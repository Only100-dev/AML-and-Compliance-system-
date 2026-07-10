/**
 * IC-OS PII Library Integration Hooks
 * Phase 1 Regulatory Critical Enhancement
 *
 * Connects UI components to the @/lib/pii masking module.
 * Provides React hooks, record-type-specific masking functions,
 * and CBUAE view-level masking configuration.
 *
 * Key features:
 *   - usePIIMasking React hook for client components
 *   - maskComplianceRecord function for different record types
 *   - CBUAE_VIEW_MASKING_CONFIG with field-level masking rules
 *   - Record-specific masking: AML alerts, KYC, SAR, Sanctions
 *   - applyCBUAEViewMasking for regulator-facing data views
 */

import {
  maskPartial,
  maskName,
  maskEmiratesId,
  maskPassport,
  maskPhone,
  maskEmail,
  maskAccountNumber,
  maskTradeLicense,
  maskTRN,
  maskAmount,
  maskAddress,
  maskFull,
  maskNone,
} from '@/lib/pii';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type MaskingStrategy =
  | 'none'
  | 'partial'
  | 'name'
  | 'emiratesId'
  | 'passport'
  | 'phone'
  | 'email'
  | 'accountNumber'
  | 'tradeLicense'
  | 'trn'
  | 'amount'
  | 'address'
  | 'full';

export type ComplianceRecordType =
  | 'aml_alert'
  | 'kyc_individual'
  | 'kyc_corporate'
  | 'kyc_vasp'
  | 'sar_case'
  | 'sanctions_screening'
  | 'claim'
  | 'insurance_record'
  | 'general';

export type ViewMode = 'internal' | 'cbuae' | 'auditor' | 'board';

export interface FieldMaskingRule {
  field: string;
  strategy: MaskingStrategy;
  /** Only apply masking for these view modes. Empty = all views. */
  applyForViews: ViewMode[];
  /** Whether this field is required even when masked */
  requiredWhenMasked: boolean;
}

export interface MaskingConfig {
  recordType: ComplianceRecordType;
  fields: FieldMaskingRule[];
  defaultStrategy: MaskingStrategy;
}

// ─── Masking Strategy Map ───────────────────────────────────────────────────────

const MASKING_FUNCTIONS: Record<MaskingStrategy, (value: string) => string> = {
  none: maskNone,
  partial: maskPartial,
  name: maskName,
  emiratesId: maskEmiratesId,
  passport: maskPassport,
  phone: maskPhone,
  email: maskEmail,
  accountNumber: maskAccountNumber,
  tradeLicense: maskTradeLicense,
  trn: maskTRN,
  amount: (v: string) => maskAmount(Number(v) || 0),
  address: maskAddress,
  full: maskFull,
};

// ─── CBUAE View Masking Configuration ───────────────────────────────────────────

/**
 * Field-level masking rules for CBUAE (regulator) view.
 * Defines which fields are masked and how when data is shared with
 * or viewed by CBUAE examiners.
 *
 * Per CBUAE Notice 3551/2021, certain fields must be fully masked
 * in regulator-facing views to protect ongoing investigations,
 * while other fields remain visible for regulatory review purposes.
 */
