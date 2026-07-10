import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { createAuditLog } from '@/lib/audit';
import { initiateMakerChecker } from '@/lib/middleware/maker-checker';

// ─── Phase 2 Directive 2.1: Sanctions/PEP Disposition Maker-Checker ──────────
// FDL 10/2025 Art. 15 (Segregation of Duties); CBUAE Notice 3551/2021 S3.1.
//
// Workflow:
//   1. Compliance Officer (Level 30) triages a sanctions/PEP alert and
//      recommends a disposition: FALSE_POSITIVE or TRUE_MATCH.
//   2. If TRUE_MATCH: the alert escalates to investigation/SAR (no Maker-
//      Checker needed — escalation is the safe path).
//   3. If FALSE_POSITIVE (a dismissal): a Maker-Checker request is created
//      and held PENDING. The alert is NOT closed. A Compliance Manager
//      (Level 40) or MLRO (Level 50) must approve the dismissal via
//      POST /api/aml/approve-disposition. The CO cannot self-approve.
//   4. A Compliance Manager / MLRO / Admin dismissing directly (they hold
//      the approving authority) takes immediate effect with full audit.
// ──────────────────────────────────────────────────────────────────────────────

const DispositionSchema = z.object({
  alertId: z.string().min(1, 'Alert ID is required'),
  disposition: z.enum(['FALSE_POSITIVE', 'TRUE_MATCH'], {
    error: 'disposition must be FALSE_POSITIVE or TRUE_MATCH',
  }),
  rationale: z
    .string()
    .min(20, 'A rationale of at least 20 characters is required for audit defensibility'),
  userId: z.string().optional(),
  userName: z.string().optional(),
  userRole: z.string().optional(),
}).strict();

