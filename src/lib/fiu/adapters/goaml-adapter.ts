/**
 * UAE goAML Adapter — CBUAE FIU Filing
 *
 * Wraps the existing goAML v4.2 XML generation and regulatory gateway
 * into the FIUFileAdapter contract. This is the Gold Standard baseline
 * that other adapters must match in workflow rigor.
 *
 * PRINCIPLE C: FORMAT ISOLATION — goAML XML v4.2 is UAE-only.
 * PRINCIPLE D: Audit every filing with WORM audit log + payload hash.
 * PRINCIPLE F: Maker-Checker enforcement (4-Eyes workflow).
 *
 * Phase 4 (Action 4.2): UAE adapter wrapping existing goAML pipeline.
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
import {
  generateGoAMLXML,
  validateGoAMLXML as validateGoAMLXMLStructure,
  detectReportType,
  type GoAMLFilingData,
  type GoAMLReportType,
  type XMLValidationResult as GoAMLXMLValidationResult,
} from '@/lib/compliance/goaml-xml';
import {
  submitGoAMLFiling,
  type GoAMLSubmissionRequest,
  type GoAMLSubmissionResult,
} from '@/lib/integrations/regulatory-gateway';

// ─── UAE goAML Adapter ────────────────────────────────────────────────────────

export class GoAMLAdapter extends BaseFIUAdapter {
  readonly jurisdiction = 'AE' as const;
  readonly regulator = 'CBUAE';
  readonly fiuName = 'UAE FIU (Anti-Money Laundering and Suspicious Cases Unit)';
  readonly filingFormat: FilingFormat = 'goAML_XML';
  readonly currency = 'AED';
  readonly sarDeadlineDays = 30;
  readonly sarDeadlineUnit = 'calendar_days' as const;
  readonly weekendDays = [5, 6];

  /**
   * Cache the last SARPayload used for generateFiling so that submit()
   * can reference it for error handling (handleSubmissionError requires SARPayload).
   * Cleared after successful submission.
   */
  private lastPayload: SARPayload | null = null;

  // ─── SARPayload → GoAMLFilingData Conversion ──────────────────────────────

  /**
   * Convert the generic SARPayload into the UAE-specific GoAMLFilingData
   * structure expected by generateGoAMLXML().
   *
   * PRINCIPLE C: FORMAT ISOLATION — this mapping is UAE-only. No other
   * adapter should reference GoAMLFilingData.
   */
  private convertToGoAMLData(payload: SARPayload): GoAMLFilingData {
    // Derive report type from suspicious activity type, defaulting to SAR
    const reportType = this.deriveReportType(payload);

    return {
      reportType,
      referenceNumber: payload.filingId,
      subjectName: payload.customerName,
      amountAED: payload.transactionAmount ?? 0,
      currency: payload.transactionCurrency ?? 'AED',
      narrative: payload.suspiciousActivityDescription,
      transactionDate: payload.transactionDate,
      jurisdiction: 'AE',
      emiratesId: payload.nationalId,
      identifiers: {
        passportNo: payload.passportNumber,
        nationality: payload.nationality,
        dateOfBirth: payload.dateOfBirth,
        phone: payload.phone,
        email: payload.email,
        address: payload.address,
        accountNumber: payload.accountNumber,
        beneficiaryName: payload.beneficiaryName,
        beneficiaryAccount: payload.beneficiaryAccount,
        originatingCountry: payload.originatingCountry,
        destinationCountry: payload.destinationCountry,
        transactionType: payload.transactionType,
      },
      filingEntity: {
        name: payload.reportingEntityName,
        licenseNumber: payload.reportingEntityLicense,
        trn: payload.reportingEntityTRN,
        address: payload.reportingEntityAddress,
        contactPerson: payload.reportingEntityContactPerson,
        contactPhone: payload.reportingEntityContactPhone,
      },
    };
  }

  /**
   * Derive the goAML report type from the SAR payload.
   * Defaults to SAR. If the activity types include keywords that map
   * to other report types, use those instead.
   */
  private deriveReportType(payload: SARPayload): GoAMLReportType {
    const activityTypes = payload.suspiciousActivityType.map(t => t.toUpperCase());

    // CTR: Currency Transaction Report — triggered by high-value cash transactions
    if (activityTypes.some(t => t.includes('CTR') || t.includes('CURRENCY_TRANSACTION'))) {
      return 'CTR';
    }
    // IFT: International Funds Transfer — cross-border wire transfer
    if (activityTypes.some(t => t.includes('IFT') || t.includes('INTERNATIONAL_TRANSFER'))) {
      return 'IFT';
    }
    // STR: Suspicious Transaction Report — transaction-specific suspicion
    if (activityTypes.some(t => t.includes('STR') || t.includes('SUSPICIOUS_TRANSACTION'))) {
      return 'STR';
    }
    // PNMR: PEP/NPO Management Report
    if (activityTypes.some(t => t.includes('PNMR') || t.includes('PEP') || t.includes('NPO'))) {
      return 'PNMR';
    }
    // Default to SAR (Suspicious Activity Report) — broadest category
    return 'SAR';
  }

  // ─── generateFiling ────────────────────────────────────────────────────────

  /**
   * Generate a goAML XML v4.2 filing string from the SAR payload.
   *
   * Delegates to generateGoAMLXML() from @/lib/compliance/goaml-xml.
   * The generated XML is UAE-specific per PRINCIPLE C.
   */
  async generateFiling(payload: SARPayload): Promise<string> {
    // Store payload for potential error handling in submit()
    this.lastPayload = payload;

    const goamlData = this.convertToGoAMLData(payload);
    const xml = generateGoAMLXML(goamlData);

    // Audit the generation
    await this.auditFilingAction('GENERATED', payload, 'system', {
      reportType: goamlData.reportType,
      format: 'goAML_XML',
    });

    return xml;
  }

  // ─── validateFiling ────────────────────────────────────────────────────────

  /**
   * Validate the SAR payload against UAE-specific rules.
   *
   * Checks:
   * - Required fields per UAE FIU requirements
   * - Emirates ID format (784-YYYY-NNNNNNN-X)
   * - Transaction amount for CTR threshold
   * - MLRO decision present
   */
  async validateFiling(payload: SARPayload): Promise<FilingValidationResult> {
    const errors: FilingValidationError[] = [];
    const warnings: string[] = [];

    // ─── Required Fields ───────────────────────────────────────────────────
    if (!payload.filingId) {
      errors.push({ field: 'filingId', message: 'Filing ID is required for UAE FIU submissions', severity: 'error' });
    }
    if (!payload.customerName) {
      errors.push({ field: 'customerName', message: 'Customer/subject name is required per CBUAE goAML specification', severity: 'error' });
    }
    if (!payload.suspiciousActivityDescription) {
      errors.push({ field: 'suspiciousActivityDescription', message: 'Narrative/suspicious activity description is required per FDL 10/2025 Article 14', severity: 'error' });
    }
    if (!payload.mlroName) {
      errors.push({ field: 'mlroName', message: 'MLRO name is required for 4-Eyes workflow (PRINCIPLE F)', severity: 'error' });
    }
    if (payload.mlroDecision !== 'file_sar') {
      errors.push({ field: 'mlroDecision', message: 'MLRO must have decided to file SAR before submission (PRINCIPLE F)', severity: 'error' });
    }
    if (!payload.detectionDate) {
      errors.push({ field: 'detectionDate', message: 'Detection date is required to calculate the 30-calendar-day deadline', severity: 'error' });
    }

    // ─── Emirates ID Validation ────────────────────────────────────────────
    if (payload.nationalId && payload.customerType === 'individual') {
      if (!this.validateEmiratesId(payload.nationalId)) {
        errors.push({
          field: 'nationalId',
          message: `Emirates ID "${payload.nationalId}" does not match UAE format 784-YYYY-NNNNNNN-X. This will cause FIU portal rejection.`,
          severity: 'error',
        });
      }
    }

    // ─── Reporting Entity ──────────────────────────────────────────────────
    if (!payload.reportingEntityName) {
      warnings.push('Reporting entity name is recommended for UAE FIU submissions per CBUAE guidance');
    }
    if (!payload.reportingEntityLicense) {
      warnings.push('Reporting entity license number is recommended — UAE FIU may request it');
    }

    // ─── Transaction Amount ────────────────────────────────────────────────
    if (payload.transactionAmount === undefined || payload.transactionAmount === null) {
      warnings.push('Transaction amount is not specified — required for STR/SAR/CTR report types');
    } else if (payload.transactionAmount >= 55_000) {
      warnings.push('Transaction amount >= AED 55,000 — CTR auto-detection may apply per FDL 10/2025 Article 15');
    }

    // ─── Deadline Warning ──────────────────────────────────────────────────
    if (payload.detectionDate) {
      const deadlineInfo = this.getDeadlineInfo(payload.detectionDate);
      if (deadlineInfo.isOverdue) {
        errors.push({
          field: 'filingDeadline',
          message: `Filing is OVERDUE. Deadline was ${deadlineInfo.deadlineDate.toISOString()}. Criminal liability per FDL 10/2025.`,
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
   * Validate the format of a generated goAML XML string.
   *
   * Delegates to validateGoAMLXML() from @/lib/compliance/goaml-xml
   * and maps the result to our FilingValidationResult type.
   */
  async validateFormat(filingString: string): Promise<FilingValidationResult> {
    const goamlResult: GoAMLXMLValidationResult = validateGoAMLXMLStructure(filingString);

    // Map goAML-xml.ts XMLValidationError → our FilingValidationError
    const errors: FilingValidationError[] = goamlResult.errors.map(e => ({
      field: e.path,
      message: e.message,
      severity: e.severity,
    }));

    return {
      valid: goamlResult.isValid,
      errors,
      warnings: goamlResult.warnings,
    };
  }

  // ─── submit ────────────────────────────────────────────────────────────────

  /**
   * Submit a goAML filing to the UAE FIU.
   *
   * Delegates to submitGoAMLFiling() from @/lib/integrations/regulatory-gateway.
   * Converts our types to GoAMLSubmissionRequest.
   * On failure, triggers handleSubmissionError() for manual fallback (PRINCIPLE E).
   */
  async submit(filingString: string, filingId: string): Promise<FilingResult> {
    // Parse the report type from the XML — extract <ReportCode> value
    const reportCodeMatch = filingString.match(/<ReportCode>(.*?)<\/ReportCode>/);
    const reportType = (reportCodeMatch?.[1] || 'SAR') as GoAMLReportType;

    // Parse the reference number from the XML
    const refMatch = filingString.match(/<ReferenceNumber>(.*?)<\/ReferenceNumber>/);
    const referenceNumber = refMatch?.[1] || filingId;

    // Build the gateway submission request
    const submissionRequest: GoAMLSubmissionRequest = {
      filingId,
      reportType,
      xmlPayload: filingString,
      referenceNumber,
      submittingUserId: 'system', // Will be overridden by the workflow engine with actual user
      submittingUserName: 'System', // Will be overridden by the workflow engine
    };

    try {
      const gatewayResult: GoAMLSubmissionResult = await submitGoAMLFiling(submissionRequest);

      // Map GoAMLSubmissionResult → FilingResult
      const filingResult: FilingResult = {
        success: gatewayResult.success,
        filingId: gatewayResult.filingId,
        submissionId: gatewayResult.submissionId,
        fiuReceiptNumber: gatewayResult.fiuReceiptNumber,
        submittedAt: gatewayResult.submittedAt,
        status: this.mapGatewayStatus(gatewayResult.status),
        integrityHash: gatewayResult.integrityHash,
        mode: gatewayResult.mode === 'simulation' ? 'rpa_simulation' : gatewayResult.mode,
        errorMessage: gatewayResult.errorMessage,
        retryCount: gatewayResult.retryCount,
      };

      // If submission failed and we have the payload, trigger manual fallback
      if (!gatewayResult.success && this.lastPayload) {
        const error = new Error(gatewayResult.errorMessage || 'Submission failed');
        return this.handleSubmissionError(this.lastPayload, error, filingId);
      }

      // Clear cached payload on success
      if (filingResult.success) {
        this.lastPayload = null;
      }

      return filingResult;
    } catch (error) {
      // Unhandled exception — trigger manual fallback (PRINCIPLE E)
      if (this.lastPayload) {
        const err = error instanceof Error ? error : new Error(String(error));
        return this.handleSubmissionError(this.lastPayload, err, filingId);
      }

      // No payload cached — return a basic error result
      const integrityHash = this.computeFilingHash(filingString);
      return {
        success: false,
        filingId,
        submissionId: `ERR-${Date.now()}`,
        fiuReceiptNumber: null,
        submittedAt: new Date().toISOString(),
        status: 'manual_fallback',
        integrityHash,
        mode: 'manual_fallback',
        errorMessage: error instanceof Error ? error.message : 'Unknown submission error',
        retryCount: 0,
      };
    }
  }

  /**
   * Map the gateway's status strings to our FilingStatus enum.
   */
  private mapGatewayStatus(
    status: 'SUBMITTED_TO_FIU' | 'ACKNOWLEDGED' | 'REJECTED_BY_FIU' | 'SUBMISSION_FAILED'
  ): FilingResult['status'] {
    switch (status) {
      case 'SUBMITTED_TO_FIU':
        return 'submitted_to_fiu';
      case 'ACKNOWLEDGED':
        return 'acknowledged';
      case 'REJECTED_BY_FIU':
        return 'rejected';
      case 'SUBMISSION_FAILED':
        return 'manual_fallback';
      default:
        return 'manual_fallback';
    }
  }

  // ─── generateManualFallback ────────────────────────────────────────────────

  /**
   * Generate a manual fallback document for UAE FIU portal submission.
   *
   * PRINCIPLE E: Mandatory manual fallback on electronic submission failure.
   * This document provides step-by-step instructions for filing through
   * the goAML portal at https://fiu.goaml.gov.ae when API submission fails.
   */
  async generateManualFallback(payload: SARPayload, reason: string): Promise<ManualFallbackDocument> {
    return {
      title: 'UAE CBUAE SAR Manual Filing — goAML Portal',
      jurisdiction: 'AE',
      regulator: 'CBUAE',
      fiuName: this.fiuName,
      generatedAt: new Date().toISOString(),
      reason,
      submissionInstructions: [
        '1. Open the goAML portal at https://fiu.goaml.gov.ae',
        '2. Log in with your institution\'s goAML credentials',
        '3. Navigate to "New Filing" → select the appropriate report type (STR/SAR/CTR/IFT/PNMR)',
        '4. In the "Reporting Entity" section, enter the entity name, license number, and TRN as shown below',
        '5. In the "Subject" section, enter the customer/subject details including Emirates ID',
        '6. In the "Transaction" section, enter the amount in AED, currency, date, and transaction type',
        '7. In the "Narrative" section, paste the suspicious activity description exactly as shown below',
        '8. Review all fields for accuracy — incorrect filings may result in regulatory penalties',
        '9. Submit the filing and record the FIU receipt/acknowledgment number',
        '10. Update the IC-OS system with the receipt number and mark the filing as acknowledged',
        '',
        'IMPORTANT: The 30-calendar-day deadline continues to run during manual filing.',
        'Ensure manual submission is completed before the deadline expires.',
        'Regulatory Reference: FDL 10/2025 Article 14; CBUAE Notice 3551/2021 S4.2',
      ],
      formFields: {
        'Report Type': this.deriveReportType(payload),
        'Reference Number': payload.filingId,
        'Reporting Entity Name': payload.reportingEntityName || '',
        'Reporting Entity License': payload.reportingEntityLicense || '',
        'Reporting Entity TRN': payload.reportingEntityTRN || '',
        'Reporting Entity Address': payload.reportingEntityAddress || '',
        'Contact Person': payload.reportingEntityContactPerson || '',
        'Contact Phone': payload.reportingEntityContactPhone || '',
        'Subject Full Name': payload.customerName,
        'Customer Type': payload.customerType,
        'Emirates ID': payload.nationalId || '',
        'Passport Number': payload.passportNumber || '',
        'Nationality': payload.nationality || '',
        'Date of Birth': payload.dateOfBirth || '',
        'Phone': payload.phone || '',
        'Email': payload.email || '',
        'Address': payload.address || '',
        'Account Number': payload.accountNumber || '',
        'Transaction Amount (AED)': payload.transactionAmount?.toFixed(2) || '0.00',
        'Currency': payload.transactionCurrency || 'AED',
        'Transaction Date': payload.transactionDate || '',
        'Transaction Type': payload.transactionType || '',
        'Originating Country': payload.originatingCountry || '',
        'Destination Country': payload.destinationCountry || '',
        'Beneficiary Name': payload.beneficiaryName || '',
        'Beneficiary Account': payload.beneficiaryAccount || '',
        'Suspicious Activity Description': payload.suspiciousActivityDescription,
        'Activity Types': payload.suspiciousActivityType.join(', '),
        'MLRO Name': payload.mlroName,
        'MLRO Decision': payload.mlroDecision,
        'MLRO Decision Date': payload.mlroDecisionDate || '',
        'Detection Date': payload.detectionDate?.toISOString() || '',
        'Filing Deadline': this.calculateDeadline(payload.detectionDate).toISOString(),
      },
      payload,
      portalUrl: 'https://fiu.goaml.gov.ae',
    };
  }
}
