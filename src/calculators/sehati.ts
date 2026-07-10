/**
 * Bahrain Sehati Calculator — Mandatory Health Insurance for Expatriates
 *
 * Regulatory Framework:
 * Under Bahrain's National Health Insurance Law (Decree Law No. 23 of 2018)
 * and the Sehati scheme administered by the Health Insurance Regulatory
 * Council (HIRC), all non-Bahraini, non-GCC nationals employed in Bahrain
 * must have mandatory health insurance coverage.
 *
 * Key Requirements:
 * - All expatriate employees must have active health insurance
 * - GCC nationals are typically covered under reciprocal health agreements
 * - Insurance policy must not expire (30-day grace period for renewal)
 * - Employer is responsible for ensuring coverage is maintained
 * - Non-compliance results in LMRA work permit restrictions
 *
 * PRINCIPLE A: FORMULA ACCURACY IS NON-NEGOTIABLE
 * PRINCIPLE C: SHARED COMPONENTS, COUNTRY-SPECIFIC LOGIC
 */

import type { HealthCoverageResult, EmployeeRecord } from './types';

// ─── Input Type ───────────────────────────────────────────────────────────────
export interface SehatiInput {
  employees: Array<
    Pick<
      EmployeeRecord,
      'employeeId' | 'fullName' | 'nationalityCode' | 'isGCCNational' | 'healthPolicyNumber' | 'healthPolicyExpiry'
    >
  >;
  /** Reference date for coverage check (ISO string). Defaults to today if not provided. */
  referenceDate?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Grace period in days before policy expiry is flagged as critical
const EXPIRY_GRACE_PERIOD_DAYS = 30;

// GCC country codes that have reciprocal health agreements
const GCC_COUNTRY_CODES = ['BH', 'SA', 'AE', 'QA', 'OM', 'KW'];

// ─── Helper: Days until expiry ───────────────────────────────────────────────
function daysUntilExpiry(expiryStr: string, referenceDate: Date): number {
  const expiry = new Date(expiryStr);
  const diffMs = expiry.getTime() - referenceDate.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// ─── Main Calculator ─────────────────────────────────────────────────────────
export function calculateSehati(input: SehatiInput): HealthCoverageResult {
  const referenceDate = input.referenceDate
    ? new Date(input.referenceDate)
    : new Date();

  const alerts: HealthCoverageResult['alerts'] = [];

  // Filter expatriate employees (non-Bahraini, non-GCC)
  const expatEmployees = input.employees.filter(
    (emp) => !GCC_COUNTRY_CODES.includes(emp.nationalityCode.toUpperCase())
  );

  let coveredExpats = 0;
  let uncoveredExpats = 0;

  for (const emp of expatEmployees) {
    // Check if policy number exists
    if (!emp.healthPolicyNumber) {
      uncoveredExpats++;
      alerts.push({
        type: 'critical',
        message: `No health insurance policy on file for ${emp.fullName} (${emp.employeeId})`,
        employeeId: emp.employeeId,
      });
      continue;
    }

    // Check if policy has an expiry date
    if (!emp.healthPolicyExpiry) {
      // Policy exists but no expiry — assume covered but flag as warning
      coveredExpats++;
      alerts.push({
        type: 'warning',
        message: `Health policy ${emp.healthPolicyNumber} for ${emp.fullName} has no expiry date on file`,
        employeeId: emp.employeeId,
      });
      continue;
    }

    // Check expiry
    const daysLeft = daysUntilExpiry(emp.healthPolicyExpiry, referenceDate);

    if (daysLeft < 0) {
      // Already expired
      uncoveredExpats++;
      alerts.push({
        type: 'critical',
        message: `Health policy ${emp.healthPolicyNumber} for ${emp.fullName} expired ${Math.abs(daysLeft)} day(s) ago`,
        employeeId: emp.employeeId,
      });
    } else if (daysLeft <= EXPIRY_GRACE_PERIOD_DAYS) {
      // Expiring within grace period — still covered but flag
      coveredExpats++;
      alerts.push({
        type: 'warning',
        message: `Health policy ${emp.healthPolicyNumber} for ${emp.fullName} expires in ${daysLeft} day(s) — renew immediately`,
        employeeId: emp.employeeId,
      });
    } else {
      coveredExpats++;
    }
  }

  // GCC nationals: information-only check
  for (const emp of input.employees) {
    if (
      emp.nationalityCode.toUpperCase() !== 'BH' &&
      GCC_COUNTRY_CODES.includes(emp.nationalityCode.toUpperCase()) &&
      !emp.healthPolicyNumber
    ) {
      alerts.push({
        type: 'warning',
        message: `GCC national ${emp.fullName} (${emp.nationalityCode}) has no policy — may be covered under reciprocal agreement, verify with HR`,
        employeeId: emp.employeeId,
      });
    }
  }

  // Calculate coverage percentage
  const totalExpats = expatEmployees.length;
  const coveragePercentage =
    totalExpats > 0
      ? Math.round((coveredExpats / totalExpats) * 10000) / 100
      : 100; // If no expats, 100% coverage by definition

  return {
    jurisdiction: 'BH',
    totalExpats,
    coveredExpats,
    uncoveredExpats,
    coveragePercentage,
    alerts,
  };
}
