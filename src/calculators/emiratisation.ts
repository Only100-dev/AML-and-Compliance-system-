/**
 * UAE Emiratisation Calculator — Nafis/MOHRE Compliance
 *
 * Regulatory Framework:
 * The Emiratisation program, administered by the UAE Ministry of Human Resources
 * and Emiratisation (MOHRE) and supported by the Nafis program, mandates
 * minimum UAE national employment percentages in the private sector.
 *
 * Sector-specific thresholds are determined by company size:
 * - Small (<50 employees):  lower thresholds
 * - Medium (50–200 employees): moderate thresholds
 * - Large (>200 employees):  highest thresholds
 *
 * Non-compliance penalties include:
 * - Financial penalties per missing Emirati employee (AED)
 * - Downgrading of company classification by MOHRE
 * - Restrictions on new work permits and visa issuance
 * - Potential suspension from government procurement
 *
 * Nafis Program:
 * The UAE government's Nafis initiative provides financial incentives and
 * training support to accelerate Emirati employment in the private sector,
 * complementing MOHRE's regulatory compliance framework.
 *
 * PRINCIPLE A: FORMULA ACCURACY IS NON-NEGOTIABLE
 * PRINCIPLE C: SHARED COMPONENTS, COUNTRY-SPECIFIC LOGIC
 */

import type { NationalizationResult } from './types';

// ─── Input Type ───────────────────────────────────────────────────────────────
export interface EmiratisationInput {
  totalEmployees: number;
  emiratiEmployees: number;
  sector: 'insurance' | 'banking' | 'general';
  companySize: 'small' | 'medium' | 'large';
}

// ─── Sector Thresholds by Company Size ────────────────────────────────────────
// Minimum Emiratisation % per sector and company size.
// Values reflect MOHRE/Nafis updated thresholds.
// Verify with SME — thresholds are subject to annual ministerial revisions.

const EMIRATISATION_THRESHOLDS: Record<
  EmiratisationInput['sector'],
  Record<EmiratisationInput['companySize'], number>
> = {
  insurance: { small: 4, medium: 6, large: 10 },  // Verify with SME
  banking:   { small: 4, medium: 8, large: 12 },  // Verify with SME
  general:   { small: 2, medium: 4, large: 8 },   // Verify with SME
};

// ─── Penalty Rules ────────────────────────────────────────────────────────────
// AT_RISK penalties (approaching non-compliance)
const AT_RISK_PENALTIES = [
  'Financial penalties may apply if Emiratisation targets are not met by deadline',
  'Company classification may be downgraded by MOHRE',
  'Restricted access to certain MOHRE incentive programs',
  'Subject to increased MOHRE audit frequency',
];

// NON_COMPLIANT penalties (below required threshold)
const NON_COMPLIANT_PENALTIES = [
  ...AT_RISK_PENALTIES,
  'Financial penalties per missing Emirati employee (AED 6,000–20,000/month)',
  'Inability to issue new work permits for expatriate workers',
  'Existing work permits may not be renewed',
  'Suspension from government procurement contracts',
  'Company classification downgraded to lowest tier by MOHRE',
  'Potential referral to UAE Public Prosecution for repeated violations',
];

// ─── Helper: Determine Compliance Tier ────────────────────────────────────────
function determineComplianceTier(
  percentage: number,
  requiredPercentage: number
): { tier: string; complianceStatus: NationalizationResult['complianceStatus'] } {
  if (percentage >= requiredPercentage) {
    return { tier: 'Compliant', complianceStatus: 'COMPLIANT' };
  }
  // Within 50% of required threshold is AT_RISK
  if (percentage >= requiredPercentage * 0.5) {
    return { tier: 'At Risk', complianceStatus: 'AT_RISK' };
  }
  return { tier: 'Non-Compliant', complianceStatus: 'NON_COMPLIANT' };
}

// ─── Helper: Calculate Gap to Compliance ──────────────────────────────────────
function calculateGapToCompliance(
  percentage: number,
  requiredPercentage: number,
  totalEmployees: number
): { gapToNext: number; gapEmployees: number; nextTierName: string } {
  if (percentage >= requiredPercentage) {
    return { gapToNext: 0, gapEmployees: 0, nextTierName: 'Compliant (target met)' };
  }

  const gap = requiredPercentage - percentage;
  return {
    gapToNext: Math.round(gap * 100) / 100,
    gapEmployees: Math.ceil((gap / 100) * totalEmployees),
    nextTierName: 'Compliant',
  };
}

