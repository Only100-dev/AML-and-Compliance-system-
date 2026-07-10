/**
 * IC-OS Labor/HR Calculator — Shared Type Definitions
 *
 * These types define the contract between pure calculation functions
 * and the UI components that consume them. Every calculator returns
 * one of these result types, ensuring a consistent interface across
 * all 6 GCC jurisdictions.
 *
 * PRINCIPLE A: FORMULA ACCURACY IS NON-NEGOTIABLE
 * PRINCIPLE C: SHARED COMPONENTS, COUNTRY-SPECIFIC LOGIC
 */

// ─── Nationalization / Localization Result ────────────────────────────────────
// Used by: nitaqat (KSA), bahrainisation (BH), qatarization (QA),
//          omanization (OM), kuwaitization (KW)
export interface NationalizationResult {
  /** ISO jurisdiction code (SA, BH, QA, OM, KW) */
  jurisdiction: string;
  /** Current nationalization percentage (0–100) */
  currentPercentage: number;
  /** Required minimum percentage for compliance */
  requiredPercentage: number;
  /** Named tier/band (e.g., "Platinum", "Green", "Compliant") */
  tier: string;
  /** Percentage points to reach the next tier */
  gapToNext: number;
  /** Number of additional national employees needed to reach next tier */
  gapEmployees: number;
  /** Overall compliance status */
  complianceStatus: 'COMPLIANT' | 'AT_RISK' | 'NON_COMPLIANT';
  /** List of penalty descriptions for non-compliance */
  penalties: string[];
  /** Actionable recommendations to improve compliance */
  recommendations: string[];
}

// ─── Social Insurance / Pension Contribution Result ───────────────────────────
// Used by: gosi (KSA), sio (BH), grsia (QA), pasi (OM), pifss (KW)
export interface ContributionResult {
  /** ISO jurisdiction code */
  jurisdiction: string;
  /** Gross salary before deductions */
  grossSalary: number;
  /** Salary portion subject to social insurance contributions */
  contributoryWage: number;
  /** Employer-side contribution breakdown */
  employerBreakdown: Array<{ name: string; rate: number; amount: number }>;
  /** Employee-side contribution breakdown */
  employeeBreakdown: Array<{ name: string; rate: number; amount: number }>;
  /** Total employer contribution amount */
  employerTotal: number;
  /** Total employee contribution amount */
  employeeTotal: number;
  /** Combined monthly total (employer + employee) */
  monthlyTotal: number;
  /** Annual total (monthlyTotal × 12) */
  annualTotal: number;
  /** ISO 4217 currency code (SAR, BHD, QAR, OMR, KWD) */
  currency: string;
  /** Maximum wage cap applied, or null if no cap */
  wageCap: number | null;
  /** Whether any rate in the calculation requires SME verification */
  pendingVerification: boolean;
  /** Human-readable message when pendingVerification is true */
  pendingVerificationMessage?: string;
}

// ─── Wage Protection System (WPS) Result ─────────────────────────────────────
// Used by: lmra-wps (BH), and future WPS modules for other jurisdictions
export interface WPSResult {
  /** ISO jurisdiction code */
  jurisdiction: string;
  /** Total payroll amount for the file */
  totalPayroll: number;
  /** Number of employees in the file */
  employeeCount: number;
  /** ISO 4217 currency code */
  currency: string;
  /** Generated file content (CSV/SIF format) */
  fileContent: string;
  /** Suggested file name for download */
  fileName: string;
  /** List of per-employee validation issues */
  discrepancies: Array<{
    employeeId: string;
    issue: string;
    severity: 'warning' | 'critical';
  }>;
  /** Maker-checker workflow status */
  makerCheckerStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
}

// ─── Mandatory Health Coverage Result ─────────────────────────────────────────
// Used by: sehati (BH), and future health insurance modules
export interface HealthCoverageResult {
  /** ISO jurisdiction code */
  jurisdiction: string;
  /** Total expatriate employees requiring coverage */
  totalExpats: number;
  /** Expatriate employees with valid health coverage */
  coveredExpats: number;
  /** Expatriate employees without valid health coverage */
  uncoveredExpats: number;
  /** Coverage percentage (coveredExpats / totalExpats × 100) */
  coveragePercentage: number;
  /** Alerts for missing or expiring coverage */
  alerts: Array<{
    type: 'critical' | 'warning';
    message: string;
    employeeId?: string;
  }>;
}

// ─── Rounding Utility Types ───────────────────────────────────────────────────
/** Currencies that use 0 decimal places (SAR, AED) */
export type ZeroDecimalCurrency = 'SAR' | 'AED';
/** Currencies that use 3 decimal places (BHD, QAR, OMR, KWD) */
export type ThreeDecimalCurrency = 'BHD' | 'QAR' | 'OMR' | 'KWD';

// ─── Employee Record for WPS / Health checks ─────────────────────────────────
export interface EmployeeRecord {
  employeeId: string;
  fullName: string;
  nationality: string;
  /** ISO country code for nationality */
  nationalityCode: string;
  /** Is the employee a GCC national? */
  isGCCNational: boolean;
  basicSalary: number;
  totalSalary: number;
  bankAccount?: string;
  /** Health insurance policy number (for expats) */
  healthPolicyNumber?: string;
  /** Health insurance expiry date (ISO string) */
  healthPolicyExpiry?: string;
  /** CPR/CID number */
  idNumber?: string;
}
