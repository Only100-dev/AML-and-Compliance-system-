# Task ID: 7 — GAP 3.5 Early Surrender Cooling-Off Period Tracker

## Agent: GAP 3.5

## Deliverables

### 1. API Route: `/src/app/api/early-surrender/route.ts`
- **GET**: List early surrender records with filters (policyNumber, highMLRFlag, reviewStatus, coolingOffStatus) + summary statistics
- **POST**: Create new early surrender record with full AUTO-MLR logic:
  - Auto-calculate: daysSinceInception, financialLossAED, financialLossPct
  - Auto-determine coolingOffStatus (WITHIN_COOLING_OFF / OUTSIDE_COOLING_OFF)
  - AUTO HIGH MLR FLAG: financialLossPct > 20 AND isThirdPartyPayout → flag + AML alert + notifications
- Zod strictObject, AuthGuard, RBAC (canManageEarlySurrender), rate limiting, SHA-256, WORM audit trail

### 2. API Route: `/src/app/api/early-surrender/review-mlr/route.ts`
- **POST**: Review/resolve MLR flag — MLRO/admin only (canReviewMLRFlag)
- Maker-Checker enforcement (reviewer ≠ creator)
- WORM compliance (no re-review, 409 conflict)
- ESCALATED_TO_SAR → auto-create SAR case draft with 30-day deadline
- Notifications, SHA-256 audit trail

### 3. UI Component: `/src/components/ic-os/insurance/CoolingOffTracker.tsx`
- Named export: `CoolingOffTracker`
- Dashboard summary cards (4 cards: Total, MLR Flags, Within Cooling-Off, Alerts)
- Main table with all required columns + color coding
- Cooling-Off Period Analysis dialog with LossGauge, progress bar, MLR banner
- Add Surrender Record dialog with live preview and MLR trigger warning
- MLR Review panel with CONFIRMED_MLR / FALSE_POSITIVE / ESCALATED_TO_SAR buttons
- LossGauge component defined outside render (lint compliant)
- Loading, error, empty states; responsive design

### 4. Integration
- Sidebar: Added 'Cooling-Off Tracker' nav item (Phase 13, ThermometerSun icon, canManageEarlySurrender permission)
- page.tsx: Added lazy-loaded CoolingOffTracker with 'cooling-off-tracker' switch case

## Verification
- GET /api/early-surrender → 200 ✅
- POST /api/early-surrender (MLR trigger: 30% loss + third-party) → 201 with highMLRFlag=true, alert, notifications ✅
- POST /api/early-surrender (no trigger: 5% loss, no third-party) → 201 with highMLRFlag=false ✅
- POST /api/early-surrender (invalid) → 422 with field errors ✅
- POST /api/early-surrender/review-mlr (maker-checker violation) → 403 ✅
- GET /api/early-surrender?highMLRFlag=true → 200 filtered ✅
- Lint: 0 errors, 1 pre-existing warning ✅

## Key Business Logic
The AUTO-MLR flag is the most critical piece: when financialLossPct > 20% AND isThirdPartyPayout === true, the system automatically:
1. Sets highMLRFlag = true with regulatory trigger reason
2. Creates an AMLAlert (EARLY_SURRENDER_MLR, riskLevel: high)
3. Updates linkedAlertId and alertGenerated = true
4. Sends urgent notifications to MLRO and admin users
5. Records the flag in the WORM-compliant audit trail with SHA-256 hash
