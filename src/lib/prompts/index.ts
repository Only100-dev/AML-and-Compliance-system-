/**
 * Prompt Factory — Centralized, Lazy-Loaded, Jurisdiction-Aware System Prompts
 *
 * Action 2.1: Replaces 17 hardcoded UAE prompts with a centralized factory.
 * Only the active jurisdiction's prompts are loaded into memory (lazy imports).
 *
 * PRINCIPLE B: PROMPT ISOLATION — UAE prompts MUST NOT leak into Bahrain conversations.
 * PRINCIPLE D: DETERMINISTIC SERIALIZATION — use stableStringify for caching.
 */

import { GCC_JURISDICTION_CODES, type GCCJurisdictionCode } from '@/lib/constants/jurisdictions';
import type { PromptModule, PromptContext, SystemPromptResult, PromptLoader } from './types';

// ─── Prompt Module Registry (Lazy-Loaded) ────────────────────────────────────
// Each entry is a function that dynamically imports the prompt file.
// Only the active jurisdiction's prompts are loaded into memory.

type ModuleMap = Record<PromptModule, PromptLoader>;

const promptModules: Record<string, ModuleMap> = {
  // ─── UAE (CBUAE) — Gold Standard Baseline ─────────────────────────────
  CBUAE: {
    general: () => import('./uae/general-prompt').then(m => m.default),
    aml: () => import('./uae/aml-prompt').then(m => m.default),
    sanctions: () => import('./uae/sanctions-prompt').then(m => m.default),
    kyc: () => import('./uae/kyc-prompt').then(m => m.default),
    sar_narrative: () => import('./uae/sar-narrative-prompt').then(m => m.default),
    compliance_review: () => import('./uae/compliance-review-prompt').then(m => m.default),
    policy: () => import('./uae/policy-prompt').then(m => m.default),
    regulatory: () => import('./uae/regulatory-prompt').then(m => m.default),
    risk: () => import('./uae/risk-prompt').then(m => m.default),
    adverse_media: () => import('./uae/adverse-media-prompt').then(m => m.default),
    audit: () => import('./uae/audit-prompt').then(m => m.default),
    reporting: () => import('./uae/reporting-prompt').then(m => m.default),
    training: () => import('./uae/training-prompt').then(m => m.default),
    labor: () => import('./uae/labor-prompt').then(m => m.default),
    legal: () => import('./uae/legal-prompt').then(m => m.default),
    vasp: () => import('./uae/vasp-prompt').then(m => m.default),
    goAML: () => import('./uae/goAML-prompt').then(m => m.default),
  },

  // ─── KSA (SAMA) ────────────────────────────────────────────────────────
  SAMA: {
    general: () => import('./ksa/general-prompt').then(m => m.default),
    aml: () => import('./ksa/aml-prompt').then(m => m.default),
    sanctions: () => import('./ksa/sanctions-prompt').then(m => m.default),
    kyc: () => import('./ksa/kyc-prompt').then(m => m.default),
    sar_narrative: () => import('./ksa/sar-narrative-prompt').then(m => m.default),
    compliance_review: () => import('./ksa/compliance-review-prompt').then(m => m.default),
    policy: () => import('./ksa/policy-prompt').then(m => m.default),
    regulatory: () => import('./ksa/regulatory-prompt').then(m => m.default),
    risk: () => import('./ksa/risk-prompt').then(m => m.default),
    adverse_media: () => import('./ksa/adverse-media-prompt').then(m => m.default),
    audit: () => import('./ksa/audit-prompt').then(m => m.default),
    reporting: () => import('./ksa/reporting-prompt').then(m => m.default),
    training: () => import('./ksa/training-prompt').then(m => m.default),
    labor: () => import('./ksa/labor-prompt').then(m => m.default),
    legal: () => import('./ksa/legal-prompt').then(m => m.default),
    vasp: () => import('./ksa/vasp-prompt').then(m => m.default),
    goAML: () => import('./ksa/goAML-prompt').then(m => m.default),
  },

  // ─── Bahrain (CBB) ─────────────────────────────────────────────────────
  CBB: {
    general: () => import('./bahrain/general-prompt').then(m => m.default),
    aml: () => import('./bahrain/aml-prompt').then(m => m.default),
    sanctions: () => import('./bahrain/sanctions-prompt').then(m => m.default),
    kyc: () => import('./bahrain/kyc-prompt').then(m => m.default),
    sar_narrative: () => import('./bahrain/sar-narrative-prompt').then(m => m.default),
    compliance_review: () => import('./bahrain/compliance-review-prompt').then(m => m.default),
    policy: () => import('./bahrain/policy-prompt').then(m => m.default),
    regulatory: () => import('./bahrain/regulatory-prompt').then(m => m.default),
    risk: () => import('./bahrain/risk-prompt').then(m => m.default),
    adverse_media: () => import('./bahrain/adverse-media-prompt').then(m => m.default),
    audit: () => import('./bahrain/audit-prompt').then(m => m.default),
    reporting: () => import('./bahrain/reporting-prompt').then(m => m.default),
    training: () => import('./bahrain/training-prompt').then(m => m.default),
    labor: () => import('./bahrain/labor-prompt').then(m => m.default),
    legal: () => import('./bahrain/legal-prompt').then(m => m.default),
    vasp: () => import('./bahrain/vasp-prompt').then(m => m.default),
    goAML: () => import('./bahrain/goAML-prompt').then(m => m.default),
  },

  // ─── Qatar (QCB) ───────────────────────────────────────────────────────
  QCB: {
    general: () => import('./qatar/general-prompt').then(m => m.default),
    aml: () => import('./qatar/aml-prompt').then(m => m.default),
    sanctions: () => import('./qatar/sanctions-prompt').then(m => m.default),
    kyc: () => import('./qatar/kyc-prompt').then(m => m.default),
    sar_narrative: () => import('./qatar/sar-narrative-prompt').then(m => m.default),
    compliance_review: () => import('./qatar/compliance-review-prompt').then(m => m.default),
    policy: () => import('./qatar/policy-prompt').then(m => m.default),
    regulatory: () => import('./qatar/regulatory-prompt').then(m => m.default),
    risk: () => import('./qatar/risk-prompt').then(m => m.default),
    adverse_media: () => import('./qatar/adverse-media-prompt').then(m => m.default),
    audit: () => import('./qatar/audit-prompt').then(m => m.default),
    reporting: () => import('./qatar/reporting-prompt').then(m => m.default),
    training: () => import('./qatar/training-prompt').then(m => m.default),
    labor: () => import('./qatar/labor-prompt').then(m => m.default),
    legal: () => import('./qatar/legal-prompt').then(m => m.default),
    vasp: () => import('./qatar/vasp-prompt').then(m => m.default),
    goAML: () => import('./qatar/goAML-prompt').then(m => m.default),
  },

  // ─── Oman (CBOA) ───────────────────────────────────────────────────────
  CBOA: {
    general: () => import('./oman/general-prompt').then(m => m.default),
    aml: () => import('./oman/aml-prompt').then(m => m.default),
    sanctions: () => import('./oman/sanctions-prompt').then(m => m.default),
    kyc: () => import('./oman/kyc-prompt').then(m => m.default),
    sar_narrative: () => import('./oman/sar-narrative-prompt').then(m => m.default),
    compliance_review: () => import('./oman/compliance-review-prompt').then(m => m.default),
    policy: () => import('./oman/policy-prompt').then(m => m.default),
    regulatory: () => import('./oman/regulatory-prompt').then(m => m.default),
    risk: () => import('./oman/risk-prompt').then(m => m.default),
    adverse_media: () => import('./oman/adverse-media-prompt').then(m => m.default),
    audit: () => import('./oman/audit-prompt').then(m => m.default),
    reporting: () => import('./oman/reporting-prompt').then(m => m.default),
    training: () => import('./oman/training-prompt').then(m => m.default),
    labor: () => import('./oman/labor-prompt').then(m => m.default),
    legal: () => import('./oman/legal-prompt').then(m => m.default),
    vasp: () => import('./oman/vasp-prompt').then(m => m.default),
    goAML: () => import('./oman/goAML-prompt').then(m => m.default),
  },

  // ─── Kuwait (CBK) ──────────────────────────────────────────────────────
  CBK: {
    general: () => import('./kuwait/general-prompt').then(m => m.default),
    aml: () => import('./kuwait/aml-prompt').then(m => m.default),
    sanctions: () => import('./kuwait/sanctions-prompt').then(m => m.default),
    kyc: () => import('./kuwait/kyc-prompt').then(m => m.default),
    sar_narrative: () => import('./kuwait/sar-narrative-prompt').then(m => m.default),
    compliance_review: () => import('./kuwait/compliance-review-prompt').then(m => m.default),
    policy: () => import('./kuwait/policy-prompt').then(m => m.default),
    regulatory: () => import('./kuwait/regulatory-prompt').then(m => m.default),
    risk: () => import('./kuwait/risk-prompt').then(m => m.default),
    adverse_media: () => import('./kuwait/adverse-media-prompt').then(m => m.default),
    audit: () => import('./kuwait/audit-prompt').then(m => m.default),
    reporting: () => import('./kuwait/reporting-prompt').then(m => m.default),
    training: () => import('./kuwait/training-prompt').then(m => m.default),
    labor: () => import('./kuwait/labor-prompt').then(m => m.default),
    legal: () => import('./kuwait/legal-prompt').then(m => m.default),
    vasp: () => import('./kuwait/vasp-prompt').then(m => m.default),
    goAML: () => import('./kuwait/goAML-prompt').then(m => m.default),
  },
};

