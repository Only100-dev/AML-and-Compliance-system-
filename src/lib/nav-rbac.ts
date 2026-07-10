// ─────────────────────────────────────────────────────────────────────────────
// nav-rbac.ts — Frontend Navigation RBAC (Single Source of Truth)
//
// Defines the 7-role RBAC matrix (Sections 10.1–10.7) as allowlists of
// visible sidebar section ids. Used by:
//   • src/components/ic-os/layout/Sidebar.tsx — filters nav items per role
//   • src/lib/ai/tools.ts — get_user_role_permissions tool (so the Master
//     Brain can reason over what each role is authorized to access)
//   • Any UI component that needs to check role-based visibility
//
// This is a UI/tooling visibility map. The backend RBAC
// (src/lib/compliance/rbac.ts) and authGuard remain the authoritative
// enforcement layer.
//
// Role → module mapping derived from IC-OS Regulatory Reference Sections
// 10.1 – 10.7.
//
// A `null` entry means FULL ACCESS (no filtering) — used for MLRO.
// ─────────────────────────────────────────────────────────────────────────────

import type { UserRole } from '@/lib/types';

/**
 * Per-role allowlist of visible sidebar section ids.
 * `null` = full access (no filtering). Used for MLRO.
 */
export const ROLE_ALLOWED_SECTIONS: Record<UserRole, Set<string> | null> = {
  // ── System Administrator (Section 10.2 — strict SoD) ────────────────────
  admin: new Set([
    'admin-settings',
    'audit-trail',
    'security-center',
    'master-brain-oversight',
    'user-settings',
    'help-docs',
    // Intelligence Engine — Admin sees Agent Control + Executive Intel
    'intelligence-agent',
    'intelligence-executive',
    // Phase 2: Advanced AI & Network Intel
    'advanced-intel-hub',
    'pdpl-residency',
    'ai-orchestrator',
    'graph-analytics',
    // Phase 5: Trackers & Scorecards — Admin gets full access
    'audit-scorecard',
    'gap-tracker',
    'group-dashboard',
    // Task 6-c: Examiner Pack — Admin gets download access
    'examiner-pack',
  ]),

  // ── Board Member (Section 10.3 — aggregated / executive only) ───────────
  board: new Set([
    'command-center',
    'risk-matrix',
    'audit-trail',
    'data-room',
    'compliance-alerts',
    'board-portal',
    'user-settings',
    'help-docs',
    // Intelligence Engine — Board sees Search + Agent Control + Executive Intel
    'intelligence-workspace',
    'intelligence-agent',
    'intelligence-executive',
    // Phase 2: Advanced AI & Network Intel — Board sees all modules
    'advanced-intel-hub',
    'pdpl-residency',
    'ai-orchestrator',
    'graph-analytics',
    // Phase 5: Board sees scorecard + group dashboard (anonymized)
    'audit-scorecard',
    'group-dashboard',
    // Task 6-c: Board sees Examiner Pack (read-only evidence)
    'examiner-pack',
  ]),

  // ── Auditor (Section 10.6 — read-only compliance audit) ─────────────────
  auditor: new Set([
    'command-center',
    'audit-trail',
    'risk-matrix',
    'regulatory-intelligence',
    'regulatory-tracker',
    'policies-sops',
    'policy-procedure-management',
    'compliance-audits',
    'compliance-alerts',
    'data-room',
    'user-settings',
    'help-docs',
    // Intelligence Engine — Auditor sees Intelligence Search (read-only)
    'intelligence-workspace',
    // Phase 2: Advanced AI & Network Intel — Auditor sees PDPL + Orchestrator + Graph Analytics (read-only)
    'pdpl-residency',
    'ai-orchestrator',
    'graph-analytics',
    // Phase 5: Auditor sees scorecard + gap tracker (read-only)
    'audit-scorecard',
    'gap-tracker',
    // Task 6-c: Auditor sees Examiner Pack (read-only audit evidence)
    'examiner-pack',
  ]),

  // ── Department Head (Section 10.5 — departmental view only) ─────────────
  dept_head: new Set([
    'command-center',
    'my-tasks',
    'dept-head-inbox',
    'regulatory-intelligence',
    'regulatory-tracker',
    'training-certifications',
    'training-effectiveness',
    'compliance-audits',
    'cap-kanban',
    'policy-attestations',
    'policies-sops',
    'policy-procedure-management',
    'labor-law',
    'user-settings',
    'help-docs',
    'knowledge-base',
    // Intelligence Engine — Dept Head sees Intelligence Search
    'intelligence-workspace',
    // Phase 2: Advanced AI & Network Intel — Dept Head sees overview + Orchestrator + Graph Analytics
    'advanced-intel-hub',
    'ai-orchestrator',
    'graph-analytics',
    // Phase 5: Dept Head sees scorecard + gap tracker
    'audit-scorecard',
    'gap-tracker',
  ]),

  // ── Compliance Officer (Section 10.4 — compliance operational, Maker) ───
  compliance_officer: new Set([
    'command-center',
    'corporate-kyc',
    'individual-kyc',
    'ubo-visualization',
    'aml-sanctions',
    'adverse-media',
    'evidence-war-room',
    'goaml-filing',
    'my-tasks',
    'regulatory-intelligence',
    'regulatory-tracker',
    'policies-sops',
    'policy-procedure-management',
    'compliance-alerts',
    'cap-kanban',
    'policy-attestations',
    'dept-head-inbox',
    'claims-portals',
    'maker-checker',
    'training-certifications',
    'training-effectiveness',
    'labor-law',
    'legal-advisory',
    'compliance-audits',
    'theme-settings',
    'user-settings',
    'help-docs',
    'knowledge-base',
    // Intelligence Engine — CO sees Intelligence Search
    'intelligence-workspace',
    // Phase 2: Advanced AI & Network Intel — CO sees PDPL + Orchestrator + Graph Analytics
    'advanced-intel-hub',
    'pdpl-residency',
    'ai-orchestrator',
    'graph-analytics',
    // Phase 5: CO sees scorecard + gap tracker
    'audit-scorecard',
    'gap-tracker',
  ]),

  // ── Compliance Manager (Section 10.4 — CO + QA / Checker / Tuning) ──────
  compliance_manager: new Set([
    'command-center', 'my-tasks', 'regulatory-intelligence', 'regulatory-tracker',
    'aml-sanctions', 'adverse-media', 'evidence-war-room', 'claims-portals',
    'corporate-kyc', 'individual-kyc', 'ubo-visualization', 'goaml-filing',
    'maker-checker', 'policies-sops', 'policy-procedure-management',
    'compliance-alerts', 'cap-kanban', 'policy-attestations', 'dept-head-inbox',
    'training-certifications', 'training-effectiveness', 'labor-law',
    'legal-advisory', 'compliance-audits', 'theme-settings', 'user-settings',
    'help-docs', 'knowledge-base', 'master-brain-oversight',
    'unified-workspace', 'cbuae-submission-checker', 'ai-agent',
    'advanced-analytics', 'quarterly-reporting', 'aml-assessment',
    'vendor-management', 'resiliency-hub', 'bordereaux-validation',
    // Intelligence Engine — CM sees Intelligence Search
    'intelligence-workspace',
    // Phase 2: Advanced AI & Network Intel — CM sees all modules
    'advanced-intel-hub',
    'pdpl-residency',
    'ai-orchestrator',
    'graph-analytics',
    // Phase 5: CM sees all trackers & scorecards
    'audit-scorecard',
    'gap-tracker',
    'group-dashboard',
    // Task 6-c: CM sees Examiner Pack
    'examiner-pack',
  ]),

  // ── MLRO (Section 10.4 — ALL compliance modules + executive) ────────────
  // null = FULL ACCESS. MLRO sees the entire compliance suite.
  mlro: null,
};

/**
 * Per-role default "home" section — where the Home icon navigates.
 */
export const ROLE_HOME_SECTION: Record<UserRole, string> = {
  admin: 'admin-settings',
  board: 'board-portal',
  auditor: 'audit-trail',
  dept_head: 'command-center',
  compliance_officer: 'command-center',
  compliance_manager: 'command-center',
  mlro: 'command-center',
};

/**
 * Returns the home section for a given role (defaults to command-center).
 */
export function getRoleHomeSection(role: UserRole): string {
  return ROLE_HOME_SECTION[role] ?? 'command-center';
}

/**
 * Returns true if the given role is allowed to SEE the given section id.
 * MLRO (null allowlist) always returns true (full access).
 */
export function isSectionAllowed(role: UserRole, sectionId: string): boolean {
  const allowlist = ROLE_ALLOWED_SECTIONS[role];
  if (!allowlist) return true; // null = full access
  return allowlist.has(sectionId);
}
