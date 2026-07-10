/**
 * IC-OS CPF / WTR / e-KYC / Outsourcing Assessment Questions
 * Phase 3: Advanced Compliance Workflows — AML Self-Assessment Module
 *
 * Structured assessment questions covering:
 *   1. Counter-Proliferation Financing (CPF) per FATF Recommendation 7
 *   2. Wire Transfer Regulation per FDL 10/2025 Art. 11 / CR 134/2025 Art. 11
 *   3. Digital Identity / e-KYC per CR 134/2025
 *   4. Outsourcing / Third-Party Risk per CR 134/2025
 *
 * All questions are designed for self-assessment with regulatory traceability.
 * Each question includes a hint referencing the specific FATF/UN/FDL/CR article.
 */

// ─── Common Types ───────────────────────────────────────────────────────────────

export type QuestionCategory =
  | 'CPF'
  | 'WTR'
  | 'EKYC'
  | 'OUTSOURCING';

export type ComplianceLevel = 'compliant' | 'partially_compliant' | 'non_compliant' | 'not_assessed';

export interface AssessmentQuestion {
  /** Unique question identifier */
  id: string;
  /** The assessment question text */
  text: string;
  /** Whether this question addresses a critical regulatory requirement */
  isCritical: boolean;
  /** Hint text with regulatory reference to assist the assessor */
  hint: string;
  /** Category of the question */
  category: QuestionCategory;
  /** Applicable regulatory framework */
  regulatoryFramework: string;
  /** Specific article/reference */
  articleRef: string;
  /** Weight in the overall compliance score (1-5) */
  weight: number;
  /** Default compliance level if not assessed */
  defaultLevel: ComplianceLevel;
}

export interface AssessmentResponse {
  /** Question ID */
  questionId: string;
  /** Assessed compliance level */
  level: ComplianceLevel;
  /** Evidence or justification for the assessment */
  evidence: string;
  /** Assessor notes */
  notes?: string;
  /** Date of assessment */
  assessedAt: Date;
  /** User who performed the assessment */
  assessedBy: string;
}

// ─── CPF Questions (Counter-Proliferation Financing) ────────────────────────────
// Per FATF Recommendation 7: Targeted financial sanctions related to
// the proliferation of weapons of mass destruction (WMD)

