/**
 * Intelligence Engine — GCC Jurisdiction Contexts (SSOT)
 * 
 * Single source of truth for the 6 GCC regulatory frameworks.
 * Covers: UAE (CBUAE/DFSA/FSRA), Saudi Arabia (SAMA), Bahrain (CBB),
 * Qatar (QCB), Oman (CBOA), Kuwait (CBK).
 */

// ─── GCC Jurisdiction Codes (imported from SSOT) ────────────────────────────
import { GCC_JURISDICTION_CODES } from '@/lib/constants/jurisdictions';

export const GCC_JURISDICTIONS = GCC_JURISDICTION_CODES;
export type GCCJurisdiction = typeof GCC_JURISDICTION_CODES[number];

// ─── Full Jurisdiction Context ──────────────────────────────────────────────

export interface JurisdictionContext {
  code: GCCJurisdiction;
  country: string;
  regulator: string;
  regulatorFull: string;
  currency: string;
  currencyCode: string;
  language: string;
  flagEmoji: string;
  color: string;
  riskFramework: string;
  keyLegislation: string[];
  amlAuthority: string;
  fiuName: string;
  reportingStandard: string;
}

export const JURISDICTION_CONTEXTS: Record<GCCJurisdiction, JurisdictionContext> = {
  AE: {
    code: 'AE',
    country: 'United Arab Emirates',
    regulator: 'CBUAE',
    regulatorFull: 'Central Bank of the UAE',
    currency: 'UAE Dirham',
    currencyCode: 'AED',
    language: 'Arabic / English',
    flagEmoji: '🇦🇪',
    color: '#10b981',
    riskFramework: 'CBUAE Notice 3551/2021',
    keyLegislation: [
      'Federal Decree-Law No. 20/2018 (AML/CFT)',
      'Cabinet Decision No. 10/2019',
      'CBUAE Notice 3551/2021',
      'FDL 10/2025',
      'GoAML Regulation',
    ],
    amlAuthority: 'CBUAE',
    fiuName: 'UAE FIU (goAML)',
    reportingStandard: 'goAML XML',
  },
  SA: {
    code: 'SA',
    country: 'Kingdom of Saudi Arabia',
    regulator: 'SAMA',
    regulatorFull: 'Saudi Central Bank (SAMA)',
    currency: 'Saudi Riyal',
    currencyCode: 'SAR',
    language: 'Arabic',
    flagEmoji: '🇸🇦',
    color: '#22c55e',
    riskFramework: 'SAMA AML/CFT Rules',
    keyLegislation: [
      'Anti-Money Laundering Law (Royal Decree M/39)',
      'SAMA AML/CFT Rules 2017',
      'SAMA CDD Guidelines',
      'Terrorism Financing Control Law',
    ],
    amlAuthority: 'SAMA',
    fiuName: 'SAFIU',
    reportingStandard: 'SAMA SAR Format',
  },
  BH: {
    code: 'BH',
    country: 'Kingdom of Bahrain',
    regulator: 'CBB',
    regulatorFull: 'Central Bank of Bahrain',
    currency: 'Bahraini Dinar',
    currencyCode: 'BHD',
    language: 'Arabic / English',
    flagEmoji: '🇧🇭',
    color: '#ef4444',
    riskFramework: 'CBB AML/CFT Module',
    keyLegislation: [
      'CBB Rulebook Volume 1 (Banks)',
      'CBB AML/CFT Module',
      'Law No. 54/2006 (AML)',
      'Law Decree No. 58/2006 (Terrorism Financing)',
    ],
    amlAuthority: 'CBB',
    fiuName: 'Bahrain FIU',
    reportingStandard: 'CBB SAR Format',
  },
  QA: {
    code: 'QA',
    country: 'State of Qatar',
    regulator: 'QCB',
    regulatorFull: 'Qatar Central Bank',
    currency: 'Qatari Riyal',
    currencyCode: 'QAR',
    language: 'Arabic / English',
    flagEmoji: '🇶🇦',
    color: '#8b5cf6',
    riskFramework: 'QCB AML/CFT Regulations',
    keyLegislation: [
      'Law No. 20/2019 (AML/CFT)',
      'QCB AML/CFT Instructions 2019',
      'Decision No. 1/2020 (Beneficial Ownership)',
      'QCB CDD Directives',
    ],
    amlAuthority: 'QCB',
    fiuName: 'Qatar FIU',
    reportingStandard: 'QCB SAR Format',
  },
  OM: {
    code: 'OM',
    country: 'Sultanate of Oman',
    regulator: 'CBOA',
    regulatorFull: 'Central Bank of Oman',
    currency: 'Omani Rial',
    currencyCode: 'OMR',
    language: 'Arabic',
    flagEmoji: '🇴🇲',
    color: '#f59e0b',
    riskFramework: 'CBOA AML/CFT Directive',
    keyLegislation: [
      'Royal Decree 34/2015 (AML/CFT Law)',
      'CBOA AML/CFT Directive 2016',
      'Executive Regulation of AML/CFT Law',
      'CBOA CDD Guidelines',
    ],
    amlAuthority: 'CBOA',
    fiuName: 'Oman FIU (NFU)',
    reportingStandard: 'CBOA SAR Format',
  },
  KW: {
    code: 'KW',
    country: 'State of Kuwait',
    regulator: 'CBK',
    regulatorFull: 'Central Bank of Kuwait',
    currency: 'Kuwaiti Dinar',
    currencyCode: 'KWD',
    language: 'Arabic',
    flagEmoji: '🇰🇼',
    color: '#06b6d4',
    riskFramework: 'CBK AML/CFT Instructions',
    keyLegislation: [
      'Law No. 106/2013 (AML/CFT)',
      'CBK AML/CFT Instructions 2014',
      'Ministerial Resolution No. 174/2014',
      'CBK CDD Directives',
    ],
    amlAuthority: 'CBK',
    fiuName: 'Kuwait FIU',
    reportingStandard: 'CBK SAR Format',
  },
};

