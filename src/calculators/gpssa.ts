/**
 * UAE GPSSA Contribution Calculator — General Pension and Social Security Authority
 *
 * Regulatory Framework:
 * The General Pension and Social Security Authority (GPSSA) administers mandatory
 * social insurance for UAE nationals working in the private sector under
 * Federal Law No. 7 of 1999 (as amended).
 *
 * Contribution Categories for UAE Nationals:
 * 1. Pension (Annuities):           5% employer / 5% employee
 * 2. Occupational Hazard:           1% employer / 0% employee
 *
 * GCC Nationals:
 * Contribute to Pension only per bilateral social insurance treaties.
 * Subject to individual GCC social insurance treaties — Verify with SME.
 * Rates mirror UAE national pension rates per bilateral agreements.
 *
 * Non-GCC Expatriates:
 * Exempt from GPSSA contributions entirely (covered by End of Service
 * Benefits — EOSB — under UAE Labour Law).
 *
 * Wage Cap: 70,000 AED/month — Verify with SME
 * Contributory wage = Monthly Salary, capped at wage cap.
 *
 * PRINCIPLE A: FORMULA ACCURACY IS NON-NEGOTIABLE
 * PRINCIPLE C: SHARED COMPONENTS, COUNTRY-SPECIFIC LOGIC
 */

import type { ContributionResult } from './types';

// ─── Input Type ───────────────────────────────────────────────────────────────
export interface GPSSAInput {
  monthlySalary: number;        // AED
  nationality: 'uae' | 'gcc' | 'non-gcc';
  isOccupationalHazardApplicable?: boolean; // default true for UAE nationals
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Maximum monthly contributory wage in AED — Verify with SME
const GPSSA_WAGE_CAP = 70000; // Verify with SME

// UAE national contribution rates — Verify with SME
const UAE_RATES = {
  pensionEmployer: 0.05,            // 5% — Verify with SME
  pensionEmployee: 0.05,            // 5% — Verify with SME
  occupationalHazardEmployer: 0.01, // 1% — Verify with SME
} as const;

// GCC national contribution rates (pension-only per bilateral treaties)
// Verify with SME — rates mirror UAE national pension rates per bilateral agreement
const GCC_RATES = {
  pensionEmployer: 0.05,  // 5% — Verify with SME
  pensionEmployee: 0.05,  // 5% — Verify with SME
} as const;

// ─── Rounding Utility ────────────────────────────────────────────────────────
// AED uses 0 decimal places (rounded to nearest whole Dirham)
function roundAED(value: number): number {
  return Math.round(value);
}

// ─── Main Calculator ─────────────────────────────────────────────────────────
export function calculateGPSSA(input: GPSSAInput): ContributionResult {
  const { monthlySalary, nationality, isOccupationalHazardApplicable } = input;

  // Calculate contributory wage (capped)
  const contributoryWage = Math.min(monthlySalary, GPSSA_WAGE_CAP);

  // For non-GCC expats: no GPSSA contributions (covered by EOSB)
  if (nationality === 'non-gcc') {
    return {
      jurisdiction: 'AE',
      grossSalary: roundAED(monthlySalary),
      contributoryWage: roundAED(contributoryWage),
      employerBreakdown: [],
      employeeBreakdown: [],
      employerTotal: 0,
      employeeTotal: 0,
      monthlyTotal: 0,
      annualTotal: 0,
      currency: 'AED',
      wageCap: GPSSA_WAGE_CAP,
      pendingVerification: false,
    };
  }

  // For UAE nationals
  if (nationality === 'uae') {
    const pensionEmployer = roundAED(contributoryWage * UAE_RATES.pensionEmployer);
    const pensionEmployee = roundAED(contributoryWage * UAE_RATES.pensionEmployee);
    const applyOccupationalHazard = isOccupationalHazardApplicable !== false; // default true
    const occupationalHazard = applyOccupationalHazard
      ? roundAED(contributoryWage * UAE_RATES.occupationalHazardEmployer)
      : 0;

    const employerTotal = pensionEmployer + occupationalHazard;
    const employeeTotal = pensionEmployee;

    const employerBreakdown: Array<{ name: string; rate: number; amount: number }> = [
      { name: 'Pension (Annuities)', rate: UAE_RATES.pensionEmployer, amount: pensionEmployer },
    ];
    if (applyOccupationalHazard) {
      employerBreakdown.push({
        name: 'Occupational Hazard',
        rate: UAE_RATES.occupationalHazardEmployer,
        amount: occupationalHazard,
      });
    }

    return {
      jurisdiction: 'AE',
      grossSalary: roundAED(monthlySalary),
      contributoryWage: roundAED(contributoryWage),
      employerBreakdown,
      employeeBreakdown: [
        { name: 'Pension (Annuities)', rate: UAE_RATES.pensionEmployee, amount: pensionEmployee },
      ],
      employerTotal,
      employeeTotal,
      monthlyTotal: employerTotal + employeeTotal,
      annualTotal: (employerTotal + employeeTotal) * 12,
      currency: 'AED',
      wageCap: GPSSA_WAGE_CAP,
      pendingVerification: true,
      pendingVerificationMessage:
        'Rate verification pending — consult your HR compliance officer. GPSSA rates and wage cap are subject to periodic regulatory review under Federal Law No. 7 of 1999.',
    };
  }

  // For GCC nationals (pension-only per bilateral treaties)
  const pensionEmployer = roundAED(contributoryWage * GCC_RATES.pensionEmployer);
  const pensionEmployee = roundAED(contributoryWage * GCC_RATES.pensionEmployee);

  const employerTotal = pensionEmployer;
  const employeeTotal = pensionEmployee;

  return {
    jurisdiction: 'AE',
    grossSalary: roundAED(monthlySalary),
    contributoryWage: roundAED(contributoryWage),
    employerBreakdown: [
      { name: 'Pension (Bilateral Treaty)', rate: GCC_RATES.pensionEmployer, amount: pensionEmployer },
    ],
    employeeBreakdown: [
      { name: 'Pension (Bilateral Treaty)', rate: GCC_RATES.pensionEmployee, amount: pensionEmployee },
    ],
    employerTotal,
    employeeTotal,
    monthlyTotal: employerTotal + employeeTotal,
    annualTotal: (employerTotal + employeeTotal) * 12,
    currency: 'AED',
    wageCap: GPSSA_WAGE_CAP,
    pendingVerification: true,
    pendingVerificationMessage:
      'Rate verification pending — GCC national rates vary by bilateral treaty. Consult your HR compliance officer.',
  };
}
