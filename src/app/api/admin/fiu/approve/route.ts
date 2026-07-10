/**
 * MLRO Approval (Maker-Checker) — 4-Eyes Workflow Enforcement
 *
 * Enforces the filing status state machine:
 *   DRAFT → PENDING_REVIEW → APPROVED → SUBMITTED_TO_FIU
 *
 * Actions:
 *   - submit_for_review: DRAFT → PENDING_REVIEW (compliance_officer/manager/admin)
 *   - approve: PENDING_REVIEW → APPROVED (mlro/admin ONLY — PRINCIPLE F)
 *   - reject: PENDING_REVIEW → DRAFT (mlro/compliance_manager/admin)
 *
 * The 4-Eyes principle requires that the maker (who submitted for review)
 * and the checker (who approves) are different people.
 *
 * PRINCIPLE A: Filing accuracy is criminal liability.
 * PRINCIPLE F: Maker-Checker enforcement (4-Eyes workflow).
 * PRINCIPLE D: Audit every state transition.
 *
 * Phase 4 (Action 4.1): Generic FIU approval workflow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const approveRequestSchema = z.object({
  filingId: z.string().min(1, 'Filing ID is required'),
  action: z.enum(['submit_for_review', 'approve', 'reject'], {
    error: 'Action must be one of: submit_for_review, approve, reject',
  }),
  notes: z.string().optional(),
});

// ─── Role matrix per action ──────────────────────────────────────────────────

const ACTION_ROLES: Record<string, string[]> = {
  submit_for_review: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'],
  approve: ['admin', 'mlro'], // PRINCIPLE F: ONLY MLRO can approve
  reject: ['admin', 'mlro', 'compliance_manager'],
};

// ─── POST /api/fiu/approve ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── 1. Parse & validate body first to determine required roles ───────────
    const body = await request.json();
    const parsed = approveRequestSchema.safeParse(body);

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
        { status: 400 },
      );
    }

    const { filingId, action, notes } = parsed.data;

    // ── 2. Authenticate with action-specific roles ───────────────────────────
    const allowedRoles = ACTION_ROLES[action];
    const auth = await authGuard({ allowedRoles });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json(
        {
          success: false,
          error: `Insufficient permissions for action "${action}". Required roles: ${allowedRoles.join(', ')}`,
          requiredRoles: allowedRoles,
        },
        { status: 403 },
      );
    }
    const rateLimitError = applyRateLimit(auth, request, 'SENSITIVE');
    if (rateLimitError) return rateLimitError;

    // ── 3. Resolve user identity ─────────────────────────────────────────────
    const sessionUser = auth.session?.user as Record<string, unknown> | undefined;
    const userId = (sessionUser?.id as string) || (sessionUser?.userId as string) || 'system';
    const userName = (sessionUser?.name as string) || 'System';

    // ── 4. Fetch the filing ──────────────────────────────────────────────────
    const filing = await db.goAMLFiling.findUnique({ where: { id: filingId } });

    if (!filing) {
      return NextResponse.json(
        { success: false, error: 'FIU filing not found' },
        { status: 404 },
      );
    }

    // ── 5. Execute the action ────────────────────────────────────────────────
    switch (action) {
      case 'submit_for_review':
        return await handleSubmitForReview(filing, userId, userName, notes, request);
      case 'approve':
        return await handleApprove(filing, userId, userName, notes, request);
      case 'reject':
        return await handleReject(filing, userId, userName, notes, request);
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error('[FIU_APPROVE] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process FIU approval action' },
      { status: 500 },
    );
  }
}

// ─── Action: submit_for_review (DRAFT → PENDING_REVIEW) ──────────────────────

async function handleSubmitForReview(
  filing: Record<string, unknown>,
  userId: string,
  userName: string,
  notes: string | undefined,
  request: NextRequest,
) {
  const filingStatus = filing.filingStatus as string;

  // Only DRAFT filings can be submitted for review
  if (filingStatus !== 'DRAFT') {
    return NextResponse.json(
      {
        success: false,
        error: `Filing is in "${filingStatus}" status. Only DRAFT filings can be submitted for review.`,
        currentStatus: filingStatus,
        requiredStatus: 'DRAFT',
      },
      { status: 409 },
    );
  }

  // Update filing status
  const updatedFiling = await db.goAMLFiling.update({
    where: { id: filing.id as string },
    data: { filingStatus: 'PENDING_REVIEW' },
  });

  // Create MakerCheckerLog entry
  const mcLog = await db.makerCheckerLog.create({
    data: {
      operationType: 'GOAML_SUBMIT',
      entityId: filing.id as string,
      entityType: 'GoAMLFiling',
      makerId: userId,
      makerName: userName,
      status: 'PENDING',
      expiryTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours for critical ops
      payloadSnapshot: JSON.stringify({
        action: 'submit_for_review',
        filingId: filing.id,
        referenceNumber: filing.referenceNumber,
        jurisdiction: filing.jurisdiction,
        notes,
        reason: 'FIU filing submitted for MLRO review (4-Eyes workflow)',
      }),
      jurisdiction: (filing.jurisdiction as string) || 'AE',
    },
  });

  // Audit log
  await createAuditLog({
    userId,
    action: 'FIU_FILING_SUBMITTED_FOR_REVIEW',
    resourceType: 'GoAMLFiling',
    resourceId: filing.id as string,
    details: JSON.stringify({
      jurisdiction: filing.jurisdiction,
      referenceNumber: filing.referenceNumber,
      previousStatus: 'DRAFT',
      newStatus: 'PENDING_REVIEW',
      makerCheckerLogId: mcLog.id,
      notes,
    }),
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  });

  return NextResponse.json({
    success: true,
    data: {
      filing: updatedFiling,
      makerChecker: {
        id: mcLog.id,
        status: mcLog.status,
        expiryTime: mcLog.expiryTime,
      },
    },
    message: 'FIU filing submitted for MLRO review. Awaiting approval (4-Eyes principle).',
  });
}

// ─── Action: approve (PENDING_REVIEW → APPROVED) ─────────────────────────────

async function handleApprove(
  filing: Record<string, unknown>,
  userId: string,
  userName: string,
  notes: string | undefined,
  request: NextRequest,
) {
  const filingStatus = filing.filingStatus as string;

  // Only PENDING_REVIEW filings can be approved
  if (filingStatus !== 'PENDING_REVIEW') {
    return NextResponse.json(
      {
        success: false,
        error: `Filing is in "${filingStatus}" status. Only PENDING_REVIEW filings can be approved.`,
        currentStatus: filingStatus,
        requiredStatus: 'PENDING_REVIEW',
      },
      { status: 409 },
    );
  }

  // ── 4-Eyes enforcement: verify maker ≠ checker ─────────────────────────────
  const pendingMCLog = await db.makerCheckerLog.findFirst({
    where: {
      entityId: filing.id as string,
      entityType: 'GoAMLFiling',
      status: 'PENDING',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (pendingMCLog && pendingMCLog.makerId === userId) {
    return NextResponse.json(
      {
        success: false,
        error: 'SECURITY VIOLATION: Maker and Checker cannot be the same person (4-Eyes principle).',
        violation: 'MAKER_CHECKER_SAME_PERSON',
      },
      { status: 403 },
    );
  }

  // Update filing status
  const updatedFiling = await db.goAMLFiling.update({
    where: { id: filing.id as string },
    data: { filingStatus: 'APPROVED' },
  });

  // Update the MakerCheckerLog
  if (pendingMCLog) {
    await db.makerCheckerLog.update({
      where: { id: pendingMCLog.id },
      data: {
        status: 'APPROVED',
        checkerId: userId,
        checkerName: userName,
        reviewedAt: new Date(),
      },
    });
  }

  // Audit log
  await createAuditLog({
    userId,
    action: 'FIU_FILING_APPROVED',
    resourceType: 'GoAMLFiling',
    resourceId: filing.id as string,
    details: JSON.stringify({
      jurisdiction: filing.jurisdiction,
      referenceNumber: filing.referenceNumber,
      previousStatus: 'PENDING_REVIEW',
      newStatus: 'APPROVED',
      approvedBy: userName,
      makerCheckerLogId: pendingMCLog?.id,
      makerId: pendingMCLog?.makerId,
      checkerId: userId,
      fourEyesVerified: true,
      notes,
    }),
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  });

  return NextResponse.json({
    success: true,
    data: {
      filing: updatedFiling,
      makerChecker: pendingMCLog ? {
        id: pendingMCLog.id,
        status: 'APPROVED',
        makerId: pendingMCLog.makerId,
        makerName: pendingMCLog.makerName,
        checkerId: userId,
        checkerName: userName,
      } : null,
    },
    message: 'FIU filing APPROVED by MLRO. Filing is now ready for submission to FIU.',
  });
}

// ─── Action: reject (PENDING_REVIEW → DRAFT) ─────────────────────────────────

async function handleReject(
  filing: Record<string, unknown>,
  userId: string,
  userName: string,
  notes: string | undefined,
  request: NextRequest,
) {
  const filingStatus = filing.filingStatus as string;

  // Only PENDING_REVIEW filings can be rejected
  if (filingStatus !== 'PENDING_REVIEW') {
    return NextResponse.json(
      {
        success: false,
        error: `Filing is in "${filingStatus}" status. Only PENDING_REVIEW filings can be rejected.`,
        currentStatus: filingStatus,
        requiredStatus: 'PENDING_REVIEW',
      },
      { status: 409 },
    );
  }

  // Require notes for rejection (best practice per CBUAE guidelines)
  if (!notes || notes.trim().length < 10) {
    return NextResponse.json(
      {
        success: false,
        error: 'A rationale of at least 10 characters is required when rejecting a filing per regulatory best practice.',
      },
      { status: 422 },
    );
  }

  // Update filing status back to DRAFT
  const updatedFiling = await db.goAMLFiling.update({
    where: { id: filing.id as string },
    data: { filingStatus: 'DRAFT' },
  });

  // Update the MakerCheckerLog
  const pendingMCLog = await db.makerCheckerLog.findFirst({
    where: {
      entityId: filing.id as string,
      entityType: 'GoAMLFiling',
      status: 'PENDING',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (pendingMCLog) {
    await db.makerCheckerLog.update({
      where: { id: pendingMCLog.id },
      data: {
        status: 'REJECTED',
        checkerId: userId,
        checkerName: userName,
        reviewedAt: new Date(),
      },
    });
  }

  // Audit log
  await createAuditLog({
    userId,
    action: 'FIU_FILING_REJECTED',
    resourceType: 'GoAMLFiling',
    resourceId: filing.id as string,
    details: JSON.stringify({
      jurisdiction: filing.jurisdiction,
      referenceNumber: filing.referenceNumber,
      previousStatus: 'PENDING_REVIEW',
      newStatus: 'DRAFT',
      rejectedBy: userName,
      rejectionNotes: notes,
      makerCheckerLogId: pendingMCLog?.id,
    }),
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  });

  return NextResponse.json({
    success: true,
    data: {
      filing: updatedFiling,
      rejectionNotes: notes,
    },
    message: 'FIU filing REJECTED. Filing reverted to DRAFT status for revision.',
  });
}
