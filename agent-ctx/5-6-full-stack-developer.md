# Task 5-6: GAP 4.3 (Tuning Sandbox) + GAP 4.4 (QA Sampling) API Routes

## Agent: full-stack-developer

## Files Created

### GAP 4.3: Tuning Sandbox
1. `/src/app/api/tuning/proposals/route.ts` — GET (list, filter, paginate) + POST (create, auto-number)
2. `/src/app/api/tuning/proposals/[id]/route.ts` — GET single proposal
3. `/src/app/api/tuning/proposals/[id]/simulate/route.ts` — POST shadow simulation (AMLAlert riskScore comparison)
4. `/src/app/api/tuning/proposals/[id]/submit/route.ts` — POST submit for MLRO approval
5. `/src/app/api/tuning/proposals/[id]/approve/route.ts` — POST MLRO approve/reject with maker-checker

### GAP 4.4: QA Sampling
6. `/src/app/api/qa/sample/route.ts` — POST generate stratified random sample
7. `/src/app/api/qa/samples/route.ts` — GET list with findings count
8. `/src/app/api/qa/samples/[id]/route.ts` — GET details with findings + summary stats
9. `/src/app/api/qa/findings/route.ts` — POST create immutable finding (WORM: PUT/DELETE blocked)

## Key Design Decisions
- All routes use `withRBAC` from `@/lib/compliance/rbac` for permission enforcement
- RBAC permissions: canManageRuleTuningProposals, canApproveRuleTuningProposals, canManageQASampling, canReviewQAFindings
- SHA-256 hashes computed for all mutations (proposal creation, simulation, approval, sample generation, findings)
- Maker-Checker: Proposer cannot approve their own tuning proposal
- WORM: QA Findings are immutable — PUT/DELETE return 405 with regulatory reference
- Stratified sampling: Fisher-Yates shuffle within each risk-level stratum, proportional allocation
- Simulation: Counts AMLAlerts with riskScore >= threshold for current vs proposed values
- AuditLog entries on all mutations

## Status: COMPLETED
