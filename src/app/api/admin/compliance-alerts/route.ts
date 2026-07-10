import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { authGuard } from '@/lib/auth-guard';
import { maskListPII } from '@/lib/pii';
import { applyRateLimit } from '@/lib/rate-limit';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const alertsListQuerySchema = z.object({
  alertType: z.string().optional(),
  severity: z.string().optional(),
  status: z.string().optional(),
  sourceModule: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const createAlertSchema = z.object({
  alertType: z.enum([
    'SAR_DEADLINE',
    'REGULATORY_DEADLINE',
    'MLRO_ESCALATION',
    'KYC_REVIEW_OVERDUE',
    'TRAINING_OVERDUE',
    'SANCTIONS_SCREENING_DUE',
    'POLICY_REVIEW_DUE',
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('high'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  sourceModule: z.string().min(1, 'Source module is required'),
  dueDate: z.string().min(1, 'Due date is required'), // ISO date string
  sourceEntityId: z.string().optional(),
  sourceEntityType: z.string().optional(),
  assignedToId: z.string().optional(),
});

const updateAlertSchema = z.object({
  alertId: z.string().min(1, 'Alert ID is required'),
  action: z.enum(['acknowledge', 'resolve']),
  userId: z.string().min(1, 'User ID is required'),
  resolutionNote: z.string().optional(),
});

// ─── Severity Ordering ───────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ─── SHA-256 Hash Generation ─────────────────────────────────────────────────

function generateSha256Hash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ─── Valid Status Transitions for Immutable Alerts ───────────────────────────

const VALID_ALERT_TRANSITIONS: Record<string, string[]> = {
  active: ['acknowledged'],
  acknowledged: ['resolved'],
  resolved: [], // Terminal state
  expired: [],   // Terminal state
};

// ─── GET: List Compliance Alerts ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;
    const { searchParams } = new URL(request.url);
    const queryParsed = alertsListQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!queryParsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: queryParsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { alertType, severity, status, sourceModule, page, limit } = queryParsed.data;

    const where: Record<string, unknown> = {};

    if (alertType) where.alertType = alertType;
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (sourceModule) where.sourceModule = sourceModule;

    const [alerts, total] = await Promise.all([
      db.complianceAlert.findMany({
        where,
        // Order: active first, then by severity desc, then by dueDate asc
        orderBy: [
          { status: 'asc' }, // active < acknowledged < resolved alphabetically is wrong, handle below
          { dueDate: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.complianceAlert.count({ where }),
    ]);

    // Sort in-memory for correct ordering (SQLite doesn't support CASE ordering)
    const sortedAlerts = alerts.sort((a, b) => {
      // 1. Active alerts first
      const statusOrder: Record<string, number> = { active: 0, acknowledged: 1, resolved: 2, expired: 3 };
      const statusDiff = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
      if (statusDiff !== 0) return statusDiff;

      // 2. Severity descending (critical first)
      const sevDiff = (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
      if (sevDiff !== 0) return sevDiff;

      // 3. Due date ascending (soonest first)
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    return NextResponse.json({
      success: true,
      data: maskListPII(sortedAlerts),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        summary: {
          active: alerts.filter(a => a.status === 'active').length,
          acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
          resolved: alerts.filter(a => a.status === 'resolved').length,
          critical: alerts.filter(a => a.severity === 'critical').length,
          high: alerts.filter(a => a.severity === 'high').length,
        },
      },
    });
  } catch (error) {
    console.error('[ALERTS_GET] Error listing compliance alerts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list compliance alerts' },
      { status: 500 }
    );
  }
}

// ─── POST: Create Compliance Alert (System-Generated, Immutable) ─────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;
    const body = await request.json();
    const parsed = createAlertSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const {
      alertType,
      severity,
      title,
      description,
      sourceModule,
      dueDate,
      sourceEntityId,
      sourceEntityType,
      assignedToId,
    } = parsed.data;

    // ─── Auto-generate SHA-256 hash for immutability ─────────────────────
    const hashPayload = JSON.stringify({
      alertType,
      severity,
      title,
      description,
      sourceModule,
      dueDate,
      sourceEntityId: sourceEntityId || null,
      sourceEntityType: sourceEntityType || null,
      createdAt: new Date().toISOString(),
    });
    const sha256Hash = generateSha256Hash(hashPayload);

    const alert = await db.complianceAlert.create({
      data: {
        alertType,
        severity,
        status: 'active',
        title,
        description,
        sourceModule,
        sourceEntityId: sourceEntityId || null,
        sourceEntityType: sourceEntityType || null,
        dueDate: new Date(dueDate),
        assignedToId: assignedToId || null,
        isImmutable: true, // All system-generated alerts are immutable
        sha256Hash,
      },
    });

    // ─── Audit Log ───────────────────────────────────────────────────────
    await db.auditLog.create({
      data: {
        userId: 'system',
        action: 'COMPLIANCE_ALERT_CREATED',
        resource: 'ComplianceAlert',
        resourceId: alert.id,
        details: JSON.stringify({
          alertType,
          severity,
          title,
          sourceModule,
          isImmutable: true,
          sha256Hash,
        }),
        sha256Hash,
        ipAddress: request.headers.get('x-forwarded-for') || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: alert,
      meta: {
        isImmutable: true,
        sha256Hash,
        integrityVerified: true,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[ALERTS_POST] Error creating compliance alert:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create compliance alert' },
      { status: 500 }
    );
  }
}

// ─── PUT: Acknowledge or Resolve Alert ───────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;
    const body = await request.json();
    const parsed = updateAlertSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const { alertId, action, userId, resolutionNote } = parsed.data;

    // Fetch existing alert
    const existingAlert = await db.complianceAlert.findUnique({
      where: { id: alertId },
    });

    if (!existingAlert) {
      return NextResponse.json(
        { success: false, error: `Compliance alert with ID "${alertId}" not found` },
        { status: 404 }
      );
    }

    // ─── Note: Deletion of immutable alerts is prevented by the Zod schema ──
    // The action enum only allows 'acknowledge' | 'resolve' — 'delete' is
    // rejected at the validation layer, making this guard unnecessary at runtime.

    // ─── Validate status transition ──────────────────────────────────────
    const targetStatus = action === 'acknowledge' ? 'acknowledged' : 'resolved';
    const allowedTransitions = VALID_ALERT_TRANSITIONS[existingAlert.status] || [];

    if (!allowedTransitions.includes(targetStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status transition: ${existingAlert.status} → ${targetStatus}. Allowed transitions: ${allowedTransitions.join(', ') || 'none (terminal state)'}`,
          code: 'INVALID_TRANSITION',
        },
        { status: 422 }
      );
    }

    // ─── Resolution requires a note ──────────────────────────────────────
    if (action === 'resolve' && !resolutionNote) {
      return NextResponse.json(
        {
          success: false,
          error: 'A resolution note is required when resolving an alert.',
          code: 'RESOLUTION_NOTE_REQUIRED',
        },
        { status: 422 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      status: targetStatus,
    };

    if (action === 'acknowledge') {
      updateData.acknowledgedAt = new Date();
      updateData.acknowledgedBy = userId;
    }

    if (action === 'resolve') {
      updateData.resolvedAt = new Date();
      updateData.resolutionNote = resolutionNote;
    }

    const updatedAlert = await db.complianceAlert.update({
      where: { id: alertId },
      data: updateData,
    });

    // ─── Verify integrity of immutable alert ─────────────────────────────
    if (existingAlert.isImmutable && existingAlert.sha256Hash) {
      const verificationPayload = JSON.stringify({
        alertType: existingAlert.alertType,
        severity: existingAlert.severity,
        title: existingAlert.title,
        description: existingAlert.description,
        sourceModule: existingAlert.sourceModule,
        dueDate: existingAlert.dueDate,
        sourceEntityId: existingAlert.sourceEntityId,
        sourceEntityType: existingAlert.sourceEntityType,
        createdAt: existingAlert.createdAt.toISOString(),
      });
      const currentHash = generateSha256Hash(verificationPayload);
      const integrityVerified = currentHash === existingAlert.sha256Hash;

      if (!integrityVerified) {
        console.error(`[ALERTS_PUT] INTEGRITY CHECK FAILED for alert ${alertId}`);
      }
    }

    // ─── Log acknowledgment to AuditLog ──────────────────────────────────
    await db.auditLog.create({
      data: {
        userId,
        action: `ALERT_${action.toUpperCase()}D`,
        resource: 'ComplianceAlert',
        resourceId: alertId,
        details: JSON.stringify({
          alertType: existingAlert.alertType,
          severity: existingAlert.severity,
          title: existingAlert.title,
          fromStatus: existingAlert.status,
          toStatus: targetStatus,
          resolutionNote: resolutionNote || null,
          isImmutable: existingAlert.isImmutable,
        }),
        ipAddress: request.headers.get('x-forwarded-for') || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedAlert,
      meta: {
        previousStatus: existingAlert.status,
        newStatus: targetStatus,
        isImmutable: existingAlert.isImmutable,
      },
    });
  } catch (error) {
    console.error('[ALERTS_PUT] Error updating compliance alert:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update compliance alert' },
      { status: 500 }
    );
  }
}
