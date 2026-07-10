# IC-OS v7.2 — Version & Dependency Matrix

> **Generated:** 2025-03-04 | **Commit:** `127b761` | **Platform:** IC-OS v7.2

---

## 1. Runtime & Tooling Versions

| Runtime / Tool | Version | Notes |
|---|---|---|
| **Bun** | 1.3.14 | Primary JS runtime & package manager |
| **Node.js** | v24.16.0 | Secondary / compatibility runtime |
| **Next.js** | ^16.1.1 | App Router, RSC, SSR |
| **React** | ^19.0.0 | React 19 with concurrent features |
| **TypeScript** | ^5 | Strict mode enabled |
| **Prisma** | ^6.11.1 | ORM with SQLite provider |
| **Git Commit (HEAD)** | `127b761` | Current working tree state |

### Recent Git History

| Hash | Message |
|---|---|
| `127b761` | 8d4ca2f7-5f12-4832-ac76-52bf1c3cc7b4 |
| `aa75d11` | BASELINE: Comprehensive Architecture Report |
| `c7553d5` | COMPREHENSIVE FIX: Wire all mock modules to real APIs, add Zod validation |
| `61fd232` | PROJECT COMPLETE: Executive Summary, Deployment Checklist, Phase 7 Roadmap |
| `8ba2635` | PHASE 6 COMPLETE: Final QA, Documentation & Deployment Readiness |
| `897cf7f` | RESTORE POINT: Pre-Phase 6 - All Phase 1-5 complete |
| `6d167ea` | 68a65afb-68c2-4999-b310-4fe0a2344c08 |
| `778c360` | Phase 5 Complete: Operational Workflows, Live Analytics, Export Engine |
| `29b6dbd` | d1c55e39-4c90-46e4-8335-914a49135875 |
| `74f55e6` | a1e664cf-41fe-404a-81e4-b86873c442a6 |

---

## 2. Critical Dependencies (Production)

### Core Framework

| Package | Version | Purpose |
|---|---|---|
| `next` | ^16.1.1 | Full-stack React framework (App Router, RSC, SSR, API routes) |
| `react` | ^19.0.0 | UI rendering library with concurrent features |
| `react-dom` | ^19.0.0 | React DOM renderer |

### Database

| Package | Version | Purpose |
|---|---|---|
| `@prisma/client` | ^6.11.1 | Prisma client for type-safe database queries |
| `prisma` | ^6.11.1 | Prisma CLI (migrations, schema, studio) |

### State Management

| Package | Version | Purpose |
|---|---|---|
| `@tanstack/react-query` | ^5.82.0 | Server state management, caching, background refetch |
| `@tanstack/react-table` | ^8.21.3 | Headless table component with sorting, filtering, pagination |
| `@tanstack/react-virtual` | ^3.14.2 | Virtualized list rendering for large datasets |
| `zustand` | ^5.0.6 | Client-side global state store (theme, UI state) |

### Validation

| Package | Version | Purpose |
|---|---|---|
| `zod` | ^4.0.2 | Schema validation for API inputs and form data |
| `react-hook-form` | ^7.60.0 | Form state management with controlled components |
| `@hookform/resolvers` | ^5.1.1 | Zod resolver bridge for react-hook-form |

### UI Library — Radix Primitives

