/**
 * Regulatory Thresholds — Jurisdiction-Specific Compliance Parameters
 *
 * Provides a single source of truth for jurisdiction-specific regulatory
 * thresholds used by the Master System Context and compliance review phases.
 *
 * Each GCC jurisdiction has distinct regulatory parameters for:
 *   - SAR/STR filing deadlines
 *   - CTR (Currency Transaction Report) thresholds
 *   - UBO (Ultimate Beneficial Owner) thresholds
 *   - Record retention requirements
 *   - FIU (Financial Intelligence Unit) details
 *
 * Phase 2 (Action 2.2): Created to support jurisdiction-parameterized
 * Master System Context refactoring.
 */

import { JURISDICTION_TO_CURRENCY } from '@/lib/constants/jurisdictions';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RegulatoryThresholds {
  /** ISO 3166-1 alpha-2 jurisdiction code */
  jurisdiction: string;
  /** Human-readable regulator name (e.g., "CBUAE", "SAMA") */
  regulatorName: string;
  /** Full country name for disclaimers */
  countryName: string;
  /** SAR/STR filing deadline value */
  sarDeadline: number;
  /** Unit for SAR deadline: 'calendar_days' or 'business_days' */
  sarDeadlineUnit: 'calendar_days' | 'business_days';
  /** Currency Transaction Report threshold in local currency */
  ctr: number;
  /** Local currency code (AED, SAR, BHD, QAR, OMR, KWD) */
  currency: string;
  /** UBO beneficial ownership threshold percentage */
  beneficialOwnershipThreshold: number;
  /** Financial Intelligence Unit name */
  fiuName: string;
  /** SAR filing format (e.g., "goAML", "SAMA SAR System") */
  sarFilingFormat: string;
  /** Minimum record retention period in years */
  recordRetentionYears: number;
  /** Key regulatory law/decrees for citations */
  primaryRegulations: string[];
}

// ─── Per-Jurisdiction Threshold Data ─────────────────────────────────────────

const UAE_THRESHOLDS: RegulatoryThresholds = {
  jurisdiction: 'AE',
  regulatorName: 'CBUAE',
  countryName: 'United Arab Emirates',
  sarDeadline: 30,
  sarDeadlineUnit: 'calendar_days',
  ctr: 55000,
  currency: 'AED',
  beneficialOwnershipThreshold: 25,
  fiuName: 'UAE FIU (Anti-Money Laundering and Suspicious Cases Unit)',
  sarFilingFormat: 'goAML',
  recordRetentionYears: 5,
  primaryRegulations: [
    'FDL 10/2025 (Federal Decree-Law on AML/CFT)',
    'CR 134/2025 (Cabinet Resolution on UBO)',
    'CBUAE Notice 3551/2021',
  ],
};

const KSA_THRESHOLDS: RegulatoryThresholds = {
  jurisdiction: 'SA',
  regulatorName: 'SAMA',
  countryName: 'Kingdom of Saudi Arabia',
  sarDeadline: 15, // TODO: Verify with SME — KSA HR/Compliance SME (contact: hr-compliance-sme-ksa@icos.local) — must confirm SAR filing deadline with SAMA
  sarDeadlineUnit: 'calendar_days', // TODO: Verify with SME — KSA HR/Compliance SME (contact: hr-compliance-sme-ksa@icos.local) — confirm calendar vs business days
  ctr: 60000, // TODO: Verify with SME — KSA HR/Compliance SME (contact: hr-compliance-sme-ksa@icos.local) — must confirm CTR threshold with SAMA
  currency: 'SAR',
  beneficialOwnershipThreshold: 25,
  fiuName: 'SAMA FIU',
  sarFilingFormat: 'SAMA SAR Format',
  recordRetentionYears: 10,
  primaryRegulations: [
    'Anti-Money Laundering Law (Royal Decree No. M/39)',
    'SAMA AML/CFT Rules',
    'SAMA Implementing Regulation',
  ],
};

const BAHRAIN_THRESHOLDS: RegulatoryThresholds = {
  jurisdiction: 'BH',
  regulatorName: 'CBB',
  countryName: 'Kingdom of Bahrain',
  sarDeadline: 5,
  sarDeadlineUnit: 'business_days',
  ctr: 10000,
  currency: 'BHD',
  beneficialOwnershipThreshold: 20,
  fiuName: 'CBB FID',
  sarFilingFormat: 'CBB SAR Form',
  recordRetentionYears: 5,
  primaryRegulations: [
    'CBB Rulebook Volume 3 — Financial Crime Module (FC)',
    'Decree Law No. 4 of 2001 (as amended by Law 54/2006)',
    'CBB Circulars on AML/CFT',
  ],
};

const QATAR_THRESHOLDS: RegulatoryThresholds = {
  jurisdiction: 'QA',
  regulatorName: 'QCB',
  countryName: 'State of Qatar',
  sarDeadline: 15, // TODO: Verify with SME — Qatar HR/Compliance SME (contact: hr-compliance-sme-qa@icos.local) — must confirm SAR filing deadline with QCB
  sarDeadlineUnit: 'calendar_days', // TODO: Verify with SME — Qatar HR/Compliance SME (contact: hr-compliance-sme-qa@icos.local) — confirm calendar vs business days
  ctr: 55000, // TODO: Verify with SME — Qatar HR/Compliance SME (contact: hr-compliance-sme-qa@icos.local) — must confirm CTR threshold with QCB
  currency: 'QAR',
  beneficialOwnershipThreshold: 20, // TODO: Verify with SME — Qatar HR/Compliance SME (contact: hr-compliance-sme-qa@icos.local) — confirm UBO threshold
  fiuName: 'QFIU',
  sarFilingFormat: 'QCB SAR Format',
  recordRetentionYears: 5,
  primaryRegulations: [
    'Law No. 20 of 2019 (AML/CFT Law)',
    'QCB AML/CFT Instructions 2019',
    'Decision No. 1/2020 (Beneficial Ownership)',
  ],
};

