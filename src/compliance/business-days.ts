/**
 * Business Days Calculation Utility
 * UAE Business Calendar — Weekend is Friday + Saturday
 *
 * Per CBUAE Notice 3551/2021 and UAE Federal Decree-Law No. 33 of 2021
 * (Labor Relations), the standard working week in the UAE is Monday–Thursday,
 * with Friday and Saturday designated as the weekend.
 *
 * All SLA calculations in the Dept Head Inbox and CAP Kanban modules
 * use business days (excluding Friday and Saturday).
 */

/**
 * Check if a date falls on a UAE weekend (Friday=5 or Saturday=6)
 */
export function isUAERekend(date: Date): boolean {
  const day = date.getDay(); // 0=Sun, 5=Fri, 6=Sat
  return day === 5 || day === 6;
}

/**
 * Calculate the number of business days between two dates.
 * Excludes Friday and Saturday (UAE weekend).
 * Returns a positive number if `to` is after `from`, negative if before.
 */
export function businessDaysBetween(from: Date, to: Date): number {
  let count = 0;
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  const direction = end >= start ? 1 : -1;
  const current = new Date(start);

  while (direction > 0 ? current < end : current > end) {
    if (!isUAERekend(current)) {
      count += direction;
    }
    current.setDate(current.getDate() + direction);
  }

  return count;
}

/**
 * Calculate business days elapsed since a given start date.
 * Counts business days from `startDate` to `now` (inclusive of start, exclusive of today's date if not yet complete).
 */
export function businessDaysElapsed(startDate: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  // If same day or start is in the future, 0 elapsed
  if (start >= now) return 0;

  let count = 0;
  const current = new Date(start);

  while (current < now) {
    if (!isUAERekend(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Calculate remaining business days from now until a SLA deadline.
 * The SLA is defined as `slaDays` business days from `startDate`.
 * Returns the number of business days remaining (can be negative if overdue).
 */
export function businessDaysRemaining(startDate: Date, slaDays: number): number {
  const elapsed = businessDaysElapsed(startDate);
  return slaDays - elapsed;
}

/**
 * Add N business days to a date (skipping UAE weekend).
 * Returns the target date that is N business days after `startDate`.
 */
export function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let added = 0;

  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (!isUAERekend(result)) {
      added++;
    }
  }

  return result;
}

/**
 * Check if a SLA deadline has been exceeded.
 * Returns true if `businessDaysElapsed(startDate) > slaDays`.
 */
export function isSLAExceeded(startDate: Date, slaDays: number): boolean {
  return businessDaysElapsed(startDate) > slaDays;
}

/**
 * SAR SLA configuration per FDL 10/2025 Art. 8
 */
export const SAR_SLA = {
  FILING_BUSINESS_DAYS: 7,
  FLAGGING_BUSINESS_DAYS: 5,
} as const;

/**
 * Determine the SLA status for a SAR filing.
 * Returns an object with status, daysElapsed, and daysRemaining.
 */
export function sarSLAStatus(startDate: Date, referenceDate: Date = new Date()): {
  status: 'on_track' | 'flagged' | 'escalated';
  daysElapsed: number;
  daysRemaining: number;
} {
  const elapsed = businessDaysBetween(startDate, referenceDate);
  const remaining = SAR_SLA.FILING_BUSINESS_DAYS - elapsed;

  if (elapsed >= SAR_SLA.FILING_BUSINESS_DAYS) {
    return { status: 'escalated', daysElapsed: elapsed, daysRemaining: remaining };
  }
  if (elapsed >= SAR_SLA.FLAGGING_BUSINESS_DAYS) {
    return { status: 'flagged', daysElapsed: elapsed, daysRemaining: remaining };
  }
  return { status: 'on_track', daysElapsed: elapsed, daysRemaining: remaining };
}