| Package | Version | Purpose |
|---|---|---|
| `@radix-ui/react-accordion` | ^1.2.11 | Collapsible accordion sections |
| `@radix-ui/react-alert-dialog` | ^1.1.14 | Modal confirmation dialogs |
| `@radix-ui/react-aspect-ratio` | ^1.1.7 | Aspect ratio container |
| `@radix-ui/react-avatar` | ^1.1.10 | User avatars with fallback |
| `@radix-ui/react-checkbox` | ^1.3.2 | Checkbox input |
| `@radix-ui/react-collapsible` | ^1.1.11 | Collapsible content areas |
| `@radix-ui/react-context-menu` | ^2.2.15 | Right-click context menus |
| `@radix-ui/react-dialog` | ^1.1.14 | Accessible modal dialogs |
| `@radix-ui/react-dropdown-menu` | ^2.1.15 | Dropdown menus |
| `@radix-ui/react-hover-card` | ^1.1.14 | Hover cards for entity previews |
| `@radix-ui/react-label` | ^2.1.7 | Accessible form labels |
| `@radix-ui/react-menubar` | ^1.1.15 | Menu bar navigation |
| `@radix-ui/react-navigation-menu` | ^1.2.13 | Navigation menus |
| `@radix-ui/react-popover` | ^1.1.14 | Popover overlays |
| `@radix-ui/react-progress` | ^1.1.7 | Progress bars |
| `@radix-ui/react-radio-group` | ^1.3.7 | Radio button groups |
| `@radix-ui/react-scroll-area` | ^1.2.9 | Custom scrollable areas |
| `@radix-ui/react-select` | ^2.2.5 | Select dropdowns |
| `@radix-ui/react-separator` | ^1.1.7 | Visual dividers |
| `@radix-ui/react-slider` | ^1.3.5 | Slider input controls |
| `@radix-ui/react-slot` | ^1.2.3 | Polymorphic component composition |
| `@radix-ui/react-switch` | ^1.2.5 | Toggle switches |
| `@radix-ui/react-tabs` | ^1.1.12 | Tabbed content panels |
| `@radix-ui/react-toast` | ^1.2.14 | Toast notifications |
| `@radix-ui/react-toggle` | ^1.1.9 | Toggle buttons |
| `@radix-ui/react-toggle-group` | ^1.1.10 | Toggle button groups |
| `@radix-ui/react-tooltip` | ^1.2.7 | Tooltip overlays |

### UI Library — Styling & Composition

| Package | Version | Purpose |
|---|---|---|
| `class-variance-authority` | ^0.7.1 | Variant-based component styling (cva) |
| `clsx` | ^2.1.1 | Conditional className merging |
| `tailwind-merge` | ^3.3.1 | Tailwind class conflict resolution |
| `lucide-react` | ^0.525.0 | Icon library (1000+ icons) |
| `framer-motion` | ^12.23.2 | Animation library for transitions and gestures |
| `cmdk` | ^1.1.1 | Command palette component (Cmd+K) |
| `sonner` | ^2.0.6 | Toast notification system |
| `vaul` | ^1.1.2 | Drawer component (bottom sheet) |
| `embla-carousel-react` | ^8.6.0 | Carousel/slider component |

### Authentication

| Package | Version | Purpose |
|---|---|---|
| `next-auth` | ^4.24.11 | Authentication with JWT sessions, RBAC roles |

### Styling

| Package | Version | Purpose |
|---|---|---|
| `tailwindcss` | ^4 | Utility-first CSS framework (dev) |
| `tailwindcss-animate` | ^1.0.7 | Tailwind animation utilities |
| `tw-animate-css` | ^1.3.5 | CSS animation library (dev) |
| `@tailwindcss/postcss` | ^4 | PostCSS integration for Tailwind v4 (dev) |
| `next-themes` | ^0.4.6 | Dark/light mode theme switching |

### Data Visualization

| Package | Version | Purpose |
|---|---|---|
| `recharts` | ^2.15.4 | Chart library (line, bar, pie, area, radar) |

### PDF / Export

| Package | Version | Purpose |
|---|---|---|
| `jspdf` | ^4.2.1 | PDF document generation |
| `html2canvas` | ^1.4.1 | HTML-to-canvas screenshot for PDF export |

### AI / SDK

| Package | Version | Purpose |
|---|---|---|
| `z-ai-web-dev-sdk` | ^0.0.18 | AI SDK for VLM, TTS, ASR, LLM, web search |

### Utilities

| Package | Version | Purpose |
|---|---|---|
| `date-fns` | ^4.1.0 | Date formatting, manipulation, and calculation |
| `uuid` | ^11.1.0 | UUID v4 generation |
| `sharp` | ^0.34.3 | Server-side image processing and optimization |
| `react-markdown` | ^10.1.0 | Markdown rendering in React |
| `react-syntax-highlighter` | ^15.6.1 | Code syntax highlighting |
| `react-resizable-panels` | ^3.0.3 | Resizable panel layouts |
| `@mdxeditor/editor` | ^3.39.1 | Rich MDX editor for policy authoring |
| `@dnd-kit/core` | ^6.3.1 | Drag-and-drop core engine |
| `@dnd-kit/sortable` | ^10.0.0 | Sortable drag-and-drop presort |
| `@dnd-kit/utilities` | ^3.2.2 | DnD Kit utility functions |
| `input-otp` | ^1.4.2 | OTP code input component |
| `react-day-picker` | ^9.8.0 | Date picker component |
| `@reactuses/core` | ^6.0.5 | Reactive hooks collection |
| `next-intl` | ^4.3.4 | Internationalization (i18n) framework |

