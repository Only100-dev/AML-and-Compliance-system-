# IC-OS v7.2 — MASTER GAP ANALYSIS REPORT

**Audit Date:** 2026-03-04  
**Audit Scope:** Full 5-Phase Deep-Dive — Document-to-Code Mapping, Bug/Edge Case Hunt, Security/Privacy, RAG/AI Pipeline, Performance/Build  
**Auditor:** Lead Enterprise Architect / Principal Security Engineer / Lead QA  
**Codebase:** IC-OS v7.2 (Next.js 16.1.3, Prisma/SQLite, 122-scenario RAG Knowledge Base, 65 API routes, 40 components)  
**Restore Point:** `v7.2-pre-audit-restore` (git tag)

---

## 1. EXECUTIVE SUMMARY

| Metric | Value |
|--------|-------|
| **Overall Codebase Health** | ⚠️ **NEEDS IMMEDIATE ATTENTION** before production |
| **Critical Findings (🔴)** | **14** |
| **High-Priority Issues (🟠)** | **12** |
| **Medium/Low Enhancements (🟡)** | **15** |
| **Previously Reported Bugs — Now Fixed** | **4** (AMLSanctionsTriage crash, CBUAE hydration, TopBar hydration, QueryClientProvider) |
| **Lint/Build Status** | ✅ 0 errors, 1 benign warning (TanStack Virtual / React Compiler) |
| **Type Safety** | ✅ Zero `any` types across entire codebase |
| **Top 20 Scenario Coverage** | 8 IMPLEMENTED / 8 PARTIAL / 4 MISSING |
| **Auth Coverage** | 20/63 routes have `authGuard` — **43 routes unprotected** |
| **Rate Limiting** | 2/63 routes — **61 routes unprotected** |
| **PII Masking** | 1/63 endpoints applies server-side masking — **62 expose raw PII** |

### Risk Assessment

The IC-OS platform has a **strong architectural foundation** — the Golden Path (Zod → authGuard → Prisma → SHA-256 Audit → React Query cache invalidation) is correctly implemented in the routes that use it. The RAG pipeline is functional with good no-hallucination guards. However, the system has **systemic gaps** in three areas that must be addressed before any production or regulatory review deployment:

1. **Authentication & Authorization** — 43 of 63 API routes have no `authGuard`, exposing all KYC, AML, sanctions, goAML, and claims data to unauthenticated access.
2. **PII Data Protection** — The PII masking library is excellent but applied to only 1 endpoint. 62 endpoints return raw PII (Emirates IDs, passport numbers, bank accounts, names).
3. **Rate Limiting** — Infrastructure exists but is applied to only 2 endpoints. All AI and screening endpoints are unprotected against denial-of-wallet attacks.

These are **not architectural flaws** — they are **implementation gaps** where existing infrastructure (authGuard, maskPII, rate-limit.ts) was built but not consistently applied.

---

## 2. CRITICAL GAPS (🔴)

### C1. 43 API Routes Missing `authGuard` — Unauthenticated Data Access
**Severity:** 🔴 CRITICAL  
**Impact:** Any unauthenticated user can read/write AML alerts, KYC records, goAML filings, sanctions screenings, claims, adverse media, and AI chat data.

| Endpoint Category | Routes Exposed | Data at Risk |
|---|---|---|
| AML Alerts | `/api/aml` (GET/PATCH/POST) | Alert details, SAR status, assigned users |
| KYC Records | `/api/kyc` (GET/POST/PUT/DELETE) | Full KYC with Emirates ID, passport, UBO, PEP status |
| Sanctions | `/api/sanctions` (GET/POST) | Screening results, match details, list entries |
| goAML Filings | `/api/goaml` (GET/POST/PUT/DELETE) | SAR/STR filings with subject PII |
| Claims | `/api/claims` (GET/POST/PATCH) | Claimant names, bank accounts, payout details |
| Adverse Media | `/api/adverse-media` (GET/POST/PUT/DELETE) | Subject names, nationalities, AKA |
| AI Endpoints | `/api/ai/*`, `/api/chat/scenarios` | LLM access, potential data exfiltration |
| VASP KYC | `/api/vasp-kyc` (GET/POST/PUT) | Wallet addresses, Travel Rule data |
| Audit Log | `/api/audit-log` (GET) | Full audit trail with user IDs |
| Dashboard | `/api/dashboard` (GET) | Aggregate metrics |

**Root Cause:** `authGuard` was implemented in sub-routes (individual, corporate, surrender, etc.) but not in their parent routes. The middleware skips auth checks in dev mode (`middleware.ts:90`), compounding the issue.

