import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';

// ─── GET /api/bordereaux — Fetch bordereaux submissions ─────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({
      allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'],
    });
    if (!auth.authorized) {
      return (
        auth.error ??
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const quarter = searchParams.get('quarter');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (quarter) where.quarter = quarter;

    const [submissions, total] = await Promise.all([
      db.bordereauxSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.bordereauxSubmission.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: submissions,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    console.error('Failed to fetch bordereaux submissions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bordereaux submissions' },
      { status: 500 }
    );
  }
}
