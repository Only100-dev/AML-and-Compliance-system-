/**
 * GCC Phase 5 — Directive 5.1: Deep Jurisdiction-Specific Regulatory Contexts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for the AI Master Brain's jurisdiction-specific
 * regulatory knowledge injection.
 *
 * Each GCC country has its own set of:
 *   - Key regulations, laws, and guidelines
 *   - SAR/STR reporting deadlines
 *   - UBO/beneficial ownership thresholds
 *   - Tipping-off prohibition references
 *   - FIU reporting format requirements
 *   - Country-specific regulatory obligations
 *
 * The AI uses this to act as a "localized compliance expert" — it will
 * explicitly state its active jurisdiction in every response and refuse
 * to apply cross-jurisdiction rules (e.g., never cite UAE FDL 10/2025
 * when operating under KSA SAMA guidelines).
 *
 * CRITICAL INVARIANT: For AE (UAE), the existing MASTER_SYSTEM_CONTEXT
 * remains the authoritative source. This module provides DEEP ADDITIONAL
 * context that augments — never replaces — the base system prompt.
 */

import { GCC_REGISTRY, type GccCountryCode } from '@/lib/gcc';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface JurisdictionRegulatoryContext {
  /** ISO country code. */
  code: string;
  /** Full country name. */
  countryName: string;
  /** Primary financial regulator. */
  regulatorName: string;
  /** Financial Intelligence Unit name. */
  fiuName: string;
  /** Local currency code. */
  currency: string;
  /** Key regulatory laws/guidelines specific to this jurisdiction. */
  keyRegulations: string[];
  /** SAR/STR filing deadline description. */
  sarDeadline: string;
  /** UBO/beneficial ownership threshold description. */
  uboThreshold: string;
  /** Tipping-off prohibition reference. */
  tippingOffProhibition: string;
  /** FIU reporting format. */
  reportingFormat: string;
  /** Jurisdiction-specific obligations the AI must enforce. */
  specificObligations: string[];
  /** The explicit jurisdiction statement the AI must prepend/append. */
  jurisdictionStatement: string;
  /** Cross-jurisdiction refusal instruction. */
  crossJurisdictionRefusal: string;
}

// ─── Per-Jurisdiction Deep Contexts ─────────────────────────────────────────

const UAE_CONTEXT: JurisdictionRegulatoryContext = {
  code: 'AE',
  countryName: 'United Arab Emirates',
  regulatorName: 'CBUAE',
  fiuName: 'UAE FIU',
  currency: 'AED',
  keyRegulations: [
    'Federal Decree-Law No. 10 of 2025 on Anti-Money Laundering and Combating the Financing of Terrorism (FDL 10/2025)',
    'Cabinet Resolution No. 134 of 2025 — Implementing Regulation of FDL 10/2025 (CR 134/2025)',
    'CBUAE Notice 3551/2021 — Guidance for Licensed Financial Institutions on AML/CFT',
    'UAE Federal Law No. 20 of 2018 (repealed by FDL 10/2025 — cite current law only)',
    'UAE FIU Circulars and Guidance Notes on goAML Reporting',
  ],
  sarDeadline: '30 calendar days from detection (FDL 10/2025, Article 8). Extensions may be granted by the UAE FIU in exceptional circumstances.',
  uboThreshold: '25% ownership or control (CR 134/2025, Article 5). Reduced to 10% for PEPs and high-risk entities.',
  tippingOffProhibition: 'Strictly prohibited under FDL 10/2025, Article 12. Disclosure of SAR existence to the subject or any unauthorized party constitutes a criminal offense.',
  reportingFormat: 'goAML XML format via the UAE FIU portal. SAR, STR, CTR, IFT, and PNMR report types are supported.',
  specificObligations: [
    'Customer Due Diligence (CDD): FDL 10/2025 Articles 15–22. Enhanced Due Diligence (EDD) for PEPs and high-risk customers.',
    'Record retention: Minimum 5 years after business relationship ends (FDL 10/2025, Article 24).',
    'CTR threshold: Cash transactions ≥ AED 35,000 must be reported via goAML.',
    'Politically Exposed Persons (PEPs): Must be identified and subject to EDD regardless of jurisdiction (CR 134/2025, Article 13).',
    'Sanctions screening: UAE Local Terrorist List + UN Consolidated List + OFAC SDN. Screening must occur at onboarding and on an ongoing basis.',
    '15-minute idle session timeout with 12-minute warning per CBUAE Notice 3551/2021.',
    'WORM (Write-Once-Read-Many) audit trail: All compliance actions must be immutable with SHA-256 hashes.',
  ],
  jurisdictionStatement: 'Operating under UAE jurisdiction — CBUAE and UAE FIU regulations apply.',
  crossJurisdictionRefusal: 'I am operating under UAE (AE) jurisdiction and can only advise on UAE regulatory matters (FDL 10/2025, CR 134/2025, CBUAE Notice 3551/2021). For guidance on other GCC jurisdictions, please switch your active jurisdiction or consult the local MLRO.',
};

