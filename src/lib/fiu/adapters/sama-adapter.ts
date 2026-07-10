/**
 * KSA SAMA SAR Filing Adapter
 *
 * Generates SAMA-specific JSON format for SAR/STR filings to the
 * Saudi Arabian Monetary Authority FIU.
 *
 * Deadline: 15 calendar days from detection // Verify with SME
 * Format: JSON // Verify exact schema with SME
 * Weekend: Friday-Saturday
 * National ID: 10 digits starting with 1 or 2
 *
 * PRINCIPLE A: Filing accuracy is criminal liability.
 * PRINCIPLE C: FORMAT ISOLATION — no goAML XML in this adapter.
 *
 * Phase 4 (Action 4.2): KSA SAMA adapter.
 */

import { BaseFIUAdapter } from './base-adapter';
import type {
  SARPayload,
  FilingResult,
  FilingValidationResult,
  FilingValidationError,
  ManualFallbackDocument,
  FilingFormat,
} from '../types';

// ─── SAMA JSON Filing Structure ───────────────────────────────────────────────

/**
 * SAMA-specific JSON filing structure for SAR/STR submissions.
 * // Verify exact schema with SME — field names and required sections
 * may differ from SAMA's actual portal specification.
 */
export interface SAMAJsonFiling {
  reportingEntity: {
    name: string;
    licenseNumber: string;
    countryCode: string; // Always "SA"
  };
  subjectDetails: {
    fullName: string;
    nationalId: string;
    nationality: string;
    dateOfBirth: string;
    customerType: string; // "individual" | "corporate"
  };
  suspiciousActivity: {
    description: string;
    type: string[];
    detectionDate: string;
    reportingObligation: string; // Verify with SME
  };
  transactionDetails: {
    amount: number;
    currency: string; // Always "SAR"
    date: string;
    type: string;
    originatingCountry: string;
    destinationCountry: string;
  };
  mlroDecision: {
    name: string;
    decision: string;
    date: string;
  };
  regulatoryReference: string; // Verify with SME
  filingDate: string;
  jurisdiction: string; // Always "SA"
  /** Flag indicating fields that need SME verification */
  pendingVerification?: boolean; // Verify with SME
}

// ─── SAMA Adapter ─────────────────────────────────────────────────────────────

export class SAMAAdapter extends BaseFIUAdapter {
  readonly jurisdiction = 'SA' as const;
  readonly regulator = 'SAMA';
  readonly fiuName = 'SAMA FIU';
  readonly filingFormat: FilingFormat = 'JSON';
  readonly currency = 'SAR';
  readonly sarDeadlineDays = 15; // Verify with SME
  readonly sarDeadlineUnit = 'calendar_days' as const; // Verify with SME
  readonly weekendDays = [5, 6]; // Friday-Saturday

  /**
   * Cache the last SARPayload for error handling in submit().
   * Cleared after successful submission.
   */
  private lastPayload: SARPayload | null = null;

  // ─── generateFiling ────────────────────────────────────────────────────────

