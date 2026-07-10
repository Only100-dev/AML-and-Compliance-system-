import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { sanitizeObject } from '@/lib/pii';
import { applyRateLimit } from '@/lib/rate-limit';

const analyticsQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(60).optional(),
});

// ─── Helper: Map risk strings to numeric values ─────────────────────────────

const RISK_NUMERIC: Record<string, number> = {
  low: 25,
  medium: 50,
  high: 75,
  critical: 90,
  LOW: 25,
  MEDIUM: 50,
  HIGH: 75,
  CRITICAL: 90,
  STANDARD: 25,
};

function riskToNumber(risk: string): number {
  return RISK_NUMERIC[risk] ?? 50;
}

// ─── Helper: Aggregate by month ──────────────────────────────────────────────

function aggregateByMonth(
  items: Array<{ createdAt: Date }>,
  months: number
): Array<{ month: string; count: number }> {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const monthMap = new Map<string, number>();

  // Initialize all months in range
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(key, 0);
  }

  for (const item of items) {
    const d = new Date(item.createdAt);
    if (d >= cutoff) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthMap.has(key)) {
        monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
      }
    }
  }

  return Array.from(monthMap.entries()).map(([month, count]) => ({ month, count }));
}

// ─── GET: Live Analytics Aggregation ─────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard();
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;
    const { searchParams } = new URL(request.url);
    const parsed = analyticsQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const months = parsed.data.months ?? 12;

    // ─── Run all independent queries in parallel for performance ──────────

    const [
      alerts,
      corpKYC,
      indKYC,
      filings,
      risks,
      aiMessages,
      totalAlerts,
      openAlerts,
      totalKYC,
      pendingKYC,
      totalFilings,
      pendingFilings,
    ] = await Promise.all([
      // a) Risk posture - AML alerts by risk level
      db.aMLAlert.groupBy({ by: ['riskLevel'], _count: true }),

      // b) KYC risk counts - Corporate
      db.corporateKYC.groupBy({ by: ['riskRating'], _count: true }),

      // b) KYC risk counts - Individual
      db.individualKYC.groupBy({ by: ['riskRating'], _count: true }),

      // c) Transaction trends - GoAML filings
      db.goAMLFiling.findMany({
        select: { reportType: true, createdAt: true, filingStatus: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),

      // d) Domain risk scores
      db.riskAssessment.findMany({
        select: { domain: true, inherentRisk: true, residualRisk: true },
      }),

      // e) AI model usage
      db.aIChatMessage.findMany({
        select: { modelUsed: true, latencyMs: true, createdAt: true },
      }),

      // f) Compliance summary counts - total alerts
      db.aMLAlert.count(),

      // f) Compliance summary counts - open alerts
      db.aMLAlert.count({ where: { status: { in: ['new', 'triage', 'investigating'] } } }),

      // f) Compliance summary counts - total KYC (corp + ind)
      Promise.all([
        db.corporateKYC.count(),
        db.individualKYC.count(),
      ]).then(([c, i]) => c + i),

      // f) Compliance summary counts - pending KYC
      Promise.all([
        db.corporateKYC.count({ where: { status: 'DRAFT' } }),
        db.individualKYC.count({ where: { status: 'DRAFT' } }),
      ]).then(([c, i]) => c + i),

      // f) Compliance summary counts - total filings
      db.goAMLFiling.count(),

      // f) Compliance summary counts - pending filings
      db.goAMLFiling.count({ where: { filingStatus: { in: ['DRAFT', 'PENDING_APPROVAL'] } } }),
    ]);

    // ─── a) Risk Posture ──────────────────────────────────────────────────
    const riskPosture = alerts.map(a => ({
      riskLevel: a.riskLevel,
      count: a._count,
    }));

    // ─── b) KYC Risk Counts ───────────────────────────────────────────────
    const kycRiskCounts = [
      ...corpKYC.map(k => ({ source: 'corporate' as const, riskRating: k.riskRating, count: k._count })),
      ...indKYC.map(k => ({ source: 'individual' as const, riskRating: k.riskRating, count: k._count })),
    ];

    // ─── c) Transaction Trends ────────────────────────────────────────────
    const transactionTrends = aggregateByMonth(filings, months);

    // ─── d) Domain Risk Scores ────────────────────────────────────────────
    const domainMap = new Map<string, { inherentSum: number; residualSum: number; count: number }>();
    for (const r of risks) {
      const existing = domainMap.get(r.domain) ?? { inherentSum: 0, residualSum: 0, count: 0 };
      existing.inherentSum += riskToNumber(r.inherentRisk);
      existing.residualSum += riskToNumber(r.residualRisk);
      existing.count += 1;
      domainMap.set(r.domain, existing);
    }
    const domainRiskScores = Array.from(domainMap.entries()).map(([domain, data]) => ({
      domain,
      avgInherentRisk: Math.round(data.inherentSum / data.count),
      avgResidualRisk: Math.round(data.residualSum / data.count),
      assessmentCount: data.count,
    }));

    // ─── e) AI Model Usage ────────────────────────────────────────────────
    const modelMap = new Map<string, { queryCount: number; latencySum: number; latencyCount: number }>();
    for (const m of aiMessages) {
      const model = m.modelUsed ?? 'unknown';
      const existing = modelMap.get(model) ?? { queryCount: 0, latencySum: 0, latencyCount: 0 };
      existing.queryCount += 1;
      if (m.latencyMs !== null && m.latencyMs !== undefined) {
        existing.latencySum += m.latencyMs;
        existing.latencyCount += 1;
      }
      modelMap.set(model, existing);
    }
    const aiModelUsage = Array.from(modelMap.entries()).map(([model, data]) => ({
      model,
      queryCount: data.queryCount,
      avgLatencyMs: data.latencyCount > 0 ? Math.round(data.latencySum / data.latencyCount) : null,
    }));

    // ─── f) Compliance Summary ────────────────────────────────────────────
    const complianceSummary = {
      totalAlerts,
      openAlerts,
      totalKYC,
      pendingKYC,
      totalFilings,
      pendingFilings,
    };

    // ─── g) Filing Trends by Type ─────────────────────────────────────────
    const filingByTypeMonth = new Map<string, Map<string, number>>();
    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    for (const f of filings) {
      const d = new Date(f.createdAt);
      if (d >= cutoff) {
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const typeKey = f.reportType;
        if (!filingByTypeMonth.has(typeKey)) {
          filingByTypeMonth.set(typeKey, new Map());
        }
        const monthData = filingByTypeMonth.get(typeKey)!;
        monthData.set(monthKey, (monthData.get(monthKey) ?? 0) + 1);
      }
    }

    const filingTrendsByType = Array.from(filingByTypeMonth.entries()).map(
      ([reportType, monthData]) => ({
        reportType,
        trends: Array.from(monthData.entries()).map(([month, count]) => ({ month, count })),
      })
    );

    return NextResponse.json({
      success: true,
      data: sanitizeObject({
        riskPosture,
        kycRiskCounts,
        transactionTrends,
        domainRiskScores,
        aiModelUsage,
        complianceSummary,
        filingTrendsByType,
      }),
    });
  } catch (error) {
    console.error('[ANALYTICS_AGGREGATE_GET] Error computing analytics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to compute analytics' },
      { status: 500 }
    );
  }
}
