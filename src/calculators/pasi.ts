/**
 * Oman PASI Contribution Calculator — Pension Authority for Social Insurance
 *
 * Regulatory Framework:
 * The Pension Authority for Social Insurance (PASI) administers Oman's
 * mandatory social insurance under the Social Insurance Law (Royal Decree
 * 72/1991, as amended). Contributions fund pension, disability, death,
 * and occupational hazard benefits for Omani nationals.
 *
 * Contribution Rates for Omani Nationals:
 * - Pension:                10.5% employer / 6.5% employee — Verify with SME
 * - Occupational Hazard:    1% employer / 0% employee — Verify with SME
 * - Disability/Death:       Included in employer pension rate — Verify with SME
 *
 * GCC Nationals:
 * May be covered under bilateral social insurance agreements.
 * Rates vary — typically pension only. Verify with SME.
 *
 * Non-GCC Expatriates:
 * Exempt from PASI contributions. Employers must provide
 * commercial occupational hazard insurance.
 *
 * Wage Cap: Subject to PASI annual determination — Verify with SME
 * Current assumed cap: 3,000 OMR/month — Verify with SME
 * OMR uses 3 decimal places (1 OMR = 1,000 baisa).
 *
 * PRINCIPLE A: FORMULA ACCURACY IS NON-NEGOTIABLE
 * PRINCIPLE C: SHARED COMPONENTS, COUNTRY-SPECIFIC LOGIC
 */

import type { ContributionResult } from './types';

// ─── Input Type ───────────────────────────────────────────────────────────────
export interface PASIInput {
  basicSalary: number;
  housingAllowance: number;
  nationality: 'omani' | 'gcc' | 'expat';
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Maximum monthly contributory wage in OMR — Verify with SME
const PASI_WAGE_CAP = 3000; // Verify with SME

// Omani national contribution rates — Verify with SME
const OMANI_RATES = {
  pensionEmployer: 0.105,             // 10.5% — Verify with SME
  pensionEmployee: 0.065,             // 6.5% — Verify with SME
  occupationalHazardEmployer: 0.01,   // 1% — Verify with SME
} as const;

// GCC national rates (bilateral treaties) — Verify with SME
const GCC_RATES = {
  pensionEmployer: 0.105,  // 10.5% — Verify with SME
  pensionEmployee: 0.065,  // 6.5% — Verify with SME
} as const;

// ─── Rounding Utility ────────────────────────────────────────────────────────
// OMR uses 3 decimal places
function roundOMR(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// ─── Main Calculator ─────────────────────────────────────────────────────────
export function calculatePASI(input: PASIInput): ContributionResult {
  const { basicSalary, housingAllowance, nationality } = input;

  // Calculate gross salary
  const grossSalary = basicSalary + housingAllowance;

  // Calculate contributory wage (capped)
  const contributoryWage = Math.min(grossSalary, PASI_WAGE_CAP);

  // For expats: no PASI contributions
  if (nationality === 'expat') {
    return {
      jurisdiction: 'OM',
      grossSalary: roundOMR(grossSalary),
      contributoryWage: roundOMR(contributoryWage),
      employerBreakdown: [],
      employeeBreakdown: [],
      employerTotal: 0,
      employeeTotal: 0,
      monthlyTotal: 0,
      annualTotal: 0,
      currency: 'OMR',
      wageCap: PASI_WAGE_CAP,
      pendingVerification: false,
    };
  }

  // For Omani nationals
  if (nationality === 'omani') {
    const pensionEmployer = roundOMR(contributoryWage * OMANI_RATES.pensionEmployer);
    const pensionEmployee = roundOMR(contributoryWage * OMANI_RATES.pensionEmployee);
    const occupationalHazard = roundOMR(contributoryWage * OMANI_RATES.occupationalHazardEmployer);

    const employerTotal = roundOMR(pensionEmployer + occupationalHazard);
    const employeeTotal = pensionEmployee;

    return {
      jurisdiction: 'OM',
      grossSalary: roundOMR(grossSalary),
      contributoryWage: roundOMR(contributoryWage),
      employerBreakdown: [
        { name: 'Pension & Disability/Death', rate: OMANI_RATES.pensionEmployer, amount: pensionEmployer },
        { name: 'Occupational Hazard', rate: OMANI_RATES.occupationalHazardEmployer, amount: occupationalHazard },
      ],
      employeeBreakdown: [
        { name: 'Pension', rate: OMANI_RATES.pensionEmployee, amount: pensionEmployee },
      ],
      employerTotal,
      employeeTotal,
      monthlyTotal: roundOMR(employerTotal + employeeTotal),
      annualTotal: roundOMR((employerTotal + employeeTotal) * 12),
      currency: 'OMR',
      wageCap: PASI_WAGE_CAP,
      pendingVerification: true,
      pendingVerificationMessage:
        'Rate verification pending — consult your HR compliance officer. PASI rates and wage cap are subject to periodic regulatory review.',
    };
  }

  // For GCC nationals (pension-only per bilateral treaties)
  const pensionEmployer = roundOMR(contributoryWage * GCC_RATES.pensionEmployer);
  const pensionEmployee = roundOMR(contributoryWage * GCC_RATES.pensionEmployee);

  const employerTotal = pensionEmployer;
  const employeeTotal = pensionEmployee;

  return {
    jurisdiction: 'OM',
    grossSalary: roundOMR(grossSalary),
    contributoryWage: roundOMR(contributoryWage),
    employerBreakdown: [
      { name: 'Pension (Bilateral Treaty)', rate: GCC_RATES.pensionEmployer, amount: pensionEmployer },
    ],
    employeeBreakdown: [
      { name: 'Pension (Bilateral Treaty)', rate: GCC_RATES.pensionEmployee, amount: pensionEmployee },
    ],
    employerTotal,
    employeeTotal,
    monthlyTotal: roundOMR(employerTotal + employeeTotal),
    annualTotal: roundOMR((employerTotal + employeeTotal) * 12),
    currency: 'OMR',
    wageCap: PASI_WAGE_CAP,
    pendingVerification: true,
    pendingVerificationMessage:
      'Rate verification pending — GCC national rates vary by bilateral treaty. Consult your HR compliance officer.',
  };
}
