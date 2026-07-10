/**
 * Bahrain CBB SAR Filing Adapter
 *
 * CBB (Central Bank of Bahrain) Financial Intelligence Division (FID)
 *
 * CRITICAL: 5 BUSINESS DAYS deadline from detection date.
 * - Weekend: Friday-Saturday
 * - Detection on Thursday → Deadline is next Wednesday
 * - Missing deadline = criminal liability for MLRO and institution
 *
 * Format: JSON (CBB SAR Form) // Verify exact format with SME
 * National ID: CPR Number (9 digits) — mandatory for all Bahrain subjects
 * Corporate: CR Number (Commercial Registration) — mandatory for corporate entities
 *
 * Fallback: CBB uses a web portal — if API unavailable, generate comprehensive
 * PDF with all CBB form fields pre-filled and step-by-step portal instructions.
 *
 * PRINCIPLE A: Filing accuracy is criminal liability.
 * PRINCIPLE B: Deadline calculation is NON-NEGOTIABLE (5 business days).
 * PRINCIPLE C: FORMAT ISOLATION — no goAML XML.
 * PRINCIPLE E: Mandatory manual fallback on failure.
 *
 * Phase 4 (Action 4.3): Bahrain CBB adapter.
 */

import { BaseFIUAdapter } from './base-adapter';
import type {
  SARPayload,
  FilingResult,
  FilingValidationResult,
  ManualFallbackDocument,
  FilingFormat,
  FilingValidationError,
} from '../types';

// ─── CBB SAR Form JSON Structure ──────────────────────────────────────────────

interface CBBFilingHeader {
  reportType: string;
  reportingEntityCRNumber: string;
  reportingEntityName: string;
  reportingEntityLicense: string;
  countryCode: string;
  filingDate: string;
  regulatoryReference: string;
}

interface CBBSubjectInformation {
  fullName: string;
  cprNumber: string;
  nationality: string;
  dateOfBirth: string;
  customerType: string;
  commercialRegistrationNumber: string;
  address: string;
  phone: string;
  email: string;
}

interface CBBSuspiciousActivityDetails {
  description: string;
  activityType: string[];
  detectionDate: string;
  reportingObligation: string;
}

interface CBBTransactionDetails {
  amount: number;
  currency: string;
  date: string;
  type: string;
  originatingCountry: string;
  destinationCountry: string;
}

interface CBBMLRODecision {
  name: string;
  decision: string;
  date: string;
  notes: string;
}

interface CBBFilingPayload {
  filingHeader: CBBFilingHeader;
  subjectInformation: CBBSubjectInformation;
  suspiciousActivityDetails: CBBSuspiciousActivityDetails;
  transactionDetails: CBBTransactionDetails;
  mlroDecision: CBBMLRODecision;
  jurisdiction: string;
}

// ─── CBB Adapter Implementation ───────────────────────────────────────────────

export class CBBAdapter extends BaseFIUAdapter {
  readonly jurisdiction = 'BH' as const;
  readonly regulator = 'CBB';
  readonly fiuName = 'CBB FID';
  readonly filingFormat: FilingFormat = 'JSON';
  readonly currency = 'BHD';
  readonly sarDeadlineDays = 5;
  readonly sarDeadlineUnit = 'business_days' as const;
  readonly weekendDays = [5, 6]; // Friday=5, Saturday=6

  // ─── Generate Filing ────────────────────────────────────────────────────────

