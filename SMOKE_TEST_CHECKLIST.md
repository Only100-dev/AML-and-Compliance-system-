# IC-OS End-to-End Smoke Test Checklist

> **Version:** v7.2 Hardened — Final Production Readiness Verification  
> **Regulatory Framework:** FDL 10/2025, CR 134/2025, CBUAE Notice 3551/2021, goAML v4.2  
> **Last Updated:** v7.2 Batch 6 — Final Documentation Sync & Production Readiness

---

## Pre-Flight Checks

- [ ] **Database is seeded:** `bunx tsx prisma/seed.ts` completes without errors
- [ ] **Dev server starts:** `bun run dev` serves on port 3000 with no fatal errors
- [ ] **Health check passes:** `GET /api/health` returns `status: "healthy"` with security score ≥ 75
- [ ] **Environment variables configured:** All required vars from `.env.example` are set
- [ ] **No console errors on page load:** Browser console shows zero uncaught exceptions

---

## Module 1: Admin & User Management

- [ ] **Admin can log in** with `admin@icos.ae` credentials
- [ ] **Admin can view the User Management** section under Security Center
- [ ] **Admin can create a new Compliance Officer user** with role `compliance_officer`
- [ ] **Admin can deactivate a user** (soft delete via `isActive: false`)
- [ ] **Created user appears in the User list** with correct role and jurisdiction
- [ ] **Audit Trail records the user creation** with SHA-256 hash

---

## Module 2: KYC Onboarding

- [ ] **Compliance Officer can navigate** to Corporate KYC module
- [ ] **Compliance Officer can submit a HIGH-risk Corporate KYC application** (e.g., PEP in management = true, riskScore ≥ 75)
- [ ] **HIGH-risk KYC auto-routes to Maker-Checker queue** (status changes to `PENDING_MAKER_CHECKER`)
- [ ] **Compliance Officer can submit a LOW-risk Corporate KYC application** (auto-approved)
- [ ] **LOW-risk KYC status updates to APPROVED** immediately
- [ ] **Individual KYC wizard loads** and accepts valid form data
- [ ] **UBO Ownership Visualization renders** for a Corporate KYC record
- [ ] **OFAC 50% Rule status displays** (BLOCKED/CLEAR) with ownership tree

---

## Module 3: Maker-Checker (4-Eyes Principle)

- [ ] **Maker-Checker queue shows pending items** for the logged-in MLRO
- [ ] **MLRO can review a pending KYC application** and see the maker's data
- [ ] **MLRO can approve the KYC application** with a rationale
- [ ] **KYC status updates to APPROVED** after checker approval
- [ ] **Maker cannot approve their own record** (system blocks with security violation)
- [ ] **Approval action is recorded in Audit Trail** with valid SHA-256 hash
- [ ] **MLRO can reject** a pending item with rejection reason

---

## Module 4: AML & Sanctions

- [ ] **AML Alert Triage Queue loads** with seeded alerts (5 alerts)
- [ ] **Alerts display correct risk levels** (critical, high, intermediate, low)
- [ ] **Kanban drag-and-drop works** (drag alert between status columns)
- [ ] **Sanctions exceptions display** with sunset countdown
- [ ] **Alert detail drawer opens** with full risk timeline and AI flags
- [ ] **Tipping-off warning banner displays** for SAR-related alerts
- [ ] **Escalate action creates Audit Trail entry**
- [ ] **File SAR action triggers toast notification**

---

## Module 5: goAML Filing

- [ ] **goAML Filing Center loads** with filing dashboard
- [ ] **User can create a new STR/SAR draft** with subject and transaction details
- [ ] **goAML XML preview generates** valid XML structure
- [ ] **Filing submission requires Maker-Checker approval** for HIGH-risk filings
- [ ] **Submitted filing status changes** to `SUBMITTED_TO_FIU`

---

## Module 6: Adverse Media Screening

- [ ] **Adverse Media Search page loads** with subject type selection
- [ ] **User can initiate a screening session** for an individual or entity
- [ ] **Screening results display** with match/confidence indicators
- [ ] **User can record a decision** (CLEAR, POTENTIAL_MATCH, FALSE_POSITIVE, CONFIRMED_MATCH)
- [ ] **Decision is persisted** to the database

---

