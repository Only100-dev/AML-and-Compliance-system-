# Phase 1 Regulatory Critical API Routes — Work Record

## Task ID: phase1-regulatory-critical-apis
## Agent: Fullstack API Developer

## Summary
Created 6 production-quality API route files for the IC-OS compliance platform's Phase 1 Regulatory Critical workflows. All files follow Next.js App Router conventions with proper Zod validation, error handling, and database integration.

## Files Created

### 1. `/src/app/api/sanctions/route.ts`
- **GET**: List sanctions screenings with filters (status, entityType, date range, pagination)
- **POST**: Screen entity against sanctions lists with fail-closed architecture
  - Zod validation: entityType, primaryName, aliases, identifiers
  - Idempotency key support via `x-idempotency-key` header
  - Inline Levenshtein fuzzy matching (no external deps)
  - Mock sanctions list (structured for real integration)
  - Fail-closed: creates ERROR status screening with `failClosed=true` on failures, returns 503
  - Creates ComplianceAlert for CONFIRMED_MATCH results
  - Full AuditLog integration

### 2. `/src/app/api/sar-deadlines/route.ts`
- **GET**: List SAR cases with deadline tracking (status, daysRemaining lte/gte, jurisdiction)
  - Dynamic daysRemaining calculation
  - Overdue/approaching deadline flags
- **POST**: Create SAR case from AML alert
  - Auto-calculates filingDeadline = triggerDate + 30 days (FDL 10/2025 Art. 8)
  - Creates ComplianceAlert for SAR_DEADLINE
  - Creates CalendarEvent for deadline
  - Mandatory tipping-off warning per Art. 12
- **PUT**: Update SAR status with maker-checker validation
  - Valid transition enforcement: DRAFT → PENDING_REVIEW → APPROVED_FOR_FILING → SUBMITTED_TO_FIU
  - Maker-checker: createdById ≠ reviewedById
  - Rejection requires rejectionReason
  - On SUBMITTED_TO_FIU: creates GoAMLFiling record

### 3. `/src/app/api/compliance-calendar/route.ts`
- **GET**: List calendar events with filters (eventType, jurisdiction, status, date range, priority, sourceModule)
- **POST**: Create calendar event with auto-generation of reminders
  - SAR deadlines: 7-day and 3-day reminders
  - KYC reviews: 5-day reminder
  - Training expiry: 14-day reminder
- **PUT**: Update calendar event status
- **DELETE**: Soft delete by setting status to "cancelled"

### 4. `/src/app/api/compliance-alerts/route.ts`
- **GET**: List compliance alerts sorted by active → severity desc → dueDate asc
- **POST**: Create immutable compliance alert
  - Auto-generates SHA-256 hash for integrity
  - isImmutable = true by default
- **PUT**: Acknowledge or resolve alert
  - Strict status transitions: active → acknowledged → resolved
  - Blocks deletion of immutable alerts
  - Logs acknowledgment to AuditLog with integrity verification

### 5. `/src/app/api/attestations/route.ts`
- **GET**: List attestations with filters (policyId, userId, status, department)
- **GET /overdue**: List overdue attestations with daysOverdue calculation
- **POST**: Create attestation record (CR 134/2025)
  - Duplicate prevention (same user + policy + version + pending)
  - Auto-creates calendar event for deadline
- **PUT**: Acknowledge attestation
  - Records IP address, user agent, timestamp
  - Only assigned user can acknowledge

### 6. `/src/app/api/remediations/route.ts`
- **GET**: List remediation actions with filters (auditId, status, assignedToId, priority)
- **GET /overdue**: List overdue remediation actions with daysOverdue
- **POST**: Create remediation action
  - Auto-creates calendar event and compliance alert (for high/critical priority)
  - Audit existence validation
- **PUT**: Update remediation action
  - Valid status transitions: not_started → in_progress → completed/overdue/waived
  - Completion requires evidence
  - Waiving requires reason
  - Auto-updates parent audit's remediationStatus when all actions complete

## Design Decisions
- All routes use `z.safeParse()` for validation returning structured error responses
- AuditLog entries created for all write operations
- Cross-module integration (SAR → Calendar → Alerts, Remediations → Calendar → Alerts)
- Fail-closed architecture for sanctions: 503 on errors, never defaults to CLEAR
- SHA-256 immutability for compliance alerts
- Maker-checker enforcement in SAR workflow
- Dynamic deadline calculations rather than stale stored values

## Lint & Compilation
- All 6 files pass ESLint with zero errors
- No TypeScript errors in new files (pre-existing error in arabic-normalization.ts is unrelated)
- Runtime note: Cached PrismaClient in dev server may need restart to recognize Phase 5 models