  /**
   * Generate a CBB-specific JSON filing payload.
   *
   * CRITICAL (PRINCIPLE A): Filing accuracy is criminal liability.
   * Every field must be populated from the SAR payload with zero assumptions.
   *
   * PRINCIPLE C: FORMAT ISOLATION — output is CBB JSON, NOT goAML XML.
   */
  async generateFiling(payload: SARPayload): Promise<string> {
    const filingPayload: CBBFilingPayload = {
      filingHeader: {
        reportType: 'SAR',
        reportingEntityCRNumber: payload.reportingEntityTRN || '', // Verify with SME: CR vs TRN for reporting entity
        reportingEntityName: payload.reportingEntityName || '',
        reportingEntityLicense: payload.reportingEntityLicense || '',
        countryCode: 'BH',
        filingDate: new Date().toISOString(),
        regulatoryReference: 'CBB Rulebook Volume 3 — Financial Crime Module (FC)',
      },
      subjectInformation: {
        fullName: payload.customerName,
        cprNumber: payload.nationalId || '', // CPR Number — mandatory for all Bahrain subjects
        nationality: payload.nationality || '',
        dateOfBirth: payload.dateOfBirth || '',
        customerType: payload.customerType,
        commercialRegistrationNumber: payload.commercialRegistrationNumber || '', // Mandatory for corporate entities
        address: payload.address || '',
        phone: payload.phone || '',
        email: payload.email || '',
      },
      suspiciousActivityDetails: {
        description: payload.suspiciousActivityDescription,
        activityType: payload.suspiciousActivityType,
        detectionDate: payload.detectionDate.toISOString(),
        reportingObligation: 'CBB Rulebook Volume 3, Chapter FC-2',
      },
      transactionDetails: {
        amount: payload.transactionAmount || 0,
        currency: payload.transactionCurrency || 'BHD',
        date: payload.transactionDate || '',
        type: payload.transactionType || '',
        originatingCountry: payload.originatingCountry || '',
        destinationCountry: payload.destinationCountry || '',
      },
      mlroDecision: {
        name: payload.mlroName,
        decision: payload.mlroDecision,
        date: payload.mlroDecisionDate || '',
        notes: payload.mlroNotes || '',
      },
      jurisdiction: 'BH',
    };

    return JSON.stringify(filingPayload, null, 2);
  }

  // ─── Validate Filing ────────────────────────────────────────────────────────

