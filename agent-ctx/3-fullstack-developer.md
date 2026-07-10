# Task 3: Seed Full GCC User Directory & Update Type System for GCC Jurisdictions

## Agent: full-stack-developer
## Status: ✅ COMPLETE

## Work Summary

### Task 1: Expand Jurisdiction type
- **File**: `src/lib/types.ts`
- Changed `Jurisdiction` from `'CBUAE' | 'DFSA' | 'FSRA'` to `'CBUAE' | 'DFSA' | 'FSRA' | 'AE' | 'SA' | 'BH' | 'QA' | 'OM' | 'KW'`
- This adds 6 GCC country codes alongside the 3 UAE sub-jurisdictions

### Task 2: Prisma schema — No change needed
- Verified the `User` model `jurisdiction` field is `String` type, which can store any value
- No schema migration required

### Task 3: Create GCC User Seed Script
- **File**: `prisma/seed-gcc-users.ts`
- Seeds 42 users across 6 GCC jurisdictions with all 7 canonical roles each
- Uses `upsert` to avoid duplicates with existing users
- All users set to `isActive: true`
- Jurisdiction breakdown:
  - UAE (CBUAE): 7 users including new auditor saeed.alhabshi@icos.ae
  - KSA (SA): 7 users
  - Bahrain (BH): 7 users
  - Qatar (QA): 7 users
  - Oman (OM): 7 users
  - Kuwait (KW): 7 users

### Task 4: Store jurisdiction default
- Left `CBUAE` as default in `src/lib/store.ts` — no change needed

### Task 5: Run seed
- Executed `bunx tsx prisma/seed-gcc-users.ts`
- All 42 GCC users created successfully
- Total database now has 55 users (42 GCC + 13 pre-existing)

### Task 6: Update NextAuth for GCC jurisdiction validation
- **File**: `src/app/api/auth/[...nextauth]/route.ts`
- Added import of `mapLegacyJurisdictionToGCC` from `@/lib/intelligence/jurisdiction-contexts`
- JWT callback: Added `token.gccJurisdiction = mapLegacyJurisdictionToGCC(user.jurisdiction)`
- Session callback: Added `(session.user as Record<string, unknown>).gccJurisdiction = token.gccJurisdiction`
- Frontend can now access `gccJurisdiction` from the session

### Task 7: Update TopBar jurisdiction selector
- **File**: `src/components/ic-os/layout/TopBar.tsx`
- Replaced hardcoded UAE-only jurisdiction toggle with dynamic GCC-aware selector
- UAE users: See 3 sub-jurisdiction toggle buttons (CBUAE/DFSA/FSRA) as before
- Non-UAE GCC users: See their country flag + regulator badge (e.g., 🇸🇦 SAMA)
- Admin/Board roles: See dropdown of all 6 GCC countries + UAE sub-jurisdictions when UAE selected
- Uses `JURISDICTION_CONTEXTS`, `GCC_JURISDICTIONS`, `mapLegacyJurisdictionToGCC` from jurisdiction-contexts

### Bonus: Updated LoginForm demo accounts
- **File**: `src/components/auth/LoginForm.tsx`
- Replaced old UAT demo accounts with GCC-aligned demo accounts
- Added flag emoji prefix for each jurisdiction (🇦🇪, 🇸🇦, 🇧🇭, 🇶🇦, 🇴🇲, 🇰🇼)
- 11 demo accounts across all 6 GCC jurisdictions

### Bonus: Fixed RegulatoryIntelligence jurisdiction colors
- **File**: `src/components/ic-os/regulatory/RegulatoryIntelligence.tsx`
- Added color mappings for all 6 new GCC jurisdiction codes (AE, SA, BH, QA, OM, KW)
- This was a compile error caused by the expanded Jurisdiction type

## Lint Results
- 0 errors, 2 pre-existing warnings (TanStack Virtual incompatibility)
- All audit checks pass
- Dev server healthy on port 3000

## Files Modified
1. `src/lib/types.ts` — Expanded Jurisdiction type
2. `prisma/seed-gcc-users.ts` — NEW: GCC user seed script
3. `src/app/api/auth/[...nextauth]/route.ts` — GCC jurisdiction in JWT/session
4. `src/components/ic-os/layout/TopBar.tsx` — Dynamic GCC jurisdiction selector
5. `src/components/auth/LoginForm.tsx` — GCC demo accounts
6. `src/components/ic-os/regulatory/RegulatoryIntelligence.tsx` — GCC jurisdiction colors
