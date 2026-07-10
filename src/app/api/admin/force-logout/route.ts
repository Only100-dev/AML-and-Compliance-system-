import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { createAuditLog } from '@/lib/audit';
import { checkPermission } from '@/lib/compliance/rbac';
import { z } from 'zod';

/**
 * Phase 3 Directive 3.1 — Force Logout (Master Admin).
 *
 * FDL 10/2025 Art. 15; CBUAE Notice 3551/2021 S3.4.
 *
 * Sets `User.sessionsRevokedAt = now()`. The auth-guard rejects any JWT
 * whose `iat` predates this timestamp, so the user's active sessions are
 * invalidated server-side without requiring a session table.
 *
 * Also writes a LoginEvent (eventType=FORCE_LOGOUT) so the User Lifecycle
 * UI's login-history panel surfaces the action alongside organic logins,
 * and creates an immutable AuditLog entry (action=FORCE_LOGOUT) with
 * previousValue/newValue of `sessionsRevokedAt`.
 *
 * RBAC: admin-only (canForceLogout). NOT routed through Maker-Checker
 * (operational action — the Master Admin is the authoritative actor for
 * session invalidation under incident-response conditions).
 */

const ForceLogoutSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  reason: z.string().max(500).optional(),
});

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

// ─── POST /api/admin/force-logout ────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authGuard({ allowedRoles: ['admin'] });
  if (!auth.authorized) return auth.error ?? NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  const rateLimitError = applyRateLimit(auth, request, 'WRITE');
  if (rateLimitError) return rateLimitError;

  const sessionUser = auth.session?.user as Record<string, unknown> | undefined;
  const role = (sessionUser?.role as string) ?? '';
  const adminId = (sessionUser?.userId as string) || 'dev-user';
  if (!checkPermission(role as never, 'canForceLogout' as never)) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions — canForceLogout required' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = ForceLogoutSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: fieldErrors, violation: 'VALIDATION_ERROR' },
      { status: 422 },
    );
  }

  const { userId, reason } = parsed.data;

  // Admin cannot force-logout their own account (would lock out the
  // incident responder mid-action — operational footgun).
  if (userId === adminId) {
    return NextResponse.json(
      { success: false, error: 'You cannot force-logout your own account', violation: 'SELF_FORCE_LOGOUT_FORBIDDEN' },
      { status: 403 },
    );
  }

  try {
    const target = await db.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    const clientIp = getClientIp(request);
    const userAgent = request.headers.get('user-agent') ?? null;
    const detail = reason?.trim() || 'Force logout by admin';

    // ── 1. Set sessionsRevokedAt — auth-guard will reject JWTs whose iat
    //    predates this timestamp on the next request from the target user.
    await db.user.update({
      where: { id: userId },
      data: { sessionsRevokedAt: now },
    });

    // ── 2. LoginEvent row so the User Lifecycle UI surfaces the action.
    await db.loginEvent.create({
      data: {
        userId,
        userEmail: target.email,
        eventType: 'FORCE_LOGOUT',
        ipAddress: clientIp,
        userAgent,
        failureReason: null,
      },
    });

    // ── 3. Immutable audit-log entry (SHA-256 hashed, PII-sanitized).
    await createAuditLog({
      userId: adminId,
      action: 'FORCE_LOGOUT',
      resourceType: 'User',
      resourceId: userId,
      details: `Master Admin force-logouted user ${target.email}. Reason: ${detail}. All active sessions invalidated (sessionsRevokedAt set).`,
      ipAddress: clientIp,
      previousValue: { sessionsRevokedAt: target.sessionsRevokedAt ?? null },
      newValue: { sessionsRevokedAt: now.toISOString() },
    });

    return NextResponse.json({
      success: true,
      sessionsRevokedAt: now.toISOString(),
      message: `All active sessions for ${target.email} have been invalidated.`,
    });
  } catch (error) {
    console.error('[admin/force-logout POST] Database error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to force logout user' },
      { status: 500 },
    );
  }
}
