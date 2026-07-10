/**
 * User Login History API — Phase 3.1 (P4-C)
 *
 * GET /api/admin/users/[id]/login-history
 *
 * Returns:
 *   - history:        last 50 UserLoginHistory records (newest first)
 *   - failedAttempts: count of LOGIN_FAILED records in the last 30 days
 *   - lockout:        { isLocked, lockedUntil, lastLockoutEvent? }
 *                     (locked if the latest UserSecurityEvent of type LOCKOUT
 *                      has details.lockedUntil in the future)
 *   - lastLogin:      the most recent LOGIN_SUCCESS record (or null)
 *
 * RBAC: withRBAC('canManageUsers') — admin only.
 * Audit: NOT audit-logged per request (read endpoint, shift-left mandate —
 *        see /api/tasks/my-tasks/route.ts comment).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRBAC, type ComplianceRole } from '@/lib/compliance/rbac';

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

// ─── GET /api/admin/users/[id]/login-history ────────────────────────────────
export const GET = withRBAC(
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

      // Compute the 30-day cutoff
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Run queries in parallel: history + failed count + last login + last lockout
      const [history, failedAttempts, lastLogin, lastLockoutEvent] = await Promise.all([
        db.userLoginHistory.findMany({
          where: { userId: id },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        db.userLoginHistory.count({
          where: {
            userId: id,
            action: 'LOGIN_FAILED',
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
        db.userLoginHistory.findFirst({
          where: { userId: id, action: 'LOGIN_SUCCESS' },
          orderBy: { createdAt: 'desc' },
        }),
        db.userSecurityEvent.findFirst({
          where: { userId: id, eventType: 'LOCKOUT' },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      // Compute lockout status from the latest LOCKOUT event
      let isLocked = false;
      let lockedUntil: string | null = null;
      let lastLockoutAt: string | null = null;
      if (lastLockoutEvent) {
        lastLockoutAt = lastLockoutEvent.createdAt.toISOString();
        try {
          const details = JSON.parse(lastLockoutEvent.details) as {
            lockedUntil?: string;
            duration?: number;
          };
          if (details.lockedUntil) {
            const until = new Date(details.lockedUntil);
            lockedUntil = until.toISOString();
            isLocked = until.getTime() > Date.now();
          }
        } catch {
          /* ignore parse errors */
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          history: history.map((h) => ({
            id: h.id,
            action: h.action,
            ipAddress: h.ipAddress,
            userAgent: h.userAgent,
            success: h.success,
            failureReason: h.failureReason,
            createdAt: h.createdAt,
          })),
          failedAttempts,
          lockout: {
            isLocked,
            lockedUntil,
            lastLockoutAt,
          },
          lastLogin: lastLogin
            ? {
                id: lastLogin.id,
                ipAddress: lastLogin.ipAddress,
                userAgent: lastLogin.userAgent,
                createdAt: lastLogin.createdAt,
              }
            : null,
          _requestedBy: ctx.userId,
        },
      });
    } catch (error) {
      console.error('[admin/users/[id]/login-history GET] error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch login history' },
        { status: 500 },
      );
    }
  },
  'canManageUsers',
);
