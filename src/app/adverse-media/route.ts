import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { maskListPII } from '@/lib/pii';
import { applyRateLimit } from '@/lib/rate-limit';
import { withAuditLog } from '@/lib/audit-worm';

// --- Zod Schemas ---

const adverseMediaQuerySchema = z.object({
  subjectType: z.string().optional(),
  decision: z.string().optional(),
  search: z.string().optional(),
});

const adverseMediaCreateSchema = z.object({
  subjectType: z.enum(['INDIVIDUAL', 'ENTITY']),
  subjectName: z.string().min(1),
  aka: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  searchConfig: z.string().optional(),
  results: z.string().optional(),
  decision: z.string().nullable().optional(),
  rationale: z.string().nullable().optional(),
  esgRiskTags: z.string().optional(),
  esgRiskScore: z.number().int().min(0).max(100).optional(),
  createdBy: z.string().min(1),
}).strict();

const adverseMediaUpdateSchema = z.object({
  id: z.string().min(1),
  subjectType: z.enum(['INDIVIDUAL', 'ENTITY']).optional(),
  subjectName: z.string().min(1).optional(),
  aka: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  searchConfig: z.string().optional(),
  results: z.string().optional(),
  decision: z.string().nullable().optional(),
  rationale: z.string().nullable().optional(),
  esgRiskTags: z.string().optional(),
  esgRiskScore: z.number().int().min(0).max(100).optional(),
}).strict();

const adverseMediaDeleteSchema = z.object({
  id: z.string().min(1),
});

// GET /api/adverse-media - List adverse media screening sessions with optional filters
export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;
    const { searchParams } = new URL(request.url);
    const parsed = adverseMediaQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { subjectType, decision, search } = parsed.data;

    const where: Record<string, unknown> = {};

    if (subjectType) {
      where.subjectType = subjectType;
    }
    if (decision) {
      where.decision = decision;
    }
    if (search) {
      where.subjectName = { contains: search };
    }

    const sessions = await db.adverseMediaSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: maskListPII(sessions) });
  } catch (error) {
    console.error('Failed to fetch adverse media sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch adverse media sessions' },
      { status: 500 }
    );
  }
}

// POST /api/adverse-media - Create a new adverse media screening session
export const POST = withAuditLog(
  async (request: NextRequest) => {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;
    const body = await request.json();
    const parsed = adverseMediaCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const session = await db.adverseMediaSession.create({
      data: {
        subjectType: data.subjectType,
        subjectName: data.subjectName,
        aka: data.aka ?? null,
        nationality: data.nationality ?? null,
        searchConfig: data.searchConfig ?? '{}',
        results: data.results ?? '[]',
        decision: data.decision ?? null,
        rationale: data.rationale ?? null,
        esgRiskTags: data.esgRiskTags ?? '[]',
        esgRiskScore: data.esgRiskScore ?? 0,
        createdBy: data.createdBy,
      },
    });

    return NextResponse.json({ success: true, data: session }, { status: 201 });
  } catch (error) {
    console.error('Failed to create adverse media session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create adverse media session' },
      { status: 500 }
    );
  }
  },
  { entityType: 'AdverseMedia' }
);

// PUT /api/adverse-media - Update an adverse media screening session
export const PUT = withAuditLog(
  async (request: NextRequest) => {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;
    const body = await request.json();
    const parsed = adverseMediaUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { id, ...updateFields } = parsed.data;

    const existing = await db.adverseMediaSession.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Adverse media session not found' },
        { status: 404 }
      );
    }

    // Build update data using only validated fields (exclude id)
    const updateData: Record<string, unknown> = {};
    if (updateFields.subjectType !== undefined) updateData.subjectType = updateFields.subjectType;
    if (updateFields.subjectName !== undefined) updateData.subjectName = updateFields.subjectName;
    if (updateFields.aka !== undefined) updateData.aka = updateFields.aka;
    if (updateFields.nationality !== undefined) updateData.nationality = updateFields.nationality;
    if (updateFields.searchConfig !== undefined) updateData.searchConfig = updateFields.searchConfig;
    if (updateFields.results !== undefined) updateData.results = updateFields.results;
    if (updateFields.decision !== undefined) updateData.decision = updateFields.decision;
    if (updateFields.rationale !== undefined) updateData.rationale = updateFields.rationale;
    if (updateFields.esgRiskTags !== undefined) updateData.esgRiskTags = updateFields.esgRiskTags;
    if (updateFields.esgRiskScore !== undefined) updateData.esgRiskScore = updateFields.esgRiskScore;

    const session = await db.adverseMediaSession.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    console.error('Failed to update adverse media session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update adverse media session' },
      { status: 500 }
    );
  }
  },
  { entityType: 'AdverseMedia' }
);

// DELETE /api/adverse-media - Delete an adverse media screening session
export const DELETE = withAuditLog(
  async (request: NextRequest) => {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;
    const { searchParams } = new URL(request.url);
    const parsed = adverseMediaDeleteSchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { id } = parsed.data;

    const existing = await db.adverseMediaSession.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Adverse media session not found' },
        { status: 404 }
      );
    }

    await db.adverseMediaSession.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Adverse media session deleted',
    });
  } catch (error) {
    console.error('Failed to delete adverse media session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete adverse media session' },
      { status: 500 }
    );
  }
  },
  { entityType: 'AdverseMedia' }
);
