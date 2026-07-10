# IC-OS — Intelligent Control Operating System

**Enterprise UAE AML/CFT Compliance Platform**

[![Next.js 16](https://img.shields.io/badge/Next.js-16.1.3-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

---

## 1. Project Overview

IC-OS (Intelligent Control Operating System) is a single-page Next.js 16 application purpose-built for **UAE Financial Institutions** to meet the stringent Anti-Money Laundering (AML) and Combating the Financing of Terrorism (CFT) compliance requirements established by:

- **FDL 10/2025** — Federal Decree-Law No. 10 of 2025 on Anti-Money Laundering and Combating the Financing of Terrorism and Illegal Organisations
- **CR 134/2025** — Cabinet Resolution No. 134 of 2025 (Implementing Regulation)
- **CBUAE Notice 3551/2021** — Central Bank of the UAE Guidance on AML/CFT
- **goAML v4.2** — UAE Financial Intelligence Unit reporting standard

The platform features **35+ lazy-loaded modules** organized into a unified compliance workspace, covering the full lifecycle from alert triage and KYC onboarding through SAR filing and regulatory reporting — all backed by an immutable SHA-256 audit trail and enforced Role-Based Access Control (RBAC).

> **Note:** IC-OS v7.2 is a **Compliance & AML Core** platform with optional TPRM, BCP, and Bordereaux modules. It is distinct from the full URCREP (Unified Risk, Compliance, and Reinsurance Enterprise Platform) blueprint, which includes actuarial, reinsurance, and advanced ALM modules for future development.

---

## 2. Core Features

### Core Modules

| Module | Description |
|---|---|
| **Command Center** | Real-time dashboard with KRI metrics, compliance scores, and live alert feeds |
| **AI Regulatory Intelligence** | AI-powered regulatory circular ingestion, gap analysis, and cross-referencing |
| **AML & Sanctions Triage** | Kanban-style alert triage with AI risk scoring and sanctions screening |
| **Evidence War Room** | Inspection evidence upload with AI-verified integrity and SHA-256 file hashing |
| **Claims Portals (4-Persona)** | Claimant, Adjuster, SIU (fraudScore ≥ 0.4), and Supervisor views with role-based filtering |

### Compliance Modules

| Module | Description |
|---|---|
| **CBUAE Tracker** | Regulatory circular tracking with compliance status and gap analysis |
| **Policies & SOPs** | Policy lifecycle management with AI review and version control |
| **Labor Law** | MOHRE labor compliance tracking with quota monitoring |
| **Legal Advisory** | Legal case management with AI-powered case summaries |
| **Training & Certifications** | AML/CFT training course management, enrollment, and certification tracking |
| **Training Effectiveness** | Pre/post assessment scoring, knowledge gain measurement, and effectiveness ratings |
| **Compliance Audits** | Internal and external audit scheduling, findings tracking, and remediation |
| **Adverse Media Screening** | Subject search with decision logging and match classification |

### UAE Regulatory

| Module | Description |
|---|---|
| **goAML Filing Center** | Full goAML v4.2 XML generation for STR, SAR, CTR, IFT, and PNMR report types |
| **Maker-Checker Queue** | 4-Eyes Principle enforcement with expiry tracking and maker ≠ checker validation |
| **CBUAE Submission Checker** | Pre-submission validation against CBUAE filing requirements |

### KYC Onboarding

| Module | Description |
|---|---|
| **Corporate KYC** | Legal entity onboarding with trade license, UBO identification, and PEP screening |
| **Individual KYC** | Natural person onboarding with Emirates ID, passport, and EDD triggers |
| **UBO Ownership Visualization** | Interactive ownership tree for ≥25% ultimate beneficial owners |

### AI & Reporting

| Module | Description |
|---|---|
| **AI Agent Management (5-Brain Infrastructure)** | On-premise AI assistant with context-aware compliance analysis across modules |
| **CBUAE Quarterly Reporting** | Quarterly report assembly, validation, and CBUAE submission tracking |

### Assessment & Analytics

| Module | Description |
|---|---|
| **AML Self-Assessment** | 51-question / 10-section assessment aligned with CBUAE examination framework |
| **Risk Analytics** | Enterprise-wide risk assessment with 5-domain risk matrix and version control |
| **Theme Settings** | Customizable UI themes for institutional branding |

### Production Ops

| Module | Description |
|---|---|
| **Security & Compliance Center** | System security posture dashboard with CSP, HSTS, and data residency monitoring |
| **Vendor Risk Management** | Third-party risk profiling, due diligence tracking, and EDD workflows per CBUAE guidelines |
| **Resiliency Hub** | BCP/DRP document management, resiliency testing, and incident response coordination |

### Strategic Modules

| Module | Description |
|---|---|
| **Bordereaux Validation** | CSV/Excel upload with Zod row-level validation, duplicate detection, error reports, and CBUAE submission |
| **ESG Risk Scanner** | Adverse media ESG keyword analysis for Greenwashing, Carbon Fraud, Environmental Violations, and Modern Slavery |

### Tools

| Module | Description |
|---|---|
| **Audit Trail (SHA-256)** | Immutable audit log with cryptographic hash verification for every compliance action |
| **Risk Matrix (5-Domain)** | Customer, Jurisdiction, Product, Interface, and Other domain risk assessment |

---

## What's New in v7.2

### v7.2 Hardening Highlights (Batches 1–6)

A comprehensive 6-batch hardening initiative addressed 41 findings from a gap analysis (14 Critical, 12 High, 15 Medium/Low), resolving 38 actionable items:

**Security (Batches 1–3):**
- 🔒 **AuthGuard on all 43 previously unprotected routes** — Every API endpoint now enforces RBAC via `authGuard()`
- 🛡️ **Mass assignment prevention** — All body schemas use `.strict()`, KYC uses `z.discriminatedUnion()`
- ⏱️ **LLM SDK 30s timeout** — `Promise.race()` prevents hanging AI connections
- 🔐 **GCC-specific PII masking** — 12 field-specific mask functions (Emirates ID, IBAN, passport, trade license, TRN, etc.)
- 🏷️ **Role-based response masking** — auditor/external roles see fully masked data; compliance roles see unmasked in detail views
- 🤖 **AI response PII stripping** — Regex-based catch-all for LLM outputs
- 📊 **Per-userId 3-tier rate limiting** — READ (100/min), WRITE (30/min), SENSITIVE (10/min) — no false 429s on corporate NATs
- 🔍 **Zod `safeParse` on 100% of endpoints** — All inputs validated; strict mode rejects unknown keys

**Performance (Batch 4):**
- ⚡ **N+1 query elimination** — 8 sequential Prisma queries → 1 `Promise.all()` parallel batch in investigation context
- 📈 **O(n) fraud ring analytics** — Map-based entity aggregation replaces O(n²) cluster detection
- 📄 **Pagination caps** — All heavy list endpoints enforce max 100 results via Zod validation
- 🤖 **RAG confidence threshold** — `MIN_RELEVANCE_SCORE = 3` prevents hallucination from weak context
- ⏰ **30-day SAR auto-escalation** — 2-tier system (25-day MLRO, 28-day Head of Compliance) with immutable audit trail

**Frontend Resilience (Batch 5):**
- 🛑 **3-tier error boundaries** — Page, module, and component-level crash isolation with telemetry logging
- 💀 **Skeleton loaders + Empty States** — Standardized loading and zero-result components for all data views
- ✅ **Inline Zod form validation** — Per-field error messages with red borders on goAML + KYC forms
- 📝 **TypeScript strict mode** — `noImplicitAny` enforced, zero `: any` / `@ts-ignore` directives
- ♿ **Accessibility** — Keyboard-navigable slide-to-confirm, ARIA roles on Kanban, `aria-label` on all icon buttons

**Documentation & Production Readiness (Batch 6):**
- 📚 **Comprehensive documentation sync** — ARCHITECTURE.md, README.md, SMOKE_TEST_CHECKLIST.md updated with all hardening measures
- 🏗️ **Clean production build** — Zero errors, zero new warnings
- 🏷️ **Git tag `v7.2-hardened`** — Final handover tag for DevOps deployment

### Unified Investigator Workspace
- **3-Pane "War Room"** — Customer 360°, Transaction Timeline with Fund Flow Graph, and AI Rationale + Actions in a resizable layout
- **React.memo optimized** — All sub-components memoized for 60fps performance during pane resizing
- **Seamless alert switching** — keepPreviousData prevents loading flicker between alerts

### 6 Critical GCC Regulatory Workflows
1. **Bulk Adjudication** — Mass false positive closure with shared-attribute validation, chunked processing (max 500/batch)
2. **Early Surrender Third-Party Block** — Prevents policy surrender during active investigations
3. **Fraud Ring Analytics** — Graph-based cluster detection across shared entities with CRITICAL/HIGH risk classification
4. **Sanctions Mass Freeze** — Overnight geopolitical shock response with dual MLRO+CEO confirmation and IP audit trail
5. **Audit Data Room** — Regulator-in-a-box with 72-hour time-bound access, comprehensive PII masking, SHA-256 integrity
6. **Autonomous SAR Drafting** — AI-powered SAR narrative generation with CBUAE regulatory references

### AI Compliance Assistant
- **IC-OS Compliance Assistant:** A 122-scenario RAG chatbot for instant regulatory guidance, grounded in zero-hallucination knowledge base with in-memory scoring and LLM context injection.

### Phase 11: Strategic Module Expansion

**Bordereaux Validation Engine:**
- 📊 **CSV/Excel upload with drag-and-drop** — Broker bordereaux files validated row-by-row against CBUAE requirements
- ✅ **Zod row-level validation** — Mandatory fields (policyNumber, insuredName, premiumAED, startDate, endDate, brokerId) with flexible column mapping
- 🔍 **Duplicate policy number detection** — Automatic identification of duplicate entries across the file
- 📋 **Structured error reports** — Downloadable CSV with row/column-level error details for offline correction
- 📤 **CBUAE submission workflow** — 100% validation gate: only error-free bordereaux can be submitted, with SHA-256 audit trail

**ESG / Greenwashing Risk Scanner:**
- 🌿 **Keyword-based ESG detection** — 5 risk categories: Greenwashing, Carbon Fraud, Environmental Violations, Modern Slavery, Sanctions Evasion
- 📈 **Weighted risk scoring (0-100)** — Severity-weighted scores with volume adjustment and decision influence
- 🏷️ **Visual ESG risk badges** — Low (emerald), Medium (amber), High (red) badges in adverse media results
- 📝 **Audit-logged scans** — Every ESG scan permanently recorded in SHA-256 audit trail
- 🔗 **Integrated in Adverse Media workflow** — ESG Scan button in Results step, ESG row in Report summary

### External Integration Layer
- **UAE Pass / KSA Nafath** — OAuth2 biometric identity verification with provider abstraction
- **Dow Jones / Refinitiv** — PEP/Sanctions/Adverse Media screening with 24h cache and score normalization
- **goAML Direct Submission** — Mutual TLS API or RPA simulation with idempotency and retry logic
- **Rate Limited** — All external adapters enforce request quotas to prevent API exhaustion

### Performance & Security
- 44 composite database indexes for sub-200ms query performance
- Rate limiting on all external integrations (Identity: 10/min, Screening: 20/min, Regulatory: 5/min)
- Enhanced PII masking using 12 field-specific mask functions (maskEmiratesId, maskAccountNumber, etc.)
- Dual-confirmation audit with IP addresses for sanctions mass freeze operations

---

## 3. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Framework** | Next.js (App Router + Turbopack) | 16.1.3 |
| **Language** | TypeScript | 5 |
| **Styling** | Tailwind CSS + shadcn/ui (New York style) | 4 |
| **Database** | SQLite via Prisma ORM | 6.11 |
| **Server State** | TanStack Query (React Query) | 5.82 |
| **Client State** | Zustand (with persistence) | 5.0 |
| **Data Visualization** | Recharts | 2.15 |
| **PDF Generation** | jsPDF + html2canvas | 4.2 / 1.4 |
| **Authentication** | NextAuth.js | 4.24 |
| **AI Capabilities** | z-ai-web-dev-sdk | 0.0.18 |
| **Validation** | Zod | 4.0 |
| **Animations** | Framer Motion | 12.23 |
| **Drag & Drop** | @dnd-kit | 6.3 |
| **Tables** | TanStack Table + Virtual | 8.21 / 3.14 |
| **Forms** | React Hook Form + @hookform/resolvers | 7.60 |
| **Markdown Editor** | MDXEditor | 3.39 |
| **Package Manager** | Bun | — |
| **Deployment** | Docker Standalone / Vercel | — |

---

## 4. Local Development Setup

### Prerequisites

- [Bun](https://bun.sh/) runtime (v1.0+)
- Node.js 18+ (for Next.js compatibility)
- Git

### Step-by-Step

```bash
# 1. Clone the repository
git clone <repo-url>
cd my-project

# 2. Install dependencies
bun install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your configuration (see Environment Variables below)

# 4. Push database schema (creates SQLite database and tables)
bun run db:push

# 5. Seed the database with sample data
bunx tsx prisma/seed.ts

# 6. Start the development server (with Turbopack)
bun run dev
```

The application will be available at **http://localhost:3000**.

In development mode, authentication is bypassed with a synthetic `admin` user for rapid prototyping and testing.

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | `file:./dev.db` | SQLite database connection string |
| `NEXTAUTH_SECRET` | Production | `dev-secret-min-32-characters-long!!` | NextAuth.js session encryption key (min 32 chars in production) |
| `NEXTAUTH_URL` | Production | — | Application URL for auth callbacks |
| `AI_GATEWAY_URL` | No | — | On-premise AI gateway endpoint |
| `OLLAMA_HOST` | No | `http://localhost:11434` | Ollama LLM host for local AI inference |
| `QDRANT_URL` | No | — | Qdrant vector database for RAG |
| `QDRANT_API_KEY` | No | — | Qdrant API key |
| `ENABLE_MAKER_CHECKER` | No | `true` | Enable Maker-Checker workflow enforcement |
| `ENABLE_AI_CHAT` | No | `true` | Enable AI assistant chat |
| `ENABLE_PII_MASKING` | No | `true` | Enable PII masking in exports and views |
| `DATA_RESIDENCY_REGION` | No | `me-central-1` | UAE data residency region enforcement |
| `RATE_LIMIT_TIER_READ` | No | `100` | Max requests per minute for READ tier (dashboards, lists) |
| `RATE_LIMIT_TIER_WRITE` | No | `30` | Max requests per minute for WRITE tier (mutations) |
| `RATE_LIMIT_TIER_SENSITIVE` | No | `10` | Max requests per minute for SENSITIVE tier (AI, bulk ops) |
| `LLM_TIMEOUT_MS` | No | `30000` | Timeout in milliseconds for LLM/AI SDK calls |
| `RAG_MIN_RELEVANCE_SCORE` | No | `3` | Minimum relevance score for RAG pipeline (below = fallback) |
| `SAR_DEADLINE_DAYS` | No | `30` | Regulatory deadline in days for SAR filing |
| `SAR_TIER1_DAYS_REMAINING` | No | `5` | Days remaining for Tier 1 MLRO escalation |
| `SAR_TIER2_DAYS_REMAINING` | No | `2` | Days remaining for Tier 2 Head of Compliance escalation |

---

## 5. Production Deployment

### Docker Standalone Build

```bash
# Build the standalone application
bun run build

# The standalone output is generated at .next/standalone/
# Static assets are copied to .next/standalone/.next/static/
# Public assets are copied to .next/standalone/public/

# Run in production
NODE_ENV=production bun .next/standalone/server.js
```

The `next.config.ts` is configured with `output: "standalone"` for optimal Docker deployment.

### Vercel Deployment

```bash
# Deploy to Vercel
vercel --prod

# Set environment variables in Vercel dashboard or via CLI
vercel env add DATABASE_URL
vercel env add NEXTAUTH_SECRET
vercel env add NEXTAUTH_URL
```

### Production Checklist

- [ ] `DATABASE_URL` points to production database
- [ ] `NEXTAUTH_SECRET` is set to a cryptographically random value (min 32 characters)
- [ ] `NEXTAUTH_URL` matches the production domain
- [ ] `ENABLE_PII_MASKING` is set to `true`
- [ ] `ENABLE_MAKER_CHECKER` is set to `true`
- [ ] `DATA_RESIDENCY_REGION` is set to `me-central-1`
- [ ] Database schema has been pushed: `bun run db:push`
- [ ] CSP and HSTS headers are active (auto-configured via `next.config.ts`)
- [ ] Health check endpoint is responding: `GET /api/health`

### Health Check Endpoint

```
GET /api/health
```

Returns system health, database connectivity, security posture score, and service availability. A `200` status indicates healthy; `503` indicates the database is down.

---

## 6. Project Structure

```
my-project/
├── prisma/
│   ├── schema.prisma              # Database schema (30+ models)
│   ├── seed.ts                    # Database seeding script
│   ├── seed-users.ts              # User seed data
│   └── seed-enhancements.ts       # Enhanced seed data
├── src/
│   ├── app/
│   │   ├── api/                   # API routes (45+ endpoints)
│   │   │   ├── aml/               # AML alerts CRUD
│   │   │   ├── claims/            # Claims with role-based filtering
│   │   │   ├── kyc/               # Corporate & Individual KYC
│   │   │   ├── goaml/             # goAML filing management
│   │   │   ├── goaml-xml/         # goAML XML generation
│   │   │   ├── sanctions/         # Sanctions screening
│   │   │   ├── compliance-alerts/ # Immutable compliance alerts
│   │   │   ├── sar-deadlines/     # SAR case deadline tracking
│   │   │   ├── maker-checker/     # Maker-Checker queue
│   │   │   ├── ai/                # AI assistant (chat, policy RAG)
│   │   │   ├── health/            # System health check
│   │   │   └── ...                # 30+ more endpoints
│   │   ├── login/                 # Authentication page
│   │   ├── layout.tsx             # Root layout with providers
│   │   └── page.tsx               # Main SPA entry point
│   ├── components/
│   │   ├── ic-os/                 # Module components (28+)
│   │   │   ├── dashboard/         # Command Center
│   │   │   ├── aml/               # AML & Sanctions Triage
│   │   │   ├── claims/            # Claims Portals
│   │   │   ├── kyc/               # KYC Wizards & UBO
│   │   │   ├── goaml/             # goAML Filing Center
│   │   │   ├── maker-checker/     # Maker-Checker Queue
│   │   │   ├── evidence/          # Evidence War Room
│   │   │   ├── regulatory/        # AI Regulatory Intelligence
│   │   │   ├── policies/          # Policies & SOPs
│   │   │   ├── training/          # Training & Certifications
│   │   │   ├── audits/            # Compliance Audits
│   │   │   ├── legal/             # Legal Advisory
│   │   │   ├── labor/             # Labor Law Compliance
│   │   │   ├── adverse-media/     # Adverse Media Screening
│   │   │   ├── reporting/         # CBUAE Quarterly Reporting
│   │   │   ├── ai-agent/          # AI Agent Management
│   │   │   ├── aml-assessment/    # AML Self-Assessment
│   │   │   ├── analytics/         # Risk Analytics
│   │   │   ├── security/          # Security & Compliance Center
│   │   │   ├── theme/             # Theme Settings
│   │   │   ├── shared/            # AuditTrail, RiskMatrix, AlertDetailDrawer
│   │   │   └── layout/            # Sidebar, TopBar
│   │   ├── ui/                    # shadcn/ui primitives (50+ components)
│   │   ├── shared/                # Shared components (ErrorBoundary, CommandMenu)
│   │   ├── auth/                  # LoginForm, AuthProvider
│   │   └── providers/             # QueryProvider (TanStack)
│   ├── lib/
│   │   ├── audit.ts               # SHA-256 audit log creation
│   │   ├── auth-guard.ts          # Authentication & RBAC guard
│   │   ├── pii.ts                 # PII masking utilities
│   │   ├── store.ts               # Zustand global store
│   │   ├── db.ts                  # Prisma client singleton
│   │   ├── env.ts                 # Zod-validated environment config
│   │   ├── pdf-generator.ts       # jsPDF report generation
│   │   ├── csv-export.ts          # CSV export utilities
│   │   ├── rate-limit.ts          # API rate limiting
│   │   ├── validate.ts            # Validation helpers
│   │   ├── themes.ts              # Theme definitions
│   │   ├── types.ts               # Shared TypeScript types
│   │   ├── utils.ts               # General utilities (cn, formatters)
│   │   ├── api-hooks.ts           # TanStack Query hooks
│   │   ├── query-hooks.ts         # Additional query hooks
│   │   ├── compliance/
│   │   │   ├── rbac.ts            # RBAC permission matrix & enforcement
│   │   │   ├── tipping-off.ts     # Tipping-off prohibition system
│   │   │   ├── goaml-xml.ts       # goAML v4.2 XML generation
│   │   │   ├── screening-engine.ts # Sanctions screening engine
│   │   │   ├── audit-middleware.ts # Audit middleware for API routes
│   │   │   ├── cross-module.ts    # Cross-module linking logic
│   │   │   ├── ubo-tracing.ts     # UBO ownership tracing
│   │   │   ├── regulatory-refs.ts # UAE regulatory reference constants
│   │   │   ├── arabic-normalization.ts # Arabic name normalization for matching
│   │   │   ├── cpf-questions.ts   # AML self-assessment question bank
│   │   │   ├── pii-hooks.ts       # PII masking React hooks
│   │   │   ├── rag-policy-wizard.ts # RAG-based policy wizard
│   │   │   └── training-courses-enhanced.ts # Enhanced training course data
│   │   ├── middleware/
│   │   │   └── maker-checker.ts   # Maker-Checker workflow engine
│   │   └── validations/           # Zod schemas per domain
│   │       ├── claim.ts
│   │       ├── aml.ts
│   │       ├── kyc.ts
│   │       ├── goaml.ts
│   │       ├── maker-checker.ts
│   │       ├── policy.ts
│   │       ├── audit.ts
│   │       ├── training.ts
│   │       └── ...                # 10+ validation schemas
│   ├── hooks/
│   │   ├── use-pii.ts             # PII masking hook
│   │   ├── use-mobile.ts          # Mobile detection
│   │   └── use-toast.ts           # Toast notifications
│   └── middleware.ts              # Next.js middleware (auth, CSP, security headers)
├── public/
│   └── logo.svg
├── next.config.ts                 # Next.js config (standalone, security headers)
├── tailwind.config.ts             # Tailwind CSS configuration
├── tsconfig.json                  # TypeScript configuration
├── package.json                   # Dependencies and scripts
└── bun.lock                       # Bun lockfile
```

---

## 7. Security & Compliance

IC-OS implements defense-in-depth security controls aligned with UAE regulatory requirements:

### Audit Trail Integrity
- Every compliance action is recorded with a **SHA-256 cryptographic hash**
- Audit entries are immutable — no deletion or modification permitted
- Hash payload includes user ID, action, resource, timestamp, and changes
- Verify audit integrity at any time via hash recomputation

### PII Masking
- `maskPII` utility from `@/lib/pii` enforces field-level data protection
- Names partially masked: "Ahmed Al-Rashid" → "A. A."
- Emirates ID: "784-1990-1234567-1" → "784-****-*******-1"
- Phone numbers: "+971-50-1234567" → "+971-***4567"
- Bank accounts: show last 4 digits only
- Amounts: full value in internal view, masked (`AED **,***`) in CBUAE/regulatory exports
- Controlled via `ENABLE_PII_MASKING` environment variable

### Maker-Checker (4-Eyes Principle)
- Critical operations require dual approval by two different users
- Maker and Checker cannot be the same person (enforced at database level)
- Critical operations (goAML submission, KYC high-risk approval) expire in **4 hours**
- Standard operations expire in **24 hours**
- Expiry is automatically enforced — expired requests must be resubmitted

### Tipping-Off Prohibition (FDL 10/2025 Art. 12)
- Comprehensive risk detection engine with 10 tipping-off risk indicators
- Automatic blocking of communications to SAR subjects
- SAR confidentiality levels: CONFIDENTIAL, RESTRICTED, SECRET
- Mandatory acknowledgment before accessing SAR-related data
- Full audit trail of all SAR access events

### UAE Data Residency
- All data stored within UAE (`DATA_RESIDENCY_REGION=me-central-1`)
- On-premise AI inference via Ollama — no data leaves the jurisdiction
- AI Gateway and Qdrant vector DB are deployed locally

### Security Headers
- **Content-Security-Policy (CSP)** — Strict CSP with no external script sources
- **Strict-Transport-Security (HSTS)** — max-age=63072000; includeSubDomains; preload
- **X-Content-Type-Options** — nosniff
- **X-Frame-Options** — DENY (relaxed for preview panel in development)
- **Referrer-Policy** — strict-origin-when-cross-origin
- **Permissions-Policy** — camera, microphone, geolocation, and browsing-topics disabled

### Fail-Closed Design
- Sanctions screening defaults to **blocking** if the screening engine fails
- Compliance alerts are **immutable** once created (`isImmutable: true`)
- SAR case deadlines are tracked with automatic escalation
- Idempotency keys prevent duplicate compliance-critical operations

---

## License

Proprietary — All rights reserved. This software is licensed for use by authorized UAE financial institutions only.

---

## Future Roadmap (URCREP Blueprint)

The following modules from the URCREP (Unified Risk, Compliance, and Reinsurance Enterprise Platform) blueprint are **not yet implemented** in IC-OS v7.2. They represent a multi-year roadmap for expanding the platform into a full bancassurance enterprise system.

### High Priority (Next Phase)
| Module | URCREP Part | Description |
|---|---|---|
| **Continuous Control Monitoring (CCM)** | Part 29 | Automated 24/7 control checks with population-wide scripts and evidence gathering |
| **Consumer Protection & Market Conduct** | Parts 1, 23 | Complaint tracking, fair pricing, mis-selling detection, vulnerable customer flagging |
| **Risk Register & Taxonomy** | Part 1 | Centralized risk register with full risk taxonomy, heatmaps, and residual vs. inherent scoring |
| **Model Registry / AI Model Passports** | Part 15 | Centralized model inventory with drift detection, bias testing, and validation scheduling |

### Medium Priority (Year 2)
| Module | URCREP Part | Description |
|---|---|---|
| **Reinsurance Treaty Administration** | Parts 6, 14, 22 | Multi-layered treaty management, reinstatement premiums, retrocession tracking |
| **MGA & Intermediary Oversight** | Part 22 | Binding authority, commission tracking, distributor oversight portal |
| **Incident & Breach Management** | Part 9 | "Golden Hour" protocol, regulatory clocks, root cause analysis engine |
| **Advanced Cyber Resilience** | Part 27 | Threat intelligence mapping, automated tabletop exercises, RTO/RPO monitoring |

### Long-Term (Year 3+)
| Module | URCREP Part | Description |
|---|---|---|
| **Actuarial & Reserving Engine** | Part 19 | IFRS 17 automation, multi-method reserving, granular P&L |
| **ALM & Investment Portfolio** | Part 26 | Dynamic duration matching, yield curve stress testing, look-through analysis |
| **Underwriting & Pricing Engine** | Part 20 | GLM/ML pricing models, exposure aggregation, DOA routing |
| **Digital Twin / War Gaming** | Part 17 | Real-time what-if simulation, instant impact visualization |
| **Smart Contracts & Blockchain** | Part 30 | Parametric insurance contracts, shared reinsurance ledger, collateral tokenization |

> These modules require specialized actuarial engines, Monte Carlo simulation frameworks, graph databases, or DLT infrastructure beyond the current IC-OS stack.
