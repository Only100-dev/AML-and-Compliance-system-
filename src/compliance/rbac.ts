/**
 * IC-OS RBAC Enforcement Middleware
 * Phase 1 Regulatory Critical Enhancement
 *
 * Role-Based Access Control with a comprehensive permission matrix
 * enforcing least-privilege principles per FDL 10/2025 Art. 15
 * (Internal Controls) and CBUAE Notice 3551/2021 S3.1 (Governance).
 *
 * Key features:
 *   - Comprehensive PERMISSIONS matrix defining what each role can do
 *   - checkPermission(role, permission) — boolean check
 *   - requirePermission(role, permission) — throws on denial
 *   - getRolePermissions(role) — returns all permissions for a role
 *   - withRBAC handler wrapper for API routes
 *   - Maker-Checker flagged permissions requiring dual approval
 */

import { z } from 'zod';
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ─── Role Definition ────────────────────────────────────────────────────────────

/**
 * Compliance role types aligned with IC-OS organisational structure.
 *
 * Role hierarchy (highest to lowest privilege):
 *   admin > mlro > compliance_manager > compliance_officer > dept_head > board
 *
 * Note: 'board' role has restricted operational access but full
 * dashboard/analytics visibility per governance requirements.
 */
export type ComplianceRole =
  | 'admin'
  | 'mlro'
  | 'compliance_manager'
  | 'compliance_officer'
  | 'dept_head'
  | 'board';

export const COMPLIANCE_ROLES: ComplianceRole[] = [
  'admin',
  'mlro',
  'compliance_manager',
  'compliance_officer',
  'dept_head',
  'board',
];

// ─── Permission Definition ──────────────────────────────────────────────────────

export type Permission =
  | 'canFileSAR'
  | 'canApproveAlert'
  | 'canEscalateToMLRO'
  | 'canScreenSanctions'
  | 'canApproveKYC'
  | 'canSubmitGoAML'
  | 'canApprovePolicy'
  | 'canViewBoardDashboard'
  | 'canManageUsers'
  | 'canGenerateAuditPack'
  | 'canOverrideSanctions'
  | 'canSubmitCBUAEReport'
  | 'canViewSARCase'
  | 'canCreateComplianceCase'
  | 'canReviewKYC'
  | 'canManageTraining'
  | 'canViewAuditLog'
  | 'canManagePolicies'
  | 'canViewRiskAssessment'
  | 'canManageVendorDD'
  | 'canAccessAIAssistant'
  | 'canExportData'
  | 'canManageRemediation'
  | 'canViewRegulatoryTracker'
  | 'canCreateCalendarEvent'
  | 'canManageNotifications'
  // Phase C: DMLRO, TFS, Audit, PII permissions
  | 'canDelegateAsDMLRO'
  | 'canActAsDMLRO'
  | 'canFreezeTFS'
  | 'canConfirmTFSFreeze'
  | 'canUnfreezeTFS'
  | 'canViewTFSActions'
  | 'canAccessAuditorTimeTravel'
  | 'canRequestDataExportFromTimeTravel'
  | 'canRevealPII'
  // Phase D: Insurance-Specific AML permissions
  | 'canManageProductRiskScores'
  | 'canManageSoWSoF'
  | 'canApproveSoWSoF'
  | 'canManagePremiumFinancing'
  | 'canApprovePremiumFinancing'
  | 'canManageBrokerKYC'
  | 'canApproveBrokerKYC'
  | 'canManageEarlySurrender'
  | 'canReviewMLRFlag'
  // Phase E: Board Portal, Rule Tuning, QA, Dept Head, CAP, SLA permissions
  | 'canAccessBoardPortal'
  | 'canAcknowledgeBoardDocument'
  | 'canManageRuleTuningProposals'
  | 'canApproveRuleTuningProposals'
  | 'canManageQASampling'
  | 'canReviewQAFindings'
  | 'canManageDeptHeadInbox'
  | 'canAcknowledgeCircular'
  | 'canManageCAPKanban'
  | 'canAuditVerifyCAP'
  | 'canManageComplaints'
  | 'canEscalateToOmbudsman'
  | 'canManageSLAConfig'
  // ── v7.3.0: Unified My Tasks inbox ──
  | 'canViewUnifiedTasks'
  // ── Phase F: Regulatory Circular Ingestion Engine ──
  | 'canManageIngestionSources'
  | 'canUploadCirculars'
  | 'canViewCirculars';

export interface PermissionRule {
  permission: Permission;
  description: string;
  regulatoryRef: string;
  roles: ComplianceRole[];
  /** Whether this permission requires Maker-Checker dual approval */
  requiresMakerChecker: boolean;
  /** Category for UI grouping */
  category: 'aml' | 'kyc' | 'sanctions' | 'governance' | 'reporting' | 'administration' | 'general';
}

