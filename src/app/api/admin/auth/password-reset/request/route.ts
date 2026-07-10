import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { createAuditLog } from '@/lib/audit';

// ─── Phase 2 Directive 2.3: Secure Password Reset — Request ──────────────────
// FDL 10/2025 Art. 15; CBUAE Notice 3551/2021 S3.4 (Cybersecurity).
//
// An admin initiates a password reset for a user. The system:
//   1. Generates a cryptographically-secure random token (32 bytes).
//   2. Stores ONLY the SHA-256 hash of the token (the raw token is NEVER
//      persisted — defend against DB compromise).
//   3. Sets a 15-minute expiry. Single-use (usedAt set on confirm).
//   4. Returns the raw token ONCE for out-of-band delivery (email/preview).
//   5. The old password is NEVER revealed. On confirm, passwordHash is
//      replaced with a fresh bcrypt hash.
//
// Rate-limited to prevent enumeration. Full audit trail.

const RESET_TOKEN_TTL_MINUTES = 15;

const RequestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  reason: z.string().min(10, 'A reason of at least 10 characters is required for audit'),
}).strict();

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { userId, reason } = parsed.data;
    const sessionUser = auth.session?.user as Record<string, unknown> | undefined;
    const adminId = (sessionUser?.userId as string) ?? (sessionUser?.id as string) ?? 'dev-user';
    const adminName = (sessionUser?.name as string) ?? 'Admin';

    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Invalidate any prior unused tokens for this user (single active reset)
    await db.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Generate the raw token + store only its SHA-256 hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? null;

    const tokenRecord = await db.passwordResetToken.create({
      data: {
        userId: targetUser.id,
        userEmail: targetUser.email,
        tokenHash,
        expiresAt,
        requestedById: adminId,
        requestedByName: adminName,
        requestReason: reason,
        createdByIp: clientIp,
      },
    });

    await createAuditLog({
      userId: adminId,
      action: 'PASSWORD_RESET_REQUESTED',
      resourceType: 'User',
      resourceId: targetUser.id,
      details: `Admin ${adminName} initiated a secure password reset for ${targetUser.email} (${targetUser.role}). A time-limited (15-min), single-use, SHA-256-hashed token was generated. The old password was NOT revealed. Reason: ${reason}`,
      previousValue: { passwordResetActive: false },
      newValue: { passwordResetActive: true, tokenId: tokenRecord.id, expiresAt: expiresAt.toISOString() },
    });

    // The raw token is returned ONCE for out-of-band delivery.
    // In production this would be emailed; in UAT/preview it is surfaced here.
    return NextResponse.json({
      success: true,
      data: {
        tokenId: tokenRecord.id,
        userId: targetUser.id,
        userEmail: targetUser.email,
        userName: targetUser.name,
        expiresAt: expiresAt.toISOString(),
        ttlMinutes: RESET_TOKEN_TTL_MINUTES,
        // Raw token returned ONCE — deliver out-of-band. Never persisted.
        resetToken: rawToken,
        // Construct the confirm URL for convenience (token passed as query param)
        confirmUrl: `/api/auth/password-reset/confirm`,
      },
      securityNotes: [
        'The raw token is returned ONCE and is NOT persisted — only its SHA-256 hash is stored.',
        `Token expires in ${RESET_TOKEN_TTL_MINUTES} minutes and is single-use.`,
        'The old password was NOT revealed at any point.',
        'On confirm, passwordHash is replaced with a fresh bcrypt cost-12 hash.',
      ],
      message: `Password reset token generated for ${targetUser.email}. Deliver the token to the user out-of-band. Token expires in ${RESET_TOKEN_TTL_MINUTES} minutes.`,
    });
  } catch (error) {
    console.error('[Password Reset Request API] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate password reset token' }, { status: 500 });
  }
}
