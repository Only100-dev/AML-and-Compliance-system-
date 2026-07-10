/**
 * Complaint Management API — CBUAE Notice 3551/2021; FDL 10/2025 Art. 13
 *
 * GET  /api/complaints  — List complaints with filters (status, slaStatus,
 *                         departmentId, complaintType, priority) + pagination.
 * POST /api/complaints  — Intake: creates Complaint + sets CBUAE SLA deadlines
 *                         (5 business days ack / 30 business days resolution) +
 *                         raises a ComplianceAlert so the complaint surfaces in
 *                         the alerting system.
 *
 * State Machine (transitions handled by PUT /api/complaints/[id]/transition):
 *   NEW → ACKNOWLEDGED → INVESTIGATING → RESOLVED → CLOSED
 *                    ↘ REJECTED         ↘ ESCALATED_TO_OMBUDSMAN → CLOSED
 *
 * All routes are withRBAC-protected, createAuditLog-covered, and PII is
 * sanitized at rest by the audit logger (shift-left mandate, Step 2.3).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRBAC, type ComplianceRole } from '@/lib/compliance/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import {
  addBusinessDays,
  ACK_SLA_BUSINESS_DAYS,
  RESOLUTION_SLA_BUSINESS_DAYS,
} from '@/lib/compliance/complaint-sla';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const complaintTypeEnum = z.enum(
  ['CUSTOMER', 'REGULATORY', 'INTERNAL', 'THIRD_PARTY'],
  { error: 'complaintType must be one of: CUSTOMER, REGULATORY, INTERNAL, THIRD_PARTY' },
);
const priorityEnum = z.enum(
  ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
  { error: 'priority must be one of: LOW, MEDIUM, HIGH, CRITICAL' },
);
const intakeChannelEnum = z.enum(
  ['EMAIL', 'PHONE', 'PORTAL', 'LETTER', 'IN_PERSON', 'REGULATOR'],
);

const createComplaintSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(500, 'Subject too long'),
  description: z.string().min(1, 'Description is required'),
  complaintType: complaintTypeEnum,
  priority: priorityEnum.default('MEDIUM'),
  departmentId: z.string().optional(),
  policyId: z.string().optional(),
  claimId: z.string().optional(),
  intakeChannel: intakeChannelEnum.default('PORTAL'),
});

// ─── Helper ──────────────────────────────────────────────────────────────────

function getRBACContext(request: NextRequest) {
  const raw = request.headers.get('x-rbac-context');
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      /* fall through */
    }
  }
  return {
    userId: request.headers.get('x-user-id') ?? 'unknown',
    role: (request.headers.get('x-user-role') as ComplianceRole) ?? 'unknown',
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  };
}

const VALID_STATUS_FILTERS = new Set([
  'NEW',
  'ACKNOWLEDGED',
  'INVESTIGATING',
  'RESOLVED',
  'CLOSED',
  'REJECTED',
  'ESCALATED_TO_OMBUDSMAN',
]);
const VALID_SLA_FILTERS = new Set(['WITHIN_SLA', 'APPROACHING_BREACH', 'BREACHED', 'N/A']);

// ─── GET /api/complaints ─────────────────────────────────────────────────────

export const GET = withRBAC(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get('status');
      const slaStatus = searchParams.get('slaStatus');
      const departmentId = searchParams.get('departmentId');
      const complaintType = searchParams.get('complaintType');
      const priority = searchParams.get('priority');
      const limit = Math.min(
        parseInt(searchParams.get('limit') ?? '50', 10) || 50,
        200,
      );
      const offset = Math.max(
        parseInt(searchParams.get('offset') ?? '0', 10) || 0,
        0,
      );

      // Reject invalid filter values with 400 (do not silently ignore — aids
      // debugging and prevents unexpected empty-result confusion).
      if (status && !VALID_STATUS_FILTERS.has(status)) {
        return NextResponse.json(
          { success: false, error: `Invalid status filter: ${status}` },
          { status: 400 },
        );
      }
      if (slaStatus && !VALID_SLA_FILTERS.has(slaStatus)) {
        return NextResponse.json(
          { success: false, error: `Invalid slaStatus filter: ${slaStatus}` },
          { status: 400 },
        );
      }
      if (complaintType && !['CUSTOMER', 'REGULATORY', 'INTERNAL', 'THIRD_PARTY'].includes(complaintType)) {
        return NextResponse.json(
          { success: false, error: `Invalid complaintType filter: ${complaintType}` },
          { status: 400 },
        );
      }
      if (priority && !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority)) {
        return NextResponse.json(
          { success: false, error: `Invalid priority filter: ${priority}` },
          { status: 400 },
        );
      }

      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (slaStatus) where.slaStatus = slaStatus;
      if (departmentId) where.departmentId = departmentId;
      if (complaintType) where.complaintType = complaintType;
      if (priority) where.priority = priority;

      const [complaints, total] = await Promise.all([
        db.complaint.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }],
          take: limit,
          skip: offset,
        }),
        db.complaint.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: complaints,
        pagination: { total, limit, offset },
      });
    } catch (error) {
      console.error('Failed to list complaints:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to list complaints' },
        { status: 500 },
      );
    }
  },
  'canManageComplaints',
);

