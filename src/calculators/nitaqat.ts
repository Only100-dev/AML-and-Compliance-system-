/**
 * KSA Nitaqat Calculator — Saudization Tier & Compliance
 *
 * Regulatory Framework:
 * The Nitaqat program, administered by the Saudi Ministry of Human Resources
 * and Social Development (MHRSD), classifies private-sector establishments
 * into color-coded tiers based on their Saudization percentage relative to
 * sector-specific thresholds.
 *
 * Tiers (best to worst): Platinum → Gold → Green → Yellow → Red
 *
 * Yellow and Red tiers incur escalating penalties including:
 * - Denial of new work permits / visa issuance
 * - Inability to renew existing Iqamas
 * - Restrictions on government contracts
 * - Financial penalties and potential closure
 *
 * PRINCIPLE A: FORMULA ACCURACY IS NON-NEGOTIABLE
 * PRINCIPLE C: SHARED COMPONENTS, COUNTRY-SPECIFIC LOGIC
 */

import type { NationalizationResult } from './types';

// ─── Input Type ───────────────────────────────────────────────────────────────
export interface NitaqatInput {
  totalEmployees: number;
  saudiEmployees: number;
  sector:
    | 'insurance'
    | 'banking'
    | 'retail'
    | 'construction'
    | 'manufacturing'
    | 'it'
    | 'general';
  companySize?: 'small' | 'medium' | 'large' | 'mega';
}

// ─── Sector Thresholds ────────────────────────────────────────────────────────
// Minimum Saudization % for each tier, per sector.
// Values reflect MHRSD updated thresholds as of 2024.
// Verify with SME — thresholds are subject to annual ministerial revisions.

const NITAQAT_THRESHOLDS: Record<
  NitaqatInput['sector'],
  { platinum: number; gold: number; green: number; yellow: number }
> = {
  insurance:      { platinum: 56, gold: 46, green: 32, yellow: 19 }, // Verify with SME
  banking:        { platinum: 60, gold: 50, green: 40, yellow: 28 }, // Verify with SME
  retail:         { platinum: 40, gold: 30, green: 20, yellow: 10 }, // Verify with SME
  construction:   { platinum: 30, gold: 22, green: 14, yellow: 6 },  // Verify with SME
  manufacturing:  { platinum: 35, gold: 25, green: 17, yellow: 9 },  // Verify with SME
  it:             { platinum: 50, gold: 40, green: 28, yellow: 16 }, // Verify with SME
  general:        { platinum: 45, gold: 35, green: 24, yellow: 12 }, // Verify with SME
};

// ─── Penalty Rules ────────────────────────────────────────────────────────────
// Yellow tier penalties
const YELLOW_PENALTIES = [
  'Cannot issue new work permits for non-Saudi workers',
  'Cannot transfer non-Saudi workers from other establishments',
  'Existing Iqamas may not be renewed beyond current expiry',
  'Restricted access to government services and contracts',
  'Subject to progressive financial penalties if tier persists',
];

// Red tier penalties (superset of Yellow)
const RED_PENALTIES = [
  ...YELLOW_PENALTIES,
  'All existing work permits will not be renewed',
  'Existing non-Saudi workers must be replaced with Saudis',
  'Establishment may be listed for potential closure',
  'Bank guarantees may be seized',
  'Complete ban on government procurement',
];

// ─── Helper: Determine Tier ──────────────────────────────────────────────────
function determineTier(
  percentage: number,
  thresholds: { platinum: number; gold: number; green: number; yellow: number }
): { tier: string; requiredPercentage: number } {
  if (percentage >= thresholds.platinum) {
    return { tier: 'Platinum', requiredPercentage: thresholds.platinum };
  }
  if (percentage >= thresholds.gold) {
    return { tier: 'Gold', requiredPercentage: thresholds.gold };
  }
  if (percentage >= thresholds.green) {
    return { tier: 'Green', requiredPercentage: thresholds.green };
  }
  if (percentage >= thresholds.yellow) {
    return { tier: 'Yellow', requiredPercentage: thresholds.yellow };
  }
  return { tier: 'Red', requiredPercentage: thresholds.yellow }; // yellow threshold is minimum for non-red
}

// ─── Helper: Calculate Gap to Next Tier ──────────────────────────────────────
function calculateGapToNext(
  percentage: number,
  totalEmployees: number,
  thresholds: { platinum: number; gold: number; green: number; yellow: number }
): { gapToNext: number; gapEmployees: number; nextTierName: string } {
  // Determine the next tier boundary above current percentage
  if (percentage >= thresholds.platinum) {
    // Already at the top
    return { gapToNext: 0, gapEmployees: 0, nextTierName: 'Platinum (max)' };
  }
  if (percentage >= thresholds.gold) {
    const gap = thresholds.platinum - percentage;
    return {
      gapToNext: Math.round(gap * 100) / 100,
      gapEmployees: Math.ceil((gap / 100) * totalEmployees),
      nextTierName: 'Platinum',
    };
  }
  if (percentage >= thresholds.green) {
    const gap = thresholds.gold - percentage;
    return {
      gapToNext: Math.round(gap * 100) / 100,
      gapEmployees: Math.ceil((gap / 100) * totalEmployees),
      nextTierName: 'Gold',
    };
  }
  if (percentage >= thresholds.yellow) {
    const gap = thresholds.green - percentage;
    return {
      gapToNext: Math.round(gap * 100) / 100,
      gapEmployees: Math.ceil((gap / 100) * totalEmployees),
      nextTierName: 'Green',
    };
  }
  // Below Yellow threshold → next is Yellow
  const gap = thresholds.yellow - percentage;
  return {
    gapToNext: Math.round(gap * 100) / 100,
    gapEmployees: Math.ceil((gap / 100) * totalEmployees),
    nextTierName: 'Yellow',
  };
}