// ─── Helper Functions ───────────────────────────────────────────────────────

export function getJurisdictionContext(code: string): JurisdictionContext | null {
  return JURISDICTION_CONTEXTS[code as GCCJurisdiction] ?? null;
}

export function getJurisdictionLabel(code: string): string {
  const ctx = getJurisdictionContext(code);
  if (!ctx) return code;
  return `${ctx.flagEmoji} ${ctx.regulator} (${ctx.country})`;
}

export function getJurisdictionShortLabel(code: string): string {
  const ctx = getJurisdictionContext(code);
  if (!ctx) return code;
  return `${ctx.flagEmoji} ${ctx.regulator}`;
}

export function isValidGCCJurisdiction(code: string): code is GCCJurisdiction {
  return GCC_JURISDICTIONS.includes(code as GCCJurisdiction);
}

/**
 * Maps existing UAE-only jurisdiction codes to GCC codes.
 * CBUAE/DFSA/FSRA all map to 'AE' for intelligence scoping.
 */
export function mapLegacyJurisdictionToGCC(legacy: string): GCCJurisdiction {
  switch (legacy) {
    case 'CBUAE':
    case 'DFSA':
    case 'FSRA':
      return 'AE';
    default:
      if (isValidGCCJurisdiction(legacy)) return legacy;
      return 'AE';
  }
}

/**
 * Returns the jurisdiction scope for the current user based on role and DB jurisdiction.
 */
export function getJurisdictionScopeWithLegacy(
  userRole: string,
  userJurisdiction: string,
): GCCJurisdiction[] {
  const adminRoles = ['admin', 'board'];
  if (adminRoles.includes(userRole)) {
    return [...GCC_JURISDICTIONS];
  }
  const gccCode = mapLegacyJurisdictionToGCC(userJurisdiction);
  return [gccCode];
}

// ─── Intelligence Constants ─────────────────────────────────────────────────

export const INTELLIGENCE_CATEGORIES = [
  'REGULATORY',
  'ENFORCEMENT',
  'GUIDANCE',
  'ADVISORY',
  'INDUSTRY',
] as const;
export type IntelligenceCategory = typeof INTELLIGENCE_CATEGORIES[number];

export const INTELLIGENCE_RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type IntelligenceRiskLevel = typeof INTELLIGENCE_RISK_LEVELS[number];

export const INTELLIGENCE_CREDIBILITY_LEVELS = [
  'UNVERIFIED',
  'PARTIALLY_VERIFIED',
  'VERIFIED',
  'OFFICIAL',
] as const;
export type IntelligenceCredibility = typeof INTELLIGENCE_CREDIBILITY_LEVELS[number];

export const INTELLIGENCE_STATUSES = [
  'NEW',
  'REVIEWED',
  'UNDER_ANALYSIS',
  'ACTIONED',
  'ARCHIVED',
] as const;
export type IntelligenceStatus = typeof INTELLIGENCE_STATUSES[number];

export const TREND_TYPES = [
  'EMERGING_REGULATION',
  'ENFORCEMENT_TREND',
  'INDUSTRY_SHIFT',
  'CROSS_JURISDICTION',
  'RISK_ESCALATION',
] as const;
export type TrendType = typeof TREND_TYPES[number];

export const ALERT_FREQUENCIES = ['IMMEDIATE', 'DAILY', 'WEEKLY'] as const;
export type AlertFrequency = typeof ALERT_FREQUENCIES[number];

export const ACTION_TYPES = [
  'ASSIGN',
  'ROUTE_TO_POLICY_OWNER',
  'STATUS_CHANGE',
  'ADD_NOTE',
  'ESCALATE',
] as const;
export type ActionType = typeof ACTION_TYPES[number];

// ─── Defensive JSON Parsing Utility ─────────────────────────────────────────

export function safeJsonArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}