## Module 7: Regulatory Intelligence

- [ ] **AI Regulatory Intelligence page loads** with circular ingestion interface
- [ ] **Regulatory circulars display** with status (ingested, analyzing, analyzed, actioned)
- [ ] **Gap Analysis shows AI-generated missing clauses** with confidence scores
- [ ] **CBUAE Regulatory Tracker shows** regulation compliance status
- [ ] **Filtering by regulator/jurisdiction works** (CBUAE, DFSA, FSRA)

---

## Module 8: Claims Portals (4-Persona)

- [ ] **Claims Portals loads** with persona selector
- [ ] **Claimant persona shows** claim submission form
- [ ] **Adjuster persona shows** assigned claims for review
- [ ] **SIU persona shows only** claims with `fraudScore >= 0.4` (role-based filtering)
- [ ] **Supervisor persona shows** all claims with team overview
- [ ] **Claim status update persists** to database
- [ ] **SIU flag automatically sets** when claim moves to investigation

---

## Module 9: Training & Effectiveness

- [ ] **Training & Certifications page loads** with course list and enrollment tracking
- [ ] **User can enroll staff** in a training course
- [ ] **Training Effectiveness dashboard shows** pre/post assessment scores
- [ ] **Knowledge gain calculated correctly** (post - pre = gain)
- [ ] **Negative knowledge gain triggers** compliance alert
- [ ] **Effectiveness gauge chart renders** with score needle

---

## Module 10: Compliance Audits

- [ ] **Compliance Audits page loads** with audit schedule
- [ ] **User can schedule a new audit** with type, date, and lead auditor
- [ ] **Audit status transitions work** (scheduled → in_progress → completed)
- [ ] **Remediation actions display** for audits with findings
- [ ] **Remediation status updates** (not_started → in_progress → completed)

---

## Module 11: Command Center & Analytics

- [ ] **Command Center loads** with KRI dashboard
- [ ] **Live analytics reflect actual database counts** (not hardcoded)
- [ ] **Risk Posture chart shows** distribution by risk level
- [ ] **Transaction Trends chart shows** monthly filing counts
- [ ] **Quick Actions are wired:** "File SAR Report" triggers toast/action
- [ ] **Refreshing data works** via manual refresh button

---

## Module 12: Evidence War Room

- [ ] **Evidence War Room loads** with inspection evidence list
- [ ] **AI verification status displays** for each evidence item
- [ ] **File hash (SHA-256) displays** for integrity verification
- [ ] **Evidence upload API works** (POST /api/kyc-upload with file + metadata)

---

## Module 13: Legal Advisory

- [ ] **Legal Advisory page loads** with case list
- [ ] **User can create a new legal case** (case type, priority, assigned counsel)
- [ ] **Case status transitions work** (open → in_progress → resolved)
- [ ] **AI summary displays** for cases with generated summaries

---

## Module 14: Policies & SOPs

- [ ] **Policies & SOPs page loads** with policy document list
- [ ] **Policy categories display** correctly (AML/CFT, Sanctions, KYC, etc.)
- [ ] **AI review status shows** for AI-reviewed policies
- [ ] **Policy attestation tracking works** (pending → acknowledged → overdue)

---

## Module 15: CBUAE Quarterly Reporting

- [ ] **Quarterly Reporting page loads** with report dashboard
- [ ] **PII masking toggle works** (switches between full and masked view)
- [ ] **CBUAE view shows masked data** for client names and amounts
- [ ] **Report validation checks pass** for a complete report

---

## Module 16: CBUAE Submission Checker

- [ ] **Submission Checker page loads** with report type selector
- [ ] **Quarterly report checks run** and display pass/fail results
- [ ] **SAR filing checks include** tipping-off acknowledgment requirement
- [ ] **CTR filing checks include** amount threshold (AED 35,000+)
- [ ] **Readiness percentage calculates** correctly from check results
- [ ] **Submit to CBUAE button disabled** when checks fail

---

## Module 17: AI Agent Management

- [ ] **AI Agent Management page loads** with 5-brain infrastructure display
- [ ] **AI brain status indicators** show online/offline state
- [ ] **AI chat widget opens** from floating button
- [ ] **AI chat sends message** and receives response
- [ ] **AI model usage displays** in analytics

