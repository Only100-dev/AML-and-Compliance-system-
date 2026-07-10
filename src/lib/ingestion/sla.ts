/**
 * SLA Deadline Helpers — UAE Business Calendar
 * Phase F: Regulatory Circular Ingestion Engine
 *
 * FDL 10/2025 Art. 15 (Internal Controls — timely acknowledgement &
 * remediation of regulatory change).
 * CBUAE Notice 3551/2021 S3.1 (Governance — accountability tracking).
 *
 * UAE work week: Sunday → Thursday. Weekend = Friday (5) + Saturday (6).
 * These helpers are pure (no IO) so they can be unit-tested in isolation
 * and reused by the dept-head SLA evaluator and the CAP kanban.
 */

/**
 * Add N UAE business days to `start`. Skips Friday (5) and Saturday (6).
 * Mutates a copy of `start` so the caller's `Date` reference is untouched.
 *
 * @example
 *   addUAEBusinessDays(new Date('2025-03-05T00:00:00Z'), 5) // Wed 05 Mar → Wed 12 Mar
 */
export function addUAEBusinessDays(start: Date, days: number): Date {
  const result = new Date(start.getTime());
  let added = 0;
  // Guard against negative input — treat as 0 to avoid infinite loops.
  const target = Math.max(0, Math.floor(days));
  while (added < target) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay(); // 0=Sun, 5=Fri, 6=Sat
    if (dow !== 5 && dow !== 6) added++;
  }
  return result;
}

/**
 * Compute the number of UAE business days between two dates (exclusive of
 * `end`). Used by SLA dashboards to render "days remaining" badges.
 */
export function countUAEBusinessDays(start: Date, end: Date): number {
  if (end.getTime() <= start.getTime()) return 0;
  const cursor = new Date(start.getTime());
  let count = 0;
  while (cursor.getTime() < end.getTime()) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow !== 5 && dow !== 6) count++;
  }
  return count;
}

/**
 * Standard IC-OS SLA constants for circular acknowledgement / action plan.
 * Mirrors the SLA_CONFIG table for the ingestion module.
 */
export const INGESTION_SLA = {
  ACK_BUSINESS_DAYS: 5,
  ACTION_PLAN_BUSINESS_DAYS: 10,
} as const;
