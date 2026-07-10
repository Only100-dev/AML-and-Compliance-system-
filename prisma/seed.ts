/**
 * IC-OS Comprehensive Database Seeder
 *
 * Merges all seed scripts into one robust, production-ready seeder:
 *   - seed.ts          : Core data (Users, Circulars, GapAnalysis, AMLAlerts,
 *                        SanctionsExceptions, Evidence, Claims, AuditLog,
 *                        KRIMetrics, Regulations, Policies, LaborLawCompliance,
 *                        LegalCases, TrainingCourses, TrainingEnrollments,
 *                        ComplianceAudits)
 *   - seed-users.ts    : Dedicated users (Admin, MLRO, Compliance Manager,
 *                        Compliance Officer, Dept Head, Board)
 *   - seed-enhancements.ts : Phase 5 data (ComplianceAlerts, SanctionsScreenings,
 *                        SARCases, CalendarEvents, PolicyAttestations,
 *                        RemediationActions, Notifications, VendorDueDiligence,
 *                        ComplianceCases, RiskAssessments, RegulatoryDeadlines,
 *                        VASPKYC)
 *
 * NEW seed data added:
 *   - Default Admin user (admin@icos.ae) — ⚠️ CHANGE PASSWORD ON FIRST LOGIN
 *   - Default MLRO user (mlro@icos.ae) — ⚠️ CHANGE PASSWORD ON FIRST LOGIN
 *   - AI Engine baseline Policy records (category='AI Engine')
 *   - 2 CorporateKYC records (HIGH risk + LOW risk)
 *   - 2 IndividualKYC records
 *   - 1 GoAMLFiling record (DRAFT status)
 *   - 1 MakerCheckerLog record
 *   - 1 AIChatSession + 2 AIChatMessage records
 *
 * All data uses realistic UAE compliance scenarios per FDL 10/2025, CR 134/2025,
 * FATF Recommendations, and CBUAE Notice 3551/2021.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper: convert optional date string to Date or undefined
function toDate(val: string | undefined | null): Date | undefined {
  if (!val) return undefined;
  return new Date(val);
}

// Helper: convert optional number to number or undefined
function toNum(val: number | null | undefined): number | undefined {
  if (val === null || val === undefined) return undefined;
  return val;
}

async function main() {
  console.log('🌱 Seeding IC-OS database...');

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 1. CLEAR ALL EXISTING DATA (respecting foreign key order) ──────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Clearing existing data...');

  // Children with @relation foreign keys first
  await prisma.trainingAssessment.deleteMany();
  await prisma.aIChatMessage.deleteMany();
  await prisma.insuranceRecord.deleteMany();

  // Then all other dependent records (string-based FK references)
  await prisma.trainingEnrollment.deleteMany();
  await prisma.gapAnalysis.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.policyAttestation.deleteMany();
  await prisma.remediationAction.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.complianceCase.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.regulatoryDeadline.deleteMany();
  await prisma.sARCase.deleteMany();
  await prisma.complianceAlert.deleteMany();
  await prisma.sanctionsScreening.deleteMany();
  await prisma.vendorDueDiligence.deleteMany();
  await prisma.riskAssessment.deleteMany();
  await prisma.vASPKYC.deleteMany();
  await prisma.corporateKYC.deleteMany();
  await prisma.individualKYC.deleteMany();
  await prisma.goAMLFiling.deleteMany();
  await prisma.makerCheckerLog.deleteMany();

  // Parent records for @relation FK children
  await prisma.trainingCourse.deleteMany();
  await prisma.aIChatSession.deleteMany();
  await prisma.quarterlyReport.deleteMany();

  // Core models
  await prisma.complianceAudit.deleteMany();
  await prisma.legalCase.deleteMany();
  await prisma.laborLawCompliance.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.regulation.deleteMany();
  await prisma.kRIMetric.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.inspectionEvidence.deleteMany();
  await prisma.sanctionsException.deleteMany();
  await prisma.aMLAlert.deleteMany();
  await prisma.regulatoryCircular.deleteMany();

  // User last (referenced by many models)
  await prisma.user.deleteMany();

  // Independent models
  await prisma.idempotencyRecord.deleteMany();

  console.log('  ✅ All existing data cleared.');

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 2. SEED USERS (merged from seed.ts + seed-users.ts + new defaults) ────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding Users...');

  // ⚠️  IMPORTANT: Default admin@icos.ae and mlro@icos.ae passwords must be
  //     changed on first login. These are seed-only credentials.
  const users = await Promise.all([
    // Default Admin — ⚠️ CHANGE PASSWORD ON FIRST LOGIN
    prisma.user.create({
      data: {
        email: 'admin@icos.ae',
        name: 'Omar Al-Mansoori',
        role: 'admin',
        jurisdiction: 'CBUAE',
        isActive: true,
      },
    }),
    // Default MLRO — ⚠️ CHANGE PASSWORD ON FIRST LOGIN
    prisma.user.create({
      data: {
        email: 'mlro@icos.ae',
        name: 'Ahmed Al-Rashid',
        role: 'mlro',
        jurisdiction: 'CBUAE',
        isActive: true,
      },
    }),
    // Operational MLRO (referenced by Phase 5 data)
    prisma.user.create({
      data: {
        email: 'ahmed@icos.ae',
        name: 'Ahmed Al-Rashid',
        role: 'mlro',
        jurisdiction: 'CBUAE',
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'fatima@icos.ae',
        name: 'Fatima Al-Sayed',
        role: 'compliance_manager',
        jurisdiction: 'DFSA',
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'omar@icos.ae',
        name: 'Omar Hassan',
        role: 'compliance_officer',
        jurisdiction: 'CBUAE',
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'sara@icos.ae',
        name: 'Sara Al-Maktoum',
        role: 'dept_head',
        jurisdiction: 'FSRA',
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'khalid@icos.ae',
        name: 'Khalid Nasser',
        role: 'analyst',
        jurisdiction: 'CBUAE',
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'board@icos.ae',
        name: 'Board Member',
        role: 'board',
        jurisdiction: 'CBUAE',
        isActive: true,
      },
    }),
  ]);

  // Build email → id map for cross-referencing
  const userMap: Record<string, string> = {};
  for (const u of users) {
    userMap[u.email] = u.id;
  }
  const adminId = userMap['admin@icos.ae'];
  const mlroId = userMap['mlro@icos.ae'];
  const ahmedId = userMap['ahmed@icos.ae'];
  const fatimaId = userMap['fatima@icos.ae'];
  const omarId = userMap['omar@icos.ae'];
  const saraId = userMap['sara@icos.ae'];
  const khalidId = userMap['khalid@icos.ae'];
  const boardId = userMap['board@icos.ae'];

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 3. SEED RegulatoryCirculars ────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding RegulatoryCirculars...');
  const circularsData = [
    { title: 'Enhanced Sanctions Screening Requirements for Marine Insurance', regulator: 'CBUAE', circularNumber: 'CBUAE/2024/023', effectiveDate: new Date('2025-03-15'), status: 'analyzed', summary: 'Mandatory screening of vessel IMO numbers, flag state verification, and beneficial ownership checks for all marine cargo and hull policies. Requires integration with UN and OFAC vessel databases.', affectedDepts: 'Underwriting, Claims, Compliance' },
    { title: 'AML Return Filing Procedures - Annual Update', regulator: 'DFSA', circularNumber: 'DFSA/2024/AML-089', effectiveDate: new Date('2025-09-30'), status: 'ingested', summary: 'Updated AML Annual Return template with additional fields for crypto-asset exposure and proliferation financing indicators. Deadline: September 30, 2025.', affectedDepts: 'Compliance, Finance' },
    { title: 'Third-Party Payment Provider Due Diligence', regulator: 'FSRA', circularNumber: 'FSRA/2024/COI-044', effectiveDate: new Date('2025-04-01'), status: 'actioned', summary: 'Enhanced due diligence requirements for third-party payment providers, including travel agents and brokers handling premium collections. Mandatory source-of-funds verification for payouts exceeding AED 35,000.', affectedDepts: 'Underwriting, Claims, Compliance, Finance' },
    { title: 'Customer Risk Assessment Methodology Update', regulator: 'CBUAE', circularNumber: 'CBUAE/2024/019', effectiveDate: new Date('2025-06-01'), status: 'analyzing', summary: 'Revised 5-domain risk assessment framework incorporating emerging risks from virtual asset service providers (VASPs) and decentralized finance (DeFi) exposure.', affectedDepts: 'Compliance, Underwriting, IT' },
    { title: 'goAML XML Schema Version 4.2 Migration', regulator: 'CBUAE', circularNumber: 'CBUAE/2024/015', effectiveDate: new Date('2025-02-28'), status: 'actioned', summary: 'Mandatory migration to goAML XML Schema v4.2 with updated SAR narrative structure requiring 5-part narrative format and additional transaction coding fields.', affectedDepts: 'Compliance, IT' },
  ];
  const circulars = await Promise.all(circularsData.map(d => prisma.regulatoryCircular.create({ data: d })));

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 4. SEED GapAnalysis ────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding GapAnalyses...');
  const gapData = [
    { circularId: circulars[0].id, missingClauses: 'Vessel IMO number screening not implemented in marine policy onboarding workflow', aiConfidence: 0.92, status: 'draft' },
    { circularId: circulars[0].id, missingClauses: 'No flag state verification step in cargo insurance workflow', aiConfidence: 0.88, status: 'draft' },
    { circularId: circulars[1].id, missingClauses: 'Crypto-asset exposure reporting fields missing from AML Return template', aiConfidence: 0.95, status: 'pending_approval' },
    { circularId: circulars[2].id, missingClauses: 'Third-party payment provider EDD not documented for travel agent channels', aiConfidence: 0.91, status: 'approved' },
  ];
  await Promise.all(gapData.map(d => prisma.gapAnalysis.create({ data: d })));

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 5. SEED AMLAlerts ──────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding AMLAlerts...');
  const amlData = [
    { caseId: 'AML-2025-0147', riskScore: 87, riskLevel: 'high', alertType: 'Early Surrender Anomaly', description: 'Policy INS-M-2024-8832 surrendered after 14 months with third-party refund to account in high-risk jurisdiction. Premium: AED 450,000.', aiFlags: 'Early Surrender Pattern, Third-Party Payout Red Flag, High-Risk Jurisdiction Transfer', goAMLDraft: 'PART 1 - REASON FOR SUSPICION: Early policy surrender with third-party refund raises concerns of potential premium laundering. PART 2 - SUBJECT DETAILS: Policyholder [REDACTED]. PART 3 - TRANSACTION DETAILS: Premium AED 450,000 paid via personal account; surrender value AED 382,500 refunded to third-party account. PART 4 - ACCOUNTS INVOLVED: [REDACTED] - Emirates NBD. PART 5 - SUSPICIOUS INDICATORS: Early surrender + third-party refund + high-risk jurisdiction nexus consistent with CBUAE AML Red Flags Ref. 4.7.', status: 'triage', assignedTo: 'Ahmed Al-Rashid', createdBy: 'System', jurisdiction: 'CBUAE', amount: 450000, policyNumber: 'INS-M-2024-8832' },
    { caseId: 'AML-2025-0148', riskScore: 64, riskLevel: 'intermediate', alertType: 'Structuring Pattern', description: 'Multiple premium payments just below AED 35,000 reporting threshold within 72-hour window. Total: AED 165,000 across 5 transactions.', aiFlags: 'Potential Structuring, Threshold Proximity, Rapid Succession Payments', goAMLDraft: 'PART 1 - REASON FOR SUSPICION: Multiple premium payments structured below AED 35,000 threshold. PART 2 - SUBJECT DETAILS: [REDACTED]. PART 3 - TRANSACTION DETAILS: 5 payments of AED 32,000-34,900 within 72 hours totaling AED 165,000. PART 4 - ACCOUNTS INVOLVED: [REDACTED]. PART 5 - SUSPICIOUS INDICATORS: Structuring pattern consistent with CBUAE AML Red Flags Ref. 3.2.', status: 'new', assignedTo: '', createdBy: 'System', jurisdiction: 'CBUAE', amount: 165000, policyNumber: 'INS-G-2024-2241' },
    { caseId: 'AML-2025-0149', riskScore: 42, riskLevel: 'intermediate', alertType: 'PEP Association', description: 'Policy beneficiary identified as family member of Politically Exposed Person from FATF grey-listed jurisdiction.', aiFlags: 'PEP Proximity, Grey-List Jurisdiction, Beneficiary Mismatch', goAMLDraft: 'PART 1 - REASON FOR SUSPICION: Beneficiary linked to PEP from grey-listed jurisdiction. PART 2 - SUBJECT DETAILS: [REDACTED]. PART 3 - TRANSACTION DETAILS: Life policy with AED 2,000,000 sum assured. PART 4 - ACCOUNTS INVOLVED: [REDACTED]. PART 5 - SUSPICIOUS INDICATORS: PEP association per CBUAE guidance Ref. 5.1.', status: 'investigating', assignedTo: 'Fatima Al-Sayed', createdBy: 'System', jurisdiction: 'DFSA', amount: 2000000, policyNumber: 'INS-L-2024-0789' },
    { caseId: 'AML-2025-0150', riskScore: 95, riskLevel: 'critical', alertType: 'Sanctions Hit - Direct Match', description: 'Claim payout beneficiary matches entry on UAE Local Terrorist List with 98.7% confidence. AUTOMATIC BLOCK APPLIED.', aiFlags: 'Direct Sanctions Match, UAE Local Terrorist List, Automatic Freeze Required', goAMLDraft: 'PART 1 - REASON FOR SUSPICION: Direct match on UAE Local Terrorist List. MANDATORY FREEZE AND REPORT. PART 2 - SUBJECT DETAILS: [BLOCKED - SANCTIONS MATCH]. PART 3 - TRANSACTION DETAILS: Claim payout AED 125,000 BLOCKED. PART 4 - ACCOUNTS INVOLVED: [FROZEN]. PART 5 - SUSPICIOUS INDICATORS: Zero-tolerance direct sanctions breach per CBUAE Notice 3551/2021.', status: 'escalated', assignedTo: 'MLRO Office', createdBy: 'System', jurisdiction: 'CBUAE', amount: 125000, policyNumber: 'INS-P-2024-1556' },
    { caseId: 'AML-2025-0151', riskScore: 31, riskLevel: 'low', alertType: 'Geographic Anomaly', description: 'Property insurance application for asset in newly grey-listed jurisdiction. Customer has legitimate business presence.', aiFlags: 'Grey-List Jurisdiction Asset, Legitimate Business Presence Noted', goAMLDraft: 'PART 1 - REASON FOR SUSPICION: Property in grey-listed jurisdiction but with verified business presence. PART 2 - SUBJECT DETAILS: [REDACTED]. PART 3 - TRANSACTION DETAILS: Property premium AED 85,000. PART 4 - ACCOUNTS INVOLVED: [REDACTED]. PART 5 - SUSPICIOUS INDICATORS: Geographic risk per CBUAE guidance - Enhanced monitoring recommended.', status: 'triage', assignedTo: 'Omar Hassan', createdBy: 'System', jurisdiction: 'FSRA', amount: 85000, policyNumber: 'INS-PR-2024-3312' },
  ];
  await Promise.all(amlData.map(d => prisma.aMLAlert.create({ data: d })));

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 6. SEED SanctionsExceptions ────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding SanctionsExceptions...');
  const sanctionsData = [
    { entityName: 'Gulf Maritime Services LLC', riskDomain: 'Interface Risk', justification: 'Broker operates in shared port facility with sanctioned vessel operators but has no direct commercial relationship.', compensatingControls: 'Enhanced transaction monitoring, Quarterly compliance review, Separate bank account verification', sunsetDate: new Date('2025-07-15'), approvedBy: 'Ahmed Al-Rashid (MLRO)', status: 'active', cbuaeNotified: true },
    { entityName: 'Al-Rashid Travel Agency', riskDomain: 'Customer Risk', justification: 'Travel agent channels premium payments through correspondent bank with indirect exposure to sanctioned entity.', compensatingControls: 'Monthly transaction sampling, Source-of-funds verification for payments >AED 25,000', sunsetDate: new Date('2025-08-22'), approvedBy: 'Fatima Al-Sayed (Compliance Manager)', status: 'active', cbuaeNotified: true },
    { entityName: 'Pacific Trade Credit Corp', riskDomain: 'Jurisdiction Risk', justification: 'Trade credit insurance covers transactions involving entities in jurisdiction under OFAC secondary sanctions review.', compensatingControls: 'OFAC 50% Rule screening, Semi-annual reassessment, Legal counsel sign-off', sunsetDate: new Date('2025-03-30'), approvedBy: 'Ahmed Al-Rashid (MLRO)', status: 'active', cbuaeNotified: false },
  ];
  await Promise.all(sanctionsData.map(d => prisma.sanctionsException.create({ data: d })));

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 7. SEED InspectionEvidence ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding InspectionEvidence...');
  const evidenceData = [
    { inspectionId: 'INS-2025-001', fileName: 'UBO_Declaration_Signed_2024.pdf', fileHash: 'a3f2b7c9d1e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4', fileSize: 2456789, fileType: 'application/pdf', aiVerified: true, aiConfidence: 0.94, aiVerificationDetail: 'Contains signed UBO declaration with authorized signatory verification. Document integrity confirmed.', uploadedBy: 'Sara Al-Maktoum', department: 'Underwriting' },
    { inspectionId: 'INS-2025-001', fileName: 'AML_Policy_v3.2_Approved.pdf', fileHash: 'b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4', fileSize: 5123456, fileType: 'application/pdf', aiVerified: true, aiConfidence: 0.98, aiVerificationDetail: 'Contains approved AML/CFT Policy v3.2 with Board sign-off dated Dec 2024. All required sections present.', uploadedBy: 'Omar Hassan', department: 'Compliance' },
    { inspectionId: 'INS-2025-002', fileName: 'Training_Attendance_Q4_2024.xlsx', fileHash: 'c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5', fileSize: 876543, fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', aiVerified: false, aiConfidence: 0.45, aiVerificationDetail: 'Insufficient data: Training attendance records do not cover all mandated staff. Missing departments: Claims (3 staff), IT (2 staff).', uploadedBy: 'Khalid Nasser', department: 'HR' },
  ];
  await Promise.all(evidenceData.map(d => prisma.inspectionEvidence.create({ data: d })));

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 8. SEED Claims ─────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding Claims...');
  const claimsData = [
    { claimNumber: 'CLM-2025-00891', policyNumber: 'INS-M-2024-8832', claimType: 'Marine Cargo', claimantName: 'Gulf Shipping LLC', description: 'Cargo damage claim for shipment from Jebel Ali to Mumbai. Container damage during transit.', amount: 382500, fraudScore: 0.23, status: 'under_review', priority: 'high', assignedAdjuster: 'Ahmed Al-Rashid', siuFlagged: false, jurisdiction: 'CBUAE' },
    { claimNumber: 'CLM-2025-00892', policyNumber: 'INS-P-2024-1556', claimType: 'Property', claimantName: 'Al-Nahda Properties', description: 'Fire damage to commercial property in Business Bay. Estimated structural and contents damage.', amount: 1250000, fraudScore: 0.67, status: 'investigation', priority: 'urgent', assignedAdjuster: 'Fatima Al-Sayed', siuFlagged: true, jurisdiction: 'CBUAE' },
    { claimNumber: 'CLM-2025-00893', policyNumber: 'INS-L-2024-0789', claimType: 'Life', claimantName: 'Beneficiary - Name Withheld', description: 'Death benefit claim under group life policy. Beneficiary is PEP family member.', amount: 2000000, fraudScore: 0.12, status: 'submitted', priority: 'high', assignedAdjuster: '', siuFlagged: false, jurisdiction: 'DFSA' },
    { claimNumber: 'CLM-2025-00894', policyNumber: 'INS-G-2024-2241', claimType: 'Motor', claimantName: 'Mohammed Al-Fahim', description: 'Vehicle theft claim. Luxury vehicle reported stolen from residential compound.', amount: 450000, fraudScore: 0.45, status: 'under_review', priority: 'normal', assignedAdjuster: 'Omar Hassan', siuFlagged: false, jurisdiction: 'CBUAE' },
    { claimNumber: 'CLM-2025-00895', policyNumber: 'INS-PR-2024-3312', claimType: 'Professional Indemnity', claimantName: 'TechConsult Middle East', description: 'Professional negligence claim from client. Error in architectural design causing structural issues.', amount: 850000, fraudScore: 0.08, status: 'approved', priority: 'normal', assignedAdjuster: 'Sara Al-Maktoum', siuFlagged: false, jurisdiction: 'FSRA' },
  ];
  await Promise.all(claimsData.map(d => prisma.claim.create({ data: d })));

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 9. SEED AuditLog ───────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding AuditLogs...');
  const auditLogData = [
    { userId: ahmedId, action: 'APPROVE', resource: 'AML Alert', resourceId: 'AML-2025-0147', details: 'Approved SAR filing after review of AI-generated goAML narrative', aiConfidence: 0.87, sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
    { userId: fatimaId, action: 'ESCALATE', resource: 'AML Alert', resourceId: 'AML-2025-0149', details: 'Escalated to MLRO for PEP-related disposition decision', aiConfidence: 0.72, sha256Hash: 'a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a' },
    { userId: omarId, action: 'UPLOAD', resource: 'Evidence', resourceId: 'INS-2025-001', details: 'Uploaded signed UBO declaration for compliance inspection', aiConfidence: 0.94, sha256Hash: 'a3f2b7c9d1e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4' },
    { userId: ahmedId, action: 'OVERRIDE_BLOCKED', resource: 'Maker/Checker', resourceId: 'AML-2025-0150', details: 'Security Violation: Maker/Checker Breach - User attempted to approve own record', aiConfidence: null, sha256Hash: 'b7e23ec29af22b0b4e41da31e868d57226161c974ca77ac5b2d46b0e8f6a0b3d' },
    { userId: saraId, action: 'APPROVE_POLICY', resource: 'Gap Analysis', resourceId: 'GA-2025-003', details: 'Approved policy update for third-party payment EDD requirements', aiConfidence: 0.91, sha256Hash: 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce' },
  ];
  await Promise.all(auditLogData.map(d => prisma.auditLog.create({ data: d })));

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 10. SEED KRIMetrics ────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding KRIMetrics...');
  const kriData = [
    { name: 'Sanctions False Positive Rate', value: 12.4, target: 15.0, trend: 'down', jurisdiction: 'CBUAE', category: 'Sanctions' },
    { name: 'Active Exceptions (Sunset Tracking)', value: 7, target: 5, trend: 'up', jurisdiction: 'CBUAE', category: 'Sanctions' },
    { name: 'Overdue KYC Reviews', value: 23, target: 0, trend: 'up', jurisdiction: 'CBUAE', category: 'KYC' },
    { name: 'SAR Filing Turnaround', value: 3.2, target: 5.0, trend: 'down', jurisdiction: 'CBUAE', category: 'AML' },
    { name: 'AML Alert Disposition Rate', value: 87.3, target: 90.0, trend: 'up', jurisdiction: 'DFSA', category: 'AML' },
    { name: 'Compliance Training Completion', value: 94.7, target: 100.0, trend: 'up', jurisdiction: 'FSRA', category: 'Training' },
    { name: 'High-Risk Customer Reviews', value: 156, target: 160, trend: 'stable', jurisdiction: 'CBUAE', category: 'KYC' },
    { name: 'Policy Exception Approval Rate', value: 8.2, target: 10.0, trend: 'down', jurisdiction: 'DFSA', category: 'Governance' },
  ];
  await Promise.all(kriData.map(d => prisma.kRIMetric.create({ data: d })));

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 11. SEED Regulations ───────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding Regulations...');
  const regulationsData = [
    { title: 'FDL No. 20 of 2018 (AML/CFT)', issuer: 'CBUAE', category: 'AML/CFT', description: 'Federal Decree-Law on Anti-Money Laundering and Combating the Financing of Terrorism and Illegal Organisations', effectiveDate: new Date('2018-10-30'), nextReviewDate: new Date('2025-06-30'), complianceStatus: 'COMPLIANT', assignedTo: 'Compliance Dept', priority: 'high' },
    { title: 'Consumer Protection Regulation', issuer: 'CBUAE', category: 'Operations', description: 'Regulation on consumer protection in insurance transactions, including fair treatment and disclosure requirements', effectiveDate: new Date('2020-01-01'), nextReviewDate: new Date('2025-11-15'), complianceStatus: 'PARTIAL', assignedTo: 'Legal Team', priority: 'high' },
    { title: 'Outsourcing Regulations', issuer: 'CBUAE', category: 'IT & Security', description: 'Guidelines for outsourcing of insurance activities and services, including cloud computing and third-party risk management', effectiveDate: new Date('2021-06-01'), nextReviewDate: new Date('2025-01-10'), complianceStatus: 'PENDING', assignedTo: 'IT Dept', priority: 'normal' },
    { title: 'Corporate Governance Code', issuer: 'CBUAE', category: 'Governance', description: 'Corporate governance requirements for insurance companies including board composition, risk committees, and internal controls', effectiveDate: new Date('2019-04-15'), nextReviewDate: new Date('2025-09-01'), complianceStatus: 'COMPLIANT', assignedTo: 'Board Secretary', priority: 'high' },
    { title: 'Solvency Framework for Insurance', issuer: 'CBUAE', category: 'Finance', description: 'Capital adequacy and solvency margin requirements for insurance companies operating in the UAE', effectiveDate: new Date('2022-01-01'), nextReviewDate: new Date('2025-12-31'), complianceStatus: 'COMPLIANT', assignedTo: 'CFO Office', priority: 'urgent' },
    { title: 'Data Protection Regulation', issuer: 'CBUAE', category: 'Data Privacy', description: 'Requirements for protection of personal data in insurance operations, including customer consent and data residency', effectiveDate: new Date('2023-03-01'), nextReviewDate: new Date('2025-07-15'), complianceStatus: 'PARTIAL', assignedTo: 'Data Protection Officer', priority: 'high' },
    { title: 'Motor Insurance Unified Policy', issuer: 'CBUAE', category: 'Products', description: 'Standardized motor insurance policy terms and conditions for comprehensive and third-party coverage', effectiveDate: new Date('2024-01-01'), nextReviewDate: new Date('2026-01-01'), complianceStatus: 'COMPLIANT', assignedTo: 'Motor Underwriting', priority: 'normal' },
    { title: 'Health Insurance Regulations (DHA)', issuer: 'DFSA', category: 'Health', description: 'Dubai Health Authority requirements for health insurance providers including mandatory coverage and network standards', effectiveDate: new Date('2022-07-01'), nextReviewDate: new Date('2025-10-30'), complianceStatus: 'NON_COMPLIANT', assignedTo: 'Health Line Manager', priority: 'urgent' },
  ];
  await Promise.all(regulationsData.map(d => prisma.regulation.create({ data: d })));

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 12. SEED Policies (including AI Engine baseline configs) ───────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding Policies...');
  const policiesData = [
    { title: 'AML/CFT Compliance Policy', policyNumber: 'POL-AML-001', category: 'AML/CFT', version: '3.2', status: 'published', department: 'Compliance', owner: 'Ahmed Al-Rashid', reviewDate: new Date('2025-01-15'), approvalDate: new Date('2024-12-20'), approvedBy: 'Board Risk Committee', aiReviewed: true, aiConfidence: 0.96 },
    { title: 'Sanctions Screening Policy', policyNumber: 'POL-SANC-001', category: 'Sanctions', version: '2.1', status: 'published', department: 'Compliance', owner: 'Ahmed Al-Rashid', reviewDate: new Date('2025-03-01'), approvalDate: new Date('2024-11-15'), approvedBy: 'MLRO', aiReviewed: true, aiConfidence: 0.94 },
    { title: 'Customer Due Diligence (CDD) SOP', policyNumber: 'SOP-CDD-001', category: 'KYC', version: '4.0', status: 'under_review', department: 'Compliance', owner: 'Fatima Al-Sayed', reviewDate: new Date('2025-02-28'), aiReviewed: true, aiConfidence: 0.89 },
    { title: 'Data Privacy & Protection Policy', policyNumber: 'POL-DP-001', category: 'Data Privacy', version: '1.5', status: 'draft', department: 'Legal', owner: 'Khalid Nasser', aiReviewed: false, aiConfidence: 0 },
    { title: 'Claims Management Procedures', policyNumber: 'SOP-CLM-001', category: 'Claims', version: '2.3', status: 'published', department: 'Claims', owner: 'Sara Al-Maktoum', reviewDate: new Date('2025-06-15'), approvalDate: new Date('2024-09-30'), approvedBy: 'Claims Manager', aiReviewed: true, aiConfidence: 0.91 },
    { title: 'Underwriting Risk Appetite Policy', policyNumber: 'POL-UW-001', category: 'Underwriting', version: '2.0', status: 'approved', department: 'Underwriting', owner: 'Omar Hassan', reviewDate: new Date('2025-04-01'), approvalDate: new Date('2025-01-10'), approvedBy: 'Chief Underwriter', aiReviewed: true, aiConfidence: 0.87 },
    { title: 'Business Continuity Plan', policyNumber: 'POL-BCP-001', category: 'Operations', version: '1.2', status: 'published', department: 'Operations', owner: 'Operations Manager', reviewDate: new Date('2025-08-01'), approvalDate: new Date('2024-06-15'), approvedBy: 'COO', aiReviewed: false, aiConfidence: 0 },
    { title: 'Third-Party Due Diligence Policy', policyNumber: 'POL-TPDD-001', category: 'Vendor Mgmt', version: '1.0', status: 'draft', department: 'Procurement', owner: 'Procurement Lead', aiReviewed: false, aiConfidence: 0 },

    // ── AI Engine Baseline Configuration Policies ─────────────────────────────
    // These Policy records represent the baseline AI Engine configurations.
    // They define how the on-premise AI models operate for AML, sanctions,
    // and compliance screening tasks. Stored as Policies with category='AI Engine'
    // since no dedicated AIConfig model exists.
    {
      title: 'AI Engine — AML Transaction Monitoring Configuration',
      policyNumber: 'AI-ENG-AML-001',
      category: 'AI Engine',
      version: '1.4',
      status: 'published',
      department: 'IT & Compliance',
      owner: 'AI Operations',
      reviewDate: new Date('2025-04-01'),
      approvalDate: new Date('2025-01-15'),
      approvedBy: 'CTO & MLRO',
      aiReviewed: true,
      aiConfidence: 1.0,
    },
    {
      title: 'AI Engine — Sanctions Screening Fuzzy Match Configuration',
      policyNumber: 'AI-ENG-SANC-001',
      category: 'AI Engine',
      version: '1.2',
      status: 'published',
      department: 'IT & Compliance',
      owner: 'AI Operations',
      reviewDate: new Date('2025-03-15'),
      approvalDate: new Date('2025-01-10'),
      approvedBy: 'CTO & MLRO',
      aiReviewed: true,
      aiConfidence: 1.0,
    },
    {
      title: 'AI Engine — goAML Narrative Generation Configuration',
      policyNumber: 'AI-ENG-GOAML-001',
      category: 'AI Engine',
      version: '1.1',
      status: 'under_review',
      department: 'IT & Compliance',
      owner: 'AI Operations',
      reviewDate: new Date('2025-05-01'),
      aiReviewed: true,
      aiConfidence: 1.0,
    },
  ];
  const policies = await Promise.all(policiesData.map(d => prisma.policy.create({ data: d })));

  // Build policy number → id map
  const policyMap: Record<string, { id: string; policyNumber: string; title: string; version: string }> = {};
  for (const p of policies) {
    policyMap[p.policyNumber] = {
      id: p.id,
      policyNumber: p.policyNumber,
      title: p.title,
      version: p.version,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 13. SEED LaborLawCompliance ────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding LaborLawCompliance...');
  const laborData = [
    { requirement: 'Emiratisation Quota - Private Sector (2%)', category: 'Emiratisation', authority: 'MOHRE', complianceStatus: 'COMPLIANT', dueDate: new Date('2025-12-31'), assignedTo: 'HR Department', details: 'Achieve minimum 2% Emirati workforce in skilled positions by year-end', quotaType: 'Percentage', currentCount: 12, requiredCount: 10, lastVerified: new Date('2025-01-15') },
    { requirement: 'Emiratisation Semi-Annual Increment', category: 'Emiratisation', authority: 'MOHRE', complianceStatus: 'PARTIAL', dueDate: new Date('2025-06-30'), assignedTo: 'HR Department', details: 'Add 1% Emirati workforce per half-year. Current rate: 0.5%', quotaType: 'Incremental', currentCount: 5, requiredCount: 10, lastVerified: new Date('2025-01-10') },
    { requirement: 'Wage Protection System (WPS) Compliance', category: 'WPS', authority: 'MOHRE', complianceStatus: 'COMPLIANT', dueDate: new Date('2025-01-31'), assignedTo: 'Payroll Team', details: 'All employee salaries processed through WPS-approved channels', quotaType: 'Full Compliance', currentCount: 450, requiredCount: 450, lastVerified: new Date('2025-01-15') },
    { requirement: 'Midday Break Rule (Jun-Sep)', category: 'Working Conditions', authority: 'MOHRE', complianceStatus: 'NOT_STARTED', dueDate: new Date('2025-06-15'), assignedTo: 'Operations', details: 'Mandatory midday break for outdoor workers from 12:30 PM to 3:00 PM during summer months', quotaType: 'N/A', currentCount: 0, requiredCount: 0 },
    { requirement: 'Employee Insurance (DHA/MOHRE)', category: 'Insurance', authority: 'MOHRE', complianceStatus: 'COMPLIANT', dueDate: new Date('2025-12-31'), assignedTo: 'HR Department', details: 'All employees covered under mandatory health insurance scheme', quotaType: 'Full Coverage', currentCount: 450, requiredCount: 450, lastVerified: new Date('2025-01-01') },
    { requirement: 'Gratuity End-of-Service Benefits', category: 'Benefits', authority: 'MOHRE', complianceStatus: 'COMPLIANT', dueDate: new Date('2025-12-31'), assignedTo: 'Finance', details: 'Accrual and payment of end-of-service benefits per UAE Labor Law', quotaType: 'Full Compliance', currentCount: 450, requiredCount: 450, lastVerified: new Date('2024-12-31') },
    { requirement: 'Work Permit Renewal Compliance', category: 'Immigration', authority: 'MOHRE', complianceStatus: 'PARTIAL', dueDate: new Date('2025-03-31'), assignedTo: 'HR Department', details: '3 work permits expiring within 30 days require immediate renewal', quotaType: 'Permits', currentCount: 447, requiredCount: 450, lastVerified: new Date('2025-01-17') },
  ];
  await Promise.all(laborData.map(d => prisma.laborLawCompliance.create({ data: d })));

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 14. SEED LegalCases ────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding LegalCases...');
  const legalData = [
    { caseNumber: 'LEG-2025-001', title: 'Policyholder Dispute - Claim Denial', caseType: 'Litigation', status: 'open', priority: 'high', assignedCounsel: 'Al-Maktoum Legal', department: 'Claims', description: 'Policyholder challenging denial of marine cargo claim. Allegation of bad faith and insufficient investigation.', filingDate: new Date('2025-01-05'), nextHearing: new Date('2025-02-15'), jurisdiction: 'DIFC Courts', aiSummary: 'Case involves marine cargo claim denial. Policyholder alleges failure to conduct proper investigation before denial. Recommend settlement given potential DIFC Courts unfavorable ruling on procedural fairness grounds.' },
    { caseNumber: 'LEG-2025-002', title: 'Broker Commission Dispute', caseType: 'Arbitration', status: 'in_progress', priority: 'normal', assignedCounsel: 'Internal Legal', department: 'Distribution', description: 'Dispute with former authorized broker over outstanding commission payments and non-compete clause enforcement.', filingDate: new Date('2024-11-20'), nextHearing: new Date('2025-02-01'), jurisdiction: 'Dubai Courts', aiSummary: 'Broker commission dispute. Non-compete clause may be enforceable under UAE Commercial Agencies Law. Recommend mediation before arbitration.' },
    { caseNumber: 'LEG-2025-003', title: 'Regulatory Inquiry - CBUAE Examination', caseType: 'Regulatory', status: 'in_progress', priority: 'urgent', assignedCounsel: 'Baker McKenzie', department: 'Compliance', description: 'CBUAE examination findings requiring formal response. 3 observations on AML reporting procedures.', filingDate: new Date('2025-01-10'), nextHearing: new Date('2025-01-31'), jurisdiction: 'CBUAE', aiSummary: 'Regulatory examination with 3 observations. Two relate to SAR filing timeliness, one to EDD documentation gaps. Recommend immediate remediation plan and proactive response to CBUAE.' },
    { caseNumber: 'LEG-2025-004', title: 'Employee Termination Dispute', caseType: 'Labor', status: 'resolved', priority: 'normal', assignedCounsel: 'Internal Legal', department: 'HR', description: 'Former employee claims arbitrary dismissal. Settlement reached through MOHRE mediation.', filingDate: new Date('2024-12-01'), jurisdiction: 'MOHRE', aiSummary: 'Labor dispute resolved through MOHRE mediation. Settlement amount AED 85,000. Case closed with no admission of liability.' },
    { caseNumber: 'LEG-2025-005', title: 'Subrogation Recovery - Property Damage', caseType: 'Recovery', status: 'open', priority: 'normal', assignedCounsel: 'Al-Tamimi & Co', department: 'Claims', description: 'Subrogation claim against third-party contractor for property damage caused by negligent construction work.', filingDate: new Date('2024-10-15'), nextHearing: new Date('2025-03-10'), jurisdiction: 'Dubai Courts', aiSummary: 'Subrogation recovery potential high. Third-party contractor liability established. Recommend proceeding with claim for AED 1,250,000 recovery.' },
  ];
  await Promise.all(legalData.map(d => prisma.legalCase.create({ data: d })));

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 15. SEED TrainingCourses ───────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding TrainingCourses...');
  const courseData = [
    { title: 'AML/CFT Fundamentals 2025', category: 'AML/CFT', provider: 'IC-OS Training', durationHours: 8, isMandatory: true, targetAudience: 'All Staff', certification: true, validForMonths: 12, status: 'active' },
    { title: 'Sanctions Screening Advanced', category: 'Sanctions', provider: 'ComplianceHub', durationHours: 4, isMandatory: true, targetAudience: 'Compliance & Underwriting', certification: true, validForMonths: 6, status: 'active' },
    { title: 'goAML Reporting Workshop', category: 'Reporting', provider: 'FIU Training', durationHours: 6, isMandatory: true, targetAudience: 'Compliance Officers', certification: true, validForMonths: 12, status: 'active' },
    { title: 'Data Privacy & GDPR for Insurance', category: 'Data Privacy', provider: 'PrivacyPro', durationHours: 3, isMandatory: false, targetAudience: 'IT & Compliance', certification: false, validForMonths: 24, status: 'active' },
    { title: 'Fraud Detection & SIU Procedures', category: 'Fraud', provider: 'IC-OS Training', durationHours: 5, isMandatory: true, targetAudience: 'Claims & SIU', certification: true, validForMonths: 12, status: 'active' },
    { title: 'UAE Insurance Law Update 2025', category: 'Legal', provider: 'LegalEdge', durationHours: 2, isMandatory: true, targetAudience: 'All Staff', certification: false, validForMonths: 6, status: 'active' },
    { title: 'Customer Due Diligence (CDD) Refresh', category: 'KYC', provider: 'IC-OS Training', durationHours: 3, isMandatory: true, targetAudience: 'Underwriting & Compliance', certification: true, validForMonths: 12, status: 'active' },
  ];
  const courses = await Promise.all(courseData.map(d => prisma.trainingCourse.create({ data: d })));

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 16. SEED TrainingEnrollments ───────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding TrainingEnrollments...');
  const enrollmentData = [
    { courseId: courses[0].id, userId: fatimaId, userName: 'Fatima Al-Sayed', department: 'Compliance', status: 'completed', enrolledAt: new Date('2024-12-01'), completedAt: new Date('2024-12-15'), expiryDate: new Date('2025-12-15'), score: 92 },
    { courseId: courses[1].id, userId: omarId, userName: 'Omar Hassan', department: 'Underwriting', status: 'expired', enrolledAt: new Date('2024-06-01'), completedAt: new Date('2024-06-20'), expiryDate: new Date('2024-12-20'), score: 88 },
    { courseId: courses[2].id, userId: saraId, userName: 'Sara Al-Maktoum', department: 'Compliance', status: 'in_progress', enrolledAt: new Date('2025-01-05') },
    { courseId: courses[0].id, userId: khalidId, userName: 'Khalid Nasser', department: 'HR', status: 'overdue', enrolledAt: new Date('2024-11-01'), expiryDate: new Date('2025-01-15') },
    { courseId: courses[4].id, userId: ahmedId, userName: 'Ahmed Al-Rashid', department: 'Claims', status: 'completed', enrolledAt: new Date('2024-10-01'), completedAt: new Date('2024-10-28'), expiryDate: new Date('2025-10-28'), score: 95 },
  ];
  const enrollments = await Promise.all(enrollmentData.map(d => prisma.trainingEnrollment.create({ data: d })));

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 17. SEED ComplianceAudits ──────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding ComplianceAudits...');
  const auditData = [
    { auditNumber: 'AUD-2025-001', title: 'Q1 Internal AML/CFT Audit', auditType: 'internal', status: 'in_progress', scheduledDate: new Date('2025-01-15'), leadAuditor: 'Internal Audit Team', scope: 'AML/CFT program effectiveness, SAR filing procedures, EDD documentation', findings: '2 high, 3 medium, 1 low findings identified', remediationStatus: 'in_progress', remediationDueDate: new Date('2025-03-15'), riskLevel: 'high', jurisdiction: 'CBUAE', department: 'Compliance' },
    { auditNumber: 'AUD-2025-002', title: 'CBUAE On-Site Examination', auditType: 'regulatory', status: 'scheduled', scheduledDate: new Date('2025-03-01'), leadAuditor: 'CBUAE Supervision Team', scope: 'Full scope examination of insurance operations', remediationStatus: 'not_started', riskLevel: 'critical', jurisdiction: 'CBUAE', department: 'All' },
    { auditNumber: 'AUD-2025-003', title: 'Data Privacy Compliance Review', auditType: 'internal', status: 'completed', scheduledDate: new Date('2024-11-15'), completedDate: new Date('2024-12-20'), leadAuditor: 'DPO Office', scope: 'Data protection practices, consent management, data residency compliance', findings: '1 high, 4 medium findings. Consent forms require update for DIFC/ADGM data protection law alignment', remediationStatus: 'in_progress', remediationDueDate: new Date('2025-02-28'), riskLevel: 'intermediate', jurisdiction: 'DFSA', department: 'IT & Legal' },
    { auditNumber: 'AUD-2025-004', title: 'External Actuarial Review', auditType: 'external', status: 'completed', scheduledDate: new Date('2024-10-01'), completedDate: new Date('2024-11-15'), leadAuditor: 'Deloitte Actuarial', scope: 'Reserving adequacy, solvency margin calculation, reinsurance program', findings: 'Reserves adequate. Minor methodology update recommended for marine portfolio', remediationStatus: 'completed', remediationDueDate: new Date('2025-01-31'), riskLevel: 'low', jurisdiction: 'CBUAE', department: 'Finance' },
    { auditNumber: 'AUD-2025-005', title: 'Sanctions Screening Effectiveness', auditType: 'internal', status: 'scheduled', scheduledDate: new Date('2025-02-15'), leadAuditor: 'Compliance Team', scope: 'Sanctions screening tool effectiveness, false positive analysis, escalation procedures', remediationStatus: 'not_started', riskLevel: 'high', jurisdiction: 'CBUAE', department: 'Compliance & IT' },
    { auditNumber: 'AUD-2025-006', title: 'Emiratisation Compliance Check', auditType: 'regulatory', status: 'completed', scheduledDate: new Date('2024-12-01'), completedDate: new Date('2024-12-15'), leadAuditor: 'MOHRE Inspector', scope: 'Emiratisation quota compliance, WPS adherence, labor law compliance', findings: '1 medium finding: Emiratisation semi-annual increment below target', remediationStatus: 'overdue', remediationDueDate: new Date('2025-01-15'), riskLevel: 'intermediate', jurisdiction: 'CBUAE', department: 'HR' },
  ];
  const audits = await Promise.all(auditData.map(d => prisma.complianceAudit.create({ data: d })));

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 18. SEED Phase 5: ComplianceAlerts ─────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding ComplianceAlerts...');
  const complianceAlertData = [
    {
      alertType: 'SAR_DEADLINE',
      severity: 'critical',
      status: 'active',
      title: 'SAR Filing Deadline — Case AML-2025-0147',
      description: 'SAR filing deadline approaching for case AML-2025-0147. Early surrender anomaly with third-party refund to high-risk jurisdiction. Filing must be completed within 30 calendar days of trigger date per FDL 10/2025 Art. 8.',
      sourceModule: 'aml',
      sourceEntityId: 'AML-2025-0147',
      sourceEntityType: 'AMLAlert',
      dueDate: new Date('2025-04-15'),
      assignedToId: ahmedId,
      isImmutable: true,
      sha256Hash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1',
    },
    {
      alertType: 'REGULATORY_DEADLINE',
      severity: 'high',
      status: 'active',
      title: 'CBUAE Quarterly Return — Q1 2025',
      description: 'CBUAE quarterly insurance return for Q1 2025 is due. All insurance records must be validated and submitted through the CBUAE portal. Late submission may result in administrative penalties per FDL 10/2025 Art. 21.',
      sourceModule: 'regulatory',
      sourceEntityId: null,
      sourceEntityType: null,
      dueDate: new Date('2025-04-30'),
      assignedToId: fatimaId,
      isImmutable: true,
      sha256Hash: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
    },
    {
      alertType: 'MLRO_ESCALATION',
      severity: 'critical',
      status: 'active',
      title: 'MLRO Escalation — Direct Sanctions Match',
      description: 'Critical escalation to MLRO: Direct sanctions match on UAE Local Terrorist List (Case AML-2025-0150). Automatic freeze applied. Immediate MLRO review and CBUAE notification required per CR 134/2025 Art. 25 within 24 hours.',
      sourceModule: 'sanctions',
      sourceEntityId: 'AML-2025-0150',
      sourceEntityType: 'AMLAlert',
      dueDate: new Date('2025-03-20'),
      assignedToId: ahmedId,
      isImmutable: true,
      sha256Hash: 'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
    },
    {
      alertType: 'KYC_REVIEW_OVERDUE',
      severity: 'high',
      status: 'active',
      title: 'Overdue KYC Reviews — 23 High-Risk Customers',
      description: '23 high-risk customer KYC reviews are overdue per the periodic review schedule. Reviews must be completed within the established SLA per CBUAE Notice 3551/2021 S5.1 and CR 134/2025 Art. 15. Current overdue count exceeds the target of zero.',
      sourceModule: 'kyc',
      sourceEntityId: null,
      sourceEntityType: null,
      dueDate: new Date('2025-03-31'),
      assignedToId: omarId,
      isImmutable: true,
      sha256Hash: 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4',
    },
    {
      alertType: 'TRAINING_OVERDUE',
      severity: 'medium',
      status: 'active',
      title: 'AML Training Overdue — 4 Staff Members',
      description: '4 staff members have overdue AML/CFT training certifications. Annual refresher training must be completed per CBUAE Notice 3551/2021 S9.1. Non-compliant staff should not perform CDD or transaction monitoring duties until training is completed.',
      sourceModule: 'training',
      sourceEntityId: null,
      sourceEntityType: null,
      dueDate: new Date('2025-03-15'),
      assignedToId: khalidId,
      isImmutable: true,
      sha256Hash: 'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5',
    },
  ];
  const complianceAlerts = await Promise.all(
    complianceAlertData.map(d => prisma.complianceAlert.create({ data: d }))
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 19. SEED Phase 5: SanctionsScreenings ──────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding SanctionsScreenings...');
  const screeningData = [
    {
      screeningId: 'SCR-2025-00142',
      entityType: 'INDIVIDUAL',
      primaryName: 'Mohammed Al-Fahim',
      aliases: '["M. Al-Fahim", "Mohd Al-Fahim"]',
      identifiers: '{"emiratesId": "784-1990-1234567-1", "passportNo": "N1234567", "dob": "1990-03-15"}',
      status: 'CLEAR',
      highestScore: 12,
      matches: '[]',
      screeningLists: '["UAE_LOCAL_TERRORIST_LIST", "UNSC_CONSOLIDATED", "OFAC_SDN", "EU_SANCTIONS", "UK_HMT"]',
      idempotencyKey: 'idem-scr-142-2025',
      screenedById: omarId,
      failClosed: true,
    },
    {
      screeningId: 'SCR-2025-00168',
      entityType: 'ENTITY',
      primaryName: 'Gulf Maritime Services LLC',
      aliases: '["Gulf Maritime", "GMS LLC Dubai"]',
      identifiers: '{"tradeLicenseNo": "CN-123456", "trn": "100123456700003"}',
      status: 'POTENTIAL_MATCH',
      highestScore: 72,
      matches: '[{"listName": "OFAC_SDN", "matchedName": "Gulf Maritime Services International", "score": 72, "matchType": "FUZZY"}]',
      screeningLists: '["UAE_LOCAL_TERRORIST_LIST", "UNSC_CONSOLIDATED", "OFAC_SDN", "EU_SANCTIONS", "UK_HMT"]',
      idempotencyKey: 'idem-scr-168-2025',
      screenedById: fatimaId,
      failClosed: true,
    },
    {
      screeningId: 'SCR-2025-00195',
      entityType: 'INDIVIDUAL',
      primaryName: 'Ahmed Khamis Al-Balushi',
      aliases: '["A.K. Al-Balushi", "Ahmed Al-Baloshi"]',
      identifiers: '{"passportNo": "P9876543", "nationality": "Omani", "dob": "1978-07-22"}',
      status: 'CONFIRMED_MATCH',
      highestScore: 98,
      matches: '[{"listName": "UNSC_CONSOLIDATED", "matchedName": "Ahmed Khamis Al-Balushi", "score": 98, "matchType": "EXACT"}, {"listName": "UAE_LOCAL_TERRORIST_LIST", "matchedName": "Ahmed Khamis Al-Balushi", "score": 98, "matchType": "EXACT"}]',
      screeningLists: '["UAE_LOCAL_TERRORIST_LIST", "UNSC_CONSOLIDATED", "OFAC_SDN", "EU_SANCTIONS", "UK_HMT"]',
      idempotencyKey: 'idem-scr-195-2025',
      screenedById: ahmedId,
      failClosed: true,
    },
  ];
  const screenings = await Promise.all(
    screeningData.map(d => prisma.sanctionsScreening.create({ data: d }))
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 20. SEED Phase 5: SARCases ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding SARCases...');
  const sarData = [
    {
      caseNumber: 'SAR-2025-0031',
      alertId: null,
      filingDeadline: new Date('2025-04-10'),
      triggerDate: new Date('2025-03-11'),
      daysRemaining: 15,
      status: 'DRAFT',
      narrative: 'PART 1 - REASON FOR SUSPICION: Policyholder engaged in early surrender of marine cargo insurance policy with refund directed to a third-party account in a high-risk jurisdiction. The pattern is consistent with premium laundering through insurance products. PART 2 - SUBJECT DETAILS: Policyholder is a corporate entity with complex ownership structure. UBO identified as a national of a FATF grey-listed jurisdiction. PART 3 - TRANSACTION DETAILS: Premium of AED 450,000 paid via personal account; surrender value of AED 382,500 refunded to third-party account. PART 4 - ACCOUNTS INVOLVED: Emirates NBD account ending 4521 (premium payer); Mashreq Bank account ending 8837 (refund recipient). PART 5 - SUSPICIOUS INDICATORS: Early surrender + third-party refund + high-risk jurisdiction nexus per CBUAE Red Flags Ref. 4.7.',
      goamlXmlPath: null,
      tippingOffWarning: true,
      tippingOffAcknowledgedAt: new Date('2025-03-11T10:30:00Z'),
      subjectName: 'Gulf Shipping LLC — UBO: [REDACTED]',
      subjectType: 'ENTITY',
      jurisdiction: 'CBUAE',
      riskLevel: 'high',
      createdById: omarId,
      reviewedById: null,
      submittedById: null,
    },
    {
      caseNumber: 'SAR-2025-0028',
      alertId: null,
      filingDeadline: new Date('2025-03-28'),
      triggerDate: new Date('2025-02-26'),
      daysRemaining: 5,
      status: 'PENDING_REVIEW',
      narrative: 'PART 1 - REASON FOR SUSPICION: Multiple premium payments structured below the AED 35,000 reporting threshold within 72-hour window, totalling AED 165,000. The structuring pattern suggests deliberate avoidance of transaction monitoring controls. PART 2 - SUBJECT DETAILS: Individual policyholder, UAE national, employed in cash-intensive business. PART 3 - TRANSACTION DETAILS: 5 payments of AED 32,000-34,900 made within 72 hours via different payment channels. PART 4 - ACCOUNTS INVOLVED: ADCB personal account ending 2234. PART 5 - SUSPICIOUS INDICATORS: Structuring pattern per CBUAE Red Flags Ref. 3.2; threshold proximity; rapid succession payments across channels.',
      goamlXmlPath: '/sar-xml/SAR-2025-0028-draft.xml',
      tippingOffWarning: true,
      tippingOffAcknowledgedAt: new Date('2025-02-26T14:15:00Z'),
      subjectName: '[REDACTED] — Structuring Pattern',
      subjectType: 'INDIVIDUAL',
      jurisdiction: 'CBUAE',
      riskLevel: 'high',
      createdById: fatimaId,
      reviewedById: ahmedId,
      submittedById: null,
    },
    {
      caseNumber: 'SAR-2025-0019',
      alertId: null,
      filingDeadline: new Date('2025-02-28'),
      triggerDate: new Date('2025-01-29'),
      daysRemaining: 0,
      status: 'SUBMITTED_TO_FIU',
      narrative: 'PART 1 - REASON FOR SUSPICION: Life insurance claim beneficiary identified as family member of a Politically Exposed Person from a FATF grey-listed jurisdiction. The policy structure and beneficiary designation suggest potential use of insurance for wealth transfer obscuring the PEP connection. PART 2 - SUBJECT DETAILS: Policyholder deceased; beneficiary is PEP family member from grey-listed jurisdiction. PART 3 - TRANSACTION DETAILS: Life policy with AED 2,000,000 sum assured. Premium payment pattern inconsistent with declared income. PART 4 - ACCOUNTS INVOLVED: [REDACTED] — DIFC branch. PART 5 - SUSPICIOUS INDICATORS: PEP association per CBUAE guidance Ref. 5.1; income-policy mismatch; grey-list jurisdiction nexus.',
      goamlXmlPath: '/sar-xml/SAR-2025-0019-submitted.xml',
      tippingOffWarning: true,
      tippingOffAcknowledgedAt: new Date('2025-01-29T09:00:00Z'),
      subjectName: 'PEP Family Member — [REDACTED]',
      subjectType: 'INDIVIDUAL',
      jurisdiction: 'DFSA',
      riskLevel: 'high',
      createdById: fatimaId,
      reviewedById: ahmedId,
      submittedById: ahmedId,
      submittedAt: new Date('2025-02-27T16:45:00Z'),
    },
  ];
  const sarCases = await Promise.all(
    sarData.map(d => prisma.sARCase.create({ data: d }))
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 21. SEED Phase 5: CalendarEvents ───────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding CalendarEvents...');
  const calendarData = [
    {
      title: 'CBUAE On-Site Examination',
      description: 'Full scope CBUAE on-site examination of insurance operations. Examination team will review AML/CFT programme, sanctions compliance, and customer due diligence records.',
      eventType: 'regulatory',
      eventDate: new Date('2025-03-01'),
      endDate: new Date('2025-03-05'),
      priority: 'urgent',
      jurisdiction: 'CBUAE',
      status: 'upcoming',
      sourceModule: 'audits',
      sourceEntityId: audits[1]?.id ?? null,
      isRecurring: false,
      assignedToId: ahmedId,
      location: 'IC-OS Head Office — Dubai',
      notes: 'Prepare all compliance documentation including AML policy, SAR filings, training records, and sanctions screening logs.',
    },
    {
      title: 'Q1 2025 Internal AML/CFT Audit',
      description: 'Quarterly internal audit of AML/CFT programme effectiveness, SAR filing procedures, and EDD documentation.',
      eventType: 'audit',
      eventDate: new Date('2025-01-15'),
      endDate: new Date('2025-01-25'),
      priority: 'high',
      jurisdiction: 'CBUAE',
      status: 'in_progress',
      sourceModule: 'audits',
      sourceEntityId: audits[0]?.id ?? null,
      isRecurring: true,
      recurringPattern: 'quarterly',
      assignedToId: fatimaId,
      location: 'Virtual / IC-OS Office',
    },
    {
      title: 'AML/CFT Annual Refresher Training — All Staff',
      description: 'Mandatory annual AML/CFT refresher training for all staff members. Covers FDL 10/2025 updates, CR 134/2025 changes, and new red flag indicators. Per CBUAE Notice 3551/2021 S9.1.',
      eventType: 'training',
      eventDate: new Date('2025-03-15'),
      endDate: new Date('2025-03-30'),
      priority: 'high',
      jurisdiction: 'CBUAE',
      status: 'upcoming',
      sourceModule: 'training',
      isRecurring: true,
      recurringPattern: 'annually',
      assignedToId: khalidId,
      location: 'Online / IC-OS Learning Platform',
    },
    {
      title: 'AML/CFT Policy Annual Review',
      description: 'Annual review and update of AML/CFT Compliance Policy per CR 134/2025 Art. 20. Policy must be reviewed and approved by senior management.',
      eventType: 'policy',
      eventDate: new Date('2025-06-01'),
      priority: 'high',
      jurisdiction: 'CBUAE',
      status: 'upcoming',
      sourceModule: 'policies',
      sourceEntityId: policyMap['POL-AML-001']?.id ?? null,
      isRecurring: true,
      recurringPattern: 'annually',
      assignedToId: ahmedId,
      notes: 'Must incorporate FDL 10/2025 and CR 134/2025 changes.',
    },
    {
      title: 'goAML XML Schema v4.2 Migration Deadline',
      description: 'Deadline for migration to goAML XML Schema v4.2. All SAR filings must use the new schema format with 5-part narrative structure and additional transaction coding fields.',
      eventType: 'aml',
      eventDate: new Date('2025-02-28'),
      priority: 'urgent',
      jurisdiction: 'CBUAE',
      status: 'completed',
      sourceModule: 'goaml',
      isRecurring: false,
      assignedToId: omarId,
    },
    {
      title: 'SAR Filing Deadline — SAR-2025-0028',
      description: 'SAR filing deadline for SAR-2025-0028. Filing must be completed within 30 calendar days per FDL 10/2025 Art. 8. Current status: Pending MLRO review.',
      eventType: 'sar_deadline',
      eventDate: new Date('2025-03-28'),
      priority: 'urgent',
      jurisdiction: 'CBUAE',
      status: 'upcoming',
      sourceModule: 'sar',
      sourceEntityId: sarCases[1]?.id ?? null,
      isRecurring: false,
      assignedToId: ahmedId,
      notes: 'Tipping-off warning applies. Do not discuss with non-authorized personnel.',
    },
    {
      title: 'High-Risk Customer KYC Review Batch — March',
      description: 'Monthly batch review of high-risk customer KYC profiles. 23 overdue reviews from previous batches must be completed. Per CBUAE Notice 3551/2021 S5.1 and CR 134/2025 Art. 15.',
      eventType: 'kyc_review',
      eventDate: new Date('2025-03-31'),
      priority: 'high',
      jurisdiction: 'CBUAE',
      status: 'upcoming',
      sourceModule: 'kyc',
      isRecurring: true,
      recurringPattern: 'monthly',
      assignedToId: omarId,
    },
    {
      title: 'Sanctions Screening Effectiveness Audit',
      description: 'Internal audit of sanctions screening tool effectiveness, false positive analysis, and escalation procedures per CR 134/2025 Art. 26 and CBUAE Notice 3551/2021 S7.1-S7.2.',
      eventType: 'audit',
      eventDate: new Date('2025-02-15'),
      priority: 'high',
      jurisdiction: 'CBUAE',
      status: 'scheduled',
      sourceModule: 'audits',
      sourceEntityId: audits[4]?.id ?? null,
      isRecurring: false,
      assignedToId: fatimaId,
      location: 'Compliance Department',
    },
  ];
  const calendarEvents = await Promise.all(
    calendarData.map(d => prisma.calendarEvent.create({ data: d }))
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 22. SEED Phase 5: PolicyAttestations ───────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding PolicyAttestations...');
  const amlPolicy = policyMap['POL-AML-001'];
  const sanctionsPolicy = policyMap['POL-SANC-001'];
  const cddSop = policyMap['SOP-CDD-001'];

  const attestationData = [
    {
      policyId: amlPolicy?.id ?? 'seed-policy-aml',
      policyNumber: 'POL-AML-001',
      policyTitle: 'AML/CFT Compliance Policy',
      userId: fatimaId,
      userName: 'Fatima Al-Sayed',
      department: 'Compliance',
      status: 'pending',
      attestationDeadline: new Date('2025-03-31'),
      version: '3.2',
    },
    {
      policyId: sanctionsPolicy?.id ?? 'seed-policy-sanc',
      policyNumber: 'POL-SANC-001',
      policyTitle: 'Sanctions Screening Policy',
      userId: omarId,
      userName: 'Omar Hassan',
      department: 'Underwriting',
      status: 'pending',
      attestationDeadline: new Date('2025-03-15'),
      version: '2.1',
    },
    {
      policyId: cddSop?.id ?? 'seed-policy-cdd',
      policyNumber: 'SOP-CDD-001',
      policyTitle: 'Customer Due Diligence (CDD) SOP',
      userId: saraId,
      userName: 'Sara Al-Maktoum',
      department: 'Claims',
      status: 'acknowledged',
      attestationDeadline: new Date('2025-02-28'),
      acknowledgedAt: new Date('2025-02-20T11:30:00Z'),
      ip4Address: '192.168.1.105',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      version: '4.0',
    },
    {
      policyId: amlPolicy?.id ?? 'seed-policy-aml',
      policyNumber: 'POL-AML-001',
      policyTitle: 'AML/CFT Compliance Policy',
      userId: khalidId,
      userName: 'Khalid Nasser',
      department: 'HR',
      status: 'overdue',
      attestationDeadline: new Date('2025-01-31'),
      version: '3.2',
    },
  ];
  const attestations = await Promise.all(
    attestationData.map(d => prisma.policyAttestation.create({ data: d }))
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 23. SEED Phase 5: RemediationActions ───────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding RemediationActions...');
  const remediationData = [
    {
      auditId: audits[0]?.id ?? null,
      findingId: 'F-2025-001',
      title: 'Implement Vessel IMO Number Screening in Marine Onboarding',
      description: 'Gap identified: Vessel IMO number screening not implemented in marine policy onboarding workflow per CBUAE Circular CBUAE/2024/023. Must integrate with UN and OFAC vessel databases.',
      status: 'not_started',
      priority: 'high',
      assignedToId: omarId,
      assignedToName: 'Omar Hassan',
      dueDate: new Date('2025-04-30'),
    },
    {
      auditId: audits[0]?.id ?? null,
      findingId: 'F-2025-002',
      title: 'Add Crypto-Asset Exposure Fields to AML Return Template',
      description: 'Gap identified: Crypto-asset exposure reporting fields missing from AML Return template per DFSA Circular DFSA/2024/AML-089. Updated template with additional fields for VASP exposure and proliferation financing indicators.',
      status: 'in_progress',
      priority: 'high',
      assignedToId: fatimaId,
      assignedToName: 'Fatima Al-Sayed',
      dueDate: new Date('2025-05-15'),
      evidence: '{"updatedTemplate": "AML_Return_v4.2_draft.xlsx", "reviewStatus": "pending_compliance_review", "estimatedCompletion": "2025-04-15"}',
    },
    {
      auditId: audits[2]?.id ?? null,
      findingId: 'F-2025-005',
      title: 'Update Consent Forms for DIFC/ADGM Data Protection Alignment',
      description: 'Finding from Data Privacy Compliance Review: Consent forms require update for alignment with DIFC and ADGM data protection laws. Four medium-severity findings related to consent management.',
      status: 'completed',
      priority: 'medium',
      assignedToId: khalidId,
      assignedToName: 'Khalid Nasser',
      dueDate: new Date('2025-02-28'),
      completedDate: new Date('2025-02-15'),
      evidence: '{"updatedConsentForms": ["DIFC_Consent_v2.pdf", "ADGM_Consent_v2.pdf"], "legalReviewCompleted": true, "approvalDate": "2025-02-14"}',
    },
  ];
  const remediations = await Promise.all(
    remediationData.map(d => prisma.remediationAction.create({ data: d }))
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 24. SEED Phase 5: Notifications ────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding Notifications...');
  const notificationData = [
    {
      userId: ahmedId,
      userName: 'Ahmed Al-Rashid',
      type: 'sar_deadline',
      title: 'SAR Filing Deadline — 5 Days Remaining',
      message: 'SAR case SAR-2025-0028 has 5 days remaining until the filing deadline (28 March 2025). The case is pending your review. Per FDL 10/2025 Art. 8, filing must be completed within 30 calendar days.',
      priority: 'urgent',
      isRead: false,
      sourceModule: 'sar',
      sourceEntityId: sarCases[1]?.id ?? null,
      actionUrl: '/sar?id=' + (sarCases[1]?.id ?? ''),
      expiresAt: new Date('2025-03-28'),
    },
    {
      userId: khalidId,
      userName: 'Khalid Nasser',
      type: 'training_overdue',
      title: 'AML Training Certification Overdue',
      message: 'Your AML/CFT Fundamentals 2025 training certification expired on 15 January 2025. Please complete the annual refresher training immediately. Per CBUAE Notice 3551/2021 S9.1, all staff must maintain current AML training certification.',
      priority: 'high',
      isRead: false,
      sourceModule: 'training',
      actionUrl: '/training',
      expiresAt: new Date('2025-04-15'),
    },
    {
      userId: fatimaId,
      userName: 'Fatima Al-Sayed',
      type: 'policy_review',
      title: 'AML/CFT Policy Attestation Required',
      message: 'You are required to acknowledge the updated AML/CFT Compliance Policy v3.2 by 31 March 2025. Please review and attest through the Policy Attestation portal.',
      priority: 'normal',
      isRead: true,
      readAt: new Date('2025-03-10T09:15:00Z'),
      sourceModule: 'policies',
      sourceEntityId: amlPolicy?.id ?? null,
      actionUrl: '/policies?id=' + (amlPolicy?.id ?? ''),
      expiresAt: new Date('2025-03-31'),
    },
    {
      userId: omarId,
      userName: 'Omar Hassan',
      type: 'sanctions_hit',
      title: 'Potential Sanctions Match Requires Review',
      message: 'Sanctions screening SCR-2025-00168 returned a potential match (score: 72%) for Gulf Maritime Services LLC against the OFAC SDN list. Your review is required to determine if this is a true match or false positive.',
      priority: 'urgent',
      isRead: false,
      sourceModule: 'sanctions',
      sourceEntityId: screenings[1]?.id ?? null,
      actionUrl: '/sanctions?id=' + (screenings[1]?.id ?? ''),
      expiresAt: new Date('2025-04-01'),
    },
    {
      userId: saraId,
      userName: 'Sara Al-Maktoum',
      type: 'kyc_overdue',
      title: 'KYC Review Overdue — Action Required',
      message: 'You have been assigned 8 high-risk customer KYC reviews that are overdue. Please complete the reviews by 31 March 2025 per the periodic review schedule. Per CBUAE Notice 3551/2021 S5.1, overdue reviews represent a compliance gap.',
      priority: 'high',
      isRead: true,
      readAt: new Date('2025-03-08T14:30:00Z'),
      sourceModule: 'kyc',
      actionUrl: '/kyc',
      expiresAt: new Date('2025-03-31'),
    },
  ];
  const notifications = await Promise.all(
    notificationData.map(d => prisma.notification.create({ data: d }))
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 25. SEED Phase 5: VendorDueDiligence ───────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding VendorDueDiligence...');
  const vendorData = [
    {
      vendorName: 'ComplianceTech Solutions FZ-LLC',
      serviceType: 'IT',
      riskRating: 'medium',
      amlAssessment: '{"screeningProvider": true, "dataProcessing": true, "accessToCustomerData": true, "jurisdictionRisk": "LOW", "amlPolicyExists": true, "lastReviewDate": "2024-11-15", "findings": "Vendor has adequate AML controls. Annual review recommended."}',
      contractEndDate: new Date('2026-06-30'),
      reviewDate: new Date('2025-06-15'),
      reviewStatus: 'pending',
      assignedReviewer: 'Fatima Al-Sayed',
      documents: '["MLA_v2.pdf", "AML_Policy_Vendor.pdf", "DPA_2024.pdf", "SOC2_Report_2024.pdf"]',
    },
    {
      vendorName: 'Al-Rashid Travel Agency',
      serviceType: 'Operations',
      riskRating: 'high',
      amlAssessment: '{"premiumCollectionChannel": true, "thirdPartyPayments": true, "accessToCustomerData": true, "jurisdictionRisk": "MEDIUM", "amlPolicyExists": false, "lastReviewDate": "2024-09-20", "findings": "HIGH RISK: Vendor channels premium payments through correspondent bank with indirect sanctions exposure. No AML policy on file. Enhanced monitoring required. Compensating controls: monthly transaction sampling, source-of-funds verification for payments >AED 25,000."}',
      contractEndDate: new Date('2025-12-31'),
      reviewDate: new Date('2025-03-30'),
      reviewStatus: 'in_progress',
      assignedReviewer: 'Ahmed Al-Rashid',
      documents: '["Service_Agreement_v3.pdf", "Sanctions_Exception_Evidence.pdf", "Transaction_Sampling_Report_Q4.pdf"]',
    },
  ];
  const vendors = await Promise.all(
    vendorData.map(d => prisma.vendorDueDiligence.create({ data: d }))
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 26. SEED Phase 5: ComplianceCases ──────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding ComplianceCases...');
  const complianceCaseData = [
    {
      caseNumber: 'CC-2025-0001',
      title: 'AML Investigation: Early Surrender Anomaly — Gulf Shipping LLC',
      caseType: 'aml_investigation',
      status: 'in_progress',
      priority: 'high',
      riskLevel: 'high',
      jurisdiction: 'CBUAE',
      description: 'Unified compliance case for the early surrender anomaly involving Gulf Shipping LLC. Policy INS-M-2024-8832 surrendered after 14 months with third-party refund to account in high-risk jurisdiction. Premium: AED 450,000. Links AML alert, SAR case, sanctions screening, and KYC records.',
      linkedAlertIds: JSON.stringify(['AML-2025-0147']),
      linkedKYCIds: null,
      linkedSARIds: JSON.stringify([sarCases[0]?.id ?? '']),
      linkedSanctionsIds: JSON.stringify([screenings[1]?.id ?? '']),
      linkedPolicyIds: null,
      linkedCaseIds: null,
      assignedToId: ahmedId,
      assignedToName: 'Ahmed Al-Rashid',
    },
    {
      caseNumber: 'CC-2025-0002',
      title: 'Sanctions Review: Confirmed Match — Ahmed Khamis Al-Balushi',
      caseType: 'sanctions_review',
      status: 'escalated',
      priority: 'urgent',
      riskLevel: 'critical',
      jurisdiction: 'CBUAE',
      description: 'Critical sanctions case involving a confirmed match on both the UNSC Consolidated List and UAE Local Terrorist List. Automatic freeze applied to all related accounts and policies. Immediate reporting to CBUAE and UAE Sanctions Committee required per CR 134/2025 Art. 25.',
      linkedAlertIds: JSON.stringify(['AML-2025-0150']),
      linkedKYCIds: null,
      linkedSARIds: null,
      linkedSanctionsIds: JSON.stringify([screenings[2]?.id ?? '']),
      linkedPolicyIds: null,
      linkedCaseIds: null,
      assignedToId: ahmedId,
      assignedToName: 'Ahmed Al-Rashid (MLRO)',
    },
  ];
  const complianceCases = await Promise.all(
    complianceCaseData.map(d => prisma.complianceCase.create({ data: d }))
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 27. SEED Phase 5: RiskAssessments ──────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding RiskAssessments...');
  const riskData = [
    {
      assessmentNumber: 'RA-2025-CUST-001',
      title: 'Customer Risk Assessment 2025',
      domain: 'Customer',
      category: 'Customer Risk',
      inherentRisk: 'high',
      residualRisk: 'medium',
      controls: '["CDD procedures per FDL 10/2025 Art. 7", "EDD for PEPs per Art. 9 and CR 134/2025 Art. 8", "Ongoing monitoring per Art. 10", "Periodic KYC reviews per CBUAE Notice 3551 S5.1", "Transaction monitoring with automated alerting per S6.1", "Sanctions screening per CR 134/2025 Art. 26"]',
      controlEffectiveness: 'moderate',
      riskAppetiteThreshold: '{"highRiskCustomerLimit": "15% of portfolio", "pepAcceptanceCriteria": "Senior management approval required", "greyListJurisdictionThreshold": "Enhanced monitoring above 10% exposure", "vaspDefaultRating": "HIGH per FDL 10/2025 Art. 4"}',
      version: 1,
      approvedBy: 'Board Risk Committee',
      approvedAt: new Date('2025-01-20'),
      assessmentDate: new Date('2025-01-15'),
      nextReviewDate: new Date('2026-01-15'),
    },
    {
      assessmentNumber: 'RA-2025-JUR-001',
      title: 'Jurisdiction Risk Assessment 2025',
      domain: 'Jurisdiction',
      category: 'Country/Geographic Risk',
      inherentRisk: 'high',
      residualRisk: 'medium',
      controls: '["Jurisdictional risk screening per CBUAE Notice 3551 S4.2", "FATF grey-list and black-list monitoring", "Enhanced measures for high-risk jurisdictions per CR 134/2025 Art. 13", "Country risk scoring methodology with annual update", "Cross-border transfer monitoring per FATF Rec. 16", "Correspondent banking EDD per CR 134/2025 Art. 9"]',
      controlEffectiveness: 'moderate',
      riskAppetiteThreshold: '{"greyListExposureLimit": "20% of premium volume", "blackListExposureLimit": "0% — prohibited", "highRiskJurisdictionReview": "Quarterly reassessment", "nascentJurisdictionProtocol": "Case-by-case senior management approval"}',
      version: 1,
      approvedBy: 'Board Risk Committee',
      approvedAt: new Date('2025-01-22'),
      assessmentDate: new Date('2025-01-18'),
      nextReviewDate: new Date('2026-01-18'),
    },
  ];
  const riskAssessments = await Promise.all(
    riskData.map(d => prisma.riskAssessment.create({ data: d }))
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 28. SEED Phase 5: RegulatoryDeadlines ──────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding RegulatoryDeadlines...');
  const deadlineData = [
    {
      title: 'CBUAE Quarterly Insurance Return — Q1 2025',
      deadlineType: 'cbuae_quarterly',
      dueDate: new Date('2025-04-30'),
      jurisdiction: 'CBUAE',
      status: 'upcoming',
      daysRemaining: 45,
      assignedToId: fatimaId,
      sourceModule: 'regulatory',
      penaltyForNonCompliance: 'Administrative penalties per FDL 10/2025 Art. 21, including fines up to AED 1,000,000 for repeated non-compliance with regulatory filing requirements.',
    },
    {
      title: 'SAR Filing — SAR-2025-0028 (Structured Payments)',
      deadlineType: 'sar_filing',
      dueDate: new Date('2025-03-28'),
      jurisdiction: 'CBUAE',
      status: 'due_soon',
      daysRemaining: 5,
      assignedToId: ahmedId,
      sourceEntityId: sarCases[1]?.id ?? null,
      sourceModule: 'sar',
      penaltyForNonCompliance: 'Criminal penalties per FDL 10/2025 Art. 19: up to 10 years imprisonment and/or AED 100,000–5,000,000 fine for failure to report suspicious transactions.',
    },
    {
      title: 'Annual AML/CFT Audit — Submission to CBUAE',
      deadlineType: 'audit_submission',
      dueDate: new Date('2025-06-30'),
      jurisdiction: 'CBUAE',
      status: 'upcoming',
      daysRemaining: 105,
      assignedToId: fatimaId,
      sourceModule: 'audits',
      penaltyForNonCompliance: 'Administrative penalties per FDL 10/2025 Art. 21 and CR 134/2025 Art. 28. Failure to conduct annual independent audit may result in restrictions on business activities.',
    },
  ];
  const deadlines = await Promise.all(
    deadlineData.map(d => prisma.regulatoryDeadline.create({ data: d }))
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 29. SEED Phase 5: VASPKYC ──────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding VASPKYC...');
  const vaspData = [
    {
      vaspName: 'CryptoVault Exchange FZ-LLC',
      licenseNumber: 'DWTCA-2024-0156',
      licenseJurisdiction: 'DWTC',
      vaspType: 'exchange',
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f2BD18',
      blockchainNetwork: 'Ethereum',
      riskScore: 78,
      riskRating: 'HIGH',
      uboIdentified: true,
      uboDetails: '{"name": "[REDACTED]", "nationality": "UAE", "ownershipPercentage": 60, "pepStatus": false, "sourceOfWealth": "Technology entrepreneurship"}',
      travelRuleCompliant: true,
      status: 'PENDING_MAKER_CHECKER',
      reviewDate: new Date('2025-04-01'),
      eddRequired: true,
    },
  ];
  const vaspRecords = await Promise.all(
    vaspData.map(d => prisma.vASPKYC.create({ data: d }))
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 30. SEED NEW: CorporateKYC ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding CorporateKYC...');
  const corporateKYCData = [
    {
      // HIGH risk corporate — complex ownership, PEP in management, grey-list jurisdiction
      legalName: 'Gulf Maritime Services LLC',
      tradeLicenseNo: 'CN-123456',
      trn: '100123456700003',
      legalForm: 'LLC',
      uboIdentified: true,
      uboDetails: JSON.stringify([
        { name: '[REDACTED]', nationality: 'Iranian', ownershipPercentage: 55, pepStatus: false, sourceOfWealth: 'Maritime trade & logistics' },
        { name: 'Ahmed Khamis Al-Balushi', nationality: 'Omani', ownershipPercentage: 30, pepStatus: true, sourceOfWealth: 'Shipping & port management' },
      ]),
      pepInManagement: true,
      riskScore: 82,
      riskRating: 'HIGH',
      status: 'PENDING_MAKER_CHECKER',
    },
    {
      // LOW risk corporate — simple ownership, no PEP, UAE-domiciled
      legalName: 'Al-Nahda Properties PJSC',
      tradeLicenseNo: 'DN-789012',
      trn: '100789012300001',
      legalForm: 'PJSC',
      uboIdentified: true,
      uboDetails: JSON.stringify([
        { name: 'Saeed Al-Nahda', nationality: 'UAE', ownershipPercentage: 65, pepStatus: false, sourceOfWealth: 'Real estate development' },
        { name: 'Fatima Al-Nahda', nationality: 'UAE', ownershipPercentage: 20, pepStatus: false, sourceOfWealth: 'Family investment' },
      ]),
      pepInManagement: false,
      riskScore: 18,
      riskRating: 'LOW',
      status: 'APPROVED',
    },
  ];
  const corporateKYCs = await Promise.all(
    corporateKYCData.map(d => prisma.corporateKYC.create({ data: d }))
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 31. SEED NEW: IndividualKYC ────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding IndividualKYC...');
  const individualKYCData = [
    {
      // Standard-risk individual — UAE national, no PEP
      fullName: 'Mohammed Al-Fahim',
      emiratesId: '784-1990-1234567-1',
      passportNo: 'N1234567',
      nationality: 'UAE',
      isPep: false,
      riskRating: 'STANDARD',
      eddRequired: false,
      status: 'APPROVED',
    },
    {
      // High-risk individual — PEP from grey-listed jurisdiction
      fullName: 'Yusuf Al-Balushi',
      emiratesId: null,
      passportNo: 'P9876543',
      nationality: 'Omani',
      isPep: true,
      riskRating: 'HIGH',
      eddRequired: true,
      status: 'PENDING_MAKER_CHECKER',
    },
  ];
  const individualKYCs = await Promise.all(
    individualKYCData.map(d => prisma.individualKYC.create({ data: d }))
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 32. SEED NEW: GoAMLFiling ──────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding GoAMLFiling...');
  const goAMLFilingData = [
    {
      reportType: 'STR',
      referenceNumber: 'GOAML-STR-2025-0031',
      subjectName: 'Gulf Shipping LLC — UBO: [REDACTED]',
      amountAED: 382500,
      filingStatus: 'DRAFT',
      xmlPayload: `<?xml version="1.0" encoding="UTF-8"?>
<goAML xmlns="http://www.un.org/goaml">
  <str_report>
    <reason_for_suspicion>Early surrender of marine cargo insurance policy with third-party refund directed to high-risk jurisdiction. Pattern consistent with premium laundering through insurance products.</reason_for_suspicion>
    <subject>
      <subject_type>ENTITY</subject_type>
      <name>Gulf Shipping LLC</name>
      <ubo nationality="IR" ownership_pct="55"/>
    </subject>
    <transaction>
      <amount currency="AED">382500</amount>
      <date>2025-03-10</date>
      <type>Insurance Surrender</type>
    </transaction>
  </str_report>
</goAML>`,
    },
  ];
  const goAMLFilings = await Promise.all(
    goAMLFilingData.map(d => prisma.goAMLFiling.create({ data: d }))
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 33. SEED NEW: MakerCheckerLog ──────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding MakerCheckerLog...');
  const makerCheckerData = [
    {
      operationType: 'KYC_HIGH_RISK_APPROVAL',
      entityId: corporateKYCs[0].id,
      entityType: 'CorporateKYC',
      makerId: omarId,
      makerName: 'Omar Hassan',
      checkerId: null,
      checkerName: null,
      status: 'PENDING',
      expiryTime: new Date('2025-04-15T23:59:59Z'),
      payloadSnapshot: JSON.stringify({
        action: 'APPROVE_HIGH_RISK_KYC',
        corporateKYCId: corporateKYCs[0].id,
        legalName: 'Gulf Maritime Services LLC',
        riskRating: 'HIGH',
        pepInManagement: true,
        reason: 'Corporate KYC rated HIGH risk due to PEP in management and grey-list jurisdiction UBO. Requires MLRO approval per CR 134/2025 Art. 8.',
      }),
    },
  ];
  const makerCheckerLogs = await Promise.all(
    makerCheckerData.map(d => prisma.makerCheckerLog.create({ data: d }))
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 34. SEED NEW: AIChatSession + AIChatMessages ───────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('  Seeding AIChatSession & AIChatMessages...');
  const aiChatSession = await prisma.aIChatSession.create({
    data: {
      userId: ahmedId,
      contextModule: 'goAML',
    },
  });

  const aiChatMessages = await Promise.all([
    prisma.aIChatMessage.create({
      data: {
        sessionId: aiChatSession.id,
        role: 'user',
        content: 'Generate a goAML SAR narrative for case AML-2025-0147. The policy INS-M-2024-8832 was surrendered after 14 months with a third-party refund of AED 382,500 to a high-risk jurisdiction. Premium was AED 450,000.',
        modelUsed: null,
        latencyMs: null,
      },
    }),
    prisma.aIChatMessage.create({
      data: {
        sessionId: aiChatSession.id,
        role: 'assistant',
        content: 'Based on the details for case AML-2025-0147, I have generated a 5-part SAR narrative compliant with goAML XML Schema v4.2 and FDL 10/2025 Art. 8:\n\n**PART 1 — REASON FOR SUSPICION:** Early policy surrender with third-party refund raises concerns of potential premium laundering through insurance products.\n\n**PART 2 — SUBJECT DETAILS:** Policyholder is Gulf Shipping LLC, a corporate entity with complex ownership structure. UBO identified as a national of a FATF grey-listed jurisdiction.\n\n**PART 3 — TRANSACTION DETAILS:** Premium of AED 450,000 paid via personal account; surrender value of AED 382,500 refunded to third-party account in high-risk jurisdiction.\n\n**PART 4 — ACCOUNTS INVOLVED:** Emirates NBD account ending 4521 (premium payer); Mashreq Bank account ending 8837 (refund recipient).\n\n**PART 5 — SUSPICIOUS INDICATORS:** Early surrender + third-party refund + high-risk jurisdiction nexus consistent with CBUAE AML Red Flags Ref. 4.7.\n\n⚠️ Tipping-off warning applies per FDL 10/2025 Art. 12. Do not discuss with unauthorized personnel.',
        modelUsed: 'qwen2.5:14b',
        latencyMs: 3420,
      },
    }),
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 35. SEED SUMMARY ───────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('✅ IC-OS Database Seeding Complete!');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('  📊 Seed Counts by Model:');
  console.log('  ─────────────────────────────────────────────────────────');
  console.log(`  Users                    : ${users.length}`);
  console.log(`  RegulatoryCirculars      : ${circulars.length}`);
  console.log(`  GapAnalyses              : ${gapData.length}`);
  console.log(`  AMLAlerts                : ${amlData.length}`);
  console.log(`  SanctionsExceptions      : ${sanctionsData.length}`);
  console.log(`  InspectionEvidence       : ${evidenceData.length}`);
  console.log(`  Claims                   : ${claimsData.length}`);
  console.log(`  AuditLogs                : ${auditLogData.length}`);
  console.log(`  KRIMetrics               : ${kriData.length}`);
  console.log(`  Regulations              : ${regulationsData.length}`);
  console.log(`  Policies                 : ${policiesData.length} (incl. 3 AI Engine configs)`);
  console.log(`  LaborLawCompliance       : ${laborData.length}`);
  console.log(`  LegalCases               : ${legalData.length}`);
  console.log(`  TrainingCourses          : ${courses.length}`);
  console.log(`  TrainingEnrollments      : ${enrollmentData.length}`);
  console.log(`  ComplianceAudits         : ${auditData.length}`);
  console.log(`  ComplianceAlerts         : ${complianceAlertData.length}`);
  console.log(`  SanctionsScreenings      : ${screeningData.length}`);
  console.log(`  SARCases                 : ${sarData.length}`);
  console.log(`  CalendarEvents           : ${calendarData.length}`);
  console.log(`  PolicyAttestations       : ${attestationData.length}`);
  console.log(`  RemediationActions       : ${remediationData.length}`);
  console.log(`  Notifications            : ${notificationData.length}`);
  console.log(`  VendorDueDiligence       : ${vendorData.length}`);
  console.log(`  ComplianceCases          : ${complianceCaseData.length}`);
  console.log(`  RiskAssessments          : ${riskData.length}`);
  console.log(`  RegulatoryDeadlines      : ${deadlineData.length}`);
  console.log(`  VASPKYC                  : ${vaspData.length}`);
  console.log(`  CorporateKYC             : ${corporateKYCData.length} (1 HIGH, 1 LOW)`);
  console.log(`  IndividualKYC            : ${individualKYCData.length} (1 STANDARD, 1 HIGH)`);
  console.log(`  GoAMLFilings             : ${goAMLFilingData.length}`);
  console.log(`  MakerCheckerLogs         : ${makerCheckerData.length}`);
  console.log(`  AIChatSessions           : 1`);
  console.log(`  AIChatMessages           : ${aiChatMessages.length}`);
  console.log('');
  console.log('  ⚠️  DEFAULT CREDENTIALS — Change passwords on first login:');
  console.log('      admin@icos.ae  (role: admin)');
  console.log('      mlro@icos.ae   (role: mlro)');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
