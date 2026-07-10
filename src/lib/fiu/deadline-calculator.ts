/**
 * FIU Deadline Calculator — Jurisdiction-Aware SAR/STR Filing Deadlines
 *
 * CRITICAL (PRINCIPLE B): Deadline calculation is NON-NEGOTIABLE.
 * - Bahrain CBB: 5 BUSINESS DAYS (exclude Fri-Sat)
 *   Detection on Thursday → Deadline is next Wednesday
 * - UAE CBUAE: 30 CALENDAR DAYS
 *   Detection Jan 1 → Deadline Jan 31
 *
 * Phase 4 (Action 4.1): Centralized deadline calculation for all 6 GCC countries.
 */

import type { GCCJurisdictionCode } from '@/lib/constants/jurisdictions';
import { getRegulatoryThresholds } from '@/lib/regulatory/thresholds';
import { addBusinessDaysGCC, addCalendarDays, businessDaysRemainingGCC, calendarDaysRemaining } from './business-days-gcc';
import type { DeadlineInfo } from './types';

// ─── Deadline Calculation ─────────────────────────────────────────────────────

/**
 * Calculate the SAR filing deadline for any GCC jurisdiction.
 * Uses the jurisdiction-specific threshold data (deadline days + unit).
 *
 * @param detectionDate - Date the suspicious activity was detected
 * @param jurisdiction - GCC alpha-2 code
 * @returns The absolute deadline date
 */
export function calculateFilingDeadline(
  detectionDate: Date,
  jurisdiction: GCCJurisdictionCode
): Date {
  const thresholds = getRegulatoryThresholds(jurisdiction);

  if (thresholds.sarDeadlineUnit === 'business_days') {
    return addBusinessDaysGCC(detectionDate, thresholds.sarDeadline, jurisdiction);
  }

  return addCalendarDays(detectionDate, thresholds.sarDeadline);
}

/**
 * Get comprehensive deadline information for UI display.
 *
 * @param detectionDate - Date the suspicious activity was detected
 * @param jurisdiction - GCC alpha-2 code
 * @returns Full deadline info with remaining days, overdue status, etc.
 */
export function getFilingDeadlineInfo(
  detectionDate: Date,
  jurisdiction: GCCJurisdictionCode
): DeadlineInfo {
  const thresholds = getRegulatoryThresholds(jurisdiction);
  const deadlineDate = calculateFilingDeadline(detectionDate, jurisdiction);

  const daysRemaining = thresholds.sarDeadlineUnit === 'business_days'
    ? businessDaysRemainingGCC(detectionDate, thresholds.sarDeadline, jurisdiction)
    : calendarDaysRemaining(deadlineDate);

  return {
    detectionDate,
    deadlineDate,
    deadlineType: thresholds.sarDeadlineUnit,
    deadlineDays: thresholds.sarDeadline,
    daysRemaining,
    isOverdue: daysRemaining < 0,
    isCritical: daysRemaining >= 0 && daysRemaining <= 3,
    jurisdiction,
    regulator: thresholds.regulatorName,
  };
}

/**
 * Check if a SAR filing deadline has been exceeded.
 * Returns true if the deadline has passed.
 */
export function isFilingDeadlineExceeded(
  detectionDate: Date,
  jurisdiction: GCCJurisdictionCode
): boolean {
  const info = getFilingDeadlineInfo(detectionDate, jurisdiction);
  return info.isOverdue;
}

/**
 * Get a human-readable description of the filing deadline.
 */
export function getDeadlineDescription(jurisdiction: GCCJurisdictionCode): string {
  const thresholds = getRegulatoryThresholds(jurisdiction);
  const unit = thresholds.sarDeadlineUnit === 'business_days' ? 'business days' : 'calendar days';
  return `${thresholds.sarDeadline} ${unit} from detection date (${thresholds.regulatorName} requirement)`;
}