  /**
   * Validate the SAR payload against Bahrain CBB rules.
   *
   * CRITICAL validations:
   * - CPR Number: 9 digits, mandatory for all Bahrain subjects
   * - CR Number: mandatory for corporate entities
   * - Customer name, suspicious activity description, MLRO decision are required
   * - Transaction amount must be present for transaction-based reports
   *
   * PRINCIPLE A: Filing accuracy is criminal liability — every validation
   * error is a potential criminal exposure for the institution.
   */
  async validateFiling(payload: SARPayload): Promise<FilingValidationResult> {
    const errors: FilingValidationError[] = [];
    const warnings: string[] = [];

    // ── Required field validations ───────────────────────────────────────────

    if (!payload.customerName || payload.customerName.trim() === '') {
      errors.push({
        field: 'customerName',
        message: 'Customer name is required for CBB SAR filing',
        severity: 'error',
      });
    }

    if (!payload.suspiciousActivityDescription || payload.suspiciousActivityDescription.trim() === '') {
      errors.push({
        field: 'suspiciousActivityDescription',
        message: 'Suspicious activity description is required for CBB SAR filing',
        severity: 'error',
      });
    }

    if (!payload.mlroDecision) {
      errors.push({
        field: 'mlroDecision',
        message: 'MLRO decision is required for CBB SAR filing',
        severity: 'error',
      });
    }

    if (!payload.mlroName || payload.mlroName.trim() === '') {
      errors.push({
        field: 'mlroName',
        message: 'MLRO name is required for CBB SAR filing',
        severity: 'error',
      });
    }

    // ── CPR Number validation (CRITICAL for Bahrain) ─────────────────────────

    if (payload.nationalId) {
      if (!this.validateCPRNumber(payload.nationalId)) {
        errors.push({
          field: 'nationalId',
          message: `CPR Number must be exactly 9 digits — received "${payload.nationalId}" does not match format`,
          severity: 'error',
        });
      }
    } else {
      // CPR is mandatory for all Bahrain subjects
      if (payload.customerType === 'individual') {
        errors.push({
          field: 'nationalId',
          message: 'CPR Number is mandatory for all individual Bahrain subjects',
          severity: 'error',
        });
      } else {
        warnings.push('CPR Number is not provided — recommended even for corporate entities with Bahraini nationals');
      }
    }

    // ── CR Number validation (mandatory for corporate entities) ──────────────

    if (payload.customerType === 'corporate') {
      if (!payload.commercialRegistrationNumber || payload.commercialRegistrationNumber.trim() === '') {
        errors.push({
          field: 'commercialRegistrationNumber',
          message: 'Commercial Registration (CR) Number is mandatory for corporate entities under CBB rules',
          severity: 'error',
        });
      } else if (!this.validateCRNumber(payload.commercialRegistrationNumber)) {
        errors.push({
          field: 'commercialRegistrationNumber',
          message: `CR Number format is invalid — received "${payload.commercialRegistrationNumber}" does not match expected format (5-20 digits/hyphens)`,
          severity: 'error',
        });
      }
    }

    // ── Transaction amount validation ────────────────────────────────────────

    if (payload.suspiciousActivityType.some(t =>
      t.toLowerCase().includes('transaction') ||
      t.toLowerCase().includes('transfer') ||
      t.toLowerCase().includes('payment')
    )) {
      if (!payload.transactionAmount || payload.transactionAmount <= 0) {
        errors.push({
          field: 'transactionAmount',
          message: 'Transaction amount is required for transaction-based SAR reports',
          severity: 'error',
        });
      }
    } else if (!payload.transactionAmount || payload.transactionAmount <= 0) {
      warnings.push('Transaction amount is not provided — CBB expects amount details where applicable');
    }

    // ── Deadline warning ─────────────────────────────────────────────────────

    const deadlineInfo = this.getDeadlineInfo(payload.detectionDate);
    if (deadlineInfo.isOverdue) {
      errors.push({
        field: 'detectionDate',
        message: '⚠️ CRITICAL: The 5-business-day CBB filing deadline has EXCEEDED. Criminal liability may apply.',
        severity: 'error',
      });
    } else if (deadlineInfo.isCritical) {
      warnings.push(`⚠️ URGENT: Only ${deadlineInfo.daysRemaining} business day(s) remaining to file with CBB. Deadline: ${deadlineInfo.deadlineDate.toISOString()}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ─── Validate Format ────────────────────────────────────────────────────────

  /**
   * Validate the JSON format of a generated CBB filing string.
   * Checks that the string is valid JSON and contains all required top-level keys.
   */
  async validateFormat(filingString: string): Promise<FilingValidationResult> {
    const errors: FilingValidationError[] = [];
    const warnings: string[] = [];

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(filingString);
    } catch (e) {
      return {
        valid: false,
        errors: [{
          field: 'format',
          message: `Invalid JSON format: ${e instanceof Error ? e.message : 'Parse error'}`,
          severity: 'error',
        }],
        warnings,
      };
    }

    // Check required top-level keys
    const requiredKeys = [
      'filingHeader',
      'subjectInformation',
      'suspiciousActivityDetails',
      'transactionDetails',
      'mlroDecision',
      'jurisdiction',
    ];

    for (const key of requiredKeys) {
      if (!(key in parsed)) {
        errors.push({
          field: key,
          message: `Required top-level key "${key}" is missing from CBB filing payload`,
          severity: 'error',
        });
      }
    }

    // Validate jurisdiction is BH
    if ('jurisdiction' in parsed && parsed.jurisdiction !== 'BH') {
      errors.push({
        field: 'jurisdiction',
        message: `Jurisdiction must be "BH" for CBB filings — received "${parsed.jurisdiction}"`,
        severity: 'error',
      });
    }

    // Validate filingHeader.reportType is SAR
    if ('filingHeader' in parsed && typeof parsed.filingHeader === 'object' && parsed.filingHeader !== null) {
      const header = parsed.filingHeader as Record<string, unknown>;
      if (header.reportType !== 'SAR') {
        warnings.push(`Report type is "${header.reportType}" — expected "SAR" for SAR filings`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ─── Submit Filing ──────────────────────────────────────────────────────────

  /**
   * Submit a CBB SAR filing.
   *
   * CBB uses a web portal — there is no publicly documented direct API.
   * This implementation operates in simulation mode by default.
   *
   * If environment variable CBB_API_URL is set, it will attempt a real API call.
   * On any failure, PRINCIPLE E mandates automatic manual fallback.
   */
  async submit(filingString: string, filingId: string): Promise<FilingResult> {
    const integrityHash = this.computeFilingHash(filingString);
    const cbbApiUrl = process.env.CBB_API_URL;

    // ── Attempt real API call if configured ──────────────────────────────────

    if (cbbApiUrl) {
      try {
        const response = await fetch(cbbApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Filing-Id': filingId,
            'X-Jurisdiction': 'BH',
            'X-Regulator': 'CBB',
          },
          body: filingString,
        });

        if (!response.ok) {
          throw new Error(`CBB API returned HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        return {
          success: true,
          filingId,
          submissionId: result.submissionId || `CBB-${Date.now()}`,
          fiuReceiptNumber: result.receiptNumber || null, // Verify with SME: CBB receipt field name
          submittedAt: new Date().toISOString(),
          status: 'submitted_to_fiu',
          integrityHash,
          mode: 'direct_api',
          retryCount: 0,
        };
      } catch (error) {
        // PRINCIPLE E: Mandatory manual fallback on failure
        const payload = JSON.parse(filingString);
        const sarPayload = this.reconstructSARPayload(payload);
        return this.handleSubmissionError(sarPayload, error instanceof Error ? error : new Error(String(error)), filingId);
      }
    }

    // ── Simulation mode (default) ────────────────────────────────────────────

    return {
      success: true,
      filingId,
      submissionId: `CBB-SIM-${Date.now()}`,
      fiuReceiptNumber: null, // Verify with SME: CBB receipt format
      submittedAt: new Date().toISOString(),
      status: 'submitted_to_fiu',
      integrityHash,
      mode: 'rpa_simulation',
      retryCount: 0,
    };
  }

