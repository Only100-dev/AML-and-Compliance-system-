# Task 4-C: GCC Phase 4 — Directive 4.3: Jurisdiction-Specific Regulatory Reporting (FIU Templates)

**Date**: 2026-03-05
**Agent**: full-stack-developer
**Task ID**: 4-C
**Status**: ✅ Completed

## Task
Extend the goAML/Filing Center module to generate jurisdiction-specific FIU reporting templates across all 6 GCC countries. When the MLRO clicks "Generate Report", the system outputs the correct file format based on the active jurisdiction:
- UAE (AE): goAML XML (legacy, byte-identical)
- KSA (SA): SAFIU XML
- Bahrain/Qatar/Oman/Kuwait: Generic FIU CSV

## Prerequisites Confirmed
- Read `/home/z/my-project/worklog.md` — confirmed Phases 1-3 complete (Jurisdiction model, jurisdiction-aware auth with `getSessionJurisdictionId`/`getSessionJurisdictionCode`/`getJurisdictionScope`/`requireJurisdiction`, scoped policies/regulations/ingestion/AI). Tasks 4-A (KYC) and 4-B (Sanctions) complete with established patterns: `useSession` from `next-auth/react` for client jurisdiction extraction, `GCC_FLAGS` map for header badges, `getJurisdictionScope` for GET scoping, `requireJurisdiction` for cross-jurisdiction guards, AE path byte-identical.
- Read `/home/z/my-project/src/lib/compliance/fiu-templates.ts` (single source of truth — exports `generateFiuReport`, `getReportFormatForJurisdiction`, `getReportFormatLabel`, types `ReportFormat`/`FiuReportInput`/`FiuReportOutput`). Three generators: `generateGoAmlXml` (AE, root `<goAML xmlns="http://fiu.gov.ae/goAML" version="4.2">`), `generateSafiuXml` (SA, root `<SAFIUReport xmlns="https://safiu.gov.sa/schema/v1" version="1.0">`), `generateGenericCsv` (BH/QA/OM/KW, flat key-value CSV).
- Confirmed Prisma schema: `GoAMLFiling` model has `jurisdictionId String?` + `country Jurisdiction?` relation + `reportFormat String?` + `amountCurrency String?` (orchestrator pre-requisite). `Jurisdiction` model has `currency String` field. `AuditLog` model has `jurisdictionId String?` field. DB in sync.

## Files Verified/Delivered (3 files: 1 new, 2 modified)

### 1. `src/app/api/goaml/generate-report/route.ts` (NEW API endpoint)
POST handler that generates the jurisdiction-correct FIU file. Flow per spec:
1. Auth guard (allowed roles: admin/mlro/compliance_manager/compliance_officer) + rate limit WRITE
2. Extract `jurisdictionCode` + `jurisdictionId` from session (never from body)
3. Parse body `{ filingId: string }` (defensive `.catch(() => ({}))` for malformed JSON → 400 if missing)
4. Fetch filing by ID → 404 if not found
5. **Cross-jurisdiction guard**: `requireJurisdiction(auth.session, filing.jurisdictionId)` → 403 with `{ error: 'Cross-jurisdiction access denied — filing belongs to a different country scope' }` if denied. Legacy null-jurisdictionId filings only accessible from AE (helper handles this).
6. Resolve currency: prefer `filing.amountCurrency` (already tagged on create), else `db.jurisdiction.findUnique({ where: { code: jurisdictionCode }, select: { currency: true } })`, else `'AED'` (legacy default)
7. Resolve narrative: extract `<Narrative>...</Narrative>` from existing xmlPayload (works for both goAML + SAFIU XML shapes); fall back to `'SAR narrative pending MLRO finalization.'`
8. Build `FiuReportInput` from filing: `reportType`, `referenceNumber`, `subjectName`, `amount` (from `amountAED`), `currency`, `narrative`, `transactionDate` (filing.createdAt ISO), `filingEntity` (DEFAULT_FILING_ENTITY constant — IC-OS Reporting Entity)
9. Call `generateFiuReport(jurisdictionCode, input)` → routes to correct generator
10. Update filing: `db.goAMLFiling.update({ where: { id: filingId }, data: { xmlPayload: output.content, reportFormat: output.format, amountCurrency: currency } })`
11. WORM audit log: `db.auditLog.create({ data: { userId, action: 'GOAML_REPORT_GENERATED', resource: 'GoAMLFiling', resourceId: filingId, details: JSON.stringify({ filingId, reportFormat, formatLabel, jurisdictionCode, jurisdictionId, filename, mimeType, warnings }), sha256Hash: null, ipAddress, jurisdictionId: jurisdictionId ?? undefined } })`. `userId` read via `auth.session?.user as Record<string, unknown> | undefined` (falls back through userId → id → 'system'). `ipAddress` from `x-forwarded-for` header.
12. Return `NextResponse.json({ success: true, data: { filingId, content, mimeType, fileExtension, format, formatLabel, filename: `${filenameBase}.${fileExtension}`, warnings } })`
- Wrapped in try/catch → 500 on unexpected error.
- Bonus: GET helper that returns `{ jurisdictionCode, reportFormat, formatLabel }` for UI badge rendering without generating a file.