// ─── Comprehensive Permissions Matrix ───────────────────────────────────────────

/**
 * Master permission matrix defining what each role can do.
 * Each entry specifies the allowed roles, regulatory reference,
 * and whether Maker-Checker dual approval is required.
 */
export const PERMISSIONS: Record<Permission, PermissionRule> = {
  canFileSAR: {
    permission: 'canFileSAR',
    description: 'File a Suspicious Activity Report (SAR) with the FIU via goAML',
    regulatoryRef: 'FDL 10/2025 Art. 8; CR 134/2025 Art. 10-11',
    roles: ['mlro', 'admin'],
    requiresMakerChecker: true,
    category: 'aml',
  },
  canApproveAlert: {
    permission: 'canApproveAlert',
    description: 'Approve or reject an AML alert after triage/investigation',
    regulatoryRef: 'FDL 10/2025 Art. 13-14; CBUAE Notice 3551/2021 S3.2',
    roles: ['mlro', 'compliance_manager', 'admin'],
    requiresMakerChecker: false,
    category: 'aml',
  },
  canEscalateToMLRO: {
    permission: 'canEscalateToMLRO',
    description: 'Escalate an alert, case, or finding to the MLRO for review',
    regulatoryRef: 'FDL 10/2025 Art. 13-14; CR 134/2025 Art. 18',
    roles: ['compliance_officer', 'compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'aml',
  },
  canScreenSanctions: {
    permission: 'canScreenSanctions',
    description: 'Initiate and review sanctions screening against UAE and UN lists',
    regulatoryRef: 'FDL 10/2025 Art. 18; CR 134/2025 Art. 25-26',
    roles: ['compliance_officer', 'compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'sanctions',
  },
  canApproveKYC: {
    permission: 'canApproveKYC',
    description: 'Approve or reject a KYC record (individual, corporate, or VASP)',
    regulatoryRef: 'FDL 10/2025 Art. 7, 9; CR 134/2025 Art. 5-9',
    roles: ['compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: true,
    category: 'kyc',
  },
  canSubmitGoAML: {
    permission: 'canSubmitGoAML',
    description: 'Submit a goAML filing (STR, SAR, CTR, IFT, PNMR) to the FIU',
    regulatoryRef: 'FDL 10/2025 Art. 8; CR 134/2025 Art. 10-11',
    roles: ['mlro', 'admin'],
    requiresMakerChecker: true,
    category: 'reporting',
  },
  canApprovePolicy: {
    permission: 'canApprovePolicy',
    description: 'Approve or reject a compliance policy or SOP document',
    regulatoryRef: 'FDL 10/2025 Art. 15; CR 134/2025 Art. 20',
    roles: ['compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'governance',
  },
  canViewBoardDashboard: {
    permission: 'canViewBoardDashboard',
    description: 'Access the Board-level compliance dashboard with aggregated metrics',
    regulatoryRef: 'CBUAE Notice 3551/2021 S3.1',
    roles: ['board', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'governance',
  },
  canManageUsers: {
    permission: 'canManageUsers',
    description: 'Create, modify, or deactivate user accounts and role assignments',
    regulatoryRef: 'FDL 10/2025 Art. 15; CBUAE Notice 3551/2021 S3.1',
    roles: ['admin'],
    requiresMakerChecker: true,
    category: 'administration',
  },
  canGenerateAuditPack: {
    permission: 'canGenerateAuditPack',
    description: 'Generate and export audit documentation packs for regulatory examination',
    regulatoryRef: 'FDL 10/2025 Art. 11, 15; CR 134/2025 Art. 16, 21',
    roles: ['compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'reporting',
  },
  canOverrideSanctions: {
    permission: 'canOverrideSanctions',
    description: 'Override a sanctions screening match or create a sanctions exception',
    regulatoryRef: 'FDL 10/2025 Art. 18; CR 134/2025 Art. 25-27',
    roles: ['mlro', 'admin'],
    requiresMakerChecker: true,
    category: 'sanctions',
  },
  canSubmitCBUAEReport: {
    permission: 'canSubmitCBUAEReport',
    description: 'Submit quarterly or ad-hoc regulatory reports to CBUAE',
    regulatoryRef: 'CBUAE Notice 3551/2021; FDL 10/2025 Art. 21',
    roles: ['mlro', 'admin'],
    requiresMakerChecker: true,
    category: 'reporting',
  },
  canViewSARCase: {
    permission: 'canViewSARCase',
    description: 'View SAR case details including subject information and narrative',
    regulatoryRef: 'FDL 10/2025 Art. 12; CR 134/2025 Art. 17',
    roles: ['mlro', 'compliance_manager', 'compliance_officer', 'admin'],
    requiresMakerChecker: false,
    category: 'aml',
  },
  canCreateComplianceCase: {
    permission: 'canCreateComplianceCase',
    description: 'Create a new unified compliance case linking alerts, KYC, SARs, and sanctions',
    regulatoryRef: 'FDL 10/2025 Art. 13-15',
    roles: ['compliance_officer', 'compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'aml',
  },
  canReviewKYC: {
    permission: 'canReviewKYC',
    description: 'Review and update KYC records (initiate CDD/EDD reviews)',
    regulatoryRef: 'FDL 10/2025 Art. 7, 9, 10; CR 134/2025 Art. 5-9, 15',
    roles: ['compliance_officer', 'compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'kyc',
  },
  canManageTraining: {
    permission: 'canManageTraining',
    description: 'Manage AML/CFT training courses, enrollments, and certifications',
    regulatoryRef: 'FDL 10/2025 Art. 15; CBUAE Notice 3551/2021 S9.1',
    roles: ['compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'governance',
  },
  canViewAuditLog: {
    permission: 'canViewAuditLog',
    description: 'View the immutable audit trail and verify audit entry integrity',
    regulatoryRef: 'FDL 10/2025 Art. 11, 15; CR 134/2025 Art. 16, 21',
    roles: ['compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'administration',
  },
  canManagePolicies: {
    permission: 'canManagePolicies',
    description: 'Create, edit, and manage compliance policies and SOPs',
    regulatoryRef: 'FDL 10/2025 Art. 15; CR 134/2025 Art. 20',
    roles: ['compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'governance',
  },
  canViewRiskAssessment: {
    permission: 'canViewRiskAssessment',
    description: 'View enterprise-wide risk assessments and risk matrices',
    regulatoryRef: 'FDL 10/2025 Art. 16-17; CR 134/2025 Art. 22-24',
    roles: ['compliance_officer', 'compliance_manager', 'mlro', 'admin', 'board'],
    requiresMakerChecker: false,
    category: 'governance',
  },
  canManageVendorDD: {
    permission: 'canManageVendorDD',
    description: 'Manage vendor and third-party due diligence per outsourcing requirements',
    regulatoryRef: 'CR 134/2025 Art. 20; CBUAE Notice 3551/2021 S3.1',
    roles: ['compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'governance',
  },
  canAccessAIAssistant: {
    permission: 'canAccessAIAssistant',
    description: 'Access the backend AI compliance assistant for queries and analysis',
    regulatoryRef: 'Internal policy; FDL 10/2025 Art. 15',
    roles: ['compliance_officer', 'compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'general',
  },
  canExportData: {
    permission: 'canExportData',
    description: 'Export compliance data, reports, and audit packs from the system',
    regulatoryRef: 'FDL 10/2025 Art. 11, 15; CR 134/2025 Art. 16',
    roles: ['compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'administration',
  },
  canManageRemediation: {
    permission: 'canManageRemediation',
    description: 'Create, assign, and track remediation actions from audit findings',
    regulatoryRef: 'FDL 10/2025 Art. 15; CR 134/2025 Art. 21',
    roles: ['compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'governance',
  },
  canViewRegulatoryTracker: {
    permission: 'canViewRegulatoryTracker',
    description: 'View the CBUAE regulatory circular tracker and gap analysis',
    regulatoryRef: 'CBUAE Notice 3551/2021; FDL 10/2025 Art. 15',
    roles: ['compliance_officer', 'compliance_manager', 'mlro', 'admin', 'dept_head', 'board'],
    requiresMakerChecker: false,
    category: 'general',
  },
  canCreateCalendarEvent: {
    permission: 'canCreateCalendarEvent',
    description: 'Create and manage compliance calendar events and deadlines',
    regulatoryRef: 'FDL 10/2025 Art. 15; CBUAE Notice 3551/2021 S3.1',
    roles: ['compliance_officer', 'compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'general',
  },
  canManageNotifications: {
    permission: 'canManageNotifications',
    description: 'Configure notification rules and escalation thresholds',
    regulatoryRef: 'FDL 10/2025 Art. 13-14; CBUAE Notice 3551/2021 S3.2',
    roles: ['compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'administration',
  },
  // ─── Phase C: DMLRO, TFS, Audit, PII Permissions ─────────────────────────────
  canDelegateAsDMLRO: {
    permission: 'canDelegateAsDMLRO',
    description: 'MLRO can activate DMLRO delegation to a compliance manager',
    regulatoryRef: 'FDL 10/2025 Art. 13-14; CBUAE Notice 3551/2021 S3.1',
    roles: ['mlro', 'admin'],
    requiresMakerChecker: true,
    category: 'governance',
  },
  canActAsDMLRO: {
    permission: 'canActAsDMLRO',
    description: 'Compliance manager can act as DMLRO when delegated by MLRO',
    regulatoryRef: 'FDL 10/2025 Art. 13-14; CBUAE Notice 3551/2021 S3.1',
    roles: ['compliance_manager', 'admin'],
    requiresMakerChecker: false,
    category: 'governance',
  },
  canFreezeTFS: {
    permission: 'canFreezeTFS',
    description: 'Create TFS asset freeze actions on sanctions list matches',
    regulatoryRef: 'UAE Cabinet Resolution No. 18/2021; FDL 10/2025 Art. 18',
    roles: ['compliance_officer', 'compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'sanctions',
  },
  canConfirmTFSFreeze: {
    permission: 'canConfirmTFSFreeze',
    description: 'Confirm a TFS asset freeze action (MLRO maker-checker)',
    regulatoryRef: 'UAE Cabinet Resolution No. 18/2021; FDL 10/2025 Art. 18',
    roles: ['mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'sanctions',
  },
  canUnfreezeTFS: {
    permission: 'canUnfreezeTFS',
    description: 'Request TFS asset unfreeze with proper authority documentation',
    regulatoryRef: 'UAE Cabinet Resolution No. 18/2021; FDL 10/2025 Art. 18',
    roles: ['mlro', 'admin'],
    requiresMakerChecker: true,
    category: 'sanctions',
  },
  canViewTFSActions: {
    permission: 'canViewTFSActions',
    description: 'View TFS asset freeze/unfreeze actions and generate FIU reports',
    regulatoryRef: 'UAE Cabinet Resolution No. 18/2021; FDL 10/2025 Art. 18',
    roles: ['compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'sanctions',
  },
  canAccessAuditorTimeTravel: {
    permission: 'canAccessAuditorTimeTravel',
    description: 'Access auditor time-travel point-in-time state reconstruction',
    regulatoryRef: 'FDL 10/2025 Art. 11, 15; CR 134/2025 Art. 16, 21',
    roles: ['mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'administration',
  },
  canRequestDataExportFromTimeTravel: {
    permission: 'canRequestDataExportFromTimeTravel',
    description: 'Request data export from auditor time-travel (requires MLRO approval)',
    regulatoryRef: 'FDL 10/2025 Art. 11, 15; CR 134/2025 Art. 16, 21',
    roles: ['mlro', 'admin'],
    requiresMakerChecker: true,
    category: 'administration',
  },
  canRevealPII: {
    permission: 'canRevealPII',
    description: 'Reveal PII fields (click-to-reveal) with mandatory audit trail',
    regulatoryRef: 'CBUAE Notice 3551/2021; FDL 10/2025 Art. 12',
    roles: ['compliance_officer', 'compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'administration',
  },
  // ─── Phase D: Insurance-Specific AML Permissions ────────────────────────────────
  canManageProductRiskScores: {
    permission: 'canManageProductRiskScores',
    description: 'Manage product risk scores per CBUAE Insurance AML Guidelines',
    regulatoryRef: 'CBUAE Insurance AML Guidelines; FDL 10/2025 Art. 16-17',
    roles: ['compliance_officer', 'compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'aml',
  },
  canManageSoWSoF: {
    permission: 'canManageSoWSoF',
    description: 'Manage Source of Wealth / Source of Funds records for high-risk products',
    regulatoryRef: 'CBUAE Insurance AML Guidelines; FDL 10/2025 Art. 7, 9',
    roles: ['compliance_officer', 'compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'aml',
  },
  canApproveSoWSoF: {
    permission: 'canApproveSoWSoF',
    description: 'Approve Source of Wealth / Source of Funds for high-risk products (Maker-Checker)',
    regulatoryRef: 'CBUAE Insurance AML Guidelines; FDL 10/2025 Art. 7, 9, 15',
    roles: ['compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: true,
    category: 'aml',
  },
  canManagePremiumFinancing: {
    permission: 'canManagePremiumFinancing',
    description: 'Manage premium financing records per CBUAE Insurance AML Guidelines',
    regulatoryRef: 'CBUAE Insurance AML Guidelines; FDL 10/2025 Art. 16-17',
    roles: ['compliance_officer', 'compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'aml',
  },
  canApprovePremiumFinancing: {
    permission: 'canApprovePremiumFinancing',
    description: 'Approve flagged premium financing records (Maker-Checker)',
    regulatoryRef: 'CBUAE Insurance AML Guidelines; FDL 10/2025 Art. 15',
    roles: ['compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: true,
    category: 'aml',
  },
  canManageBrokerKYC: {
    permission: 'canManageBrokerKYC',
    description: 'Manage broker KYC records per CBUAE Insurance Board Resolution No. 4 of 2022',
    regulatoryRef: 'CBUAE Insurance Board Resolution No. 4/2022; FDL 10/2025 Art. 7, 9',
    roles: ['compliance_officer', 'compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'kyc',
  },
  canApproveBrokerKYC: {
    permission: 'canApproveBrokerKYC',
    description: 'Approve broker KYC records (Maker-Checker)',
    regulatoryRef: 'CBUAE Insurance Board Resolution No. 4/2022; FDL 10/2025 Art. 7, 9, 15',
    roles: ['compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: true,
    category: 'kyc',
  },
  canManageEarlySurrender: {
    permission: 'canManageEarlySurrender',
    description: 'Manage early surrender records with auto-MLR flagging',
    regulatoryRef: 'CBUAE Insurance AML Guidelines; FDL 10/2025 Art. 13-14',
    roles: ['compliance_officer', 'compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'aml',
  },
  canReviewMLRFlag: {
    permission: 'canReviewMLRFlag',
    description: 'Review and resolve High MLR flags (MLRO/admin only, 4-eyes principle)',
    regulatoryRef: 'CBUAE Insurance AML Guidelines; FDL 10/2025 Art. 13-14, 15',
    roles: ['mlro', 'admin'],
    requiresMakerChecker: true,
    category: 'aml',
  },
  // ─── Phase E: Board Portal, Rule Tuning, QA, Dept Head, CAP, SLA Permissions ────
  canAccessBoardPortal: {
    permission: 'canAccessBoardPortal',
    description: 'Access the Board Portal for document management and critical escalations',
    regulatoryRef: 'CBUAE Notice 3551/2021 S3.1',
    roles: ['board', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'governance',
  },
  canAcknowledgeBoardDocument: {
    permission: 'canAcknowledgeBoardDocument',
    description: 'Digitally acknowledge board documents with watermark and non-repudiation',
    regulatoryRef: 'CBUAE Notice 3551/2021 S3.1',
    roles: ['board', 'admin'],
    requiresMakerChecker: false,
    category: 'governance',
  },
  canManageRuleTuningProposals: {
    permission: 'canManageRuleTuningProposals',
    description: 'Create, edit, and simulate rule tuning proposals in the sandbox',
    regulatoryRef: 'FDL 10/2025 Art. 15',
    roles: ['compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'governance',
  },
  canApproveRuleTuningProposals: {
    permission: 'canApproveRuleTuningProposals',
    description: 'Approve or reject rule tuning proposals (MLRO Maker-Checker)',
    regulatoryRef: 'FDL 10/2025 Art. 15',
    roles: ['mlro', 'admin'],
    requiresMakerChecker: true,
    category: 'governance',
  },
  canManageQASampling: {
    permission: 'canManageQASampling',
    description: 'Generate and manage QA stratified random samples',
    regulatoryRef: 'FDL 10/2025 Art. 15',
    roles: ['compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'governance',
  },
  canReviewQAFindings: {
    permission: 'canReviewQAFindings',
    description: 'Submit and view QA review findings (immutable)',
    regulatoryRef: 'FDL 10/2025 Art. 15',
    roles: ['compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'governance',
  },
  canManageDeptHeadInbox: {
    permission: 'canManageDeptHeadInbox',
    description: 'Access department head digital acknowledgment inbox with SLA tracking',
    regulatoryRef: 'FDL 10/2025 Art. 15',
    roles: ['dept_head', 'mlro', 'compliance_manager', 'admin'],
    requiresMakerChecker: false,
    category: 'governance',
  },
  canAcknowledgeCircular: {
    permission: 'canAcknowledgeCircular',
    description: 'Acknowledge circulars and submit action plans as department head',
    regulatoryRef: 'FDL 10/2025 Art. 15',
    roles: ['dept_head', 'admin'],
    requiresMakerChecker: false,
    category: 'governance',
  },
  canManageCAPKanban: {
    permission: 'canManageCAPKanban',
    description: 'Manage Corrective Action Plans on the Kanban board',
    regulatoryRef: 'FDL 10/2025 Art. 15',
    roles: ['compliance_officer', 'compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'governance',
  },
  canAuditVerifyCAP: {
    permission: 'canAuditVerifyCAP',
    description: 'Audit-verify remediated CAPs (compliance_manager/mlro/admin, Maker-Checker)',
    regulatoryRef: 'FDL 10/2025 Art. 15',
    roles: ['compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: true,
    category: 'governance',
  },
  // ── Phase 4 / F1: Complaint Management (CBUAE Notice 3551/2021; FDL 10/2025 Art. 13) ──
  canManageComplaints: {
    permission: 'canManageComplaints',
    description: 'Intake, investigate, and transition complaints through the CBUAE SLA state machine',
    regulatoryRef: 'CBUAE Notice 3551/2021; FDL 10/2025 Art. 13',
    roles: ['compliance_officer', 'compliance_manager', 'mlro', 'dept_head', 'admin'],
    requiresMakerChecker: false,
    category: 'governance',
  },
  canEscalateToOmbudsman: {
    permission: 'canEscalateToOmbudsman',
    description: 'Escalate an unresolved complaint to the Insurance Ombudsman Bureau (4-eyes, senior roles only)',
    regulatoryRef: 'CBUAE Notice 3551/2021; FDL 10/2025 Art. 13',
    roles: ['compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'governance',
  },
  canManageSLAConfig: {
    permission: 'canManageSLAConfig',
    description: 'Configure and evaluate SLA compliance across all modules',
    regulatoryRef: 'FDL 10/2025 Art. 15; CBUAE Notice 3551/2021 S3.1',
    roles: ['compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'governance',
  },
  canViewUnifiedTasks: {
    permission: 'canViewUnifiedTasks',
    description: 'View the unified My Tasks inbox',
    regulatoryRef: 'FDL 10/2025 Art. 15',
    roles: ['compliance_officer', 'compliance_manager', 'mlro', 'dept_head', 'admin'],
    requiresMakerChecker: false,
    category: 'governance',
  },
  // ── Phase F: Regulatory Circular Ingestion Engine ──
  canManageIngestionSources: {
    permission: 'canManageIngestionSources',
    description: 'Configure automated scraper sources (add URL, frequency, CSS selectors)',
    regulatoryRef: 'FDL 10/2025 Art. 15; CBUAE Notice 3551/2021 S3.1',
    roles: ['admin', 'compliance_manager'],
    requiresMakerChecker: false,
    category: 'governance',
  },
  canUploadCirculars: {
    permission: 'canUploadCirculars',
    description: 'Manually upload regulatory circulars and run AI deep extraction',
    regulatoryRef: 'FDL 10/2025 Art. 15',
    roles: ['compliance_manager', 'mlro', 'admin'],
    requiresMakerChecker: false,
    category: 'governance',
  },
  canViewCirculars: {
    permission: 'canViewCirculars',
    description: 'View committed regulatory circulars and the RCM dashboard',
    regulatoryRef: 'FDL 10/2025 Art. 15',
    roles: ['compliance_manager', 'mlro', 'compliance_officer', 'dept_head', 'admin'],
    requiresMakerChecker: false,
    category: 'governance',
  },
};

// ─── Permission Check Functions ─────────────────────────────────────────────────

/**
 * Check if a role has a specific permission.
 * Returns true if the role is in the permission's allowed roles list.
 */
export function checkPermission(role: ComplianceRole, permission: Permission): boolean {
  const rule = PERMISSIONS[permission];
  if (!rule) return false;
  return rule.roles.includes(role);
}

/**
 * Require that a role has a specific permission.
 * Throws a PermissionDeniedError if the role does not have the permission.
 */
export function requirePermission(role: ComplianceRole, permission: Permission): void {
  if (!checkPermission(role, permission)) {
    const rule = PERMISSIONS[permission];
    throw new PermissionDeniedError(
      `Role "${role}" does not have permission "${permission}". ` +
      `Required roles: ${rule?.roles.join(', ') ?? 'none'}. ` +
      `Regulatory reference: ${rule?.regulatoryRef ?? 'N/A'}`,
      role,
      permission
    );
  }
}

/**
 * Get all permissions assigned to a specific role.
 * Returns an array of PermissionRule objects for every permission the role has.
 */
export function getRolePermissions(role: ComplianceRole): PermissionRule[] {
  return Object.values(PERMISSIONS).filter((rule) =>
    rule.roles.includes(role)
  );
}

/**
 * Get all permissions for a role grouped by category.
 */
export function getRolePermissionsByCategory(
  role: ComplianceRole
): Record<PermissionRule['category'], PermissionRule[]> {
  const perms = getRolePermissions(role);
  const grouped: Record<PermissionRule['category'], PermissionRule[]> = {
    aml: [],
    kyc: [],
    sanctions: [],
    governance: [],
    reporting: [],
    administration: [],
    general: [],
  };

  for (const perm of perms) {
    grouped[perm.category].push(perm);
  }

  return grouped;
}

/**
 * Check if a permission requires Maker-Checker dual approval.
 */
export function requiresMakerChecker(permission: Permission): boolean {
  return PERMISSIONS[permission]?.requiresMakerChecker ?? false;
}

/**
 * Get all permissions that require Maker-Checker approval.
 */
export function getMakerCheckerPermissions(): PermissionRule[] {
  return Object.values(PERMISSIONS).filter((rule) => rule.requiresMakerChecker);
}

/**
 * Check if a role can perform an action that requires Maker-Checker,
 * and if so, whether the Maker-Checker requirement is satisfied.
 */
export function checkMakerCheckerRequirement(
  role: ComplianceRole,
  permission: Permission,
  makerId: string,
  checkerId: string | undefined
): {
  canPerform: boolean;
  requiresApproval: boolean;
  makerCheckerSatisfied: boolean;
  reason?: string;
} {
  const hasPermission = checkPermission(role, permission);
  if (!hasPermission) {
    return {
      canPerform: false,
      requiresApproval: false,
      makerCheckerSatisfied: false,
      reason: `Role "${role}" does not have permission "${permission}"`,
    };
  }

  const needsMC = requiresMakerChecker(permission);

  if (!needsMC) {
    return {
      canPerform: true,
      requiresApproval: false,
      makerCheckerSatisfied: true,
    };
  }

  // Maker-Checker required: verify checker is provided and different from maker
  if (!checkerId) {
    return {
      canPerform: false,
      requiresApproval: true,
      makerCheckerSatisfied: false,
      reason: `Permission "${permission}" requires Maker-Checker approval. No checker has been assigned.`,
    };
  }

  if (makerId === checkerId) {
    return {
      canPerform: false,
      requiresApproval: true,
      makerCheckerSatisfied: false,
      reason: `Maker-Checker violation: maker and checker cannot be the same person (4-eyes principle).`,
    };
  }

  return {
    canPerform: true,
    requiresApproval: true,
    makerCheckerSatisfied: true,
  };
}

// ─── Permission Denied Error ────────────────────────────────────────────────────

export class PermissionDeniedError extends Error {
  public readonly role: ComplianceRole;
  public readonly permission: Permission;

  constructor(message: string, role: ComplianceRole, permission: Permission) {
    super(message);
    this.name = 'PermissionDeniedError';
    this.role = role;
    this.permission = permission;
  }
}

// ─── API Route RBAC Wrapper ─────────────────────────────────────────────────────

/**
 * Zod schema for RBAC context extracted from request headers.
 */
export const RBACContextSchema = z.object({
  userId: z.string().min(1),
  role: z.enum([
    'admin',
    'mlro',
    'compliance_manager',
    'compliance_officer',
    'dept_head',
    'board',
  ]),
  ipAddress: z.string().optional(),
});

export type RBACContext = z.infer<typeof RBACContextSchema>;

type APIRouteHandler = (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>;

/**
 * withRBAC — Higher-order function that wraps an API route handler
 * with RBAC permission checking.
 *
 * Extracts the user's role from the `x-user-role` and `x-user-id` headers
 * (set by the authentication middleware) and checks the required permission
 * before allowing the handler to execute.
 *
 * Usage:
 * ```typescript
 * export const POST = withRBAC(
 *   async (request) => {
 *     // Handler code — only reached if permission is granted
 *     return NextResponse.json({ success: true });
 *   },
 *   'canFileSAR'
 * );
 * ```
 */
export function withRBAC(
  handler: APIRouteHandler,
  requiredPermission: Permission
): APIRouteHandler {
  return async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ) => {
    // Extract RBAC context from headers
    const userRole = request.headers.get('x-user-role') as ComplianceRole | null;
    const userId = request.headers.get('x-user-id');
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      undefined;

    if (!userRole || !userId) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Missing x-user-role or x-user-id headers',
          regulatoryRef: 'FDL 10/2025 Art. 15',
        },
        { status: 401 }
      );
    }

    // Validate role
    if (!COMPLIANCE_ROLES.includes(userRole)) {
      return NextResponse.json(
        {
          error: 'Invalid role',
          message: `Role "${userRole}" is not a valid compliance role`,
        },
        { status: 403 }
      );
    }

    // Check permission
    try {
      requirePermission(userRole, requiredPermission);
    } catch (error) {
      if (error instanceof PermissionDeniedError) {
        return NextResponse.json(
          {
            error: 'Permission denied',
            message: error.message,
            role: error.role,
            permission: error.permission,
            regulatoryRef: PERMISSIONS[error.permission]?.regulatoryRef,
          },
          { status: 403 }
        );
      }
      throw error;
    }

    // Attach RBAC context to request for downstream use
    const rbacContext: RBACContext = {
      userId,
      role: userRole,
      ipAddress,
    };

    // Add RBAC context as a custom header for downstream handlers.
    // CRITICAL (Phase 4 Step 2.2): We MUST mutate the existing request's
    // headers in place rather than constructing `new NextRequest(request,
    // { headers })`. Under Next.js 16 / Turbopack, the NextRequest
    // constructor cannot clone the internal `#state` private field across
    // the constructor boundary, which throws:
    //   TypeError: Cannot read private member #state from an object whose
    //   class did not declare it
    // This broke EVERY withRBAC-wrapped route (POST /api/cap/plans,
    // /api/cap/plans/[id]/transition, etc.) with a 500 + empty body.
    // The Web API `Headers` object is mutable, so `set()` is the correct,
    // spec-compliant way to attach the RBAC context.
    request.headers.set('x-rbac-context', JSON.stringify(rbacContext));

    // Execute the handler
    return handler(request, context);
  };
}

// ─── Role Hierarchy and Utilities ───────────────────────────────────────────────

/**
 * Role hierarchy mapping — higher number = higher privilege.
 * Used for UI display and role escalation logic.
 *
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  DUAL-AXIS RBAC CLARIFICATION (Pre-UAT Polish Fix #2)                      ║
 * ║                                                                            ║
 * ║  Axis 1 — System Privilege (ROLE_HIERARCHY):                               ║
 * ║    Admin is Level 100 for system configuration, user management,           ║
 * ║    and technical operations. This is the HIGHEST system privilege.         ║
 * ║                                                                            ║
 * ║  Axis 2 — Business Data Authority (BUSINESS_AUTHORITY per permission):     ║
 * ║    Admin's BUSINESS_AUTHORITY for sensitive compliance data is              ║
 * ║    strictly 0 (ZERO). Admin CANNOT:                                        ║
 * ║      • canApproveKYC          → SoD: Admin must not self-approve KYC       ║
 * ║      • canFileSAR             → SoD: Admin must not file SARs              ║
 * ║      • canOverrideSanctions   → SoD: Admin cannot override sanctions       ║
 * ║      • canReviewMLRFlag       → SoD: Admin cannot review MLR flags         ║
 * ║      • canActivateBreakGlass  → Only MLRO can authorize emergency access   ║
 * ║                                                                            ║
 * ║  CRITICAL: SoD blocks apply REGARDLESS of system level.                    ║
 * ║  An admin at Level 100 is STILL blocked from all Axis 2 operations        ║
 * ║  that require explicit business authority. This is by design per           ║
 * ║  FDL 10/2025 Art. 15 (Segregation of Duties) and CBUAE Notice             ║
 * ║  3551/2021 S3.1 (Governance).                                              ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */
export const ROLE_HIERARCHY: Record<ComplianceRole, number> = {
  board: 10,
  dept_head: 20,
  compliance_officer: 30,
  compliance_manager: 40,
  mlro: 50,
  admin: 100, // System Config Level 100 — BUT BUSINESS_AUTHORITY for sensitive data = 0 (see above)
};

/**
 * Human-readable role labels.
 */
export const ROLE_LABELS: Record<ComplianceRole, string> = {
  admin: 'System Administrator',
  mlro: 'Money Laundering Reporting Officer (MLRO)',
  compliance_manager: 'Compliance Manager',
  compliance_officer: 'Compliance Officer',
  dept_head: 'Department Head',
  board: 'Board Member',
};

/**
 * Check if one role has equal or higher privilege than another.
 */
export function isRoleAtLeast(role: ComplianceRole, minimumRole: ComplianceRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minimumRole];
}

/**
 * Get the minimum role required for a given permission.
 */
export function getMinimumRoleForPermission(permission: Permission): ComplianceRole {
  const rule = PERMISSIONS[permission];
  if (!rule || rule.roles.length === 0) return 'admin'; // Default to most restricted

  // Return the role with the lowest hierarchy number
  const sortedRoles = rule.roles.sort(
    (a, b) => ROLE_HIERARCHY[a] - ROLE_HIERARCHY[b]
  );
  return sortedRoles[0];
}

/**
 * Roles that require Maker-Checker approval for role changes.
 * Promoting a user to any of these privileged roles must go through
 * the 4-eyes principle (Segregation of Duties per Section 10.1.3).
 */
export const ROLE_CHANGE_REQUIRES_MAKER_CHECKER: ComplianceRole[] = [
  'admin',
  'mlro',
  'compliance_manager',
];
