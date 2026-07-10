/**
 * ============================================================================
 * Seed: Board Documents (v7.3.0-uat-hotfix-5)
 * ============================================================================
 *
 * Purpose:
 *   Seeds 5 BoardDocument records so the Board Portal section (restored in
 *   hotfix-5) displays real content instead of an empty state during UAT.
 *   Covers all 4 documentType enum values and 2 of 3 status values.
 *
 * Idempotency:
 *   Gates on `db.boardDocument.count() > 0`. Re-running on a populated table
 *   is a no-op (prints "already has N records, skipping").
 *
 * Usage:
 *   bun run prisma/seed-board-documents.ts
 *
 * Related:
 *   - RCA_P2_REGRESSION.md §5.2 (board-portal was one of the 7 invisible P1 sections)
 *   - UAT_ENVIRONMENT_RUNBOOK.md (hotfix log)
 * ============================================================================
 */

import { db } from '@/lib/db';

interface BoardDocSeed {
  title: string;
  documentType: string;
  content: string;
  status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
  publishedBy: string;
  daysAgo: number;
}

const BOARD_DOC_SEEDS: BoardDocSeed[] = [
  {
    title: 'FY2025 Annual Compliance Report',
    documentType: 'ANNUAL_COMPLIANCE_REPORT',
    content:
      'Comprehensive annual compliance report covering all regulatory obligations under CBUAE FDL 10/2025, CR 134/2025, and MOHRE labor regulations. Includes KRI performance, audit findings remediation status, AML/CFT program effectiveness, and board attestations for the fiscal year 2025.',
    status: 'PUBLISHED',
    publishedBy: 'UCO UAT Compliance Officer',
    daysAgo: 14,
  },
  {
    title: 'Risk Appetite Statement 2025',
    documentType: 'RISK_APPETITE_STATEMENT',
    content:
      'Board-approved Risk Appetite Statement defining the maximum tolerable risk across compliance, operational, financial, and strategic risk categories. Establishes KRI thresholds, escalation triggers, and the governance framework for risk acceptance decisions within the insurance compliance program.',
    status: 'PUBLISHED',
    publishedBy: 'admin@icos.ae',
    daysAgo: 30,
  },
  {
    title: 'Board Minutes — Q2 2025 Compliance Committee Meeting',
    documentType: 'BOARD_MINUTES',
    content:
      'Minutes from the Q2 2025 Board Compliance Committee meeting. Agenda items: (1) Q1 compliance dashboard review, (2) CBUAE examination findings remediation, (3) AML/CFT program annual review, (4) TPRM risk assessment results, (5) Resiliency and BCP test outcomes, (6) Board attestation of policy acknowledgments.',
    status: 'PUBLISHED',
    publishedBy: 'admin@icos.ae',
    daysAgo: 21,
  },
  {
    title: 'AML/CFT Policy Update v7.3 — Board Notification',
    documentType: 'POLICY_UPDATE',
    content:
      'Notification of AML/CFT policy updates effective v7.3.0, incorporating CBUAE FDL 10/2025 enhanced due diligence requirements, revised SAR escalation thresholds, and updated goAML XML submission timelines. Board members are required to acknowledge receipt and review within 14 days.',
    status: 'PUBLISHED',
    publishedBy: 'UMO UAT MLRO Officer',
    daysAgo: 7,
  },
  {
    title: 'Draft: Cybersecurity Incident Response Framework',
    documentType: 'POLICY_UPDATE',
    content:
      'Draft cybersecurity incident response framework aligned with NIST CSF and UAE NESA standards. Defines incident severity classification, response timelines (RTO/RPO), breach notification requirements under FDL 10/2025 Article 18, and coordination protocols with CBUAE and UAE Computer Emergency Response Team (aeCERT).',
    status: 'DRAFT',
    publishedBy: 'admin@icos.ae',
    daysAgo: 3,
  },
];

async function seedBoardDocuments(): Promise<number> {
  const existing = await db.boardDocument.count();
  if (existing > 0) {
    console.log(`BoardDocument: already has ${existing} records, skipping.`);
    return 0;
  }

  const now = new Date();
  await db.$transaction(
    BOARD_DOC_SEEDS.map((doc) =>
      db.boardDocument.create({
        data: {
          title: doc.title,
          documentType: doc.documentType,
          content: doc.content,
          status: doc.status,
          publishedAt: doc.status === 'PUBLISHED' ? new Date(now.getTime() - doc.daysAgo * 86400000) : null,
          publishedBy: doc.publishedBy,
          watermarkEnabled: true,
        },
      }),
    ),
  );
  console.log(`BoardDocument: seeded ${BOARD_DOC_SEEDS.length} records.`);
  return BOARD_DOC_SEEDS.length;
}

async function main() {
  console.log('═══ Board Document Seed (v7.3.0-uat-hotfix-5) ═══');
  const seeded = await seedBoardDocuments();
  const total = await db.boardDocument.count();
  console.log(`Seed complete: ${seeded} new board documents. Total now: ${total}.`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
