# Monitoring & Telemetry Setup — IC-OS v7.2

> **Scope**: Telemetry, audit trail integrity, system health, error tracking, performance monitoring, and user quick-start workflows.

---

## 1. Telemetry System Overview

### How It Works

The telemetry system is implemented in `src/lib/telemetry.ts` as a **singleton `Telemetry` class** with an in-memory event buffer (max 1,000 events). It provides three severity levels:

| Method | Type | Use Case |
|--------|------|----------|
| `logError(error, context)` | `error` | Unhandled exceptions, API failures, rendering errors |
| `logWarning(message, context)` | `warning` | Degraded performance, retryable failures, non-critical anomalies |
| `logInfo(message, context)` | `info` | User actions, module navigation, feature usage |

Each event captures:
```typescript
{
  timestamp: string;           // ISO 8601
  type: 'error' | 'warning' | 'info';
  module: string;              // e.g. 'AMLAlerts', 'AdverseMedia'
  action: string;              // e.g. 'componentDidCatch', 'fetchData'
  message: string;             // Error message or description
  context?: Record<string, unknown>;  // Additional structured data
  userId?: string;
  sessionId?: string;
}
```

### What Events Are Logged

- **Error Boundary catches**: Every `ModuleErrorBoundary` and `ErrorBoundary` catch logs via `logError()` with the module name, action (`componentDidCatch`), and the React component stack.
- **API hook errors**: React Query hooks return `error` fields from failed fetches; these can be piped into telemetry.
- **Adverse media session save failures**: The `AdverseMediaSearch` component logs save errors via `toast.error()`.
- **Audit log write failures**: The Prisma audit middleware logs `console.error` when `AuditLog.create()` fails.

### Accessing Telemetry Logs in Dev Console

In **development mode** (`NODE_ENV === 'development'`), errors are printed to the browser console with structured context:

```
[Telemetry] ERROR in AMLAlerts.componentDidCatch: Cannot read properties of undefined {componentStack: "..."}
```

To inspect the full event buffer programmatically:

```javascript
// In browser dev console — import the singleton
import { telemetry } from '@/lib/telemetry';

// Get last 50 events (all types)
telemetry.getRecentEvents(50);

// Get last 50 errors only
telemetry.getErrors(50);
```

### Extending for Production Logging

The current implementation is a lightweight dev-mode logger. For production, extend the `addEvent()` method to forward events to an APM provider:

#### DataDog Integration
```typescript
private addEvent(event: TelemetryEvent) {
  this.events.push(event);
  if (this.events.length > this.maxEvents) {
    this.events = this.events.slice(-this.maxEvents);
  }

  // Production forwarding
  if (process.env.NODE_ENV === 'production') {
    import('@datadog/browser-logs').then(({ logger }) => {
      if (event.type === 'error') logger.error(event.message, event);
      else if (event.type === 'warning') logger.warn(event.message, event);
      else logger.info(event.message, event);
    });
  }
}
```

#### Sentry Integration
```typescript
private addEvent(event: TelemetryEvent) {
  // ... existing buffer logic ...

  if (process.env.NODE_ENV === 'production') {
    import('@sentry/nextjs').then(({ captureException, captureMessage }) => {
      if (event.type === 'error') {
        captureException(new Error(event.message), { extra: event.context, tags: { module: event.module } });
      } else {
        captureMessage(`[${event.type.toUpperCase()}] ${event.module}.${event.action}: ${event.message}`, event.type === 'warning' ? 'warning' : 'info');
      }
    });
  }
}
```

#### Key Considerations
- **Do NOT log PII**: Filter out `userId`, `userName`, and other personally identifiable information before forwarding to third-party services.
- **Rate limiting**: APM providers have ingestion limits; consider batching or sampling in high-traffic scenarios.
- **Source maps**: Ensure production builds include source maps (stored securely, not publicly served) for readable stack traces.

---

## 2. Audit Trail Verification Guide

### How SHA-256 Hashes Are Generated

Audit trail integrity is maintained through SHA-256 hashing implemented in two complementary systems:

#### Direct Audit Logging (`src/lib/audit.ts`)
```typescript
const hashPayload = JSON.stringify({
  userId: input.userId,
  action: input.action,
  resourceType: input.resourceType,
  resourceId: input.resourceId,
  timestamp: new Date().toISOString(),
  changes: input.changes || {},
});
const sha256Hash = crypto.createHash('sha256').update(hashPayload).digest('hex');
```

