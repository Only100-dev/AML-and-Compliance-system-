import type {
  RegulatoryCircular, GapAnalysisItem, AMLAlertCase,
  SanctionsException, EvidenceItem, AuditLogEntry,
  RiskMatrixCell, ComplianceMetrics,
} from './types';

export const mockCirculars: RegulatoryCircular[] = [
  {
    id: '1', title: 'Enhanced Sanctions Screening Requirements for Marine Insurance', regulator: 'CBUAE',
    circularNumber: 'CBUAE/2024/023', effectiveDate: '2025-03-15', status: 'analyzed',
    summary: 'Mandatory screening of vessel IMO numbers, flag state verification, and beneficial ownership checks for all marine cargo and hull policies. Requires integration with UN and OFAC vessel databases.',
    affectedDepts: ['Underwriting', 'Claims', 'Compliance'], riskImpact: 'high'
  },
  {
    id: '2', title: 'AML Return Filing Procedures - Annual Update', regulator: 'DFSA',
    circularNumber: 'DFSA/2024/AML-089', effectiveDate: '2025-09-30', status: 'ingested',
    summary: 'Updated AML Annual Return template with additional fields for crypto-asset exposure and proliferation financing indicators. Deadline: September 30, 2025.',
    affectedDepts: ['Compliance', 'Finance'], riskImpact: 'intermediate'
  },
  {
    id: '3', title: 'Third-Party Payment Provider Due Diligence', regulator: 'FSRA',
    circularNumber: 'FSRA/2024/COI-044', effectiveDate: '2025-04-01', status: 'actioned',
    summary: 'Enhanced due diligence requirements for third-party payment providers, including travel agents and brokers handling premium collections. Mandatory source-of-funds verification for payouts exceeding AED 35,000.',
    affectedDepts: ['Underwriting', 'Claims', 'Compliance', 'Finance'], riskImpact: 'high'
  },
  {
    id: '4', title: 'Customer Risk Assessment Methodology Update', regulator: 'CBUAE',
    circularNumber: 'CBUAE/2024/019', effectiveDate: '2025-06-01', status: 'analyzing',
    summary: 'Revised 5-domain risk assessment framework incorporating emerging risks from virtual asset service providers (VASPs) and decentralized finance (DeFi) exposure.',
    affectedDepts: ['Compliance', 'Underwriting', 'IT'], riskImpact: 'intermediate'
  },
  {
    id: '5', title: 'goAML XML Schema Version 4.2 Migration', regulator: 'CBUAE',
    circularNumber: 'CBUAE/2024/015', effectiveDate: '2025-02-28', status: 'actioned',
    summary: 'Mandatory migration to goAML XML Schema v4.2 with updated SAR narrative structure requiring 5-part narrative format and additional transaction coding fields.',
    affectedDepts: ['Compliance', 'IT'], riskImpact: 'high'
  },
];

export const mockGapAnalyses: GapAnalysisItem[] = [
  {
    id: '1', circularId: '1', missingClause: 'Vessel IMO number screening not implemented in marine policy onboarding workflow',
    currentPolicy: 'POL-UW-012: Marine Underwriting Procedures (Section 4.3 - Sanctions Check)',
    requiredAction: 'Add IMO number field to marine policy application form; integrate with vessel screening API',
    aiConfidence: 0.92, status: 'draft', sourceRef: 'CBUAE/2024/023 §3.2(a)'
  },
  {
    id: '2', circularId: '1', missingClause: 'No flag state verification step in cargo insurance workflow',
    currentPolicy: 'POL-UW-012: Marine Underwriting Procedures (Section 4.5 - Country Risk)',
    requiredAction: 'Add flag state risk assessment; cross-reference with FATF high-risk jurisdiction list',
    aiConfidence: 0.88, status: 'draft', sourceRef: 'CBUAE/2024/023 §3.4(b)'
  },
  {
    id: '3', circularId: '2', missingClause: 'Crypto-asset exposure reporting fields missing from AML Return template',
    currentPolicy: 'POL-AML-003: AML Reporting Procedures (Appendix B - Annual Return)',
    requiredAction: 'Add crypto-asset and DeFi exposure sections to annual return preparation checklist',
    aiConfidence: 0.95, status: 'pending_approval', sourceRef: 'DFSA/2024/AML-089 §2.1'
  },
  {
    id: '4', circularId: '3', missingClause: 'Third-party payment provider EDD not documented for travel agent channels',
    currentPolicy: 'POL-AML-007: Third-Party Due Diligence (Section 2.1 - Agent Screening)',
    requiredAction: 'Create EDD checklist for travel agent and broker payment providers; add source-of-funds verification threshold',
    aiConfidence: 0.91, status: 'approved', sourceRef: 'FSRA/2024/COI-044 §4.2'
  },
];

