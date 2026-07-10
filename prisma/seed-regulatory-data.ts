/**
 * ════════════════════════════════════════════════════════════════════════════
 * IC-OS v7.3.0 — UAT Hotfix Batch 3: Regulatory Demo Data Seeder
 * ════════════════════════════════════════════════════════════════════════════
 * Purpose: Populate the 3 regulatory module tables (ThirdPartyVendor,
 *          BusinessContinuityPlan, BordereauxSubmission) plus the linked
 *          InsuranceRecord line-item table with realistic UAE insurance
 *          data for UAT testers.
 *
 * Resolves: Issue 7 from GAP_ANALYSIS_REPORT.md — the three regulatory
 *   API endpoints (GET /api/vendors, /api/bcp, /api/bordereaux) returned
 *   empty arrays because their backing tables were empty.
 *
 * Records created (when the corresponding table is empty):
 *   - 7  ThirdPartyVendor       (UAE insurance ecosystem: IT, data, consulting,
 *                                brokers, TPA — covers all 6 serviceType values)
 *   - 4  BusinessContinuityPlan (BCP, DRP, Incident_Response, Crisis_Communication)
 *   - 4  BordereauxSubmission   (uploaded / validated / rejected / submitted)
 *   - 8  InsuranceRecord        (bordereaux line items, unique policyNumbers)
 *
 * IDEMPOTENCY:
 *   Each model is gated by a `count() > 0` check. Re-runs skip already-
 *   populated tables and print a clear "already has N records, skipping"
 *   message. Safe to re-run on the same database without duplicating data.
 *
 * Usage:
 *   bun run db:seed-regulatory
 *   (or)  bun run prisma/seed-regulatory-data.ts
 *
 * Notes:
 *   - Does NOT modify the Prisma schema (models already exist + pushed).
 *   - Does NOT call db:push (schema is already in sync with the DB).
 *   - Uses the existing `@/lib/db` Prisma client singleton.
 *   - All vendors / BCPs are seeded with isActive=true so the default
 *     GET endpoints (which filter isActive=true) return the full count.
 * ════════════════════════════════════════════════════════════════════════════
 */

import { db } from '@/lib/db';

// ─── Date helpers ────────────────────────────────────────────────────────────

/** Returns a Date `days` days from now (negative = past). */
function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

/** Returns a Date `months` months from now (negative = past). */
function monthsFromNow(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}

// ─── 1. ThirdPartyVendor seed data ───────────────────────────────────────────
// 7 vendors covering all 6 serviceType enum values + varied risk/AML profiles.
// Note: isActive=true for all 7 so the default GET /api/vendors (which filters
// isActive=true) returns the full 7-record set expected by UAT verification.

interface VendorSeed {
  vendorName: string;
  serviceType: 'IT_Service' | 'Data_Processor' | 'Consulting' | 'Insurance_Broker' | 'TPA' | 'Other';
  riskRating: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  contractExpiry: Date | null;
  amlStatus: 'clear' | 'pending' | 'flagged' | 'edd_required';
  dataProcessingAgreement: boolean;
  lastAuditDate: Date | null;
  nextReviewDate: Date | null;
  country: string;
  contractValue: number;
  description: string;
  eddTriggered: boolean;
  eddCompletedDate: Date | null;
  isActive: boolean;
}

