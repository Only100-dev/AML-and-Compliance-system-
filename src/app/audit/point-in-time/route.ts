import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { withRBAC, checkPermission, type ComplianceRole } from '@/lib/compliance/rbac';
import { withAuditLog } from '@/lib/audit-worm';

// ─── SHA-256 Helper ─────────────────────────────────────────────────────────

function computeSHA256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const pointInTimeQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  resource: z.enum(['case', 'alert', 'kyc', 'sar']),
  id: z.string().optional(),
});

// ─── GET: Point-in-Time State Reconstruction (Auditor Time-Travel) ──────────
// FDL 10/2025 Art. 11, 15 — Auditor Time-Travel View

export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // RBAC check
    const userRole = (auth.session?.user as Record<string, unknown>)?.role as string;
    if (!checkPermission(userRole as ComplianceRole, 'canAccessAuditorTimeTravel')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Permission denied: canAccessAuditorTimeTravel',
          regulatoryRef: 'FDL 10/2025 Art. 11, 15; CR 134/2025 Art. 16, 21',
        },
        { status: 403 }
      );
    }

    const rateLimitError = applyRateLimit(auth, request, 'SENSITIVE');
    if (rateLimitError) return rateLimitError;

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    const resource = searchParams.get('resource');
    const resourceId = searchParams.get('id');

    const parsed = pointInTimeQuerySchema.safeParse({
      date: dateStr,
      resource,
      id: resourceId ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
          regulatoryRef: 'FDL 10/2025 Art. 11, 15',
        },
        { status: 400 }
      );
    }

    const { date, resource: resourceType, id } = parsed.data;
    const targetDate = new Date(date + 'T23:59:59.999Z');

    // Fetch AuditLog entries up to target date
    const where: Record<string, unknown> = {
      resource: resourceType,
      createdAt: { lte: targetDate },
    };
    if (id) where.resourceId = id;

    const auditEntries = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    // Verify hash chain integrity
    let prevHash = 'GENESIS';
    let hashChainValid = true;

    for (const entry of auditEntries) {
      const hashPayload = JSON.stringify({
        prevHash,
        action: entry.action,
        resource: entry.resource,
        details: entry.details ?? '',
        createdAt: entry.createdAt.toISOString(),
      });
      const expectedHash = computeSHA256(hashPayload);

      if (entry.sha256Hash && entry.sha256Hash !== expectedHash) {
        hashChainValid = false;
        break;
      }

      prevHash = entry.sha256Hash ?? expectedHash;
    }

    // Reconstruct state by replaying entries
    const reconstructedState: Record<string, unknown> = {};
    const stateHistory: Array<{ action: string; timestamp: string; changes: unknown }> = [];

    for (const entry of auditEntries) {
      const changeEntry = {
        action: entry.action,
        timestamp: entry.createdAt.toISOString(),
        changes: entry.details ? (() => {
          try { return JSON.parse(entry.details); } catch { return entry.details; }
        })() : null,
      };
      stateHistory.push(changeEntry);

      // Apply action to reconstructed state
      switch (entry.action) {
        case 'CREATE':
        case 'CREATED':
          reconstructedState[entry.resourceId ?? 'unknown'] = {
            ...changeEntry.changes as Record<string, unknown>,
            _createdAt: entry.createdAt.toISOString(),
            _createdBy: entry.userId,
          };
          break;
        case 'UPDATE':
        case 'UPDATED':
          if (reconstructedState[entry.resourceId ?? 'unknown']) {
            reconstructedState[entry.resourceId ?? 'unknown'] = {
              ...reconstructedState[entry.resourceId ?? 'unknown'] as Record<string, unknown>,
              ...(changeEntry.changes as Record<string, unknown> ?? {}),
              _updatedAt: entry.createdAt.toISOString(),
              _updatedBy: entry.userId,
            };
          }
          break;
        case 'DELETE':
        case 'DELETED':
          if (reconstructedState[entry.resourceId ?? 'unknown']) {
            (reconstructedState[entry.resourceId ?? 'unknown'] as Record<string, unknown>)._deletedAt = entry.createdAt.toISOString();
            (reconstructedState[entry.resourceId ?? 'unknown'] as Record<string, unknown>)._deletedBy = entry.userId;
          }
          break;
        default:
          // For other action types, record in state
          reconstructedState[`${entry.resourceId ?? 'unknown'}_${entry.action}`] = changeEntry;
          break;
      }
    }

    // Log view in AuditorTimeTravelView with SHA-256
    const authUserId = (auth.session?.user as Record<string, unknown>)?.userId as string
      || (auth.session?.user as Record<string, unknown>)?.id as string
      || 'system';
    const authUserName = (auth.session?.user as Record<string, unknown>)?.name as string ?? 'Unknown';

    const viewLogPayload = JSON.stringify({
      auditorId: authUserId,
      targetDate: targetDate.toISOString(),
      resource: resourceType,
      resourceId: id ?? null,
      hashChainValid,
      timestamp: new Date().toISOString(),
    });
    const viewLogSha256 = computeSHA256(viewLogPayload);

    const viewLog = await db.auditorTimeTravelView.create({
      data: {
        auditorId: authUserId,
        auditorName: authUserName,
        targetDate,
        resource: resourceType,
        resourceId: id ?? null,
        reconstructedState: JSON.stringify(reconstructedState),
        hashChainValid,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        sha256Hash: viewLogSha256,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        viewLogId: viewLog.id,
        targetDate: date,
        resource: resourceType,
        resourceId: id,
        reconstructedState,
        stateHistory,
        hashChainValid,
        totalEntries: auditEntries.length,
        viewLogSha256,
      },
      regulatoryRef: 'FDL 10/2025 Art. 11, 15; CR 134/2025 Art. 16, 21',
    });
  } catch (error) {
    console.error('[AUDIT_POINT_IN_TIME_GET] Error reconstructing point-in-time state:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reconstruct point-in-time state' },
      { status: 500 }
    );
  }
}

// ─── Block POST/PUT/DELETE for Auditor Role ─────────────────────────────────
// Auditors have read-only access — all write operations must be blocked

export const POST = withAuditLog(
  async () => {
  return NextResponse.json(
    {
      success: false,
      error: 'Auditor role is read-only. POST/PUT/DELETE operations are prohibited.',
      regulatoryRef: 'FDL 10/2025 Art. 11, 15 — Auditors have read-only access to time-travel views',
    },
    { status: 403 }
  );
  },
  { entityType: 'PointInTimeAudit' }
);

export const PUT = withAuditLog(
  async () => {
  return NextResponse.json(
    {
      success: false,
      error: 'Auditor role is read-only. POST/PUT/DELETE operations are prohibited.',
      regulatoryRef: 'FDL 10/2025 Art. 11, 15 — Auditors have read-only access to time-travel views',
    },
    { status: 403 }
  );
  },
  { entityType: 'PointInTimeAudit' }
);

export const DELETE = withAuditLog(
  async () => {
  return NextResponse.json(
    {
      success: false,
      error: 'Auditor role is read-only. POST/PUT/DELETE operations are prohibited.',
      regulatoryRef: 'FDL 10/2025 Art. 11, 15 — Auditors have read-only access to time-travel views',
    },
    { status: 403 }
  );
  },
  { entityType: 'PointInTimeAudit' }
);
