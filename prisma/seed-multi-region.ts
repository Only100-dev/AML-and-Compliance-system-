/**
 * Multi-Region Seed Script — Addendum C
 * Seeds baseline mock data for the 5 non-UAE GCC jurisdictions:
 *   KSA (SA), Bahrain (BH), Qatar (QA), Oman (OM), Kuwait (KW)
 *
 * Uses create with jurisdiction-prefixed unique identifiers to avoid collisions
 * with existing UAE data. All records default to CBUAE-safe values in the schema;
 * this script explicitly sets the jurisdiction code for each GCC region.
 *
 * Run: bun run prisma/seed-multi-region.ts
 */

import { db } from '../src/lib/db';

// ─── Jurisdiction Context Mapping ─────────────────────────────────────────────
interface JurisdictionContext {
  code: string;               // DB jurisdiction value
  name: string;               // Display name
  regulator: string;          // Central bank / regulator code
  regulatorFull: string;      // Full regulator name
  fiuName: string;            // Financial Intelligence Unit name
  currency: string;           // Local currency code
  laborAuthority: string;     // Labor market authority
  socialInsurance: string;    // Social insurance authority
  laborAuthorityFull: string; // Full labor authority name
  socialInsuranceFull: string;// Full social insurance name
  prefix: string;             // 2-letter prefix for unique IDs
}

