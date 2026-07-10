/**
 * User Lifecycle — PATCH /api/admin/users/[id]
 *
 * Updates a user's status (Active ↔ Suspended ↔ Archived) with validated
 * state-machine transitions. The User model has only `isActive: Boolean`, so:
 *   - Active   ↔ isActive === true  AND no archived marker → user can log in
 *   - Suspended↔ isActive === false                  → user cannot log in (temp)
 *   - Archived ↔ isActive === false AND a UserSecurityEvent of type STATUS_CHANGE
 *                with details.archived=true exists    → user cannot log in (perm)
 *
 * Transition matrix (allowed):
 *   Active    → Suspended, Archived
 *   Suspended → Active, Archived
 *   Archived  → Active (restore), Suspended
 *
 * RBAC: withRBAC('canManageUsers') — admin only.
 * Audit: createAuditLog with action USER_STATUS_CHANGE, before/after JSON,
 *        plus a UserSecurityEvent of type STATUS_CHANGE.
 *
 * Body: { status: 'Active' | 'Suspended' | 'Archived', reason?: string }
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

// ─── Status type + transition matrix ────────────────────────────────────────
type UserStatus = 'Active' | 'Suspended' | 'Archived';

const ALLOWED_TRANSITIONS: Record<UserStatus, UserStatus[]> = {
  Active: ['Suspended', 'Archived'],
  Suspended: ['Active', 'Archived'],
  Archived: ['Active', 'Suspended'],
};

// ─── Zod schemas ────────────────────────────────────────────────────────────
const StatusChangeSchema = z.object({
  status: z.enum(['Active', 'Suspended', 'Archived']),
  reason: z.string().max(500).optional(),
});

// ─── Derive the user's current lifecycle status ─────────────────────────────
async function deriveUserStatus(userId: string): Promise<UserStatus> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('USER_NOT_FOUND');

  if (user.isActive) return 'Active';

  // isActive=false: check if archived (most recent STATUS_CHANGE with archived=true)
  const lastArchived = await db.userSecurityEvent.findFirst({
    where: {
      userId,
      eventType: 'STATUS_CHANGE',
    },
    orderBy: { createdAt: 'desc' },
  });
  if (lastArchived) {
    try {
      const details = JSON.parse(lastArchived.details) as { archived?: boolean };
      if (details.archived === true) return 'Archived';
    } catch {
      /* fall through to Suspended */
    }
  }
  return 'Suspended';
}

// ─── PATCH /api/admin/users/[id] ────────────────────────────────────────────
export const PATCH = withRBAC(
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

      // Prevent self-suspension / self-archive
      if (id === ctx.userId) {
        return NextResponse.json(
          {
            success: false,
            error: 'You cannot change your own lifecycle status',
            violation: 'SELF_STATUS_CHANGE_FORBIDDEN',
          },
          { status: 403 },
        );
      }

      // Parse body
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid JSON payload' },
          { status: 400 },
        );
      }

      const parsed = StatusChangeSchema.safeParse(body);
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

      const target = parsed.data.status;

      // Fetch user + derive current status
      const user = await db.user.findUnique({ where: { id } });
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 },
        );
      }

      const currentStatus = await deriveUserStatus(id);

      // Validate transition
      if (currentStatus === target) {
        return NextResponse.json(
          {
            success: false,
            error: `User is already ${currentStatus}`,
            violation: 'NO_OP',
          },
          { status: 409 },
        );
      }

      const allowed = ALLOWED_TRANSITIONS[currentStatus];
      if (!allowed.includes(target)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid status transition: ${currentStatus} → ${target}. Allowed: ${allowed.join(', ')}`,
            violation: 'INVALID_TRANSITION',
          },
          { status: 422 },
        );
      }

      // Apply the transition:
      //  - Active    → isActive=true
      //  - Suspended → isActive=false
      //  - Archived  → isActive=false + UserSecurityEvent STATUS_CHANGE archived=true
      const newIsActive = target === 'Active';
      const updatedUser = await db.user.update({
        where: { id },
        data: { isActive: newIsActive },
      });

      // Record a UserSecurityEvent for the status change
      await db.userSecurityEvent.create({
        data: {
          userId: id,
          eventType: 'STATUS_CHANGE',
          details: JSON.stringify({
            from: currentStatus,
            to: target,
            archived: target === 'Archived',
            reason: parsed.data.reason ?? null,
          }),
          performedById: ctx.userId,
          performedByRole: ctx.role,
        },
      });

      // Audit log
      await createAuditLog({
        userId: ctx.userId,
        action: 'USER_STATUS_CHANGE',
        resourceType: 'User',
        resourceId: id,
        details: `User ${user.email} status changed ${currentStatus} → ${target} by ${ctx.role} (${ctx.userId})${parsed.data.reason ? `. Reason: ${parsed.data.reason}` : ''}`,
        changes: {
          previousValue: { status: currentStatus, isActive: !newIsActive },
          newValue: { status: target, isActive: newIsActive },
          reason: parsed.data.reason ?? null,
        },
        ipAddress: ctx.ipAddress,
      });

      return NextResponse.json({
        success: true,
        data: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
          isActive: updatedUser.isActive,
          previousStatus: currentStatus,
          newStatus: target,
        },
        message: `User "${updatedUser.name}" status changed from ${currentStatus} to ${target}.`,
      });
    } catch (error) {
      console.error('[admin/users/[id] PATCH] error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update user status' },
        { status: 500 },
      );
    }
  },
  'canManageUsers',
);

// ─── GET /api/admin/users/[id] ──────────────────────────────────────────────
// Convenience: returns the user record + derived lifecycle status. Used by the
// User Lifecycle UI when a user is selected from the list.
export const GET = withRBAC(
  async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> },
  ) => {
    try {
      const params = context ? await context.params : {};
      const { id } = params;

      if (!id) {
        return NextResponse.json(
          { success: false, error: 'User id is required' },
          { status: 400 },
        );
      }

      const user = await db.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          jurisdiction: true,
          avatar: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 },
        );
      }

      const status = await deriveUserStatus(id);

      return NextResponse.json({
        success: true,
        data: { ...user, lifecycleStatus: status },
      });
    } catch (error) {
      console.error('[admin/users/[id] GET] error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch user' },
        { status: 500 },
      );
    }
  },
  'canManageUsers',
);
