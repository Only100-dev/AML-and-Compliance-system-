/**
 * Intelligence Engine — Shared TypeScript Types
 * Type definitions for the AI-Powered GCC Regulatory Intelligence Engine.
 */

// ─── Intelligence Item ──────────────────────────────────────────────────────

export interface IntelligenceItemData {
  id: string;
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl?: string | null;
  category: string;
  riskScore: number;
  riskLevel: string;
  credibility: string;
  jurisdictionId: string;
  regulator?: string | null;
  publishedDate?: string | null;
  aiSummary?: string | null;
  aiVerified: boolean;
  aiVerificationNotes?: string | null;
  sourceLineage?: string | null;
  chainOfThought?: string | null;
  tags?: string | null;
  status: string;
  assignedToId?: string | null;
  assignedToName?: string | null;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  entities?: IntelligenceEntityData[];
  policyMappings?: IntelligencePolicyMappingData[];
  watchlistEntries?: WatchlistItemData[];
  actions?: IntelligenceActionData[];
}

export interface IntelligenceEntityData {
  id: string;
  itemId: string;
  name: string;
  type: string;
  role?: string | null;
  riskContribution: number;
  metadata?: string | null;
  createdAt: string;
}

export interface IntelligencePolicyMappingData {
  id: string;
  itemId: string;
  policyId?: string | null;
  policyNumber?: string | null;
  coverageStatus: string;
  impactAssessment?: string | null;
  remediationAction?: string | null;
  owner?: string | null;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Trend Signal ───────────────────────────────────────────────────────────

export interface TrendSignalData {
  id: string;
  title: string;
  description: string;
  trendType: string;
  severity: string;
  confidence: number;
  jurisdictions?: string | null;
  sources?: string | null;
  chainOfThought?: string | null;
  aiModel: string;
  verifiedBy?: string | null;
  verificationStatus: string;
  validFrom: string;
  validTo?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Saved Search ───────────────────────────────────────────────────────────

export interface SavedSearchData {
  id: string;
  userId: string;
  name: string;
  query: string;
  filters?: string | null;
  resultCount: number;
  lastRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Alert Rule ─────────────────────────────────────────────────────────────

export interface AlertRuleData {
  id: string;
  userId: string;
  name: string;
  query: string;
  filters?: string | null;
  frequency: string;
  isActive: boolean;
  lastTriggered?: string | null;
  triggerCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Watchlist ──────────────────────────────────────────────────────────────

export interface WatchlistItemData {
  id: string;
  userId: string;
  itemType: string;
  itemId: string;
  notes?: string | null;
  pinnedAt: string;
  intelligenceItem?: IntelligenceItemData | null;
  trendSignal?: TrendSignalData | null;
}

// ─── Intelligence Action ────────────────────────────────────────────────────

export interface IntelligenceActionData {
  id: string;
  itemId: string;
  actionType: string;
  assignedToId?: string | null;
  assignedToName?: string | null;
  assignedBy: string;
  assignedByRole: string;
  statusFrom?: string | null;
  statusTo?: string | null;
  notes?: string | null;
  dueDate?: string | null;
  policyMappingId?: string | null;
  makerCheckerId?: string | null;
  aiImpactSummary?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

// ─── Agent ──────────────────────────────────────────────────────────────────

export interface AgentConfigData {
  id: string;
  isScannerActive: boolean;
  scanIntervalMinutes: number;
  confidenceThreshold: number;
  riskThreshold: number;
  maxItemsPerScan: number;
  enabledJurisdictions?: string | null;
  enabledSources?: string | null;
  updatedBy?: string | null;
  updatedAt: string;
}

export interface AgentScanLogData {
  id: string;
  scanType: string;
  jurisdictionId?: string | null;
  topic?: string | null;
  sourcesQueried?: string | null;
  sourcesIgnored?: string | null;
  itemsFound: number;
  itemsIngested: number;
  trendSignalsGenerated: number;
  confidenceThreshold: number;
  riskThreshold: number;
  status: string;
  duration?: number | null;
  error?: string | null;
  triggeredBy: string;
  aiModel: string;
  startedAt: string;
  completedAt?: string | null;
}

// ─── AI Suggestions ─────────────────────────────────────────────────────────

export interface AlertSuggestion {
  id: string;
  name: string;
  query: string;
  filters?: Record<string, string> | null;
  frequency: string;
  reasoning: string;
}

// ─── Export ─────────────────────────────────────────────────────────────────

export interface IntelligenceExportData {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  exportType: string;
  exportScope: string;
  recordCount: number;
  filters?: string | null;
  jurisdiction?: string | null;
  fileName?: string | null;
  createdAt: string;
}

// ─── Search Response ────────────────────────────────────────────────────────

export interface IntelligenceSearchResponse {
  success: boolean;
  data: {
    items: IntelligenceItemData[];
    total: number;
    facets: IntelligenceFacets;
    page: number;
    limit: number;
  };
}

export interface IntelligenceFacets {
  categories: Record<string, number>;
  riskLevels: Record<string, number>;
  credibilityLevels: Record<string, number>;
  statuses: Record<string, number>;
  jurisdictions: Record<string, number>;
}

// ─── Agent Status ───────────────────────────────────────────────────────────

export interface AgentStatusResponse {
  success: boolean;
  data: {
    config: AgentConfigData;
    recentScans: AgentScanLogData[];
    stats: {
      totalScans: number;
      completedScans: number;
      failedScans: number;
      lastScanAt: string | null;
    };
  };
}

// ─── Type Aliases (used by UI components) ───────────────────────────────────

export type IntelligenceItemType = IntelligenceItemData;
export type TrendSignalItem = TrendSignalData;
export type AlertRuleItem = AlertRuleData;
export type WatchlistEntry = WatchlistItemData;
export type AgentScanLog = AgentScanLogData;
export type AgentConfig = AgentConfigData;

export interface IntelligenceFilterState {
  jurisdictions: string[];
  categories: string[];
  riskLevels: string[];
  credibility: string[];
  statuses: string[];
  dateFrom: string;
  dateTo: string;
  searchQuery: string;
}

export interface IntelligenceStatsResponse {
  totalItems: number;
  highRiskItems: number;
  newToday: number;
  activeTrends: number;
}
