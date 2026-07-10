/**
 * GCC Phase 4 — Directive 4.2: Sanctions & PEP Screening Routing
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for jurisdiction-specific local sanctions lists.
 *
 * Each GCC country maintains its own Local Terrorist List alongside the
 * UN Consolidated List. This module routes screening queries to the correct
 * local list based on the active `jurisdictionId`.
 *
 * UAE (AE) is byte-identical to legacy behavior (UAE_LOCAL list code).
 * All other jurisdictions are purely additive.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SanctionsListEntry {
  /** The sanctioned entity/individual name (uppercase for matching). */
  name: string;
  /** Machine list code (e.g. OFAC_SDN, UN_SECURITY, UAE_LOCAL, KSA_UNIFIED). */
  list: string;
  /** Entity type: INDIVIDUAL or ENTITY. */
  type: 'INDIVIDUAL' | 'ENTITY';
  /** Country code of the sanctioned subject. */
  country: string;
}

export interface JurisdictionSanctionsConfig {
  /** Jurisdiction code (AE/SA/BH/QA/OM/KW). */
  code: string;
  /** Machine list code for the local list (e.g. UAE_LOCAL, KSA_UNIFIED). */
  localListCode: string;
  /** Human-readable label for the local list (e.g. "UAE Local Terrorist List"). */
  localListLabel: string;
  /** Human-readable combined label shown in the UI results panel. */
  combinedLabel: string;
  /** Mock sanctioned entries on the local list (for screening demos). */
  localEntries: SanctionsListEntry[];
}

// ─── UN + International Lists (shared across all jurisdictions) ─────────────

/** International lists screened for ALL jurisdictions regardless of context. */
export const INTERNATIONAL_LIST_CODES = ['OFAC_SDN', 'EU_CONSOLIDATED', 'UN_SECURITY'] as const;

/** Mock international sanctions entries (screened for every jurisdiction). */
export const INTERNATIONAL_SANCTIONS_ENTRIES: SanctionsListEntry[] = [
  { name: 'AHMAD AL-ASSAD', list: 'OFAC_SDN', type: 'INDIVIDUAL', country: 'SY' },
  { name: 'AL-RASHID TRADING GROUP', list: 'EU_CONSOLIDATED', type: 'ENTITY', country: 'IQ' },
  { name: 'MOHAMMED BIN KHALIFA', list: 'UN_SECURITY', type: 'INDIVIDUAL', country: 'AE' },
  { name: 'FATIMA AL-ZAHRA', list: 'OFAC_SDN', type: 'INDIVIDUAL', country: 'IR' },
  { name: 'YOUSUF AL-NOUR', list: 'UN_SECURITY', type: 'INDIVIDUAL', country: 'SD' },
];

// ─── Per-Jurisdiction Local Lists ───────────────────────────────────────────

const UAE_SANCTIONS_CONFIG: JurisdictionSanctionsConfig = {
  code: 'AE',
  localListCode: 'UAE_LOCAL',
  localListLabel: 'UAE Local Terrorist List',
  combinedLabel: 'UAE Local Terrorist List & UN Consolidated List',
  localEntries: [
    { name: 'DUBAI FINANCE HOLDINGS LTD', list: 'UAE_LOCAL', type: 'ENTITY', country: 'AE' },
    { name: 'GULF PRECIOUS METALS EXCHANGE', list: 'UAE_LOCAL', type: 'ENTITY', country: 'AE' },
    { name: 'MIDDLE EAST INVESTMENT CORPORATION', list: 'UAE_LOCAL', type: 'ENTITY', country: 'AE' },
  ],
};

const KSA_SANCTIONS_CONFIG: JurisdictionSanctionsConfig = {
  code: 'SA',
  localListCode: 'KSA_UNIFIED',
  localListLabel: 'KSA Unified Terrorist List',
  combinedLabel: 'KSA Unified List & UN Consolidated List',
  localEntries: [
    { name: 'RIYADH CHARITY FUND NETWORK', list: 'KSA_UNIFIED', type: 'ENTITY', country: 'SA' },
    { name: 'ABDUL RAHMAN AL-HARBI', list: 'KSA_UNIFIED', type: 'INDIVIDUAL', country: 'SA' },
    { name: 'DESERT LOGISTICS HOLDINGS', list: 'KSA_UNIFIED', type: 'ENTITY', country: 'SA' },
  ],
};