export const CBUAE_VIEW_MASKING_CONFIG: Record<ComplianceRecordType, MaskingConfig> = {
  aml_alert: {
    recordType: 'aml_alert',
    defaultStrategy: 'partial',
    fields: [
      { field: 'id', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'caseId', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'riskScore', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'riskLevel', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'alertType', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'description', strategy: 'full', applyForViews: ['cbuae'], requiredWhenMasked: false },
      { field: 'assignedTo', strategy: 'name', applyForViews: ['cbuae'], requiredWhenMasked: false },
      { field: 'createdBy', strategy: 'name', applyForViews: ['cbuae'], requiredWhenMasked: false },
      { field: 'amount', strategy: 'amount', applyForViews: ['cbuae'], requiredWhenMasked: false },
      { field: 'policyNumber', strategy: 'partial', applyForViews: ['cbuae'], requiredWhenMasked: true },
      { field: 'jurisdiction', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'status', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
    ],
  },
  kyc_individual: {
    recordType: 'kyc_individual',
    defaultStrategy: 'name',
    fields: [
      { field: 'id', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'fullName', strategy: 'name', applyForViews: ['cbuae', 'auditor'], requiredWhenMasked: true },
      { field: 'emiratesId', strategy: 'emiratesId', applyForViews: ['cbuae', 'auditor', 'board'], requiredWhenMasked: true },
      { field: 'passportNo', strategy: 'passport', applyForViews: ['cbuae', 'auditor', 'board'], requiredWhenMasked: true },
      { field: 'nationality', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'isPep', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'riskRating', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'eddRequired', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'status', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
    ],
  },
  kyc_corporate: {
    recordType: 'kyc_corporate',
    defaultStrategy: 'partial',
    fields: [
      { field: 'id', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'legalName', strategy: 'name', applyForViews: ['cbuae', 'auditor'], requiredWhenMasked: true },
      { field: 'tradeLicenseNo', strategy: 'tradeLicense', applyForViews: ['cbuae', 'auditor'], requiredWhenMasked: true },
      { field: 'trn', strategy: 'trn', applyForViews: ['cbuae', 'auditor', 'board'], requiredWhenMasked: true },
      { field: 'legalForm', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'uboIdentified', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'uboDetails', strategy: 'full', applyForViews: ['cbuae', 'auditor', 'board'], requiredWhenMasked: false },
      { field: 'pepInManagement', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'riskScore', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'riskRating', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'status', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
    ],
  },
  kyc_vasp: {
    recordType: 'kyc_vasp',
    defaultStrategy: 'partial',
    fields: [
      { field: 'id', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'vaspName', strategy: 'name', applyForViews: ['cbuae', 'auditor'], requiredWhenMasked: true },
      { field: 'licenseNumber', strategy: 'partial', applyForViews: ['cbuae', 'auditor'], requiredWhenMasked: true },
      { field: 'walletAddress', strategy: 'full', applyForViews: ['cbuae', 'auditor', 'board'], requiredWhenMasked: false },
      { field: 'riskScore', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'riskRating', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'travelRuleCompliant', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'uboDetails', strategy: 'full', applyForViews: ['cbuae', 'auditor', 'board'], requiredWhenMasked: false },
      { field: 'status', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
    ],
  },
  sar_case: {
    recordType: 'sar_case',
    defaultStrategy: 'full',
    fields: [
      { field: 'id', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'caseNumber', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'subjectName', strategy: 'name', applyForViews: ['cbuae'], requiredWhenMasked: true },
      { field: 'subjectType', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'narrative', strategy: 'full', applyForViews: ['cbuae', 'auditor'], requiredWhenMasked: false },
      { field: 'filingDeadline', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'daysRemaining', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'status', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'riskLevel', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'jurisdiction', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'tippingOffWarning', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'createdById', strategy: 'name', applyForViews: ['cbuae', 'auditor'], requiredWhenMasked: false },
      { field: 'reviewedById', strategy: 'name', applyForViews: ['cbuae', 'auditor'], requiredWhenMasked: false },
    ],
  },
  sanctions_screening: {
    recordType: 'sanctions_screening',
    defaultStrategy: 'partial',
    fields: [
      { field: 'id', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'screeningId', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'entityType', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'primaryName', strategy: 'name', applyForViews: ['cbuae', 'auditor'], requiredWhenMasked: true },
      { field: 'aliases', strategy: 'full', applyForViews: ['cbuae', 'auditor', 'board'], requiredWhenMasked: false },
      { field: 'identifiers', strategy: 'full', applyForViews: ['cbuae', 'auditor', 'board'], requiredWhenMasked: false },
      { field: 'status', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'highestScore', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'matches', strategy: 'full', applyForViews: ['cbuae', 'auditor'], requiredWhenMasked: false },
      { field: 'screeningLists', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
    ],
  },
  claim: {
    recordType: 'claim',
    defaultStrategy: 'partial',
    fields: [
      { field: 'id', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'claimNumber', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'policyNumber', strategy: 'partial', applyForViews: ['cbuae'], requiredWhenMasked: true },
      { field: 'claimantName', strategy: 'name', applyForViews: ['cbuae', 'auditor'], requiredWhenMasked: true },
      { field: 'amount', strategy: 'amount', applyForViews: ['cbuae'], requiredWhenMasked: false },
      { field: 'fraudScore', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'status', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'siuFlagged', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'description', strategy: 'full', applyForViews: ['cbuae'], requiredWhenMasked: false },
    ],
  },
  insurance_record: {
    recordType: 'insurance_record',
    defaultStrategy: 'partial',
    fields: [
      { field: 'id', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'policyNumber', strategy: 'partial', applyForViews: ['cbuae'], requiredWhenMasked: true },
      { field: 'clientName', strategy: 'name', applyForViews: ['cbuae', 'auditor'], requiredWhenMasked: true },
      { field: 'emirate', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'productType', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'premiumAED', strategy: 'amount', applyForViews: ['cbuae'], requiredWhenMasked: false },
      { field: 'amlStatus', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
    ],
  },
  general: {
    recordType: 'general',
    defaultStrategy: 'partial',
    fields: [
      { field: 'id', strategy: 'none', applyForViews: [], requiredWhenMasked: true },
      { field: 'name', strategy: 'name', applyForViews: ['cbuae', 'auditor'], requiredWhenMasked: true },
      { field: 'email', strategy: 'email', applyForViews: ['cbuae', 'auditor', 'board'], requiredWhenMasked: true },
      { field: 'phone', strategy: 'phone', applyForViews: ['cbuae', 'auditor', 'board'], requiredWhenMasked: true },
      { field: 'address', strategy: 'address', applyForViews: ['cbuae', 'auditor'], requiredWhenMasked: false },
    ],
  },
};

// ─── Core Masking Logic (non-hook) ───────────────────────────────────────────────

/**
 * Mask a single field value using the specified strategy.
 * In 'internal' view mode, no masking is applied by default.
 */
export function maskFieldValue(value: string, strategy: MaskingStrategy, viewMode: ViewMode = 'internal'): string {
  if (viewMode === 'internal') {
    return value; // Internal users see unmasked data
  }
  return MASKING_FUNCTIONS[strategy](value);
}

/**
 * Mask an entire record based on the record type and view mode.
 * This is the core masking function used by both the React hook
 * and the standalone masking functions.
 */
export function maskRecordData<T extends Record<string, unknown>>(
  data: T,
  recordType: ComplianceRecordType,
  viewMode: ViewMode = 'internal'
): T {
  if (viewMode === 'internal') {
    return data; // Internal users see unmasked data
  }

  const config = CBUAE_VIEW_MASKING_CONFIG[recordType];
  const masked = { ...data };

  for (const rule of config.fields) {
    const shouldMask =
      rule.applyForViews.length === 0 || rule.applyForViews.includes(viewMode);

    if (shouldMask && rule.field in masked) {
      const originalValue = masked[rule.field];
      if (typeof originalValue === 'string') {
        (masked as Record<string, unknown>)[rule.field] =
          MASKING_FUNCTIONS[rule.strategy](originalValue);
      } else if (typeof originalValue === 'number' && rule.strategy === 'amount') {
        (masked as Record<string, unknown>)[rule.field] =
          maskAmount(originalValue);
      }
    }
  }

  return masked;
}

/**
 * Check if a field should be masked for the given view mode.
 */
export function isFieldMaskedForView(field: string, recordType: ComplianceRecordType, viewMode: ViewMode = 'internal'): boolean {
  if (viewMode === 'internal') return false;

  const config = CBUAE_VIEW_MASKING_CONFIG[recordType];
  const rule = config.fields.find((r) => r.field === field);

  if (!rule) return true; // Default: mask unknown fields

  return rule.applyForViews.length === 0 || rule.applyForViews.includes(viewMode);
}

/**
 * Get the masking strategy for a specific field and record type.
 */
export function getFieldMaskingStrategy(field: string, recordType: ComplianceRecordType): MaskingStrategy {
  const config = CBUAE_VIEW_MASKING_CONFIG[recordType];
  const rule = config.fields.find((r) => r.field === field);
  return rule?.strategy ?? config.defaultStrategy;
}

// ─── usePIIMasking React Hook ───────────────────────────────────────────────────

/**
 * React hook for PII masking in client components.
 * Provides masking functions and record-specific masking utilities.
 *
 * Usage:
 * ```tsx
 * 'use client';
 * import { usePIIMasking } from '@/lib/compliance/pii-hooks';
 *
 * function AlertCard({ alert }) {
 *   const { mask, maskRecord } = usePIIMasking('cbuae');
 *   return <div>{mask(alert.assignedTo, 'name')}</div>;
 * }
 * ```
 */
export function usePIIMasking(viewMode: ViewMode = 'internal') {
  /**
   * Mask a single field value using the specified strategy.
   */
  const mask = (value: string, strategy: MaskingStrategy): string => {
    return maskFieldValue(value, strategy, viewMode);
  };

  /**
   * Mask an entire record based on the record type and view mode.
   */
  const maskRecord = <T extends Record<string, unknown>>(
    data: T,
    recordType: ComplianceRecordType
  ): T => {
    return maskRecordData(data, recordType, viewMode);
  };

  /**
   * Apply CBUAE-specific masking to a record.
   * Shorthand for maskRecord with 'cbuae' view mode.
   */
  const maskForCBUAE = <T extends Record<string, unknown>>(
    data: T,
    recordType: ComplianceRecordType
  ): T => {
    return maskRecord(data, recordType);
  };

  /**
   * Check if a field should be masked for the current view mode.
   */
  const isFieldMasked = (field: string, recordType: ComplianceRecordType): boolean => {
    return isFieldMaskedForView(field, recordType, viewMode);
  };

  /**
   * Get the masking strategy for a specific field and record type.
   */
  const getFieldStrategy = (field: string, recordType: ComplianceRecordType): MaskingStrategy => {
    return getFieldMaskingStrategy(field, recordType);
  };

  return {
    mask,
    maskRecord,
    maskForCBUAE,
    isFieldMasked,
    getFieldStrategy,
    viewMode,
    // Direct access to masking functions
    maskPartial,
    maskName,
    maskEmiratesId,
    maskPassport,
    maskPhone,
    maskEmail,
    maskAccountNumber,
    maskTradeLicense,
    maskTRN,
    maskAmount,
    maskAddress,
    maskFull,
    maskNone,
  };
}

// ─── Record-Specific Masking Functions ──────────────────────────────────────────

/**
 * Mask an AML alert record for the specified view mode.
 * Hides subject details, narrative, and assigned personnel for CBUAE view.
 */
export function maskAMLAlert(
  data: Record<string, unknown>,
  viewMode: ViewMode = 'cbuae'
): Record<string, unknown> {
  return maskRecordData(data, 'aml_alert', viewMode);
}

/**
 * Mask an individual KYC record.
 * Protects full name, Emirates ID, passport number, and other PII.
 */
export function maskKYCRecord(
  data: Record<string, unknown>,
  viewMode: ViewMode = 'cbuae'
): Record<string, unknown> {
  // Detect if corporate or individual based on fields present
  const isCorporate = 'legalName' in data || 'tradeLicenseNo' in data;
  const isVASP = 'vaspName' in data || 'walletAddress' in data;

  if (isVASP) return maskRecordData(data, 'kyc_vasp', viewMode);
  if (isCorporate) return maskRecordData(data, 'kyc_corporate', viewMode);
  return maskRecordData(data, 'kyc_individual', viewMode);
}

/**
 * Mask a SAR case record.
 * Maximum confidentiality — narrative and subject details fully masked
 * for non-internal views per FDL 10/2025 Art. 12.
 */
export function maskSARCase(
  data: Record<string, unknown>,
  viewMode: ViewMode = 'cbuae'
): Record<string, unknown> {
  return maskRecordData(data, 'sar_case', viewMode);
}

/**
 * Mask a sanctions screening record.
 * Protects subject identity and match details for non-internal views.
 */
export function maskSanctionsScreening(
  data: Record<string, unknown>,
  viewMode: ViewMode = 'cbuae'
): Record<string, unknown> {
  return maskRecordData(data, 'sanctions_screening', viewMode);
}

// ─── Generic Compliance Record Masking ──────────────────────────────────────────

/**
 * Mask a compliance record based on its type.
 * Automatically selects the appropriate masking configuration.
 */
export function maskComplianceRecord(
  data: Record<string, unknown>,
  recordType: ComplianceRecordType,
  viewMode: ViewMode = 'cbuae'
): Record<string, unknown> {
  return maskRecordData(data, recordType, viewMode);
}

// ─── CBUAE View Masking ─────────────────────────────────────────────────────────

/**
 * Apply CBUAE view masking to data based on record type.
 * This is the primary function for preparing data for CBUAE
 * regulator review or examination.
 *
 * All fields marked for CBUAE masking in the CBUAE_VIEW_MASKING_CONFIG
 * will be masked according to their defined strategy.
 *
 * @param data - The record data to mask
 * @param recordType - The type of compliance record
 * @returns A new object with masked fields
 */
export function applyCBUAEViewMasking(
  data: Record<string, unknown>,
  recordType: ComplianceRecordType
): Record<string, unknown> {
  const config = CBUAE_VIEW_MASKING_CONFIG[recordType];
  const masked = { ...data };

  for (const rule of config.fields) {
    // Apply masking for CBUAE view specifically
    const shouldMask =
      rule.applyForViews.length === 0 || rule.applyForViews.includes('cbuae');

    if (shouldMask && rule.field in masked) {
      const originalValue = masked[rule.field];
      if (typeof originalValue === 'string') {
        (masked as Record<string, unknown>)[rule.field] =
          MASKING_FUNCTIONS[rule.strategy](originalValue);
      } else if (typeof originalValue === 'number' && rule.strategy === 'amount') {
        (masked as Record<string, unknown>)[rule.field] = maskAmount(originalValue);
      }
    }
  }

  // Apply default masking to any unmapped string fields
  for (const [key, value] of Object.entries(masked)) {
    const hasRule = config.fields.some((r) => r.field === key);
    if (!hasRule && typeof value === 'string' && value.length > 0) {
      (masked as Record<string, unknown>)[key] = MASKING_FUNCTIONS[config.defaultStrategy](value);
    }
  }

  return masked;
}

/**
 * Apply masking for a specific view mode and record type.
 * More flexible than applyCBUAEViewMasking — supports all view modes.
 */
export function applyViewMasking(
  data: Record<string, unknown>,
  recordType: ComplianceRecordType,
  viewMode: ViewMode = 'internal'
): Record<string, unknown> {
  if (viewMode === 'internal') {
    return { ...data }; // No masking for internal users
  }

  if (viewMode === 'cbuae') {
    return applyCBUAEViewMasking(data, recordType);
  }

  // For auditor and board views, apply the same logic with view-specific rules
  const config = CBUAE_VIEW_MASKING_CONFIG[recordType];
  const masked = { ...data };

  for (const rule of config.fields) {
    const shouldMask =
      rule.applyForViews.length === 0 || rule.applyForViews.includes(viewMode);

    if (shouldMask && rule.field in masked) {
      const originalValue = masked[rule.field];
      if (typeof originalValue === 'string') {
        (masked as Record<string, unknown>)[rule.field] =
          MASKING_FUNCTIONS[rule.strategy](originalValue);
      } else if (typeof originalValue === 'number' && rule.strategy === 'amount') {
        (masked as Record<string, unknown>)[rule.field] = maskAmount(originalValue);
      }
    }
  }

  return masked;
}
