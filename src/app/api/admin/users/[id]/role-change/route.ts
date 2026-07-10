/**
 * Master Admin v2 — Role Change with Maker-Checker (Section 10.1.3 & 10.2)
 * ------------------------------------------------------------------
 * POST /api/admin/users/[id]/role-change
 *   Body: { newRole: ComplianceRole }
 *
 * Segregation of Duties enforcement:
 *   - Promoting a user to a privileged role (admin, mlro, compliance_manager,
 *     auditor) CANNOT be done unilaterally by a single admin. The request
 *     creates a MakerCheckerLog PENDING entry for a second admin (Checker) to
 *     approve. The role is NOT applied until approval.
 *   - Non-privileged role changes (compliance_officer, dept_head, board) are
 *     applied directly with full before/after audit logging.
 *
 * RBAC: admin only (canManageUsers).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { createAuditLog } from '@/lib/audit';
import {
  COMPLIANCE_ROLES,
  ROLE_LABELS,
  ROLE_CHANGE_REQUIRES_MAKER_CHECKER,
} from '@/lib/compliance/rbac';
import type { ComplianceRole } from '@/lib/compliance/rbac';

const MAKER_CHECKER_TTL_HOURS = 72;

function isValidRole(role: string): role is ComplianceRole {
  return (COMPLIANCE_ROLES as string[]).includes(role);
}

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

  let body: { newRole?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const newRole = body.newRole;
  if (!newRole || !isValidRole(newRole)) {
    return NextResponse.json(
      {
        success: false,
        error: `Invalid role. Must be one of: ${COMPLIANCE_ROLES.join(', ')}`,
      },
      { status: 400 },
    );
  }

  try {
    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 },
      );
    }

    if (user.status === 'ARCHIVED') {
      return NextResponse.json(
        { success: false, error: 'Cannot change role for an archived user' },
        { status: 400 },
      );
    }

    if (user.role === newRole) {
      return NextResponse.json(
        { success: false, error: `User already has role '${ROLE_LABELS[newRole]}'` },
        { status: 400 },
      );
    }

    const previousRole = user.role as ComplianceRole;

    // ── Maker-Checker gate: privileged role promotions require dual approval ──
    if (ROLE_CHANGE_REQUIRES_MAKER_CHECKER.includes(newRole)) {
      // 4-Eyes enforcement: the Maker (this admin) cannot be the Checker.
      // Check for an existing pending request to avoid duplicates.
      const existing = await db.makerCheckerLog.findFirst({
        where: {
          entityType: 'User',
          entityId: user.id,
          status: 'PENDING',
          operationType: 'ADMIN_ROLE_CHANGE',
        },
      });

      if (existing) {
        return NextResponse.json({
          success: true,
          data: {
            makerCheckerRequestId: existing.id,
            status: 'PENDING',
            requiresApproval: true,
            message: `A role-change request (${ROLE_LABELS[previousRole]} → ${ROLE_LABELS[newRole]}) is already pending Checker approval. The role has NOT been applied yet.`,
          },
        });
      }

      const expiryTime = new Date(
        Date.now() + MAKER_CHECKER_TTL_HOURS * 60 * 60 * 1000,
      );

      const mcLog = await db.makerCheckerLog.create({
        data: {
          operationType: 'ADMIN_ROLE_CHANGE',
          entityId: user.id,
          entityType: 'User',
          makerId: adminId,
          makerName: adminName,
          status: 'PENDING',
          expiryTime,
          payloadSnapshot: JSON.stringify({
            userId: user.id,
            userEmail: user.email,
            userName: user.name,
            previousRole,
            requestedRole: newRole,
            previousRoleLabel: ROLE_LABELS[previousRole],
            requestedRoleLabel: ROLE_LABELS[newRole],
            reason: `Privileged role promotion to ${ROLE_LABELS[newRole]} requires 4-eyes approval per Section 10.1.3.`,
          }),
        },
      });

      // Audit the Maker-Checker request initiation.
      await createAuditLog({
        userId: adminId,
        action: 'ADMIN_ROLE_CHANGE_REQUESTED',
        resourceType: 'User',
        resourceId: user.id,
        details: `Maker ${adminName} requested role change for ${user.email}: ${ROLE_LABELS[previousRole]} → ${ROLE_LABELS[newRole]}. PENDING Checker approval (MakerCheckerLog ${mcLog.id}). Role NOT yet applied.`,
        previousValue: JSON.stringify({ role: previousRole }),
        newValue: JSON.stringify({
          requestedRole: newRole,
          makerCheckerRequestId: mcLog.id,
          status: 'PENDING',
          expiresAt: expiryTime.toISOString(),
        }),
      });

      return NextResponse.json({
        success: true,
        data: {
          makerCheckerRequestId: mcLog.id,
          status: 'PENDING',
          requiresApproval: true,
          previousRole,
          requestedRole: newRole,
          previousRoleLabel: ROLE_LABELS[previousRole],
          requestedRoleLabel: ROLE_LABELS[newRole],
          expiresAt: expiryTime.toISOString(),
          message: `Role change to '${ROLE_LABELS[newRole]}' requires Maker-Checker (4-Eyes) approval per Section 10.1.3. A pending approval request was created (ID: ${mcLog.id}). A second admin must approve before the role is applied. The user's role remains '${ROLE_LABELS[previousRole]}'.`,
        },
      });
    }

    // ── Non-privileged role change: apply directly with before/after audit ──
    await db.user.update({
      where: { id: user.id },
      data: { role: newRole },
    });

    await createAuditLog({
      userId: adminId,
      action: 'ADMIN_ROLE_CHANGE_APPLIED',
      resourceType: 'User',
      resourceId: user.id,
      details: `Admin ${adminName} changed role for ${user.email}: ${ROLE_LABELS[previousRole]} → ${ROLE_LABELS[newRole]}. Applied directly (non-privileged role; no Maker-Checker required).`,
      previousValue: JSON.stringify({ role: previousRole }),
      newValue: JSON.stringify({ role: newRole, appliedBy: adminId }),
    });

    return NextResponse.json({
      success: true,
      data: {
        requiresApproval: false,
        previousRole,
        newRole,
        previousRoleLabel: ROLE_LABELS[previousRole],
        newRoleLabel: ROLE_LABELS[newRole],
        message: `Role changed from '${ROLE_LABELS[previousRole]}' to '${ROLE_LABELS[newRole]}' (applied directly — non-privileged role).`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[ADMIN_ROLE_CHANGE] Failed:', message);
    return NextResponse.json(
      { success: false, error: 'Failed to process role change' },
      { status: 500 },
    );
  }
}
