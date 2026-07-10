'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useICOSStore } from '@/lib/store';
import type {
  RegulationItem, LaborLawItem, LegalCaseItem,
  TrainingCourseItem, TrainingEnrollmentItem,
  PolicyItem, ComplianceAuditItem, AuditLogEntry,
  AMLAlertCase, EvidenceItem, ClaimCase,
  RegulatoryCircular,
  AdverseMediaSessionItem, CorporateKYCItem, IndividualKYCItem,
  GoAMLFilingItem, MakerCheckerLogItem,
  QuarterlyReportItem, InsuranceRecordItem,
  AIChatSessionItem, AIChatMessageItem,
} from './types';

// ─── Generic fetcher ────────────────────────────────────────────────────────

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    try {
      const json = await res.json();
      throw new Error(json.error || `API error: ${res.status}`);
    } catch (e) {
      if (e instanceof Error && e.message !== `API error: ${res.status}`) throw e;
      throw new Error(`API error: ${res.status}`);
    }
  }
  const json = await res.json();
  if (json.success) return json.data as T;
  throw new Error(json.error || 'Unknown error');
}

async function apiMutate<T>(url: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    try {
      const json = await res.json();
      throw new Error(json.error || `API error: ${res.status}`);
    } catch (e) {
      if (e instanceof Error && e.message !== `API error: ${res.status}`) throw e;
      throw new Error(`API error: ${res.status}`);
    }
  }
  const json = await res.json();
  if (json.success) return json.data as T;
  throw new Error(json.error || 'Operation failed');
}

// ─── Query Key Factory ──────────────────────────────────────────────────────

export const queryKeys = {
  dashboard: ['dashboard'] as const,
  regulations: (filters?: Record<string, string>) => ['regulations', filters] as const,
  labor: (filters?: Record<string, string>) => ['labor', filters] as const,
  legalCases: (filters?: Record<string, string>) => ['legal-cases', filters] as const,
  trainingCourses: ['training-courses'] as const,
  trainingEnrollments: ['training-enrollments'] as const,
  policies: (filters?: Record<string, string>) => ['policies', filters] as const,
  audits: (filters?: Record<string, string>) => ['audits', filters] as const,
  amlAlerts: (filters?: Record<string, string>) => ['aml-alerts', filters] as const,
  sanctionsExceptions: ['sanctions-exceptions'] as const,
  evidence: (inspectionId?: string) => ['evidence', inspectionId] as const,
  claims: (filters?: Record<string, string>) => ['claims', filters] as const,
  regulatoryCirculars: (regulator?: string) => ['regulatory-circulars', regulator] as const,
  compliance: (jurisdiction?: string) => ['compliance', jurisdiction] as const,
  adverseMedia: (filters?: Record<string, string>) => ['adverse-media', filters] as const,
  corporateKYC: (filters?: Record<string, string>) => ['corporate-kyc', filters] as const,
  individualKYC: (filters?: Record<string, string>) => ['individual-kyc', filters] as const,
  goamlFilings: (filters?: Record<string, string>) => ['goaml-filings', filters] as const,
  makerChecker: (filters?: Record<string, string>) => ['maker-checker', filters] as const,
  quarterlyReports: (filters?: Record<string, string>) => ['quarterly-reports', filters] as const,
  insuranceRecords: (filters?: Record<string, string>) => ['insurance-records', filters] as const,
  aiChatSessions: ['ai-chat-sessions'] as const,
  aiChatMessages: (sessionId: string) => ['ai-chat-messages', sessionId] as const,
  complianceCalendar: (filters?: Record<string, string>) => ['compliance-calendar', filters] as const,
  attestations: (filters?: Record<string, string>) => ['attestations', filters] as const,
  remediations: (filters?: Record<string, string>) => ['remediations', filters] as const,
  goamlXml: ['goaml-xml'] as const,
  policyWizard: ['policy-wizard'] as const,
  complianceCases: (filters?: Record<string, string>) => ['compliance-cases', filters] as const,
  notifications: (filters?: Record<string, string>) => ['notifications', filters] as const,
  riskAssessment: (filters?: Record<string, string>) => ['risk-assessment', filters] as const,
  vaspKyc: (filters?: Record<string, string>) => ['vasp-kyc', filters] as const,
  regulatoryDeadlines: (filters?: Record<string, string>) => ['regulatory-deadlines', filters] as const,
  idempotency: (filters?: Record<string, string>) => ['idempotency', filters] as const,
  cbuaeSubmissionChecker: (filters?: Record<string, string>) => ['cbuae-submission-checker', filters] as const,
  analytics: ['analytics'] as const,
  users: (filters?: Record<string, string>) => ['users', filters] as const,
  userProfile: ['user-profile'] as const,
  auditLog: (filters?: Record<string, string>) => ['audit-log', filters] as const,
  health: ['health'] as const,
};

// ─── Query Hooks ────────────────────────────────────────────────────────────