const OMAN_THRESHOLDS: RegulatoryThresholds = {
  jurisdiction: 'OM',
  regulatorName: 'CBOA',
  countryName: 'Sultanate of Oman',
  sarDeadline: 15, // TODO: Verify with SME — Oman HR/Compliance SME (contact: hr-compliance-sme-om@icos.local) — must confirm SAR filing deadline with CBOA
  sarDeadlineUnit: 'calendar_days', // TODO: Verify with SME — Oman HR/Compliance SME (contact: hr-compliance-sme-om@icos.local) — confirm calendar vs business days
  ctr: 10000, // TODO: Verify with SME — Oman HR/Compliance SME (contact: hr-compliance-sme-om@icos.local) — must confirm CTR threshold with CBOA
  currency: 'OMR',
  beneficialOwnershipThreshold: 20, // TODO: Verify with SME — Oman HR/Compliance SME (contact: hr-compliance-sme-om@icos.local) — confirm UBO threshold
  fiuName: 'Oman FIU',
  sarFilingFormat: 'CBOA SAR Format',
  recordRetentionYears: 5,
  primaryRegulations: [
    'Royal Decree 34/2015 (AML/CFT Law)',
    'CBOA AML/CFT Directive 2016',
    'Executive Regulation of AML/CFT Law',
  ],
};

const KUWAIT_THRESHOLDS: RegulatoryThresholds = {
  jurisdiction: 'KW',
  regulatorName: 'CBK',
  countryName: 'State of Kuwait',
  sarDeadline: 15, // TODO: Verify with SME — Kuwait HR/Compliance SME (contact: hr-compliance-sme-kw@icos.local) — must confirm SAR filing deadline with CBK
  sarDeadlineUnit: 'calendar_days', // TODO: Verify with SME — Kuwait HR/Compliance SME (contact: hr-compliance-sme-kw@icos.local) — confirm calendar vs business days
  ctr: 3000, // TODO: Verify with SME — Kuwait HR/Compliance SME (contact: hr-compliance-sme-kw@icos.local) — must confirm CTR threshold with CBK
  currency: 'KWD',
  beneficialOwnershipThreshold: 20, // TODO: Verify with SME — Kuwait HR/Compliance SME (contact: hr-compliance-sme-kw@icos.local) — confirm UBO threshold
  fiuName: 'KFIU',
  sarFilingFormat: 'CBK SAR Format',
  recordRetentionYears: 5,
  primaryRegulations: [
    'Law No. 106 of 2013 (AML/CFT Law)',
    'CBK AML/CFT Instructions 2014',
    'Ministerial Resolution No. 174/2014',
  ],
};

// ─── Lookup Map ──────────────────────────────────────────────────────────────

const THRESHOLD_MAP: Record<string, RegulatoryThresholds> = {
  // GCC alpha-2 codes
  AE: UAE_THRESHOLDS,
  SA: KSA_THRESHOLDS,
  BH: BAHRAIN_THRESHOLDS,
  QA: QATAR_THRESHOLDS,
  OM: OMAN_THRESHOLDS,
  KW: KUWAIT_THRESHOLDS,
  // Legacy UAE sub-jurisdiction codes
  CBUAE: UAE_THRESHOLDS,
  DFSA: UAE_THRESHOLDS,
  FSRA: UAE_THRESHOLDS,
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns the regulatory thresholds for the given jurisdiction.
 * Falls back to UAE (CBUAE) thresholds for unrecognized codes.
 *
 * @param jurisdiction - GCC alpha-2 code (AE, SA, BH, QA, OM, KW)
 *                       or legacy code (CBUAE, DFSA, FSRA)
 * @returns RegulatoryThresholds for the jurisdiction
 */
export function getRegulatoryThresholds(jurisdiction: string): RegulatoryThresholds {
  // Resolve currency from centralized mapping if not already set
  const thresholds = THRESHOLD_MAP[jurisdiction];
  if (thresholds) {
    return thresholds;
  }

  // Fallback: try to find by partial match (e.g., lowercase 'ae')
  const upper = jurisdiction.toUpperCase();
  if (THRESHOLD_MAP[upper]) {
    return THRESHOLD_MAP[upper];
  }

  // Ultimate fallback: UAE/CBUAE thresholds
  return UAE_THRESHOLDS;
}

/**
 * Returns the currency code for a jurisdiction.
 * Convenience wrapper around JURISDICTION_TO_CURRENCY.
 */
export function getJurisdictionCurrency(jurisdiction: string): string {
  return JURISDICTION_TO_CURRENCY[jurisdiction] || 'AED';
}

/**
 * Returns a formatted string summarizing key thresholds for a jurisdiction.
 * Useful for embedding in system prompts or disclaimers.
 */
export function getThresholdsSummary(jurisdiction: string): string {
  const t = getRegulatoryThresholds(jurisdiction);
  return [
    `Regulator: ${t.regulatorName} (${t.countryName})`,
    `SAR/STR Deadline: ${t.sarDeadline} ${t.sarDeadlineUnit === 'business_days' ? 'business days' : 'calendar days'}`,
    `CTR Threshold: ${t.ctr.toLocaleString()} ${t.currency}`,
    `UBO Threshold: ≥${t.beneficialOwnershipThreshold}%`,
    `FIU: ${t.fiuName}`,
    `Record Retention: ${t.recordRetentionYears} years`,
    `Primary Regulations: ${t.primaryRegulations.join(', ')}`,
  ].join('\n');
}
