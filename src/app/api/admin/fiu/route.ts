/**
 * Generic FIU Filing CRUD — Multi-Jurisdictional SAR/STR Filing
 *
 * Replaces the UAE-only /api/goaml CRUD with a jurisdiction-aware endpoint
 * that works across all 6 GCC jurisdictions (AE, SA, BH, QA, OM, KW).
 *
 * State Machine: DRAFT → PENDING_REVIEW → APPROVED → SUBMITTED_TO_FIU → ACKNOWLEDGED
 * Any status can transition to MANUAL_FALLBACK or REJECTED.
 *
 * PRINCIPLE A: Filing accuracy is criminal liability.
 * PRINCIPLE D: Audit every filing with WORM audit log.
 * PRINCIPLE F: Maker-Checker enforcement (4-Eyes workflow).
 *
 * Phase 4 (Action 4.1): Generic FIU filing CRUD.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { createAuditLog } from '@/lib/audit';
import { maskListPII } from '@/lib/pii';
import { calculateFilingDeadline, getFilingDeadlineInfo } from '@/lib/fiu/deadline-calculator';
import { z } from 'zod';
import { GCC_JURISDICTION_CODES } from '@/lib/constants/jurisdictions';
import type { GCCJurisdictionCode } from '@/lib/constants/jurisdictions';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const jurisdictionEnum = z.string()
  .refine((val): val is GCCJurisdictionCode => GCC_JURISDICTION_CODES.includes(val as GCCJurisdictionCode), {
    message: 'jurisdiction must be one of: AE, SA, BH, QA, OM, KW',
  });

const createFIUFilingSchema = z.object({
  jurisdiction: jurisdictionEnum,
  reportType: z.enum(['STR', 'SAR', 'CTR', 'IFT', 'PNMR'], {
    error: 'reportType must be one of: STR, SAR, CTR, IFT, PNMR',
  }),
  subjectName: z.string().min(1, 'Subject name is required'),
  amount: z.number().nullable().optional(),
  currency: z.string().optional(),
  narrative: z.string().optional(),
  customerType: z.enum(['individual', 'corporate']).optional(),
  nationalId: z.string().optional(),
  suspiciousActivityType: z.string().optional(),
  suspiciousActivityDescription: z.string().optional(),
});

const updateFIUFilingSchema = z.object({
  filingId: z.string().min(1, 'Filing ID is required'),
  reportType: z.enum(['STR', 'SAR', 'CTR', 'IFT', 'PNMR']).optional(),
  subjectName: z.string().optional(),
  amount: z.number().nullable().optional(),
  currency: z.string().optional(),
  narrative: z.string().optional(),
  customerType: z.enum(['individual', 'corporate']).optional(),
  nationalId: z.string().optional(),
  suspiciousActivityType: z.string().optional(),
  suspiciousActivityDescription: z.string().optional(),
  filingStatus: z.string().optional(),
});

// ─── GET /api/fiu — List filings by jurisdiction ──────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // ── 1. Authenticate & authorize ──────────────────────────────────────────
    const auth = await authGuard({
      allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'],
    });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;

    // ── 2. Parse query parameters ────────────────────────────────────────────
    const { searchParams } = new URL(request.url);
    const jurisdiction = searchParams.get('jurisdiction');
    const status = searchParams.get('status');
    const reportType = searchParams.get('reportType');
    const search = searchParams.get('search');

    // Validate jurisdiction if provided
    if (jurisdiction && !GCC_JURISDICTION_CODES.includes(jurisdiction as GCCJurisdictionCode)) {
      return NextResponse.json(
        { success: false, error: `Invalid jurisdiction: ${jurisdiction}. Must be one of: ${GCC_JURISDICTION_CODES.join(', ')}` },
        { status: 400 },
      );
    }

    // ── 3. Build filter conditions ───────────────────────────────────────────
    const where: Record<string, unknown> = {};

    if (jurisdiction) {
      where.jurisdiction = jurisdiction;
    }
    if (status) {
      where.filingStatus = status.toUpperCase();
    }
    if (reportType) {
      where.reportType = reportType;
    }
    if (search) {
      where.OR = [
        { subjectName: { contains: search } },
        { referenceNumber: { contains: search } },
      ];
    }

    // ── 4. Fetch filings ─────────────────────────────────────────────────────
    const filings = await db.goAMLFiling.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // ── 5. Mask PII and return ───────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      data: maskListPII(filings),
      count: filings.length,
    });
  } catch (error) {
    console.error('[FIU_CRUD] Failed to fetch FIU filings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch FIU filings' },
      { status: 500 },
    );
  }
}

// ─── POST /api/fiu — Create a new filing ─────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── 1. Authenticate & authorize ──────────────────────────────────────────
    const auth = await authGuard({
      allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'],
    });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;

    // ── 2. Parse & validate body ─────────────────────────────────────────────
    const body = await request.json();
    const parsed = createFIUFilingSchema.safeParse(body);

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
        { status: 400 },
      );
    }

    const data = parsed.data;
    const jurisdiction = data.jurisdiction as GCCJurisdictionCode;

    // ── 3. Calculate filing deadline ─────────────────────────────────────────
    const detectionDate = new Date();
    const filingDeadline = calculateFilingDeadline(detectionDate, jurisdiction);
    const deadlineInfo = getFilingDeadlineInfo(detectionDate, jurisdiction);

    // ── 4. Generate reference number ─────────────────────────────────────────
    const referenceNumber = `FIU-${jurisdiction}-${data.reportType}-${Date.now()}`;

    // ── 5. Resolve user identity ─────────────────────────────────────────────
    const sessionUser = auth.session?.user as Record<string, unknown> | undefined;
    const userId = (sessionUser?.id as string) || (sessionUser?.userId as string) || 'system';
    const userName = (sessionUser?.name as string) || 'System';

    // ── 6. Create the filing ─────────────────────────────────────────────────
    const filing = await db.goAMLFiling.create({
      data: {
        reportType: data.reportType,
        referenceNumber,
        subjectName: data.subjectName,
        amountAED: data.amount || null,
        filingStatus: 'DRAFT',
        xmlPayload: '', // Will be populated by adapter on submission
        jurisdiction: jurisdiction,
      },
    });

    // ── 7. Audit log the creation ────────────────────────────────────────────
    await createAuditLog({
      userId,
      action: 'FIU_FILING_CREATED',
      resourceType: 'GoAMLFiling',
      resourceId: filing.id,
      details: JSON.stringify({
        jurisdiction: jurisdiction,
        reportType: data.reportType,
        referenceNumber,
        filingStatus: 'DRAFT',
        deadlineInfo: {
          deadlineDate: filingDeadline.toISOString(),
          daysRemaining: deadlineInfo.daysRemaining,
          deadlineType: deadlineInfo.deadlineType,
          isCritical: deadlineInfo.isCritical,
        },
        createdBy: userName,
      }),
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    // ── 8. Return the created filing ─────────────────────────────────────────
    return NextResponse.json(
      {
        success: true,
        data: filing,
        deadlineInfo: {
          deadlineDate: filingDeadline.toISOString(),
          daysRemaining: deadlineInfo.daysRemaining,
          deadlineType: deadlineInfo.deadlineType,
          isCritical: deadlineInfo.isCritical,
          isOverdue: deadlineInfo.isOverdue,
          regulator: deadlineInfo.regulator,
        },
        message: `FIU filing created as DRAFT for ${data.jurisdiction}. Deadline: ${filingDeadline.toISOString().split('T')[0]}`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[FIU_CRUD] Failed to create FIU filing:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create FIU filing' },
      { status: 500 },
    );
  }
}

// ─── PUT /api/fiu — Update a filing ──────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    // ── 1. Authenticate & authorize ──────────────────────────────────────────
    const auth = await authGuard({
      allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'],
    });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;

    // ── 2. Parse & validate body ─────────────────────────────────────────────
    const body = await request.json();
    const parsed = updateFIUFilingSchema.safeParse(body);

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
        { status: 400 },
      );
    }

    const { filingId, ...updateFields } = parsed.data;

    // ── 3. Verify filing exists ──────────────────────────────────────────────
    const existing = await db.goAMLFiling.findUnique({ where: { id: filingId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'FIU filing not found' },
        { status: 404 },
      );
    }

    // ── 4. Prevent modification of submitted/approved filings ────────────────
    const immutableStatuses = ['SUBMITTED_TO_FIU', 'ACKNOWLEDGED', 'APPROVED'];
    if (immutableStatuses.includes(existing.filingStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot modify filing in "${existing.filingStatus}" status. Only DRAFT filings can be edited.`,
        },
        { status: 409 },
      );
    }

    // ── 5. Build update data ─────────────────────────────────────────────────
    const updateData: Record<string, unknown> = {};
    if (updateFields.reportType !== undefined) updateData.reportType = updateFields.reportType;
    if (updateFields.subjectName !== undefined) updateData.subjectName = updateFields.subjectName;
    if (updateFields.amount !== undefined) updateData.amountAED = updateFields.amount;
    if (updateFields.filingStatus !== undefined) updateData.filingStatus = updateFields.filingStatus.toUpperCase();

    // Don't allow empty update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 },
      );
    }

    // ── 6. Update the filing ─────────────────────────────────────────────────
    const updatedFiling = await db.goAMLFiling.update({
      where: { id: filingId },
      data: updateData,
    });

    // ── 7. Audit log the update ──────────────────────────────────────────────
    const sessionUser = auth.session?.user as Record<string, unknown> | undefined;
    const userId = (sessionUser?.id as string) || (sessionUser?.userId as string) || 'system';

    await createAuditLog({
      userId,
      action: 'FIU_FILING_UPDATED',
      resourceType: 'GoAMLFiling',
      resourceId: filingId,
      details: JSON.stringify({
        jurisdiction: existing.jurisdiction,
        referenceNumber: existing.referenceNumber,
        changes: Object.keys(updateData),
        previousValues: Object.fromEntries(
          Object.keys(updateData).map(key => [key, (existing as Record<string, unknown>)[key]])
        ),
      }),
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({
      success: true,
      data: updatedFiling,
    });
  } catch (error) {
    console.error('[FIU_CRUD] Failed to update FIU filing:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update FIU filing' },
      { status: 500 },
    );
  }
}
