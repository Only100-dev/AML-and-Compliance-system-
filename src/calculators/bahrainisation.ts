/**
 * Bahrainisation Calculator — Bahrain Nationalization Quota Compliance
 *
 * Regulatory Framework:
 * The Labour Market Regulatory Authority (LMRA) enforces Bahrainisation
 * quotas under Bahrain Labour Law (Law No. 36 of 2012) and LMRA
 * regulations. Private-sector establishments in designated sectors must
 * employ a minimum percentage of Bahraini nationals.
 *
 * Key Sectors & Minimum Quotas:
 * - Insurance: 20% — Verify with SME
 * - Banking:   32% — Verify with SME
 * - Retail:    15% — Verify with SME
 * - General:   10% — Verify with SME
 *
 * Non-compliance penalties (administered by LMRA):
 * - Work permit restrictions (no new permits, non-renewal)
 * - Financial penalties per non-compliant position
 * - Potential license suspension for repeated violations
 * - Increased fees for expatriate worker permits
 *
 * PRINCIPLE A: FORMULA ACCURACY IS NON-NEGOTIABLE
 * PRINCIPLE C: SHARED COMPONENTS, COUNTRY-SPECIFIC LOGIC
 */

import type { NationalizationResult } from './types';

// ─── Input Type ───────────────────────────────────────────────────────────────
export interface BahrainisationInput {
  totalEmployees: number;
  bahrainiEmployees: number;
  sector: 'insurance' | 'banking' | 'retail' | 'construction' | 'manufacturing' | 'general';
}

// ─── Sector Thresholds ────────────────────────────────────────────────────────
// Minimum Bahrainisation % required per sector — Verify with SME
const BAHRAINIISATION_THRESHOLDS: Record<
  BahrainisationInput['sector'],
  number
> = {
  insurance:      20, // Verify with SME
  banking:        32, // Verify with SME
  retail:         15, // Verify with SME
  construction:   10, // Verify with SME
  manufacturing:  10, // Verify with SME
  general:        10, // Verify with SME
};

// ─── Penalty Tiers ────────────────────────────────────────────────────────────
// LMRA uses a graduated penalty system. Below are descriptions.
const AT_RISK_PENALTIES = [
  'LMRA may restrict issuance of new expatriate work permits',
  'Expat permit renewal requires proof of Bahrainisation improvement plan',
  'Elevated expatriate worker levy applies',
];

const NON_COMPLIANT_PENALTIES = [
  'All new expatriate work permits denied',
  'Existing expatriate permits will not be renewed upon expiry',
  'Financial penalty per non-Bahraini position above the quota',
  'Establishment may face license suspension for repeated non-compliance',
  'Mandatory appearance before LMRA compliance review board',
];

// ─── Main Calculator ─────────────────────────────────────────────────────────
export function calculateBahrainisation(
  input: BahrainisationInput
): NationalizationResult {
  const { totalEmployees, bahrainiEmployees, sector } = input;

  // Edge case: zero employees
  if (totalEmployees === 0) {
    return {
      jurisdiction: 'BH',
      currentPercentage: 0,
      requiredPercentage: BAHRAINIISATION_THRESHOLDS[sector],
      tier: 'Non-Compliant',
      gapToNext: BAHRAINIISATION_THRESHOLDS[sector],
      gapEmployees: 0,
      complianceStatus: 'NON_COMPLIANT',
      penalties: NON_COMPLIANT_PENALTIES,
      recommendations: [
        'Register employees with LMRA to begin Bahrainisation tracking.',
      ],
    };
  }

  // Bahrainisation percentage
  const currentPercentage =
    Math.round((bahrainiEmployees / totalEmployees) * 10000) / 100;

  const requiredPercentage = BAHRAINIISATION_THRESHOLDS[sector];

  // Gap calculation
  const gapToNext = Math.max(
    0,
    Math.round((requiredPercentage - currentPercentage) * 100) / 100
  );
  const gapEmployees = Math.ceil(
    Math.max(0, requiredPercentage - currentPercentage) / 100 * totalEmployees
  );

  // Compliance status & tier
  let complianceStatus: NationalizationResult['complianceStatus'];
  let tier: string;

  if (currentPercentage >= requiredPercentage + 5) {
    complianceStatus = 'COMPLIANT';
    tier = 'Exemplary';
  } else if (currentPercentage >= requiredPercentage) {
    complianceStatus = 'COMPLIANT';
    tier = 'Compliant';
  } else if (currentPercentage >= requiredPercentage * 0.75) {
    complianceStatus = 'AT_RISK';
    tier = 'Below Quota';
  } else {
    complianceStatus = 'NON_COMPLIANT';
    tier = 'Non-Compliant';
  }

  // Penalties
  const penalties =
    complianceStatus === 'NON_COMPLIANT'
      ? NON_COMPLIANT_PENALTIES
      : complianceStatus === 'AT_RISK'
        ? AT_RISK_PENALTIES
        : [];

  // Recommendations
  const recommendations = generateBahrainRecommendations(
    currentPercentage,
    requiredPercentage,
    gapEmployees,
    sector
  );

  return {
    jurisdiction: 'BH',
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

// ─── Recommendation Generator ─────────────────────────────────────────────────
function generateBahrainRecommendations(
  current: number,
  required: number,
  gapEmployees: number,
  sector: string
): string[] {
  const recs: string[] = [];

  if (current < required * 0.75) {
    recs.push(
      `URGENT: Hire at least ${gapEmployees} Bahraini national(s) to approach the ${required}% ${sector} sector quota.`
    );
    recs.push('Contact LMRA for a structured Bahrainisation improvement plan.');
    recs.push('Consider partnering with Bahrain Polytechnic or UOB for graduate recruitment.');
  } else if (current < required) {
    recs.push(
      `Hire ${gapEmployees} more Bahraini national(s) to meet the ${required}% ${sector} sector quota.`
    );
    recs.push('Focus on positions that can be filled through the Tamkeen employment program.');
    recs.push('Review job descriptions to ensure they are not unnecessarily excluding Bahraini applicants.');
  } else if (current < required + 5) {
    recs.push(
      'You meet the minimum quota but have limited buffer. Continue Bahraini hiring to build a safety margin.'
    );
    recs.push('Consider succession planning for key roles with Bahraini talent.');
  } else {
    recs.push('Excellent! Bahrainisation levels exceed the minimum by a comfortable margin.');
    recs.push('Explore Tamkeen wage subsidy programs for additional Bahraini hires.');
  }

  recs.push('Ensure all Bahraini employees are registered with SIO and LMRA.');
  recs.push('Monitor LMRA portal for quota updates — sector thresholds may change periodically.');

  return recs;
}