// ─── Jurisdiction Code Mapping ───────────────────────────────────────────────
// Map GCC alpha-2 codes to regulator codes used in promptModules keys
const JURISDICTION_TO_PROMPT_KEY: Record<string, string> = {
  AE: 'CBUAE',
  SA: 'SAMA',
  BH: 'CBB',
  QA: 'QCB',
  OM: 'CBOA',
  KW: 'CBK',
  // Legacy codes
  CBUAE: 'CBUAE',
  DFSA: 'CBUAE',
  FSRA: 'CBUAE',
};

function resolvePromptKey(jurisdiction: string): string {
  return JURISDICTION_TO_PROMPT_KEY[jurisdiction] || 'CBUAE';
}

// ─── Context Merge Helper ───────────────────────────────────────────────────

function mergeContext(prompt: string, context?: PromptContext): string {
  if (!context) return prompt;
  let merged = prompt;
  if (context.userRole) {
    merged += `\n\nACTIVE USER ROLE: ${context.userRole}`;
  }
  return merged;
}

// ─── Main Factory Function ──────────────────────────────────────────────────

/**
 * Loads a jurisdiction-specific system prompt via the factory.
 * Uses dynamic imports for lazy-loading — only the active jurisdiction's
 * prompts are loaded into memory.
 *
 * @param jurisdiction - GCC jurisdiction code (AE, SA, BH, QA, OM, KW or legacy CBUAE/DFSA/FSRA)
 * @param module - The prompt module to load
 * @param context - Optional runtime context to inject
 * @returns SystemPromptResult with the loaded prompt, version, and metadata
 */