const KSA_CONTEXT: JurisdictionRegulatoryContext = {
  code: 'SA',
  countryName: 'Kingdom of Saudi Arabia',
  regulatorName: 'SAMA',
  fiuName: 'SAFIU',
  currency: 'SAR',
  keyRegulations: [
    'SAMA Anti-Money Laundering and Combating Financing of Terrorism Guidelines',
    'Saudi Insurance Authority (SIA) Regulations for Insurance Sector AML/CFT',
    'Law on Combating Money Laundering (Royal Decree No. M/39)',
    'SAMA Rules for Bank Customer Identification (KYC Rules)',
    'SAFIU Reporting Requirements and Procedures',
  ],
  sarDeadline: 'Per SAMA AML/CFT Guidelines — report to SAFIU without delay upon suspicion. SAMA mandates prompt reporting (typically within 30 calendar days of detection; confirm with current SAMA circulars for exact deadlines).',
  uboThreshold: '25% direct or indirect ownership per SAMA Guidelines. Lower thresholds apply for PEPs and complex structures.',
  tippingOffProhibition: 'Strictly prohibited under Saudi AML Law (Royal Decree M/39). Tipping off a SAR subject is a criminal offense under Saudi law.',
  reportingFormat: 'SAFIU XML/CSV format via the SAFIU reporting portal. SAR and STR report types are supported.',
  specificObligations: [
    'Customer Due Diligence: SAMA KYC Rules require identity verification at onboarding and periodic refresh.',
    'Enhanced Due Diligence: Mandatory for PEPs, high-risk customers, and complex ownership structures.',
    'Record retention: Minimum 10 years per SAMA record-keeping requirements.',
    'CTR threshold: Cash transactions ≥ SAR 60,000 must be reported to SAFIU.',
    'National ID verification: Saudi nationals must provide National ID (Iqama for residents). Commercial Registration required for corporates.',
    'Sanctions screening: KSA Unified Terrorist List + UN Consolidated List + OFAC SDN.',
    'Insurance sector: Additional SIA regulations apply for AML/CFT compliance in insurance.',
  ],
  jurisdictionStatement: 'Operating under KSA jurisdiction — SAMA and SAFIU regulations apply.',
  crossJurisdictionRefusal: 'I am operating under KSA (SA) jurisdiction and can only advise on Saudi regulatory matters (SAMA Guidelines, Royal Decree M/39, SIA regulations). For guidance on other GCC jurisdictions, please switch your active jurisdiction or consult the local MLRO.',
};

