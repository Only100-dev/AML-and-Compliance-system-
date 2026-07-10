/**
 * GCC Multi-Jurisdictional Configuration — Single Source of Truth
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 5: Consolidates all GCC country-level metadata (currencies, regulators,
 * flags, FIU names, exchange rates) into ONE shared module.
 *
 * This replaces the scattered GCC_CURRENCIES / GCC_REGULATORS / GCC_FLAGS copies
 * that were independently defined in 8+ components during Phases 2–4.
 *
 * Adding a 7th GCC country in the future is now a simple config update here.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export const GCC_COUNTRIES = ['AE', 'SA', 'BH', 'QA', 'OM', 'KW'] as const;
export type GccCountryCode = (typeof GCC_COUNTRIES)[number];

export interface GccJurisdictionConfig {
  code: GccCountryCode;
  name: string;
  regulatorName: string;
  fiuName: string;
  currency: string;
  flag: string;
  /** Approximate rate to convert 1 local unit → USD. Dashboard display ONLY. */
  toUsdRate: number;
}

// ─── Master Registry ────────────────────────────────────────────────────────

export const GCC_REGISTRY: Record<GccCountryCode, GccJurisdictionConfig> = {
  AE: {
    code: 'AE',
    name: 'United Arab Emirates',
    regulatorName: 'CBUAE',
    fiuName: 'UAE FIU',
    currency: 'AED',
    flag: '\u{1F1E6}\u{1F1EA}', // 🇦🇪
    toUsdRate: 0.2723,
  },
  SA: {
    code: 'SA',
    name: 'Kingdom of Saudi Arabia',
    regulatorName: 'SAMA',
    fiuName: 'SAFIU',
    currency: 'SAR',
    flag: '\u{1F1F8}\u{1F1E6}', // 🇸🇦
    toUsdRate: 0.2667,
  },
  BH: {
    code: 'BH',
    name: 'Kingdom of Bahrain',
    regulatorName: 'CBB',
    fiuName: 'Bahrain FIU',
    currency: 'BHD',
    flag: '\u{1F1E7}\u{1F1ED}', // 🇧🇭
    toUsdRate: 2.6526,
  },
  QA: {
    code: 'QA',
    name: 'State of Qatar',
    regulatorName: 'QCB',
    fiuName: 'Qatar FIU',
    currency: 'QAR',
    flag: '\u{1F1F6}\u{1F1E6}', // 🇶🇦
    toUsdRate: 0.2747,
  },
  OM: {
    code: 'OM',
    name: 'Sultanate of Oman',
    regulatorName: 'CBOA',
    fiuName: 'Oman FIU',
    currency: 'OMR',
    flag: '\u{1F1F4}\u{1F1F2}', // 🇴🇲
    toUsdRate: 2.5974,
  },
  KW: {
    code: 'KW',
    name: 'State of Kuwait',
    regulatorName: 'CBK',
    fiuName: 'Kuwait FIU',
    currency: 'KWD',
    flag: '\u{1F1F0}\u{1F1FC}', // 🇰🇼
    toUsdRate: 3.2637,
  },
};

// ─── Convenience Maps (backward-compatible with Phase 2–4 component usage) ──

export const GCC_CURRENCIES: Record<string, string> = Object.fromEntries(
  GCC_COUNTRIES.map((c) => [c, GCC_REGISTRY[c].currency]),
);

export const GCC_REGULATORS: Record<string, string> = Object.fromEntries(
  GCC_COUNTRIES.map((c) => [c, GCC_REGISTRY[c].regulatorName]),
);

export const GCC_FIU_NAMES: Record<string, string> = Object.fromEntries(
  GCC_COUNTRIES.map((c) => [c, GCC_REGISTRY[c].fiuName]),
);

export const GCC_COUNTRY_NAMES: Record<string, string> = Object.fromEntries(
  GCC_COUNTRIES.map((c) => [c, GCC_REGISTRY[c].name]),
);

export const GCC_FLAGS: Record<string, string> = Object.fromEntries(
  GCC_COUNTRIES.map((c) => [c, GCC_REGISTRY[c].flag]),
);

// ─── Helper Functions ───────────────────────────────────────────────────────

export function getCurrency(code: string | null | undefined): string {
  return GCC_REGISTRY[(code || 'AE') as GccCountryCode]?.currency ?? 'AED';
}

export function getRegulator(code: string | null | undefined): string {
  return GCC_REGISTRY[(code || 'AE') as GccCountryCode]?.regulatorName ?? 'CBUAE';
}

export function getFiuName(code: string | null | undefined): string {
  return GCC_REGISTRY[(code || 'AE') as GccCountryCode]?.fiuName ?? 'UAE FIU';
}

export function getCountryName(code: string | null | undefined): string {
  return GCC_REGISTRY[(code || 'AE') as GccCountryCode]?.name ?? 'United Arab Emirates';
}

export function getFlag(code: string | null | undefined): string {
  return GCC_REGISTRY[(code || 'AE') as GccCountryCode]?.flag ?? '\u{1F1E6}\u{1F1EA}';
}

