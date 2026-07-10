# UAT Kickoff Brief — IC-OS v7.3.0-RC1

**Document Type:** Stakeholder-Facing UAT Kickoff Brief
**Release:** IC-OS v7.3.0-RC1 (Release Candidate 1)
**Audience:** Compliance Manager, Department Heads, CCO/MLRO, IT/Security, Development Team
**Regulatory Framework:** CBUAE Notice 3551/2021 (Complaints Handling), Federal Decree-Law (FDL) 10/2025 (AML/CFT — Tipping-Off, GoAML), Cabinet Resolution (CR) 134/2025 (Corporate Compliance Governance)
**UAT Window:** 10 business days
**Restore Point Tag:** `v7.3.0-RC1-uat-prep-restore-point` (commit `ec4c992`)
**Document Status:** Final — Ready for Distribution

---

## 1. Purpose

This brief prepares all User Acceptance Testing (UAT) stakeholders for the formal execution phase of IC-OS v7.3.0-RC1. IC-OS is the audit-ready, CBUAE-compliant insurance compliance platform covering complaints handling (CBUAE Notice 3551/2021), suspicious activity reporting and GoAML filing (FDL 10/2025), and corporate compliance governance including policy attestation and audit-trail integrity (CR 134/2025).

The UAT phase is the final gate before production deployment. A P0 defect in the SLA evaluator import path (causing cascading HTTP 500s on the main page and four API endpoints) was identified, fixed, and committed at `49e1b4b`. The UAT environment has been seeded with 62 anonymized records covering six role-based users, 10 complaints, 5 Corrective Action Plans (CAPs), 3 Suspicious Activity Reports (SARs), 5 compliance alerts, 20 UniversalTasks, and 10 audit logs. All endpoints are verified working (HTTP 200) and the platform is ready for stakeholder-driven UAT execution.

This document defines:
1. The 10-day UAT timeline and what is expected of each stakeholder role on each day.
2. The bug severity definitions that govern fix-priority commitments during UAT.
3. The UAT success criteria that must be met before production deployment is authorized.
4. The production deployment readiness checklist that the Development Team must satisfy in parallel with UAT.

It is intended to be read in full by all UAT stakeholders **before** Day 1 (Kickoff). The companion documents — `UAT_TEST_SCENARIOS.md`, `UAT_ACCESS_CREDENTIALS.md`, and `UAT_ENVIRONMENT_RUNBOOK.md` — provide the executable test scripts, credentials, and operational procedures respectively.

---

## 2. UAT Stakeholders & Roles

The following five stakeholder groups participate in UAT. Each has a distinct responsibility, access level, and sign-off authority. Credentials for all role-based accounts are in `UAT_ACCESS_CREDENTIALS.md`.

| Role | Responsibility | Access Level |
|---|---|---|
| **Compliance Manager** (Primary Tester) | Test all core workflows end-to-end (Complaint Lifecycle, GoAML Maker-Checker, Policy Attestation, Data-Room Generation, Unified My Tasks Inbox). Triage and re-verify bug fixes. Drive sign-off across all 5 scenarios. | Full access (compliance_manager role + admin account available) |
| **Department Heads** (Legal, Underwriting, Claims) | Test circular acknowledgments, policy read-receipts, and cross-department routing. Verify that complaints and CAPs assigned to their department appear in the correct inbox with correct SLA timers. | Department-specific (dept_head role — restricted operational access, full visibility for own department) |
| **CCO/MLRO** (Executive Sign-off) | Review executive dashboards, approve GoAML submissions through the Maker-Checker workflow, verify audit-trail integrity and immutability. Provide executive sign-off for production deployment. | Read-most, approve-specific (mlro role — approval authority on GoAML, full read on dashboards and audit) |
| **IT/Security** (Technical Sign-off) | Verify RBAC enforcement, audit-logging completeness, webhook signature verification, PII masking in data-room output, and the dev-bypass invariant (synthetic admin must NEVER appear in production). Provide technical sign-off. | Admin access (admin role — full system access for verification only; no production data modification) |
| **Development Team** (Support) | Triage reported bugs, fix P0/P1 defects within committed SLAs, provide technical guidance to stakeholders, maintain the UAT environment stability. No new feature work during UAT. | Full access (admin role + source-code access for debugging) |

**Sign-off authority**: Production deployment requires **two** sign-offs — (a) CCO/MLRO executive sign-off and (b) IT/Security technical sign-off. The Compliance Manager's scenario sign-offs are a prerequisite for both.

---