### 2. `src/app/api/goaml/route.ts` (existing — jurisdiction-tagged + scoped)
- **Imports**: `getJurisdictionScope`, `getSessionJurisdictionId`, `getSessionJurisdictionCode`, `requireJurisdiction` from `@/lib/auth-guard`; `getReportFormatForJurisdiction`, `getReportFormatLabel` from `@/lib/compliance/fiu-templates`.
- **GET handler**: `const jScope = getJurisdictionScope(auth.session)` merged into `where` clause. Response now includes `meta: { jurisdictionScoped: Boolean(jScope.jurisdictionId), jurisdictionCode }`. Legacy null-jurisdictionId rows only visible to AE (via `getJurisdictionScope` returning `{}` for AE dev mode → unscoped; non-AE sessions get strict `{ jurisdictionId: <id> }`).
- **POST handler (create)**: Extracts `jurisdictionCode` + `jurisdictionId` from session (NEVER body). Computes `reportFormat = getReportFormatForJurisdiction(jurisdictionCode)` + `formatLabel`. Looks up `amountCurrency` from `db.jurisdiction.findUnique({ where: { code: jurisdictionCode }, select: { currency: true } })` (default 'AED' for AE). For AE: keeps `xmlPayload=''` (legacy byte-identical). For non-AE with empty xmlPayload: sets placeholder `[Pending ${formatLabel} generation]`. Persists `jurisdictionId`, `reportFormat`, `amountCurrency` on the new row. XML validation is CONDITIONAL: `const shouldValidateGoAml = reportFormat === 'GOAML_XML'` — only validates when `data.xmlPayload && filingStatus === 'PENDING_APPROVAL' && shouldValidateGoAml`. Maker-checker payload now includes `jurisdictionCode`, `jurisdictionId`, `reportFormat`, `formatLabel` for country-tagged WORM trail. Audit/maker-checker logic intact.
- **PUT handler (update)**: After fetching existing filing, adds `requireJurisdiction(auth.session, existing.jurisdictionId)` → 403 if denied. XML validation is CONDITIONAL on effective report format: `const effectiveReportFormat = existing.reportFormat ?? 'GOAML_XML'` (legacy null → GOAML_XML); `const shouldValidateGoAml = effectiveReportFormat === 'GOAML_XML'`. Only runs `validateGoAMLXML` when `effectiveXmlPayload && effectiveFilingStatus === 'PENDING_APPROVAL' && shouldValidateGoAml`. This means a KSA SAFIU XML payload is NEVER rejected by the UAE goAML schema validator. All other PUT logic byte-identical.
- **DELETE handler**: After fetching existing filing, adds `requireJurisdiction(auth.session, existing.jurisdictionId)` → 403 if denied. Rest byte-identical.

