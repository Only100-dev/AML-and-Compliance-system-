# UAT Execution Report — IC-OS v7.2

**Document Version:** 1.0  
**Platform:** IC-OS (Insurance Compliance Operating System) v7.2  
**Date Prepared:** 2025-03-05  
**Status:** Ready for UAT Execution  
**Classification:** Internal — Compliance Testing  

---

## Table of Contents

1. [UAT Framework Overview](#1-uat-framework-overview)
2. [Smoke Test Checklist](#2-smoke-test-checklist)
3. [Results & Sign-off Table](#3-results--sign-off-table)
4. [Role-Based UAT Instructions](#4-role-based-uat-instructions)
5. [Seeded Test Accounts](#5-seeded-test-accounts)
6. [Appendix: UAT Execution Guidelines](#6-appendix-uat-execution-guidelines)

---

## 1. UAT Framework Overview

### 1.1 Purpose

User Acceptance Testing (UAT) for IC-OS v7.2 validates that all 31+ platform modules function correctly from an end-user perspective, meeting regulatory compliance requirements under:

- **FDL No. 20 of 2018 / FDL 10/2025** — Federal Decree-Law on Anti-Money Laundering and Combating the Financing of Terrorism
- **Cabinet Resolution No. 134/2025 (CR 134/2025)** — Executive Regulations for AML/CFT
- **CBUAE Notice 3551/2021** — Guidance for Licensed Financial Institutions
- **FATF Recommendations** — International Standards on Combating Money Laundering

UAT ensures the platform is production-ready for deployment to UAE-regulated insurance entities operating under CBUAE, DFSA, and FSRA jurisdictions.

### 1.2 UAT Scope

| Dimension | Coverage |
|-----------|----------|
| **Total Modules** | 33 modules across 8 categories |
| **Core Modules** | Command Center, Regulatory Intelligence |
| **AML & Sanctions** | Triage, Adverse Media, SAR Narrative |
| **KYC & Onboarding** | Corporate KYC, Individual KYC, UBO Visualization |
| **Filing & Reporting** | goAML Filing Center, Quarterly Reporting |
| **Governance** | Maker-Checker, Policies, Audits, Risk Matrix |
| **Regulatory** | CBUAE Tracker, Labor Law, Legal Advisory |
| **Training** | Certifications, Effectiveness Measurement |
| **Operations** | Claims Portals, Evidence War Room |
| **Advanced** | AI Agent, AI Engine, Analytics, Security, CBUAE Submission Checker, AML Self-Assessment, Calendar, Audit Pack, Settings, Help, Command Menu |

### 1.3 UAT Roles

| Role | UAT Responsibility | Focus Areas |
|------|--------------------|-------------|
| **Compliance Officer** | Verify daily compliance workflows | Alert triage, regulatory tracking, policy review, claims |
| **MLRO** (Money Laundering Reporting Officer) | Validate AML/CFT critical paths | SAR filing, Maker-Checker enforcement, goAML XML, audit trail integrity |
| **Admin** | Verify system administration | User management, AI configuration, security settings, notifications |
| **Dept Head** | Verify departmental operations | Claims management, team oversight, policy attestation |
| **Board Member** | Verify governance dashboards | KRI visibility, risk posture, compliance status overview |

### 1.4 UAT Environment

| Parameter | Value |
|-----------|-------|
| **Environment** | Staging / Local Development Server |
| **URL** | `http://localhost:3000` (default Next.js dev server) |
| **Database** | SQLite (seeded with production-representative data) |
| **AI Engine** | Ollama (qwen2.5:14b) — local inference |
| **Region** | UAE (me-central-1) |
| **Data Residency** | UAE Data Residency Enforced |
| **Seed Command** | `bun run db:seed` |
| **Dev Server** | `bun run dev` |

---

## 2. Smoke Test Checklist

> **Instructions:** For each test case, mark the checkbox [ ] as [x] when passed. Record any failures in the Notes column of the Results & Sign-off Table (Section 3).

---

### Category A: Core Modules

#### A1. Command Center

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| A1.1 | Dashboard loads on application start | Command Center renders with KPI cards, charts, and compliance summary | [ ] Pass [ ] Fail |
| A1.2 | KRI cards display with values | All KRI metrics (Sanctions FP Rate, Active Exceptions, Overdue KYC, SAR Turnaround, AML Disposition Rate, Training Completion) display with numeric values, targets, and trend arrows | [ ] Pass [ ] Fail |
| A1.3 | Jurisdiction toggle works | Clicking CBUAE / DFSA / FSRA toggle filters KRI data and dashboard content by jurisdiction | [ ] Pass [ ] Fail |
| A1.4 | Recent audit logs visible | Audit log feed displays recent compliance actions with timestamps, users, and SHA-256 hashes | [ ] Pass [ ] Fail |
| A1.5 | Quick action buttons functional | "File SAR Report", "Run Sanctions Screen", "Start Inspection", "Generate Audit Pack" buttons trigger toast notifications confirming action initiated | [ ] Pass [ ] Fail |

#### A2. Regulatory Intelligence

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| A2.1 | Circulars load and display | Regulatory circulars list loads with title, regulator badge, circular number, status, and effective date | [ ] Pass [ ] Fail |
| A2.2 | Gap analysis runs | Clicking gap analysis on a circular generates gap entries with missing clauses, AI confidence scores, and status badges | [ ] Pass [ ] Fail |
| A2.3 | AI analysis triggers | AI analysis button on a circular changes status to "analyzing" and produces AI-generated gap findings with confidence percentages | [ ] Pass [ ] Fail |

---

### Category B: AML & Sanctions

#### B1. AML & Sanctions Triage

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| B1.1 | Kanban board loads | Alert triage board renders with columns: New, Triage, Investigating, SAR Filed, Escalated, Closed | [ ] Pass [ ] Fail |
| B1.2 | Alerts display with details | AML alerts show case ID, risk score, risk level badge, alert type, description, AI flags | [ ] Pass [ ] Fail |
| B1.3 | Drag-and-drop works | Dragging an alert card between Kanban columns updates the alert status | [ ] Pass [ ] Fail |
| B1.4 | Status change persists | After drag-and-drop, the new status is reflected and survives page refresh | [ ] Pass [ ] Fail |
| B1.5 | Maker-Checker enforcement fires | Attempting to approve own record triggers Maker-Checker violation: "User attempted to approve own record" error with audit log entry | [ ] Pass [ ] Fail |

#### B2. Adverse Media Search

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| B2.1 | Search form works | Adverse media search form accepts entity name, keyword, and date range inputs | [ ] Pass [ ] Fail |
| B2.2 | Results display | Search returns results with source, sentiment, relevance score, and date | [ ] Pass [ ] Fail |
| B2.3 | Decision can be saved | User can save a decision (escalate / dismiss / monitor) on an adverse media result with notes | [ ] Pass [ ] Fail |

#### B3. SAR Narrative Builder

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| B3.1 | SAR cases load | SAR case list displays with case number, status, deadline, risk level, and subject type | [ ] Pass [ ] Fail |
| B3.2 | Deadline tracking works | SAR cases show days remaining until filing deadline per FDL 10/2025 Art. 8 (30 calendar days) | [ ] Pass [ ] Fail |
| B3.3 | Narrative editor functional | 5-part SAR narrative editor (Reason, Subject, Transaction, Accounts, Indicators) loads with pre-populated AI-generated content | [ ] Pass [ ] Fail |
| B3.4 | Tipping-off warning displayed | Tipping-off prohibition banner per FDL 10/2025 Art. 12 displays on all SAR case views | [ ] Pass [ ] Fail |

---

### Category C: KYC & Onboarding

#### C1. Corporate KYC

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| C1.1 | Application form works | Corporate KYC form accepts legal name, trade license, TRN, legal form, UBO details, PEP declaration | [ ] Pass [ ] Fail |
| C1.2 | UBO visualization loads | UBO tree renders with ownership percentages, sanctioned entity highlighting, and OFAC 50% rule calculation | [ ] Pass [ ] Fail |
| C1.3 | Maker-Checker flow enforced | HIGH-risk corporate KYC submissions require MLRO approval via Maker-Checker queue before status change to APPROVED | [ ] Pass [ ] Fail |
| C1.4 | Risk rating assignment | Risk rating (HIGH / MEDIUM / LOW) is auto-calculated based on PEP status, jurisdiction, ownership complexity | [ ] Pass [ ] Fail |

#### C2. Individual KYC

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| C2.1 | Profile form works | Individual KYC form accepts full name, Emirates ID, passport number, nationality, occupation | [ ] Pass [ ] Fail |
| C2.2 | PEP flagging | PEP status can be toggled; when enabled, EDD requirement is automatically flagged | [ ] Pass [ ] Fail |
| C2.3 | Risk rating assignment | Risk rating (STANDARD / HIGH) is assigned based on PEP status, jurisdiction, and sanctions screening results | [ ] Pass [ ] Fail |

#### C3. UBO Visualization

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| C3.1 | Tree renders | UBO ownership tree renders with expandable/collapsible nodes showing ownership chain | [ ] Pass [ ] Fail |
| C3.2 | OFAC 50% rule calculation works | Total sanctioned ownership percentage is calculated; entities with >= 50% sanctioned ownership are flagged as BLOCKED | [ ] Pass [ ] Fail |
| C3.3 | Sanctioned node highlighting | Nodes linked to sanctioned entities display red border/glow with shield icon | [ ] Pass [ ] Fail |
| C3.4 | Node detail panel | Clicking a node opens detail panel with name, ownership %, jurisdiction, and sanctioned status | [ ] Pass [ ] Fail |

---

### Category D: Filing & Reporting

#### D1. goAML Filing Center

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| D1.1 | Filings list loads | goAML filings list displays with reference number, report type, subject, amount, and filing status | [ ] Pass [ ] Fail |
| D1.2 | XML generation works | Clicking "Generate XML" produces goAML XML Schema v4.2 compliant output with 5-part narrative structure | [ ] Pass [ ] Fail |
| D1.3 | Approval flow | Draft filings require Maker-Checker approval before status changes to SUBMITTED_TO_FIU | [ ] Pass [ ] Fail |

#### D2. Quarterly Reporting

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| D2.1 | Reports list loads | Quarterly reports list displays with period, status, jurisdiction, and compliance score | [ ] Pass [ ] Fail |
| D2.2 | PII masking toggle | PII masking toggle redacts personal identifiable information (names, Emirates IDs, account numbers) in report view | [ ] Pass [ ] Fail |
| D2.3 | CBUAE view | CBUAE-specific view shows masked data with regulatory compliance attestation | [ ] Pass [ ] Fail |

---

### Category E: Governance

#### E1. Maker-Checker Queue

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| E1.1 | Pending items load | Maker-Checker queue displays pending items with operation type, entity, maker name, and expiry time | [ ] Pass [ ] Fail |
| E1.2 | Approve/reject works | Checker can approve or reject pending items; status updates to APPROVED or REJECTED | [ ] Pass [ ] Fail |
| E1.3 | Audit trail created | Each Maker-Checker action (approve/reject) creates an immutable audit log entry with SHA-256 hash | [ ] Pass [ ] Fail |
| E1.4 | Self-approval blocked | User cannot approve their own Maker-Checker item; system enforces maker != checker constraint | [ ] Pass [ ] Fail |

#### E2. Policies & SOPs

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| E2.1 | Policy list loads | Policies list displays with title, policy number, category, version, status, and owner | [ ] Pass [ ] Fail |
| E2.2 | Create/edit flow | Policy creation form accepts all fields; edit mode allows version increment and content modification | [ ] Pass [ ] Fail |
| E2.3 | AI review | AI review button generates confidence score and flagged sections for policy content | [ ] Pass [ ] Fail |
| E2.4 | Policy attestation | Pending policy attestations display with deadline and acknowledgment button | [ ] Pass [ ] Fail |

#### E3. Compliance Audits

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| E3.1 | Audit list loads | Compliance audits list displays with audit number, title, type, status, risk level, and scheduled date | [ ] Pass [ ] Fail |
| E3.2 | Schedule audit | New audit scheduling form accepts title, type (internal/external/regulatory), scope, lead auditor, and date | [ ] Pass [ ] Fail |
| E3.3 | Remediation tracking | Audit findings link to remediation actions with status tracking (not_started / in_progress / completed / overdue) | [ ] Pass [ ] Fail |

#### E4. Risk Matrix

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| E4.1 | Risk grid renders | Risk matrix grid renders with inherent risk (Y-axis) vs. residual risk (X-axis) and color-coded cells | [ ] Pass [ ] Fail |
| E4.2 | Domain filtering | Filter dropdown allows filtering by risk domain (Customer, Jurisdiction, Interface, Product, Transaction) | [ ] Pass [ ] Fail |
| E4.3 | Risk assessment details | Clicking a risk cell shows detailed assessment with controls, control effectiveness, and risk appetite thresholds | [ ] Pass [ ] Fail |

---

### Category F: Regulatory

#### F1. CBUAE Regulatory Tracker

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| F1.1 | Regulations load | Regulations list displays with title, issuer, category, effective date, next review date, and assigned department | [ ] Pass [ ] Fail |
| F1.2 | Filter by issuer/category/status | Filter controls work for issuer (CBUAE/DFSA), category (AML/CFT/Operations/Governance/IT/Finance/Data Privacy/Products/Health), and compliance status | [ ] Pass [ ] Fail |
| F1.3 | Compliance status badges | Status badges display: COMPLIANT (green), PARTIAL (amber), PENDING (yellow), NON_COMPLIANT (red) | [ ] Pass [ ] Fail |

#### F2. Labor Law Compliance

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| F2.1 | Requirements load | Labor law compliance list displays with requirement, category, authority, compliance status, and due date | [ ] Pass [ ] Fail |
| F2.2 | Filter functionality | Filter by category (Emiratisation/WPS/Working Conditions/Insurance/Benefits/Immigration) and compliance status | [ ] Pass [ ] Fail |
| F2.3 | Status tracking | Each requirement shows current count vs. required count with last verification date | [ ] Pass [ ] Fail |

#### F3. Legal Advisory

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| F3.1 | Cases list loads | Legal cases list displays with case number, title, case type, status, priority, and jurisdiction | [ ] Pass [ ] Fail |
| F3.2 | Case details view | Clicking a case opens details with description, assigned counsel, filing date, next hearing, and AI-generated summary | [ ] Pass [ ] Fail |

---

### Category G: Training

#### G1. Training & Certifications

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| G1.1 | Course list loads | Training courses display with title, category, provider, duration, mandatory flag, target audience, and certification availability | [ ] Pass [ ] Fail |
| G1.2 | Enrollment functionality | Users can enroll in available courses; enrollment status changes to "in_progress" | [ ] Pass [ ] Fail |
| G1.3 | Status tracking | Enrollment statuses tracked: completed / in_progress / overdue / expired with score and expiry date | [ ] Pass [ ] Fail |

#### G2. Training Effectiveness

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| G2.1 | Pre/post assessment scores | Effectiveness dashboard displays pre-assessment and post-assessment score comparison | [ ] Pass [ ] Fail |
| G2.2 | Knowledge gain charts | Knowledge gain distribution chart renders showing percentage improvement per course/department | [ ] Pass [ ] Fail |
| G2.3 | Effectiveness gauge | Overall effectiveness score gauge renders with needle indicator and compliance threshold markers | [ ] Pass [ ] Fail |
| G2.4 | Negative gain alert | Courses with negative knowledge gain trigger compliance alert banner | [ ] Pass [ ] Fail |

---

### Category H: Operations

#### H1. Claims Portals

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| H1.1 | Claims load | Claims list displays with claim number, policy number, claim type, claimant, amount, status, and priority | [ ] Pass [ ] Fail |
| H1.2 | Persona switching works | Switching between claimant / adjuster / SIU / supervisor persona filters claims and adjusts visible fields | [ ] Pass [ ] Fail |
| H1.3 | Fraud score display | Claims with fraud scores display visual indicator; SIU-flagged claims show alert badge | [ ] Pass [ ] Fail |
| H1.4 | Claim detail view | Clicking a claim opens detail view with full description, fraud score, adjuster assignment, and jurisdiction | [ ] Pass [ ] Fail |

#### H2. Evidence War Room

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| H2.1 | Evidence items load | Evidence list displays with inspection ID, file name, file type, uploaded by, and department | [ ] Pass [ ] Fail |
| H2.2 | AI verification display | AI verification status (verified/not verified) displays with confidence score and detail text | [ ] Pass [ ] Fail |
| H2.3 | File hash integrity | SHA-256 file hash displays for each evidence item confirming document integrity | [ ] Pass [ ] Fail |

---

### Category I: Advanced Modules

#### I1. AI Agent Management

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| I1.1 | Chat sessions display | AI chat sessions list with context module, user, and message count | [ ] Pass [ ] Fail |
| I1.2 | Chat interaction works | User can send messages and receive AI-generated responses in real-time | [ ] Pass [ ] Fail |
| I1.3 | Model configuration | AI model selection and parameters can be configured (temperature, max tokens, etc.) | [ ] Pass [ ] Fail |

#### I2. AI Engine Control

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| I2.1 | Engine parameters display | AI Engine configuration policies display (AML Transaction Monitoring, Sanctions Fuzzy Match, goAML Narrative) | [ ] Pass [ ] Fail |
| I2.2 | Quota settings | Token usage quotas and rate limits display per model configuration | [ ] Pass [ ] Fail |
| I2.3 | Engine status | AI Engine operational status and health indicators display | [ ] Pass [ ] Fail |

#### I3. Advanced Analytics

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| I3.1 | Dashboard renders | Advanced Analytics dashboard loads with KPI cards and tabbed view | [ ] Pass [ ] Fail |
| I3.2 | Charts display | Risk posture, KYC risk distribution, transaction trends, and domain risk charts render correctly | [ ] Pass [ ] Fail |
| I3.3 | AI insight panel | AI-generated insight banner displays with compliance recommendations | [ ] Pass [ ] Fail |

#### I4. Security Dashboard

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| I4.1 | Security metrics display | Security score/grade, checks passed, database health, and system uptime KPIs render | [ ] Pass [ ] Fail |
| I4.2 | Security checks list | 18 security checks across 5 categories (HTTP Headers, Auth, Data Residency, Infrastructure, Compliance) display with pass/fail status | [ ] Pass [ ] Fail |
| I4.3 | Deployment readiness | Deployment readiness checklist displays with 14 items and overall readiness assessment | [ ] Pass [ ] Fail |

#### I5. CBUAE Submission Checker

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| I5.1 | Submission validation works | Selecting report type (quarterly_report / sar_filing / ctr_filing) and running validation returns checklist results | [ ] Pass [ ] Fail |
| I5.2 | Readiness scoring | Readiness percentage and pass/fail counts display with progress bar | [ ] Pass [ ] Fail |
| I5.3 | Tipping-off warning | SAR/CTR filing types display tipping-off prohibition banner per FDL 10/2025 Art. 12 | [ ] Pass [ ] Fail |

#### I6. AML Self-Assessment

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| I6.1 | Assessment form loads | AML Self-Assessment wizard renders with 10 sections and 51 questions | [ ] Pass [ ] Fail |
| I6.2 | Scoring works | Completing sections calculates weighted scores with critical item double-weighting | [ ] Pass [ ] Fail |
| I6.3 | Results with benchmarks | Assessment results display with sector benchmarks, compliance percentage, and rating | [ ] Pass [ ] Fail |
| I6.4 | PDF export | "Export to PDF" button generates downloadable assessment report | [ ] Pass [ ] Fail |

#### I7. Compliance Calendar

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| I7.1 | Calendar events display | Calendar view displays upcoming regulatory deadlines, audits, training, and policy review events | [ ] Pass [ ] Fail |
| I7.2 | Create event | New calendar event form accepts title, description, event type, date, priority, jurisdiction, and assignment | [ ] Pass [ ] Fail |
| I7.3 | Event source linking | Calendar events link to source modules (audits, training, policies, SAR) for cross-module navigation | [ ] Pass [ ] Fail |

#### I8. Audit Pack Generator

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| I8.1 | Pack generation | Audit pack generation initiates with module selection and date range | [ ] Pass [ ] Fail |
| I8.2 | PII masking | PII masking toggle redacts personal data in generated audit pack | [ ] Pass [ ] Fail |

#### I9. User Settings / Theme Settings

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| I9.1 | Settings save correctly | User preferences (theme, notifications, language) save and persist across page refreshes | [ ] Pass [ ] Fail |
| I9.2 | Theme selection | Theme picker shows 4 themes (ConvertEase, Anarisk Navy, Anarisk Dual, Mega Lotus) with preview | [ ] Pass [ ] Fail |
| I9.3 | Theme persistence | Selected theme persists via localStorage and applies on next page load without FOUC | [ ] Pass [ ] Fail |

#### I10. Help & Documentation

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| I10.1 | Help content displays | Help & Documentation module loads with 9 sections and 48 subsections | [ ] Pass [ ] Fail |
| I10.2 | Search functionality | Search filter works across section titles, content, and tags | [ ] Pass [ ] Fail |
| I10.3 | Multiple view modes | At least 2 view modes render correctly (Standard, Compact, Card Grid, Book, Quick Ref, Print) | [ ] Pass [ ] Fail |

#### I11. Command Menu (Cmd+K)

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| I11.1 | Opens | Pressing Cmd+K (Mac) / Ctrl+K (Windows) opens the command palette | [ ] Pass [ ] Fail |
| I11.2 | Searches | Typing a search query filters available commands and modules | [ ] Pass [ ] Fail |
| I11.3 | Navigates | Selecting a search result navigates to the corresponding module | [ ] Pass [ ] Fail |

---

## 3. Results & Sign-off Table

> **Instructions:** UAT testers fill in Date and Status columns during testing. Record any bugs or observations in Notes/Bugs Found.

| # | Module | Tested By (Role) | Date | Status (Pass/Fail) | Notes/Bugs Found |
|---|--------|-----------------|------|--------------------|--------------------|
| A1 | Command Center | | | | |
| A2 | Regulatory Intelligence | | | | |
| B1 | AML & Sanctions Triage | | | | |
| B2 | Adverse Media Search | | | | |
| B3 | SAR Narrative Builder | | | | |
| C1 | Corporate KYC | | | | |
| C2 | Individual KYC | | | | |
| C3 | UBO Visualization | | | | |
| D1 | goAML Filing Center | | | | |
| D2 | Quarterly Reporting | | | | |
| E1 | Maker-Checker Queue | | | | |
| E2 | Policies & SOPs | | | | |
| E3 | Compliance Audits | | | | |
| E4 | Risk Matrix | | | | |
| F1 | CBUAE Regulatory Tracker | | | | |
| F2 | Labor Law Compliance | | | | |
| F3 | Legal Advisory | | | | |
| G1 | Training & Certifications | | | | |
| G2 | Training Effectiveness | | | | |
| H1 | Claims Portals | | | | |
| H2 | Evidence War Room | | | | |
| I1 | AI Agent Management | | | | |
| I2 | AI Engine Control | | | | |
| I3 | Advanced Analytics | | | | |
| I4 | Security Dashboard | | | | |
| I5 | CBUAE Submission Checker | | | | |
| I6 | AML Self-Assessment | | | | |
| I7 | Compliance Calendar | | | | |
| I8 | Audit Pack Generator | | | | |
| I9 | User Settings / Theme Settings | | | | |
| I10 | Help & Documentation | | | | |
| I11 | Command Menu (Cmd+K) | | | | |

### Overall UAT Sign-off

| Field | Value |
|-------|-------|
| **Total Modules Tested** | ___ / 33 |
| **Total Test Cases Executed** | ___ / 108 |
| **Pass Rate** | ___% |
| **Critical Bugs Found** | ___ |
| **Major Bugs Found** | ___ |
| **Minor Bugs Found** | ___ |
| **UAT Lead** | _________________________ |
| **Date Completed** | _________________________ |
| **Go/No-Go Recommendation** | [ ] GO — Production Ready &nbsp; [ ] NO-GO — Requires Remediation |
| **Sign-off (Compliance)** | _________________________ |
| **Sign-off (MLRO)** | _________________________ |
| **Sign-off (Admin)** | _________________________ |

---

## 4. Role-Based UAT Instructions

### 4.1 Compliance Officer Workflow

> **Login:** `omar@icos.ae` (role: `compliance_officer`, jurisdiction: CBUAE)

| Step | Action | Expected Outcome | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Log in with default compliance_officer role | Dashboard loads with CBUAE jurisdiction context | [ ] Pass [ ] Fail |
| 2 | Navigate to Regulatory Tracker → verify regulations load | 8 regulations display with CBUAE/DFSA issuer badges and compliance status badges (COMPLIANT/PARTIAL/PENDING/NON_COMPLIANT) | [ ] Pass [ ] Fail |
| 3 | Navigate to AML Triage → verify alerts display | 5 AML alerts display in Kanban board with risk scores (31–95), risk levels, and AI flags | [ ] Pass [ ] Fail |
| 4 | Navigate to Claims Portals → switch persona to claimant | Persona dropdown switches view; claimant persona shows only claims filed by the user | [ ] Pass [ ] Fail |
| 5 | Navigate to Policies & SOPs → review a policy | Policy detail view opens with version history, AI review score, and attestation status | [ ] Pass [ ] Fail |
| 6 | Export Audit Pack with PII masking | Audit pack generation completes with PII masking enabled; personal data redacted in output | [ ] Pass [ ] Fail |

### 4.2 MLRO Workflow

> **Login:** `mlro@icos.ae` or `ahmed@icos.ae` (role: `mlro`, jurisdiction: CBUAE)

| Step | Action | Expected Outcome | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Log in with default MLRO role | Dashboard loads with MLRO-specific notifications (SAR deadlines, escalations) | [ ] Pass [ ] Fail |
| 2 | Navigate to AML Triage → approve/escalate alerts | MLRO can approve or escalate AML alerts; action recorded in audit log with SHA-256 hash | [ ] Pass [ ] Fail |
| 3 | Navigate to Maker-Checker → verify Maker-Checker enforcement | Pending Maker-Checker items display; MLRO can approve items where MLRO is not the maker; self-approval blocked | [ ] Pass [ ] Fail |
| 4 | Navigate to goAML Filing → generate XML | goAML XML Schema v4.2 output generates with 5-part SAR narrative and transaction coding fields | [ ] Pass [ ] Fail |
| 5 | Navigate to SAR Narrative Builder → verify 30-day deadline | SAR cases display with days remaining counter; cases at 0 days show OVERDUE warning; FDL 10/2025 Art. 8 reference displayed | [ ] Pass [ ] Fail |
| 6 | Navigate to Audit Trail → verify SHA-256 hashes | Audit log entries display with SHA-256 hashes; hash integrity confirmed for all compliance actions | [ ] Pass [ ] Fail |

### 4.3 Admin Workflow

> **Login:** `admin@icos.ae` (role: `admin`, jurisdiction: CBUAE)

| Step | Action | Expected Outcome | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Log in with default admin role | Dashboard loads with full administrative access indicator | [ ] Pass [ ] Fail |
| 2 | Navigate to Admin Panel → verify user management | User list displays all 8 seeded users with role badges, jurisdiction, and active status | [ ] Pass [ ] Fail |
| 3 | Navigate to AI Engine Control → verify model config | 3 AI Engine baseline policies display (AML Transaction Monitoring, Sanctions Fuzzy Match, goAML Narrative Generation) with version and approval status | [ ] Pass [ ] Fail |
| 4 | Navigate to Security Dashboard → verify security metrics | Security score/grade displays; 18 security checks across 5 categories show pass/fail; deployment readiness checklist shows 14 items | [ ] Pass [ ] Fail |
| 5 | Navigate to Training → verify course enrollment | 7 training courses display; enrollment records for 5 users visible with status tracking | [ ] Pass [ ] Fail |
| 6 | Verify all notifications display correctly | 6 notifications display with correct priority, read/unread status, and action URLs linking to source modules | [ ] Pass [ ] Fail |

---

## 5. Seeded Test Accounts

> **Source:** `/home/z/my-project/prisma/seed.ts`  
> **WARNING:** Default passwords for `admin@icos.ae` and `mlro@icos.ae` must be changed on first login.

### 5.1 User Accounts

| # | Email | Name | Role | Jurisdiction | Active | UAT Use Case |
|---|-------|------|------|-------------|--------|-------------|
| 1 | `admin@icos.ae` | Omar Al-Mansoori | `admin` | CBUAE | Yes | Admin workflow testing, full system access, user management, AI engine config, security dashboard |
| 2 | `mlro@icos.ae` | Ahmed Al-Rashid | `mlro` | CBUAE | Yes | MLRO workflow testing, SAR approval, Maker-Checker approval, goAML filing |
| 3 | `ahmed@icos.ae` | Ahmed Al-Rashid | `mlro` | CBUAE | Yes | Operational MLRO account — referenced by Phase 5 data (notifications, sanctions screenings, SAR cases) |
| 4 | `fatima@icos.ae` | Fatima Al-Sayed | `compliance_manager` | DFSA | Yes | Compliance Manager workflow, policy review, gap analysis approval, audit scheduling |
| 5 | `omar@icos.ae` | Omar Hassan | `compliance_officer` | CBUAE | Yes | Compliance Officer workflow, AML triage, KYC reviews, evidence uploads, Maker-Checker submissions |
| 6 | `sara@icos.ae` | Sara Al-Maktoum | `dept_head` | FSRA | Yes | Department Head workflow, claims management, policy attestation, team oversight |
| 7 | `khalid@icos.ae` | Khalid Nasser | `analyst` | CBUAE | Yes | Analyst role, HR/training data, evidence uploads, labor law compliance tracking |
| 8 | `board@icos.ae` | Board Member | `board` | CBUAE | Yes | Board Member view, governance dashboards, risk posture overview, KRI visibility |

### 5.2 Seeded Data Summary

| Data Model | Count | Key Records |
|------------|-------|-------------|
| Users | 8 | 8 roles across 3 jurisdictions |
| RegulatoryCirculars | 5 | CBUAE/DFSA/FSRA circulars with gap analysis |
| GapAnalyses | 4 | Missing clauses with AI confidence scores |
| AMLAlerts | 5 | Risk levels: critical (1), high (1), intermediate (2), low (1) |
| SanctionsExceptions | 3 | Active exceptions with sunset dates and compensating controls |
| InspectionEvidence | 3 | AI-verified and unverified evidence with SHA-256 hashes |
| Claims | 5 | 5 claim types across CBUAE/DFSA/FSRA jurisdictions with fraud scores |
| AuditLogs | 5 | APPROVE, ESCALATE, UPLOAD, OVERRIDE_BLOCKED, APPROVE_POLICY actions |
| KRIMetrics | 8 | 8 KPIs across Sanctions/KYC/AML/Training/Governance categories |
| Regulations | 8 | CBUAE/DFSA regulations with COMPLIANT/PARTIAL/PENDING/NON_COMPLIANT status |
| Policies | 11 | 8 operational + 3 AI Engine configuration policies |
| LaborLawCompliance | 7 | Emiratisation/WPS/Working Conditions/Insurance/Benefits/Immigration |
| LegalCases | 5 | Litigation/Arbitration/Regulatory/Labor/Recovery case types |
| TrainingCourses | 7 | Mandatory + optional courses with certification tracking |
| TrainingEnrollments | 5 | Completed/expired/in_progress/overdue enrollment statuses |
| ComplianceAudits | 6 | Internal/regulatory/external audit types with remediation tracking |
| ComplianceAlerts | 5 | SAR_DEADLINE/REGULATORY_DEADLINE/MLRO_ESCALATION/KYC_REVIEW_OVERDUE/TRAINING_OVERDUE |
| SanctionsScreenings | 3 | CLEAR/POTENTIAL_MATCH/CONFIRMED_MATCH screening results |
| SARCases | 3 | DRAFT/PENDING_REVIEW/SUBMITTED_TO_FIU with 30-day deadline tracking |
| CalendarEvents | 8 | Regulatory/audit/training/policy/SAR/KYC event types |
| PolicyAttestations | 4 | Pending/acknowledged/overdue attestation statuses |
| RemediationActions | 3 | Not started/in progress/completed remediation tracking |
| Notifications | 6 | Urgent/high/normal priority with read/unread status |
| VendorDueDiligence | 2 | IT/Operations vendor types with AML assessment |
| ComplianceCases | 2 | AML investigation + sanctions review unified cases |
| RiskAssessments | 2 | Customer/Jurisdiction risk domains with inherent+residual risk |
| RegulatoryDeadlines | 3 | CBUAE quarterly/SAR filing/audit submission deadlines |
| VASPKYC | 1 | Exchange type VASP with HIGH risk rating |
| CorporateKYC | 2 | 1 HIGH risk (PEP + grey-list), 1 LOW risk (UAE-domiciled) |
| IndividualKYC | 2 | 1 STANDARD risk (UAE national), 1 HIGH risk (PEP, Omani) |
| GoAMLFilings | 1 | DRAFT STR filing with XML payload |
| MakerCheckerLogs | 1 | PENDING KYC high-risk approval requiring MLRO sign-off |
| AIChatSessions | 1 | goAML context session with Q&A |
| AIChatMessages | 2 | User query + assistant response (qwen2.5:14b, 3420ms latency) |

### 5.3 Critical Test Scenarios Using Seed Data

| Scenario | Data Used | Expected Behavior |
|----------|-----------|-------------------|
| **Sanctions direct match** | AML-2025-0150 (risk score 95, "Direct Match on UAE Local Terrorist List") | Alert auto-escalated, accounts frozen, MLRO immediate notification required |
| **SAR 30-day deadline** | SAR-2025-0028 (5 days remaining, PENDING_REVIEW) | Deadline countdown displays; urgent notification fires; tipping-off warning shown |
| **Maker-Checker enforcement** | MakerCheckerLog (Omar Hassan as maker, awaiting MLRO checker) | Omar cannot approve own item; Ahmed (MLRO) can approve from Maker-Checker queue |
| **OFAC 50% rule** | CorporateKYC: Gulf Maritime Services LLC (sanctioned UBO at 30%) | UBO visualization calculates total sanctioned ownership; if >= 50%, entity flagged BLOCKED |
| **PEP flagging** | IndividualKYC: Yusuf Al-Balushi (isPep=true, HIGH risk) | PEP status triggers EDD requirement; risk rating auto-assigned HIGH |
| **Training negative gain** | Training effectiveness data with -7% knowledge gain | Compliance alert auto-created for negative knowledge gain; improvement flag raised |
| **goAML XML generation** | GoAMLFiling: GOAML-STR-2025-0031 (DRAFT) | XML output conformant with goAML Schema v4.2, 5-part narrative structure |
| **PII masking** | Any module with personal data | PII toggle masks names (F***** A*-S****), Emirates IDs (784-****-****-*-1), amounts (AED ***,***) |

---

## 6. Appendix: UAT Execution Guidelines

### 6.1 Pre-UAT Checklist

- [ ] Database seeded: `bun run db:seed` executed successfully
- [ ] Dev server running: `bun run dev` — accessible at `http://localhost:3000`
- [ ] AI Engine running: Ollama with qwen2.5:14b model loaded
- [ ] All 33 modules accessible from sidebar navigation
- [ ] Health endpoint returns healthy: `curl http://localhost:3000/api/health`
- [ ] Test accounts can log in (at minimum: admin, mlro, compliance_officer)

### 6.2 Bug Severity Classification

| Severity | Definition | Example |
|----------|-----------|---------|
| **Critical** | Blocks core compliance workflow; regulatory requirement cannot be met | Maker-Checker bypass allows self-approval; SAR filing fails; sanctions screening returns false CLEAR on known match |
| **Major** | Feature significantly impaired but workaround exists | Kanban drag-and-drop fails but status change via dropdown works; PDF export crashes but data displays correctly |
| **Minor** | Cosmetic or non-functional issue; no impact on compliance | Badge color slightly off; tooltip text truncated; mobile layout minor overflow |
| **Enhancement** | Suggested improvement; not a bug | Additional filter option; keyboard shortcut; improved error message |

### 6.3 Bug Reporting Template

```
Module: [e.g., AML & Sanctions Triage]
Test Case: [e.g., B1.5 - Maker-Checker enforcement]
Severity: [Critical / Major / Minor / Enhancement]
Reproducibility: [Always / Sometimes / Once]

Steps to Reproduce:
1. 
2. 
3. 

Expected Result:


Actual Result:


Screenshots/Logs:

```

### 6.4 UAT Exit Criteria

| Criterion | Threshold |
|-----------|-----------|
| All 33 modules tested | 100% |
| All 108 test cases executed | 100% |
| Critical bugs | 0 unresolved |
| Major bugs | <= 2 unresolved (with documented workaround) |
| Minor bugs | <= 10 unresolved (tracked for next sprint) |
| Compliance Officer sign-off | Required |
| MLRO sign-off | Required |
| Admin sign-off | Required |

### 6.5 Regulatory References

| Regulation | Reference | Applicable Test Cases |
|-----------|-----------|----------------------|
| FDL 10/2025 Art. 8 | SAR filing within 30 calendar days | B3.2, MLRO Step 5 |
| FDL 10/2025 Art. 12 | Tipping-off prohibition | B3.4, I5.3 |
| CR 134/2025 Art. 8 | EDD for PEPs and high-risk customers | C1.3, C2.2 |
| CR 134/2025 Art. 15 | Periodic KYC reviews | C1.1, C2.1 |
| CR 134/2025 Art. 25 | Sanctions matching and reporting | B1.1–B1.5 |
| CR 134/2025 Art. 26 | Sanctions screening effectiveness | E3.1–E3.3 |
| CBUAE Notice 3551/2021 S5.1 | KYC review schedules | F1.1, MLRO Step 5 |
| CBUAE Notice 3551/2021 S7.1–S7.2 | Sanctions screening procedures | I5.1–I5.3 |
| CBUAE Notice 3551/2021 S9.1 | AML training requirements | G1.1–G1.3 |
| goAML XML Schema v4.2 | SAR narrative structure (5-part) | D1.2, MLRO Step 4 |
| OFAC 50% Rule | Aggregate sanctioned ownership | C3.2, C3.3 |

---

*Document prepared for IC-OS v7.2 UAT execution. All seeded data reflects realistic UAE compliance scenarios per FDL 10/2025, CR 134/2025, FATF Recommendations, and CBUAE Notice 3551/2021.*
