# Task 2 - Fullstack Developer: Connect AMLSanctionsTriage to Real API Hooks

## Summary
Connected the AMLSanctionsTriage component from mock data to live API hooks, following the same pattern as CommandCenter.tsx.

## Files Modified
1. **`src/components/ic-os/aml/AMLSanctionsTriage.tsx`** - Main component, replaced mock data with API hooks
2. **`src/lib/api-hooks.ts`** - Added `useSanctionsExceptions` hook and `SanctionsException` type import

## Files Created
1. **`src/app/api/sanctions-exceptions/route.ts`** - New GET endpoint for SanctionsException data from DB

## Key Changes in AMLSanctionsTriage.tsx
- **Alerts**: `useState([...mockAMLAlerts])` → `useMemo` deriving from `useAMLAlerts()` API with mock fallback
- **Compliance metrics**: `mockComplianceMetrics.*` → `useComplianceMetrics()` API with fallback
- **Sanctions exceptions**: `useMemo(() => mockSanctionsExceptions, [])` → `useSanctionsExceptions('active')` with fallback
- **Kanban mutations**: `setAlerts()` → `setStatusOverrides()` (avoids setState-in-effect lint violation)
- **Loading state**: Full-screen Loader2 spinner when initial load
- **Error state**: AlertCircle + retry button when API fails
- **Refresh**: Inline indicator + Refresh button in header
- Removed `useEffect` import (no longer needed)

## API Endpoint: /api/sanctions-exceptions
- GET with optional `?status=active` filter
- Queries Prisma `sanctionsException` table
- Calculates `daysRemaining` from `sunsetDate`
- Parses `compensatingControls` from comma-separated string to string array
- Returns meta with `total`, `active`, `expiringSoon`

## Lint Status
- 0 errors, 0 warnings

## Verification
- `GET /api/sanctions-exceptions` returns 200 with 3 active exceptions
- `GET /api/compliance` returns 200 with overdueReviews=3, sanctionsHits=1, falsePositiveRate=12.4
- `GET /api/aml` returns 200 with 4 AML alerts
