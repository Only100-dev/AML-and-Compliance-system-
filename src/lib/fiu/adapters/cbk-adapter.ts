/**
 * Kuwait CBK/KFIU SAR Filing Adapter
 *
 * Central Bank of Kuwait / Kuwait Financial Intelligence Unit
 *
 * Deadline: 15 calendar days from detection // Verify with SME
 * Format: JSON // Verify exact format with SME
 * Weekend: Friday-Saturday
 * National ID: 12-digit Kuwaiti Civil ID
 *
 * IMPORTANT: PIFSS contributions and Kuwaitization rules apply only
 * to KUWAITI nationals. Non-Kuwaiti residents are excluded from
 * nationalization quotas but still require AML/CFT compliance.
 *
 * PRINCIPLE A: Filing accuracy is criminal liability.
 * PRINCIPLE C: FORMAT ISOLATION — no goAML XML.
 *
 * Phase 4 (Actions 4.12-4.13): Kuwait CBK adapter.
 */

import { BaseFIUAdapter } from './base-adapter';
import type {
  SARPayload,
  FilingResult,
  FilingValidationResult,
  FilingValidationError,
  ManualFallbackDocument,
} from '../types';

// ─── CBK Filing JSON Structure ────────────────────────────────────────────────

interface CBKFilingHeader {
  reportType: string;
  reportingEntityName: string;
  reportingEntityLicense: string;
  countryCode: string;
  filingDate: string;
  regulatoryReference: string;
  /** Flag indicating values that need SME verification */
  pendingVerification?: boolean; // Verify with SME
}

interface CBKSubjectInformation {
  fullName: string;
  civilId: string;
  nationality: string;
  dateOfBirth: string;
  customerType: string;
  /** Whether the subject is a Kuwaiti national (affects PIFSS/Kuwaitization rules) */
  isKuwaitiNational: boolean;
  passportNumber: string;
  residencePermitNumber: string;
  address: string;
  phone: string;
  email: string;
}

interface CBKSuspiciousActivityDetails {
  description: string;
  activityType: string[];
  detectionDate: string;
  reportingObligation: string;
  /** Flag indicating values that need SME verification */
  pendingVerification?: boolean; // Verify with SME
}

interface CBKTransactionDetails {
  amount: number;
  currency: string;
  date: string;
  type: string;
  originatingCountry: string;
  destinationCountry: string;
}

interface CBKMLRODecision {
  name: string;
  decision: string;
  date: string;
  notes: string;
}

interface CBKFiling {
  filingHeader: CBKFilingHeader;
  subjectInformation: CBKSubjectInformation;
  suspiciousActivityDetails: CBKSuspiciousActivityDetails;
  transactionDetails: CBKTransactionDetails;
  mlroDecision: CBKMLRODecision;
  jurisdiction: string;
}

// ─── Required top-level keys for format validation ────────────────────────────

const CBK_REQUIRED_TOP_LEVEL_KEYS: (keyof CBKFiling)[] = [
  'filingHeader',
  'subjectInformation',
  'suspiciousActivityDetails',
  'transactionDetails',
  'mlroDecision',
  'jurisdiction',
];

const CBK_REQUIRED_HEADER_KEYS: (keyof CBKFilingHeader)[] = [
  'reportType',
  'reportingEntityName',
  'countryCode',
  'filingDate',
  'regulatoryReference',
];

const CBK_REQUIRED_SUBJECT_KEYS: (keyof CBKSubjectInformation)[] = [
  'fullName',
  'civilId',
  'customerType',
  'isKuwaitiNational',
];

const CBK_REQUIRED_ACTIVITY_KEYS: (keyof CBKSuspiciousActivityDetails)[] = [
  'description',
  'detectionDate',
];

const CBK_REQUIRED_TRANSACTION_KEYS: (keyof CBKTransactionDetails)[] = [
  'amount',
  'currency',
  'date',
];

const CBK_REQUIRED_MLRO_KEYS: (keyof CBKMLRODecision)[] = [
  'name',
  'decision',
];

// ─── CBK Adapter Implementation ───────────────────────────────────────────────

export class CBKAdapter extends BaseFIUAdapter {
  readonly jurisdiction = 'KW' as const;
  readonly regulator = 'CBK';
  readonly fiuName = 'KFIU';
  readonly filingFormat = 'JSON' as const;
  readonly currency = 'KWD';
  readonly sarDeadlineDays = 15; // Verify with SME
  readonly sarDeadlineUnit = 'calendar_days' as const;
  readonly weekendDays = [5, 6];

  // ─── Generate Filing ────────────────────────────────────────────────────────

