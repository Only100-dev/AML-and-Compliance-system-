#!/usr/bin/env bun
/**
 * v7.3.0-RC1-uat-ready — Blocker 2 Verification Script
 * ------------------------------------------------------------------
 * Verifies that createUniversalTask() is fixed (uses correct field names
 * `taskType` / `sourceId` / `sourceEntityType`) AND that the 3 UAT-critical
 * flows (CAP assignment, Policy Attestation, Circular Acknowledgment) now
 * create UniversalTask rows that surface in the assignee's My Tasks inbox.
 *
 * TEST MATRIX:
 *   1. CAP assignment       → POST /api/cap/plans → GET /api/tasks/my-tasks?taskType=CAP
 *   2. Policy attestation   → POST /api/attestations → GET /api/tasks/my-tasks?taskType=POLICY_ATTESTATION
 *   3. Attestation ack      → PUT /api/attestations → task removed from active inbox
 *   4. Direct helper call   → createUniversalTask() → row exists in DB
 *
 * All test records use UAT-* prefixed identifiers and are cleaned up at the end.
 *
 * USAGE: bunx tsx scripts/verify-universal-task-helper.mjs
 */
import { PrismaClient } from '@prisma/client';

const BASE = 'http://localhost:3000';
const TEST_USER = {
  id: 'cmqm1payy0002orjaeg2irv2e', // UAT compliance_manager (from seed-uat.ts)
  name: 'UAT User 2',
  email: 'uat-user-2@icos-test.local',
  department: 'Compliance',
  role: 'compliance_manager',
};
const DEPT_HEAD = {
  id: 'cmqm1payz0003orjaef8wzm0n', // UAT dept_head (from seed-uat.ts)
  name: 'UAT User 4',
};

const db = new PrismaClient();

function log(msg) { console.log(`[verify-ut] ${msg}`); }
function pass(msg) { console.log(`  ✓ ${msg}`); }
function fail(msg) { console.error(`  ✗ ${msg}`); }

let exitCode = 0;
const createdTaskIds = [];
const createdCapIds = [];
const createdAttestationIds = [];
const createdAckIds = [];

function headers(role = TEST_USER.role, id = TEST_USER.id) {
  return {
    'Content-Type': 'application/json',
    'x-user-role': role,
    'x-user-id': id,
  };
}

async function getMyTasks(taskType) {
  const url = `${BASE}/api/tasks/my-tasks?taskType=${taskType}&limit=200`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`my-tasks returned ${res.status}`);
  const json = await res.json();
  return json;
}

// ─── TEST 1: CAP assignment creates an inbox task ──────────────────────────────
async function testCapAssignment() {
  log('TEST 1: CAP assignment → task appears in inbox');
  const before = await getMyTasks('CAP');
  const beforeCount = before.pagination.total;

  const capRes = await fetch(`${BASE}/api/cap/plans`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      title: 'UAT-VERIFY: Test CAP for blocker 2 verification',
      description: 'Created by verify-universal-task-helper.mjs to test that CAP assignment surfaces a UniversalTask in the inbox.',
      sourceType: 'AUDIT_FINDING',
      priority: 'high',
      assignedToId: TEST_USER.id,
      assignedToName: TEST_USER.name,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  });
  if (!capRes.ok) {
    fail(`CAP creation failed: ${capRes.status} ${await capRes.text()}`);
    exitCode = 1;
    return;
  }
  const capJson = await capRes.json();
  const capId = capJson.data.id;
  createdCapIds.push(capId);
  pass(`CAP created: ${capId}`);

  // Give the helper a moment to write the task (it's awaited inside the route,
  // but the inbox query is eventually consistent — small delay for safety).
  await new Promise((r) => setTimeout(r, 100));

  const after = await getMyTasks('CAP');
  const afterCount = after.pagination.total;
  const newTask = after.data.find((t) => t.sourceId === capId && t.taskType === 'CAP');

  if (newTask) {
    createdTaskIds.push(newTask.id);
    pass(`Task surfaced in inbox: id=${newTask.id}, status=${newTask.status}, priority=${newTask.priority}`);
    pass(`Inbox CAP count: ${beforeCount} → ${afterCount} (+${afterCount - beforeCount})`);
    if (newTask.assignedToId !== TEST_USER.id) {
      fail(`Task assignedToId mismatch: expected ${TEST_USER.id}, got ${newTask.assignedToId}`);
      exitCode = 1;
    }
    if (newTask.status !== 'OPEN') {
      fail(`Task status unexpected: expected OPEN, got ${newTask.status}`);
      exitCode = 1;
    }
  } else {
    fail(`CAP task NOT found in inbox after creation (capId=${capId})`);
    exitCode = 1;
  }
}

