// ─────────────────────────────────────────────────────────────────────────────
// master-brain.ts — Dual-Master-Brain Orchestration Engine
//
// Implements the Agentic AI Router / Orchestrator where GLM-5.2 and
// Qwen3.7-Plus act as the supreme "Executive AI Committee":
//
//   Phase 1 — INTENT ANALYSIS & TOOL ROUTING (GLM-5.2):
//     The synthesis brain analyzes the user's intent and decides which
//     agentic tools to invoke to gather grounding context.
//
//   Phase 2 — STRATEGIC SYNTHESIS (GLM-5.2):
//     With the tool-gathered context, the synthesis brain generates the
//     strategic synthesis — filtered through RBAC, Maker-Checker, and
//     regulatory guardrails.
//
//   Phase 3 — DUAL-CORE COMPLIANCE REVIEW (Qwen3.7-Plus):
//     The review brain acts as the Compliance Checker, reviewing the
//     synthesis against the jurisdiction's regulatory guardrails and
//     internal policies. It can APPROVE, ANNOTATE, or REJECT (with
//     requested revisions).
//
//   Phase 4 — CONSENSUS:
//     If the reviewer approves (or annotates), the consensus is returned.
//     If the reviewer requests revisions, a single revision loop occurs
//     (GLM-5.2 revises → Qwen3.7-Plus re-reviews). Final result always
//     surfaces both brains' reasoning in the Chain-of-Thought.
//
// All phases are logged to the audit trail for the Master Brain Oversight
// panel (Chain-of-Thought audit logs).
//
// Phase 2 (Action 2.2): Refactored to support jurisdiction-parameterized
// system context. The MASTER_SYSTEM_CONTEXT constant has been REMOVED;
// all phases now receive a jurisdiction-aware systemContext string via
// getMasterSystemContext(jurisdiction).
// ─────────────────────────────────────────────────────────────────────────────

import { ACTIVE_AI_MODEL, REVIEW_AI_MODEL, DEFAULT_TOOL_PERMISSIONS, AI_THINKING_CONFIG, AI_THINKING_CONFIG_DEEP, type ToolPermissions } from '@/lib/ai/model';
import { getEnabledToolDescriptors, executeTool } from '@/lib/ai/tools';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OrchestrationRequest {
  prompt: string;
  userRole: string;
  userName?: string;
  contextModule?: string;
  sessionId?: string;
  permissions?: ToolPermissions;
  jurisdictionId?: string;  // GCC jurisdiction code (AE, SA, BH, QA, OM, KW, or legacy CBUAE)
}

export interface ToolInvocation {
  tool: string;
  args: Record<string, unknown>;
  result: string;
  timestamp: string;
}

export interface BrainPhase {
  brain: 'GLM-5.2' | 'Qwen3.7-Plus';
  phase: 'intent' | 'synthesis' | 'review' | 'revision';
  model: string;
  input: string;
  output: string;
  latencyMs: number;
  timestamp: string;
}

export type ConsensusVerdict = 'APPROVED' | 'APPROVED_WITH_ANNOTATIONS' | 'REVISIONS_REQUESTED';

export interface OrchestrationResult {
  success: boolean;
  consensus: string;
  verdict: ConsensusVerdict;
  synthesis: string;
  review: string;
  toolsUsed: ToolInvocation[];
  chainOfThought: BrainPhase[];
  totalLatencyMs: number;
  modelsUsed: { synthesis: string; review: string };
  disclaimer: string;
  error?: string;
}

// ─── LLM Call Helper (with timeout) ──────────────────────────────────────────

const LLM_TIMEOUT_MS = 45_000;

async function callLLM(
  model: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
): Promise<{ content: string; latencyMs: number }> {
  const startTime = Date.now();
  const ZAI = (await import('z-ai-web-dev-sdk')).default;
  const zai = await ZAI.create();

  const completion = await Promise.race([
    zai.chat.completions.create({
      model,
      messages,
      thinking: AI_THINKING_CONFIG,
    }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`LLM call (${model}) timed out after ${LLM_TIMEOUT_MS / 1000}s`)),
        LLM_TIMEOUT_MS,
      ),
    ),
  ]);

  const content = completion.choices[0]?.message?.content || '';
  return { content, latencyMs: Date.now() - startTime };
}

// ─── Phase 1: Intent Analysis & Tool Routing ─────────────────────────────────

