/**
 * P0-A Fix: Auth Seeding Script
 *
 * Hashes all user passwords with bcrypt, replacing the insecure
 * hardcoded demo passwords identified in Fortress v5.0 A-001.
 *
 * Run: bun run db:seed:auth
 *
 * This script is EXCLUDED from production builds. It should only
 * be run during initial setup or development.
 *
 * IMPORTANT: In production, users MUST set their own passwords
 * via a secure password-reset flow. The demo passwords below
 * are for development/UAT ONLY.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

// Demo passwords — development/UAT only. In production, users set their own.
const DEMO_CREDENTIALS: Record<string, string> = {
  'admin': 'admin123',
  'mlro': 'mlro123',
  'compliance_manager': 'cm123',
  'compliance_officer': 'co123',
  'dept_head': 'dh123',
  'board': 'board123',
  'auditor': 'auditor123',
};

async function main() {
  console.log('🔐 P0-A Auth Seeding: Hashing user passwords with bcrypt...\n');

  // Guard: Never run in production
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ FATAL: This script must NOT run in production. Users must set their own passwords.');
    process.exit(1);
  }

  const users = await prisma.user.findMany();

  let updated = 0;
  let skipped = 0;

  for (const user of users) {
    // Skip users who already have a passwordHash
    if (user.passwordHash) {
      console.log(`  ⏭️  ${user.email} — already has passwordHash, skipping`);
      skipped++;
      continue;
    }

    const demoPassword = DEMO_CREDENTIALS[user.role];
    if (!demoPassword) {
      console.log(`  ⚠️  ${user.email} — role '${user.role}' has no demo password, assigning default`);
    }

    const passwordToHash = demoPassword || 'changeme-immediately';
    const passwordHash = await bcrypt.hash(passwordToHash, BCRYPT_ROUNDS);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    console.log(`  ✅ ${user.email} — passwordHash set (role: ${user.role})`);
    updated++;
  }

  console.log(`\n🔐 Auth seeding complete: ${updated} users updated, ${skipped} skipped.\n`);

  // Also ensure the auditor role users from seed-gcc-users have hashes
  const auditorUsers = await prisma.user.findMany({
    where: { role: 'auditor', passwordHash: null },
  });

  if (auditorUsers.length > 0) {
    const hash = await bcrypt.hash('auditor123', BCRYPT_ROUNDS);
    for (const u of auditorUsers) {
      await prisma.user.update({ where: { id: u.id }, data: { passwordHash: hash } });
      console.log(`  ✅ ${u.email} — auditor passwordHash set`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