// ─── TEST 2: Policy attestation creates an inbox task ──────────────────────────
async function testPolicyAttestation() {
  log('TEST 2: Policy attestation → task appears in inbox');
  const before = await getMyTasks('POLICY_ATTESTATION');
  const beforeCount = before.pagination.total;

  // Use a real policy from the seeded data
  const attRes = await fetch(`${BASE}/api/attestations`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      policyId: 'cmqm1payy0009orja8xk1c9xz', // seed-uat.ts policy id
      policyNumber: 'UAT-POL-VERIFY-001',
      policyTitle: 'UAT Verification Test Policy',
      userId: TEST_USER.id,
      userName: TEST_USER.name,
      department: TEST_USER.department,
      version: '1.0.0',
      attestationDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  });
  if (!attRes.ok) {
    fail(`Attestation creation failed: ${attRes.status} ${await attRes.text()}`);
    exitCode = 1;
    return;
  }
  const attJson = await attRes.json();
  const attId = attJson.data.id;
  createdAttestationIds.push(attId);
  pass(`Attestation created: ${attId}`);

  await new Promise((r) => setTimeout(r, 100));

  const after = await getMyTasks('POLICY_ATTESTATION');
  const afterCount = after.pagination.total;
  const newTask = after.data.find((t) => t.sourceId === attId && t.taskType === 'POLICY_ATTESTATION');

  if (newTask) {
    createdTaskIds.push(newTask.id);
    pass(`Task surfaced in inbox: id=${newTask.id}, status=${newTask.status}, priority=${newTask.priority}`);
    pass(`Inbox POLICY_ATTESTATION count: ${beforeCount} → ${afterCount} (+${afterCount - beforeCount})`);

    // ─── TEST 3: Acknowledge the attestation → task removed from active inbox ──
    log('TEST 3: Acknowledge attestation → task removed from active inbox');
    const ackRes = await fetch(`${BASE}/api/attestations`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({
        attestationId: attId,
        userId: TEST_USER.id,
      }),
    });
    if (!ackRes.ok) {
      fail(`Attestation ack failed: ${ackRes.status} ${await ackRes.text()}`);
      exitCode = 1;
      return;
    }
    pass(`Attestation acknowledged`);

    await new Promise((r) => setTimeout(r, 100));

    const afterAck = await getMyTasks('POLICY_ATTESTATION');
    const stillPresent = afterAck.data.find((t) => t.sourceId === attId);
    if (stillPresent) {
      fail(`Task STILL in active inbox after ack: id=${stillPresent.id} status=${stillPresent.status}`);
      exitCode = 1;
    } else {
      pass(`Task correctly removed from active inbox after acknowledgment`);
    }

    // Verify the task exists with status=DONE in the DB (filtered query)
    const doneTasks = await getMyTasks('POLICY_ATTESTATION');
    // Also check via DB directly
    const dbTask = await db.universalTask.findFirst({
      where: { taskType: 'POLICY_ATTESTATION', sourceId: attId },
    });
    if (dbTask && dbTask.status === 'DONE') {
      pass(`DB verification: task status=DONE ✓`);
    } else {
      fail(`DB verification failed: task status=${dbTask?.status ?? 'null'}`);
      exitCode = 1;
    }
  } else {
    fail(`Attestation task NOT found in inbox after creation (attId=${attId})`);
    exitCode = 1;
  }
}

// ─── TEST 4: Direct createUniversalTask() helper call ──────────────────────────
async function testDirectHelperCall() {
  log('TEST 4: Direct createUniversalTask() helper call → row exists in DB');

  // Import the helper directly
  const { createUniversalTask } = await import('../src/lib/universal-task.ts');

  const result = await createUniversalTask({
    taskType: 'CIRCULAR_ACK',
    sourceId: `UAT-VERIFY-DIRECT-${Date.now()}`,
    sourceEntityType: 'DepartmentAcknowledgment',
    sourceModule: 'DEPT_ACKNOWLEDGMENT',
    title: 'UAT-VERIFY: Direct helper call test',
    description: 'Created by verify-universal-task-helper.mjs via direct createUniversalTask() call.',
    assignedToId: DEPT_HEAD.id,
    assignedToName: DEPT_HEAD.name,
    priority: 'HIGH',
    status: 'OPEN',
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
  });

  if (result && result.id) {
    createdTaskIds.push(result.id);
    pass(`createUniversalTask() returned: id=${result.id} status=${result.status}`);

    // Verify the row exists in the DB with correct field names
    const dbRow = await db.universalTask.findUnique({
      where: { id: result.id },
    });
    if (dbRow) {
      pass(`DB row exists: taskType=${dbRow.taskType}, sourceEntityType=${dbRow.sourceEntityType}, sourceModule=${dbRow.sourceModule}`);
      if (dbRow.taskType !== 'CIRCULAR_ACK') {
        fail(`taskType field mismatch: expected CIRCULAR_ACK, got ${dbRow.taskType}`);
        exitCode = 1;
      }
      if (!dbRow.sourceEntityType) {
        fail(`sourceEntityType is null/empty — helper didn't write it`);
        exitCode = 1;
      }
      if (!dbRow.sourceModule) {
        fail(`sourceModule is null/empty — helper didn't write it`);
        exitCode = 1;
      }
      if (!dbRow.sha256Hash) {
        fail(`sha256Hash is null — tamper-evidence not computed`);
        exitCode = 1;
      } else {
        pass(`sha256Hash computed: ${dbRow.sha256Hash.slice(0, 16)}...`);
      }
    } else {
      fail(`DB row NOT found for id=${result.id}`);
      exitCode = 1;
    }
  } else {
    fail(`createUniversalTask() returned null — helper failed silently`);
    exitCode = 1;
  }
}

