/**
 * GCC User Directory Seed Script
 * Directive 3: Seeds the complete GCC user directory across all 6 jurisdictions
 * with all 7 canonical roles per jurisdiction.
 *
 * Uses upsert to avoid duplicates with existing users.
 * Run: bun run prisma/seed-gcc-users.ts
 */

import { db } from '../src/lib/db';

interface SeedUser {
  email: string;
  name: string;
  role: string;
  jurisdiction: string;
}

const GCC_USERS: SeedUser[] = [
  // ─── UAE (AE) — jurisdiction: 'CBUAE' ──────────────────────────────────
  { email: 'omar.almansoori@icos.ae', name: 'Omar Al Mansoori', role: 'admin', jurisdiction: 'CBUAE' },
  { email: 'ahmed.alrashid@icos.ae', name: 'Ahmed Al Rashid', role: 'mlro', jurisdiction: 'CBUAE' },
  { email: 'fatima.alsayed@icos.ae', name: 'Fatima Al Sayed', role: 'compliance_manager', jurisdiction: 'CBUAE' },
  { email: 'khalid.noor@icos.ae', name: 'Khalid Noor', role: 'compliance_officer', jurisdiction: 'CBUAE' },
  { email: 'sara.almaktoum@icos.ae', name: 'Sara Al Maktoum', role: 'dept_head', jurisdiction: 'CBUAE' },
  { email: 'board@icos.ae', name: 'UAE Board Member', role: 'board', jurisdiction: 'CBUAE' },
  { email: 'saeed.alhabshi@icos.ae', name: 'Saeed Al Habshi', role: 'auditor', jurisdiction: 'CBUAE' },

  // ─── KSA (SA) — jurisdiction: 'SA' ─────────────────────────────────────
  { email: 'abdullah.alsaud@icos.sa', name: 'Abdullah Al Saud', role: 'admin', jurisdiction: 'SA' },
  { email: 'mohammed.alqahtani@icos.sa', name: 'Mohammed Al Qahtani', role: 'mlro', jurisdiction: 'SA' },
  { email: 'nora.alshammari@icos.sa', name: 'Nora Al Shammari', role: 'compliance_manager', jurisdiction: 'SA' },
  { email: 'faisal.aldosari@icos.sa', name: 'Faisal Al Dosari', role: 'compliance_officer', jurisdiction: 'SA' },
  { email: 'turki.alharbi@icos.sa', name: 'Turki Al Harbi', role: 'dept_head', jurisdiction: 'SA' },
  { email: 'ksa.board@icos.sa', name: 'KSA Board Member', role: 'board', jurisdiction: 'SA' },
  { email: 'laila.almohammadi@icos.sa', name: 'Laila Al Mohammadi', role: 'auditor', jurisdiction: 'SA' },

  // ─── Bahrain (BH) — jurisdiction: 'BH' ─────────────────────────────────
  { email: 'hussein.alalawi@icos.bh', name: 'Hussein Al Alawi', role: 'admin', jurisdiction: 'BH' },
  { email: 'maryam.alkhalifa@icos.bh', name: 'Maryam Al Khalifa', role: 'mlro', jurisdiction: 'BH' },
  { email: 'ahmed.almahmood@icos.bh', name: 'Ahmed Al Mahmood', role: 'compliance_manager', jurisdiction: 'BH' },
  { email: 'zainab.alsayed@icos.bh', name: 'Zainab Al Sayed', role: 'compliance_officer', jurisdiction: 'BH' },
  { email: 'khalil.almeer@icos.bh', name: 'Khalil Al Meer', role: 'dept_head', jurisdiction: 'BH' },
  { email: 'bh.board@icos.bh', name: 'Bahrain Board Member', role: 'board', jurisdiction: 'BH' },
  { email: 'amina.alhajji@icos.bh', name: 'Amina Al Hajji', role: 'auditor', jurisdiction: 'BH' },

  // ─── Qatar (QA) — jurisdiction: 'QA' ───────────────────────────────────
  { email: 'hamad.althani@icos.qa', name: 'Hamad Al Thani', role: 'admin', jurisdiction: 'QA' },
  { email: 'noor.alkubaisi@icos.qa', name: 'Noor Al Kubaisi', role: 'mlro', jurisdiction: 'QA' },
  { email: 'fatima.almohannadi@icos.qa', name: 'Fatima Al Mohannadi', role: 'compliance_manager', jurisdiction: 'QA' },
  { email: 'jasim.althani@icos.qa', name: 'Jasim Al Thani', role: 'compliance_officer', jurisdiction: 'QA' },
  { email: 'rashid.alketbi@icos.qa', name: 'Rashid Al Ketbi', role: 'dept_head', jurisdiction: 'QA' },
  { email: 'qa.board@icos.qa', name: 'Qatar Board Member', role: 'board', jurisdiction: 'QA' },
  { email: 'mariam.alhajri@icos.qa', name: 'Mariam Al Hajri', role: 'auditor', jurisdiction: 'QA' },

  // ─── Oman (OM) — jurisdiction: 'OM' ────────────────────────────────────
  { email: 'salim.albusaidi@icos.om', name: 'Salim Al Busaidi', role: 'admin', jurisdiction: 'OM' },
  { email: 'khadija.alkharousi@icos.om', name: 'Khadija Al Kharousi', role: 'mlro', jurisdiction: 'OM' },
  { email: 'yusuf.almawali@icos.om', name: 'Yusuf Al Mawali', role: 'compliance_manager', jurisdiction: 'OM' },
  { email: 'amina.albalushi@icos.om', name: 'Amina Al Balushi', role: 'compliance_officer', jurisdiction: 'OM' },
  { email: 'omar.alsinawi@icos.om', name: 'Omar Al Sinawi', role: 'dept_head', jurisdiction: 'OM' },
  { email: 'om.board@icos.om', name: 'Oman Board Member', role: 'board', jurisdiction: 'OM' },
  { email: 'huda.alkathiri@icos.om', name: 'Huda Al Kathiri', role: 'auditor', jurisdiction: 'OM' },

  // ─── Kuwait (KW) — jurisdiction: 'KW' ──────────────────────────────────
  { email: 'jasem.almutairi@icos.kw', name: 'Jasem Al Mutairi', role: 'admin', jurisdiction: 'KW' },
  { email: 'muna.alshemmari@icos.kw', name: 'Muna Al Shemmari', role: 'mlro', jurisdiction: 'KW' },
  { email: 'bader.alsaif@icos.kw', name: 'Bader Al Saif', role: 'compliance_manager', jurisdiction: 'KW' },
  { email: 'hessa.alenezi@icos.kw', name: 'Hessa Al Enezi', role: 'compliance_officer', jurisdiction: 'KW' },
  { email: 'fahad.alotaibi@icos.kw', name: 'Fahad Al Otaibi', role: 'dept_head', jurisdiction: 'KW' },
  { email: 'kw.board@icos.kw', name: 'Kuwait Board Member', role: 'board', jurisdiction: 'KW' },
  { email: 'dalal.alhashem@icos.kw', name: 'Dalal Al Hashem', role: 'auditor', jurisdiction: 'KW' },
];