export const CPF_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 'CPF-Q001',
    text: 'Does the entity screen all customers, beneficial owners, and transaction counterparties against UN Security Council proliferation-related sanctions lists (UNSCR 1718, 1737, 1747, 1803, 1929, and successors) before establishing a business relationship and on an ongoing basis?',
    isCritical: true,
    hint: 'FATF Recommendation 7 requires implementation of targeted financial sanctions to comply with UNSC resolutions relating to proliferation. Per CR 134/2025 Art. 25, screening must include UAE-specific proliferation designations. Refer to UAE Cabinet Resolution on proliferation financing and CBUAE Notice 3551/2021 S7.1.',
    category: 'CPF',
    regulatoryFramework: 'FATF Recommendation 7; UNSC Resolutions 1718/1737/1747/1803/1929; CR 134/2025 Art. 25',
    articleRef: 'FATF Rec. 7; UNSC 1718 et seq.; CR 134/2025 Art. 25',
    weight: 5,
    defaultLevel: 'not_assessed',
  },
  {
    id: 'CPF-Q002',
    text: 'Does the entity have procedures to detect and assess transactions involving dual-use goods and technologies that could contribute to WMD proliferation, including items on the Wassenaar Arrangement, Nuclear Suppliers Group, and Missile Technology Control Regime lists?',
    isCritical: true,
    hint: 'FATF Recommendation 7 and the FATF Guidance on Proliferation Financing (2018, updated 2021) require entities to identify activities potentially related to proliferation, including trade in dual-use goods. Insurance covering cargo or trade finance involving dual-use items should trigger enhanced review. Per FDL 10/2025 Art. 9, EDD applies to higher-risk scenarios.',
    category: 'CPF',
    regulatoryFramework: 'FATF Recommendation 7; FATF PF Guidance 2021; FDL 10/2025 Art. 9',
    articleRef: 'FATF Rec. 7; FATF PF Guidance; FDL 10/2025 Art. 9',
    weight: 5,
    defaultLevel: 'not_assessed',
  },
  {
    id: 'CPF-Q003',
    text: 'Does the entity have mechanisms to identify proliferation networks and supply chain financing patterns, including transactions involving entities or individuals linked to known proliferators, front companies, or procurement agents acting on behalf of sanctioned jurisdictions (e.g., DPRK, Iran)?',
    isCritical: true,
    hint: 'FATF Recommendation 7 and the FATF Advisory on Proliferation Financing recommend monitoring for indicators of proliferation networks, including front companies, transshipment through third countries, and unusual payment patterns. Per CBUAE Notice 3551/2021 S6.1, transaction monitoring should include proliferation financing indicators.',
    category: 'CPF',
    regulatoryFramework: 'FATF Recommendation 7; FATF PF Advisory; CBUAE Notice 3551/2021 S6.1',
    articleRef: 'FATF Rec. 7; FATF PF Advisory; CBUAE 3551 S6.1',
    weight: 5,
    defaultLevel: 'not_assessed',
  },
  {
    id: 'CPF-Q004',
    text: 'Does the entity implement targeted financial sanctions for proliferation without delay, including immediate freezing of funds or assets of designated persons and entities, and reporting to the UAE Sanctions Committee within 24 hours of identification per CR 134/2025 Art. 25?',
    isCritical: true,
    hint: 'FATF Recommendation 7 requires immediate implementation of targeted financial sanctions for proliferation without prior notice to the designated person. CR 134/2025 Art. 25 specifies reporting to the UAE Sanctions Committee within 24 hours. FDL 10/2025 Art. 18 mandates immediate freezing. Failure to comply constitutes a criminal offence per FDL 10/2025 Art. 19-20.',
    category: 'CPF',
    regulatoryFramework: 'FATF Recommendation 7; CR 134/2025 Art. 25; FDL 10/2025 Art. 18',
    articleRef: 'FATF Rec. 7; CR 134/2025 Art. 25; FDL 10/2025 Art. 18',
    weight: 5,
    defaultLevel: 'not_assessed',
  },
  {
    id: 'CPF-Q005',
    text: 'Has the entity conducted a dedicated proliferation financing risk assessment as part of its enterprise-wide risk assessment, identifying specific PF exposure by customer type, product, service, and jurisdiction, per FATF Immediate Outcome 11 and FDL 10/2025 Art. 16-17?',
    isCritical: true,
    hint: 'FATF Immediate Outcome 11 requires that PF risks are identified and understood. The FATF updated its Methodology in 2021 to include PF-specific assessment criteria. FDL 10/2025 Art. 16-17 and CR 134/2025 Art. 22 mandate enterprise-wide risk assessments that include proliferation financing as a distinct risk category. CBUAE Notice 3551/2021 S4.1-S4.3 provides risk factor guidance.',
    category: 'CPF',
    regulatoryFramework: 'FATF Recommendation 7; FATF IO 11; FDL 10/2025 Art. 16-17; CR 134/2025 Art. 22',
    articleRef: 'FATF Rec. 7; FATF IO 11; FDL 10/2025 Art. 16-17; CR 134/2025 Art. 22',
    weight: 5,
    defaultLevel: 'not_assessed',
  },
];

// ─── WTR Questions (Wire Transfer Regulation) ───────────────────────────────────
// Per FDL 10/2025 Art. 11 and CR 134/2025 Art. 11
// Also referencing FATF Recommendation 16 (Wire Transfers)