/** Fetch regulations with optional status / issuer / category filters */
export function useRegulations(filters?: {
  status?: string;
  issuer?: string;
  category?: string;
  type?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.issuer) params.set('issuer', filters.issuer);
  if (filters?.category) params.set('category', filters.category);
  if (filters?.type) params.set('type', filters.type);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.regulations(filters as Record<string, string>),
    queryFn: () => apiFetch<RegulationItem[]>(`/api/regulations${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch labor compliance items */
export function useLaborCompliance(filters?: { category?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.category) params.set('category', filters.category);
  if (filters?.status) params.set('status', filters.status);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.labor(filters as Record<string, string>),
    queryFn: () => apiFetch<LaborLawItem[]>(`/api/labor${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch legal cases */
export function useLegalCases(filters?: { type?: string; status?: string; priority?: string }) {
  const params = new URLSearchParams();
  if (filters?.type) params.set('type', filters.type);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.priority) params.set('priority', filters.priority);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.legalCases(filters as Record<string, string>),
    queryFn: () => apiFetch<LegalCaseItem[]>(`/api/cases${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch training courses */
export function useTrainingCourses() {
  const result = useQuery({
    queryKey: queryKeys.trainingCourses,
    queryFn: () => apiFetch<TrainingCourseItem[]>('/api/training?type=courses'),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch training enrollments */
export function useTrainingEnrollments() {
  const result = useQuery({
    queryKey: queryKeys.trainingEnrollments,
    queryFn: () => apiFetch<TrainingEnrollmentItem[]>('/api/training?type=enrollments'),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch policies */
export function usePolicies(filters?: { category?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.category) params.set('category', filters.category);
  if (filters?.status) params.set('status', filters.status);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.policies(filters as Record<string, string>),
    queryFn: () => apiFetch<PolicyItem[]>(`/api/policies${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch compliance audits */
export function useAudits(filters?: { type?: string; status?: string; riskLevel?: string }) {
  const params = new URLSearchParams();
  if (filters?.type) params.set('type', filters.type);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.riskLevel) params.set('riskLevel', filters.riskLevel);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.audits(filters as Record<string, string>),
    queryFn: () => apiFetch<ComplianceAuditItem[]>(`/api/audits${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch dashboard metrics */
export function useDashboardMetrics() {
  const result = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => apiFetch<{
      complianceScore: number;
      jurisdiction: string;
      lastUpdated: string;
      kriMetrics: Array<{
        id: string; name: string; value: number; target: number;
        trend: string; jurisdiction: string; category: string;
      }>;
      regulations: { total: number; compliant: number; partial: number; nonCompliant: number; pending: number };
      policies: { total: number; published: number; draft: number; underReview: number; aiReviewed: number };
      audits: { total: number; scheduled: number; inProgress: number; completed: number; overdueRemediation: number };
      labor: { total: number; compliant: number; partial: number; nonCompliant: number; complianceRate: number };
      legal: { total: number; open: number; urgent: number };
      training: { totalCourses: number; mandatoryCourses: number; totalEnrollments: number; completedEnrollments: number; overdueEnrollments: number; completionRate: number };
      recentAuditLogs: AuditLogEntry[];
    }>('/api/dashboard'),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch compliance metrics */
export function useComplianceMetrics(jurisdiction?: string) {
  const params = new URLSearchParams();
  if (jurisdiction) params.set('jurisdiction', jurisdiction);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.compliance(jurisdiction),
    queryFn: () => apiFetch<{
      totalAlerts: number; openAlerts: number; overdueReviews: number;
      sanctionsHits: number; falsePositiveRate: number; activeExceptions: number;
      pendingInspections: number; complianceScore: number;
      jurisdiction: string; lastUpdated: string;
      kriMetrics: Array<{ name: string; value: number; target: number; status: string }>;
      auditTrailHash: string;
    }>(`/api/compliance${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch AML alerts */
export function useAMLAlerts(filters?: { jurisdiction?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.jurisdiction) params.set('jurisdiction', filters.jurisdiction);
  if (filters?.status) params.set('status', filters.status);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.amlAlerts(filters as Record<string, string>),
    queryFn: () => apiFetch<AMLAlertCase[]>(`/api/aml${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch regulatory circulars from /api/regulations */
export function useRegulatoryCirculars(regulator?: string) {
  const params = new URLSearchParams();
  if (regulator) params.set('issuer', regulator);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.regulatoryCirculars(regulator),
    queryFn: () => apiFetch<RegulatoryCircular[]>(`/api/regulations${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch evidence items */
export function useEvidence(inspectionId?: string) {
  const params = new URLSearchParams();
  if (inspectionId) params.set('inspectionId', inspectionId);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.evidence(inspectionId),
    queryFn: () => apiFetch<EvidenceItem[]>(`/api/evidence${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch claims */
export function useClaims(filters?: { persona?: string; jurisdiction?: string }) {
  const params = new URLSearchParams();
  if (filters?.persona) params.set('persona', filters.persona);
  if (filters?.jurisdiction) params.set('jurisdiction', filters.jurisdiction);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.claims(filters as Record<string, string>),
    queryFn: () => apiFetch<ClaimCase[]>(`/api/claims${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

// ─── Phase 3 Hooks ──────────────────────────────────────────────────────────

/** Fetch adverse media sessions */
export function useAdverseMediaSessions(filters?: { subjectType?: string; decision?: string; search?: string }) {
  const params = new URLSearchParams();
  if (filters?.subjectType) params.set('subjectType', filters.subjectType);
  if (filters?.decision) params.set('decision', filters.decision);
  if (filters?.search) params.set('search', filters.search);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.adverseMedia(filters as Record<string, string>),
    queryFn: () => apiFetch<AdverseMediaSessionItem[]>(`/api/adverse-media${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch corporate KYC applications */
export function useCorporateKYC(filters?: { status?: string; riskRating?: string; search?: string }) {
  const params = new URLSearchParams();
  params.set('type', 'corporate');
  if (filters?.status) params.set('status', filters.status);
  if (filters?.riskRating) params.set('riskRating', filters.riskRating);
  if (filters?.search) params.set('search', filters.search);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.corporateKYC(filters as Record<string, string>),
    queryFn: () => apiFetch<CorporateKYCItem[]>(`/api/kyc?${query}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch individual KYC profiles */
export function useIndividualKYC(filters?: { status?: string; riskRating?: string; isPep?: string; search?: string }) {
  const params = new URLSearchParams();
  params.set('type', 'individual');
  if (filters?.status) params.set('status', filters.status);
  if (filters?.riskRating) params.set('riskRating', filters.riskRating);
  if (filters?.isPep) params.set('isPep', filters.isPep);
  if (filters?.search) params.set('search', filters.search);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.individualKYC(filters as Record<string, string>),
    queryFn: () => apiFetch<IndividualKYCItem[]>(`/api/kyc?${query}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch goAML filings */
export function useGoAMLFilings(filters?: { reportType?: string; filingStatus?: string; search?: string }) {
  const params = new URLSearchParams();
  if (filters?.reportType) params.set('reportType', filters.reportType);
  if (filters?.filingStatus) params.set('filingStatus', filters.filingStatus);
  if (filters?.search) params.set('search', filters.search);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.goamlFilings(filters as Record<string, string>),
    queryFn: () => apiFetch<GoAMLFilingItem[]>(`/api/goaml${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch maker-checker logs */
export function useMakerCheckerLogs(filters?: { status?: string; operationType?: string; entityType?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.operationType) params.set('operationType', filters.operationType);
  if (filters?.entityType) params.set('entityType', filters.entityType);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.makerChecker(filters as Record<string, string>),
    queryFn: () => apiFetch<MakerCheckerLogItem[]>(`/api/maker-checker${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

// ─── Phase 4 Hooks ──────────────────────────────────────────────────────────

/** Fetch quarterly reports */
export function useQuarterlyReports(filters?: { quarter?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.quarter) params.set('quarter', filters.quarter);
  if (filters?.status) params.set('status', filters.status);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.quarterlyReports(filters as Record<string, string>),
    queryFn: () => apiFetch<QuarterlyReportItem[]>(`/api/quarterly-reporting${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch insurance records */
export function useInsuranceRecords(filters?: { status?: string }) {
  const params = new URLSearchParams();
  params.set('type', 'records');
  if (filters?.status) params.set('status', filters.status);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.insuranceRecords(filters as Record<string, string>),
    queryFn: () => apiFetch<InsuranceRecordItem[]>(`/api/quarterly-reporting?${query}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch AI chat sessions */
export function useAIChatSessions() {
  const result = useQuery({
    queryKey: queryKeys.aiChatSessions,
    queryFn: () => apiFetch<AIChatSessionItem[]>('/api/ai/chat'),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch AI chat messages for a session */
export function useAIChatMessages(sessionId: string) {
  const result = useQuery({
    queryKey: queryKeys.aiChatMessages(sessionId),
    queryFn: () => apiFetch<AIChatMessageItem[]>(`/api/ai/chat?sessionId=${sessionId}`),
    enabled: !!sessionId,
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

// ─── Training Effectiveness Hook ──────────────────────────────────────────────

/** Fetch training effectiveness measurement data (pre/post assessments, knowledge gain) */
export function useTrainingEffectiveness(filters?: {
  courseId?: string;
  enrollmentId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.courseId) params.set('courseId', filters.courseId);
  if (filters?.enrollmentId) params.set('enrollmentId', filters.enrollmentId);
  if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters?.dateTo) params.set('dateTo', filters.dateTo);
  const query = params.toString();

  const result = useQuery({
    queryKey: ['training-effectiveness', filters] as const,
    queryFn: () => apiFetch<{
      enrollments: Array<{
        id: string;
        courseId: string;
        courseTitle: string;
        courseCategory: string;
        userId: string;
        userName: string;
        department: string;
        status: string;
        preAssessmentScore: number | null;
        postAssessmentScore: number | null;
        knowledgeGain: number | null;
        complianceScore: number | null;
        assessmentMethod: string | null;
        assessmentDate: string | null;
        effectivenessRating: string | null;
      }>;
      overallStats: {
        totalEnrollments: number;
        withBothScores: number;
        avgPreScore: number;
        avgPostScore: number;
        avgKnowledgeGain: number;
        overallEffectivenessScore: number;
        ratingDistribution: Record<string, number>;
      };
      courseStats: Array<{
        courseId: string;
        courseTitle: string;
        courseCategory: string;
        enrollments: number;
        withBothScores: number;
        avgPreScore: number;
        avgPostScore: number;
        avgKnowledgeGain: number;
        effectivenessScore: number;
        needsImprovement: boolean;
      }>;
      departmentStats: Array<{
        department: string;
        enrollments: number;
        withBothScores: number;
        avgPreScore: number;
        avgPostScore: number;
        avgKnowledgeGain: number;
        effectivenessScore: number;
      }>;
      gainDistribution: {
        negative: number;
        minimal: number;
        moderate: number;
        good: number;
        excellent: number;
      };
      coursesNeedingImprovement: Array<{
        courseId: string;
        courseTitle: string;
        courseCategory: string;
        enrollments: number;
        withBothScores: number;
        avgPreScore: number;
        avgPostScore: number;
        avgKnowledgeGain: number;
        effectivenessScore: number;
        needsImprovement: boolean;
      }>;
      complianceScoreFormula: string;
    }>(`/api/training-effectiveness${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

// ─── UBO Tree Hook ──────────────────────────────────────────────────────────

/** Fetch UBO ownership tree for OFAC 50% Rule calculation */
export function useUBOTree(entityId: string) {
  const result = useQuery({
    queryKey: ['ubo-tree', entityId] as const,
    queryFn: async () => {
      const res = await fetch(`/api/ubo-tree?entityId=${encodeURIComponent(entityId)}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      return json.data as {
        entityId: string;
        totalSanctionedOwnership: number;
        isBlocked: boolean;
        flaggedChain: Array<{
          id: string;
          name: string;
          ownershipPercent: number;
          level: number;
          isSanctioned: boolean;
          children: unknown[];
          jurisdiction?: string;
          entityType?: string;
        }>;
        ownershipTree: {
          id: string;
          name: string;
          ownershipPercent: number;
          level: number;
          isSanctioned: boolean;
          children: unknown[];
          jurisdiction?: string;
          entityType?: string;
        } | null;
        depthReached: number;
      };
    },
    enabled: !!entityId,
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

// ─── KYC Document Upload Hook ──────────────────────────────────────────────

/** Fetch KYC documents for an inspection or KYC ID */
export function useKYCDocuments(filters: { inspectionId?: string; kycId?: string }) {
  const params = new URLSearchParams();
  if (filters.inspectionId) params.set('inspectionId', filters.inspectionId);
  if (filters.kycId) params.set('kycId', filters.kycId);
  const query = params.toString();

  const result = useQuery({
    queryKey: ['kyc-documents', filters] as const,
    queryFn: async () => {
      const res = await fetch(`/api/kyc-upload?${query}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      return json.data as Array<{
        id: string;
        inspectionId: string;
        fileName: string;
        fileHash: string;
        fileSize: number;
        fileType: string;
        uploadedBy: string;
        department: string;
        createdAt: string;
      }>;
    },
    enabled: !!(filters.inspectionId || filters.kycId),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

// ─── Sanctions Screening Hook ───────────────────────────────────────────────

/** Fetch sanctions screening results with filters */
export function useSanctionsScreenings(filters?: {
  status?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.entityType) params.set('entityType', filters.entityType);
  if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters?.dateTo) params.set('dateTo', filters.dateTo);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  const query = params.toString();

  const result = useQuery({
    queryKey: ['sanctions-screenings', filters] as const,
    queryFn: () => apiFetch<{
      screenings: Array<{
        id: string;
        screeningId: string;
        entityType: string;
        primaryName: string;
        status: string;
        highestScore: number;
        createdAt: string;
      }>;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/sanctions${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

// ─── Compliance Alerts Hook ─────────────────────────────────────────────────

/** Fetch compliance alerts with filters */
export function useComplianceAlerts(filters?: {
  alertType?: string;
  severity?: string;
  status?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.alertType) params.set('alertType', filters.alertType);
  if (filters?.severity) params.set('severity', filters.severity);
  if (filters?.status) params.set('status', filters.status);
  const query = params.toString();

  const result = useQuery({
    queryKey: ['compliance-alerts', filters] as const,
    queryFn: () => apiFetch<Array<{
      id: string;
      alertType: string;
      severity: string;
      status: string;
      title: string;
      description: string;
      sourceModule: string;
      dueDate: string;
      isImmutable: boolean;
      createdAt: string;
    }>>(`/api/compliance-alerts${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

// ─── SAR Deadline Hook ──────────────────────────────────────────────────────

/** Fetch SAR cases with deadline tracking */
export function useSARDeadlines(filters?: { status?: string; daysRemaining?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.daysRemaining) params.set('daysRemaining', filters.daysRemaining);
  const query = params.toString();

  const result = useQuery({
    queryKey: ['sar-deadlines', filters] as const,
    queryFn: () => apiFetch<Array<{
      id: string;
      caseNumber: string;
      filingDeadline: string;
      triggerDate: string;
      daysRemaining: number;
      status: string;
      subjectName: string;
      riskLevel: string;
      tippingOffWarning: boolean;
    }>>(`/api/sar-deadlines${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

// ─── Mutation Hook ──────────────────────────────────────────────────────────

/** Error type for API mutations */
export interface ApiMutationError extends Error {
  status: number;
  message: string;
}

/** Fetch AI engine config */
export function useAIConfig() {
  const result = useQuery({
    queryKey: ['ai-config'] as const,
    queryFn: () => apiFetch<{
      provider: string;
      apiKey: string;
      defaultModel: string;
      temperature: number;
      maxTokens: number;
      topP: number;
      frequencyPenalty: number;
      presencePenalty: number;
      monthlyTokenQuota: number;
      isActive: boolean;
    }>('/api/admin/ai-config'),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Update AI engine config */
export function useUpdateAIConfig() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiMutate<{ message?: string }>('/api/admin/ai-config', 'PUT', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config'] as const });
    },
  });

  return {
    mutateAsync: mutation.mutateAsync,
    mutate: mutation.mutate,
    loading: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}

/** Fetch current user profile */
export function useMyProfile() {
  const result = useQuery({
    queryKey: queryKeys.userProfile,
    queryFn: () => apiFetch<{
      id: string;
      email: string;
      name: string;
      role: string;
      jurisdiction: string;
      avatar: string | null;
      isActive: boolean;
    }>('/api/users/me'),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Update current user profile */
export function useUpdateMyProfile() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: { name?: string; avatar?: string }) => {
      return apiMutate<{ message?: string }>('/api/users/me', 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile });
    },
  });

  return {
    mutateAsync: mutation.mutateAsync,
    mutate: mutation.mutate,
    loading: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}

/** Fetch users with optional filters */
export function useUsers() {
  const result = useQuery({
    queryKey: queryKeys.users(),
    queryFn: () => apiFetch<Array<{
      id: string;
      email: string;
      name: string;
      role: string;
      jurisdiction: string;
      avatar: string | null;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    }>>('/api/users'),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Create a new user */
export function useCreateUser() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: { email: string; name: string; role: string; jurisdiction?: string; isActive?: boolean }) => {
      return apiMutate<{ id: string; message?: string }>('/api/users', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
    },
  });

  return {
    mutateAsync: mutation.mutateAsync,
    mutate: mutation.mutate,
    loading: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}

/** Update an existing user */
export function useUpdateUser() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: { id: string; role?: string; isActive?: boolean; name?: string; email?: string; jurisdiction?: string }) => {
      // PATCH (not PUT) — the /api/users route exports a PATCH handler that
      // reads the user id from the request body. The previous PUT verb here
      // returned 405 Method Not Allowed, which broke the AdminPanel "Edit Role"
      // submenu. Aligned with the canonical Next.js App Router convention of
      // using PATCH for partial updates.
      return apiMutate<{ id: string; message?: string }>(`/api/users?id=${data.id}`, 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
    },
  });

  return {
    mutateAsync: mutation.mutateAsync,
    mutate: mutation.mutate,
    loading: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}

/** Generic mutation hook that invalidates queries after success */
export function useApiMutation(options?: {
  invalidateKeys?: string[][];
  onSuccess?: (data: unknown) => void;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ url, method, body }: {
      url: string;
      method: 'POST' | 'PUT' | 'DELETE';
      body?: unknown;
    }) => {
      return apiMutate(url, method, body);
    },
    onSuccess: (data) => {
      if (options?.invalidateKeys) {
        options.invalidateKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
      options?.onSuccess?.(data);
    },
  });

  return {
    mutate: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}

// ─── Phase 5 Hooks ──────────────────────────────────────────────────────────

/** Fetch compliance calendar events */
export function useComplianceCalendar(filters?: {
  eventType?: string;
  status?: string;
  priority?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.eventType) params.set('eventType', filters.eventType);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.priority) params.set('priority', filters.priority);
  if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters?.dateTo) params.set('dateTo', filters.dateTo);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.complianceCalendar(filters as Record<string, string>),
    queryFn: () => apiFetch<Array<Record<string, unknown>>>(`/api/compliance-calendar${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch policy attestations */
export function useAttestations(filters?: {
  policyId?: string;
  userId?: string;
  status?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.policyId) params.set('policyId', filters.policyId);
  if (filters?.userId) params.set('userId', filters.userId);
  if (filters?.status) params.set('status', filters.status);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.attestations(filters as Record<string, string>),
    queryFn: () => apiFetch<Array<Record<string, unknown>>>(`/api/attestations${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch remediation actions */
export function useRemediations(filters?: {
  auditId?: string;
  status?: string;
  priority?: string;
  assignedToId?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.auditId) params.set('auditId', filters.auditId);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.priority) params.set('priority', filters.priority);
  if (filters?.assignedToId) params.set('assignedToId', filters.assignedToId);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.remediations(filters as Record<string, string>),
    queryFn: () => apiFetch<Array<Record<string, unknown>>>(`/api/remediations${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Generate goAML XML (mutation) */
export function useGoAMLXml() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (body: {
      reportType: string;
      entityId?: string;
      transactionData?: Record<string, unknown>;
    }) => {
      return apiMutate<Record<string, unknown>>('/api/goaml-xml', 'POST', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goamlXml });
    },
  });

  return {
    mutate: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}

/** Policy wizard 6-step mutation */
export function usePolicyWizard() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (body: {
      step: 'start' | 'regmap' | 'draft' | 'review' | 'approve' | 'publish';
      policyId?: string;
      data?: Record<string, unknown>;
    }) => {
      return apiMutate<Record<string, unknown>>('/api/policy-wizard', 'POST', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.policyWizard });
      queryClient.invalidateQueries({ queryKey: queryKeys.policies() });
    },
  });

  return {
    mutate: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}

/** Fetch compliance cases */
export function useComplianceCases(filters?: {
  caseType?: string;
  status?: string;
  riskLevel?: string;
  assignedToId?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.caseType) params.set('caseType', filters.caseType);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.riskLevel) params.set('riskLevel', filters.riskLevel);
  if (filters?.assignedToId) params.set('assignedToId', filters.assignedToId);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.complianceCases(filters as Record<string, string>),
    queryFn: () => apiFetch<{
      cases: Array<Record<string, unknown>>;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/compliance-cases${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch notifications */
export function useNotifications(filters?: {
  userId?: string;
  type?: string;
  isRead?: string;
  priority?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.userId) params.set('userId', filters.userId);
  if (filters?.type) params.set('type', filters.type);
  if (filters?.isRead) params.set('isRead', filters.isRead);
  if (filters?.priority) params.set('priority', filters.priority);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.notifications(filters as Record<string, string>),
    queryFn: () => apiFetch<{
      notifications: Array<Record<string, unknown>>;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/notifications${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch risk assessments */
export function useRiskAssessment(filters?: {
  domain?: string;
  category?: string;
  inherentRisk?: string;
  residualRisk?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.domain) params.set('domain', filters.domain);
  if (filters?.category) params.set('category', filters.category);
  if (filters?.inherentRisk) params.set('inherentRisk', filters.inherentRisk);
  if (filters?.residualRisk) params.set('residualRisk', filters.residualRisk);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.riskAssessment(filters as Record<string, string>),
    queryFn: () => apiFetch<Array<Record<string, unknown>>>(`/api/risk-assessment${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch VASP KYC records */
export function useVASPKYC(filters?: {
  vaspType?: string;
  riskRating?: string;
  status?: string;
  travelRuleCompliant?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.vaspType) params.set('vaspType', filters.vaspType);
  if (filters?.riskRating) params.set('riskRating', filters.riskRating);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.travelRuleCompliant) params.set('travelRuleCompliant', filters.travelRuleCompliant);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.vaspKyc(filters as Record<string, string>),
    queryFn: () => apiFetch<Array<Record<string, unknown>>>(`/api/vasp-kyc${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch regulatory deadlines */
export function useRegulatoryDeadlines(filters?: {
  deadlineType?: string;
  status?: string;
  jurisdiction?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.deadlineType) params.set('deadlineType', filters.deadlineType);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.jurisdiction) params.set('jurisdiction', filters.jurisdiction);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.regulatoryDeadlines(filters as Record<string, string>),
    queryFn: () => apiFetch<Array<Record<string, unknown>>>(`/api/regulatory-deadlines${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Fetch idempotency records */
export function useIdempotency(filters?: {
  operationType?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.operationType) params.set('operationType', filters.operationType);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.idempotency(filters as Record<string, string>),
    queryFn: () => apiFetch<{
      records: Array<Record<string, unknown>>;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/idempotency${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

// ─── CBUAE Submission Checker Hook ──────────────────────────────────────────────

/** Check CBUAE submission readiness for quarterly reports, SAR filings, and CTR filings */
export function useCBUAESubmissionChecker(filters?: { reportId?: string; reportType?: string }) {
  const params = new URLSearchParams();
  if (filters?.reportId) params.set('reportId', filters.reportId);
  if (filters?.reportType) params.set('reportType', filters.reportType);
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.cbuaeSubmissionChecker(filters as Record<string, string>),
    queryFn: () => apiFetch<{
      ready: boolean;
      checks: Array<{
        check: string;
        passed: boolean;
        message: string;
      }>;
      missingFields: string[];
      reportId?: string;
      reportType?: string;
      checkedAt: string;
    }>(`/api/cbuae-submission-checker${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

// ─── Phase 5.2 Utility Hooks ─────────────────────────────────────────────────

/** Fetch live analytics aggregations from Prisma */
export function useAnalyticsAggregate(months?: number) {
  const params = new URLSearchParams();
  if (months) params.set('months', String(months));
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.analytics,
    queryFn: () => apiFetch<{
      riskPosture: Array<{ riskLevel: string; count: number }>;
      kycRiskCounts: {
        corporate: Array<{ riskRating: string; count: number }>;
        individual: Array<{ riskRating: string; count: number }>;
      };
      transactionTrends: Array<{ month: string; volume: number; flagged: number; avgRisk: number; str: number; sar: number; ctr: number; ift: number }>;
      domainRiskScores: Array<{ domain: string; score: number; benchmark: number }>;
      aiModelUsage: Array<{ model: string; queryCount: number; avgLatencyMs: number | null }>;
      complianceSummary: {
        totalAlerts: number; openAlerts: number;
        totalKYC: number; pendingKYC: number;
        totalFilings: number; pendingFilings: number;
      };
      filingTrendsByType: Array<{ month: string; STR: number; SAR: number; CTR: number; IFT: number; PNMR: number }>;
    }>(`/api/analytics/aggregate${query ? `?${query}` : ''}`),
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

/** Create a new claim (mutation) */
export function useCreateClaim() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (body: {
      policyNumber: string;
      claimType: string;
      claimantName: string;
      description: string;
      amount: number;
    }) => {
      return apiMutate<ClaimCase>('/api/claims', 'POST', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.claims() });
    },
  });

  return {
    mutate: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}

/** Update a claim (mutation) */
export function useUpdateClaim() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (body: {
      id: string;
      status?: string;
      priority?: string;
      assignedAdjuster?: string;
      siuFlagged?: boolean;
      fraudScore?: number;
    }) => {
      return apiMutate<ClaimCase>('/api/claims', 'PATCH', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.claims() });
    },
  });

  return {
    mutate: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}

/** Create a new legal case (mutation) */
export function useCreateLegalCase() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (body: {
      title: string;
      caseType: string;
      priority?: string;
      assignedCounsel?: string;
      department?: string;
      description?: string;
      filingDate?: string;
      nextHearing?: string;
    }) => {
      const caseNumber = `LC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      return apiMutate<LegalCaseItem>('/api/cases', 'POST', { ...body, caseNumber });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.legalCases() });
    },
  });

  return {
    mutate: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}

/** Create a training enrollment (mutation) */
export function useCreateEnrollment() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (body: {
      courseId: string;
      userId: string;
      userName: string;
      department: string;
    }) => {
      return apiMutate<TrainingEnrollmentItem>('/api/training', 'POST', { ...body, type: 'enrollment' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trainingEnrollments });
    },
  });

  return {
    mutate: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}

/** Update a training enrollment (mutation) */
export function useUpdateEnrollment() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (body: {
      id: string;
      status?: string;
      score?: number;
      completedAt?: string;
      expiryDate?: string;
      postAssessmentScore?: number;
    }) => {
      return apiMutate<TrainingEnrollmentItem>('/api/training', 'PUT', { ...body, type: 'enrollment' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trainingEnrollments });
    },
  });

  return {
    mutate: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}

/** Schedule a new compliance audit (mutation) */
export function useScheduleAudit() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (body: {
      title: string;
      auditType?: string;
      scheduledDate: string;
      leadAuditor?: string;
      scope?: string;
      riskLevel?: string;
      department?: string;
    }) => {
      const auditNumber = `AUD-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      return apiMutate<ComplianceAuditItem>('/api/audits', 'POST', { ...body, auditNumber });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.audits() });
    },
  });

  return {
    mutate: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}

/** Update a compliance audit (mutation) */
export function useUpdateAudit() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (body: {
      id: string;
      status?: string;
      findings?: string;
      remediationStatus?: string;
      completedDate?: string;
    }) => {
      return apiMutate<ComplianceAuditItem>('/api/audits', 'PUT', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.audits() });
    },
  });

  return {
    mutate: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}

// ─── Audit Log Hook ──────────────────────────────────────────────────────────

/** Fetch audit log entries with pagination and filtering */
export function useAuditLog(filters?: {
  action?: string;
  userId?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.action && filters.action !== 'all') params.set('action', filters.action);
  if (filters?.userId && filters.userId !== 'all') params.set('userId', filters.userId);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  const query = params.toString();

  const result = useQuery({
    queryKey: queryKeys.auditLog(filters as Record<string, string>),
    queryFn: () => apiFetch<AuditLogEntry[]>(`/api/audit-log${query ? `?${query}` : ''}`),
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

// ─── Health Check Hook ──────────────────────────────────────────────────────

/** Fetch system health status */
export function useHealth() {
  const result = useQuery({
    queryKey: queryKeys.health,
    queryFn: async () => {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json() as Promise<{
        status: string;
        timestamp: string;
        version: string;
        phase: string;
        uptime: number;
        region: string;
        dataResidency: string;
        compliance: {
          pdpl: boolean;
          cbuae: boolean;
          cspHeaders: boolean;
          hsts: boolean;
        };
        services: {
          database: { status: string; latencyMs: number; provider: string };
          aiGateway: { status: string; url: string };
        };
        security: {
          score: number;
          grade: string;
          checks: Record<string, boolean>;
        };
        performance: {
          healthCheckLatencyMs: number;
        };
      }>;
    },
    refetchInterval: 30000,
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

// ============================================================================
// v7.3.0-uat-hotfix-5 — P1 restoration: Unified My Tasks inbox
// ============================================================================
// These exports were silently deleted from query-hooks.ts by P2 commit ec4c992
// (see RCA_P2_REGRESSION.md §5.2). MyTasks.tsx imports them; without these the
// component fails to compile. Restored here, adapted to the CURRENT
// /api/tasks/my-tasks response shape ({ success, data, pagination }) which
// diverged from the P1-era shape ({ success, tasks, aggregates, pagination }).
// The hook bridges the two: it reads `data`, maps each row to the
// UniversalTaskItem interface the component expects, and computes the
// aggregates client-side (the API no longer returns them).
// ============================================================================

export interface UniversalTaskItem {
  entityType: 'CAP' | 'AUDIT_FINDING' | 'POLICY_ATTESTATION' | 'CIRCULAR_ACK' | 'GOAML_FILING' | 'MAKER_CHECKER' | 'ALERT' | 'COMPLAINT' | 'SAR';
  entityId: string;
  id: string;
  title: string;
  description: string | null;
  assignedToId: string;
  assignedToName: string | null;
  assignedById: string | null;
  assignedByName: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE';
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueDate: string | null;
  completedAt: string | null;
  sourceModule: string | null;
  actionUrl: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface MyTasksAggregates {
  totalOpen: number;
  byPriority: { low: number; medium: number; high: number; critical: number };
  byEntityType: Record<string, number>;
  overdueCount: number;
  completedTodayCount: number;
}

export interface MyTasksResponse {
  tasks: UniversalTaskItem[];
  aggregates: MyTasksAggregates;
  pagination: { limit: number; offset: number; total: number };
}

// Maps a raw API row (taskType/sourceId/uppercase priority+status) to the
// UniversalTaskItem shape the MyTasks component was authored against.
function mapApiTaskToUniversalTask(raw: {
  id: string;
  taskType: string;
  sourceId: string;
  title: string;
  description?: string | null;
  assignedToId?: string | null;
  assignedToName?: string | null;
  priority?: string;
  status?: string;
  dueDate?: string | null;
  sourceModule?: string | null;
  createdAt?: string;
}): UniversalTaskItem {
  const rawPriority = (raw.priority ?? 'MEDIUM').toLowerCase();
  const rawStatus = raw.status ?? 'OPEN';
  // API uses DONE; component expects COMPLETED.
  const status = rawStatus === 'DONE' ? 'COMPLETED' : (rawStatus as UniversalTaskItem['status']);
  return {
    id: raw.id,
    entityType: raw.taskType as UniversalTaskItem['entityType'],
    entityId: raw.sourceId,
    title: raw.title,
    description: raw.description ?? null,
    assignedToId: raw.assignedToId ?? '',
    assignedToName: raw.assignedToName ?? null,
    assignedById: null,
    assignedByName: null,
    status,
    priority: (['low', 'medium', 'high', 'critical'].includes(rawPriority)
      ? rawPriority
      : 'medium') as UniversalTaskItem['priority'],
    dueDate: raw.dueDate ?? null,
    completedAt: null,
    sourceModule: raw.sourceModule ?? null,
    actionUrl: null,
    metadata: null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.createdAt ?? new Date().toISOString(),
  };
}

export function useMyTasks(filters?: {
  entityType?: string;
  includeCompleted?: boolean;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  // The component passes `entityType`; the API accepts `taskType`.
  if (filters?.entityType) params.set('taskType', filters.entityType);
  // includeCompleted=false → API defaults to OPEN+IN_PROGRESS (active only).
  // includeCompleted=true → omit status filter so DONE/CANCELLED are included.
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  const qs = params.toString();
  const url = `/api/tasks/my-tasks${qs ? `?${qs}` : ''}`;

  const result = useQuery<MyTasksResponse>({
    queryKey: ['my-tasks', filters ?? {}],
    queryFn: async () => {
      // Read the current user from the store so the inbox shows THIS user's
      // tasks (the API filters by assignedToId = x-user-id).
      const { id: userId, role: userRole } = useICOSStore.getState().currentUser;
      const res = await fetch(url, {
        headers: { 'x-user-id': userId, 'x-user-role': userRole },
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load tasks');
      const rawTasks: Array<Record<string, unknown>> = json.data ?? [];
      const tasks = rawTasks.map((r) =>
        mapApiTaskToUniversalTask(r as Parameters<typeof mapApiTaskToUniversalTask>[0]),
      );

      // Compute aggregates client-side (API no longer returns them).
      const now = new Date();
      const byPriority = { low: 0, medium: 0, high: 0, critical: 0 };
      const byEntityType: Record<string, number> = {};
      let totalOpen = 0;
      let overdueCount = 0;
      for (const t of tasks) {
        if (t.status === 'OPEN' || t.status === 'IN_PROGRESS') {
          totalOpen++;
          if (t.dueDate && new Date(t.dueDate) < now) overdueCount++;
        }
        byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
        byEntityType[t.entityType] = (byEntityType[t.entityType] ?? 0) + 1;
      }
      const aggregates: MyTasksAggregates = {
        totalOpen,
        byPriority,
        byEntityType,
        overdueCount,
        completedTodayCount: 0,
      };

      return {
        tasks,
        aggregates,
        pagination: json.pagination ?? { limit: filters?.limit ?? 50, offset: filters?.offset ?? 0, total: tasks.length },
      } as MyTasksResponse;
    },
    refetchInterval: 60_000, // refresh inbox every 60s
    staleTime: 30_000,
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}
