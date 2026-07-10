import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { maskListPII } from '@/lib/pii';
import { applyRateLimit } from '@/lib/rate-limit';

const amlQuerySchema = z.object({
  jurisdiction: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const amlPatchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['new', 'triage', 'investigating', 'sar_filed', 'closed', 'escalated']),
  userId: z.string().optional(),
}).strict();

const amlPostSchema = z.object({
  alertId: z.string().min(1),
  action: z.enum(['approve', 'escalate', 'override']),
  userId: z.string().optional(),
  justification: z.string().optional(),
}).strict();

// Helper to map DB record to frontend AMLAlertCase shape
function mapAlertToFE(alert: Awaited<ReturnType<typeof db.aMLAlert.findFirst>>) {
  if (!alert) return null;
  return {
    id: alert.id,
    caseId: alert.caseId,
    riskScore: alert.riskScore ?? 0,
    riskLevel: alert.riskLevel,
    alertType: alert.alertType,
    description: alert.description,
    aiFlags: alert.aiFlags ? alert.aiFlags.split(',').map((s: string) => s.trim()) : [],
    goAMLDraft: alert.goAMLDraft ?? '',
    status: alert.status,
    assignedTo: alert.assignedTo ?? '',
    createdBy: alert.createdBy ?? '',
    jurisdiction: alert.jurisdiction,
    amount: alert.amount ?? 0,
    policyNumber: alert.policyNumber,
    createdAt: alert.createdAt.toISOString(),
  };
}

// GET /api/aml - Get AML alerts from the database
export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;
    const { searchParams } = new URL(request.url);
    const queryParsed = amlQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!queryParsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: queryParsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const jurisdiction = queryParsed.data.jurisdiction || 'ALL';
    const status = queryParsed.data.status;
    const page = queryParsed.data.page;
    const limit = queryParsed.data.limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (jurisdiction !== 'ALL') where.jurisdiction = jurisdiction;

    const [alerts, total] = await Promise.all([
      db.aMLAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.aMLAlert.count({ where }),
    ]);

    const mapped = alerts.map((a) => mapAlertToFE(a));

    return NextResponse.json({
      success: true,
      data: maskListPII(mapped),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), jurisdiction },
    });
  } catch (error) {
    console.error('[AML API] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch AML alerts' },
      { status: 500 }
    );
  }
}

// PATCH /api/aml - Update alert status (with audit trail)
export async function PATCH(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;
    const parsed = amlPatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { id, status, userId } = parsed.data;

    // Check if alert exists
    const existing = await db.aMLAlert.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }

    // Maker/Checker enforcement: cannot approve own record
    if (status === 'sar_filed' && existing.createdBy && existing.createdBy === userId) {
      return NextResponse.json({
        success: false,
        error: 'Security Violation: Maker/Checker Breach. You cannot approve a record you created. Escalate to Manager.',
        code: 'MAKER_CHECKER_VIOLATION',
      }, { status: 403 });
    }

    // Update the alert status
    const updated = await db.aMLAlert.update({
      where: { id },
      data: {
        status,
        approvedBy: status === 'sar_filed' ? userId : existing.approvedBy,
      },
    });

    // Create audit log entry
    await db.auditLog.create({
      data: {
        userId: userId ?? 'unknown',
        action: `ALERT_STATUS_CHANGE:${existing.status}->${status}`,
        resource: 'AMLAlert',
        resourceId: updated.caseId,
        details: `Status changed from ${existing.status} to ${status}`,
        sha256Hash: `${existing.caseId}:${existing.status}:${status}:${new Date().toISOString()}`.replace(/[^\w:]/g, ''),
      },
    });

    return NextResponse.json({
      success: true,
      data: mapAlertToFE(updated),
      message: `Alert ${updated.caseId} status updated to ${status}`,
    });
  } catch (error) {
    console.error('[AML API] PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update alert status' },
      { status: 500 }
    );
  }
}

// POST /api/aml - Update alert status (legacy, with Maker/Checker validation)
export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;
    const parsed = amlPostSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { alertId, action, userId, justification } = parsed.data;

    // Find the alert
    const alert = await db.aMLAlert.findUnique({ where: { id: alertId } });
    if (!alert) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }

    // Maker/Checker enforcement
    if (action === 'approve' && alert.createdBy && alert.createdBy === userId) {
      return NextResponse.json({
        success: false,
        error: 'Security Violation: Maker/Checker Breach. You cannot approve a record you created. Escalate to Manager.',
        code: 'MAKER_CHECKER_VIOLATION',
      }, { status: 403 });
    }

    // Map action to status
    const actionStatusMap: Record<string, string> = {
      approve: 'sar_filed',
      escalate: 'escalated',
      override: 'investigating',
    };
    const newStatus = actionStatusMap[action] ?? alert.status;

    // Update the alert
    const updated = await db.aMLAlert.update({
      where: { id: alertId },
      data: {
        status: newStatus,
        approvedBy: action === 'approve' ? userId : alert.approvedBy,
      },
    });

    // Create audit log entry
    await db.auditLog.create({
      data: {
        userId: userId ?? 'unknown',
        action: action.toUpperCase(),
        resource: 'AMLAlert',
        resourceId: updated.caseId,
        details: justification ?? `Action '${action}' applied to alert ${updated.caseId}`,
        sha256Hash: `${updated.caseId}:${action}:${new Date().toISOString()}`.replace(/[^\w:]/g, ''),
      },
    });

    return NextResponse.json({
      success: true,
      data: mapAlertToFE(updated),
      message: `Alert ${alertId} action '${action}' processed successfully`,
    });
  } catch (error) {
    console.error('[AML API] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process alert action' },
      { status: 500 }
    );
  }
}