export function getJurisdictionConfig(code: string | null | undefined): GccJurisdictionConfig {
  return GCC_REGISTRY[(code || 'AE') as GccCountryCode] ?? GCC_REGISTRY.AE;
}

/**
 * Convert an amount from a GCC currency to USD using static approximations.
 *
 * WARNING: These rates are FIXED APPROXIMATIONS for dashboard display ONLY.
 * They must NEVER be used for actual financial transactions, settlement, or
 * regulatory reporting. Live rates should be sourced from a forex API in
 * production.
 */
export function convertToUsd(amount: number, fromCountryCode: string): number {
  const rate = GCC_REGISTRY[fromCountryCode as GccCountryCode]?.toUsdRate ?? GCC_REGISTRY.AE.toUsdRate;
  return amount * rate;
}

/**
 * Format a monetary amount with its currency code.
 * e.g. formatCurrencyAmount(50000, 'AED') → 'AED 50,000'
 */
export function formatCurrencyAmount(amount: number, currency: string): string {
  return `${currency} ${Math.round(amount).toLocaleString('en-US')}`;
}

/**
 * Format a monetary amount as USD.
 * e.g. formatUsdAmount(13615) → 'USD 13,615'
 */
export function formatUsdAmount(amount: number): string {
  return `USD ${Math.round(amount).toLocaleString('en-US')}`;
}

/**
 * Format an amount with the currency for a given jurisdiction code.
 * e.g. formatAmountForJurisdiction(50000, 'SA') → 'SAR 50,000'
 */
export function formatAmountForJurisdiction(amount: number, jurisdictionCode: string | null | undefined): string {
  const currency = getCurrency(jurisdictionCode);
  return formatCurrencyAmount(amount, currency);
}

/**
 * Represents a per-currency breakdown of a monetary aggregation.
 * Used by the Consolidated Dashboard to display amounts separated by currency
 * (never mixing raw values).
 */
export interface CurrencyBreakdown {
  currency: string;
  countryCode: GccCountryCode;
  amount: number;
  usdEquivalent: number;
}

/**
 * Aggregate monetary amounts by currency across multiple jurisdictions.
 * Returns an array of CurrencyBreakdown entries — one per currency present.
 *
 * Input: an array of { countryCode, amount } tuples.
 * Output: grouped sums per currency + USD conversion.
 */
export function aggregateByCurrency(
  entries: Array<{ countryCode: GccCountryCode; amount: number }>,
): CurrencyBreakdown[] {
  const grouped = new Map<string, { currency: string; countryCode: GccCountryCode; amount: number }>();

  for (const entry of entries) {
    const config = GCC_REGISTRY[entry.countryCode];
    if (!config) continue;
    const key = config.currency;
    const existing = grouped.get(key);
    if (existing) {
      existing.amount += entry.amount;
    } else {
      grouped.set(key, { currency: config.currency, countryCode: entry.countryCode, amount: entry.amount });
    }
  }

  return Array.from(grouped.values()).map((g) => ({
    currency: g.currency,
    countryCode: g.countryCode,
    amount: g.amount,
    usdEquivalent: convertToUsd(g.amount, g.countryCode),
  }));
}

/**
 * Format a CurrencyBreakdown array as a display string.
 * e.g. "AED 50,000 | SAR 120,000 | KWD 5,000"
 */
export function formatCurrencyBreakdown(breakdowns: CurrencyBreakdown[]): string {
  return breakdowns.map((b) => formatCurrencyAmount(b.amount, b.currency)).join(' | ');
}

/**
 * Format the total USD equivalent of a CurrencyBreakdown array.
 * e.g. "USD 57,265 (converted to base currency)"
 */
export function formatTotalUsdEquivalent(breakdowns: CurrencyBreakdown[]): string {
  const totalUsd = breakdowns.reduce((sum, b) => sum + b.usdEquivalent, 0);
  return `${formatUsdAmount(totalUsd)} (converted to base currency)`;
}

/**
 * Compliance health status for a jurisdiction in the Risk Heatmap.
 */
export type ComplianceHealthStatus = 'healthy' | 'warning' | 'critical';

export interface JurisdictionHealthEntry {
  code: GccCountryCode;
  name: string;
  flag: string;
  regulatorName: string;
  currency: string;
  health: ComplianceHealthStatus;
  complianceScore: number;
  openAlerts: number;
  slaBreaches: number;
  totalPolicies: number;
  publishedPolicies: number;
}

/**
 * Determine compliance health status from score.
 */
export function getHealthStatus(complianceScore: number): ComplianceHealthStatus {
  if (complianceScore >= 80) return 'healthy';
  if (complianceScore >= 60) return 'warning';
  return 'critical';
}

/**
 * Get the emoji indicator for a health status.
 */
export function getHealthEmoji(status: ComplianceHealthStatus): string {
  switch (status) {
    case 'healthy': return '\u{1F7E2}'; // 🟢
    case 'warning': return '\u{1F7E1}'; // 🟡
    case 'critical': return '\u{1F534}'; // 🔴
  }
}
