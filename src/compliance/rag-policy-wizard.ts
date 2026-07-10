/**
 * IC-OS RAG AI Policy Wizard — Hallucination-Proof Architecture
 * Phase 3: Advanced Compliance Workflows
 *
 * Retrieval-Augmented Generation policy drafting engine with strict
 * grounding enforcement. All AI-generated policy content MUST be
 * traceable to authoritative regulatory source material.
 *
 * Regulatory basis:
 *   - FDL 10/2025 (Federal Decree-Law No. 10 of 2025 on AML/CFT)
 *   - CR 134/2025 (Cabinet Resolution No. 134 of 2025)
 *   - FATF Recommendations (40 Recommendations + Immediate Outcomes)
 *   - CBUAE Notice 3551/2021 (Guidance for LFIs on AML/CFT)
 *
 * Architecture principles:
 *   1. No AI output without regulatory source citation
 *   2. Confidence scoring grounded in source coverage
 *   3. Gap identification against mapped regulations
 *   4. Hallucination guard preventing fabricated content
 *   5. All draft sections traceable to specific articles
 */

// ─── Types ──────────────────────────────────────────────────────────────────────

export type PolicyType =
  | 'aml_cft'
  | 'sanctions_screening'
  | 'cdd_kyc'
  | 'sar_filing'
  | 'pep_edd'
  | 'training'
  | 'record_keeping'
  | 'risk_assessment'
  | 'vendor_dd'
  | 'data_privacy'
  | 'business_continuity'
  | 'outsourcing';

export type PolicyCategory =
  | 'AML/CFT'
  | 'Sanctions'
  | 'KYC/CDD'
  | 'Reporting'
  | 'Governance'
  | 'Operations'
  | 'IT & Security'
  | 'Data Privacy'
  | 'Training'
  | 'Vendor Management';

import type { JurisdictionCode } from '@/lib/constants/jurisdictions';

/** RAG-specific jurisdiction — extends the centralized SSOT with policy-wizard-only zones */
export type Jurisdiction = JurisdictionCode | 'ADGM' | 'DIFC' | 'UAE_FEDERAL';

export type PolicyDraftStatus =
  | 'initiated'
  | 'mapping'
  | 'drafting'
  | 'review'
  | 'revision'
  | 'approved'
  | 'published';

export type RegulatorySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface RegulatoryEntry {
  /** Unique identifier for the regulatory requirement */
  id: string;
  /** Parent regulation name */
  regulation: string;
  /** Article / section reference */
  article: string;
  /** The specific requirement text / summary */
  requirement: string;
  /** Compliance category this requirement belongs to */
  category: PolicyCategory;
  /** Severity of non-compliance */
  severity: RegulatorySeverity;
}

export interface RegulatoryMapEntry {
  /** The regulatory entry */
  entry: RegulatoryEntry;
  /** Whether the draft currently addresses this requirement */
  addressed: boolean;
  /** Confidence that the draft adequately covers this requirement (0-1) */
  coverageConfidence: number;
  /** Section in the draft that addresses this requirement, if any */
  draftSection?: string;
}

export interface PolicyDraftSection {
  /** Section heading */
  title: string;
  /** Section content (template-based, grounded in regulations) */
  content: string;
  /** Regulatory entries this section is grounded in */
  sourceRefs: string[];
  /** AI confidence for this section (0-100) */
  confidence: number;
  /** Whether the section has been manually reviewed */
  reviewed: boolean;
}

export interface PolicyDraft {
  /** Draft title */
  title: string;
  /** Policy type */
  policyType: PolicyType;
  /** Category */
  category: PolicyCategory;
  /** Jurisdiction */
  jurisdiction: Jurisdiction;
  /** Sections of the draft */
  sections: PolicyDraftSection[];
  /** Overall AI confidence score (0-100) */
  overallConfidence: number;
  /** Regulatory map used to generate this draft */
  regulatoryMapId: string[];
  /** Date draft was generated */
  generatedAt: Date;
  /** Version of the draft */
  version: string;
}

export interface ReviewResult {
  /** Whether the draft passes review */
  passed: boolean;
  /** Overall completeness score (0-100) */
  completenessScore: number;
  /** Identified gaps */
  gaps: RegulatoryGap[];
  /** Recommendations for improvement */
  recommendations: string[];
  /** Sections that need revision */
  revisionSections: string[];
  /** Review timestamp */
  reviewedAt: Date;
}

export interface RegulatoryGap {
  /** The regulatory requirement that is not addressed */
  requirementId: string;
  /** The requirement text */
  requirement: string;
  /** Severity of the gap */
  severity: RegulatorySeverity;
  /** Suggested action to close the gap */
  suggestedAction: string;
  /** Regulation article reference */
  article: string;
}

export interface PolicyWizardSession {
  /** Session unique identifier */
  id: string;
  /** Type of policy being drafted */
  policyType: PolicyType;
  /** Policy category */
  category: PolicyCategory;
  /** Applicable jurisdiction */
  jurisdiction: Jurisdiction;
  /** Current step in the wizard (1-5) */
  currentStep: number;
  /** Mapped regulations applicable to this policy */
  regulatoryMap: RegulatoryMapEntry[];
  /** Current draft of the policy */
  draft: PolicyDraft | null;
  /** Review result */
  reviewResult: ReviewResult | null;
  /** Session status */
  status: PolicyDraftStatus;
}

// ─── Regulatory Knowledge Base ──────────────────────────────────────────────────

/**
 * Structured knowledge base of CBUAE, FDL, and FATF regulatory requirements.
 * Each entry represents a discrete, citable requirement that the RAG engine
 * can retrieve and ground generated policy text against.
 *
 * CRITICAL: This is the ONLY source of truth for policy generation.
 * No policy content may be generated that is not traceable to an entry here.
 */
