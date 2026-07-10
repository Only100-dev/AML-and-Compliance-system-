/**
 * CAP Detail API
 * FDL 10/2025 Art. 15
 *
 * GET: Get specific CAP
 * PUT: Update CAP details (NOT state — use transition endpoint)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRBAC } from '@/lib/compliance/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import { createHash } from 'crypto';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const updateCAPSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  sourceType: z.enum(['AUDIT_FINDING', 'REGULATORY_TRACKER', 'QA_FINDING']).optional(),
  sourceReferenceId: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assignedToId: z.string().nullable().optional(),
  assignedToName: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional().transform((v) => {
    if (v === null || v === undefined) return undefined;
    return new Date(v);
  }),
}).refine((data) => {
  // Disallow state changes via this endpoint
  return !('state' in data);
}, {
  message: 'State changes are not allowed via this endpoint. Use the /transition endpoint.',
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

// ─── GET /api/cap/plans/[id] ─────────────────────────────────────────────────

export const GET = withRBAC(
  async (request: NextRequest, context?: { params: Promise<Record<string, string>> }) => {
    try {
      const params = context ? await context.params : {};
      const { id } = params;

      const plan = await db.correctiveActionPlan.findUnique({ where: { id } });

      if (!plan) {
        return NextResponse.json(
          { success: false, error: 'Corrective action plan not found' },
          { status: 404 },
        );
      }

      return NextResponse.json({ success: true, data: plan });
    } catch (error) {
      console.error('Failed to fetch corrective action plan:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch corrective action plan' },
        { status: 500 },
      );
    }
  },
  'canManageCAPKanban',
);

// ─── PUT /api/cap/plans/[id] ─────────────────────────────────────────────────

export const PUT = withRBAC(
  async (request: NextRequest, context?: { params: Promise<Record<string, string>> }) => {
    try {
      const params = context ? await context.params : {};
      const { id } = params;
      const ctx = getRBACContext(request);

      const existing = await db.correctiveActionPlan.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Corrective action plan not found' },
          { status: 404 },
        );
      }

      const body = await request.json();

      // Block state changes via this endpoint
      if ('state' in body) {
        return NextResponse.json(
          {
            success: false,
            error: 'State changes are not allowed via this endpoint. Use the /transition endpoint.',
            regulatoryRef: 'FDL 10/2025 Art. 15',
          },
          { status: 422 },
        );
      }

      const parsed = updateCAPSchema.safeParse(body);

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

      // Compute SHA-256 hash
      const hashPayload = JSON.stringify({
        action: 'UPDATE_CAP',
        planId: id,
        changes: parsed.data,
        userId: ctx.userId,
        timestamp: new Date().toISOString(),
      });
      const sha256Hash = createHash('sha256').update(hashPayload).digest('hex');

      const plan = await db.correctiveActionPlan.update({
        where: { id },
        data: {
          ...parsed.data,
          sha256Hash,
          updatedAt: new Date(),
        },
      });

      // Audit log with SHA-256
      await createAuditLog({
        userId: ctx.userId,
        action: 'UPDATE_CAP',
        resourceType: 'CorrectiveActionPlan',
        resourceId: id,
        details: `Updated corrective action plan "${existing.title}"`,
        changes: parsed.data as Record<string, unknown>,
        ipAddress: ctx.ipAddress,
      });

      return NextResponse.json({
        success: true,
        data: plan,
      });
    } catch (error) {
      console.error('Failed to update corrective action plan:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update corrective action plan' },
        { status: 500 },
      );
    }
  },
  'canManageCAPKanban',
);
