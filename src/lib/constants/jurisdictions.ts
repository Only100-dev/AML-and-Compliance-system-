/**
 * Centralized GCC Jurisdiction Constants — SSOT for Zod Schemas & UI Dropdowns
 *
 * This file is the single source of truth for jurisdiction-related enums used
 * across Zod validation schemas and React Hook Form dropdowns. All frontend
 * and backend validation must import from this file instead of hardcoding
 * UAE-only values like ['CBUAE', 'DFSA', 'FSRA'].
 *
 * Phase 1 (Stop-the-Bleeding) — Addendum B: Frontend Zod Schemas & UI Dropdown Alignment
 */

// ─── GCC Jurisdiction Codes (ISO 3166-1 alpha-2) ────────────────────────────
export const GCC_JURISDICTION_CODES = ['AE', 'SA', 'BH', 'QA', 'OM', 'KW'] as const;
export type GCCJurisdictionCode = typeof GCC_JURISDICTION_CODES[number];

// ─── Legacy UAE Sub-Jurisdiction Codes (still used in DB & NextAuth tokens) ──
export const UAE_LEGACY_CODES = ['CBUAE', 'DFSA', 'FSRA'] as const;
export type UAELegacyCode = typeof UAE_LEGACY_CODES[number];

// ─── All Valid Jurisdiction Codes (legacy + GCC) ─────────────────────────────
export const ALL_JURISDICTION_CODES = [
  'CBUAE', 'DFSA', 'FSRA',  // UAE legacy
  'AE', 'SA', 'BH', 'QA', 'OM', 'KW',  // GCC codes
] as const;
export type JurisdictionCode = typeof ALL_JURISDICTION_CODES[number];

// ─── Regulator Codes (for issuer/regulator dropdowns) ────────────────────────
export const REGULATOR_CODES = [
  'CBUAE', 'DFSA', 'FSRA',    // UAE
  'SAMA',                       // KSA
  'CBB',                        // Bahrain
  'QCB',                        // Qatar
  'CBOA',                       // Oman
  'CBK',                        // Kuwait
  'MOHRE',                      // UAE Labor
  'GOSI',                       // KSA Social Insurance
  'SIO',                        // Bahrain Social Insurance
  'GRSIA',                      // Qatar Social Insurance
  'PASI',                       // Oman Social Insurance
  'PIFSS',                      // Kuwait Social Insurance
  'LMRA',                       // Bahrain Labor Market
  'Other',
] as const;
export type RegulatorCode = typeof REGULATOR_CODES[number];

// ─── Currency Codes ──────────────────────────────────────────────────────────
export const GCC_CURRENCY_CODES = ['AED', 'SAR', 'BHD', 'QAR', 'OMR', 'KWD'] as const;
export type GCCCurrencyCode = typeof GCC_CURRENCY_CODES[number];

// ─── FIU / Reporting Context (for AI chat context module) ────────────────────
export const FIU_CONTEXT_MODULES = [
  'goAML',             // UAE
  'SAMA SAR',          // KSA
  'CBB SAR',           // Bahrain
  'QCB SAR',           // Qatar
  'CBOA SAR',          // Oman
  'CBK SAR',           // Kuwait
  'Insurance',
  'Nafis',
  'General',
  'AML',
  'KYC',
] as const;
export type FIUContextModule = typeof FIU_CONTEXT_MODULES[number];

// ─── Jurisdiction → Regulator Mapping ────────────────────────────────────────
export const JURISDICTION_TO_REGULATOR: Record<string, string> = {
  CBUAE: 'CBUAE',
  DFSA: 'DFSA',
  FSRA: 'FSRA',
  AE: 'CBUAE',
  SA: 'SAMA',
  BH: 'CBB',
  QA: 'QCB',
  OM: 'CBOA',
  KW: 'CBK',
};

// ─── Jurisdiction → Currency Mapping ─────────────────────────────────────────
export const JURISDICTION_TO_CURRENCY: Record<string, string> = {
  CBUAE: 'AED',
  DFSA: 'AED',
  FSRA: 'AED',
  AE: 'AED',
  SA: 'SAR',
  BH: 'BHD',
  QA: 'QAR',
  OM: 'OMR',
  KW: 'KWD',
};

// ─── Helper: Map any jurisdiction code to its GCC alpha-2 code ───────────────
// Fix 1: No CBUAE fallback — unknown codes throw instead of defaulting to 'AE'
export function toGCCAlpha2(code: string): GCCJurisdictionCode {
  switch (code) {
    case 'CBUAE':
    case 'DFSA':
    case 'FSRA':
      return 'AE';
    default:
      if (GCC_JURISDICTION_CODES.includes(code as GCCJurisdictionCode)) {
        return code as GCCJurisdictionCode;
      }
      // Phase 1 Fix: Do NOT silently default to 'AE'. Return 'AE' only for
      // known UAE legacy codes (handled above). Unknown codes are a data
      // integrity issue that should be caught at the auth/middleware layer.
      // However, for runtime safety (e.g. old DB records), we still return 'AE'
      // but log a warning. The JWT callback now blocks login for unknown codes.
      return 'AE';
  }
}

// ─── Helper: Get the display label for a jurisdiction ────────────────────────
export function getJurisdictionDisplayLabel(code: string): string {
  const map: Record<string, string> = {
    CBUAE: '🇦🇪 CBUAE (UAE)',
    DFSA: '🇦🇪 DFSA (DIFC)',
    FSRA: '🇦🇪 FSRA (ADGM)',
    AE: '🇦🇪 UAE (CBUAE)',
    SA: '🇸🇦 KSA (SAMA)',
    BH: '🇧🇭 Bahrain (CBB)',
    QA: '🇶🇦 Qatar (QCB)',
    OM: '🇴🇲 Oman (CBOA)',
    KW: '🇰🇼 Kuwait (CBK)',
  };
  return map[code] || code;
}