**Fix:** Add `authGuard` to all 43 unprotected routes. Prioritize KYC, AML, sanctions, goAML, and claims routes first.

---

### C2. Mass Assignment Vulnerability in `/api/kyc` PUT
**Severity:** 🔴 CRITICAL  
**File:** `src/app/api/kyc/route.ts`, lines 198-239  
**Impact:** An attacker can modify `riskRating`, `riskScore`, `status`, `uboIdentified`, `pepInManagement`, or any other field by including them in the request body.

```typescript
const { id, type, ...data } = body;  // No Zod schema — data is attacker-controlled
const kyc = await db.corporateKYC.update({ where: { id }, data });  // Direct spread
```

**Fix:** Add a Zod update schema that whitelists only allowed fields. Reject any extra keys.

---

### C3. 62 API Endpoints Return Unmasked PII
**Severity:** 🔴 CRITICAL  
**Impact:** Emirates IDs, passport numbers, bank account numbers, trade license numbers, full names, and addresses are returned in API responses without any server-side masking. This violates CBUAE Notice 3551/2021 data protection requirements.

**Key exposed endpoints:**
- `/api/kyc` — `legalName`, `emiratesId`, `passportNo`, `uboDetails`
- `/api/sanctions` — `primaryName`, `aliases`, `identifiers`
- `/api/claims` — `claimantName`, `payoutBankAccount`
- `/api/goaml` — `subjectName`, `xmlPayload`
- `/api/investigation/context` — Full customer profile, transactions, adverse media (ALL UNMASKED)
- `/api/audit-log` — `userId`, `userName`, `details`

**Only endpoint with correct masking:** `/api/audit/generate-data-room` ✅

**Broken import:** `src/hooks/use-pii.ts:39-40` references `maskGeneric` and `maskObject` which do not exist in `src/lib/pii.ts`.

**Fix:** Apply server-side PII masking in all data-returning route handlers using the existing `src/lib/pii.ts` library. Fix broken imports in use-pii.ts.

---

### C4. Rate Limiting Applied to Only 2/63 Endpoints
**Severity:** 🔴 CRITICAL  
**Impact:** All AI endpoints (`/api/ai/*`, `/api/chat/*`) are unprotected against denial-of-wallet attacks on LLM APIs. All screening endpoints are unprotected against quota exhaustion. Auth endpoints have no brute-force protection.

**Existing but unused rate limit profiles:**
| Profile | Config | Used? |
|---|---|---|
| `AI_CHAT` | 20 req/min | ❌ NEVER USED |
| `AI_TASK` | 10 req/min | ❌ NEVER USED |
| `AUTH` | 5 req/15min | ❌ NEVER USED |
| `WRITE` | 30 req/min | ✅ Used in 1 endpoint |
| `READ` | 60 req/min | ❌ NEVER USED |

**Fix:** Apply existing rate limit profiles to their designated endpoint categories.

---

### C5. Dev Mode Auth Bypass Grants Full Admin Access
**Severity:** 🔴 CRITICAL  
**File:** `src/lib/auth-guard.ts`, lines 25-37  
**Impact:** If `NODE_ENV=development` is accidentally set in staging/production, all authentication is bypassed with admin privileges.

```typescript
if (!session?.user && process.env.NODE_ENV === 'development') {
  return { session: { user: { name: 'Dev User', role: 'admin' } }, authorized: true };
}
```

**Compounded by:** `src/middleware.ts:90` — `if (!isDev) { /* auth check */ }` skips ALL auth checks in dev mode.

**Fix:** Add explicit opt-in flag (e.g., `ICOS_DEV_BYPASS_AUTH=true`) instead of relying on `NODE_ENV`. Log a prominent warning when bypass is active.

---

### C6. No Timeout on z-ai-web-dev-sdk LLM Calls (4 endpoints)
**Severity:** 🔴 CRITICAL  
**Files:**
- `src/app/api/chat/scenarios/route.ts:387`
- `src/app/api/ai/enhanced/route.ts:267`
- `src/app/api/ai/policy-rag/route.ts:118`
- `src/app/api/regulatory-intel/analyze/route.ts:171`

**Impact:** If the LLM SDK hangs, the request thread blocks indefinitely. Under load, this can exhaust server resources and cause cascading failures.

**Comparison:** The Ollama fallback in `enhanced/route.ts:283-284` correctly uses `AbortController` with a 15-second timeout.

**Fix:** Add `AbortController` with 30-second timeout to all `zai.chat.completions.create()` calls.

---

