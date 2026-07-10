# Task 3: Zod Schema Multi-Jurisdiction Update Agent

## Summary
Updated all 9 Zod validation schemas with hardcoded UAE-only enums to use centralized GCC jurisdiction constants from `@/lib/constants/jurisdictions.ts`.

## Files Changed (9 files, 11 enum replacements + 2 field additions)

### Jurisdiction Enums → `ALL_JURISDICTION_CODES`
1. `src/lib/validations/aml.ts` — 1 replacement
2. `src/lib/validations/claim.ts` — 1 replacement
3. `src/lib/validations/audit.ts` — 2 replacements (Create + Update schemas)
4. `src/lib/validations/case.ts` — 2 replacements (Create + Update schemas)

### Regulator Enums → `REGULATOR_CODES`
5. `src/lib/validations/regulation.ts` — 2 replacements (Create + Update schemas)
6. `src/lib/validations/regulatory.ts` — 1 replacement

### Context Module Enum → `FIU_CONTEXT_MODULES`
7. `src/lib/validations/ai.ts` — 1 replacement

### Currency-Aware Field Renames
8. `src/lib/validations/goaml.ts` — `amountAED` → `amount` (new) + `amountAED` (deprecated alias) in both schemas
9. `src/lib/validations/quarterly-reporting.ts` — added `totalPremium` alongside deprecated `totalPremiumAED`

## Verification
- `rg "z.enum\(\['CBUAE'"` → no matches (zero hardcoded UAE enums remaining)
- `rg "z.enum\(\['goAML'"` → no matches (zero hardcoded contextModule enums remaining)
- Lint: 0 errors, 2 pre-existing warnings
- Dev server: all routes returning 200
