# Task 3-d: Update CommandCenter dashboard to use API data, update sidebar and footer for Phase 2

## Summary
Migrated the CommandCenter dashboard from mock data imports to live API data via hooks, updated sidebar and footer for Phase 2 branding.

## Changes Made

### 1. `/src/lib/api-hooks.ts`
- Updated `useDashboardMetrics` return type to match the actual `/api/dashboard` API response shape (includes kriMetrics, regulations, policies, audits, labor, legal, training, recentAuditLogs)
- Removed unused `KRICard`, `ComplianceMetrics`, `SanctionsException`, `GapAnalysisItem` imports

### 2. `/src/components/ic-os/dashboard/CommandCenter.tsx`
- Removed mock imports (`mockKRICards`, `mockAMLAlerts`, `mockComplianceMetrics`), kept `chartData`
- Added `useDashboardMetrics`, `useAMLAlerts` hooks
- Created `mapApiKriToCard()` to map API KRI metrics → `KRICard` type (computes unit, status, trendValue)
- Built `complianceMetrics` from aggregated dashboard API data
- Added loading state (Loader2 spinner) and error state (AlertCircle + retry)
- Updated Refresh button to call `refetchDashboard()`
- All `mockAMLAlerts` → `amlAlerts`, `mockKRICards` → `kriCards`, `mockComplianceMetrics` → `complianceMetrics`

### 3. `/src/components/ic-os/layout/Sidebar.tsx`
- "Phase 1 Modules" → "Compliance Modules"

### 4. `/src/app/page.tsx`
- "IC-OS v2.0 Phase 1" → "IC-OS v2.0 Phase 2"

## Verification
- `bun run lint` passes with zero errors
- Homepage returns HTTP 200
- `/api/dashboard` and `/api/aml` endpoints return correct data
