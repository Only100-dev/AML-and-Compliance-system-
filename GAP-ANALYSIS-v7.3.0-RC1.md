# IC-OS Comprehensive Gap Analysis
### Baseline for CBUAE / UAE FIU / FDL 10/2025 Alignment Upgrade

| Field | Value |
|---|---|
| **Document** | Comprehensive Gap Analysis — Pre-Upgrade Baseline |
| **System** | IC-OS (Insurance Compliance Operating System) |
| **Baseline version** | v7.3.0-RC1-uat-hotfix-5 (commit `6f8c12a`) |
| **Restore point** | `v7.2.0-pre-gap-analysis` (tag created before this analysis) |
| **Target framework** | UAE CBUAE Notice 3551/2021 · UAE FIU goAML · Federal Decree-Law (FDL) 10/2025 · UAE PDPL |
| **Analysis date** | 2026-06-22 (Asia/Dubai) |
| **Method** | Static analysis of live source tree (zero code changes — code freeze preserved) |

> **Scope note.** This analysis reflects the *actual* current state of the working tree at commit `6f8c12a` (v7.3.0-RC1-uat-hotfix-5). All ratings are evidence-based against the code, schema, and API routes present on disk. Gaps are flagged against the target regulatory framework so the Systems Architect can sequence the Phased Development Plan.

---

## 1. Architecture & Tech Stack

### 1.1 Current Stack (verified from `package.json` + source)

| Layer | Technology | Version | Notes |
|---|---|---|---|
| **Frontend framework** | Next.js (App Router, Turbopack) | 16.2.9 | React 19.2 server components + client islands |
| **UI language** | TypeScript | 5.9.3 | Strict typing throughout |
| **Styling** | Tailwind CSS | 4.3.1 | shadcn/ui (New York) — 43 components |
| **Charts** | Recharts | 2.15.4 | KRI gauges, risk matrix, trend lines |
| **Animation** | Framer Motion | 12.40 | Transitions / micro-interactions |
| **Backend runtime** | Next.js API Routes (Node) | — | Runs on Bun + Node v24.16 |
| **ORM** | Prisma | 6.19.3 | SQLite provider |
| **Database** | **SQLite** (file: `db/custom.db`) | — | ⚠️ See §6 — not production-grade for regulated workloads |
| **Auth** | NextAuth.js (Auth.js) | v4.24.14 | Credentials provider; JWT sessions |
| **Validation** | Zod | 4.4.3 | Route input validation on critical endpoints |
| **Client state** | Zustand | 5.0.14 | Persisted (theme only) |
| **Server state** | Custom `useApiFetch` hooks | — | TanStack-style caching in `src/lib/api-hooks.ts` |
| **Toasts** | Sonner | 2.0.7 | — |
| **Icons** | Lucide React | — | — |

### 1.2 Hosting & Deployment

- **Containerization:** ✅ Present — `Dockerfile` + `docker-compose.yml` at repo root.
- **CI/CD:** ✅ Present — `.github/workflows/deploy.yml`.
- **Build output:** Standalone Next.js (`next build` → `.next/standalone/server.js`, started via `bun .next/standalone/server.js`).
- **Cloud target:** **Not pinned to a specific cloud** (no AWS/Azure/GCP-specific IaC). The Docker setup is cloud-agnostic and on-prem-ready.
- **UAE data residency:** Stated as a design goal (PDPL); not yet enforced by infrastructure config — deployment destination must be a UAE-region host.

### 1.3 Codebase Scale (verified)

| Metric | Count |
|---|---|
| Prisma data models | **68** |
| API endpoints (`route.ts`) | **108** mutating + read routes |
| `withRBAC`-guarded routes | 27 |
| `createAuditLog` call sites | 63 |
| RBAC permissions (`Permission` union) | 61 |
| Compliance roles | 7 |
| `TODO`/`FIXME`/`HACK` markers | 33 |
| Mock/simulated/placeholder references | 170 |
| `bun run lint` | **0 errors, 0 FAILs**, 21 WARNs |
| Audit-guard check | PASS — 87/108 mutating routes audit-logged |

---

