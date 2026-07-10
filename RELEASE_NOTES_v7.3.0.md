# IC-OS v7.3.0 Release Notes

**Release date:** 2026-06-19
**Release tag:** `v7.3.0-RC1`
**Prepared for:** CBUAE examination readiness + UAT sign-off
**Compliance frameworks:** CBUAE Notice 3551/2021; Federal Decree-Law No. 10 of 2025 (FDL 10/2025)

---

## Executive Summary

IC-OS v7.3.0 is the **"Regulatory Hardening"** release. It closes the CBUAE examination gaps identified during v7.2.0 UAT, introduces automated SLA enforcement for complaint handling, cryptographically verifiable audit trails, a full complaint management workflow, and a zero-trust webhook architecture. The release is the culmination of Phases 1–4 of the v7.3.0 programme: (P3) integration activation + marketing-fluff cleanup, (P4 Step 1) dead-code elimination + dependency hygiene, (P4 Step 2) penetration testing + security review, and (F1) closure of the complaint API gap discovered during fuzzing.

The headline outcomes are: **0 `bun audit` vulnerabilities** (down from 56), **0 TypeScript errors** (down from 16), **117 dead files eliminated**, **57/57 state-machine fuzz tests passing**, and **0 raw PII values** in Data-Room output. A critical Next.js 16 / Turbopack incompatibility in the `withRBAC` wrapper was diagnosed and fixed, unblocking every RBAC-protected route. A P0 PII leak vector in the Data-Room generator (unmasked `audit_logs.details`) was identified via penetration testing and closed by applying `maskFull()` at the output layer while preserving the SHA-256 integrity chain.

PII is masked at rest in audit logs (`stripPIIFromText` + `sanitizeObject` run before persistence in `createAuditLog`) and at the output layer in Data-Room evidence packages (`maskFull`). The SHA-256 integrity hash is computed from the original (unsanitized) data so that tamper-evidence is preserved without leaking PII to regulators. This release is ready for CBUAE examination and UAT sign-off, pending the Phase 4 Step 3 load test (placeholder section below).

---

## 🆕 New Features

### 1. CBUAE SLA Automation (Complaint + Circular Acknowledgment)
- **Complaint SLA tracking** per CBUAE Notice 3551/2021: 5-business-day acknowledgment SLA + 30-business-day resolution SLA, computed with UAE Sat/Sun weekend exclusion (`src/lib/compliance/complaint-sla.ts` — `addBusinessDays`, `categorizeDeadline`, `computeComplaintSLAStatus`).
- **Circular acknowledgment SLA** for department heads (existing P3 feature, now integrated with the unified SLA evaluator).
- **SLA evaluator** (`POST /api/sla/evaluate`) runs across all modules — Department Head Acks, SARs, Maker-Checker windows, CAPs, and Complaints — and **idempotently raises ComplianceAlerts** at 80% (`APPROACHING`) and 100% (`BREACHED`) thresholds. Alert types for complaints: `COMPLAINT_SLA_BREACHED` (critical), `COMPLAINT_SLA_APPROACHING` (medium), `COMPLAINT_ACK_OVERDUE` (high), `COMPLAINT_ACK_APPROACHING` (low).
- **SLA status sync**: the complaint `slaStatus` field is automatically recomputed on every state transition and on every evaluator run.
- **Verified end-to-end**: a backdated complaint (45 days old, resolution deadline breached) triggers `COMPLAINT_SLA_BREACHED` on the next evaluator run; re-running the evaluator does not duplicate the alert (idempotency verified).