export const WTR_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 'WTR-Q001',
    text: 'Does the entity collect and verify complete originator information for all wire transfers, including: (a) name, (b) account number or unique transaction reference, (c) address, or (d) national identity number, or (e) customer identification number, or (f) date and place of birth, as required by CR 134/2025 Art. 11 and FATF Recommendation 16?',
    isCritical: true,
    hint: 'CR 134/2025 Art. 11 and FATF Recommendation 16 require that originator information accompanies all wire transfers. For transfers exceeding AED 3,500 (cash) or any electronic transfer, the originating institution must include the originator\'s name, account number, and address or national ID. Per CBUAE Notice 3551/2021 S5.1, the cash threshold is AED 3,500.',
    category: 'WTR',
    regulatoryFramework: 'FDL 10/2025 Art. 11; CR 134/2025 Art. 11; FATF Recommendation 16',
    articleRef: 'FDL 10/2025 Art. 11; CR 134/2025 Art. 11; FATF Rec. 16',
    weight: 5,
    defaultLevel: 'not_assessed',
  },
  {
    id: 'WTR-Q002',
    text: 'Does the entity collect and verify beneficiary information for all incoming wire transfers, including beneficiary name and account number, and does it screen beneficiaries against sanctions and PEP lists before processing the transfer?',
    isCritical: true,
    hint: 'CR 134/2025 Art. 11 and FATF Recommendation 16 require that beneficiary information (name and account number) is included in wire transfers. The beneficiary institution must verify the beneficiary\'s identity and screen against sanctions lists per CR 134/2025 Art. 25-26. Per CBUAE Notice 3551/2021 S7.1, real-time sanctions screening applies to all incoming transfers.',
    category: 'WTR',
    regulatoryFramework: 'CR 134/2025 Art. 11; FATF Recommendation 16; CR 134/2025 Art. 25-26',
    articleRef: 'CR 134/2025 Art. 11; FATF Rec. 16; CR 134/2025 Art. 25-26',
    weight: 5,
    defaultLevel: 'not_assessed',
  },
  {
    id: 'WTR-Q003',
    text: 'Does the entity maintain complete records of all wire transfers (both domestic and cross-border) for a minimum of 5 years, including originator information, beneficiary information, transaction amount, date, and purpose, per FDL 10/2025 Art. 11 and CR 134/2025 Art. 16?',
    isCritical: true,
    hint: 'FDL 10/2025 Art. 11 mandates a minimum 5-year retention period for all wire transfer records. CR 134/2025 Art. 16 specifies the types of records that must be retained. FATF Recommendation 11 requires that records enable the reconstruction of individual transactions. Per CBUAE Notice 3551/2021 S8.1, records must be available for supervisory examination.',
    category: 'WTR',
    regulatoryFramework: 'FDL 10/2025 Art. 11; CR 134/2025 Art. 16; FATF Recommendation 11',
    articleRef: 'FDL 10/2025 Art. 11; CR 134/2025 Art. 16; FATF Rec. 11',
    weight: 4,
    defaultLevel: 'not_assessed',
  },
  {
    id: 'WTR-Q004',
    text: 'Does the entity comply with the Request for Payment (RFP) framework for wire transfers, including verifying that RFP messages contain required originator and beneficiary data, and that incomplete RFP transfers are flagged for investigation or rejected per FATF Recommendation 16 and CBUAE wire transfer requirements?',
    isCritical: false,
    hint: 'FATF Recommendation 16 requires that financial institutions process wire transfers with required and accurate originator and beneficiary information. Transfers lacking required information should be flagged, investigated, and potentially rejected. The RFP (Request for Payment) format must comply with ISO 20022 messaging standards. Per CBUAE Notice 3551/2021 S6.1, transaction monitoring must detect transfers with missing information.',
    category: 'WTR',
    regulatoryFramework: 'FATF Recommendation 16; CBUAE Notice 3551/2021 S6.1',
    articleRef: 'FATF Rec. 16; CBUAE 3551 S6.1',
    weight: 4,
    defaultLevel: 'not_assessed',
  },
  {
    id: 'WTR-Q005',
    text: 'Does the entity implement enhanced monitoring for cross-border wire transfers, including: (a) screening against high-risk jurisdiction lists, (b) applying EDD for transfers to/from FATF grey-listed or black-listed jurisdictions, (c) monitoring for structuring patterns across multiple transfers, and (d) filing SARs for suspicious cross-border transfer patterns per FDL 10/2025 Art. 8-9?',
    isCritical: true,
    hint: 'CR 134/2025 Art. 13 requires EDD measures for transactions involving high-risk jurisdictions identified by FATF or the National Committee. FDL 10/2025 Art. 8 mandates SAR filing for suspicious cross-border transactions. FATF Recommendation 16 requires monitoring of cross-border transfers for ML/TF indicators. Per CBUAE Notice 3551/2021 S4.2, jurisdictional risk must be assessed for all cross-border transfers.',
    category: 'WTR',
    regulatoryFramework: 'FDL 10/2025 Art. 8-9; CR 134/2025 Art. 13; FATF Recommendation 16; CBUAE Notice 3551/2021 S4.2',
    articleRef: 'FDL 10/2025 Art. 8-9; CR 134/2025 Art. 13; FATF Rec. 16; CBUAE 3551 S4.2',
    weight: 5,
    defaultLevel: 'not_assessed',
  },
];

// ─── e-KYC Questions (Digital Identity / Electronic Know Your Customer) ─────────
// Per CR 134/2025 — Digital identity verification and remote onboarding provisions