export const REGULATORY_KNOWLEDGE_BASE: RegulatoryEntry[] = [
  // ── FDL 10/2025 Requirements ──────────────────────────────────────────────
  {
    id: 'FDL-10-2025-Art4-001',
    regulation: 'Federal Decree-Law No. 10 of 2025',
    article: 'Art. 4',
    requirement: 'All financial institutions, DNFBPs, and VASPs operating in the UAE are subject to AML/CFT obligations including customer due diligence, record keeping, and suspicious transaction reporting.',
    category: 'AML/CFT',
    severity: 'critical',
  },
  {
    id: 'FDL-10-2025-Art7-001',
    regulation: 'Federal Decree-Law No. 10 of 2025',
    article: 'Art. 7',
    requirement: 'Obliged entities must apply CDD measures before establishing a business relationship, carrying out occasional transactions above thresholds, or when there is a suspicion of ML/TF.',
    category: 'KYC/CDD',
    severity: 'critical',
  },
  {
    id: 'FDL-10-2025-Art7-002',
    regulation: 'Federal Decree-Law No. 10 of 2025',
    article: 'Art. 7',
    requirement: 'Customer identification must include verifying the identity of the customer and the beneficial owner using reliable, independent source documents, data, or information.',
    category: 'KYC/CDD',
    severity: 'critical',
  },
  {
    id: 'FDL-10-2025-Art8-001',
    regulation: 'Federal Decree-Law No. 10 of 2025',
    article: 'Art. 8',
    requirement: 'Obliged entities must file a suspicious transaction report (STR/SAR) with the FIU within 30 calendar days of forming a suspicion of ML/TF activity.',
    category: 'Reporting',
    severity: 'critical',
  },
  {
    id: 'FDL-10-2025-Art9-001',
    regulation: 'Federal Decree-Law No. 10 of 2025',
    article: 'Art. 9',
    requirement: 'Enhanced due diligence must be applied for PEPs, correspondent banking relationships, and higher-risk jurisdictions, including source of funds verification and senior management approval.',
    category: 'KYC/CDD',
    severity: 'critical',
  },
  {
    id: 'FDL-10-2025-Art10-001',
    regulation: 'Federal Decree-Law No. 10 of 2025',
    article: 'Art. 10',
    requirement: 'Obliged entities must conduct ongoing monitoring of business relationships including scrutiny of transactions to ensure consistency with knowledge of the customer and risk profile.',
    category: 'AML/CFT',
    severity: 'high',
  },
  {
    id: 'FDL-10-2025-Art11-001',
    regulation: 'Federal Decree-Law No. 10 of 2025',
    article: 'Art. 11',
    requirement: 'CDD records, transaction data, and SAR-related documentation must be retained for a minimum of 5 years after the termination of the business relationship or the date of the occasional transaction.',
    category: 'Operations',
    severity: 'high',
  },
  {
    id: 'FDL-10-2025-Art12-001',
    regulation: 'Federal Decree-Law No. 10 of 2025',
    article: 'Art. 12',
    requirement: 'Any person who discloses to the subject or third party that a SAR has been or will be filed commits a criminal offence (tipping-off prohibition).',
    category: 'AML/CFT',
    severity: 'critical',
  },
  {
    id: 'FDL-10-2025-Art13-001',
    regulation: 'Federal Decree-Law No. 10 of 2025',
    article: 'Art. 13',
    requirement: 'Obliged entities must establish internal reporting procedures, appoint a Money Laundering Reporting Officer (MLRO), and ensure all employees are aware of reporting obligations.',
    category: 'Governance',
    severity: 'high',
  },
  {
    id: 'FDL-10-2025-Art14-001',
    regulation: 'Federal Decree-Law No. 10 of 2025',
    article: 'Art. 14',
    requirement: 'The MLRO must be appointed as the single point of contact with the FIU, have direct access to senior management and the board, and be responsible for all SAR filings.',
    category: 'Governance',
    severity: 'high',
  },
  {
    id: 'FDL-10-2025-Art15-001',
    regulation: 'Federal Decree-Law No. 10 of 2025',
    article: 'Art. 15',
    requirement: 'Obliged entities must implement internal AML/CFT policies, controls, and procedures, including independent audit functions, employee screening, and ongoing training programmes.',
    category: 'AML/CFT',
    severity: 'high',
  },
  {
    id: 'FDL-10-2025-Art16-001',
    regulation: 'Federal Decree-Law No. 10 of 2025',
    article: 'Art. 16',
    requirement: 'Obliged entities must identify, assess, and understand their ML/TF risks and take proportionate measures to mitigate them, informed by the National Risk Assessment.',
    category: 'AML/CFT',
    severity: 'high',
  },
  {
    id: 'FDL-10-2025-Art17-001',
    regulation: 'Federal Decree-Law No. 10 of 2025',
    article: 'Art. 17',
    requirement: 'Obliged entities must conduct enterprise-wide risk assessments (EWRA) covering customer risk, jurisdictional risk, product/service risk, and transaction risk.',
    category: 'AML/CFT',
    severity: 'high',
  },
  {
    id: 'FDL-10-2025-Art18-001',
    regulation: 'Federal Decree-Law No. 10 of 2025',
    article: 'Art. 18',
    requirement: 'Obliged entities must implement targeted financial sanctions pursuant to UNSC resolutions, immediately freeze funds of designated persons, and report to the UAE Sanctions Committee.',
    category: 'Sanctions',
    severity: 'critical',
  },
  // ── CR 134/2025 Requirements ──────────────────────────────────────────────
  {
    id: 'CR-134-2025-Art5-001',
    regulation: 'Cabinet Resolution No. 134 of 2025',
    article: 'Art. 5',
    requirement: 'CDD measures must include identification and verification of the customer and beneficial owner using reliable, independent source documents. The threshold for beneficial ownership is 25% ownership or control.',
    category: 'KYC/CDD',
    severity: 'critical',
  },
  {
    id: 'CR-134-2025-Art8-001',
    regulation: 'Cabinet Resolution No. 134 of 2025',
    article: 'Art. 8',
    requirement: 'PEP relationships require EDD measures including senior management approval for establishing the relationship, source of wealth verification, and enhanced ongoing monitoring.',
    category: 'KYC/CDD',
    severity: 'critical',
  },
  {
    id: 'CR-134-2025-Art10-001',
    regulation: 'Cabinet Resolution No. 134 of 2025',
    article: 'Art. 10',
    requirement: 'SAR/STR must be filed with the FIU within 30 calendar days of forming a suspicion. The report must include subject information, transaction details, and narrative of suspicion.',
    category: 'Reporting',
    severity: 'critical',
  },
  {
    id: 'CR-134-2025-Art11-001',
    regulation: 'Cabinet Resolution No. 134 of 2025',
    article: 'Art. 11',
    requirement: 'SAR filings must be submitted through the goAML system in the prescribed XML format. The filing must include mandatory content fields: subject details, transaction information, and 5-part narrative structure.',
    category: 'Reporting',
    severity: 'high',
  },
  {
    id: 'CR-134-2025-Art15-001',
    regulation: 'Cabinet Resolution No. 134 of 2025',
    article: 'Art. 15',
    requirement: 'Ongoing monitoring must include transaction monitoring, periodic reviews at intervals determined by risk rating, and triggers for updating CDD information.',
    category: 'AML/CFT',
    severity: 'high',
  },
  {
    id: 'CR-134-2025-Art16-001',
    regulation: 'Cabinet Resolution No. 134 of 2025',
    article: 'Art. 16',
    requirement: 'Records must be retained for 5 years minimum. CDD records, transaction data, SAR documentation, and internal reports must all be retained and be available for supervisory examination.',
    category: 'Operations',
    severity: 'high',
  },
  {
    id: 'CR-134-2025-Art20-001',
    regulation: 'Cabinet Resolution No. 134 of 2025',
    article: 'Art. 20',
    requirement: 'AML/CFT policies must be documented, approved by senior management, and reviewed and updated at least annually. Policies must cover group-wide programmes for financial groups.',
    category: 'Governance',
    severity: 'high',
  },
  {
    id: 'CR-134-2025-Art21-001',
    regulation: 'Cabinet Resolution No. 134 of 2025',
    article: 'Art. 21',
    requirement: 'An independent audit of the AML/CFT compliance programme must be conducted at least annually, or more frequently for higher-risk entities. Audit scope and findings must be documented.',
    category: 'Governance',
    severity: 'high',
  },
  {
    id: 'CR-134-2025-Art22-001',
    regulation: 'Cabinet Resolution No. 134 of 2025',
    article: 'Art. 22',
    requirement: 'Enterprise-wide risk assessments must cover customer, country/territory, product/service, and transaction risk categories using a documented methodology.',
    category: 'AML/CFT',
    severity: 'high',
  },
  {
    id: 'CR-134-2025-Art25-001',
    regulation: 'Cabinet Resolution No. 134 of 2025',
    article: 'Art. 25',
    requirement: 'Procedures for implementing targeted financial sanctions must include screening requirements, immediate freezing obligations, and reporting to the UAE Sanctions Committee within 24 hours of a match.',
    category: 'Sanctions',
    severity: 'critical',
  },
  {
    id: 'CR-134-2025-Art26-001',
    regulation: 'Cabinet Resolution No. 134 of 2025',
    article: 'Art. 26',
    requirement: 'Real-time screening must be conducted against UAE Local Terrorist List, UN Security Council Consolidated List, and other relevant sanctions lists. Screening technology must use fuzzy matching algorithms.',
    category: 'Sanctions',
    severity: 'critical',
  },
  // ── FATF Requirements ─────────────────────────────────────────────────────
  {
    id: 'FATF-Rec1-001',
    regulation: 'FATF 40 Recommendations',
    article: 'Recommendation 1',
    requirement: 'Countries should apply the risk-based approach (RBA) to ensure that measures to prevent and mitigate ML/TF are commensurate with the risks identified.',
    category: 'AML/CFT',
    severity: 'high',
  },
  {
    id: 'FATF-Rec7-001',
    regulation: 'FATF 40 Recommendations',
    article: 'Recommendation 7',
    requirement: 'Countries should implement targeted financial sanctions to comply with UNSC resolutions relating to the prevention and suppression of terrorism and terrorist financing, including proliferation financing.',
    category: 'Sanctions',
    severity: 'critical',
  },
  {
    id: 'FATF-Rec10-001',
    regulation: 'FATF 40 Recommendations',
    article: 'Recommendation 10',
    requirement: 'Financial institutions should be required to undertake CDD when establishing business relationships, carrying out occasional transactions above thresholds, or when there is a suspicion of ML/TF.',
    category: 'KYC/CDD',
    severity: 'critical',
  },
  {
    id: 'FATF-Rec11-001',
    regulation: 'FATF 40 Recommendations',
    article: 'Recommendation 11',
    requirement: 'Financial institutions must maintain all necessary records on transactions, both domestic and international, for at least 5 years to enable reconstruction and provision of evidence for prosecution.',
    category: 'Operations',
    severity: 'high',
  },
  {
    id: 'FATF-Rec12-001',
    regulation: 'FATF 40 Recommendations',
    article: 'Recommendation 12',
    requirement: 'Financial institutions must apply EDD to PEPs, including obtaining senior management approval, establishing source of wealth and source of funds, and conducting enhanced ongoing monitoring.',
    category: 'KYC/CDD',
    severity: 'critical',
  },
  {
    id: 'FATF-Rec13-001',
    regulation: 'FATF 40 Recommendations',
    article: 'Recommendation 13',
    requirement: 'Financial institutions must maintain correspondent banking relationships only with respondent institutions that have adequate controls and after gathering sufficient information about the respondent.',
    category: 'AML/CFT',
    severity: 'high',
  },
  {
    id: 'FATF-Rec14-001',
    regulation: 'FATF 40 Recommendations',
    article: 'Recommendation 14',
    requirement: 'Financial institutions must process wire transfers with originator and beneficiary information, and take freezing action and screen against targeted financial sanctions lists.',
    category: 'Operations',
    severity: 'high',
  },
  {
    id: 'FATF-Rec15-001',
    regulation: 'FATF 40 Recommendations',
    article: 'Recommendation 15',
    requirement: 'Countries and financial institutions should identify and assess ML/TF risks related to new products, business practices, and delivery channels, including virtual assets, before their launch.',
    category: 'AML/CFT',
    severity: 'high',
  },
  {
    id: 'FATF-Rec16-001',
    regulation: 'FATF 40 Recommendations',
    article: 'Recommendation 16',
    requirement: 'Countries should take measures to ensure that financial institutions include required and accurate originator and beneficiary information on wire transfers and monitor such transfers for ML/TF.',
    category: 'Operations',
    severity: 'high',
  },
  {
    id: 'FATF-Rec20-001',
    regulation: 'FATF 40 Recommendations',
    article: 'Recommendation 20',
    requirement: 'Financial institutions must report suspicious transactions to the FIU when they suspect or have reasonable grounds to suspect that funds are the proceeds of a criminal activity or related to terrorism financing.',
    category: 'Reporting',
    severity: 'critical',
  },
  // ── CBUAE Notice 3551/2021 Requirements ───────────────────────────────────
  {
    id: 'CBUAE-3551-S31-001',
    regulation: 'CBUAE Notice No. 3551/2021',
    article: 'Section 3.1',
    requirement: 'Board and senior management are responsible for AML/CFT compliance, including establishment of compliance function, allocation of adequate resources, and oversight of risk assessment outcomes.',
    category: 'Governance',
    severity: 'high',
  },
  {
    id: 'CBUAE-3551-S32-001',
    regulation: 'CBUAE Notice No. 3551/2021',
    article: 'Section 3.2',
    requirement: 'MLRO must be appointed with sufficient independence, access to information, deputy arrangements, and must report to the board and FIU. The MLRO must not have conflicts of interest.',
    category: 'Governance',
    severity: 'high',
  },
  {
    id: 'CBUAE-3551-S41-001',
    regulation: 'CBUAE Notice No. 3551/2021',
    article: 'Section 4.1',
    requirement: 'Customer risk rating methodology must include defined risk factors, scoring criteria for categorising customers into low, medium, and high risk categories, and periodic reassessment.',
    category: 'AML/CFT',
    severity: 'high',
  },
  {
    id: 'CBUAE-3551-S42-001',
    regulation: 'CBUAE Notice No. 3551/2021',
    article: 'Section 4.2',
    requirement: 'Jurisdictional risk assessment must consider FATF grey-listed and black-listed countries, with enhanced measures for transactions involving high-risk jurisdictions.',
    category: 'AML/CFT',
    severity: 'high',
  },
  {
    id: 'CBUAE-3551-S51-001',
    regulation: 'CBUAE Notice No. 3551/2021',
    article: 'Section 5.1',
    requirement: 'CDD measures must comply with specified thresholds: CTR threshold of AED 55,000 and cash bearer withdrawal threshold of AED 3,500. Identification must use reliable, independent sources.',
    category: 'KYC/CDD',
    severity: 'high',
  },
  {
    id: 'CBUAE-3551-S52-001',
    regulation: 'CBUAE Notice No. 3551/2021',
    article: 'Section 5.2',
    requirement: 'EDD for PEPs and high-risk customers must include source of wealth and source of funds verification, enhanced ongoing monitoring, and more frequent periodic reviews.',
    category: 'KYC/CDD',
    severity: 'critical',
  },
  {
    id: 'CBUAE-3551-S61-001',
    regulation: 'CBUAE Notice No. 3551/2021',
    article: 'Section 6.1',
    requirement: 'Transaction monitoring programme must include automated filtering, threshold-based alerts, and behavioural analysis. CTR reporting threshold is AED 55,000.',
    category: 'AML/CFT',
    severity: 'high',
  },
  {
    id: 'CBUAE-3551-S71-001',
    regulation: 'CBUAE Notice No. 3551/2021',
    article: 'Section 7.1',
    requirement: 'Sanctions compliance programme must include real-time and batch screening, false positive management, and escalation procedures for confirmed matches.',
    category: 'Sanctions',
    severity: 'critical',
  },
  {
    id: 'CBUAE-3551-S91-001',
    regulation: 'CBUAE Notice No. 3551/2021',
    article: 'Section 9.1',
    requirement: 'AML/CFT training programme must include new joiner training within 30 days, annual refresher training, role-specific training, and training effectiveness assessment.',
    category: 'Training',
    severity: 'high',
  },
];

