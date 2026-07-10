# Full System Gap Analysis Report — IC-OS v7.3.0-RC1-uat-final

**Date:** 2026-06-20  
**Analyst:** Main Orchestrator (Gap Analysis)  
**Mode:** READ-ONLY investigation — zero code changes made  
**Restore Point:** `v7.3.0-uat-gap-analysis-restore-point` @ `1380767` (created before investigation, verified intact)  
**Trigger:** Stakeholder reports that "multiple critical sections of the platform are not active and showing errors"

---

## 5.1 Executive Summary

### Investigation Scope
A comprehensive, read-only audit was conducted across 6 dimensions:
1. Navigation render-case audit (all 36 sidebar items)
2. API endpoint smoke tests (15 key endpoints + live verification)
3. Integration adapter audit (3 adapters)
4. Command palette (Ctrl+K) mapping audit
5. Empty-data / silent-failure detection
6. Git history regression analysis for every broken section

### Headline Numbers

| Metric | Count |
|--------|-------|
| Total issues found | **11** |
| P0 (Critical — regulatory blocker / security / data loss) | **0** |
| P1 (High — core workflow broken, must fix before UAT sign-off) | **8** |
| P2 (Medium — workaround exists or data-layer work needed) | **2** |
| P3 (Low — cosmetic / hygiene) | **1** |
| Sections reported broken by stakeholders | 10 |
| Sections confirmed actually broken | **5** |
| Sections reported broken but actually working | **4** (over-reporting rate: 44%) |
| Orphaned UI code (complete components never rendered) | **5,416 lines** |

### Root Cause Analysis

**The 5 confirmed-broken sections share a single root cause:** missing `case '<nav-id>':` entries in `src/app/page.tsx`'s `renderSection()` switch statement. Clicking any of these 5 nav items silently falls through to the `default: <CommandCenter />` case — the user sees the Command Center dashboard instead of the expected page, with **no error message, no console log, and no indication of failure**.

**Critical regression discovered:** 3 of the 5 broken sections (Vendor Risk, Resiliency Hub, Bordereaux) **WERE working** after the P1 sprint ("Wire the Orphans", commit `fb6a374`, 2026-06-18 18:23 UTC). They were **silently re-broken 13 hours later** by commit `ec4c992` ("feat(P2): Complaint Management + DMS Hardening + RBAC CI Guard", 2026-06-19 07:15 UTC), which deleted 10 lazy imports + 10 switch cases + 7 sidebar nav items in a single diff. This appears to be an **accidental wholesale revert of the P1 sprint's frontend work** bundled into a P2 feature commit. The worklog has **no entry acknowledging this regression**.

The other 2 broken sections (My Profile, Admin Panel) have been orphaned since `24836cb` (2026-06-15, "UAT Preparation & Handover Package") and were never re-wired by any subsequent commit. No worklog entry claims they were fixed.

**Systemic concern:** This pattern — a feature commit accidentally reverting prior sprint work — indicates a gap in the code review / merge process. The P2 commit's diff should have been caught by a reviewer or CI check. See §5.5 Prevention Recommendations.

---

## 5.2 Detailed Findings

### Issue 1: Vendor Risk section broken (P1 — Regulatory)

| Field | Value |
|-------|-------|
| **Section** | Vendor Risk (Third-Party Risk Management & EDD) |
| **Nav ID** | `vendor-management` |
| **Current Status** | BROKEN — clicks render Command Center (default fallthrough) |
| **Error Details** | No error message; silent fallthrough. User clicks "Vendor Risk" in sidebar → sees Command Center dashboard instead of vendor list. |
| **Root Cause** | Missing `case 'vendor-management':` in `src/app/page.tsx` `renderSection()` switch (line 63–130). The lazy import `const VendorManagement = lazy(...)` was also deleted. |
| **Impact** | **Regulatory** — TPRM/EDD is a CBUAE Notice 3551/2021 obligation. Compliance officers cannot access the vendor risk register, due diligence records, or third-party risk scoring. This is a UAT-blocking issue for any stakeholder testing vendor management workflows. |
| **Backing API** | `GET /api/vendors` → HTTP 200, returns `{"success":true,"data":[]}` (0 records). `POST /api/vendors` and `PATCH /api/vendors/[id]` also exist and work. |
| **Prisma Model** | `ThirdPartyVendor` (0 records), `VendorDueDiligence` (2 records — partial seed) |
| **UI Component** | `src/components/ic-os/tprm/VendorManagement.tsx` — 942 lines, complete, shippable. Calls `POST /api/vendors` and `PATCH /api/vendors/${id}` via `useApiMutation`. No hardcoded IDs. |
| **Recommended Fix** | Re-add the lazy import + switch case to `page.tsx` (~3 lines). The component is fully built. Optionally seed vendor data for UAT. |
| **Estimated Effort** | **S** (small — ~15 minutes including verification) |

