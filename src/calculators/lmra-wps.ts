/**
 * Bahrain LMRA WPS Calculator — Wage Protection System File Generation
 *
 * Regulatory Framework:
 * The Labour Market Regulatory Authority (LMRA) mandates the Wage Protection
 * System (WPS) for all private-sector employers in Bahrain. Employers must
 * submit monthly salary disbursement files through approved channels to
 * verify that all employees are paid at least the minimum wage and on time.
 *
 * Key Requirements:
 * - Minimum monthly salary: 200 BHD — Verify with SME
 * - Bank account validation: IBAN format (BH + 2 check digits + 14 alphanumeric)
 * - File format: CSV with LMRA-prescribed column structure
 * - All expatriate employees must have valid CPR numbers
 * - Salary must be disbursed within the payroll cycle
 *
 * Maker-Checker Workflow:
 * Generated WPS files must go through a maker-checker process:
 * 1. HR Officer (maker) generates and submits the file
 * 2. Compliance/Finance Officer (checker) reviews and approves/rejects
 *
 * PRINCIPLE A: FORMULA ACCURACY IS NON-NEGOTIABLE
 * PRINCIPLE C: SHARED COMPONENTS, COUNTRY-SPECIFIC LOGIC
 */

import type { WPSResult, EmployeeRecord } from './types';

// ─── Input Type ───────────────────────────────────────────────────────────────
export interface LMRAWPSInput {
  employees: Array<
    Pick<EmployeeRecord, 'employeeId' | 'fullName' | 'nationalityCode' | 'totalSalary' | 'bankAccount' | 'idNumber'>
  >;
  payrollMonth: string; // Format: YYYY-MM
  companyName?: string;
  companyCRNumber?: string; // Commercial Registration Number
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Minimum monthly salary in BHD — Verify with SME
const MINIMUM_SALARY_BHD = 200; // Verify with SME

// IBAN format for Bahrain: BH + 2 check digits + BBAN (14 chars) = 22 chars total
const BAHRAIN_IBAN_PATTERN = /^BH\d{2}[A-Z0-9]{14}$/;

// ─── Validation Helpers ──────────────────────────────────────────────────────

function validateMinimumSalary(employee: LMRAWPSInput['employees'][number]): string | null {
  if (employee.totalSalary < MINIMUM_SALARY_BHD) {
    return `Salary (${employee.totalSalary.toFixed(3)} BHD) is below the minimum wage of ${MINIMUM_SALARY_BHD} BHD`;
  }
  return null;
}

function validateBankAccount(employee: LMRAWPSInput['employees'][number]): string | null {
  if (!employee.bankAccount) {
    return 'No bank account provided — WPS requires a valid bank account for salary disbursement';
  }
  if (!BAHRAIN_IBAN_PATTERN.test(employee.bankAccount)) {
    return `Invalid IBAN format: "${employee.bankAccount}" — Expected Bahrain IBAN (BH + 22 characters)`;
  }
  return null;
}

function validateCPR(employee: LMRAWPSInput['employees'][number]): string | null {
  if (!employee.idNumber) {
    return 'Missing CPR/CID number — required for all employees in WPS file';
  }
  // CPR format: 8 digits for Bahraini, varies for expats
  return null;
}

// ─── CSV Generation ──────────────────────────────────────────────────────────

function generateCSVContent(
  input: LMRAWPSInput
): string {
  const headers = [
    'Employee_ID',
    'Full_Name',
    'Nationality_Code',
    'CPR_CID',
    'Total_Salary_BHD',
    'Bank_Account_IBAN',
    'Payroll_Month',
    'Company_CR',
  ];

  const rows = input.employees.map((emp) =>
    [
      emp.employeeId,
      `"${emp.fullName}"`,
      emp.nationalityCode,
      emp.idNumber || '',
      emp.totalSalary.toFixed(3),
      emp.bankAccount || '',
      input.payrollMonth,
      input.companyCRNumber || '',
    ].join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

// ─── Main Calculator ─────────────────────────────────────────────────────────
export function calculateLMRAWPS(input: LMRAWPSInput): WPSResult {
  const discrepancies: WPSResult['discrepancies'] = [];
  let totalPayroll = 0;

  // Validate each employee
  for (const employee of input.employees) {
    totalPayroll += employee.totalSalary;

    // Minimum salary check
    const salaryIssue = validateMinimumSalary(employee);
    if (salaryIssue) {
      discrepancies.push({
        employeeId: employee.employeeId,
        issue: salaryIssue,
        severity: 'critical',
      });
    }

    // Bank account validation
    const bankIssue = validateBankAccount(employee);
    if (bankIssue) {
      discrepancies.push({
        employeeId: employee.employeeId,
        issue: bankIssue,
        severity: bankIssue.includes('No bank account') ? 'critical' : 'warning',
      });
    }

    // CPR/CID validation
    const cprIssue = validateCPR(employee);
    if (cprIssue) {
      discrepancies.push({
        employeeId: employee.employeeId,
        issue: cprIssue,
        severity: 'warning',
      });
    }
  }

  // Generate file content
  const fileContent = generateCSVContent(input);

  // Generate file name
  const sanitizedMonth = input.payrollMonth.replace(/[^0-9-]/g, '');
  const companyPrefix = input.companyCRNumber
    ? `CR${input.companyCRNumber}`
    : 'LMRA';
  const fileName = `WPS_${companyPrefix}_${sanitizedMonth}.csv`;

  // Round total payroll to 3 decimal places (BHD)
  totalPayroll = Math.round(totalPayroll * 1000) / 1000;

  // Determine maker-checker status
  const hasCritical = discrepancies.some((d) => d.severity === 'critical');
  const makerCheckerStatus = hasCritical ? 'REJECTED' : 'PENDING';

  return {
    jurisdiction: 'BH',
    totalPayroll,
    employeeCount: input.employees.length,
    currency: 'BHD',
    fileContent,
    fileName,
    discrepancies,
    makerCheckerStatus,
  };
}
