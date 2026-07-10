/**
 * Oman CBOA/Oman FIU SAR Filing Adapter
 *
 * Central Bank of Oman / Oman Financial Intelligence Unit
 *
 * Deadline: 15 calendar days from detection // Verify with SME
 * Format: JSON // Verify exact format with SME
 * Weekend: Friday-Saturday
 * National ID: 8-digit Omani Civil ID
 *
 * PRINCIPLE A: Filing accuracy is criminal liability.
 * PRINCIPLE C: FORMAT ISOLATION — no goAML XML.
 *
 * Phase 4 (Actions 4.10-4.11): Oman CBOA adapter.
 */

import { BaseFIUAdapter } from './base-adapter';
import type {
  SARPayload,
  FilingResult,
  FilingValidationResult,
  FilingValidationError,
  ManualFallbackDocument,
} from '../types';

// ─── CBOA Filing JSON Structure ───────────────────────────────────────────────

interface CBOAFilingHeader {
  reportType: string;
  reportingEntityName: string;
  reportingEntityLicense: string;
  countryCode: string;
  filingDate: string;
  regulatoryReference: string;
  /** Flag indicating values that need SME verification */
  pendingVerification?: boolean; // Verify with SME
}

interface CBOASubjectInformation {
  fullName: string;
  civilId: string;
  nationality: string;
  dateOfBirth: string;
  customerType: string;
  passportNumber: string;
  address: string;
  phone: string;
  email: string;
}

interface CBOASuspiciousActivityDetails {
  description: string;
  activityType: string[];
  detectionDate: string;
  reportingObligation: string;
  /** Flag indicating values that need SME verification */
  pendingVerification?: boolean; // Verify with SME
}

interface CBOATransactionDetails {
  amount: number;
  currency: string;
  date: string;
  type: string;
  originatingCountry: string;
  destinationCountry: string;
}

interface CBOAMLRODecision {
  name: string;
  decision: string;
  date: string;
  notes: string;
}

interface CBOAFiling {
  filingHeader: CBOAFilingHeader;
  subjectInformation: CBOASubjectInformation;
  suspiciousActivityDetails: CBOASuspiciousActivityDetails;
  transactionDetails: CBOATransactionDetails;
  mlroDecision: CBOAMLRODecision;
  jurisdiction: string;
}

// ─── Required top-level keys for format validation ────────────────────────────

const CBOA_REQUIRED_TOP_LEVEL_KEYS: (keyof CBOAFiling)[] = [
  'filingHeader',
  'subjectInformation',
  'suspiciousActivityDetails',
  'transactionDetails',
  'mlroDecision',
  'jurisdiction',
];

const CBOA_REQUIRED_HEADER_KEYS: (keyof CBOAFilingHeader)[] = [
  'reportType',
  'reportingEntityName',
  'countryCode',
  'filingDate',
  'regulatoryReference',
];

const CBOA_REQUIRED_SUBJECT_KEYS: (keyof CBOASubjectInformation)[] = [
  'fullName',
  'civilId',
  'customerType',
];

const CBOA_REQUIRED_ACTIVITY_KEYS: (keyof CBOASuspiciousActivityDetails)[] = [
  'description',
  'detectionDate',
];

const CBOA_REQUIRED_TRANSACTION_KEYS: (keyof CBOATransactionDetails)[] = [
  'amount',
  'currency',
  'date',
];

const CBOA_REQUIRED_MLRO_KEYS: (keyof CBOAMLRODecision)[] = [
  'name',
  'decision',
];

// ─── CBOA Adapter Implementation ──────────────────────────────────────────────

export class CBOAAdapter extends BaseFIUAdapter {
  readonly jurisdiction = 'OM' as const;
  readonly regulator = 'CBOA';
  readonly fiuName = 'Oman FIU';
  readonly filingFormat = 'JSON' as const;
  readonly currency = 'OMR';
  readonly sarDeadlineDays = 15; // Verify with SME
  readonly sarDeadlineUnit = 'calendar_days' as const;
  readonly weekendDays = [5, 6];

  // ─── Generate Filing ────────────────────────────────────────────────────────

