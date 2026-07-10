/**
 * Phase 2 Directive 2.4 — Cron Route: Ingestion SLA Auto-Escalation
 * ------------------------------------------------------------------
 * FDL 10/2025 Art. 15; CBUAE Notice 3551/2021.
 *
 * Scans DepartmentAcknowledgment rows and auto-escalates overdue SLAs:
 *   - If now > slaDeadlineAck and status=PENDING_ACK -> OVERDUE_ACK + alert + CCO escalation
 *   - If now > slaDeadlineAction and status=ACKNOWLEDGED -> OVERDUE_ACTION + alert
 *
 * SLA windows (UAE business days from circular commit):
 *   - Acknowledgment: 5 business days (INGESTION_SLA.ACK_BUSINESS_DAYS)
 *   - Action plan: 10 business days (INGESTION_SLA.ACTION_PLAN_BUSINESS_DAYS)
 *
 * Security: protected by CRON_SECRET + IP isolation. One summary AuditLog per run.
 */

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { enforceCronIsolation } from '@/lib/cron/isolation';

function verifyCronSecret(request: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn('[cron/ingestion-sla] CRON_SECRET not configured — failing closed.');
    return { ok: false, reason: 'CRON_SECRET not configured' };
  }
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, reason: 'Missing Bearer token' };
  }
  const token = authHeader.slice(7);
  if (token.length !== secret.length || token !== secret) {
    return { ok: false, reason: 'Token mismatch' };
  }
  return { ok: true };
}

export async function GET(request: NextRequest) {
  return runIngestionSLA(request);
}

export async function POST(request: NextRequest) {
  return runIngestionSLA(request);
}

async function runIngestionSLA(request: NextRequest) {
  const isolation = enforceCronIsolation(request);
  if (!isolation.ok) {
    return NextResponse.json({ success: false, error: isolation.reason }, { status: 403 });
  }
  const secretCheck = verifyCronSecret(request);
  if (!secretCheck.ok) {
    return NextResponse.json({ success: false, error: secretCheck.reason }, { status: 401 });
  }

  try {
    const now = new Date();

    // ── Overdue acknowledgments (PENDING_ACK past deadline) ────────────────
    const overdueAcks = await db.departmentAcknowledgment.findMany({
      where: {
        slaStatus: 'PENDING_ACK',
        slaDeadlineAck: { lt: now },
      },
    });
    const overdueAckCircularIds = [...new Set(overdueAcks.map((a) => a.circularId))];
    const overdueAckCirculars = await db.regulatoryCircular.findMany({
      where: { id: { in: overdueAckCircularIds } },
      select: { id: true, circularNumber: true, title: true },
    });
    const ackCircularMap = new Map(overdueAckCirculars.map((c) => [c.id, c]));

    let ackEscalated = 0;
    for (const ack of overdueAcks) {
      const circ = ackCircularMap.get(ack.circularId);
      await db.$transaction([
        db.departmentAcknowledgment.update({
          where: { id: ack.id },
          data: { slaStatus: 'OVERDUE_ACK', escalatedToCCO: true, escalatedAt: now },
        }),
        db.complianceAlert.create({
          data: {
            alertType: 'REGULATORY_DEADLINE',
            severity: 'high',
            status: 'active',
            title: `Overdue Circular Acknowledgment: ${circ?.circularNumber ?? ack.circularId}`,
            description: `Department "${ack.departmentName}" has missed the 5-business-day acknowledgment deadline for circular "${circ?.title ?? ack.circularId}". Escalated to Chief Compliance Officer. FDL 10/2025 Art. 15.`,
            sourceModule: 'Ingestion',
            sourceEntityId: ack.id,
            sourceEntityType: 'DepartmentAcknowledgment',
            dueDate: now,
            isImmutable: true,
          },
        }),
      ]);
      ackEscalated++;
    }

    // ── Overdue action plans (ACKNOWLEDGED but action plan past deadline) ───
    const overdueActions = await db.departmentAcknowledgment.findMany({
      where: {
        slaStatus: 'ACKNOWLEDGED',
        slaDeadlineAction: { lt: now },
      },
    });
    const overdueActionCircularIds = [...new Set(overdueActions.map((a) => a.circularId))];
    const overdueActionCirculars = await db.regulatoryCircular.findMany({
      where: { id: { in: overdueActionCircularIds } },
      select: { id: true, circularNumber: true, title: true },
    });
    const actionCircularMap = new Map(overdueActionCirculars.map((c) => [c.id, c]));

    let actionEscalated = 0;
    for (const ack of overdueActions) {
      const circ = actionCircularMap.get(ack.circularId);
      await db.$transaction([
        db.departmentAcknowledgment.update({
          where: { id: ack.id },
          data: { slaStatus: 'OVERDUE_ACTION', escalatedToCCO: true, escalatedAt: now },
        }),
        db.complianceAlert.create({
          data: {
            alertType: 'REGULATORY_DEADLINE',
            severity: 'critical',
            status: 'active',
            title: `Overdue Action Plan: ${circ?.circularNumber ?? ack.circularId}`,
            description: `Department "${ack.departmentName}" acknowledged circular "${circ?.title ?? ack.circularId}" but has missed the 10-business-day action plan submission deadline. Escalated to Chief Compliance Officer. FDL 10/2025 Art. 15.`,
            sourceModule: 'Ingestion',
            sourceEntityId: ack.id,
            sourceEntityType: 'DepartmentAcknowledgment',
            dueDate: now,
            isImmutable: true,
          },
        }),
      ]);
      actionEscalated++;
    }

    await createAuditLog({
      userId: 'cron-ingestion-sla',
      action: 'CRON_INGESTION_SLA_RUN',
      resourceType: 'DepartmentAcknowledgment',
      resourceId: 'batch',
      details: `Ingestion SLA escalation run. Overdue acks escalated: ${ackEscalated}. Overdue action plans escalated: ${actionEscalated}.`,
      previousValue: { overdueAckCandidates: overdueAcks.length, overdueActionCandidates: overdueActions.length },
      newValue: { ackEscalated, actionEscalated },
    });

    return NextResponse.json({
      success: true,
      scannedOverdueAck: overdueAcks.length,
      scannedOverdueAction: overdueActions.length,
      ackEscalated,
      actionEscalated,
      ranAt: now.toISOString(),
    });
  } catch (error) {
    console.error('[cron/ingestion-sla] Error:', error);
    return NextResponse.json({ success: false, error: 'Ingestion SLA escalation failed' }, { status: 500 });
  }
}