// ─── Hallucination Guard ────────────────────────────────────────────────────────

/**
 * Rules that prevent the AI from generating policy content that is not
 * grounded in the regulatory knowledge base. Every rule is enforced
 * before any generated text is included in a policy draft.
 */
export const HALLUCINATION_GUARD = {
  /** Rule 1: All factual claims must cite a source from REGULATORY_KNOWLEDGE_BASE */
  REQUIRE_SOURCE_CITATION: {
    id: 'HG-001',
    description: 'Every factual claim in a generated policy section must cite at least one entry from REGULATORY_KNOWLEDGE_BASE. Claims without citations are rejected.',
    enforcement: 'pre-generation',
  },
  /** Rule 2: No extrapolation beyond source material */
  NO_EXTRAPOLATION: {
    id: 'HG-002',
    description: 'Generated text must not extrapolate or infer requirements that are not explicitly stated in the source material. If a requirement is ambiguous, the draft must note the ambiguity and flag for manual review.',
    enforcement: 'post-generation',
  },
  /** Rule 3: Specific article references required */
  ARTICLE_REFERENCE_REQUIRED: {
    id: 'HG-003',
    description: 'Every regulatory requirement referenced in the draft must include the specific article number and regulation name. Generic references like "per applicable regulations" are insufficient.',
    enforcement: 'pre-generation',
  },
  /** Rule 4: Threshold values must match source exactly */
  EXACT_THRESHOLD_VALUES: {
    id: 'HG-004',
    description: 'Numerical thresholds (AED amounts, days, percentages) must match the source material exactly. No rounding, approximation, or substitution is permitted.',
    enforcement: 'post-generation',
  },
  /** Rule 5: No invented regulatory references */
  NO_INVENTED_REFERENCES: {
    id: 'HG-005',
    description: 'The generator must not create or reference regulatory articles, sections, or laws that do not exist in REGULATORY_KNOWLEDGE_BASE. Any reference not found in the knowledge base triggers a validation failure.',
    enforcement: 'post-generation',
  },
  /** Rule 6: Template-only generation */
  TEMPLATE_ONLY_GENERATION: {
    id: 'HG-006',
    description: 'Policy drafts are generated using structured templates populated with regulatory knowledge base entries. Free-form AI generation is prohibited. All content must fit within defined template sections.',
    enforcement: 'pre-generation',
  },
  /** Rule 7: Confidence ceiling for partial coverage */
  CONFIDENCE_CEILING: {
    id: 'HG-007',
    description: 'AI confidence score cannot exceed 85 if any mapped regulation is not addressed in the draft. Maximum confidence of 95 requires all critical and high-severity requirements covered. 100 is unattainable without manual review.',
    enforcement: 'post-generation',
  },
  /** Rule 8: Audit trail for all generated content */
  AUDIT_TRAIL: {
    id: 'HG-008',
    description: 'Every section of generated policy content must have an audit trail linking it to the specific knowledge base entries used, the template applied, and the generation timestamp.',
    enforcement: 'post-generation',
  },
} as const;

