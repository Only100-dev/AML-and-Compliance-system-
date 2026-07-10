# Task ID: 2a-2b-frontend
# Agent: Frontend Developer

## Task: Add Bulk Actions toolbar to AMLSanctionsTriage.tsx + Third-Party Surrender Block Modal to ClaimsPortals.tsx

### Work Log:

**Task 1: AMLSanctionsTriage.tsx Bulk Actions Toolbar**
- Added `Input` import from `@/components/ui/input`
- Renamed `bulkSubmitting` → `bulkMutationPending` (state variable and all references)
- Updated `handleBulkDismiss` to use `currentUser.id` and `currentUser.name` in the API payload
- Replaced raw HTML `<input>` with shadcn `Input` component in the bulk actions toolbar
- Changed bulk dismiss button icon from `Ban` to `CheckCircle2` per spec
- All existing functionality preserved (toggleAlertSelection, clearSelection, checkbox on AlertCard, Kanban columns, drag-and-drop)

**Task 2: ClaimsPortals.tsx Third-Party Surrender Block Modal**
- Added AlertDialog component imports from `@/components/ui/alert-dialog`
- Replaced existing custom modal `ThirdPartySurrenderBlockModal` with AlertDialog-based version:
  - New props: `onSubmitEDD` (was `onSubmitMLRO`), `claimData` object (was `claimNumber` string)
  - `claimData` includes: `claimNumber`, `amount`, `daysSinceIssuance`
  - Uses AlertDialogContent/Header/Footer/Title/Description from shadcn/ui
  - Shows claim details (claim number, AED amount, days since issuance) when claimData is present
  - Displays regulatory references (QCB AML Rules §4.1, CBUAE Insurance Regulations, FATF Guidance)
  - Includes "REGULATORY BLOCK ACTIVE" indicator with pulsing AlertTriangle
  - EDD review requirement notice in rose-colored callout
- Replaced `surrenderBlockClaim` state with `surrenderBlockData` (object type with claimNumber, amount, daysSinceIssuance)
- Updated `wrappedUpdateClaim` to populate full `surrenderBlockData` from blocked API response
- Updated modal rendering to pass `onSubmitEDD` and `claimData` props
- Updated toast messages for MLRO submission

### Lint Results:
- 0 errors, 1 pre-existing warning (unrelated: TrainingCertifications.tsx incompatible library)
