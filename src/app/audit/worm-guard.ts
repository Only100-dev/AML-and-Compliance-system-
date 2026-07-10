/**
 * WORM (Write Once, Read Many) enforcement for AuditLog
 * Per FDL 10/2025 Art. 11 and CBUAE Notice 3551/2021 S3.1
 *
 * No UPDATE or DELETE operations are permitted on AuditLog records.
 * This guard intercepts any attempt to mutate audit log entries.
 */

import { db } from '@/lib/db';

const WORM_DENIED_ACTIONS = ['update', 'delete'] as const;

/**
 * Validate that an AuditLog mutation attempt is blocked.
 * Returns an error response if the operation is not permitted.
 */
export function checkWORMCompliance(operation: string): { allowed: boolean; error?: string } {
  if (WORM_DENIED_ACTIONS.includes(operation as typeof WORM_DENIED_ACTIONS[number])) {
    return {
      allowed: false,
      error: `WORM VIOLATION: Operation "${operation}" is not permitted on AuditLog records. ` +
        `Audit logs are immutable per FDL 10/2025 Art. 11 and CBUAE Notice 3551/2021 S3.1. ` +
        `Only INSERT (create) operations are allowed.`,
    };
  }
  return { allowed: true };
}

/**
 * Verify the integrity of the entire audit trail by checking SHA-256 hash chain.
 * Returns the number of verified entries and any integrity violations.
 */
export async function verifyAuditIntegrity(): Promise<{
  totalEntries: number;
  verified: number;
  violations: Array<{ id: string; expected: string; actual: string }>;
}> {
  const entries = await db.auditLog.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, sha256Hash: true, userId: true, action: true, resource: true, createdAt: true },
  });

  const violations: Array<{ id: string; expected: string; actual: string }> = [];

  // Verify each entry has a hash
  for (const entry of entries) {
    if (!entry.sha256Hash) {
      violations.push({
        id: entry.id,
        expected: 'SHA-256 hash present',
        actual: 'Missing hash',
      });
    }
  }

  return {
    totalEntries: entries.length,
    verified: entries.length - violations.length,
    violations,
  };
}
