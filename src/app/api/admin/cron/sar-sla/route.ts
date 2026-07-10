/**
 * Phase 2 Directive 2.2 — Cron Route: SAR Filing SLA Monitor
 * ------------------------------------------------------------------
 * Enforces the 7-business-day SAR filing SLA (FDL 10/2025 Art. 8).
 *
 * For every STR/SAR GoAMLFiling not yet submitted to the FIU:
 *   - At Day 5 (5 business days elapsed since creation): set slaFlaggedAt
 *     and create a high-severity ComplianceAlert (SAR_DEADLINE) so the MLRO
 *     has 2 business days of slack to sign and submit.
 *   - At Day 7 (7 business days elapsed, hard deadline breached): set
 *     slaEscalatedAt and create a critical ComplianceAlert escalating to
 *     the MLRO + Compliance Manager.
 *
 * Security: protected by CRON_SECRET (Authorization: Bearer) + IP isolation.
 * Audit: one summary AuditLog per run (flagged count + escalated count).
 */

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { enforceCronIsolation } from '@/lib/cron/isolation';
import { sarSLAStatus, SAR_SLA } from '@/lib/compliance/business-days';

function verifyCronSecret(request: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn('[cron/sar-sla] CRON_SECRET not configured — failing closed.');
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
  return runSarSLAMonitor(request);
}

export async function POST(request: NextRequest) {
  return runSarSLAMonitor(request);
}

async function runSarSLAMonitor(request: NextRequest) {
  // ── Security gate ──────────────────────────────────────────────────────
  const isolation = enforceCronIsolation(request);
  if (!isolation.ok) {
    return NextResponse.json({ success: false, error: isolation.reason }, { status: 403 });
  }
  const secretCheck = verifyCronSecret(request);
  if (!secretCheck.ok) {
    return NextResponse.json({ success: false, error: secretCheck.reason }, { status: 401 });
  }

  try {
    // Find all STR/SAR filings not yet submitted to the FIU.
    const activeFilings = await db.goAMLFiling.findMany({
      where: {
        reportType: { in: ['STR', 'SAR'] },
        filingStatus: { notIn: ['SUBMITTED_TO_FIU', 'ACKNOWLEDGED'] },
      },
    });

    let flaggedCount = 0;
    let escalatedCount = 0;
    const now = new Date();

    for (const filing of activeFilings) {
      const triggerDate = filing.createdAt;
      const sla = sarSLAStatus(triggerDate, now);

      // Day-5 auto-flag
      if (sla.status === 'flagged' && !filing.slaFlaggedAt) {
        await db.$transaction([
          db.goAMLFiling.update({
            where: { id: filing.id },
            data: { slaFlaggedAt: now },
          }),
          db.complianceAlert.create({
            data: {
              alertType: 'SAR_DEADLINE',
              severity: 'high',
              status: 'active',
              title: `SAR Filing SLA Day-5 Warning: ${filing.referenceNumber}`,
              description: `SAR ${filing.referenceNumber} (${filing.subjectName}) has reached ${sla.daysElapsed} business days since drafting. The 7-business-day FIU filing deadline (FDL 10/2025 Art. 8) is approaching. ${sla.daysRemaining} business day(s) remaining. The MLRO must sign and submit before the deadline.`,
              sourceModule: 'GoAML',
              sourceEntityId: filing.id,
              sourceEntityType: 'GoAMLFiling',
              dueDate: filing.slaDeadline ?? new Date(triggerDate.getTime() + SAR_SLA.FILING_BUSINESS_DAYS * 24 * 60 * 60 * 1000),
              isImmutable: true,
            },
          }),
        ]);
        flaggedCount++;
      }

      // Day-7 hard escalation
      if (sla.status === 'overdue' && !filing.slaEscalatedAt) {
        await db.$transaction([
          db.goAMLFiling.update({
            where: { id: filing.id },
            data: { slaEscalatedAt: now, ...(filing.slaFlaggedAt ? {} : { slaFlaggedAt: now }) },
          }),
          db.complianceAlert.create({
            data: {
              alertType: 'SAR_DEADLINE',
              severity: 'critical',
              status: 'active',
              title: `SAR Filing SLA BREACHED: ${filing.referenceNumber}`,
              description: `SAR ${filing.referenceNumber} (${filing.subjectName}) has BREACHED the 7-business-day FIU filing deadline (FDL 10/2025 Art. 8). ${sla.daysElapsed} business days elapsed. Immediate MLRO + Compliance Manager escalation required. Regulatory non-compliance must be documented.`,
              sourceModule: 'GoAML',
              sourceEntityId: filing.id,
              sourceEntityType: 'GoAMLFiling',
              dueDate: now,
              isImmutable: true,
            },
          }),
        ]);
        escalatedCount++;
      }
    }

    await createAuditLog({
      userId: 'cron-sar-sla',
      action: 'CRON_SAR_SLA_MONITOR_RUN',
      resourceType: 'GoAMLFiling',
      resourceId: 'batch',
      details: `SAR SLA monitor run. Active filings scanned: ${activeFilings.length}. Day-5 flagged: ${flaggedCount}. Day-7 escalated: ${escalatedCount}.`,
      previousValue: { activeFilings: activeFilings.length },
      newValue: { flagged: flaggedCount, escalated: escalatedCount },
    });

    return NextResponse.json({
      success: true,
      scanned: activeFilings.length,
      flaggedAtDay5: flaggedCount,
      escalatedAtDay7: escalatedCount,
      slaConfig: SAR_SLA,
      ranAt: now.toISOString(),
    });
  } catch (error) {
    console.error('[cron/sar-sla] Error:', error);
    return NextResponse.json({ success: false, error: 'SAR SLA monitor failed' }, { status: 500 });
  }
}
