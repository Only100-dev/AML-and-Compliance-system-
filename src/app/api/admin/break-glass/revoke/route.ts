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

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const revokeBreakGlassSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  revokedBy: z.string().min(1, 'Revoked by user ID is required'),
});

// ─── POST: Revoke Break-Glass Session ───────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = revokeBreakGlassSchema.safeParse(body);

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

    const { sessionId, revokedBy } = parsed.data;

    // Find session
    const session = await db.breakGlassSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Break-glass session not found' },
        { status: 404 }
      );
    }

    if (session.status !== 'active') {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot revoke session with status "${session.status}". Only active sessions can be revoked.`,
          regulatoryRef: 'CBUAE Notice 3551/2021 S3.1',
        },
        { status: 400 }
      );
    }

    const now = new Date();

    // Update BreakGlassSession
    const updatedSession = await db.breakGlassSession.update({
      where: { id: sessionId },
      data: {
        status: 'revoked',
        revokedAt: now,
      },
    });

    // Create AuditLog with SHA-256 hash
    const auditPayload = JSON.stringify({
      action: 'BREAK_GLASS_REVOKED',
      sessionId,
      userId: session.userId,
      revokedBy,
      timestamp: now.toISOString(),
    });
    const sha256Hash = computeSHA256(auditPayload);

    await db.auditLog.create({
      data: {
        userId: revokedBy,
        action: 'BREAK_GLASS_REVOKED',
        resource: 'BreakGlassSession',
        resourceId: sessionId,
        details: `Break-glass session revoked for user ${session.userName}. Revoked by: ${revokedBy}`,
        sha256Hash,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedSession,
      regulatoryRef: 'CBUAE Notice 3551/2021 S3.1',
    });
  } catch (error) {
    console.error('[BREAK_GLASS_REVOKE_POST] Error revoking break-glass session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to revoke break-glass session' },
      { status: 500 }
    );
  }
}
