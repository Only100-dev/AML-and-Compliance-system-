/**
 * GCC Phase 2 — Seed a KSA (Saudi Arabia) demo user for UAT verification.
 *
 * Creates a KSA Compliance Officer (local user, locked to SA jurisdiction)
 * so we can verify that non-AE users see an empty dashboard with no UAE
 * data leakage, and the TopBar shows the SA country badge.
 *
 * Run: bun run scripts/seed-ksa-demo-user.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const saJurisdiction = await prisma.jurisdiction.findUnique({
    where: { code: 'SA' },
  });

  if (!saJurisdiction) {
    throw new Error('SA jurisdiction not found. Run seed-gcc-jurisdictions.ts first.');
  }

  const ksaUser = await prisma.user.upsert({
    where: { email: 'ksa.mlro@icos.sa' },
    update: {
      name: 'Khalid Al-Saud',
      role: 'mlro',
      jurisdiction: 'SAMA',
      jurisdictionId: saJurisdiction.id,
      userType: 'local',
      isActive: true,
    },
    create: {
      email: 'ksa.mlro@icos.sa',
      name: 'Khalid Al-Saud',
      role: 'mlro',
      jurisdiction: 'SAMA',
      jurisdictionId: saJurisdiction.id,
      userType: 'local',
      isActive: true,
    },
  });

  console.log('✅ KSA demo user created:');
  console.log(`   Email:          ${ksaUser.email}`);
  console.log(`   Name:           ${ksaUser.name}`);
  console.log(`   Role:           ${ksaUser.role}`);
  console.log(`   Jurisdiction:   ${ksaUser.jurisdiction} (String sub-regulator)`);
  console.log(`   JurisdictionId: ${ksaUser.jurisdictionId} (SA country FK)`);
  console.log(`   UserType:       ${ksaUser.userType} (locked to SA — cannot switch)`);
  console.log(`   Password:       mlro123 (role-based demo password)`);
  console.log('');
  console.log('   This user will see an EMPTY dashboard (no UAE data leakage)');
  console.log('   and the TopBar will show 🇸🇦 SA as a static badge.');
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
