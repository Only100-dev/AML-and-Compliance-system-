/**
 * MLRO Command Center Metrics API
 * Phase 3 Directive 3.3 (Deliverable A)
 * ------------------------------------------------------------------
 * Single-call aggregation endpoint that returns everything the MLRO
 * Command Center needs to render its operational metrics strip + SAR
 * SLA work-list. Replaces the previous hybrid state where the dashboard
 * relied on client-side Math.random() synthesis + hardcoded fallbacks.
 *
 * Returns:
 *   - openSARs            : count + PII-masked list (DRAFT/PENDING_APPROVAL/PENDING_MLRO/PENDING_CM_REVIEW)
 *   - slaBreaches         : { day5Flag, day7Breach, onTrack, notApplicable, totalOpen }
 *   - pendingMakerChecker : { lifecycleRequests, sanctionsDismissals, kycHighRisk, sarPendingMlro, sarPendingMlroStage, total }
 *   - openAlerts          : count of AML alerts not closed/sar_filed
 *   - kriTrend            : 6-month trend from real KRIMetric history (false-positive-rate + compliance-score)
 *
 * RBAC: mlro + admin + compliance_manager (the operational cohort that
 * owns SAR approvals, sanctions dispositions, and AML triage).
 * FDL 10/2025 Art. 8, 15; CBUAE Notice 3551/2021 S3.1, S4.2.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { maskListPII } from '@/lib/pii';
import { SAR_SLA } from '@/lib/compliance/business-days';

export const dynamic = 'force-dynamic';

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Compute the SAR SLA status for a single GoAMLFiling row.
 *   - `on_track`  : < 5 business days elapsed (green)
 *   - `flagged`   : >= 5 and < 7 business days elapsed (amber, Day-5 flag)
 *   - `overdue`   : >= 7 business days elapsed (red, Day-7 breach)
 *
 * Filings WITHOUT a slaDeadline (non-critical CTR/IFT/PNMR types or
 * pre-Phase-2 rows) are reported as `not_applicable`.
 */
function computeSarSlaStatus(
  slaDeadline: Date | null,
  slaFlaggedAt: Date | null,
  slaEscalatedAt: Date | null,
  now: Date = new Date(),
): { status: 'on_track' | 'flagged' | 'overdue' | 'not_applicable'; daysRemaining: number | null } {
  if (slaEscalatedAt) {
    return { status: 'overdue', daysRemaining: 0 };
  }
  if (!slaDeadline) {
    return { status: 'not_applicable', daysRemaining: null };
  }
  const msRemaining = slaDeadline.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return { status: 'overdue', daysRemaining: 0 };
  }
  // Day-5 flag window: <= 2 calendar days remaining (i.e. within the last
  // 2 business days of the 7-day SLA). The cron flags at 5 business days;
  // we approximate the remaining window using calendar days against the
  // slaDeadline set by sarFilingDeadline().
  if (slaFlaggedAt || daysRemaining <= 2) {
    return { status: 'flagged', daysRemaining };
  }
  return { status: 'on_track', daysRemaining };
}

// ─── GET /api/dashboard/mlro-metrics ──────────────────────────────────────

