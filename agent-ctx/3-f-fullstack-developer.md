# Task 3-f - Full-Stack Developer Work Record

## Task
Fix 3 components that have mock data or hardcoded values

## Changes Made

### 1. CommandCenter.tsx
- Removed `chartData` import from mock-data
- Added `useComplianceMetrics` and `useClaims` hooks
- Fixed `formatTimeAgo()` to use `new Date()` instead of hardcoded date
- Fixed `complianceMetrics` to prefer compliance API data over dashboard-derived metrics
- Added `computedChartData` useMemo deriving all chart data from API responses
- Updated chart references to use `computedChartData`

### 2. TopBar.tsx
- Added `useQuery` from @tanstack/react-query for notifications
- Replaced hardcoded "3" badge count with real unreadCount from API
- Replaced 3 hardcoded notification items with dynamic API data
- Fixed user role: "MLRO" → dynamic from currentUser.role
- Added loading/empty states for notifications

### 3. RiskMatrix.tsx
- Replaced `mockRiskMatrix` with `useQuery` fetching from /api/risk-assessment
- Added `mapAssessmentToCell()` for API → RiskMatrixCell mapping
- SRAS progress bars now data-driven from risk assessment data
- Added loading/error states with retry
- All visual design preserved exactly

### 4. Bonus Fix
- Fixed EvidenceWarRoom.tsx: handleDrop was using await in non-async function

## Verification
- Lint: 0 errors (1 pre-existing warning unrelated)
- All APIs returning 200
- Homepage renders correctly

