// ─────────────────────────────────────────────────────────────────────────────
// tools.ts — Agentic Tool-Use for the Dual-Master-Brain Orchestrator
//
// Equips the Master Brains with autonomous tool-calling capabilities so they
// can ground their synthesis in real system state:
//   • search_knowledge_base      — RAG search over regulatory KB + scenarios
//   • get_user_role_permissions  — RBAC lookup (7-role matrix, Sections 10.1-10.7)
//   • fetch_internal_sop         — retrieve a specific internal SOP by number/keyword
//
// All tools are READ-ONLY by design. Write tools (e.g. create_sar) are
// intentionally NOT exposed — the Master Brain advises, humans execute.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from '@/lib/db';
import { REGULATORY_KNOWLEDGE_BASE } from '@/lib/compliance/rag-policy-wizard';
import { ROLE_ALLOWED_SECTIONS } from '@/lib/nav-rbac';
import type { UserRole } from '@/lib/types';
import type { ToolName, ToolPermissions } from '@/lib/ai/model';

// ─── Tool Definition Type ────────────────────────────────────────────────────

export interface AgenticTool {
  name: ToolName;
  description: string;
  /** JSON-schema-ish parameter descriptor for the brain's prompt. */
  parameters: string;
  /** Executes the tool and returns a string the brain can reason over. */
  execute: (args: Record<string, unknown>) => Promise<string>;
}

// ─── Tool 1: search_knowledge_base ───────────────────────────────────────────

async function searchKnowledgeBase(args: Record<string, unknown>): Promise<string> {
  const query = String(args.query ?? '').trim();
  const jurisdiction = String(args.jurisdiction ?? 'AE').trim();
  if (!query) return 'Error: query parameter is required.';

  const lower = query.toLowerCase();
  const results: string[] = [];

  // 1. Regulatory Knowledge Base (FDL 10/2025, CR 134/2025, CBUAE Notice 3551/2021)
  // Always search UAE KB as it's the baseline
  const kbMatches = REGULATORY_KNOWLEDGE_BASE
    .filter((entry) => {
      const hay = `${entry.regulation} ${entry.article} ${entry.requirement} ${entry.category}`.toLowerCase();
      return lower.split(/\s+/).some((term) => hay.includes(term));
    })
    .slice(0, 8);

  if (kbMatches.length > 0) {
    results.push(`=== Regulatory Knowledge Base Matches (UAE Baseline — FDL 10/2025) ${jurisdiction !== 'AE' ? `[Note: Showing UAE baseline; also see ${jurisdiction}-specific refs below]` : ''} ===`);
    for (const m of kbMatches) {
      results.push(`• [${m.regulation} ${m.article}] (${m.category}, severity: ${m.severity})\n  ${m.requirement}`);
    }
  }

  // 1b. Jurisdiction-specific regulatory references (non-UAE)
  if (jurisdiction !== 'AE') {
    try {
      const { queryRegulatoryReferences } = await import('@/lib/regulatory');
      const jurisdictionResults = await queryRegulatoryReferences({
        jurisdiction: jurisdiction as 'BH' | 'SA' | 'QA' | 'OM' | 'KW',
        searchTerms: query.split(/\s+/),
      });
      if (jurisdictionResults.length > 0) {
        results.push(`\n=== Jurisdiction-Specific Regulatory References (${jurisdiction}) ===`);
        for (const ref of jurisdictionResults.slice(0, 6)) {
          results.push(`• [${ref.module} ${ref.section}] (${ref.category}, severity: ${ref.severity})\n  ${ref.requirement}`);
        }
      }
    } catch {
      // Regulatory references module unavailable — UAE KB matches are still useful
    }
  }

  // 2. Scenario Knowledge (122 operational scenarios)
  try {
    const scenarioMatches = await db.scenarioKnowledge.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { category: { contains: query } },
          { packName: { contains: query } },
        ],
      },
      take: 6,
      select: { packNumber: true, title: true, category: true, riskLevel: true },
    });
    if (scenarioMatches.length > 0) {
      results.push('\n=== Operational Scenario Matches ===');
      for (const s of scenarioMatches) {
        results.push(`• [Pack ${s.packNumber}] ${s.title} (${s.category}, risk: ${s.riskLevel})`);
      }
    }
  } catch {
    // DB unavailable — KB matches are still useful
  }

  // 3. Internal Policies (by title/category/department)
  try {
    const policyMatches = await db.policy.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { category: { contains: query } },
          { department: { contains: query } },
        ],
      },
      take: 6,
      select: { policyNumber: true, title: true, category: true, department: true, status: true, version: true },
    });
    if (policyMatches.length > 0) {
      results.push('\n=== Internal Policy Matches ===');
      for (const p of policyMatches) {
        results.push(`• [${p.policyNumber} v${p.version}] ${p.title} (${p.category}, dept: ${p.department}, status: ${p.status})`);
      }
    }
  } catch {
    // DB unavailable
  }

  return results.length > 0
    ? results.join('\n')
    : `No knowledge base matches found for "${query}".`;
}

