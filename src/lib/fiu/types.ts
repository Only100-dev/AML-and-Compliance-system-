/**
 * FIU Filing Type Definitions — Multi-Jurisdictional SAR/STR Filing Architecture
 * Phase 4 (Action 4.1): Abstract the UAE goAML pipeline into a generic
 * multi-jurisdictional FIU filing architecture.
 *
 * Key Design Decisions:
 * - PRINCIPLE A: Filing accuracy is criminal liability
 * - PRINCIPLE C: Format isolation — goAML XML is UAE-only
 * - PRINCIPLE D: Audit every filing with WORM audit log + payload hash
 * - PRINCIPLE E: Mandatory manual fallback on electronic submission failure
 * - PRINCIPLE F: Maker-Checker enforcement (4-Eyes workflow)
 */

import type { GCCJurisdictionCode } from '@/lib/constants/jurisdictions';

// ─── Filing Status State Machine ─────────────────────────────────────────────
// DRAFT → PENDING_REVIEW → APPROVED → SUBMITTED_TO_FIU → ACKNOWLEDGED
// Any status can transition to REJECTED or MANUAL_FALLBACK

export type FilingStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'submitted_to_fiu'
  | 'acknowledged'
  | 'rejected'
  | 'manual_fallback';

export type FilingFormat = 'goAML_XML' | 'JSON' | 'XML' | 'CSV' | 'PDF' | 'PORTAL_FORM';

export type ReportType = 'STR' | 'SAR' | 'CTR' | 'IFT' | 'PNMR';

export type CustomerType = 'individual' | 'corporate';

// ─── SAR Filing Payload ───────────────────────────────────────────────────────

export interface SARPayload {
  /** Unique filing identifier within our system */
  filingId: string;
  /** GCC alpha-2 jurisdiction code (AE, SA, BH, QA, OM, KW) */
  jurisdiction: GCCJurisdictionCode;
  /** Regulator name (CBUAE, SAMA, CBB, QCB, CBOA, CBK) */
  regulator: string;
  /** Financial Intelligence Unit name */
  fiuName: string;
  /** Date the suspicious activity was first detected */
  detectionDate: Date;
  /** Calculated filing deadline based on jurisdiction rules */
  filingDeadline: Date;

  // ─── Customer / Subject Information ───────────────────────────────────────
  customerId: string;
  customerName: string;
  customerType: CustomerType;
  /** National ID in local format (Emirates ID, CPR, Qatari ID, etc.) */
  nationalId?: string;
  /** Commercial Registration number (for corporate entities, esp. Bahrain) */
  commercialRegistrationNumber?: string;
  nationality?: string;
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  address?: string;
  passportNumber?: string;

  // ─── Suspicious Activity Information ──────────────────────────────────────
  suspiciousActivityDescription: string;
  suspiciousActivityType: string[];
  /** Transaction amount in local currency */
  transactionAmount?: number;
  /** Currency code (AED, SAR, BHD, QAR, OMR, KWD) */
  transactionCurrency?: string;
  transactionDate?: string;
  originatingCountry?: string;
  destinationCountry?: string;
  transactionType?: string;
  accountNumber?: string;
  beneficiaryName?: string;
  beneficiaryAccount?: string;

  // ─── Reporting Entity Information ──────────────────────────────────────────
  reportingEntityName?: string;
  reportingEntityLicense?: string;
  reportingEntityTRN?: string;
  reportingEntityAddress?: string;
  reportingEntityContactPerson?: string;
  reportingEntityContactPhone?: string;

  // ─── MLRO Decision ────────────────────────────────────────────────────────
  mlroName: string;
  mlroDecision: 'file_sar' | 'no_suspicion';
  /** ISO timestamp when MLRO made the decision */
  mlroDecisionDate?: string;
  /** Additional MLRO notes or justification */
  mlroNotes?: string;
}

// ─── Filing Result ────────────────────────────────────────────────────────────

export interface FilingResult {
  success: boolean;
  filingId: string;
  submissionId: string;
  fiuReceiptNumber: string | null;
  submittedAt: string;
  status: FilingStatus;
  /** SHA-256 integrity hash of the submitted payload */
  integrityHash: string;
  /** Submission mode: direct_api, rpa_simulation, manual_fallback */
  mode: 'direct_api' | 'rpa_simulation' | 'manual_fallback';
  errorMessage?: string;
  retryCount: number;
}

