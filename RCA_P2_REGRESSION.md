# Root Cause Analysis — P2 Commit `ec4c992` Silent Regression

**Date:** 2026-06-20
**Author:** Main Orchestrator (UAT Hotfix Phase)
**Trigger:** Full System Gap Analysis revealed 5 sidebar sections broken; git history traced the regression to a single P2 commit.
**Severity:** P1 (process failure — 3 regulatory sections broken, would have failed a CBUAE audit if shipped to production)
**Restore Point:** `v7.3.0-uat-pre-hotfix-restore-point` @ `c4d8f31`

---

## 1. Executive Summary

Commit `ec4c992` ("feat(P2): Complaint Management + DMS Hardening + RBAC CI Guard", authored 2026-06-19 07:15 UTC) silently reverted the entirety of the P1 "Wire the Orphans" sprint's frontend wiring. In a single 962-file commit, it deleted:

- **10 lazy imports** from `src/app/page.tsx`
- **10 switch cases** from the `renderSection()` function in `src/app/page.tsx`
- **7 sidebar nav items** from `src/components/ic-os/layout/Sidebar.tsx`

The deletion was unacknowledged in both the commit message and the worklog. The P2 verification suite — which claimed "all green" — tested only the new Complaint Management module and never regression-tested the existing 31 sidebar items. The regression went undetected for **13 hours** until the Full System Gap Analysis caught it.

**This is not just a bug. It is a process failure** in three dimensions: (1) the commit was too large to review, (2) the verification was scoped to new features only, (3) no automated guard existed to catch sidebar/render-case drift. This RCA documents the root cause and the prevention measures now in place.

---

## 2. What Was Deleted (The Evidence)

### 2.1 The P1 Sprint (`073b2ef`, 2026-06-18 21:46 UTC) ADDED:

```diff
+ // P1 Step 1 — Unified "My Tasks" inbox
+ const MyTasks = lazy(() => import('@/components/ic-os/tasks/MyTasks')...);
+
+ // P1 Step 3 — Orphaned sidebar items (components already existed; just needed router cases)
+ const VendorManagement = lazy(() => import('@/components/ic-os/tprm/VendorManagement')...);
+ const UploadBordereaux = lazy(() => import('@/components/ic-os/bordereaux/UploadBordereaux')...);
+ const ResiliencyHub = lazy(() => import('@/components/ic-os/resiliency/ResiliencyHub')...);
+
+ // P1 Step 2 — Wire the Orphans: 6 new UIs for previously-orphaned backend APIs
+ const CAPKanban = lazy(...);
+ const ComplianceAlerts = lazy(...);
+ const DeptHeadInbox = lazy(...);
+ const PolicyAttestations = lazy(...);
+ const BoardPortal = lazy(...);
+ const DataRoomGenerator = lazy(...);
```

Plus 10 corresponding `case '<id>':` entries in the `renderSection()` switch, and 7 sidebar nav items.

### 2.2 The P2 Sprint (`ec4c992`, 2026-06-19 07:15 UTC) DELETED all of the above:

```diff
- // P1 Step 1 — Unified "My Tasks" inbox
- const MyTasks = lazy(...);
-
- // P1 Step 3 — Orphaned sidebar items
- const VendorManagement = lazy(...);
- const UploadBordereaux = lazy(...);
- const ResiliencyHub = lazy(...);
-
- // P1 Step 2 — Wire the Orphans: 6 new UIs
- const CAPKanban = lazy(...);
- const ComplianceAlerts = lazy(...);
- const DeptHeadInbox = lazy(...);
- const PolicyAttestations = lazy(...);
- const BoardPortal = lazy(...);
- const DataRoomGenerator = lazy(...);
```

Plus all 10 `case` entries and 7 sidebar items. The diff is a verbatim reversal of the P1 additions.

### 2.3 The P2 Commit Was Enormous

`git show ec4c992 --stat` reports: **962 files changed, 226,152 insertions(+), 5,585 deletions(-)**. The page.tsx deletion (−47 lines) was buried among 962 files. A human reviewer scanning the diff would have to scroll past hundreds of file headers to reach page.tsx, and the commit message gave no hint that page.tsx was touched at all.

---

## 3. Timeline