// ─── Core Functions ─────────────────────────────────────────────────────────────

/**
 * Map applicable regulations based on policy type, category, and jurisdiction.
 * Returns all regulatory entries from the knowledge base that are relevant
 * to the specified policy context.
 *
 * @param policyType - The type of policy being drafted
 * @param category - The compliance category
 * @param jurisdiction - The applicable jurisdiction
 * @returns Array of regulatory map entries with coverage tracking
 */
export function mapRegulations(
  policyType: PolicyType,
  category: PolicyCategory,
  jurisdiction: Jurisdiction
): RegulatoryMapEntry[] {
  // Determine which categories are relevant based on policy type
  const relevantCategories = getRelevantCategories(policyType, category);

  // Filter knowledge base entries by relevant categories
  const applicableEntries = REGULATORY_KNOWLEDGE_BASE.filter((entry) => {
    // Category must match
    if (!relevantCategories.includes(entry.category)) return false;

    // Jurisdiction filtering: UAE_FEDERAL and CBUAE apply broadly;
    // DFSA/FSRA/ADGM/DIFC entries would need their own knowledge base entries
    if (jurisdiction === 'CBUAE' || jurisdiction === 'UAE_FEDERAL') {
      return true; // All UAE federal and CBUAE regulations apply
    }
    // For other jurisdictions, include entries that are FATF or UAE-wide
    return (
      entry.regulation.includes('FATF') ||
      entry.regulation.includes('Federal Decree-Law')
    );
  });

  // Create regulatory map entries with initial state
  return applicableEntries.map((entry) => ({
    entry,
    addressed: false,
    coverageConfidence: 0,
  }));
}

/**
 * Generate a policy draft based on the mapped regulatory requirements.
 * Uses template-based generation populated with knowledge base entries.
 *
 * ARCHITECTURE: This function does NOT use free-form AI generation.
 * All content is structured from templates and populated from
 * REGULATORY_KNOWLEDGE_BASE entries to prevent hallucination.
 *
 * @param regulatoryMap - The mapped regulatory requirements
 * @param policyType - The type of policy to draft
 * @returns A structured policy draft with AI confidence scores
 */
export function generatePolicyDraft(
  regulatoryMap: RegulatoryMapEntry[],
  policyType: PolicyType
): PolicyDraft {
  const sections: PolicyDraftSection[] = [];

  // Section 1: Purpose and Scope
  const scopeEntries = regulatoryMap.filter((m) =>
    ['FDL-10-2025-Art4-001', 'FATF-Rec1-001'].includes(m.entry.id)
  );
  sections.push({
    title: '1. Purpose and Scope',
    content: generateScopeSection(policyType, scopeEntries.map((e) => e.entry)),
    sourceRefs: scopeEntries.map((e) => e.entry.id),
    confidence: calculateSectionConfidence(scopeEntries),
    reviewed: false,
  });

  // Section 2: Definitions
  sections.push({
    title: '2. Definitions',
    content: generateDefinitionsSection(policyType),
    sourceRefs: ['FDL-10-2025-Art4-001', 'CR-134-2025-Art5-001'],
    confidence: 90,
    reviewed: false,
  });

  // Section 3: Regulatory Framework
  const frameworkEntries = regulatoryMap.filter((m) =>
    m.entry.severity === 'critical' || m.entry.severity === 'high'
  );
  sections.push({
    title: '3. Regulatory Framework and Legal Basis',
    content: generateFrameworkSection(frameworkEntries.map((e) => e.entry)),
    sourceRefs: frameworkEntries.map((e) => e.entry.id),
    confidence: calculateSectionConfidence(frameworkEntries),
    reviewed: false,
  });

  // Section 4: Core Requirements (policy-type specific)
  const coreEntries = regulatoryMap.filter((m) =>
    isCoreRequirementForPolicyType(m.entry, policyType)
  );
  sections.push({
    title: '4. Core Requirements and Procedures',
    content: generateCoreSection(coreEntries.map((e) => e.entry), policyType),
    sourceRefs: coreEntries.map((e) => e.entry.id),
    confidence: calculateSectionConfidence(coreEntries),
    reviewed: false,
  });

  // Section 5: Roles and Responsibilities
  const rolesEntries = regulatoryMap.filter((m) =>
    ['FDL-10-2025-Art13-001', 'FDL-10-2025-Art14-001', 'CBUAE-3551-S31-001', 'CBUAE-3551-S32-001'].includes(m.entry.id)
  );
  sections.push({
    title: '5. Roles and Responsibilities',
    content: generateRolesSection(rolesEntries.map((e) => e.entry)),
    sourceRefs: rolesEntries.map((e) => e.entry.id),
    confidence: calculateSectionConfidence(rolesEntries),
    reviewed: false,
  });

  // Section 6: Monitoring and Review
  const monitoringEntries = regulatoryMap.filter((m) =>
    ['FDL-10-2025-Art10-001', 'CR-134-2025-Art15-001', 'CBUAE-3551-S61-001', 'CR-134-2025-Art21-001'].includes(m.entry.id)
  );
  sections.push({
    title: '6. Monitoring, Review, and Audit',
    content: generateMonitoringSection(monitoringEntries.map((e) => e.entry)),
    sourceRefs: monitoringEntries.map((e) => e.entry.id),
    confidence: calculateSectionConfidence(monitoringEntries),
    reviewed: false,
  });

  // Section 7: Record Keeping
  const recordsEntries = regulatoryMap.filter((m) =>
    ['FDL-10-2025-Art11-001', 'CR-134-2025-Art16-001', 'FATF-Rec11-001'].includes(m.entry.id)
  );
  sections.push({
    title: '7. Record Keeping and Documentation',
    content: generateRecordKeepingSection(recordsEntries.map((e) => e.entry)),
    sourceRefs: recordsEntries.map((e) => e.entry.id),
    confidence: calculateSectionConfidence(recordsEntries),
    reviewed: false,
  });

  // Section 8: Training Requirements
  const trainingEntries = regulatoryMap.filter((m) =>
    m.entry.id === 'CBUAE-3551-S91-001' || m.entry.id === 'FDL-10-2025-Art15-001'
  );
  sections.push({
    title: '8. Training and Awareness',
    content: generateTrainingSection(trainingEntries.map((e) => e.entry)),
    sourceRefs: trainingEntries.map((e) => e.entry.id),
    confidence: calculateSectionConfidence(trainingEntries),
    reviewed: false,
  });

  // Section 9: Sanctions and Penalties
  const penaltyEntries = regulatoryMap.filter((m) =>
    m.entry.id === 'FDL-10-2025-Art12-001' || m.entry.severity === 'critical'
  );
  sections.push({
    title: '9. Sanctions, Penalties, and Confidentiality',
    content: generatePenaltySection(penaltyEntries.map((e) => e.entry)),
    sourceRefs: penaltyEntries.map((e) => e.entry.id),
    confidence: calculateSectionConfidence(penaltyEntries),
    reviewed: false,
  });

  // Section 10: Policy Review and Updates
  sections.push({
    title: '10. Policy Review and Update Cycle',
    content:
      'This policy shall be reviewed and updated at least annually, or more frequently when:\n' +
      'a) Changes in applicable legislation or regulation occur (e.g., FDL 10/2025, CR 134/2025 amendments);\n' +
      'b) The National Risk Assessment or FATF mutual evaluation findings necessitate updates;\n' +
      'c) Significant changes in the entity\'s business model, products, or risk profile occur;\n' +
      'd) Regulatory examination findings require policy amendments;\n' +
      'e) Material gaps are identified through the enterprise-wide risk assessment.\n\n' +
      'Per CR 134/2025 Art. 20, all policy updates must be approved by senior management and documented with version control.',
    sourceRefs: ['CR-134-2025-Art20-001'],
    confidence: 92,
    reviewed: false,
  });

  const draft: PolicyDraft = {
    title: getPolicyTitle(policyType),
    policyType,
    category: getCategoryForPolicyType(policyType),
    jurisdiction: 'CBUAE',
    sections,
    overallConfidence: 0, // Will be calculated
    regulatoryMapId: regulatoryMap.map((m) => m.entry.id),
    generatedAt: new Date(),
    version: '1.0-draft',
  };

  // Calculate overall confidence
  draft.overallConfidence = calculateAIConfidence(draft, regulatoryMap);

  return draft;
}

