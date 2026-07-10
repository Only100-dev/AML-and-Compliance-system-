/**
 * GCC Multi-Jurisdictional Framework — Phase 1 Seed & Migration
 * ─────────────────────────────────────────────────────────────────
 * 1. Seeds the 6 GCC Jurisdictions (AE, SA, BH, QA, OM, KW).
 * 2. Backfills ALL existing rows to the AE (UAE) jurisdiction so that no
 *    existing UAE data is orphaned. This is idempotent and safe to re-run.
 *
 * Run: bun run scripts/seed-gcc-jurisdictions.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GCC_JURISDICTIONS = [
  {
    code: 'AE',
    name: 'United Arab Emirates',
    regulatorName: 'CBUAE',
    fiuName: 'UAE FIU',
    currency: 'AED',
  },
  {
    code: 'SA',
    name: 'Kingdom of Saudi Arabia',
    regulatorName: 'SAMA',
    fiuName: 'SAFIU',
    currency: 'SAR',
  },
  {
    code: 'BH',
    name: 'Kingdom of Bahrain',
    regulatorName: 'CBB',
    fiuName: 'Bahrain FIU',
    currency: 'BHD',
  },
  {
    code: 'QA',
    name: 'State of Qatar',
    regulatorName: 'QCB',
    fiuName: 'Qatar FIU',
    currency: 'QAR',
  },
  {
    code: 'OM',
    name: 'Sultanate of Oman',
    regulatorName: 'CBOA',
    fiuName: 'Oman FIU',
    currency: 'OMR',
  },
  {
    code: 'KW',
    name: 'State of Kuwait',
    regulatorName: 'CBK',
    fiuName: 'Kuwait FIU',
    currency: 'KWD',
  },
];

async function main() {
  console.log('🌍 GCC Multi-Jurisdictional Seed & Migration');
  console.log('══════════════════════════════════════════════\n');

  // ── Step 1: Upsert the 6 GCC jurisdictions ──
  console.log('Step 1: Seeding 6 GCC Jurisdictions…');
  const jurisdictionMap: Record<string, string> = {}; // code → id

  for (const jur of GCC_JURISDICTIONS) {
    const record = await prisma.jurisdiction.upsert({
      where: { code: jur.code },
      update: {
        name: jur.name,
        regulatorName: jur.regulatorName,
        fiuName: jur.fiuName,
        currency: jur.currency,
        isActive: true,
      },
      create: jur,
    });
    jurisdictionMap[jur.code] = record.id;
    console.log(`  ✅ ${jur.code} — ${jur.name} (${jur.regulatorName}) → ${record.id}`);
  }

  const aeId = jurisdictionMap['AE'];
  console.log(`\n  AE (UAE) jurisdiction id: ${aeId}\n`);

  // ── Step 2: Backfill existing rows to AE ──
  // All existing data was created under the UAE regulatory scope. We assign
  // jurisdictionId = AE for every row that currently has a NULL jurisdictionId.
  console.log('Step 2: Backfilling existing data to AE (UAE) jurisdiction…');

  const [users, policies, circulars, alerts, auditLogs, departments] = await Promise.all([
    prisma.user.updateMany({ where: { jurisdictionId: null }, data: { jurisdictionId: aeId } }),
    prisma.policy.updateMany({ where: { jurisdictionId: null }, data: { jurisdictionId: aeId } }),
    prisma.regulatoryCircular.updateMany({ where: { jurisdictionId: null }, data: { jurisdictionId: aeId } }),
    prisma.aMLAlert.updateMany({ where: { jurisdictionId: null }, data: { jurisdictionId: aeId } }),
    prisma.auditLog.updateMany({ where: { jurisdictionId: null }, data: { jurisdictionId: aeId } }),
    prisma.department.updateMany({ where: { jurisdictionId: null }, data: { jurisdictionId: aeId } }),
  ]);

  console.log(`  ✅ Users:              ${users.count} rows → AE`);
  console.log(`  ✅ Policies:           ${policies.count} rows → AE`);
  console.log(`  ✅ RegulatoryCirculars:${circulars.count} rows → AE`);
  console.log(`  ✅ AMLAlerts:          ${alerts.count} rows → AE`);
  console.log(`  ✅ AuditLogs:          ${auditLogs.count} rows → AE`);
  console.log(`  ✅ Departments:        ${departments.count} rows → AE`);

  // ── Step 3: Verify ──
  console.log('\nStep 3: Verification…');
  const counts = await prisma.jurisdiction.findMany({
    select: { code: true, name: true, regulatorName: true, currency: true, isActive: true,
      _count: { select: { users: true, policies: true, circulars: true, alerts: true, auditLogs: true, departments: true } } },
    orderBy: { code: 'asc' },
  });
  console.log('\n  Jurisdiction Summary:');
  for (const c of counts) {
    console.log(`    ${c.code} (${c.regulatorName}, ${c.currency}) — active=${c.isActive} | users=${c._count.users} policies=${c._count.policies} circulars=${c._count.circulars} alerts=${c._count.alerts} audits=${c._count.auditLogs} depts=${c._count.departments}`);
  }

  console.log('\n✅ GCC Phase 1 seed & migration complete.');
  console.log(`   All existing UAE data is now scoped to jurisdictionId=${aeId} (AE).`);
  console.log('   The 5 new GCC jurisdictions (SA/BH/QA/OM/KW) are empty and ready for Phase 2.\n');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
