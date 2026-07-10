import type { JurisdictionCode } from '@/lib/constants/jurisdictions';

export type Jurisdiction = JurisdictionCode;
export type RiskLevel = 'low' | 'intermediate' | 'high' | 'critical';
export type AlertStatus = 'new' | 'triage' | 'investigating' | 'sar_filed' | 'closed' | 'escalated';
export type ClaimStatus = 'submitted' | 'under_review' | 'investigation' | 'approved' | 'rejected' | 'paid';
export type UserRole = 'admin' | 'mlro' | 'compliance_manager' | 'compliance_officer' | 'dept_head' | 'board' | 'auditor';
export type PersonaPortal = 'claimant' | 'adjuster' | 'siu' | 'supervisor';

export interface KRICard {
  id: string;
  name: string;
  value: number;
  target: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
  status: 'compliant' | 'warning' | 'critical';
  jurisdiction: Jurisdiction;
}

export interface RegulatoryCircular {
  id: string;
  title: string;
  regulator: Jurisdiction;
  circularNumber: string;
  effectiveDate: string;
  status: 'ingested' | 'analyzing' | 'analyzed' | 'actioned';
  summary: string;
  affectedDepts: string[];
  riskImpact: RiskLevel;
}

export interface GapAnalysisItem {
  id: string;
  circularId: string;
  missingClause: string;
  currentPolicy: string;
  requiredAction: string;
  aiConfidence: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  sourceRef: string;
}

export interface AMLAlertCase {
  id: string;
  caseId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  alertType: string;
  description: string;
  aiFlags: string[];
  goAMLDraft: string;
  status: AlertStatus;
  assignedTo: string;
  createdBy: string;
  jurisdiction: Jurisdiction;
  createdAt: string;
  amount: number;
  policyNumber: string;
}

export interface SanctionsException {
  id: string;
  entityName: string;
  riskDomain: string;
  justification: string;
  compensatingControls: string[];
  sunsetDate: string;
  approvedBy: string;
  status: 'active' | 'expired' | 'revoked';
  cbuaeNotified: boolean;
  daysRemaining: number;
}

export interface EvidenceItem {
  id: string;
  inspectionId: string;
  fileName: string;
  fileHash: string;
  fileSize: number;
  fileType: string;
  aiVerified: boolean;
  aiConfidence: number;
  aiVerificationDetail: string;
  uploadedBy: string;
  department: string;
  uploadedAt: string;
}

export interface ClaimCase {
  id: string;
  claimNumber: string;
  policyNumber: string;
  claimType: string;
  claimantName: string;
  description: string;
  amount: number;
  fraudScore: number;
  status: ClaimStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assignedAdjuster: string;
  siuFlagged: boolean;
  jurisdiction: Jurisdiction;
  createdAt: string;
  aiRecommendation?: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId: string;
  details: string;
  aiConfidence: number | null;
  sha256Hash: string;
  timestamp: string;
}

export interface RiskMatrixCell {
  domain: string;
  category: string;
  riskLevel: RiskLevel;
  description: string;
  controls: string[];
  controlOwner: string;
}

export interface ComplianceMetrics {
  totalAlerts: number;
  openAlerts: number;
  overdueReviews: number;
  sanctionsHits: number;
  falsePositiveRate: number;
  activeExceptions: number;
  pendingInspections: number;
  complianceScore: number;
}

// ─── Phase 1 Enhancement Types ────────────────────────────────────────────

export type ComplianceStatus = 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' | 'PENDING' | 'NOT_STARTED';
export type PolicyStatus = 'draft' | 'under_review' | 'approved' | 'published' | 'archived';
export type CaseStatus = 'open' | 'in_progress' | 'under_review' | 'resolved' | 'closed';
export type AuditStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type RemediationStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue';
export type TrainingStatus = 'enrolled' | 'in_progress' | 'completed' | 'expired' | 'overdue';

