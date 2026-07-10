import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { createAuditLog } from '@/lib/audit';
import { reviewMakerChecker } from '@/lib/middleware/maker-checker';

// ─── Phase 2 Directive 2.1: Approve/Reject a CO's Sanctions Dismissal ────────
// FDL 10/2025 Art. 15 (Segregation of Duties); 4-eyes principle.
//
// Only Compliance Manager (Level 40), MLRO (Level 50), or Admin can approve
// a CO's recommended FALSE_POSITIVE dismissal. The checker CANNOT be the same
// person as the maker (the CO who recommended). Enforced by reviewMakerChecker().
//
// On APPROVED: alert.dispositionStage -> APPROVED, alert.status -> closed.
// On REJECTED: alert.dispositionStage -> REJECTED, alert stays open for re-triage.

const ApproveSchema = z.object({
  makerCheckerLogId: z.string().min(1, 'Maker-Checker log ID is required'),
  alertId: z.string().min(1, 'Alert ID is required'),
  action: z.enum(['APPROVED', 'REJECTED'], {
    error: 'action must be APPROVED or REJECTED',
  }),
  rationale: z.string().optional(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    // Only the approving authority can check a sanctions dismissal.
    const auth = await authGuard({
      allowedRoles: ['admin', 'mlro', 'compliance_manager'],
    });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = ApproveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { makerCheckerLogId, alertId, action, rationale } = parsed.data;

    // Rejection requires a rationale (audit defensibility).
    if (action === 'REJECTED' && (!rationale || rationale.trim().length < 10)) {
      return NextResponse.json(
        { success: false, error: 'A rationale of at least 10 characters is required when rejecting a dismissal.' },
        { status: 422 },
      );
    }

    const sessionUser = auth.session?.user as Record<string, unknown> | undefined;
    const checkerId = (sessionUser?.userId as string) ?? (sessionUser?.id as string) ?? 'dev-user';
    const checkerName = (sessionUser?.name as string) ?? 'Unknown';
    const checkerRole = (sessionUser?.role as string) ?? 'compliance_manager';

    // Verify the alert exists and is in a pending disposition state.
    const alert = await db.aMLAlert.findUnique({ where: { id: alertId } });
    if (!alert) {
      return NextResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
    }

    if (alert.dispositionStage !== 'RECOMMENDED') {
      return NextResponse.json(
        {
          success: false,
          error: `Alert disposition is in "${alert.dispositionStage}" stage. Only RECOMMENDED dismissals can be reviewed.`,
          violation: 'INVALID_DISPOSITION_STAGE',
        },
        { status: 409 },
      );
    }

    const previousState = {
      status: alert.status,
      disposition: alert.disposition,
      dispositionStage: alert.dispositionStage,
      makerCheckerLogId: alert.makerCheckerLogId,
    };

    // Execute the Maker-Checker review (enforces maker != checker + expiry).
    let mcLog;
    try {
      mcLog = await reviewMakerChecker(makerCheckerLogId, checkerId, checkerName, action);
    } catch (mcError) {
      const message = mcError instanceof Error ? mcError.message : 'Maker-Checker review failed';
      if (message.includes('4-eyes') || message.includes('same person')) {
        return NextResponse.json(
          {
            success: false,
            error: `SECURITY VIOLATION: ${message} The CO who recommended this dismissal cannot approve it.`,
            violation: 'MAKER_CHECKER_SAME_PERSON',
          },
          { status: 403 },
        );
      }
      if (message.includes('expired')) {
        return NextResponse.json(
          { success: false, error: message, violation: 'REQUEST_EXPIRED' },
          { status: 410 },
        );
      }
      if (message.includes('already processed')) {
        return NextResponse.json(
          { success: false, error: message, violation: 'ALREADY_PROCESSED' },
          { status: 409 },
        );
      }
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    // Apply the disposition outcome.
    if (action === 'APPROVED') {
      const updated = await db.aMLAlert.update({
        where: { id: alertId },
        data: {
          dispositionStage: 'APPROVED',
          dispositionApprovedById: checkerId,
          dispositionApprovedByName: checkerName,
          dispositionApprovedAt: new Date(),
          status: 'closed',
        },
      });

      await createAuditLog({
        userId: checkerId,
        action: 'SANCTIONS_DISPOSITION_APPROVED',
        resourceType: 'AMLAlert',
        resourceId: alert.caseId,
        details: `CM/MLRO (${checkerRole}) APPROVED the CO's FALSE_POSITIVE dismissal. Alert closed. Rationale: ${rationale ?? 'N/A'}`,
        previousValue: previousState,
        newValue: { status: 'closed', disposition: 'FALSE_POSITIVE', dispositionStage: 'APPROVED', approvedBy: checkerName },
      });

      return NextResponse.json({
        success: true,
        data: {
          id: updated.id,
          status: updated.status,
          disposition: updated.disposition,
          dispositionStage: updated.dispositionStage,
        },
        makerChecker: { id: mcLog.id, status: mcLog.status, checkerName: mcLog.checkerName, reviewedAt: mcLog.reviewedAt },
        message: 'FALSE_POSITIVE dismissal APPROVED. Alert closed.',
      });
    }

    // REJECTED — revert the alert for re-triage.
    const updated = await db.aMLAlert.update({
      where: { id: alertId },
      data: {
        dispositionStage: 'REJECTED',
        dispositionApprovedById: checkerId,
        dispositionApprovedByName: checkerName,
        dispositionApprovedAt: new Date(),
        makerCheckerLogId: null,
      },
    });

    await createAuditLog({
      userId: checkerId,
      action: 'SANCTIONS_DISPOSITION_REJECTED',
      resourceType: 'AMLAlert',
      resourceId: alert.caseId,
      details: `CM/MLRO (${checkerRole}) REJECTED the CO's FALSE_POSITIVE dismissal. Alert remains open for re-triage. Rationale: ${rationale}`,
      previousValue: previousState,
      newValue: { status: alert.status, disposition: alert.disposition, dispositionStage: 'REJECTED' },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        disposition: updated.disposition,
        dispositionStage: updated.dispositionStage,
      },
      makerChecker: { id: mcLog.id, status: mcLog.status, checkerName: mcLog.checkerName, reviewedAt: mcLog.reviewedAt },
      message: 'FALSE_POSITIVE dismissal REJECTED. Alert remains open for re-triage.',
    });
  } catch (error) {
    console.error('[AML Approve Disposition API] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to review disposition' }, { status: 500 });
  }
}
