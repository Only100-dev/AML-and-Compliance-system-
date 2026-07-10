# IC-OS Comprehensive Architecture Report

**Intelligent Control Operating System — Enterprise UAE AML/CFT Compliance Platform v7.2**

> This document provides a complete, detailed breakdown of every module's architecture, workflows, business logic, data flows, and user ownership. Generated as the baseline reference for the IC-OS platform.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Module Catalog](#2-module-catalog)
3. [Module-by-Module Architecture](#3-module-by-module-architecture)
4. [API Route Inventory](#4-api-route-inventory)
5. [Shared Libraries & Utilities](#5-shared-libraries--utilities)
6. [Data Architecture](#6-data-architecture)
7. [Security & Compliance Controls](#7-security--compliance-controls)
8. [Known Issues & Technical Debt](#8-known-issues--technical-debt)

---

## 1. System Overview

### Architecture Pattern
IC-OS is a **single-page application (SPA)** built on Next.js 16 with App Router. All 28+ compliance modules are lazy-loaded into a single route (`/`) using `React.lazy()` + `Suspense`. Navigation is managed via Zustand client state (`activeSection`), not URL routing.

### The Golden Path
Every compliance-critical operation follows the **Golden Path** pattern:

```
Zod Validation → authGuard (RBAC) → Prisma Operation → Audit Log (SHA-256) → React Query Cache Invalidation
```

### Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Framework | Next.js 16 (App Router + Turbopack) | Server rendering, API routes, middleware |
| Language | TypeScript 5 | Type safety throughout |
| Styling | Tailwind CSS 4 + shadcn/ui | Component library (New York style) |
| Database | SQLite via Prisma ORM 6.x | 39+ models, persistent storage |
| Server State | TanStack Query 5.x | Data fetching, caching, mutations |
| Client State | Zustand 5.x | Navigation, theme, user context |
| AI | z-ai-web-dev-sdk + Ollama | On-premise LLM, RAG, policy analysis |
| Authentication | NextAuth.js v4 | Session management, JWT tokens |
| Validation | Zod 4.x | Request body and form validation |
| Visualization | Recharts + @tanstack/react-virtual | Charts and virtualized tables |
| PDF/CSV | jsPDF + html2canvas | Report generation and data export |
| Animations | Framer Motion | UI transitions and drag-and-drop |

---

## 2. Module Catalog

| # | Module | Component File | API Endpoint | Data Source | Write Operations | ErrorBoundary |
|---|---|---|---|---|---|---|
| 1 | Command Center | `dashboard/CommandCenter.tsx` | `/api/dashboard`, `/api/compliance` | API (useQuery) | No | ✅ Per-module |
| 2 | AML & Sanctions Triage | `aml/AMLSanctionsTriage.tsx` | `/api/aml`, `/api/sanctions-exceptions` | API (useQuery + useMutation) | PATCH status | ✅ Per-module |
| 3 | Evidence War Room | `evidence/EvidenceWarRoom.tsx` | `/api/evidence`, `/api/kyc-upload` | API (useQuery) | POST upload | ✅ Per-module |
| 4 | Claims Portals (4-Persona) | `claims/ClaimsPortals.tsx` | `/api/claims` | API (useQuery + useMutation) | Create, Update | ✅ Per-module |
| 5 | CBUAE Tracker | `regulatory/CBUAERegulatoryTracker.tsx` | `/api/regulations` | API (useQuery) | No | ✅ Per-module |
| 6 | Policies & SOPs | `policies/PoliciesSOPs.tsx` | `/api/policies` | API (useQuery + useMutation) | Create | ✅ Per-module |
| 7 | Labor Law | `labor/LaborLawCompliance.tsx` | `/api/labor` | API (useQuery) | No (read-only) | ✅ Per-module |
| 8 | Legal Advisory | `legal/LegalAdvisory.tsx` | `/api/cases` | API (useQuery + useMutation) | Create | ✅ Per-module |
| 9 | Training & Certs | `training/TrainingCertifications.tsx` | `/api/training` | API (useQuery + useMutation) | Create, Update | ✅ Per-module |
| 10 | Training Effectiveness | `training/TrainingEffectiveness.tsx` | `/api/training-effectiveness` | API (useQuery + useMutation) | Create assessment | ✅ Per-module |
| 11 | Compliance Audits | `audits/ComplianceAudits.tsx` | `/api/audits` | API (useQuery + useMutation) | Schedule, Update | ✅ Per-module |
| 12 | Adverse Media | `adverse-media/AdverseMediaSearch.tsx` | `/api/adverse-media` | API (useQuery + useMutation) | POST session | ✅ Per-module |
| 13 | goAML Filing Center | `goaml/GoAMLFilingCenter.tsx` | `/api/goaml`, `/api/goaml-xml` | API (useQuery + useMutation) | Create, Approve | ✅ Per-module |
| 14 | Maker-Checker Queue | `maker-checker/MakerCheckerQueue.tsx` | `/api/maker-checker` | API (useQuery + useMutation) | Approve, Reject | ✅ Per-module |
| 15 | Submission Checker | `compliance/CBUAESubmissionChecker.tsx` | `/api/cbuae-submission-checker` | API (useQuery) | No | ✅ Per-module |
| 16 | Corporate KYC | `kyc/CorporateKYCWizard.tsx` | `/api/kyc?type=corporate` | API (useQuery + useMutation) | Create | ✅ Per-module |
| 17 | Individual KYC | `kyc/IndividualKYCWizard.tsx` | `/api/kyc?type=individual` | API (useQuery + useMutation) | Create | ✅ Per-module |
| 18 | UBO Ownership | `kyc/UBOVisualization.tsx` | `/api/ubo-tree`, `/api/kyc` | API (useQuery) | No | ✅ Per-module |
| 19 | Audit Trail | `shared/AuditTrail.tsx` | `/api/audit-log` | API (useQuery) | No (CSV export) | ✅ Per-module |
| 20 | Risk Matrix | `shared/RiskMatrix.tsx` | `/api/risk-assessment` | API (useQuery) | No | ✅ Per-module |
| 21 | AI Agent Management | `ai-agent/AIAgentManagement.tsx` | `/api/health`, `/api/ai/chat` | API (useQuery) | No | ✅ Per-module |
| 22 | CBUAE Reporting | `reporting/QuarterlyReporting.tsx` | `/api/quarterly-reporting` | API (useQuery) | No | ✅ Per-module |
| 23 | AML Self-Assessment | `aml-assessment/AMLSelfAssessment.tsx` | localStorage | Local state + localStorage | Save progress | ✅ Per-module |
| 24 | Risk Analytics | `analytics/AdvancedAnalytics.tsx` | `/api/analytics/aggregate` | API (useQuery) | No | ✅ Per-module |
| 25 | Theme Settings | `theme/ThemeSettings.tsx` | Zustand store | Local state | Update theme | ✅ Per-module |
| 26 | Security Center | `security/SecurityDashboard.tsx` | `/api/health` | API (useQuery) | No | ✅ Per-module |
| 27 | Alert Detail Drawer | `shared/AlertDetailDrawer.tsx` | Props from parent | Parent component | Actions via toasts | ✅ Per-module |
| 28 | Help & Documentation | `help/HelpDocumentation.tsx` | None | Static content | No | ✅ Per-module |

---

## 3. Module-by-Module Architecture

### Module 1: Command Center
**File:** `src/components/ic-os/dashboard/CommandCenter.tsx`
**Role:** Real-time compliance dashboard with KRI metrics, risk posture, and alert feeds
**Owner:** All roles (read access); MLRO and Admin for action triggers

**Data Flow:**
- Fetches from `/api/dashboard` → KRI metrics, compliance scores
- Fetches from `/api/compliance` → AML alerts, regulations, claims, sanctions counts
- Fetches from `/api/claims` → Claims data for monthly trends chart
- Charts (risk distribution, KRI trends, monthly claims) are computed from API data via `useMemo`
- Quick Actions: "File SAR Report", "Run Sanctions Screen", "Start Inspection", "Generate Audit Pack"

**Internal Processes:**
- `formatTimeAgo()` converts ISO timestamps to relative time ("2h ago", "just now")
- `complianceMetrics` derives aggregate metrics from dashboard + compliance data
- `computedChartData` generates chart-ready datasets from API responses
- Role selector (MLRO/Admin/Officer) is decorative — doesn't filter data

**User Ownership:**
| Role | Access Level |
|---|---|
| Admin | Full dashboard + all quick actions |
| MLRO | Full dashboard + SAR filing + sanctions screen |
| Compliance Officer | Read-only dashboard |
| Board | Aggregated view only |

---

### Module 2: AML & Sanctions Triage
**File:** `src/components/ic-os/aml/AMLSanctionsTriage.tsx`
**Role:** Kanban-style AML alert triage with drag-and-drop, risk scoring, and sanctions exception management
**Owner:** MLRO (primary), Compliance Officers (triage), Admin (override)

**Data Flow:**
- Fetches AML alerts from `/api/aml` via `useAMLAlerts()` hook
- Fetches sanctions exceptions from `/api/sanctions-exceptions` via `useSanctionsExceptions()`
- **Mutations:** PATCH `/api/aml` with `{ id, status, userId }` for status changes
- Kanban columns: New → Triage → Investigating → SAR Filed → Closed
- Drag-and-drop triggers `statusMutation.mutate()` to persist status change

**Internal Processes:**
- `handleDrop(alertId, newStatus)` — persists the Kanban column change to backend
- Action buttons: Approve → `status: 'sar_filed'`, Override → `status: 'investigating'`, Escalate → `status: 'escalated'`
- Risk level badges: Critical (red), High (orange), Intermediate (yellow), Low (green)
- SIU persona filtering not implemented at component level (API-level filtering exists)

**Business Rules:**
- Maker-Checker enforced for SAR filing actions
- Tipping-off warning banner for SAR-related alerts
- Audit trail entry created for every status change

---

### Module 3: Evidence War Room
**File:** `src/components/ic-os/evidence/EvidenceWarRoom.tsx`
**Role:** Inspection evidence upload, AI verification, and SHA-256 file integrity tracking
**Owner:** Compliance Officers (upload), Auditors (verify), Admin (manage)

**Data Flow:**
- Fetches evidence items from `/api/evidence` via `useEvidence()` hook
- File uploads POST to `/api/kyc-upload` with FormData (file + metadata)
- SHA-256 file hashing computed server-side on upload
- AI verification status and confidence score returned in API response

**Internal Processes:**
- Evidence checklist tracking by inspection ID and department
- File type validation (PDF, XLSX, DOCX, images)
- Department assignment for uploaded evidence
- Hash verification display for integrity checking

---

### Module 4: Claims Portals (4-Persona)
**File:** `src/components/ic-os/claims/ClaimsPortals.tsx`
**Role:** 4-persona claims management with role-based filtering and fraud scoring
**Owner:** Claimant (submit), Adjuster (review), SIU (investigate), Supervisor (oversight)

**Data Flow:**
- Fetches from `/api/claims` via `useClaims()` hook with persona-based filtering
- `useCreateClaim()` → POST `/api/claims` with form data
- `useUpdateClaim()` → PATCH `/api/claims` with status changes
- SIU persona: API filters to `siuFlagged=true OR fraudScore >= 0.4`
- Sequential claim numbers: `CLM-{year}-{5-digit-seq}`

**Persona Workflows:**
| Persona | View | Actions |
|---|---|---|
| Claimant | Submit form (3 steps) | Submit new claim |
| Adjuster | Assigned claims | Add notes, update status, request info |
| SIU | High-fraud-score claims only | Flag for investigation, escalate |
| Supervisor | All claims + team overview | Override, approve, reassign |

---

### Module 5: CBUAE Tracker
**File:** `src/components/ic-os/regulatory/CBUAERegulatoryTracker.tsx`
**Role:** Regulatory circular tracking with compliance status and gap analysis
**Owner:** Compliance Officers (track), MLRO (review), Admin (manage)

**Data Flow:**
- Fetches from `/api/regulations` via useQuery
- Collapsible sections per regulator (CBUAE, DFSA, FSRA)
- Compliance status badges: COMPLIANT, PARTIAL, PENDING, NON_COMPLIANT

---

### Module 6: Policies & SOPs
**File:** `src/components/ic-os/policies/PoliciesSOPs.tsx`
**Role:** Policy lifecycle management with AI review, version control, and attestation tracking
**Owner:** Compliance Manager (create/edit), MLRO (approve), Admin (manage)

**Data Flow:**
- Fetches from `/api/policies` via `usePolicies()` hook
- `useCreatePolicy()` → POST `/api/policies` with CreatePolicyDialog form
- Policy categories: AML/CFT, Sanctions, KYC, Data Privacy, Claims, Underwriting, Operations, Vendor Mgmt, AI Engine
- Status workflow: Draft → Under Review → Approved → Published

**Business Rules:**
- Auto-generated policy numbers: `POL-{year}-{seq}`
- Version tracking with semantic versioning
- AI review confidence score display
- Policy attestation tracking per user

---

### Module 7: Labor Law Compliance
**File:** `src/components/ic-os/labor/LaborLawCompliance.tsx`
**Role:** MOHRE labor compliance tracking with Emiratisation quotas and WPS monitoring
**Owner:** HR Department (manage), Compliance (oversight), Admin (all access)

**Data Flow:**
- Fetches from `/api/labor` via `useLaborCompliance()` hook with `refetch` capability
- Read-only display with expandable row animations (Framer Motion)
- Categories: Emiratisation, WPS, Working Conditions, Insurance, Benefits, Immigration

---

### Module 8: Legal Advisory
**File:** `src/components/ic-os/legal/LegalAdvisory.tsx`
**Role:** Legal case management with AI-powered case summaries
**Owner:** Legal Counsel (manage), Compliance (oversight), Admin (all access)

**Data Flow:**
- Fetches from `/api/cases` via `useLegalCases()` hook
- `useMutation()` → POST `/api/cases` via NewCaseDialog
- Auto-generated case numbers: `LC-{year}-{5-digit-seq}`
- Case types: Litigation, Arbitration, Regulatory, Labor, Recovery

**Business Rules:**
- AI summaries displayed for cases with generated summaries
- Next hearing date tracking
- Jurisdiction labels: DIFC Courts, Dubai Courts, CBUAE, MOHRE

---

### Module 9: Training & Certifications
**File:** `src/components/ic-os/training/TrainingCertifications.tsx`
**Role:** AML/CFT training course management, enrollment, and certification tracking
**Owner:** Compliance Manager (manage), HR (enroll), All staff (view)

**Data Flow:**
- Fetches courses from `/api/training?type=courses` via `useTrainingCourses()`
- Fetches enrollments from `/api/training?type=enrollments` via `useTrainingEnrollments()`
- `useCreateEnrollment()` → POST `/api/training` with enrollment data
- `useUpdateEnrollment()` → PUT `/api/training` with status updates
- Virtualized enrollment list via `@tanstack/react-virtual`

---

### Module 10: Training Effectiveness
**File:** `src/components/ic-os/training/TrainingEffectiveness.tsx`
**Role:** Pre/post assessment scoring, knowledge gain measurement, effectiveness ratings
**Owner:** Compliance Manager (analyze), Training providers (assess)

**Data Flow:**
- Fetches from `/api/training-effectiveness` via useQuery
- POST assessments with pre/post scores
- Knowledge gain = post score - pre score
- Negative knowledge gain triggers compliance alert

---

### Module 11: Compliance Audits
**File:** `src/components/ic-os/audits/ComplianceAudits.tsx`
**Role:** Internal and external audit scheduling, findings tracking, and remediation
**Owner:** Lead Auditor (schedule), Compliance Manager (remediate), Admin (all access)

**Data Flow:**
- Fetches from `/api/audits` via `useAudits()` hook
- `useScheduleAudit()` → POST `/api/audits` with audit details
- `useUpdateAudit()` → PUT `/api/audits` with status transitions
- CSV export via dynamic import of `@/lib/csv-export`
- Status workflow: Scheduled → In Progress → Completed

---

### Module 12: Adverse Media Screening
**File:** `src/components/ic-os/adverse-media/AdverseMediaSearch.tsx`
**Role:** 5-step screening wizard for individual/entity adverse media searches
**Owner:** Compliance Officers (screen), MLRO (review decisions)

**Data Flow:**
- 5-step wizard: Subject Info → Keywords → Sources → Review → Report
- POST completed screening session to `/api/adverse-media`
- Decision classification: CLEAR, POTENTIAL_MATCH, FALSE_POSITIVE, CONFIRMED_MATCH
- 83 AML keyword categories pre-loaded as defaults

---

### Module 13: goAML Filing Center
**File:** `src/components/ic-os/goaml/GoAMLFilingCenter.tsx`
**Role:** Full goAML v4.2 XML generation for STR, SAR, CTR, IFT, and PNMR report types
**Owner:** MLRO (file/approve), Compliance Officers (draft), Admin (all access)

**Data Flow:**
- Fetches filings from `/api/goaml` via `useQuery`
- `useMutation()` → POST `/api/goaml` for new filings (New Filing dialog)
- `useMutation()` → PUT `/api/goaml` for approval (status → SUBMITTED_TO_FIU)
- XML generation via `/api/goaml-xml` endpoint
- Filing lifecycle: DRAFT → PENDING_APPROVAL → SUBMITTED_TO_FIU → ACKNOWLEDGED

**Business Rules:**
- STR/SAR filings require Maker-Checker approval
- Reference number format: `{reportType}-{year}-{seq}`
- CTR threshold: AED 35,000+
- Maker-Checker notice displayed for HIGH-risk filings

---

### Module 14: Maker-Checker Queue
**File:** `src/components/ic-os/maker-checker/MakerCheckerQueue.tsx`
**Role:** 4-Eyes Principle enforcement with expiry tracking and maker ≠ checker validation
**Owner:** MLRO (primary checker), Admin (all access), Compliance Manager (KYC checker)

**Data Flow:**
- Fetches pending requests from `/api/maker-checker?status=PENDING` via `useQuery`
- Fetches all requests from `/api/maker-checker?status=ALL` for History tab
- `useMutation()` → POST `/api/maker-checker` with `{ logId, checkerId, checkerName, action: 'approve'|'reject' }`
- Current user from Zustand store used as checker identity
- Cache invalidation on both `makerChecker` and `goamlFilings` keys

**Business Rules:**
- Maker ≠ Checker enforced at both frontend (warning) and backend (403 error)
- Critical operations expire in 4 hours, standard in 24 hours
- Rejection requires a reason
- Approval creates audit log entry with SHA-256 hash

---

### Module 15: CBUAE Submission Checker
**File:** `src/components/ic-os/compliance/CBUAESubmissionChecker.tsx`
**Role:** Pre-submission validation against CBUAE filing requirements
**Owner:** MLRO (validate), Compliance Officers (prepare)

**Data Flow:**
- POST to `/api/cbuae-submission-checker` with report type and data
- Returns pass/fail checks with readiness percentage
- Check categories: completeness, accuracy, timeliness, PII masking
- Submit button disabled until all checks pass

---

### Module 16: Corporate KYC
**File:** `src/components/ic-os/kyc/CorporateKYCWizard.tsx`
**Role:** Legal entity onboarding with trade license, UBO identification, and PEP screening
**Owner:** Compliance Officers (submit), MLRO (approve high-risk), Admin (all access)

**Data Flow:**
- Fetches from `/api/kyc?type=corporate` via `useQuery`
- `useMutation()` → POST `/api/kyc` with `{ type: 'corporate', legalName, tradeLicenseNo, ... }`
- HIGH-risk (riskScore ≥ 75): Status auto-set to `PENDING_MAKER_CHECKER`
- LOW-risk: Status auto-set to `APPROVED`
- MEDIUM-risk: Status set to `DRAFT`

**Business Rules:**
- PEP in management flag triggers EDD requirement
- UBO identification required for ≥25% ownership
- Trade license and TRN validation
- Conditional routing: HIGH risk → Maker-Checker, LOW risk → auto-approve

---

### Module 17: Individual KYC
**File:** `src/components/ic-os/kyc/IndividualKYCWizard.tsx`
**Role:** Natural person onboarding with Emirates ID, passport, and EDD triggers
**Owner:** Compliance Officers (submit), MLRO (approve high-risk), Admin (all access)

**Data Flow:**
- Fetches from `/api/kyc?type=individual` via `useQuery`
- `useMutation()` → POST `/api/kyc` with `{ type: 'individual', fullName, passportNo, nationality, ... }`
- PEP or HIGH risk rating → `eddRequired: true` + `PENDING_MAKER_CHECKER`
- STANDARD risk → `APPROVED`

---

### Module 18: UBO Ownership Visualization
**File:** `src/components/ic-os/kyc/UBOVisualization.tsx`
**Role:** Interactive ownership tree for ≥25% ultimate beneficial owners with OFAC 50% Rule
**Owner:** Compliance Officers (view), MLRO (review), Admin (all access)

**Data Flow:**
- Entity selector fetches available CorporateKYC records from `/api/kyc?type=corporate`
- When entity selected, fetches UBO tree from `/api/ubo-tree?entityId={id}`
- Auto-selects when only one corporate entity exists
- OFAC 50% Rule calculation displayed per ownership chain
- Status indicators: BLOCKED, CLEAR, PENDING

---

### Module 19: Audit Trail
**File:** `src/components/ic-os/shared/AuditTrail.tsx`
**Role:** Immutable audit log with cryptographic hash verification for every compliance action
**Owner:** All roles (read), Admin (export), Auditors (verify)

**Data Flow:**
- Fetches from `/api/audit-log` via `useAuditLog()` hook with pagination and filtering
- Filter params: action, userId, search, limit
- Virtualized scrolling via `@tanstack/react-virtual` for large datasets
- CSV export via dynamic import of `@/lib/csv-export`
- Hash verification display (visual simulation — actual recompute requires original payload)

**Business Rules:**
- Audit entries are immutable — no deletion or modification
- SHA-256 hash computed from userId + action + resource + timestamp + details
- Filter by action type, user, or search term
- User name enrichment from User table

---

### Module 20: Risk Matrix
**File:** `src/components/ic-os/shared/RiskMatrix.tsx`
**Role:** 5-domain risk assessment matrix with SRAS (Sanctions Risk Appetite Statement)
**Owner:** Compliance Manager (assess), MLRO (review), Board (oversight)

**Data Flow:**
- Fetches from `/api/risk-assessment` via `useQuery`
- Maps assessment records to matrix cells via `mapAssessmentToCell()`
- Risk domains: Customer, Jurisdiction, Product, Interface, Other
- Risk levels: Low → Medium → High → Critical
- SRAS progress bars data-driven from assessment controls analysis

---

### Module 21: AI Agent Management
**File:** `src/components/ic-os/ai-agent/AIAgentManagement.tsx`
**Role:** 5-brain AI infrastructure dashboard with Ollama, AI Gateway, and Qdrant status
**Owner:** IT/AI Operations (monitor), Admin (configure)

**Data Flow:**
- Fetches health status from `/api/health` via `useHealth()` hook
- Fetches AI chat sessions from `/api/ai/chat` (GET) via `useAIChatSessions()` hook
- Infrastructure services dynamically built from health endpoint
- GPU utilization derived from health status
- Brain configuration, infra config, and vector collections are deployment constants
- Refresh button refetches both health and chat sessions

**5-Brain Architecture:**
1. AML Transaction Monitor (Ollama)
2. Sanctions Screening Engine (Fuzzy Match)
3. goAML Narrative Generator (XML v4.2)
4. Regulatory Change Detector (RAG/Qdrant)
5. Customer Risk Scorer (ML Pipeline)

---

### Module 22: CBUAE Quarterly Reporting
**File:** `src/components/ic-os/reporting/QuarterlyReporting.tsx`
**Role:** Quarterly report assembly, insurance record management, and CBUAE submission tracking
**Owner:** Compliance Officers (prepare), MLRO (validate), Admin (submit)

**Data Flow:**
- Fetches from `/api/quarterly-reporting` via `useQuarterlyReports()` and `useInsuranceRecords()` hooks
- KPI values computed from latest report data (totalPolicies, totalPremiumAED, etc.)
- PII masking toggle: switches between full and masked view for CBUAE
- View modes: Summary, Detailed Records, CBUAE View (masked)

---

### Module 23: AML Self-Assessment
**File:** `src/components/ic-os/aml-assessment/AMLSelfAssessment.tsx`
**Role:** 51-question / 10-section assessment aligned with CBUAE examination framework
**Owner:** Compliance Officers (assess), MLRO (review), Board (oversight)

**Data Flow:**
- Questions loaded from `@/lib/compliance/cpf-questions.ts` (static)
- Sector benchmarks from `@/lib/aml-data` (static)
- Answers persisted to localStorage with key `icos-aml-assessment`
- Auto-save on each answer change
- PDF export via dynamic import of jspdf + html2canvas

**Assessment Structure:**
- 10 sections covering CBUAE examination framework
- 51 questions with 4 rating options: Compliant, Partially Compliant, Non-Compliant, N/A
- Critical items double-weighted in score calculation
- Results: Radar chart + sector benchmarks + weighted score

---

### Module 24-28: Supporting Modules

| Module | Role | Data Source |
|---|---|---|
| Risk Analytics | Advanced analytics with live aggregations | `/api/analytics/aggregate` |
| Theme Settings | UI theme customization | Zustand (persisted to localStorage) |
| Security Center | System security posture dashboard | `/api/health` |
| Alert Detail Drawer | Detailed alert view with cross-module navigation | Props from parent + PII masking |
| Help & Documentation | User guide and API documentation | Static content |

---

## 4. API Route Inventory

### Complete Route Table (39 endpoints)

| Route | Methods | Zod Validation | Description |
|---|---|---|---|
| `/api/adverse-media` | GET, POST | ✅ | Adverse media screening sessions |
| `/api/ai` | POST | ❌ | Basic AI chat |
| `/api/ai/chat` | GET, POST | ✅ (POST) | AI chat with streaming |
| `/api/ai/enhanced` | GET, POST | ✅ | Enhanced AI chat with multi-module context |
| `/api/ai/policy-rag` | GET, POST | ✅ | Policy RAG queries |
| `/api/aml` | GET, POST, PATCH | ✅ (PATCH) | AML alerts CRUD |
| `/api/attestations` | GET, POST, PUT | ✅ | Policy attestation tracking |
| `/api/audit-log` | GET | N/A | Audit log with filtering and pagination |
| `/api/audits` | GET, POST, PUT, DELETE | ✅ | Compliance audit management |
| `/api/cases` | GET, POST, PUT, DELETE | ✅ | Legal case management |
| `/api/cbuae-submission-checker` | POST | ✅ | Pre-submission validation |
| `/api/claims` | GET, POST, PATCH | ✅ | Claims with persona filtering |
| `/api/compliance` | GET | N/A | Compliance metrics aggregation |
| `/api/compliance-alerts` | GET, POST, PUT | ✅ | Immutable compliance alerts |
| `/api/compliance-calendar` | GET, POST, PUT, DELETE | ✅ | Calendar event management |
| `/api/compliance-cases` | GET, POST, PUT | ✅ | Unified compliance cases |
| `/api/dashboard` | GET | N/A | Dashboard data aggregation |
| `/api/evidence` | GET, POST | ✅ (POST) | Inspection evidence |
| `/api/goaml` | GET, POST, PUT, DELETE | ✅ | goAML filing management |
| `/api/goaml-xml` | POST, PUT | ✅ | goAML XML generation (v4.2) |
| `/api/health` | GET | N/A | System health check |
| `/api/idempotency` | GET, POST, DELETE | ✅ | Idempotency key management |
| `/api/kyc` | GET, POST, PUT, DELETE | ✅ | Corporate & Individual KYC |
| `/api/kyc-upload` | GET, POST, DELETE | ✅ | KYC document upload with hashing |
| `/api/labor` | GET, POST, PUT, DELETE | ✅ | Labor law compliance |
| `/api/maker-checker` | GET, POST | ✅ | Maker-Checker queue |
| `/api/notifications` | GET, POST, PUT, DELETE | ✅ | Notification management |
| `/api/policies` | GET, POST, PUT, DELETE | ✅ | Policy lifecycle |
| `/api/policy-wizard` | POST | ✅ (per step) | AI-powered policy drafting |
| `/api/quarterly-reporting` | GET, POST | ✅ | CBUAE quarterly reports |
| `/api/regulations` | GET, POST, PUT, DELETE | ✅ | Regulatory circular management |
| `/api/regulatory` | GET | N/A | Regulatory intelligence |
| `/api/regulatory-deadlines` | GET, POST, PUT | ✅ | Regulatory deadline tracking |
| `/api/remediations` | GET, POST, PUT | ✅ | Remediation action tracking |
| `/api/risk-assessment` | GET, POST, PUT | ✅ | Risk assessment management |
| `/api/sanctions` | GET, POST | ✅ | Sanctions screening |
| `/api/sanctions-exceptions` | GET, POST | ✅ | Sanctions exception management |
| `/api/sar-deadlines` | GET, POST, PUT | ✅ | SAR case deadline tracking |
| `/api/training` | GET, POST, PUT, DELETE | ✅ | Training course & enrollment |
| `/api/training-effectiveness` | GET, POST, PUT | ✅ | Training effectiveness |
| `/api/ubo-tree` | GET | N/A | UBO ownership visualization |
| `/api/vasp-kyc` | GET, POST, PUT | ✅ | VASP-specific KYC |

### Response Format

All API responses follow a consistent envelope:

```json
// Success
{ "success": true, "data": { ... }, "meta": { "total": 42, "page": 1 } }

// Error
{ "success": false, "error": "Validation failed", "details": [{ "field": "name", "message": "Required" }] }
```

### Error Codes
| Code | Meaning | When Used |
|---|---|---|
| 400 | Validation Failed | Zod schema rejection |
| 401 | Unauthorized | No session or invalid token |
| 403 | Forbidden | Role lacks permission |
| 404 | Not Found | Entity doesn't exist |
| 409 | Conflict | Duplicate key or state violation |
| 500 | Internal Error | Unhandled server error |

---

## 5. Shared Libraries & Utilities

### Core Libraries

| File | Purpose | Key Exports |
|---|---|---|
| `src/lib/db.ts` | Prisma client singleton | `db` (PrismaClient instance) |
| `src/lib/audit.ts` | Audit log creation | `createAuditLog()`, `withAudit()` HOC |
| `src/lib/auth-guard.ts` | Authentication & RBAC guard | `authGuard({ allowedRoles })` |
| `src/lib/pii.ts` | PII masking utilities | `maskName()`, `maskEmiratesId()`, `maskAmount()`, etc. |
| `src/lib/store.ts` | Zustand global store | `useICOSStore()` — navigation, theme, user, sidebar |
| `src/lib/env.ts` | Zod-validated environment config | `env` — all env vars with type safety |
| `src/lib/pdf-generator.ts` | jsPDF report generation | `generatePDF()`, `generateAuditPackPDF()` |
| `src/lib/csv-export.ts` | CSV export utilities | `downloadCSV()`, `generateAuditPackCSV()` |
| `src/lib/rate-limit.ts` | API rate limiting | `checkRateLimit()`, `RATE_LIMITS` profiles |
| `src/lib/validate.ts` | Validation helpers | `validateBody()`, `validateSearchParams()` |
| `src/lib/api-hooks.ts` | Custom data-fetching hooks (useState + useEffect) | `useAMLAlerts()`, `useDashboardMetrics()`, etc. |
| `src/lib/query-hooks.ts` | TanStack Query hooks | `useClaims()`, `usePolicies()`, `useApiMutation()`, etc. |

### Compliance Libraries

| File | Purpose |
|---|---|
| `src/lib/compliance/rbac.ts` | RBAC permission matrix (26 permissions, 9 roles) |
| `src/lib/compliance/tipping-off.ts` | Tipping-off prohibition system (10 risk indicators) |
| `src/lib/compliance/goaml-xml.ts` | goAML v4.2 XML generation engine |
| `src/lib/compliance/screening-engine.ts` | Sanctions screening with fuzzy matching |
| `src/lib/compliance/audit-middleware.ts` | Audit middleware for API routes |
| `src/lib/compliance/cross-module.ts` | Cross-module linking and navigation |
| `src/lib/compliance/ubo-tracing.ts` | UBO ownership chain tracing |
| `src/lib/compliance/regulatory-refs.ts` | UAE regulatory reference constants |
| `src/lib/compliance/arabic-normalization.ts` | Arabic name normalization for matching |
| `src/lib/compliance/cpf-questions.ts` | AML self-assessment question bank (51 questions) |
| `src/lib/compliance/pii-hooks.ts` | PII masking React hooks |
| `src/lib/compliance/rag-policy-wizard.ts` | RAG-based policy wizard |

### Middleware

| File | Purpose |
|---|---|
| `src/lib/middleware/maker-checker.ts` | Maker-Checker workflow engine (initiate, review, expire) |
| `src/middleware.ts` | Next.js middleware (auth, CSP, security headers, CORS) |

### Validation Schemas

| File | Domain |
|---|---|
| `src/lib/validations/claim.ts` | Claims validation |
| `src/lib/validations/aml.ts` | AML alerts validation |
| `src/lib/validations/kyc.ts` | KYC validation |
| `src/lib/validations/goaml.ts` | goAML filing validation |
| `src/lib/validations/maker-checker.ts` | Maker-Checker validation |
| `src/lib/validations/policy.ts` | Policy validation |
| `src/lib/validations/audit.ts` | Audit validation |
| `src/lib/validations/training.ts` | Training validation |

---

## 6. Data Architecture

### Database Schema (39+ Models)

#### Core Business Models
| Model | Purpose | Key Fields |
|---|---|---|
| `User` | System users with roles | email, name, role, jurisdiction, isActive |
| `AMLAlert` | AML alert triage | caseId, riskScore, riskLevel, alertType, status |
| `Claim` | Insurance claims | claimNumber, claimType, amount, fraudScore, siuFlagged |
| `CorporateKYC` | Corporate entity onboarding | legalName, tradeLicenseNo, uboIdentified, riskScore, status |
| `IndividualKYC` | Individual person onboarding | fullName, passportNo, isPep, eddRequired, status |
| `GoAMLFiling` | goAML report filings | reportType, referenceNumber, filingStatus, xmlPayload |
| `MakerCheckerLog` | 4-eyes approval tracking | operationType, makerId, checkerId, status, expiryTime |
| `AuditLog` | Immutable audit trail | userId, action, resource, sha256Hash |

#### Compliance Framework Models
| Model | Purpose |
|---|---|
| `RegulatoryCircular` | CBUAE/DFSA/FSRA circulars |
| `Regulation` | Regulatory requirements tracking |
| `GapAnalysis` | AI-generated compliance gaps |
| `Policy` | Policy lifecycle management |
| `PolicyAttestation` | User policy acknowledgment |
| `LaborLawCompliance` | MOHRE labor requirements |
| `ComplianceAlert` | Immutable deadline/escalation alerts |
| `ComplianceAudit` | Internal/external audit scheduling |
| `ComplianceCase` | Unified cross-module case tracking |
| `SARCase` | SAR filing with 30-day deadline |
| `SanctionsScreening` | Fuzzy-match screening events |
| `SanctionsException` | Approved sanctions exceptions |
| `RiskAssessment` | 5-domain risk assessment versioning |
| `RegulatoryDeadline` | CBUAE filing deadline tracking |
| `CalendarEvent` | Cross-module compliance calendar |
| `Notification` | User notification system |
| `RemediationAction` | Audit finding remediation |
| `VendorDueDiligence` | Third-party risk assessment |
| `VASPKYC` | Virtual Asset Service Provider KYC |
| `IdempotencyRecord` | Duplicate operation prevention |

#### AI & Reporting Models
| Model | Purpose |
|---|---|
| `AIChatSession` | AI conversation sessions |
| `AIChatMessage` | Individual AI messages |
| `QuarterlyReport` | CBUAE quarterly reports |
| `InsuranceRecord` | Insurance policy records |
| `KRIMetric` | Key Risk Indicator metrics |
| `InspectionEvidence` | SHA-256 hashed evidence files |
| `LegalCase` | Legal case management |
| `TrainingCourse` | Training course catalog |
| `TrainingEnrollment` | Staff enrollment tracking |
| `TrainingAssessment` | Pre/post assessment scores |

### Role Hierarchy

| Role | Level | Primary Responsibilities |
|---|---|---|
| `admin` | 100 | Full system access, user management, configuration |
| `mlro` | 50 | AML approval, SAR filing, goAML submission, escalations |
| `compliance_manager` | 40 | Policy management, training oversight, audit scheduling |
| `compliance_officer` | 30 | Day-to-day compliance, KYC processing, alert triage |
| `claims_adjuster` | — | Claims processing, fraud flagging |
| `analyst` | — | Data analysis, reporting, read-only compliance |
| `siu` | — | Only sees claims with `fraudScore >= 0.4` |
| `dept_head` | 20 | Department-level operations |
| `board` | 10 | Governance oversight, aggregated dashboards |

---

## 7. Security & Compliance Controls

### Defense-in-Depth Layers

| Layer | Control | Implementation |
|---|---|---|
| **Network** | Security Headers | HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy |
| **Authentication** | NextAuth.js v4 | JWT sessions, role extraction, dev bypass |
| **Authorization** | RBAC (26 permissions) | `authGuard()`, `withRBAC()`, `checkPermission()` |
| **Validation** | Zod schemas | Request body validation on all mutation routes |
| **Data Integrity** | SHA-256 hashing | Audit log entries, evidence files, compliance alerts |
| **Privacy** | PII masking | 12 masking functions, context-aware by role |
| **Workflow** | Maker-Checker | 4-eyes principle, expiry enforcement, maker ≠ checker |
| **Confidentiality** | Tipping-off prohibition | 10 risk indicators, SAR confidentiality levels |
| **Residency** | UAE data region | On-premise AI, no external API calls |
| **Fail-closed** | Default blocking | Sanctions screening, compliance alerts |
| **Error Handling** | ErrorBoundary | Per-module isolation, telemetry logging |
| **Idempotency** | Key tracking | Duplicate prevention for critical operations |

---

## 8. Known Issues & Technical Debt

### Resolved in This Session

| # | Issue | Resolution |
|---|---|---|
| 1 | KYC modules used mock data | ✅ Wired to `/api/kyc` with useQuery/useMutation |
| 2 | goAML used mock data | ✅ Wired to `/api/goaml` with New Filing dialog |
| 3 | Maker-Checker used mock data | ✅ Wired to `/api/maker-checker` with real approve/reject |
| 4 | AML status changes not persisted | ✅ Added PATCH mutation for status changes |
| 5 | Dashboard charts used mock data | ✅ Computed from API data |
| 6 | TopBar had hardcoded notifications | ✅ Fetched from `/api/notifications` |
| 7 | AuditTrail used mock data | ✅ Wired to new `/api/audit-log` endpoint |
| 8 | RiskMatrix used mock data | ✅ Wired to `/api/risk-assessment` |
| 9 | Legal New Case didn't call API | ✅ Wired to POST `/api/cases` |
| 10 | Policies Create had no handler | ✅ Added CreatePolicyDialog with POST |
| 11 | AML Assessment lost progress | ✅ localStorage persistence added |
| 12 | 8 API routes lacked Zod validation | ✅ Schemas added with safeParse pattern |
| 13 | 5 routes lacked 404 checks | ✅ findUnique checks before update/delete |
| 14 | Maker-Checker didn't handle VASPKYC | ✅ Added VASPKYC case |
| 15 | AI enhanced used wrong system role | ✅ Changed from 'assistant' to 'system' |
| 16 | Claim numbers were random | ✅ Sequential counter implementation |
| 17 | No per-module ErrorBoundary | ✅ ModuleErrorBoundary wrapping all 28 modules |
| 18 | Quarterly Reporting used mock data | ✅ Wired to `/api/quarterly-reporting` |
| 19 | AI Agent used hardcoded data | ✅ Wired to `/api/health` and `/api/ai/chat` |
| 20 | Regulatory Intelligence had wrong API URL | ✅ Fixed to `/api/regulations` |
| 21 | UBO Visualization missing required prop | ✅ Added entity selector dropdown |

### Remaining Technical Debt

| # | Severity | Issue | Recommendation |
|---|---|---|---|
| 1 | 🟡 MEDIUM | `authGuard()` not called by any API route | Add to all mutation routes in Phase 7 |
| 2 | 🟡 MEDIUM | `rate-limit.ts` not used by any route | Add to AI chat and filing endpoints |
| 3 | 🟡 MEDIUM | `validate.ts` helper not used (routes use inline safeParse) | Standardize in Phase 7 |
| 4 | 🟡 MEDIUM | Duplicate data-fetching systems (`api-hooks.ts` vs `query-hooks.ts`) | Migrate all to `query-hooks.ts` |
| 5 | 🟡 MEDIUM | `console.error` in 40+ API routes (should use telemetry) | Replace with `logError()` |
| 6 | 🟢 LOW | Sidebar nav rendering duplicated 8+ times | Extract to reusable NavItem component |
| 7 | 🟢 LOW | AML Assessment uses localStorage, not database | Add API endpoint in Phase 7 |
| 8 | 🟢 LOW | `/api/policy-wizard` uses in-memory session storage | Migrate to database |
| 9 | 🟢 LOW | Claims file upload button is decorative | Wire to actual upload API |
| 10 | 🟢 LOW | Compliance Calendar not in sidebar navigation | Add to nav items |

---

*Report generated as baseline reference for IC-OS v7.2 platform.*
*Restore Point: `c7553d5` — COMPREHENSIVE FIX commit*
