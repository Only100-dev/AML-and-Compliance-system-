/**
 * Complaint State Transition API — CBUAE Notice 3551/2021; FDL 10/2025 Art. 13
 *
 * PUT /api/complaints/[id]/transition — Transition complaint state with strict
 *   validation, field guards, and 4-eyes enforcement on Ombudsman escalation.
 *
 * State Machine:
 *   NEW → ACKNOWLEDGED                  (sets acknowledgedAt, acknowledgedById)
 *   NEW → REJECTED                      (requires rejectionReason)
 *   ACKNOWLEDGED → INVESTIGATING
 *   ACKNOWLEDGED → REJECTED             (requires rejectionReason)
 *   INVESTIGATING → RESOLVED            (requires resolutionSummary; sets resolvedAt, resolvedById)
 *   INVESTIGATING → ESCALATED_TO_OMBUDSMAN  (requires escalationReason; senior roles only; 4-eyes)
 *   RESOLVED → CLOSED
 *   RESOLVED → ESCALATED_TO_OMBUDSMAN   (requires escalationReason; senior roles only; 4-eyes)
 *   ESCALATED_TO_OMBUDSMAN → CLOSED     (senior roles only)
 *   Any other transition: 422 "Invalid state transition"
 *
 * Terminal states: CLOSED, REJECTED (no outgoing transitions).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  withRBAC,
  checkPermission,
  type ComplianceRole,
} from '@/lib/compliance/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import { computeComplaintSLAStatus } from '@/lib/compliance/complaint-sla';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const transitionComplaintSchema = z.object({
  targetState: z.enum(
    [
      'NEW',
      'ACKNOWLEDGED',
      'INVESTIGATING',
      'RESOLVED',
      'CLOSED',
      'REJECTED',
      'ESCALATED_TO_OMBUDSMAN',
    ],
    {
      error:
        'targetState must be one of: NEW, ACKNOWLEDGED, INVESTIGATING, RESOLVED, CLOSED, REJECTED, ESCALATED_TO_OMBUDSMAN',
    },
  ),
  resolutionSummary: z.string().optional(),
  rejectionReason: z.string().optional(),
  escalationReason: z.string().optional(),
});

// ─── State Machine Definition ────────────────────────────────────────────────

type ComplaintState = z.infer<typeof transitionComplaintSchema>['targetState'];

interface ComplaintTransition {
  from: ComplaintState;
  to: ComplaintState;
  requiredPermission: 'canManageComplaints' | 'canEscalateToOmbudsman';
  allowedRoles: ComplianceRole[];
  requiresResolutionSummary: boolean;
  requiresRejectionReason: boolean;
  requiresEscalationReason: boolean;
  /** 4-eyes: the escalator must differ from the person who moved it to the
   *  source state (the "maker"). */
  requiresFourEyes: boolean;
}