---

## 3. Dev Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@tailwindcss/postcss` | ^4 | PostCSS plugin for Tailwind CSS v4 |
| `@types/react` | ^19 | TypeScript type definitions for React |
| `@types/react-dom` | ^19 | TypeScript type definitions for React DOM |
| `bun-types` | ^1.3.4 | TypeScript type definitions for Bun runtime |
| `eslint` | ^9 | JavaScript/TypeScript linter |
| `eslint-config-next` | ^16.1.1 | Next.js-specific ESLint rules |
| `tailwindcss` | ^4 | Utility-first CSS framework (build-time) |
| `tw-animate-css` | ^1.3.5 | Animation CSS utilities for Tailwind |
| `typescript` | ^5 | TypeScript compiler |

---

## 4. Prisma Schema State

### Provider & Connection

| Property | Value |
|---|---|
| **Provider** | SQLite |
| **Default URL** | `file:/home/z/my-project/db/custom.db` |
| **Client Generator** | `prisma-client-js` |
| **Seed Command** | `bunx tsx prisma/seed.ts` |
| **Total Models** | 39 |

### Phase 1 — Core Platform Models (17 models)

| Model | Purpose |
|---|---|
| `User` | User accounts with RBAC roles, jurisdiction, active status |
| `RegulatoryCircular` | Ingested regulatory circulars with status tracking |
| `GapAnalysis` | AI-powered gap analysis against circulars |
| `AMLAlert` | AML/sanctions alerts with risk scoring, goAML draft, SIU flagging |
| `SanctionsException` | Sanctions exceptions with sunset dates and CBUAE notification |
| `InspectionEvidence` | Evidence uploads with AI verification and SHA-256 hashing |
| `Claim` | Insurance claims with fraud scoring, SIU flagging, adjuster assignment |
| `AuditLog` | Immutable audit trail with SHA-256 hashing and IP tracking |
| `KRIMetric` | Key Risk Indicators with targets, trends, jurisdiction |
| `Regulation` | Regulatory requirements with compliance status tracking |
| `Policy` | Policy management with AI review, approval workflow |
| `LaborLawCompliance` | MOHRE labor law compliance with quota tracking |
| `LegalCase` | Legal case management with hearing dates, AI summaries |
| `TrainingCourse` | Training catalog with mandatory flags, certification |
| `TrainingEnrollment` | Enrollment tracking with pre/post assessment effectiveness fields |
| `TrainingAssessment` | Individual pre/post assessment records with scoring |
| `ComplianceAudit` | Audit management with findings and remediation tracking |

### Phase 3 — Advanced Compliance Workflows (5 models)

| Model | Purpose |
|---|---|
| `AdverseMediaSession` | Adverse media screening sessions with decision logging |
| `CorporateKYC` | Corporate KYC with UBO identification, PEP screening, risk scoring |
| `IndividualKYC` | Individual KYC with PEP flagging, EDD requirements |
| `GoAMLFiling` | goAML report filing (STR/SAR/CTR/IFT/PNMR) with XML payload |
| `MakerCheckerLog` | Maker-checker approval workflow with expiry and payload snapshots |

### Phase 4 — AI Agent & Quarterly Reporting (4 models)

| Model | Purpose |
|---|---|
| `AIChatSession` | AI chat sessions scoped by compliance module |
| `AIChatMessage` | Chat messages with model tracking and latency metrics |
| `QuarterlyReport` | CBUAE quarterly report assembly and submission tracking |
| `InsuranceRecord` | Insurance policy records with PII masking for CBUAE view |

### Phase 5 — Regulatory Critical Enhancement (13 models)