### C7. User Feedback (ThumbsUp/Down) Never Persisted
**Severity:** 🔴 CRITICAL  
**File:** `src/components/AIAssistantWidget.tsx:220-222`  
**Impact:** The feedback loop for RAG quality is completely broken. Users click thumbs-up/down, but the data is never sent to the server. `ScenarioChatReference.userFeedback` is always `null`.

```typescript
const handleFeedback = useCallback((messageId: string, feedback: 'positive' | 'negative') => {
  toast.success(feedback === 'positive' ? 'Feedback recorded' : 'Feedback noted');
  // ← No API call! Feedback is lost.
}, []);
```

**Fix:** Create a `/api/chat/feedback` endpoint that updates `ScenarioChatReference.userFeedback`. Wire the `handleFeedback` callback to call this endpoint.

---

### C8. ScenarioChatReference is Write-Only — No Analytics/Read Path
**Severity:** 🔴 CRITICAL  
**File:** `prisma/schema.prisma:764-776`  
**Impact:** No way to determine which scenarios are most useful, which are never referenced, or how the RAG system is performing over time. The entire feedback loop for model refinement is broken.

**Fix:** Create a `/api/chat/analytics` endpoint that queries `ScenarioChatReference` for usage metrics. Add a simple analytics panel in the AI admin config.

---

### C9. Missing Regulatory Workflows — 4 Critical Scenarios
**Severity:** 🔴 CRITICAL  
**Impact:** Regulatory liability during CBUAE examination. These are referenced in `regulatory-refs.ts` but have zero code enforcement:

| Scenario | Regulatory Reference | Gap |
|---|---|---|
| NPO Enhanced Screening | FATF Recommendation 8 | No seed data, no route, no logic |
| Correspondent Banking DD | CR 134/2025 Art. 9 | Ref fully mapped but zero code |
| De-Risking / Managed Exit | FATF Guidance on De-risking | Seed exists but no route |
| MLAT / International Cooperation | FDL 10/2025 Art. 22, CR 134/2025 Art. 31-33 | Ref fully mapped but zero code |

---

### C10. Full Table Scan in Investigation Context
**Severity:** 🔴 CRITICAL  
**File:** `src/app/api/investigation/context/route.ts:177`  
**Issue:** `db.complianceCase.findMany()` fetches ALL compliance cases with no WHERE clause, then filters in JavaScript using `JSON.parse(c.linkedAlertIds)`. This is an O(n) in-memory scan that grows linearly with data.

**Fix:** Replace with a proper Prisma query: `where: { linkedAlertIds: { contains: validatedAlertId } }` or refactor `linkedAlertIds` to a proper relation table.

---

### C11. N+1 Recursive Queries in UBO Tracing
**Severity:** 🔴 CRITICAL  
**File:** `src/lib/compliance/ubo-tracing.ts:188-215, 248-277, 339-357, 419-453`  
**Issue:** `traceUBOOwnership()`, `calculateOFAC50Percent()`, `buildOwnershipTree()`, and `aggregateOwnership()` make individual DB queries (`checkSanctionedStatus()`, `getDirectOwners()`) inside recursive loops. At depth 5 with branching, this generates 50+ sequential queries.

**Fix:** Batch queries at each depth level. Pre-fetch all owners and sanctioned IDs before recursing.

---

### C12. Hard Delete on KYC Records — No Audit Trail
**Severity:** 🔴 CRITICAL  
**File:** `src/app/api/kyc/route.ts:270-278`  
**Issue:** Hard-deletes KYC records with `db.corporateKYC.delete()` / `db.individualKYC.delete()`. No audit log is created. Violates FDL 10/2025 Art. 11 (5-year record retention).

**Fix:** Implement soft delete (add `deletedAt` field, `isDeleted` flag). Create audit log entry before soft-deleting.

---

### C13. Missing Zod Validation on `/api/aml` and `/api/kyc`
**Severity:** 🔴 CRITICAL  
**Files:** 
- `src/app/api/aml/route.ts` — No Zod schema at all
- `src/app/api/kyc/route.ts` — No Zod schema on PUT/DELETE

**Impact:** Type coercion attacks, extra fields, nested object injection. The PUT mass assignment (C2) is a direct consequence of this gap.

**Fix:** Create and apply Zod schemas for all methods on both routes.

---

### C14. SAR Draft References Wrong Law for Tipping-Off
**Severity:** 🔴 CRITICAL (Regulatory Accuracy)  
**File:** `src/app/api/ai/draft-sar/route.ts:108`  
**Issue:** States "Per UAE Federal Decree-Law No. 20 of 2018" but the codebase elsewhere consistently references "FDL 10/2025". FDL 20/2018 is the old AML law that was superseded by FDL 10/2025.

