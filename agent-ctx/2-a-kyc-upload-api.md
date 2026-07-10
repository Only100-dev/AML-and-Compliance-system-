# Task 2-a: KYC Document Upload API

## Summary
Created a new document upload API endpoint at `/api/kyc-upload/route.ts` for the IC-OS Regulatory Intelligence Hub project.

## File Created
- `/home/z/my-project/src/app/api/kyc-upload/route.ts` — New file (additive, no existing files modified)
- `/home/z/my-project/uploads/` — Directory created for file storage

## Endpoints

### POST /api/kyc-upload
- Accepts multipart form data with `file` + metadata fields
- Validates file type (PDF, JPG, PNG, DOCX only)
- Max file size: 10MB
- Zod validation for metadata: `inspectionId`, `documentType` (7 enum values), `uploadedBy`, `department`, optional `kycId`
- Generates SHA-256 hash for file integrity
- Stores file in `/home/z/my-project/uploads/` with unique filename
- Creates `InspectionEvidence` record in database
- Creates `AuditLog` entry
- Returns 201 with evidence record ID

### GET /api/kyc-upload
- Lists documents by `inspectionId` or `kycId` (at least one required)
- Supports `documentType` filter, pagination (`page`/`limit`)
- Excludes soft-deleted records
- Returns paginated results

### DELETE /api/kyc-upload
- Soft-delete by updating record (marks as deleted)
- Zod validation for `id`, `deletedBy`, optional `deletionReason`
- Prevents double-deletion (409)
- Returns 404 for non-existent records
- Creates AuditLog entry

## Document Types Supported
`emirates_id`, `passport`, `trade_license`, `trn_certificate`, `ubo_declaration`, `bank_statement`, `other`

## Testing Results
- All 7 document types: ✅
- All MIME types (PDF, PNG, JPG): ✅
- Validation errors (no file, invalid type, unsupported MIME): ✅
- Soft-delete and re-delete prevention: ✅
- Non-existent record handling: ✅
- Lint: 0 errors, 0 warnings