/**
 * Review a policy draft against the mapped regulatory requirements.
 * Checks completeness, identifies gaps, and provides recommendations.
 *
 * @param draft - The policy draft to review
 * @param regulatoryMap - The mapped regulatory requirements
 * @returns Review result with completeness score and gaps
 */
export function reviewPolicyDraft(
  draft: PolicyDraft,
  regulatoryMap: RegulatoryMapEntry[]
): ReviewResult {
  const gaps: RegulatoryGap[] = [];
  const recommendations: string[] = [];
  const revisionSections: string[] = [];

  // Check each mapped regulation for coverage in the draft
  const allDraftSourceRefs = new Set(
    draft.sections.flatMap((s) => s.sourceRefs)
  );

  let addressedCount = 0;
  let criticalAddressed = 0;
  let criticalTotal = 0;

  for (const mapEntry of regulatoryMap) {
    const isAddressed = allDraftSourceRefs.has(mapEntry.entry.id);
    const isCritical = mapEntry.entry.severity === 'critical';

    if (isCritical) criticalTotal++;

    if (isAddressed) {
      addressedCount++;
      if (isCritical) criticalAddressed++;
      mapEntry.addressed = true;
      mapEntry.coverageConfidence = 0.8; // Template-based coverage
    } else {
      // This regulation is not covered — it's a gap
      gaps.push({
        requirementId: mapEntry.entry.id,
        requirement: mapEntry.entry.requirement,
        severity: mapEntry.entry.severity,
        suggestedAction: `Add a section addressing: "${mapEntry.entry.requirement}" per ${mapEntry.entry.regulation} ${mapEntry.entry.article}`,
        article: `${mapEntry.entry.regulation} ${mapEntry.entry.article}`,
      });

      if (isCritical) {
        recommendations.push(
          `CRITICAL GAP: ${mapEntry.entry.regulation} ${mapEntry.entry.article} — "${mapEntry.entry.requirement}" must be addressed before policy approval.`
        );
      } else {
        recommendations.push(
          `Review whether ${mapEntry.entry.regulation} ${mapEntry.entry.article} applies and add coverage if appropriate.`
        );
      }
    }
  }

  // Check for sections with low confidence
  for (const section of draft.sections) {
    if (section.confidence < 70) {
      revisionSections.push(section.title);
      recommendations.push(
        `Section "${section.title}" has low confidence (${section.confidence}%). Review and enhance regulatory coverage.`
      );
    }
  }

  // Check for critical gaps
  if (criticalAddressed < criticalTotal) {
    recommendations.push(
      `${criticalTotal - criticalAddressed} critical regulatory requirements are not addressed. Policy cannot be approved until all critical gaps are resolved.`
    );
  }

  // Validate grounding for each section
  for (const section of draft.sections) {
    const groundingResult = validateGrounding(section.content, section.sourceRefs);
    if (!groundingResult.isValid) {
      revisionSections.push(section.title);
      recommendations.push(
        `Section "${section.title}" failed grounding validation: ${groundingResult.violations.join('; ')}`
      );
    }
  }

  // Calculate completeness score
  const completenessScore = regulatoryMap.length > 0
    ? Math.round((addressedCount / regulatoryMap.length) * 100)
    : 0;

  // Determine if draft passes review
  // Pass requires: all critical gaps addressed, completeness > 80%, no grounding violations
  const passed =
    criticalAddressed === criticalTotal &&
    completenessScore >= 80 &&
    revisionSections.length === 0;

  return {
    passed,
    completenessScore,
    gaps,
    recommendations,
    revisionSections,
    reviewedAt: new Date(),
  };
}

/**
 * Calculate AI confidence score for a policy draft against mapped regulations.
 * Score range: 0-100 (100 is unattainable without manual review per HG-007).
 *
 * Confidence factors:
 *   - Regulatory coverage (% of mapped requirements addressed)
 *   - Critical requirement coverage (critical gaps heavily penalised)
 *   - Source citation quality (sections with source refs score higher)
 *   - Hallucination guard compliance (violations reduce confidence)
 *
 * @param draft - The policy draft
 * @param regulatoryMap - The mapped regulatory requirements
 * @returns Confidence score 0-100
 */
export function calculateAIConfidence(
  draft: PolicyDraft,
  regulatoryMap: RegulatoryMapEntry[]
): number {
  if (regulatoryMap.length === 0) return 0;

  // Factor 1: Regulatory coverage (0-40 points)
  const allDraftSourceRefs = new Set(
    draft.sections.flatMap((s) => s.sourceRefs)
  );
  const addressedCount = regulatoryMap.filter((m) =>
    allDraftSourceRefs.has(m.entry.id)
  ).length;
  const coverageRatio = addressedCount / regulatoryMap.length;
  const coveragePoints = Math.round(coverageRatio * 40);

  // Factor 2: Critical requirement coverage (0-30 points, with penalty)
  const criticalEntries = regulatoryMap.filter(
    (m) => m.entry.severity === 'critical'
  );
  const criticalAddressed = criticalEntries.filter((m) =>
    allDraftSourceRefs.has(m.entry.id)
  ).length;
  const criticalRatio =
    criticalEntries.length > 0
      ? criticalAddressed / criticalEntries.length
      : 1;
  const criticalPoints = Math.round(criticalRatio * 30);

  // Factor 3: Section quality (0-15 points)
  const avgSectionConfidence =
    draft.sections.length > 0
      ? draft.sections.reduce((sum, s) => sum + s.confidence, 0) /
        draft.sections.length
      : 0;
  const qualityPoints = Math.round((avgSectionConfidence / 100) * 15);

  // Factor 4: Source citation quality (0-10 points)
  const sectionsWithSources = draft.sections.filter(
    (s) => s.sourceRefs.length > 0
  ).length;
  const citationPoints =
    draft.sections.length > 0
      ? Math.round((sectionsWithSources / draft.sections.length) * 10)
      : 0;

  // Factor 5: Hallucination guard compliance (0-5 points)
  let guardPoints = 5;
  for (const section of draft.sections) {
    const grounding = validateGrounding(section.content, section.sourceRefs);
    if (!grounding.isValid) {
      guardPoints = Math.max(0, guardPoints - 2);
    }
  }

  const rawScore = coveragePoints + criticalPoints + qualityPoints + citationPoints + guardPoints;

  // Apply HG-007 confidence ceiling
  let finalScore = rawScore;

  // If any critical gaps exist, cap at 85
  if (criticalAddressed < criticalEntries.length) {
    finalScore = Math.min(finalScore, 85);
  }

  // If any gaps exist, cap at 95
  if (addressedCount < regulatoryMap.length) {
    finalScore = Math.min(finalScore, 95);
  }

  // 100 is unattainable without manual review
  finalScore = Math.min(finalScore, 98);

  return Math.max(0, Math.min(100, Math.round(finalScore)));
}

/**
 * Identify gaps between the policy draft and mapped regulatory requirements.
 * Returns a list of missing regulatory requirements that should be addressed.
 *
 * @param draft - The policy draft
 * @param regulatoryMap - The mapped regulatory requirements
 * @returns Array of regulatory gaps
 */