export interface RegulationItem {
  id: string;
  title: string;
  issuer: string;
  category: string;
  description: string;
  effectiveDate: string;
  nextReviewDate: string;
  complianceStatus: ComplianceStatus;
  assignedTo: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export interface PolicyItem {
  id: string;
  title: string;
  policyNumber: string;
  category: string;
  version: string;
  status: PolicyStatus;
  department: string;
  owner: string;
  reviewDate: string;
  approvalDate: string;
  approvedBy: string;
  aiReviewed: boolean;
  aiConfidence: number;
}

export interface LaborLawItem {
  id: string;
  requirement: string;
  category: string;
  authority: string;
  complianceStatus: ComplianceStatus;
  dueDate: string;
  assignedTo: string;
  details: string;
  quotaType: string;
  currentCount: number;
  requiredCount: number;
  lastVerified: string;
}

export interface LegalCaseItem {
  id: string;
  caseNumber: string;
  title: string;
  caseType: string;
  status: CaseStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assignedCounsel: string;
  department: string;
  description: string;
  filingDate: string;
  nextHearing: string;
  jurisdiction: string;
  aiSummary: string;
}

export interface TrainingCourseItem {
  id: string;
  title: string;
  category: string;
  provider: string;
  durationHours: number;
  isMandatory: boolean;
  targetAudience: string;
  certification: boolean;
  validForMonths: number;
  enrolledCount: number;
  completedCount: number;
  expiryAlerts: number;
}

export interface TrainingEnrollmentItem {
  id: string;
  courseId: string;
  courseTitle: string;
  userName: string;
  department: string;
  status: TrainingStatus;
  enrolledAt: string;
  completedAt: string;
  expiryDate: string;
  score: number;
}

export interface ComplianceAuditItem {
  id: string;
  auditNumber: string;
  title: string;
  auditType: 'internal' | 'external' | 'regulatory';
  status: AuditStatus;
  scheduledDate: string;
  completedDate: string;
  leadAuditor: string;
  scope: string;
  findings: string;
  remediationStatus: RemediationStatus;
  remediationDueDate: string;
  riskLevel: RiskLevel;
  jurisdiction: Jurisdiction;
  department: string;
}

// ─── Phase 3: Advanced Compliance Workflow Types ────────────────────────────

export type AdverseMediaDecision = 'CLEAR' | 'FALSE_POSITIVE' | 'POTENTIAL_MATCH' | 'CONFIRMED_MATCH';
export type AdverseMediaSubjectType = 'INDIVIDUAL' | 'ENTITY';
export type KYCRiskRating = 'LOW' | 'MEDIUM' | 'HIGH';
export type IndividualKYCRiskRating = 'STANDARD' | 'HIGH';
export type KYCStatus = 'DRAFT' | 'PENDING_MAKER_CHECKER' | 'APPROVED' | 'REJECTED';
export type GoAMLReportType = 'STR' | 'SAR' | 'CTR' | 'IFT' | 'PNMR';
export type GoAMLFilingStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'SUBMITTED_TO_FIU' | 'ACKNOWLEDGED';
export type MakerCheckerStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
export type MakerCheckerOperationType = 'KYC_HIGH_RISK_APPROVAL' | 'GOAML_SUBMIT' | 'SANCTIONS_CLEARANCE_OVERRIDE';

export interface AdverseMediaSessionItem {
  id: string;
  subjectType: AdverseMediaSubjectType;
  subjectName: string;
  aka: string | null;
  nationality: string | null;
  searchConfig: string;
  results: string;
  decision: AdverseMediaDecision | null;
  rationale: string | null;
  createdAt: string;
  createdBy: string;
}

export interface CorporateKYCItem {
  id: string;
  legalName: string;
  tradeLicenseNo: string;
  trn: string | null;
  legalForm: string;
  uboIdentified: boolean;
  uboDetails: string | null;
  pepInManagement: boolean;
  riskScore: number;
  riskRating: KYCRiskRating;
  status: KYCStatus;
  createdAt: string;
}

export interface IndividualKYCItem {
  id: string;
  fullName: string;
  emiratesId: string | null;
  passportNo: string;
  nationality: string;
  isPep: boolean;
  riskRating: IndividualKYCRiskRating;
  eddRequired: boolean;
  status: KYCStatus;
  createdAt: string;
}

export interface GoAMLFilingItem {
  id: string;
  reportType: GoAMLReportType;
  referenceNumber: string;
  subjectName: string;
  amountAED: number | null;
  filingStatus: GoAMLFilingStatus;
  xmlPayload: string;
  fiuAcknowledgementId: string | null;
  createdAt: string;
  submittedAt: string | null;
}

export interface MakerCheckerLogItem {
  id: string;
  operationType: MakerCheckerOperationType;
  entityId: string;
  entityType: string;
  makerId: string;
  makerName: string;
  checkerId: string | null;
  checkerName: string | null;
  status: MakerCheckerStatus;
  expiryTime: string;
  payloadSnapshot: string;
  createdAt: string;
  reviewedAt: string | null;
}

// ─── Phase 4: Backend AI Agent & Quarterly CBUAE Reporting ────────────────

export type QuarterlyReportStatus = 'PROCESSING' | 'VALIDATED' | 'READY' | 'SUBMITTED';
export type AMLRecordStatus = 'CLEARED' | 'FLAGGED';

export interface AIChatSessionItem {
  id: string;
  userId: string;
  contextModule: string;
  createdAt: string;
  messageCount: number;
}

export interface AIChatMessageItem {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  modelUsed: string | null;
  latencyMs: number | null;
  createdAt: string;
}

export interface QuarterlyReportItem {
  id: string;
  quarter: string;
  year: number;
  entityName: string;
  totalPolicies: number;
  totalPremiumAED: number;
  activePolicies: number;
  cancellationRate: number;
  status: QuarterlyReportStatus;
  cbuaeSubmissionId: string | null;
  createdAt: string;
  recordCount: number;
}

export interface InsuranceRecordItem {
  id: string;
  policyNumber: string;
  clientName: string;
  emirate: string;
  productType: string;
  premiumAED: number;
  amlStatus: AMLRecordStatus;
  reportId: string | null;
}
