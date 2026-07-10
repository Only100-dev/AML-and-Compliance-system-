/**
 * Master Admin v2 — User Lifecycle Status Management (Section 10.1.5)
 * ------------------------------------------------------------------
 * POST /api/admin/users/[id]/status
 *   Body: { status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | 'ARCHIVED' }
 *
 * Implements the full user lifecycle. Each transition is audited with
 * before/after state. Suspending/Deactivating/Archiving also revokes all
 * active sessions (immediate offboarding per Section 10.1.5).
 *
 * RBAC: admin only (canManageUsers).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { createAuditLog } from '@/lib/audit';

const VALID_STATUSES = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'ARCHIVED'] as const;
type UserStatus = (typeof VALID_STATUSES)[number];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authGuard({ allowedRoles: ['admin'] });
  if (!auth.authorized) return auth.error;

  const sessionUser = auth.session?.user as Record<string, unknown> | undefined;
  const adminId = (sessionUser?.userId as string) || 'dev-user';
  const adminName = (sessionUser?.name as string) || 'Dev User';

  const rateLimitError = applyRateLimit(auth, request, 'WRITE');
  if (rateLimitError) return rateLimitError;

  const { id } = await params;

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const newStatus = body.status;
  if (!newStatus || !VALID_STATUSES.includes(newStatus as UserStatus)) {
    return NextResponse.json(
      {
        success: false,
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      },
      { status: 400 },
    );
  }

  try {
    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, status: true, role: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 },
      );
    }

    const previousStatus = user.status;

    // Compute the timestamp fields to set based on the new status.
    const now = new Date();
    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'ACTIVE') {
      updateData.isActive = true;
      updateData.suspendedAt = null;
      updateData.deactivatedAt = null;
      updateData.failedLoginAttempts = 0;
    } else if (newStatus === 'SUSPENDED') {
      updateData.isActive = false;
      updateData.suspendedAt = now;
    } else if (newStatus === 'DEACTIVATED') {
      updateData.isActive = false;
      updateData.deactivatedAt = now;
    } else if (newStatus === 'ARCHIVED') {
      updateData.isActive = false;
      updateData.archivedAt = now;
    }

    await db.user.update({
      where: { id: user.id },
      data: updateData,
    });

    // Offboarding: revoke all active sessions when suspending/deactivating/archiving.
    let revokedSessions = 0;
    if (newStatus !== 'ACTIVE') {
      const result = await db.userSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      });
      revokedSessions = result.count;
    }

    await createAuditLog({
      userId: adminId,
      action: 'ADMIN_USER_STATUS_CHANGE',
      resourceType: 'User',
      resourceId: user.id,
      details: `Admin ${adminName} changed status for ${user.email} (${user.name}): ${previousStatus} → ${newStatus}.${revokedSessions > 0 ? ` Revoked ${revokedSessions} active session(s).` : ''}`,
      previousValue: JSON.stringify({ status: previousStatus }),
      newValue: JSON.stringify({
        status: newStatus,
        changedBy: adminId,
        revokedSessions,
      }),
    });

    return NextResponse.json({
      success: true,
      data: {
        previousStatus,
        newStatus,
        revokedSessions,
        message: `User status changed from '${previousStatus}' to '${newStatus}'.${revokedSessions > 0 ? ` ${revokedSessions} session(s) revoked.` : ''}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[ADMIN_USER_STATUS] Failed:', message);
    return NextResponse.json(
      { success: false, error: 'Failed to update user status' },
      { status: 500 },
    );
  }
}
