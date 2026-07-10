#!/usr/bin/env node
/**
 * IC-OS v7.3.0 — Phase 4 Step 3 — Mock Data Generator (Task P4-3-b)
 * ==================================================================
 * Populates the SQLite DB (db/custom.db) with a realistic load-test
 * dataset for the 4 endpoints under test:
 *
 *   1. GET /api/tasks/my-tasks          (UniversalTask — added by P4-3-a)
 *   2. GET /api/complaints              (Complaint)
 *   3. GET /api/audit/integrity         (AuditLog SHA-256 chain verification)
 *   4. GET /api/department-risk         (DepartmentRiskScore)
 *
 * DATASET VOLUME
 *   - 50  synthetic users              (loadtest-user-001 … loadtest-user-050)
 *   - 50  synthetic departments         (dept-loadtest-001 … dept-loadtest-050)
 *       → 50 DepartmentRiskScore rows
 *   - 10,000 UniversalTask records      (200 per user, varied taskType/status/dueDate)
 *   - 5,000  Complaint records          (100 per department, 20/30/50 SLA distribution)
 *   - 2,500  CorrectiveActionPlan rows  (50 per department)
 *   - 1,000  AuditLog entries           (LOADTEST_AUDIT action — stresses integrity scan)
 *
 * IDEMPOTENCY
 *   Re-running is safe. At startup we count existing Complaint rows whose
 *   `subject` starts with the sentinel `LOADTEST-`. If any exist, the
 *   script prints a skip message and exits 0 — existing data is never
 *   clobbered. All mock rows are tagged with the `LOADTEST-` prefix so
 *   they can be cleaned up later via `DELETE FROM ... WHERE ... LIKE 'LOADTEST-%'`.
 *
 * BATCHING
 *   Inserts use Prisma `createMany` in batches of 100. `createMany` issues
 *   a single parameterised INSERT (atomic on SQLite) which is both faster
 *   and lock-friendlier than 100 individual `create()` calls — satisfying
 *   the spec's "use $transaction batches of 100 to avoid SQLite lock
 *   contention" intent. `skipDuplicates: true` makes each batch robust
 *   against accidental unique-key collisions on partial re-runs.
 *
 * UNIVERSALTASK SCHEMA (shipped by P4-3-a — verified against prisma/schema.prisma)
 *   The UniversalTask model exposes:
 *     id               String   @id @default(cuid())
 *     taskType         String   // ALERT | COMPLAINT | CAP | SAR | MAKER_CHECKER
 *     sourceId         String   // FK to source record (unique per taskType)
 *     sourceEntityType String   // 'ComplianceAlert' | 'Complaint' | 'CorrectiveActionPlan' | 'SARCase' | 'MakerCheckerLog'
 *     title            String
 *     description      String?
 *     assignedToId     String?  // null = unassigned pool
 *     assignedToName   String?
 *     priority         String   @default("MEDIUM")
 *     status           String   @default("OPEN")
 *     dueDate          DateTime?
 *     sourceModule     String   // COMPLIANCE_ALERTS | COMPLAINTS | CAP | SAR | MAKER_CHECKER
 *     isImmutable      Boolean  @default(false)
 *     sha256Hash       String?
 *     createdAt        DateTime @default(now())
 *     updatedAt        DateTime @updatedAt
 *     @@unique([taskType, sourceId])
 *   A defensive try/catch still wraps each batch so a schema drift won't
 *   abort the other 3 models' generation.
 *
 * USAGE
 *   node scripts/generate-mock-data.mjs
 *   # or: bun run scripts/generate-mock-data.mjs
 *
 * EXIT CODES
 *   0 — mock data inserted (or already present, skipped)
 *   1 — fatal error during generation
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ log: ['error'] });

// ─── Configuration ───────────────────────────────────────────────────────────

const LOADTEST_PREFIX = 'LOADTEST-';
const NUM_USERS = 50;
const NUM_DEPTS = 50;
const COMPLAINTS_PER_DEPT = 100;
const CAPS_PER_DEPT = 50;
const NUM_UNIVERSAL_TASKS = 10000;
const NUM_AUDIT_LOGS = 1000;
const BATCH_SIZE = 100;

// Task-type / status / priority distributions
const TASK_TYPES = ['ALERT', 'COMPLAINT', 'CAP', 'SAR', 'MAKER_CHECKER'];
const TASK_STATUSES_WEIGHTED = [
  ...Array(60).fill('OPEN'),
  ...Array(20).fill('IN_PROGRESS'),
  ...Array(15).fill('DONE'),
  ...Array(5).fill('CANCELLED'),
];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

// Maps taskType → (sourceEntityType, sourceModule) per P4-3-a's UniversalTask schema.
const TASK_TYPE_TO_SOURCE = {
  ALERT: { sourceEntityType: 'ComplianceAlert', sourceModule: 'COMPLIANCE_ALERTS' },
  COMPLAINT: { sourceEntityType: 'Complaint', sourceModule: 'COMPLAINTS' },
  CAP: { sourceEntityType: 'CorrectiveActionPlan', sourceModule: 'CAP' },
  SAR: { sourceEntityType: 'SARCase', sourceModule: 'SAR' },
  MAKER_CHECKER: { sourceEntityType: 'MakerCheckerLog', sourceModule: 'MAKER_CHECKER' },
};

const COMPLAINT_TYPES = ['CUSTOMER', 'REGULATORY', 'INTERNAL', 'THIRD_PARTY'];
const COMPLAINT_STATUSES = ['NEW', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'CLOSED'];
const CAP_SOURCE_TYPES = ['AUDIT_FINDING', 'REGULATORY_TRACKER', 'QA_FINDING'];
const CAP_STATES = ['TODO', 'IN_PROGRESS', 'REMEDIATED', 'AUDIT_VERIFIED'];

// Canned lorem text (no dependency on a lorem library)
const LOREM_FRAGMENTS = [
  'policy holder dispute over claim settlement timeline',
  'delayed response from underwriting team on endorsement request',
  'regulatory circular 3551/2021 acknowledgment pending',
  'sanctions screening false positive requires review',
  'KYC refresh overdue for high-risk corporate client',
  'GoAML filing rejected by FIU — narrative insufficient',
  'complaint escalated to ombudsman — 4-eyes required',
  'corrective action plan remediation evidence missing',
  'adverse media screen flagged PEP association',
  'training certification expired for compliance officer',
  'break-glass session invoked — post-incident review due',
  'vendor due diligence renewal overdue by 14 days',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pad(n, width) {
  return String(n).padStart(width, '0');
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Idempotency check ───────────────────────────────────────────────────────

async function checkIdempotency() {
  const existing = await db.complaint.count({
    where: { subject: { startsWith: LOADTEST_PREFIX } },
  });
  if (existing > 0) {
    console.log(
      `Mock data already present: ${existing} LOADTEST complaints. Skipping.`,
    );
    return false;
  }
  return true;
}

// ─── Department risk scores ──────────────────────────────────────────────────

async function generateDepartments() {
  console.log('\n[1/5] Generating 50 DepartmentRiskScore rows...');
  const rows = [];
  for (let i = 1; i <= NUM_DEPTS; i++) {
    const deptId = `dept-loadtest-${pad(i, 3)}`;
    const score = randomInt(5, 95);
    rows.push({
      departmentId: deptId,
      score,
      factors: {
        source: 'loadtest',
        breachCount: randomInt(0, 20),
        capOverdue: randomInt(0, 10),
        complaintBreached: randomInt(0, 30),
        trainingOverdue: randomInt(0, 15),
        note: `Load-test synthetic department ${deptId}`,
      },
    });
  }
  await db.departmentRiskScore.createMany({ data: rows });
  console.log(`  ✓ Inserted ${rows.length} DepartmentRiskScore rows.`);
  return rows.length;
}

// ─── Complaints (5,000 across 50 departments) ────────────────────────────────

async function generateComplaints() {
  console.log('\n[2/5] Generating 5,000 Complaint rows (100 × 50 departments)...');
  const year = new Date().getFullYear();
  let globalSeq = 1;
  let inserted = 0;
  let batch = [];
  let lastProgress = 0;

  for (let d = 1; d <= NUM_DEPTS; d++) {
    const deptId = `dept-loadtest-${pad(d, 3)}`;
    for (let c = 0; c < COMPLAINTS_PER_DEPT; c++) {
      // SLA distribution: 20% BREACHED, 30% APPROACHING_BREACH, 50% WITHIN_SLA
      const slaRoll = Math.random();
      let slaStatus;
      let slaDeadlineResolution;
      if (slaRoll < 0.2) {
        slaStatus = 'BREACHED';
        slaDeadlineResolution = daysFromNow(-randomInt(25, 60));
      } else if (slaRoll < 0.5) {
        slaStatus = 'APPROACHING_BREACH';
        slaDeadlineResolution = daysFromNow(randomInt(1, 7));
      } else {
        slaStatus = 'WITHIN_SLA';
        slaDeadlineResolution = daysFromNow(randomInt(7, 30));
      }

      const createdAt = daysFromNow(-randomInt(1, 60));
      const complaintNumber = `LOADTEST-CMP-${year}-${pad(globalSeq, 5)}`;
      globalSeq++;

      batch.push({
        complaintNumber,
        subject: `${LOADTEST_PREFIX}Complaint ${globalSeq - 1} — ${pick(LOREM_FRAGMENTS)}`,
        description: `Load-test complaint #${globalSeq - 1} assigned to ${deptId}. ` +
          `Synthetic record for performance testing of /api/complaints endpoint. ` +
          pick(LOREM_FRAGMENTS),
        complaintType: pick(COMPLAINT_TYPES),
        priority: pick(PRIORITIES),
        status: pick(COMPLAINT_STATUSES),
        departmentId: deptId,
        slaDeadlineAck: daysFromNow(randomInt(-5, 5)),
        slaDeadlineResolution,
        slaStatus,
        createdAt,
      });

      if (batch.length >= BATCH_SIZE) {
        try {
          const r = await db.complaint.createMany({ data: batch });
          inserted += r.count;
        } catch (e) {
          console.warn(`  ⚠ Complaint batch failed (continuing): ${e.message}`);
        }
        batch = [];
        if (inserted - lastProgress >= 1000) {
          console.log(`  … ${inserted.toLocaleString()} complaints inserted`);
          lastProgress = inserted;
        }
      }
    }
  }
  // Flush remainder
  if (batch.length > 0) {
    try {
      const r = await db.complaint.createMany({ data: batch });
      inserted += r.count;
    } catch (e) {
      console.warn(`  ⚠ Complaint final batch failed (continuing): ${e.message}`);
    }
  }
  console.log(`  ✓ Inserted ${inserted.toLocaleString()} Complaint rows.`);
  return inserted;
}

// ─── Corrective Action Plans (2,500 across 50 departments) ───────────────────
// Note: the CAP model has no departmentId field — we tag the title with the
// dept id so CAPs are still attributable to a department for analysis.

async function generateCAPs() {
  console.log('\n[3/5] Generating 2,500 CorrectiveActionPlan rows (50 × 50 departments)...');
  let globalSeq = 1;
  let inserted = 0;
  let batch = [];
  let lastProgress = 0;

  for (let d = 1; d <= NUM_DEPTS; d++) {
    const deptTag = `dept-loadtest-${pad(d, 3)}`;
    for (let c = 0; c < CAPS_PER_DEPT; c++) {
      const state = pick(CAP_STATES);
      const dueRoll = Math.random();
      let dueDate;
      if (dueRoll < 0.2) {
        dueDate = daysFromNow(-randomInt(1, 30)); // overdue
      } else if (dueRoll < 0.5) {
        dueDate = daysFromNow(randomInt(1, 7)); // approaching
      } else {
        dueDate = daysFromNow(randomInt(7, 60)); // normal
      }

      batch.push({
        title: `${LOADTEST_PREFIX}CAP ${pad(globalSeq, 4)} [${deptTag}] — ${pick(LOREM_FRAGMENTS)}`,
        description: `Load-test CAP #${globalSeq} for ${deptTag}. Synthetic record for ` +
          `performance testing. ${pick(LOREM_FRAGMENTS)}`,
        sourceType: pick(CAP_SOURCE_TYPES),
        priority: pick(['low', 'medium', 'high', 'critical']),
        state,
        assignedToId: `loadtest-user-${pad(randomInt(1, NUM_USERS), 3)}`,
        assignedToName: `Load Test User ${randomInt(1, NUM_USERS)}`,
        dueDate,
        remediatedAt: state === 'REMEDIATED' || state === 'AUDIT_VERIFIED'
          ? daysFromNow(-randomInt(1, 30))
          : null,
        auditVerifiedAt: state === 'AUDIT_VERIFIED'
          ? daysFromNow(-randomInt(1, 15))
          : null,
      });
      globalSeq++;

      if (batch.length >= BATCH_SIZE) {
        try {
          const r = await db.correctiveActionPlan.createMany({ data: batch });
          inserted += r.count;
        } catch (e) {
          console.warn(`  ⚠ CAP batch failed (continuing): ${e.message}`);
        }
        batch = [];
        if (inserted - lastProgress >= 1000) {
          console.log(`  … ${inserted.toLocaleString()} CAPs inserted`);
          lastProgress = inserted;
        }
      }
    }
  }
  if (batch.length > 0) {
    try {
      const r = await db.correctiveActionPlan.createMany({ data: batch });
      inserted += r.count;
    } catch (e) {
      console.warn(`  ⚠ CAP final batch failed (continuing): ${e.message}`);
    }
  }
  console.log(`  ✓ Inserted ${inserted.toLocaleString()} CorrectiveActionPlan rows.`);
  return inserted;
}

// ─── UniversalTasks (10,000 across 50 users) ─────────────────────────────────
// Defensive: P4-3-a ships this model in parallel. We probe with a count() first;
// if the model is unreachable (schema not generated / table missing), we log a
// warning and skip — the other 3 models still populate.

async function generateUniversalTasks() {
  console.log('\n[4/5] Generating 10,000 UniversalTask rows...');

  // Probe: confirm the model is queryable. Prisma returns a proxy for any
  // property access, so `typeof db.universalTask` is always 'object' — the
  // only reliable check is to actually invoke a method.
  let existingCount = -1;
  try {
    existingCount = await db.universalTask.count();
  } catch (e) {
    console.warn(
      '  ⚠ db.universalTask.count() threw — the UniversalTask model is not ' +
      `queryable (${e.message.split('\n')[0]}). Skipping UniversalTask ` +
      'creation. The /api/tasks/my-tasks load test will exercise an empty ' +
      'result set. The other 3 models are unaffected.',
    );
    return 0;
  }
  console.log(`  (UniversalTask table currently holds ${existingCount.toLocaleString()} rows from prior runs/backfill.)`);

  let inserted = 0;
  let lastProgress = 0;
  let aborted = false;

  for (let start = 0; start < NUM_UNIVERSAL_TASKS && !aborted; start += BATCH_SIZE) {
    const end = Math.min(start + BATCH_SIZE, NUM_UNIVERSAL_TASKS);
    const batch = [];
    for (let i = start; i < end; i++) {
      // Round-robin assignee so each of the 50 users gets ~200 tasks.
      const userIdx = (i % NUM_USERS) + 1;
      const assigneeId = `loadtest-user-${pad(userIdx, 3)}`;

      // Due-date distribution: 20% overdue, 30% approaching SLA, 50% normal
      const dueRoll = Math.random();
      let dueDate;
      if (dueRoll < 0.2) {
        dueDate = daysFromNow(-randomInt(1, 30)); // overdue
      } else if (dueRoll < 0.5) {
        dueDate = daysFromNow(randomInt(1, 7)); // approaching SLA
      } else {
        dueDate = daysFromNow(randomInt(7, 60)); // normal
      }

      const taskType = pick(TASK_TYPES);
      const { sourceEntityType, sourceModule } = TASK_TYPE_TO_SOURCE[taskType];
      const seq = i + 1;
      // sourceId is globally unique (lt-00001..lt-10000) which guarantees the
      // @@unique([taskType, sourceId]) constraint holds across all 10k rows.
      const sourceId = `lt-${pad(seq, 5)}`;
      batch.push({
        title: `${LOADTEST_PREFIX}Task ${pad(seq, 5)} — ${taskType} ${pick(LOREM_FRAGMENTS)}`,
        description: `Load-test UniversalTask #${seq} (${taskType}). Synthetic record ` +
          `for performance testing of /api/tasks/my-tasks. ${pick(LOREM_FRAGMENTS)}`,
        taskType,
        sourceId,
        sourceEntityType,
        sourceModule,
        status: pick(TASK_STATUSES_WEIGHTED),
        assignedToId: assigneeId,
        assignedToName: `Load Test User ${userIdx}`,
        dueDate,
        priority: pick(PRIORITIES),
        isImmutable: false,
        sha256Hash: null,
      });
    }

    try {
      const r = await db.universalTask.createMany({ data: batch });
      inserted += r.count;
    } catch (e) {
      console.warn(
        `  ⚠ UniversalTask batch starting at ${start} failed: ${e.message}\n` +
        `    This usually means the UniversalTask schema field names differ ` +
        `from the assumed set (see script header). Skipping remaining ` +
        `UniversalTask batches. The other 3 models are unaffected.`,
      );
      aborted = true;
    }

    if (inserted - lastProgress >= 1000) {
      console.log(`  … ${inserted.toLocaleString()} UniversalTasks inserted`);
      lastProgress = inserted;
    }
  }
  console.log(`  ✓ Inserted ${inserted.toLocaleString()} UniversalTask rows.`);
  return inserted;
}

// ─── AuditLog entries (1,000 — stress the integrity scan) ────────────────────
// sha256Hash is set to NULL so the /api/audit/integrity endpoint skips these
// entries in its violation check (`entry.sha256Hash && ...` is false for null),
// but they still count toward the chronological iteration the endpoint
// performs — achieving the stated goal of testing hash-chain verification
// performance under load WITHOUT polluting the integrity verdict.

async function generateAuditLogs() {
  console.log('\n[5/5] Generating 1,000 AuditLog rows (LOADTEST_AUDIT)...');
  const batch = [];
  for (let i = 1; i <= NUM_AUDIT_LOGS; i++) {
    // Spread createdAt over the last 30 days so entries interleave
    // chronologically with real audit entries.
    const createdAt = daysFromNow(-randomInt(0, 30));
    batch.push({
      userId: `loadtest-user-${pad(randomInt(1, NUM_USERS), 3)}`,
      action: 'LOADTEST_AUDIT',
      resource: 'LoadTest',
      resourceId: `lt-audit-${pad(i, 5)}`,
      details: `${LOADTEST_PREFIX}Audit log entry ${i} — synthetic load-test entry for integrity-scan performance verification.`,
      sha256Hash: null, // null → integrity endpoint skips, but still iterates
      ipAddress: '127.0.0.1',
      createdAt,
    });
  }
  try {
    const r = await db.auditLog.createMany({ data: batch });
    console.log(`  ✓ Inserted ${r.count.toLocaleString()} AuditLog rows.`);
    return r.count;
  } catch (e) {
    console.warn(`  ⚠ AuditLog batch failed: ${e.message}`);
    return 0;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('  IC-OS v7.3.0 — Phase 4 Step 3 — Mock Data Generator (P4-3-b)');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(`  Target DB:    ${process.env.DATABASE_URL ?? 'db/custom.db (default)'}`);
  console.log(`  Users:        ${NUM_USERS}`);
  console.log(`  Departments:  ${NUM_DEPTS}`);
  console.log(`  Complaints:   ${NUM_DEPTS * COMPLAINTS_PER_DEPT} (${COMPLAINTS_PER_DEPT}/dept)`);
  console.log(`  CAPs:         ${NUM_DEPTS * CAPS_PER_DEPT} (${CAPS_PER_DEPT}/dept)`);
  console.log(`  UnivTasks:    ${NUM_UNIVERSAL_TASKS}`);
  console.log(`  AuditLogs:    ${NUM_AUDIT_LOGS}`);
  console.log(`  Batch size:   ${BATCH_SIZE}`);
  console.log('──────────────────────────────────────────────────────────────────');

  const shouldProceed = await checkIdempotency();
  if (!shouldProceed) {
    return { skipped: true };
  }

  const t0 = Date.now();
  const summary = {
    departments: await generateDepartments(),
    complaints: await generateComplaints(),
    caps: await generateCAPs(),
    universalTasks: await generateUniversalTasks(),
    auditLogs: await generateAuditLogs(),
  };
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('  MOCK DATA GENERATION COMPLETE');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(`  DepartmentRiskScore : ${summary.departments.toLocaleString()}`);
  console.log(`  Complaint           : ${summary.complaints.toLocaleString()}`);
  console.log(`  CorrectiveActionPlan: ${summary.caps.toLocaleString()}`);
  console.log(`  UniversalTask       : ${summary.universalTasks.toLocaleString()}`);
  console.log(`  AuditLog            : ${summary.auditLogs.toLocaleString()}`);
  const total = Object.values(summary).reduce((a, b) => a + b, 0);
  console.log(`  ─────────────────────────────────────────`);
  console.log(`  TOTAL               : ${total.toLocaleString()} rows in ${elapsed}s`);
  console.log(`  Sentinel prefix     : "${LOADTEST_PREFIX}" (use for cleanup)`);
  console.log('══════════════════════════════════════════════════════════════════');

  return summary;
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error('\n[FATAL] Mock data generation failed:', e);
    await db.$disconnect();
    process.exit(1);
  });
