# UAT Test Scenarios — IC-OS v7.3.0-RC1

**Document Type:** Detailed UAT Test Scenario Checklists
**Release:** IC-OS v7.3.0-RC1
**Audience:** Compliance Manager (Primary Tester), Department Heads, CCO/MLRO, IT/Security
**Companion Documents:** `UAT_KICKOFF_BRIEF.md`, `UAT_ACCESS_CREDENTIALS.md`, `UAT_ENVIRONMENT_RUNBOOK.md`
**Regulatory References:** CBUAE Notice 3551/2021 (Complaints), FDL 10/2025 (AML/GoAML/SAR), CR 134/2025 (Corporate Governance)

---

## How to Use This Document

This document contains five business-critical UAT test scenarios. Each scenario is a self-contained checklist with:
- **Objective** — what the scenario verifies and why it matters regulatorily.
- **Prerequisites** — what must be true before testing begins (data, credentials, environment).
- **Step-by-step Actions** — exact API endpoints, request bodies, and headers (copy-paste ready for `curl` or Postman).
- **Expected Results** — what the tester should see after each step (HTTP status, response body, UI state).
- **Sign-off** — the tester initials and dates the scenario when all steps pass.

**Tester account**: All scenarios use the credentials from `UAT_ACCESS_CREDENTIALS.md`. The Primary Tester is the **Compliance Manager** (User ID `cmqm1payy0002orjaeg2irv2e`, email `uat-user-3@icos-test.local`), unless a scenario explicitly requires a different role (e.g., GoAML Maker-Checker requires two different users).

**API access**: Two methods are documented in `UAT_ACCESS_CREDENTIALS.md` — browser login (for non-technical stakeholders) and API header impersonation (for IT/Security + Dev Support). All `curl` examples in this document use the API header method. The headers `x-user-role` and `x-user-id` are required on every `withRBAC`-protected endpoint.

**Base URL**: All endpoints are relative to `http://localhost:3000` (the dev server).

---

## Scenario 1: Complaint Lifecycle (CBUAE Compliance)

### Objective
Verify the end-to-end complaint handling workflow meets CBUAE Notice 3551/2021 requirements: complaint acknowledgment within 5 business days, resolution within 30 business days, full state-machine transitions, SLA-breach automation, and audit-logged communications. This is the **highest regulatory priority** scenario — CBUAE examination will sample this workflow first.

### Prerequisites
- UAT environment seeded (`bunx tsx prisma/seed-uat.ts` completed; 10 UAT complaints exist with `UAT-CMP-2026-NNNN` prefixes)
- Dev server running on port 3000 (`bun run dev`)
- Tester has Compliance Manager credentials (User ID `cmqm1payy0002orjaeg2irv2e`)
- Audit integrity verified: `GET /api/audit/integrity?fresh=1` returns `valid: true`

### Step-by-Step Actions

#### Step 1.1 — Create a new complaint
**Request**:
```bash
curl -X POST http://localhost:3000/api/complaints \
  -H "Content-Type: application/json" \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e" \
  -d '{
    "complaintNumber": "UAT-CMP-2026-NEW1",
    "subject": "UAT Test: Policy cancellation dispute",
    "description": "Customer disputes cancellation of motor policy without 30-day notice.",
    "complaintType": "CUSTOMER",
    "priority": "HIGH",
    "departmentId": "DEPT-CLAIMS"
  }'
```

**Expected Result**:
- HTTP 201 Created
- Response body contains the new complaint with `status: "NEW"`, `slaStatus: "WITHIN_SLA"`, `createdAt` timestamp, `complaintNumber: "UAT-CMP-2026-NEW1"`
- Audit log entry created with `action: "COMPLAINT_CREATED"` (verify in Step 1.6)

#### Step 1.2 — Acknowledge the complaint (CBUAE: within 5 business days)
**Request**:
```bash
curl -X PUT http://localhost:3000/api/complaints/<complaintId>/transition \
  -H "Content-Type: application/json" \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e" \
  -d '{ "targetStatus": "ACKNOWLEDGED" }'
```
*(Replace `<complaintId>` with the ID returned in Step 1.1)*

**Expected Result**:
- HTTP 200 OK
- Complaint `status` is now `"ACKNOWLEDGED"`
- State-machine transition is logged: `NEW → ACKNOWLEDGED`
- SLA acknowledgment timer stops; resolution timer (30 business days) starts

#### Step 1.3 — Move through investigation and resolution
Repeat the transition call for each state in sequence:
- `ACKNOWLEDGED → INVESTIGATING`
- `INVESTIGATING → RESOLVED`
- `RESOLVED → CLOSED`