**Fix:** Update reference from FDL 20/2018 to FDL 10/2025.

---

## 3. HIGH-PRIORITY ISSUES (🟠)

### H1. RAG Prompt Uses Wrong Role — `assistant` Instead of `system`
**File:** `src/app/api/chat/scenarios/route.ts:363-365`, `src/app/api/ai/policy-rag/route.ts:119-121`  
**Impact:** The LLM treats the RAG context as prior model output rather than behavioral instructions, weakening the hallucination guard.  
**Fix:** Change `role: 'assistant'` to `role: 'system'` in both files.

### H2. `.parse()` Instead of `.safeParse()` on 4 Routes
**Files:**
- `src/app/api/ai/enhanced/route.ts:237`
- `src/app/api/ai/policy-rag/route.ts:149`
- `src/app/api/training-effectiveness/route.ts:302, 434`

**Impact:** `.parse()` throws `ZodError` which the outer catch returns as a generic 500 instead of a proper 400 with field-level validation details.  
**Fix:** Replace with `.safeParse()` and handle the `success: false` path with 400 responses.

### H3. `/api/aml` POST — `action` Parameter Not Validated
**File:** `src/app/api/aml/route.ts:164-170`  
**Impact:** Invalid `action` values silently no-op — API returns success but does nothing.  
**Fix:** Validate `action` against allowed enum values (`approve`, `escalate`, `override`) with Zod.

### H4. No Request Body Size Limits on Any Route
**Impact:** An attacker could send multi-MB JSON payloads to exhaust server memory. `request.json()` reads the entire body before Zod validates.  
**Fix:** Add body size limits via Next.js config or middleware.

### H5. 8 Partially Implemented Scenarios (Top 20)
| Scenario | Gap |
|---|---|
| Takaful Hibah / Beneficial Ownership | No Takaful pooling logic, no Hibah nominee verification |
| Overnight Sanctions Unfreeze | Freeze implemented but no unfreeze/de-freeze POST endpoint |
| Large Cash Transaction Reporting | No AED 55,000 CTR threshold auto-detection |
| Cross-Border Wire Transfer Monitoring | No FATF Rec 16 enforcement, no wire transfer route |
| Trade-Based ML Detection | Seed exists but no TM engine, no price deviation detection |
| Customer Risk Rating Reclassification | No automatic risk recalculation on profile change |
| Transaction Monitoring / Velocity Rules | No TM engine route, no velocity/aggregation rules |
| High-Risk Jurisdiction Review | No automatic FATF list integration, no auto-EDD trigger |

### H6. Audit Log N+1 Query Pattern
**File:** `src/app/api/audit-log/route.ts:31-48`  
**Issue:** Two-step query: fetch logs, then fetch users separately. Should use Prisma `include: { user: ... }`.  
**Fix:** Replace with single query using `include`.

### H7. Sequential DB Queries in Investigation Context
**File:** `src/app/api/investigation/context/route.ts:111-197`  
**Issue:** 6-8 sequential DB queries where independent ones (claims, adverse media, goAML, sanctions) could be parallelized.  
**Fix:** Wrap independent queries in `Promise.all()`.

### H8. Loop-Based Inserts in Chat References
**File:** `src/app/api/chat/scenarios/route.ts:432-444`  
**Issue:** Creates up to 3 records in sequential individual queries.  
**Fix:** Use `db.scenarioChatReference.createMany({ data: [...] })`.

### H9. PDF Generator — No PII Masking Enforced
**File:** `src/lib/pdf-generator.ts`  
**Issue:** Accepts raw data and renders it directly into PDFs. Caller is responsible for pre-masking but this is not enforced.  
**Fix:** Apply masking inside the generator functions, not just at the caller.

### H10. CSV Export — Masking Optional, Not Enforced
**File:** `src/lib/csv-export.ts:7-12`  
**Issue:** `piiMaskMap` parameter is optional. `generateAuditPackCSV()` does NOT pass any masking.  
**Fix:** Make masking required or apply default masking.

### H11. `$queryRawUnsafe` with Interpolated Table Name
**File:** `src/lib/compliance/audit-middleware.ts:249`  
**Issue:** `$queryRawUnsafe` bypasses Prisma's SQL injection protections. `model` variable is interpolated into SQL string. Mitigated by `auditedModels` whitelist but still a risk vector.  
**Fix:** Use `$queryRaw` tagged template or Prisma's dynamic model access.

