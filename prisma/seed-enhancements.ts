/**
 * IC-OS Phase 5 Seed Data — Regulatory Critical Enhancement Models
 *
 * Seeds the following models:
 *   - ComplianceAlert (5 records)
 *   - SanctionsScreening (3 records)
 *   - SARCase (3 records)
 *   - CalendarEvent (8 records)
 *   - PolicyAttestation (4 records)
 *   - RemediationAction (3 records)
 *   - Notification (5 records)
 *   - VendorDueDiligence (2 records)
 *   - ComplianceCase (2 records)
 *   - RiskAssessment (2 records)
 *   - RegulatoryDeadline (3 records)
 *   - VASPKYC (1 record)
 *
 * All data uses realistic UAE compliance scenarios per FDL 10/2025, CR 134/2025,
 * FATF Recommendations, and CBUAE Notice 3551/2021.
 */

import { db } from '@/lib/db';

async function main() {
  console.log('🌱 Seeding Phase 5 enhancement data...');

  // ── Fetch existing users for reference ──────────────────────────────────
  const users = await db.user.findMany();
  const userMap: Record<string, string> = {};
  for (const u of users) {
    userMap[u.email] = u.id;
  }

  const ahmedId = userMap['ahmed@icos.ae'] ?? 'seed-user-ahmed';
  const fatimaId = userMap['fatima@icos.ae'] ?? 'seed-user-fatima';
  const omarId = userMap['omar@icos.ae'] ?? 'seed-user-omar';
  const saraId = userMap['sara@icos.ae'] ?? 'seed-user-sara';
  const khalidId = userMap['khalid@icos.ae'] ?? 'seed-user-khalid';

  // ── Fetch existing policies for attestation linking ─────────────────────
  const policies = await db.policy.findMany();
  const policyMap: Record<string, { id: string; policyNumber: string; title: string; version: string }> = {};
  for (const p of policies) {
    policyMap[p.policyNumber] = {
      id: p.id,
      policyNumber: p.policyNumber,
      title: p.title,
      version: p.version,
    };
  }

  // ── Fetch existing audits for remediation linking ───────────────────────
  const audits = await db.complianceAudit.findMany();

  // ── Seed ComplianceAlerts ───────────────────────────────────────────────
  console.log('  Seeding ComplianceAlerts...');
  const alertData = [
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
    alertData.map((d) => db.complianceAlert.create({ data: d }))
  );

  // ── Seed SanctionsScreenings ────────────────────────────────────────────
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
      jurisdiction: 'AE',
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
      jurisdiction: 'AE',
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
      jurisdiction: 'AE',
    },
  ];
  const screenings = await Promise.all(
    screeningData.map((d) => db.sanctionsScreening.create({ data: d }))
  );

  // ── Seed SARCases ───────────────────────────────────────────────────────
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
    sarData.map((d) => db.sARCase.create({ data: d }))
  );

  // ── Seed CalendarEvents ─────────────────────────────────────────────────
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
      sourceEntityId: policies.find((p) => p.policyNumber === 'POL-AML-001')?.id ?? null,
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
    calendarData.map((d) => db.calendarEvent.create({ data: d }))
  );

  // ── Seed PolicyAttestations ─────────────────────────────────────────────
  console.log('  Seeding PolicyAttestations...');
  const amlPolicy = policies.find((p) => p.policyNumber === 'POL-AML-001');
  const sanctionsPolicy = policies.find((p) => p.policyNumber === 'POL-SANC-001');
  const cddSop = policies.find((p) => p.policyNumber === 'SOP-CDD-001');

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
    attestationData.map((d) => db.policyAttestation.create({ data: d }))
  );

  // ── Seed RemediationActions ─────────────────────────────────────────────
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
    remediationData.map((d) => db.remediationAction.create({ data: d }))
  );

  // ── Seed Notifications ──────────────────────────────────────────────────
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
      description: undefined as unknown as string,
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
    notificationData.map((d) => {
      // Remove undefined fields
      const clean = { ...d };
      delete (clean as Record<string, unknown>).description;
      return db.notification.create({ data: clean });
    })
  );

  // ── Seed VendorDueDiligence ─────────────────────────────────────────────
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
    vendorData.map((d) => db.vendorDueDiligence.create({ data: d }))
  );

  // ── Seed ComplianceCases ────────────────────────────────────────────────
  console.log('  Seeding ComplianceCases...');
  const caseData = [
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
    caseData.map((d) => db.complianceCase.create({ data: d }))
  );

  // ── Seed RiskAssessments ────────────────────────────────────────────────
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
    riskData.map((d) => db.riskAssessment.create({ data: d }))
  );

  // ── Seed RegulatoryDeadlines ────────────────────────────────────────────
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
    deadlineData.map((d) => db.regulatoryDeadline.create({ data: d }))
  );

  // ── Seed VASPKYC ────────────────────────────────────────────────────────
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
    vaspData.map((d) => db.vASPKYC.create({ data: d }))
  );

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('✅ Phase 5 enhancement seeding complete!');
  console.log(`  ComplianceAlerts: ${complianceAlerts.length}`);
  console.log(`  SanctionsScreenings: ${screenings.length}`);
  console.log(`  SARCases: ${sarCases.length}`);
  console.log(`  CalendarEvents: ${calendarEvents.length}`);
  console.log(`  PolicyAttestations: ${attestations.length}`);
  console.log(`  RemediationActions: ${remediations.length}`);
  console.log(`  Notifications: ${notifications.length}`);
  console.log(`  VendorDueDiligence: ${vendors.length}`);
  console.log(`  ComplianceCases: ${complianceCases.length}`);
  console.log(`  RiskAssessments: ${riskAssessments.length}`);
  console.log(`  RegulatoryDeadlines: ${deadlines.length}`);
  console.log(`  VASPKYC: ${vaspRecords.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Phase 5 seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