// ─── Helper: Generate Recommendations ─────────────────────────────────────────
function generateRecommendations(
  percentage: number,
  saudiEmployees: number,
  totalEmployees: number,
  thresholds: { platinum: number; gold: number; green: number; yellow: number }
): string[] {
  const recs: string[] = [];

  if (totalEmployees === 0) {
    recs.push('Register employees in the GOSI/MHRSD system to begin Nitaqat tracking.');
    return recs;
  }

  if (percentage < thresholds.yellow) {
    recs.push(
      `URGENT: Hire at least ${Math.ceil(((thresholds.yellow - percentage) / 100) * totalEmployees)} Saudi national(s) to escape the Red tier.`
    );
    recs.push('Prioritize Saudi hiring for roles currently held by expatriate workers.');
    recs.push('Contact MHRSD for a remediation plan to avoid establishment closure.');
  } else if (percentage < thresholds.green) {
    recs.push(
      `Hire ${Math.ceil(((thresholds.green - percentage) / 100) * totalEmployees)} more Saudi national(s) to reach the Green tier.`
    );
    recs.push('Focus on entry-level and junior positions where Saudi talent is available.');
    recs.push('Consider on-the-job training programs to upskill Saudi hires.');
  } else if (percentage < thresholds.gold) {
    recs.push(
      `${Math.ceil(((thresholds.gold - percentage) / 100) * totalEmployees)} more Saudi hire(s) needed for Gold tier — unlocks premium MHRSD incentives.`
    );
    recs.push('Explore mid-level positions for Saudi professionals.');
  } else if (percentage < thresholds.platinum) {
    recs.push(
      `${Math.ceil(((thresholds.platinum - percentage) / 100) * totalEmployees)} more Saudi hire(s) for Platinum — highest priority for government contracts.`
    );
    recs.push('Target senior and specialized roles for Saudi talent development.');
  } else {
    recs.push('Excellent! Maintain current Saudization levels to retain Platinum status.');
    recs.push('Explore MHRSD reward programs available to Platinum-tier establishments.');
  }

  // Universal recommendations
  recs.push('Ensure all Saudi employees are registered with GOSI and MHRSD QIWA portal.');
  recs.push('Review Nitaqat classification quarterly — thresholds may change annually.');

  return recs;
}

// ─── Main Calculator ─────────────────────────────────────────────────────────
export function calculateNitaqat(input: NitaqatInput): NationalizationResult {
  const { totalEmployees, saudiEmployees, sector } = input;

  // Edge case: zero employees
  if (totalEmployees === 0) {
    return {
      jurisdiction: 'SA',
      currentPercentage: 0,
      requiredPercentage: NITAQAT_THRESHOLDS[sector].yellow,
      tier: 'Red',
      gapToNext: NITAQAT_THRESHOLDS[sector].yellow,
      gapEmployees: 0,
      complianceStatus: 'NON_COMPLIANT',
      penalties: RED_PENALTIES,
      recommendations: [
        'Register employees in the GOSI/MHRSD system to begin Nitaqat tracking.',
      ],
    };
  }

  // Saudization percentage
  const currentPercentage = Math.round((saudiEmployees / totalEmployees) * 10000) / 100;

  // Sector thresholds
  const thresholds = NITAQAT_THRESHOLDS[sector];

  // Determine tier
  const { tier, requiredPercentage } = determineTier(currentPercentage, thresholds);

  // Calculate gap to next tier
  const { gapToNext, gapEmployees } = calculateGapToNext(
    currentPercentage,
    totalEmployees,
    thresholds
  );

  // Compliance status
  let complianceStatus: NationalizationResult['complianceStatus'];
  if (currentPercentage >= thresholds.green) {
    complianceStatus = 'COMPLIANT';
  } else if (currentPercentage >= thresholds.yellow) {
    complianceStatus = 'AT_RISK';
  } else {
    complianceStatus = 'NON_COMPLIANT';
  }

  // Penalties
  const penalties =
    currentPercentage < thresholds.yellow
      ? RED_PENALTIES
      : currentPercentage < thresholds.green
        ? YELLOW_PENALTIES
        : [];

  // Recommendations
  const recommendations = generateRecommendations(
    currentPercentage,
    saudiEmployees,
    totalEmployees,
    thresholds
  );

  return {
    jurisdiction: 'SA',
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
