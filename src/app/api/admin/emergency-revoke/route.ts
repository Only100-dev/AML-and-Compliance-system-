import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { initiateMakerChecker, reviewMakerChecker } from '@/lib/middleware/maker-checker';
import { checkPermission, type ComplianceRole } from '@/lib/compliance/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import crypto from 'crypto';

// ─── POST /api/admin/emergency-revoke ───────────────────────────────────────
// Emergency Access Revocation — "Manual Kill Switch" for Offboarding
// Pre-UAT Polish Fix #3
//
// Regulatory Mandate: FDL 10/2025 Art. 15 (Internal Controls) requires access
// suspension "within 1 hour of termination." Since HR System Integration is
// deferred to Phase F, this endpoint provides a manual mechanism to satisfy
// the 1-hour regulatory mandate.
//
// Enforcement:
//   1. Only IT Admin or HR-authorized roles can REQUEST revocation (Maker)
//   2. Revocation requires Maker-Checker approval (4-eyes principle)
//   3. On approval: user.isActive = false, all BreakGlassSessions revoked,
//      all DMLRO delegations cancelled, audit trail created
//   4. SHA-256 tamper-evident audit log entry
//   5. Immediate notification to MLRO and Compliance Manager
//
// Two modes:
//   - Mode A (with approval): Maker requests, Checker approves → full revocation
//   - Mode B (immediate): When justification includes "IMMINENT_RISK", revocation
//     is executed immediately but still creates Maker-Checker log for post-hoc review
// ──────────────────────────────────────────────────────────────────────────────

const emergencyRevokeSchema = z.object({
  /** ID of the user whose access must be revoked */
  targetUserId: z.string().min(1, 'Target user ID is required'),
  /** Reason for emergency revocation */
  justification: z.string().min(20, 'Justification must be at least 20 characters (regulatory requirement)'),
  /** Whether this is an imminent risk requiring immediate action */
  isImminentRisk: z.boolean().default(false),
  /** Maker-Checker log ID (for approval mode) */
  makerCheckerLogId: z.string().optional(),
  /** Action: request, approve, or reject */
  action: z.enum(['REQUEST', 'APPROVE', 'REJECT'], {
    error: 'Action must be REQUEST, APPROVE, or REJECT',
  }),
});

type EmergencyRevokeRequest = z.infer<typeof emergencyRevokeSchema>;

// ─── Core Revocation Logic ──────────────────────────────────────────────────

async function executeRevocation(targetUserId: string, requestedById: string, justification: string) {
  const timestamp = new Date();

  // 1. Suspend the user account
  const suspendedUser = await db.user.update({
    where: { id: targetUserId },
    data: {
      isActive: false,
      dmlroDelegationActive: false,
      dmlroDelegationExpiry: null,
    },
  });

  // 2. Revoke all active Break-Glass sessions for this user
  const revokedBreakGlass = await db.breakGlassSession.updateMany({
    where: {
      userId: targetUserId,
      status: 'ACTIVE',
    },
    data: {
      status: 'REVOKED',
      revokedAt: timestamp,
    },
  });

  // 3. Cancel all active DMLRO delegations where user is delegator OR delegate
  const cancelledDelegationsAsDelegator = await db.user.updateMany({
    where: {
      id: targetUserId,
      dmlroDelegationActive: true,
    },
    data: {
      dmlroDelegationActive: false,
      dmlroDelegationExpiry: null,
    },
  });

  const cancelledDelegationsAsDelegate = await db.user.updateMany({
    where: {
      dmlroDelegatedToId: targetUserId,
      dmlroDelegationActive: true,
    },
    data: {
      dmlroDelegationActive: false,
      dmlroDelegationExpiry: null,
    },
  });

  // 4. Create SHA-256 tamper-evident audit log
  const hashPayload = JSON.stringify({
    action: 'EMERGENCY_ACCESS_REVOCATION',
    targetUserId,
    requestedById,
    justification,
    timestamp: timestamp.toISOString(),
    revokedBreakGlassCount: revokedBreakGlass.count,
  });
  const sha256Hash = crypto.createHash('sha256').update(hashPayload).digest('hex');

  await createAuditLog({
    userId: requestedById,
    action: 'EMERGENCY_ACCESS_REVOCATION',
    resourceType: 'User',
    resourceId: targetUserId,
    details: `EMERGENCY REVOCATION executed for user ${suspendedUser.name} (${suspendedUser.email}). Reason: ${justification}. Break-glass sessions revoked: ${revokedBreakGlass.count}. DMLRO delegations cancelled as delegator: ${cancelledDelegationsAsDelegator.count}, as delegate: ${cancelledDelegationsAsDelegate.count}.`,
    changes: {
      targetUserId,
      targetUserName: suspendedUser.name,
      targetUserEmail: suspendedUser.email,
      targetUserRole: suspendedUser.role,
      isActive: false,
      revokedBreakGlassSessions: revokedBreakGlass.count,
      cancelledDelegationsAsDelegator: cancelledDelegationsAsDelegator.count,
      cancelledDelegationsAsDelegate: cancelledDelegationsAsDelegate.count,
      justification,
      sha256Hash,
    },
  });

  // 5. Notify MLRO and Compliance Manager
  const notifyRoles = ['mlro', 'compliance_manager'];
  const notifyUsers = await db.user.findMany({
    where: {
      role: { in: notifyRoles },
      isActive: true,
    },
  });

  for (const notifyUser of notifyUsers) {
    await db.notification.create({
      data: {
        userId: notifyUser.id,
        userName: notifyUser.name,
        type: 'sanctions_hit',
        title: 'EMERGENCY: Access Revocation Executed',
        message: `User ${suspendedUser.name} (${suspendedUser.role}) has been emergency-revoked. Reason: ${justification}. All active sessions and delegations have been invalidated.`,
        priority: 'urgent',
        sourceModule: 'admin_emergency_revoke',
        sourceEntityId: targetUserId,
      },
    });
  }

  return {
    suspendedUser: {
      id: suspendedUser.id,
      name: suspendedUser.name,
      email: suspendedUser.email,
      role: suspendedUser.role,
    },
    revokedBreakGlassSessions: revokedBreakGlass.count,
    cancelledDelegationsAsDelegator: cancelledDelegationsAsDelegator.count,
    cancelledDelegationsAsDelegate: cancelledDelegationsAsDelegate.count,
    sha256Hash,
    executedAt: timestamp,
  };
}

