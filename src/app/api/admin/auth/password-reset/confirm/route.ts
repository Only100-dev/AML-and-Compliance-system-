import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { createAuditLog } from '@/lib/audit';

// ─── Phase 2 Directive 2.3: Secure Password Reset — Confirm ──────────────────
// FDL 10/2025 Art. 15; CBUAE Notice 3551/2021 S3.4 (Cybersecurity).
//
// The user (or admin on their behalf) submits the raw reset token + a new
// password. The system:
//   1. Hashes the submitted token with SHA-256 and looks up the record.
//   2. Validates the token is not expired and not already used.
//   3. Hashes the new password with bcrypt (cost 12) and replaces passwordHash.
//   4. Marks the token as used (single-use enforcement).
//   5. Full audit trail. The old password hash is NEVER returned.
//
// This endpoint is NOT behind authGuard — it is authenticated by the token
// itself (possession of the token IS the authentication). Rate-limited by IP.

const ConfirmSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(12, 'New password must be at least 12 characters'),
  userId: z.string().optional(), // optional explicit user ID for extra safety
}).strict();

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

// Simple in-memory rate limiter for the confirm endpoint (per-IP, 10 req/min).
const confirmAttempts = new Map<string, { count: number; windowStart: number }>();
function rateLimitConfirm(ip: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const windowMs = 60_000;
  const maxAttempts = 10;
  const entry = confirmAttempts.get(ip);
  if (!entry || now - entry.windowStart > windowMs) {
    confirmAttempts.set(ip, { count: 1, windowStart: now });
    return { ok: true };
  }
  entry.count++;
  if (entry.count > maxAttempts) {
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - entry.windowStart)) / 1000) };
  }
  return { ok: true };
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown';
    const rl = rateLimitConfirm(clientIp);
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many password reset attempts. Please try again later.', retryAfter: rl.retryAfter },
        { status: 429, headers: rl.retryAfter ? { 'Retry-After': String(rl.retryAfter) } : {} },
      );
    }

    const body = await request.json();
    const parsed = ConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { token, newPassword, userId: explicitUserId } = parsed.data;

    // Hash the submitted token and look up the record (constant-time via unique index)
    const tokenHash = sha256(token);
    const tokenRecord = await db.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!tokenRecord) {
      // Anti-enumeration: do not reveal whether the token exists
      return NextResponse.json(
        { success: false, error: 'Invalid or expired reset token.' },
        { status: 404 },
      );
    }

    // Check expiry
    if (new Date() > tokenRecord.expiresAt) {
      await db.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() }, // mark as consumed to prevent resurrection
      });
      return NextResponse.json(
        { success: false, error: 'Reset token has expired. Please request a new password reset.' },
        { status: 410 },
      );
    }

    // Check single-use
    if (tokenRecord.usedAt) {
      return NextResponse.json(
        { success: false, error: 'Reset token has already been used. Please request a new password reset.' },
        { status: 409 },
      );
    }

    // Optional explicit userId cross-check
    if (explicitUserId && explicitUserId !== tokenRecord.userId) {
      return NextResponse.json(
        { success: false, error: 'Token does not match the specified user.' },
        { status: 403 },
      );
    }

    // Fetch the user
    const user = await db.user.findUnique({
      where: { id: tokenRecord.userId },
      select: { id: true, email: true, name: true, role: true, isActive: true, passwordHash: true },
    });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User account not found.' }, { status: 404 });
    }
    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Account is deactivated. Password reset is not permitted for inactive accounts.' },
        { status: 403 },
      );
    }

    // Hash the new password with bcrypt (cost 12) and replace the old hash
    const previousHashPresent = !!user.passwordHash;
    const newHash = await hashPassword(newPassword);

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      }),
      db.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await createAuditLog({
      userId: user.id,
      action: 'PASSWORD_RESET_CONFIRMED',
      resourceType: 'User',
      resourceId: user.id,
      details: `Password reset confirmed for ${user.email}. New bcrypt cost-12 hash set. Token ${tokenRecord.id} marked used (single-use). Initiated by admin: ${tokenRecord.requestedByName ?? 'unknown'}. Old password was NOT revealed at any point.`,
      previousValue: { passwordHashPresent: previousHashPresent, passwordHashValue: 'REDACTED' },
      newValue: { passwordHashPresent: true, passwordHashValue: 'REDACTED', resetTokenConsumed: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        userEmail: user.email,
        passwordResetAt: new Date().toISOString(),
      },
      securityNotes: [
        'New password hashed with bcrypt (cost 12) and stored in passwordHash.',
        'The old password hash was overwritten and NEVER revealed.',
        'The reset token has been marked used (single-use enforced).',
        'All active sessions for this user should be invalidated (require re-login).',
      ],
      message: `Password successfully reset for ${user.email}. The user may now log in with the new password.`,
    });
  } catch (error) {
    console.error('[Password Reset Confirm API] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to confirm password reset' }, { status: 500 });
  }
}
