import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { checkPermission, type ComplianceRole } from '@/lib/compliance/rbac';

// ─── SHA-256 Helper ─────────────────────────────────────────────────────────

function computeSHA256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const activateDelegationSchema = z.object({
  mlroUserId: z.string().min(1, 'MLRO user ID is required'),
  deputyUserId: z.string().min(1, 'Deputy user ID is required'),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
  expiryDays: z.number().int().min(1).max(30, 'Expiry days must be between 1 and 30'),
});

// ─── GET: Get Current Delegation Status ──────────────────────────────────────
// FDL 10/2025 Art. 13-14 — DMLRO Delegation Status

export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId query parameter is required' },
        { status: 400 }
      );
    }

    // Auto-expire delegations past expiry
    const now = new Date();
    const expiredUsers = await db.user.findMany({
      where: {
        dmlroDelegationActive: true,
        dmlroDelegationExpiry: { lt: now },
      },
    });

    for (const user of expiredUsers) {
      await db.user.update({
        where: { id: user.id },
        data: {
          dmlroDelegationActive: false,
          dmlroDelegatedToId: null,
          dmlroDelegatedToName: null,
          dmlroDelegationExpiry: null,
          dmlroDelegationReason: null,
        },
      });
    }

    // Find user's delegation state
    const user = await db.user.findUnique({ where: { id: userId } });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Get DMLRODelegationLog history
    const delegationHistory = await db.dMLRODelegationLog.findMany({
      where: {
        OR: [
          { mlroUserId: userId },
          { deputyUserId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      data: {
        delegation: {
          active: user.dmlroDelegationActive,
          delegatedToId: user.dmlroDelegatedToId,
          delegatedToName: user.dmlroDelegatedToName,
          expiry: user.dmlroDelegationExpiry,
          reason: user.dmlroDelegationReason,
        },
        history: delegationHistory,
      },
      regulatoryRef: 'FDL 10/2025 Art. 13-14',
    });
  } catch (error) {
    console.error('[DMLRO_GET] Error getting delegation status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get delegation status' },
      { status: 500 }
    );
  }
}

