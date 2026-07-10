/**
 * Master Admin v2 — Secure Password Reset API (Section 10.2)
 * ------------------------------------------------------------------
 * POST /api/admin/users/[id]/reset-password
 *   Issues a secure, time-limited (24-hour) password reset token for a user.
 *
 * CRITICAL SECURITY BOUNDARY:
 *   - An admin can NEVER view, extract, or reveal a user's existing password.
 *   - This endpoint generates a random token, stores only its SHA-256 HASH
 *     (never the plaintext), and returns a mock reset link for the admin to
 *     relay (in production this would be emailed to the user's registered
 *     address by a background mailer).
 *   - The action is logged immutably to the audit trail with before/after
 *     state (previousValue: none, newValue: token-issued metadata).
 *
 * RBAC: admin only (canManageUsers). Maker-Checker is NOT required to ISSUE a
 * reset (the user must still click the link and set a new password), but the
 * issuance is fully audited.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { createAuditLog } from '@/lib/audit';
import crypto from 'crypto';

const RESET_TOKEN_TTL_HOURS = 24;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authGuard({ allowedRoles: ['admin'] });
  if (!auth.authorized) return auth.error;

  const sessionUser = auth.session?.user as Record<string, unknown> | undefined;
  const adminId = (sessionUser?.userId as string) || 'dev-user';
  const adminName = (sessionUser?.name as string) || 'Dev User';

  const rateLimitError = applyRateLimit(auth, request, 'WRITE');
  if (rateLimitError) return rateLimitError;

  const { id } = await params;

  try {
    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, status: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 },
      );
    }

    if (user.status === 'ARCHIVED') {
      return NextResponse.json(
        { success: false, error: 'Cannot reset password for an archived user' },
        { status: 400 },
      );
    }

    // Generate a cryptographically-secure random token (32 bytes → 64 hex chars).
    const plaintextToken = crypto.randomBytes(32).toString('hex');
    // Store ONLY the SHA-256 hash — the plaintext is never persisted.
    const tokenHash = crypto
      .createHash('sha256')
      .update(plaintextToken)
      .digest('hex');

    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_HOURS * 60 * 60 * 1000);

    // Invalidate any prior unused tokens for this user (only one active reset at a time).
    await db.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        createdBy: adminId,
      },
    });

    // Construct a mock reset link. In production a background mailer would email
    // this to the user's registered address; here we return it so the admin/UI
    // can display it for UAT demonstration. The plaintext token is NOT stored.
    const resetLink = `/auth/reset-password?token=${plaintextToken}&email=${encodeURIComponent(user.email)}`;

    // Immutable audit log — before/after state captured.
    await createAuditLog({
      userId: adminId,
      action: 'PASSWORD_RESET_ISSUED',
      resourceType: 'User',
      resourceId: user.id,
      details: `Admin ${adminName} issued a 24h password reset token for ${user.email} (${user.name}). Token HASH stored; plaintext never persisted.`,
      previousValue: JSON.stringify({ passwordResetActive: false }),
      newValue: JSON.stringify({
        passwordResetActive: true,
        expiresAt: expiresAt.toISOString(),
        issuedBy: adminId,
        ttlHours: RESET_TOKEN_TTL_HOURS,
      }),
    });

    return NextResponse.json({
      success: true,
      data: {
        resetLink,
        expiresAt: expiresAt.toISOString(),
        ttlHours: RESET_TOKEN_TTL_HOURS,
        message: `Secure reset link generated (valid ${RESET_TOKEN_TTL_HOURS}h). The user's existing password was NOT revealed. In production this link is emailed to ${user.email}.`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[ADMIN_RESET_PASSWORD] Failed:', message);
    return NextResponse.json(
      { success: false, error: 'Failed to issue password reset' },
      { status: 500 },
    );
  }
}
