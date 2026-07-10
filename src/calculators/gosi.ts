/**
 * KSA GOSI Contribution Calculator — Social Insurance & Occupational Hazards
 *
 * Regulatory Framework:
 * The General Organization for Social Insurance (GOSI) administers mandatory
 * social insurance for private-sector employees in Saudi Arabia under the
 * Social Insurance Law (Royal Decree M/33).
 *
 * Contribution Categories for Saudi Nationals:
 * 1. Pension (Annuities):     9% employer / 9% employee
 * 2. Occupational Hazards:    2% employer / 0% employee
 * 3. SANED (Unemployment):    1% employer / 1% employee
 *
 * GCC Nationals:
 * Typically contribute to Pension only at bilateral agreement rates.
 * Subject to individual GCC social insurance treaties — Verify with SME.
 *
 * Non-GCC Expatriates:
 * Exempt from GOSI contributions entirely (employer covers occupational
 * hazard insurance through separate commercial policies).
 *
 * Wage Cap: 45,000 SAR/month — Verify with SME
 * Contributory wage = Basic Salary + Housing Allowance, capped at wage cap.
 *
 * PRINCIPLE A: FORMULA ACCURACY IS NON-NEGOTIABLE
 * PRINCIPLE C: SHARED COMPONENTS, COUNTRY-SPECIFIC LOGIC
 */

import type { ContributionResult } from './types';

// ─── Input Type ───────────────────────────────────────────────────────────────
export interface GOSIInput {
  basicSalary: number;
  housingAllowance: number;
  nationality: 'saudi' | 'gcc' | 'expat';
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Maximum monthly contributory wage in SAR — Verify with SME
const GOSI_WAGE_CAP = 45000; // Verify with SME

// Saudi national contribution rates — Verify with SME
const SAUDI_RATES = {
  pensionEmployer: 0.09,         // 9% — Verify with SME
  pensionEmployee: 0.09,         // 9% — Verify with SME
  occupationalHazardEmployer: 0.02, // 2% — Verify with SME
  sanedEmployer: 0.01,           // 1% — Verify with SME
  sanedEmployee: 0.01,           // 1% — Verify with SME
} as const;

// GCC national contribution rates (pension-only per bilateral treaties)
// Verify with SME — rates differ by bilateral agreement
const GCC_RATES = {
  pensionEmployer: 0.09,  // 9% — Verify with SME
  pensionEmployee: 0.09,  // 9% — Verify with SME
} as const;

// ─── Rounding Utility ────────────────────────────────────────────────────────
// SAR uses 0 decimal places (rounded to nearest whole Riyal)
function roundSAR(value: number): number {
  return Math.round(value);
}

// ─── Main Calculator ─────────────────────────────────────────────────────────
export function calculateGOSI(input: GOSIInput): ContributionResult {
  const { basicSalary, housingAllowance, nationality } = input;

  // Calculate gross salary
  const grossSalary = basicSalary + housingAllowance;

  // Calculate contributory wage (capped)
  const contributoryWage = Math.min(grossSalary, GOSI_WAGE_CAP);

  // For expats: no GOSI contributions
  if (nationality === 'expat') {
    return {
      jurisdiction: 'SA',
      grossSalary: roundSAR(grossSalary),
      contributoryWage: roundSAR(contributoryWage),
      employerBreakdown: [],
      employeeBreakdown: [],
      employerTotal: 0,
      employeeTotal: 0,
      monthlyTotal: 0,
      annualTotal: 0,
      currency: 'SAR',
      wageCap: GOSI_WAGE_CAP,
      pendingVerification: false,
    };
  }

  // For Saudi nationals
  if (nationality === 'saudi') {
    const pensionEmployer = roundSAR(contributoryWage * SAUDI_RATES.pensionEmployer);
    const pensionEmployee = roundSAR(contributoryWage * SAUDI_RATES.pensionEmployee);
    const occupationalHazard = roundSAR(contributoryWage * SAUDI_RATES.occupationalHazardEmployer);
    const sanedEmployer = roundSAR(contributoryWage * SAUDI_RATES.sanedEmployer);
    const sanedEmployee = roundSAR(contributoryWage * SAUDI_RATES.sanedEmployee);

    const employerTotal = pensionEmployer + occupationalHazard + sanedEmployer;
    const employeeTotal = pensionEmployee + sanedEmployee;

    return {
      jurisdiction: 'SA',
      grossSalary: roundSAR(grossSalary),
      contributoryWage: roundSAR(contributoryWage),
      employerBreakdown: [
        { name: 'Pension (Annuities)', rate: SAUDI_RATES.pensionEmployer, amount: pensionEmployer },
        { name: 'Occupational Hazards', rate: SAUDI_RATES.occupationalHazardEmployer, amount: occupationalHazard },
        { name: 'SANED (Unemployment)', rate: SAUDI_RATES.sanedEmployer, amount: sanedEmployer },
      ],
      employeeBreakdown: [
        { name: 'Pension (Annuities)', rate: SAUDI_RATES.pensionEmployee, amount: pensionEmployee },
        { name: 'SANED (Unemployment)', rate: SAUDI_RATES.sanedEmployee, amount: sanedEmployee },
      ],
      employerTotal,
      employeeTotal,
      monthlyTotal: employerTotal + employeeTotal,
      annualTotal: (employerTotal + employeeTotal) * 12,
      currency: 'SAR',
      wageCap: GOSI_WAGE_CAP,
      pendingVerification: true,
      pendingVerificationMessage:
        'Rate verification pending — consult your HR compliance officer. GOSI rates and wage cap are subject to annual ministerial review.',
    };
  }

  // For GCC nationals (pension-only per bilateral treaties)
  const pensionEmployer = roundSAR(contributoryWage * GCC_RATES.pensionEmployer);
  const pensionEmployee = roundSAR(contributoryWage * GCC_RATES.pensionEmployee);

  const employerTotal = pensionEmployer;
  const employeeTotal = pensionEmployee;

  return {
    jurisdiction: 'SA',
    grossSalary: roundSAR(grossSalary),
    contributoryWage: roundSAR(contributoryWage),
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
    currency: 'SAR',
    wageCap: GOSI_WAGE_CAP,
    pendingVerification: true,
    pendingVerificationMessage:
      'Rate verification pending — GCC national rates vary by bilateral treaty. Consult your HR compliance officer.',
  };
}