export const mockAMLAlerts: AMLAlertCase[] = [
  {
    id: '1', caseId: 'AML-2025-0147', riskScore: 87, riskLevel: 'high', alertType: 'Early Surrender Anomaly',
    description: 'Policy INS-M-2024-8832 surrendered after 14 months with third-party refund to account in high-risk jurisdiction. Premium: AED 450,000.',
    aiFlags: ['Early Surrender Pattern', 'Third-Party Payout Red Flag', 'High-Risk Jurisdiction Transfer'],
    goAMLDraft: 'PART 1 - REASON FOR SUSPICION: Early policy surrender with third-party refund raises concerns of potential premium laundering. PART 2 - SUBJECT DETAILS: Policyholder [REDACTED], UAE Resident ID [REDACTED]. PART 3 - TRANSACTION DETAILS: Premium AED 450,000 paid via personal account; surrender value AED 382,500 refunded to third-party account in [HIGH-RISK JURISDICTION]. PART 4 - ACCOUNTS INVOLVED: [REDACTED] - Emirates NBD; [REDACTED] - Overseas Correspondent Bank. PART 5 - SUSPICIOUS INDICATORS: Early surrender + third-party refund + high-risk jurisdiction nexus consistent with CBUAE AML Red Flags Ref. 4.7.',
    status: 'triage', assignedTo: 'Ahmed Al-Rashid', createdBy: 'System', jurisdiction: 'CBUAE',
    createdAt: '2025-01-15T09:30:00Z', amount: 450000, policyNumber: 'INS-M-2024-8832'
  },
  {
    id: '2', caseId: 'AML-2025-0148', riskScore: 64, riskLevel: 'intermediate', alertType: 'Structuring Pattern',
    description: 'Multiple premium payments just below AED 35,000 reporting threshold within 72-hour window. Total: AED 165,000 across 5 transactions.',
    aiFlags: ['Potential Structuring', 'Threshold Proximity', 'Rapid Succession Payments'],
    goAMLDraft: 'PART 1 - REASON FOR SUSPICION: Multiple premium payments structured below AED 35,000 threshold. PART 2 - SUBJECT DETAILS: [REDACTED]. PART 3 - TRANSACTION DETAILS: 5 payments of AED 32,000-34,900 within 72 hours totaling AED 165,000. PART 4 - ACCOUNTS INVOLVED: [REDACTED]. PART 5 - SUSPICIOUS INDICATORS: Structuring pattern consistent with CBUAE AML Red Flags Ref. 3.2.',
    status: 'new', assignedTo: '', createdBy: 'System', jurisdiction: 'CBUAE',
    createdAt: '2025-01-16T14:20:00Z', amount: 165000, policyNumber: 'INS-G-2024-2241'
  },
  {
    id: '3', caseId: 'AML-2025-0149', riskScore: 42, riskLevel: 'intermediate', alertType: 'PEP Association',
    description: 'Policy beneficiary identified as family member of Politically Exposed Person from FATF grey-listed jurisdiction.',
    aiFlags: ['PEP Proximity', 'Grey-List Jurisdiction', 'Beneficiary Mismatch'],
    goAMLDraft: 'PART 1 - REASON FOR SUSPICION: Beneficiary linked to PEP from grey-listed jurisdiction. PART 2 - SUBJECT DETAILS: [REDACTED]. PART 3 - TRANSACTION DETAILS: Life policy with AED 2,000,000 sum assured. PART 4 - ACCOUNTS INVOLVED: [REDACTED]. PART 5 - SUSPICIOUS INDICATORS: PEP association per CBUAE guidance Ref. 5.1.',
    status: 'investigating', assignedTo: 'Fatima Al-Sayed', createdBy: 'System', jurisdiction: 'DFSA',
    createdAt: '2025-01-10T11:45:00Z', amount: 2000000, policyNumber: 'INS-L-2024-0789'
  },
  {
    id: '4', caseId: 'AML-2025-0150', riskScore: 95, riskLevel: 'critical', alertType: 'Sanctions Hit - Direct Match',
    description: 'Claim payout beneficiary matches entry on UAE Local Terrorist List with 98.7% confidence. AUTOMATIC BLOCK APPLIED.',
    aiFlags: ['Direct Sanctions Match', 'UAE Local Terrorist List', 'Automatic Freeze Required'],
    goAMLDraft: 'PART 1 - REASON FOR SUSPICION: Direct match on UAE Local Terrorist List. MANDATORY FREEZE AND REPORT. PART 2 - SUBJECT DETAILS: [BLOCKED - SANCTIONS MATCH]. PART 3 - TRANSACTION DETAILS: Claim payout AED 125,000 BLOCKED. PART 4 - ACCOUNTS INVOLVED: [FROZEN]. PART 5 - SUSPICIOUS INDICATORS: Zero-tolerance direct sanctions breach per CBUAE Notice 3551/2021.',
    status: 'escalated', assignedTo: 'MLRO Office', createdBy: 'System', jurisdiction: 'CBUAE',
    createdAt: '2025-01-17T08:00:00Z', amount: 125000, policyNumber: 'INS-P-2024-1556'
  },
  {
    id: '5', caseId: 'AML-2025-0151', riskScore: 31, riskLevel: 'low', alertType: 'Geographic Anomaly',
    description: 'Property insurance application for asset in newly grey-listed jurisdiction. Customer has legitimate business presence.',
    aiFlags: ['Grey-List Jurisdiction Asset', 'Legitimate Business Presence Noted'],
    goAMLDraft: 'PART 1 - REASON FOR SUSPICION: Property in grey-listed jurisdiction but with verified business presence. PART 2 - SUBJECT DETAILS: [REDACTED]. PART 3 - TRANSACTION DETAILS: Property premium AED 85,000. PART 4 - ACCOUNTS INVOLVED: [REDACTED]. PART 5 - SUSPICIOUS INDICATORS: Geographic risk per CBUAE guidance - Enhanced monitoring recommended.',
    status: 'triage', assignedTo: 'Omar Hassan', createdBy: 'System', jurisdiction: 'FSRA',
    createdAt: '2025-01-14T16:30:00Z', amount: 85000, policyNumber: 'INS-PR-2024-3312'
  },
];

