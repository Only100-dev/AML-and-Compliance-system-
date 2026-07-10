/**
 * Qatar GRSIA Contribution Calculator — General Retirement & Social Insurance Authority
 *
 * Regulatory Framework:
 * The General Retirement and Social Insurance Authority (GRSIA) administers
 * Qatar's mandatory social insurance under Law No. 24 of 2002 (Social
 * Insurance Law). Contributions fund pension, disability, death, and
 * occupational hazard benefits for Qatari nationals.
 *
 * Contribution Rates for Qatari Nationals:
 * - Pension:            10% employer / 5% employee — Verify with SME
 * - Disability/Death:   Included in employer rate — Verify with SME
 * - Occupational Hazard: 3% employer / 0% employee — Verify with SME
 *
 * GCC Nationals:
 * May be covered under bilateral social insurance agreements.
 * Rates vary — typically pension only. Verify with SME.
 *
 * Non-GCC Expatriates:
 * Exempt from GRSIA contributions (covered under employer's
 * commercial insurance obligations per Labour Law).
 *
 * Wage Cap: Subject to GRSIA annual determination — Verify with SME
 * Current assumed cap: 50,000 QAR/month — Verify with SME
 * QAR uses 2 decimal places.
 *
 * PRINCIPLE A: FORMULA ACCURACY IS NON-NEGOTIABLE
 * PRINCIPLE C: SHARED COMPONENTS, COUNTRY-SPECIFIC LOGIC
 */

import type { ContributionResult } from './types';

// ─── Input Type ───────────────────────────────────────────────────────────────
export interface GRSIAInput {
  basicSalary: number;
  housingAllowance: number;
  nationality: 'qatari' | 'gcc' | 'expat';
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Maximum monthly contributory wage in QAR — Verify with SME
const GRSIA_WAGE_CAP = 50000; // Verify with SME

// Qatari national contribution rates — Verify with SME
const QATARI_RATES = {
  pensionEmployer: 0.10,             // 10% — Verify with SME
  pensionEmployee: 0.05,             // 5% — Verify with SME
  occupationalHazardEmployer: 0.03,  // 3% — Verify with SME
} as const;

// GCC national rates (bilateral treaties) — Verify with SME
const GCC_RATES = {
  pensionEmployer: 0.10,  // 10% — Verify with SME
  pensionEmployee: 0.05,  // 5% — Verify with SME
} as const;

// ─── Rounding Utility ────────────────────────────────────────────────────────
// QAR uses 2 decimal places
function roundQAR(value: number): number {
  return Math.round(value * 100) / 100;
}

// ─── Main Calculator ─────────────────────────────────────────────────────────
export function calculateGRSIA(input: GRSIAInput): ContributionResult {
  const { basicSalary, housingAllowance, nationality } = input;

  // Calculate gross salary
  const grossSalary = basicSalary + housingAllowance;

  // Calculate contributory wage (capped)
  const contributoryWage = Math.min(grossSalary, GRSIA_WAGE_CAP);

  // For expats: no GRSIA contributions
  if (nationality === 'expat') {
    return {
      jurisdiction: 'QA',
      grossSalary: roundQAR(grossSalary),
      contributoryWage: roundQAR(contributoryWage),
      employerBreakdown: [],
      employeeBreakdown: [],
      employerTotal: 0,
      employeeTotal: 0,
      monthlyTotal: 0,
      annualTotal: 0,
      currency: 'QAR',
      wageCap: GRSIA_WAGE_CAP,
      pendingVerification: false,
    };
  }

  // For Qatari nationals
  if (nationality === 'qatari') {
    const pensionEmployer = roundQAR(contributoryWage * QATARI_RATES.pensionEmployer);
    const pensionEmployee = roundQAR(contributoryWage * QATARI_RATES.pensionEmployee);
    const occupationalHazard = roundQAR(contributoryWage * QATARI_RATES.occupationalHazardEmployer);

    const employerTotal = roundQAR(pensionEmployer + occupationalHazard);
    const employeeTotal = pensionEmployee;

    return {
      jurisdiction: 'QA',
      grossSalary: roundQAR(grossSalary),
      contributoryWage: roundQAR(contributoryWage),
      employerBreakdown: [
        { name: 'Pension & Disability/Death', rate: QATARI_RATES.pensionEmployer, amount: pensionEmployer },
        { name: 'Occupational Hazard', rate: QATARI_RATES.occupationalHazardEmployer, amount: occupationalHazard },
      ],
      employeeBreakdown: [
        { name: 'Pension', rate: QATARI_RATES.pensionEmployee, amount: pensionEmployee },
      ],
      employerTotal,
      employeeTotal,
      monthlyTotal: roundQAR(employerTotal + employeeTotal),
      annualTotal: roundQAR((employerTotal + employeeTotal) * 12),
      currency: 'QAR',
      wageCap: GRSIA_WAGE_CAP,
      pendingVerification: true,
      pendingVerificationMessage:
        'Rate verification pending — consult your HR compliance officer. GRSIA rates and wage cap are subject to periodic regulatory review.',
    };
  }

  // For GCC nationals (pension-only per bilateral treaties)
  const pensionEmployer = roundQAR(contributoryWage * GCC_RATES.pensionEmployer);
  const pensionEmployee = roundQAR(contributoryWage * GCC_RATES.pensionEmployee);

  const employerTotal = pensionEmployer;
  const employeeTotal = pensionEmployee;

  return {
    jurisdiction: 'QA',
    grossSalary: roundQAR(grossSalary),
    contributoryWage: roundQAR(contributoryWage),
    employerBreakdown: [
      { name: 'Pension (Bilateral Treaty)', rate: GCC_RATES.pensionEmployer, amount: pensionEmployer },
    ],
    employeeBreakdown: [
      { name: 'Pension (Bilateral Treaty)', rate: GCC_RATES.pensionEmployee, amount: pensionEmployee },
    ],
    employerTotal,
    employeeTotal,
    monthlyTotal: roundQAR(employerTotal + employeeTotal),
    annualTotal: roundQAR((employerTotal + employeeTotal) * 12),
    currency: 'QAR',
    wageCap: GRSIA_WAGE_CAP,
    pendingVerification: true,
    pendingVerificationMessage:
      'Rate verification pending — GCC national rates vary by bilateral treaty. Consult your HR compliance officer.',
  };
}