async function main() {
  console.log('🌍 Seeding GCC User Directory...');
  console.log(`   ${GCC_USERS.length} users across 6 jurisdictions`);

  let created = 0;
  let skipped = 0;

  for (const user of GCC_USERS) {
    const result = await db.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        jurisdiction: user.jurisdiction,
        isActive: true,
      },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        jurisdiction: user.jurisdiction,
        isActive: true,
      },
    });

    if (result.createdAt === result.updatedAt) {
      created++;
    } else {
      skipped++;
    }
  }

  console.log(`\n✅ GCC User Directory seeded successfully!`);
  console.log(`   Created: ${created}  |  Updated: ${skipped}`);

  // Verify count by jurisdiction
  const jurisdictions = ['CBUAE', 'SA', 'BH', 'QA', 'OM', 'KW'];
  console.log('\n📊 Users per jurisdiction:');
  for (const j of jurisdictions) {
    const count = await db.user.count({ where: { jurisdiction: j } });
    console.log(`   ${j}: ${count} users`);
  }

  const totalUsers = await db.user.count();
  console.log(`\n   Total users in database: ${totalUsers}`);

  // ─── Verification: Confirm all 6 GCC jurisdictions have users ──────────
  console.log('\n🔍 Verification — All 6 GCC jurisdictions must have users:');
  const allJurisdictions = ['CBUAE', 'SA', 'BH', 'QA', 'OM', 'KW'];
  let allJurisdictionsHaveUsers = true;
  for (const j of allJurisdictions) {
    const count = await db.user.count({ where: { jurisdiction: j, isActive: true } });
    const status = count > 0 ? '✅' : '❌';
    console.log(`   ${status} ${j}: ${count} active users`);
    if (count === 0) allJurisdictionsHaveUsers = false;
  }
  if (allJurisdictionsHaveUsers) {
    console.log('\n✅ All 6 GCC jurisdictions have active users. Verification passed!');
  } else {
    console.log('\n⚠️  Some jurisdictions have no active users. Verification failed!');
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
