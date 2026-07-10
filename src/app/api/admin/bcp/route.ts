import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { BCPCreateSchema } from '@/lib/validations/bcp';
import crypto from 'crypto';

// ─── GET /api/bcp — Fetch BCP/DRP plans with optional filtering ──────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard();
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;

    const { searchParams } = new URL(request.url);
    const planType = searchParams.get('planType');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const isActiveParam = searchParams.get('isActive');

    const where: Record<string, unknown> = {};

    // Default isActive to true if not explicitly set
    if (isActiveParam !== null) {
      where.isActive = isActiveParam === 'true';
    } else {
      where.isActive = true;
    }

    if (planType) where.planType = planType;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { owner: { contains: search } },
        { department: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const plans = await db.businessContinuityPlan.findMany({
      where,
      orderBy: { nextTestDate: 'asc' },
    });

    return NextResponse.json({ success: true, data: plans });
  } catch (error) {
    console.error('Failed to fetch BCP plans:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch BCP plans' },
      { status: 500 }
    );
  }
}

// ─── POST /api/bcp — Create a new BCP/DRP plan ──────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = BCPCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const plan = await db.businessContinuityPlan.create({
      data: {
        planType: data.planType,
        title: data.title,
        version: data.version,
        status: data.status,
        lastTestedDate: data.lastTestedDate,
        nextTestDate: data.nextTestDate,
        testFrequency: data.testFrequency,
        documentUrl: data.documentUrl,
        owner: data.owner,
        department: data.department,
        rtoHours: data.rtoHours,
        rpoHours: data.rpoHours,
        description: data.description,
      },
    });

    // SHA-256 Audit Log
    const userId = (auth.session?.user as Record<string, unknown>)?.userId as string
      || (auth.session?.user as Record<string, unknown>)?.id as string
      || 'unknown';

    const sha256Hash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ action: 'BCP_PLAN_CREATED', planId: plan.id, timestamp: Date.now() }))
      .digest('hex');

    await db.auditLog.create({
      data: {
        userId,
        action: 'BCP_PLAN_CREATED',
        resource: 'BusinessContinuityPlan',
        resourceId: plan.id,
        details: JSON.stringify({ title: data.title, planType: data.planType, version: data.version }),
        sha256Hash,
      },
    });

    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (error) {
    console.error('Failed to create BCP plan:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create BCP plan' },
      { status: 500 }
    );
  }
}
