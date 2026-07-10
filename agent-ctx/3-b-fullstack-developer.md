# Task 3-b: Wire goAML Filing Center and Maker-Checker Queue to Real APIs

## Agent: Full-Stack Developer

## Summary
Successfully replaced hardcoded mock data in both GoAMLFilingCenter and MakerCheckerQueue components with real API calls using TanStack Query hooks.

## Files Modified
1. **src/components/ic-os/goaml/GoAMLFilingCenter.tsx** — Full rewrite of data layer
2. **src/components/ic-os/maker-checker/MakerCheckerQueue.tsx** — Full rewrite of data layer
3. **src/app/api/maker-checker/route.ts** — Added status=ALL support

## Key Changes

### GoAMLFilingCenter.tsx
- Replaced `useState<GoAMLFiling[]>(mockFilings)` → `useQuery` fetching `/api/goaml`
- Added "New Filing" dialog with form (reportType, subjectName, amountAED, initial status)
- Create filing: `useMutation` POST `/api/goaml` with auto-generated reference number
- Approve filing: `useMutation` PUT `/api/goaml` with `{ id, filingStatus, submittedAt }`
- HIGH-risk filings (STR/SAR): show Maker-Checker notice when PENDING_APPROVAL
- Loading/error states with toast notifications
- Cache invalidation: goamlFilings + makerChecker keys

### MakerCheckerQueue.tsx
- Two `useQuery` hooks: pending (`status=PENDING`) and all (`status=ALL`)
- Approve/Reject: `useMutation` POST `/api/maker-checker` with `{ logId, checkerId, checkerName, action }`
- Current user from `useICOSStore().currentUser` for checker identity
- Frontend maker≠checker enforcement: red conflict warning + disabled buttons
- Loading/error states with per-request loading indicators
- Cache invalidation: makerChecker + goamlFilings keys

### API Route Fix
- `/api/maker-checker?status=ALL` now returns all statuses (previously defaulted to PENDING)

## Verification
- Lint: 0 errors
- API tests: GET /api/goaml 200, GET /api/maker-checker?status=PENDING 200, GET /api/maker-checker?status=ALL 200
- Dev server: clean compilation
- Homepage: loads correctly
