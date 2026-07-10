import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { checkPermission, type ComplianceRole } from '@/lib/compliance/rbac';

// ─── GET: List Auditor Time-Travel View History ─────────────────────────────
// FDL 10/2025 Art. 11, 15 — Auditor Time-Travel View History

export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // RBAC check
    const userRole = (auth.session?.user as Record<string, unknown>)?.role as string;
    if (!checkPermission(userRole as ComplianceRole, 'canAccessAuditorTimeTravel')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Permission denied: canAccessAuditorTimeTravel',
          regulatoryRef: 'FDL 10/2025 Art. 11, 15; CR 134/2025 Art. 16, 21',
        },
        { status: 403 }
      );
    }

    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;

    const authUserId = (auth.session?.user as Record<string, unknown>)?.userId as string
      || (auth.session?.user as Record<string, unknown>)?.id as string
      || 'system';

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const [views, total] = await Promise.all([
      db.auditorTimeTravelView.findMany({
        where: { auditorId: authUserId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.auditorTimeTravelView.count({
        where: { auditorId: authUserId },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: views,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      regulatoryRef: 'FDL 10/2025 Art. 11, 15; CR 134/2025 Art. 16, 21',
    });
  } catch (error) {
    console.error('[AUDIT_TIME_TRAVEL_HISTORY_GET] Error listing time-travel history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list time-travel history' },
      { status: 500 }
    );
  }
}
