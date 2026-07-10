import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { autoGenerateGap, escalateOverdueGaps } from '@/lib/gaps/auto-generation';
import { getAssignmentForTheme, resolveOwnerFromDB } from '@/lib/gaps/assignment-engine';
import type { GapTheme, GapSeverity } from '@/lib/gaps/types';
import { GCC_JURISDICTION_CODES } from '@/lib/constants/jurisdictions';
import { withAuditLog } from '@/lib/audit-worm';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createGapSchema = z.object({
  jurisdictionId: z.enum(GCC_JURISDICTION_CODES as unknown as [string, ...string[]]),
  controlId: z.string().optional(),
  theme: z.string().min(1),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  severity: z.enum(['Critical', 'High', 'Medium', 'Low', 'Observation']),
  detectedBy: z.enum(['system', 'user', 'audit', 'regulatory_change']).optional(),
  detectionTrigger: z.record(z.unknown()).optional(),
  autoGenerate: z.boolean().optional(), // If true, uses auto-generation engine
});

const updateGapSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['Open', 'In_Progress', 'Awaiting_Approval', 'Closed', 'Escalated']).optional(),
  ownerId: z.string().optional(),
  ownerName: z.string().optional(),
  remediationNotes: z.string().optional(),
  evidence: z.array(z.unknown()).optional(),
  severity: z.enum(['Critical', 'High', 'Medium', 'Low', 'Observation']).optional(),
  dueDate: z.string().optional(),
});

// GET /api/gaps — Fetch gaps with optional filtering
export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard();
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;

    const { searchParams } = new URL(request.url);
    const jurisdictionId = searchParams.get('jurisdictionId');
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const theme = searchParams.get('theme');
    const isSystemic = searchParams.get('isSystemic');
    const ownerId = searchParams.get('ownerId');

    const where: Record<string, unknown> = {};

    if (jurisdictionId) where.jurisdictionId = jurisdictionId;
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (theme) where.theme = theme;
    if (isSystemic === 'true') where.isSystemic = true;
    if (ownerId) where.ownerId = ownerId;

    // Non-admin users see only their jurisdiction's gaps
    const userJurisdiction = (auth.user as Record<string, unknown>)?.jurisdiction as string | undefined;
    const userRole = (auth.user as Record<string, unknown>)?.role as string | undefined;
    if (userRole !== 'admin' && userJurisdiction && !jurisdictionId) {
      where.jurisdictionId = userJurisdiction;
    }

    const gaps = await db.gap.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Parse JSON fields
    const parsedGaps = gaps.map(gap => ({
      ...gap,
      relatedGapIds: gap.relatedGapIds ? JSON.parse(gap.relatedGapIds) : [],
      evidence: gap.evidence ? JSON.parse(gap.evidence as string) : [],
      detectionTrigger: gap.detectionTrigger ? JSON.parse(gap.detectionTrigger as string) : null,
    }));

    return NextResponse.json({ success: true, data: parsedGaps });
  } catch (error) {
    console.error('Failed to fetch gaps:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch gaps' },
      { status: 500 }
    );
  }
}

// POST /api/gaps — Create a new gap (or auto-generate)
export const POST = withAuditLog(
  async (request: NextRequest) => {
  try {
    const auth = await authGuard();
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = createGapSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) },
        { status: 400 }
      );
    }

    const data = parsed.data;

    if (data.autoGenerate) {
      // Use the auto-generation engine
      const result = await autoGenerateGap({
        jurisdictionId: data.jurisdictionId as 'AE' | 'SA' | 'BH' | 'QA' | 'OM' | 'KW',
        theme: data.theme as GapTheme,
        title: data.title,
        description: data.description,
        severity: data.severity as GapSeverity,
        trigger: (data.detectionTrigger?.trigger as 'regulatory_change' | 'control_failure' | 'audit_finding' | 'missing_control') || 'regulatory_change',
        triggerMetadata: data.detectionTrigger,
        controlId: data.controlId,
      });

      return NextResponse.json({
        success: true,
        data: { gapId: result.gapId, isSystemic: result.isSystemic, relatedGapIds: result.relatedGapIds },
      }, { status: 201 });
    }

    // Manual gap creation
    const assignment = getAssignmentForTheme(data.theme as GapTheme, data.jurisdictionId as 'AE' | 'SA' | 'BH' | 'QA' | 'OM' | 'KW');
    let ownerId = data.detectedBy === 'user' ? (auth.user as Record<string, unknown>)?.id as string : assignment.ownerId;
    let ownerName = data.detectedBy === 'user' ? (auth.user as Record<string, unknown>)?.name as string : assignment.ownerName;

    // Try to resolve real user from DB
    const dbOwner = await resolveOwnerFromDB(assignment.ownerRole, data.jurisdictionId as 'AE' | 'SA' | 'BH' | 'QA' | 'OM' | 'KW');
    if (dbOwner) {
      ownerId = dbOwner.ownerId;
      ownerName = dbOwner.ownerName;
    }

    const { GAP_SEVERITY_CONFIG } = await import('@/lib/gaps/types');
    const severityConfig = GAP_SEVERITY_CONFIG[data.severity as GapSeverity];
    const { addBusinessDaysGCC } = await import('@/lib/fiu/business-days-gcc');
    const dueDate = addBusinessDaysGCC(new Date(), severityConfig.remediationDays, data.jurisdictionId as 'AE' | 'SA' | 'BH' | 'QA' | 'OM' | 'KW');

    const gap = await db.gap.create({
      data: {
        jurisdictionId: data.jurisdictionId,
        controlId: data.controlId,
        theme: data.theme,
        title: data.title,
        description: data.description,
        severity: data.severity,
        status: 'Open',
        detectedBy: data.detectedBy || 'user',
        detectionTrigger: data.detectionTrigger ? JSON.stringify(data.detectionTrigger) : null,
        ownerId,
        ownerName,
        ownerRole: assignment.ownerRole,
        dueDate,
        isSystemic: false,
        relatedGapIds: null,
        evidence: null,
        escalationLevel: 0,
      },
    });

    return NextResponse.json({ success: true, data: gap }, { status: 201 });
  } catch (error) {
    console.error('Failed to create gap:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create gap' },
      { status: 500 }
    );
  }
  },
  { entityType: 'GapAssessment' }
);

// PUT /api/gaps — Update a gap
export const PUT = withAuditLog(
  async (request: NextRequest) => {
  try {
    const auth = await authGuard();
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = updateGapSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) },
        { status: 400 }
      );
    }

    const { id, ...data } = parsed.data;

    const existing = await db.gap.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Gap not found' }, { status: 404 });
    }

    // If closing a gap, set closedDate
    const updateData: Record<string, unknown> = { ...data };
    if (data.status === 'Closed') {
      updateData.closedDate = new Date();
    }
    if (data.evidence) {
      updateData.evidence = JSON.stringify(data.evidence);
    }
    if (data.dueDate) {
      updateData.dueDate = new Date(data.dueDate);
    }

    const gap = await db.gap.update({ where: { id }, data: updateData });

    return NextResponse.json({ success: true, data: gap });
  } catch (error) {
    console.error('Failed to update gap:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update gap' },
      { status: 500 }
    );
  }
  },
  { entityType: 'GapAssessment' }
);