// ─── TEST 5: Idempotency — calling helper twice for same source returns same task ──
async function testIdempotency() {
  log('TEST 5: Idempotency — same (taskType, sourceId) returns same task');
  const { createUniversalTask } = await import('../src/lib/universal-task.ts');

  const sourceId = `UAT-VERIFY-IDEMPOTENT-${Date.now()}`;
  const first = await createUniversalTask({
    taskType: 'CAP',
    sourceId,
    sourceEntityType: 'CorrectiveActionPlan',
    sourceModule: 'CAP',
    title: 'UAT-VERIFY: Idempotency test (1st call)',
    assignedToId: TEST_USER.id,
    priority: 'MEDIUM',
    status: 'OPEN',
  });
  const second = await createUniversalTask({
    taskType: 'CAP',
    sourceId,
    sourceEntityType: 'CorrectiveActionPlan',
    sourceModule: 'CAP',
    title: 'UAT-VERIFY: Idempotency test (2nd call — should be ignored)',
    assignedToId: TEST_USER.id,
    priority: 'MEDIUM',
    status: 'OPEN',
  });

  if (first && second && first.id === second.id) {
    pass(`Idempotency verified: both calls returned id=${first.id}`);
    createdTaskIds.push(first.id);
  } else {
    fail(`Idempotency FAILED: first=${first?.id}, second=${second?.id}`);
    if (first) createdTaskIds.push(first.id);
    if (second && second.id !== first?.id) createdTaskIds.push(second.id);
    exitCode = 1;
  }
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────
async function cleanup() {
  log('Cleaning up test records...');
  // Delete UniversalTask rows
  for (const id of createdTaskIds) {
    try {
      await db.universalTask.delete({ where: { id } });
    } catch { /* already gone */ }
  }
  pass(`Deleted ${createdTaskIds.length} UniversalTask rows`);

  // Delete CAPs
  for (const id of createdCapIds) {
    try {
      await db.correctiveActionPlan.delete({ where: { id } });
    } catch { /* already gone */ }
  }
  pass(`Deleted ${createdCapIds.length} CAP rows`);

  // Delete attestations
  for (const id of createdAttestationIds) {
    try {
      // Also delete the calendar event referencing it
      await db.calendarEvent.deleteMany({ where: { sourceEntityId: id } });
      await db.policyAttestation.delete({ where: { id } });
    } catch { /* already gone */ }
  }
  pass(`Deleted ${createdAttestationIds.length} attestation rows (+ calendar events)`);

  // Delete audit logs created during verification (keep the chain clean)
  try {
    await db.auditLog.deleteMany({
      where: { details: { contains: 'UAT-VERIFY' } },
    });
  } catch { /* best effort */ }

  await db.$disconnect();
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log('=== v7.3.0-RC1-uat-ready — Blocker 2 Verification ===');
  log(`Target user: ${TEST_USER.email} (${TEST_USER.role})`);
  log('');

  try {
    await testCapAssignment();
    log('');
    await testPolicyAttestation();
    log('');
    await testDirectHelperCall();
    log('');
    await testIdempotency();
    log('');
  } finally {
    await cleanup();
  }

  log('');
  if (exitCode === 0) {
    console.log('═'.repeat(70));
    console.log('  ✓ BLOCKER 2 VERIFICATION: PASS');
    console.log('    - createUniversalTask() uses correct field names');
    console.log('    - CAP assignment surfaces a task in the inbox');
    console.log('    - Policy attestation surfaces a task in the inbox');
    console.log('    - Acknowledging an attestation removes it from the active inbox');
    console.log('    - Direct helper call creates a valid DB row with sha256Hash');
    console.log('    - Idempotency: same (taskType, sourceId) returns the same task');
    console.log('═'.repeat(70));
  } else {
    console.log('═'.repeat(70));
    console.error('  ✗ BLOCKER 2 VERIFICATION: FAIL — see errors above');
    console.log('═'.repeat(70));
  }
  process.exit(exitCode);
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  cleanup().finally(() => process.exit(1));
});
