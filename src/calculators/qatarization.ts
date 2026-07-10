/**
 * Qatarization Calculator — Qatar Nationalization Quota Compliance
 *
 * Regulatory Framework:
 * Qatar's Ministry of Labour (MOL) enforces Qatarization targets under
 * Labour Law No. 14 of 2004 and subsequent ministerial decrees.
 * Qatarization focuses on increasing Qatari national participation in
 * the private sector, particularly in key industries.
 *
 * Sector Targets:
 * - Banking & Finance:   30% — Verify with SME
 * - Insurance:           25% — Verify with SME
 * - Oil & Gas:           20% — Verify with SME
 * - Government Entities: 50% — Verify with SME
 * - General Private:     10% — Verify with SME
 *
 * Non-compliance penalties:
 * - Restrictions on new work permits
 * - Increased expatriate worker fees
 * - Potential denial of government contract eligibility
 * - Administrative fines
 *
 * PRINCIPLE A: FORMULA ACCURACY IS NON-NEGOTIABLE
 * PRINCIPLE C: SHARED COMPONENTS, COUNTRY-SPECIFIC LOGIC
 */

import type { NationalizationResult } from './types';

// ─── Input Type ───────────────────────────────────────────────────────────────
export interface QatarizationInput {
  totalEmployees: number;
  qatariEmployees: number;
  sector:
    | 'banking'
    | 'insurance'
    | 'oil_gas'
    | 'government'
    | 'construction'
    | 'general';
}

// ─── Sector Thresholds ────────────────────────────────────────────────────────
// Minimum Qatarization % required per sector — Verify with SME
const QATARIZATION_THRESHOLDS: Record<
  QatarizationInput['sector'],
  number
> = {
  banking:       30, // Verify with SME
  insurance:     25, // Verify with SME
  oil_gas:       20, // Verify with SME
  government:    50, // Verify with SME
  construction:  10, // Verify with SME
  general:       10, // Verify with SME
};

// ─── Penalty Descriptions ─────────────────────────────────────────────────────
const AT_RISK_PENALTIES = [
  'MOL may restrict issuance of new expatriate work permits',
  'Higher levies on expatriate worker permits',
  'Subject to increased compliance audit frequency',
];

const NON_COMPLIANT_PENALTIES = [
  'All new expatriate work permits denied until Qatarization target is met',
  'Existing work permits may not be renewed',
  'Administrative fines per non-compliant position per month',
  'Ineligible for government contracts and procurement',
  'Mandatory remediation plan required by MOL',
];

// ─── Main Calculator ─────────────────────────────────────────────────────────
export function calculateQatarization(
  input: QatarizationInput
): NationalizationResult {
  const { totalEmployees, qatariEmployees, sector } = input;

  // Edge case: zero employees
  if (totalEmployees === 0) {
    return {
      jurisdiction: 'QA',
      currentPercentage: 0,
      requiredPercentage: QATARIZATION_THRESHOLDS[sector],
      tier: 'Non-Compliant',
      gapToNext: QATARIZATION_THRESHOLDS[sector],
      gapEmployees: 0,
      complianceStatus: 'NON_COMPLIANT',
      penalties: NON_COMPLIANT_PENALTIES,
      recommendations: [
        'Register employees with MOL to begin Qatarization tracking.',
      ],
    };
  }

  // Qatarization percentage
  const currentPercentage =
    Math.round((qatariEmployees / totalEmployees) * 10000) / 100;

  const requiredPercentage = QATARIZATION_THRESHOLDS[sector];

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
    tier = 'Below Target';
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
  const recommendations = generateQatarRecommendations(
    currentPercentage,
    requiredPercentage,
    gapEmployees,
    sector
  );

  return {
    jurisdiction: 'QA',
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
function generateQatarRecommendations(
  current: number,
  required: number,
  gapEmployees: number,
  sector: string
): string[] {
  const recs: string[] = [];

  if (current < required * 0.75) {
    recs.push(
      `URGENT: Hire at least ${gapEmployees} Qatari national(s) to approach the ${required}% ${sector} sector target.`
    );
    recs.push('Contact MOL for a Qatarization improvement plan.');
    recs.push('Partner with Qatar University and Hamad Bin Khalifa University for talent pipelines.');
  } else if (current < required) {
    recs.push(
      `Hire ${gapEmployees} more Qatari national(s) to meet the ${required}% ${sector} sector target.`
    );
    recs.push('Utilize Qatar Career Fair and Qatar Development Bank programs for recruitment.');
    recs.push('Consider creating internship-to-hire pipelines for Qatari graduates.');
  } else if (current < required + 5) {
    recs.push(
      'You meet the minimum target but have limited buffer. Continue Qatari hiring for safety margin.'
    );
    recs.push('Develop succession plans with Qatari nationals for leadership roles.');
  } else {
    recs.push('Excellent! Qatarization levels comfortably exceed the minimum target.');
    recs.push('Explore MOL incentive programs for high-performing employers.');
  }

  recs.push('Ensure all Qatari employees are registered with GRSIA and MOL.');
  recs.push('Monitor MOL announcements for target revisions — sector thresholds may change.');

  return recs;
}
