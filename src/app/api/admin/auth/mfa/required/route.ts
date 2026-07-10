import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isMFARequired } from '@/lib/auth-mfa';
import { applyRateLimit } from '@/lib/rate-limit';

/**
 * GET /api/auth/mfa/required?email=...
 * Pre-login probe: tells the login UI whether the given account requires an
 * MFA code, so the OTP field can be shown conditionally WITHOUT revealing
 * any secret material. Returns only a boolean — no secrets, no PII beyond
 * whether the email exists + is MFA-gated.
 *
 * Rate-limited (SENSITIVE tier) to prevent email enumeration.
 */
export async function GET(request: NextRequest) {
  const rl = applyRateLimit({ authorized: true, user: { id: 'anon', role: 'public' } } as never, request, 'SENSITIVE');
  if (rl) return rl;

  const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ success: false, error: 'Email parameter required' }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { role: true, mfaEnabled: true, isActive: true },
  });

  // Deliberately do NOT distinguish "no such user" from "not MFA-required"
  // to avoid user-enumeration via this endpoint.
  if (!user || !user.isActive) {
    return NextResponse.json({ success: true, data: { mfaRequired: false } });
  }

  return NextResponse.json({
    success: true,
    data: { mfaRequired: isMFARequired(user) },
  });
}