| Time (UTC) | Event |
|------------|-------|
| 2026-06-18 21:46 | P1 commit `073b2ef` — "Wire the Orphans" — adds 10 lazy imports + 10 cases + 7 sidebar items. Worklog entry documents the wiring. Verification: "Browser E2E: all 6 new sections render with 0 console errors." |
| 2026-06-19 07:15 | P2 commit `ec4c992` — "Complaint Management + DMS Hardening + RBAC CI Guard" — 962-file commit. Silently deletes the P1 frontend wiring. Worklog entry (1434 lines changed) focuses entirely on Complaint Management + DMS + RBAC. **No mention of page.tsx or Sidebar.tsx deletions.** Verification claims "Agent Browser: list/detail/intake/transition all render" — but this only tests the NEW Complaint module, not the 31 existing sidebar items. |
| 2026-06-19 07:15 → 2026-06-20 ~07:00 | **13-hour undetected regression window.** No user/stakeholder clicks Vendor Risk / Resiliency Hub / Bordereaux during this window. The silent fallthrough (default → CommandCenter) produces no error, so no alarm fires. |
| 2026-06-20 ~07:00 | Stakeholder reports "multiple critical sections not active." Full System Gap Analysis begins. |
| 2026-06-20 (gap analysis) | Root cause traced to `ec4c992`. 5 sections confirmed broken (sidebar exists, case missing); 7 sections confirmed invisible (both sidebar + case deleted). |
| 2026-06-20 (this RCA) | Prevention measures implemented; hotfix batches authorized. |

---

## 4. Root Cause Analysis

### 4.1 Why the Deletion Happened (Technical Root Cause)

The P2 commit was a **bulk operation** (962 files, 226K insertions). The signature indicators:

- Commit author is `Z User <z@container>` (automated agent, not a human).
- Several files show `0` lines changed (mode-touch only): `MyTasks.tsx | 0`, `audit-actor.ts | 0` — characteristic of a bulk file-touching operation.
- The page.tsx deletion is a **verbatim reversal** of the P1 additions — not a surgical edit. This indicates the P2 operation regenerated `page.tsx` from a **stale template** (the pre-P1 version) and then layered the P2 Complaint Management content on top, rather than editing the current (P1-era) file in place.

**Most likely sequence:**
1. The P2 agent scaffolded Complaint Management + DMS + RBAC work.
2. When integrating into `page.tsx`, it used a cached/stale copy of page.tsx (pre-P1) as the base.
3. It added the Complaint Management render case to this stale base.
4. It overwrote the live page.tsx with this stale-plus-complaint version — annihilating the P1 wiring.
5. The same happened to Sidebar.tsx (stale version overwrote the P1-era version with 7 new items).

### 4.2 Why It Wasn't Caught (Process Root Cause)

Three independent process failures all had to occur for this to ship:

| # | Process Gap | What Should Have Happened |
|---|-------------|---------------------------|
| 1 | **No regression test for navigation rendering.** The P2 verification tested only the new Complaint module. No test clicked the other 31 sidebar items to confirm they still render. | A navigation smoke test (now implemented as Prevention 2.3) should click every sidebar item and assert the target component renders. |
| 2 | **No CI guard for sidebar ↔ render-case parity.** Nothing verified that every sidebar item has a matching `case` in page.tsx. | A static-analysis check (now implemented as Prevention 2.1, wired into `bun run lint`) should fail the build if any sidebar item lacks a render case. |
| 3 | **Code review did not flag the page.tsx deletion.** The 962-file diff was too large for meaningful human review, and the commit message gave no hint that page.tsx was touched. | The PR template (now implemented as Prevention 2.2) requires the author to explicitly disclose any deletion of switch cases, lazy imports, or sidebar items. The worklog template (Prevention 2.4) requires a Regressions section. |

Any ONE of these three guards would have caught the regression. All three were absent.

### 4.3 Why It Stayed Hidden for 13 Hours

- The regression is a **silent fallthrough**: clicking "Vendor Risk" renders `<CommandCenter/>` (the default case) instead of throwing an error. There is no error boundary triggered, no console error, no 500.
- The audit-integrity checker (`check:audit`) only verifies `createAuditLog()` usage on state-changing API routes — it does NOT inspect frontend rendering.
- No stakeholder happened to click the affected sections during the 13-hour window. When one finally did, the report was anecdotal ("sections not active") rather than a precise error.

---

## 5. Scope of the Regression

### 5.1 Confirmed Broken (5 sections — sidebar item exists, render case missing)

These produce a user-visible symptom (click → wrong page):

| Nav ID | Section | Symptom |
|--------|---------|---------|
| `vendor-management` | Vendor Risk | Click → Command Center (silent fallthrough) |
| `resiliency-hub` | Resiliency Hub | Click → Command Center |
| `bordereaux-validation` | Bordereaux | Click → Command Center |
| `user-settings` | My Profile | Click → Command Center |
| `admin-settings` | Admin Panel | Click → Command Center |

### 5.2 Confirmed Invisible (7 sections — sidebar item AND render case both deleted)

These produce NO user-visible symptom (there is no sidebar item to click). They were part of the P1 "Wire the Orphans" sprint and are now completely absent from the UI:

