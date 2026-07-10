# Task ID: 3 — GAP 3.1 Product Risk Scoring Engine

## Agent: full-stack-developer

## Summary
Implemented GAP 3.1 — Insurance Product AML Risk Scoring Engine with full Golden Path compliance (Prisma → Zod → AuthGuard → React Query → SHA-256 Audit Trail).

## Files Created
1. `/src/app/api/product-risk/route.ts` — GET (list) + POST (create) API routes
2. `/src/app/api/product-risk/[id]/route.ts` — PUT (update) + PATCH (deactivate) API routes
3. `/src/components/ic-os/insurance/ProductRiskScoring.tsx` — Full UI component

## Files Modified
1. `/src/components/ic-os/layout/Sidebar.tsx` — Added phase13Items with Product Risk nav item + Insurance AML section
2. `/src/app/page.tsx` — Added lazy-loaded ProductRiskScoring component + switch case

## API Endpoints Verified
- `GET /api/product-risk` → 200 (paginated, filterable)
- `POST /api/product-risk` → 201 (create with SHA-256 audit + high-risk notification)
- `POST /api/product-risk` (duplicate) → 409
- `POST /api/product-risk` (invalid) → 422
- `PUT /api/product-risk/[id]` → 200 (update with auto-review)
- `PUT /api/product-risk/[id]` (deactivated) → 400
- `PUT /api/product-risk/[id]` (not found) → 404
- `PATCH /api/product-risk/[id]` → 200 (soft delete)
- `PATCH /api/product-risk/[id]` (already inactive) → 400

## Key Patterns Used
- Zod `strictObject()` for mass assignment prevention
- AuthGuard with allowedRoles: admin, compliance_manager, mlro
- RBAC via `canManageProductRiskScores` permission (auditor/compliance_officer read-only)
- Rate limiting: READ tier for GET, WRITE tier for POST/PUT/PATCH
- SHA-256 hash on creation and all audit entries
- WORM audit trail via `db.auditLog.create()` only (never update/delete)
- High-risk product notification (riskWeight >= 7) for compliance_manager and mlro
- React Query with useQuery + useMutation + queryClient.invalidateQueries
- Color-coded risk weight: 1-3 green, 4-6 amber, 7-8 orange, 9-10 red

## Lint Status
0 errors, 0 new warnings (1 pre-existing warning in TrainingCertifications.tsx)
