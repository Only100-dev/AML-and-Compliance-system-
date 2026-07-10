/**
 * Seed script for the 8 normalized insurance departments (Section 10.6).
 * Idempotent: only creates departments that don't already exist (matched by `name`).
 * Run: bun run scripts/seed-departments.ts
 */
import { db } from '../src/lib/db';

interface DeptSeed {
  name: string;
  displayName: string;
  headName: string | null;
  complianceScope: 'direct' | 'indirect';
  description: string;
}

const DEPARTMENTS: DeptSeed[] = [
  {
    name: 'Underwriting',
    displayName: 'Underwriting Department',
    headName: 'Ahmed Al Marri',
    complianceScope: 'direct',
    description:
      'Owns customer onboarding KYC, source-of-funds declarations, and high-risk product underwriting decisions.',
  },
  {
    name: 'Claims',
    displayName: 'Claims Department',
    headName: 'Fatima Hassan',
    complianceScope: 'direct',
    description:
      'Handles claim payouts, beneficiary verification, and sanctions screening of payees.',
  },
  {
    name: 'Brokerage',
    displayName: 'Brokerage & Intermediaries',
    headName: 'Khalid Nasser',
    complianceScope: 'direct',
    description:
      'Manages broker onboarding, commission payments, and intermediary due diligence.',
  },
  {
    name: 'Finance',
    displayName: 'Finance & Treasury',
    headName: 'Sara Al Zaabi',
    complianceScope: 'direct',
    description:
      'Processes premium financing, refunds, and monitors cash-intensive transactions for STR signals.',
  },
  {
    name: 'IT',
    displayName: 'Information Technology',
    headName: 'Omar Bin Saeed',
    complianceScope: 'indirect',
    description:
      'Maintains AML/CFT system integrity, audit log immutability, access controls, and PDPL data protection.',
  },
  {
    name: 'Compliance',
    displayName: 'Compliance Department',
    headName: 'Layla Al Mansoori',
    complianceScope: 'direct',
    description:
      'Owns the AML/CFT program, MLRO function, SAR filings, regulatory reporting, and policy attestation.',
  },
  {
    name: 'Legal',
    displayName: 'Legal & Regulatory Affairs',
    headName: 'Yousef Al Hashimi',
    complianceScope: 'indirect',
    description:
      'Provides legal opinions on sanctions, data sharing, tipping-off prohibitions, and court orders.',
  },
  {
    name: 'HR',
    displayName: 'Human Resources',
    headName: 'Mona Al Suwaidi',
    complianceScope: 'indirect',
    description:
      'Manages employee screening, mandatory AML training records, and internal whistleblowing channels.',
  },
];

async function main() {
  console.log('Seeding insurance departments (idempotent)...');
  let created = 0;
  let skipped = 0;

  for (const dept of DEPARTMENTS) {
    const existing = await db.department.findUnique({ where: { name: dept.name } });
    if (existing) {
      console.log(`  SKIP  "${dept.name}" already exists (id=${existing.id})`);
      skipped++;
      continue;
    }
    const created_dept = await db.department.create({
      data: {
        name: dept.name,
        displayName: dept.displayName,
        headName: dept.headName,
        complianceScope: dept.complianceScope,
        description: dept.description,
      },
    });
    console.log(`  CREATE "${dept.name}" -> id=${created_dept.id}`);
    created++;
  }

  const total = await db.department.count();
  console.log(
    `\nDone. Created ${created} department(s), skipped ${skipped} existing. Total in DB: ${total}.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  });
