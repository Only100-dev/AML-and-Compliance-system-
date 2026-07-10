/**
 * Complaint SLA helpers — CBUAE Notice 3551/2021; FDL 10/2025 Art. 13
 *
 * CBUAE requires complaint acknowledgment within 5 business days and
 * resolution within 30 business days. This module computes SLA deadlines
 * (business days, excluding the UAE weekend of Saturday & Sunday) and
 * categorizes SLA status for the evaluator.
 *
 * NOTE: Public-holiday adjustment is intentionally out of scope (no UAE
 * holiday data source is wired in). The computed deadline is therefore a
 * *strict lower bound*: actual SLA may be more lenient due to public
 * holidays, but never stricter. Regulators accept this conservative bias.
 */

export const ACK_SLA_BUSINESS_DAYS = 5;
export const RESOLUTION_SLA_BUSINESS_DAYS = 30;
/** Approaching-breach threshold: 80% of the SLA window elapsed (CBUAE early-warning) */
export const APPROACHING_THRESHOLD = 0.8;

export type ComplaintSLAStatus =
  | 'WITHIN_SLA'
  | 'APPROACHING_BREACH'
  | 'BREACHED'
  | 'N/A';

/**
 * Add N business days (Mon–Fri) to a date. Saturday & Sunday are skipped.
 * (UAE switched to a Sat/Sun weekend in 2022 per Federal Decree.)
 */
export function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start.getTime());
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay(); // 0 = Sunday, 6 = Saturday
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

/**
 * Categorize SLA status for a single deadline relative to its creation time.
 *
 * - If the SLA was already satisfied (`completedDate` set) → 'N/A' (inactive)
 * - If `now` is past the deadline → 'BREACHED'
 * - If ≥ 80% of the SLA window has elapsed (but not yet breached) → 'APPROACHING_BREACH'
 * - Otherwise → 'WITHIN_SLA'
 */
export function categorizeDeadline(
  deadline: Date | null,
  completedDate: Date | null,
  createdAt: Date,
  now: Date = new Date(),
): ComplaintSLAStatus {
  if (completedDate) return 'N/A';
  if (!deadline) return 'N/A';
  if (now.getTime() > deadline.getTime()) return 'BREACHED';
  const totalWindow = deadline.getTime() - createdAt.getTime();
  if (totalWindow <= 0) return 'BREACHED';
  const elapsed = now.getTime() - createdAt.getTime();
  if (elapsed / totalWindow >= APPROACHING_THRESHOLD) return 'APPROACHING_BREACH';
  return 'WITHIN_SLA';
}

const STATUS_RANK: Record<ComplaintSLAStatus, number> = {
  'N/A': 0,
  'WITHIN_SLA': 1,
  'APPROACHING_BREACH': 2,
  'BREACHED': 3,
};

/**
 * Compute the overall complaint SLA status as the *worse* of the
 * acknowledgment and resolution deadlines. Terminal states (CLOSED, REJECTED)
 * have no active SLA and return 'N/A'.
 */
export function computeComplaintSLAStatus(
  complaint: {
    slaDeadlineAck: Date | null;
    slaDeadlineResolution: Date | null;
    acknowledgedAt: Date | null;
    resolvedAt: Date | null;
    createdAt: Date;
    status: string;
  },
  now: Date = new Date(),
): ComplaintSLAStatus {
  if (complaint.status === 'CLOSED' || complaint.status === 'REJECTED') {
    return 'N/A';
  }
  const ack = categorizeDeadline(
    complaint.slaDeadlineAck,
    complaint.acknowledgedAt,
    complaint.createdAt,
    now,
  );
  const res = categorizeDeadline(
    complaint.slaDeadlineResolution,
    complaint.resolvedAt,
    complaint.createdAt,
    now,
  );
  return STATUS_RANK[ack] >= STATUS_RANK[res] ? ack : res;
}

// ─── Per-Phase SLA Evaluation (used by the CBUAE SLA Evaluator cron) ──────────

/**
 * SLA phase identifier — 'ACK' for the 5-business-day acknowledgment
 * deadline, 'RESOLUTION' for the 30-business-day resolution deadline.
 */
export type SlaPhase = 'ACK' | 'RESOLUTION';

/**
 * Rich per-phase SLA evaluation result. Used by the SLA evaluator
 * (`/api/complaints/sla/evaluate`) to decide whether to generate a
 * ComplianceAlert + UniversalTask at the 80% (approaching) or 100%
 * (breached) thresholds.
 */
export interface SlaPhaseEvaluation {
  phase: SlaPhase;
  status: ComplaintSLAStatus;
  /** True when status is APPROACHING_BREACH or BREACHED → an alert should fire. */
  shouldAlert: boolean;
  /** e.g. 'COMPLAINT_ACK_SLA_APPROACHING' / 'COMPLAINT_RESOLUTION_SLA_BREACHED'. */
  alertType: string;
  /** 'high' for approaching, 'critical' for breached. */
  alertSeverity: 'high' | 'critical';
  /** Fraction of the SLA window elapsed, clamped to [0, 1]. */
  elapsedFraction: number;
  /** The deadline Date (null when no deadline is set). */
  deadline: Date | null;
  /** Calendar days remaining until the deadline (negative if breached). */
  daysRemaining: number;
}

/**
 * Evaluate a single SLA phase (ACK or RESOLUTION) for a complaint.
 *
 * Wraps `categorizeDeadline` with alert-type / severity / elapsed-fraction
 * metadata so the evaluator can decide whether to generate a ComplianceAlert
 * and what severity to assign.
 *
 * If `completedDate` is set (complaint already acknowledged / resolved for
 * this phase), the status is 'N/A' and no alert fires — the SLA was satisfied.
 *
 * @param phase         'ACK' or 'RESOLUTION'
 * @param createdAt     Complaint creation timestamp
 * @param deadline      The SLA deadline for this phase (null = no SLA set)
 * @param now           Current time (defaults to new Date())
 * @param completedDate When this phase was satisfied (null = still active)
 */
export function evaluateSlaPhase(
  phase: SlaPhase,
  createdAt: Date,
  deadline: Date | null,
  now: Date = new Date(),
  completedDate: Date | null = null,
): SlaPhaseEvaluation {
  const prefix = phase === 'ACK' ? 'COMPLAINT_ACK_SLA' : 'COMPLAINT_RESOLUTION_SLA';

  // No deadline or already completed → SLA is inactive for this phase.
  if (!deadline || completedDate) {
    return {
      phase,
      status: 'N/A',
      shouldAlert: false,
      alertType: `${prefix}_APPROACHING`,
      alertSeverity: 'high',
      elapsedFraction: 0,
      deadline,
      daysRemaining: 0,
    };
  }

  const totalWindow = deadline.getTime() - createdAt.getTime();
  const elapsed = now.getTime() - createdAt.getTime();
  const elapsedFraction =
    totalWindow > 0 ? Math.min(Math.max(elapsed / totalWindow, 0), 1) : 1;
  const daysRemaining = Math.ceil(
    (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  const status = categorizeDeadline(deadline, completedDate, createdAt, now);
  const shouldAlert = status === 'APPROACHING_BREACH' || status === 'BREACHED';
  const alertType = `${prefix}_${status === 'BREACHED' ? 'BREACHED' : 'APPROACHING'}`;
  const alertSeverity: 'high' | 'critical' =
    status === 'BREACHED' ? 'critical' : 'high';

  return {
    phase,
    status,
    shouldAlert,
    alertType,
    alertSeverity,
    elapsedFraction,
    deadline,
    daysRemaining,
  };
}
