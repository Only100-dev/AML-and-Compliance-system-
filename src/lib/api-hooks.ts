'use client';

import { useState, useEffect, useCallback } from 'react';
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
  SanctionsException,
} from './types';

// ─── Generic fetch hook ────────────────────────────────────────────────────

function useApiFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
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
      if (json.success) {
        setData(json.data);
      } else {
        throw new Error(json.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// ─── Generic mutation hook ─────────────────────────────────────────────────

export function useApiMutation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async <T = unknown>(
    url: string,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body?: unknown,
  ): Promise<T> => {
    try {
      setLoading(true);
      setError(null);
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
      if (!json.success) throw new Error(json.error || 'Operation failed');
      return json.data as T;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Operation failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, loading, error };
}

// ─── Specific hooks for each API route ─────────────────────────────────────

/** Fetch regulations with optional status / issuer / category filters */
export function useRegulations(filters?: {
  status?: string;
  issuer?: string;
  category?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.issuer) params.set('issuer', filters.issuer);
  if (filters?.category) params.set('category', filters.category);
  const query = params.toString();
  return useApiFetch<RegulationItem[]>(`/api/regulations${query ? `?${query}` : ''}`);
}

/** Fetch labor compliance items with optional category / status filters */
export function useLaborCompliance(filters?: {
  category?: string;
  status?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.category) params.set('category', filters.category);
  if (filters?.status) params.set('status', filters.status);
  const query = params.toString();
  return useApiFetch<LaborLawItem[]>(`/api/labor${query ? `?${query}` : ''}`);
}

/** Fetch legal cases with optional type / status / priority filters */
export function useLegalCases(filters?: {
  type?: string;
  status?: string;
  priority?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.type) params.set('type', filters.type);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.priority) params.set('priority', filters.priority);
  const query = params.toString();
  return useApiFetch<LegalCaseItem[]>(`/api/cases${query ? `?${query}` : ''}`);
}

/** Fetch training courses */
export function useTrainingCourses() {
  return useApiFetch<TrainingCourseItem[]>('/api/training?type=courses');
}

/** Fetch training enrollments */
export function useTrainingEnrollments() {
  return useApiFetch<TrainingEnrollmentItem[]>('/api/training?type=enrollments');
}

/** Fetch policies with optional category / status filters */
export function usePolicies(filters?: {
  category?: string;
  status?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.category) params.set('category', filters.category);
  if (filters?.status) params.set('status', filters.status);
  const query = params.toString();
  return useApiFetch<PolicyItem[]>(`/api/policies${query ? `?${query}` : ''}`);
}

/** Fetch compliance audits with optional type / status / riskLevel filters */
export function useAudits(filters?: {
  type?: string;
  status?: string;
  riskLevel?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.type) params.set('type', filters.type);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.riskLevel) params.set('riskLevel', filters.riskLevel);
  const query = params.toString();
  return useApiFetch<ComplianceAuditItem[]>(`/api/audits${query ? `?${query}` : ''}`);
}

/** Fetch dashboard metrics (KRI cards, compliance metrics, recent audit logs) */
export function useDashboardMetrics() {
  return useApiFetch<{
    complianceScore: number;
    jurisdiction: string;
    lastUpdated: string;
    kriMetrics: Array<{
      id: string;
      name: string;
      value: number;
      target: number;
      trend: string;
      jurisdiction: string;
      category: string;
    }>;
    regulations: {
      total: number;
      compliant: number;
      partial: number;
      nonCompliant: number;
      pending: number;
    };
    policies: {
      total: number;
      published: number;
      draft: number;
      underReview: number;
      aiReviewed: number;
    };
    audits: {
      total: number;
      scheduled: number;
      inProgress: number;
      completed: number;
      overdueRemediation: number;
    };
    labor: {
      total: number;
      compliant: number;
      partial: number;
      nonCompliant: number;
      complianceRate: number;
    };
    legal: {
      total: number;
      open: number;
      urgent: number;
    };
    training: {
      totalCourses: number;
      mandatoryCourses: number;
      totalEnrollments: number;
      completedEnrollments: number;
      overdueEnrollments: number;
      completionRate: number;
    };
    recentAuditLogs: AuditLogEntry[];
  }>('/api/dashboard');
}

// ─── Existing API route hooks ──────────────────────────────────────────────

/** Fetch compliance metrics with optional jurisdiction filter */
export function useComplianceMetrics(jurisdiction?: string) {
  const params = new URLSearchParams();
  if (jurisdiction) params.set('jurisdiction', jurisdiction);
  const query = params.toString();
  return useApiFetch<{
    totalAlerts: number;
    openAlerts: number;
    overdueReviews: number;
    sanctionsHits: number;
    falsePositiveRate: number;
    activeExceptions: number;
    pendingInspections: number;
    complianceScore: number;
    jurisdiction: string;
    lastUpdated: string;
    kriMetrics: Array<{
      name: string;
      value: number;
      target: number;
      status: string;
    }>;
    auditTrailHash: string;
  }>(`/api/compliance${query ? `?${query}` : ''}`);
}

/** Fetch AML alerts with optional jurisdiction / status filters */
export function useAMLAlerts(filters?: {
  jurisdiction?: string;
  status?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.jurisdiction) params.set('jurisdiction', filters.jurisdiction);
  if (filters?.status) params.set('status', filters.status);
  const query = params.toString();
  return useApiFetch<AMLAlertCase[]>(`/api/aml${query ? `?${query}` : ''}`);
}