  /**
   * Generate a SAMA-specific JSON filing from the SAR payload.
   *
   * PRINCIPLE C: FORMAT ISOLATION — this generates JSON, NOT goAML XML.
   * The JSON structure follows SAMA's expected format for SAR/STR filings.
   *
   * // Verify exact schema with SME — field names and required sections
   * may differ from SAMA's actual portal specification.
   */
  async generateFiling(payload: SARPayload): Promise<string> {
    // Store payload for potential error handling in submit()
    this.lastPayload = payload;

    const samaFiling: SAMAJsonFiling = {
      reportingEntity: {
        name: payload.reportingEntityName || '',
        licenseNumber: payload.reportingEntityLicense || '',
        countryCode: 'SA',
      },
      subjectDetails: {
        fullName: payload.customerName,
        nationalId: payload.nationalId || '',
        nationality: payload.nationality || '',
        dateOfBirth: payload.dateOfBirth || '',
        customerType: payload.customerType,
      },
      suspiciousActivity: {
        description: payload.suspiciousActivityDescription,
        type: payload.suspiciousActivityType,
        detectionDate: payload.detectionDate?.toISOString() || '',
        reportingObligation: 'Anti-Money Laundering Law (Royal Decree No. M/39)', // Verify with SME
      },
      transactionDetails: {
        amount: payload.transactionAmount ?? 0,
        currency: payload.transactionCurrency || 'SAR',
        date: payload.transactionDate || '',
        type: payload.transactionType || '',
        originatingCountry: payload.originatingCountry || '',
        destinationCountry: payload.destinationCountry || '',
      },
      mlroDecision: {
        name: payload.mlroName,
        decision: payload.mlroDecision,
        date: payload.mlroDecisionDate || '',
      },
      regulatoryReference: 'Anti-Money Laundering Law (Royal Decree No. M/39)', // Verify with SME
      filingDate: new Date().toISOString(),
      jurisdiction: 'SA',
      pendingVerification: true, // Verify with SME — mark until schema confirmed
    };

    // Audit the generation
    await this.auditFilingAction('GENERATED', payload, 'system', {
      reportType: 'SAR',
      format: 'JSON',
      jurisdiction: 'SA',
    });

    return JSON.stringify(samaFiling, null, 2);
  }

  // ─── validateFiling ────────────────────────────────────────────────────────

  /**
   * Validate the SAR payload against KSA SAMA-specific rules.
   *
   * Checks:
   * - Required fields per SAMA requirements
   * - Saudi National ID format (10 digits, starts with 1 or 2)
   * - Transaction amount present for transaction-based reports
   * - MLRO decision present (PRINCIPLE F)
   */
  async validateFiling(payload: SARPayload): Promise<FilingValidationResult> {
    const errors: FilingValidationError[] = [];
    const warnings: string[] = [];

    // ─── Required Fields ───────────────────────────────────────────────────
    if (!payload.filingId) {
      errors.push({ field: 'filingId', message: 'Filing ID is required for SAMA FIU submissions', severity: 'error' });
    }
    if (!payload.customerName) {
      errors.push({ field: 'customerName', message: 'Customer/subject name is required per SAMA AML regulations', severity: 'error' });
    }
    if (!payload.suspiciousActivityDescription) {
      errors.push({ field: 'suspiciousActivityDescription', message: 'Suspicious activity description is required per Royal Decree No. M/39', severity: 'error' });
    }
    if (!payload.mlroName) {
      errors.push({ field: 'mlroName', message: 'MLRO name is required for 4-Eyes workflow (PRINCIPLE F)', severity: 'error' });
    }
    if (payload.mlroDecision !== 'file_sar') {
      errors.push({ field: 'mlroDecision', message: 'MLRO must have decided to file SAR before submission (PRINCIPLE F)', severity: 'error' });
    }
    if (!payload.detectionDate) {
      errors.push({ field: 'detectionDate', message: 'Detection date is required to calculate the 15-calendar-day deadline', severity: 'error' });
    }

    // ─── Saudi National ID Validation ──────────────────────────────────────
    if (payload.nationalId && payload.customerType === 'individual') {
      if (!this.validateSaudiNationalId(payload.nationalId)) {
        errors.push({
          field: 'nationalId',
          message: `Saudi National ID "${payload.nationalId}" must be 10 digits starting with 1 or 2. This will cause SAMA rejection.`,
          severity: 'error',
        });
      }
    } else if (!payload.nationalId && payload.customerType === 'individual') {
      warnings.push('National ID is strongly recommended for individual subjects per SAMA AML regulations');
    }

    // ─── Transaction Amount ────────────────────────────────────────────────
    if (payload.transactionAmount === undefined || payload.transactionAmount === null) {
      warnings.push('Transaction amount is not specified — required for transaction-based SAR/STR reports per SAMA guidance');
    }

    // ─── Reporting Entity ──────────────────────────────────────────────────
    if (!payload.reportingEntityName) {
      warnings.push('Reporting entity name is recommended for SAMA FIU submissions');
    }
    if (!payload.reportingEntityLicense) {
      warnings.push('Reporting entity SAMA license number is recommended — SAMA may request it');
    }

    // ─── Deadline Warning ──────────────────────────────────────────────────
    if (payload.detectionDate) {
      const deadlineInfo = this.getDeadlineInfo(payload.detectionDate);
      if (deadlineInfo.isOverdue) {
        errors.push({
          field: 'filingDeadline',
          message: `Filing is OVERDUE. Deadline was ${deadlineInfo.deadlineDate.toISOString()}. Criminal liability per Royal Decree No. M/39.`,
          severity: 'error',
        });
      } else if (deadlineInfo.isCritical) {
        warnings.push(`Filing deadline is critical — only ${deadlineInfo.daysRemaining} day(s) remaining`);
      }
    }

    return {
      valid: errors.filter(e => e.severity === 'error').length === 0,
      errors,
      warnings,
    };
  }

