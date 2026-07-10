# Task 5+6: Zod Validation Schemas + Validation Middleware + Auto Audit Trail Utility

## Agent: Main

## Work Completed

### H3: Zod Validation Schemas + Validation Middleware
1. Created `/src/lib/validations/` directory with 6 schema files:
   - `aml.ts` - AMLAlertCreateSchema + AMLAlertActionSchema
   - `claim.ts` - ClaimCreateSchema
   - `evidence.ts` - EvidenceQuerySchema
   - `regulation.ts` - RegulationCreateSchema + RegulationUpdateSchema (partial)
   - `policy.ts` - PolicyCreateSchema
   - `index.ts` - Barrel export

2. Created `/src/lib/validate.ts` with:
   - `validateBody<T>()` - async body validation returning discriminated union
   - `validateSearchParams<T>()` - sync query param validation
   - Both return 400 JSON with field-level error details on failure
   - Uses `z.ZodType<T>` (zod v4 compatible, replaces `ZodSchema`)

### H5: Auto Audit Trail Utility
3. Created `/src/lib/audit.ts` with:
   - `createAuditLog()` - Creates immutable audit entries with SHA-256 integrity hash
   - `withAudit()` - HOC that wraps any DB mutation with automatic audit logging
   - `getRecentAuditLogs()` - Retrieves logs with filtering and pagination

### API Route Updates
4. Updated 4 API routes with validation + createAuditLog():
   - `/api/aml/route.ts` - AMLAlertCreateSchema on create, AMLAlertActionSchema on action
   - `/api/claims/route.ts` - ClaimCreateSchema on POST
   - `/api/regulations/route.ts` - RegulationCreateSchema on POST, RegulationUpdateSchema on PUT, audit on DELETE
   - `/api/policies/route.ts` - PolicyCreateSchema on POST, audit on PUT/DELETE (previously no audit logging)

## Key Decisions
- Used `z.ZodType<T>` instead of `ZodSchema` for zod v4 compatibility
- Preserved all existing API contracts (validation is additive)
- Used `validation.data` for field values in DB creates (validated data)
- Added `userId` extraction from request body for audit context
- Regulations PUT builds updateData selectively from validated fields to handle partial updates

## Test Results
- `bun run lint` — no errors
- All endpoints tested via curl: validation rejects empty/invalid bodies with 400 + detailed field errors
- Valid creates succeed with 201 and proper audit logs
