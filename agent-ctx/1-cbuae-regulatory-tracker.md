# Task 1 — CBUAE Regulatory Tracker Persistence

## Summary
Completed the CBUAE Regulatory Tracker persistence feature following the Golden Path pattern (Zod validation + authGuard + Prisma + React Query mutations + cache invalidation).

## Files Modified

1. **`/src/lib/validations/regulation.ts`** — Updated RegulationCreateSchema with task-specified fields (title max 500, issuer enum with 4 values, category required, effectiveDate required, complianceStatus/PRIORITY defaults). Preserved RegulationUpdateSchema.

2. **`/src/app/api/regulations/route.ts`** — Enhanced POST handler with authGuard (admin/mlro/compliance_officer/compliance_manager), Zod safeParse (422 on failure with fieldErrors), duplicate title check (409), and 201 response with message. GET/PUT/DELETE handlers unchanged.

3. **`/src/lib/api-hooks.ts`** — Added `useCreateRegulation()` mutation hook using @tanstack/react-query useMutation + useQueryClient. Imports ApiMutationError and queryKeys from ./query-hooks. Invalidates regulations cache on success.

4. **`/src/components/ic-os/regulatory/CBUAERegulatoryTracker.tsx`** — Replaced mock handleSubmitRegulation with real async mutation. Added Loader2 loading spinner on submit button. Error handling: 409→Duplicate toast, 422→Validation toast with field messages, other→generic error toast.

## Verification
- `bun run lint` — passes clean (0 errors, 0 warnings)
- Dev server compiles without errors
- All existing functionality preserved (GET/PUT/DELETE handlers, RegulationUpdateSchema)
