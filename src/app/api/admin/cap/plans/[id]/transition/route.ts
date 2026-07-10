/**
 * CAP State Transition API
 * FDL 10/2025 Art. 15 — STRICT State Machine
 *
 * POST: Transition CAP state with strict validation
 *
 * State Machine:
 *   TODO → IN_PROGRESS: compliance_officer/manager/mlro/admin
 *   IN_PROGRESS → REMEDIATED: compliance_officer/manager/mlro/admin
 *   REMEDIATED → AUDIT_VERIFIED: compliance_manager/mlro/admin (Maker-Checker)
 *   Any other transition: 422 "Invalid state transition"
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRBAC, checkPermission, type ComplianceRole } from '@/lib/compliance/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import { createHash } from 'crypto';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const transitionCAPSchema = z.object({
  targetState: z.enum(['TODO', 'IN_PROGRESS', 'REMEDIATED', 'AUDIT_VERIFIED'], {
    error: 'targetState must be one of: TODO, IN_PROGRESS, REMEDIATED, AUDIT_VERIFIED',
  }),
  verificationNotes: z.string().optional(),
});

// ─── State Machine Definition ────────────────────────────────────────────────

type CAPState = 'TODO' | 'IN_PROGRESS' | 'REMEDIATED' | 'AUDIT_VERIFIED';

interface StateTransition {
  from: CAPState;
  to: CAPState;
  requiredPermission: 'canManageCAPKanban' | 'canAuditVerifyCAP';
  allowedRoles: ComplianceRole[];
  requiresMakerChecker: boolean;
}

const VALID_TRANSITIONS: StateTransition[] = [
  {
    from: 'TODO',
    to: 'IN_PROGRESS',
    requiredPermission: 'canManageCAPKanban',
    allowedRoles: ['compliance_officer', 'compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
  },
  {
    from: 'IN_PROGRESS',
    to: 'REMEDIATED',
    requiredPermission: 'canManageCAPKanban',
    allowedRoles: ['compliance_officer', 'compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
  },
  {
    from: 'REMEDIATED',
    to: 'AUDIT_VERIFIED',
    requiredPermission: 'canAuditVerifyCAP',
    allowedRoles: ['compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: true,
  },
];

// ─── Helper ──────────────────────────────────────────────────────────────────

function getRBACContext(request: NextRequest) {
  const raw = request.headers.get('x-rbac-context');
  if (raw) {
    try { return JSON.parse(raw); } catch { /* fall through */ }
  }
  return {
    userId: request.headers.get('x-user-id') ?? 'unknown',
    role: request.headers.get('x-user-role') as ComplianceRole ?? 'unknown',
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  };
}

// ─── POST /api/cap/plans/[id]/transition ─────────────────────────────────────