const BAHRAIN_SANCTIONS_CONFIG: JurisdictionSanctionsConfig = {
  code: 'BH',
  localListCode: 'BH_LOCAL',
  localListLabel: 'Bahrain Local Terrorist List',
  combinedLabel: 'Bahrain Local List & UN Consolidated List',
  localEntries: [
    { name: 'MANAMA TRADE FACILITATORS LLC', list: 'BH_LOCAL', type: 'ENTITY', country: 'BH' },
  ],
};

const QATAR_SANCTIONS_CONFIG: JurisdictionSanctionsConfig = {
  code: 'QA',
  localListCode: 'QA_LOCAL',
  localListLabel: 'Qatar Local Terrorist List',
  combinedLabel: 'Qatar Local List & UN Consolidated List',
  localEntries: [
    { name: 'DOHA COMMODITY BROKERAGE', list: 'QA_LOCAL', type: 'ENTITY', country: 'QA' },
  ],
};

const OMAN_SANCTIONS_CONFIG: JurisdictionSanctionsConfig = {
  code: 'OM',
  localListCode: 'OM_LOCAL',
  localListLabel: 'Oman Local Terrorist List',
  combinedLabel: 'Oman Local List & UN Consolidated List',
  localEntries: [
    { name: 'MUSCAT CURRENCY EXCHANGE', list: 'OM_LOCAL', type: 'ENTITY', country: 'OM' },
  ],
};

const KUWAIT_SANCTIONS_CONFIG: JurisdictionSanctionsConfig = {
  code: 'KW',
  localListCode: 'KW_LOCAL',
  localListLabel: 'Kuwait Local Terrorist List',
  combinedLabel: 'Kuwait Local List & UN Consolidated List',
  localEntries: [
    { name: 'KUWAIT CITY HAWALA NETWORK', list: 'KW_LOCAL', type: 'ENTITY', country: 'KW' },
  ],
};

// ─── Registry ───────────────────────────────────────────────────────────────

const SANCTIONS_CONFIG_REGISTRY: Record<string, JurisdictionSanctionsConfig> = {
  AE: UAE_SANCTIONS_CONFIG,
  SA: KSA_SANCTIONS_CONFIG,
  BH: BAHRAIN_SANCTIONS_CONFIG,
  QA: QATAR_SANCTIONS_CONFIG,
  OM: OMAN_SANCTIONS_CONFIG,
  KW: KUWAIT_SANCTIONS_CONFIG,
};

/**
 * Resolve the sanctions routing config for a jurisdiction code.
 * Falls back to UAE (AE) for unknown codes — preserving legacy behavior.
 */
export function getSanctionsConfig(jurisdictionCode: string | null | undefined): JurisdictionSanctionsConfig {
  const code = (jurisdictionCode || 'AE').toUpperCase();
  return SANCTIONS_CONFIG_REGISTRY[code] ?? UAE_SANCTIONS_CONFIG;
}

/**
 * Build the full mock sanctions list to screen against for a jurisdiction.
 * Combines international lists (UN/OFAC/EU) with the jurisdiction's local list.
 *
 * This is the function the screening engine calls to get the list of entries
 * to fuzzy-match the input name against.
 */
export function getScreeningListForJurisdiction(
  jurisdictionCode: string | null | undefined,
): SanctionsListEntry[] {
  const config = getSanctionsConfig(jurisdictionCode);
  // International lists are always included.
  // Local list entries are included only for the active jurisdiction.
  return [...INTERNATIONAL_SANCTIONS_ENTRIES, ...config.localEntries];
}

/**
 * Returns the human-readable label describing which lists are being screened.
 * e.g. "KSA Unified List & UN Consolidated List"
 *
 * This is the exact string the UI must display in the screening results panel
 * per Directive 4.2.
 */
export function getScreeningListsLabel(jurisdictionCode: string | null | undefined): string {
  return getSanctionsConfig(jurisdictionCode).combinedLabel;
}

/**
 * Returns the array of machine list codes that were screened for a jurisdiction.
 * Used to persist `screeningLists` JSON on the SanctionsScreening row.
 */
export function getScreeningListCodes(jurisdictionCode: string | null | undefined): string[] {
  const config = getSanctionsConfig(jurisdictionCode);
  return [...INTERNATIONAL_LIST_CODES, config.localListCode];
}
