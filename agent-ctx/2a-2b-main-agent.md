# Task 2a-2b: False Positive Bulk Adjudication & Third-Party Surrender Block

## Summary
Implemented Phase 2 tasks 2.1 and 2.2 for the IC-OS platform (GCC Insurance AML/CFT compliance).

## Files Created
- `/home/z/my-project/src/app/api/alerts/bulk-adjudicate/route.ts` — POST endpoint for bulk false positive adjudication
- `/home/z/my-project/agent-ctx/2a-2b-main-agent.md` — This work log

## Files Modified
- `/home/z/my-project/src/components/ic-os/aml/AMLSanctionsTriage.tsx` — Added bulk selection + floating toolbar
- `/home/z/my-project/src/app/api/claims/route.ts` — Added third-party early surrender block logic
- `/home/z/my-project/src/components/ic-os/claims/ClaimsPortals.tsx` — Added ThirdPartySurrenderBlockModal

## Details

### Task 2.1: False Positive Bulk Adjudication
- API: Zod-validated POST with alertIds (non-empty), decision ('FALSE_POSITIVE'), bulkJustification (min 20 chars), userId/userName
- Common attribute validation: checks same aiFlags/sanctions name hit, same alertType, OR same jurisdiction — rejects with 400 if none shared
- Uses Prisma `updateMany` to close all matching alerts
- Creates single SHA-256 audit log entry via `createAuditLog`
- Frontend: Added `selectedAlertIds` Set state, checkbox per AlertCard, floating sticky toolbar with count/justification input/dismiss button
- Toolbar: cyan/emerald accent, backdrop-blur, sticky top positioning, 20-char justification validation
- On success: invalidates AML alerts query cache, clears selection

### Task 2.2: Early Surrender & Third-Party Payout Block
- API PATCH: Added payoutBankAccount, originalPremiumBankAccount, daysSinceIssuance, userId to Zod schema
- Hard business rule: surrender claims with daysSinceIssuance < 30 AND payoutBankAccount !== originalPremiumBankAccount → PENDING_MLRO_REVIEW
- Audit log created for the block
- Returns `{ blocked: true, reason: 'THIRD_PARTY_EARLY_SURRENDER', requiresMLROEDD: true }`
- Frontend: ThirdPartySurrenderBlockModal with pulsing red border, dark red overlay, regulatory references (QCB §4.1, CBUAE Insurance Regulations)
- Modal has "Submit for MLRO EDD Review" and "Cancel Surrender" buttons
- wrappedUpdateClaim in ClaimsPortals detects `blocked: true` response and triggers modal

## Lint
- 0 errors, 1 pre-existing warning (TanStack Virtual incompatible library in TrainingCertifications.tsx)

## API Verification
- POST /api/alerts/bulk-adjudicate: Returns 404 for non-existent alerts (validation working)
- PATCH /api/claims: Returns 404 for non-existent claims (existing behavior preserved)
- Surrender block logic verified: code path checked, Zod validation confirmed
- Main page: 200 OK

## Dev Server
- Compiles cleanly, no runtime errors
