# Task 3-g: Wire 3 Read-Only Modules to Write Operations

## Summary
Wired 3 previously read-only components to full write operations without changing visual design.

## Changes Made

### 1. LegalAdvisory.tsx
- Switched from `@/lib/api-hooks` to `@/lib/query-hooks` for TanStack Query integration
- Added `useMutation` for POST to `/api/cases` in NewCaseDialog
- Auto-generates caseNumber (LC-{year}-{seq}), validates title+caseType
- On success: invalidates queryKeys.legalCases(), closes dialog, resets form, shows toast
- On error: shows error toast
- Button shows Loader2 spinner when pending

### 2. PoliciesSOPs.tsx
- Switched from `@/lib/api-hooks` to `@/lib/query-hooks` for TanStack Query integration
- Created CreatePolicyDialog component with form (title, category, department, owner)
- Added `useMutation` for POST to `/api/policies`
- Auto-generates policyNumber (POL-{year}-{seq}), defaults status='draft', version='1.0'
- On success: invalidates queryKeys.policies(), closes dialog, resets form, shows toast
- On error: shows error toast
- "Create Policy" button now opens dialog

### 3. AMLSelfAssessment.tsx
- Added localStorage persistence with key `icos-aml-assessment`
- loadSavedAnswers() on mount via useState initializer
- Auto-save on each answer change
- Added "Save Progress" button with explicit save + toast
- "View Results" saves to localStorage before showing results
- handleReset clears localStorage

## Lint: 0 errors
## APIs tested: POST /api/cases (201), POST /api/policies (201)
