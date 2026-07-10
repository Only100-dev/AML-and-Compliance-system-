import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { AlertStatusUpdateSchema } from '@/lib/validations/alert';
import { applyRateLimit } from '@/lib/rate-limit';

// PATCH /api/alerts/status - Update AML alert status (Kanban drag-and-drop persistence)
export async function PATCH(request: NextRequest) {
  // 1. Authenticate
  const { session, authorized, error } = await authGuard({
    allowedRoles: ['admin', 'mlro', 'compliance_officer', 'compliance_manager'],
  });

  if (!authorized || error) {
    return error ?? NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 },
    );
  }

  const rateLimitError = applyRateLimit({ session, authorized }, request, 'WRITE');
  if (rateLimitError) return rateLimitError;

  // 2. Parse & Validate
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON payload' },
      { status: 400 },
    );
  }

  const parseResult = AlertStatusUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    const fieldErrors = parseResult.error.flatten().fieldErrors;
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: fieldErrors },
      { status: 422 },
    );
  }

  const { alertId, newStatus, justification } = parseResult.data;

  // 3. Check alert exists
  const existing = await db.aMLAlert.findUnique({ where: { id: alertId } });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: `AML alert with ID "${alertId}" not found.` },
      { status: 404 },
    );
  }

  // 4. Business rule: Can't move from closed back to open without justification
  if (existing.status === 'closed' && newStatus !== 'closed' && !justification) {
    return NextResponse.json(
      { success: false, error: 'Reopening a closed alert requires a justification.' },
      { status: 422 },
    );
  }

  // 5. Update the alert status
  const updatedBy = parseResult.data.updatedBy
    ?? (session?.user as Record<string, unknown> | undefined)?.id as string
    ?? 'unknown';

  try {
    const updated = await db.aMLAlert.update({
      where: { id: alertId },
      data: {
        status: newStatus,
        updatedAt: new Date(),
      },
    });

    // 6. Log to audit trail
    await db.auditLog.create({
      data: {
        userId: updatedBy,
        action: `ALERT_STATUS_CHANGE:${existing.status}->${newStatus}`,
        resource: 'AMLAlert',
        resourceId: alertId,
        details: justification || `Status changed from ${existing.status} to ${newStatus}`,
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Alert status updated from "${existing.status}" to "${newStatus}"`,
    });
  } catch (dbError) {
    console.error('[alerts/status] Database error:', dbError);
    return NextResponse.json(
      { success: false, error: 'Failed to update alert status due to a database error.' },
      { status: 500 },
    );
  }
}
