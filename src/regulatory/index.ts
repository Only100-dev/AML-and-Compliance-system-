/**
 * Regulatory Reference Database — Central Export
 *
 * Provides a single entry point for accessing jurisdiction-specific
 * regulatory reference data across all 6 GCC jurisdictions.
 *
 * Phase 2 (Action 2.6): Unified regulatory reference query interface.
 */

import type { GCCJurisdictionCode } from '@/lib/constants/jurisdictions';

// ─── Re-exports per country ─────────────────────────────────────────────────

export { CBB_VOLUME3_REFS, BAHRAIN_AML_LAWS, BAHRAIN_LABOR_REFS } from './bahrain/cbb-volume3';
export type { CBBRegulatoryRef, BahrainLawRef } from './bahrain/cbb-volume3';

export { SAMA_AML_REFS, KSA_AML_LAWS, KSA_LABOR_REFS } from './ksa/sama-rules';
export type { SAMARegulatoryRef, KSALawRef } from './ksa/sama-rules';

export { QCB_AML_REFS, QATAR_AML_LAWS, QATAR_LABOR_REFS } from './qatar/qcb-insurance';
export type { QCBRegulatoryRef, QatarLawRef } from './qatar/qcb-insurance';

export { CBOA_AML_REFS, OMAN_AML_LAWS, OMAN_LABOR_REFS } from './oman/cboa-insurance';
export type { CBOARegulatoryRef, OmanLawRef } from './oman/cboa-insurance';

export { CBK_AML_REFS, KUWAIT_AML_LAWS, KUWAIT_LABOR_REFS } from './kuwait/cbk-insurance';
export type { CBKRegulatoryRef, KuwaitLawRef } from './kuwait/cbk-insurance';

// ─── Re-export thresholds ───────────────────────────────────────────────────

export {
  getRegulatoryThresholds,
  getJurisdictionCurrency,
  getThresholdsSummary,
} from './thresholds';
export type { RegulatoryThresholds } from './thresholds';

// ─── Unified Query Interface ────────────────────────────────────────────────

export interface RegulatoryReferenceQuery {
  jurisdiction: GCCJurisdictionCode;
  category?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  searchTerms?: string[];
}

export interface RegulatoryReferenceResult {
  jurisdiction: GCCJurisdictionCode;
  module: string;
  section: string;
  title: string;
  requirement: string;
  severity: string;
  category: string;
}

/**
 * Internal helper: normalise any jurisdiction-specific ref into the
 * unified result shape. Handles both `module`-based (CBB, QCB, CBOA, CBK)
 * and `ruleNumber`-based (SAMA) reference structures.
 */
interface NormalisableRef {
  module?: string;
  ruleNumber?: string;
  section: string;
  title: string;
  requirement: string;
  severity: string;
  category: string;
}

/**
 * Internal helper: filter a list of regulatory references by category,
 * severity, and search terms.
 */
function filterRefs(
  refs: NormalisableRef[],
  jurisdiction: GCCJurisdictionCode,
  category?: string,
  severity?: 'critical' | 'high' | 'medium' | 'low',
  searchTerms?: string[],
): RegulatoryReferenceResult[] {
  const results: RegulatoryReferenceResult[] = [];
  for (const ref of refs) {
    if (category && ref.category !== category) continue;
    if (severity && ref.severity !== severity) continue;
    const moduleKey = ref.module ?? ref.ruleNumber ?? '';
    if (searchTerms && searchTerms.length > 0) {
      const haystack = `${moduleKey} ${ref.section} ${ref.title} ${ref.requirement}`.toLowerCase();
      if (!searchTerms.some(t => haystack.includes(t.toLowerCase()))) continue;
    }
    results.push({
      jurisdiction,
      module: moduleKey,
      section: ref.section,
      title: ref.title,
      requirement: ref.requirement,
      severity: ref.severity,
      category: ref.category,
    });
  }
  return results;
}

/**
 * Queries regulatory references across all jurisdictions or a specific one.
 * Used by the AI knowledge base search tool.
 *
 * UAE (AE) returns empty results because the existing regulatory-refs.ts
 * (FDL 10/2025 / CR 134/2025) handles UAE separately via
 * REGULATORY_KNOWLEDGE_BASE in rag-policy-wizard.ts.
 */