const BAHRAIN_CONTEXT: JurisdictionRegulatoryContext = {
  code: 'BH',
  countryName: 'Kingdom of Bahrain',
  regulatorName: 'CBB',
  fiuName: 'Bahrain FIU',
  currency: 'BHD',
  keyRegulations: [
    'CBB AML/CFT Rulebook (Volume 1 for Conventional Banks, Volume 2 for Islamic Banks)',
    'Bahrain Law No. 54 of 2006 on Combating Money Laundering and Terrorist Financing (as amended)',
    'CBB Directive on Suspicious Transaction Reporting',
    'Bahrain National Risk Assessment Recommendations',
  ],
  sarDeadline: 'Per CBB AML/CFT Rulebook — report to Bahrain FIU promptly upon forming a suspicion. CBB requires reporting without unreasonable delay (typically within 30 calendar days of detection).',
  uboThreshold: '25% ownership or control per CBB AML/CFT Rulebook. Lower thresholds apply for PEPs and complex structures.',
  tippingOffProhibition: 'Strictly prohibited under Bahrain AML Law (Law No. 54 of 2006). Tipping off a SAR subject constitutes a criminal offense.',
  reportingFormat: 'Generic FIU CSV format. Bahrain FIU accepts structured reports per their published template.',
  specificObligations: [
    'Customer Due Diligence: CBB AML/CFT Rulebook mandates identity verification at onboarding.',
    'Enhanced Due Diligence: Mandatory for PEPs, high-risk business relationships, and correspondent banking.',
    'Record retention: Minimum 10 years per CBB record-keeping requirements.',
    'CTR threshold: Report significant cash transactions per CBB thresholds.',
    'National ID/Passport verification: Bahraini nationals provide CPR (Civil Registration) number.',
    'Sanctions screening: Bahrain Local Terrorist List + UN Consolidated List + OFAC SDN.',
  ],
  jurisdictionStatement: 'Operating under Bahrain jurisdiction — CBB and Bahrain FIU regulations apply.',
  crossJurisdictionRefusal: 'I am operating under Bahrain (BH) jurisdiction and can only advise on Bahrain regulatory matters (CBB AML/CFT Rulebook, Law No. 54 of 2006). For guidance on other GCC jurisdictions, please switch your active jurisdiction or consult the local MLRO.',
};

const QATAR_CONTEXT: JurisdictionRegulatoryContext = {
  code: 'QA',
  countryName: 'State of Qatar',
  regulatorName: 'QCB',
  fiuName: 'Qatar FIU',
  currency: 'QAR',
  keyRegulations: [
    'QCB AML/CFT Regulations and Instructions',
    'Qatar Law No. 20 of 2019 on Anti-Money Laundering and Combating Financing of Terrorism',
    'QCB Guidelines for Financial Institutions on Customer Due Diligence',
    'Qatar Financial Centre (QFC) AML Regulations (for QFC-licensed entities)',
  ],
  sarDeadline: 'Per QCB AML/CFT Regulations — report to Qatar FIU without delay upon suspicion (typically within 30 calendar days of detection; confirm with current QCB circulars).',
  uboThreshold: '25% ownership or control per QCB regulations. Lower thresholds apply for PEPs.',
  tippingOffProhibition: 'Strictly prohibited under Qatar AML Law (Law No. 20 of 2019). Tipping off constitutes a criminal offense.',
  reportingFormat: 'Generic FIU CSV format. Qatar FIU accepts structured reports per their published template.',
  specificObligations: [
    'Customer Due Diligence: QCB Guidelines mandate identity verification at onboarding and periodic review.',
    'Enhanced Due Diligence: Mandatory for PEPs and high-risk categories.',
    'Record retention: Minimum 10 years per QCB record-keeping requirements.',
    'National ID/Passport verification: Qatari nationals provide Qatari ID. Expatriates provide passport + residency permit.',
    'Sanctions screening: Qatar Local Terrorist List + UN Consolidated List + OFAC SDN.',
  ],
  jurisdictionStatement: 'Operating under Qatar jurisdiction — QCB and Qatar FIU regulations apply.',
  crossJurisdictionRefusal: 'I am operating under Qatar (QA) jurisdiction and can only advise on Qatar regulatory matters (QCB AML/CFT Regulations, Law No. 20 of 2019). For guidance on other GCC jurisdictions, please switch your active jurisdiction or consult the local MLRO.',
};