## 2. Identity, Access Management (IAM) & Security

### 2.1 User Roles — Definition & Storage

- **7-role matrix** defined in `src/lib/compliance/rbac.ts` as a TypeScript union `ComplianceRole`:

  | Role | Level | Function |
  |---|---|---|
  | `admin` | 100 | System configuration, user management |
  | `mlro` | 90 | SAR/STR approval, goAML filing, regulatory liaison |
  | `compliance_manager` | 70 | Policy management, training, audit coordination |
  | `compliance_officer` | 60 | Day-to-day operations, screening |
  | `auditor` | 50 | Read-only audit/assurance |
  | `dept_head` | 40 | Department compliance oversight |
  | `board` | 30 | Strategic oversight, aggregated dashboards |

- **Storage gap ⚠️:** `User.role` is a **plain `String`** in the Prisma schema (default `'compliance_officer'`), *not* a DB-level enum. The role constraint is enforced only at the application layer (`COMPLIANCE_ROLES` check). A rogue write or direct DB access could insert an arbitrary role string. **Recommend migrating to a Prisma `enum` for DB-level integrity.**

- **User model (current, 16 fields):** `id, email, name, role, jurisdiction, avatar, isActive, dmlroDelegatedToId/Name, dmlroDelegationActive/Expiry/Reason, createdAt, updatedAt`. ⚠️ Missing fields needed for CBUAE-grade user lifecycle: `status` (ACTIVE/SUSPENDED/DEACTIVATED/ARCHIVED), `failedLoginAttempts`, `lockedUntil`, `mfaEnabled`, `lastLoginAt`, `lastActiveDevice`, `passwordChangedAt`.

### 2.2 RBAC — Strict or Hardcoded?

- **Strict RBAC: ✅ YES — permission-matrix driven, not hardcoded.**
  - `Permission` union: **61 distinct permissions** (e.g. `canFileSAR`, `canApproveKYC`, `canSubmitGoAML`, `canManageUsers`, `canOverrideSanctions`).
  - `ROLE_PERMISSIONS` map binds each role → permission set.
  - `withRBAC(handler, requiredPermission)` HOF guards **27 API routes**.
  - `authGuard({ allowedRoles })` guards additional routes.
  - `checkPermission(role, permission)` / `requirePermission()` for inline checks.
- This is a strength. The RBAC engine is production-grade and already supports the 7-role target hierarchy.

### 2.3 Authentication

- **Framework:** NextAuth.js v4, **CredentialsProvider** (email + password).
- **Password verification ⚠️ CRITICAL GAP:** The `authorize()` function uses **hardcoded demo passwords** (`admin123`, `mlro123`, `cm123`, `co123`, `dh123`, `board123`) and explicitly comments *"For v7.1 demo, accept any password for existing users."* There is **no bcrypt/argon2 hashing** in the actual auth path (despite help docs claiming bcrypt cost 12). This is a **P0 blocker for any production/UAT with real users**.
- **Dev bypass:** `authGuard` grants a synthetic `admin` session when `NODE_ENV === 'development'`. This is env-gated and CI-enforced (`check:audit` script fails the build if the guard is removed) — correctly implemented.
- **Rate limiting:** ✅ Present (`src/lib/rate-limit.ts`) — auth endpoints limited to 5 attempts / 15 min.

### 2.4 Multi-Factor Authentication (MFA)

- **Status: ❌ NOT IMPLEMENTED.**
- MFA is *mentioned* in help documentation (`help-data.ts`: "MFA Support: Available for MLRO and Admin roles") but there is **no TOTP / OTP / WebAuthn / SMS-OTP code** anywhere in `src/lib` or `src/app/api`.
- **FDL 10/2025 / CBUAE gap:** Mandatory MFA for privileged roles (admin/MLRO) is a hard regulatory expectation. Must be built.

### 2.5 Session Management & Idle Timeout