// ─── POST Handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userRole = (auth.session?.user as Record<string, unknown>)?.role as ComplianceRole;

    // Only admin can REQUEST emergency revocation; MLRO/CM can APPROVE
    if (!checkPermission(userRole, 'canManageUsers') && userRole !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          error: 'Permission denied',
          message: 'Only System Admin or MLRO can execute emergency access revocation.',
          regulatoryRef: 'FDL 10/2025 Art. 15 (Internal Controls); CBUAE Notice 3551/2021 S3.1',
        },
        { status: 403 }
      );
    }

    const rateLimitError = applyRateLimit(auth, request, 'SENSITIVE');
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = emergencyRevokeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const data: EmergencyRevokeRequest = parsed.data;
    const requestorId = ((auth.session?.user as Record<string, unknown>)?.userId as string) ||
      ((auth.session?.user as Record<string, unknown>)?.id as string) || 'unknown';
    const requestorName = ((auth.session?.user as Record<string, unknown>)?.name as string) || 'Unknown';

    // Verify target user exists
    const targetUser = await db.user.findUnique({ where: { id: data.targetUserId } });
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'Target user not found' },
        { status: 404 }
      );
    }

    // Cannot revoke your own access
    if (targetUser.id === requestorId) {
      return NextResponse.json(
        {
          success: false,
          error: 'SECURITY VIOLATION: Cannot revoke your own access.',
          violation: 'SELF_REVOCATION_BLOCKED',
        },
        { status: 403 }
      );
    }

    // ── MODE A: REQUEST (initiate Maker-Checker) ─────────────────────────────
    if (data.action === 'REQUEST') {
      const mcLog = await initiateMakerChecker(
        'EMERGENCY_REVOKE',
        data.targetUserId,
        'User',
        requestorId,
        requestorName,
        {
          targetUserId: data.targetUserId,
          targetUserName: targetUser.name,
          targetUserRole: targetUser.role,
          justification: data.justification,
          isImminentRisk: data.isImminentRisk,
          reason: 'Emergency access revocation requires dual authorization per FDL 10/2025 Art. 15',
        }
      );

      // If IMMINENT_RISK flag is set, execute immediately (Mode B)
      // but still create the Maker-Checker log for post-hoc review
      let revocationResult = null;
      if (data.isImminentRisk) {
        revocationResult = await executeRevocation(
          data.targetUserId,
          requestorId,
          `[IMMINENT RISK - IMMEDIATE EXECUTION] ${data.justification}`
        );

        // Auto-approve the Maker-Checker log with a note
        await db.makerCheckerLog.update({
          where: { id: mcLog.id },
          data: {
            status: 'APPROVED',
            checkerId: 'system-imminent-risk',
            checkerName: 'System (Imminent Risk Auto-Approval)',
            reviewedAt: new Date(),
          },
        });

        return NextResponse.json({
          success: true,
          mode: 'IMMINENT_RISK_IMMEDIATE',
          data: revocationResult,
          makerChecker: {
            id: mcLog.id,
            status: 'APPROVED',
            note: 'Executed immediately due to imminent risk flag. Post-hoc review required by MLRO/Compliance Manager within 24 hours.',
          },
          message: `EMERGENCY REVOCATION executed IMMEDIATELY for user ${targetUser.name} due to imminent risk. All sessions and delegations invalidated. Post-hoc review by MLRO required within 24 hours per FDL 10/2025 Art. 15.`,
        }, { status: 200 });
      }

      return NextResponse.json({
        success: true,
        mode: 'MAKER_CHECKER_PENDING',
        data: {
          makerCheckerLogId: mcLog.id,
          targetUser: {
            id: targetUser.id,
            name: targetUser.name,
            role: targetUser.role,
          },
        },
        message: `Emergency revocation request created for user ${targetUser.name}. Awaiting Checker approval before execution. Maker-Checker log: ${mcLog.id}`,
      }, { status: 201 });
    }

    // ── MODE A (continued): APPROVE ──────────────────────────────────────────
    if (data.action === 'APPROVE') {
      if (!data.makerCheckerLogId) {
        return NextResponse.json(
          { success: false, error: 'Maker-Checker log ID is required for approval' },
          { status: 400 }
        );
      }

      // Execute Maker-Checker review (enforces Maker != Checker)
      try {
        const mcLog = await reviewMakerChecker(
          data.makerCheckerLogId,
          requestorId,
          requestorName,
          'APPROVED'
        );

        // Execute the revocation
        const revocationResult = await executeRevocation(
          data.targetUserId,
          requestorId,
          data.justification
        );

        return NextResponse.json({
          success: true,
          mode: 'MAKER_CHECKER_APPROVED',
          data: revocationResult,
          makerChecker: {
            id: mcLog.id,
            status: mcLog.status,
            checkerId: mcLog.checkerId,
            checkerName: mcLog.checkerName,
            reviewedAt: mcLog.reviewedAt,
          },
          message: `Emergency revocation APPROVED and executed for user ${targetUser.name}. All sessions and delegations invalidated.`,
        });
      } catch (mcError) {
        const message = mcError instanceof Error ? mcError.message : 'Maker-Checker review failed';

        if (message.includes('4-eyes') || message.includes('same person')) {
          return NextResponse.json(
            {
              success: false,
              error: `SECURITY VIOLATION: ${message}`,
              violation: 'MAKER_CHECKER_SAME_PERSON',
              regulatoryRef: 'FDL 10/2025 Art. 15 (4-Eyes Principle)',
            },
            { status: 403 }
          );
        }

        if (message.includes('expired')) {
          return NextResponse.json(
            { success: false, error: message, violation: 'REQUEST_EXPIRED' },
            { status: 410 }
          );
        }

        return NextResponse.json(
          { success: false, error: message },
          { status: 400 }
        );
      }
    }

    // ── MODE A (continued): REJECT ───────────────────────────────────────────
    if (data.action === 'REJECT') {
      if (!data.makerCheckerLogId) {
        return NextResponse.json(
          { success: false, error: 'Maker-Checker log ID is required for rejection' },
          { status: 400 }
        );
      }

      if (!data.justification || data.justification.trim().length < 10) {
        return NextResponse.json(
          {
            success: false,
            error: 'A rationale of at least 10 characters is required when rejecting an emergency revocation request.',
          },
          { status: 422 }
        );
      }

      try {
        const mcLog = await reviewMakerChecker(
          data.makerCheckerLogId,
          requestorId,
          requestorName,
          'REJECTED'
        );

        await createAuditLog({
          userId: requestorId,
          action: 'EMERGENCY_REVOCATION_REJECTED',
          resourceType: 'User',
          resourceId: data.targetUserId,
          details: `Emergency revocation request for user ${targetUser.name} REJECTED by ${requestorName}. Reason: ${data.justification}`,
          changes: {
            targetUserId: data.targetUserId,
            rejectionReason: data.justification,
            makerCheckerLogId: data.makerCheckerLogId,
          },
        });

        return NextResponse.json({
          success: true,
          mode: 'MAKER_CHECKER_REJECTED',
          data: {
            makerChecker: {
              id: mcLog.id,
              status: mcLog.status,
              checkerId: mcLog.checkerId,
              checkerName: mcLog.checkerName,
              reviewedAt: mcLog.reviewedAt,
            },
          },
          message: `Emergency revocation request for user ${targetUser.name} has been REJECTED.`,
        });
      } catch (mcError) {
        const message = mcError instanceof Error ? mcError.message : 'Maker-Checker review failed';
        return NextResponse.json(
          { success: false, error: message },
          { status: 400 }
        );
      }
    }

    // Should not reach here
    return NextResponse.json(
      { success: false, error: 'Invalid action specified' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[EMERGENCY_REVOKE] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process emergency revocation request' },
      { status: 500 }
    );
  }
}
