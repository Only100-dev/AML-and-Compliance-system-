import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { checkPermission, type ComplianceRole } from '@/lib/compliance/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import crypto from 'crypto';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const approveBrokerKYCSchema = z.object({
  brokerId: z.string().min(1, 'Broker ID is required'),
  action: z.enum(['APPROVED', 'REJECTED'], {
    error: 'Action must be APPROVED or REJECTED',
  }),
  reviewNotes: z.string().min(1, 'Review notes are required'),
});

// ─── POST /api/broker-kyc/approve ───────────────────────────────────────────
// Approve/reject broker KYC (Maker-Checker)
// Auth: canApproveBrokerKYC (compliance_manager/mlro/admin)
// Maker-Checker: approver cannot be same as creator

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard();
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (auth.session?.user as Record<string, unknown>)?.role as ComplianceRole;
    if (!checkPermission(userRole, 'canApproveBrokerKYC')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Permission denied',
          message: `Role "${userRole}" does not have permission "canApproveBrokerKYC". Only compliance_manager, mlro, or admin can approve broker KYC.`,
          regulatoryRef: 'CBUAE Insurance Board Resolution No. 4/2022; FDL 10/2025 Art. 7, 9, 15',
        },
        { status: 403 }
      );
    }

    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = approveBrokerKYCSchema.safeParse(body);
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

    const data = parsed.data;
    const userId = ((auth.session?.user as Record<string, unknown>)?.userId as string) ||
      ((auth.session?.user as Record<string, unknown>)?.id as string) || 'unknown';

    // Fetch the broker record
    const broker = await db.brokerKYC.findUnique({
      where: { id: data.brokerId },
    });

    if (!broker) {
      return NextResponse.json(
        { success: false, error: 'Broker KYC record not found' },
        { status: 404 }
      );
    }

    // Verify the broker is in PENDING status
    if (broker.status !== 'PENDING' && broker.status !== 'UNDER_REVIEW') {
      return NextResponse.json(
        {
          success: false,
          error: `Broker KYC is in "${broker.status}" status. Only PENDING or UNDER_REVIEW records can be reviewed.`,
        },
        { status: 409 }
      );
    }

    // Maker-Checker: approver cannot be same as creator (check approvedById which is the creator in this context)
    // Since BrokerKYC doesn't have a createdBy field, we check approvedById (first approver = creator pattern)
    // Instead, we use the sha256Hash metadata to verify. For simplicity, we check if the current approver
    // is trying to approve their own creation — we track this via the audit log.
    const existingApproval = await db.auditLog.findFirst({
      where: {
        resource: 'BrokerKYC',
        resourceId: data.brokerId,
        action: 'BROKER_KYC_CREATED',
      },
    });

    if (existingApproval && existingApproval.userId === userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'SECURITY VIOLATION: 4-eyes principle — approver cannot be the same person who created the broker KYC record.',
          violation: 'MAKER_CHECKER_SAME_PERSON',
          regulatoryRef: 'CBUAE Insurance Board Resolution No. 4/2022; FDL 10/2025 Art. 15',
        },
        { status: 403 }
      );
    }

    // Update the broker record
    const updatedBroker = await db.brokerKYC.update({
      where: { id: data.brokerId },
      data: {
        status: data.action,
        approvedById: userId,
        approvalDate: new Date(),
        reviewNotes: data.reviewNotes,
      },
    });

    // SHA-256 Audit Trail
    const hashPayload = JSON.stringify({
      action: `BROKER_KYC_${data.action}`,
      resourceType: 'BrokerKYC',
      resourceId: data.brokerId,
      userId,
      timestamp: new Date().toISOString(),
    });
    const sha256Hash = crypto.createHash('sha256').update(hashPayload).digest('hex');

    await createAuditLog({
      userId,
      action: `BROKER_KYC_${data.action}`,
      resourceType: 'BrokerKYC',
      resourceId: data.brokerId,
      details: `Broker KYC for "${broker.brokerName}" ${data.action.toLowerCase()}. Notes: ${data.reviewNotes}`,
      changes: {
        status: data.action,
        approvedById: userId,
        reviewNotes: data.reviewNotes,
        sha256Hash,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedBroker,
      message: `Broker KYC ${data.action.toLowerCase()} successfully.`,
    });
  } catch (error) {
    console.error('Failed to approve/reject broker KYC:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve/reject broker KYC' },
      { status: 500 }
    );
  }
}
