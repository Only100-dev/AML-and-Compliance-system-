/**
 * Migration Backfill Script — Fix 2
 *
 * This script backfills the `jurisdiction` field for any existing records
 * that have NULL jurisdiction (which shouldn't happen since the schema
 * previously had @default("CBUAE"), but we handle it as a safety measure).
 *
 * For records that had the old CBUAE default, they will keep "CBUAE" since
 * that was their actual value. This script is a one-time migration tool.
 *
 * Run: bun run prisma/seed-backfill-jurisdiction.ts
 */

import { db } from '../src/lib/db';

async function main() {
  console.log('🔧 Migration Backfill — Jurisdiction Field (Fix 2)');
  console.log('   Ensuring all records have an explicit jurisdiction value\n');

  const models = [
    { name: 'User', model: db.user },
    { name: 'AMLAlert', model: db.aMLAlert },
    { name: 'Claim', model: db.claim },
    { name: 'AuditLog', model: db.auditLog },
    { name: 'KRIMetric', model: db.kRIMetric },
    { name: 'Regulation', model: db.regulation },
    { name: 'Policy', model: db.policy },
    { name: 'LaborLawCompliance', model: db.laborLawCompliance },
    { name: 'LegalCase', model: db.legalCase },
    { name: 'ComplianceAudit', model: db.complianceAudit },
    { name: 'CorporateKYC', model: db.corporateKYC },
    { name: 'IndividualKYC', model: db.individualKYC },
    { name: 'GoAMLFiling', model: db.goAMLFiling },
    { name: 'MakerCheckerLog', model: db.makerCheckerLog },
    { name: 'SanctionsScreening', model: db.sanctionsScreening },
    { name: 'SARCase', model: db.sARCase },
    { name: 'CalendarEvent', model: db.calendarEvent },
    { name: 'ComplianceCase', model: db.complianceCase },
    { name: 'RegulatoryDeadline', model: db.regulatoryDeadline },
  ] as const;

  let totalBackfilled = 0;

  for (const { name, model } of models) {
    try {
      // Count records with NULL or empty jurisdiction
      // @ts-expect-error — dynamic model access
      const nullCount = await model.count({
        where: {
          OR: [
            { jurisdiction: null },
            { jurisdiction: '' },
          ],
        },
      });

      if (nullCount > 0) {
        // @ts-expect-error — dynamic model access
        const result = await model.updateMany({
          where: {
            OR: [
              { jurisdiction: null },
              { jurisdiction: '' },
            ],
          },
          data: {
            jurisdiction: 'CBUAE', // These records were created under the old default
          },
        });
        console.log(`  ✅ ${name}: Backfilled ${result.count} records`);
        totalBackfilled += result.count;
      } else {
        console.log(`  ✅ ${name}: All records have jurisdiction (0 backfilled)`);
      }
    } catch (e: any) {
      console.log(`  ⚠️  ${name}: Skipped (${e.message})`);
    }
  }

  console.log(`\n📊 Total records backfilled: ${totalBackfilled}`);

  if (totalBackfilled > 0) {
    console.log('   These records had NULL jurisdiction from before the schema default was removed.');
    console.log('   They were set to "CBUAE" since that was the previous @default value.');
  }

  console.log('\n✅ Backfill complete!');
}

main()
  .catch((e) => {
    console.error('❌ Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
