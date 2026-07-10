/**
 * P3 Step 2 — Predictive Risk Scoring (Data Aggregation Engine)
 * ------------------------------------------------------------------
 * Computes a dynamic department risk score from live compliance data:
 *
 *   Base 50
 *   + 10 per OVERDUE CorrectiveActionPlan in the department
 *   + 15 per BREACHED Complaint SLA in the department
 *   -  5 per CLOSED ComplianceAudit (audit finding) in the last 90 days
 *
 * Final score is clamped to [0, 100].
 *
 * The engine is deliberately defensive: each factor query is wrapped in its
 * own try/catch so a single failing table never aborts the whole calculation.
 * On query error, that factor returns count 0 with the error message in
 * `detail`, and the remaining factors still contribute to the score.
 *
 * Department association:
 *   - Complaint has a direct `departmentId` field.
 *   - ComplianceAudit has a direct `department` field (String, nullable).
 *   - CorrectiveActionPlan has no department field. For CAP rows whose
 *     `sourceType === 'AUDIT_FINDING'` and whose `sourceReferenceId` points
 *     at a ComplianceAudit, the audit's `department` is used as the CAP's
 *     department. CAPs without such an audit link cannot be associated with
 *     a department and are skipped (counted as 0 against every department)
 *     — this is documented in the factor's `detail` string. This keeps the
 *     engine schema-compatible (no existing model is modified).
 */

import { db } from '@/lib/db';

// ─── Types ───────────────────────────────────────────────────────────────

export interface RiskFactor {
  label: string;
  points: number;
  count: number;
  detail: string;
}

export interface DepartmentRiskResult {
  departmentId: string;
  score: number;
  factors: RiskFactor[];
  calculatedAt: Date;
}

// ─── Constants ───────────────────────────────────────────────────────────

const BASE_SCORE = 50;
const POINTS_PER_OVERDUE_CAP = 10;
const POINTS_PER_BREACHED_COMPLAINT = 15;
const POINTS_PER_CLOSED_AUDIT = -5;
const CLOSED_AUDIT_WINDOW_DAYS = 90;
const MIN_SCORE = 0;
const MAX_SCORE = 100;

/** CAP `state` values that represent a finished/remediated CAP. */
const CAP_CLOSED_STATES = new Set(['REMEDIATED', 'AUDIT_VERIFIED']);

/** ComplianceAudit `status` values that represent a closed/completed audit. */
const AUDIT_CLOSED_STATUSES = new Set([
  'closed',
  'completed',
  'CLOSED',
  'COMPLETED',
  'CLOSED_WITH_FINDINGS',
]);

// ─── Helpers ─────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isAuditClosed(status: string | null | undefined): boolean {
  if (!status) return false;
  return AUDIT_CLOSED_STATUSES.has(status);
}

// ─── Per-Factor Computation ──────────────────────────────────────────────

/**
 * OVERDUE CorrectiveActionPlan count for the given department.
 *
 * Strategy: CorrectiveActionPlan has no department column, so we join
 * through its source audit when possible. CAP rows with
 * `sourceType === 'AUDIT_FINDING'` and a non-null `sourceReferenceId`
 * are looked up against ComplianceAudit; we count the overdue ones whose
 * source audit is in this department. CAPs without such a link are
 * skipped (and reported as such in the detail string).
 *
 * An OVERDUE CAP is one whose `dueDate` is in the past AND whose `state`
 * is not in {REMEDIATED, AUDIT_VERIFIED} (i.e. still open and past due).
 */
