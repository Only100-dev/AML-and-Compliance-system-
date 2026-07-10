/**
 * Kuwait PIFSS Contribution Calculator — Public Institution for Social Security
 *
 * Regulatory Framework:
 * The Public Institution for Social Security (PIFSS) administers Kuwait's
 * mandatory social insurance under the Social Security Law (Law No. 61
 * of 1976, as amended). Contributions fund pension, disability, death,
 * and end-of-service benefits for Kuwaiti nationals.
 *
 * Contribution Rates for Kuwaiti Nationals:
 * - Pension:            11.5% employer / 7.5% employee — Verify with SME
 * - Disability/Death:   Included in employer pension rate — Verify with SME
 *
 * GCC Nationals:
 * May be covered under bilateral social insurance agreements.
 * Rates vary — typically pension only. Verify with SME.
 *
 * Non-GCC Expatriates:
 * Exempt from PIFSS contributions. End-of-service benefits (indemnity)
 * for expats are governed by Labour Law No. 6 of 2010 and calculated
 * separately (not through PIFSS).
 *
 * Wage Cap: Subject to PIFSS annual determination — Verify with SME
 * Current assumed cap: 2,500 KWD/month — Verify with SME
 * KWD uses 3 decimal places (1 KWD = 1,000 fils).
 *
 * PRINCIPLE A: FORMULA ACCURACY IS NON-NEGOTIABLE
 * PRINCIPLE C: SHARED COMPONENTS, COUNTRY-SPECIFIC LOGIC
 */

import type { ContributionResult } from './types';

// ─── Input Type ───────────────────────────────────────────────────────────────
export interface PIFSSInput {
  basicSalary: number;
  housingAllowance: number;
  nationality: 'kuwaiti' | 'gcc' | 'expat';
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Maximum monthly contributory wage in KWD — Verify with SME
const PIFSS_WAGE_CAP = 2500; // Verify with SME

// Kuwaiti national contribution rates — Verify with SME
const KUWAITI_RATES = {
  pensionEmployer: 0.115,   // 11.5% — Verify with SME
  pensionEmployee: 0.075,   // 7.5% — Verify with SME
} as const;

// GCC national rates (bilateral treaties) — Verify with SME
const GCC_RATES = {
  pensionEmployer: 0.115,  // 11.5% — Verify with SME
  pensionEmployee: 0.075,  // 7.5% — Verify with SME
} as const;

// ─── Rounding Utility ────────────────────────────────────────────────────────
// KWD uses 3 decimal places
function roundKWD(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// ─── Main Calculator ─────────────────────────────────────────────────────────
export function calculatePIFSS(input: PIFSSInput): ContributionResult {
  const { basicSalary, housingAllowance, nationality } = input;

  // Calculate gross salary
  const grossSalary = basicSalary + housingAllowance;

  // Calculate contributory wage (capped)
  const contributoryWage = Math.min(grossSalary, PIFSS_WAGE_CAP);

  // For expats: no PIFSS contributions
  // Note: Expat end-of-service indemnity is calculated separately
  // under Labour Law and is NOT a PIFSS contribution
  if (nationality === 'expat') {
    return {
      jurisdiction: 'KW',
      grossSalary: roundKWD(grossSalary),
      contributoryWage: roundKWD(contributoryWage),
      employerBreakdown: [],
      employeeBreakdown: [],
      employerTotal: 0,
      employeeTotal: 0,
      monthlyTotal: 0,
      annualTotal: 0,
      currency: 'KWD',
      wageCap: PIFSS_WAGE_CAP,
      pendingVerification: false,
    };
  }

  // For Kuwaiti nationals
  if (nationality === 'kuwaiti') {
    const pensionEmployer = roundKWD(contributoryWage * KUWAITI_RATES.pensionEmployer);
    const pensionEmployee = roundKWD(contributoryWage * KUWAITI_RATES.pensionEmployee);

    const employerTotal = pensionEmployer;
    const employeeTotal = pensionEmployee;

    return {
      jurisdiction: 'KW',
      grossSalary: roundKWD(grossSalary),
      contributoryWage: roundKWD(contributoryWage),
      employerBreakdown: [
        { name: 'Pension & Disability/Death', rate: KUWAITI_RATES.pensionEmployer, amount: pensionEmployer },
      ],
      employeeBreakdown: [
        { name: 'Pension', rate: KUWAITI_RATES.pensionEmployee, amount: pensionEmployee },
      ],
      employerTotal,
      employeeTotal,
      monthlyTotal: roundKWD(employerTotal + employeeTotal),
      annualTotal: roundKWD((employerTotal + employeeTotal) * 12),
      currency: 'KWD',
      wageCap: PIFSS_WAGE_CAP,
      pendingVerification: true,
      pendingVerificationMessage:
        'Rate verification pending — consult your HR compliance officer. PIFSS rates and wage cap are subject to periodic regulatory review.',
    };
  }

  // For GCC nationals (pension-only per bilateral treaties)
  const pensionEmployer = roundKWD(contributoryWage * GCC_RATES.pensionEmployer);
  const pensionEmployee = roundKWD(contributoryWage * GCC_RATES.pensionEmployee);

  const employerTotal = pensionEmployer;
  const employeeTotal = pensionEmployee;

  return {
    jurisdiction: 'KW',
    grossSalary: roundKWD(grossSalary),
    contributoryWage: roundKWD(contributoryWage),
    employerBreakdown: [
      { name: 'Pension (Bilateral Treaty)', rate: GCC_RATES.pensionEmployer, amount: pensionEmployer },
    ],
    employeeBreakdown: [
      { name: 'Pension (Bilateral Treaty)', rate: GCC_RATES.pensionEmployee, amount: pensionEmployee },
    ],
    employerTotal,
    employeeTotal,
    monthlyTotal: roundKWD(employerTotal + employeeTotal),
    annualTotal: roundKWD((employerTotal + employeeTotal) * 12),
    currency: 'KWD',
    wageCap: PIFSS_WAGE_CAP,
    pendingVerification: true,
    pendingVerificationMessage:
      'Rate verification pending — GCC national rates vary by bilateral treaty. Consult your HR compliance officer.',
  };
}