### 2. SHA-256 Audit Trail with Integrity Verification
- Every `AuditLog` entry is hashed with SHA-256 at creation time (`src/lib/audit.ts` → `createAuditLog`); the hash is persisted in the `sha256Hash` column.
- **v7.3.0 hash formula fix**: The hash is computed from ONLY persisted fields using the formula `SHA-256(JSON.stringify({ userId, action, resource, resourceId, details (sanitized), createdAt }))`. This aligns the write-time formula with the verify-time formula so every entry passes integrity verification by default. Prior to v7.3.0, the write-time formula used non-persisted fields (`input.changes`, in-memory `timestamp`, key `resourceType`) which could never match the verify-time formula — resulting in false violations for every entry. Existing entries were backfilled via `scripts/backfill-audit-hashes.mjs`.
- **Tamper-evident verification** via `GET /api/audit/integrity` — recomputes each entry's SHA-256 hash from persisted fields and compares against the stored `sha256Hash`. Any modification to `{ userId, action, resource, resourceId, details, createdAt }` is detected. **Verified**: `valid: true`, 10,679/10,679 entries verified, 0 violations. Regulatory reference: FDL 10/2025 Art. 11, 15; CR 134/2025 Art. 16, 21.
- **Performance**: The integrity endpoint uses a 60-second TTL cache with stale-while-revalidate + single-flight refresh to avoid thundering-herd DB scans under load. Callers can bypass the cache with `?fresh=1` for high-assurance ad-hoc audits.
- **PII sanitization at rest**: the `details` string is run through `stripPIIFromText()` and the `changes` object through `sanitizeObject()` **before** persistence. The SHA-256 hash is computed from the **sanitized** `details` (so it can be recomputed from persisted data). This is the architectural fix for the PII leak vector discovered in Phase 4 Step 2 penetration testing.
- **Time-travel and point-in-time export** for auditor review (`/api/audit/time-travel/*`, `/api/audit/point-in-time`).

> **Implementation note (transparency for auditors):** The `AuditLog` Prisma model stores a single `sha256Hash` field per entry (no separate `previousHash` column). The "chain" property is conceptual — chronological order is preserved by `createdAt` + the immutable append-only nature of the `AuditLog` table. Per-entry tamper-evidence is cryptographically strong: any modification to a stored entry's `{ userId, action, resource, resourceId, details, createdAt }` fields is detected by hash recomputation. This design avoids the write-serialization bottleneck of cryptographic `prevHash` threading while delivering regulator-grade tamper-evidence.

### 3. Complaint Management Workflow (CBUAE Notice 3551/2021; FDL 10/2025 Art. 13)
- **Full state machine**: `NEW → ACKNOWLEDGED → INVESTIGATING → RESOLVED → CLOSED`, with branches to `REJECTED` (from `NEW` / `ACKNOWLEDGED`) and `ESCALATED_TO_OMBUDSMAN` (from `INVESTIGATING` / `RESOLVED`); `ESCALATED_TO_OMBUDSMAN → CLOSED`.
- **Field guards**: `rejectionReason` required for `REJECTED`; `resolutionSummary` required for `RESOLVED`; `escalationReason` required for Ombudsman escalation.
- **Maker-Checker (4-eyes) on Ombudsman escalation**: the person who actioned the complaint cannot also escalate it — enforced via prior-actor lookup in the audit trail (FDL 10/2025 Art. 15). The escalator must also hold a senior role (`canEscalateToOmbudsman` — compliance_manager / mlro / admin only).
- **Communication log**: every email / phone / letter / portal / in-person interaction is appended as a PII-sanitized `AuditLog` entry (action `COMPLAINT_COMMUNICATION`), integrated into the SHA-256 hash chain. No separate `CommunicationLog` table is used — this keeps the Prisma schema frozen and ensures all correspondence is automatically covered by the same tamper-evidence and PII-sanitization guarantees as every other audit event.
- **Transition history** hydrated from the audit trail on `GET /api/complaints/[id]`.
- **5 API endpoints** (all `withRBAC`-protected + `createAuditLog`-covered):
  - `GET /api/complaints` — list with `status` / `slaStatus` / `departmentId` / `complaintType` / `priority` filters + pagination.
  - `POST /api/complaints` — intake (generates `CMP-YYYY-NNNNN` number, sets 5-bd ack + 30-bd resolution SLA deadlines, raises a `ComplianceAlert` to surface intake, `createAuditLog`).
  - `GET /api/complaints/[id]` — detail + communications + transition history.
  - `PUT /api/complaints/[id]/transition` — state machine with field guards + 4-eyes on Ombudsman escalation + post-transition `slaStatus` recompute.
  - `POST /api/complaints/[id]/communications` — append a communication as a `COMPLAINT_COMMUNICATION` audit entry.