async function countOverdueCAPsForDepartment(
  departmentId: string,
  now: Date,
): Promise<{ count: number; detail: string }> {
  // 1) Fetch all open CAPs with a due date in the past that originated
  //    from an audit finding. (We can't filter by audit department at the
  //    SQL level because the relationship is application-defined.)
  const overdueCAPs = await db.correctiveActionPlan.findMany({
    where: {
      dueDate: { lt: now, not: null },
      state: { notIn: Array.from(CAP_CLOSED_STATES) },
      sourceType: 'AUDIT_FINDING',
      sourceReferenceId: { not: null },
    },
    select: {
      id: true,
      sourceReferenceId: true,
      title: true,
      dueDate: true,
      state: true,
    },
  });

  if (overdueCAPs.length === 0) {
    return {
      count: 0,
      detail:
        'No overdue AUDIT_FINDING-sourced CAPs found. CAPs without an audit link are not attributed to a department.',
    };
  }

  // 2) Resolve the source audit for each CAP to determine its department.
  const auditIds = Array.from(
    new Set(
      overdueCAPs
        .map((c) => c.sourceReferenceId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const audits = await db.complianceAudit.findMany({
    where: { id: { in: auditIds } },
    select: { id: true, department: true },
  });

  const auditDeptById = new Map<string, string | null>(
    audits.map((a) => [a.id, a.department ?? null]),
  );

  const matching = overdueCAPs.filter(
    (c) => c.sourceReferenceId && auditDeptById.get(c.sourceReferenceId) === departmentId,
  );

  return {
    count: matching.length,
    detail: `${matching.length} overdue AUDIT_FINDING CAP(s) linked to a ComplianceAudit in department "${departmentId}". ${overdueCAPs.length - matching.length} other overdue CAP(s) were either linked to other departments or had no resolvable audit link.`,
  };
}

/**
 * BREACHED Complaint SLA count for the given department.
 *
 * Counts Complaint rows where `departmentId = departmentId` and
 * `slaStatus = 'BREACHED'`.
 */
async function countBreachedComplaintsForDepartment(
  departmentId: string,
): Promise<{ count: number; detail: string }> {
  const count = await db.complaint.count({
    where: {
      departmentId,
      slaStatus: 'BREACHED',
    },
  });

  return {
    count,
    detail: `${count} complaint(s) with slaStatus = BREACHED in department "${departmentId}".`,
  };
}

/**
 * CLOSED ComplianceAudit count in the last 90 days for the given department.
 *
 * An audit is "closed" if `status` is in {closed, completed, CLOSED,
 * COMPLETED, CLOSED_WITH_FINDINGS}. The 90-day window is evaluated against
 * `completedDate` (preferred) or `updatedAt` (fallback) — whichever is set.
 */
async function countClosedAuditsForDepartment(
  departmentId: string,
  now: Date,
): Promise<{ count: number; detail: string }> {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - CLOSED_AUDIT_WINDOW_DAYS);

  // SQLite doesn't support advanced Prisma filtering on date coalescing,
  // so we fetch the candidate rows (department + closed-ish status) and
  // apply the 90-day window in JS. Result sets per department are small.
  const candidates = await db.complianceAudit.findMany({
    where: {
      department: departmentId,
    },
    select: {
      id: true,
      status: true,
      completedDate: true,
      updatedAt: true,
    },
  });

  let count = 0;
  for (const a of candidates) {
    if (!isAuditClosed(a.status)) continue;
    const ref = a.completedDate ?? a.updatedAt;
    if (!ref) continue;
    if (new Date(ref) >= cutoff) count++;
  }

  return {
    count,
    detail: `${count} closed ComplianceAudit finding(s) in department "${departmentId}" within the last ${CLOSED_AUDIT_WINDOW_DAYS} days (window evaluated against completedDate, falling back to updatedAt).`,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Compute the dynamic risk score for a single department.
 *
 * Defensive: each factor query is isolated in try/catch so one failing
 * table never aborts the whole calculation.
 */
export async function calculateDepartmentRisk(
  departmentId: string,
): Promise<DepartmentRiskResult> {
  const now = new Date();
  const factors: RiskFactor[] = [];
  let score = BASE_SCORE;

  // Base score is always the first factor.
  factors.push({
    label: 'Base score',
    points: BASE_SCORE,
    count: 1,
    detail: 'Baseline department risk score before applying modifiers.',
  });

  // Factor 1: +10 per OVERDUE CAP in the department.
  try {
    const { count, detail } = await countOverdueCAPsForDepartment(departmentId, now);
    const points = count * POINTS_PER_OVERDUE_CAP;
    score += points;
    factors.push({
      label: 'Overdue Corrective Action Plans',
      points,
      count,
      detail,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    factors.push({
      label: 'Overdue Corrective Action Plans',
      points: 0,
      count: 0,
      detail: `Query failed — counted as 0. Error: ${message}`,
    });
  }

  // Factor 2: +15 per BREACHED complaint SLA in the department.
  try {
    const { count, detail } = await countBreachedComplaintsForDepartment(departmentId);
    const points = count * POINTS_PER_BREACHED_COMPLAINT;
    score += points;
    factors.push({
      label: 'Breached Complaint SLAs',
      points,
      count,
      detail,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    factors.push({
      label: 'Breached Complaint SLAs',
      points: 0,
      count: 0,
      detail: `Query failed — counted as 0. Error: ${message}`,
    });
  }

  // Factor 3: -5 per CLOSED ComplianceAudit in the last 90 days.
  try {
    const { count, detail } = await countClosedAuditsForDepartment(departmentId, now);
    const points = count * POINTS_PER_CLOSED_AUDIT;
    score += points;
    factors.push({
      label: `Closed Audit Findings (last ${CLOSED_AUDIT_WINDOW_DAYS} days)`,
      points,
      count,
      detail,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    factors.push({
      label: `Closed Audit Findings (last ${CLOSED_AUDIT_WINDOW_DAYS} days)`,
      points: 0,
      count: 0,
      detail: `Query failed — counted as 0. Error: ${message}`,
    });
  }

  // Clamp to [0, 100].
  const clamped = clamp(score, MIN_SCORE, MAX_SCORE);
  if (clamped !== score) {
    factors.push({
      label: 'Score clamp',
      points: clamped - score,
      count: 1,
      detail: `Raw score ${score} was clamped to the [${MIN_SCORE}, ${MAX_SCORE}] range.`,
    });
  }

  return {
    departmentId,
    score: clamped,
    factors,
    calculatedAt: now,
  };
}

/**
 * Discover every department that has at least one CAP, Complaint, or
 * ComplianceAudit, then compute + upsert a DepartmentRiskScore for each.
 *
 * Returns the per-department results plus a human-readable execution log.
 */
export async function calculateAllDepartmentRiskScores(): Promise<{
  results: DepartmentRiskResult[];
  log: string[];
}> {
  const log: string[] = [];
  const startedAt = new Date();
  log.push(
    `[${startedAt.toISOString()}] Department risk aggregation started.`,
  );

  // ── Discover departments from each source table ──────────────────────
  // ComplianceAudit.department is the authoritative department identifier
  // for audits (and transitively for AUDIT_FINDING-sourced CAPs).
  const auditDepartments = await db.complianceAudit
    .findMany({
      where: { department: { not: null } },
      select: { department: true },
      distinct: ['department'],
    })
    .then((rows) => rows.map((r) => r.department as string))
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      log.push(`  WARN: failed to enumerate ComplianceAudit departments: ${message}`);
      return [] as string[];
    });

  // Complaint.departmentId is the authoritative department identifier for
  // complaints (and directly used in the BREACHED SLA factor).
  const complaintDepartments = await db.complaint
    .findMany({
      where: { departmentId: { not: null } },
      select: { departmentId: true },
      distinct: ['departmentId'],
    })
    .then((rows) =>
      rows
        .map((r) => r.departmentId)
        .filter((id): id is string => Boolean(id)),
    )
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      log.push(`  WARN: failed to enumerate Complaint departments: ${message}`);
      return [] as string[];
    });

  // CAPs without an audit link cannot be attributed to a department, so we
  // don't enumerate from CAPs directly — the audit department list already
  // covers every CAP that could meaningfully contribute.

  const departmentSet = new Set<string>([
    ...auditDepartments,
    ...complaintDepartments,
  ]);
  const departments = Array.from(departmentSet).filter(Boolean).sort();

  log.push(
    `  Discovered ${departments.length} distinct department(s): ${departments.join(', ') || '(none)'}`,
  );

  // ── Compute + upsert per-department scores ───────────────────────────
  const results: DepartmentRiskResult[] = [];
  for (const departmentId of departments) {
    try {
      const result = await calculateDepartmentRisk(departmentId);
      results.push(result);

      // Prisma's JSON column expects InputJsonValue; cast the typed array
      // via JSON.parse(JSON.stringify(...)) to satisfy the type while also
      // stripping any non-serializable leftovers (Date objects, etc.).
      const factorsJson = JSON.parse(JSON.stringify(result.factors)) as import('@prisma/client').Prisma.InputJsonValue;

      await db.departmentRiskScore.upsert({
        where: { departmentId },
        update: {
          score: result.score,
          calculatedAt: result.calculatedAt,
          factors: factorsJson,
        },
        create: {
          departmentId: result.departmentId,
          score: result.score,
          calculatedAt: result.calculatedAt,
          factors: factorsJson,
        },
      });

      log.push(
        `  ✓ ${departmentId}: score=${result.score} (factors: ${result.factors
          .filter((f) => f.label !== 'Base score' && f.label !== 'Score clamp')
          .map((f) => `${f.label}=${f.count} (${f.points >= 0 ? '+' : ''}${f.points})`)
          .join(', ') || 'no modifiers'})`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.push(`  ✗ ${departmentId}: FAILED — ${message}`);
    }
  }

  const finishedAt = new Date();
  log.push(
    `[${finishedAt.toISOString()}] Department risk aggregation finished. ${results.length}/${departments.length} department(s) updated in ${finishedAt.getTime() - startedAt.getTime()}ms.`,
  );

  return { results, log };
}
