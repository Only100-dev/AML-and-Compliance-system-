import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { BCPUpdateSchema } from '@/lib/validations/bcp';
import crypto from 'crypto';

// ─── PATCH /api/bcp/[id] — Update a BCP/DRP plan ────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;

    const { id } = await params;
    const body = await request.json();

    // Validate with BCPUpdateSchema, merging URL id into body
    const parsed = BCPUpdateSchema.safeParse({ ...body, id });

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
        { status: 400 }
      );
    }

    const data = parsed.data;
    const { id: _planId, ...updateFields } = data;

    // Fetch existing plan
    const existing = await db.businessContinuityPlan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'BCP plan not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (updateFields.planType) updateData.planType = updateFields.planType;
    if (updateFields.title) updateData.title = updateFields.title;
    if (updateFields.version) updateData.version = updateFields.version;
    if (updateFields.status) updateData.status = updateFields.status;
    if (updateFields.lastTestedDate !== undefined) updateData.lastTestedDate = updateFields.lastTestedDate ?? null;
    if (updateFields.nextTestDate !== undefined) updateData.nextTestDate = updateFields.nextTestDate ?? null;
    if (updateFields.testFrequency) updateData.testFrequency = updateFields.testFrequency;
    if (updateFields.documentUrl !== undefined) updateData.documentUrl = updateFields.documentUrl ?? null;
    if (updateFields.owner !== undefined) updateData.owner = updateFields.owner ?? null;
    if (updateFields.department !== undefined) updateData.department = updateFields.department ?? null;
    if (updateFields.rtoHours !== undefined) updateData.rtoHours = updateFields.rtoHours ?? null;
    if (updateFields.rpoHours !== undefined) updateData.rpoHours = updateFields.rpoHours ?? null;
    if (updateFields.description !== undefined) updateData.description = updateFields.description ?? null;
    if (updateFields.isActive !== undefined) updateData.isActive = updateFields.isActive;

    // Update the plan
    const updatedPlan = await db.businessContinuityPlan.update({
      where: { id },
      data: updateData,
    });

    // ─── Audit logging ──────────────────────────────────────────────────────

    const userId = (auth.session?.user as Record<string, unknown>)?.userId as string
      || (auth.session?.user as Record<string, unknown>)?.id as string
      || 'unknown';

    // If status changed, log BCP_STATUS_CHANGED audit
    if (updateFields.status && updateFields.status !== existing.status) {
      const statusChangeHash = crypto
        .createHash('sha256')
        .update(JSON.stringify({
          action: 'BCP_STATUS_CHANGED',
          planId: id,
          fromStatus: existing.status,
          toStatus: updateFields.status,
          timestamp: Date.now(),
        }))
        .digest('hex');

      await db.auditLog.create({
        data: {
          userId,
          action: 'BCP_STATUS_CHANGED',
          resource: 'BusinessContinuityPlan',
          resourceId: id,
          details: JSON.stringify({
            fromStatus: existing.status,
            toStatus: updateFields.status,
            title: existing.title,
          }),
          sha256Hash: statusChangeHash,
        },
      });
    }

    // If lastTestedDate changed (meaning a test was logged), log BCP_RESILIENCY_TEST_LOGGED
    // This is critical per the URCREP requirement for immutable audit of resiliency tests
    if (updateFields.lastTestedDate !== undefined) {
      const existingTestedDate = existing.lastTestedDate ? existing.lastTestedDate.toISOString() : null;
      const newTestedDate = updateFields.lastTestedDate ? new Date(updateFields.lastTestedDate).toISOString() : null;

      if (existingTestedDate !== newTestedDate) {
        const testLoggedHash = crypto
          .createHash('sha256')
          .update(JSON.stringify({
            action: 'BCP_RESILIENCY_TEST_LOGGED',
            planId: id,
            previousTestDate: existingTestedDate,
            newTestDate: newTestedDate,
            timestamp: Date.now(),
          }))
          .digest('hex');

        await db.auditLog.create({
          data: {
            userId,
            action: 'BCP_RESILIENCY_TEST_LOGGED',
            resource: 'BusinessContinuityPlan',
            resourceId: id,
            details: JSON.stringify({
              planTitle: existing.title,
              planType: existing.planType,
              previousTestDate: existingTestedDate,
              newTestDate: newTestedDate,
              testFrequency: updatedPlan.testFrequency,
            }),
            sha256Hash: testLoggedHash,
          },
        });
      }
    }

    // General update audit log
    const updateHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ action: 'BCP_PLAN_UPDATED', planId: id, timestamp: Date.now() }))
      .digest('hex');

    await db.auditLog.create({
      data: {
        userId,
        action: 'BCP_PLAN_UPDATED',
        resource: 'BusinessContinuityPlan',
        resourceId: id,
        details: JSON.stringify({
          title: updatedPlan.title,
          updatedFields: Object.keys(updateData),
        }),
        sha256Hash: updateHash,
      },
    });

    return NextResponse.json({ success: true, data: updatedPlan });
  } catch (error) {
    console.error('Failed to update BCP plan:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update BCP plan' },
      { status: 500 }
    );
  }
}