## 3. UAT Timeline (10 Business Days)

| Day | Phase | Activities | Deliverable |
|---|---|---|---|
| **Day 1** | Kickoff | All stakeholders attend the UAT kickoff session. Review this brief, walk through the 5 scenarios in `UAT_TEST_SCENARIOS.md`, distribute credentials from `UAT_ACCESS_CREDENTIALS.md`, confirm environment accessibility (Preview Panel + API), and run the smoke test (verify audit integrity endpoint returns `valid: true`). | Kickoff minutes, confirmed access for all 6 accounts, smoke test passed |
| **Days 2–7** | Active Testing | Compliance Manager executes all 5 scenarios end-to-end. Department Heads test their inbox flows on Days 2–3. CCO/MLRO reviews dashboards and approves GoAML submissions on Days 4–5. IT/Security runs `security-checks.mjs`, `check-rbac-dev-bypass.ts`, `check-audit-logging.ts`, and `pii-leak-detection.mjs` on Days 6–7. Bugs are logged in real time with severity tags. | Daily bug-triage report; IT/Security verification report by end of Day 7 |
| **Days 8–9** | Re-Testing | Development Team fixes P0/P1 bugs reported in Days 2–7. Compliance Manager re-tests fixed scenarios. Any new P0/P1 bugs discovered during re-test extend the timeline (see §6 Bug Severity). Department Heads and CCO/MLRO re-verify their affected workflows. | Re-test report; updated bug list (target: 0 P0/P1 open) |
| **Day 10** | Sign-off | Final regression pass. Compliance Manager confirms all 5 scenarios signed off. CCO/MLRO provides executive sign-off. IT/Security provides technical sign-off. Go/No-Go decision recorded. | Signed UAT Sign-Off Form; Go/No-Go decision; production deployment scheduled (if Go) |

**Daily cadence**: A 15-minute stand-up at 09:00 local time during Days 2–9. The Compliance Manager chairs; bug severity changes and blockers are the standing agenda.

---

## 4. Bug Severity Definitions

Bug severity governs the Development Team's fix-time commitment. Severity is assigned at bug-log time by the Compliance Manager (or IT/Security for technical issues) and may be re-classified during the daily stand-up.

| Severity | Definition | Fix Commitment | Example |
|---|---|---|---|
| **P0 — Critical** | System crash, data loss, security breach, or regulatory non-compliance. The platform cannot be used for its primary purpose, or a control failure creates regulatory exposure. | **Fix within 4 hours** of report. UAT execution halts on the affected scenario until the fix is verified. Development Team lead is paged immediately. | Main page returns HTTP 500; GoAML Maker-Checker bypassed; PII visible in data-room output; audit-trail tamperable. |
| **P1 — High** | Core workflow is broken with no workaround. The scenario cannot be completed end-to-end, but the platform is otherwise usable. | **Fix within 24 hours** of report. Scenario remains blocked until the fix is verified; dependent scenarios may also be blocked. | Complaint state machine rejects a valid transition; `/api/tasks/my-tasks` returns 500 for a specific role; SAR approval flow fails for a non-creator user. |
| **P2 — Medium** | Workflow is impaired but a workaround exists. The scenario can be completed, but with degraded UX or with manual intervention. | **Fix within 3 business days** of report. Scenario may be marked "Passed with workaround" pending fix. | Filter on My Tasks inbox doesn't persist across page reloads; CSV export truncates long field names; SLA countdown timer shows wrong timezone. |
| **P3 — Low** | Cosmetic or non-functional issue. No impact on workflow, compliance, or data integrity. | **Fix before production deployment** (not blocking UAT sign-off, but tracked). | Typo in a button label; tooltip alignment off by 2px; loading spinner color inconsistent with brand. |

**Escalation path**: P0 bugs escalate to the Development Team lead immediately and are reported in the next stand-up regardless of resolution status. P1 bugs are reported in the next stand-up. P2/P3 bugs are batched into the daily bug-triage report.

---

## 5. UAT Success Criteria

UAT is considered **PASSED** and production deployment is **AUTHORIZED** only when **all five** of the following criteria are met. Partial pass (e.g., 4/5 scenarios signed off) is a **NO-GO** and triggers a re-scoping meeting.