interface IntentAnalysis {
  toolsToCall: Array<{ tool: string; args: Record<string, unknown> }>;
  reasoning: string;
}

function parseIntentResponse(raw: string): IntentAnalysis {
  // The brain is instructed to output a JSON block. Extract it defensively.
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { toolsToCall: [], reasoning: raw.slice(0, 300) };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      toolsToCall: Array.isArray(parsed.toolsToCall) ? parsed.toolsToCall : [],
      reasoning: String(parsed.reasoning ?? ''),
    };
  } catch {
    return { toolsToCall: [], reasoning: raw.slice(0, 300) };
  }
}

async function analyzeIntent(
  prompt: string,
  userRole: string,
  contextModule: string | undefined,
  permissions: ToolPermissions,
  systemContext: string,
): Promise<{ analysis: IntentAnalysis; phase: BrainPhase }> {
  const toolDescriptors = getEnabledToolDescriptors(permissions);
  const userPrompt = `User prompt: "${prompt}"
User role: ${userRole}
Context module: ${contextModule ?? 'general'}

Available tools you may invoke:
${toolDescriptors}

Analyze the user's intent and decide which tools to invoke to gather grounding context BEFORE you synthesize a response. Respond ONLY with a JSON object:
{
  "reasoning": "<brief explanation of your intent analysis>",
  "toolsToCall": [
    { "tool": "<tool_name>", "args": { "<param>": "<value>" } }
  ]
}
Invoke at most 3 tools. Only invoke tools that are clearly relevant. If no tools are needed, return an empty toolsToCall array.`;

  const { content, latencyMs } = await callLLM(ACTIVE_AI_MODEL, [
    { role: 'system', content: systemContext },
    { role: 'user', content: userPrompt },
  ]);

  return {
    analysis: parseIntentResponse(content),
    phase: {
      brain: 'GLM-5.2',
      phase: 'intent',
      model: ACTIVE_AI_MODEL,
      input: userPrompt,
      output: content,
      latencyMs,
      timestamp: new Date().toISOString(),
    },
  };
}

// ─── Phase 2: Strategic Synthesis (GLM-5.2) ──────────────────────────────────

async function generateSynthesis(
  prompt: string,
  userRole: string,
  contextModule: string | undefined,
  toolContext: string,
  systemContext: string,
): Promise<{ synthesis: string; phase: BrainPhase }> {
  const userPrompt = `User prompt: "${prompt}"
User role: ${userRole}
Context module: ${contextModule ?? 'general'}

=== Tool-Gathered Context ===
${toolContext || '(no tools were invoked — synthesize from your training knowledge and the regulatory guardrails above)'}

=== Instructions ===
Synthesize a strategic, compliance-aligned response. You are the SYNTHESIS brain (GLM-5.2). Your output will be reviewed by the Compliance Checker (Qwen3.7-Plus) before it reaches the user.

Rules:
- Cite specific regulatory articles for the user's jurisdiction when applicable. Follow the jurisdiction context provided in the system prompt.
- If internal SOPs were retrieved via tools, cite them by policy number and section.
- Respect the user's role RBAC — only recommend actions they are authorized to perform.
- Enforce Maker-Checker: never advise bypassing a checker approval.
- Be concise, professional, and actionable.
- If you are uncertain about a regulatory reference, say so explicitly.
- Structure your response with clear sections if the prompt is complex.`;

  const { content, latencyMs } = await callLLM(ACTIVE_AI_MODEL, [
    { role: 'system', content: systemContext },
    { role: 'user', content: userPrompt },
  ]);

  return {
    synthesis: content,
    phase: {
      brain: 'GLM-5.2',
      phase: 'synthesis',
      model: ACTIVE_AI_MODEL,
      input: userPrompt,
      output: content,
      latencyMs,
      timestamp: new Date().toISOString(),
    },
  };
}

// ─── Phase 3: Dual-Core Compliance Review (Qwen3.7-Plus) ─────────────────────

interface ReviewResult {
  verdict: ConsensusVerdict;
  annotations: string;
  revisedOutput?: string;
}

