# Task 3-a: Wire KYC Module Components to Real API Endpoints

## Agent: Full-Stack Developer
## Status: COMPLETED

## Summary
Replaced hardcoded mock data in all 3 KYC module components with real API calls using TanStack React Query (useQuery/useMutation).

## Files Modified
1. `src/components/ic-os/kyc/CorporateKYCWizard.tsx` - Full rewrite of data layer
2. `src/components/ic-os/kyc/IndividualKYCWizard.tsx` - Full rewrite of data layer
3. `src/components/ic-os/kyc/UBOVisualization.tsx` - Added entity selector + optional prop

## Key Changes

### CorporateKYCWizard
- Removed `mockApplications` array
- Added `useQuery` for `['kyc', 'corporate']` → `GET /api/kyc?type=corporate`
- Added `useMutation` for `POST /api/kyc` with `type: 'corporate'`
- HIGH risk (riskScore >= 75): status → `PENDING_MAKER_CHECKER` (API-enforced maker-checker)
- LOW risk: status → `APPROVED` (auto-approval via POST body)
- MEDIUM risk: status → `DRAFT` (API default)
- Added `parseUboDetails()` for JSON string → UBDetail[] mapping
- Added `mapApiToApplication()` for API record → CorporateApplication mapping
- Loading/error/refresh states with Loader2, AlertCircle, RefreshCw
- Toast notifications on mutation success/error

### IndividualKYCWizard
- Removed `mockProfiles` array
- Added `useQuery` for `['kyc', 'individual']` → `GET /api/kyc?type=individual`
- Added `useMutation` for `POST /api/kyc` with `type: 'individual'`
- PEP or HIGH risk: EDD triggered, status → `PENDING_MAKER_CHECKER` (API-enforced)
- STANDARD risk: status → `APPROVED` (auto-approval)
- Added `mapApiToProfile()` for API record → IndividualProfile mapping
- Loading/error/refresh states

### UBOVisualization
- Changed `corporateKYCId` prop from required to optional
- Added `useQuery` for corporate entities list
- Added entity selector dropdown (Select component)
- Auto-selects single entity when no prop provided
- Resets state on entity change
- All states (loading/error/no-entity/no-data) include selector when applicable

## API Contracts Used
- `GET /api/kyc?type=corporate` → `{ success: true, data: CorporateKYC[] }`
- `GET /api/kyc?type=individual` → `{ success: true, data: IndividualKYC[] }`
- `POST /api/kyc` → Creates record, returns `{ success: true, data, makerChecker? }`
- `GET /api/ubo-tree?entityId={id}` → `{ success: true, data: OFAC50Result }`

## Lint: 0 errors
## Dev Server: Clean compilation
