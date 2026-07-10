#!/usr/bin/env node
/**
 * v7.3.0 — UniversalTask Backfill Script
 * ------------------------------------------------------------------
 * One-shot script that materializes UniversalTask rows from the existing
 * ComplianceAlert, Complaint, CorrectiveActionPlan, SARCase, and
 * MakerCheckerLog records. Idempotent via the
 * `@@unique([taskType, sourceId])` constraint — uses upsert so re-runs
 * refresh the title/priority/status/dueDate without duplicating rows.
 *
 * Run with:
 *   node scripts/backfill-universal-tasks.mjs
 *
 * Output: a one-line summary:
 *   Backfilled: X alerts, Y complaints, Z CAPs, W SARs, V MC logs → total N UniversalTasks
 *
 * Batched into transactions of 100 to avoid SQLite write-lock contention.
 *
 * Mapping (per directive):
 *   ComplianceAlert (status='active')        → ALERT          (severity→priority)
 *   Complaint       (status NOT IN [CLOSED,REJECTED]) → COMPLAINT     (priority passthrough)
 *   CorrectiveActionPlan (state != AUDIT_VERIFIED) → CAP            (priority uppercase)
 *   SARCase         (status NOT IN [SUBMITTED_TO_FIU,REJECTED_BY_FIU]) → SAR  (priority=HIGH)
 *   MakerCheckerLog (status='PENDING')       → MAKER_CHECKER  (priority=HIGH)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BATCH_SIZE = 100;

// ─── Mapping helpers ──────────────────────────────────────────────────────────

/**
 * Convert a ComplianceAlert severity string to a UniversalTask priority.
 *   critical → CRITICAL, high → HIGH, medium → MEDIUM, * → LOW
 */
function severityToPriority(severity) {
  const s = (severity ?? '').toLowerCase();
  if (s === 'critical') return 'CRITICAL';
  if (s === 'high') return 'HIGH';
  if (s === 'medium') return 'MEDIUM';
  return 'LOW';
}

/**
 * Uppercase a CAP priority ('medium' → 'MEDIUM'); any non-standard value
 * falls back to 'MEDIUM'.
 */
function capPriority(p) {
  const u = (p ?? '').toUpperCase();
  if (u === 'LOW' || u === 'MEDIUM' || u === 'HIGH' || u === 'CRITICAL') return u;
  return 'MEDIUM';
}

/**
 * Slice an array into chunks of `size`.
 */
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

// ─── Per-source builders ──────────────────────────────────────────────────────
//
// Each builder returns an array of upsert payloads. Each payload has the
// `where` (taskType+sourceId unique key) and `create`/`update` data. We use
// the same object for both create and update so re-runs refresh every field.

function buildAlertTasks(alerts) {
  return alerts
    .filter((a) => a.status === 'active' || a.status === 'resolved')
    .map((a) => {
      const status = a.status === 'resolved' ? 'DONE' : 'OPEN';
      const priority = severityToPriority(a.severity);
      return {
        where: { taskType_sourceId: { taskType: 'ALERT', sourceId: a.id } },
        create: {
          taskType: 'ALERT',
          sourceId: a.id,
          sourceEntityType: 'ComplianceAlert',
          title: a.title ?? 'Untitled alert',
          description: a.description ?? null,
          assignedToId: a.assignedToId ?? null,
          assignedToName: null,
          priority,
          status,
          dueDate: a.dueDate ?? null,
          sourceModule: 'COMPLIANCE_ALERTS',
          isImmutable: a.isImmutable ?? false,
          sha256Hash: a.sha256Hash ?? null,
        },
      };
    });
}

function buildComplaintTasks(complaints) {
  return complaints
    .filter((c) => !['CLOSED', 'REJECTED'].includes(c.status))
    .map((c) => {
      const status = ['ACKNOWLEDGED', 'INVESTIGATING'].includes(c.status)
        ? 'IN_PROGRESS'
        : 'OPEN';
      return {
        where: { taskType_sourceId: { taskType: 'COMPLAINT', sourceId: c.id } },
        create: {
          taskType: 'COMPLAINT',
          sourceId: c.id,
          sourceEntityType: 'Complaint',
          title: `Complaint ${c.complaintNumber}: ${c.subject ?? ''}`.trim(),
          description: c.description ?? null,
          assignedToId: c.acknowledgedById ?? null,
          assignedToName: null,
          priority: c.priority ?? 'MEDIUM',
          status,
          dueDate: c.slaDeadlineResolution ?? null,
          sourceModule: 'COMPLAINTS',
          isImmutable: false,
          sha256Hash: null,
        },
      };
    });
}

function buildCapTasks(caps) {
  return caps
    .filter((c) => c.state !== 'AUDIT_VERIFIED')
    .map((c) => ({
      where: { taskType_sourceId: { taskType: 'CAP', sourceId: c.id } },
      create: {
        taskType: 'CAP',
        sourceId: c.id,
        sourceEntityType: 'CorrectiveActionPlan',
        title: c.title ?? 'Untitled CAP',
        description: c.description ?? null,
        assignedToId: c.assignedToId ?? null,
        assignedToName: c.assignedToName ?? null,
        priority: capPriority(c.priority),
        status: c.state === 'TODO' ? 'OPEN' : 'IN_PROGRESS',
        dueDate: c.dueDate ?? null,
        sourceModule: 'CAP',
        isImmutable: false,
        sha256Hash: c.sha256Hash ?? null,
      },
    }));
}

