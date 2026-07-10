# Task 7d — Frontend Developer Work Record

## Task
Wire the frontend for Phase 2 Directive 2.4 (Regulatory Circular Ingestion Integration) in the IC-OS compliance platform. Rewire the Regulatory Change Management (RCM) dashboard component (`src/components/ic-os/regulatory/RegulatoryIntelligence.tsx`) to consume committed circulars from the Phase F ingestion pipeline via the NEW `GET /api/regulatory/rcm-sync` endpoint instead of the legacy `GET /api/regulations` (via `useRegulatoryCirculars()` hook).

Server-side endpoint is ALREADY BUILT — pure frontend wiring. Do NOT modify server code. Do NOT break existing functionality.

## Context Review (from prior agents in /agent-ctx)
- Phase 0/1 finalization complete: PostgreSQL migration done, MFA + bcrypt + audit before/after + idle timeout delivered.
- `src/app/api/regulatory/rcm-sync/route.ts` is the Phase 2 Directive 2.4 server-side deliverable (160 lines, queries RegulatoryCircular + parallel groupBy on ExtractedObligation + DepartmentAcknowledgment).
- `RegulatoryIntelligence.tsx` was previously fixed by task 3-d-retry to consume `/api/regulations` (Regulation model) with client-side field mapping. That mapping is now obsolete — rcm-sync returns the correct shape directly.
- Only consumer of `RegulatoryIntelligence` is `src/app/page.tsx` (lazy import + render-case). Free to refactor internals as long as the named export is preserved.

## Changes Made

### `src/components/ic-os/regulatory/RegulatoryIntelligence.tsx` (674 → 873 lines, +199 net)

#### Imports
- Removed: `useRegulatoryCirculars` from `@/lib/query-hooks`; `RegulatoryCircular, Jurisdiction, RiskLevel` from `@/lib/types`.
- Added: `useQuery` from `@tanstack/react-query`; lucide icons `Database, Building2, CheckCheck`.
- Kept: `GapAnalysisItem` type (used by the unchanged Gap Analysis right panel).

#### Local Types (NEW — mirror the rcm-sync API contract)
- `RiskImpactLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'`
- `RcmObligations`, `RcmDeptAcks`, `RcmSla`, `RcmCircular`, `RcmSummary`, `RcmDataSource`, `RcmSyncResponse`
- All defined locally — ZERO changes to shared `src/lib/types.ts`.

#### Helper Maps
- `regulatorColors`: changed from `Record<Jurisdiction, ...>` to `Record<string, ...>` with `defaultRegulatorColor` fallback.
- `riskConfig`: REPLACED 4-key lowercase (`high|critical|intermediate|low`) with 4-key UPPERCASE per Directive 2.4 color spec:
  - CRITICAL = red (`bg-red-600/20 text-red-400`)
  - HIGH = orange (`bg-orange-500/15 text-orange-400`)
  - MEDIUM = yellow (`bg-yellow-500/15 text-yellow-400`)
  - LOW = green (`bg-emerald-500/15 text-emerald-400`)
- `gapStatusConfig` + `confidenceBadge`: preserved unchanged.

#### New `StatCard` helper
- 4 tones (emerald/amber/red/slate), accepts icon + label + value + sub + customValue.
- Used for the 6 summary stat tiles.

#### `CircularCard` rewritten
- Accepts `RcmCircular` instead of `RegulatoryCircular`.
- Header: regulator + circularNumber + risk badge (uppercase) + red "Overdue" badge when `sla.hasOverdueItems`.
- Body: title; issuingAuthority + effectiveDate + committedAt row (Building2/FileText/CheckCheck icons); affectedDepts chips.
- Obligation summary as small badges: "X Obligations" + "Y Open" + "Z In Progress" + "W Remediated" (+ "No obligations extracted" italic when total=0).
- Dept-ack summary as small badges: "X Depts" + "Y Pending" + "Z Ack'd" + "W Action Plan" + "V Overdue" (red, bold, when overdue >0).
- SLA proximity line: "Committed N days ago · SLA breach detected" (when hasOverdueItems).
- Collapsible summary + documentHash (SHA-256 prefix).
- Removed: old `statusConfig` status badge + `ai-processing` analyzing indicator (rcm-sync returns only PUBLISHED).

#### Main `RegulatoryIntelligence` component — data layer rewired
- Replaced `useRegulatoryCirculars(regulator)` with inline `useQuery<RcmSyncResponse>` keyed on `['rcm-sync', regulatorFilter, riskFilter]`.
- Query function fetches `GET /api/regulatory/rcm-sync?regulator=&riskImpactLevel=` (server-side filtering), `staleTime: 30s`.
- Derived `circulars`, `summary`, `dataSource`, `circularsError` from the response.
- Removed the 60-line client-side Regulation→RegulatoryCircular mapping `useMemo` (rcm-sync returns the correct shape directly).
- Removed `statusFilter` state (rcm-sync returns only PUBLISHED — no workflow status).
- Removed `useICOSStore()` `jurisdiction` destructure (was unused).
- `runGapAnalysis` now accepts `RcmCircular`; the `circularText` composition uses fields all present on `RcmCircular`.
- `filteredCirculars`: client-side search only (regulator + risk are server-side). Search matches title, circularNumber, summary, issuingAuthority.