### Issue 2: Resiliency Hub section broken (P1 — Regulatory)

| Field | Value |
|-------|-------|
| **Section** | Resiliency Hub (BCP/DRP Management & Incident Response) |
| **Nav ID** | `resiliency-hub` |
| **Current Status** | BROKEN — clicks render Command Center |
| **Error Details** | Silent fallthrough, no error message. |
| **Root Cause** | Missing `case 'resiliency-hub':` in `page.tsx` switch. Lazy import deleted by P2 commit `ec4c992`. |
| **Impact** | **Regulatory** — BCP/DRP is required under CBUAE Dodd 2/2018 + ISO 22301. Business continuity plans, disaster recovery procedures, and incident reporting workflow are inaccessible. |
| **Backing API** | `GET /api/bcp` → HTTP 200, returns `{"success":true,"data":[]}` (0 records). `POST /api/bcp` and `POST /api/bcp/report-incident` also exist. |
| **Prisma Model** | `BusinessContinuityPlan` (0 records) |
| **UI Component** | `src/components/ic-os/resiliency/ResiliencyHub.tsx` — 714 lines, complete. Calls `POST /api/bcp` and `POST /api/bcp/report-incident`. No hardcoded IDs. |
| **Recommended Fix** | Re-add lazy import + switch case. Optionally seed BCP data. |
| **Estimated Effort** | **S** (~15 minutes) |

### Issue 3: Bordereaux section broken (P1 — Regulatory)

| Field | Value |
|-------|-------|
| **Section** | Bordereaux (Broker Data Validation & CBUAE Submission) |
| **Nav ID** | `bordereaux-validation` |
| **Current Status** | BROKEN — clicks render Command Center |
| **Error Details** | Silent fallthrough, no error message. |
| **Root Cause** | Missing `case 'bordereaux-validation':` in `page.tsx` switch. Lazy import deleted by P2 commit `ec4c992`. |
| **Impact** | **Regulatory** — bordereaux submission is a CBUAE Standard Return obligation (CR 134/2025). Upload, validation, and tracking workflows are inaccessible. |
| **Backing API** | `GET /api/bordereaux` → HTTP 200, returns `{"success":true,"data":[],"pagination":{"total":0,...}}` (0 records). `POST /api/bordereaux/validate` and `POST /api/bordereaux/submit` also exist. |
| **Prisma Model** | `BordereauxSubmission` (0 records), `InsuranceRecord` (0 records) |
| **UI Component** | `src/components/ic-os/bordereaux/UploadBordereaux.tsx` — 700 lines, complete. Calls `POST /api/bordereaux/validate`, `POST /api/bordereaux/submit`, `GET /api/bordereaux`. No hardcoded IDs. |
| **Recommended Fix** | Re-add lazy import + switch case. Optionally seed bordereaux data. |
| **Estimated Effort** | **S** (~15 minutes) |

### Issue 4: My Profile section broken (P1 — Operational)

| Field | Value |
|-------|-------|
| **Section** | My Profile (User Profile, Preferences & Security Settings) |
| **Nav ID** | `user-settings` |
| **Current Status** | BROKEN — clicks render Command Center |
| **Error Details** | Silent fallthrough, no error message. |
| **Root Cause** | (1) Missing `case 'user-settings':` in `page.tsx` switch. (2) Even if wired, the component uses **hardcoded mock data** (`MOCK_PROFILE`, `MOCK_SESSIONS`, `MOCK_CONNECTED_SERVICES` constants at lines 110–167) instead of fetching from `/api/users/me`. |
| **Impact** | **Operational** — users cannot view/edit their profile, change password, manage active sessions, or configure preferences. Disruptive for individual users but not a regulatory blocker. |
| **Backing API** | `GET /api/users/me` → HTTP 200, returns synthetic `dev-user` in dev mode (auth-guard dev bypass). Would return real user in production. No `/api/users/sessions` endpoint exists (needed for the sessions tab). |
| **Prisma Model** | `User` (14 records) |
| **UI Component** | `src/components/ic-os/settings/UserSettings.tsx` — 1254 lines. UI scaffold is complete but data layer is NOT wired — 3 mock constants provide fake data ("Ahmed Al-Rashid", 3 fake device sessions, Slack/Jira/Exchange mock integrations). |
| **Recommended Fix** | (1) Add lazy import + switch case. (2) Replace `MOCK_PROFILE` with `useApiQuery('/api/users/me')`. (3) Add `/api/users/sessions` endpoint for the sessions tab (or hide it until built). |
| **Estimated Effort** | **M** (medium — ~2-3 hours: wiring + data-layer + optional new endpoint) |