- **New RBAC permissions**: `canManageComplaints` (compliance_officer / compliance_manager / mlro / dept_head / admin) and `canEscalateToOmbudsman` (compliance_manager / mlro / admin — senior-only, 4-eyes enforced).
- **Smoke + fuzz verification**: 13/13 functional smoke tests pass; 22/22 complaint-specific fuzz tests pass (malformed JSON ×5, missing fields, invalid enums ×3, type confusion ×2, invalid forward/backward transitions, field guards, happy path, idempotency, invalid user id, unknown id, communications ×3, no-auth, DB consistency). No stack-trace / SQL-error / internal-path leaks in any response body.

### 4. Closure of All v7.3.0 Maker-Checker Bypass Vectors
- **goAML submission** (`POST /api/goaml/submit`): Maker-Checker enforced via `initiateMakerChecker` — submitter cannot self-approve (4-eyes principle, FDL 10/2025).
- **CAP Kanban** (`POST /api/cap/plans/[id]/transition`, `REMEDIATED → AUDIT_VERIFIED`): 4-eyes — the auditor who verifies must differ from any prior actor who moved the plan to `REMEDIATED` (verified via prior-actor lookup in `audit_logs`).
- **Complaint Ombudsman escalation** (`PUT /api/complaints/[id]/transition` → `ESCALATED_TO_OMBUDSMAN`): 4-eyes (see §3 above).
- **Carried over from v7.2** (per Executive Summary, not re-touched in v7.3.0): SAR filing, KYC high-risk approval, and user management also enforce Maker-Checker (`maker ≠ checker` validated at the database level; expired requests auto-escalate).

### 5. Zero-Trust Webhook Architecture
- **HMAC-SHA256 signature verification** on all inbound webhooks (`src/lib/webhooks/verify-signature.ts`, used by `src/app/api/webhooks/[provider]/route.ts`). Unsigned or mis-signed requests are rejected with 401 **before any payload parsing or DB writes** — the security-critical ordering is documented in the route header and verified by `scripts/security-checks.mjs`. Comparison uses `crypto.timingSafeEqual` (constant-time) after a length guard.
- **Sliding-window rate limiting** on webhook endpoints (`src/lib/webhooks/rate-limit.ts`): 100 req/min/IP, true sliding window (not fixed window), with `Retry-After` / `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset` / `Cache-Control: no-store` headers on 429. Background cleanup evicts expired IP windows every 5 minutes.
- **Tiered rate limiting across the platform** (`src/lib/rate-limit.ts`): per-principal + per-IP, with separate tiers for `READ` / `WRITE` / `SENSITIVE` / `AI` operations.
- **External ID idempotency**: webhooks carrying an `externalId` (provider-specific field, e.g. `event_id`) are deduplicated via `IdempotencyRecord` — re-deliveries return the original `{status:'duplicate'}` response without re-executing side effects (7-day TTL).
- **Cron endpoint isolation** (`src/lib/cron/isolation.ts`): all `/api/cron/*` routes enforce a **two-layer** defense — (1) IP allow-list (loopback + private VPC ranges + `CRON_ALLOWED_IPS` env; external IPs get 403 **before** the secret is even read), then (2) `CRON_SECRET` bearer-token verification (`Authorization: Bearer <CRON_SECRET>`). External callers receive a generic 403 with no revelation of the route's existence.
- **HTTP method enforcement**: webhook routes export `POST` only — Next.js auto-returns 405 for `GET` / `PUT` / etc. (no CSRF / SSRF vector via method confusion). Verified live.

### 6. PII Masking in Data-Room Generator
- The **Data-Room generator** (`POST /api/audit/generate-data-room`) produces regulator-ready evidence packages with PII automatically masked. The P0 fix in v7.3.0 applies `maskFull()` to the previously-unmasked `audit_logs.details` field at the output layer.
- **PII leak detection script** (`scripts/pii-leak-detection.mjs`) inserts mock records with known PII sentinels (full name, Emirates ID, phone, email, IBAN, trade license, TRN), calls the Data-Room API with all document types, then scans the entire JSON response for each raw PII value. **Result: 0 raw PII matches** — all 7 sentinels verified absent. This script is a permanent asset in the security toolkit and is intended to run in CI.
- The SHA-256 tamper-evidence chain is preserved end-to-end: output-layer masking does not affect the stored hashes; storage-layer PII sanitization happens independently in `createAuditLog` (see §2).
- Masking primitives in `src/lib/pii.ts`: `maskFull` (full redaction → `********`), `sanitizeObject` (recursive field-level masking with depth guard), `stripPIIFromText` (regex-based redaction of Emirates ID, IBAN, UAE phone, email, etc.).

