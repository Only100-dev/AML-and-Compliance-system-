---
Task ID: 7a
Agent: Frontend Wiring Agent (Phase 2 Directive 2.1 — Disposition Maker-Checker UI)
Date: 2025-01-XX

Task:
Wire the frontend for Phase 2 Directive 2.1 (Sanctions/PEP Disposition Maker-Checker)
in the IC-OS compliance platform. The server-side enforcement (POST /api/aml/disposition
and POST /api/aml/approve-disposition) is ALREADY BUILT. My job is ONLY to wire the UI
so the new disposition flow is visible/usable in the Preview Panel. No server changes.

Files Modified (2):
1. src/components/ic-os/aml/AMLSanctionsTriage.tsx
2. src/components/ic-os/shared/AlertDetailDrawer.tsx

Work Log:
- Read /home/z/my-project/worklog.md tail (Phase 0/1 + hotfix-5 context) and confirmed
  the dev environment is on Postgres + Next.js 16 + React 19 + Tailwind 4.
- Read both target files in full (AMLSanctionsTriage 1263 lines, AlertDetailDrawer 1004 lines).
- Read the new server API routes to understand exact response shapes:
  - /api/aml/disposition → 202 + makerChecker object when CO dismisses (FALSE_POSITIVE).
  - /api/aml/disposition → 200 immediate close when CM/MLRO/admin dismisses.
  - /api/aml/disposition → 200 escalation when TRUE_MATCH.
  - /api/aml/approve-disposition → APPROVED closes alert; REJECTED keeps it open.
  - GET /api/aml now returns 7 new optional fields per alert:
    disposition, dispositionStage, dispositionRationale, dispositionByName,
    dispositionApprovedByName, dispositionApprovedAt, makerCheckerLogId.
- Confirmed shared AMLAlertCase type (src/lib/types.ts) does NOT declare the new
  fields — declared a local extended type (AlertWithDisposition / AMLAlertWithDisposition)
  inside each modified file rather than mutating the shared type, to keep changes
  self-contained and strictly non-breaking.

File 1 — AMLSanctionsTriage.tsx changes:
- Added imports: Dialog (DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle) from @/components/ui/dialog, Textarea from @/components/ui/textarea,
  Label from @/components/ui/label. (All already-existing shadcn/ui components.)
- Added local extended types: DispositionValue, DispositionStage, DispositionFields,
  AlertWithDisposition. Constants APPROVING_ROLES, MIN_DISPOSITION_RATIONALE=20,
  MIN_REJECT_RATIONALE=10.
- Added new self-contained <DispositionPanel alert={...}/> component (~440 lines)
  that renders inside each AlertCard. The panel:
  • Reads currentUser from useICOSStore, queryClient from useQueryClient.
  • Detects role-based permissions: isApprover = admin/mlro/compliance_manager.
  • Detects alert state: isPendingApproval (FALSE_POSITIVE + RECOMMENDED),
    isApprovedFP, isApprovedTM, isRejected.
  • Renders state banner (amber pending / emerald approved-FP / rose approved-TM
    or rejected) with the maker/checker name + rationale snippet when present.
  • Renders "Dismiss (FP)" + "Confirm (TM)" buttons when no disposition recorded.
  • Renders "Approve Dismissal" + "Reject" buttons only when isPendingApproval
    AND isApprover (CM/MLRO/admin).
  • Dialog #1 (Disposition): Textarea with rationale (min 20 chars, live counter
    that turns green at threshold), submit calls POST /api/aml/disposition with
    alertId, disposition, rationale, userId/userName/userRole from currentUser.
    Handles 202 (maker-checker pending) by showing the exact required toast:
    "Disposition recommendation submitted. A Compliance Manager or MLRO must
    approve the dismissal (4-eyes)." Handles 200 paths for TRUE_MATCH escalation
    and CM/MLRO/admin direct-dismissal with appropriate toasts.
  • Dialog #2 (Review): Textarea with rationale (optional on APPROVED, required
    min 10 chars on REJECTED), submit calls POST /api/aml/approve-disposition
    with makerCheckerLogId, alertId, action, rationale.
  • Both flows invalidate the amlAlerts TanStack Query on success so the Kanban
    re-renders with fresh disposition state.
  • All async work uses inline fetch() (matching the existing bulk-adjudicate
    pattern in the same file). No new query hooks added.
