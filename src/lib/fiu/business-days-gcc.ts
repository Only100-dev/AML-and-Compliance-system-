/**
 * GCC Business Days Calculation Utility
 *
 * Generalized from the UAE-specific business-days.ts to support
 * all 6 GCC jurisdictions.
 *
 * Default GCC Weekend: Friday + Saturday (all 6 countries)
 * - KSA: Fri-Sat (standard)
 * - Bahrain: Fri-Sat (standard)
 * - Qatar: Fri-Sat (standard)
 * - Oman: Fri-Sat (standard)
 * - Kuwait: Fri-Sat (standard)
 * - UAE: Fri-Sat (per Federal Decree-Law No. 33 of 2021)
 *
 * Phase 4 (Action 4.1): Jurisdiction-aware deadline calculation
 * is CRITICAL — wrong deadline = criminal liability (PRINCIPLE B).
 */

import type { GCCJurisdictionCode } from '@/lib/constants/jurisdictions';

// ─── Weekend Configuration per Jurisdiction ───────────────────────────────────

const GCC_WEEKEND_CONFIG: Record<GCCJurisdictionCode, number[]> = {
  AE: [5, 6],  // Friday=5, Saturday=6
  SA: [5, 6],  // Friday=5, Saturday=6
  BH: [5, 6],  // Friday=5, Saturday=6
  QA: [5, 6],  // Friday=5, Saturday=6
  OM: [5, 6],  // Friday=5, Saturday=6
  KW: [5, 6],  // Friday=5, Saturday=6
};

/**
 * Check if a date falls on a weekend for the given jurisdiction.
 * Default: Friday (5) + Saturday (6) for all GCC countries.
 */
export function isGCCWeekend(date: Date, jurisdiction: GCCJurisdictionCode = 'AE'): boolean {
  const day = date.getDay(); // 0=Sun, 5=Fri, 6=Sat
  const weekendDays = GCC_WEEKEND_CONFIG[jurisdiction] || [5, 6];
  return weekendDays.includes(day);
}

/**
 * Add N business days to a date (skipping jurisdiction-specific weekends).
 * Returns the target date that is N business days after startDate.
 *
 * CRITICAL for Bahrain CBB: 5 business days from detection date,
 * excluding Friday-Saturday. Detection on Thursday → deadline is next Wednesday.
 */
export function addBusinessDaysGCC(
  startDate: Date,
  days: number,
  jurisdiction: GCCJurisdictionCode = 'AE'
): Date {
  const result = new Date(startDate);
  result.setHours(0, 0, 0, 0);
  let added = 0;

  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (!isGCCWeekend(result, jurisdiction)) {
      added++;
    }
  }

  return result;
}

/**
 * Calculate the number of business days between two dates,
 * excluding jurisdiction-specific weekends.
 */
export function businessDaysBetweenGCC(
  from: Date,
  to: Date,
  jurisdiction: GCCJurisdictionCode = 'AE'
): number {
  let count = 0;
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  const direction = end >= start ? 1 : -1;
  const current = new Date(start);

  while (direction > 0 ? current < end : current > end) {
    if (!isGCCWeekend(current, jurisdiction)) {
      count += direction;
    }
    current.setDate(current.getDate() + direction);
  }

  return count;
}

/**
 * Calculate business days elapsed since a given start date.
 */
export function businessDaysElapsedGCC(
  startDate: Date,
  jurisdiction: GCCJurisdictionCode = 'AE'
): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  if (start >= now) return 0;

  let count = 0;
  const current = new Date(start);

  while (current < now) {
    if (!isGCCWeekend(current, jurisdiction)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Calculate remaining business days from now until a SLA deadline.
 */
export function businessDaysRemainingGCC(
  startDate: Date,
  slaDays: number,
  jurisdiction: GCCJurisdictionCode = 'AE'
): number {
  const elapsed = businessDaysElapsedGCC(startDate, jurisdiction);
  return slaDays - elapsed;
}

/**
 * Add N calendar days to a date (no weekend skipping).
 * Used for UAE (30 calendar days) and other calendar-day jurisdictions.
 */
export function addCalendarDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Calculate calendar days remaining until a deadline.
 */
export function calendarDaysRemaining(deadlineDate: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const deadline = new Date(deadlineDate);
  deadline.setHours(0, 0, 0, 0);
  return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Check if a SLA deadline has been exceeded.
 */
export function isSLAExceededGCC(
  startDate: Date,
  slaDays: number,
  jurisdiction: GCCJurisdictionCode = 'AE',
  deadlineUnit: 'calendar_days' | 'business_days' = 'business_days'
): boolean {
  if (deadlineUnit === 'business_days') {
    return businessDaysElapsedGCC(startDate, jurisdiction) > slaDays;
  }
  return calendarDaysRemaining(addCalendarDays(startDate, slaDays)) < 0;
}