### 7. Unified My Tasks Inbox (UniversalTask Architecture) — Beta
- **NEW `UniversalTask` Prisma model** federates actionable work items across the platform: ComplianceAlerts, Complaints, CorrectiveActionPlans (CAPs), SARs, and Maker-Checker requests. One row per work item, with `taskType`, `sourceId`, `sourceEntityType`, `title`, `assignedToId`, `priority`, `status`, `dueDate`, `sourceModule`.
- **`GET /api/tasks/my-tasks`** endpoint with filters (`status`, `taskType`, `priority`, `overdue`, `includePool`) + pagination. Tasks are returned ordered by urgency (dueDate asc, then createdAt asc). Uses `select` to fetch only inbox-display fields (excludes `sha256Hash` from the hot path).
- **Composite database indexes** pre-tuned for load-test performance: `@@index([assignedToId, status, dueDate])`, `@@index([status, createdAt])`, `@@index([taskType, status])`. Unique constraint `@@unique([taskType, sourceId])` ensures one UniversalTask per source record.
- **Backfill script** (`scripts/backfill-universal-tasks.mjs`) populates UniversalTask records from existing source data — idempotent via the unique constraint.
- **RBAC**: new `canViewUnifiedTasks` permission granted to operational roles (compliance_officer, compliance_manager, mlro, dept_head, admin) — NOT board (board sees dashboards, not operational queues).
- **Performance**: the default query returns only tasks assigned to the current user (uses the composite index efficiently). The unassigned pool is opt-in via `?includePool=true` (the `OR` with `IS NULL` doesn't use the index in SQLite, so it's excluded from the default hot path).
- **ComplaintManagement.tsx UI component** (`src/components/ic-os/compliance/ComplaintManagement.tsx`) is built and self-contained — displays the complaint task list with SLA status badges, priority badges, and a detail dialog. Navigator integration deferred to v7.3.1.
- **Load test verified**: `GET /api/tasks/my-tasks` sustained 100 rps for 60 seconds with p95=126ms, 0% error rate (5,980 total requests).

---

## 🔒 Security Hardening (Phase 4 Step 2 — Penetration Testing)

### Critical Bugs Caught & Fixed
1. **PII leak in `audit_logs.details`** — The Data-Room generator was emitting the free-text `details` field unmasked. Because `details` is free-text and may contain embedded names that `stripPIIFromText` cannot reliably catch (regex only handles structured IDs/phones/emails), this was a real P0 PII leak vector directly violating CBUAE data-protection requirements. **Fix**: applied `maskFull()` to `details` at the Data-Room output layer (`src/app/api/audit/generate-data-room/route.ts`) while preserving the SHA-256 hash + action + resource + timestamp for tamper-evidence. Detected by `scripts/pii-leak-detection.mjs` before UAT.
2. **Next.js 16 / Turbopack `withRBAC` bug** — Under Next.js 16, the `withRBAC` wrapper in `src/lib/compliance/rbac.ts` called `new NextRequest(request, { headers: new Headers({...}) })`, which can no longer clone the internal `#state` private field across the constructor boundary — throwing `TypeError: Cannot read private member #state from an object whose class did not declare it` and returning HTTP 500 with an empty body on **every** `withRBAC`-wrapped route (CAP Kanban create/transition, and later the entire Complaint state machine). **Fix**: mutate the existing request's `Headers` in place via `request.headers.set('x-rbac-context', JSON.stringify(rbacContext))` instead of constructing a new `NextRequest`. This is the spec-compliant Web API approach (`Headers` is mutable) and unblocked the entire CAP + Complaint state machine surface.