const VALID_COMPLAINT_TRANSITIONS: ComplaintTransition[] = [
  {
    from: 'NEW',
    to: 'ACKNOWLEDGED',
    requiredPermission: 'canManageComplaints',
    allowedRoles: ['compliance_officer', 'compliance_manager', 'mlro', 'dept_head', 'admin'],
    requiresResolutionSummary: false,
    requiresRejectionReason: false,
    requiresEscalationReason: false,
    requiresFourEyes: false,
  },
  {
    from: 'NEW',
    to: 'REJECTED',
    requiredPermission: 'canManageComplaints',
    allowedRoles: ['compliance_officer', 'compliance_manager', 'mlro', 'admin'],
    requiresResolutionSummary: false,
    requiresRejectionReason: true,
    requiresEscalationReason: false,
    requiresFourEyes: false,
  },
  {
    from: 'ACKNOWLEDGED',
    to: 'INVESTIGATING',
    requiredPermission: 'canManageComplaints',
    allowedRoles: ['compliance_officer', 'compliance_manager', 'mlro', 'dept_head', 'admin'],
    requiresResolutionSummary: false,
    requiresRejectionReason: false,
    requiresEscalationReason: false,
    requiresFourEyes: false,
  },
  {
    from: 'ACKNOWLEDGED',
    to: 'REJECTED',
    requiredPermission: 'canManageComplaints',
    allowedRoles: ['compliance_officer', 'compliance_manager', 'mlro', 'admin'],
    requiresResolutionSummary: false,
    requiresRejectionReason: true,
    requiresEscalationReason: false,
    requiresFourEyes: false,
  },
  {
    from: 'INVESTIGATING',
    to: 'RESOLVED',
    requiredPermission: 'canManageComplaints',
    allowedRoles: ['compliance_officer', 'compliance_manager', 'mlro', 'admin'],
    requiresResolutionSummary: true,
    requiresRejectionReason: false,
    requiresEscalationReason: false,
    requiresFourEyes: false,
  },
  {
    from: 'INVESTIGATING',
    to: 'ESCALATED_TO_OMBUDSMAN',
    requiredPermission: 'canEscalateToOmbudsman',
    allowedRoles: ['compliance_manager', 'mlro', 'admin'],
    requiresResolutionSummary: false,
    requiresRejectionReason: false,
    requiresEscalationReason: true,
    requiresFourEyes: true,
  },
  {
    from: 'RESOLVED',
    to: 'CLOSED',
    requiredPermission: 'canManageComplaints',
    allowedRoles: ['compliance_officer', 'compliance_manager', 'mlro', 'admin'],
    requiresResolutionSummary: false,
    requiresRejectionReason: false,
    requiresEscalationReason: false,
    requiresFourEyes: false,
  },
  {
    from: 'RESOLVED',
    to: 'ESCALATED_TO_OMBUDSMAN',
    requiredPermission: 'canEscalateToOmbudsman',
    allowedRoles: ['compliance_manager', 'mlro', 'admin'],
    requiresResolutionSummary: false,
    requiresRejectionReason: false,
    requiresEscalationReason: true,
    requiresFourEyes: true,
  },
  {
    from: 'ESCALATED_TO_OMBUDSMAN',
    to: 'CLOSED',
    requiredPermission: 'canManageComplaints',
    allowedRoles: ['compliance_manager', 'mlro', 'admin'],
    requiresResolutionSummary: false,
    requiresRejectionReason: false,
    requiresEscalationReason: false,
    requiresFourEyes: false,
  },
];

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

// ─── PUT /api/complaints/[id]/transition ─────────────────────────────────────