| Model | Purpose |
|---|---|
| `ComplianceAlert` | Immutable compliance alerts with SHA-256 integrity (FDL 10/2025) |
| `SanctionsScreening` | Sanctions screening events with fuzzy match tracking |
| `SARCase` | SAR case tracking with 30-day FDL 10/2025 deadline enforcement |
| `CalendarEvent` | Compliance calendar with cross-module integration |
| `PolicyAttestation` | Policy attestation tracking per CR 134/2025 |
| `RemediationAction` | Individual remediation actions from audit findings |
| `Notification` | Compliance deadline and alert notification system |
| `VendorDueDiligence` | Vendor/third-party due diligence per CR 134/2025 |
| `ComplianceCase` | Unified compliance case linking alerts, KYC, SARs, sanctions |
| `RiskAssessment` | Versioned risk assessment with inherent and residual risk |
| `RegulatoryDeadline` | CBUAE regulatory deadline tracking with auto-status |
| `VASPKYC` | VASP-specific KYC and risk assessment per FDL 10/2025 |
| `IdempotencyRecord` | Idempotency tracking for compliance-critical API operations |

---

## 5. API Routes Inventory

| Route | Methods | Primary Model(s) |
|---|---|---|
| `/api/health` | GET | — (system health) |
| `/api/dashboard` | GET | AMLAlert, KRIMetric, ComplianceAlert |
| `/api/auth/[...nextauth]` | GET, POST | User |
| `/api/users` | GET | User |
| `/api/users/me` | GET | User |
| `/api/aml` | GET, POST, PATCH | AMLAlert |
| `/api/alerts/status` | GET | AMLAlert |
| `/api/sanctions` | POST | SanctionsScreening |
| `/api/sanctions-exceptions` | GET | SanctionsException |
| `/api/sar-deadlines` | GET | SARCase |
| `/api/compliance` | GET | AMLAlert, ComplianceAlert |
| `/api/compliance-alerts` | GET, POST, PATCH | ComplianceAlert |
| `/api/compliance-cases` | GET, POST | ComplianceCase |
| `/api/compliance-calendar` | GET, POST, PATCH, DELETE | CalendarEvent |
| `/api/claims` | GET, POST, PATCH | Claim |
| `/api/audits` | GET, POST | ComplianceAudit |
| `/api/audit-log` | GET | AuditLog |
| `/api/evidence` | GET, POST | InspectionEvidence |
| `/api/kyc` | GET | CorporateKYC, IndividualKYC |
| `/api/kyc/corporate` | GET, POST, PATCH | CorporateKYC |
| `/api/kyc/individual` | GET, POST, PATCH | IndividualKYC |
| `/api/kyc-upload` | POST, GET, DELETE | InspectionEvidence |
| `/api/ubo-tree` | GET | CorporateKYC |
| `/api/goaml` | GET, POST | GoAMLFiling |
| `/api/goaml/approve` | POST | GoAMLFiling, MakerCheckerLog |
| `/api/goaml/submit` | POST | GoAMLFiling |
| `/api/goaml-xml` | POST | GoAMLFiling |
| `/api/maker-checker` | GET, POST, PATCH | MakerCheckerLog |
| `/api/adverse-media` | GET, POST | AdverseMediaSession |
| `/api/adverse-media/screen` | POST | AdverseMediaSession |
| `/api/adverse-media/decide` | POST | AdverseMediaSession |
| `/api/policies` | GET, POST, PATCH | Policy |
| `/api/policy-wizard` | POST | Policy |
| `/api/attestations` | GET, POST, PATCH | PolicyAttestation |
| `/api/regulations` | GET | Regulation |
| `/api/regulatory` | GET | Regulation |
| `/api/regulatory-intel/analyze` | POST | Regulation |
| `/api/regulatory-intel/approve` | POST | Regulation |
| `/api/regulatory-deadlines` | GET | RegulatoryDeadline |
| `/api/labor` | GET | LaborLawCompliance |
| `/api/training` | GET, POST | TrainingCourse, TrainingEnrollment |
| `/api/training-effectiveness` | GET, POST, PUT | TrainingEnrollment, TrainingAssessment |
| `/api/quarterly-reporting` | GET, POST | QuarterlyReport, InsuranceRecord |
| `/api/cbuae-submission-checker` | GET | QuarterlyReport, GoAMLFiling, InsuranceRecord |
| `/api/risk-assessment` | GET, POST | RiskAssessment |
| `/api/notifications` | GET, PATCH | Notification |
| `/api/remediations` | GET, POST, PATCH | RemediationAction |
| `/api/vasp-kyc` | GET, POST, PATCH | VASPKYC |
| `/api/cases` | GET, POST | LegalCase |
| `/api/analytics/aggregate` | GET | AMLAlert, CorporateKYC, IndividualKYC, GoAMLFiling, RiskAssessment, AIChatMessage |
| `/api/ai` | POST | AIChatSession |
| `/api/ai/enhanced` | POST | AIChatSession |
| `/api/ai/chat` | POST | AIChatSession, AIChatMessage |
| `/api/ai/policy-rag` | POST | Policy |
| `/api/admin/ai-config` | GET, PATCH | — (configuration) |
| `/api/idempotency` | GET, POST | IdempotencyRecord |