- **NextAuth session:** JWT-based, `maxAge: 8 * 60 * 60` (8 hours absolute).
- **15-minute idle timeout: ❌ NOT ENFORCED.** No idle-timeout middleware, no activity-tracking sliding session. Help docs mention "30-minute idle timeout" but this is **documented, not implemented**.
- **CBUAE gap ⚠️:** CBUAE cybersecurity requirements mandate a 15-minute idle timeout for financial-sector systems. This is a **P0 compliance gap**.
- **Failed-login lockout:** Partial — rate-limit (5/15min) provides brute-force protection, but there is no persistent account-lockout state (no `lockedUntil` field on User).

---

## 3. Audit Trail & Immutability

### 3.1 How Are Actions Logged?

- **`createAuditLog()`** (`src/lib/audit.ts`) writes to the `AuditLog` model on every mutating operation.
- **AuditLog schema:** `id, userId, action, resource, resourceId, details, aiConfidence, sha256Hash, ipAddress, createdAt`.
- **Coverage:** 87 / 108 mutating routes emit audit logs (21 routes WARN — mostly read-side or notification routes with no real state mutation).
- **SHA-256 hashing:** Each log entry computes `sha256Hash` over `(userId, action, resource, resourceId, createdAt)` → tamper-evident chain. `verifyAuditIntegrity()` recomputes and compares. ✅
- **14 models** carry a `sha256Hash` field for row-level immutability signaling (SARCase, EarlySurrenderRecord, PremiumFinancingRecord, BrokerKYC, SoWSoFRecord, etc.).

### 3.2 WORM (Write-Once-Read-Many) Enforcement

- **✅ Enforced at the application layer:**
  - `src/app/api/audit/worm-guard.ts` — `checkWORMCompliance(operation)` blocks `update` / `delete` on `AuditLog`. Cites FDL 10/2025 Art. 11 + CBUAE Notice 3551/2021 S3.1.
  - `src/lib/compliance/audit-middleware.ts` — `WORM_ACTIONS` deny-list applied across mutating paths.
- **⚠️ DB-layer gap:** There is **no DB-level trigger or GRANT/REVOKE** preventing a DBA from running raw `UPDATE`/`DELETE` SQL on the `AuditLog` table. WORM is enforced only in app code. For a regulated platform, this should be backed by DB-level restrictions (or append-only table permissions / WORM storage).

### 3.3 Before/After Data-State Capture

- **❌ NOT PRESENT.** The `AuditLog` model has **no `previousValue` / `newValue` fields**. Critical changes (role changes, policy edits, KYC status transitions) record *that* an action happened, but not *what the data looked like before and after*.
- **FDL 10/2025 / audit-defense gap ⚠️:** External auditors routinely demand before/after evidence for privileged mutations. This is a **P1 compliance gap** — the schema must be extended with `previousValue Json?` / `newValue Json?` and `createAuditLog()` must snapshot both states.

---

## 4. Current Modules & Workflow Status

> Rating scale: **Not Started · UI Only · Partially Functional · Fully Functional**

### 4.1 User Management & Admin Panel — **Partially Functional**

- ✅ `User` model + `/api/users` (2 routes) + `AdminPanel` component exist.
- ✅ Role assignment UI, deactivate (`isActive = false`), DMLRO delegation fields.
- ⚠️ **Gaps:** No suspend/deactivate lifecycle states (only boolean `isActive`); no enforced password-reset flow; no failed-login lockout state; role changes are **not** routed through Maker-Checker at the schema level (the richer Master Admin v2 schema with `status` / `failedLoginAttempts` / `mfaEnabled` / `lastLoginAt` is **not present in this baseline**).
- **Target:** Add full user lifecycle (ACTIVE/SUSPENDED/DEACTIVATED/ARCHIVED), secure password reset, Maker-Checker SoD on role changes.

### 4.2 KYC & Customer Onboarding — **Fully Functional (UI) / Partially Functional (workflow)**

- ✅ Models: `CorporateKYC`, `IndividualKYC`, `VASPKYC`, `BrokerKYC` + `/api/kyc` (3 routes).
- ✅ 6-step Corporate onboarding wizard with **UBO cascade** (Art. 10 CR 134/2025) + **11-factor risk scoring** (PEP, PEP-UBO, complex ownership, sanctions match, etc.) — documented in help-data and implemented in components.
- ✅ Document upload UI, risk-rating thresholds (Low <30 / Medium 30–59 / High ≥60 → EDD).
- ⚠️ **Gaps:** Document storage is local (no encrypted object store / DMS integration); UBO visualization is UI-only (no graph persistence); periodic review scheduling not enforced.

