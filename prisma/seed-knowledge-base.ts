/**
 * Knowledge Base Document Seeder (Phase 5 — Part 4 Tier 2/3/4)
 *
 * Seeds sample Tier 2 (Cheat Sheets), Tier 3 (SOPs), and Tier 4 (Governance
 * Manuals) documents to demonstrate role-based visibility:
 *   - Tier 2/3: visible to all roles (allowedRoles = [])
 *   - Tier 4 Governance: restricted to ["board", "mlro"] only
 *
 * Idempotent: skips if KnowledgeBaseDocument table already has records.
 *
 * Usage: bun run prisma/seed-knowledge-base.ts
 */

import { db } from '@/lib/db';

interface KBDocSeed {
  title: string;
  description: string;
  tier: 2 | 3 | 4;
  category: string;
  documentUrl?: string;
  contentMarkdown?: string;
  allowedRoles: string[];
  version: string;
  owner: string;
}

const SEED_DOCS: KBDocSeed[] = [
  // ─── Tier 2: Visual Cheat Sheets (all roles) ──────────────────────────────
  {
    title: 'AML Alert Triage Quick-Reference Card',
    description:
      'One-page visual cheat sheet for Compliance Officers: red/amber/green disposition matrix for AML alerts.',
    tier: 2,
    category: 'AML',
    documentUrl: '',
    contentMarkdown:
      '# AML Alert Triage Quick-Reference\n\n| Signal | Disposition | SLA |\n|---|---|---|\n| Direct sanctions match | True Positive → Freeze | Immediate |\n| PEP proximity (≤2 hops) | Escalate to CM | 24h |\n| Structuring pattern | Investigate | 48h |\n| Benign anomaly | False Positive → Document | 72h |',
    allowedRoles: [],
    version: '1.0',
    owner: 'Compliance Training Team',
  },
  {
    title: 'goAML Filing Checklist (STR/SAR/CTR)',
    description:
      'Visual checklist of mandatory fields and UPPERCASE XML elements for each goAML report type.',
    tier: 2,
    category: 'goAML',
    documentUrl: '',
    contentMarkdown:
      '# goAML Filing Checklist\n\n## STR/SAR Required Elements\n- REPORT, SUBJECT, ACTIVITY, AMOUNT, CURRENCY, REASON\n- Subject FULLNAME + identifiers\n- Narrative (3-part: reason, subject, transaction)\n\n## CTR Auto-Promotion\n- Triggered at AED 55,000+ threshold\n- Required: FROM, TO, AMOUNT, CURRENCY, TRANSACTION_DATE',
    allowedRoles: [],
    version: '1.1',
    owner: 'MLRO Office',
  },

  // ─── Tier 3: Deep-Dive SOPs (all roles) ───────────────────────────────────
  {
    title: 'SOP: Sanctions Screening & False-Positive Disposition',
    description:
      'Step-by-step Standard Operating Procedure for sanctions screening, true/false-positive determination, and Maker-Checker escalation.',
    tier: 3,
    category: 'Sanctions',
    documentUrl: '',
    contentMarkdown:
      '# SOP: Sanctions Screening & Disposition\n\n## 1. Screening\n1. CO runs name against UAE Local Terrorist List + UN/OFAC lists.\n2. System returns match-score.\n\n## 2. Triage (CO — Maker)\n1. Review match details (name, DOB, nationality, identifiers).\n2. Determine True Positive vs False Positive.\n3. Document evidence in Evidence War Room.\n4. Submit recommendation to CM.\n\n## 3. Maker-Checker Review (CM — Checker)\n1. Review CO evidence.\n2. Approve False Positive OR escalate True Positive to MLRO.\n\n## 4. MLRO Freeze Decision\n1. Authorize sanctions freeze (True Positive).\n2. File blocking report to UAE FIU within statutory deadline.\n\n**Regulatory Reference**: FDL 10/2025 Art. 15; CBUAE Notice 3551/2021 S3.1.',
    allowedRoles: [],
    version: '2.0',
    owner: 'Compliance Manager',
  },
  {
    title: 'SOP: KYC Onboarding & Risk-Rating',
    description:
      'Deep-dive SOP for individual and corporate KYC, CDD/EDD application, and risk-rating methodology with CM approval gates.',
    tier: 3,
    category: 'KYC',
    documentUrl: '',
    contentMarkdown:
      '# SOP: KYC Onboarding & Risk-Rating\n\n## CDD Steps\n1. Collect identification (Emirates ID, passport).\n2. Verify identity via identity-provider adapter.\n3. Screen PEP status.\n4. Assign initial risk rating (Low/Medium/High).\n\n## EDD Triggers\n- PEP = yes → EDD required.\n- High-risk jurisdiction → EDD required.\n- High premium (AED 50,000+) → EDD required.\n\n## CM Approval Gate\n- All High-risk customers require CM approval before activation.\n\n**Regulatory Reference**: FDL 10/2025 Art. 16/17; CBUAE Notice 3551/2021 S2.4; CR 134/2025 Art. 12.',
    allowedRoles: [],
    version: '1.5',
    owner: 'Compliance Manager',
  },

  // ─── Tier 4: Strategic Governance Manuals (RESTRICTED — board + mlro only) ─
  {
    title: 'Board Governance Manual: AML/CFT Oversight Framework',
    description:
      'Strategic governance manual for Board Members and MLRO. Covers board-level oversight responsibilities, risk-appetite statements, and quarterly assurance reporting. RESTRICTED to Board + MLRO only.',
    tier: 4,
    category: 'Governance',
    documentUrl: '',
    contentMarkdown:
      '# Board Governance Manual: AML/CFT Oversight\n\n## Board Oversight Responsibilities\n1. Approve the AML/CFT Compliance Framework annually.\n2. Review quarterly KRI/KPI dashboards (anonymized, aggregated).\n3. Ensure MLRO independence and direct reporting line.\n4. Approve risk-appetite statement for financial crime.\n\n## Quarterly Assurance Reporting\n- MLRO presents quarterly compliance posture to the Board.\n- Includes: SAR filing volume, SLA adherence, training completion, audit findings.\n- Board minutes record review and any directives.\n\n## Access Restriction\nThis document is restricted to Board Members and the MLRO per Section 10.7 (View-Only) and the Tiered Enablement Framework. System Administrators have NO access (SoD).\n\n**Regulatory Reference**: CR 134/2025 Art. 21 (Board oversight); CBUAE Notice 3551/2021 S3.1.',
    allowedRoles: ['board', 'mlro'],
    version: '3.0',
    owner: 'Board Secretary',
  },
  {
    title: 'MLRO Delegation & Break-Glass Protocol (Governance)',
    description:
      'Strategic governance manual covering DMLRO delegation authority, break-glass emergency access protocol, and MLRO accountability. RESTRICTED to Board + MLRO only.',
    tier: 4,
    category: 'Governance',
    documentUrl: '',
    contentMarkdown:
      '# MLRO Delegation & Break-Glass Protocol\n\n## DMLRO Delegation\n- MLRO may delegate operational tasks to a Deputy MLRO (DMLRO).\n- Delegation is time-bound and audit-logged.\n- MLRO retains final accountability for all filings.\n\n## Break-Glass Emergency Access\n- Activated ONLY by the MLRO (Admin CANNOT activate).\n- Grants temporary PII/SAR access for emergency regulatory response.\n- Auto-expires (default 4 hours).\n- Full audit trail + post-hoc review mandatory.\n\n**Regulatory Reference**: CR 134/2025 Art. 21; FDL 10/2025 Art. 15.',
    allowedRoles: ['board', 'mlro'],
    version: '2.1',
    owner: 'MLRO Office',
  },
];

async function main() {
  const existing = await db.knowledgeBaseDocument.count();
  if (existing > 0) {
    console.log(`KnowledgeBaseDocument: already has ${existing} records, skipping.`);
    return 0;
  }

  console.log(`Seeding ${SEED_DOCS.length} Knowledge Base documents...`);
  for (const doc of SEED_DOCS) {
    await db.knowledgeBaseDocument.create({
      data: {
        title: doc.title,
        description: doc.description,
        tier: doc.tier,
        category: doc.category,
        documentUrl: doc.documentUrl || null,
        contentMarkdown: doc.contentMarkdown,
        allowedRoles: JSON.stringify(doc.allowedRoles),
        status: 'published',
        version: doc.version,
        owner: doc.owner,
      },
    });
  }

  console.log(`Seed complete: ${SEED_DOCS.length} Knowledge Base documents.`);
  return SEED_DOCS.length;
}

main()
  .then((n) => {
    console.log(`Done. ${n} records seeded.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