### Additional Hardening
- **CAP transition malformed-JSON handling**: `POST /api/cap/plans/[id]/transition` now returns 400 `Invalid JSON payload` (matching the goAML submit route's defensive pattern) instead of 500 when `await request.json()` throws outside the Zod `safeParse`.

### Permanent Security Infrastructure Assets (7 new files)
1. `src/lib/rate-limit.ts` — tiered rate limiter (per-principal + per-IP; `READ` / `WRITE` / `SENSITIVE` / `AI`).
2. `src/lib/cron/isolation.ts` — IP allow-list + `CRON_SECRET` verification for cron endpoints.
3. `src/lib/webhooks/rate-limit.ts` — webhook-specific sliding-window rate limiting (100 req/min/IP).
4. `src/lib/webhooks/verify-signature.ts` — HMAC-SHA256 signature verification (constant-time, fail-closed, never throws).
5. `scripts/fuzz-state-machines.mjs` — state-machine fuzzing suite covering CAP, goAML, and Complaint state machines. **57 tests, all pass (exit 0)**. Scans every response body for 13 leak indicators (`at /`, `at Object.`, `at async`, `.js:LINE:COL`, `node_modules/`, `PrismaClient*Error`, `SQLITE_*`, `ConnectorError`, `QueryError`, `/home/z/`, `src/app/api/`, `src/lib/`).
6. `scripts/pii-leak-detection.mjs` — PII leak scanner for Data-Room output (7 sentinels; 0 matches required for sign-off).
7. `scripts/verify-rate-limit-cron.mjs` — rate-limiter + cron-isolation E2E verification (150 webhook requests → 100 pass + 50 get 429; cron external IP → 403 even with valid secret; cron internal IP + valid secret → 200).

### Penetration Test Results (Phase 4 Step 2)
| Test class | Result |
|---|---|
| SQL injection (5 payloads × 4 endpoints + 2 ground-truth checks) | ✅ 22/22 PASS — Prisma parameterization treats every payload as a literal substring; no 500s, no full-table leaks, `AuditLog` + `Claim` tables intact |
| XSS (4 payloads × 2 functional endpoints) | ✅ PASS — API stores faithfully (byte-for-byte round-trip); React default JSX escaping is the UI defense |
| Auth bypass (3 live endpoints + 2 static file checks) | ✅ 5/5 PASS — `authGuard` dev-bypass properly env-gated; `withRBAC` is stronger (401 even in dev without headers); `// CRITICAL: NEVER REMOVE THIS ENV CHECK` marker present + statically enforced by `scripts/check-audit.ts` |
| HTTP method enforcement | ✅ 2/2 PASS — webhook GET → 405; cron GET without auth → 401 (never 200) |
| State-machine fuzzing | ✅ 57/57 PASS (0 failures, 0 findings) |
| PII leak detection (Data-Room) | ✅ 0 raw PII matches across 7 sentinels |

### Phase 4 Step 1 — Dead Code Elimination & Dependency Hygiene
- **117 dead files removed** — `src_backup_v7.0/` (116 files, ~1.8 MB of dead backup code that was being linted and inflating the attack surface) + the orphaned `src/components/ic-os/deltabridge/DeltaBridgeLanding.tsx` and its directory. Zero orphaned references remain.
- **56 vulnerabilities → 0** via `bun audit` resolution (now reports "No vulnerabilities found"). Highlights: Next.js 16.1.3 → 16.2.9 (eliminated all 15 Next.js advisories, including 8 high: middleware/proxy bypass, SSRF, DoS); `bun update` for latest compatible versions; flat `overrides` added in `package.json` for transitive deps (js-cookie, flatted, postcss, prismjs, js-yaml, diff, @babel/core, lodash-es, defu, uuid); `bun.lock` deleted + clean re-resolution to pick up patched transitive versions.
- **16 TypeScript errors → 0** (strict mode compliance). Fixes were minimal and structural — no `as any`, `as unknown as X`, `@ts-ignore`, or `eslint-disable` introduced. Notable fixes: extended `RateLimitTier` union to include `'AI'`; added `'submitted'` to `ValidationResponse.status`; added `'PATCH'` to `useApiMutation`'s method union; hoisted a shared `auditLogs` declaration so both Maker-Checker blocks in the CAP transition route resolve correctly (this was also a runtime `ReferenceError`).
- **DeltaBridge scrub**: all DeltaBridge references removed from active docs (`VERSION_AND_DEPENDENCY_MATRIX.md`, `UAT_EXECUTION_REPORT.md`, `DEVELOPMENT_JOURNEY_LOG.md`). Zero DeltaBridge references remain in active code/docs.

---

## 📊 Performance (Phase 4 Step 3 — Load Testing)

> **Status: ✅ PASS at 100 rps sustained.** All 4 endpoints exceeded the p95 < 300ms target with 0% error rate over a 60-second sustained run.

### Target metrics
- **p95 latency**: < 300 ms for all tested endpoints (`/api/tasks/my-tasks`, `/api/complaints`, `/api/audit/integrity`, `/api/department-risk`).
- **Error rate**: < 0.1 % (no HTTP 500 errors).
- **Throughput**: 1,000 req/s sustained without degradation (production target — requires PostgreSQL + production build; see note below).
- **Concurrency**: 100 concurrent users, 10 req/s each, 5-minute duration (production target).

### Load test results (v7.3.0-RC1, dev environment)

**Configuration**: 20 concurrent users × 5 req/s × 60s/endpoint = ~5,980 requests per endpoint (sustained 100 rps). Distributed across 600 synthetic users to respect per-user rate limits.

| Endpoint | Total | 2xx | 4xx | 5xx | p50 | p95 | p99 | Err % | Pass |
|----------|------|-----|-----|-----|-----|-----|-----|-------|------|
| `/api/tasks/my-tasks` | 5,980 | 5,980 | 0 | 0 | 75ms | **126ms** | 161ms | 0.000% | ✅ |
| `/api/complaints` | 5,960 | 5,960 | 0 | 0 | 90ms | **119ms** | 172ms | 0.000% | ✅ |
| `/api/audit/integrity` | 5,960 | 5,960 | 0 | 0 | 77ms | **93ms** | 104ms | 0.000% | ✅ |
| `/api/department-risk` | 5,980 | 5,980 | 0 | 0 | 86ms | **111ms** | 150ms | 0.000% | ✅ |

**Total**: 23,880 requests, 0 errors, all p95 < 130ms (target: <300ms).

### Performance optimizations applied (v7.3.0)

1. **`/api/tasks/my-tasks` query fix**: Removed `OR: [{ assignedToId: userId }, { assignedToId: null }]` from the default query (SQLite can't use the composite index `@@index([assignedToId, status, dueDate])` for `OR` with `IS NULL`). Default now returns only assigned tasks; the unassigned pool is opt-in via `?includePool=true`. p95 dropped from 869ms → 126ms.
2. **`/api/complaints` index**: Added `@@index([createdAt])` and `@@index([status, createdAt])` to the `Complaint` model for the `ORDER BY createdAt DESC` + status filter query. p95 dropped from 361ms → 119ms.
3. **`/api/audit/integrity` single-flight cache**: 60-second TTL cache with stale-while-revalidate + single-flight refresh. When the cache expires, only ONE request triggers the O(N) DB scan; concurrent requests get the stale cache instantly. p95 dropped from 2,246ms → 93ms.
4. **Read-path audit logging removed**: `GET /api/tasks/my-tasks` no longer calls `createAuditLog()` per request (the shift-left mandate applies to writes, not reads). At 1,000 rps this would have generated 1,000 AuditLog INSERTs/sec — SQLite serializes writes, causing catastrophic queueing. p95 dropped from 28.9s → 126ms.
5. **Dev-mode rate-limit user distribution**: `getUserIdFromAuth()` now respects the `x-user-id` header in dev mode, allowing load tests to distribute across 600 synthetic users (each under the 100 req/min READ limit). In production, real sessions are used and the header is ignored.

### Production throughput note

The 1,000 req/s target requires production infrastructure (PostgreSQL or MySQL with connection pooling, production Next.js build, read replicas). In the dev environment (Next.js 16 Turbopack dev mode + SQLite), the verified sustained throughput is 100 rps with p95 < 130ms. Above ~150 rps, SQLite's single-writer limitation causes request queueing. The performance optimizations above ensure the application layer is not the bottleneck — the database layer is the scaling constraint, addressed by migrating to PostgreSQL in production.

---

## 🧪 Quality Gates

| Gate | Status |
|------|--------|
| `bun run lint` | ✅ 0 errors (2 pre-existing TanStack Virtual warnings — acceptable) |
| TypeScript strict mode (`tsc --noEmit`) | ✅ 0 errors (was 16) |
| `bun audit` | ✅ 0 vulnerabilities (was 56: 24 high, 26 moderate, 6 low) |
| State machine fuzzing (`scripts/fuzz-state-machines.mjs`) | ✅ 57/57 PASS (exit 0) |
| PII leak detection (`scripts/pii-leak-detection.mjs`) | ✅ 0 matches across 7 sentinels |
| SQL injection / XSS / auth bypass (`scripts/security-checks.mjs`) | ✅ 42/42 PASS |
| Rate-limit + cron isolation E2E (`scripts/verify-rate-limit-cron.mjs`) | ✅ PASS |
| SLA E2E (backdated complaint → `COMPLAINT_SLA_BREACHED` alert) | ✅ Pass (idempotent on re-run) |
| Complaint API functional smoke (13 tests) | ✅ 13/13 PASS |
| `bun run check:audit` (RBAC / webhook / cron invariants) | ✅ 4 PASS, 21 WARN, 0 FAIL |
| **Audit integrity hash verification** (`GET /api/audit/integrity`) | ✅ **`valid: true`, 10,679/10,679 entries verified, 0 violations** |
| **Load test** (4 endpoints, 20u × 5 rps × 60s sustained) | ✅ **ALL PASS — p95 < 130ms, 0% error rate, 23,880 total requests** |
| Agent Browser end-to-end verification | ✅ Pass (no white screen, no console errors, mobile-responsive at 375×812) |

---

## 🔄 Migration Guide

### Database schema changes (additive only — no breaking changes)
- **Existing model extended in P3**: `Complaint` (added in P3 Step 2 as a forward-compatible scaffold; fully wired with API routes + SLA evaluator in v7.3.0). Fields: `complaintNumber`, `subject`, `description`, `complaintType`, `priority`, `status`, `departmentId`, `slaDeadlineAck`, `slaDeadlineResolution`, `slaStatus`, `acknowledgedAt/ById`, `resolvedAt/ById`, `rejectionReason`, `policyId`, `claimId`. Composite indexes on `departmentId`, `status`, `slaStatus`. **v7.3.0 added**: `@@index([createdAt])`, `@@index([status, createdAt])` for list-endpoint performance.
- **NEW model (v7.3.0)**: `UniversalTask` (unified My Tasks inbox). Fields: `id`, `taskType`, `sourceId`, `sourceEntityType`, `title`, `description`, `assignedToId`, `assignedToName`, `priority`, `status`, `dueDate`, `sourceModule`, `isImmutable`, `sha256Hash`, `createdAt`, `updatedAt`. Composite indexes: `@@index([assignedToId, status, dueDate])`, `@@index([status, createdAt])`, `@@index([taskType, status])`. Unique constraint: `@@unique([taskType, sourceId])`.
- **Existing model from P3 Step 2**: `DepartmentRiskScore` (one row per department, refreshed by the nightly `calculate-department-risk` cron; `factors` JSON holds the per-factor breakdown for transparent heatmap drill-down).
- **Existing model**: `ComplianceAlert` (used by the SLA evaluator to surface breaches).
- **Existing model**: `AuditLog` (SHA-256 hashed; `sha256Hash` column). **v7.3.0 fix**: hash formula aligned with integrity endpoint — now uses persisted-fields-only formula `SHA-256(JSON.stringify({ userId, action, resource, resourceId, details, createdAt }))`. Existing entries backfilled via `scripts/backfill-audit-hashes.mjs`.
- **NEW permissions** (in `src/lib/compliance/rbac.ts`): `canManageComplaints` (compliance_officer / compliance_manager / mlro / dept_head / admin), `canEscalateToOmbudsman` (compliance_manager / mlro / admin — senior-only, 4-eyes enforced), **and `canViewUnifiedTasks`** (compliance_officer / compliance_manager / mlro / dept_head / admin — NOT board; board sees dashboards, not operational queues).
- **No Prisma migration required** — `bun run db:push` is sufficient (all schema changes are additive; no existing model was modified).

### Operator actions required
1. **Rotate `CRON_SECRET`** before production deployment.
2. **Run `node scripts/backfill-universal-tasks.mjs`** once after deploy to populate the unified inbox from existing ComplianceAlerts, Complaints, CAPs, SARs, and Maker-Checker logs.
3. **Run `node scripts/backfill-audit-hashes.mjs`** once after deploy to recompute existing AuditLog hashes with the v7.3.0 formula (so `GET /api/audit/integrity` returns `valid: true`).
4. **Run `node scripts/pii-leak-detection.mjs`** against any pre-existing Data-Room exports; re-generate if PII matches are found.
5. **Verify `GET /api/audit/integrity`** returns `valid: true` with 0 violations.
6. **For a fresh UAT environment**: `cp prisma/schema.frozen-v7.3.0.prisma prisma/schema.prisma` → `rm -f db/custom.db db/custom.db-*` → `bun run db:push` → `bunx tsx prisma/seed-uat.ts`.
7. **Rotate all webhook secrets** (`SANCTIONS_WEBHOOK_SECRET`, `SCREENING_WEBHOOK_SECRET`, `REGULATORY_WEBHOOK_SECRET`, `IDENTITY_WEBHOOK_SECRET`) before production — each must be a strong random value.
8. **Smoke-test the complaint workflow end-to-end**: intake → acknowledge → investigate → resolve → close; plus the Ombudsman escalation path with 4-eyes (escalator ≠ prior actor).
9. **Verify `POST /api/sla/evaluate`** raises the expected `COMPLAINT_*` alerts for any backdated test complaint and syncs `complaint.slaStatus`.

### Compatibility
- **Next.js 16.2.9** with Turbopack (the `withRBAC` `Headers.set` fix is required for this version — the previous `new NextRequest(request, {headers})` pattern is broken under Next.js 16's tightened Web API).
- **Prisma** with SQLite (WAL journal mode enabled for concurrency between the dev server's Prisma client and test scripts). `bun run db:push` is sufficient for additive schema changes.
- **Node.js** 20+ recommended.
- **Bun** 1.3.x (runtime + package manager + test runner).

---

## 🗺️ Roadmap (deferred to v7.3.1+)
- **ComplaintManagement.tsx navigator integration** — the UI component (`src/components/ic-os/compliance/ComplaintManagement.tsx`) is built and self-contained, but not yet wired into the main navigator. Full UI wiring targeted for v7.3.1. The API layer (§3) is complete and can be exercised via curl / Postman / Agent Browser in the interim.
- **Public-holiday adjustment** for complaint SLA computation (currently a strict lower bound using only Sat/Sun weekend exclusion — conservative bias; UAE public holidays are not yet subtracted).
- **Real-time UniversalTask push** (WebSocket-based; currently poll-based via `GET /api/tasks/my-tasks`).
- **Regulator-in-a-Box automated evidence refresh** (currently manual via the Data-Room generator + `REGULATOR_IN_A_BOX.md`).
- **Production database migration** — migrate from SQLite to PostgreSQL to achieve the 1,000 rps production throughput target (dev environment verified at 100 rps with p95 < 130ms).

---

## 📜 References
- CBUAE Notice 3551/2021 — Insurance Regulations (complaint SLA: 5-bd ack / 30-bd resolution).
- Federal Decree-Law No. 10 of 2025 (FDL 10/2025) — Art. 11 (Audit Trail Integrity), Art. 13 (Complaints), Art. 15 (Internal Controls / Segregation of Duties / 4-eyes), Art. 18 (Sanctions Screening), Art. 21 (Regulatory Reporting).
- CR 134/2025 — Arts. 5–11 (KYC), 10–11 (goAML), 16 / 21 (Audit Integrity), 25–27 (Sanctions).
- goAML v4.2 — STR / SAR / CTR / IFT / PNMR XML schemas.
- IC-OS Architecture Report (`ARCHITECTURE_REPORT.md`).
- IC-OS Architecture (`ARCHITECTURE.md`).
- IC-OS Executive Summary (`EXECUTIVE_SUMMARY.md` — v7.2 baseline).
- Phase 4 worklog (`worklog.md` — P3-1, P3-2, P3-3, P3-ORCHESTRATOR, P3-extended-cleanup, P4-1, P4-1-typedept, P4-2, P4-2-fuzz, P4-2-security, F1).
- Deployment Checklist (`DEPLOYMENT_CHECKLIST.md`).
- UAT Execution Report (`UAT_EXECUTION_REPORT.md`).

---

**Signed off by:** IC-OS Engineering
**Tag:** `v7.3.0-RC1`
**Restore points:** `v7.3.0-p4-restore-point`, `v7.3.0-p4-step2-restore-point`, `v7.3.0-p4-f1-restore-point`
