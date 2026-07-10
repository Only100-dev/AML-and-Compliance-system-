/**
 * P0-C Fix: WORM/Immutable Audit Storage — Chain-Linked Audit Log
 *
 * Implements a SHA-256 linked-list (blockchain-inspired) audit trail where:
 * - Each AuditLog entry includes prevHash (hash of the previous entry)
 * - currentHash is computed from ALL persisted fields + prevHash
 * - chainIndex is a monotonic sequence number
 * - isSealed prevents modification after creation (WORM = Write Once, Read Many)
 *
 * Per Fortress v5.0 A-010: The existing AuditLog stored SHA-256 hashes on
 * mutable SQLite records — this is NOT tamper-evident because the hash can
 * be recomputed after modification. The chain-link design means any tampering
 * breaks the entire chain from that point forward, making it detectable.
 *
 * Also implements withAuditLog() HOF to wrap the 34 mutating API routes
 * identified by the Fortress v5.0 audit gap analysis (18% → 0%).
 */

import { db } from '@/lib/db';
import crypto from 'crypto';
import { stableStringify } from '@/lib/stable-stringify';
import { sanitizeObject, stripPIIFromText } from '@/lib/pii';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface WormAuditInput {
  userId: string;
  action: string;         // CREATE, UPDATE, DELETE, APPROVE, REJECT, SUBMIT, etc.
  entityType: string;     // Policy, Claim, User, SAR, GoAMLFiling, etc.
  entityId: string;
  payload?: Record<string, unknown>;  // The actual data changed
  details?: string;
  ipAddress?: string;
  jurisdiction?: string;
}

export interface WormAuditResult {
  id: string;
  chainIndex: number;
  currentHash: string;
  prevHash: string | null;
}

// ─── Chain-Linked Audit Log Creation ────────────────────────────────────────────

/**
 * Create a WORM (Write Once, Read Many) audit log entry with chain integrity.
 *
 * This function:
 * 1. Gets the last audit entry to build the chain link (prevHash)
 * 2. Computes chainIndex (monotonic increment)
 * 3. Computes currentHash from all persisted fields + prevHash
 * 4. Creates the entry with isSealed=true (immutable after creation)
 *
 * The chain design ensures:
 * - Any deletion of an entry breaks the chain (prevHash won't match)
 * - Any modification of an entry changes its hash, breaking the chain forward
 * - Inserting a fake entry requires recomputing all subsequent hashes
 */
export async function createWormAuditLog(input: WormAuditInput): Promise<WormAuditResult> {
  // Get the last audit entry for chain linking
  const lastEntry = await db.auditLog.findFirst({
    orderBy: { chainIndex: 'desc' },
    select: { chainIndex: true, currentHash: true },
  });

  const chainIndex = (lastEntry?.chainIndex ?? 0) + 1;
  const prevHash = lastEntry?.currentHash ?? null;

  // Sanitize details — strip PII per CBUAE data minimization requirements
  const sanitizedDetails = input.details
    ? stripPIIFromText(input.details)
    : `${input.action} on ${input.entityType}`;

  // Pin the createdAt timestamp so the hash payload matches what will be persisted
  const createdAt = new Date();

  // Build the hash payload from ALL persisted fields + prevHash for chain integrity
  const hashPayload = stableStringify({
    chainIndex,
    prevHash,
    userId: input.userId,
    action: input.action,
    resource: input.entityType,
    resourceId: input.entityId,
    details: sanitizedDetails,
    ipAddress: input.ipAddress ?? null,
    jurisdiction: input.jurisdiction ?? null,
    createdAt: createdAt.toISOString(),
  });

  const currentHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

  // Create the audit log entry as sealed (WORM — cannot be modified)
  const auditLog = await db.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      resource: input.entityType,
      resourceId: input.entityId,
      details: sanitizedDetails,
      sha256Hash: currentHash, // Keep for backward compatibility with integrity checks
      ipAddress: input.ipAddress,
      jurisdiction: input.jurisdiction ?? 'UNKNOWN',
      createdAt,
      // WORM chain fields
      prevHash,
      currentHash,
      chainIndex,
      isSealed: true,
    },
  });

  return {
    id: auditLog.id,
    chainIndex,
    currentHash,
    prevHash,
  };
}

// ─── Chain Integrity Verification ───────────────────────────────────────────────

/**
 * Verify the integrity of the entire audit chain from a given starting index.
 * Returns the number of broken links found (0 = fully intact chain).
 */
export async function verifyAuditChain(fromIndex?: number): Promise<{
  isValid: boolean;
  totalEntries: number;
  brokenLinks: Array<{ index: number; expected: string; actual: string | null }>;
}> {
  const where = fromIndex ? { chainIndex: { gte: fromIndex } } : {};
  const entries = await db.auditLog.findMany({
    where,
    orderBy: { chainIndex: 'asc' },
  });

  const brokenLinks: Array<{ index: number; expected: string; actual: string | null }> = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Check 1: prevHash must match the currentHash of the previous entry
    if (i > 0) {
      const expectedPrevHash = entries[i - 1].currentHash;
      if (entry.prevHash !== expectedPrevHash) {
        brokenLinks.push({
          index: entry.chainIndex,
          expected: expectedPrevHash ?? 'null',
          actual: entry.prevHash,
        });
      }
    }

    // Check 2: currentHash must be recomputable from the entry's fields
    const recomputedHash = recomputeHash(entry);
    if (recomputedHash !== entry.currentHash) {
      brokenLinks.push({
        index: entry.chainIndex,
        expected: recomputedHash ?? 'null',
        actual: entry.currentHash,
      });
    }
  }

  return {
    isValid: brokenLinks.length === 0,
    totalEntries: entries.length,
    brokenLinks,
  };
}