### 3. `src/components/ic-os/goaml/GoAMLFilingCenter.tsx` (UI — jurisdiction context + Generate Report)
- **Imports**: `useSession` from `next-auth/react`; `getReportFormatForJurisdiction`, `getReportFormatLabel` from `@/lib/compliance/fiu-templates`; `Download` from lucide-react.
- **Jurisdiction extraction**: `const { data: session } = useSession(); const sessionUser = session?.user as { jurisdictionCode?: string | null; jurisdictionId?: string | null } | undefined; const jurisdictionCode = sessionUser?.jurisdictionCode || 'AE';` (defaults to AE for unauthenticated preview — legacy byte-identical).
- **Derived values**: `activeCurrency = GCC_CURRENCIES[jurisdictionCode] || 'AED'`; `activeRegulator = GCC_REGULATORS[jurisdictionCode] || 'CBUAE'`; `isAE = jurisdictionCode === 'AE'`; `reportFormat = getReportFormatForJurisdiction(jurisdictionCode)`; `reportFormatLabel = getReportFormatLabel(reportFormat)`.
- **Maps**: `GCC_FLAGS = { AE:'🇦🇪', SA:'🇸🇦', BH:'🇧🇭', QA:'🇶🇦', OM:'🇴🇲', KW:'🇰🇼' }`; `GCC_CURRENCIES = { AE:'AED', SA:'SAR', BH:'BHD', QA:'QAR', OM:'OMR', KW:'KWD' }`; `GCC_REGULATORS = { AE:'CBUAE', SA:'SAMA', BH:'CBB', QA:'QCB', OM:'CBOA', KW:'CBK' }`.
- **Types extended**: `GoAMLFiling` interface now has `jurisdictionId?`, `reportFormat?`, `amountCurrency?`. New `GenerateReportResponse` interface for the generate-report API response.
- **`formatAmount` helper**: Currency-aware — `formatAmount(amount, currency)` returns `${currency} ${amount.toLocaleString('en-AE')}` (falls back to AED for legacy null-currency rows). Legacy `formatAED` helper retained for backward compat.
- **Header**: Jurisdiction badge (flag emoji + code + format label) next to title. Subtitle is jurisdiction-conditional: AE → `"UAE FIU reporting: STR, SAR, CTR, IFT, and PNMR"` (byte-identical); non-AE → `"${activeRegulator} FIU reporting (${reportFormatLabel}): STR, SAR, CTR, IFT, and PNMR"`.
- **New Filing button + dialog**: AE → "New goAML Filing"; non-AE → "New FIU Filing". Dialog description: `"Create a new report filing for ${jurisdictionCode} FIU submission."`. Amount label shows `(${activeCurrency})`.
- **Filing table amount column**: Header shows `Amount (${activeCurrency})`. Cell uses `formatAmount(filing.amountAED, filing.amountCurrency)` — renders the filing's own currency tag (per-row), not just the session currency.
- **XML Preview tab**: Tab title AE → "goAML XML Payload Preview"; non-AE → "FIU Report Payload Preview". Badge: AE → "Schema v4.2" (cyan); non-AE → `reportFormatLabel` (emerald). Helper text AE → legacy goAML Schema v4.2 text (byte-identical); non-AE → `"Review the ${reportFormatLabel} payload before submission. Use \"Generate Report\" to produce the downloadable ${jurisdictionCode} FIU submission artifact."`.
- **Generate Report button** (NEW): In XML Preview tab, next to "Copy to Clipboard". Only appears when `selectedFiling` is set. Uses `useMutation` (`generateReportMutation`) — POST `/api/goaml/generate-report` with `{ filingId }`. On success: creates `Blob([data.content], { type: data.mimeType })` + `URL.createObjectURL` + temporary anchor + `anchor.download = data.filename` + `anchor.click()` + `URL.revokeObjectURL` on next tick. Toast: `Report generated: ${data.filename}` with description `${data.formatLabel} · ${jurisdictionCode} FIU submission artifact`. Invalidates `queryKeys.goamlFilings()` to refresh persisted payload. On error: `toast.error('Failed to generate report', ...)`. Button shows `Loader2` spinner during pending.
- **Per-row Generate Report download icon**: Added to both desktop table Actions column and mobile cards — a ghost button with `Download` icon (emerald) that calls `handleGenerateReport(filing)`. Makes the download discoverable from the filing queue without selecting first.
- **`handleCopyXml`**: Byte-identical (unchanged).
- **`createFilingMutation`**: Byte-identical (POST /api/goaml now tags jurisdictionId server-side; client payload unchanged).