/** Fetch regulatory circulars with optional regulator filter */
export function useRegulatoryCirculars(regulator?: string) {
  const params = new URLSearchParams();
  if (regulator) params.set('regulator', regulator);
  const query = params.toString();
  return useApiFetch<RegulatoryCircular[]>(`/api/regulatory${query ? `?${query}` : ''}`);
}

/** Fetch evidence items with optional inspectionId filter */
export function useEvidence(inspectionId?: string) {
  const params = new URLSearchParams();
  if (inspectionId) params.set('inspectionId', inspectionId);
  const query = params.toString();
  return useApiFetch<EvidenceItem[]>(`/api/evidence${query ? `?${query}` : ''}`);
}

/** Fetch claims with optional persona / jurisdiction filters */
export function useClaims(filters?: {
  persona?: string;
  jurisdiction?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.persona) params.set('persona', filters.persona);
  if (filters?.jurisdiction) params.set('jurisdiction', filters.jurisdiction);
  const query = params.toString();
  return useApiFetch<ClaimCase[]>(`/api/claims${query ? `?${query}` : ''}`);
}

// ─── Phase 3 API Hooks ────────────────────────────────────────────────────

/** Fetch adverse media sessions with optional filters */
export function useAdverseMediaSessions(filters?: {
  subjectType?: string;
  decision?: string;
  search?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.subjectType) params.set('subjectType', filters.subjectType);
  if (filters?.decision) params.set('decision', filters.decision);
  if (filters?.search) params.set('search', filters.search);
  const query = params.toString();
  return useApiFetch<AdverseMediaSessionItem[]>(`/api/adverse-media${query ? `?${query}` : ''}`);
}

/** Fetch corporate KYC applications with optional filters */
export function useCorporateKYC(filters?: {
  status?: string;
  riskRating?: string;
  search?: string;
}) {
  const params = new URLSearchParams();
  params.set('type', 'corporate');
  if (filters?.status) params.set('status', filters.status);
  if (filters?.riskRating) params.set('riskRating', filters.riskRating);
  if (filters?.search) params.set('search', filters.search);
  const query = params.toString();
  return useApiFetch<CorporateKYCItem[]>(`/api/kyc?${query}`);
}

/** Fetch individual KYC profiles with optional filters */
export function useIndividualKYC(filters?: {
  status?: string;
  riskRating?: string;
  isPep?: string;
  search?: string;
}) {
  const params = new URLSearchParams();
  params.set('type', 'individual');
  if (filters?.status) params.set('status', filters.status);
  if (filters?.riskRating) params.set('riskRating', filters.riskRating);
  if (filters?.isPep) params.set('isPep', filters.isPep);
  if (filters?.search) params.set('search', filters.search);
  const query = params.toString();
  return useApiFetch<IndividualKYCItem[]>(`/api/kyc?${query}`);
}

/** Fetch goAML filings with optional filters */
export function useGoAMLFilings(filters?: {
  reportType?: string;
  filingStatus?: string;
  search?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.reportType) params.set('reportType', filters.reportType);
  if (filters?.filingStatus) params.set('filingStatus', filters.filingStatus);
  if (filters?.search) params.set('search', filters.search);
  const query = params.toString();
  return useApiFetch<GoAMLFilingItem[]>(`/api/goaml${query ? `?${query}` : ''}`);
}

/** Fetch maker-checker logs with optional status filter */
export function useMakerCheckerLogs(filters?: {
  status?: string;
  operationType?: string;
  entityType?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.operationType) params.set('operationType', filters.operationType);
  if (filters?.entityType) params.set('entityType', filters.entityType);
  const query = params.toString();
  return useApiFetch<MakerCheckerLogItem[]>(`/api/maker-checker${query ? `?${query}` : ''}`);
}

// ─── Phase 4 API Hooks ────────────────────────────────────────────────────

/** Fetch quarterly reports with optional quarter / status filters */
export function useQuarterlyReports(filters?: {
  quarter?: string;
  status?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.quarter) params.set('quarter', filters.quarter);
  if (filters?.status) params.set('status', filters.status);
  const query = params.toString();
  return useApiFetch<QuarterlyReportItem[]>(`/api/quarterly-reporting${query ? `?${query}` : ''}`);
}

/** Fetch insurance records with optional status filter */
export function useInsuranceRecords(filters?: {
  status?: string;
}) {
  const params = new URLSearchParams();
  params.set('type', 'records');
  if (filters?.status) params.set('status', filters.status);
  const query = params.toString();
  return useApiFetch<InsuranceRecordItem[]>(`/api/quarterly-reporting?${query}`);
}

/** Fetch AI chat sessions */
export function useAIChatSessions() {
  return useApiFetch<AIChatSessionItem[]>('/api/ai/chat');
}

/** Fetch AI chat messages for a session */
export function useAIChatMessages(sessionId: string) {
  return useApiFetch<AIChatMessageItem[]>(`/api/ai/chat?sessionId=${sessionId}`);
}

/** Fetch sanctions exceptions with sunset clause tracking */
export function useSanctionsExceptions(status?: string) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const query = params.toString();
  return useApiFetch<SanctionsException[]>(`/api/sanctions-exceptions${query ? `?${query}` : ''}`);
}
