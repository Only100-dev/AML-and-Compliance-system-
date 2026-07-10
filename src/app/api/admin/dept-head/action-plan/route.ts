/**
 * Department Head Action Plan API
 * FDL 10/2025 Art. 15
 *
 * POST: Submit action plan for a circular
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRBAC } from '@/lib/compliance/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import { createHash } from 'crypto';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const submitActionPlanSchema = z.object({
  acknowledgmentId: z.string().min(1, 'Acknowledgment ID is required'),
  actionPlan: z.string().min(1, 'Action plan is required'),
});

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

// ─── POST /api/dept-head/action-plan ─────────────────────────────────────────

export const POST = withRBAC(
  async (request: NextRequest) => {
    try {
      const ctx = getRBACContext(request);
      const body = await request.json();
      const parsed = submitActionPlanSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            details: parsed.error.issues.map((i) => ({
              field: i.path.join('.'),
              message: i.message,
            })),
          },
          { status: 400 },
        );
      }

      const { acknowledgmentId, actionPlan } = parsed.data;

      const acknowledgment = await db.departmentAcknowledgment.findUnique({
        where: { id: acknowledgmentId },
      });

      if (!acknowledgment) {
        return NextResponse.json(
          { success: false, error: 'Acknowledgment record not found' },
          { status: 404 },
        );
      }

      // Verify the current user is the one assigned
      if (acknowledgment.acknowledgedById !== ctx.userId) {
        return NextResponse.json(
          {
            success: false,
            error: 'You can only submit action plans for circulars assigned to you',
            regulatoryRef: 'FDL 10/2025 Art. 15',
          },
          { status: 403 },
        );
      }

      // Must be acknowledged first
      if (!acknowledgment.acknowledgedAt) {
        return NextResponse.json(
          {
            success: false,
            error: 'Circular must be acknowledged before submitting an action plan',
            regulatoryRef: 'FDL 10/2025 Art. 15',
          },
          { status: 422 },
        );
      }

      // Already submitted?
      if (acknowledgment.actionPlanSubmittedAt) {
        return NextResponse.json(
          {
            success: false,
            error: 'Action plan already submitted for this circular',
            regulatoryRef: 'FDL 10/2025 Art. 15',
          },
          { status: 409 },
        );
      }

      // Update acknowledgment with action plan
      const updatedAcknowledgment = await db.departmentAcknowledgment.update({
        where: { id: acknowledgmentId },
        data: {
          actionPlan,
          actionPlanSubmittedAt: new Date(),
          slaStatus: 'ACTION_PLAN_SUBMITTED',
          updatedAt: new Date(),
        },
      });

      // Audit log with SHA-256
      const hashPayload = JSON.stringify({
        action: 'SUBMIT_ACTION_PLAN',
        acknowledgmentId,
        circularId: acknowledgment.circularId,
        userId: ctx.userId,
        timestamp: new Date().toISOString(),
      });
      const sha256Hash = createHash('sha256').update(hashPayload).digest('hex');

      await createAuditLog({
        userId: ctx.userId,
        action: 'SUBMIT_ACTION_PLAN',
        resourceType: 'DepartmentAcknowledgment',
        resourceId: acknowledgmentId,
        details: `Department head submitted action plan for circular ${acknowledgment.circularId}`,
        ipAddress: ctx.ipAddress,
      });

      return NextResponse.json({
        success: true,
        data: { ...updatedAcknowledgment, _auditHash: sha256Hash },
      });
    } catch (error) {
      console.error('Failed to submit action plan:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to submit action plan' },
        { status: 500 },
      );
    }
  },
  'canAcknowledgeCircular',
);
