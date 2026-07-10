/**
 * Global Security Policy API — Phase 3.1 (P4-C)
 *
 * GET  /api/admin/security-policy  — return the singleton SecurityPolicy row
 *                                    (created with defaults if missing).
 * PUT  /api/admin/security-policy  — update the singleton row; audit-log the
 *                                    before/after JSON.
 *
 * RBAC: withRBAC('canManageUsers') — admin only (canManageUsers is admin-only
 *       per PERMISSIONS matrix). Clients must send `x-user-id` + `x-user-role`
 *       headers (set by the auth middleware or supplied directly in dev).
 *
 * Audit: createAuditLog() is called on PUT with action SECURITY_POLICY_UPDATE,
 *        resource SecurityPolicy, and changes = { previousValue, newValue }.
 *
 * Singleton pattern: the row with id=SINGLETON_ID is the only row. If absent
 * on first GET, it is created with the Prisma defaults. The PUT updates that
 * same row in place.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { withRBAC, type ComplianceRole } from '@/lib/compliance/rbac';
import { createAuditLog } from '@/lib/audit';

// ─── Singleton id ────────────────────────────────────────────────────────────
const SINGLETON_ID = 'singleton';

// ─── RBAC Context Helper (mirrors src/app/api/complaints/route.ts pattern) ───
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

// ─── Zod validation schema for PUT ──────────────────────────────────────────
const SecurityPolicyUpdateSchema = z.object({
  passwordMinLength: z.number().int().min(8).max(128).optional(),
  passwordRequireUpper: z.boolean().optional(),
  passwordRequireLower: z.boolean().optional(),
  passwordRequireNumber: z.boolean().optional(),
  passwordRequireSymbol: z.boolean().optional(),
  passwordHistoryCount: z.number().int().min(0).max(24).optional(),
  passwordExpiryDays: z.number().int().min(0).max(365).optional(),
  sessionTimeoutMin: z.number().int().min(1).max(1440).optional(),
  maxConcurrentSessions: z.number().int().min(1).max(20).optional(),
  mfaRequiredRoles: z.array(z.string()).optional(),
  mfaEnforcedGlobal: z.boolean().optional(),
  maxFailedAttempts: z.number().int().min(1).max(50).optional(),
  lockoutDurationMin: z.number().int().min(1).max(1440).optional(),
});

// ─── Helper: get or create the singleton row ────────────────────────────────
async function getOrCreateSingleton() {
  const existing = await db.securityPolicy.findUnique({
    where: { id: SINGLETON_ID },
  });
  if (existing) return existing;
  // create-on-first-read with Prisma defaults
  return db.securityPolicy.create({ data: { id: SINGLETON_ID } });
}

// ─── GET /api/admin/security-policy ─────────────────────────────────────────
export const GET = withRBAC(
  async (request: NextRequest) => {
    try {
      const ctx = getRBACContext(request);
      const policy = await getOrCreateSingleton();

      // Parse mfaRequiredRoles JSON for the response
      let mfaRequiredRoles: string[] = [];
      try {
        mfaRequiredRoles = JSON.parse(policy.mfaRequiredRoles) as string[];
      } catch {
        mfaRequiredRoles = [];
      }

      return NextResponse.json({
        success: true,
        data: {
          ...policy,
          mfaRequiredRoles,
          // attach who performed the read (informational; reads are not audited
          // per the shift-left mandate — see /api/tasks/my-tasks/route.ts)
          _requestedBy: ctx.userId,
        },
      });
    } catch (error) {
      console.error('[admin/security-policy GET] error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch security policy' },
        { status: 500 },
      );
    }
  },
  'canManageUsers',
);

// ─── PUT /api/admin/security-policy ─────────────────────────────────────────
export const PUT = withRBAC(
  async (request: NextRequest) => {
    try {
      const ctx = getRBACContext(request);

      // Parse body
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid JSON payload' },
          { status: 400 },
        );
      }

      const parsed = SecurityPolicyUpdateSchema.safeParse(body);
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
          { status: 422 },
        );
      }

      const validated = parsed.data;

      // Fetch the current singleton (for before/after audit)
      const previous = await getOrCreateSingleton();

      // Build update payload (only fields that were provided)
      const updateData: Record<string, unknown> = {};
      if (validated.passwordMinLength !== undefined) updateData.passwordMinLength = validated.passwordMinLength;
      if (validated.passwordRequireUpper !== undefined) updateData.passwordRequireUpper = validated.passwordRequireUpper;
      if (validated.passwordRequireLower !== undefined) updateData.passwordRequireLower = validated.passwordRequireLower;
      if (validated.passwordRequireNumber !== undefined) updateData.passwordRequireNumber = validated.passwordRequireNumber;
      if (validated.passwordRequireSymbol !== undefined) updateData.passwordRequireSymbol = validated.passwordRequireSymbol;
      if (validated.passwordHistoryCount !== undefined) updateData.passwordHistoryCount = validated.passwordHistoryCount;
      if (validated.passwordExpiryDays !== undefined) updateData.passwordExpiryDays = validated.passwordExpiryDays;
      if (validated.sessionTimeoutMin !== undefined) updateData.sessionTimeoutMin = validated.sessionTimeoutMin;
      if (validated.maxConcurrentSessions !== undefined) updateData.maxConcurrentSessions = validated.maxConcurrentSessions;
      if (validated.mfaRequiredRoles !== undefined) updateData.mfaRequiredRoles = JSON.stringify(validated.mfaRequiredRoles);
      if (validated.mfaEnforcedGlobal !== undefined) updateData.mfaEnforcedGlobal = validated.mfaEnforcedGlobal;
      if (validated.maxFailedAttempts !== undefined) updateData.maxFailedAttempts = validated.maxFailedAttempts;
      if (validated.lockoutDurationMin !== undefined) updateData.lockoutDurationMin = validated.lockoutDurationMin;

      // Always stamp who made the change
      updateData.updatedById = ctx.userId;
      updateData.updatedByRole = ctx.role;

      const updated = await db.securityPolicy.update({
        where: { id: SINGLETON_ID },
        data: updateData,
      });

      // Build the previous/new value snapshots for the audit log. mfaRequiredRoles
      // is normalized to a JSON array so the audit trail is human-readable.
      const previousSnapshot = {
        ...previous,
        mfaRequiredRoles: (() => {
          try { return JSON.parse(previous.mfaRequiredRoles); } catch { return []; }
        })(),
      };
      const newSnapshot = {
        ...updated,
        mfaRequiredRoles: (() => {
          try { return JSON.parse(updated.mfaRequiredRoles); } catch { return []; }
        })(),
      };

      // Audit log (SECURITY_POLICY_UPDATE with before/after JSON)
      await createAuditLog({
        userId: ctx.userId,
        action: 'SECURITY_POLICY_UPDATE',
        resourceType: 'SecurityPolicy',
        resourceId: updated.id,
        details: `Security policy updated by ${ctx.role} (${ctx.userId}). Changed fields: ${Object.keys(updateData).filter(k => k !== 'updatedById' && k !== 'updatedByRole').join(', ') || 'none'}`,
        changes: {
          previousValue: previousSnapshot,
          newValue: newSnapshot,
          changedFields: Object.keys(updateData).filter(k => k !== 'updatedById' && k !== 'updatedByRole'),
        },
        ipAddress: ctx.ipAddress,
      });

      // Return the updated row with mfaRequiredRoles parsed for the client
      return NextResponse.json({
        success: true,
        data: {
          ...updated,
          mfaRequiredRoles: (() => {
            try { return JSON.parse(updated.mfaRequiredRoles); } catch { return []; }
          })(),
        },
        message: 'Security policy updated successfully',
      });
    } catch (error) {
      console.error('[admin/security-policy PUT] error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update security policy' },
        { status: 500 },
      );
    }
  },
  'canManageUsers',
);
