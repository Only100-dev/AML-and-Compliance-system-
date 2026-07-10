# Task 7c — Frontend Wiring for Phase 2 Directive 2.3

**Agent**: Frontend Wiring Specialist
**Task**: Wire AdminPanel.tsx UI for new SoD lifecycle approval queue + secure password reset flow
**Status**: Complete

## Scope
Single-file edit: `src/components/ic-os/admin/AdminPanel.tsx` (2040 → 2953 lines, +913 additive).

## Server APIs wired (no server code modified)
- `PATCH /api/users` — 202 Maker-Checker routing for role changes + deactivations
- `GET /api/admin/lifecycle-requests?status=PENDING|ALL` — SoD queue
- `POST /api/admin/approve-lifecycle` — Approve/Reject with rationale
- `POST /api/auth/password-reset/request` — 15-min single-use token generation
- (NOT wired: `POST /api/auth/password-reset/confirm` — that's the user's action, surfaced only as informational text in the result dialog)

## UI deliverables
1. **202 Pending Response Handling** — patchUser helper bypasses the broken useUpdateUser hook (PUT → 405). Edit Role / Suspend / Delete now correctly call PATCH, detect 202, and toast "Maker-Checker approval required" with explanation. User list refreshes; "Pending Approval" badge (amber, Clock icon) shown next to affected users (desktop + mobile).
2. **New "SoD Approvals" Tab** — 4 summary stat cards (Pending/Approved/Rejected/Expired), status filter (PENDING/ALL), Refresh button, max-h-96 scrollable list of lifecycle requests. Each row shows target user, op type, current → requested transition, maker, expiry (with "soon" warning), reviewer (for non-pending), Approve/Reject buttons. Reject opens rationale dialog (≥ 10 chars).
3. **Secure Password Reset Button** — "Reset Password" item in user row dropdown (desktop + mobile). Opens reason dialog (≥ 10 chars). On submit, displays a one-time-token dialog with the raw token, 15-min expiry, copy-to-clipboard button, and explicit "deliver out-of-band, shown only once" warning. NOT auto-confirmed.

## Verification
- `bun run lint`: 0 errors, 2 pre-existing warnings (unrelated TrainingCertifications.tsx)
- `bunx eslint src/components/ic-os/admin/AdminPanel.tsx`: clean
- check:nav-render: 43/43 PASS
- Dev server: compiles cleanly (multiple "✓ Compiled in" entries, no errors)
- File: 0 existing lines removed; all 5 existing tabs + Add-User dialog + AI Config tab preserved

## Key Design Decisions
- **Bypassed `useUpdateUser` hook** with a direct `patchUser` fetch — the existing hook issues PUT but the route is PATCH-only (405). Fixing the hook would require touching query-hooks.ts (out of scope). The patchUser helper reads the HTTP status (critical for 202 detection) which apiMutate doesn't expose.
- **`React.useCallback`** for all new handlers (matches the existing KnowledgeBaseTab pattern in the same file).
- **No new state libraries** — all state is `useState` + `useEffect` + `useMemo`. TanStack Query is used only via the existing useUsers/useCreateUser hooks (left untouched).
- **`displayApiRole()` helper** for the SoD queue — humanises ALL raw API roles (admin/mlro/compliance_officer/compliance_manager/dept_head/board) so the queue is accurate even for roles the legacy UI doesn't expose.
- **Copy-to-clipboard fallback** — tries `navigator.clipboard.writeText` first, falls back to `document.execCommand('copy')` for non-secure (http) preview contexts.
- **Reject/Reason dialogs enforce ≥ 10 chars client-side** — matches the server-side Zod schema (rationale.min(10) for reject, reason.min(10) for password reset). Live character counters shown.

## Files modified
- `src/components/ic-os/admin/AdminPanel.tsx` (only)

## Files NOT modified (per task constraints)
- Any API route in `src/app/api/`
- `src/lib/query-hooks.ts` (broken useUpdateUser hook left as-is)
- `prisma/schema.prisma`
- Any other admin tab component