export const PUT = withRBAC(
  async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> },
  ) => {
    try {
      const params = context ? await context.params : {};
      const { id } = params;
      const ctx = getRBACContext(request);

      // Defensive JSON parse — malformed JSON must return 400, not 500.
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid JSON payload' },
          { status: 400 },
        );
      }
      const parsed = transitionComplaintSchema.safeParse(body);
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

      const { targetState, resolutionSummary, rejectionReason, escalationReason } =
        parsed.data;

      // Fetch the current complaint
      const complaint = await db.complaint.findUnique({ where: { id } });
      if (!complaint) {
        return NextResponse.json(
          { success: false, error: 'Complaint not found' },
          { status: 404 },
        );
      }

      const currentState = complaint.status as ComplaintState;

      // No-op: same state
      if (currentState === targetState) {
        return NextResponse.json(
          {
            success: false,
            error: `Complaint is already in state "${targetState}"`,
            regulatoryRef: 'CBUAE Notice 3551/2021; FDL 10/2025 Art. 13',
          },
          { status: 422 },
        );
      }

      // Validate transition exists
      const transition = VALID_COMPLAINT_TRANSITIONS.find(
        (t) => t.from === currentState && t.to === targetState,
      );
      if (!transition) {
        const validTargets = VALID_COMPLAINT_TRANSITIONS.filter(
          (t) => t.from === currentState,
        ).map((t) => t.to);
        return NextResponse.json(
          {
            success: false,
            error: `Invalid state transition: ${currentState} → ${targetState}. Valid transitions from ${currentState}: ${validTargets.join(', ') || 'none (terminal state)'}`,
            regulatoryRef: 'CBUAE Notice 3551/2021; FDL 10/2025 Art. 13',
          },
          { status: 422 },
        );
      }

      // Role guard for this specific transition
      if (!transition.allowedRoles.includes(ctx.role as ComplianceRole)) {
        return NextResponse.json(
          {
            success: false,
            error: `Role "${ctx.role}" is not allowed to transition from ${currentState} to ${targetState}. Required roles: ${transition.allowedRoles.join(', ')}`,
            regulatoryRef: 'CBUAE Notice 3551/2021; FDL 10/2025 Art. 13',
          },
          { status: 403 },
        );
      }

      // Permission guard
      if (!checkPermission(ctx.role as ComplianceRole, transition.requiredPermission)) {
        return NextResponse.json(
          {
            success: false,
            error: `Permission "${transition.requiredPermission}" required for transition ${currentState} → ${targetState}`,
            regulatoryRef: 'CBUAE Notice 3551/2021; FDL 10/2025 Art. 13',
          },
          { status: 403 },
        );
      }

      // Field guards — required contextual fields for certain transitions
      if (transition.requiresResolutionSummary && (!resolutionSummary || resolutionSummary.trim().length === 0)) {
        return NextResponse.json(
          {
            success: false,
            error: 'resolutionSummary is required when transitioning to RESOLVED',
            regulatoryRef: 'CBUAE Notice 3551/2021',
          },
          { status: 422 },
        );
      }
      if (transition.requiresRejectionReason && (!rejectionReason || rejectionReason.trim().length === 0)) {
        return NextResponse.json(
          {
            success: false,
            error: 'rejectionReason is required when transitioning to REJECTED',
            regulatoryRef: 'CBUAE Notice 3551/2021',
          },
          { status: 422 },
        );
      }
      if (transition.requiresEscalationReason && (!escalationReason || escalationReason.trim().length === 0)) {
        return NextResponse.json(
          {
            success: false,
            error: 'escalationReason is required when escalating to the Insurance Ombudsman Bureau',
            regulatoryRef: 'FDL 10/2025 Art. 13',
          },
          { status: 422 },
        );
      }

      // 4-eyes (Maker-Checker) enforcement for Ombudsman escalation.
      // The escalator must NOT be the same person who moved the complaint into
      // the source state (the "maker"). We look up the most recent
      // TRANSITION_COMPLAINT / CREATE_COMPLAINT audit log to identify the maker.
      if (transition.requiresFourEyes) {
        const makerLogs = await db.auditLog.findMany({
          where: {
            resource: 'Complaint',
            resourceId: id,
            action: { in: ['TRANSITION_COMPLAINT', 'CREATE_COMPLAINT'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });
        const maker = makerLogs.find(
          (log) =>
            log.action === 'TRANSITION_COMPLAINT' ||
            log.action === 'CREATE_COMPLAINT',
        );
        if (maker && maker.userId === ctx.userId) {
          return NextResponse.json(
            {
              success: false,
              error:
                'Maker-Checker violation: the person who actioned this complaint cannot also escalate it to the Ombudsman (4-eyes principle, FDL 10/2025 Art. 15)',
              regulatoryRef: 'FDL 10/2025 Art. 15',
            },
            { status: 403 },
          );
        }
      }

      // Build the update payload with field guards / timestamps
      const updateData: Record<string, unknown> = {
        status: targetState,
        updatedAt: new Date(),
      };

      if (targetState === 'ACKNOWLEDGED') {
        updateData.acknowledgedAt = new Date();
        updateData.acknowledgedById = ctx.userId;
      } else if (targetState === 'RESOLVED') {
        updateData.resolvedAt = new Date();
        updateData.resolvedById = ctx.userId;
      } else if (targetState === 'REJECTED') {
        updateData.rejectionReason = rejectionReason!;
      }

      // Update the complaint first, then recompute SLA status against the
      // post-transition record (so ACKNOWLEDGED/RESOLVED correctly mark the
      // relevant SLA as satisfied).
      const updated = await db.complaint.update({
        where: { id },
        data: updateData,
      });

      // Recompute SLA status based on the updated record
      const newSlaStatus = computeComplaintSLAStatus({
        slaDeadlineAck: updated.slaDeadlineAck,
        slaDeadlineResolution: updated.slaDeadlineResolution,
        acknowledgedAt: updated.acknowledgedAt,
        resolvedAt: updated.resolvedAt,
        createdAt: updated.createdAt,
        status: updated.status,
      });
      if (newSlaStatus !== updated.slaStatus) {
        await db.complaint.update({
          where: { id },
          data: { slaStatus: newSlaStatus },
        });
        updated.slaStatus = newSlaStatus;
      }

      // Audit log (PII-sanitized at rest). Structured contextual fields are
      // captured in `changes` for the transition history hydration in GET /[id].
      await createAuditLog({
        userId: ctx.userId,
        action: 'TRANSITION_COMPLAINT',
        resourceType: 'Complaint',
        resourceId: id,
        details: `Transitioned complaint ${complaint.complaintNumber} from ${currentState} to ${targetState}`,
        changes: {
          from: currentState,
          to: targetState,
          resolutionSummary: resolutionSummary ?? null,
          rejectionReason: rejectionReason ?? null,
          escalationReason: escalationReason ?? null,
        },
        ipAddress: ctx.ipAddress,
      });

      return NextResponse.json({ success: true, data: updated });
    } catch (error) {
      console.error('Failed to transition complaint:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to transition complaint' },
        { status: 500 },
      );
    }
  },
  'canManageComplaints',
);