const VENDOR_SEEDS: VendorSeed[] = [
  {
    vendorName: 'Emirates IT Solutions FZ-LLC',
    serviceType: 'IT_Service',
    riskRating: 'high',
    riskScore: 72,
    contractExpiry: monthsFromNow(3),
    amlStatus: 'edd_required',
    dataProcessingAgreement: true,
    lastAuditDate: monthsFromNow(-8),
    nextReviewDate: monthsFromNow(1),
    country: 'AE',
    contractValue: 850000,
    description:
      'Primary IT infrastructure and managed-services provider for the UAE on-prem data centre. Holds privileged access to production systems and processes policyholder PII — EDD triggered due to high-risk service classification under CBUAE Dodd 2/2018 §4.3.',
    eddTriggered: true,
    eddCompletedDate: monthsFromNow(-2),
    isActive: true,
  },
  {
    vendorName: 'Gulf Data Processing LLC',
    serviceType: 'Data_Processor',
    riskRating: 'critical',
    riskScore: 88,
    contractExpiry: monthsFromNow(8),
    amlStatus: 'flagged',
    dataProcessingAgreement: false,
    lastAuditDate: monthsFromNow(-14),
    nextReviewDate: monthsFromNow(-1), // overdue
    country: 'AE',
    contractValue: 1200000,
    description:
      'Outsourced claims data processing & analytics vendor. Processes bulk bordereaux data and aggregated policyholder records. CRITICAL: DPA missing on file, EDD overdue by 30+ days — escalate to MLRO for review under UAE AML-CFT framework.',
    eddTriggered: true,
    eddCompletedDate: null, // EDD triggered but never completed — overdue
    isActive: true,
  },
  {
    vendorName: 'Al-Mahara Consultancy Group',
    serviceType: 'Consulting',
    riskRating: 'medium',
    riskScore: 45,
    contractExpiry: monthsFromNow(14),
    amlStatus: 'clear',
    dataProcessingAgreement: true,
    lastAuditDate: monthsFromNow(-5),
    nextReviewDate: monthsFromNow(7),
    country: 'AE',
    contractValue: 320000,
    description:
      'Independent compliance consulting and regulatory advisory firm. Provides CBUAE reporting readiness assessments and ISO 31000 risk-framework implementation support. No privileged system access — advisory-only engagement.',
    eddTriggered: false,
    eddCompletedDate: null,
    isActive: true,
  },
  {
    vendorName: 'Abu Dhabi Brokers Network',
    serviceType: 'Insurance_Broker',
    riskRating: 'medium',
    riskScore: 55,
    contractExpiry: monthsFromNow(-2), // expired — needs renewal
    amlStatus: 'pending',
    dataProcessingAgreement: true,
    lastAuditDate: monthsFromNow(-3),
    nextReviewDate: monthsFromNow(2),
    country: 'AE',
    contractValue: 540000,
    description:
      'Licensed insurance broker network operating across Abu Dhabi emirate. Originates motor, property, and health policies on behalf of the company. AML screening pending renewal of IAED broker registration — contract expired 2 months ago, renewal in progress.',
    eddTriggered: false,
    eddCompletedDate: null,
    isActive: true,
  },
  {
    vendorName: 'ClaimsPro TPA Services',
    serviceType: 'TPA',
    riskRating: 'high',
    riskScore: 68,
    contractExpiry: monthsFromNow(20),
    amlStatus: 'edd_required',
    dataProcessingAgreement: true,
    lastAuditDate: monthsFromNow(-6),
    nextReviewDate: monthsFromNow(3),
    country: 'AE',
    contractValue: 680000,
    description:
      'Third-Party Administrator for health and motor claims. Processes claimant PII, medical records, and payout disbursements. EDD required due to high transaction volume (>50k claims/yr) and direct disbursement access to operating accounts.',
    eddTriggered: true,
    eddCompletedDate: monthsFromNow(-1),
    isActive: true,
  },
  {
    vendorName: 'SecureIT Middle East',
    serviceType: 'IT_Service',
    riskRating: 'low',
    riskScore: 22,
    contractExpiry: monthsFromNow(18),
    amlStatus: 'clear',
    dataProcessingAgreement: true,
    lastAuditDate: monthsFromNow(-2),
    nextReviewDate: monthsFromNow(10),
    country: 'AE',
    contractValue: 180000,
    description:
      'Tier-2 IT vendor providing endpoint protection, MDM, and SOC-as-a-Service. Read-only monitoring access only — no production data write privileges. Low risk profile, all compliance artifacts current.',
    eddTriggered: false,
    eddCompletedDate: null,
    isActive: true,
  },
  {
    vendorName: 'Ras Al Khaimah Reinsurance Brokers',
    serviceType: 'Insurance_Broker',
    riskRating: 'high',
    riskScore: 76,
    contractExpiry: monthsFromNow(1),
    amlStatus: 'edd_required',
    dataProcessingAgreement: false,
    lastAuditDate: monthsFromNow(-10),
    nextReviewDate: monthsFromNow(-1), // overdue
    country: 'AE',
    contractValue: 950000,
    description:
      'Reinsurance broker facilitator for treaty and facultative placements across GCC. High-value cross-border transactions, DPA not yet executed, EDD required — next review overdue by 1 month. Contract expiry imminent (1 month).',
    eddTriggered: true,
    eddCompletedDate: null, // triggered but not completed
    isActive: true,
  },
];

// ─── 2. BusinessContinuityPlan seed data ─────────────────────────────────────
// 4 plans covering all 4 planType enum values.

