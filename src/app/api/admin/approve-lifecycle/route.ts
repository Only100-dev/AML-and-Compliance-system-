import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { createAuditLog } from '@/lib/audit';
import { reviewMakerChecker } from '@/lib/middleware/maker-checker';

// ─── Phase 2 Directive 2.3: Approve/Reject a Pending User Lifecycle Change ───
// FDL 10/2025 Art. 15 (Segregation of Duties); CBUAE Notice 3551/2021 S3.1.
//
// A second admin or MLRO (the Checker) reviews a pending USER_ROLE_CHANGE or
// USER_DEACTIVATION request created by PATCH /api/users. The checker CANNOT be
// the same admin who made the request (4-eyes).
//
// On APPROVED: the role change or deactivation is applied to the User record.
// On REJECTED: no change is applied; the request is discarded.

const ApproveLifecycleSchema = z.object({
  makerCheckerLogId: z.string().min(1, 'Maker-Checker log ID is required'),
  action: z.enum(['APPROVED', 'REJECTED'], {
    error: 'action must be APPROVED or REJECTED',
  }),
  rationale: z.string().optional(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    // Only admin or MLRO can be the checker for a lifecycle change.
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = ApproveLifecycleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { makerCheckerLogId, action, rationale } = parsed.data;
    const sessionUser = auth.session?.user as Record<string, unknown> | undefined;
    const checkerId = (sessionUser?.userId as string) ?? (sessionUser?.id as string) ?? 'dev-user';
    const checkerName = (sessionUser?.name as string) ?? 'Unknown';
    const checkerRole = (sessionUser?.role as string) ?? 'admin';

    if (action === 'REJECTED' && (!rationale || rationale.trim().length < 10)) {
      return NextResponse.json(
        { success: false, error: 'A rationale of at least 10 characters is required when rejecting a lifecycle change.' },
        { status: 422 },
      );
    }

    // Fetch the maker-checker log
    const mcLog = await db.makerCheckerLog.findUnique({ where: { id: makerCheckerLogId } });
    if (!mcLog) {
      return NextResponse.json({ success: false, error: 'Maker-Checker log not found' }, { status: 404 });
    }
    if (!['USER_ROLE_CHANGE', 'USER_DEACTIVATION'].includes(mcLog.operationType)) {
      return NextResponse.json(
        { success: false, error: `Log operationType "${mcLog.operationType}" is not a lifecycle change. Use the appropriate approval endpoint.` },
        { status: 400 },
      );
    }
    if (mcLog.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: `Log already processed with status: ${mcLog.status}.`, violation: 'ALREADY_PROCESSED' },
        { status: 409 },
      );
    }

    // Parse the payload snapshot to know what change to apply
    let snapshot: {
      targetUserId: string;
      targetUserEmail: string;
      targetUserName: string;
      currentRole: string;
      currentIsActive: boolean;
      requestedRole: string;
      requestedIsActive: boolean;
    };
    try {
      snapshot = JSON.parse(mcLog.payloadSnapshot);
    } catch {
      return NextResponse.json({ success: false, error: 'Corrupted payload snapshot in Maker-Checker log' }, { status: 500 });
    }

    // Execute the maker-checker review (enforces maker != checker + expiry)
    let reviewedLog;
    try {
      reviewedLog = await reviewMakerChecker(makerCheckerLogId, checkerId, checkerName, action);
    } catch (mcError) {
      const message = mcError instanceof Error ? mcError.message : 'Maker-Checker review failed';
      if (message.includes('4-eyes') || message.includes('same person')) {
        return NextResponse.json(
          {
            success: false,
            error: `SECURITY VIOLATION: ${message} The admin who requested this lifecycle change cannot approve it.`,
            violation: 'MAKER_CHECKER_SAME_PERSON',
          },
          { status: 403 },
        );
      }
      if (message.includes('expired')) {
        return NextResponse.json({ success: false, error: message, violation: 'REQUEST_EXPIRED' }, { status: 410 });
      }
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const targetUser = await db.user.findUnique({ where: { id: snapshot.targetUserId } });
    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'Target user no longer exists' }, { status: 404 });
    }

    const previousState = { role: targetUser.role, isActive: targetUser.isActive };

    if (action === 'REJECTED') {
      await createAuditLog({
        userId: checkerId,
        action: `${mcLog.operationType}_REJECTED`,
        resourceType: 'User',
        resourceId: targetUser.id,
        details: `${checkerRole} (${checkerName}) REJECTED the ${mcLog.operationType} request for ${targetUser.email}. No change applied. Rationale: ${rationale}`,
        previousValue: previousState,
        newValue: previousState,
      });
      return NextResponse.json({
        success: true,
        data: { id: targetUser.id, role: targetUser.role, isActive: targetUser.isActive },
        makerChecker: { id: reviewedLog.id, status: reviewedLog.status },
        message: `${mcLog.operationType} request REJECTED. No change applied to the user.`,
      });
    }

    // ── APPROVED: apply the lifecycle change ──────────────────────────────────
    const updateData: { role?: string; isActive?: boolean } = {};
    if (mcLog.operationType === 'USER_ROLE_CHANGE') {
      updateData.role = snapshot.requestedRole;
    } else if (mcLog.operationType === 'USER_DEACTIVATION') {
      updateData.isActive = false;
    }

    const updatedUser = await db.user.update({
      where: { id: snapshot.targetUserId },
      data: updateData,
    });

    await createAuditLog({
      userId: checkerId,
      action: `${mcLog.operationType}_APPROVED`,
      resourceType: 'User',
      resourceId: updatedUser.id,
      details: `${checkerRole} (${checkerName}) APPROVED the ${mcLog.operationType} request (originally made by ${mcLog.makerName}). Change applied: ${JSON.stringify(updateData)}. Rationale: ${rationale ?? 'N/A'}`,
      previousValue: previousState,
      newValue: { role: updatedUser.role, isActive: updatedUser.isActive },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
      },
      makerChecker: { id: reviewedLog.id, status: reviewedLog.status, checkerName: reviewedLog.checkerName, reviewedAt: reviewedLog.reviewedAt },
      message: `${mcLog.operationType} APPROVED and applied. User ${updatedUser.email} now has role="${updatedUser.role}", isActive=${updatedUser.isActive}.`,
    });
  } catch (error) {
    console.error('[Admin Approve Lifecycle API] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to approve lifecycle change' }, { status: 500 });
  }
}