- Wired <DispositionPanel alert={alert as AlertWithDisposition}/> into <AlertCard>
  via a <Separator/> + <DispositionPanel/> block at the bottom of CardContent,
  after the existing "Move to…" status menu and before the closing </CardContent>.
  The Kanban layout, drag/drop, existing status transitions, bulk-adjudicate
  toolbar, and AI Flag pills are all UNTOUCHED.

File 2 — AlertDetailDrawer.tsx changes:
- Added local extended type AMLAlertWithDisposition + DispositionValue +
  DispositionStage + AMLAlertDispositionFields.
- Added a compact, read-only Disposition Status Banner between the ScrollArea
  and the SheetFooter (visible across all tabs — details/ai/audit). Renders
  only when unified.kind === 'aml' AND the alert has a disposition or stage set.
  Banner states:
  • FALSE_POSITIVE + RECOMMENDED → amber "Dismissed as FALSE_POSITIVE — Pending
    CM/MLRO approval" + "Recommended by {dispositionByName}" sub-text.
  • FALSE_POSITIVE + APPROVED → emerald "Dismissal Approved" + "Disposal approved
    by {dispositionApprovedByName} on {date}. Alert closed." sub-text.
  • TRUE_MATCH + APPROVED → rose "Confirmed TRUE_MATCH — Escalated" + "Confirmed
    by {dispositionByName} — escalated for SAR filing." sub-text.
  • REJECTED → rose "Dismissal Rejected" + "Dismissal rejected by
    {dispositionApprovedByName}. Alert remains open for re-triage." sub-text.
  • Includes the dispositionRationale as a clipped italic quote when present.
  • Stage is shown as an outlined Badge (RECOMMENDED/APPROVED/REJECTED) for at-
    a-glance status. Tones respect light/dark mode (text-amber-700/300 etc.).
- No duplicate disposition form added (per spec — the form lives in AMLSanctionsTriage).

Verification:
- bun run lint: PASS (0 errors, 2 pre-existing warnings — TanStack Virtual
  useVirtualizer in TrainingCertifications.tsx + AuditTrail.tsx, both unrelated
  to this task and pre-existing per worklog GAP-ANALYSIS-v7.3.0-RC1 §Verification).
- bunx tsc --noEmit: 0 errors in modified files (AMLSanctionsTriage.tsx and
  AlertDetailDrawer.tsx clean). Pre-existing TS errors remain in 6 unrelated
  files (dmlro/status, goaml/xml-integrity, ingestion/commit, ingestion/logs,
  GoAMLFilingCenter, PIIRevealField, audit.ts) — none touched by this task.
- check:nav: 43/43 PASS (unchanged).
- check:audit: 0 FAIL, 21 pre-existing WARN (unchanged).

Stage Summary:
- Two production-ready UI changes that surface the Phase 2 Directive 2.1
  Sanctions/PEP Disposition Maker-Checker flow in the Preview Panel.
- All shadcn/ui primitives used (Dialog, Textarea, Button, Badge, Label) already
  existed in src/components/ui. No new packages installed.
- Zero server code modified. Zero API routes changed. Zero DB schema changes.
- The Kanban board, drag-and-drop, existing status transitions, and the bulk-
  adjudicate toolbar continue to work unchanged. The new DispositionPanel is
  strictly additive — it appears at the bottom of each AlertCard with a
  separator, and only renders interactive controls when no disposition is
  recorded OR when an approver needs to act on a pending dismissal.
- The AlertDetailDrawer banner is also strictly additive — only renders when
  the AML alert has a disposition set, otherwise the drawer looks identical to
  before.

Regressions:
- None. All changes are additive (new component, new banner, new imports).
  No existing imports removed. No existing JSX modified except for the single
  insertion point in AlertCard (Separator + DispositionPanel before
  </CardContent>) and the single insertion point in AlertDetailDrawer (banner
  block between </ScrollArea> and <SheetFooter>). Both insertion points use
  existing patterns from the same file. Verified: lint 0 errors, tsc 0 errors
  in modified files, dev server compiles cleanly (dev.log shows
  "✓ Compiled in 351ms" / "✓ Compiled in 469ms" after the changes).
