#!/usr/bin/env bun
/**
 * IC-OS GoAML Test-Artifact Cleanup
 * ============================================================================
 * Removes leftover AUTH-BYPASS-PROBE-* test records from the GoAMLFiling table.
 * These were created during security testing (auth-bypass probes) and were never
 * cleaned up. They would be visible to UAT stakeholders testing Scenario 2
 * (GoAML Maker-Checker) and look unprofessional.
 *
 * Idempotent: safe to re-run. Deletes only records whose referenceNumber starts
 * with 'AUTH-BYPASS-PROBE-'. Reports count before/after.
 *
 * Introduced by: UAT Hotfix Batch 4 (Issue 9 — hygiene).
 * Run: bun run scripts/cleanup-goaml-test-artifacts.ts
 */

import { db } from '@/lib/db';

async function main() {
  const before = await db.goAMLFiling.count({
    where: { referenceNumber: { startsWith: 'AUTH-BYPASS-PROBE-' } },
  });
  console.log(`[cleanup-goaml-test-artifacts] AUTH-BYPASS-PROBE records found: ${before}`);

  if (before === 0) {
    console.log('[cleanup-goaml-test-artifacts] Nothing to clean. DB is already free of test artifacts.');
    return;
  }

  const deleted = await db.goAMLFiling.deleteMany({
    where: { referenceNumber: { startsWith: 'AUTH-BYPASS-PROBE-' } },
  });

  const after = await db.goAMLFiling.count({
    where: { referenceNumber: { startsWith: 'AUTH-BYPASS-PROBE-' } },
  });

  console.log(`[cleanup-goaml-test-artifacts] Deleted ${deleted.count} test-artifact record(s).`);
  console.log(`[cleanup-goaml-test-artifacts] Remaining AUTH-BYPASS-PROBE records: ${after} (should be 0).`);
  console.log('[cleanup-goaml-test-artifacts] DONE.');
}

main()
  .catch((e) => {
    console.error('[cleanup-goaml-test-artifacts] FAILED:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