export const EKYC_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 'EKYC-Q001',
    text: 'Does the entity have documented remote onboarding procedures that meet CDD requirements per FDL 10/2025 Art. 7 and CR 134/2025 Art. 5, including identity verification through digital means, risk-based approach to remote customer acceptance, and clear criteria for when in-person verification is required?',
    isCritical: true,
    hint: 'CR 134/2025 Art. 5 permits CDD through digital means, provided the identification and verification process achieves the same level of assurance as in-person verification. FDL 10/2025 Art. 7 requires CDD before establishing a business relationship. The risk-based approach should determine when remote onboarding is appropriate and when enhanced measures (including in-person verification) are needed for higher-risk customers.',
    category: 'EKYC',
    regulatoryFramework: 'CR 134/2025 Art. 5; FDL 10/2025 Art. 7; FATF Digital Identity Guidance 2020',
    articleRef: 'CR 134/2025 Art. 5; FDL 10/2025 Art. 7; FATF Digital ID Guidance',
    weight: 5,
    defaultLevel: 'not_assessed',
  },
  {
    id: 'EKYC-Q002',
    text: 'Does the entity use digital identity verification systems that comply with UAE digital identity standards, including: (a) Emirates ID authentication via ICP API, (b) facial recognition with liveness detection, (c) document verification with tamper detection, and (d) proof of address verification through digital means?',
    isCritical: true,
    hint: 'CR 134/2025 Art. 5 requires reliable, independent source documents for identity verification. The UAE Federal Authority for Identity and Citizenship (ICP) provides Emirates ID verification APIs. FATF Digital Identity Guidance (2020) recommends that digital ID systems provide the same or greater level of assurance as traditional identity verification methods. Facial recognition with liveness detection is required to prevent impersonation.',
    category: 'EKYC',
    regulatoryFramework: 'CR 134/2025 Art. 5; FATF Digital Identity Guidance 2020; UAE ICP Standards',
    articleRef: 'CR 134/2025 Art. 5; FATF Digital ID Guidance; ICP Standards',
    weight: 5,
    defaultLevel: 'not_assessed',
  },
  {
    id: 'EKYC-Q003',
    text: 'Does the entity implement video KYC (vKYC) procedures with adequate controls, including: (a) real-time video interaction with trained KYC officers, (b) screen capture and recording of the vKYC session, (c) geolocation verification, (d) display of original identity documents during the session, and (e) timestamping and audit trail for regulatory examination?',
    isCritical: false,
    hint: 'Video KYC is an emerging practice in the UAE, with CBUAE allowing remote verification through live video interaction. The session must include real-time interaction (not pre-recorded), display of original documents, and geolocation capture. All vKYC sessions should be recorded and retained for 5 years per FDL 10/2025 Art. 11. The video must clearly show the customer, their documents, and the verification process.',
    category: 'EKYC',
    regulatoryFramework: 'CR 134/2025 Art. 5; FDL 10/2025 Art. 11; CBUAE Digital Banking Guidelines',
    articleRef: 'CR 134/2025 Art. 5; FDL 10/2025 Art. 11',
    weight: 4,
    defaultLevel: 'not_assessed',
  },
  {
    id: 'EKYC-Q004',
    text: 'Does the entity conduct an e-KYC risk assessment that evaluates the risks of digital onboarding by customer type, product, transaction type, and jurisdiction, including specific controls for higher-risk digital onboarding scenarios such as PEPs, high-risk jurisdictions, and complex ownership structures?',
    isCritical: true,
    hint: 'FDL 10/2025 Art. 16-17 and CR 134/2025 Art. 22 mandate enterprise-wide risk assessments that include technology-related risks. The FATF Digital Identity Guidance (2020) recommends risk assessment of digital ID systems. Per CR 134/2025 Art. 14, new technologies and delivery channels must be assessed for ML/TF risk before deployment. Digital onboarding of PEPs and high-risk customers should require EDD per FDL 10/2025 Art. 9.',
    category: 'EKYC',
    regulatoryFramework: 'FDL 10/2025 Art. 16-17; CR 134/2025 Art. 14, 22; FATF Digital Identity Guidance 2020',
    articleRef: 'FDL 10/2025 Art. 16-17; CR 134/2025 Art. 14, 22; FATF Digital ID Guidance',
    weight: 5,
    defaultLevel: 'not_assessed',
  },
  {
    id: 'EKYC-Q005',
    text: 'Does the entity ensure that digital identity verification providers meet established standards for reliability, independence, and data protection, including: (a) due diligence on the digital ID provider, (b) assessment of the provider\'s anti-fraud capabilities, (c) data processing agreement compliant with UAE data protection law, and (d) SLA for verification accuracy and uptime?',
    isCritical: false,
    hint: 'CR 134/2025 Art. 5 requires that identity verification uses reliable, independent sources. The FATF Digital Identity Guidance (2020) recommends due diligence on digital ID providers. Per CBUAE Notice 3551/2021 S3.1, the entity\'s board retains ultimate responsibility for the effectiveness of AML/CFT controls, including those performed by third-party digital ID providers. Data protection compliance is required per UAE Federal Decree-Law No. 45 of 2021 on Personal Data Protection.',
    category: 'EKYC',
    regulatoryFramework: 'CR 134/2025 Art. 5; FATF Digital Identity Guidance 2020; CBUAE Notice 3551/2021 S3.1; UAE DPL 45/2021',
    articleRef: 'CR 134/2025 Art. 5; FATF Digital ID Guidance; CBUAE 3551 S3.1',
    weight: 4,
    defaultLevel: 'not_assessed',
  },
];

