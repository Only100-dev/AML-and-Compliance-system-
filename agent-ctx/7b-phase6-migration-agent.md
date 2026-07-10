# Task 7b: Phase 6 — Dual Code Migration

## Task A: cbuaeRegistrationNo → regulatorRegistrationNo + regulatorCode

### Files Modified

1. **`src/app/api/broker-kyc/route.ts`**:
   - Zod schema: `cbuaeRegistrationNo: z.string().optional()` → `regulatorRegistrationNo: z.string().optional(), regulatorCode: z.enum(['CBUAE', 'SAMA', 'CBB', 'QCB', 'CBOA', 'CBK']).optional()`
   - SHA-256 hash payload: `cbuaeRegistrationNo: data.cbuaeRegistrationNo` → `regulatorRegistrationNo: data.regulatorRegistrationNo, regulatorCode: data.regulatorCode`
   - Prisma create data: `cbuaeRegistrationNo: data.cbuaeRegistrationNo ?? null` → `regulatorRegistrationNo: data.regulatorRegistrationNo ?? null, regulatorCode: data.regulatorCode ?? null`

2. **`src/components/ic-os/insurance/BrokerKYCModule.tsx`**:
   - Interface: `cbuaeRegistrationNo: string | null;` → `regulatorRegistrationNo: string | null; regulatorCode: string | null;` (was already partially updated)
   - addForm state: `cbuaeRegistrationNo: ''` → `regulatorRegistrationNo: '', regulatorCode: 'CBUAE'` (was already partially updated)
   - Payload: `cbuaeRegistrationNo: addForm.cbuaeRegistrationNo || undefined` → `regulatorRegistrationNo: addForm.regulatorRegistrationNo || undefined, regulatorCode: addForm.regulatorCode || undefined` (was already partially updated)
   - Reset form: updated to use new field names (was already partially updated)
   - Table display: `{broker.cbuaeRegistrationNo || '—'}` → `{broker.regulatorRegistrationNo || '—'}`
   - Detail view label: "CBUAE Reg No:" → "Regulator Reg No:" with regulatorCode shown in parentheses
   - Form input: replaced CBUAE Registration No input with Regulator Registration No input + Regulator Code dropdown (6 GCC regulators)

3. **`src/app/api/broker-kyc/approve/route.ts`**:
   - No `cbuaeRegistrationNo` references found in this file (only `broker.brokerName` in audit details)
   - Added `domain: 'AML'` to the createAuditLog call

## Task B: Add `domain` parameter to all `createAuditLog` call sites

### Domain Mapping Applied
- **AML** (19 calls): /api/fiu/, /api/broker-kyc/, /api/sanctions/, /api/analytics/, /api/investigation/, /api/ai/draft-sar/, /api/cbuae-submission-checker/, /api/fiu-submission-checker/, /api/alerts/, /lib/fiu/
- **INSURANCE** (15 calls): /api/claims/, /api/sow-sof/, /api/early-surrender/, /api/product-risk/, /api/premium-financing/, /api/complaints/
- **GOVERNANCE** (38 calls): /api/audit/, /api/cap/, /api/board/, /api/tuning/, /api/webhooks/, /api/intelligence/, /api/regulatory-intel/, /api/ingestion/, /api/adverse-media/, /api/cron/intelligence-scanner/, /lib/gaps/
- **OPERATIONAL** (6 calls): /api/sla/, /api/dept-head/, /api/attestations/, /api/cron/calculate-department-risk/
- **SECURITY** (4 calls): /api/admin/, /api/qa/

### Total: 91 createAuditLog calls updated across 68 source files + 1 seed file (prisma/seed-uat.ts)

### Additional Fixes
- Fixed duplicate `domain:` entries in broker-kyc/route.ts, broker-kyc/approve/route.ts, and sanctions/versions/route.ts (caused by Python script adding domain when it was already manually added)
- Fixed prisma/seed-uat.ts createAuditLog call missing domain parameter

### Verification
- Lint: 0 FAILs, 22 warnings (all pre-existing)
- Dev server: healthy, all routes returning 200
- All createAuditLog calls in src/ verified to contain `domain:` parameter (except withAudit in audit.ts which passes domain via spread)