#### Prisma Audit Middleware (`src/lib/compliance/audit-middleware.ts`)
The middleware intercepts all `create`, `update`, and `delete` operations on **20 audited models** and generates hashes automatically:

| Category | Audited Models |
|----------|---------------|
| AML/Sanctions | `AMLAlert`, `SARCase`, `GoAMLFiling`, `SanctionsScreening`, `SanctionsException` |
| KYC | `CorporateKYC`, `IndividualKYC`, `VASPKYC` |
| Compliance | `ComplianceAlert`, `ComplianceCase`, `ComplianceAudit` |
| Governance | `Policy`, `PolicyAttestation`, `RegulatoryCircular`, `Regulation` |
| Claims | `Claim` |
| Other | `MakerCheckerLog`, `VendorDueDiligence`, `RiskAssessment`, `InsuranceRecord`, `QuarterlyReport` |

The hash is computed over a deterministic JSON string:
```typescript
const payload = JSON.stringify({
  userId: entry.userId,
  action: entry.action,
  resource: entry.resource,
  resourceId: entry.resourceId,
  details: entry.details,
  timestamp: new Date().toISOString(),
  previousData: entry.previousData ?? null,
  newData: entry.newData ?? null,
});
return createHash('sha256').update(payload).digest('hex');
```

### Integrity Verification API

A server-side verification function exists in `src/lib/compliance/audit-middleware.ts`:

```typescript
export async function verifyAuditIntegrity(auditLogId: string): Promise<boolean>
```

It re-reads the audit log entry from the database, recomputes the SHA-256 hash from the stored data, and returns `true` if the hash matches, `false` if tampered.

### Step-by-Step Verification Guide for Admins

#### Step 1: Navigate to the Audit Trail Module
1. Open IC-OS v7.2
2. Click **"Audit Trail"** in the sidebar under **Shared Modules**
3. The module header displays: **"Immutable Audit Trail — SHA-256 Secured · Append-Only Log · CBUAE Compliant"**

#### Step 2: Verify SHA-256 Hashes Display Correctly
1. Each audit entry row contains a **truncated SHA-256 hash** displayed in monospace font (`text-[9px] font-mono`)
2. Hover over a hash to see the **full hash value** in a tooltip
3. Click the **Copy icon** (📋) next to a hash to copy it to clipboard — a toast confirms "SHA-256 hash copied to clipboard"
4. Verify that hash values are 64-character hex strings (SHA-256 output)

#### Step 3: Cross-Reference with Database Entries
1. Use the **Filter Bar** to narrow by action type, user, or search term
2. Click the **Eye icon** (👁) on any entry to open the Hash Verification dialog
3. The verification dialog shows three states:
   - **Pending**: "Preparing verification..."
   - **Verifying**: "Verifying SHA-256 hash integrity..." with spinner
   - **Verified**: Green checkmark with "Hash Verified Successfully — The audit entry has not been tampered with"
4. For server-side verification, call the API:
   ```bash
   # Via the audit-log API
   curl http://localhost:3000/api/audit-log?limit=10

   # Check that sha256Hash field is populated for each entry
   ```

#### Step 4: Check That User Actions Are Being Recorded
1. Perform a compliance action (e.g., approve an AML alert, upload a KYC document)
2. Return to the Audit Trail module
3. Click the **Refresh button** (🔄) in the header
4. Verify the new action appears with:
   - Correct **user name** and **action badge**
   - Appropriate **resource** and **resource ID**
   - **AI Confidence** score (if AI-assisted)
   - Fresh **SHA-256 hash**
   - **Timestamp** in UAE timezone (Asia/Dubai)

#### Step 5: Verify Immutable Records
1. Compliance Alerts with `isImmutable: true` cannot be modified or deleted — any attempt triggers a `MAKER_CHECKER_VIOLATION` audit entry
2. The audit trail footer displays: **"All entries stored in immutable audit log with SHA-256 hashing · Append-only — No deletion or modification permitted"**
3. Maker-Checker violations are flagged with a red highlight class (`maker-checker-violation`)
4. Statistics cards show: Total Entries, Overrides Blocked, AI-Assisted Decisions

