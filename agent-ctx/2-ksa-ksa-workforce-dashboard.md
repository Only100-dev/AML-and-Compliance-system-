# Task 2-ksa: KSA Workforce Dashboard

## Summary
Replaced the placeholder stub at `src/components/ic-os/labor/ksa/SaudiWorkforceDashboard.tsx` with a full-featured KSA workforce dashboard.

## What Was Built
A complete interactive dashboard with 5 sections:

1. **Header** - "KSA Labor Law Compliance" with SAMA Regulated + Live Tracking badges (green accent)
2. **Summary Cards** (4-card grid) - Total Requirements, Nitaqat Tier (dynamic), GOSI Compliance %, Upcoming Deadlines
3. **Nitaqat Tier Calculator** - Interactive inputs (Total/Saudi Employees, Sector), calls `calculateNitaqat()`, displays in `QuotaGauge` shared component
4. **GOSI Contribution Calculator** - Interactive inputs (Basic Salary, Housing Allowance, Nationality), calls `calculateGOSI()`, displays in `ContributionTable` shared component, handles expat exemption
5. **Compliance Requirements Table** - `useLaborCompliance()` hook, category filter, desktop expandable rows + mobile collapsible cards

## Key Decisions
- Used green-500/400 accent colors (KSA identity) vs UAE cyan
- Mapped `NationalizationResult.complianceStatus` ('COMPLIANT'|'AT_RISK'|'NON_COMPLIANT') → QuotaGauge's 'COMPLIANT'|'PARTIAL'|'NON_COMPLIANT'
- Created KSA-specific category colors (Saudization=green, GOSI=emerald, Iqama=orange, Labor Law=teal)
- Created KSA-specific authority styles (MHRSD=green, SAMA=emerald, GOSI=teal, MOI=amber)
- Expat GOSI results show inline notice card instead of empty ContributionTable

## Verification
- Lint: 0 FAILs
- TypeScript: no errors in component
- Dev server: compiling successfully
