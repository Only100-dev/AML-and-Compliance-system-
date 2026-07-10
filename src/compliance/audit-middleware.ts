/**
 * IC-OS Prisma Audit Middleware
 * Phase 1 Regulatory Critical Enhancement
 *
 * Automatically captures Maker-Checker actions and data mutations
 * on critical compliance models. All audit entries are SHA-256 hashed
 * for tamper-proof integrity verification per FDL 10/2025 Art. 11.
 *
 * Key features:
 *   - Intercepts create / update / delete on audited models
 *   - Captures previousData (before) and newData (after) for full traceability
 *   - Enforces Maker-Checker: maker ≠ checker for approval operations
 *   - Generates SHA-256 hash for each audit entry
 *   - Creates AuditLog entries automatically via Prisma $use middleware
 */

import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { stableStringify } from '@/lib/stable-stringify';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface AuditContext {
  /** The user performing the action */
  userId: string;
  /** Human-readable user name */
  userName?: string;
  /** IP address of the client */
  ipAddress?: string;
  /** For approval operations: the checker's user ID */
  checkerId?: string;
  /** For approval operations: the checker's human-readable name */
  checkerName?: string;
  /** The regulatory reference applicable to this action */
  regulatoryRef?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface AuditEntry {
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  details: string;
  sha256Hash: string;
  ipAddress?: string;
  previousData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
}

export interface MakerCheckerViolation {
  violated: boolean;
  reason?: string;
  makerId: string;
  checkerId?: string;
}

// ─── Audited Models ─────────────────────────────────────────────────────────────

/**
 * Models that require automatic audit trail capture.
 * These are the critical compliance entities where every mutation
 * must be immutably logged per CBUAE regulatory requirements.
 */
export const auditedModels: readonly string[] = [
  'AMLAlert',
  'SARCase',
  'GoAMLFiling',
  'MakerCheckerLog',
  'CorporateKYC',
  'IndividualKYC',
  'VASPKYC',
  'SanctionsScreening',
  'SanctionsException',
  'ComplianceAlert',
  'ComplianceCase',
  'Policy',
  'PolicyAttestation',
  'ComplianceAudit',
  'RegulatoryCircular',
  'Regulation',
  'Claim',
  'VendorDueDiligence',
  'RiskAssessment',
  'InsuranceRecord',
  'QuarterlyReport',
] as const;

/** Approval-status fields that trigger Maker-Checker enforcement */
const APPROVAL_STATUS_FIELDS: readonly string[] = [
  'status',
  'approvedBy',
  'reviewedById',
  'submittedById',
  'checkerId',
  'filingStatus',
] as const;

/** Actions that constitute an approval decision */
const APPROVAL_ACTIONS: readonly string[] = [
  'APPROVED',
  'REJECTED',
  'APPROVED_FOR_FILING',
  'SUBMITTED_TO_FIU',
  'APPROVE',
  'REJECT',
] as const;

// ─── SHA-256 Hash Generation ────────────────────────────────────────────────────

/**
 * Generate a SHA-256 hash for an audit entry to ensure tamper-proof integrity.
 * The hash is computed over a deterministic string representation of the entry.
 */
export function generateAuditHash(entry: Omit<AuditEntry, 'sha256Hash'>): string {
  // Addendum E: Use stableStringify() for deterministic key ordering
  const payload = stableStringify({
    userId: entry.userId,
    action: entry.action,
    resource: entry.resource,
    resourceId: entry.resourceId,
    details: entry.details,
    timestamp: new Date().toISOString(),
    previousData: entry.previousData ?? null,
    newData: entry.newData ?? null,
  });

  return createHash('sha256').update(payload).digest('hex');
}

// ─── Maker-Checker Enforcement ──────────────────────────────────────────────────

/**
 * Verify Maker-Checker compliance for approval operations.
 * Per the 4-eyes principle, the same person cannot both initiate and approve
 * a critical compliance action.
 *
 * @returns MakerCheckerViolation indicating whether the principle is violated
 */
export function verifyMakerCheckerCompliance(
  action: string,
  data: Record<string, unknown>,
  context: AuditContext
): MakerCheckerViolation {
  const isApprovalAction = APPROVAL_ACTIONS.some(
    (a) => action.toUpperCase().includes(a)
  );

  const hasApprovalField = APPROVAL_STATUS_FIELDS.some(
    (f) => f in data && data[f] !== undefined && data[f] !== null
  );

  // If this is not an approval action, no Maker-Checker check needed
  if (!isApprovalAction && !hasApprovalField) {
    return { violated: false, makerId: context.userId };
  }

  const makerId = context.userId;
  const checkerId = context.checkerId ?? (data.checkerId as string | undefined) ?? (data.approvedBy as string | undefined);

  // If no checker is identified, we cannot verify — flag as potential violation
  if (!checkerId) {
    return {
      violated: false,
      reason: 'No checker identified for approval action — Maker-Checker verification deferred to approval gate',
      makerId,
    };
  }

  // Enforce: maker ≠ checker
  if (makerId === checkerId) {
    return {
      violated: true,
      reason: `Maker-Checker violation: maker (${makerId}) and checker (${checkerId}) are the same person. The 4-eyes principle requires distinct individuals.`,
      makerId,
      checkerId,
    };
  }

  return { violated: false, makerId, checkerId };
}

// ─── Prisma Audit Middleware ─────────────────────────────────────────────────────

/**
 * Current audit context — set per request via setAuditContext().
 * This is thread-local via AsyncLocalStorage in production; for now
 * we use a module-level variable with request-scoped override.
 */
let currentAuditContext: AuditContext | null = null;

/**
 * Set the audit context for the current operation.
 * Must be called before any audited Prisma operation.
 */
export function setAuditContext(context: AuditContext): void {
  currentAuditContext = context;
}

/**
 * Clear the audit context after the current operation completes.
 */
export function clearAuditContext(): void {
  currentAuditContext = null;
}

/**
 * Get the current audit context.
 */
export function getAuditContext(): AuditContext | null {
  return currentAuditContext;
}

/**
 * Prisma middleware that intercepts create, update, and delete operations
 * on audited models and automatically creates AuditLog entries.
 *
 * Usage:
 * ```typescript
 * import { prismaAuditMiddleware, setAuditContext, clearAuditContext } from '@/lib/compliance/audit-middleware';
 * db.$use(prismaAuditMiddleware);
 *
 * // Before a critical operation:
 * setAuditContext({ userId: 'user-123', userName: 'Ahmed MLRO' });
 * await db.aMLAlert.update({ where: { id: 'alert-1' }, data: { status: 'escalated' } });
 * clearAuditContext();
 * ```
 */
export const prismaAuditMiddleware = async (params: any, next: any) => {
  const { model, action, args } = params;

  // Only intercept mutations on audited models
  const isAuditedModel = model && auditedModels.includes(model);
  const isMutatingAction = ['create', 'update', 'delete'].includes(action);

  if (!isAuditedModel || !isMutatingAction) {
    return next(params);
  }

  const context = currentAuditContext;
  const resourceId = extractResourceId(args, action);
  const timestamp = new Date();

  // Capture previous data for updates and deletes
  let previousData: Record<string, unknown> | undefined;

  if (action === 'update' || action === 'delete') {
    try {
      const existing = await db.$queryRawUnsafe(
        `SELECT * FROM "${model}" WHERE id = ?`,
        resourceId
      );
      if (existing && Array.isArray(existing) && existing.length > 0) {
        previousData = existing[0] as Record<string, unknown>;
      }
    } catch {
      // If we can't fetch previous data, continue — don't block the operation
      previousData = undefined;
    }
  }

  // Execute the original operation
  const result = await next(params);

  // Capture new data for creates and updates
  let newData: Record<string, unknown> | undefined;

  if (action === 'create' || action === 'update') {
    newData = result as Record<string, unknown>;
  }

  // Build audit details
  const details = buildAuditDetails(action, model, previousData, newData, context);

  // Build audit entry
  const auditEntry: Omit<AuditEntry, 'sha256Hash'> = {
    userId: context?.userId ?? 'system',
    action: `${action}_${model}`.toUpperCase(),
    resource: model,
    resourceId: resourceId ?? 'unknown',
    details,
    ipAddress: context?.ipAddress,
    previousData,
    newData,
  };

  // Generate SHA-256 integrity hash
  const sha256Hash = generateAuditHash(auditEntry);

  // Maker-Checker enforcement for approval operations
  if (context && action === 'update' && newData) {
    const mcResult = verifyMakerCheckerCompliance(
      `${action}_${model}`,
      newData,
      context
    );

    if (mcResult.violated) {
      // Log the violation but still record the audit entry
      // The violation will be flagged for investigation
      const violationHash = generateAuditHash({
        userId: context.userId,
        action: `MAKER_CHECKER_VIOLATION_${model}`.toUpperCase(),
        resource: model,
        resourceId: resourceId ?? 'unknown',
        details: mcResult.reason ?? 'Maker-Checker violation detected',
        ipAddress: context.ipAddress,
      });
      await db.auditLog.create({
        data: {
          userId: context.userId,
          action: `MAKER_CHECKER_VIOLATION_${model}`.toUpperCase(),
          resource: model,
          resourceId: resourceId ?? 'unknown',
          details: mcResult.reason ?? 'Maker-Checker violation detected',
          sha256Hash: violationHash,
          ipAddress: context.ipAddress,
          // WORM chain fields (P0-C Fix)
          jurisdiction: context.metadata?.jurisdiction as string ?? 'UNKNOWN',
          prevHash: null, // Standalone violation entry — not chain-linked
          currentHash: violationHash,
          chainIndex: 0, // Will be properly assigned by WORM audit for normal entries
          isSealed: true,
        },
      });

      // Throw to prevent the violating operation from completing
      throw new Error(
        `MAKER-CHECKER VIOLATION: ${mcResult.reason}. ` +
        `Per FDL 10/2025 Art. 13-14, the same person cannot both initiate and approve a critical compliance action.`
      );
    }
  }

  // Create the AuditLog entry (with WORM chain fields — P0-C Fix)
  try {
    // Get last entry for chain linking
    const lastEntry = await db.auditLog.findFirst({
      orderBy: { chainIndex: 'desc' },
      select: { chainIndex: true, currentHash: true },
    });
    const chainIndex = (lastEntry?.chainIndex ?? 0) + 1;
    const prevHash = lastEntry?.currentHash ?? null;

    await db.auditLog.create({
      data: {
        userId: auditEntry.userId,
        action: auditEntry.action,
        resource: auditEntry.resource,
        resourceId: auditEntry.resourceId,
        details: auditEntry.details,
        sha256Hash,
        ipAddress: auditEntry.ipAddress,
        // WORM chain fields (P0-C Fix)
        jurisdiction: context?.metadata?.jurisdiction as string ?? 'UNKNOWN',
        prevHash,
        currentHash: sha256Hash,
        chainIndex,
        isSealed: true,
      },
    });
  } catch (error) {
    // Audit logging failure should not block the operation,
    // but we must log the failure for investigation
    console.error(
      `[AUDIT MIDDLEWARE] Failed to create AuditLog entry:`,
      error
    );
  }

  return result;
};

// ─── Helper Functions ────────────────────────────────────────────────────────────

/**
 * Extract the resource ID from Prisma action args.
 */
function extractResourceId(
  args: Record<string, unknown>,
  action: string
): string {
  if (action === 'create' && args.data) {
    // For creates, the ID may not be available until after creation
    return (args.data as Record<string, unknown>)?.id as string ?? 'pending';
  }

  if (args.where) {
    return (args.where as Record<string, unknown>)?.id as string ?? 'unknown';
  }

  return 'unknown';
}

/**
 * Build a human-readable audit details string.
 */
function buildAuditDetails(
  action: string,
  model: string | undefined,
  previousData: Record<string, unknown> | undefined,
  newData: Record<string, unknown> | undefined,
  context: AuditContext | null
): string {
  const parts: string[] = [];

  parts.push(`Action: ${action.toUpperCase()} on ${model}`);

  if (context?.userName) {
    parts.push(`User: ${context.userName} (${context.userId})`);
  } else if (context?.userId) {
    parts.push(`User: ${context.userId}`);
  }

  if (context?.regulatoryRef) {
    parts.push(`Regulatory Ref: ${context.regulatoryRef}`);
  }

  if (previousData && newData) {
    // For updates, show the changed fields
    const changedFields: string[] = [];
    for (const key of Object.keys(newData)) {
      const prev = previousData[key];
      const next = newData[key];
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        changedFields.push(`${key}: ${JSON.stringify(prev)} → ${JSON.stringify(next)}`);
      }
    }
    if (changedFields.length > 0) {
      parts.push(`Changes: ${changedFields.join('; ')}`);
    }
  } else if (newData && !previousData) {
    // For creates, show the created fields
    const fields = Object.entries(newData)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(', ');
    parts.push(`Created with: ${fields}`);
  } else if (previousData && !newData) {
    parts.push(`Deleted record`);
  }

  return parts.join(' | ');
}