1. **Scenario Sign-off (5/5)**: All five scenarios in `UAT_TEST_SCENARIOS.md` — (1) Complaint Lifecycle, (2) GoAML Maker-Checker, (3) Policy Attestation, (4) Data-Room Generation, (5) Unified My Tasks Inbox — are signed off by the Compliance Manager. Each scenario's sign-off line is initialed and dated.
2. **Zero P0/P1 Bugs Open**: No P0 or P1 bugs remain open at the end of Day 10. P0 bugs fixed within their 4-hour SLA and re-verified count as closed. P1 bugs fixed within their 24-hour SLA and re-verified count as closed.
3. **P2 Bugs Resolved or Workaround-Documented**: All P2 bugs are either (a) fixed and re-verified, or (b) have a documented workaround approved by the Compliance Manager and tracked for v7.3.1. P3 bugs are tracked for v7.3.1 with no UAT-blocking status.
4. **CCO/MLRO Executive Sign-off**: The CCO/MLRO reviews the executive dashboards, approves at least one GoAML submission through the Maker-Checker workflow (verifying 4-eyes enforcement), confirms audit-trail integrity (`/api/audit/integrity` returns `valid: true`), and signs the UAT Sign-Off Form.
5. **IT/Security Technical Sign-off**: IT/Security confirms RBAC enforcement (no role escalation possible), audit-logging completeness (all write operations logged), webhook signature verification (HMAC validated), PII masking (0 raw PII matches in `pii-leak-detection.mjs` output), and the dev-bypass invariant (`check-rbac-dev-bypass.ts` and `check-audit.ts` both pass). Signs the UAT Sign-Off Form.

**Audit-trail integrity gate**: As a hard prerequisite for sign-off, `GET /api/audit/integrity?fresh=1` must return `valid: true` with 0 violations on the final day. Any violation blocks sign-off regardless of other criteria.

---

## 6. Production Deployment Readiness Checklist

This checklist is owned by the Development Team and verified in parallel with UAT. All items must be complete before the Go decision on Day 10. Items marked **[UAT-VERIFIED]** are confirmed during UAT execution; items marked **[PRE-PROD]** must be completed by the Dev Team in the staging environment before production deployment.

### 6.1 Infrastructure
- [ ] SQLite → PostgreSQL migration script validated against staging data (no data loss, all constraints satisfied)
- [ ] Database backup and restore procedure documented and tested (restore time < 30 minutes)
- [ ] Application server capacity verified (load test at 2× expected peak — target p95 < 300ms, 0% errors)
- [ ] CDN/static asset delivery configured (Next.js 16 + Turbopack production build)
- [ ] DNS and TLS certificates provisioned for production domain
- [ ] [UAT-VERIFIED] Dev server runs cleanly via `bun run dev` (Turbopack, port 3000, auto-restart via `bun --hot`)

### 6.2 Security & Compliance
- [ ] [UAT-VERIFIED] RBAC enforced on all `withRBAC`-protected endpoints (no role escalation; `check-rbac-dev-bypass.ts` passes)
- [ ] [UAT-VERIFIED] Audit logging complete on all write operations (`check-audit-logging.ts` passes; `check-audit.ts` CI invariant passes)
- [ ] [UAT-VERIFIED] Audit-trail integrity (`/api/audit/integrity?fresh=1` returns `valid: true`, 0 violations, all entries verified — 11397/11397 at kickoff; count grows as UAT creates audit entries, remains `valid: true`)
- [ ] [UAT-VERIFIED] PII masking in data-room output (0 raw PII matches via `pii-leak-detection.mjs`)
- [ ] [UAT-VERIFIED] Webhook signature verification (HMAC validated; no unsigned webhooks accepted)
- [ ] [PRE-PROD] Dev-mode `authGuard` synthetic-admin bypass disabled in production (NODE_ENV=production; CI `check-audit.ts` enforces this invariant)
- [ ] [PRE-PROD] JWT secret rotated for production (not the dev-mode demo secret)
- [ ] [PRE-PROD] TLS 1.3 enforced; HSTS headers configured
- [ ] [PRE-PROD] Rate-limiting thresholds reviewed for production traffic (SENSITIVE: 10/min, READ: 100/min)

### 6.3 Monitoring & Alerting
- [ ] Application logs shipped to centralized log store (structured JSON, PII-scrubbed at source)
- [ ] Audit-log integrity cron job scheduled (hourly `/api/audit/integrity` check; alert on `valid: false`)
- [ ] SLA evaluator cron job scheduled (daily; generates ComplianceAlerts at 80% approaching / 100% breached)
- [ ] Uptime monitoring on `/api/health` (alert if non-200 for 3 consecutive checks)
- [ ] p95 latency alerting on `/api/tasks/my-tasks`, `/api/complaints`, `/api/audit/integrity`, `/api/department-risk` (alert if p95 > 300ms for 5 minutes)
- [ ] Error-rate alerting (alert if 5xx error rate > 1% for 5 minutes)

