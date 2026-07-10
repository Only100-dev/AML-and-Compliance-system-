import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';

// ─── Phase 2 Directive 2.3: List Pending User Lifecycle Change Requests ──────
// Returns the Maker-Checker queue for USER_ROLE_CHANGE and USER_DEACTIVATION
// requests, enriched with the target user's current state. Used by the Admin
// panel's "Segregation of Duties" approval queue UI.

export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'PENDING';

    const where: Record<string, unknown> = {
      operationType: { in: ['USER_ROLE_CHANGE', 'USER_DEACTIVATION'] },
    };
    if (statusFilter !== 'ALL') {
      where.status = statusFilter;
    }

    const logs = await db.makerCheckerLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Enrich with target user current state
    const enriched = await Promise.all(
      logs.map(async (log) => {
        let snapshot: Record<string, unknown> = {};
        try {
          snapshot = JSON.parse(log.payloadSnapshot);
        } catch {
          snapshot = { parseError: true };
        }
        const targetUserId = snapshot.targetUserId as string | undefined;
        const targetUser = targetUserId
          ? await db.user.findUnique({
              where: { id: targetUserId },
              select: { id: true, email: true, name: true, role: true, isActive: true },
            })
          : null;
        return {
          id: log.id,
          operationType: log.operationType,
          status: log.status,
          makerName: log.makerName,
          makerId: log.makerId,
          checkerName: log.checkerName,
          reviewedAt: log.reviewedAt?.toISOString() ?? null,
          expiryTime: log.expiryTime.toISOString(),
          createdAt: log.createdAt.toISOString(),
          snapshot,
          targetUser: targetUser
            ? {
                id: targetUser.id,
                email: targetUser.email,
                name: targetUser.name,
                currentRole: targetUser.role,
                currentIsActive: targetUser.isActive,
              }
            : null,
        };
      }),
    );

    const summary = {
      pending: enriched.filter((e) => e.status === 'PENDING').length,
      approved: enriched.filter((e) => e.status === 'APPROVED').length,
      rejected: enriched.filter((e) => e.status === 'REJECTED').length,
      expired: enriched.filter((e) => e.status === 'EXPIRED').length,
    };

    return NextResponse.json({ success: true, data: enriched, summary });
  } catch (error) {
    console.error('[Admin Lifecycle Requests API] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch lifecycle requests' }, { status: 500 });
  }
}
