import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';
import { verifyTOTP } from '@/lib/auth-mfa';
import { createAuditLog } from '@/lib/audit';

const EnableSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
});

/**
 * POST /api/auth/mfa/enable
 * Activates MFA for the authenticated user by verifying the first OTP
 * against the pending secret (set by /mfa/setup). On success, sets
 * `mfaEnabled = true`. From this point, the user must supply a TOTP at
 * every login.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = EnableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { mfaSecret: true, mfaEnabled: true, name: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }
  if (!user.mfaSecret) {
    return NextResponse.json(
      { success: false, error: 'No pending MFA secret. Call /mfa/setup first.' },
      { status: 409 }
    );
  }

  if (!verifyTOTP(parsed.data.otp, user.mfaSecret)) {
    await createAuditLog({
      userId,
      action: 'MFA_ENABLE_FAILED',
      resourceType: 'user',
      resourceId: userId,
      details: 'First-OTP verification failed during MFA enable.',
    });
    return NextResponse.json({ success: false, error: 'Invalid OTP' }, { status: 400 });
  }

  await db.user.update({
    where: { id: userId },
    data: { mfaEnabled: true },
  });

  await createAuditLog({
    userId,
    action: 'MFA_ENABLED',
    resourceType: 'user',
    resourceId: userId,
    details: `MFA enabled for ${user.email}. Future logins require a TOTP.`,
  });

  return NextResponse.json({ success: true, data: { enabled: true } });
}
