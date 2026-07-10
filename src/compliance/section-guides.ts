/**
 * IC-OS Section Guide Registry (Phase 4.1 — Section 10.1.4)
 *
 * Collapsible "Section Guide" card data for every major module.
 * Each entry provides:
 *   1. Role-Specific Actions  — what each role can do in the module.
 *   2. Workflow Visualization  — the end-to-end step flow.
 *   3. Regulatory References  — explicit citations to UAE AML/CFT law.
 *
 * Regulatory framework:
 *   - FDL 10/2025 (Federal Decree-Law No. 10 of 2025 on AML/CFT)
 *   - CR 134/2025 (Cabinet Resolution No. 134 of 2025 — Implementing Regulation)
 *   - CBUAE Notice 3551/2021 (Guidance for Licensed Financial Institutions)
 *   - Cabinet Decision 10/2019 (Implementing Regulation of AML Law 20/2018)
 */

export type SectionGuideKey =
  | 'aml-sanctions'
  | 'kyc'
  | 'goaml-filing'
  | 'admin';

export interface RegulatoryCitation {
  citation: string;
  description: string;
}

export interface SectionGuideData {
  /** Module display title */
  title: string;
  /** One-line module purpose */
  purpose: string;
  /** Actions available per role (role string → action list). Unknown roles get the 'default' bucket. */
  roleActions: Record<string, string[]>;
  /** Ordered workflow steps */
  workflow: string[];
  /** Regulatory citations with descriptions */
  regulations: RegulatoryCitation[];
}

/** Canonical role labels for display (keys match useICOSStore currentUser.role values). */
export const ROLE_LABELS: Record<string, string> = {
  admin: 'System Administrator',
  mlro: 'MLRO',
  compliance_manager: 'Compliance Manager',
  compliance_officer: 'Compliance Officer',
  dept_head: 'Department Head',
  board: 'Board Member',
  auditor: 'Internal/External Auditor',
  system_administrator: 'System Administrator',
};

