import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { maskListPII } from '@/lib/pii';
import { applyRateLimit } from '@/lib/rate-limit';
import { ALL_JURISDICTION_CODES } from '@/lib/constants/jurisdictions';
import { withAuditLog } from '@/lib/audit-worm';

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const createCaseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  caseType: z.enum([
    'aml_investigation',
    'sanctions_review',
    'kyc_escalation',
    'fraud_investigation',
    'regulatory_inquiry',
  ]),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  jurisdiction: z.enum([...ALL_JURISDICTION_CODES]).default('CBUAE'),
  description: z.string().optional(),
  linkedAlertIds: z.array(z.string()).optional(),
  linkedKYCIds: z.array(z.string()).optional(),
  linkedSARIds: z.array(z.string()).optional(),
  linkedSanctionsIds: z.array(z.string()).optional(),
  assignedToId: z.string().optional(),
  assignedToName: z.string().optional(),
});

const updateCaseSchema = z.object({
  id: z.string().min(1, 'Case ID is required'),
  status: z.enum(['open', 'in_progress', 'under_review', 'escalated', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  description: z.string().optional(),
  addLinkedAlertIds: z.array(z.string()).optional(),
  removeLinkedAlertIds: z.array(z.string()).optional(),
  addLinkedKYCIds: z.array(z.string()).optional(),
  removeLinkedKYCIds: z.array(z.string()).optional(),
  addLinkedSARIds: z.array(z.string()).optional(),
  removeLinkedSARIds: z.array(z.string()).optional(),
  addLinkedSanctionsIds: z.array(z.string()).optional(),
  removeLinkedSanctionsIds: z.array(z.string()).optional(),
  assignedToId: z.string().optional(),
  assignedToName: z.string().optional(),
  closureNotes: z.string().optional(),
});

// ─── Helper: Generate Case Number ───────────────────────────────────────────

async function generateCaseNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CC-${year}-`;

  // Find the highest existing case number for this year
  const existingCases = await db.complianceCase.findMany({
    where: {
      caseNumber: { startsWith: prefix },
    },
    orderBy: { caseNumber: 'desc' },
    take: 1,
  });

  let nextNumber = 1;
  if (existingCases.length > 0) {
    const lastNumber = existingCases[0].caseNumber.split('-').pop();
    if (lastNumber) {
      nextNumber = parseInt(lastNumber, 10) + 1;
    }
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}

// ─── Helper: Merge JSON Array ───────────────────────────────────────────────

function mergeJsonArray(
  existing: string | null | undefined,
  add: string[] = [],
  remove: string[] = []
): string {
  let arr: string[] = [];
  if (existing) {
    try {
      arr = JSON.parse(existing);
    } catch {
      arr = [];
    }
  }

  // Add new items
  for (const item of add) {
    if (!arr.includes(item)) {
      arr.push(item);
    }
  }

  // Remove items
  arr = arr.filter((item) => !remove.includes(item));

  return JSON.stringify(arr);
}

// ─── GET: List Compliance Cases ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;
    const { searchParams } = new URL(request.url);
    const caseType = searchParams.get('caseType');
    const status = searchParams.get('status');
    const riskLevel = searchParams.get('riskLevel');
    const jurisdiction = searchParams.get('jurisdiction');
    const search = searchParams.get('search');
    const caseNumber = searchParams.get('caseNumber');

    // GET /case-number: Get case by caseNumber
    if (caseNumber) {
      const case_ = await db.complianceCase.findUnique({
        where: { caseNumber },
      });

      if (!case_) {
        return NextResponse.json(
          { success: false, error: 'Case not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: case_ });
    }

    const where: Record<string, unknown> = {};

    if (caseType) where.caseType = caseType;
    if (status) where.status = status;
    if (riskLevel) where.riskLevel = riskLevel;
    if (jurisdiction) where.jurisdiction = jurisdiction;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { caseNumber: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const cases = await db.complianceCase.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: maskListPII(cases) });
  } catch (error) {
    console.error('Failed to fetch compliance cases:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch compliance cases' },
      { status: 500 }
    );
  }
}

// ─── POST: Create Compliance Case ───────────────────────────────────────────

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
    const parseResult = createCaseSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parseResult.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Auto-generate case number
    const caseNumber = await generateCaseNumber();

    const complianceCase = await db.complianceCase.create({
      data: {
        caseNumber,
        title: data.title,
        caseType: data.caseType,
        status: 'open',
        priority: data.priority,
        riskLevel: data.riskLevel,
        jurisdiction: data.jurisdiction,
        description: data.description,
        linkedAlertIds: data.linkedAlertIds ? JSON.stringify(data.linkedAlertIds) : null,
        linkedKYCIds: data.linkedKYCIds ? JSON.stringify(data.linkedKYCIds) : null,
        linkedSARIds: data.linkedSARIds ? JSON.stringify(data.linkedSARIds) : null,
        linkedSanctionsIds: data.linkedSanctionsIds ? JSON.stringify(data.linkedSanctionsIds) : null,
        assignedToId: data.assignedToId,
        assignedToName: data.assignedToName,
      },
    });

    return NextResponse.json({
      success: true,
      data: complianceCase,
      message: `Compliance case created: ${caseNumber}`,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create compliance case:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create compliance case' },
      { status: 500 }
    );
  }
  },
  { entityType: 'ComplianceCase' }
);

// ─── PUT: Update Compliance Case ────────────────────────────────────────────

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
    const parseResult = updateCaseSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parseResult.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const { id, ...updateFields } = data;

    const existing = await db.complianceCase.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Compliance case not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (updateFields.status) updateData.status = updateFields.status;
    if (updateFields.priority) updateData.priority = updateFields.priority;
    if (updateFields.riskLevel) updateData.riskLevel = updateFields.riskLevel;
    if (updateFields.description) updateData.description = updateFields.description;
    if (updateFields.assignedToId) updateData.assignedToId = updateFields.assignedToId;
    if (updateFields.assignedToName) updateData.assignedToName = updateFields.assignedToName;

    // Handle linked entity updates
    if (updateFields.addLinkedAlertIds || updateFields.removeLinkedAlertIds) {
      updateData.linkedAlertIds = mergeJsonArray(
        existing.linkedAlertIds,
        updateFields.addLinkedAlertIds,
        updateFields.removeLinkedAlertIds
      );
    }
    if (updateFields.addLinkedKYCIds || updateFields.removeLinkedKYCIds) {
      updateData.linkedKYCIds = mergeJsonArray(
        existing.linkedKYCIds,
        updateFields.addLinkedKYCIds,
        updateFields.removeLinkedKYCIds
      );
    }
    if (updateFields.addLinkedSARIds || updateFields.removeLinkedSARIds) {
      updateData.linkedSARIds = mergeJsonArray(
        existing.linkedSARIds,
        updateFields.addLinkedSARIds,
        updateFields.removeLinkedSARIds
      );
    }
    if (updateFields.addLinkedSanctionsIds || updateFields.removeLinkedSanctionsIds) {
      updateData.linkedSanctionsIds = mergeJsonArray(
        existing.linkedSanctionsIds,
        updateFields.addLinkedSanctionsIds,
        updateFields.removeLinkedSanctionsIds
      );
    }

    // Handle case closure
    if (updateFields.status === 'closed') {
      updateData.closedAt = new Date();
      if (updateFields.closureNotes) {
        updateData.closureNotes = updateFields.closureNotes;
      }
    }

    const updatedCase = await db.complianceCase.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: updatedCase,
      message: 'Compliance case updated successfully',
    });
  } catch (error) {
    console.error('Failed to update compliance case:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update compliance case' },
      { status: 500 }
    );
  }
  },
  { entityType: 'ComplianceCase' }
);
