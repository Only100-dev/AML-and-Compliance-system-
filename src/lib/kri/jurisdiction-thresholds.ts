/**
 * Phase 5: Jurisdiction-Specific KRI Thresholds
 * 
 * PRINCIPLE B: Scoring is evidence-based. Every threshold is backed by
 * regulatory requirements. Unknown targets are marked with // Verify with SME.
 * 
 * Each KRI has:
 * - target: The desired value (green)
 * - warning: Below target but not critical (yellow)
 * - critical: Requires immediate attention (red)
 * - unit: Measurement unit
 */

import type { GCCJurisdictionCode } from '@/lib/constants/jurisdictions';

export interface KRIThreshold {
  jurisdiction: GCCJurisdictionCode;
  metric: string;
  label: string;
  target: number;
  warning: number;
  critical: number;
  unit: string;
  category: string;
  description: string;
  source?: string; // Regulatory source
}

export const KRI_THRESHOLDS: KRIThreshold[] = [
  // ─── UAE (CBUAE) ──────────────────────────────────────────────────────────
  { jurisdiction: 'AE', metric: 'emiratisation_rate', label: 'Emiratisation Rate', target: 4, warning: 3, critical: 2, unit: '%', category: 'employment', description: 'Minimum UAE national employment rate per CBUAE mandate', source: 'CBUAE Circular' },
  { jurisdiction: 'AE', metric: 'sar_filing_timeliness', label: 'SAR Filing Timeliness', target: 100, warning: 90, critical: 80, unit: '%', category: 'aml', description: 'Percentage of SARs filed within 30 calendar days of detection', source: 'FDL 10/2025' },
  { jurisdiction: 'AE', metric: 'training_completion_rate', label: 'Training Completion Rate', target: 100, warning: 85, critical: 70, unit: '%', category: 'governance', description: 'AML/CFT training completion rate for all staff', source: 'Cabinet Decision 10/2019' },
  { jurisdiction: 'AE', metric: 'complaint_resolution_sla', label: 'Complaint Resolution SLA', target: 95, warning: 85, critical: 75, unit: '%', category: 'operations', description: 'Complaints resolved within CBUAE SLA timeframe', source: 'CBUAE Consumer Protection' },
  
  // ─── KSA (SAMA) ───────────────────────────────────────────────────────────
  { jurisdiction: 'SA', metric: 'nitaqat_tier', label: 'Nitaqat Tier', target: 1, warning: 2, critical: 3, unit: 'tier', category: 'employment', description: 'Nitaqat program tier (1=Platinum, 2=Gold, 3=Silver)', source: 'MHRSD Nitaqat', // Verify with SME: exact tier mapping
  },
  { jurisdiction: 'SA', metric: 'sar_filing_timeliness', label: 'SAR Filing Timeliness', target: 100, warning: 90, critical: 80, unit: '%', category: 'aml', description: 'Percentage of SARs filed within SAMA deadline', source: 'SAMA AML Rules' },
  { jurisdiction: 'SA', metric: 'saudization_rate', label: 'Saudization Rate', target: 30, warning: 25, critical: 20, unit: '%', category: 'employment', description: 'Saudi national employment rate per Nitaqat', // Verify with SME: specific sector target
  },
  
  // ─── Bahrain (CBB) ────────────────────────────────────────────────────────
  { jurisdiction: 'BH', metric: 'bahrainisation_rate', label: 'Bahrainisation Rate', target: 20, warning: 18, critical: 15, unit: '%', category: 'employment', description: 'Minimum Bahraini employment rate per LMRA/CBB', source: 'LMRA Regulations' },
  { jurisdiction: 'BH', metric: 'sar_filing_timeliness', label: 'SAR Filing Timeliness', target: 100, warning: 90, critical: 80, unit: '%', category: 'aml', description: 'Percentage of SARs filed within 5 business days', source: 'CBB AML Handbook' },
  { jurisdiction: 'BH', metric: 'cpr_compliance_rate', label: 'CPR Compliance Rate', target: 100, warning: 95, critical: 90, unit: '%', category: 'kyc', description: 'Employee CPR (9-digit Bahraini ID) validation compliance', source: 'CBB Volume 3' },
  
  // ─── Qatar (QCB) ──────────────────────────────────────────────────────────
  { jurisdiction: 'QA', metric: 'qatarization_rate', label: 'Qatarization Rate', target: 15, warning: 12, critical: 10, unit: '%', category: 'employment', description: 'Qatari national employment rate', // Verify with SME: specific target
  },
  { jurisdiction: 'QA', metric: 'sar_filing_timeliness', label: 'SAR Filing Timeliness', target: 100, warning: 90, critical: 80, unit: '%', category: 'aml', description: 'Percentage of SARs filed within QCB deadline', source: 'QCB AML Regulations' },
  { jurisdiction: 'QA', metric: 'qid_compliance_rate', label: 'QID Compliance Rate', target: 100, warning: 95, critical: 90, unit: '%', category: 'kyc', description: 'Qatari ID (11-digit) validation compliance', source: 'QCB KYC Rules' },
  
  // ─── Oman (CBOA) ──────────────────────────────────────────────────────────
  { jurisdiction: 'OM', metric: 'omanization_rate', label: 'Omanization Rate', target: 60, warning: 55, critical: 50, unit: '%', category: 'employment', description: 'Minimum Omani employment rate per CBOA/MoL', source: 'Oman Labour Law' },
  { jurisdiction: 'OM', metric: 'sar_filing_timeliness', label: 'SAR Filing Timeliness', target: 100, warning: 90, critical: 80, unit: '%', category: 'aml', description: 'Percentage of SARs filed within CBOA deadline', source: 'CBOA AML Regulations' },
  { jurisdiction: 'OM', metric: 'civil_id_compliance_rate', label: 'Civil ID Compliance Rate', target: 100, warning: 95, critical: 90, unit: '%', category: 'kyc', description: 'Omani Civil ID (8-digit) validation compliance', source: 'CBOA KYC Rules' },
  
  // ─── Kuwait (CBK) ─────────────────────────────────────────────────────────
  { jurisdiction: 'KW', metric: 'kuwaitization_rate', label: 'Kuwaitization Rate', target: 10, warning: 8, critical: 5, unit: '%', category: 'employment', description: 'Kuwaiti national employment rate', // Verify with SME: specific target
  },
  { jurisdiction: 'KW', metric: 'sar_filing_timeliness', label: 'SAR Filing Timeliness', target: 100, warning: 90, critical: 80, unit: '%', category: 'aml', description: 'Percentage of SARs filed within CBK deadline', source: 'CBK AML Regulations' },
  { jurisdiction: 'KW', metric: 'civil_id_compliance_rate', label: 'Civil ID Compliance Rate', target: 100, warning: 95, critical: 90, unit: '%', category: 'kyc', description: 'Kuwaiti Civil ID (12-digit) validation compliance', source: 'CBK KYC Rules' },
  
  // ─── Shared AML Metrics (all 6 jurisdictions) ─────────────────────────────
  { jurisdiction: 'AE', metric: 'sanctions_screening_rate', label: 'Sanctions Screening Rate', target: 100, warning: 99, critical: 95, unit: '%', category: 'aml', description: 'Percentage of transactions screened against sanctions lists', source: 'FATF Rec 7' },
  { jurisdiction: 'SA', metric: 'sanctions_screening_rate', label: 'Sanctions Screening Rate', target: 100, warning: 99, critical: 95, unit: '%', category: 'aml', description: 'Percentage of transactions screened against sanctions lists', source: 'FATF Rec 7' },
  { jurisdiction: 'BH', metric: 'sanctions_screening_rate', label: 'Sanctions Screening Rate', target: 100, warning: 99, critical: 95, unit: '%', category: 'aml', description: 'Percentage of transactions screened against sanctions lists', source: 'FATF Rec 7' },
  { jurisdiction: 'QA', metric: 'sanctions_screening_rate', label: 'Sanctions Screening Rate', target: 100, warning: 99, critical: 95, unit: '%', category: 'aml', description: 'Percentage of transactions screened against sanctions lists', source: 'FATF Rec 7' },
  { jurisdiction: 'OM', metric: 'sanctions_screening_rate', label: 'Sanctions Screening Rate', target: 100, warning: 99, critical: 95, unit: '%', category: 'aml', description: 'Percentage of transactions screened against sanctions lists', source: 'FATF Rec 7' },
  { jurisdiction: 'KW', metric: 'sanctions_screening_rate', label: 'Sanctions Screening Rate', target: 100, warning: 99, critical: 95, unit: '%', category: 'aml', description: 'Percentage of transactions screened against sanctions lists', source: 'FATF Rec 7' },
  
  { jurisdiction: 'AE', metric: 'false_positive_rate', label: 'Sanctions False Positive Rate', target: 5, warning: 10, critical: 20, unit: '%', category: 'aml', description: 'False positive rate for sanctions screening (lower is better)', source: 'Industry Benchmark' },
  { jurisdiction: 'SA', metric: 'false_positive_rate', label: 'Sanctions False Positive Rate', target: 5, warning: 10, critical: 20, unit: '%', category: 'aml', description: 'False positive rate for sanctions screening (lower is better)', source: 'Industry Benchmark' },
  { jurisdiction: 'BH', metric: 'false_positive_rate', label: 'Sanctions False Positive Rate', target: 5, warning: 10, critical: 20, unit: '%', category: 'aml', description: 'False positive rate for sanctions screening (lower is better)', source: 'Industry Benchmark' },
  { jurisdiction: 'QA', metric: 'false_positive_rate', label: 'Sanctions False Positive Rate', target: 5, warning: 10, critical: 20, unit: '%', category: 'aml', description: 'False positive rate for sanctions screening (lower is better)', source: 'Industry Benchmark' },
  { jurisdiction: 'OM', metric: 'false_positive_rate', label: 'Sanctions False Positive Rate', target: 5, warning: 10, critical: 20, unit: '%', category: 'aml', description: 'False positive rate for sanctions screening (lower is better)', source: 'Industry Benchmark' },
  { jurisdiction: 'KW', metric: 'false_positive_rate', label: 'Sanctions False Positive Rate', target: 5, warning: 10, critical: 20, unit: '%', category: 'aml', description: 'False positive rate for sanctions screening (lower is better)', source: 'Industry Benchmark' },
];