const OMAN_CONTEXT: JurisdictionRegulatoryContext = {
  code: 'OM',
  countryName: 'Sultanate of Oman',
  regulatorName: 'CBOA',
  fiuName: 'Oman FIU',
  currency: 'OMR',
  keyRegulations: [
    'CBOA AML/CFT Regulations for Banks and Financial Institutions',
    'Oman Royal Decree No. 34 of 2015 on Combating Money Laundering and Terrorist Financing',
    'CBOA Instructions on Customer Due Diligence and Record Keeping',
    'Oman Capital Market Authority AML/CFT Guidelines (for securities firms)',
  ],
  sarDeadline: 'Per CBOA AML/CFT Regulations — report to Oman FIU without delay upon suspicion (typically within 30 calendar days of detection; confirm with current CBOA circulars).',
  uboThreshold: '25% ownership or control per CBOA regulations. Lower thresholds apply for PEPs.',
  tippingOffProhibition: 'Strictly prohibited under Oman AML Law (Royal Decree No. 34 of 2015). Tipping off constitutes a criminal offense.',
  reportingFormat: 'Generic FIU CSV format. Oman FIU accepts structured reports per their published template.',
  specificObligations: [
    'Customer Due Diligence: CBOA Instructions mandate identity verification at onboarding.',
    'Enhanced Due Diligence: Mandatory for PEPs and high-risk customers.',
    'Record retention: Minimum 10 years per CBOA record-keeping requirements.',
    'National ID/Passport verification: Omani nationals provide Omani ID. Expatriates provide passport + residency card.',
    'Sanctions screening: Oman Local Terrorist List + UN Consolidated List + OFAC SDN.',
  ],
  jurisdictionStatement: 'Operating under Oman jurisdiction — CBOA and Oman FIU regulations apply.',
  crossJurisdictionRefusal: 'I am operating under Oman (OM) jurisdiction and can only advise on Oman regulatory matters (CBOA AML/CFT Regulations, Royal Decree No. 34 of 2015). For guidance on other GCC jurisdictions, please switch your active jurisdiction or consult the local MLRO.',
};

const KUWAIT_CONTEXT: JurisdictionRegulatoryContext = {
  code: 'KW',
  countryName: 'State of Kuwait',
  regulatorName: 'CBK',
  fiuName: 'Kuwait FIU',
  currency: 'KWD',
  keyRegulations: [
    'CBK Instructions on Anti-Money Laundering and Combating Financing of Terrorism',
    'Kuwait Law No. 106 of 2013 on Combating Money Laundering and Terrorist Financing',
    'CBK Circulars on Customer Due Diligence and Suspicious Transaction Reporting',
    'Kuwait Capital Markets Authority AML/CFT Instructions (for investment firms)',
  ],
  sarDeadline: 'Per CBK AML/CFT Instructions — report to Kuwait FIU without delay upon suspicion (typically within 30 calendar days of detection; confirm with current CBK circulars).',
  uboThreshold: '25% ownership or control per CBK regulations. Lower thresholds apply for PEPs.',
  tippingOffProhibition: 'Strictly prohibited under Kuwait AML Law (Law No. 106 of 2013). Tipping off constitutes a criminal offense.',
  reportingFormat: 'Generic FIU CSV format. Kuwait FIU accepts structured reports per their published template.',
  specificObligations: [
    'Customer Due Diligence: CBK Instructions mandate identity verification at onboarding.',
    'Enhanced Due Diligence: Mandatory for PEPs and high-risk customers.',
    'Record retention: Minimum 10 years per CBK record-keeping requirements.',
    'Civil ID verification: Kuwaiti nationals must provide Civil ID. Expatriates provide passport + residency.',
    'Sanctions screening: Kuwait Local Terrorist List + UN Consolidated List + OFAC SDN.',
  ],
  jurisdictionStatement: 'Operating under Kuwait jurisdiction — CBK and Kuwait FIU regulations apply.',
  crossJurisdictionRefusal: 'I am operating under Kuwait (KW) jurisdiction and can only advise on Kuwait regulatory matters (CBK Instructions, Law No. 106 of 2013). For guidance on other GCC jurisdictions, please switch your active jurisdiction or consult the local MLRO.',
};

