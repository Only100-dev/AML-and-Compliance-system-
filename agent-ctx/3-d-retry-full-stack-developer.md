# Task 3-d-retry — Full-Stack Developer Work Record

## Task
Wire 3 modules from mock data to real API calls. Do NOT change visual design.

## Changes Made

### 1. `/src/app/api/evidence/route.ts` (GET endpoint fix)
- **Problem**: GET endpoint returned raw Prisma `InspectionEvidence` objects which have `createdAt` field, but the frontend `EvidenceItem` type expects `uploadedAt`
- **Fix**: Added explicit field mapping in the GET handler to transform `createdAt` → `uploadedAt` (ISOString), ensuring DB records display correctly in the evidence table
- EvidenceWarRoom.tsx was already properly wired (uses `useEvidence` hook, POSTs to `/api/kyc-upload`, has loading/error states)

### 2. `/src/lib/query-hooks.ts` (useRegulatoryCirculars hook fix)
- **Problem**: Hook fetched from `/api/regulatory` which doesn't exist (404), and sent `regulator` query param but API accepts `issuer`
- **Fix**: Changed URL to `/api/regulations` and query param from `regulator` to `issuer`

### 3. `/src/components/ic-os/regulatory/RegulatoryIntelligence.tsx` (data mapping fix)
- **Problem**: useMemo mapping assumed `RegulatoryCircular`-shaped API responses, but `/api/regulations` returns `Regulation` model objects with different field names
- **Fix**: Rewrote the mapping to use Regulation model fields:
  - `c.issuer` → `regulator` (with CBUAE/DFSA/FSRA validation)
  - `c.complianceStatus` → `status` (COMPLIANT→actioned, NON_COMPLIANT→analyzing, PARTIAL→analyzed, PENDING→ingested)
  - `c.description` → `summary`
  - `c.priority` → `riskImpact` (urgent/high/critical→high, normal/medium→intermediate, low→low)
  - `c.assignedTo` (comma-split) or `c.category` → `affectedDepts`
  - Derived `circularNumber` from issuer + category + id suffix

### 4. `/src/components/ic-os/adverse-media/AdverseMediaSearch.tsx` (cleanup)
- **Already properly wired**: Starts with empty results, POSTs to `/api/adverse-media` on step 5, has savingSession loading indicator
- **Cleanup**: Removed leftover "Mock results for demonstration" / "Mock results removed" comment block

## Verification
- Lint: 0 errors, 1 pre-existing warning
- API tests: `/api/evidence` returns mapped data with `uploadedAt`, `/api/regulations` returns Regulation objects
- All 3 modules confirmed using TanStack Query hooks with real Prisma-backed API endpoints