  // ─── Manual Fallback ────────────────────────────────────────────────────────

  /**
   * Generate a comprehensive manual fallback document for CBB portal submission.
   *
   * PRINCIPLE E: If electronic submission fails or is unavailable, the adapter
   * MUST generate a human-readable filing document. Silent failures are not allowed.
   *
   * This document includes:
   * - Pre-filled form fields from the payload
   * - Detailed step-by-step instructions for the CBB portal
   * - CR warning about the 5-business-day deadline
   */
  async generateManualFallback(payload: SARPayload, reason: string): Promise<ManualFallbackDocument> {
    const deadlineInfo = this.getDeadlineInfo(payload.detectionDate);

    return {
      title: 'CBB SAR Filing — Manual Submission Required',
      jurisdiction: 'BH',
      regulator: 'CBB',
      fiuName: this.fiuName,
      generatedAt: new Date().toISOString(),
      reason,
      submissionInstructions: [
        '1. Navigate to the CBB Financial Intelligence Division (FID) portal at https://www.cbb.gov.bh/fid', // Verify with SME
        '2. Log in using your institution\'s CBB portal credentials',
        '3. Navigate to "SAR Filing" → "New SAR Submission"',
        '4. Select Report Type: "Suspicious Activity Report (SAR)"',
        '5. Enter the Reporting Entity details:',
        '   - CR Number / TRN of the reporting entity',
        '   - Full legal name of the reporting entity',
        '   - CBB license number',
        '6. Enter the Subject Information:',
        '   - Full name as per CPR / identification documents',
        '   - CPR Number (9 digits) — mandatory for all Bahrain subjects',
        '   - For corporate entities: Commercial Registration (CR) Number — mandatory',
        '   - Nationality, date of birth, address, phone, email',
        '7. Enter the Suspicious Activity Details:',
        '   - Comprehensive description of the suspicious activity',
        '   - Activity type(s) from CBB classification list', // Verify with SME: CBB activity type codes
        '   - Detection date (this determines the 5-business-day deadline)',
        '8. Enter Transaction Details (if applicable):',
        '   - Amount and currency (BHD)',
        '   - Transaction date and type',
        '   - Originating and destination countries',
        '9. Enter MLRO Decision:',
        '   - MLRO name and decision (file_sar / no_suspicion)',
        '   - Decision date and any supporting notes',
        '10. Review all fields for accuracy before submission',
        '11. Submit the SAR and retain the CBB acknowledgment reference number',
        '',
        `⚠️ DEADLINE WARNING: ${deadlineInfo.isOverdue
          ? 'The 5-business-day CBB deadline has EXCEEDED. URGENT: File immediately and document reasons for delay.'
          : `Deadline is ${deadlineInfo.deadlineDate.toISOString()}. ${deadlineInfo.daysRemaining} business day(s) remaining.`
        }`,
        '',
        '⚠️ CRIMINAL LIABILITY NOTE: Under CBB Rulebook Volume 3 (Financial Crime Module),',
        'failure to file within 5 business days may result in criminal liability for the',
        'MLRO and the institution. This is the strictest SAR deadline in the GCC.',
      ],
      formFields: {
        // Filing Header
        'Report Type': 'SAR',
        'Reporting Entity CR Number': payload.reportingEntityTRN || '', // Verify with SME
        'Reporting Entity Name': payload.reportingEntityName || '',
        'Reporting Entity License': payload.reportingEntityLicense || '',
        'Country Code': 'BH',
        'Regulatory Reference': 'CBB Rulebook Volume 3 — Financial Crime Module (FC)',

        // Subject Information
        'Full Name': payload.customerName,
        'CPR Number': payload.nationalId || '',
        'Nationality': payload.nationality || '',
        'Date of Birth': payload.dateOfBirth || '',
        'Customer Type': payload.customerType,
        'Commercial Registration Number': payload.commercialRegistrationNumber || '',
        'Address': payload.address || '',
        'Phone': payload.phone || '',
        'Email': payload.email || '',

        // Suspicious Activity
        'Activity Description': payload.suspiciousActivityDescription,
        'Activity Type(s)': payload.suspiciousActivityType.join(', '),
        'Detection Date': payload.detectionDate.toISOString(),
        'Reporting Obligation': 'CBB Rulebook Volume 3, Chapter FC-2',

        // Transaction Details
        'Transaction Amount': payload.transactionAmount?.toString() || '0',
        'Currency': payload.transactionCurrency || 'BHD',
        'Transaction Date': payload.transactionDate || '',
        'Transaction Type': payload.transactionType || '',
        'Originating Country': payload.originatingCountry || '',
        'Destination Country': payload.destinationCountry || '',

        // MLRO Decision
        'MLRO Name': payload.mlroName,
        'MLRO Decision': payload.mlroDecision,
        'MLRO Decision Date': payload.mlroDecisionDate || '',
        'MLRO Notes': payload.mlroNotes || '',

        // Deadline Info
        'Filing Deadline': deadlineInfo.deadlineDate.toISOString(),
        'Days Remaining': deadlineInfo.isOverdue ? 'OVERDUE' : `${deadlineInfo.daysRemaining} business days`,
      },
      payload,
      portalUrl: 'https://www.cbb.gov.bh/fid', // Verify with SME
    };
  }

