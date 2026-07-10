/**
 * Phase 5: Gap Tracking Type Definitions
 * PRINCIPLE C: Remediation is accountable — every gap has an owner, due date, and status.
 * PRINCIPLE D: Cross-region intelligence (systemic gap detection, anonymized).
 */

import type { GCCJurisdictionCode } from '@/lib/constants/jurisdictions';

// ─── Gap Status State Machine ─────────────────────────────────────────────────
// Open → In_Progress → Awaiting_Approval → Closed
// Any status can transition to Escalated (auto-escalation on overdue)

export type GapStatus = 'Open' | 'In_Progress' | 'Awaiting_Approval' | 'Closed' | 'Escalated';
export type GapSeverity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Observation';
export type GapDetectedBy = 'system' | 'user' | 'audit' | 'regulatory_change';
export type GapTheme = 
  | 'employee-benefits'
  | 'payroll-social-insurance'
  | 'contracts-employment'
  | 'product-design'
  | 'claims-handling'
  | 'financial-crime'
  | 'governance-risk'
  | 'data-protection'
  | 'operational-resilience';

export const GAP_THEMES: { code: GapTheme; label: string }[] = [
  { code: 'employee-benefits', label: 'Employee Benefits' },
  { code: 'payroll-social-insurance', label: 'Payroll & Social Insurance' },
  { code: 'contracts-employment', label: 'Contracts & Employment' },
  { code: 'product-design', label: 'Product Design' },
  { code: 'claims-handling', label: 'Claims Handling' },
  { code: 'financial-crime', label: 'Financial Crime (AML/CFT)' },
  { code: 'governance-risk', label: 'Governance & Risk' },
  { code: 'data-protection', label: 'Data Protection' },
  { code: 'operational-resilience', label: 'Operational Resilience' },
];

export const GAP_SEVERITY_CONFIG: Record<GapSeverity, { 
  label: string; 
  color: string; 
  remediationDays: number;
  bgColor: string;
  borderColor: string;
}> = {
  Critical: { label: 'Critical', color: 'text-red-700', remediationDays: 7, bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  High: { label: 'High', color: 'text-orange-700', remediationDays: 30, bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
  Medium: { label: 'Medium', color: 'text-yellow-700', remediationDays: 90, bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
  Low: { label: 'Low', color: 'text-blue-700', remediationDays: 180, bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  Observation: { label: 'Observation', color: 'text-gray-700', remediationDays: 365, bgColor: 'bg-gray-50', borderColor: 'border-gray-200' },
};

export const GAP_STATUS_CONFIG: Record<GapStatus, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  Open: { label: 'Open', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  In_Progress: { label: 'In Progress', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  Awaiting_Approval: { label: 'Awaiting Approval', color: 'text-yellow-700', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
  Closed: { label: 'Closed', color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  Escalated: { label: 'Escalated', color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
};

export interface GapItem {
  id: string;
  jurisdictionId: string;
  controlId?: string;
  theme: GapTheme;
  title: string;
  description: string;
  severity: GapSeverity;
  status: GapStatus;
  detectedBy: GapDetectedBy;
  detectionTrigger?: string;
  ownerId?: string;
  ownerName?: string;
  ownerRole?: string;
  dueDate?: string;
  closedDate?: string;
  isSystemic: boolean;
  relatedGapIds?: string[];
  evidence?: unknown[];
  remediationNotes?: string;
  escalationLevel: number;
  createdAt: string;
  updatedAt: string;
}

export interface GapCreateInput {
  jurisdictionId: GCCJurisdictionCode;
  controlId?: string;
  theme: GapTheme;
  title: string;
  description: string;
  severity: GapSeverity;
  detectedBy?: GapDetectedBy;
  detectionTrigger?: Record<string, unknown>;
  ownerId?: string;
  ownerName?: string;
  ownerRole?: string;
}

export interface SystemicGapDetectionResult {
  isSystemic: boolean;
  relatedGapIds: string[];
  affectedJurisdictions: GCCJurisdictionCode[];
}