**Total API Routes:** 56

---

## 6. Module-Dependency Mapping

| Module | Component Path | Key External Dependencies | API Routes Used | Prisma Models Used |
|---|---|---|---|---|
| **Command Center** | `ic-os/dashboard/CommandCenter.tsx` | recharts, @tanstack/react-query, lucide-react, framer-motion | `/api/dashboard`, `/api/aml` | AMLAlert, KRIMetric, ComplianceAlert |
| **AML & Sanctions Triage** | `ic-os/aml/AMLSanctionsTriage.tsx` | @dnd-kit/core, @dnd-kit/sortable, recharts, @tanstack/react-query | `/api/aml`, `/api/sanctions-exceptions`, `/api/compliance` | AMLAlert, SanctionsException |
| **Adverse Media Screening** | `ic-os/adverse-media/AdverseMediaSearch.tsx` | @tanstack/react-query, zod, lucide-react | `/api/adverse-media`, `/api/adverse-media/screen`, `/api/adverse-media/decide` | AdverseMediaSession |
| **Corporate KYC Wizard** | `ic-os/kyc/CorporateKYCWizard.tsx` | react-hook-form, zod, @hookform/resolvers, lucide-react | `/api/kyc/corporate`, `/api/kyc-upload` | CorporateKYC, InspectionEvidence |
| **Individual KYC Wizard** | `ic-os/kyc/IndividualKYCWizard.tsx` | react-hook-form, zod, @hookform/resolvers, lucide-react | `/api/kyc/individual`, `/api/kyc-upload` | IndividualKYC, InspectionEvidence |
| **UBO Visualization** | `ic-os/kyc/UBOVisualization.tsx` | @tanstack/react-query, lucide-react, framer-motion | `/api/ubo-tree` | CorporateKYC |
| **goAML Filing Center** | `ic-os/goaml/GoAMLFilingCenter.tsx` | @tanstack/react-query, zod, react-hook-form, lucide-react | `/api/goaml`, `/api/goaml/approve`, `/api/goaml/submit`, `/api/goaml-xml` | GoAMLFiling, MakerCheckerLog |
| **Maker-Checker Queue** | `ic-os/maker-checker/MakerCheckerQueue.tsx` | @tanstack/react-query, lucide-react, sonner | `/api/maker-checker` | MakerCheckerLog |
| **Policies & SOPs** | `ic-os/policies/PoliciesSOPs.tsx` | @mdxeditor/editor, @tanstack/react-query, lucide-react | `/api/policies`, `/api/policy-wizard`, `/api/attestations` | Policy, PolicyAttestation |
| **CBUAE Regulatory Tracker** | `ic-os/regulatory/CBUAERegulatoryTracker.tsx` | @tanstack/react-query, recharts, lucide-react, date-fns | `/api/regulations`, `/api/regulatory`, `/api/regulatory-deadlines` | Regulation, RegulatoryDeadline |
| **Regulatory Intelligence** | `ic-os/regulatory/RegulatoryIntelligence.tsx` | @tanstack/react-query, zod, lucide-react | `/api/regulatory-intel/analyze`, `/api/regulatory-intel/approve` | Regulation |
| **Quarterly Reporting** | `ic-os/reporting/QuarterlyReporting.tsx` | @tanstack/react-query, recharts, lucide-react, date-fns | `/api/quarterly-reporting`, `/api/cbuae-submission-checker` | QuarterlyReport, InsuranceRecord |
| **CBUAE Submission Checker** | `ic-os/compliance/CBUAESubmissionChecker.tsx` | @tanstack/react-query, zod, lucide-react, sonner | `/api/cbuae-submission-checker` | QuarterlyReport, GoAMLFiling |
| **Claims Portal** | `ic-os/claims/ClaimsPortals.tsx` | @tanstack/react-query, @tanstack/react-table, recharts, lucide-react | `/api/claims` | Claim |
| **Compliance Audits** | `ic-os/audits/ComplianceAudits.tsx` | @tanstack/react-query, lucide-react, sonner | `/api/audits`, `/api/remediations` | ComplianceAudit, RemediationAction |
| **Evidence War Room** | `ic-os/evidence/EvidenceWarRoom.tsx` | @tanstack/react-query, lucide-react, framer-motion | `/api/evidence`, `/api/kyc-upload` | InspectionEvidence |
| **Training Effectiveness** | `ic-os/training/TrainingEffectiveness.tsx` | @tanstack/react-query, recharts, lucide-react | `/api/training-effectiveness`, `/api/training` | TrainingEnrollment, TrainingAssessment |
| **Training Certifications** | `ic-os/training/TrainingCertifications.tsx` | @tanstack/react-query, lucide-react, date-fns | `/api/training` | TrainingCourse, TrainingEnrollment |
| **Labor Law Compliance** | `ic-os/labor/LaborLawCompliance.tsx` | @tanstack/react-query, lucide-react, date-fns | `/api/labor` | LaborLawCompliance |
| **Legal Advisory** | `ic-os/legal/LegalAdvisory.tsx` | @tanstack/react-query, lucide-react | `/api/cases` | LegalCase |
| **Compliance Calendar** | `ic-os/calendar/ComplianceCalendar.tsx` | react-day-picker, @tanstack/react-query, date-fns, lucide-react | `/api/compliance-calendar` | CalendarEvent |
| **SAR Narrative Builder** | `ic-os/sar/SARNarrativeBuilder.tsx` | react-hook-form, zod, @tanstack/react-query, lucide-react | `/api/sar-deadlines`, `/api/aml` | SARCase, AMLAlert |
| **AML Self-Assessment** | `ic-os/aml-assessment/AMLSelfAssessment.tsx` | recharts, jspdf, html2canvas, lucide-react | `/api/aml` | AMLAlert |
| **Advanced Analytics** | `ic-os/analytics/AdvancedAnalytics.tsx` | recharts, @tanstack/react-query, lucide-react | `/api/analytics/aggregate` | AMLAlert, CorporateKYC, RiskAssessment |
| **AI Engine Control** | `ic-os/ai-engine/AIEngineControl.tsx` | @tanstack/react-query, lucide-react, sonner | `/api/ai`, `/api/ai/enhanced` | AIChatSession |
| **AI Agent Management** | `ic-os/ai-agent/AIAgentManagement.tsx` | @tanstack/react-query, lucide-react | `/api/ai/chat` | AIChatSession, AIChatMessage |
| **Audit Pack Generator** | `ic-os/audit-pack/AuditPackGenerator.tsx` | jspdf, html2canvas, @tanstack/react-query, lucide-react | `/api/audits`, `/api/audit-log` | ComplianceAudit, AuditLog |
| **Security Dashboard** | `ic-os/security/SecurityDashboard.tsx` | @tanstack/react-query, lucide-react | `/api/health` | — (system metrics) |
| **Admin Panel** | `ic-os/admin/AdminPanel.tsx` | @tanstack/react-query, lucide-react | `/api/admin/ai-config`, `/api/users` | User |
| **Help Documentation** | `ic-os/help/HelpDocumentation.tsx` | lucide-react, cmdk | — | — |