export async function getSystemPrompt(
  jurisdiction: string,
  module: PromptModule,
  context?: PromptContext,
): Promise<SystemPromptResult> {
  const promptKey = resolvePromptKey(jurisdiction);

  const jurisdictionModules = promptModules[promptKey];
  if (!jurisdictionModules) {
    throw new Error(`No prompt modules found for jurisdiction key: ${promptKey} (input: ${jurisdiction})`);
  }

  const promptLoader = jurisdictionModules[module];
  if (!promptLoader) {
    throw new Error(`Prompt module "${module}" not found for ${promptKey}`);
  }

  const baseContext = await import('./shared/base-context').then(m => m.default);
  const jurisdictionPrompt = await promptLoader();
  const mergedPrompt = mergeContext(jurisdictionPrompt, context);

  // Normalize the jurisdiction to a GCC alpha-2 code for the result
  let normalizedJurisdiction: GCCJurisdictionCode;
  if (GCC_JURISDICTION_CODES.includes(jurisdiction as GCCJurisdictionCode)) {
    normalizedJurisdiction = jurisdiction as GCCJurisdictionCode;
  } else {
    // Map legacy codes
    const mapping: Record<string, GCCJurisdictionCode> = { CBUAE: 'AE', DFSA: 'AE', FSRA: 'AE' };
    normalizedJurisdiction = mapping[jurisdiction] || 'AE';
  }

  return {
    prompt: `${baseContext}\n\n${mergedPrompt}`,
    jurisdiction: normalizedJurisdiction,
    module,
    version: `${promptKey}-${module}-v1.0`,
  };
}

/**
 * Convenience function: loads multiple prompt modules for a jurisdiction
 * and returns them as a single merged system prompt string.
 */
export async function getMergedSystemPrompt(
  jurisdiction: string,
  modules: PromptModule[],
  context?: PromptContext,
): Promise<SystemPromptResult> {
  const results = await Promise.all(
    modules.map(m => getSystemPrompt(jurisdiction, m, context))
  );

  const promptKey = resolvePromptKey(jurisdiction);
  const mergedPrompt = results.map(r => r.prompt).join('\n\n---\n\n');

  let normalizedJurisdiction: GCCJurisdictionCode;
  if (GCC_JURISDICTION_CODES.includes(jurisdiction as GCCJurisdictionCode)) {
    normalizedJurisdiction = jurisdiction as GCCJurisdictionCode;
  } else {
    const mapping: Record<string, GCCJurisdictionCode> = { CBUAE: 'AE', DFSA: 'AE', FSRA: 'AE' };
    normalizedJurisdiction = mapping[jurisdiction] || 'AE';
  }

  return {
    prompt: mergedPrompt,
    jurisdiction: normalizedJurisdiction,
    module: modules.join('+') as PromptModule,
    version: `${promptKey}-${modules.join('+')}-v1.0`,
  };
}

// ─── Re-exports ──────────────────────────────────────────────────────────────

export type { PromptModule, PromptContext, SystemPromptResult } from './types';