// ─── Outsourcing / Third-Party Risk Questions ───────────────────────────────────
// Per CR 134/2025 — Outsourcing and third-party risk management requirements

export const OUTSOURCING_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 'OUT-Q001',
    text: 'Does the entity maintain a register of all outsourced compliance-relevant functions and third-party service providers, including: (a) scope of outsourced services, (b) risk rating of each vendor, (c) AML/CFT assessment of the vendor, (d) contract terms including data protection and audit rights, and (e) frequency of vendor review and reassessment?',
    isCritical: true,
    hint: 'CR 134/2025 Art. 20 requires that AML/CFT policies cover group-wide programmes and outsourced functions. The entity retains ultimate responsibility for AML/CFT compliance even when functions are outsourced. Per CBUAE Notice 3551/2021 S3.1, the board must ensure adequate oversight of outsourced compliance functions. The vendor register should be updated at least annually and include risk assessments.',
    category: 'OUTSOURCING',
    regulatoryFramework: 'CR 134/2025 Art. 20; CBUAE Notice 3551/2021 S3.1; CBUAE Outsourcing Regulations',
    articleRef: 'CR 134/2025 Art. 20; CBUAE 3551 S3.1; CBUAE Outsourcing Regs',
    weight: 5,
    defaultLevel: 'not_assessed',
  },
  {
    id: 'OUT-Q002',
    text: 'Does the entity conduct due diligence on third-party service providers before engagement and on an ongoing basis, including: (a) AML/CFT risk assessment of the vendor, (b) sanctions screening of the vendor and its beneficial owners, (c) assessment of the vendor\'s data security and privacy controls, (d) evaluation of the vendor\'s business continuity capabilities, and (e) review of the vendor\'s regulatory compliance track record?',
    isCritical: true,
    hint: 'CR 134/2025 Art. 20 and CBUAE Outsourcing Regulations require that entities conduct thorough due diligence on third-party service providers. Per FDL 10/2025 Art. 18 and CR 134/2025 Art. 26, vendors and their beneficial owners must be screened against sanctions lists. CBUAE Notice 3551/2021 S3.1 requires the board to ensure that outsourced functions do not compromise AML/CFT compliance. Vendor risk assessments should be proportionate to the risk of the outsourced function.',
    category: 'OUTSOURCING',
    regulatoryFramework: 'CR 134/2025 Art. 20; FDL 10/2025 Art. 18; CR 134/2025 Art. 26; CBUAE Notice 3551/2021 S3.1',
    articleRef: 'CR 134/2025 Art. 20; FDL 10/2025 Art. 18; CR 134/2025 Art. 26',
    weight: 5,
    defaultLevel: 'not_assessed',
  },
  {
    id: 'OUT-Q003',
    text: 'Does the entity ensure that outsourcing contracts include specific AML/CFT provisions, including: (a) the entity\'s right to audit the vendor\'s AML/CFT controls, (b) obligation for the vendor to report suspicious activities to the entity\'s MLRO, (c) confidentiality and tipping-off prohibition obligations per FDL 10/2025 Art. 12, (d) data protection and data residency requirements, and (e) termination clauses for non-compliance with AML/CFT requirements?',
    isCritical: false,
    hint: 'FDL 10/2025 Art. 12 prohibits tipping-off, which extends to third-party service providers. CR 134/2025 Art. 20 requires that outsourced functions are subject to the entity\'s AML/CFT policies. The entity\'s MLRO must receive suspicious activity reports from vendors. Per CBUAE Outsourcing Regulations, contracts must include audit rights, data protection provisions, and termination clauses for regulatory non-compliance.',
    category: 'OUTSOURCING',
    regulatoryFramework: 'FDL 10/2025 Art. 12; CR 134/2025 Art. 20; CBUAE Outsourcing Regulations; UAE DPL 45/2021',
    articleRef: 'FDL 10/2025 Art. 12; CR 134/2025 Art. 20; CBUAE Outsourcing Regs',
    weight: 4,
    defaultLevel: 'not_assessed',
  },
];

