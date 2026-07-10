# Task 7-8: GAP 4.5 + GAP 4.6 API Routes

## Summary
Created all API routes for Phase E features: Dept Head Inbox (GAP 4.5) and CAP Kanban Board (GAP 4.6).

## Files Created
1. `/src/lib/compliance/business-days.ts` — UAE business days utility (Fri/Sat weekend)
2. `/src/app/api/dept-head/inbox/route.ts` — GET inbox with SLA countdown and auto-overdue
3. `/src/app/api/dept-head/acknowledge/route.ts` — POST acknowledge circular
4. `/src/app/api/dept-head/action-plan/route.ts` — POST submit action plan
5. `/src/app/api/dept-head/check-sla/route.ts` — POST batch SLA check (cron-like)
6. `/src/app/api/cap/plans/route.ts` — GET list (grouped) + POST create CAP
7. `/src/app/api/cap/plans/[id]/route.ts` — GET CAP details with state history
8. `/src/app/api/cap/plans/[id]/transition/route.ts` — POST transition CAP status

## Key Decisions
- Used `authGuard` + `checkPermission` pattern instead of `withRBAC` wrapper due to Next.js 16 incompatibility (new NextRequest constructor fails with private member access)
- All routes follow existing codebase patterns (TFS, DMLRO, SLA evaluate)
- UAE business days: Friday + Saturday are weekend per UAE Federal Decree-Law No. 33 of 2021
- CAP state machine is STRICT: only 4 defined transitions allowed, terminal state (AUDIT_VERIFIED) has no valid transitions

## Test Results
- All 7 endpoints tested and working
- Invalid state transitions correctly return 400
- Validation errors correctly return 400
- Not-found correctly returns 404
- Full lifecycle tested: TODO → IN_PROGRESS → REMEDIATED → AUDIT_VERIFIED