/**
 * Get KRI thresholds for a specific jurisdiction.
 */
export function getKRIThresholdsForJurisdiction(jurisdictionId: GCCJurisdictionCode): KRIThreshold[] {
  return KRI_THRESHOLDS.filter(t => t.jurisdiction === jurisdictionId);
}

/**
 * Evaluate a KRI value against its thresholds.
 * Returns the status: 'compliant' | 'warning' | 'critical'
 * 
 * For metrics where LOWER is better (e.g., false_positive_rate),
 * the comparison is inverted.
 */
export function evaluateKRI(
  metric: string,
  value: number,
  jurisdictionId: GCCJurisdictionCode
): 'compliant' | 'warning' | 'critical' | 'unknown' {
  const threshold = KRI_THRESHOLDS.find(
    t => t.metric === metric && t.jurisdiction === jurisdictionId
  );

  if (!threshold) return 'unknown';

  // Determine direction: for rates like emiratisation, higher is better.
  // For false positive rates, lower is better.
  // Heuristic: if target > critical, higher is better; otherwise lower is better.
  const higherIsBetter = threshold.target > threshold.critical;

  if (higherIsBetter) {
    if (value >= threshold.target) return 'compliant';
    if (value >= threshold.warning) return 'warning';
    return 'critical';
  } else {
    // Lower is better (e.g., false positive rate)
    if (value <= threshold.target) return 'compliant';
    if (value <= threshold.warning) return 'warning';
    return 'critical';
  }
}