### Shared Components

| Component | Path | Key External Dependencies |
|---|---|---|
| **Alert Detail Drawer** | `ic-os/shared/AlertDetailDrawer.tsx` | @tanstack/react-query, lucide-react, sonner, vaul |
| **Audit Trail** | `ic-os/shared/AuditTrail.tsx` | @tanstack/react-query, lucide-react | 
| **Risk Matrix** | `ic-os/shared/RiskMatrix.tsx` | recharts, lucide-react |
| **Command Menu** | `ic-os/shared/CommandMenu.tsx` | cmdk, lucide-react |
| **Theme Settings** | `ic-os/theme/ThemeSettings.tsx` | zustand, lucide-react |
| **User Settings** | `ic-os/settings/UserSettings.tsx` | zustand, lucide-react |
| **Login Form** | `auth/LoginForm.tsx` | react-hook-form, zod, next-auth, lucide-react |
| **Auth Provider** | `auth/AuthProvider.tsx` | next-auth |
| **AI Assistant Widget** | `AIAssistantWidget.tsx` | @tanstack/react-query, lucide-react, framer-motion |
| **Sidebar** | `ic-os/layout/Sidebar.tsx` | zustand, lucide-react, next-themes |
| **TopBar** | `ic-os/layout/TopBar.tsx` | zustand, lucide-react, next-themes |