---

## 3. System Health Monitoring

### Health Check Endpoint

**Endpoint**: `GET /api/health`

The endpoint is configured with `dynamic = 'force-dynamic'` to ensure fresh data on every request.

### Metrics Returned

```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "version": "6.0.0",
  "phase": "Phase 6 — Production Readiness",
  "uptime": 86400,
  "region": "me-central-1",
  "dataResidency": "UAE",
  "compliance": {
    "pdpl": true,
    "cbuae": true,
    "cspHeaders": true,
    "hsts": true
  },
  "services": {
    "database": {
      "status": "connected" | "degraded" | "down",
      "latencyMs": 12,
      "provider": "SQLite"
    },
    "aiGateway": {
      "status": "available" | "not_configured",
      "url": "http://localhost:8000"
    },
    "ollama": {
      "status": "available" | "not_configured",
      "url": "http://localhost:11434"
    }
  },
  "security": {
    "score": 88,
    "grade": "A" | "B" | "C" | "D",
    "checks": {
      "httpsEnforced": true,
      "authConfigured": true,
      "dataResidencyUAE": true,
      "piiMaskingEnabled": true,
      "makerCheckerEnabled": true,
      "aiOnPremise": false,
      "cspHeadersActive": true,
      "hstsActive": true
    }
  },
  "performance": {
    "healthCheckLatencyMs": 45
  }
}
```

### Status Logic

| Condition | Status | HTTP Code |
|-----------|--------|-----------|
| DB connected, latency < 100ms | `healthy` | 200 |
| DB connected, latency ≥ 100ms | `degraded` | 200 |
| DB down | `unhealthy` | 503 |

### Security Score Grading

| Score | Grade |
|-------|-------|
| 90–100 | A |
| 75–89 | B |
| 60–74 | C |
| < 60 | D |

### Setting Up Monitoring Alerts

#### Uptime Robot / Pingdom
```
URL: https://your-icos-domain.com/api/health
Expected Status: 200
Expected String: "healthy"
Check Interval: 60 seconds
Alert on: status != 200, response contains "degraded" or "unhealthy"
```

#### Datadog Monitor
```yaml
# datadog-monitor.yaml
name: IC-OS Health Check
type: metric
query: "avg(last_5m):avg:icos.health.status{env:production} < 1"
message: |
  IC-OS health check is reporting degraded or unhealthy status.
  Check /api/health for details. @slack-ops-channel
thresholds:
  critical: 0.5
  warning: 0.8
```

#### Custom Prometheus Exporter
```typescript
// Example: expose /api/health metrics to Prometheus
import { Registry, Gauge } from 'prom-client';

const registry = new Registry();
const healthGauge = new Gauge({
  name: 'icos_health_status',
  help: 'IC-OS health status: 2=healthy, 1=degraded, 0=unhealthy',
  registers: [registry],
});

// Poll /api/health every 30s and update gauge
setInterval(async () => {
  const res = await fetch('http://localhost:3000/api/health');
  const data = await res.json();
  healthGauge.set(data.status === 'healthy' ? 2 : data.status === 'degraded' ? 1 : 0);
}, 30000);
```

#### Key Alerts to Configure

| Alert | Condition | Severity |
|-------|-----------|----------|
| Database down | `services.database.status === "down"` | Critical |
| Database slow | `services.database.latencyMs > 100` | Warning |
| Security score drop | `security.score < 75` | Warning |
| AI services offline | `aiGateway.status === "not_configured"` AND `ollama.status === "not_configured"` | Info |
| Health check latency | `performance.healthCheckLatencyMs > 500` | Warning |
| PII masking disabled | `security.checks.piiMaskingEnabled === false` | Critical |

---

## 4. Error Boundary & Error Tracking

### Architecture: Two-Tier Error Boundaries

IC-OS implements a two-tier error boundary system to ensure module isolation:

```
<ErrorBoundary module="AppContent">           ← App-level (outer)
  <main>
    <Suspense fallback={<SectionLoader />}>
      <ModuleErrorBoundary moduleName="AML & Sanctions Triage">  ← Module-level (inner)
        <AMLSanctionsTriage />
      </ModuleErrorBoundary>
    </Suspense>
  </main>
</ErrorBoundary>
```

