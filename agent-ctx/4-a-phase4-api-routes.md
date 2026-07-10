# Task 4-a: Phase 4 API Routes — Multi-Jurisdictional FIU Filing

## Agent: Phase 4 API Routes Agent

## Summary

Built 4 API route files that extend the platform from UAE-only goAML filing to multi-jurisdictional FIU filing across all 6 GCC countries (AE, SA, BH, QA, OM, KW).

## Files Created

1. **`/src/app/api/fiu/route.ts`** — Generic FIU Filing CRUD
   - GET /api/fiu?jurisdiction=BH&status=draft — List filings by jurisdiction
   - POST /api/fiu — Create filing with deadline calculation
   - PUT /api/fiu — Update filing (with immutability guard)

2. **`/src/app/api/fiu/submit/route.ts`** — Generic FIU Submission
   - POST /api/fiu/submit — Submit APPROVED filing to FIU via adapter
   - Auth: admin, mlro ONLY (PRINCIPLE F)
   - Manual fallback + ComplianceAlert on failure (PRINCIPLE E)

3. **`/src/app/api/fiu/approve/route.ts`** — MLRO Approval (Maker-Checker)
   - POST /api/fiu/approve — 4-Eyes workflow enforcement
   - Actions: submit_for_review, approve, reject
   - 4-Eyes: maker ≠ checker verification

4. **`/src/app/api/fiu-submission-checker/route.ts`** — Jurisdiction-Aware Submission Checker
   - GET /api/fiu-submission-checker?jurisdiction=BH&reportType=sar_filing
   - 6 common checks + jurisdiction-specific checks via adapter.validateFiling()

## Design Decisions

- Uppercase status values (DRAFT, PENDING_REVIEW, APPROVED) for DB consistency with existing GoAMLFiling model
- Action-based RBAC in approve route: different roles for different actions
- Adapter factory lazy-loading for efficient memory usage
- SHA-256 integrity hash on submission payload
- ComplianceAlert with severity='critical' on manual fallback (PRINCIPLE E)

## Verification

- ESLint: 0 errors on new files
- All 4 endpoints compile and respond
- No existing files modified