---

## Module 18: AML Self-Assessment

- [ ] **AML Self-Assessment loads** with 10-section wizard
- [ ] **51 questions render** across all sections
- [ ] **Rating buttons work** (Compliant, Partially Compliant, Non-Compliant, N/A)
- [ ] **Critical item double-weighting** applies in score calculation
- [ ] **Results dashboard shows** radar chart and sector benchmarks
- [ ] **PDF export generates** downloadable assessment report

---

## Module 19: Security Center

- [ ] **Security Dashboard loads** with KPI cards
- [ ] **Security score and grade display** (A/B/C/D)
- [ ] **18 security checks display** across 5 categories
- [ ] **Infrastructure status shows** service health
- [ ] **Deployment readiness checklist displays** 14 items with pass/fail

---

## Module 20: Audit Trail

- [ ] **Audit Trail loads** with chronological log entries
- [ ] **SHA-256 hash displays** for each entry
- [ ] **Filtering by user/action/resource works**
- [ ] **Export to CSV works** with PII masking applied
- [ ] **Virtualized scrolling performs well** for large datasets (60fps)

---

## Cross-Module Integration Tests

- [ ] **KYC approval updates Command Center analytics** in real-time
- [ ] **AML alert escalation creates** ComplianceAlert and Notification
- [ ] **SAR filing deadline tracking** creates CalendarEvent
- [ ] **Audit finding creates** RemediationAction with due date
- [ ] **Training overdue triggers** ComplianceAlert (type: TRAINING_OVERDUE)
- [ ] **Policy attestation overdue** shows in notification list
- [ ] **Cross-module navigation works** (alert → KYC → SAR → sanctions screening)

---

## Export & Reporting Tests

- [ ] **CSV export generates** valid file with correct headers
- [ ] **PDF export generates** downloadable document
- [ ] **PII masking applies correctly** in all exports (names, IDs, amounts)
- [ ] **Export of empty dataset** handles gracefully (no crash)

---

## Security & Compliance Tests

- [ ] **ErrorBoundary catches** a simulated error without crashing the SPA
- [ ] **Telemetry logs errors** to console in development mode
- [ ] **Security headers present** in HTTP response (HSTS, CSP, X-Frame-Options: DENY)
- [ ] **CSP headers allow** necessary script/style sources
- [ ] **Unauthorized API access returns** 401/403 (not 500)
- [ ] **Zod validation rejects** malformed request bodies with 400 error
- [ ] **Idempotency keys prevent** duplicate compliance operations
- [ ] **Fail-closed behavior:** Sanctions screening defaults to blocking on error

---

## Performance Tests

- [ ] **Initial page load** completes within 3 seconds
- [ ] **Module lazy-loading works** (only active module is loaded)
- [ ] **Virtualized tables scroll** smoothly at 60fps (Admin Panel, Audit Trail)
- [ ] **React Query caching works** (no duplicate API calls for same data)
- [ ] **Sidebar collapse/expand** is smooth with no layout shift

---

## Accessibility & Responsiveness

- [ ] **Mobile layout works** (sidebar collapses, content reflows)
- [ ] **Touch targets** are at least 44px on mobile
- [ ] **Keyboard navigation** works for all interactive elements
- [ ] **Dark mode toggle** works correctly
- [ ] **Sticky footer** stays at viewport bottom on short pages
- [ ] **Footer pushes down** naturally on long pages (no overlap)

---

## Module 21: Unified Investigator Workspace (v7.2)

- [ ] **Unified Workspace loads** with 3-pane resizable layout (Customer 360, Timeline, AI Rationale)
- [ ] **Customer 360 Profile displays** risk score hero, alert info, customer profile, and sanctions screenings
- [ ] **Fund Flow Network Graph renders** SVG nodes and edges with color-coded risk indicators
- [ ] **Transaction Timeline shows** unified events from alerts, transactions, goAML, SAR, and cases
- [ ] **AI Rationale Panel displays** confidence bar, explainable AI summary, red flags, and risk factor breakdown
- [ ] **Action Panel works** — Dismiss, Escalate, File SAR buttons with AlertDialog confirmation requiring justification
- [ ] **Pane resizing is smooth** at 60fps with no visual glitches (React.memo verified)

---