### Issue 5: Admin Panel section broken (P1 — Operational/Regulatory)

| Field | Value |
|-------|-------|
| **Section** | Admin Panel (System Administration & User Management) |
| **Nav ID** | `admin-settings` |
| **Current Status** | BROKEN — clicks render Command Center |
| **Error Details** | Silent fallthrough, no error message. |
| **Root Cause** | (1) Missing `case 'admin-settings':` in `page.tsx` switch. (2) User Management tab uses **hardcoded `initialUsers` mock array** (lines 124+, 4+ fake users) instead of `/api/users` (14 real records available). (3) Config tab not wired to `/api/admin/ai-config`. Only the Knowledge Base tab is data-bound (to `/api/scenarios`, 122 records). |
| **Impact** | **Operational/Regulatory** — admin cannot manage user accounts, roles, or system configuration from the UI. Must use DB or API directly. 4 of 5 tabs are static UI. |
| **Backing API** | `GET /api/users` → 200, 14 records. `GET /api/admin/ai-config` → 200, returns config defaults (`apiKey:""`, `provider:"z-ai"`). `GET /api/scenarios` → 200, 122 records (already wired for Knowledge tab). |
| **Prisma Model** | `User` (14), `AIEngineConfig` (0 persisted rows), `ScenarioKnowledge` (122) |
| **UI Component** | `src/components/ic-os/admin/AdminPanel.tsx` — 1806 lines. 5 tabs: `users` (mock data), `billing` (static), `config` (not wired), `audit` (static), `knowledge` (works, calls `/api/scenarios`). |
| **Recommended Fix** | (1) Add lazy import + switch case. (2) Replace `initialUsers` mock with `useApiQuery('/api/users')` fetch. (3) Wire Config tab to `/api/admin/ai-config`. |
| **Estimated Effort** | **M** (medium — ~3-4 hours: wiring + data-layer for User Mgmt + Config tabs) |

### Issue 6: Command Menu (Ctrl+K) wrong navigation targets (P1)

| Field | Value |
|-------|-------|
| **Section** | Command Palette (Ctrl+K quick navigation) |
| **Current Status** | 2 of 15 commands navigate to WRONG pages |
| **Error Details** | (1) "Manage Users (Admin)" → navigates to `ai-agent` (AI Agent Management page) instead of `admin-settings`. (2) "User Settings" → navigates to `theme-settings` instead of `user-settings`. Both confirmed in `src/components/shared/CommandMenu.tsx` lines 73, 75. |
| **Root Cause** | Incorrect `navigate()` target IDs in the command definitions. The nav IDs `admin-settings` and `user-settings` exist in the sidebar but the command palette points elsewhere. |
| **Impact** | Users using Ctrl+K to jump to admin/user settings land on the wrong page. Compounded by the fact that even the correct target IDs are currently broken (Issues 4, 5). |
| **Recommended Fix** | Fix 2 lines in `CommandMenu.tsx`: line 73 `navigate('ai-agent')` → `navigate('admin-settings')`; line 75 `navigate('theme-settings')` → `navigate('user-settings')`. Must be done IN CONJUNCTION with fixing Issues 4, 5 (otherwise the corrected navigation still lands on a broken page). |
| **Estimated Effort** | **S** (~5 minutes, but paired with Issues 4, 5) |

### Issue 7: Empty backing data for 3 broken sections (P2)