### H12. Missing `updatedAt` on CorporateKYC and IndividualKYC
**Files:** `prisma/schema.prisma:327-360`  
**Impact:** Updates to KYC records are not timestamped. All other models have `updatedAt`.  
**Fix:** Add `updatedAt DateTime @updatedAt` to both models.

---

## 4. MEDIUM/LOW ENHANCEMENTS (🟡)

### M1. searchVector Field Name Misleading
**File:** `prisma/schema.prisma:748`  
**Issue:** Named `searchVector` but stores plain text, not a vector embedding. Will cause confusion when migrating to PostgreSQL with pgvector.  
**Fix:** Rename to `searchText` or add a comment clarifying the field is text-based.

### M2. Schema Comment Outdated
**File:** `prisma/schema.prisma:733`  
**Issue:** Says "117+ Operational Scenarios" but actual count is 122.  
**Fix:** Update to "122 Operational Scenarios".

### M3. Seed Counter Inaccurate
**File:** `prisma/seed-scenarios.ts:86-88`  
**Issue:** `created` counter increments on every upsert regardless of create vs update. `updated` and `skipped` counters declared but never populated.  
**Fix:** Use Prisma upsert result to differentiate creates from updates.

### M4. chart.tsx Potential toLocaleString Crash
**File:** `src/components/ui/chart.tsx:237`  
**Issue:** `{item.value.toLocaleString()}` — no null guard on `item.value`. If chart data has undefined/null value, this will throw.  
**Fix:** Add null guard: `(item.value ?? 0).toLocaleString()`.

### M5. LiveReload console.log
**File:** `src/components/LiveReload.tsx:31`  
**Issue:** `[IC-OS LiveReload] Connected to HMR WebSocket` console.log in production code.  
**Fix:** Gate behind `process.env.NODE_ENV === 'development'`.

### M6. Excessive console.error in API Routes
**Impact:** 90+ `console.error`/`console.warn` statements. Some may log sensitive data (full error objects with request bodies).  
**Fix:** Replace with structured logging service for production. Sanitize error objects before logging.

### M7. Recharts Wildcard Import
**File:** `src/components/ui/chart.tsx:4`  
**Issue:** `import * as RechartsPrimitive from "recharts"` may defeat tree-shaking.  
**Fix:** Change to named imports for used components.

### M8. Missing React.memo on Large List Components
**Files:** AdminPanel.tsx, ClaimsPortals.tsx, AMLSanctionsTriage.tsx, MakerCheckerQueue.tsx, CorporateKYCWizard.tsx, GoAMLFilingCenter.tsx  
**Issue:** List items rendered via `.map()` in parent components without `React.memo` on individual items. Every parent re-render re-renders all list items.  
**Fix:** Extract row/item sub-components with `React.memo`.

### M9. Fallback OR Conditions TypeScript Concern
**File:** `src/app/api/chat/scenarios/route.ts:228`  
**Issue:** `as const` type assertion on Prisma `contains` filter may cause TypeScript issues with Prisma's generated types.  
**Fix:** Remove `as const` or use proper Prisma where input type.

### M10. No Virtualization on Large List Components
**Files:** ClaimsPortals, AdminPanel, AMLSanctionsTriage (vs. TrainingCertifications and AuditTrail which already use it)  
**Issue:** Without virtualization, rendering 100+ items causes DOM bloat.  
**Fix:** Apply `@tanstack/react-virtual` pattern from TrainingCertifications.tsx.

### M11. Unbounded findMany in Training Effectiveness
**File:** `src/app/api/training-effectiveness/route.ts:84`  
**Issue:** `db.trainingCourse.findMany()` with no `take` limit.  
**Fix:** Add `take` limit and pagination.

### M12. SDK Failures Deferred to Request Time
**Impact:** All 4 `z-ai-web-dev-sdk` integrations use dynamic import. SDK initialization failures surface at first API call, not at startup.  
**Fix:** Add a startup health check or at minimum log a warning if the SDK fails to initialize.

### M13. Include Over-Fetching in Quarterly Reporting
**File:** `src/app/api/quarterly-reporting/route.ts:44`, `src/app/api/cbuae-submission-checker/route.ts:38,43`  
**Issue:** `include: { records: true }` includes ALL records for a report without limit.  
**Fix:** Add `take` limit on included records or use `select` for field projection.

### M14. Missing Index on searchVector for FTS
**Impact:** SQLite FTS5 could significantly improve fallback text search. Current approach loads all 122 active records into memory — acceptable at this scale but not future-proof.  
**Fix:** Consider FTS5 index when scenario count exceeds ~500.

