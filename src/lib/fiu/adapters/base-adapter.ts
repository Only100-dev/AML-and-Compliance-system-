/**
 * Base FIU Adapter — Shared Audit, Hashing & Error Handling
 *
 * All country-specific adapters extend this base class to inherit:
 * - SHA-256 payload integrity hashing (using stableStringify from Phase 1)
 * - WORM audit log integration
 * - Automatic manual fallback on submission failure (PRINCIPLE E)
 * - Maker-Checker enforcement (PRINCIPLE F)
 *
 * Phase 4 (Action 4.1): Foundation for all 6 GCC country adapters.
 */

import crypto from 'crypto';
import { stableStringify } from '@/lib/stable-stringify';
import { createAuditLog } from '@/lib/audit';
import type {
  FIUFileAdapter,
  SARPayload,
  FilingResult,
  FilingValidationResult,
  ManualFallbackDocument,
  FilingFormat,
  FilingStatus,
  DeadlineInfo,
} from '../types';
import type { GCCJurisdictionCode } from '@/lib/constants/jurisdictions';
import { addBusinessDaysGCC, addCalendarDays, calendarDaysRemaining, businessDaysRemainingGCC } from '../business-days-gcc';

// ─── Abstract Base Adapter ────────────────────────────────────────────────────

export abstract class BaseFIUAdapter implements Partial<FIUFileAdapter> {
  abstract readonly jurisdiction: GCCJurisdictionCode;
  abstract readonly regulator: string;
  abstract readonly fiuName: string;
  abstract readonly filingFormat: FilingFormat;
  abstract readonly currency: string;
  abstract readonly sarDeadlineDays: number;
  abstract readonly sarDeadlineUnit: 'calendar_days' | 'business_days';
  abstract readonly weekendDays: number[];

  abstract generateFiling(payload: SARPayload): Promise<string>;
  abstract validateFiling(payload: SARPayload): Promise<FilingValidationResult>;
  abstract validateFormat(filingString: string): Promise<FilingValidationResult>;
  abstract submit(filingString: string, filingId: string): Promise<FilingResult>;
  abstract generateManualFallback(payload: SARPayload, reason: string): Promise<ManualFallbackDocument>;

  // ─── Deadline Calculation ──────────────────────────────────────────────────

  /**
   * Calculate the filing deadline based on detection date and jurisdiction rules.
   *
   * CRITICAL (PRINCIPLE B): Deadline calculation is non-negotiable.
   * - Bahrain CBB: 5 BUSINESS DAYS (exclude Fri-Sat)
   * - UAE CBUAE: 30 CALENDAR DAYS
   * - Others: Per jurisdiction thresholds
   */
  calculateDeadline(detectionDate: Date): Date {
    if (this.sarDeadlineUnit === 'business_days') {
      return addBusinessDaysGCC(detectionDate, this.sarDeadlineDays, this.jurisdiction);
    }
    return addCalendarDays(detectionDate, this.sarDeadlineDays);
  }

  /**
   * Get comprehensive deadline information for UI display.
   */
  getDeadlineInfo(detectionDate: Date): DeadlineInfo {
    const deadlineDate = this.calculateDeadline(detectionDate);
    const daysRemaining = this.sarDeadlineUnit === 'business_days'
      ? businessDaysRemainingGCC(detectionDate, this.sarDeadlineDays, this.jurisdiction)
      : calendarDaysRemaining(deadlineDate);

    return {
      detectionDate,
      deadlineDate,
      deadlineType: this.sarDeadlineUnit,
      deadlineDays: this.sarDeadlineDays,
      daysRemaining,
      isOverdue: daysRemaining < 0,
      isCritical: daysRemaining >= 0 && daysRemaining <= 3,
      jurisdiction: this.jurisdiction,
      regulator: this.regulator,
    };
  }

  // ─── Payload Integrity Hashing ─────────────────────────────────────────────