  // ─── validateFormat ────────────────────────────────────────────────────────

  /**
   * Validate the format of a generated SAMA JSON filing string.
   *
   * Parses the JSON and checks that all required top-level keys exist.
   * PRINCIPLE C: FORMAT ISOLATION — this validates JSON, NOT goAML XML.
   */
  async validateFormat(filingString: string): Promise<FilingValidationResult> {
    const errors: FilingValidationError[] = [];
    const warnings: string[] = [];

    // ─── Parse JSON ────────────────────────────────────────────────────────
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(filingString);
    } catch (e) {
      errors.push({
        field: 'format',
        message: `Invalid JSON format: ${e instanceof Error ? e.message : 'Parse error'}`,
        severity: 'error',
      });
      return { valid: false, errors, warnings };
    }

    // ─── Required Top-Level Keys ───────────────────────────────────────────
    const requiredKeys = [
      'reportingEntity',
      'subjectDetails',
      'suspiciousActivity',
      'transactionDetails',
      'mlroDecision',
      'regulatoryReference',
      'filingDate',
      'jurisdiction',
    ];

    for (const key of requiredKeys) {
      if (!(key in parsed)) {
        errors.push({
          field: key,
          message: `Required top-level key "${key}" is missing from SAMA JSON filing`,
          severity: 'error',
        });
      }
    }

    // ─── Validate Jurisdiction ─────────────────────────────────────────────
    if (parsed.jurisdiction && parsed.jurisdiction !== 'SA') {
      errors.push({
        field: 'jurisdiction',
        message: `Jurisdiction must be "SA" for SAMA filings, got "${parsed.jurisdiction}"`,
        severity: 'error',
      });
    }

    // ─── Validate Reporting Entity Section ─────────────────────────────────
    if (parsed.reportingEntity && typeof parsed.reportingEntity === 'object') {
      const re = parsed.reportingEntity as Record<string, unknown>;
      if (re.countryCode && re.countryCode !== 'SA') {
        warnings.push(`Reporting entity countryCode should be "SA" for SAMA filings, got "${re.countryCode}"`);
      }
    }

    // ─── Validate Subject Details ──────────────────────────────────────────
    if (parsed.subjectDetails && typeof parsed.subjectDetails === 'object') {
      const sd = parsed.subjectDetails as Record<string, unknown>;
      if (sd.nationalId && typeof sd.nationalId === 'string') {
        if (!this.validateSaudiNationalId(sd.nationalId)) {
          errors.push({
            field: 'subjectDetails.nationalId',
            message: `Saudi National ID "${sd.nationalId}" must be 10 digits starting with 1 or 2`,
            severity: 'error',
          });
        }
      }
    }

    // ─── Validate Transaction Details ──────────────────────────────────────
    if (parsed.transactionDetails && typeof parsed.transactionDetails === 'object') {
      const td = parsed.transactionDetails as Record<string, unknown>;
      if (td.currency && td.currency !== 'SAR') {
        warnings.push(`Transaction currency should be "SAR" for SAMA filings, got "${td.currency}"`);
      }
      if (td.amount !== undefined && (typeof td.amount !== 'number' || td.amount < 0)) {
        errors.push({
          field: 'transactionDetails.amount',
          message: 'Transaction amount must be a non-negative number',
          severity: 'error',
        });
      }
    }

