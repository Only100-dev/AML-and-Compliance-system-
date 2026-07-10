import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { checkPermission } from '@/lib/compliance/rbac';

/**
 * Phase 3 Directive 3.1 — Login History / Failed-Attempt Summary.
 *
 * FDL 10/2025 Art. 15; CBUAE Notice 3551/2021 S3.4.
 *
 * Returns a structured login-event stream for a single user (used by the
 * User Lifecycle UI's "Login History" panel). Also returns a summary
 * (total events, failed-attempt count, most-recent successful login) so
 * the admin can see at-a-glance whether the account is under attack.
 *
 * RBAC: admin-only (canViewLoginHistory). Read-only endpoint.
 */

// ─── GET /api/admin/login-events?userId=X&limit=50 ───────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authGuard({ allowedRoles: ['admin'] });
  if (!auth.authorized) return auth.error ?? NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  const rateLimitError = applyRateLimit(auth, request, 'READ');
  if (rateLimitError) return rateLimitError;

  const sessionUser = auth.session?.user as Record<string, unknown> | undefined;
  const role = (sessionUser?.role as string) ?? '';
  if (!checkPermission(role as never, 'canViewLoginHistory' as never)) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions — canViewLoginHistory required' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'userId query parameter is required' },
      { status: 400 },
    );
  }
  const limitRaw = Number.parseInt(searchParams.get('limit') ?? '50', 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;

  try {
    const [events, totalCount, failedCount, lastSuccess] = await Promise.all([
      db.loginEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      db.loginEvent.count({ where: { userId } }),
      db.loginEvent.count({ where: { userId, eventType: 'LOGIN_FAILED' } }),
      db.loginEvent.findFirst({
        where: { userId, eventType: 'LOGIN_SUCCESS' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      events,
      summary: {
        total: totalCount,
        failed: failedCount,
        lastLoginAt: lastSuccess?.createdAt ?? null,
      },
    });
  } catch (error) {
    console.error('[admin/login-events GET] Database error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch login events' },
      { status: 500 },
    );
  }
}
