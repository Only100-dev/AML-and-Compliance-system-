# Task 1 - full-stack-developer

## Task: Add all missing Phase 5 API query hooks to query-hooks.ts

## Summary
Successfully added all 11 missing Phase 5 API query hooks to `/home/z/my-project/src/lib/query-hooks.ts`.

## Changes Made

### File: `/home/z/my-project/src/lib/query-hooks.ts`
- **Added 11 query keys** to the `queryKeys` factory object (lines 64-74):
  - `complianceCalendar`, `attestations`, `remediations`, `goamlXml`, `policyWizard`, `complianceCases`, `notifications`, `riskAssessment`, `vaspKyc`, `regulatoryDeadlines`, `idempotency`

- **Added 9 GET query hooks** (lines 866-1171):
  1. `useComplianceCalendar` - filters: eventType, status, priority, dateFrom, dateTo
  2. `useAttestations` - filters: policyId, userId, status
  3. `useRemediations` - filters: auditId, status, priority, assignedToId
  4. `useComplianceCases` - filters: caseType, status, riskLevel, assignedToId, page, limit (paginated)
  5. `useNotifications` - filters: userId, type, isRead, priority, page, limit (paginated)
  6. `useRiskAssessment` - filters: domain, category, inherentRisk, residualRisk
  7. `useVASPKYC` - filters: vaspType, riskRating, status, travelRuleCompliant
  8. `useRegulatoryDeadlines` - filters: deadlineType, status, jurisdiction
  9. `useIdempotency` - filters: operationType, page, limit (paginated)

- **Added 2 POST mutation hooks** (lines 949-995):
  1. `useGoAMLXml` - mutation with reportType, entityId?, transactionData?
  2. `usePolicyWizard` - mutation with step (6 steps), policyId?, data?

## Patterns Followed
- GET hooks: `useQuery` + `apiFetch` + `URLSearchParams` + `{ data, loading, error, refetch }` return
- Mutation hooks: `useMutation` + `apiMutate` + `queryClient.invalidateQueries` + `{ mutate, loading, error }` return
- Paginated endpoints return `{ items: Array, pagination: { page, limit, total, totalPages } }`
- All changes are strictly additive — zero modifications to existing code

## Verification
- Lint: 0 errors, 0 warnings
- File grew from 854 → 1172 lines (+318 lines)
