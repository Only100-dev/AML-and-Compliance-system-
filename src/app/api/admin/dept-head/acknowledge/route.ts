/**
 * Department Head Acknowledge Circular API
 * FDL 10/2025 Art. 15
 *
 * POST: Acknowledge a circular with SLA tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRBAC } from '@/lib/compliance/rbac';
import { createAuditLog } from '@/lib/audit';
import { completeUniversalTask } from '@/lib/universal-task';
import { z } from 'zod';
import { createHash } from 'crypto';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const acknowledgeCircularSchema = z.object({
  acknowledgmentId: z.string().min(1, 'Acknowledgment ID is required'),
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

// ─── POST /api/dept-head/acknowledge ─────────────────────────────────────────

export const POST = withRBAC(
  async (request: NextRequest) => {
    try {
      const ctx = getRBACContext(request);
      const body = await request.json();
      const parsed = acknowledgeCircularSchema.safeParse(body);

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

      const { acknowledgmentId } = parsed.data;

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
            error: 'You can only acknowledge circulars assigned to you',
            regulatoryRef: 'FDL 10/2025 Art. 15',
          },
          { status: 403 },
        );
      }

      // Already acknowledged?
      if (acknowledgment.acknowledgedAt) {
        return NextResponse.json(
          {
            success: false,
            error: 'Circular already acknowledged',
            regulatoryRef: 'FDL 10/2025 Art. 15',
          },
          { status: 409 },
        );
      }

      // Update acknowledgment
      const updatedAcknowledgment = await db.departmentAcknowledgment.update({
        where: { id: acknowledgmentId },
        data: {
          acknowledgedAt: new Date(),
          slaStatus: 'ACKNOWLEDGED',
          updatedAt: new Date(),
        },
      });

      // Audit log with SHA-256
      const hashPayload = JSON.stringify({
        action: 'ACKNOWLEDGE_CIRCULAR',
        acknowledgmentId,
        circularId: acknowledgment.circularId,
        userId: ctx.userId,
        timestamp: new Date().toISOString(),
      });
      const sha256Hash = createHash('sha256').update(hashPayload).digest('hex');

      await createAuditLog({
        userId: ctx.userId,
        action: 'ACKNOWLEDGE_CIRCULAR',
        resourceType: 'DepartmentAcknowledgment',
        resourceId: acknowledgmentId,
        details: `Department head acknowledged circular ${acknowledgment.circularId}`,
        ipAddress: ctx.ipAddress,
      });

      // ─── Complete the UniversalTask row for this circular acknowledgment ──
      // v7.3.0-RC1-uat-ready (Blocker 2): Once acknowledged, the circular
      // task is removed from the dept head's active inbox (status → DONE).
      // Non-blocking — failure here is logged + swallowed.
      await completeUniversalTask({
        taskType: 'CIRCULAR_ACK',
        sourceId: acknowledgmentId,
        assignedToId: ctx.userId,
      });

      return NextResponse.json({
        success: true,
        data: { ...updatedAcknowledgment, _auditHash: sha256Hash },
      });
    } catch (error) {
      console.error('Failed to acknowledge circular:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to acknowledge circular' },
        { status: 500 },
      );
    }
  },
  'canAcknowledgeCircular',
);
