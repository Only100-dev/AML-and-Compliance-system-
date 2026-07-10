export interface HelpSubsection {
  id: string;
  title: string;
  content: string; // markdown-like content with **bold**, `code`, and line breaks
  tags: string[]; // for search filtering
}

export interface HelpSection {
  id: string;
  title: string;
  icon: string; // lucide icon name
  subsections: HelpSubsection[];
}

export const HELP_SECTIONS: HelpSection[] = [
  // ──────────────────────────────────────────────
  // Section 1: Platform Overview
  // ──────────────────────────────────────────────
  {
    id: "overview",
    title: "Platform Overview",
    icon: "LayoutDashboard",
    subsections: [
      {
        id: "overview-what",
        title: "1.1 What is ConvertEase?",
        content:
          "**ConvertEase** is an **enterprise-grade Compliance & AML Management Platform** purpose-built for UAE Financial Institutions. It delivers end-to-end compliance workflows across the full regulatory lifecycle.\n\nKey capabilities include:\n\n- **KYC/CDD** — Individual and Corporate onboarding wizards with automated risk scoring\n- **Sanctions Screening** — Real-time and batch screening across 8 global lists\n- **SAR/STR Filing** — Integrated goAML pipeline with Maker-Checker approval\n- **Transaction Monitoring** — Live feed, suspicious alerts, and advanced analytics\n- **Risk Assessment** — 5×5 risk matrix with multi-factor scoring\n- **Regulatory Reporting** — Automated CBUAE, goAML, and MOHRE/Nafis reporting\n\nThe platform comprises **14 integrated modules** connected through a unified data layer, providing a **real-time dashboard** with KPI tracking and instant visibility into compliance posture.\n\nAdditional highlights:\n\n- **Backend AI Agent** — Context-aware conversational AI with specialized services for compliance, document reading, memory/embeddings, and structuring\n- **UAE Data Residency** — 100% PDPL compliant with all data stored within UAE borders\n- **Multi-Theme Design System** — 4 professional themes for accessibility and user preference\n- **Maker-Checker Workflows** — Dual-approval controls for critical operations\n- **Automated Regulatory Reporting** — Direct integration with CBUAE, goAML, and MOHRE/Nafis",
        tags: ["overview", "platform", "introduction", "convertease", "aml", "compliance", "features"],
      },
      {
        id: "overview-features",
        title: "1.2 Key Features",
        content:
          "ConvertEase delivers **14 integrated modules** designed to cover every aspect of AML/CFT compliance:\n\n1. **Command Center** — Central hub with 6 KRI cards, compliance metrics, and quick actions\n2. **Individual KYC** — 5-step onboarding wizard with badge system and risk rating\n3. **Corporate Onboarding** — 6-step wizard with UBO cascade analysis and 11-factor risk scoring\n4. **Sanctions Screening** — 8 global list screening with batch upload and confidence scoring\n5. **Adverse Media Search** — 5-step wizard with 83-term AML keyword string and classification\n6. **Transaction Monitoring** — Live feed, suspicious alerts, and analytics dashboard\n7. **goAML Filing** — 6-stage SAR/STR pipeline with Maker-Checker and XML preview\n8. **Risk Assessment** — 5×5 risk matrix heatmap with donut chart breakdown\n9. **CBUAE Quarterly Reporting** — Dual dashboard with PII masking and Excel upload\n10. **AI Agent Management** — Backend AI service portfolio with context-aware routing\n11. **Policies & SOPs** — Document management with version control and full-text search\n12. **Training & Certifications** — 8 mandatory courses with certification tracking\n13. **Audit Trail** — 8 automated trigger rules with interactive toggles\n14. **Security Center** — Security posture assessment with 18 checks across 5 categories\n\n**Real-time Dashboard** — Live KPI tracking with compliance metrics, activity feeds, and jurisdiction switching (CBUAE/DFSA/FSRA)\n\n**Backend AI Agent** — Specialized AI services for conversational, compliance, document, memory, and structuring tasks\n\n**UAE Data Residency** — 100% PDPL compliant with all processing within UAE borders\n\n**Multi-Theme Design System** — 4 professional themes: Light, Dark, Navy, and Emerald\n\n**Maker-Checker Workflows** — Dual-approval controls ensuring segregation of duties\n\n**Automated Regulatory Reporting** — Direct filing to CBUAE, goAML, and MOHRE/Nafis",
        tags: ["features", "modules", "dashboard", "ai", "themes", "maker-checker", "reporting"],
      },
      {
        id: "overview-users",
        title: "1.3 Target Users",
        content:
          "ConvertEase is designed for the following **compliance professionals** within UAE Financial Institutions:\n\n- **Compliance Officers** — Day-to-day compliance operations, policy enforcement, and regulatory coordination\n- **MLRO (Money Laundering Reporting Officer)** — SAR/STR filing decisions, goAML submissions, and regulatory liaison\n- **KYC Analysts** — Customer onboarding, due diligence, risk assessment, and periodic reviews\n- **Risk Managers** — Enterprise risk assessment, risk matrix management, and risk appetite monitoring\n- **Auditors** — Internal and external audit review, QA sampling, and compliance verification\n- **Senior Management** — Executive dashboards, compliance posture overview, and strategic decision support\n\nEach role has **role-based access controls (RBAC)** with 5 permission levels:\n\n1. `Viewer` — Read-only access to dashboards and reports\n2. `Analyst` — KYC/CDD entry, screening operations, and alert management\n3. `Officer` — Full compliance operations, SAR drafting, and policy management\n4. `MLRO` — SAR/STR approval, goAML filing, and regulatory reporting authority\n5. `Admin` — System configuration, user management, and security settings",
        tags: ["users", "roles", "rbac", "compliance-officer", "mlro", "kyc-analyst", "auditor"],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // Section 2: System Architecture
  // ──────────────────────────────────────────────
  {
    id: "architecture",
    title: "System Architecture",
    icon: "Server",
    subsections: [
      {
        id: "architecture-tech",
        title: "2.1 Technology Stack",
        content:
          "ConvertEase is built on a **modern, enterprise-grade technology stack** optimized for performance, security, and developer productivity:\n\n**Frontend**\n\n- **Next.js 16** (App Router) — Server-side rendering, API routes, and edge-optimized delivery\n- **TypeScript 5** — Strict typing throughout the entire codebase for reliability\n- **Tailwind CSS 4** + **shadcn/ui** — Utility-first styling with accessible component library\n- **Zustand** — Lightweight client-side state management\n- **Recharts** — Interactive data visualization and charting\n- **Lucide React** — Consistent icon system across all modules\n\n**Backend**\n\n- **Next.js API Routes** — Serverless API endpoints with middleware support\n- **Prisma ORM** — Type-safe database access with migration support\n- **SQLite** — Embedded database for development and single-deployment scenarios\n\n**AI Layer**\n\n- **Backend AI Services** — Multiple specialized AI services orchestrated for compliance tasks\n- **Context-Aware Routing** — Intelligent request distribution to the appropriate AI service\n\n**Security**\n\n- **AES-256** encryption at rest\n- **TLS 1.3** encryption in transit\n- **JWT** authentication with Bearer tokens\n- **RBAC** with 5 permission levels",
        tags: ["architecture", "tech-stack", "nextjs", "typescript", "prisma", "tailwind", "ai"],
      },
      {
        id: "architecture-database",
        title: "2.2 Database Schema",
        content:
          "The ConvertEase database is modeled using **Prisma ORM** with **18 core models**:\n\n1. `User` — User accounts, roles, permissions, and authentication\n2. `Regulation` — Regulatory requirements and compliance mapping\n3. `AuditLog` — Comprehensive audit trail with timestamps and user attribution\n4. `LaborCompliance` — MOHRE/Nafis labor compliance tracking\n5. `LegalCase` — Legal case management and documentation\n6. `TrainingCourse` — Training content, curriculum, and scheduling\n7. `TrainingEnrollment` — User enrollment, progress, and certification tracking\n8. `AdverseMediaSession` — Adverse media search sessions and results\n9. `CorporateKYC` — Corporate onboarding data with UBO information\n10. `IndividualKYC` — Individual customer KYC data and risk ratings\n11. `GoAMLFiling` — SAR/STR/CTR filing records and pipeline tracking\n12. `MakerCheckerLog` — Maker-Checker workflow records and approval chains\n13. `AIChatSession` — AI Agent conversation sessions\n14. `AIChatMessage` — Individual messages within AI chat sessions\n15. `QuarterlyReport` — CBUAE quarterly reporting data and submissions\n16. `InsuranceRecord` — Insurance compliance records (FDL 48/2023)\n17. `Policy` — Policy documents, SOPs, and version control\n18. `ComplianceAudit` — Compliance audit records and findings\n\nAll models include **created/updated timestamps**, **soft delete** support, and **referential integrity** constraints. The schema follows **PDPL data minimization** principles with PII fields flagged for masking in regulatory views.",
        tags: ["database", "prisma", "schema", "models", "sqlite", "data-model"],
      },
      {
        id: "architecture-api",
        title: "2.3 API Routes",
        content:
          "ConvertEase exposes **14+ API endpoints** through Next.js API Routes:\n\n| Endpoint | Method | Description |\n|---|---|---|\n| `/api/dashboard` | GET | Command Center KPIs, metrics, and activity feed |\n| `/api/regulations` | GET | Regulatory requirements and compliance mapping |\n| `/api/health` | GET | System health check and status monitoring |\n| `/api/ai/chat` | POST | AI Agent conversation endpoint |\n| `/api/aml` | GET/POST | AML compliance operations |\n| `/api/goaml` | GET/POST | goAML filing operations and XML generation |\n| `/api/kyc` | GET/POST | KYC/CDD data operations |\n| `/api/training` | GET/POST | Training course management and enrollment |\n| `/api/compliance` | GET | Compliance status and metrics |\n| `/api/audits` | GET/POST | Audit trail queries and compliance audits |\n| `/api/labor` | GET/POST | MOHRE/Nafis labor compliance |\n| `/api/cases` | GET/POST | Legal case management |\n| `/api/evidence` | GET/POST | Evidence and document management |\n| `/api/policies` | GET/POST | Policy and SOP management |\n| `/api/adverse-media` | GET/POST | Adverse media search operations |\n| `/api/maker-checker` | GET/POST | Maker-Checker workflow operations |\n| `/api/quarterly-reporting` | GET/POST | CBUAE quarterly report management |\n\nAll endpoints require **Bearer JWT authentication** and enforce **RBAC** permissions. Responses follow a consistent JSON structure with `success`, `data`, and `error` fields.",
        tags: ["api", "endpoints", "routes", "rest", "authentication", "jwt"],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // Section 3: Module-by-Module Guide
  // ──────────────────────────────────────────────
  {
    id: "modules",
    title: "Module-by-Module Guide",
    icon: "BookOpen",
    subsections: [
      {
        id: "module-command-center",
        title: "3.1 Command Center",
        content:
          "The **Command Center** is the central hub of ConvertEase, providing an at-a-glance view of your organization's compliance posture.\n\n**6 KRI Cards**\n\nEach card displays a key risk indicator with trend analysis:\n\n1. **Compliance Score** — Overall compliance health percentage\n2. **Open SARs** — Pending suspicious activity reports\n3. **Overdue Reviews** — KYC reviews past their scheduled date\n4. **Active Alerts** — Unresolved transaction monitoring alerts\n5. **Pending Filings** — goAML reports awaiting submission\n6. **Risk Exposure** — Aggregate risk score across the portfolio\n\n**Compliance Metrics**\n\n- Real-time compliance percentage with trend indicators\n- Regulatory filing status summary\n- Staff workload distribution\n\n**Activity Feed**\n\n- Chronological log of all compliance activities\n- Filterable by module, user, and date range\n- Quick-view details on hover\n\n**Quick Actions**\n\nFour one-click actions for common tasks:\n\n1. **File SAR** — Initiate a new Suspicious Activity Report\n2. **Run Screening** — Launch a sanctions screening batch\n3. **Start Inspection** — Begin a compliance inspection\n4. **Generate Audit Pack** — Create a comprehensive audit package\n\n**Jurisdiction Switching**\n\nActive jurisdiction selector supporting:\n\n- **CBUAE** — Central Bank of UAE regulations\n- **DFSA** — Dubai Financial Services Authority\n- **FSRA** — Financial Services Regulatory Authority (ADGM)\n\nSwitching jurisdictions updates all dashboard metrics, applicable regulations, and compliance requirements in real time.",
        tags: ["command-center", "dashboard", "kri", "metrics", "quick-actions", "jurisdiction"],
      },
      {
        id: "module-individual-kyc",
        title: "3.2 Individual KYC",
        content:
          "The **Individual KYC** module provides a structured 5-step wizard for onboarding individual customers in compliance with **CR 134/2025**.\n\n**5-Step Wizard**\n\n**Step 1: Personal Identity**\n- Full name (English & Arabic)\n- Date of birth, nationality, gender\n- Emirates ID / Passport number\n- PEP self-declaration\n\n**Step 2: Identity Documents**\n- Emirates ID upload (front & back)\n- Passport copy (photo page)\n- Visa/Residence permit (if applicable)\n- Document expiry tracking\n\n**Step 3: Address & Employment**\n- UAE residential address\n- PO Box and Emirate\n- Employer name and address\n- Occupation and income range\n- Source of funds declaration\n\n**Step 4: Business Relationship & Funds**\n- Account type and purpose\n- Expected transaction volume\n- Corridor countries for remittances\n- Source of wealth documentation\n\n**Step 5: Summary & Risk Rating**\n- Complete profile review\n- Risk rating assignment: **Standard** or **High Risk**\n- Review schedule generation\n- Maker-Checker submission\n\n**Badge System**\n\n- 🟢 **Compulsory** — Required by CR 134/2025\n- 🟣 **Best Practice** — Recommended but not mandated\n\n**Risk Ratings**\n\n- **Standard** — Normal due diligence applied, annual review\n- **High Risk** — Enhanced due diligence (EDD) triggered, semi-annual review, MLRO oversight",
        tags: ["kyc", "cdd", "individual", "onboarding", "risk-rating", "pep", "wizard"],
      },
      {
        id: "module-corporate-onboarding",
        title: "3.3 Corporate Onboarding",
        content:
          "The **Corporate Onboarding** module handles entity onboarding with comprehensive UBO identification and multi-factor risk scoring.\n\n**6-Step Wizard**\n\n**Step 1: Entity Identity**\n- Legal name (English & Arabic)\n- Trade name, license number\n- Date of incorporation\n- Legal form (LLC, PJSC, etc.)\n- Registered address\n\n**Step 2: Constitutional Documents**\n- Trade license\n- Memorandum & Articles of Association\n- Certificate of Incumbency\n- Board resolution (if applicable)\n\n**Step 3: Management & Authorised Persons**\n- Directors, signatories, and authorized persons\n- PEP screening for each individual\n- Identity document collection\n\n**Step 4: Ownership Structure & UBO**\n- Shareholding breakdown\n- UBO cascade analysis per **Art. 10** of CR 134/2025\n- Nominee shareholders flagged\n- Complex ownership structures visualized\n\n**Step 5: Business & Relationship**\n- Business activities and sector\n- Expected transaction volumes\n- Source of funds and wealth\n- Correspondent banking relationships\n\n**Step 6: Summary & Risk Rating**\n- Complete profile review\n- 11-factor risk score calculation\n- Risk rating: Low / Medium / High\n- Maker-Checker submission\n\n**UBO Cascade Rule (Art. 10)**\n\nOwnership interests are traced through the corporate structure until a **natural person** is identified as the Ultimate Beneficial Owner. All intermediate entities must be documented.\n\n**11-Factor Risk Scoring Engine**\n\n| Factor | Points |\n|---|---|\n| PEP | +35 |\n| PEP UBO | +40 |\n| No UBO Identified | +30 |\n| Complex Ownership Structure | +25 |\n| Nominee Shareholders | +30 |\n| Newly Incorporated (< 1 year) | +15 |\n| Cash-Intensive Business | +20 |\n| High-Risk Jurisdiction | +25 |\n| Adverse Media | +20 |\n| Sanctions Match | +50 |\n| Inconsistent Business Activities | +20 |\n\n**Risk Rating Thresholds**\n\n- **Low** — Score < 30 (Standard due diligence)\n- **Medium** — Score 30–59 (Enhanced monitoring)\n- **High** — Score ≥ 60 (**EDD triggered**, MLRO review required, quarterly reviews)",
        tags: ["corporate", "onboarding", "ubo", "risk-scoring", "pep", "edq", "entity"],
      },
      {
        id: "module-sanctions-screening",
        title: "3.4 Sanctions Screening",
        content:
          "The **Sanctions Screening** module provides comprehensive screening against **8 global sanctions lists** with advanced matching capabilities.\n\n**8 Global Lists**\n\n1. **OFAC** — U.S. Office of Foreign Assets Control (SDN & Non-SDN)\n2. **EU** — European Union Consolidated List\n3. **UN** — United Nations Security Council Consolidated List\n4. **FATF** — Financial Action Task Force Black/Grey Lists\n5. **HMT** — UK HM Treasury Financial Sanctions\n6. **DFAT** — Australian Department of Foreign Affairs & Trade\n7. **MAS** — Monetary Authority of Singapore\n8. **SSI** — Sectoral Sanctions Identifications\n\n**Batch Upload**\n\n- Supported formats: **CSV**, **XLSX**, **JSON**\n- Bulk screening of up to 10,000 records per batch\n- Progress tracking with estimated completion time\n- Results export in all supported formats\n\n**Match Threshold Slider**\n\n- Adjustable from **10% to 100%**\n- Lower thresholds catch more potential matches (higher false positives)\n- Higher thresholds reduce noise (may miss partial matches)\n- Recommended: **85%** for initial screening, **70%** for enhanced review\n\n**Priority Levels**\n\n- **Normal** — Routine screening, 24-hour SLA\n- **High** — Expedited screening, 4-hour SLA\n- **Critical** — Urgent screening, 1-hour SLA (blocks onboarding until cleared)\n\n**Side-by-Side Match Comparison**\n\n- Customer details displayed alongside potential matches\n- Highlighted differences for quick assessment\n- One-click true positive / false positive classification\n\n**Confidence Scoring**\n\n- **0–100%** match confidence rating\n- Based on name similarity, date of birth, nationality, and other identifiers\n- Color-coded: Green (0–49%), Yellow (50–79%), Red (80–100%)",
        tags: ["sanctions", "screening", "ofac", "un", "fatf", "batch", "matching"],
      },
      {
        id: "module-adverse-media",
        title: "3.5 Adverse Media Search",
        content:
          "The **Adverse Media Search** module provides a structured 5-step wizard for conducting and documenting adverse media checks.\n\n**5-Step Wizard**\n\n**Step 1: Subject Details**\n- Full name and aliases\n- Date of birth, nationality\n- Occupation and associated entities\n- Screening purpose (Onboarding / Periodic Review / Trigger Event)\n\n**Step 2: Search Configuration**\n- **83-term AML keyword string** pre-configured for comprehensive coverage\n- Keyword categories: terrorism, fraud, money laundering, corruption, sanctions evasion, tax evasion, drug trafficking, human trafficking, arms dealing, cybercrime\n- Customizable search terms and exclusions\n- Date range filtering\n- Source selection (news, regulatory, court records, social media)\n\n**Step 3: Results Logging**\n- Up to **10 results** per search session\n- Each result classified as:\n  - **C** — Confirmed match to subject\n  - **P** — Potential match requiring further investigation\n  - **F** — False positive (different person/entity)\n  - **N** — Not relevant to AML/CFT risk\n- Source URL, publication date, and excerpt captured\n\n**Step 4: Decision**\n- 4 classification cards:\n  - **CLEAR** — No adverse media identified, proceed with onboarding\n  - **FALSE POSITIVE** — Results relate to a different subject\n  - **POTENTIAL MATCH** — Some concern identified, escalate for review\n  - **CONFIRMED MATCH** — Adverse media confirmed, EDD required or relationship decline\n- Narrative justification required for all decisions\n\n**Step 5: Report**\n- Comprehensive adverse media report generation\n- **PDF print/save** functionality\n- Attachment to customer KYC file\n- Audit trail entry created automatically",
        tags: ["adverse-media", "search", "aml", "keywords", "classification", "report"],
      },
      {
        id: "module-transaction-monitoring",
        title: "3.6 Transaction Monitoring",
        content:
          "The **Transaction Monitoring** module provides real-time surveillance of all financial transactions across the institution.\n\n**3-Tab Interface**\n\n**Tab 1: Live Feed**\n\n- Real-time stream of all transactions\n- **Color-coded risk** indicators:\n  - 🟢 Green — Normal transaction\n  - 🟡 Yellow — Elevated risk indicators\n  - 🟠 Orange — Suspicious pattern detected\n  - 🔴 Red — High-risk / potential SAR trigger\n- Filter by amount, currency, corridor, customer, date\n- Quick-view transaction details on click\n\n**Tab 2: Suspicious Alerts**\n\nPre-configured alert types with detection parameters:\n\n- **Structuring** — Multiple transactions designed to avoid CTR threshold (AED 55,000)\n- **Rapid Movement** — Funds deposited and withdrawn within short timeframes\n- **Unusual Cross-Border** — Transactions inconsistent with customer profile or jurisdiction risk\n- **Dormant Account Activation** — Sudden activity on previously dormant accounts\n\nEach alert includes:\n- Transaction details and pattern analysis\n- Customer risk rating and KYC status\n- Recommended action and escalation path\n\n**Tab 3: Analytics**\n\n- **Bar chart** — Transaction volume by type and period\n- **Line chart** — Trend analysis over time\n- **Pie chart** — Distribution by risk category\n- **Heatmap** — Transaction patterns by hour/day/corridor\n- Custom date range and filter options\n- Export to PDF/Excel for reporting",
        tags: ["transaction-monitoring", "alerts", "suspicious", "live-feed", "analytics", "structuring"],
      },
      {
        id: "module-goaml-filing",
        title: "3.7 goAML Filing (STR/SAR)",
        content:
          "The **goAML Filing** module manages the complete lifecycle of suspicious activity and transaction reports from detection to closure.\n\n**6-Stage Pipeline**\n\n1. **Detected** — Alert triggered by transaction monitoring, screening, or manual referral\n2. **Under Review** — Compliance analyst investigating the alert and gathering evidence\n3. **MLRO Approved** — MLRO has reviewed and approved the filing decision\n4. **Filed to FIU** — Report submitted to UAE FIU via goAML system\n5. **Acknowledged** — FIU has acknowledged receipt of the filing\n6. **Closed** — Case resolved with outcome documented\n\n**Report Types**\n\n- **STR** — Suspicious Transaction Report\n- **SAR** — Suspicious Activity Report\n- **CTR** — Cash Transaction Report (threshold: ≥ AED 55,000)\n- **IFT** — International Funds Transfer (threshold: ≥ AED 3,500)\n- **PNMR** — Partial Name Match Report\n\n**Key Features**\n\n- **Narrative Builder** — Structured template for SAR/STR narratives with guided prompts\n- **Risk Indicators** — Pre-configured list of AML/CFT risk indicators per goAML schema\n- **XML Preview** — Real-time preview of the goAML XML output before submission\n- **Maker-Checker Approval** — Dual-approval workflow ensuring segregation of duties between the analyst who prepares and the MLRO who approves\n\n**Filing Requirements**\n\n- All SARs/STRs must be filed within **7 business days** of detection\n- CTRs filed automatically for cash transactions ≥ AED 55,000\n- IFTs reported for international transfers ≥ AED 3,500\n- PNMRs filed when partial name matches are identified during screening",
        tags: ["goaml", "sar", "str", "ctr", "filing", "fiu", "pipeline", "maker-checker"],
      },
      {
        id: "module-risk-assessment",
        title: "3.8 Risk Assessment",
        content:
          "The **Risk Assessment** module provides a comprehensive framework for evaluating and visualizing compliance risk across the organization.\n\n**5×5 Risk Matrix Heatmap**\n\nA visual heatmap plotting **Likelihood** (1–5) against **Impact** (1–5):\n\n- **Green** — Low risk (1–4 combined score)\n- **Yellow** — Medium risk (5–12 combined score)\n- **Orange** — High risk (13–19 combined score)\n- **Red** — Critical risk (20–25 combined score)\n\n**5 Risk Factors**\n\n1. **Customer Risk** — PEP status, high-risk nationality, adverse media, sanctions history\n2. **Product Risk** — Cash-intensive products, anonymous transactions, complex structures\n3. **Geographic Risk** — FATF grey/blacklist jurisdictions, high-risk corridors, tax havens\n4. **Channel Risk** — Non-face-to-face onboarding, third-party introducers, correspondent banking\n5. **Sector Risk** — Money services, real estate, precious metals, virtual assets\n\n**Donut Chart Breakdown**\n\n- Visual distribution of risk across the 5 factors\n- Interactive segments with drill-down capability\n- Percentage allocation and absolute count per factor\n\n**Upcoming Reviews Table**\n\n- Sorted by review date (overdue first)\n- Customer name, risk rating, review type, and assigned analyst\n- One-click access to the review workflow\n- Overdue items highlighted with escalation indicators",
        tags: ["risk-assessment", "risk-matrix", "heatmap", "risk-factors", "donut-chart", "reviews"],
      },
      {
        id: "module-quarterly-reporting",
        title: "3.9 CBUAE Quarterly Reporting",
        content:
          "The **CBUAE Quarterly Reporting** module manages the preparation, validation, and submission of quarterly regulatory reports to the Central Bank of UAE.\n\n**Dual Dashboard**\n\n1. **Management View** — Full data with complete customer details, risk ratings, and PII visible\n2. **CBUAE Regulatory View** — PII-masked view showing only regulatory-required fields with data aggregation\n\nThe dual view ensures that internal stakeholders have full visibility while regulatory submissions comply with **PDPL data minimization** requirements.\n\n**4 Analytics Charts**\n\n- Compliance metrics trend over the quarter\n- Risk distribution across the portfolio\n- Filing status summary (SAR/STR/CTR counts)\- Regulatory threshold tracking\n\n**Excel Upload with Validation**\n\n- Upload quarterly data via **Excel template**\n- **Auto-validation** against CBUAE schema requirements\n- Error highlighting with field-level guidance\n- Warnings for data quality issues\n- Pre-submission preview\n\n**Status Tracking**\n\nFour-stage workflow:\n\n1. **PROCESSING** — Data upload and initial validation in progress\n2. **VALIDATED** — All data checks passed successfully\n3. **READY** — Report approved by MLRO and queued for submission\n4. **SUBMITTED** — Report filed with CBUAE\n\nEach status transition is logged in the audit trail with timestamp and user attribution.",
        tags: ["quarterly-reporting", "cbuae", "regulatory", "pii-masking", "excel", "submission"],
      },
      {
        id: "module-ai-agent",
        title: "3.10 AI Agent Management",
        content:
          "The **AI Agent Management** module powers ConvertEase's intelligent assistant through a set of **backend AI services** — each specialized for a specific compliance task.\n\n**Backend AI Service Portfolio**\n\n| Service | Role | Description |\n|---|---|---|\n| **Compliance Chat** | Conversationalist | General conversation, FAQs, and user guidance |\n| **Compliance Reasoning** | Domain Expert | AML/CFT compliance queries, regulation interpretation |\n| **Document Analysis** | Reader | OCR, document analysis, and data extraction |\n| **Retrieval Index** | Memory | Semantic search, context retention, and knowledge retrieval |\n| **Structured Output** | Structurer | Structured data extraction, form filling, and XML generation |\n\nAll services are served by the platform's secure backend inference layer (z-ai-web-dev-sdk) with UAE data residency. No on-premise LLM infrastructure is required.\n\n**Floating Chat Widget**\n\n- Always-accessible chat widget in the bottom-right corner\n- **Context-aware routing** — Queries are automatically directed to the most appropriate service\n- Multi-turn conversation support with session history\n- File upload capability for document analysis\n- Suggested prompts based on the current module and page context\n\n**Use Cases**\n\n- \"What are the EDD triggers for corporate clients?\" → Routed to **Compliance Reasoning**\n- \"Extract the name and ID number from this Emirates ID\" → Routed to **Document Analysis**\n- \"Generate a goAML XML for this SAR\" → Routed to **Structured Output**\n- \"What was our last conversation about?\" → Routed to **Retrieval Index**\n- \"How do I file a SAR?\" → Routed to **Compliance Chat**\n\n**Data Privacy**\n\n- All AI processing occurs within **UAE data residency** boundaries\n- No customer PII is transmitted to external APIs\n- Conversation logs are retained per PDPL retention requirements\n- Users can delete their AI conversation history",
        tags: ["ai", "chat", "llm", "agent", "conversationalist", "document-reader"],
      },
      {
        id: "module-policies",
        title: "3.11 Policies & SOPs",
        content:
          "The **Policies & SOPs** module provides a centralized document management system for all compliance policies and standard operating procedures.\n\n**Document Categories**\n\n- AML/CFT Policy\n- CDD/EDD Procedures\n- Sanctions Screening Policy\n- SAR/STR Filing Procedures\n- Risk Assessment Methodology\n- Training & Awareness Policy\n- Record Retention Policy\n- Data Protection Policy\n- Business Continuity Plan\n- Correspondent Banking Policy\n\n**Version Control**\n\n- Full version history with change tracking\n- Side-by-side comparison between versions\n- Rollback capability to previous versions\n- Approval workflow for new versions (Maker-Checker)\n- Scheduled review reminders\n\n**Role-Based Access**\n\n- **Viewer** — Read-only access to published policies\n- **Analyst** — Access to procedures and operational guides\n- **Officer** — Edit access for draft policies\n- **MLRO** — Approval authority for policy publications\n- **Admin** — Full control including deletion and archival\n\n**Full-Text Search**\n\n- Search across all policy documents\n- Keyword highlighting in results\n- Filter by category, status, and date\n- Relevance-ranked results\n\n**PDF/Word Download**\n\n- Export any policy in **PDF** or **Word** format\n- Branded templates with organizational headers\n- Digital signature support for approved documents",
        tags: ["policies", "sop", "documents", "version-control", "search", "compliance"],
      },
      {
        id: "module-training",
        title: "3.12 Training & Certifications",
        content:
          "The **Training & Certifications** module manages mandatory AML/CFT training programs and professional certification tracking.\n\n**8 Mandatory Courses**\n\n1. AML/CFT Fundamentals\n2. KYC/CDD Procedures\n3. Sanctions & Screening\n4. SAR/STR Filing\n5. Risk Assessment & Management\n6. PEP & High-Risk Customer Handling\n7. Transaction Monitoring\n8. Regulatory Reporting & goAML\n\n**Team Dashboard**\n\n- **Progress bars** for each team member's course completion\n- Filter by department, role, and certification status\n- Overdue training highlighted with escalation alerts\n- Manager view with team-level analytics\n\n**Certification Tracker**\n\nTrack professional certifications with renewal reminders:\n\n- **CAMS** — Certified Anti-Money Laundering Specialist\n- **CFE** — Certified Fraud Examiner\n- **CGSS** — Certified Global Sanctions Specialist\n- **ACAMS** — Association of Certified Anti-Money Laundering Specialists membership\n\n**Training Calendar**\n\n- Monthly view with scheduled sessions\n- Instructor-led session booking\n- E-learning module deadlines\n- Certification renewal dates\n\n**Overdue Alerts**\n\n- Email notifications for upcoming and overdue training\n- Manager escalation for persistent non-compliance\n- Dashboard badge showing overdue count\n- Automatic compliance score adjustment for training gaps",
        tags: ["training", "certifications", "cams", "cfe", "courses", "compliance-training"],
      },
      {
        id: "module-audit-trail",
        title: "3.13 Audit Trail",
        content:
          "The **Audit Trail** module provides comprehensive logging of all compliance activities with automated trigger rules.\n\n**8 Automated Trigger Rules**\n\nEach rule can be toggled on/off independently:\n\n1. **High-Risk Transaction** — Auto-logs transactions exceeding risk thresholds\n2. **PEP Onboarding** — Logs all PEP-related onboarding activities\n3. **Sanctions Match** — Logs all sanctions screening matches (true positive and false positive)\n4. **KYC Expiry** — Logs when KYC reviews become overdue\n5. **SAR Deadline** — Logs SAR filing deadline warnings and breaches\n6. **Bulk Pattern** — Logs detection of bulk transaction patterns\n7. **Cross-Border** — Logs significant cross-border transaction activity\n8. **Dormant Account** — Logs activation of dormant accounts\n\n**Interactive Toggles**\n\n- Enable/disable each trigger rule independently\n- Configure thresholds and parameters per rule\n- View trigger frequency analytics\n- Set notification preferences for each rule\n\n**Activity Feed**\n\n- Chronological log of all triggered events\n- Filterable by rule type, user, date range, and severity\n- Detailed view with full event context\n- Export to PDF/Excel for audit reporting\n\n**Compliance Benefits**\n\n- Satisfies CBUAE record-keeping requirements (Art. 12, CR 134/2025)\n- Provides evidence of active monitoring and oversight\n- Supports regulatory examination responses\n- Enables internal audit review of compliance operations",
        tags: ["audit-trail", "triggers", "logging", "compliance", "monitoring", "record-keeping"],
      },
      {
        id: "module-security-center",
        title: "3.14 Security Center",
        content:
          "The **Security Center** module provides a comprehensive view of the platform's security posture and operational readiness.\n\n**Security Posture Assessment**\n\n- Overall security score (0–100%)\n- Trend indicator showing improvement or degradation\n- Comparison against industry benchmarks\n\n**18 Checks Across 5 Categories**\n\n1. **Authentication** (4 checks)\n   - Password policy enforcement\n   - MFA/2FA status\n   - Session timeout configuration\n   - Failed login lockout policy\n\n2. **Access Control** (4 checks)\n   - RBAC configuration\n   - Privileged account audit\n   - Dormant account detection\n   - Segregation of duties validation\n\n3. **Data Protection** (4 checks)\n   - Encryption at rest (AES-256)\n   - Encryption in transit (TLS 1.3)\n   - PII masking in non-production environments\n   - Data backup verification\n\n4. **Monitoring & Logging** (3 checks)\n   - Audit logging enabled\n   - Real-time alerting configured\n   - Log integrity verification\n\n5. **Infrastructure** (3 checks)\n   - System health monitoring\n   - Dependency vulnerability scan\n   - Deployment readiness status\n\n**Health Endpoint Monitoring**\n\n- Real-time health check of all system components\n- API endpoint response time tracking\n- Database connectivity and performance\n- AI service availability status\n\n**Deployment Readiness Checklist**\n\n- Pre-deployment verification of all security controls\n- Environment configuration validation\n- SSL/TLS certificate expiry monitoring\n- Dependency and patch management status",
        tags: ["security", "posture", "checks", "monitoring", "health", "deployment", "rbac"],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // Section 4: User Scenarios & Examples
  // ──────────────────────────────────────────────
  {
    id: "scenarios",
    title: "User Scenarios & Examples",
    icon: "Users",
    subsections: [
      {
        id: "scenario-individual-onboarding",
        title: "Scenario 1: New Customer Onboarding (Individual)",
        content:
          "**Case: Fatima Al-Zarooni — Individual Customer Onboarding**\n\n**Background**\n\nFatima Al-Zarooni, a UAE national, visits the branch to open a new savings account with remittance capabilities. The KYC Analyst initiates the onboarding process in ConvertEase.\n\n**Step-by-Step Workflow**\n\n**Day 1: KYC Wizard**\n\n1. **Personal Identity** — Name: Fatima Al-Zarooni, DOB: 15/Mar/1988, Nationality: UAE, Emirates ID: 784-1988-1234567-1, PEP: No\n2. **Identity Documents** — Emirates ID uploaded (front & back), Passport copy uploaded, both valid until 2027\n3. **Address & Employment** — Address: Dubai Marina, Employer: Emirates NBD, Occupation: Senior Accountant, Income: AED 35,000/month\n4. **Business Relationship & Funds** — Account type: Savings + Remittance, Expected monthly volume: AED 15,000, Corridors: UAE-India, Source of funds: Employment salary\n5. **Summary & Risk Rating** — All compulsory fields complete (🟢), Profile reviewed, Risk rating assigned: **Medium** (due to remittance corridor to India — FATF grey list consideration)\n\n**Day 1: Sanctions Screening**\n\n- Screening initiated across 8 global lists\n- **Result: Clear** — No matches found, Confidence: **98%**\n- Screening logged and attached to KYC file\n\n**Day 1: Adverse Media Search**\n\n- 83-term AML keyword string applied\n- 2 results found, both classified as **N** (Not relevant — different person)\n- **Decision: CLEAR**\n- Report generated and saved as PDF\n\n**Day 1: MLRO Review**\n\n- Medium risk rating requires MLRO acknowledgment\n- MLRO reviews complete file: KYC ✓, Screening ✓, Adverse Media ✓\n- **MLRO Decision: Approved** — Standard due diligence with enhanced monitoring for remittance corridor\n\n**Outcome**\n\n- **Risk Rating: Medium**\n- **Annual review** scheduled for 15/Mar/2026\n- Enhanced monitoring flag for India corridor transactions\n- Account activated with standard transaction limits",
        tags: ["scenario", "individual", "onboarding", "kyc", "screening", "adverse-media", "case-study"],
      },
      {
        id: "scenario-sar-filing",
        title: "Scenario 2: Suspicious Transaction Detection & SAR Filing",
        content:
          "**Case: ABC Exchange House — Structuring Detection & SAR Filing**\n\n**Background**\n\nThe Transaction Monitoring module detects a pattern of structured deposits at ABC Exchange House, a money services business customer.\n\n**Suspicious Pattern**\n\n- **9 deposits** of exactly **AED 54,000** each over 5 business days\n- Each deposit is **below the AED 55,000 CTR threshold**\n- Total deposited: **AED 486,000**\n- **972% increase** compared to the customer's typical monthly volume\n- All deposits followed by immediate international wire transfers to a single beneficiary in Country X\n\n**Day 1: Detection**\n\n1. Transaction Monitoring alert triggered (Structuring pattern)\n2. Alert escalated to Compliance Analyst\n3. Analyst reviews transaction history and customer profile\n\n**Day 2: Investigation**\n\n4. Full transaction analysis completed\n5. Customer contact records reviewed\n6. Previous SAR history checked (none found)\n7. Beneficiary due diligence initiated\n\n**Day 3: SAR Preparation**\n\n8. SAR narrative drafted using Narrative Builder\n9. Risk indicators selected: Structuring, Rapid Movement, Unusual Cross-Border\n10. Supporting documents attached (transaction logs, customer correspondence)\n11. **goAML XML preview** generated and reviewed\n\n**Day 4: Maker-Checker Approval**\n\n12. SAR submitted for MLRO review (Maker-Checker workflow)\n13. MLRO reviews narrative quality, evidence, and regulatory compliance\n14. **MLRO Decision: Approved** — SAR to be filed\n\n**Day 5: FIU Submission**\n\n15. goAML XML submitted to UAE FIU\n16. Account frozen pending investigation\n17. **Acknowledged** by FIU\n\n**Pipeline Progress**\n\nDetected → Under Review → MLRO Approved → Filed to FIU → Acknowledged → **Closed** (upon case resolution)\n\n**Key Compliance Actions**\n\n- Account frozen to prevent further structuring\n- Related accounts flagged for monitoring\n- Beneficiary entity added to enhanced screening list\n- Training alert issued for structuring detection refresher",
        tags: ["scenario", "sar", "structuring", "goaml", "transaction-monitoring", "case-study", "filing"],
      },
      {
        id: "scenario-corporate-ubo",
        title: "Scenario 3: Corporate Client UBO Identification",
        content:
          "**Case: Gulf Investment Holdings PJSC — Corporate Onboarding with Complex UBO Structure**\n\n**Background**\n\nGulf Investment Holdings PJSC, a UAE-based investment company, applies for a corporate banking relationship. The ownership structure is complex with multiple layers.\n\n**Ownership Structure**\n\n- **35%** — UAE Individual (Ahmed Al-Mansoori)\n- **40%** — BVI-registered company (Caribbean Holdings Ltd)\n- **25%** — UAE Government entity (Dubai Investment Corporation)\n\n**UBO Cascade Analysis (Art. 10)**\n\n1. **Ahmed Al-Mansoori (35%)** — Direct individual owner → **UBO identified**\n2. **Caribbean Holdings Ltd (40%)** — Corporate entity in BVI (high-risk jurisdiction)\n   - Trace through BVI registry: 60% owned by Hassan Al-Rashid (Lebanese national)\n   - Hassan Al-Rashid → **UBO identified**\n   - PEP check: Hassan Al-Rashid identified as **former Minister of Finance** → **PEP UBO**\n3. **Dubai Investment Corporation (25%)** — Government entity\n   - Government ownership excluded from UBO definition per CR 134/2025\n   - No individual UBO for this shareholding\n\n**11-Factor Risk Scoring**\n\n| Factor | Points |\n|---|---|\n| PEP UBO (Hassan Al-Rashid) | +40 |\n| Complex Ownership Structure | +25 |\n| Nominee Shareholders (Caribbean Holdings) | +30 |\n| High-Risk Jurisdiction (BVI) | +25 |\n| No UBO Identified (Government share) | +30 |\n| Cash-Intensive Business | +0 |\n| Newly Incorporated | +0 |\n| Adverse Media | +0 |\n| Sanctions Match | +0 |\n| Inconsistent Business Activities | +0 |\n| PEP (direct) | +0 |\n| **Total** | **100** |\n\n**Risk Rating: High** (Score ≥ 60 → **EDD triggered**)\n\n**Required Actions**\n\n- **CEO/CFO approval** required for onboarding (per internal policy for High-Risk entities)\n- **Quarterly EDD** reviews scheduled\n- Source of funds documentation for all UBOs\n- PEP senior management approval for relationship continuation\n- Enhanced transaction monitoring with lower alert thresholds\n- Annual sanctions re-screening with 95% confidence threshold\n\n**Compliance Controls Applied**\n\n- UBO information shared with Transaction Monitoring for pattern analysis\n- Caribbean Holdings Ltd added to enhanced screening list\n- Quarterly review calendar entries created for all UBOs\n- Account opening conditional on CEO/CFO sign-off",
        tags: ["scenario", "corporate", "ubo", "pep", "risk-scoring", "high-risk", "case-study"],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // Section 5: Training Program
  // ──────────────────────────────────────────────
  {
    id: "training",
    title: "Training Program",
    icon: "GraduationCap",
    subsections: [
      {
        id: "training-curriculum",
        title: "5.1 Training Curriculum",
        content:
          "The ConvertEase training program includes **8 mandatory courses** for all compliance staff:\n\n| # | Course | Duration | Frequency | Target Role |\n|---|---|---|---|---|\n| 1 | AML/CFT Fundamentals | 4 hours | Annual | All Staff |\n| 2 | KYC/CDD Procedures | 6 hours | Annual | KYC Analysts, Officers |\n| 3 | Sanctions & Screening | 4 hours | Annual | Screening Analysts, Officers |\n| 4 | SAR/STR Filing | 5 hours | Annual | MLRO, Officers |\n| 5 | Risk Assessment & Management | 4 hours | Semi-Annual | Risk Managers, Officers |\n| 6 | PEP & High-Risk Customer Handling | 3 hours | Annual | KYC Analysts, Officers |\n| 7 | Transaction Monitoring | 5 hours | Annual | TM Analysts, Officers |\n| 8 | Regulatory Reporting & goAML | 4 hours | Annual | MLRO, Reporting Officers |\n\n**Total mandatory training**: **35 hours** per year for full compliance coverage.\n\n**Assessment Requirements**\n\n- Each course concludes with a **multiple-choice assessment**\n- **Passing score: 80%** required for certification\n- Up to **2 retakes** permitted within 30 days\n- Failure after 2 retakes requires instructor-led remediation",
        tags: ["training", "curriculum", "courses", "mandatory", "assessment", "duration"],
      },
      {
        id: "training-delivery",
        title: "5.2 Training Delivery Methods",
        content:
          "ConvertEase supports **3 primary training delivery methods** to accommodate different learning styles and operational requirements:\n\n**1. E-Learning (Self-Paced)**\n\n- Available 24/7 through the Training module\n- Interactive modules with embedded quizzes\n- Progress tracking with automatic resume capability\n- **Passing score: 80%**\n- Certificate generated upon completion\n- Average completion time tracked for benchmarking\n- Mobile-responsive design for on-the-go learning\n\n**2. Instructor-Led Training**\n\n- **Virtual** — Live webinars via video conference\n- **In-Person** — Classroom sessions at designated training facilities\n- Scheduled sessions visible on the Training Calendar\n- Maximum 20 participants per session for optimal engagement\n- Session recordings available for review within 7 days\n- Q&A sessions built into each module\n\n**3. On-the-Job Training**\n\n- **Shadowing** — New analysts shadow experienced team members for 2 weeks\n- **Mentoring** — Assigned mentor for the first 90 days\n- **Practical Assessments** — Real-world case studies evaluated by senior staff\n- **Simulation Exercises** — ConvertEase sandbox environment for hands-on practice\n- Performance reviews at 30, 60, and 90 days\n\n**Blended Learning Approach**\n\nThe recommended approach combines all three methods:\n- E-Learning for foundational knowledge (Weeks 1–2)\n- Instructor-Led for complex topics and Q&A (Weeks 3–4)\n- On-the-Job for practical application (Weeks 5–12)",
        tags: ["training", "delivery", "e-learning", "instructor-led", "on-the-job", "mentoring"],
      },
      {
        id: "training-schedule",
        title: "5.3 Training Schedule",
        content:
          "**Q1 2025 Training Schedule (January–March)**\n\n**January 2025**\n\n| Week | Course | Delivery | Facilitator |\n|---|---|---|---|\n| Week 1 | AML/CFT Fundamentals | E-Learning | Self-paced |\n| Week 2 | KYC/CDD Procedures | E-Learning | Self-paced |\n| Week 3 | KYC/CDD Procedures | Instructor-Led (Virtual) | A. Hassan |\n| Week 4 | Sanctions & Screening | E-Learning | Self-paced |\n\n**February 2025**\n\n| Week | Course | Delivery | Facilitator |\n|---|---|---|---|\n| Week 5 | Sanctions & Screening | Instructor-Led (In-Person) | M. Al-Ketbi |\n| Week 6 | SAR/STR Filing | E-Learning | Self-paced |\n| Week 7 | SAR/STR Filing | Instructor-Led (Virtual) | S. Patel |\n| Week 8 | Risk Assessment & Management | E-Learning | Self-paced |\n\n**March 2025**\n\n| Week | Course | Delivery | Facilitator |\n|---|---|---|---|\n| Week 9 | Risk Assessment & Management | Instructor-Led (Virtual) | R. Chen |\n| Week 10 | PEP & High-Risk Customer Handling | E-Learning | Self-paced |\n| Week 11 | Transaction Monitoring | E-Learning + Instructor-Led | K. Okonkwo |\n| Week 12 | Regulatory Reporting & goAML | E-Learning | Self-paced |\n\n**Notes**\n\n- All virtual sessions run 10:00–12:00 GST\n- In-person sessions held at the Compliance Training Center\n- Course materials available 1 week before each session\n- Assessments must be completed within 7 days of course end",
        tags: ["training", "schedule", "q1-2025", "calendar", "facilitator"],
      },
      {
        id: "training-effectiveness",
        title: "5.4 Training Effectiveness Metrics",
        content:
          "ConvertEase tracks **4 key training effectiveness metrics** to ensure continuous improvement:\n\n**1. Completion Rate**\n\n- **Current: 89%** | **Target: ≥95%**\n- Measures the percentage of staff who complete mandatory training within the designated period\n- Tracked by course, department, and individual\n- Gap: 6 percentage points below target — action plan required\n\n**2. Assessment Scores**\n\n- **Current: 87%** | **Target: ≥85%**\n- Average score across all course assessments\n- Indicates knowledge retention and comprehension\n- Currently **exceeding target** by 2 percentage points\n\n**3. Time to Competency**\n\n- Measures the average time from training start to demonstrated proficiency\n- Benchmark: 12 weeks for new analysts, 4 weeks for refresher courses\n- On-the-job performance evaluated at 30/60/90-day intervals\n\n**4. Knowledge Retention**\n\n- **Current: 82%** | **Target: ≥80%**\n- Measured through 90-day post-training assessments\n- Identifies areas where refresher training may be needed\n- Currently **meeting target** with 2 percentage points margin\n\n**Improvement Actions**\n\n- Implement automated reminders for incomplete training (targeting 95% completion)\n- Add practical case study exercises for courses with lower assessment scores\n- Schedule quarterly refresher micro-modules for areas with declining retention\n- Recognize top-performing departments to drive healthy competition",
        tags: ["training", "metrics", "effectiveness", "completion", "retention", "kpi"],
      },
      {
        id: "training-certification",
        title: "5.5 Certification Requirements",
        content:
          "Different roles require specific certification paths within ConvertEase:\n\n**KYC Analyst Certification**\n\n- **4 mandatory courses**:\n  1. AML/CFT Fundamentals\n  2. KYC/CDD Procedures\n  3. PEP & High-Risk Customer Handling\n  4. Sanctions & Screening\n- **Practical assessment**: Complete 5 supervised KYC files with ≥90% QA score\n- **Certification validity**: 1 year (renewal requires annual refresher)\n\n**MLRO Certification**\n\n- **6 mandatory courses**:\n  1. AML/CFT Fundamentals\n  2. KYC/CDD Procedures\n  3. SAR/STR Filing\n  4. Risk Assessment & Management\n  5. Transaction Monitoring\n  6. Regulatory Reporting & goAML\n- **External certification**: **CAMS** (Certified Anti-Money Laundering Specialist) required within 12 months of appointment\n- **Practical assessment**: Complete 3 supervised SAR filings with MLRO sign-off\n- **Certification validity**: 1 year (renewal requires annual refresher + CAMS recertification every 3 years)\n\n**Transaction Monitoring Analyst Certification**\n\n- **3 mandatory courses**:\n  1. AML/CFT Fundamentals\n  2. Transaction Monitoring\n  3. Risk Assessment & Management\n- **Practical assessment**: Identify and escalate 5 suspicious patterns in simulation exercises\n- **Certification validity**: 1 year (renewal requires annual refresher)\n\n**Professional Certifications Tracked**\n\n| Certification | Issuing Body | Renewal |\n|---|---|---|\n| CAMS | ACAMS | 3 years |\n| CFE | ACFE | Annual CPD |\n| CGSS | ACAMS | 3 years |\n| ACAMS Membership | ACAMS | Annual |",
        tags: ["certification", "cams", "cfe", "cgss", "kyc-analyst", "mlro", "requirements"],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // Section 6: Quality Assurance Procedures
  // ──────────────────────────────────────────────
  {
    id: "qa",
    title: "Quality Assurance Procedures",
    icon: "ClipboardCheck",
    subsections: [
      {
        id: "qa-framework",
        title: "6.1 QA Framework",
        content:
          "The ConvertEase QA Framework is built on **5 pillars** ensuring consistent, high-quality compliance operations:\n\n**1. Accuracy**\n\n- All data entries verified against source documents\n- Automated validation rules prevent common errors\n- Dual-entry verification for critical fields (names, ID numbers, amounts)\n- Error rate target: <2% per analyst per month\n\n**2. Completeness**\n\n- All mandatory fields must be populated before submission\n- Document checklist verification at each workflow step\n- Automated gap detection for missing information\n- Completeness target: 100% for all compulsory (🟢) fields\n\n**3. Timeliness**\n\n- KYC reviews completed within regulatory deadlines\n- SAR filings within 7 business days of detection\n- Screening results processed per priority SLAs\n- Overdue item escalation at 80% of deadline\n\n**4. Consistency**\n\n- Standardized procedures across all analysts\n- Decision trees for common compliance scenarios\n- Regular calibration sessions to align analyst judgments\n- Inter-rater reliability target: ≥90%\n\n**5. Documentation**\n\n- All decisions supported by documented rationale\n- Evidence retention per regulatory requirements (5 years minimum)\n- Audit trail entry for every compliance action\n- Documentation quality checked as part of QA review",
        tags: ["qa", "framework", "accuracy", "completeness", "timeliness", "documentation"],
      },
      {
        id: "qa-checklists",
        title: "6.2 QA Checklists",
        content:
          "ConvertEase provides **2 comprehensive QA checklists** for the most critical compliance processes:\n\n**KYC File QA Checklist**\n\n| # | Check | Criteria | Pass/Fail |\n|---|---|---|---|\n| 1 | Identity Verification | Name, DOB, nationality match across all documents | ☐ |\n| 2 | Document Completeness | All required documents uploaded and legible | ☐ |\n| 3 | PEP Screening | PEP status correctly identified and documented | ☐ |\n| 4 | Risk Rating | Risk rating aligns with scoring methodology | ☐ |\n| 5 | Source of Funds | Source of funds documented and consistent | ☐ |\n| 6 | Sanctions Screening | Screening completed with results documented | ☐ |\n| 7 | Adverse Media | Media check completed with classification | ☐ |\n| 8 | Review Schedule | Periodic review date set per risk rating | ☐ |\n\n**SAR Filing QA Checklist**\n\n| # | Check | Criteria | Pass/Fail |\n|---|---|---|---|\n| 1 | Subject Information | Complete and accurate subject details | ☐ |\n| 2 | Transaction Details | All relevant transactions documented | ☐ |\n| 3 | Red Flags | All red flags identified and articulated | ☐ |\n| 4 | Narrative Quality | Clear, concise, and factual narrative | ☐ |\n| 5 | Supporting Documents | All evidence attached and referenced | ☐ |\n| 6 | Maker-Checker | Dual-approval workflow completed | ☐ |\n| 7 | goAML Submission | XML validated and submitted successfully | ☐ |\n| 8 | Filing Deadline | Filed within 7 business days of detection | ☐ |\n\nEach checklist item must pass for the overall file/filing to receive a **Satisfactory** rating.",
        tags: ["qa", "checklist", "kyc", "sar", "verification", "quality"],
      },
      {
        id: "qa-sampling",
        title: "6.3 QA Sampling",
        content:
          "The QA sampling methodology ensures representative coverage across all compliance activities:\n\n**Monthly Sampling Rates**\n\n| Activity | Sampling Rate | Rationale |\n|---|---|---|\n| Individual KYC | 10% | High volume, standardized process |\n| Corporate KYC | 20% | Higher complexity and risk |\n| SARs | 100% | Critical regulatory filings |\n| Sanctions Screening | 5% | Automated process with built-in controls |\n| Transaction Alerts | 10% | High volume with defined escalation rules |\n| High-Risk Reviews | 100% | Elevated risk requiring full oversight |\n\n**Scoring Methodology**\n\nEach sampled item is scored on a 0–100% scale:\n\n- **Excellent** — 95–100%: No deficiencies, exceeds expectations\n- **Satisfactory** — 85–94%: Minor deficiencies that do not impact compliance\n- **Needs Improvement** — 70–84%: Notable deficiencies requiring corrective action\n- **Unsatisfactory** — <70%: Critical deficiencies requiring immediate remediation and re-training\n\n**Scoring Criteria**\n\n- **Accuracy** (25%) — Correctness of data and decisions\n- **Completeness** (25%) — All required fields and documents present\n- **Timeliness** (20%) — Completed within SLA/regulatory deadlines\n- **Documentation** (15%) — Quality of rationale and evidence\n- **Consistency** (15%) — Alignment with established procedures\n\n**Corrective Actions**\n\n- **Needs Improvement**: Analyst receives targeted coaching within 2 weeks\n- **Unsatisfactory**: Analyst suspended from independent work until re-training completed; manager notified",
        tags: ["qa", "sampling", "scoring", "rates", "methodology", "corrective"],
      },
      {
        id: "qa-audit-trail",
        title: "6.4 QA Audit Trail",
        content:
          "All QA reviews are automatically logged in the ConvertEase audit trail with the following information:\n\n**Logged Fields**\n\n- **Timestamp** — Date and time of the QA review\n- **Reviewer** — Name and role of the QA reviewer\n- **File/Filing ID** — Reference to the reviewed item\n- **Review Type** — KYC File / SAR Filing / Screening / Other\n- **Score** — Overall score and individual criteria scores\n- **Findings** — Detailed observations and deficiencies\n- **Rating** — Excellent / Satisfactory / Needs Improvement / Unsatisfactory\n- **Corrective Actions** — Required follow-up items with deadlines\n- **Acknowledgment** — Analyst acknowledgment of findings\n\n**Retention Policy**\n\n- QA records retained for **5 years** minimum per CR 134/2025, Art. 12\n- Records available for regulatory examination upon request\n- Quarterly QA summary reports generated automatically\n\n**Access Controls**\n\n- QA reviewers can access all sampled files regardless of department\n- Analysts can view their own QA results and corrective actions\n- Managers can view department-level QA summaries\n- MLRO has full access to all QA records\n\n**Reporting**\n\n- **Monthly**: QA summary by department and analyst\n- **Quarterly**: Trend analysis with improvement recommendations\n- **Annually**: Comprehensive QA report for senior management and board",
        tags: ["qa", "audit-trail", "logging", "retention", "reporting", "findings"],
      },
      {
        id: "qa-metrics",
        title: "6.5 QA Metrics",
        content:
          "**November 2024 QA Performance Summary**\n\n**KYC File Reviews**\n\n- **47 KYC files** reviewed\n- **88%** average score\n- **94%** pass rate (≥85% score)\n- **2 critical errors** identified (incorrect risk ratings)\n- **3 common deficiencies**: Missing source of funds documentation, incomplete PEP screening notes, inconsistent address formatting\n\n**SAR Filing Reviews**\n\n- **96%** SAR quality score\n- **100%** filed within deadline\n- **0** rejections from FIU\n- **1 minor deficiency**: Narrative could be more specific on transaction patterns\n\n**Monthly Trend (Sep–Nov 2024)**\n\n| Metric | September | October | November | Trend |\n|---|---|---|---|---|\n| KYC Files Reviewed | 38 | 42 | 47 | ↑ Improving |\n| Avg KYC Score | 84% | 86% | 88% | ↑ Improving |\n| KYC Pass Rate | 89% | 92% | 94% | ↑ Improving |\n| SAR Quality | 92% | 94% | 96% | ↑ Improving |\n| Critical Errors | 4 | 3 | 2 | ↓ Improving |\n\n**Key Observations**\n\n- QA performance trending positively across all metrics\n- Targeted coaching on source of funds documentation initiated\n- PEP screening checklist updated to address documentation gaps\n- Standardized address format template introduced to reduce inconsistencies\n- On track to achieve 95% KYC pass rate target by Q1 2025",
        tags: ["qa", "metrics", "performance", "kpi", "trends", "november-2024"],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // Section 7: FAQ
  // ──────────────────────────────────────────────
  {
    id: "faq",
    title: "FAQ",
    icon: "HelpCircle",
    subsections: [
      {
        id: "faq-general",
        title: "General (Q1–Q5)",
        content:
          "**Q1: What is ConvertEase?**\n\nConvertEase is an **enterprise-grade Compliance & AML Management Platform** purpose-built for UAE Financial Institutions. It integrates 14 modules covering KYC/CDD, sanctions screening, SAR/STR filing, transaction monitoring, risk assessment, and regulatory reporting into a single unified platform.\n\n**Q2: Who can use ConvertEase?**\n\nConvertEase is designed for compliance professionals within UAE-licensed financial institutions, including Compliance Officers, MLROs, KYC Analysts, Risk Managers, Auditors, and Senior Management. Access is controlled through 5 RBAC levels (Viewer, Analyst, Officer, MLRO, Admin).\n\n**Q3: Is ConvertEase compliant with UAE regulations?**\n\nYes. ConvertEase is fully aligned with **FDL 10/2025** (AML/CFT/CPF), **CR 134/2025** (Implementing Regulations), **FDL 48/2023** (Insurance), and **FDL 6/2025** (AML Amendments). It maps all CR 134/2025 Articles 8–17 to specific platform features.\n\n**Q4: Where is my data stored?**\n\nAll data is stored within the **UAE** in compliance with **PDPL** (Personal Data Protection Law). ConvertEase maintains 100% UAE data residency with no cross-border data transfers. Data is encrypted with **AES-256** at rest and **TLS 1.3** in transit.\n\n**Q5: Can I access ConvertEase remotely?**\n\nYes. ConvertEase is a web-based platform accessible through **Chrome 120+** (recommended browser) from any authorized location. Access requires valid credentials with JWT authentication. All remote sessions are fully encrypted and audited.",
        tags: ["faq", "general", "overview", "uae", "compliance", "access"],
      },
      {
        id: "faq-kyc",
        title: "KYC/CDD (Q6–Q10)",
        content:
          "**Q6: What is the difference between Standard and High Risk KYC?**\n\n**Standard Risk** customers undergo normal due diligence (NDD) with annual periodic reviews. **High Risk** customers require enhanced due diligence (EDD) with semi-annual reviews, MLRO oversight, CEO/CFO approval for onboarding, and enhanced transaction monitoring.\n\n**Q7: What triggers Enhanced Due Diligence (EDD)?**\n\nEDD is triggered when the **11-factor risk score** reaches **≥60 points**, or when any of the following apply: PEP status, PEP UBO, sanctions match, no UBO identified, complex ownership structure, or high-risk jurisdiction involvement. EDD requires MLRO review, senior management approval, and quarterly reviews.\n\n**Q8: What is the UBO threshold?**\n\nPer **CR 134/2025, Art. 10**, any individual who ultimately owns or controls **25% or more** of a legal entity must be identified as an Ultimate Beneficial Owner. The UBO cascade rule requires tracing ownership through all intermediate entities until natural persons are identified.\n\n**Q9: How often should PEP screening be conducted?**\n\nPEP screening is conducted at **onboarding** and during **periodic reviews** (annual for standard risk, semi-annual for high risk). Additionally, PEP status is re-screened whenever there is a **trigger event** such as a change in senior public position or adverse media alert.\n\n**Q10: How frequently are KYC reviews required?**\n\n- **Standard Risk**: Annual review (every 12 months)\n- **High Risk**: Semi-annual review (every 6 months)\n- **PEP**: Semi-annual review with PEP re-screening\n- **Trigger Events**: Immediate review regardless of scheduled date",
        tags: ["faq", "kyc", "cdd", "edd", "ubo", "pep", "review"],
      },
      {
        id: "faq-sanctions",
        title: "Sanctions & Screening (Q11–Q15)",
        content:
          "**Q11: Which sanctions lists are screened?**\n\nConvertEase screens against **8 global lists**: OFAC (US), EU Consolidated List, UN Security Council, FATF Black/Grey Lists, HMT (UK), DFAT (Australia), MAS (Singapore), and SSI (Sectoral Sanctions). All lists are updated within 24 hours of official publication.\n\n**Q12: Can I upload a batch of names for screening?**\n\nYes. The Sanctions Screening module supports **batch upload** in CSV, XLSX, and JSON formats. Up to **10,000 records** can be screened per batch with progress tracking and results export.\n\n**Q13: What match threshold should I use?**\n\nRecommended thresholds:\n- **85%** — Standard screening (balances accuracy and coverage)\n- **70%** — Enhanced review (catches partial matches, higher false positive rate)\n- **95%** — Quick clearance (only near-exact matches, may miss aliases)\n- The threshold is adjustable via the **Match Threshold Slider** (10–100%).\n\n**Q14: How do I handle false positives?**\n\nWhen a match is identified, use the **side-by-side comparison** tool to evaluate the match. If the result relates to a different person/entity, classify it as **FALSE POSITIVE** with a documented justification. The classification is logged in the audit trail and the record is excluded from future alerts unless details change.\n\n**Q15: Is real-time screening available?**\n\nYes. ConvertEase supports **real-time screening** for individual names during the onboarding workflow. Batch screening is used for periodic re-screening and bulk operations. Real-time screening returns results within **2 seconds** for a single name across all 8 lists.",
        tags: ["faq", "sanctions", "screening", "ofac", "batch", "threshold", "false-positive"],
      },
      {
        id: "faq-sar",
        title: "SAR/STR (Q16–Q20)",
        content:
          "**Q16: What is the difference between SAR and STR?**\n\n- **SAR** (Suspicious Activity Report) — Filed when there is **knowledge or suspicion** of money laundering or terrorist financing based on activity patterns\n- **STR** (Suspicious Transaction Report) — Filed when a **specific transaction** appears suspicious\n\nBoth follow the same 6-stage pipeline and goAML submission process in ConvertEase.\n\n**Q17: What is the SAR/STR filing deadline?**\n\nSARs/STRs must be filed within **7 business days** of the date the suspicion was formed or confirmed. The deadline is tracked automatically in ConvertEase with escalation alerts at 80% of the deadline.\n\n**Q18: What is the CTR threshold?**\n\n**Cash Transaction Reports (CTRs)** are automatically triggered for cash transactions of **≥ AED 55,000** (or equivalent in other currencies). The CTR is generated and queued for filing regardless of suspicion level.\n\n**Q19: What makes a good SAR narrative?**\n\nA quality SAR narrative should be:\n- **Clear** — Written in plain language without jargon\n- **Concise** — Focused on relevant facts without unnecessary detail\n- **Complete** — Covers who, what, when, where, why, and how\n- **Factual** — Based on evidence, not speculation\n- **Structured** — Follows the ConvertEase Narrative Builder template\n\nCommon deficiencies: vague descriptions, missing transaction details, unsupported conclusions.\n\n**Q20: What is goAML XML?**\n\n**goAML XML** is the standardized data format required by the **UAE FIU** for submitting SARs, STRs, CTRs, IFTs, and PNMRs. ConvertEase generates the XML automatically based on the filing data and provides a **real-time XML preview** before submission. The XML complies with **goAML v4.2 schema**.",
        tags: ["faq", "sar", "str", "ctr", "goaml", "xml", "filing", "narrative"],
      },
      {
        id: "faq-ai",
        title: "AI & Technology (Q21–Q25)",
        content:
          "**Q21: What AI services power the assistant?**\n\nThe AI Agent is powered by a set of backend AI services served through the platform's secure inference layer (z-ai-web-dev-sdk) with UAE data residency:\n- **Compliance Chat** — General conversation and user guidance\n- **Compliance Reasoning** — AML/CFT compliance expertise\n- **Document Analysis** — Document reading and OCR\n- **Retrieval Index** — Memory, embeddings, and knowledge retrieval\n- **Structured Output** — Structured data extraction and XML generation\n\nNo on-premise LLM infrastructure is required; all inference is provided by the backend AI service portfolio.\n\n**Q22: How does context-aware chat work?**\n\nThe AI Agent automatically detects the user's current module and activity, routing queries to the most appropriate service. For example, if you're on the goAML Filing page, compliance queries are routed to Compliance Reasoning, and document analysis to Document Analysis. The system also considers conversation history for multi-turn context.\n\n**Q23: Can the AI work offline?**\n\nNo. The AI Agent requires a connection to the backend AI service. However, all other platform features (KYC, screening, filing) function independently of the AI module and are not affected by AI service interruptions.\n\n**Q24: How does the AI handle data privacy?**\n\nAll AI processing occurs within **UAE data residency** boundaries. No customer PII is transmitted to external APIs. Conversation logs are retained per PDPL retention requirements, and users can delete their AI conversation history. AI access is controlled through the same RBAC permissions as the rest of the platform.\n\n**Q25: What knowledge base does the AI use?**\n\nThe AI draws from multiple sources:\n- UAE regulatory framework (FDL 10/2025, CR 134/2025, etc.)\n- Internal policies and SOPs\n- Historical compliance decisions (anonymized)\n- CBUAE guidance and circulars\n- FATF recommendations\n- Industry best practices\n\nThe knowledge base is updated quarterly or when new regulations are published.",
        tags: ["faq", "ai", "privacy", "knowledge-base", "context-aware"],
      },
      {
        id: "faq-reporting",
        title: "Reporting & Analytics (Q26–Q30)",
        content:
          "**Q26: What analytics are available?**\n\nConvertEase provides analytics across all modules:\n- **Command Center**: 6 KRI cards, compliance metrics, activity feed\n- **Transaction Monitoring**: Bar, line, pie charts, and heatmap\n- **Risk Assessment**: 5×5 risk matrix, donut chart breakdown\n- **CBUAE Quarterly Reporting**: 4 analytics charts with dual view\n- **Training**: Progress bars, completion rates, certification tracker\n- **QA**: Score distributions, trend analysis, department comparisons\n\n**Q27: How does quarterly reporting work?**\n\nThe CBUAE Quarterly Reporting module follows a 4-stage workflow:\n1. **PROCESSING** — Data uploaded via Excel template\n2. **VALIDATED** — Auto-validation against CBUAE schema passes\n3. **READY** — MLRO approves the report for submission\n4. **SUBMITTED** — Report filed with CBUAE\n\nA dual dashboard provides a full data Management View and a PII-masked CBUAE Regulatory View.\n\n**Q28: How is PII masked in reports?**\n\nIn the **CBUAE Regulatory View**, personal identifiable information is automatically masked per PDPL data minimization principles:\n- Names partially masked (e.g., F**** A-Z******)\n- Emirates ID numbers masked except last 4 digits\n- Addresses aggregated to Emirate level\n- Financial figures aggregated where individual identification is possible\n\nFull PII is only visible in the Management View with appropriate access permissions.\n\n**Q29: Can I create custom reports?**\n\nYes. ConvertEase supports custom report creation with:\n- Flexible date range selection\n- Multi-module data combination\n- Customizable columns and filters\n- Chart type selection (bar, line, pie, table)\n- Saved report templates for recurring needs\n\nCustom reports can be scheduled for automatic generation and distribution.\n\n**Q30: What export formats are available?**\n\nConvertEase supports export in:\n- **PDF** — Formatted reports with branding\n- **Excel (XLSX)** — Raw data with formatting\n- **CSV** — Flat data for analysis\n- **goAML XML** — Regulatory filing format\n- **JSON** — API-compatible data format\n\nAll exports include generation timestamp and user attribution in the audit trail.",
        tags: ["faq", "reporting", "analytics", "pii-masking", "export", "custom-reports"],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // Section 8: Technical Reference
  // ──────────────────────────────────────────────
  {
    id: "technical",
    title: "Technical Reference",
    icon: "Code",
    subsections: [
      {
        id: "technical-requirements",
        title: "8.1 System Requirements",
        content:
          "**Server Requirements**\n\n| Component | Minimum | Recommended |\n|---|---|---|\n| CPU | 8 cores | 16 cores |\n| RAM | 32 GB | 64 GB |\n| Storage | 500 GB SSD | 1 TB NVMe SSD |\n| GPU | NVIDIA (for AI) | NVIDIA A100 or equivalent |\n| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |\n| Docker | 24.0+ | 24.0+ |\n| Network | 100 Mbps | 1 Gbps |\n\n**Client Requirements**\n\n| Component | Minimum | Recommended |\n|---|---|---|\n| Browser | Chrome 120+ | Chrome 120+ (latest) |\n| Screen Resolution | 1920×1080 | 2560×1440 |\n| Internet Speed | 10 Mbps | 50 Mbps |\n| RAM | 8 GB | 16 GB |\n\n**Supported Browsers**\n\n- ✅ Chrome 120+ (recommended)\n- ✅ Edge 120+ (Chromium-based)\n- ⚠️ Firefox 120+ (partial support)\n- ⚠️ Safari 17+ (partial support)\n- ❌ Internet Explorer (not supported)\n\n**Network Requirements**\n\n- Outbound HTTPS (443) for API communications\n- WebSocket support for real-time features\n- No inbound ports required\n- UAE data center connectivity for AI services",
        tags: ["technical", "requirements", "server", "client", "browser", "infrastructure"],
      },
      {
        id: "technical-database",
        title: "8.2 Database Schema",
        content:
          "**Key Prisma Models**\n\n**User Model**\n```\nUser {\n  id          String    @id @default(cuid())\n  email       String    @unique\n  name        String\n  role        Role      @default(VIEWER)\n  department  String?\n  isActive    Boolean   @default(true)\n  lastLogin   DateTime?\n  createdAt   DateTime  @default(now())\n  updatedAt   DateTime  @updatedAt\n}\n```\n\n**Regulation Model**\n```\nRegulation {\n  id          String   @id @default(cuid())\n  article     String\n  title       String\n  description String\n  category    String\n  isActive    Boolean  @default(true)\n  createdAt   DateTime @default(now())\n  updatedAt   DateTime @updatedAt\n}\n```\n\n**AuditLog Model**\n```\nAuditLog {\n  id          String   @id @default(cuid())\n  userId      String\n  action      String\n  module      String\n  details     String?\n  ipAddress   String?\n  createdAt   DateTime @default(now())\n}\n```\n\n**CorporateKYC Model**\n```\nCorporateKYC {\n  id               String   @id @default(cuid())\n  legalName        String\n  tradeName        String?\n  licenseNumber    String\n  riskScore        Int      @default(0)\n  riskRating       String   @default(\"LOW\")\n  uboIdentified    Boolean  @default(false)\n  status           String   @default(\"DRAFT\")\n  createdAt        DateTime @default(now())\n  updatedAt        DateTime @updatedAt\n}\n```\n\n**IndividualKYC Model**\n```\nIndividualKYC {\n  id               String   @id @default(cuid())\n  fullName         String\n  emiratesId       String   @unique\n  nationality      String\n  riskRating       String   @default(\"STANDARD\")\n  pepStatus        Boolean  @default(false)\n  status           String   @default(\"DRAFT\")\n  nextReviewDate   DateTime?\n  createdAt        DateTime @default(now())\n  updatedAt        DateTime @updatedAt\n}\n```\n\n**GoAMLFiling Model**\n```\nGoAMLFiling {\n  id            String   @id @default(cuid())\n  reportType    String   // SAR, STR, CTR, IFT, PNMR\n  stage         String   @default(\"DETECTED\")\n  subjectId     String\n  narrative     String?\n  filedDate     DateTime?\n  acknowledgedDate DateTime?\n  createdAt     DateTime @default(now())\n  updatedAt     DateTime @updatedAt\n}\n```\n\n**MakerCheckerLog Model**\n```\nMakerCheckerLog {\n  id           String   @id @default(cuid())\n  entityType   String\n  entityId     String\n  makerId      String\n  checkerId    String?\n  action       String\n  status       String   @default(\"PENDING\")\n  comments     String?\n  createdAt    DateTime @default(now())\n  updatedAt    DateTime @updatedAt\n}\n```\n\n**AIChatSession Model**\n```\nAIChatSession {\n  id          String   @id @default(cuid())\n  userId      String\n  context     String?\n  brainUsed   String?\n  createdAt   DateTime @default(now())\n  updatedAt   DateTime @updatedAt\n}\n```\n\n**QuarterlyReport Model**\n```\nQuarterlyReport {\n  id          String   @id @default(cuid())\n  quarter     String\n  year        Int\n  status      String   @default(\"PROCESSING\")\n  data        String   // JSON string\n  submittedBy String?\n  submittedAt DateTime?\n  createdAt   DateTime @default(now())\n  updatedAt   DateTime @updatedAt\n}\n```",
        tags: ["database", "schema", "prisma", "models", "data-structure"],
      },
      {
        id: "technical-api",
        title: "8.3 API Reference",
        content:
          "**Base URL**: `/api`\n\n**Authentication**: All endpoints require a **Bearer JWT** token in the Authorization header:\n```\nAuthorization: Bearer <token>\n```\n\n**Common Response Format**:\n```json\n{\n  \"success\": true,\n  \"data\": { ... },\n  \"error\": null\n}\n```\n\n**Key Endpoints**\n\n**Dashboard**\n```\nGET /api/dashboard\nResponse: { kpis: [...], metrics: {...}, activityFeed: [...] }\n```\n\n**KYC Operations**\n```\nGET  /api/kyc                    // List all KYC records\nGET  /api/kyc?id=<id>            // Get specific record\nPOST /api/kyc                    // Create new record\nPUT  /api/kyc?id=<id>            // Update record\n```\n\n**Sanctions Screening**\n```\nPOST /api/aml                    // Screen individual name\nPOST /api/aml?batch=true         // Batch upload screening\nResponse: { results: [...], matches: [...], stats: {...} }\n```\n\n**goAML Filing**\n```\nGET  /api/goaml                  // List filings\nPOST /api/goaml                  // Create new filing\nPUT  /api/goaml?id=<id>          // Update filing stage\nGET  /api/goaml?xml=<id>         // Preview XML output\n```\n\n**AI Chat**\n```\nPOST /api/ai/chat\nBody: { message: string, sessionId?: string, context?: string }\nResponse: { reply: string, brain: string, sessionId: string }\n```\n\n**Quarterly Reporting**\n```\nGET  /api/quarterly-reporting              // List reports\nPOST /api/quarterly-reporting              // Upload new report\nPUT  /api/quarterly-reporting?id=<id>      // Update status\n```\n\n**Error Codes**\n\n| Code | Meaning |\n|---|---|\n| 400 | Bad Request — Invalid parameters |\n| 401 | Unauthorized — Missing or invalid token |\n| 403 | Forbidden — Insufficient permissions |\n| 404 | Not Found — Resource does not exist |\n| 422 | Validation Error — Data validation failed |\n| 500 | Internal Server Error |",
        tags: ["api", "reference", "endpoints", "rest", "authentication", "jwt"],
      },
      {
        id: "technical-security",
        title: "8.4 Security Features",
        content:
          "**Encryption**\n\n- **At Rest**: AES-256 encryption for all stored data\n- **In Transit**: TLS 1.3 for all network communications\n- **Key Management**: Hardware Security Module (HSM) for encryption key storage\n- **Password Hashing**: bcrypt with cost factor 12\n\n**Role-Based Access Control (RBAC)**\n\n| Role | Access Level | Key Permissions |\n|---|---|---|\n| `Viewer` | Read-only | View dashboards, reports |\n| `Analyst` | Operational | KYC entry, screening, alerts |\n| `Officer` | Full operations | SAR drafting, policy edits |\n| `MLRO` | Approval authority | SAR approval, goAML filing |\n| `Admin` | Full control | User management, configuration |\n\n**Audit Logging**\n\n- Every data access, modification, and deletion is logged\n- Logs include: timestamp, user ID, action, affected entity, IP address\n- Logs are immutable and cannot be edited or deleted\n- Retention: 5 years minimum per CR 134/2025, Art. 12\n- Real-time alerting for suspicious access patterns\n\n**Data Backup**\n\n| Parameter | Value |\n|---|---|\n| Backup Type | Daily incremental, weekly full |\n| Retention | 90 days |\n| RPO (Recovery Point Objective) | 24 hours |\n| RTO (Recovery Time Objective) | 4 hours |\n| Backup Location | UAE data center (secondary site) |\n| Encryption | AES-256 encrypted backups |\n\n**Additional Security Controls**\n\n- **Session Management**: 30-minute idle timeout, 8-hour maximum session\n- **Failed Login Lockout**: 5 attempts, 30-minute lockout\n- **MFA Support**: Available for MLRO and Admin roles\n- **IP Whitelisting**: Configurable per institution\n- **API Rate Limiting**: 100 requests/minute per user",
        tags: ["security", "encryption", "rbac", "audit", "backup", "access-control"],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // Section 9: Compliance & Regulatory Alignment
  // ──────────────────────────────────────────────
  {
    id: "regulatory",
    title: "Compliance & Regulatory Alignment",
    icon: "Scale",
    subsections: [
      {
        id: "regulatory-framework",
        title: "9.1 UAE Regulatory Framework",
        content:
          "ConvertEase is designed to comply with the following **UAE regulatory instruments**:\n\n**Primary Legislation**\n\n- **FDL 10/2025** — Federal Decree-Law on Anti-Money Laundering, Combating the Financing of Terrorism, and Financing of Illegal Organizations\n- **CR 134/2025** — Cabinet Resolution implementing the AML/CFT law with detailed requirements for financial institutions\n- **FDL 48/2023** — Federal Decree-Law on Insurance regulation (applicable to insurance sector users)\n- **FDL 6/2025** — Federal Decree-Law amendments to AML/CFT provisions\n\n**Regulatory Bodies**\n\n- **CBUAE** — Central Bank of the UAE: Primary regulator for banks, exchange houses, and finance companies\n- **SCA** — Securities and Commodities Authority: Regulator for securities and investment firms\n- **IA** — Insurance Authority: Regulator for insurance companies (merged into CBUAE in some areas)\n- **UAE FIU** — Financial Intelligence Unit: Receives and processes SARs, STRs, CTRs, and IFTs via goAML\n\n**International Standards**\n\n- **FATF 40 Recommendations** — Global AML/CFT standard\n- **FATF Mutual Evaluation** — UAE assessment results and action items\n- **EAG (Eurasian Group)** — Regional AML/CFT body participation\n- **MENAFATF** — Middle East & North Africa Financial Action Task Force\n\n**ConvertEase Alignment**\n\nAll platform features are mapped to specific regulatory requirements, ensuring that every compliance action has a documented legal basis. The compliance mapping is regularly updated to reflect regulatory changes and CBUAE guidance.",
        tags: ["regulatory", "uae", "cbuae", "fdl", "cr-134", "fatf", "fiu"],
      },
      {
        id: "regulatory-mapping",
        title: "9.2 ConvertEase Compliance Mapping",
        content:
          "**CR 134/2025 Articles mapped to ConvertEase features:**\n\n**Article 8 — Customer Due Diligence (CDD)**\n→ **KYC Wizards** — Individual (5-step) and Corporate (6-step) onboarding with all mandatory fields aligned to Art. 8 requirements\n\n**Article 9 — Enhanced Due Diligence (EDD)**\n→ **High-Risk Flagging** — Automatic EDD trigger when 11-factor risk score ≥60, with semi-annual reviews, MLRO oversight, and senior management approval\n\n**Article 10 — Ultimate Beneficial Owner (UBO)**\n→ **UBO Cascade Rule** — Ownership tracing through all intermediate entities until natural persons with ≥25% ownership are identified. Complex ownership structures visualized and documented.\n\n**Article 11 — Ongoing Monitoring**\n→ **Transaction Monitoring Module** — Real-time surveillance with 4 alert types (structuring, rapid movement, unusual cross-border, dormant activation) and analytics dashboard\n\n**Article 12 — Record Keeping**\n→ **Audit Trail Module** — 8 automated trigger rules, immutable logging with 5-year retention, complete audit trail for regulatory examination\n\n**Article 13 — Suspicious Transaction Reporting**\n→ **SAR/STR Filing Module** — 6-stage pipeline from detection to closure, narrative builder, risk indicators, goAML XML generation, Maker-Checker approval workflow\n\n**Article 14 — Sanctions Compliance**\n→ **Sanctions Screening Module** — 8 global lists screened, batch upload capability, match threshold configuration, side-by-side comparison, confidence scoring\n\n**Article 15 — Politically Exposed Persons (PEP)**\n→ **PEP Self-Declaration + Screening** — PEP status captured during onboarding, automated PEP screening at onboarding and periodic reviews, senior management approval for PEP relationships\n\n**Article 16 — Risk Assessment**\n→ **5×5 Risk Matrix** — Multi-factor risk assessment across 5 categories (Customer, Product, Geographic, Channel, Sector) with heatmap visualization and donut chart breakdown\n\n**Article 17 — Training & Awareness**\n→ **Training Module** — 8 mandatory courses with assessment tracking, certification management, training calendar, overdue alerts, and effectiveness metrics",
        tags: ["compliance", "mapping", "cr-134", "articles", "cdd", "edd", "ubo", "sar"],
      },
      {
        id: "regulatory-goaml",
        title: "9.3 goAML Reporting",
        content:
          "**Report Types**\n\n| Type | Full Name | Threshold |\n|---|---|---|\n| **SAR** | Suspicious Activity Report | Suspicion-based (no threshold) |\n| **STR** | Suspicious Transaction Report | Suspicion-based (no threshold) |\n| **CTR** | Cash Transaction Report | ≥ AED 55,000 |\n| **IFT** | International Funds Transfer | ≥ AED 3,500 |\n| **PNMR** | Partial Name Match Report | Partial match identified |\n\n**XML Schema Compliance**\n\n- All filings comply with **goAML v4.2** XML schema\n- Real-time XML preview before submission\n- Schema validation against UAE FIU requirements\n- Automatic field mapping from ConvertEase data to goAML format\n\n**7-Step Submission Workflow**\n\n1. **Prepare** — Analyst collects evidence and drafts the report narrative\n2. **Review** — Second analyst reviews for accuracy and completeness\n3. **MLRO Approve** — MLRO reviews and approves the filing decision\n4. **Generate XML** — goAML XML is generated and validated against schema\n5. **Submit** — XML submitted to UAE FIU via goAML system\n6. **Acknowledge** — FIU acknowledges receipt (automatically tracked)\n7. **Close** — Case is closed with final disposition documented\n\n**Filing Requirements**\n\n- **SAR/STR**: Within 7 business days of suspicion formation\n- **CTR**: Within 5 business days of the transaction\n- **IFT**: Within 5 business days of the transfer\n- **PNMR**: Within 3 business days of match identification\n- All filings require Maker-Checker approval before submission\n- No tipping off: Subject must not be informed of the filing",
        tags: ["goaml", "reporting", "xml", "sar", "str", "ctr", "ift", "fiu"],
      },
      {
        id: "regulatory-pdpl",
        title: "9.4 PDPL Compliance",
        content:
          "ConvertEase is fully compliant with the **UAE Personal Data Protection Law (PDPL)**, adhering to the following **6 principles**:\n\n**1. Lawfulness**\n\n- Data processing is based on legitimate legal grounds (regulatory compliance, contractual necessity, consent)\n- All data collection has a documented legal basis\n- Data subject rights supported: access, correction, deletion, objection\n\n**2. Data Minimization**\n\n- Only data required for compliance purposes is collected\n- PII masking in CBUAE Regulatory View (names, IDs, addresses)\n- Automated data retention policies with scheduled deletion\n- Regular data audits to identify and remove unnecessary data\n\n**3. Accuracy**\n\n- Data validated at entry point with automated checks\n- Regular data quality reviews as part of QA program\n- Data subject right to correction implemented\n- Audit trail for all data modifications\n\n**4. Storage Limitation**\n\n- **5-year retention** period per CR 134/2025, Art. 12\n- Automated retention policy enforcement\n- Secure data disposal after retention period\n- Retention extensions only with documented legal justification\n\n**5. Integrity & Confidentiality**\n\n- **AES-256** encryption at rest\n- **TLS 1.3** encryption in transit\n- **RBAC** with 5 permission levels\n- **Audit logging** for all data access\n- Regular security assessments and penetration testing\n\n**6. Accountability**\n\n- **Data Protection Officer (DPO)** designated\n- **Data Protection Impact Assessment (DPIA)** conducted\n- **72-hour breach notification** to UAEDPC and affected individuals\n- Regular compliance reporting to the Data Protection Committee\n- Annual PDPL compliance audit scheduled",
        tags: ["pdpl", "data-protection", "privacy", "encryption", "retention", "dpo"],
      },
      {
        id: "regulatory-readiness",
        title: "9.5 Regulatory Examination Readiness",
        content:
          "ConvertEase provides **instant access** to all information required for regulatory examinations by CBUAE, SCA, or external auditors:\n\n**Instant Access to Records**\n\n- Complete customer KYC files with all supporting documents\n- Sanctions screening results with match/disposition records\n- SAR/STR filing history with narratives and goAML submission confirmations\n- Transaction monitoring alert history with analyst decisions\n- Audit trail logs with full user attribution\n\n**Compliance Metrics**\n\n- Real-time compliance score and trend analysis\n- KYC review completion rates and overdue statistics\n- SAR filing timeliness (7-day SLA tracking)\n- Training completion rates and certification status\n- QA scores and improvement trends\n\n**Policy Documentation**\n\n- All current policies and SOPs accessible through the Policies module\n- Version history with approval records (Maker-Checker)\n- Evidence of policy dissemination and staff acknowledgment\n- Regulatory mapping document (CR 134/2025 Articles → platform features)\n\n**Evidence of Controls**\n\n- Maker-Checker approval logs for all critical operations\n- RBAC configuration evidence with role-permission mapping\n- Audit trail demonstrating active monitoring and oversight\n- QA review records with scoring methodology and findings\n- Training records with assessment scores and certification tracking\n\n**Reporting Capabilities**\n\n- Pre-configured examination report templates\n- Custom report generation for specific examiner requests\n- CBUAE Quarterly Reporting with dual-view (Management + Regulatory)\n- Export in PDF, Excel, CSV, and goAML XML formats\n- Automated regulatory filing confirmation records",
        tags: ["examination", "readiness", "cbuae", "audit", "compliance", "regulatory", "inspection"],
      },
    ],
  },
  // ──────────────────────────────────────────────
  // Section 11: Best Practices Library (Phase 10)
  // ──────────────────────────────────────────────
  {
    id: "best-practices",
    title: "Best Practices Library",
    icon: "BookOpen",
    subsections: [
      {
        id: "bp-vendor-dd",
        title: "11.1 Third-Party Vendor Due Diligence",
        content:
          "**Per CBUAE TPRM Guidelines and FDL 10/2025 Art. 7, 9**\n\nAll third-party vendors providing services to the institution must undergo risk-based due diligence before engagement and throughout the relationship lifecycle.\n\n**Vendor Onboarding Best Practices**\n\n1. **Pre-engagement Screening** — Screen all vendors against sanctions lists, PEP databases, and adverse media before signing contracts\n2. **Risk Classification** — Classify vendors as Low/Medium/High/Critical based on service type, data access, and geographic risk\n3. **Data Processing Agreements** — Execute DPAs with all vendors processing personal data per PDPL requirements\n4. **Contract Review** — Ensure compliance clauses are embedded in all vendor contracts\n5. **Ongoing Monitoring** — Schedule periodic reviews based on risk rating (quarterly for high, annual for low)\n\n**Enhanced Due Diligence (EDD) Triggers**\n\n- Vendor is classified as High or Critical risk\n- Vendor operates in high-risk jurisdictions\n- Vendor handles sensitive personal data\n- Vendor has adverse media or sanctions hits\n- Vendor ownership structure involves PEPs or complex chains\n\n**Key Metrics to Track**\n\n- DPA completion rate (target: 100%)\n- Average time to complete EDD\n- Vendor risk rating changes over time\n- Contract expiry and renewal rates\n- Audit finding remediation rates\n\nUse the **Vendor Risk Management** module (sidebar → Enterprise → Vendor Risk) to manage the full vendor lifecycle.",
        tags: ["vendor", "dd", "edd", "tprm", "third-party", "due-diligence", "dpa"],
      },
      {
        id: "bp-bcp-drp",
        title: "11.2 Business Continuity & Disaster Recovery",
        content:
          "**Per CBUAE Resiliency Guidelines, ISO 22301, FDL 10/2025 Art. 15**\n\nFinancial institutions must maintain documented BCP/DRP plans with regular testing and clear escalation procedures.\n\n**BCP/DRP Best Practices**\n\n1. **Plan Coverage** — Maintain BCP for all critical business functions and DRP for all critical IT systems\n2. **RTO/RPO Targets** — Define and document Recovery Time Objectives and Recovery Point Objectives for each plan\n3. **Testing Schedule** — Test BCP/DRP plans at least semi-annually; quarterly for critical systems\n4. **Incident Response** — Maintain a 24/7 incident response capability with clear escalation paths\n5. **Documentation** — Keep all plans version-controlled with clear ownership and review dates\n6. **Communication** — Establish crisis communication protocols for internal and external stakeholders\n\n**Common Gaps to Avoid**\n\n- Plans not tested within the last 12 months\n- RTO/RPO targets not defined or not aligned with business impact analysis\n- No documented escalation procedures for incidents\n- Plans not updated after organizational changes\n- Staff not trained on their roles during BCP activation\n\nUse the **Resiliency Hub** module (sidebar → Enterprise → Resiliency Hub) to manage BCP/DRP plans and report incidents.",
        tags: ["bcp", "drp", "business-continuity", "disaster-recovery", "incident", "rto", "rpo"],
      },
      {
        id: "bp-sar-filing",
        title: "11.3 SAR Filing Workflow Excellence",
        content:
          "**Per FDL 10/2025 Art. 8, 13-14; CR 134/2025 Art. 10-11**\n\nSuspicious Activity Reports must be filed within 7 business days of suspicion formation. The quality and timeliness of SAR filings directly impact the institution's regulatory standing.\n\n**SAR Filing Best Practices**\n\n1. **Timely Filing** — File within 7 business days of suspicion formation; use the 30-day auto-escalation feature\n2. **Narrative Quality** — Write clear, factual narratives that cover: who, what, when, where, why, and how\n3. **Evidence Preservation** — Attach all supporting evidence before submission\n4. **Maker-Checker** — Never bypass the 4-eyes principle; the drafter cannot be the approver\n5. **No Tipping Off** — Never inform the subject of a SAR filing\n6. **Record Keeping** — Maintain complete records for 5 years per CR 134/2025 Art. 12\n\n**Common SAR Narrative Mistakes**\n\n- Too vague: 'Customer engaged in suspicious transactions'\n- Missing timeline: No specific dates and transaction references\n- No rationale: Doesn't explain why the activity is suspicious\n- Over-conclusion: States criminal liability rather than describing observable facts\n- Missing AED amounts and transaction patterns\n\nUse the **AI Assistant** to help draft SAR narratives with proper structure and regulatory language.",
        tags: ["sar", "str", "filing", "goaml", "narrative", "mlro", "fiu"],
      },
    ],
  },
  // ──────────────────────────────────────────────
  // Section 12: FAQ (Phase 10)
  // ──────────────────────────────────────────────
  {
    id: "faq-phase10",
    title: "Frequently Asked Questions",
    icon: "HelpCircle",
    subsections: [
      {
        id: "faq-phase10-general",
        content:
          "**Q: What is IC-OS?**\nA: IC-OS (Insurance Compliance Operating System) is an enterprise-grade UAE AML/CFT compliance platform purpose-built for insurance and financial institutions, covering KYC, sanctions screening, SAR filing, regulatory reporting, and more.\n\n**Q: Which UAE regulations does IC-OS comply with?**\nA: IC-OS is designed to comply with FDL 10/2025 (Federal Decree-Law on AML/CFT), CBUAE Notice 3551/2021, CR 134/2025 (Cabinet Resolution), and the UAE PDPL (Personal Data Protection Law).\n\n**Q: Is my data stored within the UAE?**\nA: Yes, all data is stored within UAE borders in full compliance with PDPL data residency requirements.\n\n**Q: What AI capabilities does IC-OS have?**\nA: IC-OS features a RAG-powered AI assistant grounded in 122 battle-tested operational scenarios across 11 compliance packs. It provides zero-hallucination guidance by referencing only verified scenario data.\n\n**Q: How do I switch between jurisdictions?**\nA: Use the jurisdiction selector in the Command Center or TopBar to switch between CBUAE, DFSA, and FSRA regulatory contexts.\n\n**Q: What is the 'Section Guide' I see at the top of each module?**\nA: The Section Guide is a collapsible card that shows your role-specific responsibilities, data flow, regulatory references, and tips. Click it to expand and use the 'Ask AI Assistant' button for contextual help.",
        tags: ["faq", "general", "overview", "regulations", "data-residency", "ai"],
      },
      {
        id: "faq-phase10-compliance",
        content:
          "**Q: How quickly must I file a SAR?**\nA: Per FDL 10/2025, SARs must be filed within 7 business days of suspicion formation. IC-OS auto-escalates at 25 days to the MLRO and at 28 days to Head of Compliance.\n\n**Q: What is the Maker-Checker principle?**\nA: Critical compliance operations require dual approval — the person who creates/initiates (Maker) cannot be the same person who approves (Checker). This is also known as the 4-eyes principle.\n\n**Q: What is EDD and when is it required?**\nA: Enhanced Due Diligence (EDD) is required when dealing with high-risk customers, PEPs, vendors in high-risk jurisdictions, or any entity flagged by screening. EDD includes obtaining senior management approval, establishing source of funds/wealth, and ongoing enhanced monitoring.\n\n**Q: What happens if I don't complete my training on time?**\nA: Overdue training is flagged in the Training module and reported to compliance management. CBUAE requires annual AML/CFT training for all staff.\n\n**Q: How do I report a security incident?**\nA: Navigate to the Resiliency Hub (sidebar → Enterprise → Resiliency Hub) and click 'Report Incident'. This creates a high-priority ComplianceCase tagged as INCIDENT_RESPONSE.\n\n**Q: Can I override a sanctions match?**\nA: Yes, but only with MLRO approval via Maker-Checker. All overrides are logged in the immutable audit trail.",
        tags: ["faq", "compliance", "sar", "maker-checker", "edd", "training", "sanctions"],
      },
      {
        id: "faq-phase10-technical",
        content:
          "**Q: Is my data encrypted?**\nA: Yes. All data is encrypted at rest using AES-256 and in transit using TLS 1.3.\n\n**Q: How are audit trails protected?**\nA: Every compliance action creates an immutable audit log entry with SHA-256 hashing. Logs cannot be modified or deleted.\n\n**Q: What is PII masking?**\nA: PII masking automatically redacts sensitive personal information (names, IDs, addresses) in regulatory views and reports based on the user's role.\n\n**Q: How do rate limits work?**\nA: Rate limits are applied per user ID (not IP address) with tiered limits: 100/min for GET requests, 30/min for writes, and 5-10/min for AI/bulk operations.\n\n**Q: Can I access IC-OS on mobile?**\nA: Yes, the platform is fully responsive. The sidebar auto-collapses on mobile, and all data tables adapt to smaller screens.\n\n**Q: How do I get help?**\nA: Use the Help & Docs module (sidebar → Help), click 'Ask AI Assistant' in any Section Guide, or press Ctrl+K to open the Command Palette for quick navigation.",
        tags: ["faq", "technical", "security", "encryption", "audit", "pii", "rate-limit", "mobile"],
      },
    ],
  },
];

// ──────────────────────────────────────────────
// Section 10: Roles & Responsibilities Guide (NEW)
// ──────────────────────────────────────────────
export const ROLES_RESPONSIBILITIES_SECTION: HelpSection = {
  id: "roles-responsibilities",
  title: "Roles & Responsibilities Guide",
  icon: "Users",
  subsections: [
    {
      id: "roles-overview",
      title: "10.1 Role Hierarchy & Permissions",
      content:
        "IC-OS implements a **6-role RBAC system** aligned with UAE regulatory requirements per FDL 10/2025 Art. 15 and CBUAE Notice 3551/2021 S3.1.\n\n**Role Hierarchy (highest to lowest privilege)**\n\n| Role | Level | Primary Function |\n|---|---|---|\n| **Admin** | 100 | System configuration, user management, security settings |\n| **MLRO** | 50 | SAR/STR approval, goAML filing, regulatory liaison |\n| **Compliance Manager** | 40 | Policy management, training, audit coordination |\n| **Compliance Officer** | 30 | Day-to-day operations, data entry, screening |\n| **Department Head** | 20 | Department compliance oversight, reporting |\n| **Board Member** | 10 | Strategic oversight, aggregated dashboard access |\n\n**Key Principles**\n\n- **Least Privilege**: Users only see modules and actions relevant to their role\n- **Maker-Checker**: Critical operations require dual approval (4-eyes principle)\n- **Audit Trail**: Every action is logged with user attribution and timestamp\n- **No Self-Approval**: Maker and Checker must be different individuals\n\n**Maker-Checker Required Operations**\n\n- SAR/STR Filing\n- goAML Submission\n- KYC Approval\n- User Management\n- Sanctions Override\n- CBUAE Report Submission\n\n**Each section of the platform displays a collapsible 'Section Guide' card** at the top, showing:\n- Who can do what in that section (role-specific actions)\n- How data flows through the section\n- Regulatory references\n- Tips for effective use",
      tags: ["roles", "rbac", "permissions", "hierarchy", "maker-checker", "least-privilege"],
    },
    {
      id: "role-admin",
      title: "10.2 System Administrator (Admin)",
      content:
        "**Role Level**: 100 (Highest)\n\n**Primary Responsibility**: Full system configuration and user management\n\n**Accessible Sections**\n\n- ✅ All modules with full read/write access\n- ✅ Admin Panel (exclusive) — User management, feature flags, system settings\n- ✅ My Profile — Personal settings and security\n\n**Key Actions**\n\n- Create, edit, and deactivate user accounts\n- Assign and modify user roles\n- Configure feature flags and system settings\n- Manage API rate limiting and security policies\n- Generate system-wide audit reports\n- Override sanctions screening matches (with Maker-Checker)\n- Emergency access to all data for regulatory examination support\n\n**Admin Panel** (sidebar → Account → Admin Panel)\n\nThe Admin Panel provides centralized management of:\n- **User Directory** — View, create, edit, and deactivate user accounts\n- **Role Assignments** — Assign compliance roles with permission validation\n- **Feature Flags** — Enable/disable platform features per deployment phase\n- **System Settings** — Configure rate limits, AI parameters, and notifications\n- **System Audit Log** — View comprehensive system activity log\n\n**Regulatory Reference**: FDL 10/2025 Art. 15; CBUAE Notice 3551/2021 S3.1\n\n**Important**: Admin operations involving user management require Maker-Checker approval per the 4-eyes principle.",
      tags: ["admin", "system-administrator", "user-management", "feature-flags", "configuration"],
    },
    {
      id: "role-mlro",
      title: "10.3 MLRO (Money Laundering Reporting Officer)",
      content:
        "**Role Level**: 50\n\n**Primary Responsibility**: SAR/STR filing decisions, goAML submissions, and regulatory liaison\n\n**Accessible Sections**\n\n- ✅ All compliance modules with approval authority\n- ✅ Admin Panel (view access) — System status and audit log review\n- ✅ My Profile — Personal settings and security\n\n**Key Actions**\n\n- **AML & Sanctions**: Approve/reject alerts, triage cases, escalate to regulators\n- **goAML Filing**: Approve and submit SAR/STR filings to UAE FIU\n- **Maker-Checker**: Review and approve/reject pending requests\n- **KYC**: Approve high-risk entities, override risk ratings\n- **Policies & SOPs**: Approve policy documents for publication\n- **Quarterly Reporting**: Sign off and submit CBUAE reports\n- **Sanctions**: Override screening matches (with Maker-Checker)\n\n**MLRO-Specific Workflows**\n\n1. **SAR Filing Flow**: Officer drafts → Manager reviews → MLRO approves → goAML submission\n2. **Alert Escalation**: Officer escalates → MLRO reviews → Decision (file SAR / close / request more info)\n3. **Policy Approval**: Manager submits → MLRO approves → Published\n4. **30-Day SAR Escalation**: Auto-escalated at 25 days to MLRO, 28 days to Head of Compliance\n\n**Regulatory Reference**: FDL 10/2025 Art. 8, 13-14; CR 134/2025 Art. 10-11\n\n**Critical Notes**:\n- SAR filing decisions must be made within 7 business days of suspicion formation\n- No tipping off — subjects must not be informed of SAR filings\n- MLRO cannot be both Maker and Checker on the same filing",
      tags: ["mlro", "sar", "goaml", "approval", "filing", "escalation"],
    },
    {
      id: "role-compliance-manager",
      title: "10.4 Compliance Manager",
      content:
        "**Role Level**: 40\n\n**Primary Responsibility**: Policy management, training coordination, and audit oversight\n\n**Accessible Sections**\n\n- ✅ All compliance modules with operational and some approval access\n- ✅ My Profile — Personal settings and security\n\n**Key Actions**\n\n- **Policies & SOPs**: Create, edit, and submit policies for MLRO approval\n- **Training & Certs**: Manage courses, enroll staff, track completion\n- **Compliance Audits**: Schedule audits, assign auditors, track remediation\n- **AML & Sanctions**: Investigate alerts, escalate to MLRO\n- **KYC**: Approve KYC records, review UBO structures\n- **Evidence War Room**: Upload, organize, and verify evidence\n- **Adverse Media**: Run screening, classify results, generate reports\n- **Maker-Checker**: Create requests as Maker, approve certain types as Checker\n\n**Data Entry Points**\n\nThe Compliance Manager is the primary **content creator** in the system:\n- Creates policy documents in Policies & SOPs\n- Sets up training courses and enrollment in Training & Certifications\n- Schedules and assigns compliance audits\n- Drafts SAR/STR narratives before MLRO approval\n- Manages adverse media screening sessions\n\n**Regulatory Reference**: FDL 10/2025 Art. 15; CR 134/2025 Art. 20",
      tags: ["compliance-manager", "policy", "training", "audit", "content-creator"],
    },
    {
      id: "role-compliance-officer",
      title: "10.5 Compliance Officer",
      content:
        "**Role Level**: 30\n\n**Primary Responsibility**: Day-to-day compliance operations, data entry, and screening\n\n**Accessible Sections**\n\n- ✅ Command Center, AML & Sanctions, Evidence War Room\n- ✅ CBUAE Tracker, Policies & SOPs (view only)\n- ✅ goAML Filing (view status, gather evidence)\n- ✅ Corporate KYC, Individual KYC (data entry)\n- ✅ Adverse Media (screening), Maker-Checker (maker only)\n- ✅ Training & Certs (enrollment and completion)\n- ✅ My Profile — Personal settings and security\n\n**Key Actions**\n\n- **KYC Wizards**: Enter customer data, upload documents, initiate screening\n- **Sanctions Screening**: Screen entities against global lists\n- **AML Alerts**: Triage and classify alerts, gather evidence for investigation\n- **Adverse Media**: Initiate screening sessions, flag items for review\n- **Maker-Checker**: Create requests (maker role), view own submissions\n- **Training**: Enroll in courses, complete assessments\n- **Evidence**: Upload and tag documents for inspection readiness\n\n**Data Entry Points**\n\nThe Compliance Officer is the primary **data entry operator**:\n- Enters individual and corporate KYC data\n- Uploads identity documents and supporting evidence\n- Initiates sanctions and adverse media screening\n- Creates SAR/STR draft narratives\n- Updates case status and investigation notes\n\n**Regulatory Reference**: FDL 10/2025 Art. 7-15; CR 134/2025 Art. 5-21",
      tags: ["compliance-officer", "data-entry", "screening", "kyc", "operations"],
    },
    {
      id: "role-dept-head",
      title: "10.6 Department Head",
      content:
        "**Role Level**: 20\n\n**Primary Responsibility**: Department compliance oversight and reporting to senior management\n\n**Accessible Sections**\n\n- ✅ Command Center (department view)\n- ✅ CBUAE Tracker (view compliance status)\n- ✅ Risk Matrix (view risk assessments)\n- ✅ Regulatory Intelligence (view circulars)\n- ✅ My Profile — Personal settings and security\n\n**Key Actions**\n\n- View department-level compliance metrics and KRI scores\n- Review regulatory circulars affecting their department\n- Access risk assessments and compliance audit findings\n- Receive compliance status reports for management reporting\n\n**Note**: Department Heads primarily have **view access** to monitor compliance posture. Operational actions are performed by Compliance Officers and Managers.\n\n**Regulatory Reference**: CBUAE Notice 3551/2021 S3.1",
      tags: ["dept-head", "department", "oversight", "reporting", "view-access"],
    },
    {
      id: "role-board",
      title: "10.7 Board Member",
      content:
        "**Role Level**: 10\n\n**Primary Responsibility**: Strategic oversight and governance\n\n**Accessible Sections**\n\n- ✅ Command Center (aggregated board-level dashboard)\n- ✅ CBUAE Tracker (overall compliance posture)\n- ✅ Risk Matrix (enterprise risk view)\n- ✅ My Profile — Personal settings and security\n\n**Key Actions**\n\n- View aggregated compliance score and trend analysis\n- Review enterprise-wide risk assessments\n- Monitor regulatory compliance posture\n- Access board-level compliance dashboards\n\n**Note**: Board Members have **restricted operational access** but full dashboard/analytics visibility per governance requirements. This ensures segregation of duties while maintaining oversight capability.\n\n**Regulatory Reference**: CBUAE Notice 3551/2021 S3.1 (Governance)",
      tags: ["board", "governance", "oversight", "strategic", "dashboard"],
    },
    {
      id: "section-guide-how-to",
      title: "10.8 How to Use Section Guides",
      content:
        "Every module in IC-OS displays a **collapsible Section Guide** card at the top of the page. This guide provides:\n\n**What You'll See**\n\n1. **Section Description** — Brief overview of what the module does\n2. **Who Can Do What** — Color-coded cards showing each role's specific actions in that section\n3. **How Data Flows** — Step-by-step flow showing how data enters, is processed, and exits the section\n4. **Regulatory Reference** — The specific UAE regulation that mandates this functionality\n5. **Tips** — Practical advice for using the section effectively\n\n**How to Use**\n\n1. Click the **Section Guide** banner at the top of any module to expand it\n2. Review the **role cards** to understand your permissions in that section\n3. Follow the **data flow** to understand where your input goes and what happens next\n4. Check **tips** for shortcuts and best practices\n5. Click the guide again to collapse it and focus on your work\n\n**Role Color Coding**\n\n- 🟣 **Purple** — Admin (system configuration)\n- 🟡 **Amber** — MLRO (approval authority)\n- 🟢 **Green** — Compliance Manager (operational management)\n- 🔵 **Blue** — Compliance Officer (data entry and operations)\n- 🟠 **Orange** — Department Head (oversight)\n- 🔴 **Rose** — Board Member (strategic governance)\n\n**If you don't see a Section Guide** for a section, it means that section has simple functionality that doesn't require detailed role guidance.",
      tags: ["section-guide", "how-to", "roles", "permissions", "navigation", "help"],
    },
  ],
};

// Add the roles section to HELP_SECTIONS (insert after the last section)
HELP_SECTIONS.push(ROLES_RESPONSIBILITIES_SECTION);

// ──────────────────────────────────────────────
// Aggregated search tags
// ──────────────────────────────────────────────
export const HELP_SEARCH_TAGS: string[] = [
  // Section 1: Overview
  "overview",
  "platform",
  "introduction",
  "convertease",
  "aml",
  "compliance",
  "features",
  "modules",
  "dashboard",
  "ai",
  "themes",
  "maker-checker",
  "reporting",
  "users",
  "roles",
  "rbac",
  "compliance-officer",
  "mlro",
  "kyc-analyst",
  "auditor",

  // Section 2: Architecture
  "architecture",
  "tech-stack",
  "nextjs",
  "typescript",
  "prisma",
  "tailwind",
  "database",
  "schema",
  "models",
  "sqlite",
  "data-model",
  "api",
  "endpoints",
  "routes",
  "rest",
  "authentication",
  "jwt",

  // Section 3: Modules
  "command-center",
  "kri",
  "metrics",
  "quick-actions",
  "jurisdiction",
  "kyc",
  "cdd",
  "individual",
  "onboarding",
  "risk-rating",
  "pep",
  "wizard",
  "corporate",
  "ubo",
  "risk-scoring",
  "edq",
  "entity",
  "sanctions",
  "screening",
  "ofac",
  "un",
  "fatf",
  "batch",
  "matching",
  "adverse-media",
  "search",
  "aml-keywords",
  "classification",
  "report",
  "transaction-monitoring",
  "alerts",
  "suspicious",
  "live-feed",
  "analytics",
  "structuring",
  "goaml",
  "sar",
  "str",
  "ctr",
  "filing",
  "fiu",
  "pipeline",
  "risk-assessment",
  "risk-matrix",
  "heatmap",
  "risk-factors",
  "donut-chart",
  "reviews",
  "quarterly-reporting",
  "cbuae",
  "regulatory",
  "pii-masking",
  "excel",
  "submission",
  "backend-ai",
  "chat",
  "llm",
  "agent",
  "conversationalist",
  "document-reader",
  "policies",
  "sop",
  "documents",
  "version-control",
  "training",
  "certifications",
  "cams",
  "cfe",
  "courses",
  "compliance-training",
  "audit-trail",
  "triggers",
  "logging",
  "monitoring",
  "record-keeping",
  "security",
  "posture",
  "checks",
  "health",
  "deployment",

  // Section 4: Scenarios
  "scenario",
  "case-study",

  // Section 5: Training
  "curriculum",
  "mandatory",
  "assessment",
  "duration",
  "delivery",
  "e-learning",
  "instructor-led",
  "on-the-job",
  "mentoring",
  "schedule",
  "q1-2025",
  "calendar",
  "facilitator",
  "effectiveness",
  "completion",
  "retention",
  "kpi",
  "certification",
  "cgss",
  "requirements",

  // Section 6: QA
  "qa",
  "framework",
  "accuracy",
  "completeness",
  "timeliness",
  "documentation",
  "checklist",
  "verification",
  "quality",
  "sampling",
  "rates",
  "methodology",
  "corrective",
  "findings",
  "performance",
  "trends",
  "november-2024",

  // Section 7: FAQ
  "faq",
  "general",
  "uae",
  "access",
  "edd",
  "review",
  "threshold",
  "false-positive",
  "narrative",
  "xml",
  "privacy",
  "knowledge-base",
  "context-aware",
  "export",
  "custom-reports",

  // Section 8: Technical
  "technical",
  "server",
  "client",
  "browser",
  "infrastructure",
  "data-structure",
  "data-protection",
  "encryption",
  "backup",
  "access-control",

  // Section 9: Regulatory
  "cr-134",
  "fdl",
  "mapping",
  "articles",
  "ift",
  "dpo",
  "examination",
  "readiness",
  "inspection",

  // Section 10: Roles & Responsibilities
  "roles-responsibilities",
  "role-admin",
  "role-mlro",
  "role-compliance-manager",
  "role-compliance-officer",
  "role-dept-head",
  "role-board",
  "section-guide",
  "role-hierarchy",
  "data-entry",
  "content-creator",
];