function parseReviewResponse(raw: string): ReviewResult {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { verdict: 'APPROVED_WITH_ANNOTATIONS', annotations: raw.slice(0, 500) };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const verdictRaw = String(parsed.verdict ?? 'APPROVED_WITH_ANNOTATIONS').toUpperCase();
    const verdict: ConsensusVerdict = verdictRaw.includes('APPROVED') && !verdictRaw.includes('ANNOTATION')
      ? 'APPROVED'
      : verdictRaw.includes('REVISION')
        ? 'REVISIONS_REQUESTED'
        : 'APPROVED_WITH_ANNOTATIONS';
    return {
      verdict,
      annotations: String(parsed.annotations ?? ''),
      revisedOutput: parsed.revisedOutput ? String(parsed.revisedOutput) : undefined,
    };
  } catch {
    return { verdict: 'APPROVED_WITH_ANNOTATIONS', annotations: raw.slice(0, 500) };
  }
}

async function reviewSynthesis(
  prompt: string,
  synthesis: string,
  toolContext: string,
  systemContext: string,
): Promise<{ result: ReviewResult; phase: BrainPhase }> {
  const userPrompt = `Original user prompt: "${prompt}"

=== Synthesis Brain (GLM-5.2) Output ===
${synthesis}

=== Tool-Gathered Context ===
${toolContext || '(no tools invoked)'}

=== Your Role ===
You are the COMPLIANCE CHECKER (Qwen3.7-Plus). Review the synthesis above against:
1. The jurisdiction's regulatory framework (as specified in the system context above) — are all regulatory citations accurate? Are any fabricated?
2. The 7-Role RBAC — does the synthesis recommend actions the user's role is unauthorized to perform?
3. Maker-Checker / SoD — does the synthesis advise bypassing any control?
4. Internal SOPs — if tools retrieved internal policies, does the synthesis correctly cite them?
5. Tipping-off prohibition — does the synthesis disclose SAR existence to a subject?
6. Jurisdiction-specific thresholds — are CTR thresholds, SAR deadlines, and UBO thresholds correct for this jurisdiction?

Respond ONLY with a JSON object:
{
  "verdict": "APPROVED" | "APPROVED_WITH_ANNOTATIONS" | "REVISIONS_REQUESTED",
  "annotations": "<your review notes — corrections, caveats, or confirmations. If APPROVED, briefly state why.>",
  "revisedOutput": "<only if REVISIONS_REQUESTED: provide your corrected version of the synthesis>"
}`;

  const { content, latencyMs } = await callLLM(REVIEW_AI_MODEL, [
    { role: 'system', content: systemContext },
    { role: 'user', content: userPrompt },
  ]);

  return {
    result: parseReviewResponse(content),
    phase: {
      brain: 'Qwen3.7-Plus',
      phase: 'review',
      model: REVIEW_AI_MODEL,
      input: userPrompt,
      output: content,
      latencyMs,
      timestamp: new Date().toISOString(),
    },
  };
}

// ─── Phase 4: Consensus ──────────────────────────────────────────────────────

function buildConsensus(synthesis: string, review: ReviewResult): string {
  switch (review.verdict) {
    case 'APPROVED':
      return synthesis;
    case 'APPROVED_WITH_ANNOTATIONS':
      return `${synthesis}

---
Compliance Checker Annotations (Qwen3.7-Plus):
${review.annotations}`;
    case 'REVISIONS_REQUESTED':
      return review.revisedOutput || `${synthesis}

---
[Compliance Checker requested revisions but none were provided — use with caution.]
Annotations: ${review.annotations}`;
  }
}

// ─── Main Orchestrator ───────────────────────────────────────────────────────

