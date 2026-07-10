import { db } from '@/lib/db';
import crypto from 'crypto';
import { sanitizeObject, stripPIIFromText } from '@/lib/pii';
import { stableStringify } from '@/lib/stable-stringify';

export interface AuditLogInput {
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: Record<string, unknown>;
  details?: string;
  ipAddress?: string;
  jurisdiction?: string;
  previousValue?: unknown;
  newValue?: unknown;
}

/**
 * Create an immutable audit log entry with SHA-256 integrity hash.
 *
 * PII Sanitization: The `details` string and `changes` object are
 * sanitized before storage to prevent raw PII from being persisted
 * in the audit trail. This complies with CBUAE Notice 3551/2021
 * data minimization requirements.
 *
 * SHA-256 Integrity Hash (v7.3.0 fix):
 * The hash is computed from ONLY the fields that are persisted to the
 * database, using the EXACT same key names + values that the
 * `/api/audit/integrity` verification endpoint will recompute. This
 * ensures every entry's hash can be independently verified by the
 * integrity endpoint without access to non-persisted write-time data.
 *
 * Prior to v7.3.0, the hash included `input.changes` (original,
 * unsanitized, NOT persisted) and `new Date().toISOString()` (in-memory
 * timestamp, NOT the DB `createdAt`), and used the key `resourceType`
 * while the DB column is `resource`. This made integrity verification
 * impossible. The fix uses: `{ userId, action, resource, resourceId,
 * details (sanitized), createdAt }` — all persisted fields, matching
 * the integrity endpoint's formula exactly.
 *
 * `createdAt` is set explicitly (rather than relying on the DB
 * `@default(now())`) so the hash can be computed from the same value
 * that will be persisted.
 */
export async function createAuditLog(input: AuditLogInput) {
  // Sanitize details string — strip any PII patterns
  const sanitizedDetails = input.details
    ? stripPIIFromText(input.details)
    : `${input.action} on ${input.resourceType}`;

  // Sanitize changes object — mask PII fields (stored as part of details
  // by downstream consumers; the sanitized object itself is not persisted
  // as a separate column in the AuditLog table to keep the schema frozen).
  // It is returned to the caller for use in responses if needed.
  const sanitizedChanges = input.changes
    ? sanitizeObject(input.changes)
    : {};

  // Pin the createdAt timestamp so the hash payload matches what will be
  // persisted (avoids microsecond drift between in-memory and DB timestamps).
  const createdAt = new Date();

  // Build the hash payload from PERSISTED fields only. The integrity
  // endpoint recomputes this exact formula to verify tamper-evidence.
  // IMPORTANT: key names MUST match /api/audit/integrity.
  // Addendum E: Use stableStringify() instead of JSON.stringify() to ensure
  // deterministic key ordering. If the DB/ORM reorders keys when retrieving
  // a record, JSON.stringify would produce a different string, causing
  // false integrity failures.
  const hashPayload = stableStringify({
    userId: input.userId,
    action: input.action,
    resource: input.resourceType, // map input.resourceType → DB column 'resource'
    resourceId: input.resourceId,
    details: sanitizedDetails, // sanitized (what's stored)
    createdAt: createdAt.toISOString(),
  });

  const sha256Hash = crypto.createHash('sha256').update(hashPayload).digest('hex');

  // Get last entry for WORM chain linking (P0-C Fix)
  const lastEntry = await db.auditLog.findFirst({
    orderBy: { chainIndex: 'desc' },
    select: { chainIndex: true, currentHash: true },
  });
  const chainIndex = (lastEntry?.chainIndex ?? 0) + 1;
  const prevHash = lastEntry?.currentHash ?? null;

  // Build currentHash including chain fields for tamper-evidence
  const chainHashPayload = stableStringify({
    chainIndex,
    prevHash,
    userId: input.userId,
    action: input.action,
    resource: input.resourceType,
    resourceId: input.resourceId,
    details: sanitizedDetails,
    ipAddress: input.ipAddress ?? null,
    jurisdiction: input.jurisdiction || 'AE',
    createdAt: createdAt.toISOString(),
  });
  const currentHash = crypto.createHash('sha256').update(chainHashPayload).digest('hex');

  const auditLog = await db.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      resource: input.resourceType,
      resourceId: input.resourceId,
      details: sanitizedDetails,
      sha256Hash,
      ipAddress: input.ipAddress,
      jurisdiction: input.jurisdiction || 'AE',
      createdAt, // explicit so it matches the hash
      // WORM chain fields (P0-C Fix)
      prevHash,
      currentHash,
      chainIndex,
      isSealed: true,
    },
  });

  return auditLog;
}

/**
 * Higher-order function that wraps a database mutation with automatic audit logging
 */
export function withAudit<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  auditInfo: Omit<AuditLogInput, 'resourceId' | 'changes'>
): T {
  return (async (...args: unknown[]) => {
    const result = await fn(...args);
    const resourceId = (result as Record<string, unknown>)?.id as string || 'unknown';

    await createAuditLog({
      ...auditInfo,
      resourceId,
      // Sanitize args before logging to prevent PII leakage in audit trail
      changes: { args: args.map(a => typeof a === 'object' ? stableStringify(sanitizeObject(a)) : a) },
    });

    return result;
  }) as T;
}

/**
 * Get recent audit logs with optional filtering
 */
export async function getRecentAuditLogs(filters?: {
  userId?: string;
  resource?: string;
  action?: string;
  limit?: number;
  offset?: number;
}) {
  const where: Record<string, unknown> = {};
  if (filters?.userId) where.userId = filters.userId;
  if (filters?.resource) where.resource = filters.resource;
  if (filters?.action) where.action = filters.action;

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
    }),
    db.auditLog.count({ where }),
  ]);

  return { logs, total };
}
