import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = [
    {
      email: 'admin@icos.ae',
      name: 'Omar Al-Mansoori',
      role: 'admin',
      jurisdiction: 'CBUAE',
      isActive: true,
    },
    {
      email: 'ahmed.alrashid@icos.ae',
      name: 'Ahmed Al-Rashid',
      role: 'mlro',
      jurisdiction: 'CBUAE',
      isActive: true,
    },
    {
      email: 'fatima.alsayed@icos.ae',
      name: 'Fatima Al-Sayed',
      role: 'compliance_manager',
      jurisdiction: 'DFSA',
      isActive: true,
    },
    {
      email: 'khalid.noor@icos.ae',
      name: 'Khalid Noor',
      role: 'compliance_officer',
      jurisdiction: 'FSRA',
      isActive: true,
    },
    {
      email: 'sara.almaktoum@icos.ae',
      name: 'Sara Al-Maktoum',
      role: 'dept_head',
      jurisdiction: 'CBUAE',
      isActive: true,
    },
    {
      email: 'board@icos.ae',
      name: 'Board Member',
      role: 'board',
      jurisdiction: 'CBUAE',
      isActive: true,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: user,
      create: user,
    });
  }

  console.log(`✅ Seeded ${users.length} demo users`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