**Expected Result**:
- Each transition returns HTTP 200
- Each transition is audit-logged
- Final state: `CLOSED`

#### Step 1.4 — Verify SLA evaluator automation (CBUAE breach detection)
The SLA evaluator processes all eligible complaints, generates `ComplianceAlerts` at 80% (approaching) and 100% (breached) thresholds, and creates `UniversalTasks` for assigned users.

**Request**:
```bash
curl -X POST http://localhost:3000/api/complaints/sla/evaluate \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e"
```

**Expected Result** (per verified smoke-test data):
- HTTP 200 OK
- Response reports: ~500 complaints processed, ~659 alerts generated, ~316 statuses updated (numbers may vary slightly based on current dataset; the seed created 10 UAT complaints with mixed SLA states — 3 BREACHED, 3 APPROACHING_BREACH, 3 WITHIN_SLA, 1 N/A)
- `ComplianceAlert` rows created with `alertType: COMPLAINT_SLA_BREACHED` (100% threshold) and `COMPLAINT_SLA_APPROACHING` (80% threshold)
- `UniversalTask` rows created for each breached/approaching complaint, assigned to the responsible Compliance Manager
- All write operations are audit-logged

#### Step 1.5 — Verify SLA status dashboard
**Request**:
```bash
curl http://localhost:3000/api/complaints/sla/evaluate \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e"
```

**Expected Result**:
- HTTP 200 OK (GET returns the current SLA dashboard state without re-running evaluation)
- Response includes per-complaint SLA status: `WITHIN_SLA`, `APPROACHING_BREACH`, `BREACHED`, or `N/A`
- 3 UAT-prefixed complaints show `BREACHED` (createdAt backdated 30+ days ago in seed)
- 3 UAT-prefixed complaints show `APPROACHING_BREACH` (createdAt backdated 24–28 days ago)

#### Step 1.6 — Add a customer communication
**Request**:
```bash
curl -X POST http://localhost:3000/api/complaints/<complaintId>/communications \
  -H "Content-Type: application/json" \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e" \
  -d '{
    "channel": "EMAIL",
    "direction": "OUTBOUND",
    "subject": "Acknowledgment of your complaint",
    "body": "Dear Customer, we acknowledge receipt of your complaint UAT-CMP-2026-NEW1..."
  }'
```

**Expected Result**:
- HTTP 201 Created
- Communication record linked to the complaint
- Audit log entry created with `action: "COMPLAINT_COMMUNICATION_ADDED"`
- Communication is immutable (no PUT/DELETE endpoint exists)

#### Step 1.7 — Verify audit trail completeness
**Request**:
```bash
curl "http://localhost:3000/api/audit/integrity?fresh=1" \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e"
```

**Expected Result**:
- HTTP 200 OK
- `data.valid: true`
- `data.violations: []` (empty array)
- `data.verifiedEntries` equals `data.totalEntries` (all entries hash-verified)
- Hash formula: `SHA-256(JSON.stringify({ userId, action, resource, resourceId, details, createdAt }))`

### Expected Results Summary
- ✅ Full state machine works: `NEW → ACKNOWLEDGED → INVESTIGATING → RESOLVED → CLOSED → ESCALATED_TO_OMBUDSMAN` (if applicable)
- ✅ SLA automation triggers correctly (80% approaching alert, 100% breach alert, UniversalTask creation)
- ✅ CBUAE timelines enforced: 5-day ack, 30-day resolution
- ✅ All transitions audit-logged with immutable SHA-256 hashes
- ✅ Communications are immutable and audit-logged

### Sign-off
- [ ] All steps passed
- [ ] Tester (Compliance Manager): _______________  Date: __________
- [ ] Notes / deviations:

---

## Scenario 2: GoAML Maker-Checker (Regulatory Filing)