| Field | Value |
|-------|-------|
| **Section** | Vendor Risk + Resiliency Hub + Bordereaux (collectively) |
| **Current Status** | Even after wiring the render cases, the UI will show empty states |
| **Error Details** | `GET /api/vendors` → 0 records. `GET /api/bcp` → 0 records. `GET /api/bordereaux` → 0 records. The Prisma tables `ThirdPartyVendor`, `BusinessContinuityPlan`, `BordereauxSubmission` are all empty. |
| **Root Cause** | No seed scripts exist for these 3 tables. The UAT seed (`prisma/seed-uat.ts`) covers complaints, CAPs, SARs, alerts, policies, attestations, users, tasks — but not vendors, BCP plans, or bordereaux submissions. |
| **Impact** | After fixing Issues 1–3, testers will see "No vendors found" / "No BCP plans" / "No bordereaux files" empty states. The create flows work (POST endpoints exist), but there's no demo data to validate list views, filtering, or detail pages. |
| **Recommended Fix** | Add seed entries to `prisma/seed-uat.ts` for: 3-5 `ThirdPartyVendor` records (with 2 existing `VendorDueDiligence` records linked), 2-3 `BusinessContinuityPlan` records, 2-3 `BordereauxSubmission` records. |
| **Estimated Effort** | **M** (~2-3 hours: seed script + verification) |

### Issue 8: Audit integrity regression — 1 missing-hash entry (P1)

| Field | Value |
|-------|-------|
| **Section** | Audit Trail Integrity |
| **Current Status** | `GET /api/audit/integrity?fresh=1` → `valid: true`, but `11405/11406 verified` (1 missingHash). Prior baseline was `11403/11403` (0 missing). |
| **Error Details** | One AuditLog entry (`cmqm9x2450022oroljivcvv94`) has a NULL `sha256Hash`. Action: `CBUAE_SUBMISSION_CHECK`, resource: `SubmissionChecker`. Created at 2026-06-20T11:27:45 UTC — during this gap analysis (a subagent tested `/api/cbuae-submission-checker`, which created an audit log via direct `db.auditLog.create()` without hash computation). |
| **Root Cause** | This is the documented Issue 7 from `UAT_ENVIRONMENT_RUNBOOK.md` — 14+ routes bypass the canonical `createAuditLog()` helper. The `/api/cbuae-submission-checker` route is one of them. NOT a new issue; it's the v7.3.1 compliance debt. |
| **Impact** | The `valid` field is still `true` (missingHashCount is separate from violations), but `verifiedEntries < totalEntries` which could raise questions during a CBUAE examination if not explained. |
| **Recommended Fix** | Run the idempotent backfill: `node scripts/backfill-audit-hashes.mjs`. This will compute the hash for the NULL entry and restore 11406/11406 verified. (Note: this is a data fix, not a code fix — the root cause remains the 14-route bypass, tracked for v7.3.1.) |
| **Estimated Effort** | **S** (~2 minutes — run the existing backfill script) |

### Issue 9: Test artifact in GoAML data (P3)

| Field | Value |
|-------|-------|
| **Section** | GoAML Filing Center |
| **Current Status** | `GET /api/goaml` returns 8 filings, one of which is a test artifact: `referenceNumber:"AUTH-BYPASS-PROBE-1781893855987"`, `subjectName:"Auth Bypass Probe"` |
| **Error Details** | Leftover from security testing. Visible to any stakeholder testing Scenario 2 (GoAML Maker-Checker). |
| **Root Cause** | A security probe created a GoAMLFiling record that was never cleaned up. |
| **Impact** | Cosmetic — won't break any workflow, but looks unprofessional during a UAT demo. |
| **Recommended Fix** | Delete the test-artifact record (filter by `referenceNumber` starting with `AUTH-BYPASS-PROBE-`). |
| **Estimated Effort** | **S** (~5 minutes) |

### Issue 10: Dead code — unused CommandMenu.tsx (P3)

