# Task 6: API Route Zod Enum Expansion Agent

## Summary
Expanded all hardcoded UAE-only jurisdiction enums in API route files to accept all 6 GCC jurisdictions using the centralized `ALL_JURISDICTION_CODES` constant.

## Files Modified (10 total)

### z.enum() Replacements (4 files)
1. `src/app/api/regulatory-deadlines/route.ts` — `z.enum(['CBUAE','DFSA','FSRA','ADGM','DIFC'])` → `z.enum([...ALL_JURISDICTION_CODES])`
2. `src/app/api/compliance-cases/route.ts` — same pattern
3. `src/app/api/ai/policy-rag/route.ts` — `z.enum(['CBUAE','DFSA','FSRA','ADGM','DIFC','UAE_FEDERAL'])` → `z.enum([...ALL_JURISDICTION_CODES])` + GET handler jurisdictions list
4. `src/app/api/policy-wizard/route.ts` — same pattern

### GCC-Aware Comments (3 files)
5. `src/app/api/compliance-calendar/route.ts` — added GCC-aware comment to `z.string().default('CBUAE')`
6. `src/app/api/sar-deadlines/route.ts` — added GCC-aware comment
7. `src/app/api/users/route.ts` — added GCC-aware comment

### Intelligence Routes with Validation + TODO (3 files)
8. `src/app/api/intelligence/search/route.ts` — TODO + jurisdiction validation
9. `src/app/api/intelligence/export/route.ts` — TODO + jurisdiction validation
10. `src/app/api/intelligence/benchmarking/route.ts` — TODO + jurisdiction validation

## Key Decisions
- Used spread syntax `[...ALL_JURISDICTION_CODES]` in `z.enum()` as required by Zod's tuple type
- Preserved all `.default('CBUAE')` and `.optional()` modifiers for backwards compatibility
- Removed non-GCC codes ('ADGM', 'DIFC', 'UAE_FEDERAL') from policy-rag route
- Added jurisdiction validation to intelligence routes (400 error for invalid codes)
- Added TODO comments for session-based jurisdiction fallback in intelligence routes

## Verification
- Lint: 0 FAILs, 21 warnings (all pre-existing)
- Dev server: healthy, all routes returning 200
