/**
 * Bahrain SIO Contribution Calculator — Social Insurance Organization
 *
 * Regulatory Framework:
 * The Social Insurance Organization (SIO) administers Bahrain's mandatory
 * social insurance under the Social Insurance Law (Decree Law No. 24 of 1976,
 * as amended). Contributions fund pension, disability, death, and
 * unemployment benefits for Bahraini nationals.
 *
 * Contribution Rates for Bahraini Nationals:
 * - Pension:            12% employer / 5.5% employee — Verify with SME
 * - Disability/Death:   Included in employer pension rate — Verify with SME
 * - Unemployment:       1% employer / 1% employee — Verify with SME
 *
 * GCC Nationals:
 * May be covered under bilateral social insurance agreements.
 * Rates vary — typically pension only. Verify with SME.
 *
 * Non-GCC Expatriates:
 * Exempt from SIO contributions.
 *
 * Wage Cap: 4,000 BHD/month — Verify with SME
 * Contributory wage = Basic Salary + Housing Allowance, capped at wage cap.
 * BHD uses 3 decimal places (1 BHD = 1,000 fils).
 *
 * PRINCIPLE A: FORMULA ACCURACY IS NON-NEGOTIABLE
 * PRINCIPLE C: SHARED COMPONENTS, COUNTRY-SPECIFIC LOGIC
 */

import type { ContributionResult } from './types';

// ─── Input Type ───────────────────────────────────────────────────────────────
export interface SIOInput {
  basicSalary: number;
  housingAllowance: number;
  nationality: 'bahraini' | 'gcc' | 'expat';
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Maximum monthly contributory wage in BHD — Verify with SME
const SIO_WAGE_CAP = 4000; // Verify with SME

// Bahraini national contribution rates — Verify with SME
const BAHRAINI_RATES = {
  pensionEmployer: 0.12,        // 12% — Verify with SME
  pensionEmployee: 0.055,       // 5.5% — Verify with SME
  unemploymentEmployer: 0.01,   // 1% — Verify with SME
  unemploymentEmployee: 0.01,   // 1% — Verify with SME
} as const;

// GCC national rates (bilateral treaties) — Verify with SME
const GCC_RATES = {
  pensionEmployer: 0.12,   // 12% — Verify with SME
  pensionEmployee: 0.055,  // 5.5% — Verify with SME
} as const;

// ─── Rounding Utility ────────────────────────────────────────────────────────
// BHD uses 3 decimal places
function roundBHD(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// ─── Main Calculator ─────────────────────────────────────────────────────────
export function calculateSIO(input: SIOInput): ContributionResult {
  const { basicSalary, housingAllowance, nationality } = input;

  // Calculate gross salary
  const grossSalary = basicSalary + housingAllowance;

  // Calculate contributory wage (capped)
  const contributoryWage = Math.min(grossSalary, SIO_WAGE_CAP);

  // For expats: no SIO contributions
  if (nationality === 'expat') {
    return {
      jurisdiction: 'BH',
      grossSalary: roundBHD(grossSalary),
      contributoryWage: roundBHD(contributoryWage),
      employerBreakdown: [],
      employeeBreakdown: [],
      employerTotal: 0,
      employeeTotal: 0,
      monthlyTotal: 0,
      annualTotal: 0,
      currency: 'BHD',
      wageCap: SIO_WAGE_CAP,
      pendingVerification: false,
    };
  }

  // For Bahraini nationals
  if (nationality === 'bahraini') {
    const pensionEmployer = roundBHD(contributoryWage * BAHRAINI_RATES.pensionEmployer);
    const pensionEmployee = roundBHD(contributoryWage * BAHRAINI_RATES.pensionEmployee);
    const unemploymentEmployer = roundBHD(contributoryWage * BAHRAINI_RATES.unemploymentEmployer);
    const unemploymentEmployee = roundBHD(contributoryWage * BAHRAINI_RATES.unemploymentEmployee);

    const employerTotal = roundBHD(pensionEmployer + unemploymentEmployer);
    const employeeTotal = roundBHD(pensionEmployee + unemploymentEmployee);

    return {
      jurisdiction: 'BH',
      grossSalary: roundBHD(grossSalary),
      contributoryWage: roundBHD(contributoryWage),
      employerBreakdown: [
        { name: 'Pension & Disability/Death', rate: BAHRAINI_RATES.pensionEmployer, amount: pensionEmployer },
        { name: 'Unemployment Insurance', rate: BAHRAINI_RATES.unemploymentEmployer, amount: unemploymentEmployer },
      ],
      employeeBreakdown: [
        { name: 'Pension', rate: BAHRAINI_RATES.pensionEmployee, amount: pensionEmployee },
        { name: 'Unemployment Insurance', rate: BAHRAINI_RATES.unemploymentEmployee, amount: unemploymentEmployee },
      ],
      employerTotal,
      employeeTotal,
      monthlyTotal: roundBHD(employerTotal + employeeTotal),
      annualTotal: roundBHD((employerTotal + employeeTotal) * 12),
      currency: 'BHD',
      wageCap: SIO_WAGE_CAP,
      pendingVerification: true,
      pendingVerificationMessage:
        'Rate verification pending — consult your HR compliance officer. SIO rates and wage cap are subject to periodic regulatory review.',
    };
  }

  // For GCC nationals (pension-only per bilateral treaties)
  const pensionEmployer = roundBHD(contributoryWage * GCC_RATES.pensionEmployer);
  const pensionEmployee = roundBHD(contributoryWage * GCC_RATES.pensionEmployee);

  const employerTotal = pensionEmployer;
  const employeeTotal = pensionEmployee;

  return {
    jurisdiction: 'BH',
    grossSalary: roundBHD(grossSalary),
    contributoryWage: roundBHD(contributoryWage),
    employerBreakdown: [
      { name: 'Pension (Bilateral Treaty)', rate: GCC_RATES.pensionEmployer, amount: pensionEmployer },
    ],
    employeeBreakdown: [
      { name: 'Pension (Bilateral Treaty)', rate: GCC_RATES.pensionEmployee, amount: pensionEmployee },
    ],
    employerTotal,
    employeeTotal,
    monthlyTotal: roundBHD(employerTotal + employeeTotal),
    annualTotal: roundBHD((employerTotal + employeeTotal) * 12),
    currency: 'BHD',
    wageCap: SIO_WAGE_CAP,
    pendingVerification: true,
    pendingVerificationMessage:
      'Rate verification pending — GCC national rates vary by bilateral treaty. Consult your HR compliance officer.',
  };
}