// ─── Tool 2: get_user_role_permissions ───────────────────────────────────────

async function getUserRolePermissions(args: Record<string, unknown>): Promise<string> {
  const roleInput = String(args.role ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  if (!roleInput) return 'Error: role parameter is required.';

  const validRoles: UserRole[] = [
    'admin', 'mlro', 'compliance_manager', 'compliance_officer',
    'dept_head', 'board', 'auditor',
  ];

  if (!validRoles.includes(roleInput as UserRole)) {
    return `Error: unknown role "${roleInput}". Valid roles: ${validRoles.join(', ')}.`;
  }

  const role = roleInput as UserRole;
  const allowlist = ROLE_ALLOWED_SECTIONS[role];
  const visibleSections = allowlist ? Array.from(allowlist) : ['ALL (full access — MLRO)'];

  const roleDescriptions: Record<UserRole, string> = {
    admin: 'System Administrator — platform-infrastructure only (Section 10.2 SoD). Blind to all compliance/PII/SAR data.',
    mlro: 'MLRO — full compliance access (Section 10.4). Single point of contact with FIU. Approves all SARs.',
    compliance_manager: 'Compliance Manager — CO modules + QA Queue, Maker-Checker (Checker), System Tuning (Section 10.4).',
    compliance_officer: 'Compliance Officer — compliance operational (Maker). KYC, AML Alerts, Evidence, goAML Draft (Section 10.4).',
    dept_head: 'Department Head — departmental view only (Section 10.5). Owns department compliance posture, acknowledges circulars.',
    board: 'Board Member — aggregated/executive view only (Section 10.3). Blind to operational data and PII.',
    auditor: 'Auditor — read-only Audit Vault, Time-Travel UI, Reports. No edit/approval queues.',
  };

  const makerCheckerRoles: UserRole[] = ['compliance_officer', 'compliance_manager', 'mlro'];

  return `=== Role: ${role.toUpperCase()} ===
Description: ${roleDescriptions[role]}
Maker-Checker eligibility: ${makerCheckerRoles.includes(role) ? (role === 'compliance_officer' ? 'MAKER (drafts)' : 'CHECKER (approves)') : 'N/A'}
Visible sidebar sections (${visibleSections.length}): ${visibleSections.join(', ')}

Key RBAC notes (Sections 10.1-10.7):
- Admin is strictly segregated from compliance data (SoD, Section 10.2).
- Board sees only aggregated KRI dashboards (Section 10.3).
- Dept Heads own their department's compliance posture (Section 10.6).
- MLRO is the single point of contact with the relevant FIU for their jurisdiction (Section 10.4).
- Sanctions screening is fail-closed; overrides require CO→CM→MLRO approval.`;
}

// ─── Tool 3: fetch_internal_sop ──────────────────────────────────────────────

async function fetchInternalSop(args: Record<string, unknown>): Promise<string> {
  const identifier = String(args.sopNumber ?? args.keyword ?? '').trim();
  if (!identifier) return 'Error: sopNumber or keyword parameter is required.';

  try {
    // Try exact policyNumber match first
    let policies = await db.policy.findMany({
      where: { policyNumber: { contains: identifier } },
      take: 5,
      select: {
        policyNumber: true, title: true, category: true, department: true,
        owner: true, version: true, status: true, reviewDate: true,
        approvalDate: true, approvedBy: true, documentUrl: true,
        aiReviewed: true, aiConfidence: true,
      },
    });

    // Fall back to title/keyword search
    if (policies.length === 0) {
      policies = await db.policy.findMany({
        where: {
          OR: [
            { title: { contains: identifier } },
            { category: { contains: identifier } },
            { department: { contains: identifier } },
          ],
        },
        take: 5,
        select: {
          policyNumber: true, title: true, category: true, department: true,
          owner: true, version: true, status: true, reviewDate: true,
          approvalDate: true, approvedBy: true, documentUrl: true,
          aiReviewed: true, aiConfidence: true,
        },
      });
    }

    if (policies.length === 0) {
      return `No internal SOP found matching "${identifier}". Note: the internal policy repository may not yet contain this document. Recommend the Compliance Manager author and publish the SOP.`;
    }

    const lines: string[] = ['=== Internal SOP(s) Retrieved ==='];
    for (const p of policies) {
      lines.push(`• Policy Number: ${p.policyNumber} (v${p.version})
  Title: ${p.title}
  Category: ${p.category} | Department: ${p.department} | Owner: ${p.owner}
  Status: ${p.status} | AI Reviewed: ${p.aiReviewed ? 'yes' : 'no'} (confidence: ${(p.aiConfidence * 100).toFixed(0)}%)
  Approved by: ${p.approvedBy ?? 'N/A'} on ${p.approvalDate?.toISOString().split('T')[0] ?? 'N/A'}
  Next review: ${p.reviewDate?.toISOString().split('T')[0] ?? 'N/A'}
  Document URL: ${p.documentUrl ?? 'N/A (content body not yet stored — see Policy & Procedure Management module)'}`);
    }
    return lines.join('\n');
  } catch {
    return `Error retrieving internal SOP "${identifier}" from the database. The policy repository may be unavailable.`;
  }
}

// ─── Tool Registry ───────────────────────────────────────────────────────────

export const AGENTIC_TOOLS: Record<ToolName, AgenticTool> = {
  search_knowledge_base: {
    name: 'search_knowledge_base',
    description: 'Search the IC-OS regulatory knowledge base (jurisdiction-specific regulations and UAE baseline), operational scenarios, and internal policies for grounded compliance context.',
    parameters: '{ "query": "<search terms>", "jurisdiction": "<AE|SA|BH|QA|OM|KW>" }',
    execute: searchKnowledgeBase,
  },
  get_user_role_permissions: {
    name: 'get_user_role_permissions',
    description: 'Look up the 7-Role RBAC permissions for a given role (admin, mlro, compliance_manager, compliance_officer, dept_head, board, auditor). Returns visible modules, Maker-Checker eligibility, and Section 10.1-10.7 notes.',
    parameters: '{ "role": "<role_name>" }',
    execute: getUserRolePermissions,
  },
  fetch_internal_sop: {
    name: 'fetch_internal_sop',
    description: 'Retrieve a specific internal SOP/policy by its policy number or keyword. Returns title, owner, department, version, approval status, and AI confidence.',
    parameters: '{ "sopNumber": "<POL-XXX-XXX>" } or { "keyword": "<term>" }',
    execute: fetchInternalSop,
  },
};

/**
 * Returns the list of tools (with descriptions) that the brain should be
 * told it can invoke. Only tools whose permission is enabled are included.
 */
export function getEnabledToolDescriptors(permissions: ToolPermissions): string {
  const enabled = (Object.keys(AGENTIC_TOOLS) as ToolName[])
    .filter((name) => permissions[name]);
  if (enabled.length === 0) return 'No tools are currently enabled.';
  return enabled
    .map((name) => `- ${name}: ${AGENTIC_TOOLS[name].description}\n  Parameters: ${AGENTIC_TOOLS[name].parameters}`)
    .join('\n');
}

/**
 * Executes a tool by name (if permitted) and returns its output string.
 * Returns an error notice if the tool is unknown or disabled.
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  permissions: ToolPermissions,
): Promise<string> {
  if (!(name in AGENTIC_TOOLS)) {
    return `Error: unknown tool "${name}".`;
  }
  const toolName = name as ToolName;
  if (!permissions[toolName]) {
    return `Tool "${name}" is disabled by the administrator. Cannot execute.`;
  }
  try {
    return await AGENTIC_TOOLS[toolName].execute(args);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return `Tool "${name}" failed: ${msg}`;
  }
}