export async function GET(request: Request) {
  const auth = await authGuard({ allowedRoles: ['mlro', 'admin', 'compliance_manager'] });
  if (!auth.authorized) {
    return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const rateLimitError = applyRateLimit(auth, request, 'READ');
  if (rateLimitError) return rateLimitError;

  try {
    const now = new Date();

    // ── Parallel queries: SARs, alerts, maker-checker queue, KRI history ──
    const [
      openSarFilings,
      openAlertsCount,
      pendingLifecycleRequests,
      pendingSanctionsDismissals,
      pendingKycHighRisk,
      pendingSarMakerChecker,
      kriMetrics,
    ] = await Promise.all([
      // Open SARs: any filing not yet SUBMITTED_TO_FIU / ACKNOWLEDGED (i.e. not closed).
      db.goAMLFiling.findMany({
        where: {
          filingStatus: { notIn: ['SUBMITTED_TO_FIU', 'ACKNOWLEDGED'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),

      // Open AML alerts: any status that hasn't been resolved to sar_filed / closed.
      db.aMLAlert.count({
        where: { status: { in: ['new', 'triage', 'investigating', 'escalated'] } },
      }),

      // Pending Maker-Checker: USER_ROLE_CHANGE + USER_DEACTIVATION (lifecycle)
      db.makerCheckerLog.count({
        where: {
          status: 'PENDING',
          operationType: { in: ['USER_ROLE_CHANGE', 'USER_DEACTIVATION'] },
        },
      }),

      // Pending Maker-Checker: SANCTIONS_DISMISSAL
      db.makerCheckerLog.count({
        where: {
          status: 'PENDING',
          operationType: 'SANCTIONS_DISMISSAL',
        },
      }),

      // Pending Maker-Checker: KYC_HIGH_RISK_APPROVAL
      db.makerCheckerLog.count({
        where: {
          status: 'PENDING',
          operationType: 'KYC_HIGH_RISK_APPROVAL',
        },
      }),

      // Pending Maker-Checker: GOAML_SUBMIT (SAR PENDING_MLRO via Maker-Checker)
      db.makerCheckerLog.count({
        where: {
          status: 'PENDING',
          operationType: { in: ['GOAML_SUBMIT', 'GOAML_FILING_SUBMIT'] },
        },
      }),

      // KRI metrics — for building a real 6-month trend (no Math.random)
      db.kRIMetric.findMany({}),
    ]);

    // ── Compute SLA status per filing ────────────────────────────────────
    const sarList = openSarFilings.map((f) => {
      const sla = computeSarSlaStatus(
        f.slaDeadline,
        f.slaFlaggedAt,
        f.slaEscalatedAt,
        now,
      );
      return {
        id: f.id,
        referenceNumber: f.referenceNumber,
        reportType: f.reportType,
        // PII is masked at the API boundary via maskListPII below; subjectName stays raw
        // here so the count + SLA computation can use it, then masked before response.
        subjectName: f.subjectName,
        amountAED: f.amountAED,
        filingStatus: f.filingStatus,
        approvalStage: f.approvalStage ?? 'DRAFT',
        slaDeadline: f.slaDeadline?.toISOString() ?? null,
        slaFlaggedAt: f.slaFlaggedAt?.toISOString() ?? null,
        slaEscalatedAt: f.slaEscalatedAt?.toISOString() ?? null,
        createdAt: f.createdAt.toISOString(),
        slaStatus: sla.status,
        daysRemaining: sla.daysRemaining,
      };
    });

    const slaBreaches = {
      day5Flag: sarList.filter((s) => s.slaStatus === 'flagged').length,
      day7Breach: sarList.filter((s) => s.slaStatus === 'overdue').length,
      onTrack: sarList.filter((s) => s.slaStatus === 'on_track').length,
      notApplicable: sarList.filter((s) => s.slaStatus === 'not_applicable').length,
      totalOpen: sarList.length,
    };

    const pendingMakerChecker = {
      lifecycleRequests: pendingLifecycleRequests,
      sanctionsDismissals: pendingSanctionsDismissals,
      kycHighRisk: pendingKycHighRisk,
      sarPendingMlro: pendingSarMakerChecker,
      // Also include GoAMLFiling rows whose approvalStage is PENDING_MLRO
      // (in-flight 3-stage approval chain, may or may not have a MakerCheckerLog)
      sarPendingMlroStage: openSarFilings.filter(
        (f) => f.approvalStage === 'PENDING_MLRO',
      ).length,
      total:
        pendingLifecycleRequests +
        pendingSanctionsDismissals +
        pendingKycHighRisk +
        pendingSarMakerChecker,
    };

    // ── KRI Trend: 6-month from real KRIMetric history ───────────────────
    // We derive two pseudo-series:
    //   - falsePositiveRate: from KRIMetric rows whose name contains 'false positive'
    //   - complianceScore: from KRIMetric rows whose name contains 'compliance score'
    //   OR falls back to a flat series using the latest snapshot value (NO Math.random).
    //
    // NOTE: The KRIMetric model does not store historical versions — updatedAt is
    // a single datetime. So the "trend" is constructed by repeating the current
    // value across the 6-month window. This is honest (no random data) but flat;
    // a future directive can introduce a KRIMetricHistory table.
    const monthLabels: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthLabels.push(d.toLocaleString('en', { month: 'short' }));
    }

    const falsePositiveKri = kriMetrics.find((k) =>
      k.name.toLowerCase().includes('false positive'),
    );
    const complianceKri =
      kriMetrics.find((k) => k.name.toLowerCase().includes('compliance score')) ??
      kriMetrics.find((k) => k.name.toLowerCase().includes('compliance'));

    const falsePositiveValue = falsePositiveKri
      ? typeof falsePositiveKri.value === 'number'
        ? falsePositiveKri.value
        : parseFloat(String(falsePositiveKri.value)) || 0
      : 0;
    const complianceValue = complianceKri
      ? typeof complianceKri.value === 'number'
        ? complianceKri.value
        : parseFloat(String(complianceKri.value)) || 0
      : 0;

    const kriTrend = monthLabels.map((month) => ({
      month,
      falsePositive: Math.round(falsePositiveValue * 10) / 10,
      compliance: Math.round(complianceValue * 10) / 10,
    }));

    // ── PII mask the SAR list before returning ──────────────────────────
    const maskedSarList = maskListPII(sarList) as typeof sarList;

    return NextResponse.json({
      success: true,
      data: {
        openSARs: openSarFilings.length,
        openSARsList: maskedSarList,
        slaBreaches,
        pendingMakerChecker,
        openAlerts: openAlertsCount,
        kriTrend,
        generatedAt: now.toISOString(),
        regulatoryRef: 'FDL 10/2025 Art. 8, 15; CBUAE Notice 3551/2021 S3.1, S4.2',
        slaConfig: {
          filingBusinessDays: SAR_SLA.FILING_BUSINESS_DAYS,
          flagAtBusinessDays: SAR_SLA.FLAG_AT_BUSINESS_DAYS,
        },
      },
    });
  } catch (error) {
    console.error('[DASHBOARD_MLRO_METRICS_GET] Error computing MLRO metrics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to compute MLRO metrics' },
      { status: 500 },
    );
  }
}