export const mockSanctionsExceptions: SanctionsException[] = [
  {
    id: '1', entityName: 'Gulf Maritime Services LLC', riskDomain: 'Interface Risk',
    justification: 'Broker operates in shared port facility with sanctioned vessel operators but has no direct commercial relationship.',
    compensatingControls: ['Enhanced transaction monitoring', 'Quarterly compliance review', 'Separate bank account verification'],
    sunsetDate: '2025-07-15', approvedBy: 'Ahmed Al-Rashid (MLRO)', status: 'active', cbuaeNotified: true, daysRemaining: 28
  },
  {
    id: '2', entityName: 'Al-Rashid Travel Agency', riskDomain: 'Customer Risk',
    justification: 'Travel agent channels premium payments through correspondent bank with indirect exposure to sanctioned entity.',
    compensatingControls: ['Monthly transaction sampling', 'Source-of-funds verification for payments >AED 25,000'],
    sunsetDate: '2025-08-22', approvedBy: 'Fatima Al-Sayed (Compliance Manager)', status: 'active', cbuaeNotified: true, daysRemaining: 66
  },
  {
    id: '3', entityName: 'Pacific Trade Credit Corp', riskDomain: 'Jurisdiction Risk',
    justification: 'Trade credit insurance covers transactions involving entities in jurisdiction under OFAC secondary sanctions review.',
    compensatingControls: ['OFAC 50% Rule screening', 'Semi-annual reassessment', 'Legal counsel sign-off'],
    sunsetDate: '2025-03-30', approvedBy: 'Ahmed Al-Rashid (MLRO)', status: 'active', cbuaeNotified: false, daysRemaining: 12
  },
];

export const mockEvidenceItems: EvidenceItem[] = [
  {
    id: '1', inspectionId: 'INS-2025-001', fileName: 'UBO_Declaration_Signed_2024.pdf',
    fileHash: 'a3f2b7c9d1e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4',
    fileSize: 2456789, fileType: 'application/pdf',
    aiVerified: true, aiConfidence: 0.94,
    aiVerificationDetail: 'Contains signed UBO declaration with authorized signatory verification. Document integrity confirmed.',
    uploadedBy: 'Sara Al-Maktoum', department: 'Underwriting', uploadedAt: '2025-01-12T10:30:00Z'
  },
  {
    id: '2', inspectionId: 'INS-2025-001', fileName: 'AML_Policy_v3.2_Approved.pdf',
    fileHash: 'b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4',
    fileSize: 5123456, fileType: 'application/pdf',
    aiVerified: true, aiConfidence: 0.98,
    aiVerificationDetail: 'Contains approved AML/CFT Policy v3.2 with Board sign-off dated Dec 2024. All required sections present.',
    uploadedBy: 'Omar Hassan', department: 'Compliance', uploadedAt: '2025-01-13T14:15:00Z'
  },
  {
    id: '3', inspectionId: 'INS-2025-002', fileName: 'Training_Attendance_Q4_2024.xlsx',
    fileHash: 'c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5',
    fileSize: 876543, fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    aiVerified: false, aiConfidence: 0.45,
    aiVerificationDetail: 'Insufficient data: Training attendance records do not cover all mandated staff. Missing departments: Claims (3 staff), IT (2 staff).',
    uploadedBy: 'Khalid Nasser', department: 'HR', uploadedAt: '2025-01-14T09:00:00Z'
  },
];

