import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';
import { generateMFASecret, buildOTPAuthURI } from '@/lib/auth-mfa';
import { createAuditLog } from '@/lib/audit';

/**
 * POST /api/auth/mfa/setup
 * Voluntary MFA enrollment (lower-tier roles). Generates a new TOTP secret,
 * stores it on the user's record (mfaSecret) but does NOT yet enable MFA
 * (mfaEnabled stays false). The caller must then POST /mfa/enable with a
 * valid first OTP to activate.
 *
 * Requires an authenticated NextAuth session (the user must be logged in to
 * enroll MFA on their own account). Mandatory-MFA roles (admin/mlro/board)
 * are seeded with a pre-set secret, so they do not need this endpoint.
 */
export async function POST(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }
  const userId = (session.user as { id?: string }).id;
  const email = session.user.email;
  if (!userId || !email) {
    return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
  }

  const secret = generateMFASecret();
  const otpauthUri = buildOTPAuthURI(email, secret);

  await db.user.update({
    where: { id: userId },
    data: { mfaSecret: secret }, // mfaEnabled stays false until /enable
  });

  await createAuditLog({
    userId,
    action: 'MFA_SETUP_INITIATED',
    resourceType: 'user',
    resourceId: userId,
    details: 'MFA secret generated (not yet enabled). Awaiting first-OTP verification.',
  });

  // The secret is returned ONCE so the UI can render a QR code. It is stored
  // hashed-irrelevant (TOTP secrets are not passwords) but should not be
  // re-exposed after this call.
  return NextResponse.json({
    success: true,
    data: { secret, otpauthUri },
  });
}
