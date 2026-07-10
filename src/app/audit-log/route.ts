import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { sanitizeObject } from '@/lib/pii';
import { applyRateLimit } from '@/lib/rate-limit';

const auditLogQuerySchema = z.object({
  action: z.string().optional(),
  userId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/**
 * GET /api/audit-log
 * Fetch audit log entries with pagination and filtering.
 * Supports: action, userId, search, page, limit
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer', 'auditor'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;
    const { searchParams } = new URL(request.url);
    const parsed = auditLogQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const action = parsed.data.action;
    const userId = parsed.data.userId;
    const search = parsed.data.search;
    const page = parsed.data.page ?? 1;
    const limit = parsed.data.limit ?? 50;

    const where: Record<string, unknown> = {};
    if (action && action !== 'all') where.action = action;
    if (userId && userId !== 'all') where.userId = userId;

    if (search) {
      where.OR = [
        { action: { contains: search } },
        { resource: { contains: search } },
        { details: { contains: search } },
        { resourceId: { contains: search } },
      ];
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.auditLog.count({ where }),
    ]);

    // Enrich with user names — look up from User table where available,
    // otherwise use a userId-based fallback
    const userIds = [...new Set(logs.map((l) => l.userId))];
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    const data = logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      userName: userMap.get(log.userId) || log.userId,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId || '',
      details: log.details || '',
      aiConfidence: log.aiConfidence,
      sha256Hash: log.sha256Hash || '',
      timestamp: log.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: sanitizeObject(data),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch audit log:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit log entries' },
      { status: 500 },
    );
  }
}