const APPROVING_ROLES = ['compliance_manager', 'mlro', 'admin'];

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard({
      allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'],
    });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = DispositionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { alertId, disposition, rationale } = parsed.data;
    const sessionUser = auth.session?.user as Record<string, unknown> | undefined;
    const userId = parsed.data.userId ?? (sessionUser?.userId as string) ?? (sessionUser?.id as string) ?? 'dev-user';
    const userName = parsed.data.userName ?? (sessionUser?.name as string) ?? 'Unknown';
    const userRole = parsed.data.userRole ?? (sessionUser?.role as string) ?? 'compliance_officer';

    // Fetch the alert
    const alert = await db.aMLAlert.findUnique({ where: { id: alertId } });
    if (!alert) {
      return NextResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
    }

    const previousState = {
      status: alert.status,
      disposition: alert.disposition,
      dispositionStage: alert.dispositionStage,
    };

    // ── TRUE_MATCH: escalate (no Maker-Checker — escalation is the safe path) ──
    if (disposition === 'TRUE_MATCH') {
      const updated = await db.aMLAlert.update({
        where: { id: alertId },
        data: {
          disposition: 'TRUE_MATCH',
          dispositionStage: 'APPROVED',
          dispositionRationale: rationale,
          dispositionById: userId,
          dispositionByName: userName,
          dispositionAt: new Date(),
          status: 'escalated',
        },
      });

      await createAuditLog({
        userId,
        action: 'SANCTIONS_DISPOSITION_TRUE_MATCH',
        resourceType: 'AMLAlert',
        resourceId: alert.caseId,
        details: `Sanctions/PEP alert confirmed as TRUE_MATCH and escalated for SAR filing. Rationale: ${rationale}`,
        previousValue: previousState,
        newValue: { status: 'escalated', disposition: 'TRUE_MATCH', dispositionStage: 'APPROVED' },
      });

      return NextResponse.json({
        success: true,
        data: { id: updated.id, status: updated.status, disposition: updated.disposition, dispositionStage: updated.dispositionStage },
        message: 'Alert confirmed as TRUE_MATCH and escalated for SAR filing.',
      });
    }

    // ── FALSE_POSITIVE (dismissal) ──────────────────────────────────────────────
    // If the caller is already CM/MLRO/Admin (the approving authority), the
    // dismissal takes immediate effect with full audit.
    // If the caller is a Compliance Officer (Level 30), enforce Maker-Checker:
    // the dismissal is held PENDING until a CM/MLRO approves it. The CO cannot
    // self-approve (4-eyes, FDL 10/2025 Art. 15).
    const isApprover = APPROVING_ROLES.includes(userRole);

    if (isApprover) {
      const updated = await db.aMLAlert.update({
        where: { id: alertId },
        data: {
          disposition: 'FALSE_POSITIVE',
          dispositionStage: 'APPROVED',
          dispositionRationale: rationale,
          dispositionById: userId,
          dispositionByName: userName,
          dispositionAt: new Date(),
          dispositionApprovedById: userId,
          dispositionApprovedByName: userName,
          dispositionApprovedAt: new Date(),
          status: 'closed',
        },
      });

      await createAuditLog({
        userId,
        action: 'SANCTIONS_DISPOSITION_FALSE_POSITIVE',
        resourceType: 'AMLAlert',
        resourceId: alert.caseId,
        details: `Sanctions/PEP alert dismissed as FALSE_POSITIVE by ${userRole} (direct authority). Rationale: ${rationale}`,
        previousValue: previousState,
        newValue: { status: 'closed', disposition: 'FALSE_POSITIVE', dispositionStage: 'APPROVED' },
      });

      return NextResponse.json({
        success: true,
        data: { id: updated.id, status: updated.status, disposition: updated.disposition, dispositionStage: updated.dispositionStage },
        message: 'Alert dismissed as FALSE_POSITIVE (direct approver authority).',
      });
    }

    // ── CO dismissal: enforce Maker-Checker (4-eyes) ───────────────────────────
    // The CO cannot self-approve. Create a PENDING MakerCheckerLog and hold the
    // alert open until a CM/MLRO checks it.
    const mcLog = await initiateMakerChecker(
      'SANCTIONS_DISMISSAL',
      alertId,
      'AMLAlert',
      userId,
      userName,
      {
        alertCaseId: alert.caseId,
        alertType: alert.alertType,
        disposition: 'FALSE_POSITIVE',
        rationale,
        riskLevel: alert.riskLevel,
        jurisdiction: alert.jurisdiction,
        reason: 'CO sanctions dismissal requires CM/MLRO approval (4-eyes, FDL 10/2025 Art. 15)',
      },
    );

    const updated = await db.aMLAlert.update({
      where: { id: alertId },
      data: {
        disposition: 'FALSE_POSITIVE',
        dispositionStage: 'RECOMMENDED',
        dispositionRationale: rationale,
        dispositionById: userId,
        dispositionByName: userName,
        dispositionAt: new Date(),
        makerCheckerLogId: mcLog.id,
        // Status stays open — the alert is NOT closed until a CM/MLRO approves
      },
    });

    await createAuditLog({
      userId,
      action: 'SANCTIONS_DISPOSITION_RECOMMENDED',
      resourceType: 'AMLAlert',
      resourceId: alert.caseId,
      details: `CO recommended FALSE_POSITIVE dismissal. Maker-Checker PENDING (log ${mcLog.id}). Requires CM/MLRO approval. Rationale: ${rationale}`,
      previousValue: previousState,
      newValue: {
        status: alert.status,
        disposition: 'FALSE_POSITIVE',
        dispositionStage: 'RECOMMENDED',
        makerCheckerLogId: mcLog.id,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: updated.id,
          status: updated.status,
          disposition: updated.disposition,
          dispositionStage: updated.dispositionStage,
          makerCheckerLogId: mcLog.id,
        },
        makerChecker: {
          id: mcLog.id,
          operationType: mcLog.operationType,
          status: mcLog.status,
          expiryTime: mcLog.expiryTime,
          makerName: mcLog.makerName,
        },
        message:
          'Disposition recommendation submitted. A Compliance Manager or MLRO must approve the FALSE_POSITIVE dismissal before the alert can be closed (4-eyes, FDL 10/2025 Art. 15).',
      },
      { status: 202 },
    );
  } catch (error) {
    console.error('[AML Disposition API] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to record disposition' }, { status: 500 });
  }
}
