/**
 * P3 Step 2 — Department Risk Scores Read API
 * ------------------------------------------------------------------
 * Returns all DepartmentRiskScore rows (ordered by score desc) for the
 * Department Risk Heatmap on the Advanced Analytics dashboard.
 *
 * RBAC: gated by the existing authGuard + canViewRiskAssessment permission
 * (granted to compliance_officer, compliance_manager, mlro, admin, board).
 *
 * The response includes a derived `riskLevel` field:
 *   score >= 75 → 'CRITICAL'
 *   50..74      → 'HIGH'
 *   25..49      → 'MEDIUM'
 *   < 25        → 'LOW'
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { checkPermission } from '@/lib/compliance/rbac';
import { applyRateLimit } from '@/lib/rate-limit';

// ─── Helpers ─────────────────────────────────────────────────────────────

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export function deriveRiskLevel(score: number): RiskLevel {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

// ─── GET /api/department-risk ────────────────────────────────────────────

export async function GET(request: Request) {
  // 1) Auth + rate limit.
  const auth = await authGuard();
  if (!auth.authorized) {
    return auth.error ?? NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }
  const rateLimitError = applyRateLimit(auth, request, 'READ');
  if (rateLimitError) return rateLimitError;

  // 2) RBAC — must hold canViewRiskAssessment.
  const userRole = (auth.session?.user as Record<string, unknown> | undefined)?.role as
    | string
    | undefined;
  if (!userRole || !checkPermission(userRole as never, 'canViewRiskAssessment')) {
    return NextResponse.json(
      {
        success: false,
        error: 'Insufficient permissions',
        requiredPermission: 'canViewRiskAssessment',
      },
      { status: 403 },
    );
  }

  try {
    const rows = await db.departmentRiskScore.findMany({
      orderBy: { score: 'desc' },
    });

    const data = rows.map((r) => ({
      id: r.id,
      departmentId: r.departmentId,
      score: r.score,
      calculatedAt: r.calculatedAt,
      factors: r.factors,
      riskLevel: deriveRiskLevel(r.score),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[DEPARTMENT_RISK_GET] Failed to fetch department risk scores:', message);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch department risk scores' },
      { status: 500 },
    );
  }
}