// ─── POST /api/complaints (intake) ───────────────────────────────────────────

export const POST = withRBAC(
  async (request: NextRequest) => {
    try {
      const ctx = getRBACContext(request);

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid JSON payload' },
          { status: 400 },
        );
      }
      const parsed = createComplaintSchema.safeParse(body);
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
          { status: 400 },
        );
      }
      const {
        subject,
        description,
        complaintType,
        priority,
        departmentId,
        policyId,
        claimId,
        intakeChannel,
      } = parsed.data;

      // Generate a regulator-readable complaint number: CMP-{YYYY}-{NNNNN}
      const year = new Date().getFullYear();
      const existingCount = await db.complaint.count();
      let complaintNumber = `CMP-${year}-${String(existingCount + 1).padStart(5, '0')}`;

      // Compute CBUAE SLA deadlines (business days from creation)
      const now = new Date();
      const slaDeadlineAck = addBusinessDays(now, ACK_SLA_BUSINESS_DAYS);
      const slaDeadlineResolution = addBusinessDays(now, RESOLUTION_SLA_BUSINESS_DAYS);

      const baseData = {
        complaintNumber,
        subject,
        description,
        complaintType,
        priority,
        status: 'NEW' as const,
        slaDeadlineAck,
        slaDeadlineResolution,
        slaStatus: 'WITHIN_SLA' as const,
        departmentId: departmentId ?? null,
        policyId: policyId ?? null,
        claimId: claimId ?? null,
      };

      // Create the complaint (retry on complaintNumber unique collision)
      let complaint;
      try {
        complaint = await db.complaint.create({ data: baseData });
      } catch {
        // collision on complaintNumber — fall back to a timestamp-suffixed
        // unique number so intake never fails due to a race on the counter.
        complaintNumber = `CMP-${year}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
        complaint = await db.complaint.create({
          data: { ...baseData, complaintNumber },
        });
      }

      // Raise a ComplianceAlert so the complaint surfaces in the alerting
      // system. (The "UniversalTask" unified-inbox architecture referenced in
      // the v7.3.0 roadmap is not yet built — see worklog. ComplianceAlert is
      // the existing platform alerting primitive and is used here to surface
      // intake, consistent with how SAR/CAP/dept-head items already surface.)
      const severity =
        priority === 'CRITICAL'
          ? 'critical'
          : priority === 'HIGH'
            ? 'high'
            : 'medium';
      await db.complianceAlert.create({
        data: {
          alertType: 'COMPLAINT_INTAKE',
          severity,
          status: 'active',
          title: `New complaint ${complaintNumber}: ${subject.slice(0, 80)}`,
          description: `${complaintType} complaint received via ${intakeChannel}. Ack SLA: ${slaDeadlineAck.toISOString().slice(0, 10)}; Resolution SLA: ${slaDeadlineResolution.toISOString().slice(0, 10)}.`,
          sourceModule: 'COMPLAINTS',
          sourceEntityId: complaint.id,
          sourceEntityType: 'Complaint',
          dueDate: slaDeadlineResolution,
          assignedToId: null,
          isImmutable: true,
        },
      });

      // Audit log — createAuditLog sanitizes PII from details + changes at rest
      await createAuditLog({
        userId: ctx.userId,
        action: 'CREATE_COMPLAINT',
        resourceType: 'Complaint',
        resourceId: complaint.id,
        details: `Intaked complaint ${complaintNumber} (${complaintType}, ${priority}) via ${intakeChannel}: ${subject}`,
        changes: {
          complaintNumber,
          complaintType,
          priority,
          departmentId: departmentId ?? null,
          intakeChannel,
        },
        ipAddress: ctx.ipAddress,
      });

      return NextResponse.json(
        { success: true, data: complaint },
        { status: 201 },
      );
    } catch (error) {
      console.error('Failed to create complaint:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create complaint' },
        { status: 500 },
      );
    }
  },
  'canManageComplaints',
);