function buildSarTasks(sars) {
  return sars
    .filter((s) => !['SUBMITTED_TO_FIU', 'REJECTED_BY_FIU'].includes(s.status))
    .map((s) => ({
      where: { taskType_sourceId: { taskType: 'SAR', sourceId: s.id } },
      create: {
        taskType: 'SAR',
        sourceId: s.id,
        sourceEntityType: 'SARCase',
        title: `SAR ${s.caseNumber}`,
        description: null,
        assignedToId: s.reviewedById ?? s.createdById ?? null,
        assignedToName: null,
        priority: 'HIGH',
        status: 'OPEN',
        dueDate: s.filingDeadline ?? null,
        sourceModule: 'SAR',
        isImmutable: false,
        sha256Hash: null,
      },
    }));
}

function buildMakerCheckerTasks(logs) {
  return logs
    .filter((m) => m.status === 'PENDING')
    .map((m) => ({
      where: { taskType_sourceId: { taskType: 'MAKER_CHECKER', sourceId: m.id } },
      create: {
        taskType: 'MAKER_CHECKER',
        sourceId: m.id,
        sourceEntityType: 'MakerCheckerLog',
        title: `${m.operationType} review`,
        description: null,
        assignedToId: m.checkerId ?? null,
        assignedToName: m.checkerName ?? null,
        priority: 'HIGH',
        status: 'OPEN',
        dueDate: m.expiryTime ?? null,
        sourceModule: 'MAKER_CHECKER',
        isImmutable: false,
        sha256Hash: null,
      },
    }));
}

// ─── Upserter ─────────────────────────────────────────────────────────────────

/**
 * Apply a batch of upsert payloads inside a single $transaction. The same
 * payload is used for `create` and `update` so re-runs refresh every field
 * (idempotent).
 *
 * Returns the number of upserts that ran.
 */
async function upsertBatch(payloads) {
  if (payloads.length === 0) return 0;
  let count = 0;
  await prisma.$transaction(
    payloads.map((p) =>
      prisma.universalTask.upsert({
        where: p.where,
        create: p.create,
        update: p.create,
      }),
    ),
  );
  count += payloads.length;
  return count;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('UniversalTask backfill — v7.3.0');
  console.log('Reading source records...');

  const [alerts, complaints, caps, sars, mcLogs] = await Promise.all([
    prisma.complianceAlert.findMany({
      select: {
        id: true,
        alertType: true,
        severity: true,
        status: true,
        title: true,
        description: true,
        dueDate: true,
        assignedToId: true,
        isImmutable: true,
        sha256Hash: true,
      },
    }),
    prisma.complaint.findMany({
      select: {
        id: true,
        complaintNumber: true,
        subject: true,
        description: true,
        priority: true,
        status: true,
        slaDeadlineResolution: true,
        acknowledgedById: true,
      },
    }),
    prisma.correctiveActionPlan.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        state: true,
        assignedToId: true,
        assignedToName: true,
        dueDate: true,
        sha256Hash: true,
      },
    }),
    prisma.sARCase.findMany({
      select: {
        id: true,
        caseNumber: true,
        status: true,
        filingDeadline: true,
        createdById: true,
        reviewedById: true,
      },
    }),
    prisma.makerCheckerLog.findMany({
      select: {
        id: true,
        operationType: true,
        status: true,
        checkerId: true,
        checkerName: true,
        expiryTime: true,
      },
    }),
  ]);

  console.log(
    `  Sources: ${alerts.length} alerts, ${complaints.length} complaints, ` +
      `${caps.length} CAPs, ${sars.length} SARs, ${mcLogs.length} MC logs`,
  );

  // Build per-source payloads (the builders filter to eligible records).
  const alertPayloads = buildAlertTasks(alerts);
  const complaintPayloads = buildComplaintTasks(complaints);
  const capPayloads = buildCapTasks(caps);
  const sarPayloads = buildSarTasks(sars);
  const mcPayloads = buildMakerCheckerTasks(mcLogs);

  let nAlerts = 0;
  let nComplaints = 0;
  let nCaps = 0;
  let nSars = 0;
  let nMc = 0;

  // Upsert in batches of 100 to keep SQLite write transactions short.
  for (const batch of chunk(alertPayloads, BATCH_SIZE)) {
    nAlerts += await upsertBatch(batch);
  }
  for (const batch of chunk(complaintPayloads, BATCH_SIZE)) {
    nComplaints += await upsertBatch(batch);
  }
  for (const batch of chunk(capPayloads, BATCH_SIZE)) {
    nCaps += await upsertBatch(batch);
  }
  for (const batch of chunk(sarPayloads, BATCH_SIZE)) {
    nSars += await upsertBatch(batch);
  }
  for (const batch of chunk(mcPayloads, BATCH_SIZE)) {
    nMc += await upsertBatch(batch);
  }

  const totalNew = nAlerts + nComplaints + nCaps + nSars + nMc;

  // Final count from the DB (the upserts above may have refreshed existing
  // rows; the count returned here is the total number of UniversalTask rows
  // that now exist for each taskType, regardless of whether they were newly
  // created or refreshed).
  const totalInDb = await prisma.universalTask.count();

  console.log(
    `Backfilled: ${nAlerts} alerts, ${nComplaints} complaints, ${nCaps} CAPs, ` +
      `${nSars} SARs, ${nMc} MC logs → total ${totalNew} UniversalTasks ` +
      `(DB now has ${totalInDb} UniversalTask rows total)`,
  );
}

main()
  .catch((err) => {
    console.error('Backfill FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