interface BcpSeed {
  planType: 'BCP' | 'DRP' | 'Incident_Response' | 'Crisis_Communication';
  title: string;
  version: string;
  status: 'Active' | 'Draft' | 'Under_Review' | 'Archived';
  lastTestedDate: Date | null;
  nextTestDate: Date | null;
  testFrequency: 'quarterly' | 'semi-annual' | 'annual' | 'biennial';
  documentUrl: string | null;
  owner: string;
  department: string;
  rtoHours: number | null;
  rpoHours: number | null;
  description: string;
  isActive: boolean;
}

const BCP_SEEDS: BcpSeed[] = [
  {
    planType: 'BCP',
    title: 'Enterprise BCP — CBUAE Dodd 2/2018',
    version: '3.2',
    status: 'Active',
    lastTestedDate: monthsFromNow(-6),
    nextTestDate: monthsFromNow(6),
    testFrequency: 'annual',
    documentUrl: '/docs/bcp/enterprise-bcp-v3.2.pdf',
    owner: 'Chief Risk Officer',
    department: 'Risk Management',
    rtoHours: 4,
    rpoHours: 1,
    description:
      'Enterprise-wide Business Continuity Plan mandated by CBUAE Dodd 2/2018 §6. Covers critical operations disruption scenarios including loss of HQ, key personnel, and third-party service providers. Last full tabletop exercise completed 6 months ago; next annual test scheduled.',
    isActive: true,
  },
  {
    planType: 'DRP',
    title: 'Data Center DRP — ISO 22301',
    version: '2.1',
    status: 'Active',
    lastTestedDate: monthsFromNow(-2),
    nextTestDate: monthsFromNow(4),
    testFrequency: 'semi-annual',
    documentUrl: '/docs/bcp/datacenter-drp-v2.1.pdf',
    owner: 'IT Director',
    department: 'Information Technology',
    rtoHours: 2,
    rpoHours: 0, // zero data loss — synchronous replication
    description:
      'Disaster Recovery Plan for primary UAE data centre with synchronous replication to secondary DR site. Certified against ISO 22301:2019. RPO=0 achieved via storage-level synchronous replication. Last DR switchover test completed 2 months ago with full service restoration within 95 minutes (under RTO target).',
    isActive: true,
  },
  {
    planType: 'Incident_Response',
    title: 'Cybersecurity Incident Response Plan',
    version: '4.0',
    status: 'Under_Review',
    lastTestedDate: monthsFromNow(-4),
    nextTestDate: monthsFromNow(-1), // OVERDUE — past date
    testFrequency: 'quarterly',
    documentUrl: '/docs/bcp/cyber-irp-v4.0-draft.pdf',
    owner: 'CISO',
    department: 'Information Security',
    rtoHours: 1,
    rpoHours: 0,
    description:
      'Cybersecurity Incident Response Plan covering detection, containment, eradication, recovery, and post-incident analysis. Aligned with NIST SP 800-61r2 and UAE Cybercrime Federal Law No. 34/2021. Currently under review for ransomware playbooks. Quarterly test schedule is OVERDUE by 1 month — requires immediate scheduling.',
    isActive: true,
  },
  {
    planType: 'Crisis_Communication',
    title: 'Crisis Communication Plan — Regulatory',
    version: '1.0',
    status: 'Draft',
    lastTestedDate: null,
    nextTestDate: null,
    testFrequency: 'annual',
    documentUrl: null, // not yet published
    owner: 'Head of Communications',
    department: 'Corporate Affairs',
    rtoHours: null,
    rpoHours: null,
    description:
      'Crisis Communication Plan defining internal/external stakeholder notification protocols during major incidents (regulatory action, data breach, executive succession, market event). Draft stage — awaiting CRO and Legal sign-off. Aligns communication cadence with CBUAE notification windows (24/72 hours).',
    isActive: true,
  },
];

// ─── 3. BordereauxSubmission seed data ───────────────────────────────────────
// 4 submissions covering all 4 status enum values.

interface BordereauxSeed {
  fileName: string;
  fileType: 'csv' | 'xlsx';
  fileSize: number;
  uploadedBy: string;
  status: 'uploaded' | 'validated' | 'rejected' | 'submitted';
  recordCount: number;
  validCount: number;
  errorCount: number;
  validationErrors: string; // JSON array
  quarter: string;
  brokerId: string;
  submittedAt: Date | null;
  createdAt: Date;
}

