import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeId } from './themes';
import type {
  Jurisdiction, UserRole,
  RegulationItem, LaborLawItem, LegalCaseItem,
  TrainingCourseItem, TrainingEnrollmentItem,
  PolicyItem, ComplianceAuditItem, AuditLogEntry,
  KRICard, ComplianceMetrics, AMLAlertCase,
  SanctionsException, EvidenceItem, ClaimCase,
  RegulatoryCircular,
  AdverseMediaSessionItem, CorporateKYCItem, IndividualKYCItem,
  GoAMLFilingItem, MakerCheckerLogItem,
  QuarterlyReportItem, InsuranceRecordItem,
  AIChatSessionItem, AIChatMessageItem,
} from './types';

// ─── API data cache shape ──────────────────────────────────────────────────

interface ApiDataCache<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}

interface ApiStore {
  // Dashboard
  dashboardMetrics: ApiDataCache<{
    kriMetrics: KRICard[];
    complianceMetrics: ComplianceMetrics;
    recentAuditLogs: AuditLogEntry[];
  }>;
  setDashboardMetrics: (cache: ApiDataCache<{ kriMetrics: KRICard[]; complianceMetrics: ComplianceMetrics; recentAuditLogs: AuditLogEntry[]; }>) => void;

  // Regulations
  regulations: ApiDataCache<RegulationItem[]>;
  setRegulations: (cache: ApiDataCache<RegulationItem[]>) => void;

  // Labor compliance
  laborCompliance: ApiDataCache<LaborLawItem[]>;
  setLaborCompliance: (cache: ApiDataCache<LaborLawItem[]>) => void;

  // Legal cases
  legalCases: ApiDataCache<LegalCaseItem[]>;
  setLegalCases: (cache: ApiDataCache<LegalCaseItem[]>) => void;

  // Training courses
  trainingCourses: ApiDataCache<TrainingCourseItem[]>;
  setTrainingCourses: (cache: ApiDataCache<TrainingCourseItem[]>) => void;

  // Training enrollments
  trainingEnrollments: ApiDataCache<TrainingEnrollmentItem[]>;
  setTrainingEnrollments: (cache: ApiDataCache<TrainingEnrollmentItem[]>) => void;

  // Policies
  policies: ApiDataCache<PolicyItem[]>;
  setPolicies: (cache: ApiDataCache<PolicyItem[]>) => void;

  // Compliance audits
  audits: ApiDataCache<ComplianceAuditItem[]>;
  setAudits: (cache: ApiDataCache<ComplianceAuditItem[]>) => void;

  // AML alerts
  amlAlerts: ApiDataCache<AMLAlertCase[]>;
  setAmlAlerts: (cache: ApiDataCache<AMLAlertCase[]>) => void;

  // Sanctions exceptions
  sanctionsExceptions: ApiDataCache<SanctionsException[]>;
  setSanctionsExceptions: (cache: ApiDataCache<SanctionsException[]>) => void;

  // Evidence
  evidence: ApiDataCache<EvidenceItem[]>;
  setEvidence: (cache: ApiDataCache<EvidenceItem[]>) => void;

  // Claims
  claims: ApiDataCache<ClaimCase[]>;
  setClaims: (cache: ApiDataCache<ClaimCase[]>) => void;

  // Regulatory circulars
  regulatoryCirculars: ApiDataCache<RegulatoryCircular[]>;
  setRegulatoryCirculars: (cache: ApiDataCache<RegulatoryCircular[]>) => void;

  // Phase 3: Adverse media sessions
  adverseMediaSessions: ApiDataCache<AdverseMediaSessionItem[]>;
  setAdverseMediaSessions: (cache: ApiDataCache<AdverseMediaSessionItem[]>) => void;

  // Phase 3: Corporate KYC
  corporateKYC: ApiDataCache<CorporateKYCItem[]>;
  setCorporateKYC: (cache: ApiDataCache<CorporateKYCItem[]>) => void;

