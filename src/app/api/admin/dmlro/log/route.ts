import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';

/**
 * DMLRO Delegation Log API — GAP 2.3
 * Paginated delegation history for WORM audit trail review.
 *
 * Per FDL 10/2025 Art. 13-14 and CBUAE Notice 3551/2021 S3.2:
 *   - All delegation activations/deactivations/expirations are immutably logged
 *   - Log entries support filtering by mlroUserId or deputyUserId
 *   - Pagination with limit/offset for large result sets
 *
 * GET /api/dmlro/log?mlroUserId=xxx&deputyUserId=yyy&limit=20&offset=0
 */

const logQuerySchema = z.object({
  mlroUserId: z.string().optional(),
  deputyUserId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
}).strict();

export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({ requireAuth: true });
    if (!auth.authorized || !auth.session) {
      return auth.error ?? NextResponse.json(
        { success: false, error: 'Authentication required', regulatoryRef: 'FDL 10/2025 Art. 15' },
        { status: 401 }
      );
    }

    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;

    const { searchParams } = new URL(request.url);
    const queryParams = {
      mlroUserId: searchParams.get('mlroUserId') ?? undefined,
      deputyUserId: searchParams.get('deputyUserId') ?? undefined,
      limit: searchParams.get('limit') ?? '20',
      offset: searchParams.get('offset') ?? '0',
    };

    const data = logQuerySchema.parse(queryParams);

    // At least one filter is recommended but not required (admin/auditor may view all)
    const where: Record<string, unknown> = {};
    if (data.mlroUserId) {
      where.mlroUserId = data.mlroUserId;
    }
    if (data.deputyUserId) {
      where.deputyUserId = data.deputyUserId;
    }

    // Fetch total count for pagination metadata
    const total = await db.dMLRODelegationLog.count({ where });

    // Fetch paginated log entries ordered by createdAt DESC
    const logs = await db.dMLRODelegationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: data.limit,
      skip: data.offset,
    });

    return NextResponse.json({
      success: true,
      logs,
      pagination: {
        total,
        limit: data.limit,
        offset: data.offset,
        hasMore: data.offset + data.limit < total,
      },
      regulatoryRef: 'FDL 10/2025 Art. 13-14; CBUAE Notice 3551/2021 S3.2 — WORM Audit Trail',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.errors,
          regulatoryRef: 'FDL 10/2025 Art. 15',
        },
        { status: 400 }
      );
    }
    console.error('[DMLRO-LOG] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch DMLRO delegation log', regulatoryRef: 'FDL 10/2025 Art. 15' },
      { status: 500 }
    );
  }
}