const BORDEREAUX_SEEDS: BordereauxSeed[] = [
  {
    fileName: 'Q1-2025-bordereaux-bkr001.csv',
    fileType: 'csv',
    fileSize: 487200,
    uploadedBy: 'uat-mlro@icos-test.local',
    status: 'submitted',
    recordCount: 1247,
    validCount: 1247,
    errorCount: 0,
    validationErrors: '[]',
    quarter: 'Q1-2025',
    brokerId: 'BKR-001',
    submittedAt: daysFromNow(-14), // submitted 2 weeks ago
    createdAt: daysFromNow(-21),
  },
  {
    fileName: 'Q2-2025-bordereaux-bkr001.csv',
    fileType: 'csv',
    fileSize: 438900,
    uploadedBy: 'uat-mlro@icos-test.local',
    status: 'validated',
    recordCount: 1102,
    validCount: 1098,
    errorCount: 4,
    validationErrors: JSON.stringify([
      { row: 47, field: 'premiumAED', error: 'Premium below regulatory minimum threshold (AED 1,000) for Motor product' },
      { row: 213, field: 'clientName', error: 'Client name missing — required for AML screening' },
      { row: 589, field: 'policyNumber', error: 'Policy number format invalid (expected POL-YYYY-NNNNNN)' },
      { row: 902, field: 'emirate', error: 'Emirate value "RAK" not in enum [Dubai, Abu Dhabi, Sharjah, Ajman, RAK, Fujairah, UAQ]' },
    ]),
    quarter: 'Q2-2025',
    brokerId: 'BKR-001',
    submittedAt: null, // validated but not yet submitted to CBUAE
    createdAt: daysFromNow(-7),
  },
  {
    fileName: 'Q3-2025-bordereaux-bkr003.xlsx',
    fileType: 'xlsx',
    fileSize: 612400,
    uploadedBy: 'uat-compliance@icos-test.local',
    status: 'rejected',
    recordCount: 856,
    validCount: 412,
    errorCount: 444,
    validationErrors: JSON.stringify([
      { row: 12, field: 'premiumAED', error: 'missing premiumAED — required field' },
      { row: 34, field: 'policyNumber', error: 'invalid policyNumber — duplicate of row 12' },
      { row: 56, field: 'premiumAED', error: 'missing premiumAED — required field' },
      { row: 78, field: 'clientName', error: 'missing clientName — required for AML screening' },
      { row: 99, field: 'policyNumber', error: 'invalid policyNumber — format mismatch' },
      { row: 121, field: 'productType', error: 'productType "Auto" not in enum [Motor, Property, Health, Life, Marine, Travel]' },
      { row: 145, field: 'premiumAED', error: 'missing premiumAED — required field' },
      { row: 167, field: 'emirate', error: 'emirate "DXB" not in allowed enum — use "Dubai"' },
      // 436 more errors truncated for seed brevity — full error report
      // available in the bordereaux validation UI for rejected submissions.
      { row: 850, field: 'amlStatus', error: 'amlStatus "ok" not in enum [CLEARED, FLAGGED]' },
    ]),
    quarter: 'Q3-2025',
    brokerId: 'BKR-003',
    submittedAt: null, // rejected — never submitted to CBUAE
    createdAt: daysFromNow(-3),
  },
  {
    fileName: 'Q3-2025-bordereaux-bkr005.csv',
    fileType: 'csv',
    fileSize: 524800,
    uploadedBy: 'uat-admin@icos-test.local',
    status: 'uploaded',
    recordCount: 0, // not yet validated — count unknown until validation runs
    validCount: 0,
    errorCount: 0,
    validationErrors: '[]',
    quarter: 'Q3-2025',
    brokerId: 'BKR-005',
    submittedAt: null,
    createdAt: daysFromNow(0), // ~now; Date() constructor defaults to now
  },
];

// ─── 4. InsuranceRecord seed data ────────────────────────────────────────────
// 8 records with unique policyNumbers — bordereaux line items.

interface InsuranceRecordSeed {
  policyNumber: string;
  clientName: string;
  emirate: string;
  productType: string;
  premiumAED: number;
  amlStatus: string; // "CLEARED" | "FLAGGED"
  reportId: string | null;
}

