import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { createAuditLog } from '@/lib/audit';
import { resolveActorId } from '@/lib/audit-actor';
import {
  evaluateSlaPhase,
  computeComplaintSLAStatus,
  type SlaPhase,
} from '@/lib/compliance/complaint-sla';

/**
 * P2 Step 1c — CBUAE SLA Evaluator.
 *
 * Regulatory basis: CBUAE Notice 3551/2021 + UAE Insurance Regulations.
 *   - Acknowledgment within 5 business days.
 *   - Resolution within 30 business days.
 *
 * This endpoint is invoked by a scheduled job (cron) OR manually by an
 * operator. For each OPEN complaint (status not in {CLOSED, ESCALATED_TO_OMBUDSMAN}),
 * it evaluates both SLA phases and:
 *
 *   1. Updates the denormalized `slaStatus` column so the inbox can filter
 *      by `WHERE slaStatus = 'BREACHED'` without recomputing.
 *
 *   2. At 80% elapsed  → generates a `COMPLAINT_*_SLA` ComplianceAlert
 *      (severity high) and a UniversalTask so the assignee's inbox flags it.
 *
 *   3. At 100% elapsed → generates a `COMPLAINT_*_SLA` ComplianceAlert
 *      (severity critical) + UniversalTask.
 *
 * Idempotent: before creating an alert, it checks whether an active alert of
 * the same alertType already exists for the same sourceEntityId. This makes
 * the evaluator safe to run on any schedule without producing duplicates.
 *
 * The endpoint does NOT require a request body. It evaluates ALL eligible
 * complaints in one pass. Returns a summary of alerts generated + statuses
 * updated so the caller (cron / operator) has full visibility.
 *
 * Audit: every alert generation is audit-logged via the canonical helper so
 * the shift-left audit coverage rule remains satisfied.
 */

// Eligible statuses = everything EXCEPT the terminal states.
const ELIGIBLE_STATUSES = ['NEW', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED'];

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

    const actorId = resolveActorId(auth);
    const now = new Date();

    const complaints = await db.complaint.findMany({
      where: { status: { in: ELIGIBLE_STATUSES } },
      take: 500,
      select: {
        id: true,
        complaintNumber: true,
        subject: true,
        status: true,
        departmentId: true,
        slaDeadlineAck: true,
        slaDeadlineResolution: true,
        slaStatus: true,
        acknowledgedAt: true,
        resolvedAt: true,
        acknowledgedById: true,
        createdAt: true,
      },
    });

    const alertsCreated: Array<{
      complaintId: string;
      complaintNumber: string;
      phase: SlaPhase;
      severity: string;
      alertId: string;
    }> = [];
    const statusesUpdated: Array<{
      complaintId: string;
      complaintNumber: string;
      slaStatus: string;
    }> = [];

    for (const complaint of complaints) {
      const ackSla = evaluateSlaPhase(
        'ACK',
        complaint.createdAt,
        complaint.slaDeadlineAck,
        now,
        complaint.acknowledgedAt,
      );
      const resSla = evaluateSlaPhase(
        'RESOLUTION',
        complaint.createdAt,
        complaint.slaDeadlineResolution,
        now,
        complaint.resolvedAt,
      );

      // Overall SLA status = the worse of the two phases (computed via the
      // canonical helper which respects acknowledgedAt / resolvedAt).
      const overallStatus = computeComplaintSLAStatus(complaint, now);

      // ── Denormalize the SLA status column (single UPDATE per complaint) ──
      const needsUpdate = complaint.slaStatus !== overallStatus;

      if (needsUpdate) {
        await db.complaint.update({
          where: { id: complaint.id },
          data: { slaStatus: overallStatus },
        });
        statusesUpdated.push({
          complaintId: complaint.id,
          complaintNumber: complaint.complaintNumber,
          slaStatus: overallStatus,
        });
      }

      // The complaint's responsible party — Complaint has no dedicated
      // assignee column, so fall back to the acknowledger, then the
      // department, then the compliance pool.
      const assigneeId =
        complaint.acknowledgedById ?? complaint.departmentId ?? 'compliance-pool';
      const assigneeName = complaint.departmentId ?? 'Compliance Pool';

      // ── Generate alerts at 80% / 100% (idempotent) ──
      for (const sla of [ackSla, resSla]) {
        if (!sla.shouldAlert) continue;

        // Idempotency: skip if an ACTIVE alert already exists for this complaint + alertType
        const existing = await db.complianceAlert.findFirst({
          where: {
            alertType: sla.alertType,
            sourceEntityId: complaint.id,
            sourceEntityType: 'Complaint',
            status: 'active',
          },
          select: { id: true, severity: true },
        });

        // If an alert exists at the SAME or HIGHER severity, skip (no downgrade).
        // If we're escalating (APPROACHING → BREACHED), we create the new critical alert.
        if (existing) {
          const severityRank: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
          if ((severityRank[existing.severity] ?? 0) >= (severityRank[sla.alertSeverity] ?? 0)) {
            continue;
          }
        }

        const alertTitle =
          sla.phase === 'ACK'
            ? `Complaint ${complaint.complaintNumber}: Acknowledgment SLA ${sla.status === 'BREACHED' ? 'BREACHED' : 'approaching'}`
            : `Complaint ${complaint.complaintNumber}: Resolution SLA ${sla.status === 'BREACHED' ? 'BREACHED' : 'approaching'}`;

        const alertDescription =
          sla.phase === 'ACK'
            ? `CBUAE requires acknowledgment within 5 business days. Complaint ${complaint.complaintNumber} (${complaint.subject}) is at ${Math.round(sla.elapsedFraction * 100)}% of its acknowledgment SLA. Deadline: ${sla.deadline!.toISOString().split('T')[0]}.`
            : `CBUAE requires resolution within 30 business days. Complaint ${complaint.complaintNumber} (${complaint.subject}) is at ${Math.round(sla.elapsedFraction * 100)}% of its resolution SLA. Deadline: ${sla.deadline!.toISOString().split('T')[0]}.`;

        const alert = await db.complianceAlert.create({
          data: {
            alertType: sla.alertType,
            severity: sla.alertSeverity,
            status: 'active',
            title: alertTitle,
            description: alertDescription,
            sourceModule: 'complaints',
            sourceEntityId: complaint.id,
            sourceEntityType: 'Complaint',
            dueDate: sla.deadline!,
            assignedToId: assigneeId,
            isImmutable: true,
          },
        });

        alertsCreated.push({
          complaintId: complaint.id,
          complaintNumber: complaint.complaintNumber,
          phase: sla.phase,
          severity: sla.alertSeverity,
          alertId: alert.id,
        });

        // ── Surface the SLA alert in the assignee's "My Tasks" inbox ──
        // Direct DB write (taskType='ALERT', sourceId=alert.id) so each alert
        // gets its own inbox task without conflicting on the @@unique([taskType, sourceId]) constraint.
        await db.universalTask
          .create({
            data: {
              taskType: 'ALERT',
              sourceId: alert.id,
              sourceEntityType: 'ComplianceAlert',
              title: alertTitle,
              description: alertDescription,
              assignedToId: assigneeId,
              assignedToName: assigneeName,
              priority: sla.alertSeverity === 'critical' ? 'CRITICAL' : 'HIGH',
              status: 'OPEN',
              dueDate: sla.deadline,
              sourceModule: 'COMPLIANCE_ALERTS',
              isImmutable: true,
            },
          })
          .catch((e) =>
            console.error('[complaints/sla/evaluate] universal-task create failed:', e),
          );

        // ── Audit log the alert generation ──
        await createAuditLog({
          userId: actorId,
          action: `COMPLAINT_SLA_ALERT_${sla.status}`,
          resourceType: 'Complaint',
          resourceId: complaint.id,
          details: `SLA alert generated for ${complaint.complaintNumber} (${sla.phase} phase, ${sla.status}, ${sla.alertSeverity}). ${alertDescription}`,
          changes: {
            alertId: alert.id,
            alertType: sla.alertType,
            phase: sla.phase,
            status: sla.status,
            severity: sla.alertSeverity,
            elapsedFraction: sla.elapsedFraction,
            deadline: sla.deadline!.toISOString(),
          },
          ipAddress:
            request.headers.get('x-forwarded-for') ??
            request.headers.get('x-real-ip') ??
            undefined,
        }).catch((e) =>
          console.error('[complaints/sla/evaluate] audit log failed:', e),
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        evaluated: complaints.length,
        statusesUpdated: statusesUpdated.length,
        alertsCreated: alertsCreated.length,
        statusesUpdatedDetail: statusesUpdated,
        alertsCreatedDetail: alertsCreated,
      },
      meta: { evaluatedAt: now.toISOString() },
    });
  } catch (error) {
    console.error('[COMPLAINTS_SLA_EVALUATE] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to evaluate complaint SLAs' },
      { status: 500 },
    );
  }
}