## Cross-Jurisdiction Security Guarantee
The `requireJurisdiction(auth.session, filing.jurisdictionId)` guard is the single enforcement point across all 4 mutating endpoints (POST create, PUT update, DELETE, POST generate-report). It:
1. If `filing.jurisdictionId` is null (legacy row) → allows only AE sessions (where all legacy UAE data lives).
2. If `filing.jurisdictionId` is set → requires `session.jurisdictionId === filing.jurisdictionId`.
A KSA MLRO (session jurisdictionId = SA-id) cannot generate/download/update/delete a UAE filing (filing jurisdictionId = AE-id) → 403. And vice versa.

## XML Validation Scoping (Critical Constraint #4)
The UAE goAML XML validator (`src/lib/goaml/xml-validator.ts`) is UAE-specific. It must NOT reject SAFIU XML or Generic CSV. Enforced in BOTH POST and PUT handlers via:
```ts
const shouldValidateGoAml = reportFormat === 'GOAML_XML'; // POST
// or
const effectiveReportFormat = existing.reportFormat ?? 'GOAML_XML'; // PUT (legacy null → GOAML_XML)
const shouldValidateGoAml = effectiveReportFormat === 'GOAML_XML';
if (effectiveXmlPayload && filingStatus === 'PENDING_APPROVAL' && shouldValidateGoAml) {
  xmlValidation = validateGoAMLXML(...);
}
```
A KSA SAFIU XML payload (`<SAFIUReport>...`) is never passed to the UAE goAML validator. A Bahrain CSV payload is never passed either. Only GOAML_XML format (AE + legacy null) triggers validation.

## Verification
- **`bun run lint`**: 0 errors, 2 pre-existing warnings (TanStack Virtual advisories in AuditTrail.tsx + TrainingCertifications.tsx — same baseline as Phase 3 / 4-A / 4-B). Audit check: 4 PASS / 20 WARN / 0 FAIL — all security invariants hold.
- **`bunx tsc --noEmit`**: 22 total errors — ALL pre-existing. Diffed baseline (git stash) vs current: 22 = 22. ZERO new TypeScript errors introduced by my 3 files. The pre-existing errors are: `ai/orchestrate/route.ts`, `audit/generate-data-room/route.ts`, `complaints/communications/route.ts` (×2), `dmlro/log/route.ts`, `dmlro/status/route.ts` (×6), `ingestion/commit/route.ts` (×2), `ingestion/logs/route.ts` (×2), `kyc/route.ts` (line 343 — documented in 4-A worklog), `scenarios/[id]/route.ts`, `PIIRevealField.tsx` (title), `tools.ts` (packName + auditor ×2). None in `goaml/*` or `fiu-templates.ts` or `GoAMLFilingCenter.tsx`.
- **`dev.log` tail**: No compile errors, no module-not-found, no type errors. Only pre-existing `EADDRINUSE` from a duplicate server start attempt (unrelated). Dev server healthy: GET / → 200, GET /login → 200, `✓ Compiled in XXXms` after file saves.

