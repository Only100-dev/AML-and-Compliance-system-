import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { createAuditLog } from '@/lib/audit';
import { checkPermission } from '@/lib/compliance/rbac';
import { z } from 'zod';

/**
 * Phase 3 Directive 3.1 — Global Security Settings (Master Admin).
 *
 * FDL 10/2025 Art. 15 (Internal Controls); CBUAE Notice 3551/2021 S3.4.
 *
 * The Master Admin configures the platform-wide security posture here:
 *   - password policy (minLength, complexity, historyCount)
 *   - session timeouts (idleTimeoutMinutes, absoluteTimeoutHours)
 *   - MFA enforcement per role (enforcedRoles[])
 *   - account-lockout thresholds (maxAttempts, lockoutMinutes)
 *
 * Each leaf setting is persisted as its own SecurityPolicy row keyed by
 * "{category}.{field}" (e.g. "password.minLength", "mfa.enforcedRoles").
 * GET reconstructs the grouped object; PUT upserts each leaf + writes a
 * single audit log entry with previousValue/newValue of the affected
 * categories (immutable SHA-256 WORM trail).
 *
 * DECISION (per Phase 3 build directive): Security policy changes apply
 * DIRECTLY (not routed through Maker-Checker). The Master Admin is the
 * authoritative privileged actor for global security posture. The
 * Maker-Checker SoD flow remains in force for user role/deactivation
 * (Phase 2 Directive 2.3 — untouched here).
 */

// ─── Default Security Posture ────────────────────────────────────────────────
// Returned by GET when the DB has no row for a key, and used as the
// `previousValue` baseline for audit-log diffs.
export const DEFAULT_SECURITY_SETTINGS = {
  password: {
    minLength: 12,
    requireUppercase: true,
    requireSymbol: true,
    requireNumber: true,
    historyCount: 5,
  },
  session: {
    idleTimeoutMinutes: 15,
    absoluteTimeoutHours: 8,
  },
  mfa: {
    enforcedRoles: ['admin', 'mlro', 'board'],
  },
  lockout: {
    maxAttempts: 5,
    lockoutMinutes: 30,
  },
} as const;

type Category = 'password' | 'session' | 'mfa' | 'lockout';
const CATEGORIES: Category[] = ['password', 'session', 'mfa', 'lockout'];

// Leaf schemas per category — drive both validation (PUT) and
// reconstruction (GET) so the response shape is consistent.
const PasswordSchema = z.object({
  minLength: z.number().int().min(8).max(128).optional(),
  requireUppercase: z.boolean().optional(),
  requireSymbol: z.boolean().optional(),
  requireNumber: z.boolean().optional(),
  historyCount: z.number().int().min(0).max(24).optional(),
});

const SessionSchema = z.object({
  idleTimeoutMinutes: z.number().int().min(1).max(1440).optional(),
  absoluteTimeoutHours: z.number().int().min(1).max(168).optional(),
});

const MfaSchema = z.object({
  enforcedRoles: z
    .array(
      z.enum([
        'admin',
        'mlro',
        'compliance_manager',
        'compliance_officer',
        'dept_head',
        'board',
      ]),
    )
    .optional(),
});

const LockoutSchema = z.object({
  maxAttempts: z.number().int().min(1).max(20).optional(),
  lockoutMinutes: z.number().int().min(1).max(1440).optional(),
});

const SecuritySettingsUpdateSchema = z.object({
  settings: z
    .object({
      password: PasswordSchema.optional(),
      session: SessionSchema.optional(),
      mfa: MfaSchema.optional(),
      lockout: LockoutSchema.optional(),
    })
    .refine((s) => Object.keys(s).length > 0, {
      message: 'At least one category must be provided',
    }),
});

type SecuritySettings = {
  password: z.infer<typeof PasswordSchema>;
  session: z.infer<typeof SessionSchema>;
  mfa: z.infer<typeof MfaSchema>;
  lockout: z.infer<typeof LockoutSchema>;
};

/**
 * Reconstruct a grouped settings object from the raw SecurityPolicy rows.
 * Missing keys fall back to the DEFAULT_SECURITY_SETTINGS baseline.
 */
function reconstructSettings(
  rows: Array<{ key: string; value: unknown; category: string }>,
): SecuritySettings {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const get = <T,>(category: Category, field: string, fallback: T): T => {
    const v = byKey.get(`${category}.${field}`);
    return (v ?? fallback) as T;
  };

  return {
    password: {
      minLength: get('password', 'minLength', DEFAULT_SECURITY_SETTINGS.password.minLength),
      requireUppercase: get('password', 'requireUppercase', DEFAULT_SECURITY_SETTINGS.password.requireUppercase),
      requireSymbol: get('password', 'requireSymbol', DEFAULT_SECURITY_SETTINGS.password.requireSymbol),
      requireNumber: get('password', 'requireNumber', DEFAULT_SECURITY_SETTINGS.password.requireNumber),
      historyCount: get('password', 'historyCount', DEFAULT_SECURITY_SETTINGS.password.historyCount),
    },
    session: {
      idleTimeoutMinutes: get('session', 'idleTimeoutMinutes', DEFAULT_SECURITY_SETTINGS.session.idleTimeoutMinutes),
      absoluteTimeoutHours: get('session', 'absoluteTimeoutHours', DEFAULT_SECURITY_SETTINGS.session.absoluteTimeoutHours),
    },
    mfa: {
      enforcedRoles: get('mfa', 'enforcedRoles', DEFAULT_SECURITY_SETTINGS.mfa.enforcedRoles),
    },
    lockout: {
      maxAttempts: get('lockout', 'maxAttempts', DEFAULT_SECURITY_SETTINGS.lockout.maxAttempts),
      lockoutMinutes: get('lockout', 'lockoutMinutes', DEFAULT_SECURITY_SETTINGS.lockout.lockoutMinutes),
    },
  };
}