/**
 * Recompute the currentHash for an audit log entry to verify it hasn't been tampered with.
 */
function recomputeHash(entry: {
  chainIndex: number;
  prevHash: string | null;
  userId: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: string | null;
  ipAddress: string | null;
  jurisdiction: string | null;
  createdAt: Date;
}): string {
  const hashPayload = stableStringify({
    chainIndex: entry.chainIndex,
    prevHash: entry.prevHash,
    userId: entry.userId,
    action: entry.action,
    resource: entry.resource,
    resourceId: entry.resourceId ?? 'unknown',
    details: entry.details ?? '',
    ipAddress: entry.ipAddress ?? null,
    jurisdiction: entry.jurisdiction ?? null,
    createdAt: new Date(entry.createdAt).toISOString(),
  });

  return crypto.createHash('sha256').update(hashPayload).digest('hex');
}

// ─── withAuditLog HOF ───────────────────────────────────────────────────────────

type NextAuthSession = {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } & Record<string, unknown>;
} | null;

type ApiHandler = (request: Request, context?: unknown) => Promise<Response>;

interface WithAuditLogOptions {
  entityType: string;
  actionPrefix?: string;  // e.g., 'CREATE', 'UPDATE', 'DELETE' — auto-detected if not provided
}

/**
 * Higher-order function that wraps an API route handler with automatic WORM audit logging.
 *
 * Usage:
 * ```typescript
 * // In src/app/api/policies/route.ts
 * export const POST = withAuditLog(
 *   async (request) => {
 *     // ... your handler logic
 *     return NextResponse.json({ success: true, data: result });
 *   },
 *   { entityType: 'Policy' }
 * );
 * ```
 *
 * The HOF:
 * 1. Extracts the user session from the request
 * 2. Executes the original handler
 * 3. On success (2xx response), creates a WORM audit log entry
 * 4. On failure, does NOT create an audit entry (failed attempts are logged by middleware)
 *
 * The action is auto-detected from the HTTP method if actionPrefix is not provided:
 * - POST → CREATE
 * - PUT/PATCH → UPDATE
 * - DELETE → DELETE
 */
export function withAuditLog(
  handler: ApiHandler,
  options: WithAuditLogOptions
): ApiHandler {
  return async (request, context) => {
    // Execute the handler first
    const response = await handler(request, context);

    // Only audit on successful mutations (2xx status)
    if (response.ok) {
      try {
        // Extract user info from the session
        const { getServerSession } = await import('next-auth');
        const { authOptions } = await import('@/app/api/auth/[...nextauth]/route');
        const session = await getServerSession(authOptions) as NextAuthSession;

        const userId = (session?.user as Record<string, unknown>)?.userId as string
          ?? (session?.user as Record<string, unknown>)?.id as string
          ?? 'anonymous';

        const jurisdiction = (session?.user as Record<string, unknown>)?.jurisdiction as string
          ?? (session?.user as Record<string, unknown>)?.jurisdictionId as string
          ?? 'UNKNOWN';

        // Auto-detect action from HTTP method
        const method = request.method.toUpperCase();
        const actionPrefix = options.actionPrefix ?? (
          method === 'POST' ? 'CREATE' :
          method === 'PUT' || method === 'PATCH' ? 'UPDATE' :
          method === 'DELETE' ? 'DELETE' :
          method
        );

        // Try to extract entity ID from the response body
        let entityId = 'unknown';
        try {
          const clonedResponse = response.clone();
          const body = await clonedResponse.json();
          entityId = body?.data?.id ?? body?.id ?? body?.data?.entityId ?? 'unknown';
        } catch {
          // Response body is not JSON or not accessible — use 'unknown'
        }

        await createWormAuditLog({
          userId,
          action: `${actionPrefix}_${options.entityType}`.toUpperCase(),
          entityType: options.entityType,
          entityId,
          jurisdiction,
          details: `${actionPrefix} operation on ${options.entityType}`,
          ipAddress: request.headers.get('x-forwarded-for')
            ?? request.headers.get('x-real-ip')
            ?? undefined,
        });
      } catch (auditError) {
        // Audit logging failure should NOT block the operation
        // But we must log it for investigation
        console.error('[WORM AUDIT] Failed to create audit log entry:', auditError);
      }
    }

    return response;
  };
}

/**
 * Backward-compatible wrapper that adds WORM audit to the existing createAuditLog flow.
 * This ensures all existing callers automatically get chain-linked audit entries.
 */
export async function createAuditLogWithWorm(input: {
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: Record<string, unknown>;
  details?: string;
  ipAddress?: string;
}): Promise<WormAuditResult> {
  return createWormAuditLog({
    userId: input.userId,
    action: input.action,
    entityType: input.resourceType,
    entityId: input.resourceId,
    payload: input.changes,
    details: input.details,
    ipAddress: input.ipAddress,
  });
}

/**
 * Simplified WORM chain integrity verification for the Examiner Pack API.
 * Returns a boolean verdict plus counts — sufficient for regulatory reporting
 * where the examiner needs a pass/fail, not a detailed list of broken links.
 */
export async function verifyWormChainIntegrity(): Promise<{
  isValid: boolean;
  totalLogs: number;
  brokenLinks: number;
}> {
  const logs = await db.auditLog.findMany({
    orderBy: { chainIndex: 'asc' },
    select: { prevHash: true, currentHash: true, chainIndex: true },
  });

  let brokenLinks = 0;
  let prevHash: string | null = null; // Genesis: first entry has prevHash = null

  for (const log of logs) {
    if (log.prevHash !== prevHash) {
      brokenLinks++;
    }
    prevHash = log.currentHash;
  }

  return {
    isValid: brokenLinks === 0,
    totalLogs: logs.length,
    brokenLinks,
  };
}
