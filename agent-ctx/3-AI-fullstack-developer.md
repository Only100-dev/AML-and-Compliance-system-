# Task 3-AI — AI Master Brain Jurisdiction Scoping (Phase 3.2)

**Agent**: full-stack-developer (AI Scoping Subagent)
**Date**: 2026-03-05
**Task ID**: 3-AI
**Scope**: Make the IC-OS AI Master Brain jurisdiction-aware so KSA users get KSA-scoped advice (no UAE FDL/CBUAE policy leakage).

## Files Modified (6 source files)

| File | Summary |
| --- | --- |
| `src/lib/ai/model.ts` | Added `buildJurisdictionalSystemContext(jurisdictionCode, jurisdictionName, regulatorName)` helper. For AE returns `MASTER_SYSTEM_CONTEXT` verbatim; for non-AE returns a jurisdiction-appropriate variant swapping UAE refs for the active regulator name. |
| `src/lib/ai/tools.ts` | Added `ToolExecutionContext` interface. Widened `AgenticTool.execute` signature to `(args, context?) => Promise<string>`. `searchKnowledgeBase` + `fetchInternalSop` scope `db.policy.findMany()` queries by `jurisdictionId` when context is present. Jurisdiction-aware "not found" messages for non-AE. `executeTool` threads context through. |
| `src/lib/ai/master-brain.ts` | Extended `OrchestrationRequest` with optional `jurisdictionId`/`jurisdictionCode`. Resolves jurisdiction from DB (full country name + regulator name). Calls `buildJurisdictionalSystemContext` per-call instead of static `MASTER_SYSTEM_CONTEXT`. Threads jurisdiction into `analyzeIntent`/`generateSynthesis`/`reviewSynthesis` prompts. New review check #6: jurisdiction-scoping leak detector. Threads `ToolExecutionContext` into every `executeTool` call. Jurisdiction-aware disclaimer. |
| `src/app/api/ai/orchestrate/route.ts` | Imports `getSessionJurisdictionId` + `getSessionJurisdictionCode`. Extracts jurisdiction from session after `authGuard()`. Passes into `orchestrateMasterBrain`. Audit log `details` JSON now includes `jurisdictionId` + `jurisdictionCode`; the `db.auditLog.create()` row is country-tagged via `jurisdictionId: jurisdictionId ?? undefined`. |
| `src/app/api/ai/chat/route.ts` | Imports `getSessionJurisdictionCode` + `db`. Looks up regulator name from DB. AE branch keeps UAE/CBUAE/MOHRE/goAML prompts verbatim; non-AE branch builds jurisdiction-aware prompts with explicit "Do NOT cite UAE-specific regulations" guardrail. Fallback `getFallbackResponse()` is now jurisdiction-aware (AE → original UAE guidance verbatim; non-AE → regulator-specific guidance with no UAE FDL/goAML refs). Jurisdiction-aware disclaimer + `jurisdictionCode` in response body. |
| `src/app/api/ai/route.ts` | Applies jurisdiction-awareness to the 3 AI tasks (generate-goaml, gap-analysis, risk-score). goAML narrative swaps UAE-specific labels (CBUAE AML Red Flags → `${regulatorName} AML Red Flags`, UAE Resident ID → `${jurisdictionCode} Resident ID`, etc.) for non-AE. `processingLocation` reflects active country code. `jurisdictionCode` added to all 3 task response payloads. |

## Backward Compatibility — CONFIRMED

- `AgenticTool.execute` `context` parameter is OPTIONAL → existing tools that ignore it (`get_user_role_permissions`) work unchanged.
- `executeTool` `context` parameter is OPTIONAL → any caller that doesn't pass it gets unscoped queries (legacy behavior).
- `OrchestrationRequest.jurisdictionId/jurisdictionCode` are OPTIONAL → if omitted, the orchestrator defaults to 'AE' (canonical system context, unscoped tool queries).
- `REGULATORY_KNOWLEDGE_BASE` in-memory KB intentionally NOT filtered by jurisdiction (generic cross-jurisdiction reference material).
- The chat route's AE branch is byte-identical to pre-change behavior.
- The fallback engine's AE branch is byte-identical to pre-change behavior.

## Verification

- `bun run lint` → **0 errors**, 2 pre-existing warnings (unrelated React Compiler / TanStack Virtual). Audit check passed (4 PASS / 21 pre-existing WARN / 0 FAIL).
- `bunx tsc --noEmit` → 4 pre-existing errors in AI layer (verified by stashing my changes — same 4 errors at shifted line numbers). **ZERO new TypeScript errors introduced.**
- dev.log → no compile errors, no route-handler errors after edits.

## Hand-off to Next Agent

The AI layer is now jurisdiction-aware end-to-end:
1. **DB scoping**: `search_knowledge_base` + `fetch_internal_sop` filter policies by `jurisdictionId`.
2. **Prompt scoping**: All 3 brain phases (intent / synthesis / review) mention the active jurisdiction and instruct the brain to cite only that country's refs.
3. **System context**: Per-call `buildJurisdictionalSystemContext` swaps UAE-specific guardrails for the active regulator's name.
4. **Audit trail**: Master Brain audit logs are jurisdiction-tagged (both in `details` JSON and on the `AuditLog.jurisdictionId` column).
5. **Chat fallback**: Jurisdiction-aware rule-based fallback (no UAE refs for non-AE).
6. **goAML narrative**: Jurisdiction-aware labels (CBUAE → SAMA/CBB/QCB/CBOA/CBK for non-AE).

Future agents working on Phase 3.3+ (Reporting Localization, Regulatory Content Localization) can build on this — the AI now correctly refuses to leak UAE-specific policy/regulatory content to non-AE users.

For full work log see `/home/z/my-project/worklog.md` section "Task ID: 3-AI".