### 4.3 AML Alert & Case Management — **Fully Functional**

- ✅ `AMLAlert` model + `/api/aml` + `AMLSanctionsTriage` component.
- ✅ Alert generation, assignment, investigation drawer, risk-indicator tagging, escalation-to-MLRO flow.
- ✅ Linked to `SARCase` for alert → SAR progression.
- ⚠️ **Gap:** Transaction-monitoring rule engine is partially simulated (no live transaction feed ingestion).

### 4.4 Sanctions & PEP Screening — **UI Only / Partially Functional**

- ✅ `SanctionsScreening` model + `webhooks/[provider]` route (HMAC-SHA256 verified inbound receiver) + screening UI with side-by-side match comparison + confidence scoring.
- ✅ Default list `OFAC_SDN` referenced; batch-upload UI exists.
- ⚠️ **CRITICAL GAP:** **No live external sanctions/PEP provider integration** (no Dow Jones / LexisNexis / Refinitiv World-Check / ComplyAdvantage). Screening currently runs against **simulated/test lists**. The webhook receiver is built but no provider is wired to call it.
- **Target:** Integrate at least one CBUAE-recognized screening provider with real-time + batch screening.

### 4.5 Maker-Checker (4-Eyes) Engine — **Fully Functional**

- ✅ `MakerCheckerLog` model (PENDING / APPROVED / REJECTED / EXPIRED, `expiryTime`, `payloadSnapshot` JSON) + `/api/maker-checker` + `src/lib/middleware/maker-checker.ts`.
- ✅ **Generic engine** with `OperationType` enum: `KYC_HIGH_RISK_APPROVAL`, `GOAML_SUBMIT`, `SANCTIONS_CLEARANCE_OVERRIDE`, `EMERGENCY_REVOKE`.
- ✅ **Self-approval prevention** (Maker ≠ Checker enforced).
- ✅ SLA-based expiry: critical ops 4h, others 24h.
- ⚠️ **Gap:** Maker-Checker is **not yet enforced for admin role-change operations** in this baseline (the `ROLE_CHANGE_REQUIRES_MAKER_CHECKER` matrix is absent). Must be added for user-management SoD.

### 4.6 Regulatory Reporting (goAML) — **Partially Functional**

- ✅ `GoAMLFiling` model + `/api/goaml` (4 routes: list, submit, approve, validate) + `cbuae-submission-checker`.
- ✅ XML payload generation, validate, approve pipeline; Maker-Checker on submit; `fiuAcknowledgementId` field present.
- ⚠️ **CRITICAL GAP:** **No live connection to the UAE FIU goAML portal.** Submission stores `fiuAcknowledgementId` as null and records the filing locally — actual transmission to FIU is **simulated**. The 30-day SAR filing SLA is tracked but not enforced with escalations.
- **Target:** Integrate UAE FIU goAML submission API (or secure file-drop) with real acknowledgement capture.

### 4.7 Dashboards & Reporting — **Fully Functional**

- ✅ `CommandCenter` with compliance-score gauge, KRI cards, risk-distribution pie, monthly trends, activity feed.
- ✅ `KRIMetric` model + `/api/dashboard` + role-selector (view-as).
- ✅ Board Portal, Auditor Time-Travel, Dept-Head Inbox, CAP Kanban, QA Sampling.
- ⚠️ **Gap:** Some KRI cards display masked/`NaN` values due to PII `sanitizeObject` over-masking numeric metrics (cosmetic, pre-existing).

### Module Status Summary Table

