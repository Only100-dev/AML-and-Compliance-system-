import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateCurrentOTP } from '@/lib/auth-mfa';

/**
 * GET /api/auth/mfa/dev-otp?email=...
 * DEV-ONLY convenience: returns the current valid 6-digit TOTP for a given
 * user's MFA secret, so UAT testers can log in as mandatory-MFA users
 * (admin / mlro / board) without a hardware authenticator.
 *
 * CRITICAL: This endpoint is GATED behind `process.env.NODE_ENV === 'development'`
 * and can NEVER execute in production. The check:audit CI script enforces this
 * invariant; removing the guard fails the build.
 *
 * The TOTP verification itself is cryptographically real — a wrong OTP is
 * always rejected by authorize(). This endpoint merely computes the current
 * valid token from the stored secret (exactly what Google Authenticator does
 * locally on a user's phone).
 */
export async function GET(request: NextRequest) {
  // ── DEV-ONLY GUARD (CRITICAL — never remove) ──────────────────────────
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { success: false, error: 'Not available in production' },
      { status: 403 }
    );
  }

  const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ success: false, error: 'Email parameter required' }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { mfaSecret: true, mfaEnabled: true, role: true, name: true },
  });

  if (!user || !user.mfaSecret) {
    return NextResponse.json(
      { success: false, error: 'No MFA secret for this user' },
      { status: 404 }
    );
  }

  const otp = generateCurrentOTP(user.mfaSecret);

  return NextResponse.json({
    success: true,
    data: {
      email,
      name: user.name,
      role: user.role,
      mfaEnabled: user.mfaEnabled,
      otp,
      note: 'DEV ONLY — this token rotates every 30s. Use it in the MFA Code field at login.',
    },
  });
}
