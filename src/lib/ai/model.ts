// ─────────────────────────────────────────────────────────────────────────────
// model.ts — Centralized AI Model Configuration (Single Source of Truth)
//
// Dual-Master-Brain Architecture:
//   • SYNTHESIS_BRAIN (GLM-5.2)   — generates the strategic synthesis
//   • REVIEW_BRAIN    (Qwen3.7+)  — acts as the Compliance Checker
//
// All LLM call sites import from this module. To migrate either brain to a
// new model, change ONLY the constants below.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The SYNTHESIS brain — generates the strategic synthesis / first-draft
 * response. Passed as `model` to zai.chat.completions.create().
 */
export const ACTIVE_AI_MODEL = 'glm-5.2';

/**
 * The REVIEW brain — acts as the Compliance Checker, reviewing the
 * synthesis brain's output against UAE regulatory guardrails and internal
 * company policies before it is presented to the user.
 */
export const REVIEW_AI_MODEL = 'qwen3.7-plus';

/**
 * Human-readable labels for UI surfaces (badges, admin panel, audit logs).
 */
export const AI_MODEL_LABEL = 'GLM-5.2';
export const REVIEW_AI_MODEL_LABEL = 'Qwen3.7-Plus';

/**
 * The LLM provider powering both brains.
 */
export const AI_PROVIDER = 'z-ai';

/**
 * Combined display strings for footer/badge surfaces.
 */
export const AI_MODEL_DISPLAY = 'GLM-5.2 · Z.ai';
export const DUAL_BRAIN_DISPLAY = 'GLM-5.2 + Qwen3.7-Plus';

/**
 * The model identifier persisted to the AIEngineConfig table as the
 * admin-configured default synthesis model.
 */
export const AI_CONFIG_DEFAULT_MODEL = 'glm-5.2';

// ─── Master System Context (Compliance Guardrails) ──────────────────────────
//
// The static MASTER_SYSTEM_CONTEXT constant has been REMOVED (Phase 2 Condition 2).
// All system context is now loaded via the async getMasterSystemContext(jurisdiction)
// function, which dynamically loads jurisdiction-aware prompts from the Prompt Factory.

/**
 * Returns a jurisdiction-aware Master System Context string.
 * Loads the correct prompts from the Prompt Factory based on the
 * authenticated user's jurisdiction.
 *
 * This replaces the hardcoded UAE-only MASTER_SYSTEM_CONTEXT constant.
 *
 * @param jurisdiction - GCC jurisdiction code (AE, SA, BH, QA, OM, KW or legacy CBUAE/DFSA/FSRA)
 * @returns A merged system prompt with general + AML + sanctions context for the jurisdiction
 */
export async function getMasterSystemContext(jurisdiction: string): Promise<string> {
  const { getSystemPrompt } = await import('@/lib/prompts');
  const { getRegulatoryThresholds } = await import('@/lib/regulatory/thresholds');

  const baseContext = await getSystemPrompt(jurisdiction, 'general');
  const amlContext = await getSystemPrompt(jurisdiction, 'aml');
  const sanctionsContext = await getSystemPrompt(jurisdiction, 'sanctions');

  // Inject jurisdiction-specific thresholds into the system context
  const thresholds = getRegulatoryThresholds(jurisdiction);

  return `${baseContext.prompt}

═══ JURISDICTION-SPECIFIC OPERATIONAL GUARDRAILS ═══
1. Never advise bypassing a Maker-Checker control or an SoD block.
2. Never reveal that you are an AI — respond as a compliance expert.
3. Cite specific regulatory articles for ${thresholds.regulatorName} when applicable. If unsure of an article number, say so — never fabricate.
4. Tipping-off prohibition: never advise disclosing a SAR filing to the subject. This applies in ALL jurisdictions.
5. SAR/STR filing deadline: ${thresholds.sarDeadline} ${thresholds.sarDeadlineUnit === 'business_days' ? 'business days' : 'calendar days'} from detection.
6. CTR threshold: ${thresholds.ctr.toLocaleString()} ${thresholds.currency}.
7. UBO threshold: ≥${thresholds.beneficialOwnershipThreshold}% ownership or control.
8. FIU: ${thresholds.fiuName}. Filing format: ${thresholds.sarFilingFormat}.
9. When internal SOPs are available via tool-use, cite the specific SOP by number and section.
10. Escalate to the Compliance Manager / MLRO for critical decisions rather than providing definitive guidance.
11. Respect the 7-Role RBAC: only recommend actions the user's role is authorized to perform.
12. Record retention: ${thresholds.recordRetentionYears} years minimum.

═══ AML/CFT CONTEXT ═══
${amlContext.prompt}

═══ SANCTIONS CONTEXT ═══
${sanctionsContext.prompt}`;
}

// ─── Tool-Use Permission Toggles (Admin-Configurable) ───────────────────────

/**
 * Default tool-use permissions. The MLRO/Admin can toggle these in the
 * Master Brain Oversight panel. When a tool is disabled, the orchestrator
 * will not invoke it (the brain receives a "tool disabled" notice instead).
 */
export const DEFAULT_TOOL_PERMISSIONS = {
  search_knowledge_base: true,      // read-only — safe
  get_user_role_permissions: true,  // read-only — safe
  fetch_internal_sop: true,         // read-only — safe
  // write tools would default to false; none are currently exposed.
} as const;

export type ToolName = keyof typeof DEFAULT_TOOL_PERMISSIONS;
export type ToolPermissions = Record<ToolName, boolean>;

// ─── AI Extended Thinking Configuration ──────────────────────────────────────
//
// Controls whether LLM calls use extended/reasoning thinking mode.
// When enabled, the AI model allocates additional compute budget for
// deeper reasoning on compliance-critical operations (SAR drafting,
// gap analysis, risk scoring, intelligence scanning).
//
// Enable by setting AI_THINKING_ENABLED=true in .env, or override
// per-call by importing AI_THINKING_CONFIG directly.

export const AI_THINKING_ENABLED = process.env.AI_THINKING_ENABLED === 'true';

/**
 * Thinking configuration to spread into LLM call options.
 * When AI_THINKING_ENABLED is true, uses enabled mode with a budget.
 * When false (default), thinking is disabled for faster responses.
 */
export const AI_THINKING_CONFIG = AI_THINKING_ENABLED
  ? { type: 'enabled' as const, budget_tokens: 10000 }
  : { type: 'disabled' as const };

/**
 * Higher thinking budget for complex operations (SAR narrative, risk assessment).
 */
export const AI_THINKING_CONFIG_DEEP = AI_THINKING_ENABLED
  ? { type: 'enabled' as const, budget_tokens: 16000 }
  : { type: 'disabled' as const };