| Nav ID | Section | Status |
|--------|---------|--------|
| `my-tasks` | Unified My Tasks inbox | Sidebar item + render case both deleted |
| `cap-kanban` | CAP Kanban Board | Sidebar item + render case both deleted |
| `compliance-alerts` | Compliance Alerts | Sidebar item + render case both deleted |
| `dept-head-inbox` | Department Head Inbox | Sidebar item + render case both deleted |
| `policy-attestations` | Policy Attestations | Sidebar item + render case both deleted |
| `board-portal` | Board Portal | Sidebar item + render case both deleted |
| `data-room` | Audit Data-Room Generator | Sidebar item + render case both deleted |

**Decision:** The authorized hotfix scope (Batches 1–4) addresses the 5 broken sections. The 7 invisible sections are flagged here for a **separate decision** — restoring them is part of fully undoing the P2 regression, but they were not reported as "broken" by stakeholders (because they're invisible) and are not in the authorized batch list. Per RoE "no feature creep," they are logged for follow-up rather than silently restored. The component files for all 7 still exist on disk (verified), so restoration is low-effort if authorized.

---

## 6. Prevention Measures Implemented (This Session)

All four prevention measures from the user directive are now in place BEFORE any hotfix code changes:

| # | Measure | File | Status |
|---|---------|------|--------|
| 2.1 | CI check: sidebar → render-case verification | `scripts/check-nav-render.ts` (wired into `bun run lint`) | ✅ Implemented |
| 2.2 | PR template with "accidental revert" detection | `.github/pull_request_template.md` | ✅ Implemented |
| 2.3 | Playwright navigation smoke test (all sidebar items) | `e2e/nav-smoke.spec.mjs` (+ `data-sidebar-item` attrs on Sidebar.tsx) | ✅ Implemented (36/36 pass) |
| 2.4 | Worklog template with mandatory Regressions section | `WORKLOG_ENTRY_TEMPLATE.md` | ✅ Implemented |

### 6.1 How the Guards Interlock

- **Prevention 2.1 (static, gating):** Runs on every `bun run lint` (every commit). Catches the regression class statically — even before the dev server starts. Fails fast.
- **Prevention 2.3 (runtime, on-demand):** Runs via `npm run test:e2e:nav`. Clicks every sidebar item in a real browser. Catches regressions that static analysis can't (e.g. a component that renders but throws at runtime).
- **Prevention 2.2 + 2.4 (human, review-time):** The PR template forces the author to disclose deletions; the worklog template forces a Regressions section. These make silent reverts socially impossible.

Together, the three layers (static → runtime → human) ensure this class of regression cannot recur.

---

## 7. Lessons Learned

1. **Bulk commits are the enemy of review.** A 962-file commit is unreviewable by definition. The page.tsx deletion was invisible not because it was hidden, but because it was drowned. **Action:** PR template now asks authors to isolate frontend-wiring changes into their own commit when practical.

2. **"All green" is only meaningful if the test suite covers the regression surface.** The P2 verification tested the new feature and declared victory. It never asked "did I break anything that already worked?" **Action:** Prevention 2.3 (nav smoke test) now regression-tests the entire navigation surface on demand.

3. **Silent fallthroughs are the worst failure mode.** A 500 error or a crash gets caught immediately. A `default: return <CommandCenter/>` fallthrough gets caught only when a human happens to click. **Action:** Prevention 2.1 makes the fallthrough a build failure — you cannot merge a sidebar item without its render case.

4. **Stale-template regeneration is a known footgun for automated agents.** When an agent "integrates" its work by overwriting a file from a cached copy, it annihilates concurrent work. **Action:** Agents must read the CURRENT file before editing (the Edit tool enforces this — it fails if the file hasn't been Read first). The P2 agent appears to have bypassed this by writing a full-file replacement.

5. **The worklog is only as good as its Regressions section.** A worklog that only documents what was ADDED is half a worklog. **Action:** Prevention 2.4 makes the Regressions section mandatory, including for read-only work.

---

## 8. Conclusion

The P2 regression was a confluence of three absent guards. All three are now present. The 5 broken sections will be restored in Batch 1 (render cases) and Batch 2 (data-layer rewiring). The 7 invisible sections are documented here for a separate restoration decision. The platform's audit integrity (the 1 missingHash from cbuae-submission-checker) will be fixed at the root cause (route will call `createAuditLog()`) and the existing NULL-hash entry backfilled.

This RCA is appended to the worklog and referenced in the runbook. It exists not to assign blame — the P2 agent was operating without the guards that would have caught the regression — but to ensure the process gaps are understood and permanently closed.

**"Fix the system, not just the symptoms."**
