/**
 * Force Logout API — Phase 3.1 (P4-C)
 *
 * POST /api/admin/users/[id]/force-logout
 *
 * Invalidates all active sessions for the target user. The User model has no
 * `sessionsInvalidatedAt` field (schema is frozen — Phase 3.1 constraint), so
 * we use the UserSecurityEvent approach:
 *   1. Create a UserSecurityEvent of type FORCE_LOGOUT with details.invalidatedAt
 *      and details.reason. Session-check middleware can query the latest
 *      FORCE_LOGOUT event for a user and invalidate any session whose
 *      issuedAt < event.createdAt.
 *   2. Record a UserLoginHistory row with action FORCE_LOGOUT (so it appears
 *      in the login-history feed).
 *   3. createAuditLog with action USER_FORCE_LOGOUT.
 *
 * Body: { reason?: string }
 *
 * RBAC: withRBAC('canManageUsers') — admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { withRBAC, type ComplianceRole } from '@/lib/compliance/rbac';
import { createAuditLog } from '@/lib/audit';

// ─── RBAC Context Helper ────────────────────────────────────────────────────
function getRBACContext(request: NextRequest) {
  const raw = request.headers.get('x-rbac-context');
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      /* fall through */
    }
  }
  return {
    userId: request.headers.get('x-user-id') ?? 'unknown',
    role: (request.headers.get('x-user-role') as ComplianceRole) ?? 'unknown',
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  };
}

// ─── Zod schema ─────────────────────────────────────────────────────────────
const ForceLogoutSchema = z.object({
  reason: z.string().max(500).optional(),
});

// ─── POST /api/admin/users/[id]/force-logout ────────────────────────────────
export const POST = withRBAC(
  async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> },
  ) => {
    try {
      const ctx = getRBACContext(request);
      const params = context ? await context.params : {};
      const { id } = params;

      if (!id) {
        return NextResponse.json(
          { success: false, error: 'User id is required' },
          { status: 400 },
        );
      }

      // Prevent self-force-logout
      if (id === ctx.userId) {
        return NextResponse.json(
          {
            success: false,
            error: 'You cannot force-logout your own account',
            violation: 'SELF_FORCE_LOGOUT_FORBIDDEN',
          },
          { status: 403 },
        );
      }

      // Parse body (allow empty body — reason is optional)
      let body: unknown = {};
      try {
        const text = await request.text();
        if (text.trim()) body = JSON.parse(text);
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid JSON payload' },
          { status: 400 },
        );
      }

      const parsed = ForceLogoutSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            details: parsed.error.issues.map((i) => ({
              field: i.path.join('.'),
              message: i.message,
            })),
          },
          { status: 422 },
        );
      }

      const reason = parsed.data.reason ?? 'Force logout initiated by administrator';

      // Verify the user exists
      const user = await db.user.findUnique({
        where: { id },
        select: { id: true, email: true, name: true, role: true },
      });
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 },
        );
      }

      const invalidatedAt = new Date();

      // Run the three writes in parallel: security event + login history + audit
      const [securityEvent, loginHistory] = await Promise.all([
        db.userSecurityEvent.create({
          data: {
            userId: id,
            eventType: 'FORCE_LOGOUT',
            details: JSON.stringify({
              invalidatedAt: invalidatedAt.toISOString(),
              reason,
              previousSessionIssuedBefore: invalidatedAt.toISOString(),
            }),
            performedById: ctx.userId,
            performedByRole: ctx.role,
          },
        }),
        db.userLoginHistory.create({
          data: {
            userId: id,
            userName: user.name,
            action: 'FORCE_LOGOUT',
            ipAddress: ctx.ipAddress ?? null,
            userAgent: request.headers.get('user-agent') ?? null,
            success: true,
            failureReason: null,
          },
        }),
      ]);

      // Audit log
      await createAuditLog({
        userId: ctx.userId,
        action: 'USER_FORCE_LOGOUT',
        resourceType: 'User',
        resourceId: id,
        details: `Force logout issued for ${user.email} (${user.name}) by ${ctx.role} (${ctx.userId}). Reason: ${reason}`,
        changes: {
          targetUser: { id: user.id, email: user.email, name: user.name, role: user.role },
          invalidatedAt: invalidatedAt.toISOString(),
          reason,
          securityEventId: securityEvent.id,
          loginHistoryId: loginHistory.id,
        },
        ipAddress: ctx.ipAddress,
      });

      return NextResponse.json({
        success: true,
        data: {
          userId: id,
          invalidatedAt: invalidatedAt.toISOString(),
          securityEventId: securityEvent.id,
          loginHistoryId: loginHistory.id,
          reason,
        },
        message: `Force logout issued for "${user.name}". All active sessions have been invalidated.`,
      });
    } catch (error) {
      console.error('[admin/users/[id]/force-logout POST] error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to force logout user' },
        { status: 500 },
      );
    }
  },
  'canManageUsers',
);