### ModuleErrorBoundary (Per-Module)

**File**: `src/components/shared/ErrorBoundary.tsx`

- **Purpose**: Catches errors within a single module, preventing a crash from propagating to the rest of the app.
- **Props**: `moduleName: string` — displayed in the error UI.
- **Behavior on error**:
  1. Catches the error via `getDerivedStateFromError`
  2. Logs to telemetry: `logError(error, { module: moduleName, action: 'ModuleErrorBoundary.componentDidCatch', componentStack })`
  3. Renders a compact error card with:
     - Alert icon + "Module Error" header
     - Module name highlighted: "The **AML & Sanctions Triage** module encountered an error"
     - Error message in monospace
     - **Retry** button (resets component state)
  4. Does **not** take down other modules or the app shell

### ErrorBoundary (App-Level)

**File**: `src/components/shared/ErrorBoundary.tsx`

- **Purpose**: Catches errors that escape module-level boundaries (e.g., layout crashes, sidebar errors).
- **Props**: `module?: string` — optional module name for context.
- **Behavior on error**:
  1. Logs to telemetry: `logError(error, { module, action: 'componentDidCatch', componentStack })`
  2. Renders a full error card with:
     - Alert icon + "Something went wrong" header
     - Contextual message: "An error occurred in the [module] module" or generic message
     - Error message in monospace
     - **Try Again** button (resets boundary state)
     - **Reload Page** button (full page refresh)
     - Footer: "Error logged to telemetry — IC-OS v7.2"

### Legacy ErrorBoundary

**File**: `src/components/ErrorBoundary.tsx`

- Simpler implementation without telemetry integration
- Logs to `console.error` only
- Provided as a fallback; the shared `ErrorBoundary` is preferred

### Error Logging via Telemetry

All errors caught by the shared ErrorBoundary components are automatically forwarded to the telemetry system:

```typescript
// From ModuleErrorBoundary.componentDidCatch:
logError(error, {
  module: this.props.moduleName,
  action: 'ModuleErrorBoundary.componentDidCatch',
  componentStack: errorInfo.componentStack,
});
```

The telemetry singleton stores up to 1,000 events and surfaces them via:
- `telemetry.getRecentEvents(count)` — all event types
- `telemetry.getErrors(count)` — errors only

### Reading Error Reports

In development:
```
[Telemetry] ERROR in AML & Sanctions Triage.ModuleErrorBoundary.componentDidCatch:
Cannot read properties of undefined (reading 'riskLevel')
{componentStack: "    at AMLSanctionsTriage..."}
```

For production, integrate an APM service (see Section 1) to aggregate, search, and alert on error patterns.

---

## 5. Performance Monitoring

### React Query Cache Invalidation Patterns

IC-OS uses **TanStack React Query** with a centralized query key factory in `src/lib/query-hooks.ts`:

```typescript
export const queryKeys = {
  dashboard: ['dashboard'] as const,
  amlAlerts: (filters?) => ['aml-alerts', filters] as const,
  auditLog: (filters?) => ['audit-log', filters] as const,
  health: ['health'] as const,
  // ... 30+ query keys
};
```

**Cache invalidation** is handled by the `useApiMutation` hook:

```typescript
export function useApiMutation(options?: {
  invalidateKeys?: string[][];
  onSuccess?: (data: unknown) => void;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({ url, method, body }) => apiMutate(url, method, body),
    onSuccess: (data) => {
      if (options?.invalidateKeys) {
        options.invalidateKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
      options?.onSuccess?.(data);
    },
  });
  // ...
}
```