  // Phase 3: Individual KYC
  individualKYC: ApiDataCache<IndividualKYCItem[]>;
  setIndividualKYC: (cache: ApiDataCache<IndividualKYCItem[]>) => void;

  // Phase 3: goAML filings
  goamlFilings: ApiDataCache<GoAMLFilingItem[]>;
  setGoamlFilings: (cache: ApiDataCache<GoAMLFilingItem[]>) => void;

  // Phase 3: Maker-Checker logs
  makerCheckerLogs: ApiDataCache<MakerCheckerLogItem[]>;
  setMakerCheckerLogs: (cache: ApiDataCache<MakerCheckerLogItem[]>) => void;

  // Phase 4: Quarterly reports
  quarterlyReports: ApiDataCache<QuarterlyReportItem[]>;
  setQuarterlyReports: (cache: ApiDataCache<QuarterlyReportItem[]>) => void;

  // Phase 4: Insurance records
  insuranceRecords: ApiDataCache<InsuranceRecordItem[]>;
  setInsuranceRecords: (cache: ApiDataCache<InsuranceRecordItem[]>) => void;

  // Phase 4: AI chat sessions
  aiChatSessions: ApiDataCache<AIChatSessionItem[]>;
  setAiChatSessions: (cache: ApiDataCache<AIChatSessionItem[]>) => void;

  // Phase 4: AI chat messages
  aiChatMessages: ApiDataCache<AIChatMessageItem[]>;
  setAiChatMessages: (cache: ApiDataCache<AIChatMessageItem[]>) => void;

  // Intelligence Engine: search results
  intelligenceItems: ApiDataCache<any[]>;
  setIntelligenceItems: (cache: ApiDataCache<any[]>) => void;

  // Intelligence Engine: trend signals
  trendSignals: ApiDataCache<any[]>;
  setTrendSignals: (cache: ApiDataCache<any[]>) => void;

  // Intelligence Engine: alert rules
  alertRules: ApiDataCache<any[]>;
  setAlertRules: (cache: ApiDataCache<any[]>) => void;

  // Intelligence Engine: watchlist
  watchlistItems: ApiDataCache<any[]>;
  setWatchlistItems: (cache: ApiDataCache<any[]>) => void;

  // Intelligence Engine: agent config
  agentConfig: ApiDataCache<any>;
  setAgentConfig: (cache: ApiDataCache<any>) => void;

  // Invalidate all cached data (e.g. on jurisdiction change)
  invalidateAll: () => void;
}

// ─── Main IC-OS Store ──────────────────────────────────────────────────────

interface ICOSStore {
  // Navigation
  activeSection: string;
  setActiveSection: (section: string) => void;

  // Jurisdiction
  jurisdiction: Jurisdiction;
  setJurisdiction: (j: Jurisdiction) => void;

  // Theme (Phase 5)
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;

  // User
  currentUser: {
    id: string;
    name: string;
    role: UserRole;
    email: string;
    avatar?: string;
  };

  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Claims portal
  activePersona: string;
  setActivePersona: (p: string) => void;

  // AML Kanban
  draggedAlertId: string | null;
  setDraggedAlertId: (id: string | null) => void;

  // Evidence upload
  isUploading: boolean;
  setIsUploading: (v: boolean) => void;

  // API data cache
  api: ApiStore;
}

// ─── Helper: empty cache slot ──────────────────────────────────────────────

function emptyCache<T>(): ApiDataCache<T> {
  return { data: null, loading: false, error: null, lastFetched: null };
}

// ─── Store ─────────────────────────────────────────────────────────────────

