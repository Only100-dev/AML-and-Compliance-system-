# Task 3-c: API Integration for PoliciesSOPs and ComplianceAudits

## Agent: Subagent (full-stack-developer)

## Summary
Updated two frontend components to fetch data from API routes instead of using mock data imports.

## Changes Made

### 1. PoliciesSOPs.tsx (`/src/components/ic-os/policies/PoliciesSOPs.tsx`)

- **Removed**: `import { mockPolicies } from '@/lib/mock-data'`
- **Added**: `import { usePolicies } from '@/lib/api-hooks'`
- **Added API hook**: `const { data: policiesData, loading: policiesLoading, error: policiesError } = usePolicies()`
- **Created local alias**: `const policies = policiesData || []` as fallback for null data
- **Moved categories/departments**: Changed from module-level constants derived from `mockPolicies` to `useMemo` hooks derived from API data
- **Added loading state**: Centered spinner with Brain icon (animate-pulse) and "Loading policies..." text
- **Added error state**: Centered error display with FileText icon, "Failed to load policies" text, and error message
- **Added fallback for statusConfig**: `statusConfig[policy.status as PolicyStatus] || statusConfig.draft` in PolicyCard
- **Updated all mockPolicies references**: Replaced with `policies` local variable
- **Updated useMemo dependencies**: Added `policies` to dependency arrays for categories, departments, and filteredPolicies

### 2. ComplianceAudits.tsx (`/src/components/ic-os/audits/ComplianceAudits.tsx`)

- **Removed**: `import { mockAudits } from '@/lib/mock-data'`
- **Added**: `import { useAudits } from '@/lib/api-hooks'`
- **Added API hook**: `const { data: auditsData, loading: auditsLoading, error: auditsError } = useAudits()`
- **Created local alias**: `const audits = auditsData || []` as fallback for null data
- **Added loading state**: Centered spinner with ClipboardCheck icon (animate-pulse) and "Loading audits..." text
- **Added error state**: Centered error display with ClipboardCheck icon, "Failed to load audits" text, and error message
- **Added riskLevel normalization**: `(audit.riskLevel || 'low').toLowerCase()` in AuditCard to handle case differences from API
- **Added fallbacks for config lookups**: All config maps (auditTypeConfig, statusConfig, riskConfig, remediationConfig, jurisdictionConfig) now have fallback values
- **Added null-safe string operations**: Search filter uses `(audit.field || '').toLowerCase()` for nullable API fields
- **Updated risk filter comparison**: `(audit.riskLevel || '').toLowerCase() !== riskFilter` for case-insensitive matching
- **Updated all mockAudits references**: Replaced with `audits` local variable
- **Updated useMemo dependencies**: Added `audits` to dependency arrays for stats and filteredAudits

### Key API Data Considerations

- **Date fields**: API returns ISO date strings from Prisma DateTime columns; existing `new Date()` and `formatDate()` calls handle these correctly
- **Nullable fields**: API may return null for optional fields (reviewDate, approvalDate, completedDate, etc.); existing `&&` checks and null-safe fallbacks handle these
- **aiConfidence**: Already a 0-1 float in both mock data and API response; `Math.round(policy.aiConfidence * 100)` works consistently
- **aiReviewed**: Already a boolean in both mock data and API response
- **riskLevel**: API may return different casing; normalization to lowercase ensures consistent config lookup

## Lint Results
- Zero lint errors in both modified files
- Pre-existing error in CommandCenter.tsx (unrelated mockKRICards reference)