// GET /api/complaints/sla/evaluate — read-only SLA status dashboard
export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({
      allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer', 'board'],
    });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;

    const now = new Date();
    const eligible = await db.complaint.findMany({
      where: { status: { in: ELIGIBLE_STATUSES } },
      take: 500,
      select: {
        id: true,
        complaintNumber: true,
        subject: true,
        status: true,
        priority: true,
        departmentId: true,
        slaDeadlineAck: true,
        slaDeadlineResolution: true,
        slaStatus: true,
        acknowledgedAt: true,
        resolvedAt: true,
        acknowledgedById: true,
        createdAt: true,
      },
    });

    const evaluated = eligible.map((c) => {
      const ack = evaluateSlaPhase('ACK', c.createdAt, c.slaDeadlineAck, now, c.acknowledgedAt);
      const res = evaluateSlaPhase('RESOLUTION', c.createdAt, c.slaDeadlineResolution, now, c.resolvedAt);
      return {
        ...c,
        sla: {
          ack: {
            status: ack.status,
            elapsedFraction: ack.elapsedFraction,
            daysRemaining: ack.daysRemaining,
            deadline: ack.deadline?.toISOString() ?? null,
          },
          resolution: {
            status: res.status,
            elapsedFraction: res.elapsedFraction,
            daysRemaining: res.daysRemaining,
            deadline: res.deadline?.toISOString() ?? null,
          },
        },
      };
    });

    const summary = {
      total: evaluated.length,
      ackBreached: evaluated.filter((e) => e.sla.ack.status === 'BREACHED').length,
      ackApproaching: evaluated.filter((e) => e.sla.ack.status === 'APPROACHING_BREACH').length,
      resolutionBreached: evaluated.filter((e) => e.sla.resolution.status === 'BREACHED').length,
      resolutionApproaching: evaluated.filter((e) => e.sla.resolution.status === 'APPROACHING_BREACH').length,
    };

    return NextResponse.json({ success: true, data: evaluated, meta: { summary, evaluatedAt: now.toISOString() } });
  } catch (error) {
    console.error('[COMPLAINTS_SLA_STATUS_GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SLA status' },
      { status: 500 },
    );
  }
}