### M15. Invalid Date Parameter Handling in Sanctions GET
**File:** `src/app/api/sanctions/route.ts`  
**Issue:** No validation that `dateFrom`/`dateTo` parse to valid dates. `new Date('invalid')` produces `Invalid Date`.  
**Fix:** Add date validation with Zod `z.coerce.date()`.

---

## 5. ACTIONABLE FIX PLAN

### Batch 1 — Security Critical (Must fix before ANY deployment)
| # | Fix | Files | Effort |
|---|-----|-------|--------|
| 1 | Add `authGuard` to all 43 unprotected routes | 20+ route.ts files | 2-3 hours |
| 2 | Add Zod schemas to `/api/aml` and `/api/kyc` | `aml/route.ts`, `kyc/route.ts` | 1 hour |
| 3 | Fix KYC PUT mass assignment with field whitelist | `kyc/route.ts` | 30 min |
| 4 | Add AbortController timeout (30s) to all z-ai-web-dev-sdk calls | 4 route.ts files | 30 min |
| 5 | Fix dev-mode auth bypass — require explicit opt-in | `auth-guard.ts`, `middleware.ts` | 30 min |
| 6 | Apply rate limiting to AI and auth endpoints | 8+ route.ts files | 1 hour |

### Batch 2 — PII & Data Protection
| # | Fix | Files | Effort |
|---|-----|-------|--------|
| 7 | Apply server-side PII masking to all data-returning endpoints | 15+ route.ts files | 3-4 hours |
| 8 | Fix broken `maskGeneric`/`maskObject` imports in use-pii.ts | `use-pii.ts`, `pii.ts` | 15 min |
| 9 | Enforce PII masking in PDF generator and CSV export | `pdf-generator.ts`, `csv-export.ts` | 1 hour |
| 10 | Replace hard delete with soft delete on KYC | `kyc/route.ts`, schema.prisma | 1 hour |

### Batch 3 — RAG Pipeline & AI
| # | Fix | Files | Effort |
|---|-----|-------|--------|
| 11 | Fix RAG prompt role: `assistant` → `system` | `scenarios/route.ts`, `policy-rag/route.ts` | 5 min |
| 12 | Create feedback API endpoint and wire to UI | New route + `AIAssistantWidget.tsx` | 1 hour |
| 13 | Create chat analytics endpoint | New route | 1 hour |
| 14 | Fix SAR draft FDL reference (20/2018 → 10/2025) | `draft-sar/route.ts` | 5 min |
| 15 | Replace `.parse()` with `.safeParse()` on 4 routes | 3 route.ts files | 30 min |

### Batch 4 — Performance
| # | Fix | Files | Effort |
|---|-----|-------|--------|
| 16 | Fix full-table scan in investigation context | `investigation/context/route.ts` | 1 hour |
| 17 | Fix N+1 in UBO tracing (batch queries) | `ubo-tracing.ts` | 2 hours |
| 18 | Fix audit-log N+1 (use Prisma include) | `audit-log/route.ts` | 15 min |
| 19 | Parallelize independent queries in investigation context | `investigation/context/route.ts` | 30 min |
| 20 | Replace loop inserts with `createMany()` | `chat/scenarios/route.ts` | 10 min |
| 21 | Add `updatedAt` to CorporateKYC and IndividualKYC | `schema.prisma` | 5 min |

### Batch 5 — Regulatory Completeness (New Features)
| # | Fix | Files | Effort |
|---|-----|-------|--------|
| 22 | Create NPO Enhanced Screening module (seed + route) | New files | 3-4 hours |
| 23 | Create Correspondent Banking DD module | New files | 3-4 hours |
| 24 | Create De-Risking / Managed Exit workflow | New files | 2-3 hours |
| 25 | Create MLAT Request Management module | New files | 2-3 hours |
| 26 | Build Transaction Monitoring Engine (velocity, CTR, TBML) | New files | 6-8 hours |
| 27 | Build Sanctions Unfreeze API | New files | 2 hours |
| 28 | Build Automatic Risk Reclassification Engine | New files | 3-4 hours |

### Batch 6 — Polish & Hardening
| # | Fix | Files | Effort |
|---|-----|-------|--------|
| 29 | Add React.memo to large list item components | 6 component files | 2 hours |
| 30 | Fix recharts wildcard import | `chart.tsx` | 10 min |
| 31 | Gate LiveReload console.log behind dev mode | `LiveReload.tsx` | 5 min |
| 32 | Fix chart.tsx toLocaleString null guard | `chart.tsx` | 5 min |
| 33 | Update schema comment (117+ → 122) | `schema.prisma` | 2 min |
| 34 | Rename `searchVector` → `searchText` | `schema.prisma`, `seed-scenarios.ts`, route | 30 min |
| 35 | Fix seed counter accuracy | `seed-scenarios.ts` | 15 min |
| 36 | Replace `$queryRawUnsafe` with safe alternative | `audit-middleware.ts` | 30 min |
| 37 | Validate action enum in `/api/aml` POST | `aml/route.ts` | 15 min |
| 38 | Add date validation in sanctions GET | `sanctions/route.ts` | 15 min |