#### NEW — Postgres Mapping Verification Banner (Directive 2.4)
- Green-tinted banner at the top: "Postgres Mapping Verified — RegulatoryCircular & ExtractedObligation models confirmed".
- Shows `dataSource.primary` + `mappingVerifiedAt` timestamp + "Postgres" badge with Database icon.
- Renders only when `dataSource.mappingVerifiedAt` is present.

#### NEW — 6 Summary Stat Cards (Directive 2.4)
Responsive grid (2/3/6 cols):
1. Committed Circulars (emerald)
2. Open Obligations (amber, "of N total")
3. Remediated Obligations (emerald)
4. Pending Dept Acks (amber, "of N total")
5. Overdue Items (red if >0, emerald if 0; "N circulars" sub)
6. By Risk Level (slate, custom 4-line breakdown: CRITICAL/HIGH/MEDIUM/LOW in their respective colors)

#### NEW — Server-side Risk Level filter (Directive 2.4)
- Dropdown: ALL/CRITICAL/HIGH/MEDIUM/LOW.
- Passes `?riskImpactLevel=` to the rcm-sync endpoint.
- Replaced the old client-side status filter.
- Regulator filter retained (passes `?regulator=`).
- "Clear" button appears when either filter is active.

#### Preserved (unchanged behavior)
- Gap Analysis right panel — still calls `/api/regulatory-intel/analyze` via POST with composed `circularText`, still maps the response to `GapAnalysisItem[]`, still shows the same `GapAnalysisCard` UI.
- Mobile Tabs + desktop 60/40 split layout.
- Search box, regulator filter, Collapsible circular cards.
- `GapAnalysisCard` component (missing-clause / AI-recommended-action / confidence / approve-button).

#### Layout adjustment
- Wrapped the split panel in a new outer `<div className="space-y-4">` containing: banner + stat cards + split panel.
- Split panel height: `h-[calc(100vh-8rem)]` → `h-[calc(100vh-22rem)] min-h-[420px]` to accommodate the new banner + stat cards.

#### Long-list handling
- Applied `max-h-96 overflow-y-auto` to both ScrollArea inner content divs (circular list + gap list) per project rules.
- shadcn ScrollArea provides custom scrollbar styling.

#### Copy updates
- Header: "Regulatory Circular Ingestion" → "Regulatory Change Management".
- Subtitle: "AI-powered analysis · Secure backend inference" → "Committed circulars from Phase F ingestion pipeline · Postgres-backed".
- Ingestion button toast: "Circular ingestion will be available in a future update." → "Use the Ingestion Engine module to ingest new circulars." (Phase F Ingestion Engine IS available in the sidebar).

## Verification
- `bun run lint`: PASS (0 errors, 2 pre-existing warnings — both `react-hooks/incompatible-library` for `useVirtualizer` in `AuditTrail.tsx` + `TrainingCertifications.tsx`, unrelated).
- check:nav: 43/43 PASS.
- check:audit: 0 FAIL, 21 pre-existing WARN (none introduced).
- TypeScript: PASS — dev.log shows `✓ Compiled in 928ms` and `GET / 200` responses with no errors after the file save.
- No server code modified.
- No other components broken — only consumer is `src/app/page.tsx` (named export preserved).
- No new dependencies installed — uses only existing `@tanstack/react-query` + existing shadcn/ui components.

## Files Modified
- `src/components/ic-os/regulatory/RegulatoryIntelligence.tsx` (674 → 873 lines, +199 net)

## Files NOT Modified (intentionally)
- `src/app/api/regulatory/rcm-sync/route.ts` — server endpoint, already built, out of scope.
- `src/lib/query-hooks.ts` — `useRegulatoryCirculars` hook left in place (may have other consumers; removing it would be out of scope).
- `src/lib/types.ts` — zero changes (new types are local to the component file).
- `src/app/page.tsx` — named export preserved, no changes needed.

## Regressions
None. The component's named export `RegulatoryIntelligence` is preserved. The Gap Analysis panel's API call and response mapping are unchanged — only the input shape (`RcmCircular` vs `RegulatoryCircular`) changed, and the fields used by `runGapAnalysis` are present on both shapes. The legacy `useRegulatoryCirculars` hook + `/api/regulations` endpoint are not modified or deleted. Lint passes with 0 errors. Dev server compiles successfully and serves HTTP 200.
