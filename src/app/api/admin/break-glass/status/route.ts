import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';

// ─── GET: Check if user has active break-glass session ──────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId query parameter is required' },
        { status: 400 }
      );
    }

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

    // Find active session
    const session = await db.breakGlassSession.findFirst({
      where: { userId, status: 'active' },
    });

    if (session) {
      return NextResponse.json({
        success: true,
        hasActiveSession: true,
        session,
      });
    }

    return NextResponse.json({
      success: true,
      hasActiveSession: false,
    });
  } catch (error) {
    console.error('[BREAK_GLASS_STATUS_GET] Error checking break-glass status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check break-glass status' },
      { status: 500 }
    );
  }
}
