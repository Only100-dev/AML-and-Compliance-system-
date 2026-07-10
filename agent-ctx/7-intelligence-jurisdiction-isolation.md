# Task 7 — Intelligence Engine Jurisdiction Isolation Agent

## Summary
Audited and fixed all 8 intelligence API routes for jurisdiction isolation. Created shared session-based jurisdiction helper module. All routes now use NextAuth session for identity verification instead of trusting client-supplied values.

## Key Changes

### New File
- `src/lib/intelligence/session-jurisdiction.ts` — Shared helpers for session-based jurisdiction isolation
  - `getAuthenticatedContext()` — Extracts user context from NextAuth session
  - `validateJurisdictionAccess()` — Validates client jurisdiction against session scope
  - `trendJurisdictionFilter()` — Prisma where clause for TrendSignal JSON jurisdiction field
  - `filterTrendsByJurisdiction()` — In-memory filter for TrendSignal arrays

### Fixed Routes (8 files)
1. **search/route.ts** — Session auth, jurisdiction filtering, TrendSignal filtering (was unfiltered)
2. **actions/route.ts** — Session userId/role/jurisdiction override body params
3. **alerts/route.ts** — Session auth, post-fetch jurisdiction filtering, filter validation
4. **watchlist/route.ts** — Session auth, jurisdiction filtering on included items, pin validation
5. **agent/route.ts** — Session auth, jurisdiction-scoped scan logs, scan trigger restriction
6. **ai-suggestions/route.ts** — Session auth required, TrendSignal filtering, AI prompt jurisdiction constraint
7. **benchmarking/route.ts** — Session auth, MLRO single-jurisdiction view, regional aggregate scope
8. **export/route.ts** — Session auth, TrendSignal filtering, watchlist jurisdiction filtering

## Critical Vulnerabilities Fixed
- **TrendSignal data leak**: All routes querying TrendSignal had NO jurisdiction filter — any authenticated user could see trends for all 6 GCC jurisdictions
- **Spoofable identity**: All routes accepted userId, userRole, userJurisdiction from query params or request body — a malicious user could set `?jurisdiction=SA` to see KSA data
- **Hardcoded CBUAE defaults**: Multiple routes defaulted to 'CBUAE' when no jurisdiction was provided

## Verification
- Lint: 0 errors, 2 pre-existing warnings
- Dev server: healthy, `/api/health` → 200
- Unauthenticated access to intelligence routes → 401 (correct, enforced by middleware)