export const useICOSStore = create<ICOSStore>()(
  persist(
    (set, get) => ({
      activeSection: 'command-center',
      setActiveSection: (section) => set({ activeSection: section }),

      // ── FIX: setJurisdiction now invalidates API cache on switch ──
      jurisdiction: 'CBUAE',
      setJurisdiction: (j) => {
        const state = get();
        // Reset ALL API caches when jurisdiction changes to prevent stale data
        set({
          jurisdiction: j,
          api: {
            ...state.api,
            dashboardMetrics: emptyCache(),
            regulations: emptyCache(),
            laborCompliance: emptyCache(),
            legalCases: emptyCache(),
            trainingCourses: emptyCache(),
            trainingEnrollments: emptyCache(),
            policies: emptyCache(),
            audits: emptyCache(),
            amlAlerts: emptyCache(),
            sanctionsExceptions: emptyCache(),
            evidence: emptyCache(),
            claims: emptyCache(),
            regulatoryCirculars: emptyCache(),
            adverseMediaSessions: emptyCache(),
            corporateKYC: emptyCache(),
            individualKYC: emptyCache(),
            goamlFilings: emptyCache(),
            makerCheckerLogs: emptyCache(),
            quarterlyReports: emptyCache(),
            insuranceRecords: emptyCache(),
            aiChatSessions: emptyCache(),
            aiChatMessages: emptyCache(),
            intelligenceItems: emptyCache(),
            trendSignals: emptyCache(),
            alertRules: emptyCache(),
            watchlistItems: emptyCache(),
            agentConfig: emptyCache(),
          },
        });
      },

      // Theme (Phase 5)
      theme: 'convertease' as ThemeId,
      setTheme: (theme: ThemeId) => {
        set({ theme });
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', theme);
        }
      },

      currentUser: {
        id: 'u1',
        name: 'Ahmed Al-Rashid',
        role: 'mlro',
        email: 'ahmed.alrashid@icos.ae',
      },

      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      activePersona: 'claimant',
      setActivePersona: (p) => set({ activePersona: p }),

      draggedAlertId: null,
      setDraggedAlertId: (id) => set({ draggedAlertId: id }),

      isUploading: false,
      setIsUploading: (v) => set({ isUploading: v }),

      // ── API data cache ─────────────────────────────────────────────────────
      api: {
        dashboardMetrics: emptyCache(),
        setDashboardMetrics: (cache) =>
          set((s) => ({ api: { ...s.api, dashboardMetrics: cache } })),
        regulations: emptyCache(),
        setRegulations: (cache) =>
          set((s) => ({ api: { ...s.api, regulations: cache } })),
        laborCompliance: emptyCache(),
        setLaborCompliance: (cache) =>
          set((s) => ({ api: { ...s.api, laborCompliance: cache } })),
        legalCases: emptyCache(),
        setLegalCases: (cache) =>
          set((s) => ({ api: { ...s.api, legalCases: cache } })),
        trainingCourses: emptyCache(),
        setTrainingCourses: (cache) =>
          set((s) => ({ api: { ...s.api, trainingCourses: cache } })),
        trainingEnrollments: emptyCache(),
        setTrainingEnrollments: (cache) =>
          set((s) => ({ api: { ...s.api, trainingEnrollments: cache } })),
        policies: emptyCache(),
        setPolicies: (cache) =>
          set((s) => ({ api: { ...s.api, policies: cache } })),
        audits: emptyCache(),
        setAudits: (cache) =>
          set((s) => ({ api: { ...s.api, audits: cache } })),
        amlAlerts: emptyCache(),
        setAmlAlerts: (cache) =>
          set((s) => ({ api: { ...s.api, amlAlerts: cache } })),
        sanctionsExceptions: emptyCache(),
        setSanctionsExceptions: (cache) =>
          set((s) => ({ api: { ...s.api, sanctionsExceptions: cache } })),
        evidence: emptyCache(),
        setEvidence: (cache) =>
          set((s) => ({ api: { ...s.api, evidence: cache } })),
        claims: emptyCache(),
        setClaims: (cache) =>
          set((s) => ({ api: { ...s.api, claims: cache } })),
        regulatoryCirculars: emptyCache(),
        setRegulatoryCirculars: (cache) =>
          set((s) => ({ api: { ...s.api, regulatoryCirculars: cache } })),
        adverseMediaSessions: emptyCache(),
        setAdverseMediaSessions: (cache) =>
          set((s) => ({ api: { ...s.api, adverseMediaSessions: cache } })),
        corporateKYC: emptyCache(),
        setCorporateKYC: (cache) =>
          set((s) => ({ api: { ...s.api, corporateKYC: cache } })),
        individualKYC: emptyCache(),
        setIndividualKYC: (cache) =>
          set((s) => ({ api: { ...s.api, individualKYC: cache } })),
        goamlFilings: emptyCache(),
        setGoamlFilings: (cache) =>
          set((s) => ({ api: { ...s.api, goamlFilings: cache } })),
        makerCheckerLogs: emptyCache(),
        setMakerCheckerLogs: (cache) =>
          set((s) => ({ api: { ...s.api, makerCheckerLogs: cache } })),
        quarterlyReports: emptyCache(),
        setQuarterlyReports: (cache) =>
          set((s) => ({ api: { ...s.api, quarterlyReports: cache } })),
        insuranceRecords: emptyCache(),
        setInsuranceRecords: (cache) =>
          set((s) => ({ api: { ...s.api, insuranceRecords: cache } })),
        aiChatSessions: emptyCache(),
        setAiChatSessions: (cache) =>
          set((s) => ({ api: { ...s.api, aiChatSessions: cache } })),
        aiChatMessages: emptyCache(),
        setAiChatMessages: (cache) =>
          set((s) => ({ api: { ...s.api, aiChatMessages: cache } })),
        // Intelligence Engine cache slots
        intelligenceItems: emptyCache(),
        setIntelligenceItems: (cache) =>
          set((s) => ({ api: { ...s.api, intelligenceItems: cache } })),
        trendSignals: emptyCache(),
        setTrendSignals: (cache) =>
          set((s) => ({ api: { ...s.api, trendSignals: cache } })),
        alertRules: emptyCache(),
        setAlertRules: (cache) =>
          set((s) => ({ api: { ...s.api, alertRules: cache } })),
        watchlistItems: emptyCache(),
        setWatchlistItems: (cache) =>
          set((s) => ({ api: { ...s.api, watchlistItems: cache } })),
        agentConfig: emptyCache(),
        setAgentConfig: (cache) =>
          set((s) => ({ api: { ...s.api, agentConfig: cache } })),
        invalidateAll: () =>
          set((s) => ({
            api: {
              ...s.api,
              dashboardMetrics: emptyCache(),
              regulations: emptyCache(),
              laborCompliance: emptyCache(),
              legalCases: emptyCache(),
              trainingCourses: emptyCache(),
              trainingEnrollments: emptyCache(),
              policies: emptyCache(),
              audits: emptyCache(),
              amlAlerts: emptyCache(),
              sanctionsExceptions: emptyCache(),
              evidence: emptyCache(),
              claims: emptyCache(),
              regulatoryCirculars: emptyCache(),
              adverseMediaSessions: emptyCache(),
              corporateKYC: emptyCache(),
              individualKYC: emptyCache(),
              goamlFilings: emptyCache(),
              makerCheckerLogs: emptyCache(),
              quarterlyReports: emptyCache(),
              insuranceRecords: emptyCache(),
              aiChatSessions: emptyCache(),
              aiChatMessages: emptyCache(),
              intelligenceItems: emptyCache(),
              trendSignals: emptyCache(),
              alertRules: emptyCache(),
              watchlistItems: emptyCache(),
              agentConfig: emptyCache(),
            },
          })),
      },
    }),
    {
      name: 'icos-storage',
      // ── FIX: Persist jurisdiction alongside theme so it survives reloads ──
      partialize: (state) => ({
        theme: state.theme,
        jurisdiction: state.jurisdiction,
      }) as unknown as Partial<ICOSStore>,
    }
  )
);
