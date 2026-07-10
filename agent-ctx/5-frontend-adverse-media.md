# Task 5 - Frontend Developer: Adverse Media Search Wizard

## Task
Build the Adverse Media Search Wizard component for Phase 3 of the IC-OS platform.

## Files Created/Modified

### Created
- `/src/components/ic-os/adverse-media/AdverseMediaSearch.tsx` - Full 5-step wizard component

### Modified
- `/src/app/page.tsx` - Added AdverseMediaSearch import and 'adverse-media' route
- `/src/components/ic-os/layout/Sidebar.tsx` - Added Search icon and 'Adverse Media' nav item

## Component Architecture

### 5 Steps
1. **Subject Details** - Subject type toggle, full name, aliases, nationality, DOB, ID number
2. **Search Configuration** - 83-term AML boolean string, date range, source selection
3. **Results** - Logged results with manual add, risk relevance badges, empty state
4. **Decision** - Classification buttons (CLEAR/FALSE_POSITIVE/POTENTIAL_MATCH/CONFIRMED_MATCH), rationale textarea
5. **Report** - Success state with summary card, PDF download, new screening

### State Management
- `useState` for each step's form data
- `useMemo` for validation (canGoNext)
- Local state only (no API integration yet - component is self-contained)

### Visual Language
- IC-OS dark mode with emerald/amber/rose color coding
- Glass-card styling on step content card
- Horizontal stepper with desktop/mobile responsive variants
- CBUAE Compliant badge in header

## Verification
- `bun run lint` passes with zero errors
- Dev server compiles successfully (HTTP 200)
- Component accessible via sidebar navigation under "Compliance Modules"
