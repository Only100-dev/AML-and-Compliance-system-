# Task 2-api — TPRM API Agent

## Task: Create TPRM API routes and Zod validation schemas

## Files Created/Modified

1. **`/src/lib/validations/vendor.ts`** — Zod validation schemas for vendor create/update
   - `VendorCreateSchema`: Validates vendor creation with fields for vendorName, serviceType, riskRating, riskScore, contractExpiry, amlStatus, dataProcessingAgreement, lastAuditDate, nextReviewDate, assignedToId, country, contractValue, description
   - `VendorUpdateSchema`: Validates vendor updates with all create fields optional plus isActive, eddTriggered, eddCompletedDate
   - Type exports: `VendorCreateInput`, `VendorUpdateInput`

2. **`/src/lib/validations/index.ts`** — Added `export * from './vendor'`

3. **`/src/app/api/vendors/route.ts`** — GET/POST endpoints
   - GET: List vendors with filters (riskRating, amlStatus, search, isActive defaulting to true), ordered by createdAt desc
   - POST: Create vendor (admin/mlro/compliance_manager only), auto-triggers EDD for high/critical risk, SHA-256 audit log

4. **`/src/app/api/vendors/[id]/route.ts`** — PATCH endpoint
   - PATCH: Update vendor (admin/mlro/compliance_manager only), risk rating change audit log, auto-EDD trigger for high/critical

## Patterns Followed
- Golden Path: Zod → authGuard → applyRateLimit → Prisma → SHA-256 Audit
- Matches existing patterns from regulations and compliance-cases routes
- Next.js 16 App Router with `params: Promise<{ id: string }>` pattern

## Lint Result
- 0 errors, 1 pre-existing warning (unrelated to TPRM code)