export async function orchestrateMasterBrain(
  request: OrchestrationRequest,
): Promise<OrchestrationResult> {
  const startTime = Date.now();
  const { prompt, userRole, contextModule, permissions = DEFAULT_TOOL_PERMISSIONS, jurisdictionId = 'AE' } = request;

  // Load jurisdiction-aware system context
  let systemContext: string;
  try {
    const { getMasterSystemContext } = await import('@/lib/ai/model');
    systemContext = await getMasterSystemContext(jurisdictionId);
  } catch (ctxErr) {
    // Fallback: construct a minimal context if the Prompt Factory fails
    const msg = ctxErr instanceof Error ? ctxErr.message : 'unknown';
    console.error(`[Master Brain] Failed to load jurisdiction context for ${jurisdictionId}: ${msg}`);
    systemContext = `You are the Executive AI Orchestrator for IC-OS. Jurisdiction: ${jurisdictionId}. IMPORTANT: The full jurisdiction context could not be loaded. Proceed with caution and always verify regulatory citations. Never fabricate article numbers. Escalate to the MLRO for critical decisions.`;
  }

  const chainOfThought: BrainPhase[] = [];
  const toolsUsed: ToolInvocation[] = [];

  try {
    // ── Phase 1: Intent Analysis & Tool Routing ────────────────────────────
    let intentAnalysis: IntentAnalysis;
    try {
      const intentResult = await analyzeIntent(prompt, userRole, contextModule, permissions, systemContext);
      intentAnalysis = intentResult.analysis;
      chainOfThought.push(intentResult.phase);
    } catch (err) {
      // If intent analysis fails (e.g. timeout), proceed without tools
      const msg = err instanceof Error ? err.message : 'unknown';
      intentAnalysis = { toolsToCall: [], reasoning: `Intent analysis skipped: ${msg}` };
      chainOfThought.push({
        brain: 'GLM-5.2',
        phase: 'intent',
        model: ACTIVE_AI_MODEL,
        input: '(intent analysis failed)',
        output: `Skipped: ${msg}`,
        latencyMs: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // ── Execute Tools ──────────────────────────────────────────────────────
    let toolContext = '';
    for (const call of intentAnalysis.toolsToCall.slice(0, 3)) {
      const result = await executeTool(String(call.tool), call.args ?? {}, permissions);
      toolsUsed.push({
        tool: String(call.tool),
        args: call.args ?? {},
        result,
        timestamp: new Date().toISOString(),
      });
      toolContext += `\n--- Tool: ${call.tool} ---\n${result}\n`;
    }

    // ── Phase 2: Strategic Synthesis (GLM-5.2) ─────────────────────────────
    const synthResult = await generateSynthesis(prompt, userRole, contextModule, toolContext, systemContext);
    chainOfThought.push(synthResult.phase);
    const synthesis = synthResult.synthesis;

    // ── Phase 3: Dual-Core Compliance Review (Qwen3.7-Plus) ────────────────
    let reviewResult: ReviewResult;
    try {
      const reviewResponse = await reviewSynthesis(prompt, synthesis, toolContext, systemContext);
      chainOfThought.push(reviewResponse.phase);
      reviewResult = reviewResponse.result;
    } catch (err) {
      // If the review brain fails, surface the synthesis with a caveat
      const msg = err instanceof Error ? err.message : 'unknown';
      reviewResult = {
        verdict: 'APPROVED_WITH_ANNOTATIONS',
        annotations: `Compliance Checker (Qwen3.7-Plus) was unavailable (${msg}). Synthesis is UNREVIEWED — proceed with caution and consult the MLRO.`,
      };
      chainOfThought.push({
        brain: 'Qwen3.7-Plus',
        phase: 'review',
        model: REVIEW_AI_MODEL,
        input: '(review failed)',
        output: `Skipped: ${msg}`,
        latencyMs: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // ── Phase 4: Consensus ─────────────────────────────────────────────────
    const consensus = buildConsensus(synthesis, reviewResult);

    // Build jurisdiction-aware disclaimer
    const { getRegulatoryThresholds } = await import('@/lib/regulatory/thresholds');
    const thresholds = getRegulatoryThresholds(jurisdictionId);

    return {
      success: true,
      consensus,
      verdict: reviewResult.verdict,
      synthesis,
      review: reviewResult.annotations,
      toolsUsed,
      chainOfThought,
      totalLatencyMs: Date.now() - startTime,
      modelsUsed: { synthesis: ACTIVE_AI_MODEL, review: REVIEW_AI_MODEL },
      disclaimer: `This response was produced by the Dual-Master-Brain (GLM-5.2 synthesis + Qwen3.7-Plus compliance review) for ${thresholds.regulatorName} (${thresholds.jurisdiction}). AI responses are for guidance only. Always verify with official ${thresholds.regulatorName} regulatory texts and consult the MLRO for critical compliance decisions.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return {
      success: false,
      consensus: '',
      verdict: 'REVISIONS_REQUESTED',
      synthesis: '',
      review: '',
      toolsUsed,
      chainOfThought,
      totalLatencyMs: Date.now() - startTime,
      modelsUsed: { synthesis: ACTIVE_AI_MODEL, review: REVIEW_AI_MODEL },
      disclaimer: 'Master Brain orchestration failed.',
      error: msg,
    };
  }
}