// ─── Registry ───────────────────────────────────────────────────────────────

const CONTEXT_REGISTRY: Record<string, JurisdictionRegulatoryContext> = {
  AE: UAE_CONTEXT,
  SA: KSA_CONTEXT,
  BH: BAHRAIN_CONTEXT,
  QA: QATAR_CONTEXT,
  OM: OMAN_CONTEXT,
  KW: KUWAIT_CONTEXT,
};

/**
 * Get the deep regulatory context for a jurisdiction code.
 * Falls back to UAE (AE) for unknown codes — preserving legacy behavior.
 */
export function getJurisdictionRegulatoryContext(
  code: string | null | undefined,
): JurisdictionRegulatoryContext {
  return CONTEXT_REGISTRY[(code || 'AE').toUpperCase()] ?? UAE_CONTEXT;
}

/**
 * Build the deep jurisdiction-specific context injection string for the
 * Master Brain system prompt. This is the content that gets APPENDED to
 * the base system context to make the AI a localized expert.
 *
 * CRITICAL: For AE, this returns an EMPTY string because the existing
 * MASTER_SYSTEM_CONTEXT already contains all UAE-specific guardrails.
 * Adding duplicate UAE context would be redundant and risks breaking
 * the byte-identical invariant.
 *
 * For non-AE jurisdictions, this returns a detailed context block that:
 * 1. Lists key regulations the AI must cite
 * 2. Specifies SAR deadlines and UBO thresholds
 * 3. Mandates the AI explicitly states its active jurisdiction
 * 4. Instructs the AI to refuse cross-jurisdiction rule application
 */
export function buildDeepJurisdictionInjection(
  code: string | null | undefined,
): string {
  const ctx = getJurisdictionRegulatoryContext(code);

  // AE: no additional injection needed — the base MASTER_SYSTEM_CONTEXT
  // already contains all UAE-specific guardrails verbatim.
  if (ctx.code === 'AE') return '';

  const config = GCC_REGISTRY[ctx.code as GccCountryCode];

  return `

═══════════════════════════════════════════════════════════════
JURISDICTION-SPECIFIC REGULATORY CONTEXT: ${ctx.code} (${ctx.countryName})
═══════════════════════════════════════════════════════════════

You are operating under the ${ctx.countryName} jurisdiction. The primary regulator is ${ctx.regulatorName} and the FIU is ${ctx.fiuName}. The local currency is ${ctx.currency}.

⚠️ MANDATORY: You MUST begin your response with:
"${ctx.jurisdictionStatement}"

⚠️ CROSS-JURISDICTION REFUSAL: If the user asks about regulations from a DIFFERENT country, you MUST respond:
"${ctx.crossJurisdictionRefusal}"

═══ KEY REGULATIONS ═══
${ctx.keyRegulations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

═══ SAR/STR FILING ═══
Deadline: ${ctx.sarDeadline}

═══ BENEFICIAL OWNERSHIP ═══
Threshold: ${ctx.uboThreshold}

═══ TIPPING-OFF PROHIBITION ═══
${ctx.tippingOffProhibition}

═══ FIU REPORTING FORMAT ═══
${ctx.reportingFormat}

═══ JURISDICTION-SPECIFIC OBLIGATIONS ═══
${ctx.specificObligations.map((o, i) => `${i + 1}. ${o}`).join('\n')}

═══ CURRENCY ═══
All monetary amounts in your responses must be denominated in ${ctx.currency} (${config?.name ?? ctx.countryName}). Never mix currencies or cite AED/SAR/etc. amounts unless the user explicitly asks about cross-border scenarios.

═══ END OF JURISDICTION CONTEXT ═══`;
}