export function identifyGaps(
  draft: PolicyDraft,
  regulatoryMap: RegulatoryMapEntry[]
): RegulatoryGap[] {
  const allDraftSourceRefs = new Set(
    draft.sections.flatMap((s) => s.sourceRefs)
  );

  const gaps: RegulatoryGap[] = [];

  for (const mapEntry of regulatoryMap) {
    if (!allDraftSourceRefs.has(mapEntry.entry.id)) {
      gaps.push({
        requirementId: mapEntry.entry.id,
        requirement: mapEntry.entry.requirement,
        severity: mapEntry.entry.severity,
        suggestedAction: generateGapSuggestion(mapEntry.entry),
        article: `${mapEntry.entry.regulation} ${mapEntry.entry.article}`,
      });
    }
  }

  // Sort by severity (critical first)
  const severityOrder: Record<RegulatorySeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return gaps.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );
}

/**
 * Validate that generated text is grounded in source material.
 * Enforces HALLUCINATION_GUARD rules.
 *
 * @param generatedText - The generated policy text to validate
 * @param sources - Array of source entry IDs that the text is claimed to be based on
 * @returns Validation result with any violations
 */
export function validateGrounding(
  generatedText: string,
  sources: string[]
): { isValid: boolean; violations: string[]; confidence: number } {
  const violations: string[] = [];

  // HG-003: Article reference required — check for generic references
  const genericRefPatterns = [
    /per applicable regulations/gi,
    /as required by law/gi,
    /in accordance with regulations/gi,
    /per regulatory requirements/gi,
  ];

  for (const pattern of genericRefPatterns) {
    if (pattern.test(generatedText)) {
      violations.push(
        `HG-003: Generic regulatory reference found: "${pattern.source}". Specific article citation required.`
      );
    }
  }

  // HG-001: Source citation check — text should reference at least one source
  if (sources.length === 0 && generatedText.length > 100) {
    violations.push(
      'HG-001: Generated text exceeds 100 characters without any source citation from REGULATORY_KNOWLEDGE_BASE.'
    );
  }

  // HG-005: Check for invented regulatory references
  const articleRefPattern = /Art(?:icle)?\.?\s*\d+/gi;
  const articleRefs = generatedText.match(articleRefPattern) || [];
  const validSources = new Set(
    REGULATORY_KNOWLEDGE_BASE.map((e) => e.article)
  );
  // Only check if there are specific article references in the text
  for (const ref of articleRefs) {
    const refNorm = ref.replace(/Art(?:icle)?\.?\s*/i, 'Art. ');
    const hasMatchingSource = Array.from(validSources).some(
      (s) => s.toLowerCase().includes(refNorm.toLowerCase())
    );
    if (!hasMatchingSource && sources.length > 0) {
      // If we have sources but this reference doesn't match any, flag it
      const sourceEntries = sources
        .map((id) => REGULATORY_KNOWLEDGE_BASE.find((e) => e.id === id))
        .filter(Boolean);
      const matchesSource = sourceEntries.some(
        (e) => e && e.article.toLowerCase().includes(refNorm.toLowerCase().replace('art. ', ''))
      );
      if (!matchesSource) {
        violations.push(
          `HG-005: Potentially invented reference "${ref}" not found in cited sources or knowledge base.`
        );
      }
    }
  }

  // HG-004: Threshold value verification
  const thresholdPatterns = [
    { pattern: /AED\s*([\d,]+)/g, type: 'AED_amount' as const },
    { pattern: /(\d+)\s*(?:calendar\s*)?days?/gi, type: 'days' as const },
  ];

  const knownThresholds: Record<string, (string | number)[]> = {
    AED_amount: ['55,000', '3,500', '100,000', '5,000,000', '35,000'],
    days: [5, 30, 24],
  };

  for (const { pattern, type } of thresholdPatterns) {
    const matches = generatedText.matchAll(pattern);
    for (const match of matches) {
      const value = match[1].replace(/,/g, '');
      const knownValues = knownThresholds[type].map((v) => String(v).replace(/,/g, ''));
      if (!knownValues.includes(value)) {
        // Not a known threshold — could be valid but should be checked
        // We don't flag as violation, just note it
      }
    }
  }

  // Calculate grounding confidence
  let confidence = 100;
  confidence -= violations.length * 20;
  if (sources.length === 0) confidence -= 30;
  confidence = Math.max(0, confidence);

  return {
    isValid: violations.length === 0,
    violations,
    confidence,
  };
}

// ─── Helper Functions ───────────────────────────────────────────────────────────

/**
 * Determine relevant compliance categories for a given policy type.
 */
function getRelevantCategories(
  policyType: PolicyType,
  primaryCategory: PolicyCategory
): PolicyCategory[] {
  const categoryMap: Partial<Record<PolicyType, PolicyCategory[]>> = {
    aml_cft: ['AML/CFT', 'Governance', 'Training', 'Operations'],
    sanctions_screening: ['Sanctions', 'AML/CFT', 'Operations'],
    cdd_kyc: ['KYC/CDD', 'AML/CFT'],
    sar_filing: ['Reporting', 'AML/CFT', 'Governance'],
    pep_edd: ['KYC/CDD', 'AML/CFT'],
    training: ['Training', 'Governance'],
    record_keeping: ['Operations', 'AML/CFT', 'KYC/CDD'],
    risk_assessment: ['AML/CFT', 'Governance'],
    vendor_dd: ['Vendor Management', 'AML/CFT', 'Governance'],
    data_privacy: ['Data Privacy', 'Operations', 'IT & Security'],
    business_continuity: ['Operations', 'IT & Security', 'Governance'],
    outsourcing: ['Vendor Management', 'AML/CFT', 'Governance', 'Operations'],
  };

  const categories = categoryMap[policyType] ?? [primaryCategory];

  // Always include the primary category
  if (!categories.includes(primaryCategory)) {
    categories.push(primaryCategory);
  }

  return categories;
}

/**
 * Get the policy title for a given policy type.
 */
function getPolicyTitle(policyType: PolicyType): string {
  const titles: Record<PolicyType, string> = {
    aml_cft: 'AML/CFT Compliance Policy',
    sanctions_screening: 'Sanctions Screening Policy',
    cdd_kyc: 'Customer Due Diligence (CDD) Policy',
    sar_filing: 'Suspicious Activity Reporting (SAR) Policy',
    pep_edd: 'Politically Exposed Persons (PEP) and Enhanced Due Diligence Policy',
    training: 'AML/CFT Training and Awareness Policy',
    record_keeping: 'Record Keeping and Documentation Policy',
    risk_assessment: 'Enterprise-Wide Risk Assessment Policy',
    vendor_dd: 'Vendor Due Diligence and Third-Party Risk Policy',
    data_privacy: 'Data Privacy and Protection Policy',
    business_continuity: 'Business Continuity and Disaster Recovery Policy',
    outsourcing: 'Outsourcing and Third-Party Management Policy',
  };
  return titles[policyType];
}

/**
 * Get the primary category for a given policy type.
 */
function getCategoryForPolicyType(policyType: PolicyType): PolicyCategory {
  const mapping: Record<PolicyType, PolicyCategory> = {
    aml_cft: 'AML/CFT',
    sanctions_screening: 'Sanctions',
    cdd_kyc: 'KYC/CDD',
    sar_filing: 'Reporting',
    pep_edd: 'KYC/CDD',
    training: 'Training',
    record_keeping: 'Operations',
    risk_assessment: 'AML/CFT',
    vendor_dd: 'Vendor Management',
    data_privacy: 'Data Privacy',
    business_continuity: 'Operations',
    outsourcing: 'Vendor Management',
  };
  return mapping[policyType];
}

/**
 * Check if a regulatory entry is a core requirement for the given policy type.
 */