| # | Module | Status | Key Gap vs. Target |
|---|---|---|---|
| 1 | User Management & Admin Panel | **Partially Functional** | No lifecycle states, no secure password reset, no MC on role changes |
| 2 | KYC & Customer Onboarding | **Fully Functional (UI)** / Partial workflow | No encrypted doc store, no UBO graph persistence |
| 3 | AML Alert & Case Management | **Fully Functional** | Transaction-monitoring feed is simulated |
| 4 | Sanctions & PEP Screening | **UI Only / Partial** | No live external provider; simulated lists only |
| 5 | Maker-Checker (4-Eyes) Engine | **Fully Functional** | Not yet enforced for admin role changes |
| 6 | Regulatory Reporting (goAML) | **Partially Functional** | No live FIU submission; simulated acknowledgement |
| 7 | Dashboards & Reporting | **Fully Functional** | Cosmetic NaN on masked KRI cards |

---

## 5. Integrations & External APIs

### 5.1 Currently Integrated

| Integration | Status | Evidence |
|---|---|---|
| **Inbound sanctions/PEP webhook receiver** | ✅ Built (no provider wired) | `src/app/api/webhooks/[provider]/route.ts` — HMAC-SHA256 verified, processes sanctions matches, defaults to `OFAC_SDN`. Ready to receive, but **no external provider is calling it.** |
| **goAML XML pipeline** | ✅ Built (simulated submission) | `/api/goaml/{submit,approve,validate}` generates XML + Maker-Checker, but `fiuAcknowledgementId` stays null — no real FIU call. |
| **CBUAE submission checker** | ✅ Built (local validation) | `/api/cbuae-submission-checker` validates filing completeness locally; no CBUAE portal connection. |
| **AI Assistant (z-ai SDK)** | ✅ Backend integrated | `src/app/api/chat/*` — LLM chat for compliance Q&A. |

### 5.2 External Systems — Live Connections

- **❌ NONE active.** A grep for `fetch('https://...')` / `axios` across `src/app/api` and `src/lib` returns **zero external API calls** (excluding localhost/icos). The platform is currently a **closed-loop system** — all data is internal or simulated.

### 5.3 Planned / Stalled Integrations (inferred from code + help docs)

| Integration | Priority | Status |
|---|---|---|
| UAE FIU goAML portal (live submission) | **P0** | Pipeline built, submission simulated. Needs FIU API credentials + endpoint. |
| External sanctions/PEP provider (Dow Jones / LexisNexis / Refinitiv World-Check / ComplyAdvantage) | **P0** | Webhook receiver built, no provider contract. Needs vendor selection + outbound screening API. |
| Core insurance/banking system (policy/claims feed) | P1 | `InsuranceRecord` model exists; no ingest connector. |
| CBUAE reporting portal (quarterly/prudential) | P1 | `QuarterlyReport` model + UI; no portal submission. |
| MOHRE/Nafis labor reporting | P2 | `LaborLawCompliance` model + UI; no outbound API. |
| Email/notification gateway (SMTP/SMS) | P1 | `Notification` model + UI; no real transport (in-app only). |

---

## 6. Known Technical Debt & Limitations

### 6.1 Architectural / Infrastructural

| # | Debt | Severity | Impact |
|---|---|---|---|
| 6.1.1 | **SQLite database** (file-based, single writer) | 🔴 High | Not production-grade for a regulated multi-user financial platform. No HA, no point-in-time recovery, concurrency ceiling. **Must migrate to PostgreSQL** before production UAT with real load. |
| 6.1.2 | **Hardcoded demo passwords** in NextAuth `authorize()` | 🔴 Critical | `admin123` / `mlro123` etc. with no hashing. P0 security blocker. Must replace with bcrypt/argon2 + password policy. |
| 6.1.3 | **No MFA implementation** | 🔴 High | FDL/CBUAE mandatory for privileged roles. Must build TOTP at minimum. |
| 6.1.4 | **No 15-min idle session timeout** | 🔴 High | CBUAE mandatory. NextAuth maxAge is 8h absolute only; no sliding idle. |
| 6.1.5 | **No before/after audit capture** | 🟠 Medium | AuditLog lacks `previousValue`/`newValue`. Audit-defense gap. |
| 6.1.6 | **WORM enforced app-layer only** | 🟠 Medium | No DB-level trigger/GRANT preventing DBA `UPDATE`/`DELETE` on AuditLog. |
| 6.1.7 | **`User.role` is plain String** (not enum) | 🟡 Low-Med | DB-layer weak typing; migrate to Prisma enum. |