export const POST = withRBAC(
  async (request: NextRequest, context?: { params: Promise<Record<string, string>> }) => {
    try {
      const params = context ? await context.params : {};
      const { id } = params;
      const ctx = getRBACContext(request);

      // Phase 4 Step 2.2 hardening: parse JSON defensively. `request.json()`
      // throws on malformed JSON (missing brace, bare "undefined", etc.) —
      // the fuzzer found this surfaced as a 500 with a generic error. The
      // correct response for malformed JSON is 400 Bad Request, matching
      // the goAML submit route's pattern. No stack trace is leaked either
      // way (the catch below strips it), but 400 is the semantically
      // correct status for a client-side serialization error.
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid JSON payload' },
          { status: 400 },
        );
      }
      const parsed = transitionCAPSchema.safeParse(body);

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

      const { targetState, verificationNotes } = parsed.data;

      // Fetch the current CAP
      const plan = await db.correctiveActionPlan.findUnique({ where: { id } });
      if (!plan) {
        return NextResponse.json(
          { success: false, error: 'Corrective action plan not found' },
          { status: 404 },
        );
      }

      const currentState = plan.state as CAPState;

      // No-op: same state
      if (currentState === targetState) {
        return NextResponse.json(
          {
            success: false,
            error: `CAP is already in state "${targetState}"`,
            regulatoryRef: 'FDL 10/2025 Art. 15',
          },
          { status: 422 },
        );
      }

      // Validate transition
      const transition = VALID_TRANSITIONS.find(
        (t) => t.from === currentState && t.to === targetState,
      );

      if (!transition) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid state transition: ${currentState} → ${targetState}. Valid transitions from ${currentState}: ${VALID_TRANSITIONS.filter((t) => t.from === currentState).map((t) => t.to).join(', ') || 'none'}`,
            regulatoryRef: 'FDL 10/2025 Art. 15',
          },
          { status: 422 },
        );
      }

      // Check role is allowed for this specific transition
      if (!transition.allowedRoles.includes(ctx.role as ComplianceRole)) {
        return NextResponse.json(
          {
            success: false,
            error: `Role "${ctx.role}" is not allowed to transition from ${currentState} to ${targetState}. Required roles: ${transition.allowedRoles.join(', ')}`,
            regulatoryRef: 'FDL 10/2025 Art. 15',
          },
          { status: 403 },
        );
      }

      // Check specific permission for this transition
      if (!checkPermission(ctx.role as ComplianceRole, transition.requiredPermission)) {
        return NextResponse.json(
          {
            success: false,
            error: `Permission "${transition.requiredPermission}" required for transition ${currentState} → ${targetState}`,
            regulatoryRef: 'FDL 10/2025 Art. 15',
          },
          { status: 403 },
        );
      }

      // Maker-Checker enforcement for REMEDIATED → AUDIT_VERIFIED
      // The auditLog fetch is shared between the 4-eyes check below and the
      // MakerCheckerLog.create later in this handler, so we declare it in the
      // outer scope and populate it only when Maker-Checker is required.
      let auditLogs: Array<{ userId: string; action: string }> = [];
      if (transition.requiresMakerChecker) {
        // The verifier cannot be the same as the person who moved it to REMEDIATED
        // This is the 4-eyes principle
        // Check if the current user was involved in prior transitions
        auditLogs = await db.auditLog.findMany({
          where: {
            resource: 'CorrectiveActionPlan',
            resourceId: id,
            action: { in: ['TRANSITION_CAP', 'CREATE_CAP', 'UPDATE_CAP'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });

        // Check if the verifier is the same as any previous actor (4-eyes)
        const previousActors = auditLogs.map((log) => log.userId);
        if (previousActors.includes(ctx.userId) && previousActors.length > 0) {
          // For strict Maker-Checker: the person who created/transitioned before
          // should not be the same person doing the audit verification
          const makerLog = auditLogs.find(
            (log) => log.action === 'TRANSITION_CAP' && log.userId === ctx.userId,
          );
          if (makerLog) {
            return NextResponse.json(
              {
                success: false,
                error: 'Maker-Checker violation: the person who transitioned this CAP cannot also audit-verify it (4-eyes principle)',
                regulatoryRef: 'FDL 10/2025 Art. 15',
              },
              { status: 403 },
            );
          }
        }
      }

      // Build update data with timestamps
      const updateData: Record<string, unknown> = {
        state: targetState,
        updatedAt: new Date(),
      };

      if (targetState === 'IN_PROGRESS') {
        // No specific timestamp needed for IN_PROGRESS start
      } else if (targetState === 'REMEDIATED') {
        updateData.remediatedAt = new Date();
      } else if (targetState === 'AUDIT_VERIFIED') {
        updateData.auditVerifiedAt = new Date();
        updateData.auditVerifiedById = ctx.userId;
        updateData.auditVerifiedByName = ctx.userId;
        updateData.verificationNotes = verificationNotes ?? null;
      }

      // Compute SHA-256 hash
      const hashPayload = JSON.stringify({
        action: 'TRANSITION_CAP',
        planId: id,
        fromState: currentState,
        toState: targetState,
        userId: ctx.userId,
        timestamp: new Date().toISOString(),
      });
      const sha256Hash = createHash('sha256').update(hashPayload).digest('hex');
      updateData.sha256Hash = sha256Hash;

      // Update the CAP
      const updatedPlan = await db.correctiveActionPlan.update({
        where: { id },
        data: updateData,
      });

      // If this is an audit verification, create Maker-Checker log
      if (transition.requiresMakerChecker) {
        await db.makerCheckerLog.create({
          data: {
            operationType: 'CAP_AUDIT_VERIFICATION',
            entityId: id,
            entityType: 'CorrectiveActionPlan',
            makerId: previousActorId(auditLogs),
            makerName: previousActorId(auditLogs),
            checkerId: ctx.userId,
            checkerName: ctx.userId,
            status: 'APPROVED',
            expiryTime: new Date(),
            payloadSnapshot: JSON.stringify({ from: currentState, to: targetState }),
            reviewedAt: new Date(),
          },
        });
      }

      // Audit log with SHA-256
      await createAuditLog({
        userId: ctx.userId,
        action: 'TRANSITION_CAP',
        resourceType: 'CorrectiveActionPlan',
        resourceId: id,
        details: `Transitioned CAP "${plan.title}" from ${currentState} to ${targetState}`,
        changes: { from: currentState, to: targetState, verificationNotes: verificationNotes ?? null },
        ipAddress: ctx.ipAddress,
      });

      return NextResponse.json({
        success: true,
        data: updatedPlan,
      });
    } catch (error) {
      console.error('Failed to transition CAP:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to transition CAP' },
        { status: 500 },
      );
    }
  },
  'canManageCAPKanban',
);

/**
 * Get the most recent actor ID from audit logs for Maker-Checker verification
 */
function previousActorId(auditLogs: Array<{ userId: string; action: string }>): string {
  const transitionLog = auditLogs.find((log) => log.action === 'TRANSITION_CAP');
  return transitionLog?.userId ?? (auditLogs.length > 0 ? auditLogs[0].userId : 'unknown');
}