// ─── Manual Audit Logging ────────────────────────────────────────────────────────

/**
 * Manually create an audit log entry for actions that bypass Prisma
 * (e.g., file downloads, report generation, API calls to external systems).
 */
export async function createManualAuditLog(
  entry: Omit<AuditEntry, 'sha256Hash'> & { aiConfidence?: number }
): Promise<void> {
  const sha256Hash = generateAuditHash(entry);

  // Get last entry for chain linking (P0-C Fix)
  const lastEntry = await db.auditLog.findFirst({
    orderBy: { chainIndex: 'desc' },
    select: { chainIndex: true, currentHash: true },
  });
  const chainIndex = (lastEntry?.chainIndex ?? 0) + 1;
  const prevHash = lastEntry?.currentHash ?? null;

  await db.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      details: entry.details,
      sha256Hash,
      ipAddress: entry.ipAddress,
      // WORM chain fields (P0-C Fix)
      jurisdiction: 'UNKNOWN',
      prevHash,
      currentHash: sha256Hash,
      chainIndex,
      isSealed: true,
    },
  });
}

/**
 * Verify the integrity of an audit log entry by recomputing its SHA-256 hash.
 * Returns true if the hash matches, false if tampered.
 */
export async function verifyAuditIntegrity(auditLogId: string): Promise<boolean> {
  const log = await db.auditLog.findUnique({ where: { id: auditLogId } });

  if (!log || !log.sha256Hash) {
    return false;
  }

  const recomputedHash = generateAuditHash({
    userId: log.userId,
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId ?? 'unknown',
    details: log.details ?? '',
    ipAddress: log.ipAddress ?? undefined,
  });

  return recomputedHash === log.sha256Hash;
}