### 6.2 Code-Level

| # | Debt | Severity | Impact |
|---|---|---|---|
| 6.2.1 | **170 mock/simulated/placeholder references** across `src` | 🟠 Medium | Heavy simulation mode (documented in UAT-hotfix-4). Must be replaced with real data paths for production. |
| 6.2.2 | **21 mutating routes missing audit-log calls** | 🟡 Low | Lint WARN (not FAIL). Close the audit-coverage gap to 100%. |
| 6.2.3 | **Monolithic `src/app/page.tsx`** (~1700 lines, inline `AppContent`) | 🟡 Low | Maintainability; should be decomposed (known, documented). |
| 6.2.4 | **Duplicate component paths** (`portals/` vs specialized dirs) | 🟡 Low | Confusion; consolidate. |
| 6.2.5 | **33 TODO/FIXME/HACK markers** | 🟡 Low | Track and resolve. |
| 6.2.6 | **NextAuth v4** (v5 / Auth.js current) | 🟡 Low | v4 in maintenance; plan upgrade. |
| 6.2.7 | **Cosmetic NaN on masked KRI cards** | 🟡 Low | `sanitizeObject` PII masking over-masks numeric metrics. Pre-existing. |

### 6.3 Hardcoded Legacy Features (refactor risk)

- **Demo credential map** in `authorize()` — must be fully replaced (not patched) with a hashed-credential store; touches the auth hot path.
- **`help-data.ts` role table** describes a *6-role* hierarchy (Viewer/Analyst/Officer/MLRO/Admin) that **diverges** from the actual 7-role `ComplianceRole` union — documentation drift; must be reconciled.
- **`OperationType` Maker-Checker enum** is a closed list of 4 operation types — extending to admin role-changes (target) requires adding enum values + middleware wiring.

### 6.4 Performance / Bottlenecks

- SQLite write contention under concurrent audit logging (mitigated short-term by WAL, but not a real fix).
- No query-level caching layer beyond in-memory `useApiFetch`; large list endpoints (AML alerts, audit trail) will need pagination indexing at scale.
- No connection pooling (SQLite); PostgreSQL migration will introduce `PgBouncer` need.

---

## 7. Gap Analysis Summary — Mapped to Regulatory Requirements

| Regulatory Requirement | Source | Current State | Gap Severity |
|---|---|---|---|
| 7-role RBAC with SoD | FDL 10/2025 Art. 15; CBUAE 3551/2021 S3.1 | ✅ 7 roles + 61 permissions + withRBAC | Low (add MC on role changes) |
| Maker-Checker 4-eyes | FDL 10/2025 Art. 15; CR 134/2025 Art. 16 | ✅ Generic engine, self-approval blocked | Low (extend to user-mgmt) |
| WORM immutable audit | FDL 10/2025 Art. 11; CBUAE S3.1 | ✅ App-layer WORM + SHA-256 | Medium (DB-layer + before/after) |
| 15-min idle timeout | CBUAE cybersecurity | ❌ 8h absolute only | 🔴 High (P0) |
| MFA for privileged roles | FDL 10/2025; CBUAE | ❌ Not implemented | 🔴 High (P0) |
| Secure password hashing | PDPL; security best-practice | ❌ Demo plaintext passwords | 🔴 Critical (P0) |
| goAML SAR/STR filing | UAE FIU | ⚠️ Pipeline built, simulated submission | 🔴 High (P0) |
| Sanctions/PEP screening | CR 134/2025 Art. 14–15 | ⚠️ UI + webhook receiver, no live provider | 🔴 High (P0) |
| Record retention 5–10 yrs | CR 134/2025 Art. 12; FDL Art. 16 | ⚠️ Schema supports; no retention enforcement job | Medium |
| UAE data residency | PDPL | ⚠️ Design goal; not infra-enforced | Medium |
| Before/after audit capture | Audit best-practice | ❌ Not present | Medium (P1) |
| Production DB (PostgreSQL) | Operational scalability | ❌ SQLite | 🔴 High (P0) |

---

