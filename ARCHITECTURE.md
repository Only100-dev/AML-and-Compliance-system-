# IC-OS Architecture Documentation

**Intelligent Control Operating System — Enterprise UAE AML/CFT Compliance Platform**

This document describes the internal architecture, data flows, and design patterns of IC-OS. It is intended for developers, compliance engineers, and auditors who need to understand how the system enforces UAE regulatory requirements at every layer.

---

## Table of Contents

1. [The "Golden Path" Pattern](#1-the-golden-path-pattern)
2. [Role-Based Access Control (RBAC) Matrix](#2-role-based-access-control-rbac-matrix)
3. [Maker-Checker Workflow](#3-maker-checker-workflow)
4. [Data Privacy & PII Masking](#4-data-privacy--pii-masking)
5. [System Architecture Diagram](#5-system-architecture-diagram)
6. [API Route Organization](#6-api-route-organization)
7. [Data Flow: Compliance Event → Audit Trail](#7-data-flow-compliance-event--audit-trail)
8. [Unified Investigator Workspace Architecture](#8-unified-investigator-workspace-architecture)
9. [Scenario-Based RAG Knowledge Base](#9-scenario-based-rag-knowledge-base)
10. [Security & Hardening (v7.2 Batches 1–4)](#10-security--hardening-v72-batches-14)
11. [Frontend Resilience (v7.2 Batch 5)](#11-frontend-resilience-v72-batch-5)

---

## 1. The "Golden Path" Pattern

Every compliance-critical operation in IC-OS follows a single, predictable data flow pattern called the **Golden Path**. This ensures that every action is validated, authorized, recorded, and cache-coherent — with no shortcuts that could bypass regulatory controls.

### The Flow

```
┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐    ┌───────────────┐    ┌────────────┐
│  Zod     │───▶│  authGuard │───▶│  Prisma  │───▶│  Audit   │───▶│  React Query  │───▶│  Cache     │
│  Schema  │    │  (RBAC)    │    │  Operation│    │  SHA-256 │    │  Mutation     │    │  Invalidate│
└──────────┘    └───────────┘    └──────────┘    └──────────┘    └───────────────┘    └────────────┘
```

**Step-by-step:**

1. **Zod Schema** — Validates the incoming request body against a strictly-typed schema. Invalid data is rejected immediately with a `400` response and detailed field-level error messages.
2. **authGuard** — Checks the user's session and role against the required permissions. Unauthenticated requests get `401`; unauthorized roles get `403`.
3. **Prisma Operation** — Performs the database create, update, or delete. All database access goes through Prisma ORM to ensure type safety and prevent raw SQL injection.
4. **Audit Log (SHA-256)** — An immutable audit log entry is created with a cryptographic hash of the action, user, resource, timestamp, and changes. This entry cannot be modified or deleted.
5. **React Query Mutation** — On the client side, the mutation handler manages loading, error, and success states with automatic retry logic.
6. **Cache Invalidation** — On `onSuccess`, the relevant TanStack Query cache is invalidated, ensuring the UI reflects the latest data.

### Concrete Example: Creating a Claim

**API Route** (`src/app/api/claims/route.ts`):

```typescript
// ─── 1. Zod Schema ────────────────────────────────────────────────────
const createClaimSchema = z.object({
  policyNumber: z.string().min(1, 'Policy number is required'),
  claimType: z.string().min(1, 'Claim type is required'),
  claimantName: z.string().min(1, 'Claimant name is required'),
  description: z.string().min(1, 'Description is required'),
  amount: z.number().positive('Amount must be a positive number'),
});

// ─── 2. POST Handler ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Step 1: Validate with Zod
  const parsed = createClaimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    );
  }

  // Step 2: authGuard (would be called here for production endpoints)
  // const { authorized, error } = await authGuard({ allowedRoles: ['compliance_officer', 'admin'] });

  // Step 3: Prisma Operation
  const claim = await db.claim.create({
    data: { ...parsed.data, claimNumber, status: 'submitted' },
  });

  // Step 4: Audit Log (SHA-256)
  await createAuditLog({
    userId: session.user.id,
    action: 'CLAIM_CREATED',
    resourceType: 'Claim',
    resourceId: claim.id,
  });

  return NextResponse.json({ success: true, data: claim }, { status: 201 });
}
```

**Client-Side Mutation** (TanStack Query):

```typescript
const createClaimMutation = useMutation({
  mutationFn: async (data: ClaimCreateInput) => {
    const res = await fetch('/api/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create claim');
    return res.json();
  },
  onSuccess: () => {
    // Step 6: Invalidate claims cache
    queryClient.invalidateQueries({ queryKey: ['claims'] });
    toast.success('Claim created successfully');
  },
  onError: (error) => {
    toast.error(`Error: ${error.message}`);
  },
});
```

### Why This Pattern Matters

| Property | Enforcement Point | Regulatory Reference |
|---|---|---|
| Input validation | Zod Schema | FDL 10/2025 Art. 15 (Internal Controls) |
| Authorization | authGuard + RBAC | CBUAE Notice 3551/2021 S3.1 (Governance) |
| Data integrity | Prisma ORM | FDL 10/2025 Art. 11 (Record Keeping) |
| Auditability | SHA-256 Audit Log | FDL 10/2025 Art. 11, 15; CR 134/2025 Art. 16 |
| UI consistency | TanStack Query Cache | Internal quality standard |
| Error handling | Mutation error states | Internal quality standard |

---

## 2. Role-Based Access Control (RBAC) Matrix

IC-OS implements a comprehensive RBAC system defined in `src/lib/compliance/rbac.ts` with 26 explicit permissions across 7 categories. Each permission maps to specific UAE regulatory articles.

### Role Definitions

| Role | Label | Hierarchy Level | Description |
|---|---|---|---|
| `admin` | System Administrator | 100 | Full system access, user management, configuration |
| `mlro` | Money Laundering Reporting Officer | 50 | AML alert approval, SAR filing, goAML submission, escalations |
| `compliance_manager` | Compliance Manager | 40 | Policy management, training oversight, audit scheduling |
| `compliance_officer` | Compliance Officer | 30 | Day-to-day compliance operations, KYC processing |
| `claims_adjuster` | Claims Adjuster | — | Claims processing, fraud flagging |
| `analyst` | Analyst | — | Data analysis, reporting, read-only compliance |
| `siu` | Special Investigation Unit | — | Only sees claims with `fraudScore >= 0.4` |
| `dept_head` | Department Head | 20 | Department-level operations and approvals |
| `board` | Board Member | 10 | Governance oversight, policy approval, aggregated dashboards |

### Permission Matrix

| Permission | Category | admin | mlro | compliance_manager | compliance_officer | dept_head | board | Maker-Checker Required |
|---|---|---|---|---|---|---|---|---|
| `canFileSAR` | AML | ✅ | ✅ | — | — | — | — | **Yes** |
| `canApproveAlert` | AML | ✅ | ✅ | ✅ | — | — | — | No |
| `canEscalateToMLRO` | AML | ✅ | ✅ | ✅ | ✅ | — | — | No |
| `canViewSARCase` | AML | ✅ | ✅ | ✅ | ✅ | — | — | No |
| `canCreateComplianceCase` | AML | ✅ | ✅ | ✅ | ✅ | — | — | No |
| `canApproveKYC` | KYC | ✅ | ✅ | ✅ | — | — | — | **Yes** |
| `canReviewKYC` | KYC | ✅ | ✅ | ✅ | ✅ | — | — | No |
| `canScreenSanctions` | Sanctions | ✅ | ✅ | ✅ | ✅ | — | — | No |
| `canOverrideSanctions` | Sanctions | ✅ | ✅ | — | — | — | — | **Yes** |
| `canApprovePolicy` | Governance | ✅ | ✅ | ✅ | — | — | — | No |
| `canManagePolicies` | Governance | ✅ | ✅ | ✅ | — | — | — | No |
| `canManageTraining` | Governance | ✅ | ✅ | ✅ | — | — | — | No |
| `canViewRiskAssessment` | Governance | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | No |
| `canManageVendorDD` | Governance | ✅ | ✅ | ✅ | — | — | — | No |
| `canManageRemediation` | Governance | ✅ | ✅ | ✅ | — | — | — | No |
| `canViewBoardDashboard` | Governance | ✅ | ✅ | — | — | — | ✅ | No |
| `canSubmitGoAML` | Reporting | ✅ | ✅ | — | — | — | — | **Yes** |
| `canSubmitCBUAEReport` | Reporting | ✅ | ✅ | — | — | — | — | **Yes** |
| `canGenerateAuditPack` | Reporting | ✅ | ✅ | ✅ | — | — | — | No |
| `canManageUsers` | Administration | ✅ | — | — | — | — | — | **Yes** |
| `canViewAuditLog` | Administration | ✅ | ✅ | ✅ | — | — | — | No |
| `canExportData` | Administration | ✅ | ✅ | ✅ | — | — | — | No |
| `canManageNotifications` | Administration | ✅ | ✅ | ✅ | — | — | — | No |
| `canAccessAIAssistant` | General | ✅ | ✅ | ✅ | ✅ | — | — | No |
| `canViewRegulatoryTracker` | General | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | No |
| `canCreateCalendarEvent` | General | ✅ | ✅ | ✅ | ✅ | — | — | No |

### Special Role Behaviors

**SIU (Special Investigation Unit):** The SIU persona is enforced at the API level. When `persona=siu` is passed to the claims endpoint, the Prisma query automatically filters to only claims where `siuFlagged=true` OR `fraudScore >= 0.4`:

```typescript
if (persona === 'siu') {
  where.OR = [
    { siuFlagged: true },
    { fraudScore: { gte: 0.4 } },
  ];
}
```

**Board:** The board role has restricted operational access but full visibility into aggregated dashboards and risk assessments. This aligns with CBUAE Notice 3551/2021 S3.1 governance requirements for board-level oversight.

### Enforcement Points

1. **Middleware** (`src/middleware.ts`) — Enforces authentication at the edge; redirects unauthenticated users to `/login`
2. **authGuard** (`src/lib/auth-guard.ts`) — Per-route session and role checking
3. **withRBAC** (`src/lib/compliance/rbac.ts`) — Higher-order function wrapper for API routes with explicit permission requirements
4. **Client-Side** — Sidebar and module components conditionally render based on user role from the Zustand store

---

## 3. Maker-Checker Workflow

The Maker-Checker (4-Eyes Principle) is a cornerstone of IC-OS's compliance architecture, enforcing that critical operations cannot be executed by a single individual. This implements the dual-control requirements of FDL 10/2025 Art. 15 and CBUAE Notice 3551/2021 S3.1.

### Workflow States

```
                    ┌──────────┐
                    │  PENDING │ ◀── Maker creates/edits record
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ APPROVED │ │ REJECTED │ │ EXPIRED  │
        └──────────┘ └──────────┘ └──────────┘
        Checker      Checker      Auto-expired
        approves     rejects      (time exceeded)
```

### Step-by-Step Flow

**1. Maker Initiates the Operation**

```typescript
// src/lib/middleware/maker-checker.ts
const mcLog = await initiateMakerChecker(
  "GOAML_SUBMIT",       // Operation type
  filing.id,            // Entity ID
  "GoAMLFiling",        // Entity type
  makerUser.id,         // Maker user ID
  makerUser.name,       // Maker display name
  { ...filingData }     // Payload snapshot for review
);
// Status is set to "PENDING"
// Expiry time is set (4 hours for critical, 24 hours for standard)
```

**2. System Routes to Checker Queue**

The pending record appears in the Maker-Checker Queue (`/api/maker-checker?status=PENDING`). The entity's status is set to `PENDING_MAKER_CHECKER`, preventing any further modification until the Checker acts.

**3. Checker Reviews**

The Checker sees the full payload snapshot, the Maker's identity, and the time remaining before expiry. They can either:

- **Approve** — Entity status transitions to `APPROVED`; the operation proceeds
- **Reject** — Entity status transitions to `REJECTED`; the Maker is notified with the rejection reason

**4. Maker ≠ Checker Enforcement**

This is the critical invariant. It is enforced at two levels:

```typescript
// In reviewMakerChecker():
if (log.makerId === checkerId) {
  throw new Error(
    "Maker and Checker cannot be the same person (4-eyes principle violation)."
  );
}
```

Additionally, the RBAC system's `checkMakerCheckerRequirement()` function validates this before the operation even reaches the database:

```typescript
const result = checkMakerCheckerRequirement(
  userRole,
  'canSubmitGoAML',
  makerId,
  checkerId
);
// result.makerCheckerSatisfied === false if maker === checker
```

**5. Expiry Enforcement**

```typescript
if (new Date() > log.expiryTime) {
  await db.makerCheckerLog.update({
    where: { id: logId },
    data: { status: "EXPIRED" },
  });
  throw new Error("Approval request has expired. The maker must resubmit.");
}
```

**6. Audit Trail**

Both the Maker's initiation and the Checker's review are recorded as separate audit log entries with SHA-256 hashes:

```
[Maker]  ACTION: MAKER_CHECKER_INITIATED | Resource: GoAMLFiling:clx123 | SHA-256: a3f8...
[Checker] ACTION: MAKER_CHECKER_APPROVED  | Resource: GoAMLFiling:clx123 | SHA-256: b7d2...
```

### Operations Requiring Maker-Checker

| Operation Type | Expiry | Regulatory Reference |
|---|---|---|
| `GOAML_SUBMIT` | 4 hours | FDL 10/2025 Art. 8; CR 134/2025 Art. 10-11 |
| `KYC_HIGH_RISK_APPROVAL` | 4 hours | FDL 10/2025 Art. 7, 9; CR 134/2025 Art. 5-9 |
| `SANCTIONS_CLEARANCE_OVERRIDE` | 24 hours | FDL 10/2025 Art. 18; CR 134/2025 Art. 25-27 |
| SAR Filing (`canFileSAR`) | 4 hours | FDL 10/2025 Art. 8; CR 134/2025 Art. 10-11 |
| User Management (`canManageUsers`) | 24 hours | FDL 10/2025 Art. 15; CBUAE Notice 3551/2021 S3.1 |
| KYC Approval (`canApproveKYC`) | 4 hours | FDL 10/2025 Art. 7, 9; CR 134/2025 Art. 5-9 |
| CBUAE Report Submission (`canSubmitCBUAEReport`) | 4 hours | CBUAE Notice 3551/2021; FDL 10/2025 Art. 21 |
| Sanctions Override (`canOverrideSanctions`) | 24 hours | FDL 10/2025 Art. 18; CR 134/2025 Art. 25-27 |

---

## 4. Data Privacy & PII Masking

IC-OS implements field-level PII masking per CBUAE data protection and confidentiality requirements (FDL 10/2025 Art. 12, CBUAE Notice 3551/2021). The masking system is defined in `src/lib/pii.ts` and exposed via React hooks in `src/hooks/use-pii.ts`.

### Masking Functions

| Function | Input | Output | Use Case |
|---|---|---|---|
| `maskName` | `"Ahmed Al-Rashid"` | `"A. A."` | Subject names in reports |
| `maskEmiratesId` | `"784-1990-1234567-1"` | `"784-****-*******-1"` | Emirates ID display |
| `maskPassport` | `"A12345678"` | `"A1******"` | Passport number display |
| `maskPhone` | `"+971501234567"` | `"+971***4567"` | Phone number display |
| `maskEmail` | `"ahmed@company.ae"` | `"a***@company.ae"` | Email address display |
| `maskAccountNumber` | `"AE070331234567890123456"` | `"***********23456"` | Bank account display |
| `maskTradeLicense` | `"CN-123456"` | `"CN-****"` | Trade license display |
| `maskTRN` | `"100123456700003"` | `"100**********3"` | Tax Registration Number |
| `maskAmount` | `55000` | `"AED **,***"` | Amounts in CBUAE/regulatory exports |
| `maskAddress` | `"123 Sheikh Zayed Road, Dubai"` | `"***, Dubai"` | Physical addresses |
| `maskFull` | Any value | `"********"` | Highly sensitive fields |
| `maskNone` | Any value | Unchanged | Non-sensitive fields |

### Contextual Masking

The same data field can be masked differently depending on the viewing context:

| Context | Name | Amount | Account Number |
|---|---|---|---|
| **Internal (Compliance Team)** | Full name | Full value | Last 4 digits |
| **CBUAE Regulatory Export** | `"A. A."` | `"AED **,***"` | `"***********2346"` |
| **Board Dashboard** | `"A. A."` | Full value | `"***********2346"` |
| **SAR Narrative** | Full name | Full value | Full (restricted access) |

### Implementation Example

```typescript
// Server-side: PII masking in API responses
import { maskName, maskEmiratesId, maskAmount } from '@/lib/pii';

// For CBUAE export
const cbuaeExport = claims.map(claim => ({
  ...claim,
  claimantName: maskName(claim.claimantName),        // "Ahmed Al-Rashid" → "A. A."
  amount: maskAmount(claim.amount),                   // 55000 → "AED **,***"
}));

// Client-side: React hook
const { mask } = usePII();
<span>{mask('name', claim.claimantName)}</span>       // Context-aware masking
```

### PII Masking Toggle

PII masking can be disabled in development for debugging via the `ENABLE_PII_MASKING` environment variable. In production, this flag is always `true`.

---

## 5. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser (React SPA)                          │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              Lazy-loaded Modules (28+)                        │  │
│  │  Command Center | AML Triage | KYC Wizards | goAML Filing    │  │
│  │  Evidence War Room | Claims Portals | Regulatory Intelligence │  │
│  │  Policy SOPs | Training | Audits | Maker-Checker | AI Agent  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────┐    │
│  │   Zustand    │  │  TanStack Query  │  │   React Hooks      │    │
│  │  (Client     │  │  (Server State   │  │  (usePII,          │    │
│  │   State +    │  │   Cache +        │  │   useMobile,       │    │
│  │   Persist)   │  │   Mutations)     │  │   useToast)        │    │
│  └──────────────┘  └──────────────────┘  └────────────────────┘    │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  shadcn/ui Component Library (New York style, 50+ primitives) │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  REST API (fetch)
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                    Next.js API Routes (45+)                         │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Request Pipeline:                                            │  │
│  │                                                               │  │
│  │  1. Zod Validation ──── Invalid? → 400 + field errors        │  │
│  │  2. authGuard (RBAC) ── Unauthorized? → 401/403              │  │
│  │  3. withRBAC (perm) ─── No permission? → 403 + reg ref       │  │
│  │  4. Tipping-Off Check ─ Blocked? → 403 + legal warning       │  │
│  │  5. Prisma Operation ── DB error? → 500 + audit log          │  │
│  │  6. Audit Log (SHA-256) ─ Immutable record created           │  │
│  │  7. Response ────────── JSON + success flag                   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │  Compliance     │  │  Maker-Checker  │  │  PII Masking     │   │
│  │  Middleware     │  │  Engine         │  │  Layer            │   │
│  └─────────────────┘  └─────────────────┘  └──────────────────┘   │
│                                                                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│               SQLite Database (Prisma ORM)                          │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  30+ Models:                                                  │  │
│  │  User | AMLAlert | Claim | CorporateKYC | IndividualKYC      │  │
│  │  GoAMLFiling | MakerCheckerLog | SARCase | ComplianceAlert   │  │
│  │  SanctionsScreening | AuditLog | Policy | TrainingCourse     │  │
│  │  ComplianceCase | RiskAssessment | QuarterlyReport | VASPKYC │  │
│  │  CalendarEvent | Notification | RemediationAction | ...      │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                   AI Infrastructure (On-Premise)                    │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │  Ollama LLM     │  │  AI Gateway     │  │  Qdrant Vector   │   │
│  │  (Local Inf.)   │  │  (Routing)      │  │  (RAG Index)     │   │
│  └─────────────────┘  └─────────────────┘  └──────────────────┘   │
│                                                                     │
│  All data remains within UAE jurisdiction — no external API calls    │
└─────────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Responsibility | Key Technologies |
|---|---|---|
| **Browser SPA** | User interaction, client state, optimistic updates | React 19, Zustand, TanStack Query |
| **API Routes** | Validation, authorization, business logic, audit | Next.js 16, Zod, Prisma, NextAuth.js |
| **Database** | Persistent storage, data integrity, relationships | SQLite, Prisma ORM |
| **AI Infrastructure** | On-premise inference, RAG, compliance analysis | Ollama, AI Gateway, Qdrant |

---

## 6. API Route Organization

IC-OS exposes 45+ REST API endpoints organized by compliance domain. All endpoints follow consistent patterns:

- **GET** — List/retrieve records with optional filtering and role-based access
- **POST** — Create new records (validated via Zod, guarded via authGuard)
- **PATCH** — Update existing records (partial updates, validated via Zod)
- **DELETE** — Soft-delete where permitted (hard delete prohibited for compliance data)

### Route Categories

| Route | Methods | Description | Key Features |
|---|---|---|---|
| `/api/aml` | GET, POST, PATCH | AML alert CRUD | Risk scoring, AI flags, status transitions |
| `/api/claims` | GET, POST, PATCH | Claims management | 4-persona filtering, SIU fraud threshold |
| `/api/kyc` | GET, POST | Corporate & Individual KYC | UBO identification, PEP screening, EDD triggers |
| `/api/kyc-upload` | POST | KYC document upload | File hashing, AI verification |
| `/api/vasp-kyc` | GET, POST | VASP-specific KYC | Travel Rule, default HIGH risk, mandatory EDD |
| `/api/goaml` | GET, POST, PATCH | goAML filing management | Status workflow, reference tracking |
| `/api/goaml-xml` | POST | goAML XML generation | STR, SAR, CTR, IFT, PNMR templates, v4.2 compliant |
| `/api/sanctions` | GET, POST | Sanctions screening | Fuzzy matching, fail-closed, idempotency keys |
| `/api/sanctions-exceptions` | GET, POST | Sanctions exception management | Sunset dates, compensating controls, CBUAE notification |
| `/api/compliance-alerts` | GET, POST | Immutable compliance alerts | Fail-closed, SHA-256 integrity, isImmutable flag |
| `/api/sar-deadlines` | GET, POST | SAR case deadline tracking | 30-day FDL 10/2025 enforcement, tipping-off warnings |
| `/api/maker-checker` | GET, POST, PATCH | Maker-Checker queue | 4-eyes principle, expiry enforcement |
| `/api/compliance-cases` | GET, POST | Unified compliance cases | Cross-module linking (alerts, KYC, SARs, sanctions) |
| `/api/policies` | GET, POST, PATCH | Policy lifecycle | Version control, AI review, approval workflow |
| `/api/policy-wizard` | POST | AI-powered policy drafting | RAG-based generation |
| `/api/attestations` | GET, POST | Policy attestation tracking | IP logging, version tracking |
| `/api/regulations` | GET, POST, PATCH | Regulatory circular management | Ingestion, gap analysis, compliance status |
| `/api/regulatory` | GET | Regulatory intelligence | AI-powered analysis |
| `/api/regulatory-deadlines` | GET | Regulatory deadline tracking | Penalty tracking, source module linkage |
| `/api/labor` | GET, POST, PATCH | Labor law compliance | MOHRE quota tracking |
| `/api/evidence` | GET, POST | Inspection evidence | SHA-256 file hashing, AI verification |
| `/api/audits` | GET, POST, PATCH | Compliance audit management | Findings, remediation tracking |
| `/api/training` | GET, POST, PATCH | Training course & enrollment | Certification tracking, mandatory flagging |
| `/api/training-effectiveness` | GET, POST | Training effectiveness | Pre/post assessment, knowledge gain |
| `/api/quarterly-reporting` | GET, POST | CBUAE quarterly reports | Insurance record assembly, CBUAE submission |
| `/api/cbuae-submission-checker` | POST | Pre-submission validation | CBUAE filing requirements check |
| `/api/risk-assessment` | GET, POST | Risk assessment management | 5-domain matrix, version control |
| `/api/compliance-calendar` | GET, POST | Calendar event management | Cross-module integration, recurring events |
| `/api/compliance` | GET | Compliance metrics aggregation | Dashboard-ready metrics |
| `/api/dashboard` | GET | Dashboard data aggregation | KRI metrics, compliance scores |
| `/api/analytics/aggregate` | GET | Live analytics aggregations | Real-time compliance analytics |
| `/api/notifications` | GET, POST, PATCH | Notification management | Priority-based, deep linking, expiry |
| `/api/remediations` | GET, POST, PATCH | Remediation action tracking | Audit finding linkage, evidence |
| `/api/cases` | GET, POST | Legal case management | AI-powered case summaries |
| `/api/ubo-tree` | GET | UBO ownership visualization | Ownership chain traversal |
| `/api/idempotency` | POST | Idempotency key management | Duplicate prevention for critical operations |
| `/api/ai` | POST | AI chat (basic) | Compliance Q&A |
| `/api/ai/chat` | POST | AI chat (streaming) | Context-aware conversations |
| `/api/ai/enhanced` | POST | AI chat (enhanced) | Multi-module context |
| `/api/ai/policy-rag` | POST | Policy RAG queries | Vector-search policy analysis |
| `/api/auth/[...nextauth]` | GET, POST | NextAuth.js authentication | Session management, role extraction |
| `/api/health` | GET | System health check | DB connectivity, security posture, service status |
| `/api/investigation/context` | GET | Investigation context for Unified Workspace | Customer 360, timeline, AI rationale aggregation |
| `/api/alerts/bulk-adjudicate` | POST | Bulk false positive adjudication | Max 500 alerts, chunked processing (100/batch), shared-attribute validation |
| `/api/analytics/fraud-ring` | GET | Fraud ring graph analytics | Node-edge structure, cluster detection, CRITICAL/HIGH risk classification |
| `/api/admin/sanctions-shock` | POST | Overnight sanctions mass freeze | Dual-confirmation (MLRO+CEO), IP audit trail, 3/hour rate limit |
| `/api/audit/generate-data-room` | POST | Regulator-in-a-box audit response | 72-hour access token, PII-masked documents, SHA-256 integrity hash |
| `/api/ai/draft-sar` | POST | AI-powered SAR draft generation | CBUAE regulatory references, autonomous narrative drafting |

### Response Format

All API responses follow a consistent envelope:

```json
{
  "success": true,
  "data": { ... },
  "meta": { "total": 42, "page": 1 }
}
```

Error responses include regulatory references where applicable:

```json
{
  "success": false,
  "error": "Permission denied",
  "message": "Role \"compliance_officer\" does not have permission \"canFileSAR\"",
  "role": "compliance_officer",
  "permission": "canFileSAR",
  "regulatoryRef": "FDL 10/2025 Art. 8; CR 134/2025 Art. 10-11"
}
```

---

## 7. Data Flow: Compliance Event → Audit Trail

This section traces a complete compliance event — filing a SAR — through every system layer, showing how it is processed, authorized, recorded, and immutably preserved.

### Scenario: MLRO Files a SAR

```
┌─────────────────────────────────────────────────────────────────────┐
│ Step 1: User Action (Browser)                                       │
│                                                                     │
│ MLRO clicks "File SAR" in the goAML Filing Center                  │
│ → React Query mutation fires POST /api/goaml                       │
│ → Request body includes subjectName, amountAED, narrative, etc.    │
│ → Loading state shown; button disabled to prevent double-submit    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│ Step 2: Zod Validation (API Route)                                  │
│                                                                     │
│ createGoAMLFilingSchema.safeParse(body)                             │
│ ✓ reportType is valid enum: STR | SAR | CTR | IFT | PNMR          │
│ ✓ subjectName is non-empty string                                   │
│ ✓ amountAED is positive number                                      │
│ Invalid? → 400 + field-level error details                          │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│ Step 3: Authorization (authGuard + RBAC)                            │
│                                                                     │
│ authGuard({ allowedRoles: ['mlro', 'admin'] })                      │
│ ✓ Session exists and user role is 'mlro'                            │
│ ✓ checkPermission('mlro', 'canFileSAR') === true                    │
│ ✓ requiresMakerChecker('canFileSAR') === true                       │
│                                                                     │
│ Since Maker-Checker is required:                                    │
│ ✓ A Maker-Checker log is created with status PENDING                │
│ ✓ The filing status is set to PENDING_APPROVAL                      │
│ ✓ The MLRO (maker) cannot self-approve                              │
│ Unauthorized? → 403 + regulatory reference                          │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│ Step 4: Tipping-Off Check                                           │
│                                                                     │
│ checkTippingOffRisk({                                               │
│   action: 'FILE_SAR',                                              │
│   targetType: 'sar',                                               │
│   targetId: filing.id,                                             │
│   userId: mlro.id,                                                 │
│   userRole: 'mlro',                                                │
│ })                                                                  │
│ ✓ No communication to SAR subject detected                          │
│ ✓ No tipping-off keywords in external correspondence                │
│ Risk level: 'low' — Warning displayed: "Handle with strict          │
│ confidentiality per FDL 10/2025 Art. 12"                            │
│ Blocked? → 403 + legal warning + MLRO notification                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│ Step 5: Prisma Operation (Database)                                 │
│                                                                     │
│ // Create the goAML filing record                                    │
│ const filing = await db.goAMLFiling.create({                        │
│   data: {                                                           │
│     reportType: 'SAR',                                             │
│     referenceNumber: 'SAR-2025-00142',                             │
│     subjectName: parsed.data.subjectName,                           │
│     amountAED: parsed.data.amountAED,                              │
│     filingStatus: 'PENDING_APPROVAL',                              │
│     xmlPayload: generateGoAMLXML(parsed.data),                      │
│   }                                                                 │
│ });                                                                 │
│                                                                     │
│ // Create linked SAR case with 30-day deadline                      │
│ const sarCase = await db.sARCase.create({                           │
│   data: {                                                           │
│     caseNumber: 'SARC-2025-00089',                                 │
│     filingDeadline: addDays(new Date(), 30), // FDL 10/2025 Art. 8  │
│     triggerDate: new Date(),                                        │
│     tippingOffWarning: true,                                        │
│     status: 'DRAFT',                                               │
│     subjectName: parsed.data.subjectName,                           │
│   }                                                                 │
│ });                                                                 │
│                                                                     │
│ // Create compliance alert for SAR deadline                         │
│ await db.complianceAlert.create({                                   │
│   data: {                                                           │
│     alertType: 'SAR_DEADLINE',                                     │
│     severity: 'critical',                                          │
│     title: `SAR Filing Deadline: ${sarCase.caseNumber}`,           │
│     dueDate: sarCase.filingDeadline,                               │
│     isImmutable: true,                                             │
│     sha256Hash: computeHash(alertData),                             │
│   }                                                                 │
│ });                                                                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│ Step 6: Audit Log Entry (SHA-256)                                   │
│                                                                     │
│ await createAuditLog({                                              │
│   userId: mlro.id,                                                  │
│   action: 'SAR_FILING_INITIATED',                                  │
│   resourceType: 'GoAMLFiling',                                     │
│   resourceId: filing.id,                                           │
│   changes: {                                                        │
│     reportType: 'SAR',                                             │
│     amountAED: parsed.data.amountAED,                              │
│     filingStatus: 'PENDING_APPROVAL',                              │
│   },                                                                │
│ });                                                                 │
│                                                                     │
│ // SHA-256 hash computed from:                                      │
│ // { userId, action, resourceType, resourceId, timestamp, changes } │
│ // Hash: "a3f8c9d2e1b4..."                                         │
│ // This entry is IMMUTABLE — cannot be updated or deleted           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│ Step 7: Response & Cache Invalidation (Browser)                     │
│                                                                     │
│ // API responds with the created filing                             │
│ { success: true, data: filing }                                     │
│                                                                     │
│ // React Query mutation onSuccess:                                  │
│ queryClient.invalidateQueries({ queryKey: ['goaml-filings'] })     │
│ queryClient.invalidateQueries({ queryKey: ['sar-cases'] })         │
│ queryClient.invalidateQueries({ queryKey: ['compliance-alerts'] }) │
│ queryClient.invalidateQueries({ queryKey: ['dashboard'] })         │
│                                                                     │
│ // UI updates:                                                      │
│ // - Filing appears in goAML list with PENDING_APPROVAL badge       │
│ // - SAR case appears in SAR deadline tracker                       │
│ // - Compliance alert appears in Command Center                     │
│ // - Dashboard KRI metrics recalculate                              │
│ // - Maker-Checker queue shows new pending approval                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Audit Trail Integrity Verification

At any point in the future, an auditor can verify the integrity of any audit log entry:

```typescript
// Recompute the hash from the stored data
const hashPayload = JSON.stringify({
  userId: log.userId,
  action: log.action,
  resourceType: log.resource,
  resourceId: log.resourceId,
  timestamp: log.createdAt.toISOString(),
  changes: log.details,
});
const computedHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

// Compare with stored hash
const isIntact = computedHash === log.sha256Hash;
// If false → evidence of tampering → immediate security incident
```

### Cross-Module Linkage

The SAR filing above creates a web of interconnected records:

```
GoAMLFiling (SAR-2025-00142)
  ├── MakerCheckerLog (pending approval)
  ├── SARCase (SARC-2025-00089)
  │   └── ComplianceAlert (SAR_DEADLINE, critical)
  ├── ComplianceCase (if linked to existing investigation)
  │   ├── linkedAlertIds: [...]
  │   ├── linkedKYCIds: [...]
  │   └── linkedSanctionsIds: [...]
  ├── AuditLog (SAR_FILING_INITIATED + SHA-256)
  └── Notification (to Compliance Manager for review)
```

This cross-module linking ensures that any compliance event is traceable across the entire system — from the originating alert through the SAR filing to the final goAML submission — with immutable proof at every step.

---

## 8. Unified Investigator Workspace Architecture

The v7.2 Master Enhancement introduces the **Unified Investigator Workspace** — a purpose-built "War Room" interface that consolidates all investigation data into a single, high-performance view. This architecture is designed for AML investigators who need to rapidly assess risk, trace fund flows, and take regulatory action without context-switching between modules.

### 8.1 War Room 3-Pane Layout

The War Room uses a `ResizablePanelGroup` with three adjustable panes, each containing memoized sub-components for 60fps rendering during pane resizing.

**Left Pane: Customer 360° Profile**

Displays a comprehensive customer dossier aggregated from multiple data sources:

- **Risk Score Hero** — Prominent risk score display with color-coded severity indicator and historical trend sparkline
- **Alert Info** — Active alert summary with severity badges, status, and assigned investigator
- **Customer Profile** — Name, Emirates ID (PII-masked), nationality, account type, relationship duration
- **Sanctions Screening** — Real-time sanctions screening results with match confidence, list source (OFAC, UN, EU, local), and screening timestamp
- **Adverse Media** — Aggregated adverse media hits with source classification and relevance scoring

**Center Pane: Transaction Timeline + Fund Flow Network Graph**

Combines chronological and network visualization for complete transaction analysis:

- **Transaction Timeline** — Unified event timeline aggregating events from AMLAlert, Transaction, GoAMLFiling, SARCase, and ComplianceCase into a single chronological stream with color-coded event types
- **Fund Flow Network Graph** — SVG-based network visualization rendering:
  - Nodes represent entities (accounts, individuals, companies) with size proportional to transaction volume
  - Edges represent fund flows with directional arrows and amount labels
  - Color-coded risk indicators: red (high risk), orange (medium risk), green (low risk), gray (unrated)
  - Interactive: click nodes for detail overlay, hover edges for flow summary
  - Positions computed via `useMemo` to prevent recalculation on every render

**Right Pane: AI Rationale Panel + Action Panel**

Provides explainable AI output and regulatory action buttons:

- **AI Confidence Bar** — Horizontal progress bar showing AI model confidence (0-100%) for the current risk assessment
- **Explainable AI Summary** — Human-readable explanation of why the AI flagged this alert, with key contributing factors highlighted
- **Red Flags** — Bullet list of specific red flags identified by the AI, each with regulatory reference (FDL 10/2025, CR 134/2025)
- **Risk Factor Breakdown** — Tabular breakdown of risk factors (geographic, transactional, behavioral, profile-based) with individual scores and weights
- **Action Panel** — Three action buttons with `AlertDialog` confirmation requiring written justification:
  - **Dismiss** — Mark alert as false positive with justification
  - **Escalate** — Escalate to MLRO with escalation reason
  - **File SAR** — Initiate SAR filing with AI-drafted narrative

**Performance Architecture:**

```typescript
// All sub-components wrapped with React.memo for 60fps pane resizing
const Customer360Profile = React.memo(({ customerId, alertId }: Props) => { ... });
const FundFlowGraph = React.memo(({ nodes, edges }: GraphProps) => { ... });
const TransactionTimeline = React.memo(({ events }: TimelineProps) => { ... });
const AIRationalePanel = React.memo(({ alertId }: AIRationaleProps) => { ... });
const ActionPanel = React.memo(({ onDismiss, onEscalate, onFileSAR }: ActionProps) => { ... });

// useMemo for computed positions and filtered data
const graphPositions = useMemo(() => computeSVGPositions(nodes, edges), [nodes, edges]);
const timelineEvents = useMemo(() => aggregateEvents(alerts, transactions, filings), [alerts, transactions, filings]);
const fundFlowNodes = useMemo(() => buildFundFlowGraph(transactions), [transactions]);

// useCallback for action handlers to prevent unnecessary re-renders
const handleDismiss = useCallback((justification: string) => { ... }, [alertId]);
const handleEscalate = useCallback((reason: string) => { ... }, [alertId]);
const handleFileSAR = useCallback(() => { ... }, [alertId]);

// keepPreviousData for seamless alert switching
const { data } = useQuery({
  queryKey: ['investigation-context', alertId],
  queryFn: () => fetch(`/api/investigation/context?alertId=${alertId}`),
  placeholderData: keepPreviousData,
});
```

### 8.2 Fraud Ring Graph Data Model

The fraud ring analytics endpoint identifies clusters of related claims that may indicate organized fraud rings.

**API: `GET /api/analytics/fraud-ring`**

**Query Logic:**

1. Queries all `Claim` records within the specified lookback window (default: 90 days)
2. Identifies shared entities — claims that share the same claimant, policy number, or assigned adjuster
3. Builds a node-edge graph structure:
   - **Nodes:** Unique entities (claimants, policies, adjusters, claim IDs)
   - **Edges:** Relationships between entities ("filed by", "assigned to", "covered by")
4. Applies cluster detection algorithm:
   - **CRITICAL:** >3 claims sharing >2 nodes → organized fraud ring indicator
   - **HIGH:** 2-3 claims sharing >2 nodes → potential fraud ring
   - **MEDIUM:** 2 claims sharing 1-2 nodes → possible coincidence
   - **LOW:** No significant shared entities

**Database Indexes:**

```sql
-- Composite indexes for efficient fraud ring queries
CREATE INDEX idx_claim_policy_status ON Claim(policyNumber, status);
CREATE INDEX idx_claim_claimant ON Claim(claimantName);
CREATE INDEX idx_claim_siu_flagged ON Claim(siuFlagged, fraudScore);
```

**Response Structure:**

```json
{
  "success": true,
  "data": {
    "nodes": [
      { "id": "CLM-2025-00042", "type": "claim", "label": "Claim #42", "riskScore": 0.85 },
      { "id": "claimant-ahmed", "type": "claimant", "label": "A. A.", "sharedClaims": 3 },
      { "id": "policy-POL-789", "type": "policy", "label": "POL-789", "sharedClaims": 2 }
    ],
    "edges": [
      { "source": "CLM-2025-00042", "target": "claimant-ahmed", "type": "filed_by" },
      { "source": "CLM-2025-00042", "target": "policy-POL-789", "type": "covered_by" }
    ],
    "clusters": [
      {
        "id": "cluster-1",
        "riskLevel": "CRITICAL",
        "nodeCount": 7,
        "sharedNodeCount": 4,
        "claimCount": 4,
        "totalAmount": 1250000
      }
    ]
  }
}
```

### 8.3 External Integration Adapter Pattern

IC-OS v7.2 introduces a provider-agnostic adapter layer for three critical GCC regulatory integrations. Each adapter follows a consistent pattern: provider abstraction, fail-closed error handling, rate limiting, and audit logging.

**Adapter Interface:**

```typescript
interface ExternalAdapter<TConfig, TRequest, TResponse> {
  provider: string;
  execute(request: TRequest, config: TConfig): Promise<TResponse>;
  rateLimiter: RateLimiter;
  auditLog: (action: string, details: Record<string, unknown>) => Promise<void>;
}
```

#### Identity Provider Adapter

- **Providers:** UAE Pass (OAuth2 + biometric), KSA Nafath (OAuth2 + biometric)
- **Flow:** OAuth2 authorization code grant → biometric verification → identity assertion
- **Rate Limit:** 10 requests/minute per client
- **Fail-Closed:** On provider error, identity verification returns `VERIFICATION_FAILED` (blocks onboarding)
- **Audit:** All verification attempts logged with provider, timestamp, and result

#### Screening Provider Adapter

- **Providers:** Dow Jones Risk & Compliance, Refinitiv World-Check
- **Flow:** Entity query → result aggregation → score normalization
- **Caching:** 24-hour cache per entity (keyed by entity identifier + provider)
- **Score Normalization:** Provider-specific scores normalized to 0-100 scale for consistent risk assessment
- **Rate Limit:** 20 requests/minute per client
- **Fail-Closed:** On provider error or rate limit exceeded, returns result with `highestScore: 100` (conservative — treats unknown as highest risk)
- **Cache Hit Indicator:** Responses include `cacheHit: boolean` field

```typescript
// Screening adapter fail-closed pattern
const result = await screeningAdapter.execute(entityQuery, config);
// On error: { highestScore: 100, cacheHit: false, providerError: true }
// On cache hit: { highestScore: 42, cacheHit: true, providerError: false }
```

#### Regulatory Gateway Adapter

- **Providers:** goAML Direct API (mutual TLS), RPA Simulation (fallback)
- **Flow:** Construct XML payload → mutual TLS handshake → submit → receive acknowledgment
- **Idempotency:** Each submission includes a client-generated idempotency key (SHA-256 of payload)
- **Integrity:** SHA-256 hash of the complete XML payload included in the submission metadata
- **Retry:** Exponential backoff on transient failures (initial delay: 1s, max delay: 30s, max retries: 3)
- **Rate Limit:** 5 requests/minute per client
- **Fail-Closed:** On submission failure, returns `SUBMISSION_FAILED` with detailed error context

```typescript
// Regulatory gateway retry with exponential backoff
const result = await regulatoryAdapter.execute(xmlPayload, {
  idempotencyKey: sha256(xmlPayload),
  retryOptions: { initialDelay: 1000, maxDelay: 30000, maxRetries: 3 },
});
```

**Rate Limiting Summary:**

| Adapter | Rate Limit | Fail-Closed Behavior |
|---|---|---|
| Identity Provider | 10 req/min | `VERIFICATION_FAILED` |
| Screening Provider | 20 req/min | `highestScore: 100` |
| Regulatory Gateway | 5 req/min | `SUBMISSION_FAILED` |

### 8.4 Performance Optimizations

IC-OS v7.2 includes comprehensive performance optimizations across the database, API, and frontend layers.

**Database Layer:**

- **44 composite indexes** across 15 models for sub-200ms query performance on all indexed queries
- Key indexes include:
  - `Claim(policyNumber, status)` — fraud ring cluster detection
  - `Claim(claimantName)` — shared entity lookup
  - `Claim(siuFlagged, fraudScore)` — SIU persona filtering
  - `AMLAlert(riskLevel, status)` — triage queue sorting
  - `GoAMLFiling(filingStatus, reportType)` — filing dashboard queries
  - `AuditLog(createdAt, action)` — audit trail pagination
  - `ComplianceAlert(severity, isImmutable)` — immutable alert retrieval

**Frontend Layer:**

- `React.memo` on all War Room sub-components (Customer360Profile, FundFlowGraph, TransactionTimeline, AIRationalePanel, ActionPanel)
- `useMemo` for SVG graph positions, timeline events, and fund flow nodes — prevents expensive recomputation on every render
- `useCallback` for action handlers (dismiss, escalate, file SAR) and refresh callbacks — prevents unnecessary child re-renders
- `keepPreviousData` (TanStack Query v5) for seamless alert switching without loading flicker

**Bulk Operations:**

- Bulk adjudication uses chunked processing: 100 items per batch, maximum 500 items per request
- Each chunk is processed in a separate database transaction for partial success handling
- Shared-attribute validation runs before processing to ensure all alerts in a batch share at least one common attribute (risk level, alert type, or assigned officer)

```typescript
// Bulk adjudication chunking
const CHUNK_SIZE = 100;
const MAX_BATCH_SIZE = 500;

if (alertIds.length > MAX_BATCH_SIZE) {
  return NextResponse.json(
    { success: false, error: `Maximum ${MAX_BATCH_SIZE} alerts per batch` },
    { status: 400 }
  );
}

const chunks = [];
for (let i = 0; i < alertIds.length; i += CHUNK_SIZE) {
  chunks.push(alertIds.slice(i, i + CHUNK_SIZE));
}

const results = await Promise.all(
  chunks.map(chunk => processAdjudicationChunk(chunk, adjudication, userId))
);
```

### 8.5 Security Hardening

v7.2 adds multiple security hardening measures focused on external integration safety, PII protection, and sanctions operation integrity.

**External Integration Rate Limiting:**

All external integration adapters enforce request quotas to prevent API exhaustion and abuse:
- Identity Provider: 10 req/min — prevents brute-force identity verification
- Screening Provider: 20 req/min — prevents screening API exhaustion
- Regulatory Gateway: 5 req/min — prevents goAML submission flooding
- All rate limits return standard 429 responses with `Retry-After`, `X-RateLimit-Limit`, and `X-RateLimit-Remaining` headers

**PII Masking in Audit Data Room:**

The audit data room (`POST /api/audit/generate-data-room`) applies comprehensive PII masking using 12 field-specific mask functions from `@/lib/pii`:

| Mask Function | Applied To | Example Output |
|---|---|---|
| `maskName` | Customer names | `"A. A."` |
| `maskEmiratesId` | Emirates ID numbers | `"784-****-****7-1"` |
| `maskPassport` | Passport numbers | `"A1******"` |
| `maskPhone` | Phone numbers | `"+971***4567"` |
| `maskEmail` | Email addresses | `"a***@company.ae"` |
| `maskAccountNumber` | Bank account numbers | `"***********23456"` |
| `maskTradeLicense` | Trade license numbers | `"CN-****"` |
| `maskTRN` | Tax Registration Numbers | `"100**********3"` |
| `maskAmount` | Transaction amounts | `"AED **,***"` |
| `maskAddress` | Physical addresses | `"***, Dubai"` |
| `maskFull` | Highly sensitive fields | `"********"` |
| `maskNone` | Non-sensitive fields | Unchanged |

**Dual-Confirmation Sanctions Mass Freeze:**

The sanctions mass freeze operation (`POST /api/admin/sanctions-shock`) requires dual confirmation per the 4-Eyes Principle:

1. **Initiator** (MLRO) triggers the mass freeze for a geopolitical sanctions shock event
2. **Confirmer** (CEO or designated executive) must confirm the freeze — the system enforces `initiator !== confirmer`
3. Both user IDs, IP addresses, and timestamps are recorded in a **single audit record** for regulatory traceability
4. Rate limited to **3 executions per hour per IP address** to prevent accidental or malicious mass freeze operations

```typescript
// Sanctions shock dual-confirmation enforcement
if (initiator.userId === confirmer.userId) {
  return NextResponse.json(
    { success: false, error: 'Initiator and confirmer must be different users (4-Eyes Principle)' },
    { status: 403 }
  );
}

// Rate limit: 3 executions per hour per IP
const recentExecutions = await countRecentSanctionsShocks(initiator.ipAddress, 60);
if (recentExecutions >= 3) {
  return NextResponse.json(
    { success: false, error: 'Sanctions shock rate limit exceeded (3/hour per IP)' },
    { status: 429 }
  );
}

// Single audit record with both users
await createAuditLog({
  action: 'SANCTIONS_MASS_FREEZE',
  details: {
    initiatorId: initiator.userId,
    initiatorIp: initiator.ipAddress,
    initiatorTimestamp: initiator.timestamp,
    confirmerId: confirmer.userId,
    confirmerIp: confirmer.ipAddress,
    confirmerTimestamp: confirmer.timestamp,
    accountsFrozen: frozenAccountIds.length,
  },
});
```

---

## 9. Scenario-Based RAG Knowledge Base

IC-OS v7.2 introduces a **Scenario-Based RAG (Retrieval-Augmented Generation) Knowledge Base** — an AI-powered compliance assistant that delivers instant, accurate regulatory guidance grounded in a curated 122-scenario database. The system is designed with a **zero-hallucination** guarantee: every response is traceable to a specific knowledge base entry, and the LLM is never permitted to generate answers outside the retrieved context.

### Data Flow

```
┌──────────────┐    ┌──────────────────────────┐    ┌─────────────────────┐    ┌──────────────────┐
│  User Query  │───▶│  In-Memory Scoring /     │───▶│  LLM Context        │───▶│  Streamed         │
│  (Chat)      │    │  Fallback Text Search    │    │  Injection           │    │  Response         │
└──────────────┘    └──────────────────────────┘    └─────────────────────┘    └──────────────────┘
```

**Step-by-step:**

1. **User Query** — The compliance officer or MLRO submits a natural-language question via the AI Compliance Assistant chat interface (e.g., "What are the requirements for early surrender of policies during an active investigation?").

2. **In-Memory Scoring / Fallback Text Search** — The query is processed against the 122-scenario knowledge base using a multi-factor in-memory scoring algorithm that evaluates keyword overlap, semantic proximity, and regulatory domain matching. If the scoring engine is unavailable (e.g., during initialization or memory pressure), the system gracefully degrades to a deterministic fallback text search that performs substring and keyword matching against scenario titles and content.

3. **LLM Context Injection** — The top-ranked scenario(s) are injected as structured context into the LLM prompt. The system prompt enforces a strict grounding constraint: the LLM may only synthesize from the provided context and must cite the specific scenario reference (e.g., "Pack 5, Scenario 12"). If no scenario scores above the relevance threshold, the LLM is instructed to respond with a transparent "no matching guidance found" message rather than fabricating an answer.

4. **Streamed Response** — The LLM's response is streamed back to the client in real-time via Server-Sent Events (SSE), providing immediate feedback as the answer is generated. Each response includes the scenario reference, regulatory citation (FDL 10/2025, CR 134/2025), and a confidence indicator.

### Knowledge Base Structure

| Property | Value |
|---|---|
| **Total Scenarios** | 122 |
| **Storage** | In-memory (loaded at startup) with SQLite persistence |
| **Scenario Packs** | Organized by compliance domain (Pack 1–12) |
| **Compatibility** | SQLite (production) — no external vector DB required for basic operation |
| **Fallback** | Text-based keyword search when scoring engine is unavailable |

### Zero-Hallucination Design

The zero-hallucination architecture is enforced at three levels:

1. **Retrieval Gate** — If no scenario scores above the minimum relevance threshold, the system returns a "no matching guidance found" response instead of allowing the LLM to answer from its training data.
2. **Context-Only Generation** — The LLM system prompt explicitly prohibits generating information not present in the injected context. Any attempt to introduce external knowledge is blocked at the prompt level.
3. **Citation Requirement** — Every response must reference the specific scenario pack and scenario number from which the guidance was derived, enabling auditors to verify the source.

### API Endpoint

The RAG chatbot is exposed via the existing AI chat infrastructure:

- `POST /api/ai/chat` — Streaming RAG queries with scenario-based context injection
- The `ragMode` parameter activates scenario scoring and context injection
- Responses include `scenarioRef` and `confidence` fields for traceability

---

## 10. Security & Hardening (v7.2 Batches 1–4)

The v7.2 hardening initiative addressed 41 findings from a comprehensive gap analysis, resolving 38 actionable items across 6 batches. This section documents the security, performance, and resilience measures introduced in Batches 1–4.

### 10.1 Authentication & Authorization (Batch 1)

**AuthGuard Enforcement:**
All 43 API routes that previously lacked authentication now enforce `authGuard()` with role-based access control. Every route handler follows the pattern:

```typescript
const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_officer'] });
if (!auth.authorized) return auth.error;
```

- Unauthorized access returns `401` (no session) or `403` (insufficient role)
- Dev mode bypass: In `NODE_ENV=development`, a synthetic `admin` user is injected for rapid prototyping (flagged as C5 — must be disabled in production)
- RBAC matrix enforced per route: MLRO-only for SAR operations, compliance_officer for KYC, admin for user management

**Mass Assignment Prevention:**
All API body schemas now use `.strict()` to reject unknown keys, preventing mass assignment attacks. The KYC PUT endpoint (`/api/kyc`) uses `z.discriminatedUnion()` to enforce type-safe, field-locked updates:

```typescript
const updateKYCSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('corporate'), legalName: z.string().min(1), ... }).strict(),
  z.object({ type: z.literal('individual'), firstName: z.string().min(1), ... }).strict(),
]);
```

**LLM SDK Timeouts:**
All AI/LLM SDK calls are wrapped in `Promise.race()` with a 30-second timeout to prevent hanging connections from blocking the event loop:

```typescript
const result = await Promise.race([
  llmClient.chat(prompt),
  new Promise((_, reject) => setTimeout(() => reject(new Error('LLM timeout')), 30_000)),
]);
```

### 10.2 PII Masking Strategy (Batch 2)

**GCC-Specific Regex Patterns:**
The PII masking library (`@/lib/pii`) implements 12 field-specific mask functions with GCC format awareness:

| Function | Pattern | Example |
|---|---|---|
| `maskEmiratesId` | UAE 784-YYYY-NNNNNNN-C | `"784-****-****567-1"` |
| `maskName` | Multi-part name → initials | `"M.A.A."` |
| `maskIBAN` | UAE IBAN (23 chars) | `"AE07***************3456"` |
| `maskPhone` | +971 format | `"+971-***-**4567"` |
| `maskPassport` | GCC alphanumeric | `"******678"` |
| `maskEmail` | Standard email | `"a***@company.ae"` |
| `maskAccountNumber` | Bank account / IBAN | `"***********23456"` |
| `maskTradeLicense` | Trade license | `"CN-****"` |
| `maskTRN` | Tax Registration Number | `"100**********3"` |
| `maskAmount` | Monetary values | `"AED **,***"` |
| `maskAddress` | Physical addresses | `"***, Dubai"` |
| `maskFull` | Highly sensitive fields | `"********"` |

**sanitizeObject() Recursive Traversal:**
The `sanitizeObject()` function recursively traverses any object or array and applies PII masking to fields matching known sensitive field name patterns via `FIELD_MASK_MAP`. It supports:
- Auto-detection via 14 regex field-name patterns
- Explicit field lists for targeted masking
- Date object preservation (converts to ISO strings, not `[object Object]`)
- Depth guard (max 10 levels) to prevent infinite recursion

**Role-Based Response Masking:**
API responses apply PII masking based on the requesting user's role:

| Role | List View | Detail/Edit View |
|---|---|---|
| `admin`, `mlro`, `compliance_manager`, `compliance_officer` | Masked (sensitive fields only) | Unmasked |
| `auditor`, `external`, `readonly`, `board` | Fully masked | Fully masked |
| Unknown | Fully masked (fail-safe) | Fully masked (fail-safe) |

**AI Response PII Stripping:**
The `stripPIIFromText()` function applies inline regex replacement to AI chat responses, catching any PII that the LLM might inadvertently include (Emirates IDs, IBANs, phone numbers, emails, passport numbers).

**Audit Trail PII Sanitization:**
Audit log entries sanitize `details` and `changes` fields before storage, while computing the SHA-256 hash from the **original** (unsanitized) data to preserve integrity verification capability.

### 10.3 Tiered Rate Limiting (Batch 3)

All 64+ API route handlers are protected with per-userId rate limiting using a 3-tier system:

| Tier | Limit | Use Case | Key Prefix |
|---|---|---|---|
| **READ** | 100 req/min/user | Dashboards, lists, analytics GET | `tier:read` |
| **WRITE** | 30 req/min/user | POST/PUT/PATCH/DELETE mutations | `tier:write` |
| **SENSITIVE** | 10 req/min/user | AI endpoints, bulk ops, data room | `tier:sensitive` |

**Key Design Decisions:**
- Rate limiting is per-userId (from `authGuard` session), not per-IP — prevents false 429s on corporate NATs
- 429 responses include `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers
- In-memory store with 5-minute automatic cleanup of expired entries
- Frontend React Query uses `staleTime` and caching to avoid unnecessary API calls that could trigger rate limits

```typescript
// Usage pattern in route handlers
const auth = await authGuard({ allowedRoles: [...] });
if (!auth.authorized) return auth.error;

const rateLimitError = applyRateLimit(auth, request, 'WRITE');
if (rateLimitError) return rateLimitError;
```

### 10.4 RAG Pipeline Hardening (Batch 4)

**Confidence Threshold:**
The RAG pipeline enforces a minimum relevance score (`MIN_RELEVANCE_SCORE = 3`) to prevent low-quality context from reaching the LLM, eliminating hallucination risk from weak matches:

```typescript
if (matchedScenarios.length === 0 || topScore < MIN_RELEVANCE_SCORE) {
  return {
    message: NO_CONTEXT_FALLBACK,
    modelUsed: topScore > 0 ? 'fallback-low-confidence' : 'fallback-no-match',
    topRelevanceScore: topScore,
    confidenceThreshold: MIN_RELEVANCE_SCORE,
  };
}
```

- Low-confidence queries (score < 3) bypass the LLM entirely and return a standardized fallback message
- `modelUsed` field enables observability: `'fallback-low-confidence'` or `'fallback-no-match'`
- Response includes `topRelevanceScore` and `confidenceThreshold` for debugging

### 10.5 Performance Optimization (Batch 4)

**N+1 Query Prevention:**
The investigation context endpoint (`/api/investigation/context`) replaced 8 sequential Prisma queries with a single `Promise.all()` parallel batch:
- CorporateKYC + IndividualKYC now run in parallel (previously sequential fallback)
- ComplianceCase: replaced full-table-scan `findMany()` with filtered `contains` query + `take: 50` cap
- All 8 data sources (KYC, Claims, AdverseMedia, GoAML, SAR, ComplianceCase, Sanctions, KYC2) fetched concurrently

**Fraud Ring Analytics Optimization:**
- Added `limit` param (Zod validated: `z.coerce.number().int().min(1).max(500).default(500)`)
- Seed claim + all claims now fetched in parallel via `Promise.all()`
- Replaced O(n²) cluster detection with Map-based entity aggregation (O(n) single-pass indexing)
- `take: limit` on `findMany` to prevent unbounded result sets

**Pagination Caps on Heavy Endpoints:**
All heavy list endpoints now enforce maximum result limits via Zod schema validation:
- `/api/aml` — `page` + `limit` (max 100) with `skip/take`
- `/api/audit-log` — `limit.max(100)` (tightened from 200)
- `/api/sar-deadlines` — `sarListQuerySchema` with validated `page` + `limit` (max 100)
- `/api/compliance-alerts` — `alertsListQuerySchema` with validated `page` + `limit` (max 100)

### 10.6 30-Day SAR Auto-Escalation (Batch 4)

Per FDL 10/2025 Art. 8 and CBUAE regulatory requirements, the SAR deadline tracking system implements automatic 2-tier escalation:

| Tier | Trigger | Escalation Target | Severity |
|---|---|---|---|
| Tier 1 | `daysRemaining ≤ 5` (≥ 25 days elapsed) | MLRO | High |
| Tier 2 | `daysRemaining ≤ 2` (≥ 28 days elapsed) | Head of Compliance | Critical |

**Escalation Creates:**
1. `ComplianceAlert` (immutable, SHA-256 hashed, `alertType: MLRO_ESCALATION`)
2. `Notification` (priority: high/urgent) to the responsible party
3. `AuditLog` entry (immutable, SHA-256 hashed) with reason: "Auto-escalation due to 30-day regulatory deadline"

**Deduplication:** Checks for existing active `MLRO_ESCALATION` alerts with the same `sourceEntityId` + tier before creating a new escalation.

**Read-Triggered Pattern:** Auto-escalation runs on every GET request to `/api/sar-deadlines` — no separate cron job required.

**Auto-Resolution:** When a SAR case moves to `SUBMITTED_TO_FIU` status, all active `SAR_DEADLINE` and `MLRO_ESCALATION` compliance alerts are automatically resolved.

---

## 11. Frontend Resilience (v7.2 Batch 5)

### 11.1 Error Boundaries

IC-OS implements a 3-tier error boundary strategy to ensure that component crashes are isolated and never take down the entire application:

| Boundary | Scope | Component | Behavior |
|---|---|---|---|
| `ErrorBoundary` | Page-level | `src/components/shared/ErrorBoundary.tsx` | Catches any unhandled error in a module, shows full-page fallback with "Try Again" and "Reload Page" buttons |
| `ModuleErrorBoundary` | Module-level | `src/components/shared/ErrorBoundary.tsx` | Wraps each lazy-loaded module section; shows compact error card with "Retry" button |
| `ComponentErrorBoundary` | Sub-component | `src/components/shared/ComponentErrorBoundary.tsx` | Wraps heavy visualization components (Fraud Ring Graph, Transaction Timeline, Customer 360 Profile); shows localized error card with component name |

**ComponentErrorBoundary** is designed for localized crash prevention: if a sub-component throws, only that part of the UI shows a fallback — the rest of the module remains functional.

```tsx
<ComponentErrorBoundary componentName="Fraud Ring Graph">
  <FundFlowGraph data={graphData} />
</ComponentErrorBoundary>

<ComponentErrorBoundary componentName="Transaction Timeline">
  <TransactionTimeline events={timelineEvents} />
</ComponentErrorBoundary>
```

**Telemetry Integration:** All error boundaries log caught errors via `logError()` from `@/lib/telemetry`, which in development mode outputs to console and stores the last 1000 events in memory for observability.

### 11.2 Skeleton Loaders & Empty States

**Skeleton Loaders** (from `src/components/shared/Skeletons.tsx`):
- `TableSkeleton` — Pulsing placeholder rows for data tables (configurable rows/columns)
- `CardSkeleton` — Placeholder cards for card-based layouts (configurable count)
- `PaneSkeleton` — Vertical stack of placeholder lines for workspace panes

All skeleton components include `role="status"` and `aria-label="Loading data"` for screen reader accessibility.

**Empty State** (from `src/components/shared/EmptyState.tsx`):
Standardized component for when queries return 0 results. Displays:
- A relevant Lucide icon (4 variants: `SearchX`, `ShieldAlert`, `FileQuestion`, `Inbox`)
- A clear heading (e.g., "No Alerts Found")
- A brief description (e.g., "Try adjusting your filters or date range.")
- An optional action button (e.g., "Clear Filters")

```tsx
<EmptyState
  icon="shield"
  title="No Alerts Found"
  description="Try adjusting your filters or date range."
  actionLabel="Clear Filters"
  onAction={() => setFilters({})}
/>
```

**Applied to:**
- AML & Sanctions Triage — `CardSkeleton` during loading, `EmptyState` for zero alerts
- GoAML Filing Center — `TableSkeleton` during loading, `EmptyState` for zero filings
- Audit Trail — `TableSkeleton` during loading, `EmptyState` with "Clear Filters" for zero results

### 11.3 Inline Zod Form Validation

Both the GoAML Filing Center and Corporate KYC Wizard implement inline per-field Zod validation errors:

- Each form field displays its validation error **directly below the field** with `border-destructive` red border
- `validationErrors` state maps field names to error messages
- API 400 responses are parsed and mapped to per-field errors using Zod's `flatten().fieldErrors`
- Toast notifications are preserved alongside inline errors for non-field-specific feedback

```tsx
// Inline error display pattern
<div>
  <Label htmlFor="subjectName">Subject Name</Label>
  <Input
    id="subjectName"
    className={validationErrors.subjectName ? 'border-destructive' : ''}
    ...
  />
  {validationErrors.subjectName && (
    <p className="text-xs text-destructive mt-1">{validationErrors.subjectName}</p>
  )}
</div>
```

### 11.4 TypeScript Strictness

- `noImplicitAny: false` removed from `tsconfig.json` — `strict: true` now fully enforced
- Zero explicit `: any` annotations across `src/` (only 2 justified `any` in generic utility + Prisma middleware)
- Zero active `@ts-ignore` directives (1 commented-out in inactive `regulatory-gateway.ts`)
- All Prisma model types use `Prisma.XGetPayload` for strict typing
- All API schemas use `z.infer<typeof Schema>` for response/request types

### 11.5 Accessibility (a11y)

**Keyboard Navigation:**
- **Slide-to-Confirm** (MLRO Queue): Added `role="slider"`, `aria-valuemin/max/now`, `tabIndex={0}`, focus-visible ring, and keyboard handler (Enter/Space to confirm, ArrowLeft/Right to adjust)
- **Kanban Board** (AML Triage): Added `role="list"` to columns, `role="listitem"` to cards, `aria-label` to column headers, keyboard-accessible "Move to…" status dropdown with `role="listbox"`/`role="option"`
- **Modals/Dialogs**: Already accessible via Radix UI primitives

**ARIA Labels:**
- All icon-only buttons have `aria-label` attributes:
  - AI Assistant: clear chat, expand, close, toggle (4 buttons)
  - Export CSV buttons
  - Search/filter icon buttons
- Chat messages container: `role="log"` + `aria-live="polite"` for screen reader announcements

---

## Appendix: Key Regulatory References

| Reference | Full Title | Key Articles |
|---|---|---|
| **FDL 10/2025** | Federal Decree-Law No. 10 of 2025 on AML/CFT | Art. 7-10 (CDD/KYC), Art. 11 (Record Keeping), Art. 12 (Tipping-Off), Art. 13-14 (SAR/STR), Art. 15 (Internal Controls), Art. 16-18 (Risk Assessment, Sanctions) |
| **CR 134/2025** | Cabinet Resolution No. 134 of 2025 (Implementing Regulation) | Art. 5-9 (CDD), Art. 10-11 (Reporting), Art. 16 (Audit Trail), Art. 17 (Confidentiality), Art. 20 (Policies), Art. 21-24 (Risk Assessment), Art. 25-27 (Sanctions) |
| **CBUAE Notice 3551/2021** | Central Bank Guidance on AML/CFT | S3.1 (Governance), S3.2 (Escalation), S6.2 (Tipping-Off), S9.1 (Training) |
| **goAML v4.2** | UAE FIU Reporting Standard | STR, SAR, CTR, IFT, PNMR report types |

---

## 12. Phase 11: Strategic Module Expansion

### 12.1 Bordereaux Validation Engine

**Purpose:** Automate the validation of broker/cedant bordereaux data before CBUAE quarterly submission, eliminating manual data quality checks.

**Golden Path Flow:**
```
Upload CSV → Parse Headers → Zod Row Validation → Duplicate Detection → Error Report → CBUAE Submission (audit logged)
```

**Data Model:**
- `BordereauxSubmission` — Tracks file metadata, validation status, row counts, and error details
- Links to existing `InsuranceRecord` model via `quarterly-reporting` flow

**API Routes:**
| Route | Method | Purpose |
|---|---|---|
| `/api/bordereaux` | GET | List submissions with pagination |
| `/api/bordereaux/validate` | POST | Upload CSV, validate rows with Zod, return structured error report |
| `/api/bordereaux/submit` | POST | Submit validated bordereaux to CBUAE (only if 100% pass) |

**Validation Schema (`BordereauxRowSchema`):**
- `policyNumber` — Required string
- `insuredName` — Required string
- `premiumAED` — Required non-negative number (comma-stripped)
- `startDate` / `endDate` — Required date (flexible format)
- `brokerId` — Required string
- `productType` — Optional (default: "General")
- `emirate` — Optional enum (7 UAE emirates, default: "Dubai")
- `amlStatus` — Optional enum (CLEARED/FLAGGED/PENDING, default: "PENDING")

**Key Design Decisions:**
- Flexible column mapping — supports common header name variations (e.g., "Policy No", "policy_number", "PolNo")
- Duplicate policy number detection across the entire file
- 100% validation gate — only error-free bordereaux can be submitted
- Downloadable error CSV for offline correction
- SHA-256 audit trail on both validation and submission

### 12.2 ESG / Greenwashing Risk Scanner

**Purpose:** Enhance the existing Adverse Media module with ESG (Environmental, Social, Governance) risk detection, aligned with the UAE Sustainable Finance Framework.

**Data Model Enhancement:**
- `AdverseMediaSession.esgRiskTags` — JSON array of detected ESG tags (default: `[]`)
- `AdverseMediaSession.esgRiskScore` — 0-100 weighted risk score (default: `0`)

**ESG Risk Categories:**
| Category | Weight | Keywords |
|---|---|---|
| GREENWASHING | 25 | greenwashing, false environmental claim, eco fraud, green marketing fraud |
| CARBON_FRAUD | 30 | carbon fraud, carbon credit fraud, emissions manipulation, emission underreporting |
| ENVIRONMENTAL_VIOLATION | 20 | environmental violation, pollution, toxic waste, oil spill, deforestation |
| MODERN_SLAVERY | 35 | forced labor, human trafficking, child labor, supply chain slavery |
| SANCTIONS_EVASION_ESG | 30 | sanctions evasion, embargo violation, dual use goods, export control violation |

**Risk Score Calculation:**
1. Base score from tag severity weights (sum of detected tag weights)
2. Volume adjustment (+10 if >5 keyword hits, +10 if >10)
3. Decision influence (+15 for CONFIRMED_MATCH, +5 for POTENTIAL_MATCH)
4. Capped at 100

**API Route:**
| Route | Method | Purpose |
|---|---|---|
| `/api/adverse-media/esg-scan` | POST | Scan session results for ESG keywords, calculate risk score, update session |

**UI Integration:**
- "ESG Scan" button (Leaf icon) in Results step of Adverse Media workflow
- ESG Risk Badge (Low/Medium/High with score) displayed in results header
- ESG tag badges (color-coded per category) in results panel
- ESG row in Report summary card
- SectionGuide updated with ESG capabilities and UAE Sustainable Finance Framework reference

---

## 13. Future Roadmap (URCREP Blueprint)

The following major modules from the URCREP (Unified Risk, Compliance, and Reinsurance Enterprise Platform) blueprint are **not yet implemented**. They represent a multi-year development roadmap.

### Next Phase (High Priority)
- **Continuous Control Monitoring (CCM)** — Part 29: Automated 24/7 control checks
- **Consumer Protection & Market Conduct** — Parts 1, 23: Complaint tracking, vulnerable customer flagging
- **Dedicated Risk Register** — Part 1: Full risk taxonomy with heatmaps
- **Model Registry / AI Model Passports** — Part 15: Model inventory with drift detection

### Year 2 (Medium Priority)
- **Reinsurance Treaty Administration** — Parts 6, 14, 22: Multi-layered treaty management
- **MGA & Intermediary Oversight** — Part 22: Binding authority and commission tracking
- **Incident & Breach Management** — Part 9: Golden Hour protocol, regulatory clocks
- **Advanced Cyber Resilience** — Part 27: Threat intelligence, automated tabletop exercises

### Year 3+ (Long-Term)
- **Actuarial & Reserving Engine** — Part 19: IFRS 17, multi-method reserving
- **ALM & Investment Portfolio** — Part 26: Duration matching, yield curve stress testing
- **Underwriting & Pricing Engine** — Part 20: GLM/ML pricing, exposure aggregation
- **Digital Twin / War Gaming** — Part 17: Real-time what-if simulation
- **Smart Contracts & Blockchain** — Part 30: Parametric contracts, shared reinsurance ledger
