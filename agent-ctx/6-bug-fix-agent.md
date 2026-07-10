# Task 6 - Bug Fix Agent

## Task
Fix 4 existing bugs in the IC-OS project

## Bugs Fixed

### Bug 1: Missing QueryClientProvider
- **File**: `src/app/page.tsx`
- **Problem**: No QueryClientProvider wrapping the app, causing runtime errors for components using React Query hooks (useQuery, useMutation)
- **Fix**: Added `import { QueryProvider } from '@/components/providers/QueryProvider'` and wrapped `<AppContent />` with `<QueryProvider>` inside `<ThemeProvider>`

### Bug 2: Hydration Mismatch in TopBar.tsx
- **File**: `src/components/ic-os/layout/TopBar.tsx`
- **Problem**: useQuery hook crashes without QueryClientProvider, manifesting as hydration error
- **Fix**: Primarily resolved by Bug 1 (QueryClientProvider addition). The existing useSyncExternalStore mount guard was kept (tried useState/useEffect but lint rule `react-hooks/set-state-in-effect` rejects it). The useSyncExternalStore pattern is the correct lint-compliant approach.

### Bug 3: AMLSanctionsTriage crash
- **File**: `src/components/ic-os/aml/AMLSanctionsTriage.tsx`
- **Problem**: `Cannot read properties of undefined (reading 'toLocaleString')` when API returns data with undefined fields
- **Fix**: 
  - Line 104: `amount.toLocaleString('en-AE')` → `(amount ?? 0).toLocaleString('en-AE')`
  - Line 383: Added `?? '—'` fallback after toLocaleDateString()

### Bug 4: CBUAERegulatoryTracker hydration issue
- **File**: `src/components/ic-os/regulatory/CBUAERegulatoryTracker.tsx`
- **Problem**: formatDateSafe() uses local timezone methods (getDate, getMonth, getFullYear) which can produce different results on server vs client
- **Fix**:
  - Added mount guard using `useSyncExternalStore` pattern
  - Updated `formatDateSafe()` to accept optional `mounted` parameter (returns '—' when not mounted)
  - Added `mounted` prop to `RegulationTableRow` and `RegulationMobileCard` sub-components
  - Passed `mounted` to all 6 formatDateSafe() call sites and both sub-component render sites

## Lint Results
- 0 new errors from changed files
- Pre-existing errors unchanged (AIAssistantWidget.tsx parsing error, TrainingCertifications.tsx incompatible library warning)
