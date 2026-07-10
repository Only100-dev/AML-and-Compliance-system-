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
  console.log('🌱 Seeding database...');

  // ── Clear existing data (respecting foreign key order) ──────────────────
  console.log('  Clearing existing data...');

  await prisma.trainingEnrollment.deleteMany();
  await prisma.trainingCourse.deleteMany();
  await prisma.complianceAudit.deleteMany();
  await prisma.legalCase.deleteMany();
  await prisma.laborLawCompliance.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.regulation.deleteMany();
  await prisma.kRIMetric.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.inspectionEvidence.deleteMany();
  await prisma.sanctionsException.deleteMany();
  await prisma.aMLAlert.deleteMany();
  await prisma.gapAnalysis.deleteMany();
  await prisma.regulatoryCircular.deleteMany();
  await prisma.user.deleteMany();

  // ── Seed Users ─────────────────────────────────────────────────────────
  console.log('  Seeding Users...');
  const users = await Promise.all([
    prisma.user.create({ data: { email: 'ahmed@icos.ae', name: 'Ahmed Al-Rashid', role: 'mlro', jurisdiction: 'CBUAE', isActive: true } }),
    prisma.user.create({ data: { email: 'fatima@icos.ae', name: 'Fatima Al-Sayed', role: 'compliance_manager', jurisdiction: 'DFSA', isActive: true } }),
    prisma.user.create({ data: { email: 'omar@icos.ae', name: 'Omar Hassan', role: 'compliance_officer', jurisdiction: 'CBUAE', isActive: true } }),
    prisma.user.create({ data: { email: 'sara@icos.ae', name: 'Sara Al-Maktoum', role: 'claims_adjuster', jurisdiction: 'FSRA', isActive: true } }),
    prisma.user.create({ data: { email: 'khalid@icos.ae', name: 'Khalid Nasser', role: 'analyst', jurisdiction: 'CBUAE', isActive: true } }),
  ]);

  // ── Seed RegulatoryCirculars ───────────────────────────────────────────
  console.log('  Seeding RegulatoryCirculars...');
  const circularsData = [
    { title: 'Enhanced Sanctions Screening Requirements for Marine Insurance', regulator: 'CBUAE', circularNumber: 'CBUAE/2024/023', effectiveDate: new Date('2025-03-15'), status: 'analyzed', summary: 'Mandatory screening of vessel IMO numbers, flag state verification, and beneficial ownership checks for all marine cargo and hull policies. Requires integration with UN and OFAC vessel databases.', affectedDepts: 'Underwriting, Claims, Compliance' },
    { title: 'AML Return Filing Procedures - Annual Update', regulator: 'DFSA', circularNumber: 'DFSA/2024/AML-089', effectiveDate: new Date('2025-09-30'), status: 'ingested', summary: 'Updated AML Annual Return template with additional fields for crypto-asset exposure and proliferation financing indicators. Deadline: September 30, 2025.', affectedDepts: 'Compliance, Finance' },
    { title: 'Third-Party Payment Provider Due Diligence', regulator: 'FSRA', circularNumber: 'FSRA/2024/COI-044', effectiveDate: new Date('2025-04-01'), status: 'actioned', summary: 'Enhanced due diligence requirements for third-party payment providers, including travel agents and brokers handling premium collections. Mandatory source-of-funds verification for payouts exceeding AED 35,000.', affectedDepts: 'Underwriting, Claims, Compliance, Finance' },
    { title: 'Customer Risk Assessment Methodology Update', regulator: 'CBUAE', circularNumber: 'CBUAE/2024/019', effectiveDate: new Date('2025-06-01'), status: 'analyzing', summary: 'Revised 5-domain risk assessment framework incorporating emerging risks from virtual asset service providers (VASPs) and decentralized finance (DeFi) exposure.', affectedDepts: 'Compliance, Underwriting, IT' },
    { title: 'goAML XML Schema Version 4.2 Migration', regulator: 'CBUAE', circularNumber: 'CBUAE/2024/015', effectiveDate: new Date('2025-02-28'), status: 'actioned', summary: 'Mandatory migration to goAML XML Schema v4.2 with updated SAR narrative structure requiring 5-part narrative format and additional transaction coding fields.', affectedDepts: 'Compliance, IT' },
  ];
  const circulars = await Promise.all(circularsData.map(d => prisma.regulatoryCircular.create({ data: d })));

  // ── Seed GapAnalysis ───────────────────────────────────────────────────
  console.log('  Seeding GapAnalyses...');
  const gapData = [
    { circularId: circulars[0].id, missingClauses: 'Vessel IMO number screening not implemented in marine policy onboarding workflow', aiConfidence: 0.92, status: 'draft' },
    { circularId: circulars[0].id, missingClauses: 'No flag state verification step in cargo insurance workflow', aiConfidence: 0.88, status: 'draft' },
    { circularId: circulars[1].id, missingClauses: 'Crypto-asset exposure reporting fields missing from AML Return template', aiConfidence: 0.95, status: 'pending_approval' },
    { circularId: circulars[2].id, missingClauses: 'Third-party payment provider EDD not documented for travel agent channels', aiConfidence: 0.91, status: 'approved' },
  ];
  await Promise.all(gapData.map(d => prisma.gapAnalysis.create({ data: d })));

  // ── Seed AMLAlerts ─────────────────────────────────────────────────────
  console.log('  Seeding AMLAlerts...');
  const amlData = [
    { caseId: 'AML-2025-0147', riskScore: 87, riskLevel: 'high', alertType: 'Early Surrender Anomaly', description: 'Policy INS-M-2024-8832 surrendered after 14 months with third-party refund to account in high-risk jurisdiction. Premium: AED 450,000.', aiFlags: 'Early Surrender Pattern, Third-Party Payout Red Flag, High-Risk Jurisdiction Transfer', goAMLDraft: 'PART 1 - REASON FOR SUSPICION: Early policy surrender with third-party refund raises concerns of potential premium laundering. PART 2 - SUBJECT DETAILS: Policyholder [REDACTED]. PART 3 - TRANSACTION DETAILS: Premium AED 450,000 paid via personal account; surrender value AED 382,500 refunded to third-party account. PART 4 - ACCOUNTS INVOLVED: [REDACTED] - Emirates NBD. PART 5 - SUSPICIOUS INDICATORS: Early surrender + third-party refund + high-risk jurisdiction nexus consistent with CBUAE AML Red Flags Ref. 4.7.', status: 'triage', assignedTo: 'Ahmed Al-Rashid', createdBy: 'System', jurisdiction: 'CBUAE' },
    { caseId: 'AML-2025-0148', riskScore: 64, riskLevel: 'intermediate', alertType: 'Structuring Pattern', description: 'Multiple premium payments just below AED 35,000 reporting threshold within 72-hour window. Total: AED 165,000 across 5 transactions.', aiFlags: 'Potential Structuring, Threshold Proximity, Rapid Succession Payments', goAMLDraft: 'PART 1 - REASON FOR SUSPICION: Multiple premium payments structured below AED 35,000 threshold. PART 2 - SUBJECT DETAILS: [REDACTED]. PART 3 - TRANSACTION DETAILS: 5 payments of AED 32,000-34,900 within 72 hours totaling AED 165,000. PART 4 - ACCOUNTS INVOLVED: [REDACTED]. PART 5 - SUSPICIOUS INDICATORS: Structuring pattern consistent with CBUAE AML Red Flags Ref. 3.2.', status: 'new', assignedTo: '', createdBy: 'System', jurisdiction: 'CBUAE' },
    { caseId: 'AML-2025-0149', riskScore: 42, riskLevel: 'intermediate', alertType: 'PEP Association', description: 'Policy beneficiary identified as family member of Politically Exposed Person from FATF grey-listed jurisdiction.', aiFlags: 'PEP Proximity, Grey-List Jurisdiction, Beneficiary Mismatch', goAMLDraft: 'PART 1 - REASON FOR SUSPICION: Beneficiary linked to PEP from grey-listed jurisdiction. PART 2 - SUBJECT DETAILS: [REDACTED]. PART 3 - TRANSACTION DETAILS: Life policy with AED 2,000,000 sum assured. PART 4 - ACCOUNTS INVOLVED: [REDACTED]. PART 5 - SUSPICIOUS INDICATORS: PEP association per CBUAE guidance Ref. 5.1.', status: 'investigating', assignedTo: 'Fatima Al-Sayed', createdBy: 'System', jurisdiction: 'DFSA' },
    { caseId: 'AML-2025-0150', riskScore: 95, riskLevel: 'critical', alertType: 'Sanctions Hit - Direct Match', description: 'Claim payout beneficiary matches entry on UAE Local Terrorist List with 98.7% confidence. AUTOMATIC BLOCK APPLIED.', aiFlags: 'Direct Sanctions Match, UAE Local Terrorist List, Automatic Freeze Required', goAMLDraft: 'PART 1 - REASON FOR SUSPICION: Direct match on UAE Local Terrorist List. MANDATORY FREEZE AND REPORT. PART 2 - SUBJECT DETAILS: [BLOCKED - SANCTIONS MATCH]. PART 3 - TRANSACTION DETAILS: Claim payout AED 125,000 BLOCKED. PART 4 - ACCOUNTS INVOLVED: [FROZEN]. PART 5 - SUSPICIOUS INDICATORS: Zero-tolerance direct sanctions breach per CBUAE Notice 3551/2021.', status: 'escalated', assignedTo: 'MLRO Office', createdBy: 'System', jurisdiction: 'CBUAE' },
    { caseId: 'AML-2025-0151', riskScore: 31, riskLevel: 'low', alertType: 'Geographic Anomaly', description: 'Property insurance application for asset in newly grey-listed jurisdiction. Customer has legitimate business presence.', aiFlags: 'Grey-List Jurisdiction Asset, Legitimate Business Presence Noted', goAMLDraft: 'PART 1 - REASON FOR SUSPICION: Property in grey-listed jurisdiction but with verified business presence. PART 2 - SUBJECT DETAILS: [REDACTED]. PART 3 - TRANSACTION DETAILS: Property premium AED 85,000. PART 4 - ACCOUNTS INVOLVED: [REDACTED]. PART 5 - SUSPICIOUS INDICATORS: Geographic risk per CBUAE guidance - Enhanced monitoring recommended.', status: 'triage', assignedTo: 'Omar Hassan', createdBy: 'System', jurisdiction: 'FSRA' },
  ];
  await Promise.all(amlData.map(d => prisma.aMLAlert.create({ data: d })));

  // ── Seed SanctionsExceptions ───────────────────────────────────────────
  console.log('  Seeding SanctionsExceptions...');
  const sanctionsData = [
    { entityName: 'Gulf Maritime Services LLC', riskDomain: 'Interface Risk', justification: 'Broker operates in shared port facility with sanctioned vessel operators but has no direct commercial relationship.', compensatingControls: 'Enhanced transaction monitoring, Quarterly compliance review, Separate bank account verification', sunsetDate: new Date('2025-07-15'), approvedBy: 'Ahmed Al-Rashid (MLRO)', status: 'active', cbuaeNotified: true },
    { entityName: 'Al-Rashid Travel Agency', riskDomain: 'Customer Risk', justification: 'Travel agent channels premium payments through correspondent bank with indirect exposure to sanctioned entity.', compensatingControls: 'Monthly transaction sampling, Source-of-funds verification for payments >AED 25,000', sunsetDate: new Date('2025-08-22'), approvedBy: 'Fatima Al-Sayed (Compliance Manager)', status: 'active', cbuaeNotified: true },
    { entityName: 'Pacific Trade Credit Corp', riskDomain: 'Jurisdiction Risk', justification: 'Trade credit insurance covers transactions involving entities in jurisdiction under OFAC secondary sanctions review.', compensatingControls: 'OFAC 50% Rule screening, Semi-annual reassessment, Legal counsel sign-off', sunsetDate: new Date('2025-03-30'), approvedBy: 'Ahmed Al-Rashid (MLRO)', status: 'active', cbuaeNotified: false },
  ];
  await Promise.all(sanctionsData.map(d => prisma.sanctionsException.create({ data: d })));

  // ── Seed InspectionEvidence ────────────────────────────────────────────
  console.log('  Seeding InspectionEvidence...');
  const evidenceData = [
    { inspectionId: 'INS-2025-001', fileName: 'UBO_Declaration_Signed_2024.pdf', fileHash: 'a3f2b7c9d1e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4', fileSize: 2456789, fileType: 'application/pdf', aiVerified: true, aiConfidence: 0.94, aiVerificationDetail: 'Contains signed UBO declaration with authorized signatory verification. Document integrity confirmed.', uploadedBy: 'Sara Al-Maktoum', department: 'Underwriting' },
    { inspectionId: 'INS-2025-001', fileName: 'AML_Policy_v3.2_Approved.pdf', fileHash: 'b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4', fileSize: 5123456, fileType: 'application/pdf', aiVerified: true, aiConfidence: 0.98, aiVerificationDetail: 'Contains approved AML/CFT Policy v3.2 with Board sign-off dated Dec 2024. All required sections present.', uploadedBy: 'Omar Hassan', department: 'Compliance' },
    { inspectionId: 'INS-2025-002', fileName: 'Training_Attendance_Q4_2024.xlsx', fileHash: 'c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5', fileSize: 876543, fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', aiVerified: false, aiConfidence: 0.45, aiVerificationDetail: 'Insufficient data: Training attendance records do not cover all mandated staff. Missing departments: Claims (3 staff), IT (2 staff).', uploadedBy: 'Khalid Nasser', department: 'HR' },
  ];
  await Promise.all(evidenceData.map(d => prisma.inspectionEvidence.create({ data: d })));

  // ── Seed Claims ────────────────────────────────────────────────────────
  console.log('  Seeding Claims...');
  const claimsData = [
    { claimNumber: 'CLM-2025-00891', policyNumber: 'INS-M-2024-8832', claimType: 'Marine Cargo', claimantName: 'Gulf Shipping LLC', description: 'Cargo damage claim for shipment from Jebel Ali to Mumbai. Container damage during transit.', amount: 382500, fraudScore: 0.23, status: 'under_review', priority: 'high', assignedAdjuster: 'Ahmed Al-Rashid', siuFlagged: false, jurisdiction: 'CBUAE' },
    { claimNumber: 'CLM-2025-00892', policyNumber: 'INS-P-2024-1556', claimType: 'Property', claimantName: 'Al-Nahda Properties', description: 'Fire damage to commercial property in Business Bay. Estimated structural and contents damage.', amount: 1250000, fraudScore: 0.67, status: 'investigation', priority: 'urgent', assignedAdjuster: 'Fatima Al-Sayed', siuFlagged: true, jurisdiction: 'CBUAE' },
    { claimNumber: 'CLM-2025-00893', policyNumber: 'INS-L-2024-0789', claimType: 'Life', claimantName: 'Beneficiary - Name Withheld', description: 'Death benefit claim under group life policy. Beneficiary is PEP family member.', amount: 2000000, fraudScore: 0.12, status: 'submitted', priority: 'high', assignedAdjuster: '', siuFlagged: false, jurisdiction: 'DFSA' },
    { claimNumber: 'CLM-2025-00894', policyNumber: 'INS-G-2024-2241', claimType: 'Motor', claimantName: 'Mohammed Al-Fahim', description: 'Vehicle theft claim. Luxury vehicle reported stolen from residential compound.', amount: 450000, fraudScore: 0.45, status: 'under_review', priority: 'normal', assignedAdjuster: 'Omar Hassan', siuFlagged: false, jurisdiction: 'CBUAE' },
    { claimNumber: 'CLM-2025-00895', policyNumber: 'INS-PR-2024-3312', claimType: 'Professional Indemnity', claimantName: 'TechConsult Middle East', description: 'Professional negligence claim from client. Error in architectural design causing structural issues.', amount: 850000, fraudScore: 0.08, status: 'approved', priority: 'normal', assignedAdjuster: 'Sara Al-Maktoum', siuFlagged: false, jurisdiction: 'FSRA' },
  ];
  await Promise.all(claimsData.map(d => prisma.claim.create({ data: d })));

  // ── Seed AuditLog ──────────────────────────────────────────────────────
  console.log('  Seeding AuditLogs...');
  const auditLogData = [
    { userId: users[0].id, action: 'APPROVE', resource: 'AML Alert', resourceId: 'AML-2025-0147', details: 'Approved SAR filing after review of AI-generated goAML narrative', aiConfidence: 0.87, sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
    { userId: users[1].id, action: 'ESCALATE', resource: 'AML Alert', resourceId: 'AML-2025-0149', details: 'Escalated to MLRO for PEP-related disposition decision', aiConfidence: 0.72, sha256Hash: 'a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a' },
    { userId: users[2].id, action: 'UPLOAD', resource: 'Evidence', resourceId: 'INS-2025-001', details: 'Uploaded signed UBO declaration for compliance inspection', aiConfidence: 0.94, sha256Hash: 'a3f2b7c9d1e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4' },
    { userId: users[0].id, action: 'OVERRIDE_BLOCKED', resource: 'Maker/Checker', resourceId: 'AML-2025-0150', details: 'Security Violation: Maker/Checker Breach - User attempted to approve own record', aiConfidence: null, sha256Hash: 'b7e23ec29af22b0b4e41da31e868d57226161c974ca77ac5b2d46b0e8f6a0b3d' },
    { userId: users[3].id, action: 'APPROVE_POLICY', resource: 'Gap Analysis', resourceId: 'GA-2025-003', details: 'Approved policy update for third-party payment EDD requirements', aiConfidence: 0.91, sha256Hash: 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce' },
  ];
  await Promise.all(auditLogData.map(d => prisma.auditLog.create({ data: d })));

  // ── Seed KRIMetrics ────────────────────────────────────────────────────
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

  // ── Seed Regulations ───────────────────────────────────────────────────
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

  // ── Seed Policies ──────────────────────────────────────────────────────
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
  ];
  await Promise.all(policiesData.map(d => prisma.policy.create({ data: d })));

  // ── Seed LaborLawCompliance ────────────────────────────────────────────
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

  // ── Seed LegalCases ────────────────────────────────────────────────────
  console.log('  Seeding LegalCases...');
  const legalData = [
    { caseNumber: 'LEG-2025-001', title: 'Policyholder Dispute - Claim Denial', caseType: 'Litigation', status: 'open', priority: 'high', assignedCounsel: 'Al-Maktoum Legal', department: 'Claims', description: 'Policyholder challenging denial of marine cargo claim. Allegation of bad faith and insufficient investigation.', filingDate: new Date('2025-01-05'), nextHearing: new Date('2025-02-15'), jurisdiction: 'DIFC Courts', aiSummary: 'Case involves marine cargo claim denial. Policyholder alleges failure to conduct proper investigation before denial. Recommend settlement given potential DIFC Courts unfavorable ruling on procedural fairness grounds.' },
    { caseNumber: 'LEG-2025-002', title: 'Broker Commission Dispute', caseType: 'Arbitration', status: 'in_progress', priority: 'normal', assignedCounsel: 'Internal Legal', department: 'Distribution', description: 'Dispute with former authorized broker over outstanding commission payments and non-compete clause enforcement.', filingDate: new Date('2024-11-20'), nextHearing: new Date('2025-02-01'), jurisdiction: 'Dubai Courts', aiSummary: 'Broker commission dispute. Non-compete clause may be enforceable under UAE Commercial Agencies Law. Recommend mediation before arbitration.' },
    { caseNumber: 'LEG-2025-003', title: 'Regulatory Inquiry - CBUAE Examination', caseType: 'Regulatory', status: 'in_progress', priority: 'urgent', assignedCounsel: 'Baker McKenzie', department: 'Compliance', description: 'CBUAE examination findings requiring formal response. 3 observations on AML reporting procedures.', filingDate: new Date('2025-01-10'), nextHearing: new Date('2025-01-31'), jurisdiction: 'CBUAE', aiSummary: 'Regulatory examination with 3 observations. Two relate to SAR filing timeliness, one to EDD documentation gaps. Recommend immediate remediation plan and proactive response to CBUAE.' },
    { caseNumber: 'LEG-2025-004', title: 'Employee Termination Dispute', caseType: 'Labor', status: 'resolved', priority: 'normal', assignedCounsel: 'Internal Legal', department: 'HR', description: 'Former employee claims arbitrary dismissal. Settlement reached through MOHRE mediation.', filingDate: new Date('2024-12-01'), jurisdiction: 'MOHRE', aiSummary: 'Labor dispute resolved through MOHRE mediation. Settlement amount AED 85,000. Case closed with no admission of liability.' },
    { caseNumber: 'LEG-2025-005', title: 'Subrogation Recovery - Property Damage', caseType: 'Recovery', status: 'open', priority: 'normal', assignedCounsel: 'Al-Tamimi & Co', department: 'Claims', description: 'Subrogation claim against third-party contractor for property damage caused by negligent construction work.', filingDate: new Date('2024-10-15'), nextHearing: new Date('2025-03-10'), jurisdiction: 'Dubai Courts', aiSummary: 'Subrogation recovery potential high. Third-party contractor liability established. Recommend proceeding with claim for AED 1,250,000 recovery.' },
  ];
  await Promise.all(legalData.map(d => prisma.legalCase.create({ data: d })));

  // ── Seed TrainingCourses ───────────────────────────────────────────────
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

  // ── Seed TrainingEnrollments ───────────────────────────────────────────
  console.log('  Seeding TrainingEnrollments...');
  const enrollmentData = [
    { courseId: courses[0].id, userId: users[1].id, userName: 'Fatima Al-Sayed', department: 'Compliance', status: 'completed', enrolledAt: new Date('2024-12-01'), completedAt: new Date('2024-12-15'), expiryDate: new Date('2025-12-15'), score: 92 },
    { courseId: courses[1].id, userId: users[2].id, userName: 'Omar Hassan', department: 'Underwriting', status: 'expired', enrolledAt: new Date('2024-06-01'), completedAt: new Date('2024-06-20'), expiryDate: new Date('2024-12-20'), score: 88 },
    { courseId: courses[2].id, userId: users[3].id, userName: 'Sara Al-Maktoum', department: 'Compliance', status: 'in_progress', enrolledAt: new Date('2025-01-05') },
    { courseId: courses[0].id, userId: users[4].id, userName: 'Khalid Nasser', department: 'HR', status: 'overdue', enrolledAt: new Date('2024-11-01'), expiryDate: new Date('2025-01-15') },
    { courseId: courses[4].id, userId: users[0].id, userName: 'Ahmed Al-Rashid', department: 'Claims', status: 'completed', enrolledAt: new Date('2024-10-01'), completedAt: new Date('2024-10-28'), expiryDate: new Date('2025-10-28'), score: 95 },
  ];
  await Promise.all(enrollmentData.map(d => prisma.trainingEnrollment.create({ data: d })));

  // ── Seed ComplianceAudits ──────────────────────────────────────────────
  console.log('  Seeding ComplianceAudits...');
  const auditData = [
    { auditNumber: 'AUD-2025-001', title: 'Q1 Internal AML/CFT Audit', auditType: 'internal', status: 'in_progress', scheduledDate: new Date('2025-01-15'), leadAuditor: 'Internal Audit Team', scope: 'AML/CFT program effectiveness, SAR filing procedures, EDD documentation', findings: '2 high, 3 medium, 1 low findings identified', remediationStatus: 'in_progress', remediationDueDate: new Date('2025-03-15'), riskLevel: 'high', jurisdiction: 'CBUAE', department: 'Compliance' },
    { auditNumber: 'AUD-2025-002', title: 'CBUAE On-Site Examination', auditType: 'regulatory', status: 'scheduled', scheduledDate: new Date('2025-03-01'), leadAuditor: 'CBUAE Supervision Team', scope: 'Full scope examination of insurance operations', remediationStatus: 'not_started', riskLevel: 'critical', jurisdiction: 'CBUAE', department: 'All' },
    { auditNumber: 'AUD-2025-003', title: 'Data Privacy Compliance Review', auditType: 'internal', status: 'completed', scheduledDate: new Date('2024-11-15'), completedDate: new Date('2024-12-20'), leadAuditor: 'DPO Office', scope: 'Data protection practices, consent management, data residency compliance', findings: '1 high, 4 medium findings. Consent forms require update for DIFC/ADGM data protection law alignment', remediationStatus: 'in_progress', remediationDueDate: new Date('2025-02-28'), riskLevel: 'intermediate', jurisdiction: 'DFSA', department: 'IT & Legal' },
    { auditNumber: 'AUD-2025-004', title: 'External Actuarial Review', auditType: 'external', status: 'completed', scheduledDate: new Date('2024-10-01'), completedDate: new Date('2024-11-15'), leadAuditor: 'Deloitte Actuarial', scope: 'Reserving adequacy, solvency margin calculation, reinsurance program', findings: 'Reserves adequate. Minor methodology update recommended for marine portfolio', remediationStatus: 'completed', remediationDueDate: new Date('2025-01-31'), riskLevel: 'low', jurisdiction: 'CBUAE', department: 'Finance' },
    { auditNumber: 'AUD-2025-005', title: 'Sanctions Screening Effectiveness', auditType: 'internal', status: 'scheduled', scheduledDate: new Date('2025-02-15'), leadAuditor: 'Compliance Team', scope: 'Sanctions screening tool effectiveness, false positive analysis, escalation procedures', remediationStatus: 'not_started', riskLevel: 'high', jurisdiction: 'CBUAE', department: 'Compliance & IT' },
    { auditNumber: 'AUD-2025-006', title: 'Emiratisation Compliance Check', auditType: 'regulatory', status: 'completed', scheduledDate: new Date('2024-12-01'), completedDate: new Date('2024-12-15'), leadAuditor: 'MOHRE Inspector', scope: 'Emiratisation quota compliance, WPS adherence, labor law compliance', findings: '1 medium finding: Emiratisation semi-annual increment below target', remediationStatus: 'overdue', remediationDueDate: new Date('2025-01-15'), riskLevel: 'intermediate', jurisdiction: 'CBUAE', department: 'HR' },
  ];
  await Promise.all(auditData.map(d => prisma.complianceAudit.create({ data: d })));

  console.log('✅ Seeding complete!');
  console.log(`  Users: ${users.length}`);
  console.log(`  Circulars: ${circulars.length}`);
  console.log(`  Regulations: ${regulationsData.length}`);
  console.log(`  Policies: ${policiesData.length}`);
  console.log(`  Labor Items: ${laborData.length}`);
  console.log(`  Legal Cases: ${legalData.length}`);
  console.log(`  Training Courses: ${courses.length}`);
  console.log(`  Enrollments: ${enrollmentData.length}`);
  console.log(`  Compliance Audits: ${auditData.length}`);
  console.log(`  KRI Metrics: ${kriData.length}`);
  console.log(`  Audit Logs: ${auditLogData.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