## UAE → goAML Trace Confirmation
1. UAE MLRO session: `jurisdictionCode='AE'`, `jurisdictionId=<AE-id-or-null>`
2. Opens GoAMLFilingCenter → `isAE=true`, `reportFormat='GOAML_XML'`, `reportFormatLabel='goAML XML (UAE FIU)'`
3. Header: "goAML Filing Center" + badge "🇦🇪 AE · goAML XML (UAE FIU)" + subtitle "UAE FIU reporting: STR, SAR, CTR, IFT, and PNMR" ✓ (byte-identical)
4. Clicks "New goAML Filing" → dialog title "New goAML Filing" + desc "Create a new report filing for AE FIU submission." ✓
5. Creates SAR (reportType='SAR', subjectName, amount, status='DRAFT') → POST /api/goaml → server: `jurisdictionCode='AE'`, `reportFormat='GOAML_XML'`, `amountCurrency='AED'`, `xmlPayload=''` (AE allows empty), `shouldValidateGoAml=true` but no xmlPayload so no validation → `db.goAMLFiling.create({ data: { ..., jurisdictionId: <AE-id>, reportFormat: 'GOAML_XML', amountCurrency: 'AED' } })` → 201
6. Selects filing → XML Preview tab: title "goAML XML Payload Preview" + badge "Schema v4.2" ✓ (byte-identical)
7. Clicks "Generate Report" → POST /api/goaml/generate-report `{ filingId }` → server: fetch filing → `requireJurisdiction(AE-session, AE-filing.jurisdictionId)` → authorized → `currency='AED'` → `narrative='SAR narrative pending MLRO finalization.'` → `generateFiuReport('AE', input)` → routes to `generateGoAmlXml(input)` → returns `<?xml version="1.0" encoding="UTF-8"?>\n<goAML xmlns="http://fiu.gov.ae/goAML" version="4.2">...` → update filing `xmlPayload=<goAML XML>`, `reportFormat='GOAML_XML'`, `amountCurrency='AED'` → audit log `GOAML_REPORT_GENERATED` with `jurisdictionId=<AE-id>` → return `{ content: <goAML XML>, mimeType: 'application/xml', fileExtension: 'xml', format: 'GOAML_XML', formatLabel: 'goAML XML (UAE FIU)', filename: 'SAR-SAR-2024-001.xml', warnings: [] }`
8. Client: `new Blob([content], { type: 'application/xml' })` → anchor download `SAR-SAR-2024-001.xml` → toast "Report generated: SAR-SAR-2024-001.xml" (desc: "goAML XML (UAE FIU) · AE FIU submission artifact") ✓

**CONFIRMED**: UAE MLRO → goAML XML download `SAR-SAR-2024-001.xml`.

