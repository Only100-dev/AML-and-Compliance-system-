import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';

// ─── SHA-256 Helper ─────────────────────────────────────────────────────────

function computeSHA256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const activateBreakGlassSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  userName: z.string().min(1, 'User name is required'),
  originalRole: z.string().min(1, 'Original role is required'),
  elevatedRole: z.string().min(1, 'Elevated role is required'),
  justification: z.string().min(10, 'Justification must be at least 10 characters'),
  approverId: z.string().min(1, 'Approver ID is required'),
  approverName: z.string().min(1, 'Approver name is required'),
});

// ─── POST: Activate Break-Glass Session ──────────────────────────────────────
// CBUAE Notice 3551/2021 S3.1 — Break-Glass Emergency Access Protocol

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'SENSITIVE');
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = activateBreakGlassSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
          regulatoryRef: 'CBUAE Notice 3551/2021 S3.1',
        },
        { status: 400 }
      );
    }

    const { userId, userName, originalRole, elevatedRole, justification, approverId, approverName } = parsed.data;

    // Check no existing active session for user
    const existingSession = await db.breakGlassSession.findFirst({
      where: { userId, status: 'active' },
    });

    if (existingSession) {
      return NextResponse.json(
        {
          success: false,
          error: 'Active break-glass session already exists for this user',
          regulatoryRef: 'CBUAE Notice 3551/2021 S3.1 — Only one active session per user',
          existingSessionId: existingSession.id,
        },
        { status: 409 }
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours

    // Create BreakGlassSession
    const session = await db.breakGlassSession.create({
      data: {
        userId,
        userName,
        originalRole,
        elevatedRole,
        justification,
        approverId,
        approverName,
        status: 'active',
        activatedAt: now,
        expiresAt,
      },
    });

    // Create AuditLog entry with SHA-256 hash
    const auditPayload = JSON.stringify({
      action: 'BREAK_GLASS_ACTIVATED',
      userId,
      userName,
      originalRole,
      elevatedRole,
      sessionId: session.id,
      justification,
      approverId,
      approverName,
      timestamp: now.toISOString(),
    });
    const sha256Hash = computeSHA256(auditPayload);

    await db.auditLog.create({
      data: {
        userId,
        action: 'BREAK_GLASS_ACTIVATED',
        resource: 'BreakGlassSession',
        resourceId: session.id,
        details: `Break-glass activated: ${userName} elevated from ${originalRole} to ${elevatedRole}. Approver: ${approverName}`,
        sha256Hash,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: session,
        regulatoryRef: 'CBUAE Notice 3551/2021 S3.1',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[BREAK_GLASS_POST] Error activating break-glass session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to activate break-glass session' },
      { status: 500 }
    );
  }
}

// ─── GET: List Break-Glass Sessions (Monitoring) ────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');

    // Auto-expire any sessions past their TTL
    const now = new Date();
    await db.breakGlassSession.updateMany({
      where: {
        status: 'active',
        expiresAt: { lt: now },
      },
      data: {
        status: 'expired',
      },
    });

    // Build filter
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const sessions = await db.breakGlassSession.findMany({
      where,
      orderBy: { activatedAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    console.error('[BREAK_GLASS_GET] Error listing break-glass sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list break-glass sessions' },
      { status: 500 }
    );
  }
}
