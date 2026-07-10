#!/usr/bin/env node
/**
 * Investigate Audit Integrity Discrepancy (Pre-UAT Blocker)
 * ---------------------------------------------------------
 * Finds all AuditLog entries with a NULL or empty `sha256Hash` and prints
 * their full identifying details so the root cause can be determined:
 *   - id, createdAt (with "is today?" flag), action, resource, resourceId,
 *     userId, ipAddress, truncated details.
 *
 * This is a READ-ONLY diagnostic — no writes.
 *
 * Usage: node scripts/investigate-audit-discrepancy.mjs
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('═'.repeat(72));
  console.log(' Audit Integrity Discrepancy — Investigation (READ-ONLY)');
  console.log('═'.repeat(72));

  const all = await db.auditLog.findMany({
    select: {
      id: true,
      userId: true,
      action: true,
      resource: true,
      resourceId: true,
      details: true,
      sha256Hash: true,
      ipAddress: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const total = all.length;
  const nullHash = all.filter((e) => !e.sha256Hash);
  const withHash = all.filter((e) => e.sha256Hash);

  console.log(` Total entries           : ${total}`);
  console.log(` Entries WITH sha256Hash : ${withHash.length}`);
  console.log(` Entries MISSING hash    : ${nullHash.length}`);
  console.log('─'.repeat(72));

  if (nullHash.length === 0) {
    console.log(' No missing-hash entries found. Audit chain is fully populated.');
    console.log('═'.repeat(72));
    return;
  }

  // Determine "today" boundary in UTC for the "is today?" check.
  const now = new Date();
  const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  console.log(` Missing-hash entries (full details):`);
  console.log('');
  for (let i = 0; i < nullHash.length; i++) {
    const e = nullHash[i];
    const created = e.createdAt;
    const isToday = created >= startOfTodayUtc;
    const ageHours = ((now - created) / 3_600_000).toFixed(1);
    const detailsPreview = (e.details ?? '').slice(0, 120);
    console.log(`  [${i + 1}] id          : ${e.id}`);
    console.log(`      createdAt   : ${created.toISOString()}  (age: ${ageHours}h, isToday: ${isToday})`);
    console.log(`      action      : ${e.action}`);
    console.log(`      resource    : ${e.resource}`);
    console.log(`      resourceId  : ${e.resourceId}`);
    console.log(`      userId      : ${e.userId}`);
    console.log(`      ipAddress   : ${e.ipAddress ?? '(none)'}`);
    console.log(`      details     : ${detailsPreview}${(e.details ?? '').length > 120 ? '…' : ''}`);
    console.log('');
  }

  // Summary by action + resource for root-cause pattern detection.
  const byAction = {};
  for (const e of nullHash) {
    const key = `${e.action} / ${e.resource}`;
    byAction[key] = (byAction[key] || 0) + 1;
  }
  console.log('─'.repeat(72));
  console.log(' Missing-hash breakdown by (action / resource):');
  for (const [key, count] of Object.entries(byAction)) {
    console.log(`   ${count}×  ${key}`);
  }

  // Time window of the missing-hash entries.
  const times = nullHash.map((e) => e.createdAt.getTime()).sort((a, b) => a - b);
  console.log('');
  console.log(` Earliest missing-hash entry : ${new Date(times[0]).toISOString()}`);
  console.log(` Latest missing-hash entry   : ${new Date(times[times.length - 1]).toISOString()}`);
  console.log('═'.repeat(72));
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error('[investigate] FAILED:', e);
    db.$disconnect();
    process.exit(1);
  });
