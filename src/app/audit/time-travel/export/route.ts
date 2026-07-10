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

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const requestExportSchema = z.object({
  viewLogId: z.string().min(1, 'View log ID is required'),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
  format: z.enum(['pdf', 'csv', 'json']),
});

// ─── POST: Request Data Export from Time-Travel (Requires MLRO Approval) ────
// FDL 10/2025 Art. 11, 15 — Maker-Checker for data exports

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // RBAC check
    const userRole = (auth.session?.user as Record<string, unknown>)?.role as string;
    if (!checkPermission(userRole as ComplianceRole, 'canRequestDataExportFromTimeTravel')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Permission denied: canRequestDataExportFromTimeTravel',
          regulatoryRef: 'FDL 10/2025 Art. 11, 15; CR 134/2025 Art. 16, 21',
        },
        { status: 403 }
      );
    }

    const rateLimitError = applyRateLimit(auth, request, 'SENSITIVE');
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = requestExportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
          regulatoryRef: 'FDL 10/2025 Art. 11, 15',
        },
        { status: 400 }
      );
    }

    const { viewLogId, reason, format } = parsed.data;

    // Verify view log exists
    const viewLog = await db.auditorTimeTravelView.findUnique({
      where: { id: viewLogId },
    });

    if (!viewLog) {
      return NextResponse.json(
        { success: false, error: 'View log not found' },
        { status: 404 }
      );
    }

    // Verify hash chain was valid
    if (!viewLog.hashChainValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot export data from a view with invalid hash chain integrity',
          regulatoryRef: 'FDL 10/2025 Art. 11, 15 — Data integrity must be verified before export',
        },
        { status: 400 }
      );
    }

    const authUserId = (auth.session?.user as Record<string, unknown>)?.userId as string
      || (auth.session?.user as Record<string, unknown>)?.id as string
      || 'system';
    const authUserName = (auth.session?.user as Record<string, unknown>)?.name as string ?? 'Unknown';

    // Create MakerCheckerLog for MLRO approval
    const now = new Date();
    const expiryTime = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours

    const makerCheckerLog = await db.makerCheckerLog.create({
      data: {
        operationType: 'AUDIT_TIME_TRAVEL_EXPORT',
        entityId: viewLogId,
        entityType: 'AuditorTimeTravelView',
        makerId: authUserId,
        makerName: authUserName,
        status: 'PENDING',
        expiryTime,
        payloadSnapshot: JSON.stringify({
          viewLogId,
          reason,
          format,
          targetDate: viewLog.targetDate,
          resource: viewLog.resource,
        }),
      },
    });

    // Update view log export requested
    await db.auditorTimeTravelView.update({
      where: { id: viewLogId },
      data: {
        exportRequested: true,
        exportApprovalId: makerCheckerLog.id,
      },
    });

    // Create AuditLog with SHA-256
    const auditPayload = JSON.stringify({
      action: 'AUDIT_TIME_TRAVEL_EXPORT_REQUESTED',
      viewLogId,
      makerCheckerLogId: makerCheckerLog.id,
      requestedBy: authUserId,
      format,
      reason,
      timestamp: now.toISOString(),
    });
    const sha256Hash = computeSHA256(auditPayload);

    await db.auditLog.create({
      data: {
        userId: authUserId,
        action: 'AUDIT_TIME_TRAVEL_EXPORT_REQUESTED',
        resource: 'AuditorTimeTravelView',
        resourceId: viewLogId,
        details: `Data export requested for time-travel view. Format: ${format}. Reason: ${reason}. Pending MLRO approval.`,
        sha256Hash,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      },
    });

    // Create Notification for MLRO
    const mlroUsers = await db.user.findMany({
      where: { role: 'mlro', isActive: true },
      take: 5,
    });

    for (const mlro of mlroUsers) {
      await db.notification.create({
        data: {
          userId: mlro.id,
          userName: mlro.name,
          type: 'maker_checker_pending',
          title: 'Audit Time-Travel Export Approval Required',
          message: `An audit time-travel data export has been requested by ${authUserName}. Format: ${format}. Approval required within 48 hours.`,
          priority: 'high',
          sourceModule: 'audit',
          sourceEntityId: makerCheckerLog.id,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          makerCheckerLogId: makerCheckerLog.id,
          viewLogId,
          format,
          status: 'PENDING_APPROVAL',
          expiryTime,
        },
        message: 'Export request submitted. Pending MLRO approval.',
        regulatoryRef: 'FDL 10/2025 Art. 11, 15; CR 134/2025 Art. 16, 21',
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('[AUDIT_EXPORT_POST] Error requesting time-travel export:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to request time-travel data export' },
      { status: 500 }
    );
  }
}

// ─── Block PUT/DELETE for Auditor Role ──────────────────────────────────────

export async function PUT() {
  return NextResponse.json(
    {
      success: false,
      error: 'Auditor role is read-only. PUT/DELETE operations are prohibited.',
      regulatoryRef: 'FDL 10/2025 Art. 11, 15 — Auditors have read-only access',
    },
    { status: 403 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      success: false,
      error: 'Auditor role is read-only. PUT/DELETE operations are prohibited.',
      regulatoryRef: 'FDL 10/2025 Art. 11, 15 — Auditors have read-only access',
    },
    { status: 403 }
  );
}