// ─── POST: Activate Delegation ──────────────────────────────────────────────
// FDL 10/2025 Art. 13-14 — Only MLRO can activate

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json(
        {
          success: false,
          error: 'Only MLRO or admin can activate DMLRO delegation',
          regulatoryRef: 'FDL 10/2025 Art. 13-14; CBUAE Notice 3551/2021 S3.1',
        },
        { status: 403 }
      );
    }

    // RBAC check
    const userRole = (auth.session?.user as Record<string, unknown>)?.role as string;
    if (!checkPermission(userRole as ComplianceRole, 'canDelegateAsDMLRO')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Permission denied: canDelegateAsDMLRO',
          regulatoryRef: 'FDL 10/2025 Art. 13-14; CBUAE Notice 3551/2021 S3.1',
        },
        { status: 403 }
      );
    }

    const rateLimitError = applyRateLimit(auth, request, 'SENSITIVE');
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = activateDelegationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
          regulatoryRef: 'FDL 10/2025 Art. 13-14',
        },
        { status: 400 }
      );
    }

    const { mlroUserId, deputyUserId, reason, expiryDays } = parsed.data;

    // Validate: MLRO can't delegate to self
    if (mlroUserId === deputyUserId) {
      return NextResponse.json(
        {
          success: false,
          error: 'MLRO cannot delegate to self',
          regulatoryRef: 'FDL 10/2025 Art. 13-14 — SoD principle',
        },
        { status: 400 }
      );
    }

    // Validate: mlroUserId matches authenticated user
    const authUserId = (auth.session?.user as Record<string, unknown>)?.userId as string
      || (auth.session?.user as Record<string, unknown>)?.id as string;
    if (authUserId && authUserId !== mlroUserId && userRole !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          error: 'mlroUserId must match the authenticated user',
          regulatoryRef: 'FDL 10/2025 Art. 13-14',
        },
        { status: 403 }
      );
    }

    // Validate: deputy must be compliance_manager (canActAsDMLRO)
    const deputy = await db.user.findUnique({ where: { id: deputyUserId } });
    if (!deputy) {
      return NextResponse.json(
        { success: false, error: 'Deputy user not found' },
        { status: 404 }
      );
    }

    if (!checkPermission(deputy.role as ComplianceRole, 'canActAsDMLRO')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Deputy must have canActAsDMLRO permission (compliance_manager role required)',
          regulatoryRef: 'FDL 10/2025 Art. 13-14',
        },
        { status: 400 }
      );
    }

    // Validate: no existing active delegation
    const mlro = await db.user.findUnique({ where: { id: mlroUserId } });
    if (!mlro) {
      return NextResponse.json(
        { success: false, error: 'MLRO user not found' },
        { status: 404 }
      );
    }

    if (mlro.dmlroDelegationActive) {
      return NextResponse.json(
        {
          success: false,
          error: 'MLRO already has an active delegation. Deactivate first.',
          regulatoryRef: 'FDL 10/2025 Art. 13-14 — Only one active delegation at a time',
        },
        { status: 409 }
      );
    }

    const now = new Date();
    const expiryDate = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

    // Update User delegation fields
    await db.user.update({
      where: { id: mlroUserId },
      data: {
        dmlroDelegatedToId: deputyUserId,
        dmlroDelegatedToName: deputy.name,
        dmlroDelegationActive: true,
        dmlroDelegationExpiry: expiryDate,
        dmlroDelegationReason: reason,
      },
    });

    // Create DMLRODelegationLog (WORM) with SHA-256
    const delegationLogPayload = JSON.stringify({
      action: 'ACTIVATED',
      mlroUserId,
      mlroName: mlro.name,
      deputyUserId,
      deputyName: deputy.name,
      reason,
      expiryDays,
      expiryDate: expiryDate.toISOString(),
      timestamp: now.toISOString(),
    });
    const delegationSha256 = computeSHA256(delegationLogPayload);

    await db.dMLRODelegationLog.create({
      data: {
        mlroUserId,
        mlroName: mlro.name,
        deputyUserId,
        deputyName: deputy.name,
        action: 'ACTIVATED',
        reason,
        activatedAt: now,
        expiryDate,
        sha256Hash: delegationSha256,
      },
    });

    // Create AuditLog with SHA-256
    const auditPayload = JSON.stringify({
      action: 'DMLRO_DELEGATION_ACTIVATED',
      mlroUserId,
      deputyUserId,
      reason,
      expiryDays,
      timestamp: now.toISOString(),
    });
    const auditSha256 = computeSHA256(auditPayload);

    await db.auditLog.create({
      data: {
        userId: mlroUserId,
        action: 'DMLRO_DELEGATION_ACTIVATED',
        resource: 'DMLRODelegation',
        resourceId: deputyUserId,
        details: `DMLRO delegation activated: MLRO ${mlro.name} delegated to ${deputy.name} for ${expiryDays} days. Reason: ${reason}`,
        sha256Hash: auditSha256,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      },
    });

    // Create Notification for deputy
    await db.notification.create({
      data: {
        userId: deputyUserId,
        userName: deputy.name,
        type: 'maker_checker_pending',
        title: 'DMLRO Delegation Activated',
        message: `You have been delegated as DMLRO by ${mlro.name}. This delegation expires on ${expiryDate.toISOString().split('T')[0]}.`,
        priority: 'high',
        sourceModule: 'dmlro',
        sourceEntityId: mlroUserId,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        mlroUserId,
        deputyUserId,
        deputyName: deputy.name,
        expiryDate,
        reason,
        activatedAt: now,
      },
      regulatoryRef: 'FDL 10/2025 Art. 13-14',
    }, { status: 201 });
  } catch (error) {
    console.error('[DMLRO_POST] Error activating delegation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to activate DMLRO delegation' },
      { status: 500 }
    );
  }
}

