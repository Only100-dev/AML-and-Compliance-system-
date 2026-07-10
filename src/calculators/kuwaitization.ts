/**
 * Kuwaitization Calculator — Kuwait Nationalization Quota Compliance
 *
 * Regulatory Framework:
 * Kuwait's Public Authority for Manpower (PAM) enforces Kuwaitization
 * quotas under the Labour Law No. 6 of 2010 and subsequent ministerial
 * decrees. Kuwait has some of the most aggressive nationalization targets
 * in the GCC, particularly in the private sector.
 *
 * Sector Targets:
 * - Banking:       60% — Verify with SME
 * - Insurance:     40% — Verify with SME
 * - Government:    90%+ (not applicable to private-sector tool)
 * - Oil & Gas:     50% — Verify with SME
 * - Private Sector:  5-10% (varies by activity) — Verify with SME
 * - General:       10% — Verify with SME
 *
 * Non-compliance penalties:
 * - Transfer restrictions for expatriate workers
 * - Non-renewal of expatriate work permits
 * - Administrative fines
 * - Business license restrictions
 * - Mandatory Kuwaitization plans
 *
 * PRINCIPLE A: FORMULA ACCURACY IS NON-NEGOTIABLE
 * PRINCIPLE C: SHARED COMPONENTS, COUNTRY-SPECIFIC LOGIC
 */

import type { NationalizationResult } from './types';

// ─── Input Type ───────────────────────────────────────────────────────────────
export interface KuwaitizationInput {
  totalEmployees: number;
  kuwaitiEmployees: number;
  sector:
    | 'banking'
    | 'insurance'
    | 'oil_gas'
    | 'manufacturing'
    | 'construction'
    | 'general';
}

// ─── Sector Thresholds ────────────────────────────────────────────────────────
// Minimum Kuwaitization % required per sector — Verify with SME
const KUWAITIZATION_THRESHOLDS: Record<
  KuwaitizationInput['sector'],
  number
> = {
  banking:        60, // Verify with SME
  insurance:      40, // Verify with SME
  oil_gas:        50, // Verify with SME
  manufacturing:  10, // Verify with SME
  construction:    5, // Verify with SME
  general:        10, // Verify with SME
};

// ─── Penalty Descriptions ─────────────────────────────────────────────────────
const AT_RISK_PENALTIES = [
  'PAM may restrict transfer of expatriate workers to this establishment',
  'New expatriate work permits require additional justification',
  'Increased PAM inspection and compliance audit frequency',
];

const NON_COMPLIANT_PENALTIES = [
  'Transfer of expatriate workers to this establishment is blocked',
  'No new expatriate work permits will be issued',
  'Existing expatriate work permits will not be renewed upon expiry',
  'Administrative fines per non-Kuwaiti position exceeding quota',
  'Business license renewal may be restricted',
  'Mandatory Kuwaitization plan must be submitted to PAM',
];

// ─── Main Calculator ─────────────────────────────────────────────────────────
export function calculateKuwaitization(
  input: KuwaitizationInput
): NationalizationResult {
  const { totalEmployees, kuwaitiEmployees, sector } = input;

  // Edge case: zero employees
  if (totalEmployees === 0) {
    return {
      jurisdiction: 'KW',
      currentPercentage: 0,
      requiredPercentage: KUWAITIZATION_THRESHOLDS[sector],
      tier: 'Non-Compliant',
      gapToNext: KUWAITIZATION_THRESHOLDS[sector],
      gapEmployees: 0,
      complianceStatus: 'NON_COMPLIANT',
      penalties: NON_COMPLIANT_PENALTIES,
      recommendations: [
        'Register employees with PAM to begin Kuwaitization tracking.',
      ],
    };
  }

  // Kuwaitization percentage
  const currentPercentage =
    Math.round((kuwaitiEmployees / totalEmployees) * 10000) / 100;

  const requiredPercentage = KUWAITIZATION_THRESHOLDS[sector];

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
  const recommendations = generateKuwaitRecommendations(
    currentPercentage,
    requiredPercentage,
    gapEmployees,
    sector
  );

  return {
    jurisdiction: 'KW',
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
function generateKuwaitRecommendations(
  current: number,
  required: number,
  gapEmployees: number,
  sector: string
): string[] {
  const recs: string[] = [];

  if (current < required * 0.75) {
    recs.push(
      `URGENT: Hire at least ${gapEmployees} Kuwaiti national(s) to approach the ${required}% ${sector} sector target.`
    );
    recs.push('Contact PAM for a Kuwaitization improvement plan.');
    recs.push('Partner with Kuwait University and PAAET for talent pipelines.');
  } else if (current < required) {
    recs.push(
      `Hire ${gapEmployees} more Kuwaiti national(s) to meet the ${required}% ${sector} sector target.`
    );
    recs.push('Utilize the Kuwait Manpower and Government Reconstitution Programme.');
    recs.push('Consider subsidized employment programs through PAM for Kuwaiti hires.');
  } else if (current < required + 5) {
    recs.push(
      'You meet the minimum target but have limited buffer. Continue Kuwaiti hiring for safety margin.'
    );
    recs.push('Develop career progression paths for Kuwaiti nationals toward leadership roles.');
  } else {
    recs.push('Excellent! Kuwaitization levels comfortably exceed the minimum target.');
    recs.push('Explore PAM recognition programs for high-Kuwaitization employers.');
  }

  recs.push('Ensure all Kuwaiti employees are registered with PIFSS and PAM.');
  recs.push('Monitor PAM announcements for annual target revisions — sector thresholds may change.');

  return recs;
}
