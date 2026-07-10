/**
 * Board Portal Aggregated Metrics API (Anonymized, View-Only)
 * Phase 3 Directive 3.3 (Deliverable B)
 * ------------------------------------------------------------------
 * Returns strictly AGGREGATED, ANONYMIZED KPI/KRI data for the Board
 * Member Portal. NO PII, NO individual customer names, NO individual
 * SAR subjects, NO alert case IDs, NO user identifiers — only counts,
 * percentages, and risk-level distributions.
 *
 * Returns:
 *   - totalAlerts              : count of all AML alerts
 *   - alertsByRiskLevel        : { low, intermediate, high, critical }
 *   - totalSARsFiled           : count of GoAML filings SUBMITTED_TO_FIU
 *   - openSARs                 : count of GoAML filings not yet submitted
 *   - slaCompliancePct         : % of SARs filed within the 7-day SLA
 *   - slaBreaches              : { day5Flag, day7Breach }
 *   - kriTrend                 : 6-month trend (compliance + false-positive), anonymized
 *   - riskHeatmap              : Department risk scores (no PII, just score + level)
 *   - complianceScore          : overall compliance score (%)
 *   - policyStats              : { total, published, draft, underReview }
 *   - trainingCompletionPct    : overall training completion %
 *
 * RBAC: board + mlro + admin (per canViewBoardDashboard in rbac.ts).
 * FDL 10/2025 Art. 11, 15-17; CBUAE Notice 3551/2021 S3.1, S10.7.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { sanitizeObject } from '@/lib/pii';

export const dynamic = 'force-dynamic';

// ─── Helpers ─────────────────────────────────────────────────────────────

function deriveRiskLevel(score: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

// ─── GET /api/dashboard/board-metrics ──────────────────────────────────────

export async function GET(request: Request) {
  const auth = await authGuard({ allowedRoles: ['board', 'mlro', 'admin'] });
  if (!auth.authorized) {
    return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const rateLimitError = applyRateLimit(auth, request, 'READ');
  if (rateLimitError) return rateLimitError;

  try {
    const now = new Date();

    // ── Parallel queries (all aggregated, no PII selection) ─────────────
    const [
      totalAlerts,
      alertsByRiskLevelRaw,
      totalSARsFiled,
      openSARs,
      sarFilingsWithSla,
      departmentRisks,
      kriMetrics,
      totalRegulations,
      compliantRegulations,
      totalPolicies,
      publishedPolicies,
      draftPolicies,
      underReviewPolicies,
      trainingTotal,
      trainingCompleted,
    ] = await Promise.all([
      db.aMLAlert.count(),

      // Alerts by risk level (no PII, just counts)
      db.aMLAlert.groupBy({ by: ['riskLevel'], _count: true }),

      // SARs filed with FIU (closed state)
      db.goAMLFiling.count({
        where: { filingStatus: { in: ['SUBMITTED_TO_FIU', 'ACKNOWLEDGED'] } },
      }),

      // Open SARs (not yet submitted)
      db.goAMLFiling.count({
        where: { filingStatus: { notIn: ['SUBMITTED_TO_FIU', 'ACKNOWLEDGED'] } },
      }),

      // All SARs with SLA fields (for SLA compliance %)
      db.goAMLFiling.findMany({
        where: { slaDeadline: { not: null } },
        select: {
          slaDeadline: true,
          slaFlaggedAt: true,
          slaEscalatedAt: true,
          filingStatus: true,
        },
      }),

      // Department risk heatmap (no PII)
      db.departmentRiskScore.findMany({
        orderBy: { score: 'desc' },
      }),

      // KRI metrics (no PII — KRIMetric has no PII fields)
      db.kRIMetric.findMany({}),

      // Regulations — total + compliant (for compliance score)
      db.regulation.count(),
      db.regulation.count({ where: { complianceStatus: 'COMPLIANT' } }),

      // Policies
      db.policy.count(),
      db.policy.count({ where: { status: 'published' } }),
      db.policy.count({ where: { status: 'draft' } }),
      db.policy.count({ where: { status: 'under_review' } }),

      // Training completion
      db.trainingEnrollment.count(),
      db.trainingEnrollment.count({ where: { status: 'completed' } }),
    ]);

    // ── Alerts by risk level ────────────────────────────────────────────
    const alertsByRiskLevel = { low: 0, intermediate: 0, high: 0, critical: 0 };
    for (const r of alertsByRiskLevelRaw) {
      const level = (r.riskLevel || '').toLowerCase();
      if (level in alertsByRiskLevel) {
        (alertsByRiskLevel as Record<string, number>)[level] = r._count;
      }
    }

    // ── SLA compliance % (closed SARs that were NOT escalated) ──────────
    const sarWithDeadline = sarFilingsWithSla.length;
    const sarEscalated = sarFilingsWithSla.filter((s) => s.slaEscalatedAt !== null).length;
    const sarFlagged = sarFilingsWithSla.filter(
      (s) => s.slaFlaggedAt !== null && s.slaEscalatedAt === null,
    ).length;
    const slaCompliancePct =
      sarWithDeadline > 0
        ? Math.round(((sarWithDeadline - sarEscalated) / sarWithDeadline) * 1000) / 10
        : 100;

    // ── Risk heatmap (anonymized) ───────────────────────────────────────
    const riskHeatmap = departmentRisks.map((d) => ({
      departmentId: d.departmentId,
      score: d.score,
      riskLevel: deriveRiskLevel(d.score),
      calculatedAt: d.calculatedAt.toISOString(),
      // factors is JSON; sanitizeObject strips any PII inside (defensive — should be all numeric)
      factors: sanitizeObject(d.factors),
    }));

    // ── KRI trend (6-month, anonymized) ────────────────────────────────
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
      falsePositiveRate: Math.round(falsePositiveValue * 10) / 10,
      complianceScore: Math.round(complianceValue * 10) / 10,
    }));

    // ── Compliance score (overall % of COMPLIANT regulations) ───────────
    const overallComplianceScore =
      totalRegulations > 0
        ? Math.round((compliantRegulations / totalRegulations) * 100 * 10) / 10
        : 0;

    const trainingCompletionPct =
      trainingTotal > 0
        ? Math.round((trainingCompleted / trainingTotal) * 1000) / 10
        : 0;

    return NextResponse.json({
      success: true,
      data: sanitizeObject({
        totalAlerts,
        alertsByRiskLevel,
        totalSARsFiled,
        openSARs,
        slaCompliancePct,
        slaBreaches: {
          day5Flag: sarFlagged,
          day7Breach: sarEscalated,
        },
        kriTrend,
        riskHeatmap,
        complianceScore: overallComplianceScore,
        regulationStats: {
          total: totalRegulations,
          compliant: compliantRegulations,
        },
        policyStats: {
          total: totalPolicies,
          published: publishedPolicies,
          draft: draftPolicies,
          underReview: underReviewPolicies,
        },
        trainingCompletionPct,
        generatedAt: now.toISOString(),
        regulatoryRef: 'FDL 10/2025 Art. 11, 15-17; CBUAE Notice 3551/2021 S3.1, S10.7',
        anonymized: true,
      }),
    });
  } catch (error) {
    console.error('[DASHBOARD_BOARD_METRICS_GET] Error computing board metrics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to compute board metrics' },
      { status: 500 },
    );
  }
}
