/**
 * Department Head SLA Check API
 * FDL 10/2025 Art. 15
 *
 * GET: Check SLA status for all pending acknowledgments
 * - 5 business days to acknowledge
 * - 10 business days to submit action plan
 * - Auto-escalate overdue items to CCO/MLRO
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRBAC } from '@/lib/compliance/rbac';
import { createAuditLog } from '@/lib/audit';

// ─── Helper ──────────────────────────────────────────────────────────────────

function getRBACContext(request: NextRequest) {
  const raw = request.headers.get('x-rbac-context');
  if (raw) {
    try { return JSON.parse(raw); } catch { /* fall through */ }
  }
  return {
    userId: request.headers.get('x-user-id') ?? 'unknown',
    role: request.headers.get('x-user-role') ?? 'unknown',
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  };
}

/**
 * Calculate business days between two dates (excludes weekends)
 */
function businessDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Add business days to a date
 */
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) {
      added++;
    }
  }
  return result;
}

// ─── GET /api/dept-head/check-sla ────────────────────────────────────────────

export const GET = withRBAC(
  async (request: NextRequest) => {
    try {
      const ctx = getRBACContext(request);
      const now = new Date();

      // Fetch all pending acknowledgments
      const pendingAck = await db.departmentAcknowledgment.findMany({
        where: { slaStatus: 'PENDING_ACK' },
      });

      // Fetch all acknowledged without action plan
      const acknowledgedNoPlan = await db.departmentAcknowledgment.findMany({
        where: { slaStatus: 'ACKNOWLEDGED' },
      });

      const escalations: Array<{
        id: string;
        circularId: string;
        departmentName: string;
        acknowledgedById: string;
        slaStatus: string;
        daysSinceIssued: number;
        deadlineType: 'ack' | 'action';
        escalatedTo: string;
      }> = [];

      // Check PENDING_ACK items for 5 business day SLA
      for (const ack of pendingAck) {
        // Calculate deadline: 5 business days from creation
        const ackDeadline = addBusinessDays(new Date(ack.createdAt), 5);
        const daysSinceIssued = businessDaysBetween(new Date(ack.createdAt), now);

        if (now > ackDeadline) {
          // Overdue acknowledgment — escalate to CCO/MLRO
          await db.departmentAcknowledgment.update({
            where: { id: ack.id },
            data: {
              slaStatus: 'OVERDUE_ACK',
              escalatedToCCO: true,
              escalatedAt: new Date(),
              updatedAt: new Date(),
            },
          });

          escalations.push({
            id: ack.id,
            circularId: ack.circularId,
            departmentName: ack.departmentName,
            acknowledgedById: ack.acknowledgedById,
            slaStatus: 'OVERDUE_ACK',
            daysSinceIssued,
            deadlineType: 'ack',
            escalatedTo: 'CCO/MLRO',
          });
        }
      }

      // Check ACKNOWLEDGED items without action plan for 10 business day SLA
      for (const ack of acknowledgedNoPlan) {
        // Calculate deadline: 10 business days from creation (or from acknowledged date)
        const referenceDate = ack.acknowledgedAt ? new Date(ack.acknowledgedAt) : new Date(ack.createdAt);
        const actionDeadline = addBusinessDays(referenceDate, 10);
        const daysSinceAck = businessDaysBetween(referenceDate, now);

        if (now > actionDeadline) {
          // Overdue action plan — escalate to CCO/MLRO
          await db.departmentAcknowledgment.update({
            where: { id: ack.id },
            data: {
              slaStatus: 'OVERDUE_ACTION',
              escalatedToCCO: true,
              escalatedAt: new Date(),
              updatedAt: new Date(),
            },
          });

          escalations.push({
            id: ack.id,
            circularId: ack.circularId,
            departmentName: ack.departmentName,
            acknowledgedById: ack.acknowledgedById,
            slaStatus: 'OVERDUE_ACTION',
            daysSinceIssued: daysSinceAck,
            deadlineType: 'action',
            escalatedTo: 'CCO/MLRO',
          });
        }
      }

      // Generate SLA status report
      const allAcknowledgments = await db.departmentAcknowledgment.findMany();
      const report = {
        total: allAcknowledgments.length,
        byStatus: {
          PENDING_ACK: allAcknowledgments.filter((a) => a.slaStatus === 'PENDING_ACK').length,
          ACKNOWLEDGED: allAcknowledgments.filter((a) => a.slaStatus === 'ACKNOWLEDGED').length,
          ACTION_PLAN_SUBMITTED: allAcknowledgments.filter((a) => a.slaStatus === 'ACTION_PLAN_SUBMITTED').length,
          OVERDUE_ACK: allAcknowledgments.filter((a) => a.slaStatus === 'OVERDUE_ACK').length,
          OVERDUE_ACTION: allAcknowledgments.filter((a) => a.slaStatus === 'OVERDUE_ACTION').length,
        },
        escalatedThisCheck: escalations.length,
        escalationDetails: escalations,
        checkedAt: now.toISOString(),
      };

      // Audit log for SLA check
      if (escalations.length > 0) {
        await createAuditLog({
          userId: ctx.userId,
          action: 'SLA_CHECK_ESCALATIONS',
          resourceType: 'DepartmentAcknowledgment',
          resourceId: 'batch',
          details: `SLA check completed. ${escalations.length} item(s) escalated to CCO/MLRO.`,
          ipAddress: ctx.ipAddress,
        });
      }

      return NextResponse.json({
        success: true,
        data: report,
      });
    } catch (error) {
      console.error('Failed to check SLA status:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to check SLA status' },
        { status: 500 },
      );
    }
  },
  'canManageDeptHeadInbox',
);