---

## APPENDIX A: Top 20 Scenario Cross-Reference Summary

| # | Scenario | Status | Seed | Route | Reg. Enforced |
|---|----------|--------|------|-------|---------------|
| 1 | Early Surrender / Cooling-Off | 🟢 IMPLEMENTED | ✅ | ✅ | ✅ |
| 2 | Takaful Hibah / Beneficial Ownership | 🟡 PARTIAL | ✅ | ⚠️ | ⚠️ |
| 3 | False Positive Bulk Adjudication | 🟢 IMPLEMENTED | ✅ | ✅ | ✅ |
| 4 | Overnight Sanctions Freeze/Unfreeze | 🟡 PARTIAL | ✅ | ⚠️ | ✅ |
| 5 | PEP Enhanced Due Diligence | 🟢 IMPLEMENTED | ✅ | ✅ | ✅ |
| 6 | STR Filing | 🟢 IMPLEMENTED | ✅ | ✅ | ✅ |
| 7 | Large Cash Transaction Reporting | 🟡 PARTIAL | ⚠️ | ⚠️ | ⚠️ |
| 8 | Cross-Border Wire Transfer Monitoring | 🟡 PARTIAL | ⚠️ | ❌ | ⚠️ |
| 9 | Trade-Based ML Detection | 🟡 PARTIAL | ✅ | ❌ | ⚠️ |
| 10 | NPO Enhanced Screening | 🔴 MISSING | ❌ | ❌ | ⚠️ |
| 11 | VASP Risk Assessment | 🟢 IMPLEMENTED | ✅ | ✅ | ✅ |
| 12 | Correspondent Banking DD | 🔴 MISSING | ⚠️ | ❌ | ⚠️ |
| 13 | Customer Risk Rating Reclassification | 🟡 PARTIAL | ⚠️ | ⚠️ | ⚠️ |
| 14 | De-Risking / Account Closure | 🔴 MISSING | ✅ | ❌ | ⚠️ |
| 15 | UBO Identification | 🟢 IMPLEMENTED | ✅ | ✅ | ✅ |
| 16 | Sanctions Screening Real-Time | 🟢 IMPLEMENTED | ✅ | ✅ | ✅ |
| 17 | Transaction Monitoring Velocity Rules | 🟡 PARTIAL | ⚠️ | ❌ | ⚠️ |
| 18 | High-Risk Jurisdiction Review | 🟡 PARTIAL | ✅ | ⚠️ | ⚠️ |
| 19 | MLAT Request | 🔴 MISSING | ❌ | ❌ | ⚠️ |
| 20 | Regulatory Examination Readiness | 🟢 IMPLEMENTED | ✅ | ✅ | ✅ |

**Counts:** 🟢 8 IMPLEMENTED | 🟡 8 PARTIAL | 🔴 4 MISSING

---

## APPENDIX B: API Route Auth/Zod/Catch Audit Table