export const SECTION_GUIDES: Record<SectionGuideKey, SectionGuideData> = {
  'aml-sanctions': {
    title: 'AML & Sanctions Triage',
    purpose:
      'Screen, triage, and disposition sanctions/PEP matches with Maker-Checker oversight and MLRO freeze authority.',
    roleActions: {
      compliance_officer: [
        'Screen names against UAE Local Terrorist List & UN/OFAC lists',
        'Triage detected matches (true positive vs false positive)',
        'Recommend disposition with evidence',
      ],
      compliance_manager: [
        'Review CO triage recommendation (Maker-Checker)',
        'Approve false-positive disposition',
        'Escalate true-positive match to MLRO',
      ],
      mlro: [
        'Authorize sanctions freeze',
        'File blocking report to UAE FIU',
        'Notify CBUAE within statutory deadline',
      ],
      auditor: [
        'Review screening logs (read-only)',
        'Verify triage evidence chain',
      ],
      admin: [
        'Configure screening list feeds',
        'Manage match-threshold tuning (audited)',
      ],
      default: ['Contact your Compliance Officer for access to this module.'],
    },
    workflow: [
      'Name Screening',
      'Match Detection',
      'CO Triage',
      'CM Maker-Checker Review',
      'MLRO Freeze Decision',
      'FIU Blocking Report',
    ],
    regulations: [
      {
        citation: 'FDL 10/2025 Art. 15',
        description: 'Mandatory sanctions screening and blocking obligations.',
      },
      {
        citation: 'CBUAE Notice 3551/2021 S3.1',
        description:
          'UAE Local Terrorist List screening — zero-tolerance direct-match handling.',
      },
      {
        citation: 'UN Security Council Res. 1373',
        description: 'Terrorism financing sanctions framework.',
      },
      {
        citation: 'CR 134/2025 Art. 21',
        description: 'MLRO accountability for sanctions decisions.',
      },
    ],
  },

  kyc: {
    title: 'Know Your Customer (KYC)',
    purpose:
      'Customer onboarding, CDD/EDD, and risk-rating with Compliance Manager approval for high-risk customers.',
    roleActions: {
      compliance_officer: [
        'Collect customer identification documentation',
        'Perform Customer Due Diligence (CDD)',
        'Perform Enhanced Due Diligence (EDD) for high-risk',
        'Assign initial risk rating',
      ],
      compliance_manager: [
        'Approve high-risk customer onboarding',
        'Verify EDD completion',
        'Approve UBO declarations',
      ],
      mlro: [
        'Override risk rating with audited justification',
        'Approve PEP relationships',
      ],
      auditor: [
        'Review KYC files (read-only)',
        'Verify risk-rating consistency',
        'Sample-test CDD completeness',
      ],
      admin: [
        'Manage KYC document templates',
        'Configure risk-rating parameters (no PII access — SoD)',
      ],
      default: ['Contact your Compliance Officer for access to this module.'],
    },
    workflow: [
      'Customer Onboarding',
      'Document Collection',
      'CDD / EDD',
      'Risk Rating',
      'CM Approval (high-risk)',
      'Ongoing Monitoring',
    ],
    regulations: [
      {
        citation: 'FDL 10/2025 Art. 16',
        description: 'Customer Due Diligence (CDD) requirements.',
      },
      {
        citation: 'CBUAE Notice 3551/2021 S2.4',
        description:
          'Enhanced Due Diligence (EDD) for high-risk customers and PEPs.',
      },
      {
        citation: 'CR 134/2025 Art. 12',
        description: 'Risk-rating methodology and periodic review cadence.',
      },
      {
        citation: 'FDL 10/2025 Art. 17',
        description: 'Beneficial Ownership identification and reporting.',
      },
    ],
  },

  'goaml-filing': {
    title: 'goAML Filing Center',
    purpose:
      'Draft, review (Maker-Checker), MLRO-sign, and submit UPPERCASE goAML XML SAR/STR/CTR reports to the UAE FIU.',
    roleActions: {
      compliance_officer: [
        'Draft SAR narrative and supporting evidence',
        'Attach transaction records',
        'Submit draft to Compliance Manager',
      ],
      compliance_manager: [
        'Review CO recommendation (Maker-Checker gate)',
        'Approve or reject SAR draft',
        'Escalate approved draft to MLRO',
      ],
      mlro: [
        'Final SAR review',
        'Apply digital signature',
        'Generate UPPERCASE goAML XML (XSD-compliant)',
        'Submit to UAE FIU',
      ],
      auditor: [
        'View filed SARs (read-only)',
        'Verify audit trail immutability',
        'Export filing records for review',
      ],
      admin: [
        'Configure filing thresholds (CTR auto-promotion)',
        'Manage report templates (no SAR content access — SoD)',
      ],
      default: ['Contact your Compliance Officer for access to this module.'],
    },
    workflow: [
      'Alert Triggered',
      'CO Investigates',
      'CO Recommends',
      'CM Maker-Checker Review',
      'MLRO Final Review',
      'MLRO Digital Signature',
      'goAML XML Generated (UPPERCASE)',
      'Submitted to UAE FIU',
    ],
    regulations: [
      {
        citation: 'FDL 10/2025 Art. 15',
        description:
          'Mandatory suspicious transaction reporting to the UAE FIU.',
      },
      {
        citation: 'CBUAE Notice 3551/2021 S3.1',
        description: 'goAML XML schema and submission format requirements.',
      },
      {
        citation: 'Cabinet Decision 10/2019 Art. 14',
        description: 'SAR filing timeline — within 35 days of detection.',
      },
      {
        citation: 'CR 134/2025 Art. 21',
        description: 'MLRO accountability for filing integrity and signature.',
      },
    ],
  },

  admin: {
    title: 'Admin Panel',
    purpose:
      'Platform administration — users, roles, security policy, and audit oversight. Strict Segregation of Duties: NO PII/SAR access.',
    roleActions: {
      admin: [
        'Manage users and role assignments',
        'Configure Global Security Policy (password/MFA/session)',
        'Manage User Lifecycle (suspend/archive/force-logout)',
        'View system audit log',
        'Manage feature flags',
      ],
      system_administrator: [
        'Manage users and role assignments',
        'Configure Global Security Policy (password/MFA/session)',
        'Manage User Lifecycle (suspend/archive/force-logout)',
        'View system audit log',
        'Manage feature flags',
      ],
      auditor: [
        'Review admin actions (read-only)',
        'Verify SoD enforcement',
        'Export audit trail for regulatory review',
        'Verify SHA-256 audit hash integrity',
      ],
      default: [
        'Administrator role required. Contact your System Administrator.',
      ],
    },
    workflow: [
      'Admin Login (MFA enforced)',
      'Access Admin Panel',
      'Manage Users / Roles',
      'Configure Security Policy',
      'All Actions Audit-Logged (SHA-256)',
    ],
    regulations: [
      {
        citation: 'CR 134/2025 Art. 21',
        description:
          'Segregation of Duties — administrators have NO access to PII or SARs.',
      },
      {
        citation: 'CBUAE ICT Standard S5.2',
        description: 'Authentication, session management, and access controls.',
      },
      {
        citation: 'ISO 27001 A.9',
        description: 'Access control and user management domain.',
      },
      {
        citation: 'FDL 10/2025 Art. 24',
        description: 'Record-keeping and audit-trail immutability requirements.',
      },
    ],
  },
};

/**
 * Resolve the action list for a given module + role.
 * Falls back to the 'default' bucket if the role is not explicitly mapped.
 */
export function getRoleActions(
  moduleKey: SectionGuideKey,
  role: string | undefined | null,
): string[] {
  const guide = SECTION_GUIDES[moduleKey];
  if (!guide) return [];
  if (role && guide.roleActions[role]) return guide.roleActions[role];
  return guide.roleActions.default ?? [];
}

/** Human-readable label for a role key. */
export function getRoleLabel(role: string | undefined | null): string {
  if (!role) return 'Guest';
  return ROLE_LABELS[role] ?? role;
}