## 8. Recommended Phased Development Plan (input for Systems Architect)

> Sequenced by regulatory criticality and dependency. Each phase should branch from a tagged restore point and follow the UAT discipline (commit + tag + worklog + notify).

### Phase 0 — Security Hardening (P0, blocker for any real UAT)
1. Replace demo passwords with **bcrypt/argon2** hashing + secure password-reset flow.
2. Implement **TOTP-based MFA** for `admin` / `mlro` / `compliance_manager`.
3. Implement **15-minute idle session timeout** (sliding) via middleware.
4. Add **account-lockout state** (`failedLoginAttempts`, `lockedUntil`) to User model.
5. Extend `AuditLog` with `previousValue` / `newValue` (Json) and snapshot in `createAuditLog()`.

### Phase 1 — Database & Infrastructure (P0, blocker for production)
1. **Migrate SQLite → PostgreSQL** (Prisma schema provider swap + data migration script).
2. Add **DB-level WORM enforcement** (REVOKE UPDATE/DELETE on AuditLog; append-only permissions).
3. Migrate `User.role` String → Prisma **enum**.
4. Add User lifecycle fields (`status`, `lastLoginAt`, `passwordChangedAt`, `lastActiveDevice`).
5. Configure **UAE-region deployment** target (Docker host in UAE).

### Phase 2 — Compliance Workflow Completion (P0–P1)
1. **goAML live FIU integration** — real submission endpoint + acknowledgement capture + 30-day SLA escalation.
2. **External sanctions/PEP provider** — select vendor, wire outbound screening API + inbound webhook.
3. **Maker-Checker on admin role changes** — add `ROLE_CHANGE_REQUIRES_MAKER_CHECKER` + extend `OperationType` enum.
4. **Retention enforcement job** — scheduled task enforcing 5/10-year retention + retention-lock badges.

### Phase 3 — Data & Reporting (P1)
1. Core insurance/banking system ingest connector.
2. CBUAE quarterly reporting portal submission.
3. Email/SMS notification transport.
4. Pagination + indexing on large list endpoints.

### Phase 4 — Polish & Debt (P2)
1. Decompose monolithic `page.tsx`.
2. Resolve 33 TODO/FIXME + close 21 missing-audit-log WARNs.
3. Reconcile help-data role documentation drift.
4. Fix cosmetic NaN on masked KRI cards.
5. Upgrade NextAuth v4 → v5 (Auth.js).

---

## 9. Artifacts Attached / Available for Systems Architect

| Artifact | Location |
|---|---|
| Prisma schema (68 models) | `prisma/schema.prisma` (1,473 lines) |
| RBAC engine + 61 permissions | `src/lib/compliance/rbac.ts` (1,006 lines) |
| Auth guard | `src/lib/auth-guard.ts` |
| NextAuth config | `src/app/api/auth/[...nextauth]/route.ts` |
| Audit + WORM | `src/lib/audit.ts`, `src/app/api/audit/worm-guard.ts`, `src/lib/compliance/audit-middleware.ts` |
| Maker-Checker engine | `src/lib/middleware/maker-checker.ts`, `prisma/schema.prisma` (MakerCheckerLog) |
| API route inventory | 108 `route.ts` files under `src/app/api/` |
| Restore point tag | `v7.2.0-pre-gap-analysis` (commit `6f8c12a`) |
| This document | `GAP-ANALYSIS-v7.3.0-RC1.md` |

---

## 10. Next Steps

1. **Systems Architect** reviews this baseline and produces the formal **Phased Development Plan** (with effort estimates, dependencies, and UAT gates per phase).
2. Each phase branches from a tagged restore point; code freeze discipline applies between phases.
3. **P0 items (Phase 0 + Phase 1) must complete before any business-stakeholder UAT with real credentials.**
4. I'm available to walk through any section in detail — no call needed unless the Architect wants to discuss sequencing trade-offs.

---

*Prepared by IC-OS Engineering. Analysis method: static analysis of live source tree at commit `6f8c12a` (v7.3.0-RC1-uat-hotfix-5). Zero code changes made — Gold Master / pre-gap-analysis code freeze preserved.*