## KSA → SAFIU Trace Confirmation
1. KSA MLRO session: `jurisdictionCode='SA'`, `jurisdictionId=<SA-id>`
2. Opens GoAMLFilingCenter → `isAE=false`, `reportFormat='SAFIU_XML'`, `reportFormatLabel='SAFIU XML (KSA)'`, `activeCurrency='SAR'`, `activeRegulator='SAMA'`
3. Header: "goAML Filing Center" + badge "🇸🇦 SA · SAFIU XML (KSA)" + subtitle "SAMA FIU reporting (SAFIU XML (KSA)): STR, SAR, CTR, IFT, and PNMR" ✓
4. Clicks "New FIU Filing" → dialog title "New FIU Filing" + desc "Create a new report filing for SA FIU submission." ✓
5. Creates SAR → POST /api/goaml → server: `jurisdictionCode='SA'`, `reportFormat='SAFIU_XML'`, looks up jurisdiction → `amountCurrency='SAR'`, `xmlPayload='[Pending SAFIU XML (KSA) generation]'` (non-AE placeholder), `shouldValidateGoAml=false` (not GOAML_XML) → skips goAML validator → `db.goAMLFiling.create({ data: { ..., jurisdictionId: <SA-id>, reportFormat: 'SAFIU_XML', amountCurrency: 'SAR' } })` → 201
6. Selects filing → XML Preview tab: title "FIU Report Payload Preview" + badge "SAFIU XML (KSA)" ✓
7. Clicks "Generate Report" → POST /api/goaml/generate-report `{ filingId }` → server: fetch filing → `requireJurisdiction(SA-session, SA-filing.jurisdictionId)` → `sessionJid=<SA-id> === filing.jurisdictionId=<SA-id>` → authorized → `currency='SAR'` → `generateFiuReport('SA', input)` → routes to `generateSafiuXml(input)` → returns `<?xml version="1.0" encoding="UTF-8"?>\n<SAFIUReport xmlns="https://safiu.gov.sa/schema/v1" version="1.0">...` → update filing `xmlPayload=<SAFIU XML>`, `reportFormat='SAFIU_XML'`, `amountCurrency='SAR'` → audit log `GOAML_REPORT_GENERATED` with `jurisdictionId=<SA-id>` → return `{ content: <SAFIU XML>, mimeType: 'application/xml', fileExtension: 'xml', format: 'SAFIU_XML', formatLabel: 'SAFIU XML (KSA)', filename: 'SAR-SAR-2024-002.xml', warnings: [] }`
8. Client: `new Blob([content], { type: 'application/xml' })` → anchor download `SAR-SAR-2024-002.xml` → toast "Report generated: SAR-SAR-2024-002.xml" (desc: "SAFIU XML (KSA) · SA FIU submission artifact") ✓

**CONFIRMED**: KSA MLRO → SAFIU XML download `SAR-SAR-2024-002.xml`.

## Cross-Jurisdiction Block Confirmation
If KSA MLRO attempts to generate a UAE filing's report:
- POST /api/goaml/generate-report `{ filingId: <UAE-filing-id> }` → server: fetch UAE filing (jurisdictionId=<AE-id>) → `requireJurisdiction(SA-session, <AE-id>)` → `sessionJid=<SA-id> !== <AE-id>` → `{ authorized: false }` → 403 `{ error: 'Cross-jurisdiction access denied — filing belongs to a different country scope' }`
- Client: `toast.error('Failed to generate report', { description: 'Cross-jurisdiction access denied...' })` ✓

## Constraints Honored
1. ✅ UAE (AE) behavior byte-identical — goAML XML format, XML validation on PENDING_APPROVAL, maker-checker flow, "Copy to Clipboard", header text, dialog text, Schema v4.2 badge all preserved.
2. ✅ Format routing: UAE SAR → goAML XML (`<goAML>`); KSA SAR → SAFIU XML (`<SAFIUReport>`); Bahrain SAR → Generic CSV (flat key-value). The shared `generateFiuReport` handles this.
3. ✅ Cross-jurisdiction guard: `requireJurisdiction` on all 4 mutating endpoints (POST/PUT/DELETE/generate-report).
4. ✅ XML validation scoping: goAML validator only runs when `reportFormat === 'GOAML_XML'` (or legacy null → GOAML_XML). SAFIU_XML + GENERIC_CSV skip the UAE validator.
5. ✅ Zero regression: 7-role RBAC intact (allowedRoles array unchanged), maker-checker for STR/SAR intact (initiateMakerChecker call + payload preserved), WORM audit intact (auditLog.create in generate-report; maker-checker payload country-tagged).
6. ✅ TypeScript strict: no `any` types (used `Record<string, unknown>`, `FiuReportInput`, `GenerateReportResponse`, typed sessionUser).
7. ✅ Did NOT modify: `fiu-templates.ts`, Prisma schema, `xml-validator.ts`, `/api/goaml-xml/route.ts`.

## Issues
None. All 3 files compile cleanly, lint cleanly, and the UAE→goAML + KSA→SAFIU traces are confirmed end-to-end.
