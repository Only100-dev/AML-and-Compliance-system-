import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';

const complianceQuerySchema = z.object({
  jurisdiction: z.string().optional(),
});

// GET /api/compliance - Get compliance metrics
export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard();
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;
    const { searchParams } = new URL(request.url);
    const parsed = complianceQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const jurisdiction = parsed.data.jurisdiction || 'ALL';

    const where: Record<string, unknown> = {};
    if (jurisdiction !== 'ALL') where.jurisdiction = jurisdiction;

    // Fetch real metrics from database
    const [
      totalRegulations,
      compliantRegulations,
      partialRegulations,
      nonCompliantRegulations,
      pendingRegulations,
      totalAMLAlerts,
      openAMLAlerts,
      escalatedAMLAlerts,
      activeSanctionsExceptions,
      totalClaims,
      siuFlaggedClaims,
      kriMetrics,
    ] = await Promise.all([
      db.regulation.count({ where }),
      db.regulation.count({ where: { ...where, complianceStatus: 'COMPLIANT' } }),
      db.regulation.count({ where: { ...where, complianceStatus: 'PARTIAL' } }),
      db.regulation.count({ where: { ...where, complianceStatus: 'NON_COMPLIANT' } }),
      db.regulation.count({ where: { ...where, complianceStatus: 'PENDING' } }),
      db.aMLAlert.count({ where }),
      db.aMLAlert.count({ where: { ...where, status: { in: ['new', 'triage'] } } }),
      db.aMLAlert.count({ where: { ...where, status: 'escalated' } }),
      db.sanctionsException.count({ where: { status: 'active' } }),
      db.claim.count(),
      db.claim.count({ where: { siuFlagged: true } }),
      db.kRIMetric.findMany({ where }),
    ]);

    // Calculate compliance score
    const complianceScore = totalRegulations > 0
      ? Math.round((compliantRegulations / totalRegulations) * 100 * 10) / 10
      : 0;

    // Calculate false positive rate from KRI
    const fpKri = kriMetrics.find(k => k.name.includes('False Positive'));
    const falsePositiveRate = fpKri ? fpKri.value : 0;

    const metrics = {
      totalAlerts: totalAMLAlerts,
      openAlerts: openAMLAlerts,
      overdueReviews: partialRegulations + nonCompliantRegulations,
      sanctionsHits: escalatedAMLAlerts,
      falsePositiveRate,
      activeExceptions: activeSanctionsExceptions,
      pendingInspections: pendingRegulations,
      complianceScore,
      jurisdiction,
      lastUpdated: new Date().toISOString(),
      kriMetrics: kriMetrics.map(k => ({
        id: k.id,
        name: k.name,
        value: k.value,
        target: k.target,
        trend: k.trend,
        status: k.value <= k.target ? 'compliant' : k.value <= k.target * 1.2 ? 'warning' : 'critical',
        jurisdiction: k.jurisdiction,
        category: k.category,
      })),
      claimsSummary: {
        total: totalClaims,
        siuFlagged: siuFlaggedClaims,
      },
      regulationsSummary: {
        total: totalRegulations,
        compliant: compliantRegulations,
        partial: partialRegulations,
        nonCompliant: nonCompliantRegulations,
        pending: pendingRegulations,
      },
    };

    return NextResponse.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Failed to fetch compliance metrics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch compliance metrics' },
      { status: 500 }
    );
  }
}