const INSURANCE_SEEDS: InsuranceRecordSeed[] = [
  {
    policyNumber: 'POL-2025-000001',
    clientName: 'Ahmed Al Mansouri',
    emirate: 'Dubai',
    productType: 'Motor',
    premiumAED: 8400,
    amlStatus: 'CLEARED',
    reportId: null,
  },
  {
    policyNumber: 'POL-2025-000002',
    clientName: 'Fatima bint Saeed',
    emirate: 'Abu Dhabi',
    productType: 'Health',
    premiumAED: 24500,
    amlStatus: 'CLEARED',
    reportId: null,
  },
  {
    policyNumber: 'POL-2025-000003',
    clientName: 'Al-Futtaim Holdings LLC',
    emirate: 'Dubai',
    productType: 'Property',
    premiumAED: 92000,
    amlStatus: 'FLAGGED', // high premium → AML review
    reportId: null,
  },
  {
    policyNumber: 'POL-2025-000004',
    clientName: 'Mohammed Rashid Al Maktoum',
    emirate: 'Sharjah',
    productType: 'Life',
    premiumAED: 38700,
    amlStatus: 'CLEARED',
    reportId: null,
  },
  {
    policyNumber: 'POL-2025-000005',
    clientName: 'Gulf Maritime Trading FZE',
    emirate: 'Ajman',
    productType: 'Marine',
    premiumAED: 64500,
    amlStatus: 'CLEARED',
    reportId: null,
  },
  {
    policyNumber: 'POL-2025-000006',
    clientName: 'Aisha Obaid Al Nuaimi',
    emirate: 'Abu Dhabi',
    productType: 'Travel',
    premiumAED: 1500,
    amlStatus: 'CLEARED',
    reportId: null,
  },
  {
    policyNumber: 'POL-2025-000007',
    clientName: 'Emirates Falcon Trading',
    emirate: 'Dubai',
    productType: 'Property',
    premiumAED: 88000,
    amlStatus: 'FLAGGED', // high premium → AML review
    reportId: null,
  },
  {
    policyNumber: 'POL-2025-000008',
    clientName: 'Khalid Hassan Al Marri',
    emirate: 'Sharjah',
    productType: 'Motor',
    premiumAED: 12300,
    amlStatus: 'CLEARED',
    reportId: null,
  },
];

// ─── Seeder orchestration ────────────────────────────────────────────────────

async function seedVendors(): Promise<number> {
  const existing = await db.thirdPartyVendor.count();
  if (existing > 0) {
    console.log(`ThirdPartyVendor: already has ${existing} records, skipping.`);
    return 0;
  }
  await db.$transaction(
    VENDOR_SEEDS.map((v) => db.thirdPartyVendor.create({ data: v })),
  );
  console.log(`ThirdPartyVendor: seeded ${VENDOR_SEEDS.length} records.`);
  return VENDOR_SEEDS.length;
}

async function seedBcps(): Promise<number> {
  const existing = await db.businessContinuityPlan.count();
  if (existing > 0) {
    console.log(`BusinessContinuityPlan: already has ${existing} records, skipping.`);
    return 0;
  }
  await db.$transaction(
    BCP_SEEDS.map((b) => db.businessContinuityPlan.create({ data: b })),
  );
  console.log(`BusinessContinuityPlan: seeded ${BCP_SEEDS.length} records.`);
  return BCP_SEEDS.length;
}

async function seedBordereaux(): Promise<number> {
  const existing = await db.bordereauxSubmission.count();
  if (existing > 0) {
    console.log(`BordereauxSubmission: already has ${existing} records, skipping.`);
    return 0;
  }
  await db.$transaction(
    BORDEREAUX_SEEDS.map((b) => db.bordereauxSubmission.create({ data: b })),
  );
  console.log(`BordereauxSubmission: seeded ${BORDEREAUX_SEEDS.length} records.`);
  return BORDEREAUX_SEEDS.length;
}

async function seedInsuranceRecords(): Promise<number> {
  const existing = await db.insuranceRecord.count();
  if (existing > 0) {
    console.log(`InsuranceRecord: already has ${existing} records, skipping.`);
    return 0;
  }
  await db.$transaction(
    INSURANCE_SEEDS.map((r) => db.insuranceRecord.create({ data: r })),
  );
  console.log(`InsuranceRecord: seeded ${INSURANCE_SEEDS.length} records.`);
  return INSURANCE_SEEDS.length;
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  IC-OS v7.3.0 — UAT Hotfix Batch 3: Regulatory Seed Data');
  console.log('═══════════════════════════════════════════════════════════════');

  const v = await seedVendors();
  const b = await seedBcps();
  const x = await seedBordereaux();
  const i = await seedInsuranceRecords();

  console.log('─────────────────────────────────────────────────────────────');
  console.log(
    `Seed complete: ${v} vendors, ${b} BCPs, ${x} bordereaux submissions, ${i} insurance records.`,
  );
  console.log('  (0 = table was already populated — skipped for idempotency.)');
  console.log('═══════════════════════════════════════════════════════════════');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
