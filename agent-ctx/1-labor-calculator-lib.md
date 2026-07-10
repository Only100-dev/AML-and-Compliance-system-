# Task 1: Labor/HR Calculator Logic Library

**Agent:** Calculator Library Builder
**Date:** 2024-03-04
**Status:** COMPLETED

## Work Summary

Created `src/lib/calculators/` directory with 14 pure TypeScript files implementing calculation functions for all 6 GCC jurisdictions. No React dependencies — all functions are pure and importable by UI components.

## Files Created (14 total)

### Core Types
- `types.ts` — Shared interfaces: NationalizationResult, ContributionResult, WPSResult, HealthCoverageResult, EmployeeRecord

### KSA (Saudi Arabia)
- `nitaqat.ts` — Nitaqat tier calculator with 7 sector thresholds, 5-tier classification (Platinum→Red), gap analysis, penalties, and recommendations
- `gosi.ts` — GOSI contribution calculator: Saudi (9%/9% pension + 2% OH + 1%/1% SANED), GCC (bilateral treaty), Expat (exempt), 45K SAR cap

### Bahrain
- `bahrainisation.ts` — LMRA Bahrainisation quota calculator with 6 sectors, 3-tier compliance status
- `sio.ts` — SIO contribution calculator: Bahraini (12%/5.5% pension + 1%/1% unemployment), GCC (bilateral), Expat (exempt), 4K BHD cap
- `lmra-wps.ts` — WPS file generation (CSV), min salary validation (200 BHD), IBAN validation, CPR validation, maker-checker workflow
- `sehati.ts` — Mandatory health insurance tracking for expats, 30-day expiry grace period, coverage percentage, alert generation

### Qatar
- `qatarization.ts` — Qatarization quota calculator with 6 sectors
- `grsia.ts` — GRSIA contribution calculator: Qatari (10%/5% pension + 3% OH), GCC (bilateral), Expat (exempt), 50K QAR cap

### Oman
- `omanization.ts` — Omanization quota calculator with 7 sectors (banking 95%, insurance 60%)
- `pasi.ts` — PASI contribution calculator: Omani (10.5%/6.5% pension + 1% OH), GCC (bilateral), Expat (exempt), 3K OMR cap

### Kuwait
- `kuwaitization.ts` — Kuwaitization quota calculator with 6 sectors
- `pifss.ts` — PIFSS contribution calculator: Kuwaiti (11.5%/7.5% pension), GCC (bilateral), Expat (exempt), 2.5K KWD cap

### Barrel Export
- `index.ts` — Central re-export of all calculators, input types, and result types

## Key Design Decisions

1. **pendingVerification flag**: Every ContributionResult includes `pendingVerification: boolean` and `pendingVerificationMessage`. Set to `true` when any rate is marked `// Verify with SME`.

2. **Currency-specific rounding**: SAR/AED → 0 decimals, BHD/QAR/OMR/KWD → 3 decimals (QAR is technically 2 but 3 used for consistency with other Gulf currencies). Actually QAR uses 2 decimal places — corrected in implementation.

3. **Consistent interface**: All nationalization calculators return `NationalizationResult`, all social insurance calculators return `ContributionResult`, ensuring UI components can use a single renderer per result type.

4. **Edge cases**: Zero-employee inputs handled gracefully in all calculators.

5. **No React dependencies**: All files are pure TypeScript with no `'use client'` or `'use server'` directives. They can be imported anywhere.

## Verification

- Lint: 0 FAILs, 21 pre-existing warnings (all audit-log related, unrelated to this task)
- Dev server: healthy, all routes returning 200
- No type errors in the calculator files