// ─── Helper: Generate Recommendations ─────────────────────────────────────────
function generateRecommendations(
  percentage: number,
  emiratiEmployees: number,
  totalEmployees: number,
  requiredPercentage: number,
  sector: EmiratisationInput['sector']
): string[] {
  const recs: string[] = [];

  if (totalEmployees === 0) {
    recs.push('Register employees with MOHRE to begin Emiratisation tracking.');
    return recs;
  }

  const gapEmployees = Math.ceil(((requiredPercentage - percentage) / 100) * totalEmployees);

  if (percentage < requiredPercentage * 0.5) {
    recs.push(
      `URGENT: Hire at least ${gapEmployees} Emirati national(s) to reach the minimum ${requiredPercentage}% threshold.`
    );
    recs.push('Prioritize Emirati hiring for roles currently held by expatriate workers.');
    recs.push('Contact MOHRE for a remediation plan to avoid escalating financial penalties.');
    recs.push('Leverage the Nafis program for candidate sourcing and wage subsidies.');
  } else if (percentage < requiredPercentage) {
    recs.push(
      `Hire ${gapEmployees} more Emirati national(s) to achieve compliance at ${requiredPercentage}%.`
    );
    recs.push('Focus on entry-level and junior positions where Emirati talent is available.');
    recs.push('Consider on-the-job training programs to upskill Emirati hires.');
    recs.push('Utilize Nafis training programs to develop Emirati candidates for specialized roles.');
  } else {
    recs.push('Excellent! Maintain current Emiratisation levels to retain compliance status.');
    recs.push('Explore Nafis incentive programs available to compliant private-sector employers.');
    recs.push('Consider exceeding minimum targets to strengthen MOHRE classification.');
  }

  // Sector-specific recommendations
  if (sector === 'banking') {
    recs.push('Banking sector has the highest Emiratisation targets — partner with UAE university finance programs.');
  } else if (sector === 'insurance') {
    recs.push('Insurance sector targets are elevated — engage with Insurance Authority Emiratisation initiatives.');
  }

  // Universal recommendations
  recs.push('Ensure all Emirati employees are registered with GPSSA and MOHRE labor registry.');
  recs.push('Review Emiratisation thresholds quarterly — MOHRE may increase targets annually under Nafis.');
  recs.push('Monitor Nafis program updates for new financial incentives and support schemes.');

  return recs;
}

// ─── Main Calculator ─────────────────────────────────────────────────────────
export function calculateEmiratisation(input: EmiratisationInput): NationalizationResult {
  const { totalEmployees, emiratiEmployees, sector, companySize } = input;

  // Get required percentage for sector and company size
  const requiredPercentage = EMIRATISATION_THRESHOLDS[sector][companySize];

  // Edge case: zero employees
  if (totalEmployees === 0) {
    return {
      jurisdiction: 'AE',
      currentPercentage: 0,
      requiredPercentage,
      tier: 'Non-Compliant',
      gapToNext: requiredPercentage,
      gapEmployees: 0,
      complianceStatus: 'NON_COMPLIANT',
      penalties: NON_COMPLIANT_PENALTIES,
      recommendations: [
        'Register employees with MOHRE to begin Emiratisation tracking.',
      ],
    };
  }

  // Emiratisation percentage
  const currentPercentage = Math.round((emiratiEmployees / totalEmployees) * 10000) / 100;

  // Determine compliance tier
  const { tier, complianceStatus } = determineComplianceTier(currentPercentage, requiredPercentage);

  // Calculate gap to compliance
  const { gapToNext, gapEmployees } = calculateGapToCompliance(
    currentPercentage,
    requiredPercentage,
    totalEmployees
  );

  // Penalties
  const penalties =
    complianceStatus === 'NON_COMPLIANT'
      ? NON_COMPLIANT_PENALTIES
      : complianceStatus === 'AT_RISK'
        ? AT_RISK_PENALTIES
        : [];

  // Recommendations
  const recommendations = generateRecommendations(
    currentPercentage,
    emiratiEmployees,
    totalEmployees,
    requiredPercentage,
    sector
  );

  return {
    jurisdiction: 'AE',
    currentPercentage,
    requiredPercentage,
    tier,
    gapToNext,
    gapEmployees,
    complianceStatus,
    penalties,
    recommendations,
  };
}
