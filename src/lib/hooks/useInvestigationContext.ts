'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AIRationale {
  summary: string;
  redFlags: string[];
  riskFactors: Array<{ factor: string; weight: number; source: string }>;
  confidence: number;
}

export interface InvestigationAlert {
  id: string;
  caseId: string;
  riskScore: number;
  riskLevel: string;
  alertType: string;
  description: string;
  aiFlags: string[];
  goAMLDraft: string | null;
  status: string;
  assignedTo: string | null;
  createdBy: string | null;
  approvedBy: string | null;
  jurisdiction: string;
  amount: number;
  policyNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvestigationContext {
  alert: InvestigationAlert;
  customerProfile: Record<string, unknown> | null;
  uboTree: unknown | null;
  transactions: Array<Record<string, unknown>>;
  adverseMedia: Array<Record<string, unknown>>;
  goamlFilings: Array<Record<string, unknown>>;
  sarCase: Record<string, unknown> | null;
  complianceCase: Record<string, unknown> | null;
  sanctionsScreenings: Array<Record<string, unknown>>;
  aiRationale: AIRationale;
}

// ─── Query Key ──────────────────────────────────────────────────────────────

export const investigationKeys = {
  context: (alertId: string) => ['investigation-context', alertId] as const,
  aiSummary: (alertId: string) => ['ai-summary', alertId] as const,
};

// ─── Hook: useInvestigationContext ───────────────────────────────────────────

/**
 * Fetches full investigation context for a given alertId via a single,
 * optimized React Query hook to prevent loading lag in the War Room.
 */
export function useInvestigationContext(alertId: string | null) {
  const result = useQuery({
    queryKey: investigationKeys.context(alertId ?? ''),
    queryFn: async (): Promise<InvestigationContext> => {
      const res = await fetch(`/api/investigation/context?alertId=${encodeURIComponent(alertId!)}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      if (json.success) return json.data as InvestigationContext;
      throw new Error(json.error || 'Failed to fetch investigation context');
    },
    enabled: !!alertId,
    staleTime: 30_000, // Keep fresh for 30s during active investigation
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  return {
    data: result.data ?? null,
    isLoading: result.isLoading,
    error: result.error ?? null,
    refetch: result.refetch,
  };
}

// ─── Hook: useInvestigationAction ───────────────────────────────────────────

/**
 * Mutation hook for executing investigation actions (dismiss, escalate, file_sar).
 * Invalidates the relevant query caches on success.
 */
export function useInvestigationAction() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: {
      alertId: string;
      action: 'dismiss' | 'escalate' | 'file_sar';
      justification: string;
      userId: string;
      userName: string;
    }) => {
      const res = await fetch('/api/alerts/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      if (json.success) return json.data;
      throw new Error(json.error || 'Action failed');
    },
    onSuccess: (_data, variables) => {
      // Invalidate investigation context and AML alerts
      queryClient.invalidateQueries({ queryKey: investigationKeys.context(variables.alertId) });
      queryClient.invalidateQueries({ queryKey: ['aml-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['maker-checker'] });
      queryClient.invalidateQueries({ queryKey: ['compliance'] });
    },
  });

  return {
    mutate: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}

// ─── Hook: useAISummary ─────────────────────────────────────────────────────

/**
 * Mutation hook for generating AI summaries for maker-checker queue items.
 */
export function useAISummary() {
  const mutation = useMutation({
    mutationFn: async (params: {
      alertId: string;
      operationType: string;
      payloadSnapshot: string;
    }) => {
      const res = await fetch('/api/investigation/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      if (json.success) return json.data as { bullets: string[] };
      throw new Error(json.error || 'AI summary generation failed');
    },
  });

  return {
    mutate: mutation.mutateAsync,
    isPending: mutation.isPending,
    data: mutation.data as { bullets: string[] } | undefined,
    error: mutation.error?.message ?? null,
  };
}
