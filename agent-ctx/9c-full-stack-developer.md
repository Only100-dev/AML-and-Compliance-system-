# Task 9c — GAP 4.5 (Dept Head Inbox) & GAP 4.6 (CAP Kanban Board) — Frontend

## Agent: full-stack-developer

## Files Created
- `/src/components/ic-os/portals/DeptHeadInbox.tsx` — GAP 4.5 Dept Head Digital Acknowledgment Inbox
- `/src/components/ic-os/portals/CAPKanban.tsx` — GAP 4.6 Issue/CAP Kanban Board

## Files Modified
- `/src/app/page.tsx` — Added lazy imports + switch cases for both components

## GAP 4.5: DeptHeadInbox Component
- Card-based expandable inbox with GET /api/dept-head/inbox
- SLA countdown indicators (🟢🟡🔴) for Acknowledgment SLA (5bd) and Action Plan SLA (10bd)
- Overdue items: red border, "OVERDUE" badge, pulse animation
- Escalated items: amber border, "ESCALATED" badge with target/reason
- Acknowledge button with confirmation dialog → POST /api/dept-head/acknowledge
- Action Plan submission form (actions, owner, targetDate) → POST /api/dept-head/action-plan
- "Check SLAs" button (MLRO/CM only) → POST /api/dept-head/check-sla
- Stats cards (Total, Pending, Overdue, Escalated, Acknowledged, Action Plan Due)
- RBAC: canManageDeptHeadInbox permission check

## GAP 4.6: CAPKanban Component
- 4-column Kanban: TODO (slate), IN_PROGRESS (blue), REMEDIATED (amber), AUDIT_VERIFIED (green)
- GET /api/cap/plans integration with grouped data
- CAP Cards with priority/risk badges, assignee, due date SLA, source reference
- Create CAP Dialog → POST /api/cap/plans
- CAP Detail Dialog with State Transition History timeline
- State transition workflow with reason/evidence → POST /api/cap/plans/[id]/transition
- Maker-Checker for AUDIT_VERIFIED: AlertDialog with 4-eyes notice + canAuditVerifyCAP permission
- Invalid transitions blocked per FDL 10/2025 workflow

## Lint
- 0 errors in new files
- 1 pre-existing warning (TrainingCertifications.tsx)
