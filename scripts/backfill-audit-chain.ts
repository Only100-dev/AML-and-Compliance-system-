/**
 * IC-OS P0-1b — AuditLog Hash Chain Backfill Migration
 *
 * Rewrites every AuditLog row's `sha256Hash` and `previousHash` to conform
 * to the v2 chain algorithm (sha256-chain-v2) defined in
 * `src/lib/audit.ts:computeAuditHash()`.
 *
 * Algorithm:
 *   1. Read all rows in deterministic order: createdAt ASC, then id ASC.
 *   2. Walk the chain. For each row, compute:
 *        newHash = computeAuditHash({
 *          previousHash,            // null for the genesis row
 *          userId, action, resource,
 *          resourceId, details,
 *          createdAt,               // persisted DB value (unchanged)
 *        })
 *   3. FLAG BREAKS: a "break" is where the OLD stored sha256Hash was
 *      non-null AND differs from newHash. These represent historical hash
 *      mismatches under the v1 algorithm and are documented in the break
 *      report (not fatal — the v2 algorithm is by definition different).
 *   4. Update the row:
 *        db.auditLog.update({ where: { id }, data: { previousHash, sha256Hash: newHash } })
 *      `createdAt` is left UNCHANGED (we preserve the original timestamp).
 *   5. Advance previousHash = newHash for the next iteration.
 *
 * Idempotency:
 *   - Second run finds 0 breaks because every row's stored sha256Hash now
 *     equals the recomputed newHash.
 *   - previousHash pointers are also stable: the predecessor's newHash is
 *     deterministic given (createdAt, id) ordering.
 *
 * Failure isolation:
 *   - Each row update is wrapped in try/catch. A single bad row is logged
 *     and skipped; the migration continues.
 *
 * Usage:
 *   bun run scripts/backfill-audit-chain.ts             # live run
 *   bun run scripts/backfill-audit-chain.ts --dry-run   # report only, no writes
 *
 * Output:
 *   - Break report written to /home/z/my-project/audit-chain-backfill-report.json
 *   - Same report printed to stdout
 *   - Console summary with break count
 */

import { db } from '../src/lib/db';
import { computeAuditHash } from '../src/lib/audit';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BreakRecord {
  id: string;
  reason: 'OLD_HASH_MISMATCH';
  oldHash: string | null;
  newHash: string;
  previousHash: string | null;
  createdAt: string;
  action: string;
  resource: string;
}

interface UpdateFailure {
  id: string;
  error: string;
  createdAt: string;
  action: string;
  resource: string;
}

interface BackfillReport {
  algorithm: 'sha256-chain-v2';
  ranAt: string;
  dryRun: boolean;
  totalRows: number;
  breaksCount: number;
  updateFailuresCount: number;
  rowsUpdated: number;
  breaks: BreakRecord[];
  updateFailures: UpdateFailure[];
  chainHeadHash: string | null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const REPORT_PATH = resolve('/home/z/my-project/audit-chain-backfill-report.json');

  console.log('═'.repeat(72));
  console.log(' IC-OS P0-1b — AuditLog Hash Chain Backfill (sha256-chain-v2)');
  console.log('═'.repeat(72));
  console.log(` Mode              : ${dryRun ? 'DRY-RUN (no writes)' : 'LIVE (writes enabled)'}`);
  console.log(` Report path       : ${REPORT_PATH}`);
  console.log(` Started at        : ${new Date().toISOString()}`);
  console.log('─'.repeat(72));

  // 1. Read all rows in deterministic order.
  const rows = await db.auditLog.findMany({
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      userId: true,
      action: true,
      resource: true,
      resourceId: true,
      details: true,
      sha256Hash: true,
      previousHash: true,
      createdAt: true,
    },
  });

  console.log(` Total rows fetched: ${rows.length}`);
  console.log('─'.repeat(72));

  const breaks: BreakRecord[] = [];
  const updateFailures: UpdateFailure[] = [];
  let rowsUpdated = 0;
  let previousHash: string | null = null;
  let chainHeadHash: string | null = null;

  for (const row of rows) {
    // 2. Compute the v2 hash for this row given the running previousHash.
    const newHash = computeAuditHash({
      previousHash,
      userId: row.userId,
      action: row.action,
      resource: row.resource,
      resourceId: row.resourceId,
      details: row.details,
      createdAt: row.createdAt,
    });

    // 3. Flag breaks: OLD stored hash was non-null AND differs from newHash.
    //    Note: a row whose stored hash is null (e.g., legacy) is silently
    //    upgraded — that's not a "break", it's a backfill.
    if (row.sha256Hash !== null && row.sha256Hash !== newHash) {
      breaks.push({
        id: row.id,
        reason: 'OLD_HASH_MISMATCH',
        oldHash: row.sha256Hash,
        newHash,
        previousHash,
        createdAt: row.createdAt.toISOString(),
        action: row.action,
        resource: row.resource,
      });
    }

    // 4. Update the row (unless dry-run). Wrap in try/catch so one bad row
    //    doesn't abort the whole migration.
    if (!dryRun) {
      // Only write when something actually changes — idempotency optimization.
      const needsUpdate =
        row.sha256Hash !== newHash || row.previousHash !== previousHash;
      if (needsUpdate) {
        try {
          await db.auditLog.update({
            where: { id: row.id },
            data: {
              previousHash,
              sha256Hash: newHash,
            },
          });
          rowsUpdated++;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          updateFailures.push({
            id: row.id,
            error: message,
            createdAt: row.createdAt.toISOString(),
            action: row.action,
            resource: row.resource,
          });
          console.error(`  [UPDATE FAILED] id=${row.id} action=${row.action} — ${message}`);
        }
      }
    }

    // 5. Advance the chain pointer.
    previousHash = newHash;
    chainHeadHash = newHash;
  }

  // ─── Build & emit the report ──────────────────────────────────────────────
  const report: BackfillReport = {
    algorithm: 'sha256-chain-v2',
    ranAt: new Date().toISOString(),
    dryRun,
    totalRows: rows.length,
    breaksCount: breaks.length,
    updateFailuresCount: updateFailures.length,
    rowsUpdated: dryRun ? 0 : rowsUpdated,
    breaks,
    updateFailures,
    chainHeadHash,
  };

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
  console.log('─'.repeat(72));
  console.log(` Breaks flagged     : ${breaks.length}`);
  console.log(` Update failures    : ${updateFailures.length}`);
  console.log(` Rows updated       : ${dryRun ? 0 : rowsUpdated}`);
  console.log(` Chain head hash    : ${chainHeadHash ?? '(empty table)'}`);
  console.log(` Report written to  : ${REPORT_PATH}`);
  console.log('═'.repeat(72));

  if (breaks.length > 0 && !dryRun) {
    console.log('');
    console.log(' NOTE: breaks represent historical hash mismatches under the v1');
    console.log(' algorithm (writer/verifier used different field sets, no chain');
    console.log(' linkage). They have been regenerated under the v2 chain');
    console.log(' algorithm. A second run will find 0 breaks (idempotent).');
    console.log('');
  }
}

main()
  .catch((err) => {
    console.error('[BACKFILL] Fatal error:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