**Example: Policy Wizard** invalidates both `policyWizard` and `policies` keys after a successful mutation:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.policyWizard });
  queryClient.invalidateQueries({ queryKey: queryKeys.policies() });
}
```

**Best practices for cache management**:
- Use specific query keys with filters to avoid over-invalidation
- Call `queryClient.invalidateQueries()` after mutations, not `removeQueries()`
- Leverage `enabled: !!param` for conditional queries (e.g., UBO tree only when `entityId` is provided)

### Lazy Loading Strategy for 31+ Modules

All modules are **lazy-loaded** using React `lazy()` and `Suspense` in `src/app/page.tsx`:

```typescript
const CommandCenter = lazy(() => import('...').then(m => ({ default: m.CommandCenter })));
const AdverseMediaSearch = lazy(() => import('...').then(m => ({ default: m.AdverseMediaSearch })));
// ... 28 more lazy imports
```

**Benefits**:
- Initial bundle only includes the app shell (Sidebar, TopBar, ErrorBoundary, layout)
- Each module is loaded on demand when the user navigates to it
- The `SectionLoader` component provides a smooth loading spinner during chunk download
- Module-level code splitting means a user only downloads code for modules they actually use

**Measured impact**:
- Initial page load: ~58KB (shell only)
- Per-module chunks: 5–15KB each
- Total if all modules loaded: ~400KB+ (avoided by lazy loading)

### Virtual Scrolling for Large Lists

The Audit Trail component uses **@tanstack/react-virtual** for rendering large lists efficiently:

```typescript
const virtualizer = useVirtualizer({
  count: filteredLogs.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 80,
  overscan: 5,
});
```

**Configuration**:
- `estimateSize: 80` — estimated row height in pixels
- `overscan: 5` — renders 5 extra rows above/below viewport for smooth scrolling
- Maximum rendered height: 600px (`max-h-[600px]` on the ScrollArea container)

**Performance characteristics**:
- Only visible rows + overscan are rendered in the DOM
- A 10,000-entry audit log renders the same number of DOM nodes as a 50-entry list
- Rows are absolutely positioned using CSS transforms for smooth scrolling

### Bundle Size Optimization

| Technique | Implementation |
|-----------|---------------|
| **Code splitting** | All 31 modules loaded via `React.lazy()` with named exports |
| **Dynamic imports** | CSV export (`generateCSV`, `downloadCSV`) imported dynamically: `await import('@/lib/csv-export')` |
| **Tree shaking** | ESM imports throughout; barrel exports in UI components |
| **Suspense boundaries** | Module-level Suspense with `SectionLoader` fallback; CommandMenu has `fallback={null}` |
| **Named exports** | `lazy(() => import('...').then(m => ({ default: m.ComponentName })))` avoids loading entire modules |
| **CSS optimization** | Tailwind CSS with purging; only used utility classes in production bundle |

---

## 6. User Quick-Start Guide

### Workflow 1: Using the Cmd+K Command Palette

The Command Palette provides instant access to all modules, actions, and settings.

**Opening the Palette**:
- Press **Cmd+K** (macOS) or **Ctrl+K** (Windows/Linux)
- The palette opens as a dialog overlay

**Searching**:
- Start typing to filter — it searches labels, descriptions, and keywords
- Example: Type "SAR" to find "File SAR Report"
- Example: Type "kyc" to find both Corporate and Individual KYC

**Navigation**:
- Results are grouped by category: **Compliance**, **KYC**, **Admin**, **Analytics**, **Operations**, **Help**
- Each result shows an icon, label, and description
- Press **Enter** or click to navigate directly to the module

**Quick Actions Available**:

| Action | Keyword Triggers |
|--------|-----------------|
| File SAR Report | `sar`, `str`, `ctr`, `filing`, `goaml` |
| Run Sanctions Screen | `sanctions`, `screening`, `ofac`, `adverse` |
| New Corporate KYC | `corporate`, `kyc`, `onboarding`, `company` |
| New Individual KYC | `individual`, `kyc`, `onboarding`, `person` |
| Evidence War Room | `evidence`, `upload`, `inspection` |
| AI Engine Configuration | `ai`, `engine`, `config`, `models`, `ollama` |
| Advanced Analytics | `analytics`, `risk`, `scoring`, `charts` |
| Generate Audit Pack | `audit`, `pack`, `export`, `report` |
| Help & Documentation | `help`, `docs`, `manual`, `guide` |

---

### Workflow 2: Executing an Adverse Media Screening

The Adverse Media Search module follows a 5-step wizard: **Subject Details → Search Configuration → Results → Decision → Report**.

**Step 1 — Subject Details**:
1. Navigate to **Adverse Media Search** (sidebar or Cmd+K → "sanctions")
2. Select subject type: **Individual** or **Entity**
3. Enter the full legal name (required)
4. Optionally add AKA/aliases (press Enter to add each)
5. Select nationality/jurisdiction from dropdown
6. Enter date of birth (individual) or registration number (entity)
7. Click **Next**

**Step 2 — Search Configuration**:
1. Review the default **83-term AML boolean keyword string** (pre-populated)
2. Customize the keyword string if needed (supports AND, OR, NOT operators)
3. Set optional date range (From/To)
4. Select search sources (Google News, LexisNexis, Dow Jones, World-Check, OpenSanctions, UAE Local Media, Gulf News, The National, Khaleej Times)
5. Click **Next** to proceed to results

**Step 3 — Results**:
1. Review logged search results with risk relevance badges (Low/Medium/High)
2. Add manual results using the **"Add Manual Result"** button if needed
3. Remove irrelevant results with the trash icon
4. Click **Next**

**Step 4 — Decision**:
1. Select a classification:
   - **CLEAR** — No adverse media found
   - **FALSE_POSITIVE** — Results found but unrelated
   - **POTENTIAL_MATCH** — Adverse media may relate to subject (requires further review)
   - **CONFIRMED_MATCH** — Adverse media confirmed (escalation required)
2. Provide a detailed rationale (minimum 10 characters; 20+ recommended for audit trail)
3. Click **Next** to finalize

**Step 5 — Report**:
1. The session is automatically saved to the API with SHA-256 audit trail
2. Download the PDF report or start a **New Screening**
3. The classification decision and rationale are permanently recorded

---

### Workflow 3: Exporting a PII-Masked CSV Audit Pack

IC-OS provides two export mechanisms for audit data:

#### From the Audit Trail Module (CSV Export)

1. Navigate to **Audit Trail** (sidebar → Shared Modules)
2. Apply filters as needed (action type, user, search term)
3. Click **"Export Audit Pack"** button in the header
4. A CSV file downloads as `ic-os-audit-trail-YYYY-MM-DD.csv`
5. The CSV includes columns: `id`, `timestamp`, `userName`, `userId`, `action`, `resource`, `resourceId`, `details`, `sha256Hash`, `aiConfidence`

#### From the Audit Pack Generator (PDF Export)

1. Navigate to **Audit Pack Generator** (Cmd+K → "audit pack" or via Compliance Audits)
2. Choose from available report templates:
   - AML/CFT Audit Report (CBUAE Regulatory)
   - Compliance Assessment (DFSA Internal)
   - Sanctions Review Report (CBUAE Regulatory)
   - KYC/CDD Audit Pack (FSRA External)
   - Quarterly Board Report (CBUAE Board)
3. Click **"Generate Audit Pack"**
4. A branded PDF downloads including:
   - Executive Summary & Audit Overview
   - Detailed Findings & Risk Assessment
   - CBUAE/DFSA/FSRA formatted tables
   - SHA-256 Integrity Verification stamp

#### PII Masking

PII masking is controlled by the `ENABLE_PII_MASKING` environment variable (default: `true`).

The CSV export utility (`src/lib/csv-export.ts`) supports per-field masking:

```typescript
generateCSV({
  headers: ['subjectName', 'subjectType', 'decision'],
  rows: sessions,
  piiMaskMap: { subjectName: maskName },  // Applies mask function to subjectName column
});
```

**To verify PII masking**:
1. Open the exported CSV file
2. Check that sensitive fields (names, IDs, phone numbers) are masked (e.g., `A**** A-R****` instead of full names)
3. Confirm SHA-256 hashes are present and intact
4. If masking is not applied, verify `ENABLE_PII_MASKING=true` in your `.env` file

---

## Appendix: Monitoring Checklist

| Check | Frequency | Tool | Alert Threshold |
|-------|-----------|------|-----------------|
| Health endpoint response | Every 60s | Uptime monitor | status != 200 |
| Database connectivity | Every 60s | /api/health | `dbStatus === "down"` |
| Database latency | Every 60s | /api/health | latency > 100ms |
| Security score | Every 5m | /api/health | score < 75 |
| Error rate | Continuous | Telemetry / APM | > 5 errors/min |
| Audit trail hash integrity | Daily | verifyAuditIntegrity() | Any mismatch |
| Maker-Checker violations | Real-time | Audit trail | Any violation |
| PII masking status | On deploy | /api/health | `piiMaskingEnabled === false` |
| Bundle size | On deploy | CI/CD | > 500KB initial load |
| Module load time | Weekly | Lighthouse / Web Vitals | LCP > 2.5s |