| Route | try/catch | Zod | authGuard | Rate Limit |
|-------|-----------|-----|-----------|------------|
| `/api/aml` | ✅ | ❌ | ❌ | ❌ |
| `/api/kyc` | ✅ | ❌ | ❌ | ❌ |
| `/api/kyc/individual` | ✅ | ✅ | ✅ | ❌ |
| `/api/kyc/corporate` | ✅ | ✅ | ✅ | ❌ |
| `/api/sanctions` | ✅ | ✅ | ❌ | ❌ |
| `/api/sanctions-exceptions` | ✅ | ❌ | ❌ | ❌ |
| `/api/admin/sanctions-shock` | ✅ | ✅ | ✅ | ✅ |
| `/api/goaml` | ✅ | ✅ | ❌ | ❌ |
| `/api/goaml/submit` | ✅ | ✅ | ✅ | ❌ |
| `/api/goaml/approve` | ✅ | ✅ | ✅ | ❌ |
| `/api/claims` | ✅ | ✅ | ❌ | ❌ |
| `/api/claims/surrender` | ✅ | ✅ | ✅ | ❌ |
| `/api/adverse-media` | ✅ | ❌ | ❌ | ❌ |
| `/api/adverse-media/screen` | ✅ | ✅ | ✅ | ❌ |
| `/api/adverse-media/decide` | ✅ | ✅ | ✅ | ❌ |
| `/api/vasp-kyc` | ✅ | ✅ | ❌ | ❌ |
| `/api/cases` | ✅ | ❌ | ❌ | ❌ |
| `/api/policies` | ✅ | ❌ | ❌ | ❌ |
| `/api/audit-log` | ✅ | ❌ | ❌ | ❌ |
| `/api/dashboard` | ✅ | ❌ | ❌ | ❌ |
| `/api/chat/scenarios` | ✅ | ✅ | ❌ | ❌ |
| `/api/ai/enhanced` | ✅ | ✅ | ❌ | ❌ |
| `/api/ai/draft-sar` | ✅ | ✅ | ✅ | ❌ |
| `/api/ai/policy-rag` | ✅ | ✅ | ❌ | ❌ |
| `/api/investigation/context` | ✅ | ✅ | ✅ | ❌ |
| `/api/investigation/ai-summary` | ✅ | ✅ | ✅ | ❌ |
| `/api/alerts/bulk-adjudicate` | ✅ | ✅ | ✅ | ✅ |
| `/api/alerts/status` | ✅ | ✅ | ✅ | ❌ |
| `/api/risk-assessment` | ✅ | ✅ | ❌ | ❌ |
| `/api/compliance-cases` | ✅ | ❌ | ❌ | ❌ |
| `/api/compliance-alerts` | ✅ | ❌ | ❌ | ❌ |
| `/api/training` | ✅ | ❌ | ❌ | ❌ |
| `/api/training-effectiveness` | ✅ | ✅ | ❌ | ❌ |
| `/api/users` | ✅ | ❌ | ✅ | ❌ |
| `/api/users/me` | ✅ | ❌ | ✅ | ❌ |
| `/api/admin/ai-config` | ✅ | ✅ | ✅ | ❌ |
| `/api/audit/generate-data-room` | ✅ | ✅ | ✅ | ❌ |
| `/api/regulatory-intel/analyze` | ✅ | ✅ | ✅ | ❌ |
| `/api/regulatory-intel/approve` | ✅ | ✅ | ✅ | ❌ |
| `/api/cbuae-submission-checker` | ✅ | ✅ | ❌ | ❌ |
| `/api/analytics/aggregate` | ✅ | ❌ | ❌ | ❌ |
| `/api/analytics/fraud-ring` | ✅ | ✅ | ✅ | ❌ |
| `/api/maker-checker` | ✅ | ✅ | ❌ | ❌ |
| `/api/compliance-calendar` | ✅ | ❌ | ❌ | ❌ |
| `/api/quarterly-reporting` | ✅ | ✅ | ❌ | ❌ |
| `/api/remediations` | ✅ | ❌ | ❌ | ❌ |
| `/api/evidence` | ✅ | ❌ | ❌ | ❌ |
| `/api/health` | ✅ | ❌ | N/A | ❌ |

---

## APPENDIX C: Regulatory References — Mapped But Not Enforced

| Regulatory Reference | What It Requires | Code Status |
|---------------------|------------------|-------------|
| CR 134/2025 Art. 9 (Correspondent Banking) | EDD for correspondent banking, respondent assessment, senior mgmt approval | ❌ Not enforced |
| CR 134/2025 Art. 13 (High-Risk Jurisdictions) | EDD for FATF-identified jurisdictions | ⚠️ Partial — stored but not auto-triggered |
| FDL 10/2025 Art. 22 (International Cooperation) | MLAT request handling, cross-border info exchange | ❌ Not enforced |
| FATF Recommendation 8 (NPOs) | Enhanced screening for non-profit organizations | ❌ Not referenced or enforced |
| FATF Recommendation 16 (Wire Transfers) | Originator/beneficiary info, wire transfer monitoring | ❌ Not enforced |
| CBUAE Notice 3551/2021 S5.1 (CTR Threshold) | AED 55,000 CTR reporting threshold | ❌ Referenced but not enforced |
| FATF Guidance on De-risking | Managed exit, run-off-only mode, proportionate approach | ❌ Not enforced |
| FATF Guidance on TBML | Price deviation detection, commodity baseline comparison | ❌ Not enforced |

---

**END OF REPORT**

*This report is based on a thorough 5-phase audit of the IC-OS v7.2 codebase as of the `v7.2-pre-audit-restore` git tag. All findings reference actual code and should be verified before remediation. No code changes have been made — this is a read-only audit as instructed.*