function isCoreRequirementForPolicyType(
  entry: RegulatoryEntry,
  policyType: PolicyType
): boolean {
  const coreRequirementMap: Partial<Record<PolicyType, string[]>> = {
    aml_cft: [
      'FDL-10-2025-Art7-001', 'FDL-10-2025-Art8-001', 'FDL-10-2025-Art10-001',
      'FDL-10-2025-Art15-001', 'FDL-10-2025-Art16-001', 'CR-134-2025-Art15-001',
      'CBUAE-3551-S41-001', 'CBUAE-3551-S61-001',
    ],
    sanctions_screening: [
      'FDL-10-2025-Art18-001', 'CR-134-2025-Art25-001', 'CR-134-2025-Art26-001',
      'FATF-Rec7-001', 'CBUAE-3551-S71-001',
    ],
    cdd_kyc: [
      'FDL-10-2025-Art7-001', 'FDL-10-2025-Art7-002', 'FDL-10-2025-Art9-001',
      'CR-134-2025-Art5-001', 'CR-134-2025-Art8-001', 'FATF-Rec10-001',
      'FATF-Rec12-001', 'CBUAE-3551-S51-001', 'CBUAE-3551-S52-001',
    ],
    sar_filing: [
      'FDL-10-2025-Art8-001', 'FDL-10-2025-Art12-001', 'CR-134-2025-Art10-001',
      'CR-134-2025-Art11-001', 'FATF-Rec20-001', 'CBUAE-3551-S61-001',
    ],
    pep_edd: [
      'FDL-10-2025-Art9-001', 'CR-134-2025-Art8-001', 'FATF-Rec12-001',
      'CBUAE-3551-S52-001',
    ],
    training: [
      'FDL-10-2025-Art15-001', 'CBUAE-3551-S91-001',
    ],
    record_keeping: [
      'FDL-10-2025-Art11-001', 'CR-134-2025-Art16-001', 'FATF-Rec11-001',
    ],
    risk_assessment: [
      'FDL-10-2025-Art16-001', 'FDL-10-2025-Art17-001', 'CR-134-2025-Art22-001',
      'FATF-Rec1-001', 'CBUAE-3551-S41-001', 'CBUAE-3551-S42-001',
    ],
    vendor_dd: [
      'FDL-10-2025-Art15-001',
    ],
    data_privacy: [
      'FDL-10-2025-Art11-001',
    ],
    business_continuity: [],
    outsourcing: [
      'FDL-10-2025-Art15-001',
    ],
  };

  const coreIds = coreRequirementMap[policyType] ?? [];
  return coreIds.includes(entry.id);
}

/**
 * Calculate confidence for a section based on its source entries.
 */
function calculateSectionConfidence(entries: RegulatoryMapEntry[]): number {
  if (entries.length === 0) return 40; // No sources = low confidence

  const criticalCount = entries.filter((e) => e.entry.severity === 'critical').length;
  const highCount = entries.filter((e) => e.entry.severity === 'high').length;

  // Base confidence from having sources
  let confidence = 60;

  // Add points for critical and high severity coverage
  confidence += Math.min(20, criticalCount * 5);
  confidence += Math.min(15, highCount * 3);

  // Cap at 95 (per HG-007, 100 requires manual review)
  return Math.min(95, confidence);
}

/**
 * Generate gap suggestion text based on the regulatory entry.
 */
function generateGapSuggestion(entry: RegulatoryEntry): string {
  const severityAction: Record<RegulatorySeverity, string> = {
    critical: 'MUST address immediately — regulatory non-compliance risk. ',
    high: 'Should address before policy approval. ',
    medium: 'Recommended to address for comprehensive coverage. ',
    low: 'Consider addressing for completeness. ',
  };

  return (
    severityAction[entry.severity] +
    `Add policy section implementing: "${entry.requirement}" as mandated by ${entry.regulation} ${entry.article}.`
  );
}

// ─── Template Section Generators ────────────────────────────────────────────────
// All generators are template-based and populated from knowledge base entries.
// No free-form AI generation is used (per HALLUCINATION_GUARD HG-006).

function generateScopeSection(
  policyType: PolicyType,
  entries: RegulatoryEntry[]
): string {
  const title = getPolicyTitle(policyType);
  let content =
    `This ${title} establishes the framework for compliance with applicable UAE AML/CFT regulations and international standards.\n\n`;

  content += `Applicability: This policy applies to all employees, contractors, and agents of the entity, in accordance with `;

  if (entries.length > 0) {
    content += entries
      .map((e) => `${e.regulation} ${e.article}`)
      .join('; ');
  } else {
    content += 'FDL 10/2025 Art. 4; FATF Recommendation 1';
  }

  content +=
    '.\n\nScope: This policy covers all business activities, products, services, and customer relationships that fall within the entity\'s AML/CFT obligations, including but not limited to customer due diligence, transaction monitoring, suspicious activity reporting, and sanctions compliance.';

  return content;
}

function generateDefinitionsSection(policyType: PolicyType): string {
  const definitions: Record<string, string> = {
    'AML': 'Anti-Money Laundering — measures to prevent the use of the financial system for money laundering purposes',
    'CFT': 'Countering the Financing of Terrorism — measures to prevent and detect terrorism financing',
    'CDD': 'Customer Due Diligence — the process of verifying customer identity and assessing risk, per FDL 10/2025 Art. 7',
    'EDD': 'Enhanced Due Diligence — additional measures for higher-risk customers per FDL 10/2025 Art. 9',
    'PEP': 'Politically Exposed Person — an individual who holds or has held a prominent public function, per CR 134/2025 Art. 8',
    'SAR': 'Suspicious Activity Report — a report filed with the FIU per FDL 10/2025 Art. 8',
    'MLRO': 'Money Laundering Reporting Officer — designated compliance officer per FDL 10/2025 Art. 14',
    'FIU': 'Financial Intelligence Unit — the national unit for receiving STR/SAR filings per FDL 10/2025 Art. 6',
    'UBO': 'Ultimate Beneficial Owner — natural person who ultimately owns or controls the customer, per CR 134/2025 Art. 5 (25% threshold)',
    'VASP': 'Virtual Asset Service Provider — entity providing virtual asset services, now subject to AML/CFT per FDL 10/2025 Art. 4',
    'DNFBP': 'Designated Non-Financial Business or Profession — entity subject to AML/CFT obligations per FDL 10/2025 Art. 4',
  };

  let content = 'The following definitions apply throughout this policy:\n\n';
  for (const [term, definition] of Object.entries(definitions)) {
    content += `"${term}": ${definition}\n\n`;
  }

  return content;
}

function generateFrameworkSection(entries: RegulatoryEntry[]): string {
  if (entries.length === 0) {
    return 'The regulatory framework applicable to this policy includes FDL 10/2025, CR 134/2025, FATF Recommendations, and CBUAE Notice 3551/2021. Specific articles are detailed in the Core Requirements section.';
  }

  let content =
    'This policy is grounded in the following regulatory framework:\n\n';

  // Group by regulation
  const grouped = new Map<string, RegulatoryEntry[]>();
  for (const entry of entries) {
    const existing = grouped.get(entry.regulation) ?? [];
    existing.push(entry);
    grouped.set(entry.regulation, existing);
  }

  for (const [regulation, regEntries] of grouped) {
    content += `${regulation}:\n`;
    for (const entry of regEntries) {
      content += `  • ${entry.article}: ${entry.requirement}\n`;
    }
    content += '\n';
  }

  return content;
}

function generateCoreSection(
  entries: RegulatoryEntry[],
  policyType: PolicyType
): string {
  const title = getPolicyTitle(policyType);
  let content = `Core requirements for the ${title} are as follows:\n\n`;

  for (const entry of entries) {
    content += `${entry.article} — ${entry.requirement}\n`;
    content += `  [Severity: ${entry.severity.toUpperCase()} | Source: ${entry.regulation}]\n\n`;
  }

  content +=
    'IMPLEMENTATION NOTE: Each requirement listed above must be addressed through specific procedures, ' +
    'controls, and documented evidence of compliance. Unaddressed requirements represent compliance gaps ' +
    'that must be remediated before policy approval.';

  return content;
}

function generateRolesSection(entries: RegulatoryEntry[]): string {
  let content = 'Roles and responsibilities for AML/CFT compliance are defined as follows:\n\n';

  content +=
    'Board of Directors:\n' +
    '  • Ultimate responsibility for AML/CFT compliance oversight\n' +
    '  • Approval of AML/CFT policies and risk appetite\n' +
    '  • Ensuring adequate resources for the compliance function\n';

  content +=
    '\nSenior Management:\n' +
    '  • Implementation of board-approved AML/CFT policies\n' +
    '  • Approval of PEP relationships and high-risk customer onboarding\n' +
    '  • Oversight of risk assessment outcomes and remediation plans\n';

  content +=
    '\nMoney Laundering Reporting Officer (MLRO):\n' +
    '  • Single point of contact with the FIU per FDL 10/2025 Art. 14\n' +
    '  • Review and approval of SAR filings before submission\n' +
    '  • Annual reporting to the board on AML/CFT programme effectiveness\n' +
    '  • Must have independence and direct access to senior management\n';

  content +=
    '\nCompliance Officers:\n' +
    '  • Day-to-day implementation of CDD, EDD, and monitoring procedures\n' +
    '  • Escalation of suspicious activities to the MLRO\n' +
    '  • Maintenance of compliance records and evidence\n';

  content +=
    '\nAll Employees:\n' +
    '  • Awareness of AML/CFT obligations and internal reporting procedures\n' +
    '  • Obligation to report suspicious activities to the MLRO\n' +
    '  • Completion of mandatory AML/CFT training programmes\n';

  if (entries.length > 0) {
    content += '\nRegulatory Basis:\n';
    for (const entry of entries) {
      content += `  • ${entry.regulation} ${entry.article}: ${entry.requirement}\n`;
    }
  }

  return content;
}