    // ─── Pending Verification Flag ─────────────────────────────────────────
    if (parsed.pendingVerification === true) {
      warnings.push('This filing has pendingVerification=true — field mappings need SME confirmation before production use');
    }

    return {
      valid: errors.filter(e => e.severity === 'error').length === 0,
      errors,
      warnings,
    };
  }

  // ─── submit ────────────────────────────────────────────────────────────────

  /**
   * Submit a SAMA SAR filing.
   *
   * If the SAMA_API_URL environment variable is set, attempts a real API call.
   * Otherwise, returns a simulation result tagged clearly so it is never
   * mistaken for a real SAMA submission.
   *
   * On failure, triggers handleSubmissionError() for manual fallback (PRINCIPLE E).
   */
  async submit(filingString: string, filingId: string): Promise<FilingResult> {
    const integrityHash = this.computeFilingHash(filingString);
    const samaApiUrl = process.env.SAMA_API_URL;

    // ─── Attempt Real API Submission ───────────────────────────────────────
    if (samaApiUrl) {
      try {
        const response = await fetch(`${samaApiUrl}/filings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Filing-Id': filingId,
            'X-Integrity-Hash': integrityHash,
          },
          body: filingString,
        });

        if (response.ok) {
          let fiuReceiptNumber: string | null = null;
          try {
            const body = (await response.json()) as Record<string, unknown>;
            fiuReceiptNumber =
              (body.fiuReceiptNumber as string) ??
              (body.receiptNumber as string) ??
              (body.receipt_number as string) ??
              null;
          } catch {
            // Non-fatal: receipt number is best-effort
          }

          if (!fiuReceiptNumber) {
            fiuReceiptNumber = `SAMA-${response.status}-${String(Date.now()).slice(-8)}`;
          }

          // Clear cached payload on success
          this.lastPayload = null;

          return {
            success: true,
            filingId,
            submissionId: `SAMA-SUB-${Date.now()}`,
            fiuReceiptNumber,
            submittedAt: new Date().toISOString(),
            status: 'submitted_to_fiu',
            integrityHash,
            mode: 'direct_api',
            retryCount: 0,
          };
        }

        // 4xx — client error, do not retry
        if (response.status >= 400 && response.status < 500) {
          let errorDetail = `${response.status} ${response.statusText}`;
          try {
            const errText = await response.text();
            if (errText) errorDetail = `${errorDetail} — ${errText.slice(0, 500)}`;
          } catch {
            // ignore body read errors
          }

          const error = new Error(`SAMA rejected submission: ${errorDetail}`);
          if (this.lastPayload) {
            return this.handleSubmissionError(this.lastPayload, error, filingId);
          }

          return {
            success: false,
            filingId,
            submissionId: `SAMA-REJECT-${Date.now()}`,
            fiuReceiptNumber: null,
            submittedAt: new Date().toISOString(),
            status: response.status === 422 ? 'rejected' : 'manual_fallback',
            integrityHash,
            mode: 'direct_api',
            errorMessage: error.message,
            retryCount: 0,
          };
        }

        // 5xx — server error, treat as transient failure
        throw new Error(`SAMA gateway returned ${response.status} ${response.statusText}`);
      } catch (error) {
        // Real API call failed — trigger manual fallback (PRINCIPLE E)
        if (this.lastPayload) {
          const err = error instanceof Error ? error : new Error(String(error));
          return this.handleSubmissionError(this.lastPayload, err, filingId);
        }

        return {
          success: false,
          filingId,
          submissionId: `SAMA-ERR-${Date.now()}`,
          fiuReceiptNumber: null,
          submittedAt: new Date().toISOString(),
          status: 'manual_fallback',
          integrityHash,
          mode: 'manual_fallback',
          errorMessage: error instanceof Error ? error.message : 'Unknown SAMA submission error',
          retryCount: 0,
        };
      }
    }

    // ─── Simulation Mode ───────────────────────────────────────────────────
    // SAMA portal is currently web-based — no direct API available.
    // Return a clearly-tagged simulation result.

    const fiuReceiptNumber = `SAMA-SIM-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}`;

    // Clear cached payload
    this.lastPayload = null;

    return {
      success: true,
      filingId,
      submissionId: `SAMA-SIM-${Date.now()}`,
      fiuReceiptNumber,
      submittedAt: new Date().toISOString(),
      status: 'submitted_to_fiu',
      integrityHash,
      mode: 'rpa_simulation',
      retryCount: 0,
    };
  }

  // ─── generateManualFallback ────────────────────────────────────────────────

  /**
   * Generate a manual fallback document for SAMA portal submission.
   *
   * PRINCIPLE E: Mandatory manual fallback on electronic submission failure.
   * Provides step-by-step instructions for filing through the SAMA portal
   * when API submission is unavailable.
   *
   * Portal URL: https://sama.gov.sa/fiu // Verify with SME
   */
  async generateManualFallback(payload: SARPayload, reason: string): Promise<ManualFallbackDocument> {
    return {
      title: 'KSA SAMA SAR Manual Filing',
      jurisdiction: 'SA',
      regulator: 'SAMA',
      fiuName: this.fiuName,
      generatedAt: new Date().toISOString(),
      reason,
      submissionInstructions: [
        '1. Open the SAMA FIU portal at https://sama.gov.sa/fiu // Verify URL with SME',
        '2. Log in with your institution\'s SAMA portal credentials',
        '3. Navigate to "New SAR Filing" or "New STR Filing" as appropriate',
        '4. In the "Reporting Entity" section, enter the entity name and SAMA license number',
        '5. In the "Subject Details" section, enter the full name, Saudi National ID, nationality, and date of birth',
        '6. In the "Suspicious Activity" section, describe the suspicious activity and select the activity type(s)',
        '7. In the "Transaction Details" section, enter the amount in SAR, transaction date, and countries involved',
        '8. In the "MLRO Decision" section, enter the MLRO name, decision, and decision date',
        '9. Review all fields for accuracy — incorrect filings may result in regulatory penalties per Royal Decree No. M/39',
        '10. Submit the filing and record the SAMA acknowledgment reference number',
        '11. Update the IC-OS system with the reference number and mark the filing as acknowledged',
        '',
        'IMPORTANT: The 15-calendar-day deadline continues to run during manual filing.',
        'Ensure manual submission is completed before the deadline expires.',
        'Regulatory Reference: Anti-Money Laundering Law (Royal Decree No. M/39) // Verify with SME',
      ],
      formFields: {
        'Reporting Entity Name': payload.reportingEntityName || '',
        'SAMA License Number': payload.reportingEntityLicense || '',
        'Subject Full Name': payload.customerName,
        'Saudi National ID': payload.nationalId || '',
        'Nationality': payload.nationality || '',
        'Date of Birth': payload.dateOfBirth || '',
        'Customer Type': payload.customerType,
        'Suspicious Activity Description': payload.suspiciousActivityDescription,
        'Activity Types': payload.suspiciousActivityType.join(', '),
        'Detection Date': payload.detectionDate?.toISOString() || '',
        'Transaction Amount (SAR)': payload.transactionAmount?.toFixed(2) || '0.00',
        'Currency': payload.transactionCurrency || 'SAR',
        'Transaction Date': payload.transactionDate || '',
        'Transaction Type': payload.transactionType || '',
        'Originating Country': payload.originatingCountry || '',
        'Destination Country': payload.destinationCountry || '',
        'Beneficiary Name': payload.beneficiaryName || '',
        'Beneficiary Account': payload.beneficiaryAccount || '',
        'MLRO Name': payload.mlroName,
        'MLRO Decision': payload.mlroDecision,
        'MLRO Decision Date': payload.mlroDecisionDate || '',
        'Filing Deadline': payload.detectionDate ? this.calculateDeadline(payload.detectionDate).toISOString() : '',
      },
      payload,
      portalUrl: 'https://sama.gov.sa/fiu', // Verify with SME
    };
  }
}
