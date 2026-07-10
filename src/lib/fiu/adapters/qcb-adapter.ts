/**
 * Qatar QCB/QFIU SAR Filing Adapter
 *
 * Qatar Central Bank / Qatar Financial Information Unit
 *
 * Deadline: 15 calendar days from detection // Verify with SME
 * Format: JSON // Verify exact format with SME
 * Weekend: Friday-Saturday
 * National ID: 11-digit Qatari ID
 *
 * PRINCIPLE A: Filing accuracy is criminal liability.
 * PRINCIPLE C: FORMAT ISOLATION — no goAML XML.
 *
 * Phase 4 (Actions 4.4-4.5): Qatar QCB adapter.
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

// ─── QCB SAR Form JSON Structure ──────────────────────────────────────────────

interface QCBFilingHeader {
  reportType: string;
  reportingEntityName: string;
  reportingEntityLicense: string; // Verify with SME: QCB license field name
  reportingEntityReference: string;
  countryCode: string;
  filingDate: string;
  regulatoryReference: string; // Verify with SME: exact QCB regulatory reference
}

interface QCBSubjectInformation {
  fullName: string;
  qatariId: string; // 11-digit Qatari ID
  nationality: string;
  dateOfBirth: string;
  customerType: string;
  commercialRegistrationNumber: string; // Verify with SME: Qatari CR field name/format
  address: string;
  phone: string;
  email: string;
  passportNumber: string; // Verify with SME: required for non-Qatari subjects?
}

interface QCBSuspiciousActivityDetails {
  description: string;
  activityType: string[];
  detectionDate: string;
  reportingObligation: string; // Verify with SME: exact QCB reporting obligation text
}

interface QCBTransactionDetails {
  amount: number;
  currency: string;
  date: string;
  type: string;
  originatingCountry: string;
  destinationCountry: string;
}

interface QCBMLRODecision {
  name: string;
  decision: string;
  date: string;
  notes: string;
}

interface QCBFilingPayload {
  filingHeader: QCBFilingHeader;
  subjectInformation: QCBSubjectInformation;
  suspiciousActivityDetails: QCBSuspiciousActivityDetails;
  transactionDetails: QCBTransactionDetails;
  mlroDecision: QCBMLRODecision;
  jurisdiction: string;
}

// ─── QCB Adapter Implementation ───────────────────────────────────────────────

export class QCBAdapter extends BaseFIUAdapter {
  readonly jurisdiction = 'QA' as const;
  readonly regulator = 'QCB';
  readonly fiuName = 'QFIU';
  readonly filingFormat: FilingFormat = 'JSON';
  readonly currency = 'QAR';
  readonly sarDeadlineDays = 15;
  readonly sarDeadlineUnit = 'calendar_days' as const;
  readonly weekendDays = [5, 6]; // Friday=5, Saturday=6

  // ─── Generate Filing ────────────────────────────────────────────────────────

  /**
   * Generate a QCB/QFIU-specific JSON filing payload.
   *
   * PRINCIPLE A: Filing accuracy is criminal liability.
   * PRINCIPLE C: FORMAT ISOLATION — output is QCB JSON, NOT goAML XML.
   */
  async generateFiling(payload: SARPayload): Promise<string> {
    const filingPayload: QCBFilingPayload = {
      filingHeader: {
        reportType: 'SAR',
        reportingEntityName: payload.reportingEntityName || '',
        reportingEntityLicense: payload.reportingEntityLicense || '', // Verify with SME
        reportingEntityReference: payload.reportingEntityTRN || '', // Verify with SME: TRN vs QCB reference
        countryCode: 'QA',
        filingDate: new Date().toISOString(),
        regulatoryReference: 'QCB AML/CFT Guidelines — SAR Filing Requirements', // Verify with SME: exact reference
      },
      subjectInformation: {
        fullName: payload.customerName,
        qatariId: payload.nationalId || '', // 11-digit Qatari ID
        nationality: payload.nationality || '',
        dateOfBirth: payload.dateOfBirth || '',
        customerType: payload.customerType,
        commercialRegistrationNumber: payload.commercialRegistrationNumber || '', // Verify with SME
        address: payload.address || '',
        phone: payload.phone || '',
        email: payload.email || '',
        passportNumber: payload.passportNumber || '', // Verify with SME: required for non-Qatari subjects?
      },
      suspiciousActivityDetails: {
        description: payload.suspiciousActivityDescription,
        activityType: payload.suspiciousActivityType,
        detectionDate: payload.detectionDate.toISOString(),
        reportingObligation: 'QCB AML/CFT Guidelines, Chapter 5 — Suspicious Transaction Reporting', // Verify with SME
      },
      transactionDetails: {
        amount: payload.transactionAmount || 0,
        currency: payload.transactionCurrency || 'QAR',
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
      jurisdiction: 'QA',
    };

    return JSON.stringify(filingPayload, null, 2);
  }

  // ─── Validate Filing ────────────────────────────────────────────────────────

  /**
   * Validate the SAR payload against Qatar QCB/QFIU rules.
   *
   * CRITICAL validations:
   * - Qatari ID: 11 digits, mandatory for Qatari subjects
   * - Customer name, suspicious activity description, MLRO decision are required
   * - Transaction amount must be present for transaction-based reports
   *
   * PRINCIPLE A: Filing accuracy is criminal liability.
   */
  async validateFiling(payload: SARPayload): Promise<FilingValidationResult> {
    const errors: FilingValidationError[] = [];
    const warnings: string[] = [];

    // ── Required field validations ───────────────────────────────────────────

    if (!payload.customerName || payload.customerName.trim() === '') {
      errors.push({
        field: 'customerName',
        message: 'Customer name is required for QCB SAR filing',
        severity: 'error',
      });
    }

    if (!payload.suspiciousActivityDescription || payload.suspiciousActivityDescription.trim() === '') {
      errors.push({
        field: 'suspiciousActivityDescription',
        message: 'Suspicious activity description is required for QCB SAR filing',
        severity: 'error',
      });
    }

    if (!payload.mlroDecision) {
      errors.push({
        field: 'mlroDecision',
        message: 'MLRO decision is required for QCB SAR filing',
        severity: 'error',
      });
    }

    if (!payload.mlroName || payload.mlroName.trim() === '') {
      errors.push({
        field: 'mlroName',
        message: 'MLRO name is required for QCB SAR filing',
        severity: 'error',
      });
    }

    // ── Qatari ID validation (11 digits) ─────────────────────────────────────

    if (payload.nationalId) {
      if (!this.validateQatarId(payload.nationalId)) {
        errors.push({
          field: 'nationalId',
          message: `Qatari ID must be exactly 11 digits — received "${payload.nationalId}" does not match format`,
          severity: 'error',
        });
      }
    } else {
      // Qatari ID is expected for Qatar subjects
      if (payload.customerType === 'individual') {
        warnings.push('Qatari ID (11 digits) is not provided — required for Qatari nationals and residents');
      }
    }

    // ── Commercial Registration for corporate entities ───────────────────────

    if (payload.customerType === 'corporate' && !payload.commercialRegistrationNumber) {
      warnings.push('Commercial Registration number is not provided for corporate entity — QCB may require this');
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
      warnings.push('Transaction amount is not provided — QFIU expects amount details where applicable');
    }

    // ── Deadline warning ─────────────────────────────────────────────────────

    const deadlineInfo = this.getDeadlineInfo(payload.detectionDate);
    if (deadlineInfo.isOverdue) {
      errors.push({
        field: 'detectionDate',
        message: 'The 15-calendar-day QCB filing deadline has EXCEEDED. Immediate filing required.',
        severity: 'error',
      });
    } else if (deadlineInfo.isCritical) {
      warnings.push(`URGENT: Only ${deadlineInfo.daysRemaining} day(s) remaining to file with QCB/QFIU. Deadline: ${deadlineInfo.deadlineDate.toISOString()}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ─── Validate Format ────────────────────────────────────────────────────────

  /**
   * Validate the JSON format of a generated QCB filing string.
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
          message: `Required top-level key "${key}" is missing from QCB filing payload`,
          severity: 'error',
        });
      }
    }

    // Validate jurisdiction is QA
    if ('jurisdiction' in parsed && parsed.jurisdiction !== 'QA') {
      errors.push({
        field: 'jurisdiction',
        message: `Jurisdiction must be "QA" for QCB filings — received "${parsed.jurisdiction}"`,
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
   * Submit a QCB/QFIU SAR filing.
   *
   * QCB uses a web portal — there is no publicly documented direct API.
   * This implementation operates in simulation mode by default.
   *
   * If environment variable QCB_API_URL is set, it will attempt a real API call.
   * On any failure, PRINCIPLE E mandates automatic manual fallback.
   */
  async submit(filingString: string, filingId: string): Promise<FilingResult> {
    const integrityHash = this.computeFilingHash(filingString);
    const qcbApiUrl = process.env.QCB_API_URL;

    // ── Attempt real API call if configured ──────────────────────────────────

    if (qcbApiUrl) {
      try {
        const response = await fetch(qcbApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Filing-Id': filingId,
            'X-Jurisdiction': 'QA',
            'X-Regulator': 'QCB',
          },
          body: filingString,
        });

        if (!response.ok) {
          throw new Error(`QCB API returned HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        return {
          success: true,
          filingId,
          submissionId: result.submissionId || `QCB-${Date.now()}`,
          fiuReceiptNumber: result.receiptNumber || null, // Verify with SME: QCB receipt field name
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
      submissionId: `QCB-SIM-${Date.now()}`,
      fiuReceiptNumber: null, // Verify with SME: QCB receipt format
      submittedAt: new Date().toISOString(),
      status: 'submitted_to_fiu',
      integrityHash,
      mode: 'rpa_simulation',
      retryCount: 0,
    };
  }

  // ─── Manual Fallback ────────────────────────────────────────────────────────

  /**
   * Generate a comprehensive manual fallback document for QCB/QFIU portal submission.
   *
   * PRINCIPLE E: If electronic submission fails or is unavailable, the adapter
   * MUST generate a human-readable filing document. Silent failures are not allowed.
   */
  async generateManualFallback(payload: SARPayload, reason: string): Promise<ManualFallbackDocument> {
    const deadlineInfo = this.getDeadlineInfo(payload.detectionDate);

    return {
      title: 'QCB/QFIU SAR Filing — Manual Submission Required',
      jurisdiction: 'QA',
      regulator: 'QCB',
      fiuName: this.fiuName,
      generatedAt: new Date().toISOString(),
      reason,
      submissionInstructions: [
        '1. Navigate to the Qatar Financial Information Unit (QFIU) portal', // Verify with SME: portal URL
        '2. Log in using your institution\'s QCB/QFIU portal credentials',
        '3. Navigate to "SAR Filing" → "New SAR Submission"', // Verify with SME: exact navigation labels
        '4. Select Report Type: "Suspicious Activity Report (SAR)"',
        '5. Enter the Reporting Entity details:',
        '   - Full legal name of the reporting entity',
        '   - QCB license number',
        '   - Entity reference / TRN',
        '6. Enter the Subject Information:',
        '   - Full name as per Qatari ID / identification documents',
        '   - Qatari ID (11 digits) — mandatory for Qatari nationals and residents',
        '   - For non-Qatari subjects: passport number and country of issuance', // Verify with SME
        '   - For corporate entities: Commercial Registration number', // Verify with SME
        '   - Nationality, date of birth, address, phone, email',
        '7. Enter the Suspicious Activity Details:',
        '   - Comprehensive description of the suspicious activity',
        '   - Activity type(s) from QFIU classification list', // Verify with SME: QFIU activity type codes
        '   - Detection date (this determines the 15-calendar-day deadline)',
        '8. Enter Transaction Details (if applicable):',
        '   - Amount and currency (QAR)',
        '   - Transaction date and type',
        '   - Originating and destination countries',
        '9. Enter MLRO Decision:',
        '   - MLRO name and decision (file_sar / no_suspicion)',
        '   - Decision date and any supporting notes',
        '10. Review all fields for accuracy before submission',
        '11. Submit the SAR and retain the QFIU acknowledgment reference number',
        '',
        `DEADLINE: ${deadlineInfo.isOverdue
          ? 'The 15-calendar-day QCB deadline has EXCEEDED. File immediately and document reasons for delay.'
          : `Deadline is ${deadlineInfo.deadlineDate.toISOString()}. ${deadlineInfo.daysRemaining} day(s) remaining.`
        }`,
      ],
      formFields: {
        // Filing Header
        'Report Type': 'SAR',
        'Reporting Entity Name': payload.reportingEntityName || '',
        'Reporting Entity License': payload.reportingEntityLicense || '', // Verify with SME
        'Reporting Entity Reference': payload.reportingEntityTRN || '', // Verify with SME
        'Country Code': 'QA',
        'Regulatory Reference': 'QCB AML/CFT Guidelines', // Verify with SME: exact reference

        // Subject Information
        'Full Name': payload.customerName,
        'Qatari ID': payload.nationalId || '',
        'Nationality': payload.nationality || '',
        'Date of Birth': payload.dateOfBirth || '',
        'Customer Type': payload.customerType,
        'Commercial Registration Number': payload.commercialRegistrationNumber || '', // Verify with SME
        'Address': payload.address || '',
        'Phone': payload.phone || '',
        'Email': payload.email || '',
        'Passport Number': payload.passportNumber || '', // Verify with SME

        // Suspicious Activity
        'Activity Description': payload.suspiciousActivityDescription,
        'Activity Type(s)': payload.suspiciousActivityType.join(', '),
        'Detection Date': payload.detectionDate.toISOString(),
        'Reporting Obligation': 'QCB AML/CFT Guidelines, Chapter 5', // Verify with SME

        // Transaction Details
        'Transaction Amount': payload.transactionAmount?.toString() || '0',
        'Currency': payload.transactionCurrency || 'QAR',
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
        'Days Remaining': deadlineInfo.isOverdue ? 'OVERDUE' : `${deadlineInfo.daysRemaining} days`,
      },
      payload,
      portalUrl: 'https://www.qcb.gov.qa/QFIU', // Verify with SME: actual QFIU portal URL
    };
  }

  // ─── Helper: Reconstruct SAR Payload from Filing JSON ──────────────────────

  /**
   * Reconstruct a SARPayload from the QCB filing JSON structure.
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
      jurisdiction: 'QA',
      regulator: 'QCB',
      fiuName: 'QFIU',
      detectionDate: new Date(activity.detectionDate as string || new Date()),
      filingDeadline: new Date(),
      customerId: '',
      customerName: (subject.fullName as string) || '',
      customerType: (subject.customerType as 'individual' | 'corporate') || 'individual',
      nationalId: (subject.qatariId as string) || '',
      commercialRegistrationNumber: (subject.commercialRegistrationNumber as string) || '',
      nationality: (subject.nationality as string) || '',
      dateOfBirth: (subject.dateOfBirth as string) || '',
      phone: (subject.phone as string) || '',
      email: (subject.email as string) || '',
      address: (subject.address as string) || '',
      passportNumber: (subject.passportNumber as string) || '',
      suspiciousActivityDescription: (activity.description as string) || '',
      suspiciousActivityType: (activity.activityType as string[]) || [],
      transactionAmount: (transaction.amount as number) || 0,
      transactionCurrency: (transaction.currency as string) || 'QAR',
      transactionDate: (transaction.date as string) || '',
      transactionType: (transaction.type as string) || '',
      originatingCountry: (transaction.originatingCountry as string) || '',
      destinationCountry: (transaction.destinationCountry as string) || '',
      reportingEntityName: (header.reportingEntityName as string) || '',
      reportingEntityLicense: (header.reportingEntityLicense as string) || '',
      reportingEntityTRN: (header.reportingEntityReference as string) || '',
      mlroName: (mlro.name as string) || '',
      mlroDecision: (mlro.decision as 'file_sar' | 'no_suspicion') || 'file_sar',
      mlroDecisionDate: (mlro.date as string) || '',
      mlroNotes: (mlro.notes as string) || '',
    };
  }
}