  /**
   * Generate a CBOA-specific JSON filing payload.
   *
   * The JSON structure follows the CBOA/Oman FIU reporting format.
   * Fields marked with pendingVerification require SME confirmation.
   *
   * PRINCIPLE A: Every field must be accurate — filing errors are criminal liability.
   * PRINCIPLE C: JSON format only — no goAML XML.
   */
  async generateFiling(payload: SARPayload): Promise<string> {
    const filing: CBOAFiling = {
      filingHeader: {
        reportType: 'SAR',
        reportingEntityName: payload.reportingEntityName || '',
        reportingEntityLicense: payload.reportingEntityLicense || '',
        countryCode: 'OM',
        filingDate: new Date().toISOString(),
        regulatoryReference: 'Royal Decree 34/2015 (AML/CFT Law)', // Verify with SME
        pendingVerification: true, // Verify with SME — confirm regulatory reference
      },
      subjectInformation: {
        fullName: payload.customerName,
        civilId: payload.nationalId || '',
        nationality: payload.nationality || '',
        dateOfBirth: payload.dateOfBirth || '',
        customerType: payload.customerType,
        passportNumber: payload.passportNumber || '',
        address: payload.address || '',
        phone: payload.phone || '',
        email: payload.email || '',
      },
      suspiciousActivityDetails: {
        description: payload.suspiciousActivityDescription,
        activityType: payload.suspiciousActivityType || [],
        detectionDate: payload.detectionDate.toISOString(),
        reportingObligation: 'CBOA AML/CFT Directive 2016', // Verify with SME
        pendingVerification: true, // Verify with SME — confirm directive reference
      },
      transactionDetails: {
        amount: payload.transactionAmount || 0,
        currency: 'OMR',
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
      jurisdiction: 'OM',
    };

    // Audit the filing generation
    await this.auditFilingAction('GENERATED', payload, 'system', {
      filingFormat: this.filingFormat,
      filingStructure: 'CBOA_JSON_v1',
    });

    return JSON.stringify(filing, null, 2);
  }

  // ─── Validate Filing ────────────────────────────────────────────────────────

  /**
   * Validate the SAR payload against CBOA/Oman rules.
   *
   * Checks:
   * - Required fields present
   * - Omani Civil ID format (8 digits)
   * - Transaction amount > 0
   * - Detection date is present
   * - MLRO decision is valid
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
        message: 'Subject full name is required for CBOA filing',
        severity: 'error',
      });
    }

    if (!payload.suspiciousActivityDescription?.trim()) {
      errors.push({
        field: 'suspiciousActivityDescription',
        message: 'Suspicious activity description is required for CBOA filing',
        severity: 'error',
      });
    }

    if (!payload.mlroName?.trim()) {
      errors.push({
        field: 'mlroName',
        message: 'MLRO name is required for CBOA filing',
        severity: 'error',
      });
    }

    if (!payload.mlroDecision) {
      errors.push({
        field: 'mlroDecision',
        message: 'MLRO decision is required for CBOA filing',
        severity: 'error',
      });
    }

    // ── Omani Civil ID validation ──────────────────────────────────────────
    if (payload.nationalId && !this.validateOmanCivilId(payload.nationalId)) {
      errors.push({
        field: 'nationalId',
        message: 'Omani Civil ID must be exactly 8 digits',
        severity: 'error',
      });
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
    if (payload.transactionCurrency && payload.transactionCurrency !== 'OMR') {
      warnings.push(
        'Transaction currency is not OMR. CBOA expects amounts in OMR. Verify conversion if needed.'
      );
    }

    // ── Detection date check ───────────────────────────────────────────────
    if (!payload.detectionDate) {
      errors.push({
        field: 'detectionDate',
        message: 'Detection date is required for CBOA deadline calculation',
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
          `SAR filing deadline is critical: ${deadlineInfo.daysRemaining} day(s) remaining for CBOA filing.`
        );
      }
    }

    // ── Reporting entity checks ────────────────────────────────────────────
    if (!payload.reportingEntityName?.trim()) {
      warnings.push('Reporting entity name is recommended for CBOA filing');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ─── Validate Format ────────────────────────────────────────────────────────

  /**
   * Validate the format of a generated CBOA filing JSON string.
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
            message: 'CBOA filing must be a JSON object, not an array or primitive',
            severity: 'error',
          },
        ],
        warnings,
      };
    }

    const filingObj = parsed as Record<string, unknown>;

    for (const key of CBOA_REQUIRED_TOP_LEVEL_KEYS) {
      if (!(key in filingObj)) {
        errors.push({
          field: key,
          message: `Required top-level key "${key}" is missing from CBOA filing`,
          severity: 'error',
        });
      }
    }

    // ── Nested key validation ──────────────────────────────────────────────
    if (filingObj.filingHeader && typeof filingObj.filingHeader === 'object') {
      const header = filingObj.filingHeader as Record<string, unknown>;
      for (const key of CBOA_REQUIRED_HEADER_KEYS) {
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
      for (const key of CBOA_REQUIRED_SUBJECT_KEYS) {
        if (!(key in subject)) {
          errors.push({
            field: `subjectInformation.${key}`,
            message: `Required subject information key "${key}" is missing`,
            severity: 'error',
          });
        }
      }
    }

    if (filingObj.suspiciousActivityDetails && typeof filingObj.suspiciousActivityDetails === 'object') {
      const activity = filingObj.suspiciousActivityDetails as Record<string, unknown>;
      for (const key of CBOA_REQUIRED_ACTIVITY_KEYS) {
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
      for (const key of CBOA_REQUIRED_TRANSACTION_KEYS) {
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
      for (const key of CBOA_REQUIRED_MLRO_KEYS) {
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
    if (filingObj.jurisdiction !== 'OM') {
      warnings.push(
        `Jurisdiction is "${filingObj.jurisdiction}" but expected "OM" for CBOA filing`
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
   * Submit a CBOA SAR filing.
   *
   * Mode 1 — Simulation (default): CBOA_API_URL is not set.
   *   Returns a simulated successful FilingResult for development/testing.
   *
   * Mode 2 — Real API: CBOA_API_URL is set.
   *   Attempts a real HTTP POST to the CBOA API endpoint.
   *   On failure, triggers handleSubmissionError() (PRINCIPLE E: manual fallback).
   *
   * PRINCIPLE A: Filing accuracy is criminal liability.
   * PRINCIPLE E: Mandatory manual fallback on failure.
   */
  async submit(filingString: string, filingId: string): Promise<FilingResult> {
    const integrityHash = this.computeFilingHash(filingString);
    const cbouApiUrl = process.env.CBOA_API_URL;

    // ── Simulation Mode ────────────────────────────────────────────────────
    if (!cbouApiUrl) {
      return {
        success: true,
        filingId,
        submissionId: `CBOA-SIM-${Date.now()}`,
        fiuReceiptNumber: `CBOA-RCPT-${Date.now()}`,
        submittedAt: new Date().toISOString(),
        status: 'submitted_to_fiu',
        integrityHash,
        mode: 'rpa_simulation',
        retryCount: 0,
      };
    }

    // ── Real API Mode ──────────────────────────────────────────────────────
    try {
      const response = await fetch(cbouApiUrl, {
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
          `CBOA API returned HTTP ${response.status}: ${response.statusText}`
        );
      }

      const responseData = await response.json() as Record<string, unknown>;

      return {
        success: true,
        filingId,
        submissionId: (responseData.submissionId as string) || `CBOA-${Date.now()}`,
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
        jurisdiction: 'OM',
        regulator: 'CBOA',
        fiuName: 'Oman FIU',
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
   * Generate a manual fallback document for CBOA filing.
   *
   * PRINCIPLE E: If electronic submission fails, the MLRO must be able to
   * file manually. This document provides step-by-step instructions and
   * pre-filled form fields for the CBOA portal.
   *
   * The portal URL is a placeholder until confirmed by SME.
   */
  async generateManualFallback(
    payload: SARPayload,
    reason: string
  ): Promise<ManualFallbackDocument> {
    return {
      title: 'Oman CBOA SAR Manual Filing',
      jurisdiction: 'OM',
      regulator: 'CBOA',
      fiuName: this.fiuName,
      generatedAt: new Date().toISOString(),
      reason,
      submissionInstructions: [
        '1. Access the CBOA / National Centre for Financial Intelligence (NCFI) portal', // Verify URL with SME
        '2. Log in with your reporting entity credentials',
        '3. Navigate to SAR Filing → New Filing',
        '4. Enter the filing header information (report type, entity details, regulatory reference)',
        '5. Enter the subject information (full name, Civil ID, nationality, date of birth)',
        '6. For Omani nationals, enter the 8-digit Civil ID',
        '7. Enter the suspicious activity details and detection date',
        '8. Enter the transaction details (amount in OMR, date, type, countries)',
        '9. Enter the MLRO decision and notes',
        '10. Review all fields for accuracy (PRINCIPLE A: criminal liability)',
        '11. Submit the filing and retain the acknowledgment receipt',
        '12. Record the CBOA reference number in the compliance system',
      ],
      formFields: {
        'Report Type': 'SAR',
        'Reporting Entity Name': payload.reportingEntityName || '',
        'Reporting Entity License': payload.reportingEntityLicense || '',
        'Country Code': 'OM',
        'Regulatory Reference': 'Royal Decree 34/2015 (AML/CFT Law)', // Verify with SME
        'Subject Full Name': payload.customerName,
        'Subject Civil ID': payload.nationalId || '',
        'Subject Nationality': payload.nationality || '',
        'Subject Date of Birth': payload.dateOfBirth || '',
        'Customer Type': payload.customerType,
        'Subject Passport Number': payload.passportNumber || '',
        'Subject Address': payload.address || '',
        'Subject Phone': payload.phone || '',
        'Subject Email': payload.email || '',
        'Activity Description': payload.suspiciousActivityDescription,
        'Activity Types': (payload.suspiciousActivityType || []).join(', '),
        'Detection Date': payload.detectionDate?.toISOString() || '',
        'Reporting Obligation': 'CBOA AML/CFT Directive 2016', // Verify with SME
        'Transaction Amount': String(payload.transactionAmount || 0),
        'Transaction Currency': 'OMR',
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
      portalUrl: 'https://cboa.gov.om/ncfi-portal', // Verify with SME — placeholder URL
    };
  }
}