| Field | Value |
|-------|-------|
| **Section** | Code hygiene |
| **Current Status** | `src/components/ic-os/shared/CommandMenu.tsx` (322 lines) exists but is NOT imported anywhere. The active command palette is `src/components/shared/CommandMenu.tsx`. |
| **Root Cause** | The ic-os version appears to be a more complete implementation (has a 31-entry `NAV_ITEMS` array that correctly maps `user-settings` and `admin-panel`) that was superseded by the simpler-but-buggy active version. |
| **Impact** | None (dead code doesn't run). But it's confusing for developers and should either be deleted or its `NAV_ITEMS` pattern mined to fix Issue 6. |
| **Recommended Fix** | Delete the dead file, OR migrate its `NAV_ITEMS` array pattern (correct-by-construction using sidebar IDs) to replace the active `CommandMenu.tsx`. |
| **Estimated Effort** | **S** (~10 minutes — delete or migrate) |

### Issue 11: Integration adapters in simulation mode (P2 — expected for dev)

| Field | Value |
|-------|-------|
| **Section** | External integrations (goAML FIU, Dow Jones/Refinitiv, UAE Pass/Nafath) |
| **Current Status** | All 3 adapters (`regulatory-gateway.ts`, `screening-provider.ts`, `identity-provider.ts`) are **fully implemented** with real API call paths, but default to **SIMULATION mode** because no environment variables are configured. |
| **Error Details** | No errors. Each adapter emits a one-time `SIMULATION MODE ACTIVE` console warning and returns tagged mock data (`mode:'simulation'`, `fiuReceiptNumber:"FIU-SIM-..."`, `accessToken:"sim-access-token-..."`). |
| **Root Cause** | Env vars not set: `GOAML_API_KEY` + `GOAML_CERT_PATH` + `GOAML_SUBMISSION_MODE=direct_api`, `SCREENING_API_URL` + `SCREENING_API_KEY`, `IDENTITY_API_URL` + `IDENTITY_API_KEY`. |
| **Impact** | UAT testers will see simulation-mode responses for goAML submission, sanctions screening, and SSO. This is **acceptable for UAT** (the simulation responses are clearly tagged) but must be documented in the runbook so testers don't report it as a bug. If live integration testing is required, env vars must be configured. |
| **Recommended Fix** | Document in `UAT_ENVIRONMENT_RUNBOOK.md` that all 3 integrations run in simulation mode during UAT. Optionally configure env vars for live testing of specific scenarios. |
| **Estimated Effort** | **S** (~15 minutes documentation; env var config depends on credential availability) |

---

## 5.3 Git History Analysis

### The Smoking Gun: Commit `ec4c992` (P2 Sprint)

**This is the most critical finding of the gap analysis.** Commit `ec4c992` ("feat(P2): Complaint Management + DMS Hardening + RBAC CI Guard", 2026-06-19 07:15 UTC) silently reverted the P1 sprint's frontend work.

| Nav ID | Originally Wired | Re-wired by P1 | Re-broken by P2 | Days Broken |
|--------|-----------------|----------------|-----------------|-------------|
| `vendor-management` | `45c6ff9` (2026-06-12) | `fb6a374` (2026-06-18 18:23) | `ec4c992` (2026-06-19 07:15) | 1 day |
| `resiliency-hub` | `45c6ff9` (2026-06-12) | `fb6a374` (2026-06-18 18:23) | `ec4c992` (2026-06-19 07:15) | 1 day |
| `bordereaux-validation` | `45c6ff9` (2026-06-12) | `fb6a374` (2026-06-18 18:23) | `ec4c992` (2026-06-19 07:15) | 1 day |
| `user-settings` | `45c6ff9` (2026-06-12) | *(never re-wired)* | `24836cb` (2026-06-15 09:25) | 5 days |
| `admin-settings` | `45c6ff9` (2026-06-12) | *(never re-wired)* | `24836cb` (2026-06-15 09:25) | 5 days |

### What the P2 commit deleted (from `git show ec4c992 -- src/app/page.tsx`):
- **10 lazy imports** (VendorManagement, ResiliencyHub, UploadBordereaux, + 7 others including CAP Kanban, ComplianceAlerts, DeptHeadInbox, PolicyAttestations, BoardPortal, DataRoom, MyTasks)
- **10 switch cases** (the corresponding `case '...': return <Component/>` entries)
- **7 sidebar nav items** (from `Sidebar.tsx`)

### What the P2 commit added:
- Complaint Management UI (ComplaintManagement.tsx)
- DMS hardening
- RBAC CI guard

### Why this is systemic:
The P2 commit's message says "feat(P2): Complaint Management + DMS Hardening + RBAC CI Guard" — it does NOT mention deleting any P1 work. The diff deleted ~120 lines of P1 frontend code while adding ~800 lines of P2 code. A code reviewer should have flagged the deletions. The worklog's P2 entry claims "0 lint errors" but never mentions the regression. **This indicates a code review gap in the merge process.**

### Worklog claim verification:
- **vendor-management / bordereaux / resiliency-hub:** The P1 commit message (`fb6a374`) explicitly claims: *"Step 3 (Fix 3 orphaned sidebar items) — vendor-management, bordereaux-validation, resiliency-hub router cases"*. This claim was **TRUE at commit time** but was **silently undone 13 hours later** by P2 commit `ec4c992` and never restored. **The worklog has NO entry acknowledging this regression.**
- **user-settings / admin-settings:** NO worklog entry exists claiming these were ever fixed. The only AdminPanel.tsx worklog mentions (lines 400, 430) are cosmetic marketing-text rewording ("Ollama/5-Brain" → "Secure backend AI").

---

## 5.4 Prioritized Fix Plan

### P0 — Critical (Fix immediately — regulatory blockers / security / data loss)
**None.** No security breaches, data loss, or regulatory bypasses were found. The audit trail integrity remains `valid: true` (the 1 missingHash is separate from violations).

### P1 — High (Must fix before UAT sign-off — core workflow broken)

| # | Issue | Fix | Effort | Dependency |
|---|-------|-----|--------|------------|
| 1 | Vendor Risk broken | Re-add lazy import + switch case to `page.tsx` | S (~15 min) | None |
| 2 | Resiliency Hub broken | Re-add lazy import + switch case | S (~15 min) | None |
| 3 | Bordereaux broken | Re-add lazy import + switch case | S (~15 min) | None |
| 4 | My Profile broken | Re-add switch case + wire `MOCK_PROFILE` to `/api/users/me` + add `/api/users/sessions` endpoint | M (~2-3 hr) | None |
| 5 | Admin Panel broken | Re-add switch case + wire `initialUsers` to `/api/users` + wire Config tab to `/api/admin/ai-config` | M (~3-4 hr) | None |
| 6 | CommandMenu wrong targets | Fix 2 `navigate()` calls in `CommandMenu.tsx` | S (~5 min) | Must pair with Issues 4, 5 |
| 7 | Audit integrity regression (1 missingHash) | Run `node scripts/backfill-audit-hashes.mjs` | S (~2 min) | None |
| 8 | 3 empty-data sections (vendors, bcp, bordereaux) | Add seed entries to `prisma/seed-uat.ts` | M (~2-3 hr) | After Issues 1-3 wired |

**Total P1 effort: ~8-11 hours.** Issues 1-3 + 6 + 7 can be done in parallel (~30 min total). Issues 4, 5, 8 are sequential (~7-10 hr).

**Recommended fix batch:** Fix Issues 1-3 + 6 + 7 first (the "quick wins" — ~30 min, restores 3 regulatory sections + fixes command palette + restores audit integrity). Then fix Issues 4, 5 (the "data-layer work" — ~5-7 hr). Then fix Issue 8 (seed data — ~2-3 hr).

### P2 — Medium (Should fix soon — workaround exists)

| # | Issue | Fix | Effort |
|---|-------|-----|--------|
| 9 | Integration adapters in simulation mode | Document in runbook; optionally configure env vars | S (~15 min doc) |

### P3 — Low (Nice to have — cosmetic / hygiene)

| # | Issue | Fix | Effort |
|---|-------|-----|--------|
| 10 | Test artifact in GoAML data | Delete `AUTH-BYPASS-PROBE-*` record | S (~5 min) |
| 11 | Dead code (unused CommandMenu.tsx) | Delete or migrate `NAV_ITEMS` pattern | S (~10 min) |

---

## 5.5 Prevention Recommendations

### 1. CI Check: Sidebar → Render Case Verification (HIGHEST PRIORITY)

**Problem:** 5 sidebar nav items had no render case in the dispatcher switch. This was not caught by any automated check.

**Recommendation:** Add a CI script (`scripts/check-nav-routing.ts`) that:
1. Extracts all nav IDs from `Sidebar.tsx` (the `{ id, label, icon }` objects)
2. Reads `page.tsx`'s `renderSection()` switch and extracts all `case '<id>':` literals
3. Asserts that every sidebar ID has a corresponding switch case
4. Fails the CI build if any sidebar ID is missing a render case

This would have caught the P2 commit regression (`ec4c992`) before it merged. **Estimated effort: ~2 hours.** This should be the first item in the v7.3.1 backlog.

### 2. CI Check: Lazy Import ↔ Switch Case Consistency

**Problem:** The P2 commit deleted lazy imports but the switch cases referencing them were also deleted — no check verifies that every lazy import has a switch case and vice versa.

**Recommendation:** Extend `check-nav-routing.ts` to also verify: every `React.lazy(() => import(...))` in `page.tsx` is referenced by at least one `case` in the switch, and every `case` references a lazy import that exists.

### 3. Code Review Checklist: "Accidental Revert" Detection

**Problem:** Commit `ec4c992` deleted 120 lines of P1 work while adding 800 lines of P2 work. The deletions were not mentioned in the commit message and were not caught by review.

**Recommendation:** Add a code review checklist item: *"If this PR deletes code from a prior sprint, the commit message MUST explicitly state what is being removed and why."* Enforce via a PR template that requires the author to check a box: "I have verified this PR does not accidentally revert prior sprint work."

### 4. Worklog Discipline: Regression Acknowledgement

**Problem:** The worklog's P2 entry claims "0 lint errors" but never mentions that 10 lazy imports + 10 switch cases + 7 sidebar items were deleted. The P1 sprint's work was effectively undone silently.

**Recommendation:** The worklog MUST be updated when a commit reverts prior work. Add a "Regressions Introduced" section to each worklog entry. If a commit deletes code that a prior commit added, the worklog entry for the deleting commit must reference the prior commit and explain why the deletion is intentional (or flag it as accidental).

### 5. Automated Navigation Smoke Test

**Problem:** The 5 broken sections were only discovered when stakeholders reported them. No automated test navigates to each sidebar item and verifies the correct component renders.

**Recommendation:** Add an integration test (Playwright or similar) that:
1. Logs in as admin
2. Clicks each of the 36 sidebar nav items
3. Verifies the rendered page title/content matches the expected component (not the Command Center default)
4. Fails if any nav item renders the wrong component

This would catch both the missing render cases AND the CommandMenu wrong-target issue. **Estimated effort: ~4-6 hours.**

### 6. Seed Data Completeness Check

**Problem:** 3 of 5 broken sections have 0 backing data. Even after wiring, they show empty states.

**Recommendation:** Add a `scripts/check-seed-completeness.ts` script that verifies every Prisma model referenced by an API endpoint has at least N seed records (configurable threshold). Run it after `prisma/seed-uat.ts` and fail if any model is empty. This ensures UAT testers always see real data.

### 7. The 14-Route Audit Logging Gap (v7.3.1 Mandate — Reiterated)

**Problem:** The audit integrity regression (Issue 8) was caused by `/api/cbuae-submission-checker` bypassing `createAuditLog()`. This is the documented Issue 7 from the runbook — 14+ routes bypass the canonical helper.

**Recommendation (per user's v7.3.1 mandate):**
- Migrate all 14 routes to use `createAuditLog()` (first workstream in v7.3.1)
- After v7.3.1, `missingHashCount` becomes a **hard CI gate** (not just `violations`)
- Run the idempotent backfill script as part of the v7.3.1 deployment

This is non-optional compliance debt.

---

## Appendix A: Investigation Artifacts

| Artifact | Location |
|----------|----------|
| Restore point tag | `v7.3.0-uat-gap-analysis-restore-point` @ `1380767` |
| This report | `GAP_ANALYSIS_REPORT.md` |
| Worklog entry | Appended to `worklog.md` as Task ID `GAP-ANALYSIS` |
| No code changes | Working tree clean (verified after investigation) |
| No database changes | No migrations, no schema changes (1 throwaway DB-count script was created + deleted by a subagent) |

## Appendix B: Sections Reported Broken but Actually Working

The stakeholder report listed 10 broken sections. Investigation confirmed **4 are actually working**:

| Section | Status | Evidence |
|---------|--------|----------|
| AML Assessment | ✅ WORKING | `AMLSelfAssessment.tsx` (560 lines) imported at `page.tsx:33`, render case at L101. `GET /api/aml` → 200. |
| Maker-Checker | ✅ WORKING | `MakerCheckerQueue.tsx` (1222 lines) imported at `page.tsx:27`, render case at L91. `GET /api/maker-checker` → 200, 11 records. |
| Submission Checker | ✅ WORKING | `CBUAESubmissionChecker.tsx` (797 lines) imported at `page.tsx:40`, render case at L119. `GET /api/cbuae-submission-checker` → 200. |
| War Room | ✅ WORKING | `EvidenceWarRoom.tsx` (1049 lines) imported at `page.tsx:16`, render case at L71. (Note: the sidebar label "War Room" at L75 uses nav id `unified-workspace` → `UnifiedWorkspace.tsx`, also wired at L121 — both work.) |

**Over-reporting rate: 44%** (4 of 9 reported sections were functional). The reports may have been based on the CommandMenu wrong-target issue (Issue 6) — a user pressing Ctrl+K and selecting "Manage Users (Admin)" lands on the AI Agent page, which could be mistaken for a broken Admin Panel.

## Appendix C: Complete Nav Item Status Matrix (36 items)

| # | Nav ID | Label | Group | Status |
|---|--------|-------|-------|--------|
| 1 | `command-center` | Command Center | *(top)* | ✅ Wired |
| 2 | `regulatory-intelligence` | AI Regulatory Intel | *(top)* | ✅ Wired |
| 3 | `aml-sanctions` | AML & Sanctions | *(top)* | ✅ Wired |
| 4 | `evidence-war-room` | Evidence War Room | *(top)* | ✅ Wired |
| 5 | `claims-portals` | Claims Portals | *(top)* | ✅ Wired |
| 6 | `regulatory-tracker` | CBUAE Tracker | Compliance Modules | ✅ Wired |
| 7 | `policies-sops` | Policies & SOPs | Compliance Modules | ✅ Wired |
| 8 | `labor-law` | Labor Law | Compliance Modules | ✅ Wired |
| 9 | `legal-advisory` | Legal Advisory | Compliance Modules | ✅ Wired |
| 10 | `training-certifications` | Training & Certs | Compliance Modules | ✅ Wired |
| 11 | `training-effectiveness` | Effectiveness | Compliance Modules | ✅ Wired |
| 12 | `compliance-audits` | Compliance Audits | Compliance Modules | ✅ Wired |
| 13 | `adverse-media` | Adverse Media | Compliance Modules | ✅ Wired |
| 14 | `vendor-management` | Vendor Risk | Enterprise | ❌ **BROKEN** (Issue 1) |
| 15 | `resiliency-hub` | Resiliency Hub | Enterprise | ❌ **BROKEN** (Issue 2) |
| 16 | `bordereaux-validation` | Bordereaux | Strategic | ❌ **BROKEN** (Issue 3) |
| 17 | `goaml-filing` | goAML Filing | UAE Regulatory | ✅ Wired |
| 18 | `maker-checker` | Maker-Checker | UAE Regulatory | ✅ Wired |
| 19 | `cbuae-submission-checker` | Submission Checker | UAE Regulatory | ✅ Wired |
| 20 | `unified-workspace` | War Room | UAE Regulatory | ✅ Wired |
| 21 | `corporate-kyc` | Corporate KYC | KYC Onboarding | ✅ Wired |
| 22 | `individual-kyc` | Individual KYC | KYC Onboarding | ✅ Wired |
| 23 | `ubo-visualization` | UBO Ownership | KYC Onboarding | ✅ Wired |
| 24 | `audit-trail` | Audit Trail | Tools | ✅ Wired |
| 25 | `risk-matrix` | Risk Matrix | Tools | ✅ Wired |
| 26 | `ai-agent` | AI Agent Mgmt | AI & Reporting | ✅ Wired |
| 27 | `quarterly-reporting` | CBUAE Reporting | AI & Reporting | ✅ Wired |
| 28 | `aml-assessment` | AML Assessment | Assessment & Analytics | ✅ Wired |
| 29 | `advanced-analytics` | Risk Analytics | Assessment & Analytics | ✅ Wired |
| 30 | `theme-settings` | Theme Settings | Assessment & Analytics | ✅ Wired |
| 31 | `security-center` | Security Center | Production Ops | ✅ Wired |
| 32 | `uat-handover` | UAT & Handover | UAT & Release | ✅ Wired |
| 33 | `ingestion-engine` | RCM Ingestion | UAT & Release | ✅ Wired |
| 34 | `help-docs` | Help & Docs | Help | ✅ Wired |
| 35 | `user-settings` | My Profile | Account | ❌ **BROKEN** (Issue 4) |
| 36 | `admin-settings` | Admin Panel | Account | ❌ **BROKEN** (Issue 5) |

**Summary: 31 wired / 5 broken. All 5 broken items fall through to `<CommandCenter />` default.**

---

## Next Steps

**Per the user's directive: "Do not proceed with fixes until the full report is complete and reviewed."**

This report is now complete. The investigation was entirely read-only — zero code changes were made. The restore point `v7.3.0-uat-gap-analysis-restore-point` @ `1380767` is verified intact.

**Awaiting review and authorization to proceed with the prioritized fix plan (§5.4).**

The recommended fix sequence:
1. **Quick wins batch (~30 min):** Fix Issues 1, 2, 3, 6, 7 — restores 3 regulatory sections + command palette + audit integrity
2. **Data-layer batch (~5-7 hr):** Fix Issues 4, 5 — wires My Profile + Admin Panel to real APIs
3. **Seed data batch (~2-3 hr):** Fix Issue 8 — adds demo data for vendors, BCP, bordereaux
4. **Hygiene batch (~20 min):** Fix Issues 9, 10, 11 — test artifact cleanup + dead code + integration docs

All fixes must follow the UAT Rules of Engagement: commit + tag (`v7.3.0-uat-hotfix-N`) + document in runbook + notify stakeholders to re-test.
