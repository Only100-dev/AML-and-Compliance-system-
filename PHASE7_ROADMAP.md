# IC-OS Phase 7 Roadmap — Advanced "Nice-to-Have" Features

**Intelligent Control Operating System — Forward-Looking Enhancement Plan**

**Version:** 1.0  
**Date:** 2026-03-05  
**Status:** Planning  
**Prerequisite:** Phase 1–6 Complete (28+ modules, 39+ Prisma models, Golden Path, Maker-Checker, AI Gateway, Qdrant)

---

## Table of Contents

1. [Overview](#overview)
2. [Feature 1: Real-Time WebSocket Notifications](#feature-1-real-time-websocket-notifications)
3. [Feature 2: Advanced RAG for Regulatory Documents](#feature-2-advanced-rag-for-regulatory-documents)
4. [Feature 3: Multi-Tenancy for Subsidiary Entity Management](#feature-3-multi-tenancy-for-subsidiary-entity-management)
5. [Feature 4: SSO Integration with Enterprise Identity Providers](#feature-4-sso-integration-with-enterprise-identity-providers)
6. [Feature 5: Automated Regulatory Change Detection & Impact Analysis](#feature-5-automated-regulatory-change-detection--impact-analysis)
7. [Summary Timeline & Priority Matrix](#summary-timeline--priority-matrix)
8. [Risk Assessment & Mitigations](#risk-assessment--mitigations)

---

## Overview

Phases 1–6 established IC-OS as a production-grade UAE AML/CFT compliance platform with 28+ lazy-loaded modules, a hardened Golden Path pipeline (Zod → authGuard → Prisma → Audit → Cache), Maker-Checker enforcement, on-premise AI via Ollama + Qdrant, and comprehensive regulatory automation (goAML v4.2, SAR 30-day deadlines, sanctions screening, tipping-off prohibition).

Phase 7 introduces five advanced "nice-to-have" capabilities that push the platform from reactive compliance toward **proactive, real-time, and enterprise-scalable** operations. Each feature builds upon existing infrastructure and architectural patterns—no ground-up rewrites required.

### Design Principles for Phase 7

| Principle | Enforcement |
|---|---|
| **Additive Only** | All Phase 7 features must be toggleable via feature flags (`src/lib/env.ts`) and must not break Phase 1–6 functionality when disabled |
| **UAE Data Residency** | No external data egress; all processing remains within UAE jurisdiction (me-central-1) |
| **Golden Path Compliance** | Every new API endpoint follows Zod → authGuard → Prisma → Audit → Cache |
| **Fail-Closed** | Real-time and automated features must degrade gracefully (fail to polling, fail to manual) rather than silently dropping events |
| **On-Premise AI** | All AI features continue to use Ollama + AI Gateway; no external LLM APIs |

---

## Feature 1: Real-Time WebSocket Notifications

### Summary

Replace the current polling-based notification system (`GET /api/notifications` with client-side polling) with a Socket.io real-time push architecture. Deliver instant notifications for Maker-Checker approvals, high-risk AML alerts, SAR deadline countdowns, and sanctions screening hits—reducing average notification latency from ~30s (polling interval) to <500ms.

### Business Value & Regulatory Justification

| Value | Detail |
|---|---|
| **SAR Deadline Compliance** | FDL 10/2025 Art. 8 mandates 30-day SAR filing. Real-time countdown alerts ensure no deadline is missed due to notification lag. Current polling can miss up to 30 seconds of a critical deadline window. |
| **Maker-Checker Responsiveness** | The 4-eyes principle (FDL 10/2025 Art. 15) requires timely checker action. Real-time push for pending approvals reduces average approval latency from minutes to seconds, especially for 4-hour expiry windows. |
| **Sanctions Fail-Closed** | Screening hits must be acted upon immediately. A sanctions match that sits in an unread notification queue for 30 seconds is 30 seconds of potential exposure. |
| **Operational Efficiency** | Compliance officers currently refresh dashboards manually. Real-time push eliminates the "check and wait" loop, estimated to save 15–30 minutes per officer per day. |
| **CBUAE Audit Trail** | Notification delivery timestamps (pushed vs. polled) provide auditable proof of timely alerting—a differentiator during CBUAE examinations. |

### Technical Approach & Architecture

#### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Browser (React SPA)                               │
│                                                                      │
│  ┌─────────────────────┐    ┌─────────────────────────────────────┐ │
│  │  Socket.io Client    │    │  TanStack Query Cache              │ │
│  │  (useSocket hook)    │    │  (invalidate on push event)        │ │
│  └──────────┬───────────┘    └─────────────────────────────────────┘ │
│             │ receipt acknowledgment                                   │
└─────────────┼────────────────────────────────────────────────────────┘
              │ WebSocket (wss://)
              │
┌─────────────▼────────────────────────────────────────────────────────┐
│              Socket.io Server (Standalone Node.js)                    │
│              Port 3003 (existing Caddy proxy)                         │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Event Handlers:                                               │  │
│  │  • connection / authentication (JWT validation)                │  │
│  │  • join-room (userId, role, tenantId)                          │  │
│  │  • notification-received (receipt acknowledgment)              │  │
│  │  • heartbeat / reconnection                                    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Room Architecture:                                            │  │
│  │  • user:{userId}         — Personal notifications              │  │
│  │  • role:{role}           — Role-based broadcasts               │  │
│  │  • alert:{alertId}       — Alert-specific updates              │  │
│  │  • tenant:{tenantId}     — Multi-tenant scoping (Feature 3)    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Redis Adapter (optional, for horizontal scaling):             │  │
│  │  • @socket.io/redis-adapter for multi-instance fanout          │  │
│  │  • Falls back to in-memory if Redis unavailable                │  │
│  └────────────────────────────────────────────────────────────────┘  │
└─────────────┬────────────────────────────────────────────────────────┘
              │ Internal HTTP callback
              │
┌─────────────▼────────────────────────────────────────────────────────┐
│              Next.js API Routes (Existing + New)                      │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Notification Emitter Service (new):                           │  │
│  │  • POST /api/notifications → also emit Socket.io event         │  │
│  │  • Maker-Checker status change → emit to user:checkerId        │  │
│  │  • SAR deadline countdown (cron) → emit to role:mlro           │  │
│  │  • Sanctions hit → emit to role:mlro + user:screenedById       │  │
│  │  • AML alert escalation → emit to role:mlro                    │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

#### Implementation Details

**1. Socket.io Server Enhancement** (`examples/websocket/server.ts` → `src/websocket/server.ts`)

The existing Socket.io server at `examples/websocket/server.ts` provides a foundation. Enhance it with:

- **JWT Authentication**: Validate NextAuth.js session tokens on connection using the same secret
- **Room-based Routing**: Users join `user:{userId}` and `role:{role}` rooms on connection
- **Event Schema**: Typed events using Zod validation at the socket layer
- **Receipt Tracking**: Client must emit `notification-received` within 5 seconds; otherwise, fall back to in-app polling badge
- **Reconnection Buffer**: Server buffers missed events for 60 seconds per user; on reconnect, replay buffered events

```typescript
// Event types (shared between server and client)
interface NotificationEvents {
  'maker-checker:pending': { logId: string; operationType: string; makerName: string; expiryTime: string };
  'aml:high-risk-alert': { alertId: string; riskScore: number; riskLevel: string };
  'sar:deadline-warning': { caseId: string; daysRemaining: number; caseNumber: string };
  'sar:deadline-critical': { caseId: string; hoursRemaining: number; caseNumber: string };
  'sanctions:hit': { screeningId: string; matchScore: number; entityName: string };
  'sanctions:clear': { screeningId: string; entityName: string };
  'compliance:escalation': { alertType: string; severity: string; sourceModule: string };
  'notification:received': { notificationId: string; receivedAt: string };
}
```

**2. Client Hook** (`src/hooks/use-socket.ts`)

```typescript
// Auto-connects on mount, joins rooms based on Zustand user state
// Falls back gracefully if Socket.io unavailable
// Invalidates relevant TanStack Query caches on each event
const { isConnected, lastEvent, reconnecting } = useSocket();
```

**3. Notification Emitter Service** (`src/lib/notification-emitter.ts`)

A thin service that wraps the existing `POST /api/notifications` Prisma write with a parallel Socket.io emit:

```typescript
export async function emitNotification(data: CreateNotificationInput) {
  // 1. Persist to DB (existing Golden Path)
  const notification = await db.notification.create({ data });

  // 2. Emit real-time push (fire-and-forget, non-blocking)
  socketServer.to(`user:${data.userId}`).emit(data.type, {
    notificationId: notification.id,
    ...data,
  });

  // 3. Role-based broadcast for high-priority events
  if (data.priority === 'urgent') {
    socketServer.to(`role:mlro`).emit('compliance:escalation', { ... });
  }

  // 4. Audit log (existing SHA-256 audit trail)
  await createAuditLog({ action: 'NOTIFICATION_PUSHED', ... });

  return notification;
}
```

**4. SAR Deadline Countdown Cron** (`src/lib/cron/sar-deadline-countdown.ts`)

A scheduled job that emits real-time countdown events:
- **72 hours before deadline**: `sar:deadline-warning` to `user:assignedToId`
- **24 hours before deadline**: `sar:deadline-critical` to `role:mlro`
- **4 hours before deadline**: `sar:deadline-critical` to all connected users with `canFileSAR` permission

**5. Graceful Degradation**

If the Socket.io server is unavailable:
- Client-side `useSocket` hook detects disconnection and switches to 10-second polling via existing `GET /api/notifications`
- A "Connection Lost" indicator appears in the TopBar
- All notifications are still persisted to SQLite, ensuring zero data loss

### Estimated Complexity

**Medium**

- Socket.io server already exists as a prototype (`examples/websocket/server.ts`)
- Caddy already configured to proxy WebSocket connections via `XTransformPort=3003`
- Existing Notification model and API provide the persistence layer
- Primary work: authentication integration, room architecture, event typing, and client hooks

### Dependencies on Existing Modules

| Module | Dependency |
|---|---|
| `Notification` model (Prisma) | Persistence layer for all pushed events |
| `/api/notifications` route | Fallback polling when WebSocket unavailable |
| `MakerCheckerLog` model | Source of maker-checker approval events |
| `SARCase` model | Source of deadline countdown events |
| `SanctionsScreening` model | Source of screening hit events |
| `AMLAlert` model | Source of high-risk alert events |
| NextAuth.js session | JWT tokens for WebSocket authentication |
| `src/lib/env.ts` | Feature flag: `ENABLE_REALTIME_NOTIFICATIONS` |
| Caddy reverse proxy | Already routes WebSocket traffic to port 3003 |
| `src/lib/compliance/rbac.ts` | Role-based room assignment |

---

## Feature 2: Advanced RAG (Retrieval-Augmented Generation) for Regulatory Documents

### Summary

Build a PDF upload and chunking pipeline for regulatory circulars, with vector embedding via Qdrant and semantic search for policy gap analysis. This extends the existing RAG Policy Wizard (`src/lib/compliance/rag-policy-wizard.ts`) and Qdrant integration (`docker-compose.ai.yml`) from a single-purpose policy-drafting tool into a comprehensive regulatory intelligence platform.

### Business Value & Regulatory Justification

| Value | Detail |
|---|---|
| **Regulatory Change Management** | CBUAE issues 50+ circulars annually. Manual gap analysis against existing policies takes 2–4 weeks per circular. RAG-assisted analysis reduces this to hours. |
| **Policy Gap Identification** | Cross-reference new FDL/CR requirements against existing policies (`Policy` model) to automatically identify gaps—eliminating the current manual "read and compare" approach. |
| **Audit Readiness** | During CBUAE examinations, demonstrate that every regulatory circular has been assessed for compliance impact. The RAG system provides searchable evidence of analysis. |
| **CBUAE Article 15 (Internal Controls)** | FDL 10/2025 Art. 15 requires institutions to have "adequate internal controls" — a systematic RAG-driven gap analysis is the strongest evidence of adequacy. |
| **Reduced Hallucination Risk** | Unlike generic LLM queries, RAG grounds all responses in the actual text of uploaded regulatory documents. The existing `rag-policy-wizard.ts` already implements a hallucination guard; this extends it. |

### Technical Approach & Architecture

#### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Regulatory Document Pipeline                       │
│                                                                      │
│  ┌───────────┐   ┌───────────────┐   ┌──────────────┐              │
│  │ PDF Upload │──▶│  PDF Parser   │──▶│  Chunker     │              │
│  │ (API)      │   │  (pdf-parse)  │   │  (Recursive  │              │
│  └───────────┘   └───────────────┘   │   Character   │              │
│                                       │   Splitting)  │              │
│  ┌───────────┐   ┌───────────────┐   └──────┬───────┘              │
│  │ Manual    │──▶│  Text         │──────────┘                       │
│  │ Text Input│   │  Normalizer   │                                   │
│  └───────────┘   └───────────────┘                                   │
│                                                                      │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │ Chunked text (500-1000 chars, 200 overlap)
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Embedding Pipeline                                 │
│                                                                      │
│  ┌───────────────────┐   ┌───────────────────┐                     │
│  │  Embedding Model   │   │  Metadata Enricher │                     │
│  │  (Ollama nomic-    │   │  (regulator, date, │                     │
│  │   embed-text)      │   │   article numbers, │                     │
│  │                    │   │   jurisdiction)     │                     │
│  └─────────┬─────────┘   └─────────┬─────────┘                     │
│            │                       │                                  │
│            └───────────┬───────────┘                                  │
│                        ▼                                              │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Qdrant Vector Database                                      │  │
│  │  Collection: "regulatory_documents"                           │  │
│  │  • Existing Qdrant instance (docker-compose.ai.yml)           │  │
│  │  • Points: { id, vector, payload: { circularId, chunkIndex,  │  │
│  │    articleNumber, text, regulator, effectiveDate }}           │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Query & Analysis Layer                             │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ Semantic Search   │  │ Gap Analysis     │  │ Policy Compare   │  │
│  │ (natural language │  │ (new circular vs │  │ (existing policy │  │
│  │  query → vector   │  │  existing policy │  │  vs regulatory   │  │
│  │  similarity)      │  │  coverage)       │  │  requirement)    │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  AI Gateway (existing)                                       │  │
│  │  • Routes queries to Ollama LLM                              │  │
│  │  • Hallucination guard (existing rag-policy-wizard.ts)        │  │
│  │  • Context injection from Qdrant search results              │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

#### Implementation Details

**1. PDF Ingestion Pipeline** (`src/lib/rag/pdf-pipeline.ts`)

```typescript
// Multi-stage pipeline for regulatory document processing
export async function ingestRegulatoryPDF(file: File, metadata: DocumentMetadata) {
  // Stage 1: Parse PDF
  const rawText = await parsePDF(file); // using pdf-parse or unstructured

  // Stage 2: Clean and normalize
  const cleaned = normalizeRegulatoryText(rawText); // Remove headers, footers, page numbers
  // Arabic normalization using existing src/lib/compliance/arabic-normalization.ts

  // Stage 3: Recursive character splitting with article awareness
  const chunks = recursiveCharacterSplit(cleaned, {
    chunkSize: 800,
    chunkOverlap: 200,
    separators: ['\n\nArticle ', '\n\nSection ', '\n\n', '\n', '. '],
    keepSeparator: true, // Preserve article numbers for metadata
  });

  // Stage 4: Extract structured metadata per chunk
  const enrichedChunks = chunks.map(chunk => ({
    text: chunk,
    articleNumber: extractArticleNumber(chunk),  // "Art. 8", "Article 15"
    sectionNumber: extractSectionNumber(chunk),   // "S3.1", "S4.2"
    metadata: {
      circularId: metadata.id,
      regulator: metadata.regulator,
      circularNumber: metadata.circularNumber,
      effectiveDate: metadata.effectiveDate,
      jurisdiction: metadata.jurisdiction || 'CBUAE',
      chunkIndex: chunks.indexOf(chunk),
      totalChunks: chunks.length,
    },
  }));

  // Stage 5: Generate embeddings via Ollama
  const embeddings = await batchEmbed(enrichedChunks.map(c => c.text));

  // Stage 6: Upsert to Qdrant
  await qdrantClient.upsert('regulatory_documents', {
    points: enrichedChunks.map((chunk, i) => ({
      id: `${metadata.id}_chunk_${i}`,
      vector: embeddings[i],
      payload: { ...chunk.metadata, text: chunk.text, articleNumber: chunk.articleNumber },
    })),
  });

  // Stage 7: Update RegulatoryCircular status
  await db.regulatoryCircular.update({
    where: { id: metadata.id },
    data: { status: 'indexed' },
  });

  // Stage 8: Audit log
  await createAuditLog({ action: 'REGULATORY_DOCUMENT_INDEXED', ... });
}
```

**2. Semantic Search API** (`/api/rag/search/route.ts`)

```typescript
// Accepts natural language query, returns relevant regulatory chunks
export async function POST(request: NextRequest) {
  const { query, regulator, jurisdiction, topK = 10 } = await request.json();

  // Generate query embedding
  const queryVector = await embedQuery(query);

  // Search Qdrant with filters
  const results = await qdrantClient.search('regulatory_documents', {
    vector: queryVector,
    limit: topK,
    filter: {
      must: [
        ...(regulator ? [{ key: 'regulator', match: { value: regulator } }] : []),
        ...(jurisdiction ? [{ key: 'jurisdiction', match: { value: jurisdiction } }] : []),
      ],
    },
  });

  return NextResponse.json({ success: true, data: results });
}
```

**3. Gap Analysis Engine** (`src/lib/rag/gap-analysis.ts`)

Extends the existing `rag-policy-wizard.ts` hallucination-guarded approach:

```typescript
export async function analyzePolicyGaps(circularId: string) {
  // 1. Retrieve all chunks for the circular
  const circularChunks = await qdrantClient.scroll('regulatory_documents', {
    filter: { must: [{ key: 'circularId', match: { value: circularId } }] },
  });

  // 2. For each regulatory requirement (article-level), search existing policies
  const gaps = [];
  for (const chunk of circularChunks) {
    const policyResults = await qdrantClient.search('regulatory_documents', {
      vector: chunk.vector,
      limit: 5,
      filter: { must: [{ key: 'documentType', match: { value: 'policy' } }] },
    });

    // 3. If no policy chunk has similarity > 0.75, flag as potential gap
    const maxSimilarity = Math.max(...policyResults.map(r => r.score));
    if (maxSimilarity < 0.75) {
      gaps.push({
        articleNumber: chunk.payload.articleNumber,
        regulatoryText: chunk.payload.text,
        maxPolicySimilarity: maxSimilarity,
        gapSeverity: maxSimilarity < 0.5 ? 'critical' : 'moderate',
        suggestedAction: 'POLICY_UPDATE_REQUIRED',
      });
    }
  }

  // 4. AI-powered gap explanation using Ollama
  const gapAnalysis = await generateGapExplanation(gaps, circularChunks);

  return { circularId, totalRequirements: circularChunks.length, gaps, gapAnalysis };
}
```

**4. Policy Document Indexing**

Index existing policies alongside regulatory documents for cross-referencing:

- New Qdrant collection: `policies` (separate from `regulatory_documents`)
- Re-index all existing `Policy` records on startup/when feature is enabled
- Dual-collection search enables "find regulatory requirements NOT covered by policies"

**5. UI: Regulatory Document RAG Dashboard** (`src/components/ic-os/rag/RegulatoryRAGDashboard.tsx`)

- **Upload Panel**: Drag-and-drop PDF upload with metadata form (regulator, circular number, effective date)
- **Search Panel**: Natural language query with filters (regulator, jurisdiction, date range)
- **Gap Analysis Panel**: Side-by-side view of regulatory requirement vs. existing policy coverage
- **Coverage Heatmap**: Visual matrix of regulatory articles × policy coverage status

### Estimated Complexity

**High**

- PDF parsing and chunking is non-trivial for regulatory documents with mixed Arabic/English
- Qdrant collection management and embedding pipeline require careful error handling
- Gap analysis accuracy depends on embedding quality and chunk size tuning
- Requires new npm dependencies: `pdf-parse` or `unstructured`, `@qdrant/js-client-rest`

### Dependencies on Existing Modules

| Module | Dependency |
|---|---|
| `RegulatoryCircular` model | Source records for ingested documents |
| `GapAnalysis` model | Storage for generated gap analysis results |
| `Policy` model | Target for gap analysis comparison |
| `rag-policy-wizard.ts` | Existing hallucination guard and RAG patterns |
| `arabic-normalization.ts` | Arabic text processing for CBUAE circulars |
| Qdrant (`docker-compose.ai.yml`) | Vector storage (already deployed) |
| Ollama (`docker-compose.ai.yml`) | Embedding model (nomic-embed-text) and LLM inference |
| AI Gateway | Request routing and rate limiting |
| `src/lib/env.ts` | Feature flag: `ENABLE_ADVANCED_RAG` |
| `/api/policy-wizard` route | Existing RAG API pattern to extend |

---

## Feature 3: Multi-Tenancy for Subsidiary Entity Management

### Summary

Support multiple subsidiaries, branches, or group entities under a single IC-OS instance with full data isolation, per-tenant RBAC overrides, and consolidated group-level reporting for CBUAE. This enables financial groups operating across UAE free zones and mainland to manage all compliance operations from a single platform while maintaining strict data boundaries.

### Business Value & Regulatory Justification

| Value | Detail |
|---|---|
| **Group-Level CBUAE Reporting** | Financial groups must submit consolidated compliance reports. Currently, each subsidiary would need a separate IC-OS instance. Multi-tenancy enables group-level aggregation. |
| **Data Isolation per Entity** | Free zone subsidiaries (DIFC, ADGM) have separate regulatory obligations from mainland entities. Data must not leak between tenants. FDL 10/2025 requires entity-specific record keeping. |
| **Per-Tenant RBAC** | A compliance officer at the Dubai branch should not see Abu Dhabi branch alerts. Role assignments must be scoped to the tenant. |
| **Cost Efficiency** | One IC-OS deployment serving 5 subsidiaries is 5x more efficient than 5 separate deployments. Reduces infrastructure, maintenance, and licensing costs. |
| **Board-Level Oversight** | Group MLRO and board members need cross-tenant visibility for consolidated risk assessment, while subsidiary staff see only their own data. |

### Technical Approach & Architecture

#### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Multi-Tenant IC-OS Architecture                    │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Tenant Resolution Layer (Middleware)                         │  │
│  │  • Extract tenantId from: subdomain, header, or session      │  │
│  │  • Validate tenant exists and is active                       │  │
│  │  • Inject tenantId into request context                       │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                         │                                            │
│  ┌──────────────────────▼──────────────────────────────────────────┐│
│  │  Prisma Tenant Filter (Middleware)                             ││
│  │  • Automatically inject tenantId into WHERE clauses            ││
│  │  • Block cross-tenant reads/writes at ORM level                ││
│  │  • Global tenant bypass for admin group-level queries          ││
│  └───────────────────────────────────────────────────────────────┘│
│                         │                                            │
│  ┌──────────────────────▼──────────────────────────────────────────┐│
│  │  Shared Database with Tenant Column                            ││
│  │  • All models gain tenantId field                              ││
│  │  • SQLite row-level security via Prisma filtering              ││
│  │  • Migration: Add tenantId with default 'default'              ││
│  └───────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Group-Level Aggregation (Admin Only)                         │  │
│  │  • Cross-tenant queries with GROUP BY tenantId                │  │
│  │  • Consolidated CBUAE reports across all subsidiaries         │  │
│  │  • Group risk dashboard with per-tenant breakdowns            │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

#### Schema Migration Strategy

**Phase A: Add Tenant Model and tenantId Column**

```prisma
// New model
model Tenant {
  id              String   @id @default(cuid())
  name            String   @unique  // "Dubai Main Branch", "DIFC Subsidiary"
  code            String   @unique  // "DUB", "DIFC", "ADGM"
  jurisdiction    String   @default("CBUAE") // "CBUAE", "DFSA", "FSRA"
  licenseNumber   String?
  isActive        Boolean  @default(true)
  parentTenantId  String?  // For hierarchical tenants
  complianceOfficerId String? // Tenant-specific MLRO
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  users           User[]
  // ... all other tenant-scoped models
}

// Add tenantId to ALL existing models
model AMLAlert {
  id              String   @id @default(cuid())
  tenantId        String   @default("default")  // ← NEW
  tenant          Tenant   @relation(fields: [tenantId], references: [id]) // ← NEW
  // ... existing fields
}
```

**Phase B: Data Migration Script** (`scripts/migrate-multi-tenant.ts`)

```typescript
// 1. Create default tenant for existing data
await db.tenant.create({
  data: { id: 'default', name: 'Default Entity', code: 'DEFAULT', jurisdiction: 'CBUAE' }
});

// 2. Add tenantId column with default value (no data loss)
// Prisma migration: ALTER TABLE "AMLAlert" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default';

// 3. Create additional tenants from configuration
const tenants = [
  { name: 'Dubai Main Branch', code: 'DUB', jurisdiction: 'CBUAE' },
  { name: 'DIFC Subsidiary', code: 'DIFC', jurisdiction: 'DFSA' },
  { name: 'Abu Dhabi Branch', code: 'AUH', jurisdiction: 'CBUAE' },
];

// 4. Run migration in transaction
// 5. Verify data integrity: all records have tenantId, no orphaned records
```

**Phase C: Prisma Tenant Middleware** (`src/lib/middleware/tenant-filter.ts`)

```typescript
// Automatic tenant filtering at the Prisma middleware level
// Inspired by the existing audit-middleware.ts pattern
export function createTenantFilterMiddleware(tenantId: string) {
  return Prisma.defineMiddleware(async (params, next) => {
    // Bypass for system operations (migrations, health checks)
    if (params.model === 'Tenant' || params.model === 'AuditLog') {
      return next(params);
    }

    // Inject tenantId into WHERE clause for reads
    if (params.action === 'findMany' || params.action === 'findFirst' || params.action === 'count') {
      if (!params.args.where) params.args.where = {};
      if (!params.args.where.tenantId) {
        params.args.where.tenantId = tenantId;
      }
    }

    // Inject tenantId into data for writes
    if (params.action === 'create' || params.action === 'update') {
      if (!params.args.data.tenantId) {
        params.args.data.tenantId = tenantId;
      }
    }

    // Block cross-tenant access
    if (params.args.where?.tenantId && params.args.where.tenantId !== tenantId) {
      throw new Error(`Cross-tenant access denied: attempted to access tenant ${params.args.where.tenantId} from tenant ${tenantId}`);
    }

    return next(params);
  });
}
```

**Phase D: Per-Tenant RBAC Overrides**

```typescript
// Extends existing rbac.ts with tenant-scoped permissions
interface TenantRBACOverride {
  tenantId: string;
  userId: string;
  roleOverrides: Partial<Record<Permission, boolean>>; // e.g., { canFileSAR: false } for restricted subsidiary
  additionalPermissions?: Permission[]; // e.g., DIFC-specific permissions
}

// Tenant-aware permission check
export function checkPermissionTenantAware(
  role: Role,
  permission: Permission,
  tenantId: string,
  overrides: TenantRBACOverride[]
): boolean {
  // 1. Check base RBAC (existing logic)
  const baseAllowed = checkPermission(role, permission);
  if (!baseAllowed) return false;

  // 2. Check tenant-specific overrides
  const override = overrides.find(o => o.tenantId === tenantId);
  if (override?.roleOverrides[permission] === false) return false;

  return true;
}
```

**Phase E: Group-Level Reporting** (`/api/reports/group-consolidated/route.ts`)

```typescript
// Admin-only endpoint for cross-tenant aggregation
// Requires: admin role + canViewBoardDashboard permission
export async function GET(request: NextRequest) {
  const { groupBy, reportType, period } = parseQueryParams(request);

  // Bypass tenant filter for group-level queries
  const results = await db.$queryRaw`
    SELECT tenantId, COUNT(*) as total, ...
    FROM AMLAlert
    WHERE createdAt >= ${startDate}
    GROUP BY tenantId
  `;

  // Enrich with tenant metadata
  const enriched = await enrichWithTenantInfo(results);

  return NextResponse.json({ success: true, data: enriched });
}
```

### Estimated Complexity

**High**

- Schema migration touches ALL 39+ models (adding `tenantId`)
- Prisma tenant middleware must handle every query type (findMany, create, update, delete, aggregate, raw)
- Per-tenant RBAC overrides add significant complexity to the permission system
- Group-level queries bypass tenant isolation, requiring careful security review
- Testing matrix expands exponentially (9 roles × N tenants × 26 permissions)

### Dependencies on Existing Modules

| Module | Dependency |
|---|---|
| ALL Prisma models (39+) | Must add `tenantId` field |
| `src/lib/compliance/rbac.ts` | Extend with tenant-scoped overrides |
| `src/lib/db.ts` | Tenant middleware integration |
| `src/lib/compliance/audit-middleware.ts` | Pattern for Prisma middleware |
| `src/lib/auth-guard.ts` | Must resolve tenant from session |
| `/api/notifications` route | Tenant-scoped notification delivery |
| `/api/quarterly-reporting` route | Group consolidation for CBUAE |
| `MakerCheckerLog` model | Cross-tenant maker-checker must be prevented |
| `src/lib/env.ts` | Feature flag: `ENABLE_MULTI_TENANCY` |
| Seed script (`prisma/seed.ts`) | Must create tenant-aware seed data |

---

## Feature 4: SSO Integration with Enterprise Identity Providers

### Summary

Replace or augment the current NextAuth.js credentials-based authentication with enterprise identity provider integration via SAML 2.0 and OpenID Connect (OIDC). Support Okta, Azure AD, and UAE Pass (the UAE government digital identity) for authentication. Enforce MFA and implement enterprise session management.

### Business Value & Regulatory Justification

| Value | Detail |
|---|---|
| **UAE Pass Compliance** | UAE Pass is the mandated digital identity for UAE government services. CBUAE-examined institutions are increasingly expected to integrate with it for staff authentication. |
| **Enterprise SSO** | Large financial institutions already use Okta or Azure AD. Forcing a separate IC-OS login creates friction and password fatigue. SSO reduces helpdesk calls by 40–60%. |
| **MFA Enforcement** | FDL 10/2025 Art. 15 (Internal Controls) and CBUAE Notice 3551/2021 require adequate access controls. MFA is the industry standard for compliance systems. |
| **Centralized User Provisioning** | SCIM-based user provisioning from Azure AD/Okta ensures that when an employee leaves the organization, their IC-OS access is automatically revoked—closing the orphaned account risk. |
| **Session Security** | Enterprise IdPs provide session revocation, conditional access policies, and device compliance checks that are impossible with local credential stores. |

### Technical Approach & Architecture

#### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Authentication Flow                                │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Browser                                                     │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐              │    │
│  │  │ IC-OS    │  │ Okta     │  │ Azure AD     │              │    │
│  │  │ Login    │  │ SAML SSO │  │ OIDC SSO     │              │    │
│  │  │ (creds)  │  │ Button   │  │ Button       │              │    │
│  │  └────┬─────┘  └────┬─────┘  └──────┬───────┘              │    │
│  │       │              │               │                       │    │
│  │  ┌────▼──────────────▼───────────────▼──────────────────┐  │    │
│  │  │  UAE Pass Button (SAML 2.0)                          │  │    │
│  │  │  • Government-issued digital identity                 │  │    │
│  │  │  • Mandatory for CBUAE-licensed institutions          │  │    │
│  │  └──────────────────────────┬───────────────────────────┘  │    │
│  └─────────────────────────────┼──────────────────────────────┘    │
│                                │                                     │
│  ┌─────────────────────────────▼──────────────────────────────┐    │
│  │  NextAuth.js (Enhanced Configuration)                      │    │
│  │                                                             │    │
│  │  Providers:                                                 │    │
│  │  1. CredentialsProvider (existing — local fallback)         │    │
│  │  2. SAMLProvider (Okta, UAE Pass)                          │    │
│  │  3. AzureADProvider (OIDC)                                 │    │
│  │                                                             │    │
│  │  Callbacks:                                                 │    │
│  │  • signIn: Map IdP groups → IC-OS roles (rbac.ts)          │    │
│  │  • jwt: Include tenantId, MFA status, session ID           │    │
│  │  • session: Expose role, tenantId, mfaVerified             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                │                                     │
│  ┌─────────────────────────────▼──────────────────────────────┐    │
│  │  Session Management Layer                                   │    │
│  │  • Database-backed sessions (Prisma Session model)          │    │
│  │  • MFA verification state tracking                          │    │
│  │  • Concurrent session limits per user (max 2)               │    │
│  │  • Idle timeout: 30 minutes (configurable)                  │    │
│  │  • Forced logout on role change or user deactivation        │    │
│  └─────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

#### Implementation Details

**1. NextAuth.js Provider Configuration** (`src/app/api/auth/[...nextauth]/route.ts`)

```typescript
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { SAMLProvider } from '@boxyhq/saml-jackson'; // SAML 2.0
import AzureADProvider from 'next-auth/providers/azure-ad';

export const authOptions = {
  providers: [
    // Existing credential provider (fallback)
    CredentialsProvider({
      name: 'IC-OS Local',
      credentials: { email: { label: "Email" }, password: { label: "Password", type: "password" } },
      async authorize(credentials) {
        // Existing logic
      },
    }),

    // Azure AD via OIDC
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: process.env.AZURE_AD_TENANT_ID,
      authorization: {
        params: {
          scope: 'openid profile email offline_access',
          prompt: 'login', // Force fresh authentication
        },
      },
    }),

    // SAML 2.0 for Okta and UAE Pass
    // Uses @boxyhq/saml-jackson for SAML integration
    {
      id: 'saml',
      name: 'Enterprise SSO',
      type: 'oauth',
      // Configuration loaded from database (multi-tenant SAML connections)
      // Supports Okta + UAE Pass via different SAML configurations
    },
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      // 1. Map IdP groups to IC-OS roles
      const roleMapping = {
        'ic-os-mlro': 'mlro',
        'ic-os-compliance': 'compliance_officer',
        'ic-os-admin': 'admin',
        'ic-os-board': 'board',
      };

      const idpGroups = profile.groups || profile.roles || [];
      const mappedRole = mapGroupsToRole(idpGroups, roleMapping);

      if (!mappedRole) {
        return false; // Deny login if no valid group mapping
      }

      // 2. Upsert user with IdP-provided metadata
      await db.user.upsert({
        where: { email: user.email },
        create: { email: user.email, name: user.name, role: mappedRole, isActive: true },
        update: { name: user.name, role: mappedRole },
      });

      // 3. Check MFA requirement
      if (account.provider === 'credentials' && !user.mfaVerified) {
        return '/auth/mfa-required'; // Redirect to MFA challenge
      }

      // 4. Audit log
      await createAuditLog({ action: 'SSO_LOGIN', details: { provider: account.provider } });

      return true;
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.mfaVerified = user.mfaVerified || account?.provider !== 'credentials';
      }
      return token;
    },

    async session({ session, token }) {
      session.user.role = token.role;
      session.user.tenantId = token.tenantId;
      session.user.mfaVerified = token.mfaVerified;
      return session;
    },
  },

  // Database-backed sessions for revocation support
  session: {
    strategy: 'database',
    maxAge: 8 * 60 * 60, // 8 hours
    updateAge: 30 * 60,   // Refresh every 30 minutes
  },
};
```

**2. UAE Pass Integration** (`src/lib/auth/uaepass.ts`)

```typescript
// UAE Pass SAML 2.0 integration
// UAE Pass provides government-verified digital identity
export class UAEPassProvider {
  private samlConfig = {
    entryPoint: process.env.UAEPASS_ENTRY_POINT, // https://id.uaepass.ae/trustedx/saml2/idp/SSO
    issuer: process.env.UAEPASS_ISSUER,           // IC-OS SP Entity ID
    callbackUrl: `${process.env.NEXTAUTH_URL}/api/auth/callback/uaepass`,
    cert: process.env.UAEPASS_CERT,               // IdP public certificate
    signatureAlgorithm: 'sha256',
    identifierFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
  };

  // UAE Pass provides: Emirates ID, full name (Arabic + English), mobile, email
  // Map these to IC-OS user fields
}
```

**3. MFA Enforcement** (`src/lib/auth/mfa.ts`)

```typescript
// MFA enforcement per role
const MFA_REQUIRED_ROLES = ['admin', 'mlro', 'compliance_manager'];

export function requiresMFA(role: string): boolean {
  return MFA_REQUIRED_ROLES.includes(role);
}

// TOTP-based MFA for credential provider
// IdP-based SSO inherits MFA from the IdP (Azure AD Conditional Access, Okta MFA policies)
// UAE Pass is inherently MFA (smart card + PIN)

// Session tracking: Track MFA verification in JWT token
// Re-verify MFA every 4 hours for compliance-critical roles
```

**4. Session Model** (New Prisma model)

```prisma
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  expires      DateTime
  ipAddress    String?
  userAgent    String?
  mfaVerified  Boolean  @default(false)
  tenantId     String?  // Tenant context at time of login
  createdAt    DateTime @default(now())

  // Support forced logout
  revokedAt    DateTime?
  revokeReason String?  // "role_change", "user_deactivated", "admin_action"
}
```

**5. SCIM User Provisioning** (`/api/scim/v2/*`)

Basic SCIM 2.0 endpoints for automated user provisioning from Azure AD / Okta:
- `GET /api/scim/v2/Users` — List users
- `POST /api/scim/v2/Users` — Create user
- `PATCH /api/scim/v2/Users/:id` — Update user (role changes)
- `DELETE /api/scim/v2/Users/:id` — Deactivate user

### Estimated Complexity

**High**

- SAML 2.0 is a complex protocol with XML signature verification, metadata exchange, and certificate management
- UAE Pass integration requires government onboarding (registration with UAE Pass authority)
- MFA enforcement requires TOTP library integration and careful session state management
- SCIM provisioning adds significant API surface area
- Testing requires actual IdP instances (Okta dev, Azure AD tenant, UAE Pass sandbox)

### Dependencies on Existing Modules

| Module | Dependency |
|---|---|
| NextAuth.js (`/api/auth/[...nextauth]`) | Must extend provider configuration |
| `User` model (Prisma) | Must add `idpId`, `idpProvider`, `mfaSecret` fields |
| `src/lib/compliance/rbac.ts` | Role mapping from IdP groups |
| `src/lib/auth-guard.ts` | Must check MFA verification state |
| `src/middleware.ts` | Session validation and MFA enforcement |
| `AuditLog` model | SSO login/logout auditing |
| `src/lib/env.ts` | Feature flags: `ENABLE_SSO_OKTA`, `ENABLE_SSO_AZURE`, `ENABLE_UAEPASS` |
| `Notification` model | Alert on suspicious login patterns |
| `src/app/login/page.tsx` | Add SSO login buttons |
| Caddy (reverse proxy) | Must handle SAML callback URLs |

---

## Feature 5: Automated Regulatory Change Detection & Impact Analysis

### Summary

Build an automated web scraper for CBUAE, DFSA, and FSRA websites that detects regulatory circular updates, uses AI to perform diff analysis against previously known regulations, generates automatic gap analysis, and produces compliance impact scores. This transforms regulatory monitoring from a manual, periodic exercise into a continuous, automated process.

### Business Value & Regulatory Justification

| Value | Detail |
|---|---|
| **Proactive Compliance** | CBUAE circulars can be issued at any time. Manual monitoring means gaps of days or weeks before a new requirement is identified. Automated detection reduces this to hours. |
| **FDL 10/2025 Art. 15** | Requires "prompt" adaptation to regulatory changes. Automated detection with AI-powered impact analysis is the strongest evidence of prompt adaptation. |
| **CBUAE Examination Evidence** | During examinations, demonstrate that every regulatory change was detected, analyzed, and addressed within defined SLAs. |
| **Reduced Manual Effort** | Compliance teams currently spend 10–15 hours per week monitoring regulatory websites. Automation frees this time for actual compliance work. |
| **Multi-Regulator Coverage** | Institutions licensed by both CBUAE and DFSA/FSRA must monitor all regulators. A unified scraping pipeline eliminates the need for separate monitoring processes. |

### Technical Approach & Architecture

#### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Monitoring Pipeline                                │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Scheduler (Cron Jobs)                                        │  │
│  │  • Every 4 hours: Check CBUAE website for new circulars       │  │
│  │  • Every 6 hours: Check DFSA website for new regulations      │  │
│  │  • Every 6 hours: Check FSRA website for new rules            │  │
│  │  • Daily: Full content re-scan for changes to existing docs   │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                         │                                            │
│  ┌──────────────────────▼──────────────────────────────────────────┐│
│  │  Web Scraper Layer (Puppeteer + Cheerio)                       ││
│  │                                                                ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                    ││
│  │  │  CBUAE   │  │  DFSA    │  │  FSRA    │                    ││
│  │  │  Scraper │  │  Scraper │  │  Scraper │                    ││
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘                    ││
│  │       │              │              │                           ││
│  │  ┌────▼──────────────▼──────────────▼─────────────────────┐  ││
│  │  │  Normalizer: Extract title, date, URL, full text,      │  ││
│  │  │  PDF links, circular number, regulator                  │  ││
│  │  └────────────────────────────────────────────────────────┘  ││
│  └────────────────────────────────────────────────────────────────┘│
│                         │                                            │
│  ┌──────────────────────▼──────────────────────────────────────────┐│
│  │  Change Detection Engine                                       ││
│  │  • Compare scraped content against last known version          ││
│  │  • Content hash (SHA-256) for fast comparison                 ││
│  │  • If hash differs → flag as CHANGED                          ││
│  │  • If new circular number → flag as NEW                       ││
│  │  • If circular withdrawn → flag as WITHDRAWN                  ││
│  └────────────────────────────────────────────────────────────────┘│
│                         │                                            │
│  ┌──────────────────────▼──────────────────────────────────────────┐│
│  │  AI Diff Analysis (Ollama)                                     ││
│  │  • Compare old vs. new text for material changes               ││
│  │  • Classify change severity: editorial / clarifying / material ││
│  │  • Extract specific requirement changes (new/modified/removed) ││
│  │  • Identify affected compliance domains                        ││
│  └────────────────────────────────────────────────────────────────┘│
│                         │                                            │
│  ┌──────────────────────▼──────────────────────────────────────────┐│
│  │  Impact Analysis Engine                                        ││
│  │  • Cross-reference changes with existing policies              ││
│  │  • Cross-reference with RiskAssessment entries                 ││
│  │  • Cross-reference with TrainingCourse content                 ││
│  │  • Generate compliance impact score (0-100)                    ││
│  │  • Auto-create RegulatoryCircular + GapAnalysis records        ││
│  │  • Auto-create ComplianceAlert for high-impact changes         ││
│  │  • Trigger notification push (Feature 1)                       ││
│  └────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

#### Implementation Details

**1. Scraper Infrastructure** (`src/lib/regulatory-scraper/`)

```typescript
// Base scraper class with common patterns
abstract class RegulatoryScraper {
  abstract regulator: 'CBUAE' | 'DFSA' | 'FSRA';
  abstract baseUrl: string;
  abstract circularListPath: string;

  async scrape(): Promise<ScrapedCircular[]> {
    // 1. Launch headless browser (Puppeteer for JS-rendered pages)
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // 2. Navigate to circular listing page
    await page.goto(`${this.baseUrl}${this.circularListPath}`);

    // 3. Extract circular links and metadata
    const circularLinks = await page.evaluate(() => {
      // Regulator-specific DOM selectors
    });

    // 4. For each circular, download PDF and extract text
    const results: ScrapedCircular[] = [];
    for (const link of circularLinks) {
      const pdfText = await this.downloadAndParsePDF(link.pdfUrl);
      results.push({
        regulator: this.regulator,
        title: link.title,
        circularNumber: link.circularNumber,
        effectiveDate: link.effectiveDate,
        sourceUrl: link.url,
        pdfUrl: link.pdfUrl,
        fullText: pdfText,
        contentHash: computeSHA256(pdfText),
        scrapedAt: new Date(),
      });
    }

    await browser.close();
    return results;
  }
}

// CBUAE-specific implementation
class CBUAEScraper extends RegulatoryScraper {
  regulator = 'CBUAE' as const;
  baseUrl = 'https://www.centralbank.ae';
  circularListPath = '/en/regulation/circulars';
}

// DFSA-specific implementation
class DFSAScraper extends RegulatoryScraper {
  regulator = 'DFSA' as const;
  baseUrl = 'https://www.dfsa.ae';
  circularListPath = '/Legislation/Regulatory-Framework';
}

// FSRA-specific implementation
class FSRAScraper extends RegulatoryScraper {
  regulator = 'FSRA' as const;
  baseUrl = 'https://adgm.com';
  circularListPath = '/regulation/fsra/regulatory-framework';
}
```

**2. Change Detection Engine** (`src/lib/regulatory-scraper/change-detector.ts`)

```typescript
export async function detectChanges(scraped: ScrapedCircular[]): Promise<RegulatoryChange[]> {
  const changes: RegulatoryChange[] = [];

  for (const circular of scraped) {
    // Look up last known version
    const existing = await db.regulatoryCircular.findFirst({
      where: {
        circularNumber: circular.circularNumber,
        regulator: circular.regulator,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!existing) {
      // NEW circular
      changes.push({
        type: 'NEW',
        circular,
        severity: 'pending_analysis',
      });
    } else if (existing.contentHash !== circular.contentHash) {
      // CHANGED circular — AI diff analysis needed
      changes.push({
        type: 'CHANGED',
        circular,
        previousVersion: existing,
        severity: 'pending_analysis',
      });
    }
    // If hash matches, no change — skip
  }

  return changes;
}
```

**3. AI Diff Analysis** (`src/lib/regulatory-scraper/ai-diff.ts`)

```typescript
export async function analyzeDiff(change: RegulatoryChange): Promise<DiffAnalysis> {
  if (change.type === 'NEW') {
    // For new circulars, analyze against existing regulatory landscape
    const prompt = `
You are a UAE regulatory compliance analyst. A new ${change.circular.regulator} circular has been detected:

Title: ${change.circular.title}
Circular Number: ${change.circular.circularNumber}
Effective Date: ${change.circular.effectiveDate}
Full Text: ${change.circular.fullText.substring(0, 4000)}

Analyze this circular and provide:
1. Summary (2-3 sentences)
2. Affected compliance domains (KYC, AML, Sanctions, Reporting, Governance, Training)
3. New requirements introduced (bulleted list)
4. Modified requirements (if replacing prior guidance)
5. Compliance impact score (0-100, where 100 = fundamental changes required)
6. Recommended action timeline (immediate/30 days/90 days)
`;

    const analysis = await callOllama(prompt); // Via existing AI Gateway
    return parseDiffAnalysis(analysis);
  }

  if (change.type === 'CHANGED') {
    // Side-by-side comparison
    const prompt = `
Compare the old and new versions of ${change.circular.circularNumber}:

OLD VERSION (last ${change.previousVersion?.effectiveDate}):
${change.previousVersion?.fullText?.substring(0, 2000)}

NEW VERSION (${change.circular.effectiveDate}):
${change.circular.fullText.substring(0, 2000)}

Identify:
1. Material changes (new obligations, modified thresholds, removed exemptions)
2. Editorial changes (formatting, typos, reordering)
3. Each material change's compliance impact (critical/high/medium/low)
4. Overall impact score (0-100)
`;
    const analysis = await callOllama(prompt);
    return parseDiffAnalysis(analysis);
  }
}
```

**4. Compliance Impact Score Calculation**

```typescript
export function calculateImpactScore(analysis: DiffAnalysis): number {
  let score = 0;

  // Domain coverage: more domains affected = higher impact
  score += Math.min(analysis.affectedDomains.length * 10, 30);

  // New requirements: each new requirement adds to impact
  score += Math.min(analysis.newRequirements.length * 5, 25);

  // Severity of individual changes
  const criticalCount = analysis.changes.filter(c => c.impact === 'critical').length;
  const highCount = analysis.changes.filter(c => c.impact === 'high').length;
  score += criticalCount * 15;
  score += highCount * 8;

  // Cross-reference with existing compliance gaps
  const existingGaps = await db.gapAnalysis.count({
    where: { circularId: analysis.circularId, status: 'open' },
  });
  score += Math.min(existingGaps * 5, 15);

  return Math.min(score, 100); // Cap at 100
}
```

**5. Automated Workflow Triggers**

When a change is detected with impact score ≥ 50:
1. Create `RegulatoryCircular` record with status `detected`
2. Create `GapAnalysis` record with AI-generated findings
3. Create `ComplianceAlert` with severity based on impact score
4. Create `CalendarEvent` for compliance review deadline
5. Push real-time notification to `role:mlro` and `role:compliance_manager` (Feature 1)
6. Create `Notification` records for assigned compliance officers
7. Create `AuditLog` entry for the detection event

**6. Scraper Dashboard** (`src/components/ic-os/regulatory/RegulatoryChangeMonitor.tsx`)

- **Live Feed**: Chronological stream of detected changes with severity badges
- **Impact Heatmap**: Circulars plotted by impact score × affected domains
- **Auto-Analysis Panel**: AI-generated summaries with "Accept Analysis" / "Override" actions
- **Scraper Health**: Last run timestamps, success/failure counts, rate limiting status
- **Manual Trigger**: "Run scraper now" button for on-demand monitoring

**7. New Prisma Models**

```prisma
model ScrapedContent {
  id              String   @id @default(cuid())
  regulator       String   // "CBUAE", "DFSA", "FSRA"
  circularNumber  String
  title           String
  sourceUrl       String
  pdfUrl          String?
  fullText        String   // Raw extracted text
  contentHash     String   // SHA-256 for change detection
  scrapedAt       DateTime @default(now())
  processingStatus String  @default("pending") // "pending", "analyzing", "completed", "error"
  errorDetail     String?
  createdAt       DateTime @default(now())
}

model RegulatoryChangeLog {
  id              String   @id @default(cuid())
  scrapedContentId String
  changeType      String   // "NEW", "CHANGED", "WITHDRAWN"
  impactScore     Int      @default(0) // 0-100
  affectedDomains String   // JSON array
  aiSummary       String?
  aiDiffAnalysis  String?  // JSON: detailed change breakdown
  actionTimeline  String?  // "immediate", "30_days", "90_days"
  reviewStatus    String   @default("pending") // "pending", "acknowledged", "addressed", "dismissed"
  reviewedBy      String?
  reviewedAt      DateTime?
  createdAt       DateTime @default(now())
}
```

### Estimated Complexity

**High**

- Web scraping CBUAE/DFSA/FSRA websites requires handling dynamic JavaScript rendering, CAPTCHAs, and rate limiting
- AI diff analysis quality depends on LLM context window and regulatory text complexity
- False positive rate must be minimized (editorial changes flagged as material)
- Scraper maintenance is ongoing (websites change their structure)
- Puppeteer is heavy (~150MB Docker image); consider Playwright as alternative

### Dependencies on Existing Modules

| Module | Dependency |
|---|---|
| `RegulatoryCircular` model | Storage for detected circulars |
| `GapAnalysis` model | Storage for auto-generated gap analyses |
| `ComplianceAlert` model | Auto-create alerts for high-impact changes |
| `CalendarEvent` model | Auto-create review deadlines |
| `Notification` model | Push notifications for detected changes |
| `RiskAssessment` model | Cross-reference for impact scoring |
| `Policy` model | Cross-reference for gap analysis |
| Ollama + AI Gateway | AI-powered diff analysis and summarization |
| Qdrant (Feature 2) | Enhanced search if Advanced RAG is implemented |
| Real-time notifications (Feature 1) | Push alerts for detected changes |
| `src/lib/env.ts` | Feature flag: `ENABLE_REGULATORY_SCRAPER` |
| Caddy | Scraper must respect robots.txt and rate limits |

---

## Summary Timeline & Priority Matrix

### Implementation Order

The recommended implementation sequence accounts for inter-feature dependencies and business impact:

| Order | Feature | Rationale |
|---|---|---|
| **1st** | Real-Time WebSocket Notifications | Foundation for all other real-time features. Existing Socket.io prototype reduces risk. Directly improves Maker-Checker and SAR deadline workflows. |
| **2nd** | Advanced RAG for Regulatory Documents | Builds on existing Qdrant + AI Gateway infrastructure. No schema migration required for existing models. Enables Feature 5 (scraper results need vector indexing). |
| **3rd** | SSO Integration with Enterprise Identity Providers | Independent of Features 1–2. Can be developed in parallel. Highest security impact. UAE Pass integration requires government onboarding lead time. |
| **4th** | Automated Regulatory Change Detection | Depends on Feature 1 (notifications) and Feature 2 (RAG indexing). Highest business value but also highest maintenance burden. |
| **5th** | Multi-Tenancy | Most invasive change (touches all 39+ models). Should be last because it benefits from all other features being stable first. Requires careful schema migration planning. |

### Timeline Estimate

| Feature | Estimated Duration | Team Size | Sprint Count (2-week sprints) |
|---|---|---|---|
| 1. Real-Time WebSocket Notifications | 4–6 weeks | 2 developers | 2–3 sprints |
| 2. Advanced RAG for Regulatory Documents | 6–8 weeks | 2 developers | 3–4 sprints |
| 3. SSO Integration with Enterprise IdPs | 6–10 weeks | 2 developers | 3–5 sprints |
| 4. Automated Regulatory Change Detection | 8–10 weeks | 2 developers | 4–5 sprints |
| 5. Multi-Tenancy | 10–14 weeks | 3 developers | 5–7 sprints |
| **Total** | **34–48 weeks** | — | **17–24 sprints** |

### Priority Matrix

```
                    HIGH Business Value
                          │
           Feature 4 ●    │    ● Feature 1
        (Reg Scraper)     │    (WebSocket)
                          │
                          │         ● Feature 2
                          │        (Adv. RAG)
                          │
 ─────────────────────────┼──────────────────────── HIGH Feasibility
                          │
           Feature 5 ●    │
        (Multi-Tenancy)   │
                          │    ● Feature 3
                          │   (SSO/IdP)
                          │
                    LOW Business Value
```

| Feature | Business Value | Feasibility | Risk | Priority |
|---|---|---|---|---|
| 1. Real-Time WebSocket Notifications | **High** — Direct compliance impact (SAR deadlines, Maker-Checker) | **High** — Existing prototype, Socket.io mature | **Low** | **P1 — Implement First** |
| 2. Advanced RAG for Regulatory Documents | **Medium-High** — Significant efficiency gain for policy analysis | **Medium** — Qdrant exists, PDF parsing complexity | **Medium** | **P2 — Implement Second** |
| 3. SSO Integration with Enterprise IdPs | **Medium** — Security and UX improvement, UAE Pass future requirement | **Medium** — SAML complexity, UAE Pass onboarding | **Medium** | **P3 — Implement Third** |
| 4. Automated Regulatory Change Detection | **High** — Transforms compliance from reactive to proactive | **Low-Medium** — Scraper fragility, false positives | **High** | **P4 — Implement Fourth** (needs Features 1+2) |
| 5. Multi-Tenancy | **Medium** — Required for group-level compliance | **Low** — Most invasive change, highest testing surface | **High** | **P5 — Implement Last** |

---

## Risk Assessment & Mitigations

| Risk | Affected Features | Mitigation |
|---|---|---|
| **WebSocket server downtime** | Feature 1 | Graceful fallback to 10s polling; all events persisted to SQLite regardless of push delivery |
| **PDF parsing failures** (encrypted, scanned, Arabic PDFs) | Feature 2 | Multi-parser fallback (pdf-parse → Tesseract OCR); manual text input as fallback; queue failed documents for human review |
| **Qdrant embedding drift** (model updates change vector semantics) | Feature 2, 5 | Pin embedding model version; re-index on model change; store raw text alongside vectors for full-text search fallback |
| **SAML integration complexity** | Feature 3 | Start with OIDC (Azure AD) which is simpler; add SAML (Okta/UAE Pass) incrementally; keep credential provider as permanent fallback |
| **UAE Pass onboarding delays** | Feature 3 | UAE Pass requires government registration (2–6 weeks); implement Okta/Azure AD first; UAE Pass integration can be a point release |
| **Scraper breakage** (website structure changes) | Feature 4 | Health check alerts on scraper failure; version scrapers with last-known-working selectors; manual circular entry as fallback; design for easy selector updates |
| **AI diff analysis hallucination** | Feature 4 | Apply existing hallucination guard from `rag-policy-wizard.ts`; always show raw diff alongside AI analysis; require human review before auto-creating alerts |
| **Schema migration data loss** | Feature 5 | Run migration on backup first; default tenantId prevents NULL violations; transactional migration with rollback; feature flag allows disabling multi-tenancy if migration fails |
| **Cross-tenant data leakage** | Feature 5 | Prisma middleware enforcement at ORM level; integration tests for every cross-tenant scenario; penetration testing before production; audit log all cross-tenant access attempts |
| **Performance degradation** | Feature 5 | Row-level tenant filtering adds WHERE clause overhead; add composite indexes on (tenantId, createdAt) for all models; monitor query plans after migration |

---

*This roadmap is a living document. Feature specifications should be refined into detailed technical design documents before implementation begins. Each feature should be gated behind a feature flag in `src/lib/env.ts` and developed on a dedicated branch before merging to main.*

**Document prepared by:** IC-OS Phase 7 Roadmap Writer  
**Review status:** Draft — Awaiting MLRO and CTO approval  
**Next steps:** Feature 1 technical design document → Sprint planning → Implementation