// ─── DELETE: Deactivate Delegation ──────────────────────────────────────────
// FDL 10/2025 Art. 13-14 — Only MLRO can deactivate

export async function DELETE(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json(
        {
          success: false,
          error: 'Only MLRO or admin can deactivate DMLRO delegation',
          regulatoryRef: 'FDL 10/2025 Art. 13-14; CBUAE Notice 3551/2021 S3.1',
        },
        { status: 403 }
      );
    }

    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;

    const { searchParams } = new URL(request.url);
    const mlroUserId = searchParams.get('mlroUserId');

    if (!mlroUserId) {
      return NextResponse.json(
        { success: false, error: 'mlroUserId query parameter is required' },
        { status: 400 }
      );
    }

    // Find MLRO user
    const mlro = await db.user.findUnique({ where: { id: mlroUserId } });
    if (!mlro) {
      return NextResponse.json(
        { success: false, error: 'MLRO user not found' },
        { status: 404 }
      );
    }

    if (!mlro.dmlroDelegationActive) {
      return NextResponse.json(
        { success: false, error: 'No active delegation to deactivate' },
        { status: 400 }
      );
    }

    const deputyId = mlro.dmlroDelegatedToId;
    const deputyName = mlro.dmlroDelegatedToName;

    // Clear User delegation fields
    await db.user.update({
      where: { id: mlroUserId },
      data: {
        dmlroDelegatedToId: null,
        dmlroDelegatedToName: null,
        dmlroDelegationActive: false,
        dmlroDelegationExpiry: null,
        dmlroDelegationReason: null,
      },
    });

    const now = new Date();

    // Create DMLRODelegationLog (WORM) with SHA-256
    const delegationLogPayload = JSON.stringify({
      action: 'DEACTIVATED',
      mlroUserId,
      mlroName: mlro.name,
      deputyUserId: deputyId,
      deputyName,
      timestamp: now.toISOString(),
    });
    const delegationSha256 = computeSHA256(delegationLogPayload);

    await db.dMLRODelegationLog.create({
      data: {
        mlroUserId,
        mlroName: mlro.name,
        deputyUserId: deputyId ?? '',
        deputyName: deputyName ?? '',
        action: 'DEACTIVATED',
        reason: 'Deactivated by MLRO',
        deactivatedAt: now,
        sha256Hash: delegationSha256,
      },
    });

    // Create AuditLog with SHA-256
    const auditPayload = JSON.stringify({
      action: 'DMLRO_DELEGATION_DEACTIVATED',
      mlroUserId,
      deputyUserId: deputyId,
      timestamp: now.toISOString(),
    });
    const auditSha256 = computeSHA256(auditPayload);

    await db.auditLog.create({
      data: {
        userId: mlroUserId,
        action: 'DMLRO_DELEGATION_DEACTIVATED',
        resource: 'DMLRODelegation',
        resourceId: deputyId ?? '',
        details: `DMLRO delegation deactivated by MLRO ${mlro.name}. Deputy was: ${deputyName}`,
        sha256Hash: auditSha256,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      },
    });

    // Create Notification for deputy
    if (deputyId) {
      await db.notification.create({
        data: {
          userId: deputyId,
          userName: deputyName ?? '',
          type: 'regulatory_update',
          title: 'DMLRO Delegation Deactivated',
          message: `Your DMLRO delegation from ${mlro.name} has been deactivated.`,
          priority: 'normal',
          sourceModule: 'dmlro',
          sourceEntityId: mlroUserId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        mlroUserId,
        deactivatedAt: now,
      },
      regulatoryRef: 'FDL 10/2025 Art. 13-14',
    });
  } catch (error) {
    console.error('[DMLRO_DELETE] Error deactivating delegation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to deactivate DMLRO delegation' },
      { status: 500 }
    );
  }
}