## Module 22: Critical GCC Workflows (v7.2)

- [ ] **Bulk Adjudication processes** 10 alerts as FALSE_POSITIVE with shared-attribute validation
- [ ] **Bulk Adjudication rejects** >500 alert IDs with clear validation error message
- [ ] **Fraud Ring Analytics API returns** node-edge graph structure with cluster detection
- [ ] **Sanctions Mass Freeze requires** dual-confirmation (initiator ≠ confirmer per 4-Eyes Principle)
- [ ] **Sanctions Mass Freeze logs** both user IDs, IP addresses, and timestamps in single audit record
- [ ] **Audit Data Room generates** PII-masked documents with 72-hour access token and SHA-256 integrity hash
- [ ] **Audit Data Room PII masking uses** field-specific functions (maskName, maskEmiratesId, maskTradeLicense, etc.)

---

## Module 23: External Integration Layer (v7.2)

- [ ] **Identity Provider adapter** enforces rate limit (10 req/min) and throws error when exceeded
- [ ] **Screening Provider adapter** enforces rate limit (20 req/min) and returns fail-closed result when exceeded
- [ ] **Regulatory Gateway adapter** enforces rate limit (5 req/min) and returns SUBMISSION_FAILED when exceeded
- [ ] **Screening cache works** — Second request for same entity returns cacheHit=true without API call
- [ ] **goAML submission retry** works with exponential backoff on transient failures
- [ ] **Sanctions Shock rate limit** — Only 3 executions per hour per IP address

---

## Performance & Security (v7.2)

- [ ] **API response times** are sub-200ms for indexed queries (AML triage, claims portal, audit trail)
- [ ] **Bulk adjudication chunking** — Processing 200+ alerts completes without database timeout
- [ ] **PII masking in data room** — Emirates ID shows "784-****-****7-1" pattern (not generic substring mask)
- [ ] **Rate limit headers** present on 429 responses (Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining)

---

## Module 24: AI Compliance Assistant (v7.2 RAG)

- [ ] **Test query for "early surrender"** returns Pack 5 scenario reference in the RAG chatbot response
- [ ] **Verify fallback error message displays** when knowledge base is unavailable (e.g., service down or memory pressure)
- [ ] **Test "Clear Chat" functionality** resets conversation to welcome message, clearing all previous messages

---

## Hardening Verification (v7.2 Batches 1–6)

This section validates that all hardening measures from Batches 1–6 are functioning correctly in the deployed environment.

### Authentication & Authorization (Batch 1)

- [ ] **Unauthenticated API request returns 401** — `curl /api/aml` without session returns `{ success: false, error: "Authentication required" }`
- [ ] **Unauthorized role returns 403** — A `compliance_officer` requesting admin-only endpoint receives `{ success: false, error: "Insufficient permissions" }`
- [ ] **Mass assignment is blocked** — Sending unknown fields in a POST/PUT body returns 400 with field errors
- [ ] **Dev mode bypass is active** — In `NODE_ENV=development`, API requests succeed without real session

### PII Masking (Batch 2)

- [ ] **Emirates ID masked in list view** — `/api/kyc` returns Emirates IDs as `"784-****-****XXX-X"` format
- [ ] **Names masked for auditor role** — Requesting with an `auditor` role returns `"M.A.A."` instead of full names
- [ ] **PII masking toggle works** — `ENABLE_PII_MASKING=false` shows raw data; `true` shows masked data
- [ ] **AI response PII stripping** — Sending an AI chat query that would expose PII returns masked values

### Rate Limiting (Batch 3)

- [ ] **READ tier enforced** — Rapid GET requests beyond 100/min return 429 with `Retry-After` header
- [ ] **WRITE tier enforced** — Rapid POST requests beyond 30/min return 429
- [ ] **SENSITIVE tier enforced** — Rapid AI/bulk requests beyond 10/min return 429
- [ ] **Rate limit headers present** — 429 responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### RAG Pipeline Hardening (Batch 4)