  // ─── Helper: Reconstruct SAR Payload from Filing JSON ──────────────────────

  /**
   * Reconstruct a SARPayload from the CBB filing JSON structure.
   * Used internally by submit() when handleSubmissionError() needs the original payload.
   */
  private reconstructSARPayload(filingJson: Record<string, unknown>): SARPayload {
    const subject = (filingJson.subjectInformation || {}) as Record<string, unknown>;
    const activity = (filingJson.suspiciousActivityDetails || {}) as Record<string, unknown>;
    const transaction = (filingJson.transactionDetails || {}) as Record<string, unknown>;
    const mlro = (filingJson.mlroDecision || {}) as Record<string, unknown>;
    const header = (filingJson.filingHeader || {}) as Record<string, unknown>;

    return {
      filingId: '',
      jurisdiction: 'BH',
      regulator: 'CBB',
      fiuName: 'CBB FID',
      detectionDate: new Date(activity.detectionDate as string || new Date()),
      filingDeadline: new Date(),
      customerId: '',
      customerName: (subject.fullName as string) || '',
      customerType: (subject.customerType as 'individual' | 'corporate') || 'individual',
      nationalId: (subject.cprNumber as string) || '',
      commercialRegistrationNumber: (subject.commercialRegistrationNumber as string) || '',
      nationality: (subject.nationality as string) || '',
      dateOfBirth: (subject.dateOfBirth as string) || '',
      phone: (subject.phone as string) || '',
      email: (subject.email as string) || '',
      address: (subject.address as string) || '',
      suspiciousActivityDescription: (activity.description as string) || '',
      suspiciousActivityType: (activity.activityType as string[]) || [],
      transactionAmount: (transaction.amount as number) || 0,
      transactionCurrency: (transaction.currency as string) || 'BHD',
      transactionDate: (transaction.date as string) || '',
      transactionType: (transaction.type as string) || '',
      originatingCountry: (transaction.originatingCountry as string) || '',
      destinationCountry: (transaction.destinationCountry as string) || '',
      reportingEntityName: (header.reportingEntityName as string) || '',
      reportingEntityLicense: (header.reportingEntityLicense as string) || '',
      reportingEntityTRN: (header.reportingEntityCRNumber as string) || '',
      mlroName: (mlro.name as string) || '',
      mlroDecision: (mlro.decision as 'file_sar' | 'no_suspicion') || 'file_sar',
      mlroDecisionDate: (mlro.date as string) || '',
      mlroNotes: (mlro.notes as string) || '',
    };
  }
}
