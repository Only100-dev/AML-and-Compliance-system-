/**
 * CAP Kanban Board API
 * FDL 10/2025 Art. 15
 *
 * GET: List corrective action plans with filtering
 * POST: Create new corrective action plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRBAC } from '@/lib/compliance/rbac';
import { createAuditLog } from '@/lib/audit';
import { createUniversalTask } from '@/lib/universal-task';
import { z } from 'zod';
import { createHash } from 'crypto';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createCAPSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  sourceType: z.enum(['AUDIT_FINDING', 'REGULATORY_TRACKER', 'QA_FINDING'], {
    error: 'sourceType must be one of: AUDIT_FINDING, REGULATORY_TRACKER, QA_FINDING',
  }),
  sourceReferenceId: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical'], {
    error: 'priority must be one of: low, medium, high, critical',
  }),
  assignedToId: z.string().optional(),
  assignedToName: z.string().optional(),
  dueDate: z.string().optional().transform((v) => v ? new Date(v) : undefined),
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

// ─── GET /api/cap/plans ──────────────────────────────────────────────────────

export const GET = withRBAC(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const state = searchParams.get('state');
      const priority = searchParams.get('priority');
      const sourceType = searchParams.get('sourceType');
      const assignedToId = searchParams.get('assignedToId');

      const where: Record<string, unknown> = {};
      if (state) where.state = state;
      if (priority) where.priority = priority;
      if (sourceType) where.sourceType = sourceType;
      if (assignedToId) where.assignedToId = assignedToId;

      const plans = await db.correctiveActionPlan.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { dueDate: 'asc' },
        ],
      });

      return NextResponse.json({ success: true, data: plans });
    } catch (error) {
      console.error('Failed to list corrective action plans:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to list corrective action plans' },
        { status: 500 },
      );
    }
  },
  'canManageCAPKanban',
);

// ─── POST /api/cap/plans ─────────────────────────────────────────────────────

export const POST = withRBAC(
  async (request: NextRequest) => {
    try {
      const ctx = getRBACContext(request);
      const body = await request.json();
      const parsed = createCAPSchema.safeParse(body);

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

      const { title, description, sourceType, sourceReferenceId, priority, assignedToId, assignedToName, dueDate } = parsed.data;

      // Compute SHA-256 hash
      const hashPayload = JSON.stringify({
        action: 'CREATE_CAP',
        title,
        sourceType,
        priority,
        userId: ctx.userId,
        timestamp: new Date().toISOString(),
      });
      const sha256Hash = createHash('sha256').update(hashPayload).digest('hex');

      const plan = await db.correctiveActionPlan.create({
        data: {
          title,
          description,
          sourceType,
          sourceReferenceId: sourceReferenceId ?? null,
          priority,
          state: 'TODO',
          assignedToId: assignedToId ?? null,
          assignedToName: assignedToName ?? null,
          dueDate: dueDate ?? null,
          sha256Hash,
        },
      });

      // Audit log with SHA-256
      await createAuditLog({
        userId: ctx.userId,
        action: 'CREATE_CAP',
        resourceType: 'CorrectiveActionPlan',
        resourceId: plan.id,
        details: `Created corrective action plan "${title}" from ${sourceType}`,
        changes: { title, sourceType, priority, assignedToId: assignedToId ?? null },
        ipAddress: ctx.ipAddress,
      });

      // ─── Surface in the assignee's unified "My Tasks" inbox ─────────────
      // v7.3.0-RC1-uat-ready (Blocker 2): Wire createUniversalTask() into CAP
      // creation so newly-assigned CAPs appear in the assignee's inbox without
      // polling the CAP API. Non-blocking — failure here is logged + swallowed
      // so it can never break the primary CAP creation flow.
      if (assignedToId) {
        await createUniversalTask({
          taskType: 'CAP',
          sourceId: plan.id,
          sourceEntityType: 'CorrectiveActionPlan',
          sourceModule: 'CAP',
          title: `CAP: ${title}`,
          description: `${description}${sourceReferenceId ? ` (source: ${sourceReferenceId})` : ''}`,
          assignedToId,
          assignedToName: assignedToName ?? undefined,
          priority: (priority.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'),
          status: 'OPEN',
          dueDate: dueDate,
        });
      }

      return NextResponse.json({
        success: true,
        data: plan,
      }, { status: 201 });
    } catch (error) {
      console.error('Failed to create corrective action plan:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create corrective action plan' },
        { status: 500 },
      );
    }
  },
  'canManageCAPKanban',
);