### Objective
Verify the GoAML (UAE FIU's Anti-Money Laundering reporting system) Maker-Checker workflow enforces 4-eyes approval for Suspicious Activity Report (SAR) submissions, per FDL 10/2025 Article 12 (Tipping-Off) and CBUAE GoAML filing requirements. Confirm that bypass vectors (direct submit without approval, self-approval) are closed, and that the audit trail captures the full maker → checker → submit chain.

### Prerequisites
- UAT environment seeded (3 SARs exist with `UAT-SAR-2026-NNN` prefixes; 8 GoAML cases total)
- Tester has two accounts: Compliance Manager (maker, User ID `cmqm1payy0002orjaeg2irv2e`) and MLRO (checker, User ID `cmqm1payx0001orjatypofwed`)
- Dev server running on port 3000

### Step-by-Step Actions

#### Step 2.1 — List existing GoAML cases
**Request**:
```bash
curl http://localhost:3000/api/goaml \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e"
```

**Expected Result**:
- HTTP 200 OK
- Response body contains an array of 8 GoAML cases (mix of DRAFT, PENDING_REVIEW, APPROVED_FOR_FILING)
- 3 cases are UAT-prefixed (`UAT-SAR-2026-001`, `UAT-SAR-2026-002`, `UAT-SAR-2026-003`)
- Each case includes `caseNumber`, `status`, `filingDeadline`, `daysRemaining`, `tippingOffWarning`, `acknowledgedAt`

#### Step 2.2 — Create a new SAR draft (Maker action)
**Request**:
```bash
curl -X POST http://localhost:3000/api/goaml \
  -H "Content-Type: application/json" \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e" \
  -d '{
    "caseNumber": "UAT-SAR-2026-009",
    "subject": "UAT Test: Suspicious wire transfer pattern",
    "narrative": "Customer exhibited structuring behavior across 14 transactions...",
    "filingDeadline": "2026-04-15",
    "amount": 250000,
    "currency": "AED"
  }'
```

**Expected Result**:
- HTTP 201 Created
- New SAR created with `status: "DRAFT"`, `createdById: "cmqm1payy0002orjaeg2irv2e"` (the Compliance Manager)
- `tippingOffWarning: true` (per FDL 10/2025 Art. 12 — SAR existence must not be disclosed to the subject)
- Audit log entry created with `action: "SAR_DRAFT_CREATED"`

#### Step 2.3 — Attempt direct submit WITHOUT approval (bypass attempt)
This step verifies that the Maker-Checker control cannot be bypassed. The submit endpoint must reject any SAR that has not been approved by a different user.

**Request**:
```bash
curl -X POST http://localhost:3000/api/goaml/submit \
  -H "Content-Type: application/json" \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e" \
  -d '{ "caseId": "<sarCaseId>" }'
```
*(Use the ID from Step 2.2)*

**Expected Result**:
- HTTP 422 Unprocessable Entity
- Response body contains error message indicating Maker-Checker enforcement: SAR must be approved before submission
- No submission to GoAML occurs
- Audit log entry created with `action: "SAR_SUBMIT_BLOCKED"` (failed bypass attempt logged)
- SAR `status` remains `DRAFT`

#### Step 2.4 — Approve the SAR (Checker action — MUST be a different user)
The MLRO (not the Compliance Manager who created the draft) approves the SAR. This enforces the 4-eyes principle.

**Request**:
```bash
curl -X POST http://localhost:3000/api/goaml/approve \
  -H "Content-Type: application/json" \
  -H "x-user-role: mlro" \
  -H "x-user-id: cmqm1payx0001orjatypofwed" \
  -d '{ "caseId": "<sarCaseId>" }'
```

**Expected Result**:
- HTTP 200 OK
- SAR `status` transitions from `DRAFT` to `APPROVED_FOR_FILING`
- `reviewedById: "cmqm1payx0001orjatypofwed"` (the MLRO — different from `createdById`)
- Audit log entry created with `action: "SAR_APPROVED"`, capturing both the maker and checker identities

#### Step 2.4a — (Negative test) Attempt self-approval
Optionally verify that the creator cannot approve their own SAR:
```bash
curl -X POST http://localhost:3000/api/goaml/approve \
  -H "Content-Type: application/json" \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e" \
  -d '{ "caseId": "<anotherDraftSarId>" }'
```

**Expected Result**:
- HTTP 422 Unprocessable Entity
- Error message: creator cannot approve their own submission (4-eyes enforcement)
- No status change

#### Step 2.5 — Submit the approved SAR (now allowed)
**Request**:
```bash
curl -X POST http://localhost:3000/api/goaml/submit \
  -H "Content-Type: application/json" \
  -H "x-user-role: mlro" \
  -H "x-user-id: cmqm1payx0001orjatypofwed" \
  -d '{ "caseId": "<sarCaseId>" }'
```

**Expected Result**:
- HTTP 200 OK
- SAR `status` transitions from `APPROVED_FOR_FILING` to `SUBMITTED` (or `FILED`)
- Submission timestamp recorded
- Audit log entry created with `action: "SAR_SUBMITTED"`
- (In UAT, no actual GoAML submission occurs — the integration is mocked; the audit trail records the intent)

#### Step 2.6 — Validate the GoAML XML payload
**Request**:
```bash
curl -X POST http://localhost:3000/api/goaml/validate \
  -H "Content-Type: application/json" \
  -H "x-user-role: mlro" \
  -H "x-user-id: cmqm1payx0001orjatypofwed" \
  -d '{ "caseId": "<sarCaseId>" }'
```

**Expected Result**:
- HTTP 200 OK
- Response reports XML validation result: `valid: true`, schema conformance to GoAML specification
- Any validation errors are listed (expected: none for a properly-formed UAT SAR)

### Expected Results Summary
- ✅ Bypass vectors closed: direct submit without approval returns 422
- ✅ Self-approval blocked: creator cannot approve their own SAR (4-eyes enforcement)
- ✅ Cross-user approval works: MLRO (different from creator) can approve
- ✅ Submit succeeds only after approval
- ✅ Audit trail complete: maker, checker, and submit actions all logged with user IDs
- ✅ Tipping-off warning flag set per FDL 10/2025 Art. 12

### Sign-off
- [ ] All steps passed
- [ ] Tester (CCO/MLRO for approval steps, Compliance Manager for creation): _______________  Date: __________
- [ ] Notes / deviations:

---

## Scenario 3: Policy Attestation (Internal Governance)

### Objective
Verify the policy attestation workflow supports internal governance per CR 134/2025 (Corporate Compliance Governance). Confirm that policies can be distributed, acknowledgments are recorded with IP address and user-agent (non-repudiation), and attestation records are immutable. This is the audit trail for "did the employee read and acknowledge the policy."

### Prerequisites
- UAT environment seeded (11 policies exist, mix of published/draft; 4 attestations exist)
- Tester has Compliance Manager credentials (`cmqm1payy0002orjaeg2irv2e`) and Department Head credentials (`cmqm1payz0004orjadlw12mp5`)
- Dev server running on port 3000

### Step-by-Step Actions

#### Step 3.1 — List existing policies
**Request**:
```bash
curl http://localhost:3000/api/policies \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e"
```

**Expected Result**:
- HTTP 200 OK
- Response body contains an array of 11 policies
- Mix of `status: "PUBLISHED"` and `status: "DRAFT"`
- Each policy includes `id`, `title`, `version`, `status`, `publishedAt`, `effectiveDate`

#### Step 3.2 — List existing attestations
**Request**:
```bash
curl http://localhost:3000/api/attestations \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e"
```

**Expected Result**:
- HTTP 200 OK
- Response body contains 4 attestation records
- Each attestation includes `policyId`, `userId`, `acknowledgedAt`, `ipAddress`, `userAgent`

#### Step 3.3 — Create a new attestation (Department Head acknowledges a policy)
**Request**:
```bash
curl -X POST http://localhost:3000/api/attestations \
  -H "Content-Type: application/json" \
  -H "x-user-role: dept_head" \
  -H "x-user-id: cmqm1payz0004orjadlw12mp5" \
  -d '{
    "policyId": "<policyId>",
    "acknowledged": true
  }'
```
*(Use a `policyId` from Step 3.1)*

**Expected Result**:
- HTTP 201 Created
- Attestation record created with:
  - `userId: "cmqm1payz0004orjadlw12mp5"` (the Department Head)
  - `policyId: "<policyId>"`
  - `acknowledgedAt: <current-timestamp>`
  - `ipAddress: <requester-IP>` (captured from request — non-repudiation)
  - `userAgent: <requester-UA>` (captured from request — non-repudiation)
- Audit log entry created with `action: "POLICY_ATTESTED"`

#### Step 3.4 — Verify immutability of the attestation record
Attempt to modify or delete the attestation:

**Request** (attempt to modify):
```bash
curl -X PUT http://localhost:3000/api/attestations/<attestationId> \
  -H "Content-Type: application/json" \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e" \
  -d '{ "acknowledged": false }'
```

**Expected Result**:
- HTTP 405 Method Not Allowed (or 404 Not Found — no PUT route exists)
- Attestation record is unchanged
- No audit log entry created (the attempt itself may be logged at the middleware layer)

#### Step 3.5 — Verify distribution tracking
List attestations for the specific policy to verify the Department Head's acknowledgment appears:

**Request**:
```bash
curl "http://localhost:3000/api/attestations?policyId=<policyId>" \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e"
```

**Expected Result**:
- HTTP 200 OK
- Response includes the attestation created in Step 3.3
- Distribution tracking shows: total employees expected, total acknowledged, total pending

### Expected Results Summary
- ✅ Full distribution tracking works: per-policy attestation lists show who has/has not acknowledged
- ✅ Attestation records are immutable (no PUT/DELETE)
- ✅ Non-repudiation: IP address and user-agent captured on every attestation
- ✅ Audit trail complete: every attestation logged with `POLICY_ATTESTED` action
- ✅ CR 134/2025 governance requirement met: policy acknowledgments are auditable

### Sign-off
- [ ] All steps passed
- [ ] Tester (Department Head for acknowledgment, Compliance Manager for verification): _______________  Date: __________
- [ ] Notes / deviations:

---

## Scenario 4: Data-Room Generation (Regulator-in-a-Box)

### Objective
Verify the Regulator-in-a-Box data-room generator produces a regulator-ready evidence package with full PII masking and an intact SHA-256 hash chain. This is the artifact that would be handed to a CBUAE examiner during an on-site examination. PII leakage here is a P0 regulatory breach — this scenario is the highest-sensitivity test in UAT.

### Prerequisites
- UAT environment seeded and audit integrity verified (`GET /api/audit/integrity?fresh=1` returns `valid: true`, 11397/11397 entries verified, 0 violations, 0 missing-hash; audit chain fully verified — see Runbook §8 Issue 6 for the pre-UAT discrepancy resolution)
- Tester has Compliance Manager credentials and (for PII verification) IT/Security credentials
- Dev server running on port 3000
- The data-room endpoint accepts TWO response formats (added v7.3.0-RC1-uat-ready):
  - `POST /api/audit/generate-data-room` → JSON response (default, for programmatic integration + the existing PII leak detection script)
  - `POST /api/audit/generate-data-room?format=zip` → binary ZIP file download (the regulator-distributable artifact)
- Both formats require the same request body schema (see Step 4.2)

### Step-by-Step Actions

#### Step 4.1 — Verify audit integrity BEFORE generating the data-room
**Request**:
```bash
curl "http://localhost:3000/api/audit/integrity?fresh=1" \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e"
```

**Expected Result** (verified smoke-test data):
- HTTP 200 OK
- `data.valid: true`
- `data.verifiedEntries: 11397`
- `data.totalEntries: 11397` (all entries verified; `missingHashCount: 0`, `violations: []`)
- `data.violations: []` (empty array)
- Hash formula confirmed: `SHA-256(JSON.stringify({ userId, action, resource, resourceId, details, createdAt }))`

#### Step 4.2 — Generate the data-room package (JSON format — programmatic)
The endpoint accepts a request body with these fields (Zod-validated):
- `dateFrom` (string, required) — ISO date
- `dateTo` (string, required) — ISO date
- `documentTypes` (array, required, min 1) — enum: `kyc`, `alerts`, `transactions`, `filings`, `audit_logs`, `policies`
- `requestingUserId` (string, required)
- `requestingUserName` (string, required if `examinerName` not provided)
- `examinerName` (string, optional alias for `requestingUserName`)
- `requestJustification` (string, required, min 20 chars)
- `riskLevel` (enum, optional, default `all`) — `low` | `intermediate` | `high` | `critical` | `all`
- `auditId` (string, optional, nullable) — restrict `audit_logs` to a specific AuditLog.id

**Request (JSON response — default)**:
```bash
curl -X POST http://localhost:3000/api/audit/generate-data-room \
  -H "Content-Type: application/json" \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e" \
  -d '{
    "dateFrom": "2024-01-01",
    "dateTo": "2026-12-31",
    "riskLevel": "all",
    "documentTypes": ["kyc", "alerts", "transactions", "filings", "audit_logs", "policies"],
    "requestingUserId": "cmqm1payy0002orjaeg2irv2e",
    "requestingUserName": "UAT Compliance Manager",
    "requestJustification": "Quarterly CBUAE compliance audit review covering all complaint and alert activity for the regulator-in-a-box data room."
  }'
```

**Expected Result** (verified smoke-test data):
- HTTP 200 OK
- `success: true`
- `data.accessToken` — 64-char hex (time-bound, 72h expiry)
- `data.expiresAt` — ISO timestamp (72 hours from now)
- `data.integrityHash` — 64-char hex SHA-256 of the entire package
- `data.compiledDocuments` — array of 6 entries, one per documentType, each with `type`, `count`, `records[]`
- `data.metadata.totalRecords` — sum of all record counts (e.g. ~510 records across all 6 types)
- `data.metadata.piiMaskingApplied: true`
- All PII fields masked: names → initials (e.g. `"M. A. A."`), Emirates IDs → masked, phones → masked, IBANs → masked, audit log details → `"********"`

#### Step 4.2b — Generate the data-room package (ZIP format — regulator-distributable)
The `?format=zip` query parameter switches the response to a binary ZIP file download. The ZIP contains:
- `manifest.json` — metadata, accessToken, integrityHash, document list
- `<docType>.csv` — one PII-masked CSV per requested documentType (e.g. `kyc.csv`, `audit_logs.csv`, etc.)
- `integrity.txt` — human-readable SHA-256 hash + verification instructions for the examiner

**Request (ZIP response)**:
```bash
curl -X POST 'http://localhost:3000/api/audit/generate-data-room?format=zip' \
  -H "Content-Type: application/json" \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e" \
  -d '{
    "dateFrom": "2024-01-01",
    "dateTo": "2026-12-31",
    "riskLevel": "all",
    "documentTypes": ["kyc", "alerts", "transactions", "filings", "audit_logs", "policies"],
    "requestingUserId": "cmqm1payy0002orjaeg2irv2e",
    "requestingUserName": "UAT Compliance Manager",
    "requestJustification": "Quarterly CBUAE compliance audit review covering all complaint and alert activity for the regulator-in-a-box data room."
  }' \
  -o data-room.zip
```

**Expected Result** (verified smoke-test data):
- HTTP 200 OK
- `Content-Type: application/zip`
- `Content-Disposition: attachment; filename="ic-os-data-room-<8-char-token>.zip"`
- Response headers include:
  - `X-Data-Room-Hash` — 64-char hex SHA-256 (matches `manifest.json` → `integrityHash`)
  - `X-Data-Room-Token` — 64-char hex access token (72h expiry)
  - `X-Data-Room-Records` — total record count
  - `X-Data-Room-Expires` — ISO timestamp
- ZIP file body (~27 KB compressed, ~85 KB uncompressed for 6 document types × ~500 records each)
- ZIP contains 9 entries: 1 folder + `manifest.json` + 6 CSVs + `integrity.txt`
- Each CSV has a stable column order (alphabetical) and PII-masked values
- `audit_logs.csv` includes a `sha256Hash` column (per-entry integrity, verifiable via `GET /api/audit/integrity`)

**Inspecting the ZIP**:
```bash
unzip -l data-room.zip            # list contents
unzip data-room.zip -d data-room/ # extract
cat data-room/*/manifest.json     # view metadata
cat data-room/*/integrity.txt     # view verification instructions
head -3 data-room/*/audit_logs.csv  # verify sha256Hash column + PII masking
```

#### Step 4.2c — Generate a data-room scoped to ONE specific audit (optional, for targeted examiner requests)
Use the optional `auditId` field to restrict `audit_logs` to a single AuditLog entry (other documentTypes are unaffected).

**Request**:
```bash
# First, find a seeded audit log ID
AUDIT_ID=$(curl -s 'http://localhost:3000/api/audit/integrity?fresh=1' \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['violations'] or 'first-violation-id')")

# Then generate a data room scoped to that audit (audit_logs only)
curl -X POST 'http://localhost:3000/api/audit/generate-data-room?format=zip' \
  -H "Content-Type: application/json" \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e" \
  -d "{
    \"dateFrom\": \"2024-01-01\",
    \"dateTo\": \"2026-12-31\",
    \"documentTypes\": [\"audit_logs\"],
    \"requestingUserId\": \"cmqm1payy0002orjaeg2irv2e\",
    \"examinerName\": \"Senior CBUAE Examiner\",
    \"auditId\": \"$AUDIT_ID\",
    \"requestJustification\": \"CBUAE on-site examination scoped to a specific audit finding under Notice 3551/2021.\"
  }" \
  -o data-room-scoped.zip
```

**Expected Result**:
- HTTP 200 OK (same ZIP structure as Step 4.2b)
- `audit_logs.csv` contains only the single row for the specified `auditId`
- The `examinerName` alias is accepted in lieu of `requestingUserName` (permissive schema)
- `auditId: null` is also accepted (treated as "no filter")

#### Step 4.3 — Verify PII masking in the generated output
Run BOTH PII leak detection scripts — one for the JSON response, one for the ZIP response:

**Request 1 (JSON PII leak detection)**:
```bash
bunx tsx scripts/pii-leak-detection.mjs
```

**Expected Result 1**:
- Script completes with exit code 0
- Output reports: `PII LEAK DETECTION: PASS — 0 raw PII values in data room output.`
- Detection covers: full names, Emirates IDs, UAE phone numbers, IBANs, emails, trade licenses, TRNs
- Any non-zero match on real PII patterns is a **P0 bug** — halt UAT and escalate immediately

**Request 2 (ZIP PII leak detection — added v7.3.0-RC1-uat-ready)**:
```bash
bunx tsx scripts/pii-leak-detection-zip.mjs
```

**Expected Result 2**:
- Script completes with exit code 0
- Output reports: `PII LEAK DETECTION (ZIP): PASS — 0 raw PII values across 8 files in ZIP.`
- Verifies: Content-Type is `application/zip`, Content-Disposition is `attachment`, manifest integrityHash matches `X-Data-Room-Hash` response header, `audit_logs.csv` has `sha256Hash` column, 0 raw PII across all 8 files (manifest.json + 6 CSVs + integrity.txt)

#### Step 4.4 — Verify the hash chain AFTER data-room generation
The data-room generation process must not corrupt the audit trail. Re-run integrity verification:

**Request**:
```bash
curl "http://localhost:3000/api/audit/integrity?fresh=1" \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e"
```

**Expected Result**:
- HTTP 200 OK
- `data.valid: true`
- `data.verifiedEntries` equals `data.totalEntries` (entry count may have increased by 1–2 if the data-room generation itself was audit-logged)
- `data.violations: []` (empty array — hash chain intact)

#### Step 4.5 — Verify the package is regulator-ready (manual review)
Open the data-room output (download the package if the endpoint returns a file, or review the JSON response). Confirm:
- Cover page / manifest lists the examination scope (date range, finding IDs if any)
- Audit logs are organized chronologically
- Each log entry shows: timestamp, user (masked), action, resource, resource ID, details (PII-scrubbed)
- Hash chain is verifiable end-to-end (each entry's hash is computed from the previous fields)
- No raw PII anywhere in the package (cross-check with Step 4.3 script output)

### Expected Results Summary
- ✅ Audit integrity verified before generation (11397/11397 entries verified, 0 violations, 0 missing-hash — audit chain fully verified)
- ✅ Data-room JSON endpoint returns `success: true` with PII-masked records + integrityHash (Step 4.2)
- ✅ Data-room ZIP endpoint returns a valid `application/zip` download with manifest.json + 6 CSVs + integrity.txt (Step 4.2b)
- ✅ Permissive schema accepts `examinerName` alias + `auditId` filter (Step 4.2c)
- ✅ 0 raw PII in JSON output (verified by `pii-leak-detection.mjs`)
- ✅ 0 raw PII in ZIP output across all 8 files (verified by `pii-leak-detection-zip.mjs`)
- ✅ SHA-256 hash chain preserved in ZIP (manifest integrityHash + per-entry `sha256Hash` column in `audit_logs.csv`)
- ✅ Audit trail verifiable AFTER generation (hash chain intact, no violations introduced)

### Sign-off
- [ ] All steps passed
- [ ] Tester (Compliance Manager + IT/Security for PII verification): _______________  Date: __________
- [ ] Notes / deviations:

---

## Scenario 5: Unified My Tasks Inbox (Operational Efficiency)

### Objective
Verify the new v7.3.0 Unified My Tasks inbox aggregates tasks from all compliance modules (Complaints, CAPs, SARs, Alerts, Maker-Checker) into a single view, sorted by due date ascending, with working filters (status, taskType, overdue) and sub-300ms p95 latency. This is the operational efficiency headline feature of v7.3.0.

### Prerequisites
- UAT environment seeded (20 UAT-prefixed UniversalTasks distributed across 6 users; 10,083+ total UniversalTasks from load-test + SLA evaluator)
- Tester has Compliance Manager credentials (`cmqm1payy0002orjaeg2irv2e`) — verified to have 3 tasks (2 COMPLAINT + 1 CAP)
- Dev server running on port 3000

### Step-by-Step Actions

#### Step 5.1 — Get My Tasks (default view, sorted by due date ASC)
**Request**:
```bash
curl http://localhost:3000/api/tasks/my-tasks \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e"
```

**Expected Result** (verified smoke-test data):
- HTTP 200 OK
- Response body contains an array of 3 tasks for the Compliance Manager:
  - 2 tasks with `taskType: "COMPLAINT"`
  - 1 task with `taskType: "CAP"`
- Tasks are sorted by `dueDate` ascending (earliest due first)
- Overdue tasks (past `dueDate`) appear at the top of the list
- Each task includes: `id`, `title`, `taskType`, `status`, `dueDate`, `priority`, `sourceId`, `sourceEntityType`
- Response time < 300ms (verified: p95 < 130ms in load tests)

#### Step 5.2 — Verify due-date sorting
Inspect the `dueDate` field of each returned task. Confirm:
- Tasks are ordered earliest → latest by `dueDate`
- Overdue tasks (`dueDate` in the past, `status: "OPEN"`) appear before non-overdue tasks
- If two tasks have the same `dueDate`, secondary sort is by `priority` (HIGH → MEDIUM → LOW) or `createdAt`

**Expected Result**:
- Sorting verified manually by inspecting the `dueDate` timestamps in order

#### Step 5.3 — Filter by status (OPEN only)
**Request**:
```bash
curl "http://localhost:3000/api/tasks/my-tasks?status=OPEN" \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e"
```

**Expected Result**:
- HTTP 200 OK
- Response contains only tasks with `status: "OPEN"`
- No `COMPLETED`, `DONE`, `CANCELLED` tasks appear
- Response time < 300ms

#### Step 5.4 — Filter by taskType (COMPLAINT only)
**Request**:
```bash
curl "http://localhost:3000/api/tasks/my-tasks?taskType=COMPLAINT" \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e"
```

**Expected Result**:
- HTTP 200 OK
- Response contains only tasks with `taskType: "COMPLAINT"`
- Returns 2 tasks for the Compliance Manager
- No CAP, SAR, ALERT, or MAKER_CHECKER tasks appear

#### Step 5.5 — Filter overdue tasks
**Request**:
```bash
curl "http://localhost:3000/api/tasks/my-tasks?overdue=true" \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e"
```

**Expected Result**:
- HTTP 200 OK
- Response contains only tasks where `dueDate < now()` AND `status: "OPEN"`
- All returned tasks have past `dueDate` timestamps
- Non-overdue tasks are excluded

#### Step 5.6 — Verify task completion removes it from the inbox
Pick one OPEN task from Step 5.1 and mark it complete (the exact endpoint depends on the task's source module — for a COMPLAINT task, completing the underlying complaint transition marks the task complete; for a CAP, advancing the CAP state marks the task complete).

**Action**: Complete the underlying source entity (e.g., transition the linked complaint to `RESOLVED` or advance the CAP state).

**Then re-fetch My Tasks**:
```bash
curl http://localhost:3000/api/tasks/my-tasks \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e"
```

**Expected Result**:
- The completed task no longer appears in the default inbox view (its `status` is now `COMPLETED` or `DONE`)
- The remaining 2 tasks appear, still sorted by `dueDate` ASC
- The completed task is audit-logged

#### Step 5.7 — Verify performance (optional, IT/Security)
If IT/Security is co-testing, run a brief load check:

**Request**:
```bash
# Quick 10-request burst to confirm p95 < 300ms
for i in {1..10}; do
  curl -s -o /dev/null -w "%{time_total}\n" \
    -H "x-user-role: compliance_manager" \
    -H "x-user-id: cmqm1payy0002orjaeg2irv2e" \
    http://localhost:3000/api/tasks/my-tasks
done
```

**Expected Result**:
- All 10 responses are < 300ms
- 95th percentile < 130ms (verified in load tests; expected to be slightly higher in single-thread dev mode)
- No 5xx errors

### Expected Results Summary
- ✅ Unified view works: tasks from COMPLAINT, CAP, SAR, ALERT, MAKER_CHECKER, POLICY_ATTESTATION, CIRCULAR_ACK all appear in one inbox
- ✅ No tasks missing: 3 tasks returned for Compliance Manager (2 COMPLAINT + 1 CAP), matching seed data
- ✅ Sorted by `dueDate` ASC; overdue tasks float to top
- ✅ All three filters work: `status`, `taskType`, `overdue`
- ✅ Completing a task removes it from the inbox
- ✅ CAP assignment surfaces a task in the inbox (verified by `scripts/verify-universal-task-helper.mjs` — added v7.3.0-RC1-uat-ready)
- ✅ Policy attestation surfaces a task in the inbox; acknowledging it removes the task (status → DONE)
- ✅ Performance: p95 < 300ms (verified < 130ms in load tests)

### Sign-off
- [ ] All steps passed
- [ ] Tester (Compliance Manager + IT/Security for performance): _______________  Date: __________
- [ ] Notes / deviations:

---

## Cross-Scenario Audit-Trail Verification (Final Step)

After completing all 5 scenarios, run a final audit-trail integrity check to confirm that no scenario corrupted the hash chain:

**Request**:
```bash
curl "http://localhost:3000/api/audit/integrity?fresh=1" \
  -H "x-user-role: compliance_manager" \
  -H "x-user-id: cmqm1payy0002orjaeg2irv2e"
```

**Expected Result**:
- HTTP 200 OK
- `data.valid: true`
- `data.violations: []`
- `data.verifiedEntries` equals `data.totalEntries` (count will have grown from the 10727 baseline as scenarios created new audit entries)

**If violations exist**: Halt UAT. This is a P0 bug — audit-trail integrity is a hard regulatory requirement. Escalate to the Development Team lead immediately.

---

**UAT Test Scenarios — End of Document**
