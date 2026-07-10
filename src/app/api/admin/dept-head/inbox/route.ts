/**
 * Department Head Inbox API
 * FDL 10/2025 Art. 15
 *
 * GET: Get department head inbox with SLA status
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRBAC } from '@/lib/compliance/rbac';

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
 * Calculate SLA status for a department acknowledgment
 */
function calculateSLAStatus(ack: {
  slaStatus: string;
  acknowledgedAt: Date | null;
  actionPlan: string | null;
  actionPlanSubmittedAt: Date | null;
  slaDeadlineAck: Date | null;
  slaDeadlineAction: Date | null;
  createdAt: Date;
}): {
  slaStatus: string;
  daysUntilAckDeadline: number | null;
  daysUntilActionDeadline: number | null;
  isOverdueAck: boolean;
  isOverdueAction: boolean;
} {
  const now = new Date();
  let isOverdueAck = false;
  let isOverdueAction = false;
  let daysUntilAckDeadline: number | null = null;
  let daysUntilActionDeadline: number | null = null;

  if (ack.slaDeadlineAck) {
    const ackDeadline = new Date(ack.slaDeadlineAck);
    daysUntilAckDeadline = Math.ceil((ackDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (!ack.acknowledgedAt && daysUntilAckDeadline < 0) {
      isOverdueAck = true;
    }
  }

  if (ack.slaDeadlineAction) {
    const actionDeadline = new Date(ack.slaDeadlineAction);
    daysUntilActionDeadline = Math.ceil((actionDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (ack.acknowledgedAt && !ack.actionPlan && daysUntilActionDeadline < 0) {
      isOverdueAction = true;
    }
  }

  return {
    slaStatus: ack.slaStatus,
    daysUntilAckDeadline,
    daysUntilActionDeadline,
    isOverdueAck,
    isOverdueAction,
  };
}

// ─── GET /api/dept-head/inbox ────────────────────────────────────────────────

export const GET = withRBAC(
  async (request: NextRequest) => {
    try {
      const ctx = getRBACContext(request);

      // Fetch DepartmentAcknowledgment records for the current user
      const acknowledgments = await db.departmentAcknowledgment.findMany({
        where: { acknowledgedById: ctx.userId },
        orderBy: { createdAt: 'desc' },
      });

      // Include SLA status calculation
      const enrichedAcknowledgments = acknowledgments.map((ack) => {
        const slaInfo = calculateSLAStatus(ack);
        return {
          ...ack,
          slaInfo,
        };
      });

      // Summary stats
      const summary = {
        total: acknowledgments.length,
        pendingAck: acknowledgments.filter((a) => a.slaStatus === 'PENDING_ACK').length,
        acknowledged: acknowledgments.filter((a) => a.slaStatus === 'ACKNOWLEDGED').length,
        actionPlanSubmitted: acknowledgments.filter((a) => a.slaStatus === 'ACTION_PLAN_SUBMITTED').length,
        overdueAck: acknowledgments.filter((a) => a.slaStatus === 'OVERDUE_ACK').length,
        overdueAction: acknowledgments.filter((a) => a.slaStatus === 'OVERDUE_ACTION').length,
      };

      return NextResponse.json({
        success: true,
        data: enrichedAcknowledgments,
        meta: { summary },
      });
    } catch (error) {
      console.error('Failed to fetch dept head inbox:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch dept head inbox' },
        { status: 500 },
      );
    }
  },
  'canManageDeptHeadInbox',
);
