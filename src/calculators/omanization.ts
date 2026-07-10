/**
 * Omanization Calculator — Oman Nationalization Quota Compliance
 *
 * Regulatory Framework:
 * Oman's Ministry of Labour (MoL) enforces Omanization quotas under
 * the Labour Law (Royal Decree 35/2003, as amended by Royal Decree
 * 53/2023). The MoL sets sector-specific minimum percentages of Omani
 * nationals that private-sector employers must maintain.
 *
 * Omanization targets are notably high compared to other GCC states:
 * - Banking:      95% — Verify with SME (historically the highest in GCC)
 * - Insurance:    60% — Verify with SME
 * - Public Sector: 90%+ (not applicable to private-sector tool)
 * - Manufacturing: 35% — Verify with SME
 * - Construction:  25% — Verify with SME
 * - General:       15% — Verify with SME
 *
 * Non-compliance penalties:
 * - Denial of expatriate work permit issuance and renewal
 * - Administrative fines per non-compliant position
 * - Suspension of commercial license (extreme cases)
 * - Restrictions on government tenders
 * - Mandatory Omanization improvement plan
 *
 * PRINCIPLE A: FORMULA ACCURACY IS NON-NEGOTIABLE
 * PRINCIPLE C: SHARED COMPONENTS, COUNTRY-SPECIFIC LOGIC
 */

import type { NationalizationResult } from './types';

// ─── Input Type ───────────────────────────────────────────────────────────────
export interface OmanizationInput {
  totalEmployees: number;
  omaniEmployees: number;
  sector:
    | 'banking'
    | 'insurance'
    | 'manufacturing'
    | 'construction'
    | 'oil_gas'
    | 'retail'
    | 'general';
}

// ─── Sector Thresholds ────────────────────────────────────────────────────────
// Minimum Omanization % required per sector — Verify with SME
const OMANIZATION_THRESHOLDS: Record<
  OmanizationInput['sector'],
  number
> = {
  banking:        95, // Verify with SME
  insurance:      60, // Verify with SME
  manufacturing:  35, // Verify with SME
  construction:   25, // Verify with SME
  oil_gas:        30, // Verify with SME
  retail:         20, // Verify with SME
  general:        15, // Verify with SME
};

// ─── Penalty Descriptions ─────────────────────────────────────────────────────
const AT_RISK_PENALTIES = [
  'MoL may restrict issuance of new expatriate work permits',
  'Existing expatriate permits face non-renewal risk',
  'Subject to increased MoL inspection frequency',
];

const NON_COMPLIANT_PENALTIES = [
  'All new expatriate work permits denied',
  'Existing expatriate work permits will not be renewed upon expiry',
  'Administrative fines per non-Omani position exceeding quota',
  'Ineligible for government tenders and procurement',
  'Mandatory Omanization remediation plan submitted to MoL',
  'Potential commercial license suspension for persistent non-compliance',
];

// ─── Main Calculator ─────────────────────────────────────────────────────────
export function calculateOmanization(
  input: OmanizationInput
): NationalizationResult {
  const { totalEmployees, omaniEmployees, sector } = input;

  // Edge case: zero employees
  if (totalEmployees === 0) {
    return {
      jurisdiction: 'OM',
      currentPercentage: 0,
      requiredPercentage: OMANIZATION_THRESHOLDS[sector],
      tier: 'Non-Compliant',
      gapToNext: OMANIZATION_THRESHOLDS[sector],
      gapEmployees: 0,
      complianceStatus: 'NON_COMPLIANT',
      penalties: NON_COMPLIANT_PENALTIES,
      recommendations: [
        'Register employees with MoL to begin Omanization tracking.',
      ],
    };
  }

  // Omanization percentage
  const currentPercentage =
    Math.round((omaniEmployees / totalEmployees) * 10000) / 100;

  const requiredPercentage = OMANIZATION_THRESHOLDS[sector];

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
  } else if (currentPercentage >= requiredPercentage * 0.8) {
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
  const recommendations = generateOmanRecommendations(
    currentPercentage,
    requiredPercentage,
    gapEmployees,
    sector
  );

  return {
    jurisdiction: 'OM',
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
function generateOmanRecommendations(
  current: number,
  required: number,
  gapEmployees: number,
  sector: string
): string[] {
  const recs: string[] = [];

  if (current < required * 0.8) {
    recs.push(
      `URGENT: Hire at least ${gapEmployees} Omani national(s) to approach the ${required}% ${sector} sector quota.`
    );
    recs.push('Contact MoL immediately for an Omanization improvement plan.');
    recs.push('Partner with Sultan Qaboos University and Omani colleges for graduate recruitment.');
  } else if (current < required) {
    recs.push(
      `Hire ${gapEmployees} more Omani national(s) to meet the ${required}% ${sector} sector quota.`
    );
    recs.push('Utilize the National Youth Programme and SANAD initiative for Omani talent.');
    recs.push('Review job descriptions to remove unnecessary barriers for Omani applicants.');
  } else if (current < required + 5) {
    recs.push(
      'You meet the minimum quota but have limited buffer. Continue Omani hiring for safety margin.'
    );
    recs.push('Develop training and career development paths for Omani employees in senior roles.');
  } else {
    recs.push('Excellent! Omanization levels comfortably exceed the minimum quota.');
    recs.push('Explore MoL incentive programs and recognition for high-Omanization employers.');
  }

  recs.push('Ensure all Omani employees are registered with PASI and MoL.');
  recs.push('Monitor MoL announcements for annual quota revisions — sector thresholds may change.');

  return recs;
}
