# Task 7-a: Group Consolidated Dashboard

## Agent: group-dashboard-builder

## Task
Build Group Consolidated Dashboard component at `src/components/ic-os/dashboard/GroupConsolidatedDashboard.tsx`

## Work Done
- Created `src/components/ic-os/dashboard/GroupConsolidatedDashboard.tsx` — a `'use client'` component
- Strict anonymization: no PII, rounded amounts, hashed names
- 7 widgets implemented:
  1. **Risk Heat Map** — per country × severity grid
  2. **Systemic Gaps Panel** — scrollable list with severity badges
  3. **SAR Volume Chart** — horizontal bar chart by jurisdiction
  4. **Sanctions Hits Chart** — screening volume + average match score
  5. **Compliance Score Overview** — progress bars with color coding
  6. **Gap Status Distribution** — stacked bars with hover tooltips
  7. **KRI Summary Table** — metrics with trend icons and variance
- Access control: enforced via API (`/api/group-dashboard`), frontend shows 403 error with retry
- Color-coded by jurisdiction (AE=red, SA=green, BH=amber, QA=purple, OM=teal, KW=sky)
- Responsive layout: grid adapts from 1-col mobile to 2-col desktop
- Loading skeleton states, error states, empty states for all widgets
- Anonymization notice banner
- ESLint: 0 errors on new file

## Files Created/Modified
- **Created**: `src/components/ic-os/dashboard/GroupConsolidatedDashboard.tsx`
- **Modified**: `/home/z/my-project/worklog.md` (appended work record)

## Dependencies
- API route already existed at `/api/group-dashboard/route.ts`
- Uses `@/lib/constants/jurisdictions` (GCC_JURISDICTION_CODES, getJurisdictionDisplayLabel)
- Uses shadcn/ui components: Card, Badge, Skeleton
- Uses lucide-react icons