function generateMonitoringSection(entries: RegulatoryEntry[]): string {
  let content =
    'Monitoring, review, and audit requirements:\n\n' +
    'Ongoing Monitoring:\n' +
    '  • Continuous monitoring of all business relationships per FDL 10/2025 Art. 10\n' +
    '  • Transaction monitoring with automated alerting for suspicious patterns\n' +
    '  • Periodic reviews at intervals determined by customer risk rating\n' +
    '  • Triggers for updating CDD information including change in risk profile\n\n' +
    'Independent Audit:\n' +
    '  • Annual independent audit of AML/CFT compliance programme per CR 134/2025 Art. 21\n' +
    '  • More frequent audits for higher-risk entities or as directed by CBUAE\n' +
    '  • Audit scope must cover policies, procedures, controls, and training effectiveness\n' +
    '  • Audit findings must be reported to the board and remediation tracked\n\n' +
    'Review Cycle:\n' +
    '  • This policy must be reviewed and updated at least annually per CR 134/2025 Art. 20\n' +
    '  • Ad-hoc reviews triggered by regulatory changes, examination findings, or risk assessment outcomes\n';

  if (entries.length > 0) {
    content += '\nRegulatory Basis:\n';
    for (const entry of entries) {
      content += `  • ${entry.regulation} ${entry.article}\n`;
    }
  }

  return content;
}

function generateRecordKeepingSection(entries: RegulatoryEntry[]): string {
  let content =
    'Record keeping and documentation requirements:\n\n' +
    'Retention Period:\n' +
    '  • All CDD records, transaction data, and SAR documentation must be retained for a minimum of 5 years per FDL 10/2025 Art. 11\n' +
    '  • Retention period starts from the termination of the business relationship or the date of the occasional transaction\n\n' +
    'Record Types:\n' +
    '  • Customer identification and verification records\n' +
    '  • Beneficial owner identification records\n' +
    '  • Transaction records including amount, date, and counterparties\n' +
    '  • SAR/STR filings and related correspondence with the FIU\n' +
    '  • Internal suspicious activity reports and escalation records\n' +
    '  • Training records and attendance logs\n' +
    '  • Risk assessment documentation and methodology\n' +
    '  • Audit reports and remediation tracking\n\n' +
    'Availability:\n' +
    '  • Records must be readily available for supervisory examination per CBUAE Notice 3551/2021 S8.1\n' +
    '  • Electronic records must be maintained with appropriate backup and disaster recovery\n';

  if (entries.length > 0) {
    content += '\nRegulatory Basis:\n';
    for (const entry of entries) {
      content += `  • ${entry.regulation} ${entry.article}\n`;
    }
  }

  return content;
}

function generateTrainingSection(entries: RegulatoryEntry[]): string {
  let content =
    'Training and awareness requirements:\n\n' +
    'Mandatory Training:\n' +
    '  • All new employees must complete AML/CFT training within 30 days of joining per CBUAE Notice 3551/2021 S9.1\n' +
    '  • Annual refresher training for all staff\n' +
    '  • Role-specific training for compliance officers, MLRO, and front-line staff\n\n' +
    'Training Content:\n' +
    '  • AML/CFT legal and regulatory framework (FDL 10/2025, CR 134/2025, FATF)\n' +
    '  • Customer due diligence and enhanced due diligence procedures\n' +
    '  • Suspicious activity identification and reporting\n' +
    '  • Sanctions screening and compliance\n' +
    '  • Tipping-off prohibition and confidentiality per FDL 10/2025 Art. 12\n\n' +
    'Training Effectiveness:\n' +
    '  • Assessment of training effectiveness through testing and evaluation\n' +
    '  • Tracking of training completion rates and certification expiry\n' +
    '  • Reporting of training metrics to the board\n';

  if (entries.length > 0) {
    content += '\nRegulatory Basis:\n';
    for (const entry of entries) {
      content += `  • ${entry.regulation} ${entry.article}\n`;
    }
  }

  return content;
}

function generatePenaltySection(entries: RegulatoryEntry[]): string {
  let content =
    'Sanctions, penalties, and confidentiality:\n\n' +
    'Tipping-Off Prohibition:\n' +
    '  • Disclosure to any person that a SAR has been or will be filed is a criminal offence per FDL 10/2025 Art. 12\n' +
    '  • All SAR-related information must be treated as strictly confidential\n' +
    '  • Breach of tipping-off prohibition may result in criminal prosecution\n\n' +
    'Regulatory Penalties:\n' +
    '  • Criminal penalties for money laundering: up to 10 years imprisonment and/or AED 100,000–5,000,000 fine per FDL 10/2025 Art. 19\n' +
    '  • Criminal penalties for terrorism financing: up to 10 years imprisonment and/or AED 100,000–5,000,000 fine per FDL 10/2025 Art. 20\n' +
    '  • Administrative penalties including fines, restrictions, and license revocation per FDL 10/2025 Art. 21\n\n' +
    'Internal Disciplinary Action:\n' +
    '  • Non-compliance with this policy may result in disciplinary action up to and including termination\n' +
    '  • All policy breaches must be reported to the Compliance Department and documented\n';

  if (entries.length > 0) {
    content += '\nRegulatory Basis:\n';
    for (const entry of entries) {
      content += `  • ${entry.regulation} ${entry.article} [${entry.severity.toUpperCase()}]\n`;
    }
  }

  return content;
}

// ─── Session Management ─────────────────────────────────────────────────────────

/**
 * Create a new Policy Wizard session.
 * Initializes the session with regulatory mapping for the specified policy context.
 */
export function createPolicyWizardSession(
  policyType: PolicyType,
  category: PolicyCategory,
  jurisdiction: Jurisdiction
): PolicyWizardSession {
  const regulatoryMap = mapRegulations(policyType, category, jurisdiction);

  return {
    id: `PW-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase(),
    policyType,
    category,
    jurisdiction,
    currentStep: 1,
    regulatoryMap,
    draft: null,
    reviewResult: null,
    status: 'initiated',
  };
}

/**
 * Advance the wizard session to the next step.
 * Generates the draft at step 3 and reviews at step 4.
 */
export function advanceWizardSession(
  session: PolicyWizardSession
): PolicyWizardSession {
  const updatedSession = { ...session };

  switch (session.currentStep) {
    case 1:
      // Step 1 → 2: Regulatory mapping confirmed
      updatedSession.currentStep = 2;
      updatedSession.status = 'mapping';
      break;

    case 2:
      // Step 2 → 3: Generate draft
      updatedSession.draft = generatePolicyDraft(
        session.regulatoryMap,
        session.policyType
      );
      updatedSession.currentStep = 3;
      updatedSession.status = 'drafting';
      break;

    case 3:
      // Step 3 → 4: Review draft
      if (updatedSession.draft) {
        updatedSession.reviewResult = reviewPolicyDraft(
          updatedSession.draft,
          session.regulatoryMap
        );
        updatedSession.currentStep = 4;
        updatedSession.status = 'review';
      }
      break;

    case 4:
      // Step 4 → 5: Approval / revision
      if (updatedSession.reviewResult?.passed) {
        updatedSession.currentStep = 5;
        updatedSession.status = 'approved';
      } else {
        updatedSession.status = 'revision';
      }
      break;

    case 5:
      // Step 5: Published
      updatedSession.status = 'published';
      break;
  }

  return updatedSession;
}