// ─── Validation Result ────────────────────────────────────────────────────────

export interface FilingValidationResult {
  valid: boolean;
  errors: FilingValidationError[];
  warnings: string[];
}

export interface FilingValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

// ─── Adapter Interface ────────────────────────────────────────────────────────

/**
 * FIUFileAdapter — The contract every country adapter must implement.
 *
 * Each GCC country has its own FIU, filing format, deadline rules,
 * and validation requirements. This interface ensures a consistent
 * contract while allowing country-specific implementations.
 *
 * CRITICAL: goAML XML v4.2 is UAE-only (PRINCIPLE C: FORMAT ISOLATION).
 * It MUST NOT leak into other countries' adapters.
 */
export interface FIUFileAdapter {
  /** GCC alpha-2 jurisdiction code */
  readonly jurisdiction: GCCJurisdictionCode;
  /** Regulator name (e.g., 'CBUAE', 'SAMA', 'CBB') */
  readonly regulator: string;
  /** FIU name (e.g., 'UAE FIU', 'SAMA FIU') */
  readonly fiuName: string;
  /** Filing format for this jurisdiction */
  readonly filingFormat: FilingFormat;
  /** Local currency code */
  readonly currency: string;
  /** SAR deadline value (number of days) */
  readonly sarDeadlineDays: number;
  /** Deadline unit: calendar_days or business_days */
  readonly sarDeadlineUnit: 'calendar_days' | 'business_days';
  /** Weekend days for this jurisdiction (0=Sun, 5=Fri, 6=Sat) */
  readonly weekendDays: number[];

  /**
   * Generate a filing payload in the jurisdiction-specific format.
   * UAE: goAML XML v4.2
   * KSA: SAMA JSON format
   * Bahrain: CBB SAR Form (JSON)
   * Qatar: QCB format
   * Oman: CBOA format
   * Kuwait: CBK format
   */
  generateFiling(payload: SARPayload): Promise<string>;

  /**
   * Validate the generated filing payload against jurisdiction rules.
   * Returns validation errors and warnings.
   */
  validateFiling(payload: SARPayload): Promise<FilingValidationResult>;

  /**
   * Validate the format of a generated filing string.
   */
  validateFormat(filingString: string): Promise<FilingValidationResult>;

  /**
   * Calculate the filing deadline based on detection date and jurisdiction rules.
   * CRITICAL: Bahrain = 5 business days; UAE = 30 calendar days.
   */
  calculateDeadline(detectionDate: Date): Date;

  /**
   * Submit a filing to the jurisdiction's FIU.
   * Only callable after Maker-Checker approval (PRINCIPLE F).
   */
  submit(filingString: string, filingId: string): Promise<FilingResult>;

  /**
   * Generate a human-readable fallback document when electronic submission fails.
   * PRINCIPLE E: Mandatory manual fallback — silent failures not allowed.
   * This should return a structured object that can be rendered as PDF.
   */
  generateManualFallback(payload: SARPayload, reason: string): Promise<ManualFallbackDocument>;
}

// ─── Manual Fallback Document ─────────────────────────────────────────────────

export interface ManualFallbackDocument {
  title: string;
  jurisdiction: GCCJurisdictionCode;
  regulator: string;
  fiuName: string;
  generatedAt: string;
  reason: string;
  /** Step-by-step instructions for manual submission */
  submissionInstructions: string[];
  /** Pre-filled form fields for the jurisdiction's portal/paper form */
  formFields: Record<string, string>;
  /** The full payload for reference */
  payload: SARPayload;
  /** Portal URL if applicable */
  portalUrl?: string;
}

// ─── Deadline Info ────────────────────────────────────────────────────────────

export interface DeadlineInfo {
  detectionDate: Date;
  deadlineDate: Date;
  deadlineType: 'calendar_days' | 'business_days';
  deadlineDays: number;
  daysRemaining: number;
  isOverdue: boolean;
  isCritical: boolean; // < 3 days remaining
  jurisdiction: GCCJurisdictionCode;
  regulator: string;
}
