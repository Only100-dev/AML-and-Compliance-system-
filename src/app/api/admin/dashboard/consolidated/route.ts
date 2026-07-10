import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard, canSessionSwitchJurisdiction } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import {
  GCC_COUNTRIES,
  getCountryName,
  getRegulator,
  getCurrency,
  getFlag,
  getHealthStatus,
  type JurisdictionHealthEntry,
  type ComplianceHealthStatus,
} from '@/lib/gcc';

// GET /api/dashboard/consolidated — GCC-wide consolidated dashboard metrics
//
// ─── GCC Phase 5 Directive 5.2: Consolidated Dashboard API ──────────────
// Returns aggregated KPIs across ALL 6 GCC jurisdictions for the Regional
// Admin/Board "GCC Consolidated View" toggle.
//
// ACCESS CONTROL: Only regional users (userType === 'regional') or users
// with canSwitchJurisdiction permission can access this endpoint.
// Local users are blocked with 403 — they only see their own country.
export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard();
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;

    // Gate: Only regional/admin/board users can access the consolidated view.
    const canSwitch = canSessionSwitchJurisdiction(auth.session);
    if (!canSwitch) {
      return NextResponse.json(
        { success: false, error: 'Access denied. The GCC Consolidated View is only available to regional users.' },
        { status: 403 },
      );
    }

    // Fetch all jurisdictions from the DB.
    const jurisdictions = await db.jurisdiction.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    // For each jurisdiction, compute metrics.
    const healthEntries: JurisdictionHealthEntry[] = [];
    let totalAlerts = 0;
    let totalOpenAlerts = 0;
    let totalPolicies = 0;
    let totalPublishedPolicies = 0;
    let totalSlaBreaches = 0;
    let totalComplianceScores = 0;
    let jurisdictionCount = 0;

    // Per-currency alert amount aggregation (Directive 5.3)
    const alertAmountsByCurrency: Record<string, number> = {};

    for (const j of jurisdictions) {
      const jScope = { jurisdictionId: j.id };
      const isAE = j.code === 'AE';
      const legacyScope = isAE ? {} : { id: { equals: '__NO_LEGACY_DATA_FOR_NON_AE__' } };

      // Parallel queries per jurisdiction
      const [
        alertCount,
        openAlertCount,
        totalAlertAmount,
        policyCount,
        publishedPolicyCount,
        regulationCount,
        compliantRegulationCount,
        overdueAuditCount,
      ] = await Promise.all([
        db.aMLAlert.count({ where: jScope }),
        db.aMLAlert.count({ where: { ...jScope, status: { in: ['new', 'escalated', 'under_investigation'] } } }),
        db.aMLAlert.aggregate({ where: jScope, _sum: { amount: true } }),
        db.policy.count({ where: jScope }),
        db.policy.count({ where: { ...jScope, status: 'published' } }),
        db.regulation.count({ where: legacyScope }),
        db.regulation.count({ where: { ...legacyScope, complianceStatus: 'COMPLIANT' } }),
        db.complianceAudit.count({ where: { ...legacyScope, remediationStatus: 'overdue' } }),
      ]);

      const complianceScore = regulationCount > 0
        ? Math.round((compliantRegulationCount / regulationCount) * 100 * 10) / 10
        : isAE ? 85 : 0; // Default for non-AE with no data

      const health: ComplianceHealthStatus = getHealthStatus(complianceScore);

      healthEntries.push({
        code: j.code as typeof GCC_COUNTRIES[number],
        name: j.name || getCountryName(j.code),
        flag: getFlag(j.code),
        regulatorName: j.regulatorName || getRegulator(j.code),
        currency: j.currency || getCurrency(j.code),
        health,
        complianceScore,
        openAlerts: openAlertCount,
        slaBreaches: overdueAuditCount,
        totalPolicies: policyCount,
        publishedPolicies: publishedPolicyCount,
      });

      totalAlerts += alertCount;
      totalOpenAlerts += openAlertCount;
      totalPolicies += policyCount;
      totalPublishedPolicies += publishedPolicyCount;
      totalSlaBreaches += overdueAuditCount;
      totalComplianceScores += complianceScore;
      jurisdictionCount += 1;

      // Accumulate per-currency alert amounts (Directive 5.3)
      const alertAmount = totalAlertAmount._sum.amount ?? 0;
      const currency = j.currency || getCurrency(j.code);
      alertAmountsByCurrency[currency] = (alertAmountsByCurrency[currency] || 0) + alertAmount;
    }

    // Compute average compliance score
    const avgComplianceScore = jurisdictionCount > 0
      ? Math.round((totalComplianceScores / jurisdictionCount) * 10) / 10
      : 0;

    // Build currency breakdown (Directive 5.3)
    const currencyBreakdown = Object.entries(alertAmountsByCurrency).map(([currency, amount]) => ({
      currency,
      amount,
    }));

    const consolidated = {
      totalJurisdictions: jurisdictionCount,
      avgComplianceScore,
      totalAlerts,
      totalOpenAlerts,
      totalPolicies,
      totalPublishedPolicies,
      totalSlaBreaches,
      jurisdictionHealth: healthEntries,
      currencyBreakdown,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: consolidated });
  } catch (error) {
    console.error('Failed to fetch consolidated dashboard metrics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch consolidated metrics' },
      { status: 500 },
    );
  }
}