export const mockAuditLog: AuditLogEntry[] = [
  { id: '1', userId: 'u1', userName: 'Ahmed Al-Rashid', action: 'APPROVE', resource: 'AML Alert', resourceId: 'AML-2025-0147', details: 'Approved SAR filing after review of AI-generated goAML narrative', aiConfidence: 0.87, sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', timestamp: '2025-01-16T10:30:00Z' },
  { id: '2', userId: 'u2', userName: 'Fatima Al-Sayed', action: 'ESCALATE', resource: 'AML Alert', resourceId: 'AML-2025-0149', details: 'Escalated to MLRO for PEP-related disposition decision', aiConfidence: 0.72, sha256Hash: 'a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a', timestamp: '2025-01-16T11:15:00Z' },
  { id: '3', userId: 'u3', userName: 'Omar Hassan', action: 'UPLOAD', resource: 'Evidence', resourceId: 'INS-2025-001', details: 'Uploaded signed UBO declaration for compliance inspection', aiConfidence: 0.94, sha256Hash: 'a3f2b7c9d1e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4', timestamp: '2025-01-12T10:30:00Z' },
  { id: '4', userId: 'u1', userName: 'Ahmed Al-Rashid', action: 'OVERRIDE_BLOCKED', resource: 'Maker/Checker', resourceId: 'AML-2025-0150', details: 'Security Violation: Maker/Checker Breach - User attempted to approve own record', aiConfidence: null, sha256Hash: 'b7e23ec29af22b0b4e41da31e868d57226161c974ca77ac5b2d46b0e8f6a0b3d', timestamp: '2025-01-17T08:05:00Z' },
  { id: '5', userId: 'u4', userName: 'Sara Al-Maktoum', action: 'APPROVE_POLICY', resource: 'Gap Analysis', resourceId: 'GA-2025-003', details: 'Approved policy update for third-party payment EDD requirements', aiConfidence: 0.91, sha256Hash: 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce', timestamp: '2025-01-15T16:45:00Z' },
];

export const mockRiskMatrix: RiskMatrixCell[] = [
  { domain: 'Customer', category: 'PEP Exposure', riskLevel: 'high', description: 'Politically Exposed Persons and their associates require EDD', controls: ['PEP Screening Database', 'Senior Management Approval', 'Source of Wealth Verification'], controlOwner: 'Compliance Officer' },
  { domain: 'Customer', category: 'Non-Resident Corporate', riskLevel: 'intermediate', description: 'Offshore corporate entities with opaque ownership structures', controls: ['UBO Verification', 'Registry Search', 'Annual Review'], controlOwner: 'Compliance Analyst' },
  { domain: 'Customer', category: 'Resident Individual', riskLevel: 'low', description: 'Standard UAE resident with verified Emirates ID', controls: ['SDD Application', 'Emirates ID Verification', 'Periodic Review'], controlOwner: 'Junior Compliance Staff' },
  { domain: 'Jurisdiction', category: 'FATF High-Risk', riskLevel: 'critical', description: 'Countries on FATF black/grey lists', controls: ['Enhanced Monitoring', 'Transaction Blocking Rules', 'CBUAE Notification'], controlOwner: 'MLRO' },
  { domain: 'Jurisdiction', category: 'GCC Countries', riskLevel: 'low', description: 'Fellow GCC member states with AML frameworks', controls: ['Standard Monitoring', 'Reciprocal Agreement Check'], controlOwner: 'Compliance Officer' },
  { domain: 'Product', category: 'Marine Cargo', riskLevel: 'high', description: 'High-risk for sanctions evasion via vessel manipulation', controls: ['IMO Number Screening', 'Flag State Verification', 'Cargo Manifest Review'], controlOwner: 'Underwriting Manager' },
  { domain: 'Product', category: 'Trade Credit', riskLevel: 'intermediate', description: 'Trade-based money laundering risk in credit insurance', controls: ['Invoice Verification', 'Trade Pattern Analysis', 'Dual-Use Goods Check'], controlOwner: 'Underwriting Manager' },
  { domain: 'Product', category: 'Term Life', riskLevel: 'low', description: 'Lower risk product with standard underwriting', controls: ['Standard Underwriting', 'Beneficiary Verification'], controlOwner: 'Underwriting Team' },
  { domain: 'Interface', category: 'Travel Agents', riskLevel: 'intermediate', description: 'Third-party premium collection via travel channels', controls: ['Agent Due Diligence', 'Premium Reconciliation', 'Threshold Monitoring'], controlOwner: 'Distribution Manager' },
  { domain: 'Interface', category: 'Direct Channels', riskLevel: 'low', description: 'Company-owned distribution channels', controls: ['Standard Controls', 'Staff Training'], controlOwner: 'Operations Manager' },
  { domain: 'Other', category: 'Crypto-Linked', riskLevel: 'high', description: 'Policies linked to virtual asset service providers', controls: ['VASP License Verification', 'Blockchain Analysis', 'Enhanced Monitoring'], controlOwner: 'Compliance Officer' },
  { domain: 'Other', category: 'Proliferation Finance', riskLevel: 'critical', description: 'Dual-use goods and proliferation financing indicators', controls: ['End-User Certificate Review', 'Export Control Screening', 'CBUAE Immediate Report'], controlOwner: 'MLRO' },
];

export const mockComplianceMetrics: ComplianceMetrics = {
  totalAlerts: 847,
  openAlerts: 23,
  overdueReviews: 12,
  sanctionsHits: 3,
  falsePositiveRate: 12.4,
  activeExceptions: 7,
  pendingInspections: 4,
  complianceScore: 94.7,
};

export const chartData = {
  kriTrends: [
    { month: 'Jul', falsePositive: 18.2, compliance: 89.1, alerts: 45 },
    { month: 'Aug', falsePositive: 16.8, compliance: 90.3, alerts: 52 },
    { month: 'Sep', falsePositive: 15.5, compliance: 91.7, alerts: 38 },
    { month: 'Oct', falsePositive: 14.9, compliance: 92.4, alerts: 41 },
    { month: 'Nov', falsePositive: 13.7, compliance: 93.1, alerts: 36 },
    { month: 'Dec', falsePositive: 12.4, compliance: 94.7, alerts: 29 },
  ],
  riskDistribution: [
    { name: 'Low Risk', value: 452, fill: '#10b981' },
    { name: 'Intermediate', value: 287, fill: '#f59e0b' },
    { name: 'High Risk', value: 89, fill: '#ef4444' },
    { name: 'Critical', value: 19, fill: '#dc2626' },
  ],
  claimTypes: [
    { type: 'Marine', count: 34, amount: 12500000 },
    { type: 'Property', count: 28, amount: 8900000 },
    { type: 'Motor', count: 45, amount: 4200000 },
    { type: 'Life', count: 12, amount: 15600000 },
    { type: 'Professional', count: 18, amount: 5600000 },
    { type: 'Trade Credit', count: 8, amount: 7200000 },
  ],
  monthlyClaims: [
    { month: 'Jul', submitted: 42, approved: 35, rejected: 4, investigated: 3 },
    { month: 'Aug', submitted: 38, approved: 30, rejected: 3, investigated: 5 },
    { month: 'Sep', submitted: 45, approved: 38, rejected: 2, investigated: 5 },
    { month: 'Oct', submitted: 51, approved: 42, rejected: 5, investigated: 4 },
    { month: 'Nov', submitted: 39, approved: 33, rejected: 3, investigated: 3 },
    { month: 'Dec', submitted: 47, approved: 40, rejected: 4, investigated: 3 },
  ],
  financialMetrics: {
    lossRatio: 62.3,
    combinedRatio: 89.7,
    underwritingProfit: 12.4,
    premiumGrowth: 8.7,
    claimFrequency: 2.3,
    avgClaimSize: 425000,
  },
  geoClaims: [
    { emirate: 'Abu Dhabi', claims: 156, amount: 28500000 },
    { emirate: 'Dubai', claims: 234, amount: 42000000 },
    { emirate: 'Sharjah', claims: 78, amount: 8900000 },
    { emirate: 'Ajman', claims: 23, amount: 3200000 },
    { emirate: 'RAK', claims: 34, amount: 5100000 },
    { emirate: 'Fujairah', counts: 19, amount: 2800000 },
    { emirate: 'UAQ', claims: 12, amount: 1500000 },
  ],
};