const JURISDICTIONS: JurisdictionContext[] = [
  {
    code: 'SA',
    name: 'Kingdom of Saudi Arabia',
    regulator: 'SAMA',
    regulatorFull: 'Saudi Central Bank (SAMA)',
    fiuName: 'SAMA Financial Intelligence Unit',
    currency: 'SAR',
    laborAuthority: 'MHRSD',
    laborAuthorityFull: 'Ministry of Human Resources and Social Development',
    socialInsurance: 'GOSI',
    socialInsuranceFull: 'General Organization for Social Insurance',
    prefix: 'SA',
  },
  {
    code: 'BH',
    name: 'Kingdom of Bahrain',
    regulator: 'CBB',
    regulatorFull: 'Central Bank of Bahrain',
    fiuName: 'CBB Financial Intelligence Directorate',
    currency: 'BHD',
    laborAuthority: 'LMRA',
    laborAuthorityFull: 'Labour Market Regulatory Authority',
    socialInsurance: 'SIO',
    socialInsuranceFull: 'Social Insurance Organization',
    prefix: 'BH',
  },
  {
    code: 'QA',
    name: 'State of Qatar',
    regulator: 'QCB',
    regulatorFull: 'Qatar Central Bank',
    fiuName: 'QCB Financial Information Unit',
    currency: 'QAR',
    laborAuthority: 'MOLQA',
    laborAuthorityFull: 'Ministry of Labour',
    socialInsurance: 'GRSIA',
    socialInsuranceFull: 'General Retirement and Social Insurance Authority',
    prefix: 'QA',
  },
  {
    code: 'OM',
    name: 'Sultanate of Oman',
    regulator: 'CBOA',
    regulatorFull: 'Central Bank of Oman',
    fiuName: 'CBOA Financial Intelligence Unit',
    currency: 'OMR',
    laborAuthority: 'MOLMO',
    laborAuthorityFull: 'Ministry of Labour',
    socialInsurance: 'PASI',
    socialInsuranceFull: 'Public Authority for Social Insurance',
    prefix: 'OM',
  },
  {
    code: 'KW',
    name: 'State of Kuwait',
    regulator: 'CBK',
    regulatorFull: 'Central Bank of Kuwait',
    fiuName: 'CBK Anti-Money Laundering & Terrorist Financing Unit',
    currency: 'KWD',
    laborAuthority: 'MOLKW',
    laborAuthorityFull: 'Ministry of Labour',
    socialInsurance: 'PIFSS',
    socialInsuranceFull: 'Public Institution for Social Security',
    prefix: 'KW',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const now = new Date();
const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

async function seedJurisdiction(ctx: JurisdictionContext): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  console.log(`\n  🏛️  Seeding ${ctx.name} (${ctx.code})...`);

  // 1. Policy
  try {
    await db.policy.create({
      data: {
        policyNumber: `${ctx.prefix}-POL-2024-001`,
        title: `${ctx.regulatorFull} AML/CFT Compliance Policy`,
        category: 'AML',
        version: '1.0',
        status: 'published',
        department: 'Compliance',
        owner: `${ctx.regulator} Compliance Team`,
        jurisdiction: ctx.code,
      },
    });
    counts.policy = 1;
  } catch (e: any) {
    if (e.code === 'P2002') { counts.policy = 0; console.log(`     ⚠️  Policy already exists, skipping`); }
    else throw e;
  }

  // 2. AML Alert
  try {
    await db.aMLAlert.create({
      data: {
        caseId: `${ctx.prefix}-AML-2024-001`,
        riskScore: 72.5,
        riskLevel: 'high',
        alertType: 'suspicious_transaction',
        description: `Suspicious transaction pattern detected in ${ctx.name} — multiple high-value transfers to high-risk jurisdictions`,
        jurisdiction: ctx.code,
        status: 'new',
        amount: 250000,
        policyNumber: `${ctx.prefix}-POL-2024-001`,
      },
    });
    counts.amlAlert = 1;
  } catch (e: any) {
    if (e.code === 'P2002') { counts.amlAlert = 0; console.log(`     ⚠️  AML Alert already exists, skipping`); }
    else throw e;
  }

  // 3. Regulation
  try {
    await db.regulation.create({
      data: {
        title: `${ctx.regulatorFull} AML/CFT Regulations`,
        issuer: ctx.regulator,
        category: 'AML',
        description: `Anti-Money Laundering and Combating the Financing of Terrorism regulations issued by ${ctx.regulatorFull}`,
        effectiveDate: new Date('2024-01-01'),
        nextReviewDate: new Date('2025-01-01'),
        complianceStatus: 'IN_PROGRESS',
        priority: 'high',
        jurisdiction: ctx.code,
      },
    });
    counts.regulation = 1;
  } catch (e: any) {
    if (e.code === 'P2002') { counts.regulation = 0; console.log(`     ⚠️  Regulation already exists, skipping`); }
    else throw e;
  }

  // 4. Compliance Audit
  try {
    await db.complianceAudit.create({
      data: {
        auditNumber: `${ctx.prefix}-AUD-2024-001`,
        title: `${ctx.name} Annual AML/CFT Compliance Audit`,
        auditType: 'regulatory',
        status: 'scheduled',
        scheduledDate: thirtyDaysFromNow,
        leadAuditor: `${ctx.regulator} Audit Division`,
        scope: `Full AML/CFT compliance review for ${ctx.name} operations`,
        jurisdiction: ctx.code,
        riskLevel: 'medium',
      },
    });
    counts.complianceAudit = 1;
  } catch (e: any) {
    if (e.code === 'P2002') { counts.complianceAudit = 0; console.log(`     ⚠️  Compliance Audit already exists, skipping`); }
    else throw e;
  }

  // 5. Calendar Event
  try {
    await db.calendarEvent.create({
      data: {
        title: `${ctx.regulator} Regulatory Filing Deadline`,
        description: `Quarterly regulatory filing deadline for ${ctx.name}`,
        eventType: 'regulatory',
        eventDate: fourteenDaysFromNow,
        priority: 'high',
        jurisdiction: ctx.code,
        status: 'upcoming',
        sourceModule: 'regulatory_deadlines',
      },
    });
    counts.calendarEvent = 1;
  } catch (e: any) {
    if (e.code === 'P2002') { counts.calendarEvent = 0; console.log(`     ⚠️  Calendar Event already exists, skipping`); }
    else throw e;
  }

  // 6. Regulatory Deadline
  try {
    await db.regulatoryDeadline.create({
      data: {
        title: `${ctx.regulator} Quarterly Filing — Q1 2025`,
        deadlineType: 'regulatory_return',
        dueDate: sixtyDaysFromNow,
        jurisdiction: ctx.code,
        status: 'upcoming',
        daysRemaining: 60,
        penaltyForNonCompliance: `Fine up to 500,000 ${ctx.currency} per ${ctx.regulator} regulations`,
      },
    });
    counts.regulatoryDeadline = 1;
  } catch (e: any) {
    if (e.code === 'P2002') { counts.regulatoryDeadline = 0; console.log(`     ⚠️  Regulatory Deadline already exists, skipping`); }
    else throw e;
  }

  // 7. Claim
  try {
    await db.claim.create({
      data: {
        claimNumber: `${ctx.prefix}-CLM-2024-001`,
        policyNumber: `${ctx.prefix}-INS-2024-001`,
        claimType: 'property',
        claimantName: `${ctx.prefix} Client Corp.`,
        description: `Property damage claim filed under ${ctx.name} insurance regulations`,
        amount: 150000,
        fraudScore: 12.5,
        status: 'submitted',
        priority: 'normal',
        jurisdiction: ctx.code,
      },
    });
    counts.claim = 1;
  } catch (e: any) {
    if (e.code === 'P2002') { counts.claim = 0; console.log(`     ⚠️  Claim already exists, skipping`); }
    else throw e;
  }

  // 8. GoAMLFiling (with jurisdiction-specific FIU naming)
  try {
    await db.goAMLFiling.create({
      data: {
        reportType: 'SAR',
        referenceNumber: `${ctx.prefix}-SAR-2024-001`,
        subjectName: `Subject — ${ctx.name} Investigation`,
        amountAED: 500000,
        filingStatus: 'DRAFT',
        xmlPayload: `<SARReport jurisdiction="${ctx.code}" fiu="${ctx.fiuName}"><subject>Test Subject</subject></SARReport>`,
        jurisdiction: ctx.code,
      },
    });
    counts.goAMLFiling = 1;
  } catch (e: any) {
    if (e.code === 'P2002') { counts.goAMLFiling = 0; console.log(`     ⚠️  GoAMLFiling already exists, skipping`); }
    else throw e;
  }

  // 9. ComplianceCase
  try {
    await db.complianceCase.create({
      data: {
        caseNumber: `${ctx.prefix}-CASE-2024-001`,
        title: `${ctx.name} AML Investigation — Suspicious Activity`,
        caseType: 'aml_investigation',
        status: 'open',
        priority: 'high',
        riskLevel: 'high',
        jurisdiction: ctx.code,
        description: `Suspicious activity investigation initiated under ${ctx.regulatorFull} AML/CFT regulations. Case referred by ${ctx.fiuName}.`,
        linkedAlertIds: JSON.stringify([`${ctx.prefix}-AML-2024-001`]),
      },
    });
    counts.complianceCase = 1;
  } catch (e: any) {
    if (e.code === 'P2002') { counts.complianceCase = 0; console.log(`     ⚠️  ComplianceCase already exists, skipping`); }
    else throw e;
  }

  // 10. LaborLawCompliance (with jurisdiction-specific authority names)
  try {
    await db.laborLawCompliance.create({
      data: {
        requirement: `Work permit and residency compliance per ${ctx.laborAuthorityFull}`,
        category: 'Work Permits',
        authority: ctx.laborAuthority,
        complianceStatus: 'COMPLIANT',
        dueDate: ninetyDaysFromNow,
        details: `Ensure all expatriate employees have valid work permits issued by ${ctx.laborAuthorityFull} and social insurance registration with ${ctx.socialInsuranceFull}`,
        quotaType: 'Expatriate Work Permits',
        currentCount: 85,
        requiredCount: 100,
        jurisdiction: ctx.code,
      },
    });
    counts.laborLawCompliance = 1;
  } catch (e: any) {
    if (e.code === 'P2002') { counts.laborLawCompliance = 0; console.log(`     ⚠️  LaborLawCompliance already exists, skipping`); }
    else throw e;
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`     ✅ Created ${total} records for ${ctx.code}`);
  return counts;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌍 Multi-Region Seed — Addendum C');
  console.log(`   Seeding baseline data for ${JURISDICTIONS.length} non-UAE GCC jurisdictions`);
  console.log('   10 record types per jurisdiction (Policy, AML Alert, Regulation, Compliance Audit, Calendar Event, Regulatory Deadline, Claim, GoAMLFiling, ComplianceCase, LaborLawCompliance)');
  console.log('');

  const allCounts: Record<string, Record<string, number>> = {};
  let grandTotal = 0;

  for (const ctx of JURISDICTIONS) {
    const counts = await seedJurisdiction(ctx);
    allCounts[ctx.code] = counts;
    grandTotal += Object.values(counts).reduce((a, b) => a + b, 0);
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('📊 SEED SUMMARY BY JURISDICTION');
  console.log('═'.repeat(60));

  const recordTypes = ['policy', 'amlAlert', 'regulation', 'complianceAudit', 'calendarEvent', 'regulatoryDeadline', 'claim', 'goAMLFiling', 'complianceCase', 'laborLawCompliance'];

  // Header
  const header = `Record Type          |  SA  |  BH  |  QA  |  OM  |  KW  `;
  console.log(header);
  console.log('-'.repeat(header.length));

  // Rows
  for (const rt of recordTypes) {
    const label = rt.padEnd(20);
    const row = JURISDICTIONS.map(j => {
      const c = allCounts[j.code]?.[rt] ?? 0;
      return String(c).padStart(4);
    }).join(' | ');
    console.log(`${label} | ${row}`);
  }

  console.log('-'.repeat(header.length));
  console.log(`Grand total: ${grandTotal} records created`);
  console.log('');

  // ─── Verification: Count all records per jurisdiction across all seeded tables ──
  console.log('📊 Verification — Record counts by jurisdiction:');
  for (const ctx of JURISDICTIONS) {
    const [
      policies, alerts, regulations, audits, events,
      deadlines, claims, filings, cases, labor
    ] = await Promise.all([
      db.policy.count({ where: { jurisdiction: ctx.code } }),
      db.aMLAlert.count({ where: { jurisdiction: ctx.code } }),
      db.regulation.count({ where: { jurisdiction: ctx.code } }),
      db.complianceAudit.count({ where: { jurisdiction: ctx.code } }),
      db.calendarEvent.count({ where: { jurisdiction: ctx.code } }),
      db.regulatoryDeadline.count({ where: { jurisdiction: ctx.code } }),
      db.claim.count({ where: { jurisdiction: ctx.code } }),
      db.goAMLFiling.count({ where: { jurisdiction: ctx.code } }),
      db.complianceCase.count({ where: { jurisdiction: ctx.code } }),
      db.laborLawCompliance.count({ where: { jurisdiction: ctx.code } }),
    ]);
    const total = policies + alerts + regulations + audits + events + deadlines + claims + filings + cases + labor;
    console.log(`   ${ctx.code}: ${total} total records (Policy:${policies} AML:${alerts} Reg:${regulations} Audit:${audits} Cal:${events} Deadline:${deadlines} Claim:${claims} Filing:${filings} Case:${cases} Labor:${labor})`);
  }

  console.log('\n✅ Multi-region seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