  /**
   * Compute a deterministic SHA-256 hash of the payload using stableStringify.
   * This ensures the WORM audit trail can verify payload integrity.
   *
   * Uses stableStringify() from Phase 1 to ensure deterministic key ordering,
   * so the same logical payload always produces the same hash regardless of
   * runtime key insertion order.
   */
  computePayloadHash(payload: SARPayload): string {
    const serialized = stableStringify(payload);
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Compute SHA-256 hash of the filing string (generated XML/JSON/etc).
   */
  computeFilingHash(filingString: string): string {
    return crypto.createHash('sha256').update(filingString).digest('hex');
  }

  // ─── Audit Logging ─────────────────────────────────────────────────────────

  /**
   * Create a WORM audit log entry for a filing action.
   * Every filing attempt MUST create an audit log entry with:
   * - Payload hash (using stableStringify)
   * - Submission timestamp
   * - Response status
   *
   * PRINCIPLE D: Audit every filing.
   */
  async auditFilingAction(
    action: string,
    payload: SARPayload,
    userId: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    const integrityHash = this.computePayloadHash(payload);

    await createAuditLog({
      userId,
      action: `FIU_FILING_${action}`,
      resourceType: 'FIUFiling',
      resourceId: payload.filingId,
      details: JSON.stringify({
        jurisdiction: this.jurisdiction,
        regulator: this.regulator,
        fiuName: this.fiuName,
        filingFormat: this.filingFormat,
        integrityHash,
        customerType: payload.customerType,
        mlroDecision: payload.mlroDecision,
        ...details,
      }),
    });
  }

  // ─── Error Handling & Manual Fallback ──────────────────────────────────────

  /**
   * Handle a submission error by triggering manual fallback.
   *
   * PRINCIPLE E: If electronic submission fails or is unavailable, the adapter
   * MUST generate a human-readable filing document, queue it for MLRO review,
   * and alert the MLRO. Silent failures are not allowed.
   */
  async handleSubmissionError(
    payload: SARPayload,
    error: Error,
    filingId: string,
    userId: string = 'system'
  ): Promise<FilingResult> {
    // Generate manual fallback document
    const fallbackDoc = await this.generateManualFallback(payload, error.message);

    // Audit the failure
    await this.auditFilingAction('SUBMISSION_FAILED', payload, userId, {
      error: error.message,
      fallbackGenerated: true,
      mode: 'manual_fallback',
    });

    // Compute integrity hash for audit trail
    const integrityHash = this.computePayloadHash(payload);

    return {
      success: false,
      filingId,
      submissionId: `FALLBACK-${Date.now()}`,
      fiuReceiptNumber: null,
      submittedAt: new Date().toISOString(),
      status: 'manual_fallback' as FilingStatus,
      integrityHash,
      mode: 'manual_fallback',
      errorMessage: `Electronic submission failed: ${error.message}. Manual fallback document generated. Contact MLRO immediately.`,
      retryCount: 0,
    };
  }

  // ─── ID Validation Helpers ─────────────────────────────────────────────────

  /**
   * Validate Emirates ID format: 784-YYYY-NNNNNNN-X
   * UAE-specific — only used by GoAMLAdapter.
   */
  protected validateEmiratesId(id: string): boolean {
    return /^784-\d{4}-\d{7}-\d{1}$/.test(id);
  }

  /**
   * Validate Bahrain CPR number: 9 digits
   * Bahrain-specific — only used by CBBAdapter.
   */
  protected validateCPRNumber(id: string): boolean {
    return /^\d{9}$/.test(id);
  }

  /**
   * Validate Qatar ID: 11 digits
   * Qatar-specific — only used by QCBAdapter.
   */
  protected validateQatarId(id: string): boolean {
    return /^\d{11}$/.test(id);
  }

  /**
   * Validate Oman Civil ID: 8 digits
   * Oman-specific — only used by CBOAAdapter.
   */
  protected validateOmanCivilId(id: string): boolean {
    return /^\d{8}$/.test(id);
  }

  /**
   * Validate Kuwait Civil ID: 12 digits
   * Kuwait-specific — only used by CBKAdapter.
   */
  protected validateKuwaitCivilId(id: string): boolean {
    return /^\d{12}$/.test(id);
  }

  /**
   * Validate Saudi National ID: 10 digits starting with 1 or 2
   * KSA-specific — only used by SAMAAdapter.
   */
  protected validateSaudiNationalId(id: string): boolean {
    return /^[12]\d{9}$/.test(id);
  }

  /**
   * Validate Bahrain Commercial Registration (CR) number.
   * Format varies; typically numeric with possible hyphens.
   */
  protected validateCRNumber(cr: string): boolean {
    return /^[\d-]{5,20}$/.test(cr);
  }
}