// ─── Utility Functions ──────────────────────────────────────────────────────────

/**
 * Get all assessment questions across all categories.
 */
export function getAllQuestions(): AssessmentQuestion[] {
  return [
    ...CPF_QUESTIONS,
    ...WTR_QUESTIONS,
    ...EKYC_QUESTIONS,
    ...OUTSOURCING_QUESTIONS,
  ];
}

/**
 * Get questions by category.
 */
export function getQuestionsByCategory(category: QuestionCategory): AssessmentQuestion[] {
  const categoryMap: Record<QuestionCategory, AssessmentQuestion[]> = {
    CPF: CPF_QUESTIONS,
    WTR: WTR_QUESTIONS,
    EKYC: EKYC_QUESTIONS,
    OUTSOURCING: OUTSOURCING_QUESTIONS,
  };
  return categoryMap[category] ?? [];
}

/**
 * Calculate compliance score for a set of responses.
 * Returns a weighted score from 0 to 100.
 *
 * Scoring:
 *   - compliant = 100% of weight
 *   - partially_compliant = 50% of weight
 *   - non_compliant = 0% of weight
 *   - not_assessed = 0% of weight (treated as gap)
 */
export function calculateComplianceScore(
  responses: AssessmentResponse[]
): {
  score: number;
  maxScore: number;
  criticalGaps: number;
  totalQuestions: number;
  categoryScores: Record<QuestionCategory, { score: number; maxScore: number }>;
} {
  const allQuestions = getAllQuestions();
  const responseMap = new Map(responses.map((r) => [r.questionId, r]));

  let totalWeightedScore = 0;
  let totalMaxScore = 0;
  let criticalGaps = 0;

  const categoryScores: Record<string, { score: number; maxScore: number }> = {
    CPF: { score: 0, maxScore: 0 },
    WTR: { score: 0, maxScore: 0 },
    EKYC: { score: 0, maxScore: 0 },
    OUTSOURCING: { score: 0, maxScore: 0 },
  };

  for (const question of allQuestions) {
    const weight = question.weight;
    totalMaxScore += weight * 100;

    const categoryKey = question.category;
    if (categoryScores[categoryKey]) {
      categoryScores[categoryKey].maxScore += weight * 100;
    }

    const response = responseMap.get(question.id);

    if (!response || response.level === 'not_assessed') {
      if (question.isCritical) criticalGaps++;
      continue;
    }

    let scorePercentage = 0;
    switch (response.level) {
      case 'compliant':
        scorePercentage = 100;
        break;
      case 'partially_compliant':
        scorePercentage = 50;
        break;
      case 'non_compliant':
        scorePercentage = 0;
        if (question.isCritical) criticalGaps++;
        break;
    }

    const weightedScore = weight * scorePercentage;
    totalWeightedScore += weightedScore;

    if (categoryScores[categoryKey]) {
      categoryScores[categoryKey].score += weightedScore;
    }
  }

  const score = totalMaxScore > 0
    ? Math.round((totalWeightedScore / totalMaxScore) * 100)
    : 0;

  return {
    score,
    maxScore: totalMaxScore,
    criticalGaps,
    totalQuestions: allQuestions.length,
    categoryScores: categoryScores as Record<QuestionCategory, { score: number; maxScore: number }>,
  };
}

/**
 * Get the critical questions that have not been assessed or are non-compliant.
 */
export function getCriticalGaps(
  responses: AssessmentResponse[]
): AssessmentQuestion[] {
  const responseMap = new Map(responses.map((r) => [r.questionId, r]));

  return getAllQuestions().filter((q) => {
    if (!q.isCritical) return false;
    const response = responseMap.get(q.id);
    return !response || response.level === 'non_compliant' || response.level === 'not_assessed';
  });
}