// ─── GET /api/admin/security-settings ────────────────────────────────────────
// Returns the grouped security settings + the raw SecurityPolicy rows.
export async function GET(request: NextRequest) {
  const auth = await authGuard({ allowedRoles: ['admin'] });
  if (!auth.authorized) return auth.error ?? NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  const rateLimitError = applyRateLimit(auth, request, 'READ');
  if (rateLimitError) return rateLimitError;

  // RBAC — checkPermission(canManageSecurityPolicy). Admin-only; we still
  // enforce the permission check explicitly so future role additions are
  // gated by rbac.ts (single source of truth).
  const sessionUser = auth.session?.user as Record<string, unknown> | undefined;
  const role = (sessionUser?.role as string) ?? '';
  if (!checkPermission(role as never, 'canManageSecurityPolicy' as never)) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions — canManageSecurityPolicy required' },
      { status: 403 },
    );
  }

  try {
    const rows = await db.securityPolicy.findMany({
      where: { category: { in: CATEGORIES } },
    });
    const settings = reconstructSettings(
      rows.map((r) => ({ key: r.key, value: r.value, category: r.category })),
    );
    return NextResponse.json({ success: true, settings, raw: rows });
  } catch (error) {
    console.error('[admin/security-settings GET] Database error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch security settings' },
      { status: 500 },
    );
  }
}

// ─── PUT /api/admin/security-settings ────────────────────────────────────────
// Accepts a partial grouped settings object. Upserts each leaf row, then
// writes a single audit-log entry capturing the previousValue/newValue of
// each affected category. Returns the updated grouped settings.
export async function PUT(request: NextRequest) {
  const auth = await authGuard({ allowedRoles: ['admin'] });
  if (!auth.authorized) return auth.error ?? NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  const rateLimitError = applyRateLimit(auth, request, 'WRITE');
  if (rateLimitError) return rateLimitError;

  const sessionUser = auth.session?.user as Record<string, unknown> | undefined;
  const role = (sessionUser?.role as string) ?? '';
  const adminId = (sessionUser?.userId as string) || 'dev-user';
  const adminName = (sessionUser?.name as string) ?? 'Admin';
  if (!checkPermission(role as never, 'canManageSecurityPolicy' as never)) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions — canManageSecurityPolicy required' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = SecuritySettingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: fieldErrors, violation: 'VALIDATION_ERROR' },
      { status: 422 },
    );
  }

  const incoming = parsed.data.settings;
  const affectedCategories = Object.keys(incoming).filter((k) =>
    CATEGORIES.includes(k as Category),
  ) as Category[];

  if (affectedCategories.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No valid categories provided' },
      { status: 422 },
    );
  }

  try {
    // ── Capture the current state (baseline) of the affected categories ──
    const existingRows = await db.securityPolicy.findMany({
      where: { category: { in: affectedCategories } },
    });
    const previousGrouped = reconstructSettings(
      existingRows.map((r) => ({ key: r.key, value: r.value, category: r.category })),
    );
    const previousValue: Record<string, unknown> = {};
    for (const cat of affectedCategories) {
      previousValue[cat] = previousGrouped[cat];
    }

    // ── Upsert each leaf setting provided in the incoming payload ──
    // Deep-clone previousGrouped as the starting point for newGrouped so
    // unaffected categories retain their values verbatim.
    const newGrouped: SecuritySettings = JSON.parse(JSON.stringify(previousGrouped));
    for (const cat of affectedCategories) {
      const partial = (incoming as Record<string, Record<string, unknown> | undefined>)[cat];
      if (!partial) continue;
      for (const [field, value] of Object.entries(partial)) {
        const key = `${cat}.${field}`;
        await db.securityPolicy.upsert({
          where: { key },
          update: {
            value: value as never,
            category: cat,
            updatedById: adminId,
            updatedByName: adminName,
          },
          create: {
            key,
            value: value as never,
            category: cat,
            updatedById: adminId,
            updatedByName: adminName,
            description: `Security policy: ${cat}.${field}`,
          },
        });
        // Update the in-memory new state so the audit `newValue` snapshot
        // reflects what was actually persisted.
        (newGrouped[cat] as Record<string, unknown>)[field] = value;
      }
    }

    const newValue: Record<string, unknown> = {};
    for (const cat of affectedCategories) {
      newValue[cat] = newGrouped[cat];
    }

    // ── Single audit-log entry capturing previousValue + newValue ──
    // PII sanitization + SHA-256 hashing are handled by createAuditLog.
    await createAuditLog({
      userId: adminId,
      action: 'SECURITY_POLICY_UPDATE',
      resourceType: 'SecurityPolicy',
      resourceId: 'global',
      details: `Master Admin ${adminName} updated global security settings. Categories: ${affectedCategories.join(', ')}. Changes apply immediately and are recorded in the immutable SHA-256 audit trail (FDL 10/2025 Art. 15; CBUAE Notice 3551/2021 S3.4).`,
      previousValue,
      newValue,
    });

    return NextResponse.json({
      success: true,
      settings: newGrouped,
      message: 'Security policy updated — changes are captured in the immutable audit trail.',
    });
  } catch (error) {
    console.error('[admin/security-settings PUT] Database error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update security settings' },
      { status: 500 },
    );
  }
}