export async function queryRegulatoryReferences(
  query: RegulatoryReferenceQuery,
): Promise<RegulatoryReferenceResult[]> {
  const { jurisdiction, category, severity, searchTerms = [] } = query;

  switch (jurisdiction) {
    case 'BH': {
      const { CBB_VOLUME3_REFS } = await import('./bahrain/cbb-volume3');
      return filterRefs(CBB_VOLUME3_REFS, jurisdiction, category, severity, searchTerms);
    }
    case 'SA': {
      const { SAMA_AML_REFS } = await import('./ksa/sama-rules');
      return filterRefs(SAMA_AML_REFS, jurisdiction, category, severity, searchTerms);
    }
    case 'QA': {
      const { QCB_AML_REFS } = await import('./qatar/qcb-insurance');
      return filterRefs(QCB_AML_REFS, jurisdiction, category, severity, searchTerms);
    }
    case 'OM': {
      const { CBOA_AML_REFS } = await import('./oman/cboa-insurance');
      return filterRefs(CBOA_AML_REFS, jurisdiction, category, severity, searchTerms);
    }
    case 'KW': {
      const { CBK_AML_REFS } = await import('./kuwait/cbk-insurance');
      return filterRefs(CBK_AML_REFS, jurisdiction, category, severity, searchTerms);
    }
    case 'AE':
    default:
      // UAE is handled by the existing regulatory-refs.ts / REGULATORY_KNOWLEDGE_BASE.
      // Return empty — the caller should also search the UAE KB.
      return [];
  }
}

/**
 * Returns law references for a given jurisdiction.
 */
export async function getJurisdictionLaws(
  jurisdiction: GCCJurisdictionCode,
): Promise<Array<{ lawId: string; title: string; year: number; description: string; keyArticles: Array<{ article: string; title: string; description: string }> }>> {
  switch (jurisdiction) {
    case 'BH': {
      const { BAHRAIN_AML_LAWS } = await import('./bahrain/cbb-volume3');
      return BAHRAIN_AML_LAWS;
    }
    case 'SA': {
      const { KSA_AML_LAWS } = await import('./ksa/sama-rules');
      return KSA_AML_LAWS;
    }
    case 'QA': {
      const { QATAR_AML_LAWS } = await import('./qatar/qcb-insurance');
      return QATAR_AML_LAWS;
    }
    case 'OM': {
      const { OMAN_AML_LAWS } = await import('./oman/cboa-insurance');
      return OMAN_AML_LAWS;
    }
    case 'KW': {
      const { KUWAIT_AML_LAWS } = await import('./kuwait/cbk-insurance');
      return KUWAIT_AML_LAWS;
    }
    case 'AE':
    default:
      return [];
  }
}

/**
 * Returns labor/social insurance references for a given jurisdiction.
 */
export async function getJurisdictionLaborRefs(
  jurisdiction: GCCJurisdictionCode,
): Promise<Record<string, unknown> | null> {
  switch (jurisdiction) {
    case 'BH': {
      const { BAHRAIN_LABOR_REFS } = await import('./bahrain/cbb-volume3');
      return BAHRAIN_LABOR_REFS as unknown as Record<string, unknown>;
    }
    case 'SA': {
      const { KSA_LABOR_REFS } = await import('./ksa/sama-rules');
      return KSA_LABOR_REFS as unknown as Record<string, unknown>;
    }
    case 'QA': {
      const { QATAR_LABOR_REFS } = await import('./qatar/qcb-insurance');
      return QATAR_LABOR_REFS as unknown as Record<string, unknown>;
    }
    case 'OM': {
      const { OMAN_LABOR_REFS } = await import('./oman/cboa-insurance');
      return OMAN_LABOR_REFS as unknown as Record<string, unknown>;
    }
    case 'KW': {
      const { KUWAIT_LABOR_REFS } = await import('./kuwait/cbk-insurance');
      return KUWAIT_LABOR_REFS as unknown as Record<string, unknown>;
    }
    case 'AE':
    default:
      return null;
  }
}