- [ ] **Low-confidence query returns fallback** — Typing a nonsense query (e.g., "xyzzy foo bar") returns the standardized fallback message: *"I could not find a specific predefined workflow for this in the IC-OS Knowledge Base. Please consult the MLRO or refer to the CBUAE/Regulatory manual."*
- [ ] **Fallback response includes modelUsed field** — `modelUsed` is `"fallback-low-confidence"` or `"fallback-no-match"`
- [ ] **Investigation context loads quickly** — `/api/investigation/context` responds in <500ms (parallel queries)
- [ ] **Fraud ring analytics respects limit** — `/api/analytics/fraud-ring?limit=10` returns ≤10 claims

### 30-Day SAR Escalation (Batch 4)

- [ ] **SAR deadline tracking displays** — `/api/sar-deadlines` returns SAR cases with `daysElapsed` and `daysRemaining` fields
- [ ] **Tier 1 escalation at 25 days** — SAR case with `daysRemaining ≤ 5` creates MLRO_ESCALATION compliance alert (severity: high)
- [ ] **Tier 2 escalation at 28 days** — SAR case with `daysRemaining ≤ 2` creates MLRO_ESCALATION compliance alert (severity: critical)
- [ ] **Escalation creates audit log** — Each auto-escalation creates an immutable AuditLog entry with SHA-256 hash
- [ ] **Auto-resolution on submission** — When SAR → SUBMITTED_TO_FIU, active deadline/escalation alerts are resolved

### Error Boundaries (Batch 5)

- [ ] **ComponentErrorBoundary catches simulated crash** — If a sub-component (e.g., Fraud Ring Graph) throws, the error boundary shows a fallback card with "Retry" button without taking down the page
- [ ] **ModuleErrorBoundary catches module crash** — A module-level error shows a compact error card; other modules remain functional
- [ ] **Telemetry logs error** — Caught errors are logged to the telemetry system (visible in dev console)
- [ ] **Retry button works** — Clicking "Retry" on an error boundary resets the component state

### Skeleton Loaders & Empty States (Batch 5)

- [ ] **Skeleton loaders display during loading** — AML Triage, GoAML Filing, Audit Trail show pulsing placeholders while data loads
- [ ] **Empty State shows for zero results** — When AML alerts list is empty, displays "No Alerts Found" with icon and "Clear Filters" button
- [ ] **Empty State Clear Filters works** — Clicking "Clear Filters" resets filters and reloads data

### Inline Form Validation (Batch 5)

- [ ] **KYC form shows inline errors** — Creating a Corporate KYC application with empty required fields shows red borders and error messages below each field
- [ ] **GoAML filing shows inline errors** — Submitting a new STR/SAR draft with invalid data shows per-field validation errors
- [ ] **Error messages are descriptive** — Each field error provides a clear description (e.g., "Legal name is required", "Subject name must be at least 2 characters")

### TypeScript Strictness (Batch 5)

- [ ] **`bun run lint` passes with 0 errors** — Only the pre-existing TanStack Virtual warning is allowed
- [ ] **No `: any` annotations** — `grep -r ": any" src/` returns only justified exceptions
- [ ] **No `@ts-ignore` directives** — `grep -r "@ts-ignore" src/` returns no active directives

### Accessibility (Batch 5)

- [ ] **Slide-to-Confirm is keyboard-operable** — Tab to focus the slider, press Enter/Space to confirm, Arrow keys to adjust position
- [ ] **Kanban cards have ARIA roles** — Each column has `role="list"`, each card has `role="listitem"`, column headers have `aria-label`
- [ ] **Icon buttons have aria-labels** — AI chat clear button, expand button, close button, toggle button all have descriptive `aria-label` attributes
- [ ] **Chat messages are announced** — Messages container has `role="log"` and `aria-live="polite"`

### Production Build Verification (Batch 6)

- [ ] **`bun run build` completes with 0 errors** — Clean production build
- [ ] **No new ESLint warnings** — Only pre-existing TanStack Virtual warning
- [ ] **Dev console.log statements stripped** — Verify telemetry.ts and other files guard console output behind `NODE_ENV === 'development'`
- [ ] **Standalone output generated** — `.next/standalone/` directory exists with `server.js`
- [ ] **Static assets copied** — `.next/standalone/.next/static/` and `.next/standalone/public/` exist

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| MLRO | | | |
| IT Lead | | | |
| Compliance Manager | | | |
| External Auditor | | | |

---

**All tests must pass before production deployment.**  
Any failing test must be documented with a JIRA/issue ticket and resolved before launch.
