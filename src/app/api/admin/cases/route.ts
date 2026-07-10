import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { withAuditLog } from '@/lib/audit-worm';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createCaseSchema = z.object({
  caseNumber: z.string().min(1, 'Case number is required'),
  title: z.string().min(1, 'Title is required'),
  caseType: z.string().min(1, 'Case type is required'),
  status: z.string().optional(),
  priority: z.string().optional(),
  assignedCounsel: z.string().optional(),
  department: z.string().optional(),
  description: z.string().optional(),
  filingDate: z.string().optional(),
  nextHearing: z.string().optional(),
  resolutionDate: z.string().optional(),
  jurisdiction: z.string().optional(),
  aiSummary: z.string().optional(),
});

const updateCaseSchema = z.object({
  id: z.string().min(1, 'Legal case ID is required'),
  caseNumber: z.string().optional(),
  title: z.string().optional(),
  caseType: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  assignedCounsel: z.string().optional(),
  department: z.string().optional(),
  description: z.string().optional(),
  filingDate: z.string().optional(),
  nextHearing: z.string().optional(),
  resolutionDate: z.string().optional(),
  jurisdiction: z.string().optional(),
  aiSummary: z.string().optional(),
});

// GET /api/cases - Fetch legal cases with optional filtering
export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const jurisdiction = searchParams.get('jurisdiction');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};

    if (type) where.caseType = type;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (jurisdiction) where.jurisdiction = jurisdiction;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { caseNumber: { contains: search } },
        { assignedCounsel: { contains: search } },
        { jurisdiction: { contains: search } },
      ];
    }

    const cases = await db.legalCase.findMany({
      where,
      orderBy: { filingDate: 'desc' },
    });

    return NextResponse.json({ success: true, data: cases });
  } catch (error) {
    console.error('Failed to fetch legal cases:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch legal cases' },
      { status: 500 }
    );
  }
}

// POST /api/cases - Create a new legal case
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
    const parsed = createCaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Phase 1 Fix: jurisdiction is required, no CBUAE fallback
    if (!data.jurisdiction) {
      return NextResponse.json(
        { success: false, error: 'jurisdiction is required' },
        { status: 400 },
      );
    }

    const legalCase = await db.legalCase.create({
      data: {
        caseNumber: data.caseNumber,
        title: data.title,
        caseType: data.caseType,
        status: data.status || 'open',
        priority: data.priority || 'normal',
        assignedCounsel: data.assignedCounsel || undefined,
        department: data.department || undefined,
        description: data.description || undefined,
        filingDate: data.filingDate ? new Date(data.filingDate) : undefined,
        nextHearing: data.nextHearing ? new Date(data.nextHearing) : undefined,
        resolutionDate: data.resolutionDate ? new Date(data.resolutionDate) : undefined,
        jurisdiction: data.jurisdiction,
        aiSummary: data.aiSummary || undefined,
      },
    });

    return NextResponse.json({ success: true, data: legalCase }, { status: 201 });
  } catch (error) {
    console.error('Failed to create legal case:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create legal case' },
      { status: 500 }
    );
  }
  },
  { entityType: 'InvestigationCase' }
);

// PUT /api/cases - Update a legal case
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
    const parsed = updateCaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const { id, ...data } = parsed.data;

    // 404 check
    const existing = await db.legalCase.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Legal case not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = { ...data };
    if (data.filingDate) updateData.filingDate = new Date(data.filingDate);
    if (data.nextHearing) updateData.nextHearing = new Date(data.nextHearing);
    if (data.resolutionDate) updateData.resolutionDate = new Date(data.resolutionDate);

    const legalCase = await db.legalCase.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: legalCase });
  } catch (error) {
    console.error('Failed to update legal case:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update legal case' },
      { status: 500 }
    );
  }
  },
  { entityType: 'InvestigationCase' }
);

// DELETE /api/cases - Delete a legal case
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Legal case ID is required' },
        { status: 400 }
      );
    }

    // 404 check
    const existing = await db.legalCase.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Legal case not found' },
        { status: 404 }
      );
    }

    await db.legalCase.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Legal case deleted' });
  } catch (error) {
    console.error('Failed to delete legal case:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete legal case' },
      { status: 500 }
    );
  }
  },
  { entityType: 'InvestigationCase' }
);
