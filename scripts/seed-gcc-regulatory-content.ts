/**
 * GCC Multi-Jurisdictional Framework — Phase 3.3 Seed
 * Localized Regulatory Content & Mock Policies
 * ──────────────────────────────────────────────
 * Seeds realistic mock regulatory circulars for the 5 non-UAE GCC jurisdictions
 * so that dashboards are not empty during UAT. Also seeds one KSA SAR-filing
 * policy so the AI Master Brain verification scenario ("What is the deadline
 * for filing a SAR under our internal policies?") can cite a KSA-scoped SOP
 * instead of leaking UAE FDL 10/2025.
 *
 * Run: bun run scripts/seed-gcc-regulatory-content.ts
 *
 * Idempotent: re-running upserts by [jurisdictionId, circularNumber] and
 * [jurisdictionId, policyNumber]. Safe to run multiple times.
 */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

// ─── Helper: deterministic SHA-256 document hash ─────────────────────────────
function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

// ─── Helper: parse a YYYY-MM-DD string into a Date ───────────────────────────
function date(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

interface MockCircular {
  jurisdictionCode: 'SA' | 'BH' | 'QA' | 'OM' | 'KW';
  circularNumber: string;
  title: string;
  regulator: string;      // SAMA, CBB, QCB, CBOA, CBK
  issuingAuthority: string;
  summary: string;
  riskImpactLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  publicationDate: string; // ISO yyyy-mm-dd
  effectiveDate: string;   // ISO yyyy-mm-dd
  affectedDepartments: string[];
  keyObligations: Array<{ actionItem: string; affectedDept: string; deadlineDays: number | null }>;
  documentBody: string;
}

const MOCK_CIRCULARS: MockCircular[] = [
  // ─── KSA (SA) — 2 circulars ───────────────────────────────────────────────
  {
    jurisdictionCode: 'SA',
    circularNumber: 'SAMA/AML/2024/001',
    title: 'SAMA AML/CFT Guidelines for Insurance Providers',
    regulator: 'SAMA',
    issuingAuthority: 'Saudi Central Bank (SAMA)',
    summary:
      'Comprehensive AML/CFT guidelines issued by SAMA applicable to all insurance and reinsurance ' +
      'companies operating in the Kingdom of Saudi Arabia. Covers customer due diligence, beneficial ' +
      'ownership identification, suspicious transaction reporting, sanctions screening, and record-keeping ' +
      'obligations under Saudi Law No. 20/2018 on Anti-Money Laundering.',
    riskImpactLevel: 'HIGH',
    publicationDate: '2024-03-15',
    effectiveDate: '2024-06-01',
    affectedDepartments: ['Compliance', 'Underwriting', 'Claims', 'Finance'],
    keyObligations: [
      { actionItem: 'Establish and maintain a written AML/CFT compliance program approved by the Board', affectedDept: 'Compliance', deadlineDays: 90 },
      { actionItem: 'Appoint a qualified MLRO reporting directly to the SAMA Governor for STR filings', affectedDept: 'Compliance', deadlineDays: 60 },
      { actionItem: 'Implement automated sanctions screening against UN, OFAC, EU, and SAMA consolidated lists', affectedDept: 'Compliance', deadlineDays: 120 },
      { actionItem: 'Conduct Enhanced Due Diligence (EDD) on all high-risk customers including PEPs', affectedDept: 'Underwriting', deadlineDays: 90 },
      { actionItem: 'Submit STRs to SAMA via the goAML portal within 30 days of detection', affectedDept: 'Compliance', deadlineDays: 30 },
      { actionItem: 'Retain all AML records, CDD documentation, and transaction records for a minimum of 10 years', affectedDept: 'Finance', deadlineDays: null },
    ],
    documentBody:
      'SAUDI CENTRAL BANK (SAMA)\nAnti-Money Laundering and Counter-Terrorist Financing Guidelines for Insurance Providers\n' +
      'Reference: SAMA/AML/2024/001\nPublication Date: 15 March 2024\nEffective Date: 1 June 2024\n\n' +
      'Pursuant to Saudi Law No. 20/2018 on Anti-Money Laundering and SAMA\'s supervisory mandate over ' +
      'insurance companies, the following binding guidelines are issued...\n[Full circular text omitted for brevity]',
  },
  {
    jurisdictionCode: 'SA',
    circularNumber: 'CCHI/2024/002',
    title: 'CCHI Unified Insurance Policy Wordings',
    regulator: 'CCHI',
    issuingAuthority: 'Council of Cooperative Health Insurance (CCHI)',
    summary:
      'Mandatory unified policy wordings for cooperative health insurance issued by CCHI. All insurers ' +
      'offering health insurance products in KSA must adopt the standardized policy template, definitions, ' +
      'coverage scope, and exclusions. Non-compliance results in regulatory sanctions.',
    riskImpactLevel: 'MEDIUM',
    publicationDate: '2024-05-20',
    effectiveDate: '2024-09-01',
    affectedDepartments: ['Underwriting', 'Compliance', 'Legal'],
    keyObligations: [
      { actionItem: 'Migrate all existing health insurance policies to the unified CCHI wording by 1 September 2024', affectedDept: 'Underwriting', deadlineDays: 100 },
      { actionItem: 'Update policy issuance systems to enforce CCHI-standard definitions and exclusions', affectedDept: 'Underwriting', deadlineDays: 90 },
      { actionItem: 'Train underwriting staff on the unified wording requirements', affectedDept: 'Compliance', deadlineDays: 60 },
    ],
    documentBody:
      'COUNCIL OF COOPERATIVE HEALTH INSURANCE (CCHI)\nUnified Insurance Policy Wordings\n' +
      'Reference: CCHI/2024/002\nPublication Date: 20 May 2024\nEffective Date: 1 September 2024\n\n' +
      'In exercise of the powers conferred by the Cooperative Health Insurance Law...',
  },
  // ─── Bahrain (BH) — 2 circulars ───────────────────────────────────────────
  {
    jurisdictionCode: 'BH',
    circularNumber: 'CBB/IRM/2024/001',
    title: 'CBB Insurance Regulation Module',
    regulator: 'CBB',
    issuingAuthority: 'Central Bank of Bahrain (CBB)',
    summary:
      'Updated Volume 3 (Insurance) Module of the CBB Rulebook. Introduces enhanced governance, risk ' +
      'management, and solvency requirements for insurers licensed in the Kingdom of Bahrain, aligned with ' +
      'IAIS Insurance Core Principles. Applies to both conventional and takaful insurers.',
    riskImpactLevel: 'HIGH',
    publicationDate: '2024-02-10',
    effectiveDate: '2024-07-01',
    affectedDepartments: ['Compliance', 'Risk Management', 'Finance', 'Actuarial'],
    keyObligations: [
      { actionItem: 'Establish an independent Risk Management Function headed by a Chief Risk Officer reporting to the Board Risk Committee', affectedDept: 'Risk Management', deadlineDays: 120 },
      { actionItem: 'Maintain minimum solvency margin of 150% of the prescribed capital under the new CBB framework', affectedDept: 'Finance', deadlineDays: 180 },
      { actionItem: 'Conduct annual Own Risk and Solvency Assessment (ORSA) and submit to CBB by 31 March each year', affectedDept: 'Actuarial', deadlineDays: 270 },
      { actionItem: 'Implement Board-approved Remuneration Policy aligned with CBB sound compensation principles', affectedDept: 'Compliance', deadlineDays: 90 },
    ],
    documentBody:
      'CENTRAL BANK OF BAHRAIN (CBB)\nVolume 3 — Insurance Business Module (Updated)\n' +
      'Reference: CBB/IRM/2024/001\nPublication Date: 10 February 2024\nEffective Date: 1 July 2024\n\n' +
      'The Central Bank of Bahrain, in exercise of the powers conferred under Article 44 of the Central Bank ' +
      'of Bahrain and Financial Institutions Law 2006...',
  },
  {
    jurisdictionCode: 'BH',
    circularNumber: 'BH-FIU/TYP/2024/002',
    title: 'Bahrain FIU Typologies Report — Insurance Sector',
    regulator: 'CBB',
    issuingAuthority: 'Bahrain Financial Intelligence Unit (Bahrain FIU)',
    summary:
      'Advisory report from the Bahrain FIU highlighting emerging money laundering and terrorist financing ' +
      'typologies observed in the insurance sector. Includes red-flag indicators for single-premium life ' +
      'policies, early surrender anomalies, and cross-border premium financing schemes.',
    riskImpactLevel: 'MEDIUM',
    publicationDate: '2024-04-05',
    effectiveDate: '2024-04-05',
    affectedDepartments: ['Compliance', 'AML', 'Underwriting', 'Claims'],
    keyObligations: [
      { actionItem: 'Incorporate the 17 red-flag indicators into the transaction monitoring rules engine', affectedDept: 'AML', deadlineDays: 60 },
      { actionItem: 'Review all single-premium life policies > BHD 50,000 originated in the past 12 months against the typology indicators', affectedDept: 'Underwriting', deadlineDays: 90 },
      { actionItem: 'Train AML investigations staff on the new typologies via the Bahrain FIU e-learning portal', affectedDept: 'Compliance', deadlineDays: 45 },
    ],
    documentBody:
      'BAHRAIN FINANCIAL INTELLIGENCE UNIT\nInsurance Sector ML/TF Typologies Report\n' +
      'Reference: BH-FIU/TYP/2024/002\nPublication Date: 5 April 2024\n\n' +
      'This advisory report is issued by the Bahrain FIU pursuant to Decree-Law No. 54 of 2006...',
  },
  // ─── Qatar (QA) — 1 circular ──────────────────────────────────────────────
  {
    jurisdictionCode: 'QA',
    circularNumber: 'QCB/AML/2024/001',
    title: 'QCB Anti-Money Laundering Regulations',
    regulator: 'QCB',
    issuingAuthority: 'Qatar Central Bank (QCB)',
    summary:
      'Updated AML/CFT regulations issued by QCB under Law No. 20 of 2019 on Anti-Money Laundering and ' +
      'Combating the Financing of Terrorism. Applies to all financial institutions including insurers ' +
      'operating in the State of Qatar, covering both domestic and QFC-licensed entities.',
    riskImpactLevel: 'CRITICAL',
    publicationDate: '2024-01-25',
    effectiveDate: '2024-04-01',
    affectedDepartments: ['Compliance', 'Underwriting', 'Claims', 'Legal'],
    keyObligations: [
      { actionItem: 'Conduct enterprise-wide AML/CFT risk assessment using the QCB-prescribed methodology and submit to QCB', affectedDept: 'Compliance', deadlineDays: 120 },
      { actionItem: 'Implement targeted financial sanctions controls compliant with UN Security Council resolutions', affectedDept: 'Compliance', deadlineDays: 60 },
      { actionItem: 'Report STRs to the Qatar FIU via the goAML platform within 35 days of detection', affectedDept: 'Compliance', deadlineDays: 35 },
      { actionItem: 'Maintain CDD records for minimum 5 years post relationship termination', affectedDept: 'Legal', deadlineDays: null },
    ],
    documentBody:
      'QATAR CENTRAL BANK (QCB)\nAnti-Money Laundering and Counter-Terrorist Financing Regulations\n' +
      'Reference: QCB/AML/2024/001\nPublication Date: 25 January 2024\nEffective Date: 1 April 2024\n\n' +
      'In implementation of the provisions of Law No. 20 of 2019 on Anti-Money Laundering and Combating ' +
      'the Financing of Terrorism...',
  },
  // ─── Oman (OM) — 1 circular ───────────────────────────────────────────────
  {
    jurisdictionCode: 'OM',
    circularNumber: 'CBOA/ICL/2024/001',
    title: 'CBOA Insurance Companies Law Amendments',
    regulator: 'CBOA',
    issuingAuthority: 'Capital Market Authority of Oman (CBOA)',
    summary:
      'Amendments to the Insurance Companies Law issued by the Oman Capital Market Authority. Introduces ' +
      'enhanced licensing requirements, mandatory local retention quotas, and revised corporate governance ' +
      'standards for insurers operating in the Sultanate of Oman.',
    riskImpactLevel: 'MEDIUM',
    publicationDate: '2024-06-12',
    effectiveDate: '2024-12-01',
    affectedDepartments: ['Legal', 'Compliance', 'Underwriting', 'Finance'],
    keyObligations: [
      { actionItem: 'Submit revised corporate governance framework to CBOA for approval', affectedDept: 'Compliance', deadlineDays: 150 },
      { actionItem: 'Maintain minimum 30% local retention on all property and casualty lines', affectedDept: 'Underwriting', deadlineDays: 90 },
      { actionItem: 'Appoint a CBOA-approved Actuary for technical provisions certification', affectedDept: 'Finance', deadlineDays: 120 },
    ],
    documentBody:
      'CAPITAL MARKET AUTHORITY OF OMAN (CBOA)\nInsurance Companies Law — Amendments\n' +
      'Reference: CBOA/ICL/2024/001\nPublication Date: 12 June 2024\nEffective Date: 1 December 2024\n\n' +
      'In exercise of the powers conferred by Royal Decree No. 12/2019 issuing the Insurance Companies Law...',
  },
  // ─── Kuwait (KW) — 1 circular ─────────────────────────────────────────────
  {
    jurisdictionCode: 'KW',
    circularNumber: 'CBK/ISG/2024/001',
    title: 'CBK Insurance Sector Governance Guidelines',
    regulator: 'CBK',
    issuingAuthority: 'Central Bank of Kuwait (CBK)',
    summary:
      'Corporate governance guidelines issued by CBK for the insurance sector. Establishes requirements ' +
      'for Board composition, independent directors, audit committees, internal audit functions, and ' +
      'related-party transaction controls. Applies to all Kuwaiti-domiciled insurers.',
    riskImpactLevel: 'HIGH',
    publicationDate: '2024-03-28',
    effectiveDate: '2024-10-01',
    affectedDepartments: ['Compliance', 'Legal', 'Internal Audit', 'Finance'],
    keyObligations: [
      { actionItem: 'Ensure at least one-third of Board members are independent non-executive directors', affectedDept: 'Legal', deadlineDays: 120 },
      { actionItem: 'Establish a Board Audit Committee chaired by an independent director with financial expertise', affectedDept: 'Internal Audit', deadlineDays: 90 },
      { actionItem: 'Implement internal audit function reporting administratively to the CEO and functionally to the Audit Committee', affectedDept: 'Internal Audit', deadlineDays: 150 },
      { actionItem: 'Disclose all related-party transactions exceeding KWD 50,000 in the annual report', affectedDept: 'Finance', deadlineDays: null },
    ],
    documentBody:
      'CENTRAL BANK OF KUWAIT (CBK)\nInsurance Sector Governance Guidelines\n' +
      'Reference: CBK/ISG/2024/001\nPublication Date: 28 March 2024\nEffective Date: 1 October 2024\n\n' +
      'Pursuant to Law No. 32 of 1968 concerning Currency, the Central Bank of Kuwait, and the Organization ' +
      'of Banking...',
  },
];

// ─── Mock KSA Policy (for AI Master Brain verification scenario) ──────────────
// When the verification asks "What is the deadline for filing a SAR under our
// internal policies?" while in KSA context, the AI must cite THIS policy
// (SAR filing within 30 days of detection per SAMA guidelines) — NOT UAE FDL.
interface MockPolicy {
  jurisdictionCode: 'SA';
  policyNumber: string;
  title: string;
  category: string;
  department: string;
  owner: string;
  status: 'published' | 'draft' | 'under_review';
  version: string;
  aiReviewed: boolean;
  aiConfidence: number;
  reviewDate: string;
  approvalDate: string;
  approvedBy: string;
  documentUrl: string | null;
}

const MOCK_POLICIES: MockPolicy[] = [
  {
    jurisdictionCode: 'SA',
    policyNumber: 'POL-SA-SAR-001',
    title: 'Suspicious Activity Report (SAR) Filing & Escalation Procedure — KSA',
    category: 'AML / CFT',
    department: 'Compliance',
    owner: 'KSA MLRO Office',
    status: 'published',
    version: '2.1',
    aiReviewed: true,
    aiConfidence: 0.92,
    reviewDate: '2024-09-15',
    approvalDate: '2024-09-20',
    approvedBy: 'KSA Chief Compliance Officer',
    documentUrl: null,
  },
  {
    jurisdictionCode: 'SA',
    policyNumber: 'POL-SA-CDD-002',
    title: 'Customer Due Diligence & Enhanced Due Diligence Standard — KSA',
    category: 'AML / CFT',
    department: 'Compliance',
    owner: 'KSA MLRO Office',
    status: 'published',
    version: '1.4',
    aiReviewed: true,
    aiConfidence: 0.88,
    reviewDate: '2024-08-01',
    approvalDate: '2024-08-10',
    approvedBy: 'KSA Chief Compliance Officer',
    documentUrl: null,
  },
  {
    jurisdictionCode: 'BH',
    policyNumber: 'POL-BH-ORSA-001',
    title: 'Own Risk and Solvency Assessment (ORSA) Framework — Bahrain',
    category: 'Risk Management',
    department: 'Risk Management',
    owner: 'Bahrain CRO Office',
    status: 'published',
    version: '1.0',
    aiReviewed: false,
    aiConfidence: 0.0,
    reviewDate: '2024-07-20',
    approvalDate: '2024-07-25',
    approvedBy: 'Bahrain Board Risk Committee',
    documentUrl: null,
  },
  {
    jurisdictionCode: 'QA',
    policyNumber: 'POL-QA-SANCTIONS-001',
    title: 'Targeted Financial Sanctions Compliance Procedure — Qatar',
    category: 'Sanctions',
    department: 'Compliance',
    owner: 'Qatar Compliance Office',
    status: 'published',
    version: '1.1',
    aiReviewed: true,
    aiConfidence: 0.85,
    reviewDate: '2024-05-10',
    approvalDate: '2024-05-15',
    approvedBy: 'Qatar Chief Compliance Officer',
    documentUrl: null,
  },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌍 GCC Phase 3.3 — Localized Regulatory Content Seed');
  console.log('══════════════════════════════════════════════════════\n');

  // ── 1. Resolve jurisdiction IDs ──────────────────────────────────────────
  const jurisdictions = await prisma.jurisdiction.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, regulatorName: true },
  });
  const jMap = new Map(jurisdictions.map((j) => [j.code, j]));

  if (jMap.size === 0) {
    throw new Error(
      'No jurisdictions found. Run scripts/seed-gcc-jurisdictions.ts first.',
    );
  }
  console.log(`  Found ${jMap.size} active jurisdictions: ${[...jMap.keys()].join(', ')}\n`);

  // ── 2. Seed mock regulatory circulars ────────────────────────────────────
  console.log('Step 1: Seeding mock regulatory circulars…');
  let circularCount = 0;
  for (const mock of MOCK_CIRCULARS) {
    const jur = jMap.get(mock.jurisdictionCode);
    if (!jur) {
      console.warn(`  ⚠️  Jurisdiction ${mock.jurisdictionCode} not found — skipping ${mock.circularNumber}`);
      continue;
    }

    const documentHash = sha256(`GCC-PHASE3-${mock.jurisdictionCode}-${mock.circularNumber}-${mock.documentBody}`);
    const keyObligationsJson = JSON.stringify(mock.keyObligations);
    const rawExtractedJson = JSON.stringify({
      circularNumber: mock.circularNumber,
      title: mock.title,
      issuingAuthority: mock.issuingAuthority,
      publicationDate: mock.publicationDate,
      effectiveDate: mock.effectiveDate,
      summary: mock.summary,
      riskImpactLevel: mock.riskImpactLevel,
      affectedDepartments: mock.affectedDepartments,
      keyObligations: mock.keyObligations,
    });

    // Upsert by [jurisdictionId, circularNumber] (the schema's unique constraint)
    const existing = await prisma.regulatoryCircular.findFirst({
      where: { jurisdictionId: jur.id, circularNumber: mock.circularNumber },
      select: { id: true },
    });

    if (existing) {
      await prisma.regulatoryCircular.update({
        where: { id: existing.id },
        data: {
          title: mock.title,
          regulator: mock.regulator,
          effectiveDate: date(mock.effectiveDate),
          status: 'PUBLISHED',
          summary: mock.summary,
          affectedDepts: mock.affectedDepartments.join(','),
          issuingAuthority: mock.issuingAuthority,
          publicationDate: date(mock.publicationDate),
          riskImpactLevel: mock.riskImpactLevel,
          ingestionMethod: 'MANUAL_UPLOAD',
          version: 1,
          keyObligations: keyObligationsJson,
          rawExtractedJson,
          documentHash,
          committedAt: date(mock.publicationDate),
          committedById: 'system-gcc-phase3-seed',
          jurisdictionId: jur.id,
        },
      });
      console.log(`  🔄 Updated  ${mock.jurisdictionCode} ${mock.circularNumber} — ${mock.title}`);
    } else {
      const created = await prisma.regulatoryCircular.create({
        data: {
          title: mock.title,
          regulator: mock.regulator,
          circularNumber: mock.circularNumber,
          effectiveDate: date(mock.effectiveDate),
          status: 'PUBLISHED',
          summary: mock.summary,
          affectedDepts: mock.affectedDepartments.join(','),
          issuingAuthority: mock.issuingAuthority,
          publicationDate: date(mock.publicationDate),
          riskImpactLevel: mock.riskImpactLevel,
          ingestionMethod: 'MANUAL_UPLOAD',
          version: 1,
          supersedesId: null,
          keyObligations: keyObligationsJson,
          rawExtractedJson,
          documentHash,
          ingestionLogId: null,
          committedAt: date(mock.publicationDate),
          committedById: 'system-gcc-phase3-seed',
          jurisdictionId: jur.id,
        },
      });
      console.log(`  ✅ Created  ${mock.jurisdictionCode} ${mock.circularNumber} — ${mock.title} (${created.id.slice(-8)})`);
      circularCount++;
    }

    // Fan out ExtractedObligation rows (idempotent: delete + recreate for this circular)
    const circular = await prisma.regulatoryCircular.findFirst({
      where: { jurisdictionId: jur.id, circularNumber: mock.circularNumber },
      select: { id: true },
    });
    if (circular) {
      await prisma.extractedObligation.deleteMany({ where: { circularId: circular.id } });
      if (mock.keyObligations.length > 0) {
        await prisma.extractedObligation.createMany({
          data: mock.keyObligations.map((o) => ({
            circularId: circular.id,
            actionItem: o.actionItem,
            affectedDept: o.affectedDept,
            deadlineDays: o.deadlineDays,
            status: 'OPEN',
          })),
        });
      }
    }
  }

  // ── 3. Seed mock policies ────────────────────────────────────────────────
  console.log('\nStep 2: Seeding mock jurisdiction-scoped policies…');
  let policyCount = 0;
  for (const mock of MOCK_POLICIES) {
    const jur = jMap.get(mock.jurisdictionCode);
    if (!jur) {
      console.warn(`  ⚠️  Jurisdiction ${mock.jurisdictionCode} not found — skipping ${mock.policyNumber}`);
      continue;
    }

    const existing = await prisma.policy.findFirst({
      where: { jurisdictionId: jur.id, policyNumber: mock.policyNumber },
      select: { id: true },
    });

    if (existing) {
      await prisma.policy.update({
        where: { id: existing.id },
        data: {
          title: mock.title,
          category: mock.category,
          department: mock.department,
          owner: mock.owner,
          status: mock.status,
          version: mock.version,
          aiReviewed: mock.aiReviewed,
          aiConfidence: mock.aiConfidence,
          reviewDate: date(mock.reviewDate),
          approvalDate: date(mock.approvalDate),
          approvedBy: mock.approvedBy,
          documentUrl: mock.documentUrl,
          jurisdictionId: jur.id,
        },
      });
      console.log(`  🔄 Updated  ${mock.jurisdictionCode} ${mock.policyNumber} — ${mock.title}`);
    } else {
      await prisma.policy.create({
        data: {
          policyNumber: mock.policyNumber,
          title: mock.title,
          category: mock.category,
          department: mock.department,
          owner: mock.owner,
          status: mock.status,
          version: mock.version,
          aiReviewed: mock.aiReviewed,
          aiConfidence: mock.aiConfidence,
          reviewDate: date(mock.reviewDate),
          approvalDate: date(mock.approvalDate),
          approvedBy: mock.approvedBy,
          documentUrl: mock.documentUrl,
          jurisdictionId: jur.id,
        },
      });
      console.log(`  ✅ Created  ${mock.jurisdictionCode} ${mock.policyNumber} — ${mock.title}`);
      policyCount++;
    }
  }

  // ── 4. Verification summary ──────────────────────────────────────────────
  console.log('\nStep 3: Verification — per-jurisdiction content counts…');
  const summary = await prisma.jurisdiction.findMany({
    where: { isActive: true },
    select: {
      code: true,
      name: true,
      regulatorName: true,
      _count: { select: { circulars: true, policies: true } },
    },
    orderBy: { code: 'asc' },
  });
  console.log('\n  Jurisdiction | Circulars | Policies | Regulator');
  console.log('  ─────────────────────────────────────────────────');
  for (const j of summary) {
    console.log(`  ${j.code} (${j.regulatorName.padEnd(6)}) |    ${String(j._count.circulars).padStart(2)}     |    ${String(j._count.policies).padStart(2)}    | ${j.name}`);
  }

  console.log(`\n✅ GCC Phase 3.3 seed complete.`);
  console.log(`   Seeded ${MOCK_CIRCULARS.length} mock circulars (${circularCount} new) and ${MOCK_POLICIES.length} mock policies (${policyCount} new).`);
  console.log('   KSA SAR policy (POL-SA-SAR-001) is now available for AI Master Brain verification.\n');
}

main()
  .catch((e) => {
    console.error('❌ GCC Phase 3.3 seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
