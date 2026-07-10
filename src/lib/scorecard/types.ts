/**
 * Phase 5: Audit Scorecard Type Definitions
 * PRINCIPLE B: Scoring is evidence-based. Gap rating (0-3) must have clear criteria.
 */

import type { GCCJurisdictionCode } from '@/lib/constants/jurisdictions';

// ─── The 9 Scorecard Themes ─────────────────────────────────────────────────

export interface ScorecardTheme {
  code: string;
  label: string;
  description: string;
  icon: string; // Lucide icon name
}

export const SCORECARD_THEMES: ScorecardTheme[] = [
  { code: 'employee-benefits', label: 'Employee Benefits', description: 'End-of-service benefits, gratuity, and leave entitlements', icon: 'Users' },
  { code: 'payroll-social-insurance', label: 'Payroll & Social Insurance', description: 'Wage protection, GOSI/SIO/GRSIA/PASI/PIFSS compliance', icon: 'Banknote' },
  { code: 'contracts-employment', label: 'Contracts & Employment', description: 'Employment contracts, probation, termination, and notice periods', icon: 'FileText' },
  { code: 'product-design', label: 'Product Design', description: 'Product governance, TCF, and distribution requirements', icon: 'Package' },
  { code: 'claims-handling', label: 'Claims Handling', description: 'Claims processing, SLA compliance, and fair settlement', icon: 'ClipboardCheck' },
  { code: 'financial-crime', label: 'Financial Crime (AML/CFT)', description: 'AML program, SAR filing, sanctions screening, and goAML compliance', icon: 'Shield' },
  { code: 'governance-risk', label: 'Governance & Risk', description: 'Board governance, risk management, and internal controls', icon: 'Building' },
  { code: 'data-protection', label: 'Data Protection', description: 'Data privacy, consent management, and cross-border transfers', icon: 'Lock' },
  { code: 'operational-resilience', label: 'Operational Resilience', description: 'BCP, DRP, ICT risk, and outsourcing governance', icon: 'Server' },
];

// ─── Gap Rating Criteria (0-3) ──────────────────────────────────────────────

export type GapRating = 0 | 1 | 2 | 3;

export const GAP_RATING_CRITERIA: Record<GapRating, {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  remediationDays: number;
}> = {
  0: { label: 'Compliant', description: 'No gaps identified. Full compliance with regulatory requirements.', color: 'text-emerald-700', bgColor: 'bg-emerald-50', remediationDays: 0 },
  1: { label: 'Minor Gap', description: 'Minor deviations. No material impact on compliance posture.', color: 'text-blue-700', bgColor: 'bg-blue-50', remediationDays: 180 },
  2: { label: 'Moderate Gap', description: 'Significant deviations requiring remediation within 90 days.', color: 'text-yellow-700', bgColor: 'bg-yellow-50', remediationDays: 90 },
  3: { label: 'Critical Gap', description: 'Material non-compliance. Immediate remediation required.', color: 'text-red-700', bgColor: 'bg-red-50', remediationDays: 0 }, // Immediate
};

// ─── Regulator Columns ──────────────────────────────────────────────────────

export interface RegulatorColumn {
  code: string;
  name: string;
  jurisdiction: GCCJurisdictionCode;
  color: string;
  bgColor: string;
}

export const REGULATOR_COLUMNS: RegulatorColumn[] = [
  { code: 'CBUAE', name: 'CBUAE', jurisdiction: 'AE', color: 'text-red-700', bgColor: 'bg-red-50' },
  { code: 'SAMA', name: 'SAMA', jurisdiction: 'SA', color: 'text-green-700', bgColor: 'bg-green-50' },
  { code: 'CBB', name: 'CBB', jurisdiction: 'BH', color: 'text-amber-700', bgColor: 'bg-amber-50' },
  { code: 'QCB', name: 'QCB', jurisdiction: 'QA', color: 'text-purple-700', bgColor: 'bg-purple-50' },
  { code: 'CBOA', name: 'CBOA', jurisdiction: 'OM', color: 'text-teal-700', bgColor: 'bg-teal-50' },
  { code: 'CBK', name: 'CBK', jurisdiction: 'KW', color: 'text-sky-700', bgColor: 'bg-sky-50' },
];

// ─── Combined Risk Algorithm ────────────────────────────────────────────────

export type CombinedRisk = 'Critical' | 'High' | 'Medium' | 'Low';

export interface ThemeRegulatorRating {
  regulator: string;
  jurisdiction: GCCJurisdictionCode;
  gapRating: GapRating;
  evidence?: string;
  lastAssessedAt?: string;
}

export interface AuditScorecardTheme {
  theme: ScorecardTheme;
  regulators: Record<string, ThemeRegulatorRating>;
  combinedRisk: CombinedRisk;
}

/**
 * Calculate combined risk across all regulators for a given theme.
 * 
 * Algorithm:
 * - If any regulator has rating 3 (Critical) OR average > 2.5 → 'Critical'
 * - If any regulator has rating 2 (Moderate) OR average > 1.5 → 'High'
 * - If any regulator has rating 1 (Minor) OR average > 0.5 → 'Medium'
 * - All regulators at 0 (Compliant) → 'Low'
 */
export function calculateCombinedRisk(regulators: Record<string, ThemeRegulatorRating>): CombinedRisk {
  const ratings = Object.values(regulators).map(r => r.gapRating);
  if (ratings.length === 0) return 'Low';

  const maxRating = Math.max(...ratings);
  const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;

  if (maxRating === 3 || avgRating > 2.5) return 'Critical';
  if (maxRating === 2 || avgRating > 1.5) return 'High';
  if (maxRating === 1 || avgRating > 0.5) return 'Medium';
  return 'Low';
}

export const COMBINED_RISK_CONFIG: Record<CombinedRisk, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  Critical: { label: 'Critical', color: 'text-red-700', bgColor: 'bg-red-100', borderColor: 'border-red-300' },
  High: { label: 'High', color: 'text-orange-700', bgColor: 'bg-orange-100', borderColor: 'border-orange-300' },
  Medium: { label: 'Medium', color: 'text-yellow-700', bgColor: 'bg-yellow-100', borderColor: 'border-yellow-300' },
  Low: { label: 'Low', color: 'text-emerald-700', bgColor: 'bg-emerald-100', borderColor: 'border-emerald-300' },
};
