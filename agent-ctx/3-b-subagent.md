# Task 3-b: Update LegalAdvisory and TrainingCertifications to use API hooks

## Summary
Updated two frontend components to fetch data from API routes instead of using mock data imports.

## Changes Made

### 1. LegalAdvisory.tsx (`/src/components/ic-os/legal/LegalAdvisory.tsx`)
- **Import change**: `mockLegalCases` → `useLegalCases` from `@/lib/api-hooks`
- **Added**: `Loader2` icon import
- **Added**: `normalizeStatus()` helper for case-insensitive status comparison
- **Modified**: `getStatusBadge()` now accepts `string` instead of `CaseStatus` and normalizes internally
- **Added**: `useLegalCases()` hook call with data/loading/error destructuring
- **Replaced**: All `mockLegalCases` → `cases` (from `casesData || []`)
- **Added**: Null-safe access for optional fields (`assignedCounsel`, `department`)
- **Added**: Loading state (spinner) and error state (AlertTriangle + message)
- **Updated**: Status comparisons in CaseDetailPanel use `normalizeStatus()`

### 2. TrainingCertifications.tsx (`/src/components/ic-os/training/TrainingCertifications.tsx`)
- **Import change**: `mockTrainingCourses, mockTrainingEnrollments` → `useTrainingCourses, useTrainingEnrollments`
- **Added**: `Loader2` icon import
- **Added**: `normalizeTrainingStatus()` helper for case-insensitive status comparison
- **Modified**: `getStatusBadge()` now accepts `string` and normalizes
- **Added**: Both API hook calls with data/loading/error destructuring
- **Added**: Data enrichment layer via `useMemo`:
  - Courses: computes `enrolledCount`, `completedCount`, `expiryAlerts` from enrollment data
  - Enrollments: resolves `courseTitle` from courses map (DB only stores `courseId`)
- **Replaced**: All mock data references with enriched API data
- **Added**: Loading state (spinner) and error state (AlertTriangle + message)
- **Updated**: All useMemo dependency arrays include API data sources

## Lint Results
- Both modified files pass lint with zero errors
- Pre-existing lint error in CommandCenter.tsx (unrelated to this task)

## Key Design Decisions
1. **Status normalization**: Added `normalizeStatus()` / `normalizeTrainingStatus()` to handle potential case variations in DB-stored status values (e.g., "IN_PROGRESS" vs "in_progress")
2. **Data enrichment**: The DB schema doesn't include computed fields like `enrolledCount`, `completedCount`, `expiryAlerts` for courses or `courseTitle` for enrollments. These are derived from the API data using `useMemo` transformation layers.
3. **Fallback to empty arrays**: Used `casesData || []` pattern to handle null data during loading
4. **Null-safe field access**: Added `|| ''` guards for optional DB fields (assignedCounsel, department, provider, targetAudience)