---

## 7. Compliance Library Modules

| Library | Path | Purpose |
|---|---|---|
| `regulatory-refs` | `lib/compliance/regulatory-refs.ts` | FDL 10/2025 + CR 134/2025 legal mapping (1,030 lines) |
| `audit-middleware` | `lib/compliance/audit-middleware.ts` | Prisma audit middleware + maker≠checker enforcement |
| `tipping-off` | `lib/compliance/tipping-off.ts` | Tipping-off prohibition per FDL 10/2025 Art. 12 |
| `pii-hooks` | `lib/compliance/pii-hooks.ts` | PII masking hooks for CBUAE view |
| `rbac` | `lib/compliance/rbac.ts` | 6 roles × 26 permissions matrix |
| `cross-module` | `lib/compliance/cross-module.ts` | Cross-module navigation + entity linking |
| `goaml-xml` | `lib/compliance/goaml-xml.ts` | goAML v4.2 XML generation + XSD validation |
| `screening-engine` | `lib/compliance/screening-engine.ts` | Levenshtein + Jaro-Winkler + OFAC 50% Rule |
| `arabic-normalization` | `lib/compliance/arabic-normalization.ts` | Arabic phonetic normalization for screening |
| `ubo-tracing` | `lib/compliance/ubo-tracing.ts` | Recursive UBO chain tracing |
| `rag-policy-wizard` | `lib/compliance/rag-policy-wizard.ts` | RAG AI Policy Wizard + hallucination guard |
| `cpf-questions` | `lib/compliance/cpf-questions.ts` | CPF/WTR/e-KYC/Outsourcing assessment questions |
| `training-courses-enhanced` | `lib/compliance/training-courses-enhanced.ts` | Enhanced course catalog + compliance score |

---

## 8. Zod Validation Schemas

| Schema | Path | Validated Endpoint(s) |
|---|---|---|
| `laborSchema` | `lib/validations/labor.ts` | `/api/labor` |
| `adverseMediaSchema` | `lib/validations/adverse-media.ts` | `/api/adverse-media/*` |
| `amlSchema` | `lib/validations/aml.ts` | `/api/aml` |
| `alertSchema` | `lib/validations/alert.ts` | `/api/compliance-alerts` |
| `regulationSchema` | `lib/validations/regulation.ts` | `/api/regulations` |
| `caseSchema` | `lib/validations/case.ts` | `/api/cases`, `/api/compliance-cases` |
| `goamlSchema` | `lib/validations/goaml.ts` | `/api/goaml/*` |
| `quarterlyReportSchema` | `lib/validations/quarterly-reporting.ts` | `/api/quarterly-reporting` |
| `trainingSchema` | `lib/validations/training.ts` | `/api/training`, `/api/training-effectiveness` |
| `evidenceSchema` | `lib/validations/evidence.ts` | `/api/evidence`, `/api/kyc-upload` |
| `regulatorySchema` | `lib/validations/regulatory.ts` | `/api/regulatory` |
| `policySchema` | `lib/validations/policy.ts` | `/api/policies`, `/api/policy-wizard` |
| `makerCheckerSchema` | `lib/validations/maker-checker.ts` | `/api/maker-checker` |
| `kycSchema` | `lib/validations/kyc.ts` | `/api/kyc/*` |
| `aiSchema` | `lib/validations/ai.ts` | `/api/ai/*` |
| `auditSchema` | `lib/validations/audit.ts` | `/api/audits` |
| `claimSchema` | `lib/validations/claim.ts` | `/api/claims` |

---

*End of Version & Dependency Matrix — IC-OS v7.2 @ commit `127b761`*