### 6.4 Deployment Strategy
- [ ] Blue-green deployment infrastructure provisioned (or canary rollout plan documented)
- [ ] Rollback procedure documented and tested (target rollback time < 15 minutes)
- [ ] [UAT-VERIFIED] Restore point `v7.3.0-RC1-uat-prep-restore-point` (commit `ec4c992`) confirmed; rollback command `git reset --hard v7.3.0-RC1-uat-prep-restore-point` tested in staging
- [ ] Database migration runbook documented (apply migrations → verify schema → start app → smoke test)
- [ ] Feature flags reviewed (any flags introduced in v7.3.0 are either removed or documented for controlled rollout)
- [ ] Maintenance-window communication drafted (stakeholders notified 48 hours in advance)

### 6.5 Documentation & Training
- [ ] [UAT-VERIFIED] `UAT_KICKOFF_BRIEF.md` (this document) finalized
- [ ] [UAT-VERIFIED] `UAT_TEST_SCENARIOS.md` finalized
- [ ] [UAT-VERIFIED] `UAT_ACCESS_CREDENTIALS.md` finalized (production credentials NOT included — this is UAT-only)
- [ ] [UAT-VERIFIED] `UAT_ENVIRONMENT_RUNBOOK.md` finalized
- [ ] `RELEASE_NOTES_v7.3.0.md` finalized and distributed
- [ ] `REGULATOR_IN_A_BOX.md` (mock CBUAE examination evidence package) reviewed by CCO/MLRO
- [ ] End-user training materials updated for v7.3.0 features (Unified My Tasks inbox, data-room generator, SLA evaluator)
- [ ] CCO/MLRO and Department Heads briefed on new dashboards and approval workflows

---

## 7. Restore Point & Rollback

A restore point has been created to enable rapid rollback if a critical defect is discovered during UAT that cannot be fixed within the P0 4-hour SLA.

| Field | Value |
|---|---|
| **Git tag** | `v7.3.0-RC1-uat-prep-restore-point` |
| **Commit SHA** | `ec4c992` |
| **Created** | Before any UAT-prep changes (frozen schema, seed script, etc.) |
| **Working tree state** | Clean at tag time |
| **Rollback command** | `git reset --hard v7.3.0-RC1-uat-prep-restore-point` |

**⚠️ Important**: The P0 fix (broken SLA evaluator import causing cascading 500s) is committed **after** the restore point (commit `49e1b4b`). Rolling back to the restore point will **undo the P0 fix**, and the cascading 500s will return. Rollback should only be invoked if a defect more severe than the P0 fix is discovered, and only after consultation between the Development Team lead and the CCO/MLRO.

After rolling back the code, the database must also be reset to a clean state — see `UAT_ENVIRONMENT_RUNBOOK.md` §"How to Reset to Fresh UAT State" for the full procedure.

---

## 8. References & Companion Documents

| Document | Purpose |
|---|---|
| `UAT_KICKOFF_BRIEF.md` (this document) | Stakeholder-facing overview; timeline, severities, success criteria, deployment readiness |
| `UAT_TEST_SCENARIOS.md` | Detailed step-by-step test checklists for the 5 business-critical workflows |
| `UAT_ACCESS_CREDENTIALS.md` | Credential sheet for all 6 UAT role-based accounts (browser + API methods) |
| `UAT_ENVIRONMENT_RUNBOOK.md` | Operational runbook for the UAT environment (reset, verify, run scripts, known issues) |
| `RELEASE_NOTES_v7.3.0.md` | Release notes for v7.3.0-RC1 |
| `REGULATOR_IN_A_BOX.md` | Mock CBUAE examination evidence package (64 KB) |
| `ARCHITECTURE.md` | Platform architecture reference |
| `MASTER_GAP_ANALYSIS_REPORT.md` | Gap analysis driving v7.3.0 scope |

---

## 9. Acknowledgement

By participating in UAT, each stakeholder acknowledges:
1. They have read this brief in full before Day 1.
2. They understand their role's responsibility, access level, and sign-off authority (§2).
3. They understand the bug severity definitions (§4) and will tag bugs accordingly.
4. They understand the UAT success criteria (§5) and that partial pass is a NO-GO.
5. They will not modify any source code, API routes, components, or schema during UAT — all defects are reported to the Development Team for fix.

**UAT Kickoff Brief — End of Document**
