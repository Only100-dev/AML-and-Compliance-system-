#!/usr/bin/env node
/**
 * Backfill AuditLog SHA-256 Hashes (v7.3.0 one-time migration)
 * ----------------------------------------------------------------
 * Recomputes the `sha256Hash` for every existing AuditLog entry using the
 * new v7.3.0 persisted-fields-only formula:
 *
 *   SHA-256(JSON.stringify({
 *     userId, action, resource, resourceId, details, createdAt
 *   }))
 *
 * This aligns existing entries with the fix in `src/lib/audit.ts` and
 * `src/app/api/audit/integrity/route.ts`, so `GET /api/audit/integrity`
 * returns `valid: true` after the backfill.
 *
 * Idempotent: safe to re-run. Entries already matching the expected hash
 * are skipped; only mismatches are updated.
 *
 * Usage:
 *   node scripts/backfill-audit-hashes.mjs
 *   node scripts/backfill-audit-hashes.mjs --dry-run   # report only, no writes
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const db = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

function computeSHA256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function expectedHash(entry) {
  const hashPayload = JSON.stringify({
    userId: entry.userId,
    action: entry.action,
    resource: entry.resource,
    resourceId: entry.resourceId,
    details: entry.details ?? '',
    createdAt: entry.createdAt.toISOString(),
  });
  return computeSHA256(hashPayload);
}

async function main() {
  console.log(`[backfill-audit-hashes] mode=${isDryRun ? 'DRY-RUN' : 'WRITE'}`);
  console.log('[backfill-audit-hashes] fetching all AuditLog entries...');

  const entries = await db.auditLog.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      userId: true,
      action: true,
      resource: true,
      resourceId: true,
      details: true,
      sha256Hash: true,
      createdAt: true,
    },
  });

  console.log(`[backfill-audit-hashes] total entries: ${entries.length}`);

  let alreadyMatching = 0;
  let missingHash = 0;
  let mismatched = 0;
  let updated = 0;
  const BATCH_SIZE = 100;
  const updates = [];

  for (const entry of entries) {
    const recomputed = expectedHash(entry);

    if (!entry.sha256Hash) {
      missingHash++;
      updates.push({ id: entry.id, sha256Hash: recomputed });
    } else if (entry.sha256Hash === recomputed) {
      alreadyMatching++;
    } else {
      mismatched++;
      updates.push({ id: entry.id, sha256Hash: recomputed });
    }
  }

  console.log(`[backfill-audit-hashes] already matching:  ${alreadyMatching}`);
  console.log(`[backfill-audit-hashes] missing hash:      ${missingHash}`);
  console.log(`[backfill-audit-hashes] mismatched:        ${mismatched}`);
  console.log(`[backfill-audit-hashes] to update:         ${updates.length}`);

  if (isDryRun) {
    console.log('[backfill-audit-hashes] DRY-RUN — no writes performed.');
    return;
  }

  if (updates.length === 0) {
    console.log('[backfill-audit-hashes] nothing to update — all entries already match the new formula.');
    return;
  }

  // Update in batches to avoid SQLite lock contention.
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    await db.$transaction(
      batch.map((u) =>
        db.auditLog.update({
          where: { id: u.id },
          data: { sha256Hash: u.sha256Hash },
        })
      )
    );
    updated += batch.length;
    if (updated % 1000 === 0 || updated === updates.length) {
      console.log(`[backfill-audit-hashes] progress: ${updated}/${updates.length} updated`);
    }
  }

  console.log(`[backfill-audit-hashes] DONE. Updated ${updated} entries.`);
  console.log('[backfill-audit-hashes] Run `curl -H "x-user-id: u" -H "x-user-role: admin" http://localhost:3000/api/audit/integrity` to verify valid: true.');
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error('[backfill-audit-hashes] FAILED:', e);
    db.$disconnect();
    process.exit(1);
  });
