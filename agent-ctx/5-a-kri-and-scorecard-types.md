# Task 5-a: KRI and Scorecard Types

## Task
Create KRI jurisdiction thresholds and scorecard types for Phase 5 of the compliance platform.

## Work Completed

### Files Created
1. **`src/lib/kri/jurisdiction-thresholds.ts`** — 30+ KRI thresholds across 6 GCC jurisdictions
   - UAE (AE): emiratisation_rate, sar_filing_timeliness, training_completion_rate, complaint_resolution_sla
   - KSA (SA): nitaqat_tier, sar_filing_timeliness, saudization_rate
   - Bahrain (BH): bahrainisation_rate, sar_filing_timeliness, cpr_compliance_rate
   - Qatar (QA): qatarization_rate, sar_filing_timeliness, qid_compliance_rate
   - Oman (OM): omanization_rate, sar_filing_timeliness, civil_id_compliance_rate
   - Kuwait (KW): kuwaitization_rate, sar_filing_timeliness, civil_id_compliance_rate
   - Shared: sanctions_screening_rate × 6, false_positive_rate × 6
   - Helper functions: `getKRIThresholdsForJurisdiction()`, `evaluateKRI()`

2. **`src/lib/kri/index.ts`** — Barrel export

3. **`src/lib/scorecard/types.ts`** — Audit scorecard type definitions
   - 9 SCORECARD_THEMES (Employee Benefits, Payroll & Social Insurance, Contracts & Employment, Product Design, Claims Handling, Financial Crime, Governance & Risk, Data Protection, Operational Resilience)
   - GapRating type (0-3) with GAP_RATING_CRITERIA config
   - 6 REGULATOR_COLUMNS (CBUAE, SAMA, CBB, QCB, CBOA, CBK)
   - CombinedRisk algorithm: `calculateCombinedRisk()` function
   - COMBINED_RISK_CONFIG styling

4. **`src/lib/scorecard/index.ts`** — Barrel export

### SME Verification Markers
- KSA Nitaqat tier mapping: `// Verify with SME: exact tier mapping`
- KSA Saudization rate target: `// Verify with SME: specific sector target`
- Qatar Qatarization rate target: `// Verify with SME: specific target`
- Kuwait Kuwaitization rate target: `// Verify with SME: specific target`

### Lint Status
- 0 FAILs, all new files pass lint checks

## Dependencies
- Imports `GCCJurisdictionCode` from `@/lib/constants/jurisdictions` (existing)
