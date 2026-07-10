# Task 3-a: Update CBUAERegulatoryTracker and LaborLawCompliance to use API hooks

## Summary
Migrated two frontend components from using mock data imports to fetching data from API routes via the pre-built `api-hooks.ts` hooks.

## Changes Made

### File 1: `/src/components/ic-os/regulatory/CBUAERegulatoryTracker.tsx`
- **Import changes**: Removed `import { mockRegulations } from '@/lib/mock-data'`, added `import { useRegulations } from '@/lib/api-hooks'` and `import { Skeleton } from '@/components/ui/skeleton'`
- **API hook**: Added `const { data: regulationsData, loading: regulationsLoading, error: regulationsError, refetch: refetchRegulations } = useRegulations()`
- **Data source**: Created `const regulations = regulationsData || []` replacing all `mockRegulations` references
- **useMemo deps**: Updated `filteredRegulations` dependency array to include `regulations`
- **Results count**: Changed `mockRegulations.length` → `regulations.length`
- **Loading state**: Skeleton UI with 4 stat card skeletons + search bar skeleton + 5 row skeletons
- **Error state**: FileWarning icon + error message + Retry button calling `refetchRegulations()`
- **Date compatibility**: Already works - component uses `new Date()` constructor which handles ISO strings
- **Enum compatibility**: Priority and ComplianceStatus work as seed data uses matching uppercase string values

### File 2: `/src/components/ic-os/labor/LaborLawCompliance.tsx`
- **Import changes**: Removed `import { mockLaborLaw } from '@/lib/mock-data'`, added `import { useLaborCompliance } from '@/lib/api-hooks'` and `import { Skeleton } from '@/components/ui/skeleton'`
- **API hook**: Added `const { data: laborData, loading: laborLoading, error: laborError, refetch: refetchLabor } = useLaborCompliance()`
- **Data source**: Changed `const items = useMemo(() => mockLaborLaw, [])` → `const items = laborData || []`
- **Loading state**: Skeleton UI with 4 stat card skeletons + 2 emiratisation/WPS card skeletons + requirements table skeleton
- **Error state**: AlertTriangle icon + error message + Retry button calling `refetchLabor()`
- **Date compatibility**: `formatDate()` already handles null/empty with `if (!dateStr) return '—'`
- **Enum compatibility**: ComplianceStatus comparisons work as seed data uses uppercase values matching the type

## Verification
- Both files pass ESLint with zero errors
- No visual design changes - all existing features preserved
- Loading and error states provide clear user feedback with retry capability