  /**
   * Generate a CBK/KFIU-specific JSON filing payload.
   *
   * The JSON structure follows the CBK/Kuwait FIU reporting format.
   * Fields marked with pendingVerification require SME confirmation.
   *
   * Kuwait-specific considerations:
   * - 12-digit Kuwaiti Civil ID
   * - isKuwaitiNational flag: PIFSS contributions and Kuwaitization rules
   *   apply only to KUWAITI nationals. Non-Kuwaiti residents are excluded
   *   from nationalization quotas but still require AML/CFT compliance.
   * - Residence permit number for non-Kuwaiti residents
   *
   * PRINCIPLE A: Every field must be accurate — filing errors are criminal liability.
   * PRINCIPLE C: JSON format only — no goAML XML.
   */
  async generateFiling(payload: SARPayload): Promise<string> {
    // Determine if the subject is likely a Kuwaiti national based on nationality field
    // This is a heuristic — the compliance officer should verify
    const isKuwaitiNational = payload.nationality?.toLowerCase() === 'kuwaiti';

    const filing: CBKFiling = {
      filingHeader: {
        reportType: 'SAR',
        reportingEntityName: payload.reportingEntityName || '',
        reportingEntityLicense: payload.reportingEntityLicense || '',
        countryCode: 'KW',
        filingDate: new Date().toISOString(),
        regulatoryReference: 'Law No. 106 of 2013 (AML/CFT Law)', // Verify with SME
        pendingVerification: true, // Verify with SME — confirm regulatory reference
      },
      subjectInformation: {
        fullName: payload.customerName,
        civilId: payload.nationalId || '',
        nationality: payload.nationality || '',
        dateOfBirth: payload.dateOfBirth || '',
        customerType: payload.customerType,
        isKuwaitiNational,
        passportNumber: payload.passportNumber || '',
        residencePermitNumber: '', // Verify with SME — not in SARPayload, may need extension
        address: payload.address || '',
        phone: payload.phone || '',
        email: payload.email || '',
      },
      suspiciousActivityDetails: {
        description: payload.suspiciousActivityDescription,
        activityType: payload.suspiciousActivityType || [],
        detectionDate: payload.detectionDate.toISOString(),
        reportingObligation: 'CBK AML/CFT Instructions 2014', // Verify with SME
        pendingVerification: true, // Verify with SME — confirm directive reference
      },
      transactionDetails: {
        amount: payload.transactionAmount || 0,
        currency: 'KWD',
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
      jurisdiction: 'KW',
    };

    // Audit the filing generation
    await this.auditFilingAction('GENERATED', payload, 'system', {
      filingFormat: this.filingFormat,
      filingStructure: 'CBK_JSON_v1',
      isKuwaitiNational,
    });

    return JSON.stringify(filing, null, 2);
  }

  // ─── Validate Filing ────────────────────────────────────────────────────────

  /**
   * Validate the SAR payload against CBK/Kuwait rules.
   *
   * Checks:
   * - Required fields present
   * - Kuwaiti Civil ID format (12 digits)
   * - Transaction amount > 0
   * - Detection date is present
   * - MLRO decision is valid
   * - Kuwaiti national flag consistency
   *
   * IMPORTANT: PIFSS contributions and Kuwaitization rules apply only
   * to KUWAITI nationals. Non-Kuwaiti residents are excluded from
   * nationalization quotas but still require AML/CFT compliance.
   *
   * PRINCIPLE A: Filing accuracy is criminal liability.
   */
  async validateFiling(payload: SARPayload): Promise<FilingValidationResult> {
    const errors: FilingValidationError[] = [];
    const warnings: string[] = [];

    // ── Required field checks ──────────────────────────────────────────────
    if (!payload.customerName?.trim()) {
      errors.push({
        field: 'customerName',
        message: 'Subject full name is required for CBK filing',
        severity: 'error',
      });
    }

    if (!payload.suspiciousActivityDescription?.trim()) {
      errors.push({
        field: 'suspiciousActivityDescription',
        message: 'Suspicious activity description is required for CBK filing',
        severity: 'error',
      });
    }

    if (!payload.mlroName?.trim()) {
      errors.push({
        field: 'mlroName',
        message: 'MLRO name is required for CBK filing',
        severity: 'error',
      });
    }

    if (!payload.mlroDecision) {
      errors.push({
        field: 'mlroDecision',
        message: 'MLRO decision is required for CBK filing',
        severity: 'error',
      });
    }

    // ── Kuwaiti Civil ID validation ────────────────────────────────────────
    if (payload.nationalId && !this.validateKuwaitCivilId(payload.nationalId)) {
      errors.push({
        field: 'nationalId',
        message: 'Kuwaiti Civil ID must be exactly 12 digits',
        severity: 'error',
      });
    }

    // ── Kuwaiti national consistency check ─────────────────────────────────
    const isKuwaitiNational = payload.nationality?.toLowerCase() === 'kuwaiti';
    if (isKuwaitiNational && payload.nationalId) {
      // Kuwaiti nationals should have a valid Kuwaiti Civil ID
      if (!this.validateKuwaitCivilId(payload.nationalId)) {
        warnings.push(
          'Subject is marked as Kuwaiti national but Civil ID format is invalid. Verify nationality and ID.'
        );
      }
    }

    if (!isKuwaitiNational && payload.nationalId) {
      // Non-Kuwaiti residents: ID may be a different format
      // Still validate as 12-digit Kuwait Civil ID if they have a Kuwait-issued ID
      warnings.push(
        'Subject is not marked as Kuwaiti national. PIFSS contributions and Kuwaitization rules do not apply. AML/CFT compliance still required.'
      );
    }

    // ── Transaction amount check ───────────────────────────────────────────
    if (payload.transactionAmount !== undefined && payload.transactionAmount <= 0) {
      errors.push({
        field: 'transactionAmount',
        message: 'Transaction amount must be greater than 0',
        severity: 'error',
      });
    }

    // ── Currency validation ────────────────────────────────────────────────
    if (payload.transactionCurrency && payload.transactionCurrency !== 'KWD') {
      warnings.push(
        'Transaction currency is not KWD. CBK expects amounts in KWD. Verify conversion if needed.'
      );
    }

    // ── Detection date check ───────────────────────────────────────────────
    if (!payload.detectionDate) {
      errors.push({
        field: 'detectionDate',
        message: 'Detection date is required for CBK deadline calculation',
        severity: 'error',
      });
    }

    // ── Deadline warning ───────────────────────────────────────────────────
    if (payload.detectionDate) {
      const deadlineInfo = this.getDeadlineInfo(payload.detectionDate);
      if (deadlineInfo.isOverdue) {
        errors.push({
          field: 'detectionDate',
          message: 'SAR filing deadline has EXCEEDED. Immediate filing required — criminal liability risk.',
          severity: 'error',
        });
      } else if (deadlineInfo.isCritical) {
        warnings.push(
          `SAR filing deadline is critical: ${deadlineInfo.daysRemaining} day(s) remaining for CBK filing.`
        );
      }
    }

    // ── Reporting entity checks ────────────────────────────────────────────
    if (!payload.reportingEntityName?.trim()) {
      warnings.push('Reporting entity name is recommended for CBK filing');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ─── Validate Format ────────────────────────────────────────────────────────

  /**
   * Validate the format of a generated CBK filing JSON string.
   * Checks that the string is valid JSON and contains all required top-level keys.
   *
   * PRINCIPLE C: FORMAT ISOLATION — only JSON, no XML.
   */
  async validateFormat(filingString: string): Promise<FilingValidationResult> {
    const errors: FilingValidationError[] = [];
    const warnings: string[] = [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(filingString);
    } catch (e) {
      return {
        valid: false,
        errors: [
          {
            field: 'filingString',
            message: `Invalid JSON format: ${(e as Error).message}`,
            severity: 'error',
          },
        ],
        warnings,
      };
    }

    // ── Top-level key validation ───────────────────────────────────────────
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {
        valid: false,
        errors: [
          {
            field: 'filingString',
            message: 'CBK filing must be a JSON object, not an array or primitive',
            severity: 'error',
          },
        ],
        warnings,
      };
    }

    const filingObj = parsed as Record<string, unknown>;

    for (const key of CBK_REQUIRED_TOP_LEVEL_KEYS) {
      if (!(key in filingObj)) {
        errors.push({
          field: key,
          message: `Required top-level key "${key}" is missing from CBK filing`,
          severity: 'error',
        });
      }
    }

    // ── Nested key validation ──────────────────────────────────────────────
    if (filingObj.filingHeader && typeof filingObj.filingHeader === 'object') {
      const header = filingObj.filingHeader as Record<string, unknown>;
      for (const key of CBK_REQUIRED_HEADER_KEYS) {
        if (!(key in header)) {
          errors.push({
            field: `filingHeader.${key}`,
            message: `Required filing header key "${key}" is missing`,
            severity: 'error',
          });
        }
      }
    }

    if (filingObj.subjectInformation && typeof filingObj.subjectInformation === 'object') {
      const subject = filingObj.subjectInformation as Record<string, unknown>;
      for (const key of CBK_REQUIRED_SUBJECT_KEYS) {
        if (!(key in subject)) {
          errors.push({
            field: `subjectInformation.${key}`,
            message: `Required subject information key "${key}" is missing`,
            severity: 'error',
          });
        }
      }

      // ── Kuwaiti national flag validation ───────────────────────────────
      if ('isKuwaitiNational' in subject && typeof subject.isKuwaitiNational !== 'boolean') {
        errors.push({
          field: 'subjectInformation.isKuwaitiNational',
          message: 'isKuwaitiNational must be a boolean value',
          severity: 'error',
        });
      }
    }

    if (filingObj.suspiciousActivityDetails && typeof filingObj.suspiciousActivityDetails === 'object') {
      const activity = filingObj.suspiciousActivityDetails as Record<string, unknown>;
      for (const key of CBK_REQUIRED_ACTIVITY_KEYS) {
        if (!(key in activity)) {
          errors.push({
            field: `suspiciousActivityDetails.${key}`,
            message: `Required suspicious activity key "${key}" is missing`,
            severity: 'error',
          });
        }
      }
    }

    if (filingObj.transactionDetails && typeof filingObj.transactionDetails === 'object') {
      const tx = filingObj.transactionDetails as Record<string, unknown>;
      for (const key of CBK_REQUIRED_TRANSACTION_KEYS) {
        if (!(key in tx)) {
          errors.push({
            field: `transactionDetails.${key}`,
            message: `Required transaction details key "${key}" is missing`,
            severity: 'error',
          });
        }
      }
    }

    if (filingObj.mlroDecision && typeof filingObj.mlroDecision === 'object') {
      const mlro = filingObj.mlroDecision as Record<string, unknown>;
      for (const key of CBK_REQUIRED_MLRO_KEYS) {
        if (!(key in mlro)) {
          errors.push({
            field: `mlroDecision.${key}`,
            message: `Required MLRO decision key "${key}" is missing`,
            severity: 'error',
          });
        }
      }
    }

    // ── Jurisdiction check ─────────────────────────────────────────────────
    if (filingObj.jurisdiction !== 'KW') {
      warnings.push(
        `Jurisdiction is "${filingObj.jurisdiction}" but expected "KW" for CBK filing`
      );
    }

    // ── pendingVerification flag check ─────────────────────────────────────
    if (filingObj.filingHeader && typeof filingObj.filingHeader === 'object') {
      const header = filingObj.filingHeader as Record<string, unknown>;
      if (header.pendingVerification === true) {
        warnings.push(
          'Filing header contains pendingVerification flag — fields require SME confirmation before submission'
        );
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
   * Submit a CBK/KFIU SAR filing.
   *
   * Mode 1 — Simulation (default): CBK_API_URL is not set.
   *   Returns a simulated successful FilingResult for development/testing.
   *
   * Mode 2 — Real API: CBK_API_URL is set.
   *   Attempts a real HTTP POST to the CBK API endpoint.
   *   On failure, triggers handleSubmissionError() (PRINCIPLE E: manual fallback).
   *
   * PRINCIPLE A: Filing accuracy is criminal liability.
   * PRINCIPLE E: Mandatory manual fallback on failure.
   */
  async submit(filingString: string, filingId: string): Promise<FilingResult> {
    const integrityHash = this.computeFilingHash(filingString);
    const cbkApiUrl = process.env.CBK_API_URL;

    // ── Simulation Mode ────────────────────────────────────────────────────
    if (!cbkApiUrl) {
      return {
        success: true,
        filingId,
        submissionId: `CBK-SIM-${Date.now()}`,
        fiuReceiptNumber: `CBK-RCPT-${Date.now()}`,
        submittedAt: new Date().toISOString(),
        status: 'submitted_to_fiu',
        integrityHash,
        mode: 'rpa_simulation',
        retryCount: 0,
      };
    }

    // ── Real API Mode ──────────────────────────────────────────────────────
    try {
      const response = await fetch(cbkApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Filing-Id': filingId,
          'X-Integrity-Hash': integrityHash,
        },
        body: filingString,
      });

      if (!response.ok) {
        throw new Error(
          `CBK API returned HTTP ${response.status}: ${response.statusText}`
        );
      }

      const responseData = await response.json() as Record<string, unknown>;

      return {
        success: true,
        filingId,
        submissionId: (responseData.submissionId as string) || `CBK-${Date.now()}`,
        fiuReceiptNumber: (responseData.receiptNumber as string) || null,
        submittedAt: new Date().toISOString(),
        status: 'submitted_to_fiu',
        integrityHash,
        mode: 'direct_api',
        retryCount: 0,
      };
    } catch (error) {
      // PRINCIPLE E: Mandatory manual fallback on submission failure
      const payload: SARPayload = JSON.parse(filingString).payload || {
        filingId,
        jurisdiction: 'KW',
        regulator: 'CBK',
        fiuName: 'KFIU',
        detectionDate: new Date(),
        filingDeadline: new Date(),
        customerId: '',
        customerName: '',
        customerType: 'individual',
        suspiciousActivityDescription: '',
        suspiciousActivityType: [],
        mlroName: '',
        mlroDecision: 'file_sar',
      };

      return this.handleSubmissionError(
        payload,
        error instanceof Error ? error : new Error(String(error)),
        filingId
      );
    }
  }

  // ─── Manual Fallback ────────────────────────────────────────────────────────

  /**
   * Generate a manual fallback document for CBK/KFIU filing.
   *
   * PRINCIPLE E: If electronic submission fails, the MLRO must be able to
   * file manually. This document provides step-by-step instructions and
   * pre-filled form fields for the CBK portal.
   *
   * The portal URL is a placeholder until confirmed by SME.
   *
   * IMPORTANT: PIFSS contributions and Kuwaitization rules apply only
   * to KUWAITI nationals. Non-Kuwaiti residents are excluded from
   * nationalization quotas but still require AML/CFT compliance.
   */
  async generateManualFallback(
    payload: SARPayload,
    reason: string
  ): Promise<ManualFallbackDocument> {
    const isKuwaitiNational = payload.nationality?.toLowerCase() === 'kuwaiti';

    return {
      title: 'Kuwait CBK/KFIU SAR Manual Filing',
      jurisdiction: 'KW',
      regulator: 'CBK',
      fiuName: this.fiuName,
      generatedAt: new Date().toISOString(),
      reason,
      submissionInstructions: [
        '1. Access the CBK / Kuwait Financial Intelligence Unit (KFIU) portal', // Verify URL with SME
        '2. Log in with your reporting entity credentials',
        '3. Navigate to SAR Filing → New Filing',
        '4. Enter the filing header information (report type, entity details, regulatory reference)',
        '5. Enter the subject information (full name, 12-digit Civil ID, nationality)',
        '6. For Kuwaiti nationals: indicate isKuwaitiNational=true (PIFSS/Kuwaitization rules apply)',
        '7. For non-Kuwaiti residents: PIFSS contributions and Kuwaitization rules do NOT apply, but AML/CFT compliance is still required',
        '8. Enter the suspicious activity details and detection date',
        '9. Enter the transaction details (amount in KWD, date, type, countries)',
        '10. Enter the MLRO decision and notes',
        '11. Review all fields for accuracy (PRINCIPLE A: criminal liability)',
        '12. Submit the filing and retain the acknowledgment receipt',
        '13. Record the CBK/KFIU reference number in the compliance system',
      ],
      formFields: {
        'Report Type': 'SAR',
        'Reporting Entity Name': payload.reportingEntityName || '',
        'Reporting Entity License': payload.reportingEntityLicense || '',
        'Country Code': 'KW',
        'Regulatory Reference': 'Law No. 106 of 2013 (AML/CFT Law)', // Verify with SME
        'Subject Full Name': payload.customerName,
        'Subject Civil ID': payload.nationalId || '',
        'Subject Nationality': payload.nationality || '',
        'Subject Date of Birth': payload.dateOfBirth || '',
        'Customer Type': payload.customerType,
        'Is Kuwaiti National': String(isKuwaitiNational),
        'Subject Passport Number': payload.passportNumber || '',
        'Subject Address': payload.address || '',
        'Subject Phone': payload.phone || '',
        'Subject Email': payload.email || '',
        'Activity Description': payload.suspiciousActivityDescription,
        'Activity Types': (payload.suspiciousActivityType || []).join(', '),
        'Detection Date': payload.detectionDate?.toISOString() || '',
        'Reporting Obligation': 'CBK AML/CFT Instructions 2014', // Verify with SME
        'Transaction Amount': String(payload.transactionAmount || 0),
        'Transaction Currency': 'KWD',
        'Transaction Date': payload.transactionDate || '',
        'Transaction Type': payload.transactionType || '',
        'Originating Country': payload.originatingCountry || '',
        'Destination Country': payload.destinationCountry || '',
        'MLRO Name': payload.mlroName,
        'MLRO Decision': payload.mlroDecision,
        'MLRO Decision Date': payload.mlroDecisionDate || '',
        'MLRO Notes': payload.mlroNotes || '',
      },
      payload,
      portalUrl: 'https://cbk.gov.kw/kfiu-portal', // Verify with SME — placeholder URL
    };
  }
}
