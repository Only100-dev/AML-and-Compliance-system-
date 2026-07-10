#!/usr/bin/env node
/**
 * Cleanup Audit Integrity Discrepancy — Delete Test Artifacts (Pre-UAT)
 * --------------------------------------------------------------------
 * Removes the 2 null-sha256Hash AuditLog entries created by the Blocker 2
 * verification script (scripts/verify-universal-task-helper.mjs) on
 * 2026-06-20 ~08:50 UTC, plus their associated test records so no orphans
 * remain:
 *
 *   AuditLog entries (2):
 *     - cmqm4bdmz0010orolwfci9q0i  ATTESTATION_CREATED      / PolicyAttestation
 *     - cmqm4bdqs0012orol9r2mocbz  ATTESTATION_ACKNOWLEDGED / PolicyAttestation
 *     (both resourceId = cmqm4bdmx000yorolqh1lns69, policyNumber=UAT-POL-VERIFY-001)
 *
 *   Associated test records (by resourceId / sourceId / sourceEntityId):
 *     - UniversalTask  where sourceId       = <attestationId>
 *     - CalendarEvent  where sourceEntityId = <attestationId>
 *     - PolicyAttestation where id          = <attestationId>
 *
 * Safety: the script ONLY deletes AuditLog rows whose sha256Hash is NULL AND
 * whose details contain 'UAT-POL-VERIFY-001'. It will refuse to touch any
 * real (hashed) audit entry. A summary is printed + written to a report file.
 *
 * Usage:
 *   node scripts/cleanup-audit-discrepancy.mjs --dry-run   # report only
 *   node scripts/cleanup-audit-discrepancy.mjs             # execute deletes
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const db = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');
const REPORT_PATH = resolve('/home/z/my-project/audit-discrepancy-cleanup-report.json');

// Sentinel that uniquely identifies the Blocker 2 verification-script test data.
const TEST_SENTINEL = 'UAT-POL-VERIFY-001';

async function main() {
  console.log('═'.repeat(72));
  console.log(' Audit Discrepancy Cleanup — Delete Test Artifacts');
  console.log('═'.repeat(72));
  console.log(` Mode              : ${isDryRun ? 'DRY-RUN (no writes)' : 'EXECUTE (deletes enabled)'}`);
  console.log(` Test sentinel     : "${TEST_SENTINEL}"`);
  console.log(` Started at        : ${new Date().toISOString()}`);
  console.log('─'.repeat(72));

  // 1. Find the null-hash AuditLog entries that are test artifacts.
  //    Safety gate: sha256Hash MUST be null AND details MUST contain the
  //    test sentinel. This guarantees we never touch a real audit entry.
  const targetAuditLogs = await db.auditLog.findMany({
    where: { sha256Hash: null },
    select: {
      id: true,
      userId: true,
      action: true,
      resource: true,
      resourceId: true,
      details: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const testArtifacts = targetAuditLogs.filter((e) =>
    (e.details ?? '').includes(TEST_SENTINEL)
  );

  console.log(` Null-hash AuditLog entries found   : ${targetAuditLogs.length}`);
  console.log(`   …of which match test sentinel     : ${testArtifacts.length}`);
  console.log('─'.repeat(72));

  if (testArtifacts.length === 0) {
    console.log(' No test-artifact audit entries to delete. Nothing to do.');
    console.log('═'.repeat(72));
    return;
  }

  // Collect the distinct resourceIds (PolicyAttestation ids) to clean up.
  const attestationIds = [...new Set(testArtifacts.map((e) => e.resourceId))];
  const auditLogIds = testArtifacts.map((e) => e.id);

  console.log(' Test-artifact AuditLog entries to delete:');
  for (const e of testArtifacts) {
    console.log(`   • id=${e.id}  action=${e.action}  createdAt=${e.createdAt.toISOString()}`);
  }
  console.log('');
  console.log(` Associated PolicyAttestation ids   : ${attestationIds.join(', ')}`);
  console.log('─'.repeat(72));

  // 2. Preview the associated records that will be deleted.
  const associatedUniversalTasks = await db.universalTask.findMany({
    where: { sourceId: { in: attestationIds } },
    select: { id: true, taskType: true, sourceId: true, status: true },
  });
  const associatedCalendarEvents = await db.calendarEvent.findMany({
    where: { sourceEntityId: { in: attestationIds } },
    select: { id: true, title: true, sourceEntityId: true },
  });
  const associatedAttestations = await db.policyAttestation.findMany({
    where: { id: { in: attestationIds } },
    select: { id: true, policyNumber: true, policyTitle: true, status: true },
  });

  console.log(` Associated UniversalTask rows      : ${associatedUniversalTasks.length}`);
  for (const t of associatedUniversalTasks) {
    console.log(`   • id=${t.id}  taskType=${t.taskType}  status=${t.status}`);
  }
  console.log(` Associated CalendarEvent rows      : ${associatedCalendarEvents.length}`);
  for (const c of associatedCalendarEvents) {
    console.log(`   • id=${c.id}  title="${c.title}"`);
  }
  console.log(` Associated PolicyAttestation rows  : ${associatedAttestations.length}`);
  for (const a of associatedAttestations) {
    console.log(`   • id=${a.id}  policyNumber=${a.policyNumber}  status=${a.status}`);
  }
  console.log('─'.repeat(72));

  if (isDryRun) {
    console.log(' DRY-RUN — no deletes performed.');
    const report = {
      mode: 'dry-run',
      ranAt: new Date().toISOString(),
      testSentinel: TEST_SENTINEL,
      auditLogsToDelete: auditLogIds,
      associatedUniversalTaskIds: associatedUniversalTasks.map((t) => t.id),
      associatedCalendarEventIds: associatedCalendarEvents.map((c) => c.id),
      associatedPolicyAttestationIds: associatedAttestations.map((a) => a.id),
    };
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    console.log(` Report written to: ${REPORT_PATH}`);
    console.log('═'.repeat(72));
    return;
  }

  // 3. Execute the deletes in dependency order (children first, parent last).
  //    All wrapped in a transaction so the cleanup is atomic.
  console.log(' Executing deletes (transactional)…');
  const result = await db.$transaction(async (tx) => {
    const delTasks = await tx.universalTask.deleteMany({
      where: { sourceId: { in: attestationIds } },
    });
    const delEvents = await tx.calendarEvent.deleteMany({
      where: { sourceEntityId: { in: attestationIds } },
    });
    const delAttestations = await tx.policyAttestation.deleteMany({
      where: { id: { in: attestationIds } },
    });
    const delAuditLogs = await tx.auditLog.deleteMany({
      where: { id: { in: auditLogIds } },
    });
    return { delTasks, delEvents, delAttestations, delAuditLogs };
  });

  console.log('');
  console.log(' ── Delete Summary ──');
  console.log(`   UniversalTask rows deleted     : ${result.delTasks.count}`);
  console.log(`   CalendarEvent rows deleted     : ${result.delEvents.count}`);
  console.log(`   PolicyAttestation rows deleted : ${result.delAttestations.count}`);
  console.log(`   AuditLog rows deleted          : ${result.delAuditLogs.count}`);
  console.log('─'.repeat(72));

  // 4. Verify: re-count null-hash entries.
  const remainingNullHash = await db.auditLog.count({ where: { sha256Hash: null } });
  const totalRemaining = await db.auditLog.count();
  console.log(` Post-cleanup verification:`);
  console.log(`   Total AuditLog entries         : ${totalRemaining}`);
  console.log(`   Remaining null-hash entries    : ${remainingNullHash}`);
  console.log(`   Expected verified              : ${totalRemaining - remainingNullHash}/${totalRemaining}`);
  console.log('═'.repeat(72));

  const report = {
    mode: 'execute',
    ranAt: new Date().toISOString(),
    testSentinel: TEST_SENTINEL,
    deleted: {
      universalTasks: result.delTasks.count,
      calendarEvents: result.delEvents.count,
      policyAttestations: result.delAttestations.count,
      auditLogs: result.delAuditLogs.count,
    },
    deletedAuditLogIds: auditLogIds,
    deletedAttestationIds: attestationIds,
    postCleanup: {
      totalAuditLogEntries: totalRemaining,
      remainingNullHashEntries: remainingNullHash,
    },
  };
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(` Report written to: ${REPORT_PATH}`);
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error('[cleanup] FAILED:', e);
    db.$disconnect();
    process.exit(1);
  });
