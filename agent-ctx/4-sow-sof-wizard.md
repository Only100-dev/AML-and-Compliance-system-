# Task ID: 4 — GAP 3.2: Source of Wealth (SoW) vs. Source of Funds (SoF) Wizard

## Agent: full-stack-developer subagent

## Work Log:

### 1. API Route: `/src/app/api/sow-sof/route.ts`
- Created GET handler: List SoW/SoF records with filterable params (policyNumber, approvalStatus, hardBlockActive)
- Created POST handler with HARD-BLOCK logic:
  - If productRiskScore >= 7 AND (sowPopulated is false OR sofPopulated is false):
    - Set hardBlockActive = true, approvalStatus = "HARD_BLOCKED"
    - Return 422 with CBUAE regulatory message citing FDL 10/2025 Art. 9-10; CR 134/2025 Art. 5-9
  - If productRiskScore >= 7 AND both populated:
    - Set approvalStatus = "SOFT_BLOCK" (requires compliance_manager approval)
  - If productRiskScore < 7:
    - Set approvalStatus = "PENDING"
- Zod validation with `z.strictObject()` for mass assignment prevention
- AuthGuard with allowedRoles: ['admin', 'compliance_officer', 'compliance_manager', 'mlro']
- RBAC: canManageSoWSoF permission check with admin superuser bypass
- Rate limiting (READ tier for GET, WRITE tier for POST)
- Duplicate policy number check (409)
- SHA-256 hash computed for WORM audit trail integrity
- AuditLog entries: SOW_SOF_CREATED or SOW_SOF_HARD_BLOCKED

### 2. API Route: `/src/app/api/sow-sof/approve/route.ts`
- Created POST handler for approving SoW/SoF records
- Only compliance_manager, mlro, or admin can approve (RBAC: canApproveSoWSoF)
- 4-eyes principle: Approver must NOT be the same user who created the record (MAKER_CHECKER_SAME_PERSON violation → 403)
- Validates record is in SOFT_BLOCK or HARD_BLOCKED status
- For HARD_BLOCKED records: Both SoW and SoF must be populated before approval (422 if not)
- On approval: Sets approvalStatus = "APPROVED", hardBlockActive = false, hardBlockReason = null
- Rate limiting: SENSITIVE tier (10 req/min)
- SHA-256 audit trail with SOW_SOF_APPROVED action
- Notification sent to record creator on approval

### 3. UI Component: `/src/components/ic-os/insurance/SoWSoFWizard.tsx`
- 'use client' component with named export `SoWSoFWizard`
- **Summary Cards**: Total Records, Hard Blocked, Soft Block, Approved (color-coded)
- **Hard-Block Alert Banner**: Red alert when any record is HARD_BLOCKED, citing FDL 10/2025 Art. 9-10
- **Records Table**: Policy Number, Client Name, Product Risk (color-coded badge), SoW Status, SoF Status, Approval Status (color-coded badge), Hard-Block indicator, Actions (View/Approve)
- **Expandable Rows**: Click to expand and see full SoW and SoF details inline
- **Create Dialog** with two-tab guided form:
  - Tab 1 (SoW): Employment Income, Business Income, Investment Income, Inheritance, Gifts, Other Sources, Total Declared Wealth (auto-calculated), Documentary Evidence, "Verify SoW" button
  - Tab 2 (SoF): Payment Source (dropdown), Financier Name, Financier Type (dropdown), Payment Reference, Transaction Amount, Documentary Evidence, "Verify SoF" button
- **Client-side Hard-Block Warning**: When productRiskScore >= 7 and SoW/SoF incomplete, shows prominent red alert in create dialog
- **Detail View Dialog**: Full record details with SoW and SoF cards, hard-block reason, SHA-256 hash, approve button
- **Approve Dialog**: Approval notes (min 10 chars), 4-eyes principle warning, error handling
- Color-coded approval status badges: PENDING=amber, SOFT_BLOCK=orange, HARD_BLOCKED=red, APPROVED=emerald, REJECTED=red
- Responsive design (mobile-first), max-h-96 overflow on tables, loading/error/empty states
- Uses shadcn/ui: Card, Tabs, Dialog, Button, Input, Select, Badge, Alert, Table, Textarea, Label

### 4. Sidebar & Page Updates
- Added Wallet icon import to Sidebar.tsx
- Added 'SoW/SoF Wizard' nav item to phase12Items with `canManageSoWSoF` permission
- Added lazy-loaded SoWSoFWizard to page.tsx with case 'sow-sof-wizard'

### 5. Verification
- Lint: 0 new errors, 1 pre-existing warning (TrainingCertifications.tsx)
- API testing confirmed:
  - GET /api/sow-sof → 200 (returns records with pagination)
  - POST /api/sow-sof (high-risk, no SoW/SoF) → 422 (HARD-BLOCK correctly activated with regulatory message)
  - POST /api/sow-sof (low-risk) → 201 (PENDING status)
  - POST /api/sow-sof (high-risk, both populated) → 201 (SOFT_BLOCK status)

## Stage Summary:
- 2 API routes created: /api/sow-sof (GET+POST) and /api/sow-sof/approve (POST)
- 1 UI component: SoWSoFWizard with two-tab guided form, records table, create/approve/detail dialogs
- Hard-block logic enforced both server-side (422) and client-side (alert banner)
- 4-eyes principle enforced on approve route (403 if same user)
- WORM-compliant audit trail with SHA-256 integrity on all state transitions
- Regulatory references: FDL 10/2025 Art. 9-10, CR 134/2025 Art. 5-9
- Zero new lint errors
