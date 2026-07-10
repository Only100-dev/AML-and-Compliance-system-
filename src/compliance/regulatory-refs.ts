/**
 * IC-OS Regulatory Reference Mapping Utility
 * Phase 1 Regulatory Critical Enhancement
 *
 * Systematically maps all regulatory references from the repealed Law 20/2018
 * to FDL 10/2025 and Cabinet Resolution 134/2025.
 *
 * References:
 *   - FDL 10/2025 (Federal Decree-Law No. 10 of 2025 on AML/CFT)
 *   - CR 134/2025 (Cabinet Resolution No. 134 of 2025 — Implementing Regulation)
 *   - CBUAE Notice 3551/2021 (Guidance for Licensed Financial Institutions)
 */

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface RegulatoryRef {
  /** Current law reference key, e.g. "FDL-10-2025-Art-8" */
  key: string;
  /** Short human-readable label */
  label: string;
  /** Full legal citation */
  citation: string;
  /** Repealed reference (Law 20/2018) that this replaces */
  repealedRef: string;
  /** Description of the provision */
  description: string;
  /** Penalty category if breached */
  penaltyCategory?: 'criminal' | 'administrative' | 'regulatory';
}

export interface LawReference {
  lawId: string;
  title: string;
  gazetteNumber: string;
  effectiveDate: string;
  repealNote: string;
}

export interface ArticleReference {
  articleNumber: number;
  title: string;
  description: string;
  fdlReference: string;
  crReference?: string;
  repealedLawRef: string;
  category: 'obligation' | 'prohibition' | 'procedural' | 'definitional' | 'penalty';
  penaltyCategory?: 'criminal' | 'administrative' | 'regulatory';
}

// ─── Law References ─────────────────────────────────────────────────────────────

const FDL_10_2025: LawReference = {
  lawId: 'FDL-10-2025',
  title: 'Federal Decree-Law No. 10 of 2025 on Anti-Money Laundering and Combating the Financing of Terrorism and Financing of Illegal Organisations',
  gazetteNumber: 'UAE-GAZ-2025-10',
  effectiveDate: '2025-03-01',
  repealNote: 'Repeals Federal Law No. 20 of 2018 on Anti-Money Laundering and Combating the Financing of Terrorism and Financing of Illegal Organisations, as amended',
};

const CR_134_2025: LawReference = {
  lawId: 'CR-134-2025',
  title: 'Cabinet Resolution No. 134 of 2025 Concerning the Implementing Regulation of Federal Decree-Law No. 10 of 2025 on AML/CFT',
  gazetteNumber: 'UAE-GAZ-2025-CR134',
  effectiveDate: '2025-06-01',
  repealNote: 'Repeals Cabinet Decision No. 10 of 2019 (Implementing Regulation of Law 20/2018)',
};

const CBUAE_NOTICE_3551: LawReference = {
  lawId: 'CBUAE-3551-2021',
  title: 'CBUAE Notice No. 3551/2021 — Guidance for Licensed Financial Institutions on AML/CFT and Sanctions Compliance',
  gazetteNumber: 'CBUAE-NOT-3551-2021',
  effectiveDate: '2021-12-01',
  repealNote: 'Supplementary guidance; not repealed by FDL 10/2025 but must be read in conjunction with it',
};

// ─── FDL 10/2025 Articles (Art. 4-22) ───────────────────────────────────────────

const FDL_10_2025_ARTICLES: ArticleReference[] = [
  {
    articleNumber: 4,
    title: 'Scope of Application',
    description: 'Defines the entities subject to AML/CFT obligations including financial institutions, DNFBPs, and VASPs. Extends coverage to virtual asset service providers not previously captured under Law 20/2018.',
    fdlReference: 'FDL 10/2025 Art. 4',
    repealedLawRef: 'Law 20/2018 Art. 3',
    category: 'definitional',
  },
  {
    articleNumber: 5,
    title: 'National AML/CFT Committee',
    description: 'Establishes the National Committee for AML/CFT, its composition, mandate, and meeting requirements. The Committee shall oversee the national AML/CFT framework and coordinate among competent authorities.',
    fdlReference: 'FDL 10/2025 Art. 5',
    repealedLawRef: 'Law 20/2018 Art. 4',
    category: 'procedural',
  },
  {
    articleNumber: 6,
    title: 'Financial Intelligence Unit (FIU)',
    description: 'Designates the FIU as the central national unit for receiving, analyzing, and disseminating suspicious transaction reports. The FIU shall operate independently and have direct access to financial information.',
    fdlReference: 'FDL 10/2025 Art. 6',
    crReference: 'CR 134/2025 Art. 5',
    repealedLawRef: 'Law 20/2018 Art. 5',
    category: 'procedural',
  },
  {
    articleNumber: 7,
    title: 'Customer Due Diligence (CDD)',
    description: 'Mandates CDD measures before establishing a business relationship, carrying out occasional transactions above thresholds, or when there is a suspicion of ML/TF. Includes identification, verification, and ongoing monitoring requirements.',
    fdlReference: 'FDL 10/2025 Art. 7',
    crReference: 'CR 134/2025 Art. 6-9',
    repealedLawRef: 'Law 20/2018 Art. 6',
    category: 'obligation',
    penaltyCategory: 'criminal',
  },
  {
    articleNumber: 8,
    title: 'Suspicious Transaction Reporting',
    description: 'Requires obliged entities to file a suspicious transaction report (STR/SAR) with the FIU within 30 calendar days of forming a suspicion. Sets out the content requirements and confidentiality obligations for SAR filings.',
    fdlReference: 'FDL 10/2025 Art. 8',
    crReference: 'CR 134/2025 Art. 10-11',
    repealedLawRef: 'Law 20/2018 Art. 7',
    category: 'obligation',
    penaltyCategory: 'criminal',
  },
  {
    articleNumber: 9,
    title: 'Enhanced Due Diligence (EDD)',
    description: 'Requires EDD for higher-risk scenarios including PEPs, correspondent banking, and higher-risk jurisdictions. Specifies additional measures for each risk category including source of funds verification and senior management approval.',
    fdlReference: 'FDL 10/2025 Art. 9',
    crReference: 'CR 134/2025 Art. 12-14',
    repealedLawRef: 'Law 20/2018 Art. 8',
    category: 'obligation',
    penaltyCategory: 'criminal',
  },
  {
    articleNumber: 10,
    title: 'Ongoing Monitoring',
    description: 'Requires continuous monitoring of business relationships including scrutiny of transactions to ensure consistency with the entity\'s knowledge of the customer, their business, and risk profile. Mandates periodic reviews.',
    fdlReference: 'FDL 10/2025 Art. 10',
    crReference: 'CR 134/2025 Art. 15',
    repealedLawRef: 'Law 20/2018 Art. 9',
    category: 'obligation',
    penaltyCategory: 'administrative',
  },
  {
    articleNumber: 11,
    title: 'Record Keeping',
    description: 'Mandates retention of CDD records, transaction data, and SAR-related documentation for a minimum of 5 years after the termination of the business relationship or the date of the occasional transaction.',
    fdlReference: 'FDL 10/2025 Art. 11',
    crReference: 'CR 134/2025 Art. 16',
    repealedLawRef: 'Law 20/2018 Art. 10',
    category: 'obligation',
    penaltyCategory: 'administrative',
  },
  {
    articleNumber: 12,
    title: 'Tipping-Off Prohibition',
    description: 'Prohibits any person from disclosing to the subject or any third party that a SAR has been or will be filed, or that an investigation is being or may be carried out. Any such disclosure constitutes a criminal offence.',
    fdlReference: 'FDL 10/2025 Art. 12',
    crReference: 'CR 134/2025 Art. 17',
    repealedLawRef: 'Law 20/2018 Art. 11',
    category: 'prohibition',
    penaltyCategory: 'criminal',
  },
  {
    articleNumber: 13,
    title: 'Internal Reporting Procedures',
    description: 'Requires obliged entities to establish and maintain internal reporting procedures, including the appointment of a Money Laundering Reporting Officer (MLRO), and to ensure that all employees are aware of their reporting obligations.',
    fdlReference: 'FDL 10/2025 Art. 13',
    crReference: 'CR 134/2025 Art. 18',
    repealedLawRef: 'Law 20/2018 Art. 12',
    category: 'obligation',
    penaltyCategory: 'administrative',
  },
  {
    articleNumber: 14,
    title: 'Money Laundering Reporting Officer (MLRO)',
    description: 'Defines the role, responsibilities, and qualifications of the MLRO. The MLRO is the single point of contact with the FIU and must have direct access to senior management and the board.',
    fdlReference: 'FDL 10/2025 Art. 14',
    crReference: 'CR 134/2025 Art. 19',
    repealedLawRef: 'Law 20/2018 Art. 13',
    category: 'procedural',
  },
  {
    articleNumber: 15,
    title: 'Internal Controls and Compliance',
    description: 'Requires implementation of internal policies, controls, and procedures to mitigate ML/TF risks, including independent audit functions, employee screening, and ongoing training programmes.',
    fdlReference: 'FDL 10/2025 Art. 15',
    crReference: 'CR 134/2025 Art. 20-21',
    repealedLawRef: 'Law 20/2018 Art. 14',
    category: 'obligation',
    penaltyCategory: 'administrative',
  },
  {
    articleNumber: 16,
    title: 'National Risk Assessment',
    description: 'Requires obliged entities to take appropriate steps to identify, assess, and understand their ML/TF risks, and to take proportionate measures to mitigate them, informed by the National Risk Assessment.',
    fdlReference: 'FDL 10/2025 Art. 16',
    crReference: 'CR 134/2025 Art. 22',
    repealedLawRef: 'Law 20/2018 Art. 15',
    category: 'obligation',
    penaltyCategory: 'regulatory',
  },
  {
    articleNumber: 17,
    title: 'Risk Assessment by Obliged Entities',
    description: 'Mandates that obliged entities conduct enterprise-wide risk assessments (EWRA), including assessment of customer risk, jurisdictional risk, product/service risk, and transaction risk. Results must be documented and updated regularly.',
    fdlReference: 'FDL 10/2025 Art. 17',
    crReference: 'CR 134/2025 Art. 23-24',
    repealedLawRef: 'Law 20/2018 Art. 16',
    category: 'obligation',
    penaltyCategory: 'administrative',
  },
  {
    articleNumber: 18,
    title: 'Targeted Financial Sanctions',
    description: 'Requires implementation of targeted financial sanctions pursuant to United Nations Security Council resolutions. Obliges entities to immediately freeze funds and report to the UAE Sanctions Committee without prior notice to the designated person.',
    fdlReference: 'FDL 10/2025 Art. 18',
    crReference: 'CR 134/2025 Art. 25-27',
    repealedLawRef: 'Law 20/2018 Art. 17',
    category: 'obligation',
    penaltyCategory: 'criminal',
  },
  {
    articleNumber: 19,
    title: 'Penalties for Money Laundering',
    description: 'Establishes criminal penalties for money laundering offences including imprisonment of up to 10 years and fines of not less than AED 100,000 and not more than AED 5,000,000, or either of these penalties.',
    fdlReference: 'FDL 10/2025 Art. 19',
    repealedLawRef: 'Law 20/2018 Art. 18',
    category: 'penalty',
  },
  {
    articleNumber: 20,
    title: 'Penalties for Financing of Terrorism',
    description: 'Establishes criminal penalties for terrorism financing offences including imprisonment of up to 10 years and fines of not less than AED 100,000 and not more than AED 5,000,000, or either of these penalties.',
    fdlReference: 'FDL 10/2025 Art. 20',
    repealedLawRef: 'Law 20/2018 Art. 19',
    category: 'penalty',
  },
  {
    articleNumber: 21,
    title: 'Administrative Penalties',
    description: 'Empowers the Supervisory Authority to impose administrative penalties on obliged entities that fail to comply with AML/CFT requirements, including fines, restrictions on activities, and license revocation.',
    fdlReference: 'FDL 10/2025 Art. 21',
    crReference: 'CR 134/2025 Art. 28-30',
    repealedLawRef: 'Law 20/2018 Art. 20',
    category: 'penalty',
  },
  {
    articleNumber: 22,
    title: 'Cooperation and Information Exchange',
    description: 'Establishes the framework for domestic and international cooperation, mutual legal assistance, and information exchange between competent authorities, FIUs, and foreign counterparts.',
    fdlReference: 'FDL 10/2025 Art. 22',
    crReference: 'CR 134/2025 Art. 31-33',
    repealedLawRef: 'Law 20/2018 Art. 21',
    category: 'procedural',
  },
];

// ─── CR 134/2025 Articles ───────────────────────────────────────────────────────

const CR_134_2025_ARTICLES: ArticleReference[] = [
  {
    articleNumber: 1,
    title: 'Definitions and Interpretation',
    description: 'Provides comprehensive definitions for terms used throughout the Implementing Regulation, including definitions for "beneficial owner", "virtual assets", "VASP", and other key terms introduced by FDL 10/2025.',
    fdlReference: 'FDL 10/2025 Art. 1-3',
    crReference: 'CR 134/2025 Art. 1',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 1',
    category: 'definitional',
  },
  {
    articleNumber: 2,
    title: 'Supervisory Authority Powers',
    description: 'Details the powers of supervisory authorities including CBUAE, including examination, enforcement, and penalty assessment capabilities. Clarifies the scope of supervisory jurisdiction over VASPs.',
    fdlReference: 'FDL 10/2025 Art. 4-5',
    crReference: 'CR 134/2025 Art. 2',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 2',
    category: 'procedural',
  },
  {
    articleNumber: 3,
    title: 'Scope of Obliged Entities',
    description: 'Enumerates all categories of obliged entities subject to AML/CFT requirements, including additions for VASPs and non-profit organisations, with specific thresholds for inclusion.',
    fdlReference: 'FDL 10/2025 Art. 4',
    crReference: 'CR 134/2025 Art. 3',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 3',
    category: 'definitional',
  },
  {
    articleNumber: 4,
    title: 'FIU Operations and Procedures',
    description: 'Outlines FIU operational procedures, including STR/SAR receipt processing, dissemination timelines, and feedback mechanisms to reporting entities.',
    fdlReference: 'FDL 10/2025 Art. 6',
    crReference: 'CR 134/2025 Art. 4',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 4',
    category: 'procedural',
  },
  {
    articleNumber: 5,
    title: 'Customer Due Diligence Measures',
    description: 'Specifies detailed CDD measures including identification requirements for individuals, legal persons, and legal arrangements. Defines verification sources and acceptable documentation standards.',
    fdlReference: 'FDL 10/2025 Art. 7',
    crReference: 'CR 134/2025 Art. 5',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 5',
    category: 'obligation',
    penaltyCategory: 'criminal',
  },
  {
    articleNumber: 6,
    title: 'Beneficial Owner Identification',
    description: 'Establishes the threshold of 25% ownership or control for beneficial owner identification. Requires identification of the natural person who ultimately owns or controls the customer entity.',
    fdlReference: 'FDL 10/2025 Art. 7',
    crReference: 'CR 134/2025 Art. 6',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 6',
    category: 'obligation',
    penaltyCategory: 'criminal',
  },
  {
    articleNumber: 7,
    title: 'Simplified Due Diligence',
    description: 'Permits simplified due diligence measures for lower-risk categories of customers, products, and transactions, provided the reduced risk is clearly documented and supported by the entity\'s risk assessment.',
    fdlReference: 'FDL 10/2025 Art. 7',
    crReference: 'CR 134/2025 Art. 7',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 7',
    category: 'procedural',
  },
  {
    articleNumber: 8,
    title: 'Politically Exposed Persons (PEPs)',
    description: 'Defines PEP categories (domestic, foreign, international organisation), specifies EDD measures for PEP relationships, and requires senior management approval for establishing or continuing PEP relationships.',
    fdlReference: 'FDL 10/2025 Art. 9',
    crReference: 'CR 134/2025 Art. 8',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 8',
    category: 'obligation',
    penaltyCategory: 'criminal',
  },
  {
    articleNumber: 9,
    title: 'Correspondent Banking',
    description: 'Requires EDD for correspondent banking relationships, including gathering sufficient information about the respondent institution, assessing its AML/CFT controls, and obtaining senior management approval.',
    fdlReference: 'FDL 10/2025 Art. 9',
    crReference: 'CR 134/2025 Art. 9',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 9',
    category: 'obligation',
    penaltyCategory: 'criminal',
  },
  {
    articleNumber: 10,
    title: 'Suspicious Transaction Reporting Procedures',
    description: 'Details the SAR/STR filing procedure, including content requirements, format, and submission channels. Specifies the 30-calendar-day filing deadline from the date of forming a suspicion.',
    fdlReference: 'FDL 10/2025 Art. 8',
    crReference: 'CR 134/2025 Art. 10',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 10',
    category: 'obligation',
    penaltyCategory: 'criminal',
  },
  {
    articleNumber: 11,
    title: 'SAR Content and Format',
    description: 'Prescribes the mandatory content and format for SAR filings submitted to the FIU through the goAML system, including subject information, transaction details, and the narrative of suspicion.',
    fdlReference: 'FDL 10/2025 Art. 8',
    crReference: 'CR 134/2025 Art. 11',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 11',
    category: 'procedural',
  },
  {
    articleNumber: 12,
    title: 'Enhanced Due Diligence for Higher-Risk Scenarios',
    description: 'Enumerates the additional EDD measures required for higher-risk customers and transactions, including source of funds verification, enhanced ongoing monitoring, and more frequent periodic reviews.',
    fdlReference: 'FDL 10/2025 Art. 9',
    crReference: 'CR 134/2025 Art. 12',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 12',
    category: 'obligation',
    penaltyCategory: 'criminal',
  },
  {
    articleNumber: 13,
    title: 'High-Risk Jurisdictions',
    description: 'Requires application of EDD measures for business relationships and transactions with persons from jurisdictions identified by the FATF or National Committee as high-risk. May require senior management approval.',
    fdlReference: 'FDL 10/2025 Art. 9',
    crReference: 'CR 134/2025 Art. 13',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 13',
    category: 'obligation',
    penaltyCategory: 'regulatory',
  },
  {
    articleNumber: 14,
    title: 'New Products and Technologies',
    description: 'Requires risk assessment of new products, business practices, and delivery channels before launch, including virtual asset-related products and services. Mandates appropriate AML/CFT measures for new technologies.',
    fdlReference: 'FDL 10/2025 Art. 9',
    crReference: 'CR 134/2025 Art. 14',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 14',
    category: 'obligation',
    penaltyCategory: 'administrative',
  },
  {
    articleNumber: 15,
    title: 'Ongoing Monitoring Requirements',
    description: 'Specifies the nature and frequency of ongoing monitoring, including transaction monitoring thresholds, periodic review intervals, and triggers for updating CDD information.',
    fdlReference: 'FDL 10/2025 Art. 10',
    crReference: 'CR 134/2025 Art. 15',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 15',
    category: 'obligation',
    penaltyCategory: 'administrative',
  },
  {
    articleNumber: 16,
    title: 'Record Retention Requirements',
    description: 'Defines the 5-year minimum retention period for CDD records, transaction records, and SAR documentation. Specifies the types of records that must be retained and the conditions for early disposal.',
    fdlReference: 'FDL 10/2025 Art. 11',
    crReference: 'CR 134/2025 Art. 16',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 16',
    category: 'obligation',
    penaltyCategory: 'administrative',
  },
  {
    articleNumber: 17,
    title: 'Tipping-Off Prohibition and Confidentiality',
    description: 'Elaborates on the tipping-off prohibition, specifying prohibited disclosures, exceptions, and the scope of the confidentiality obligation. Clarifies that internal SAR processing is not tipping-off.',
    fdlReference: 'FDL 10/2025 Art. 12',
    crReference: 'CR 134/2025 Art. 17',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 17',
    category: 'prohibition',
    penaltyCategory: 'criminal',
  },
  {
    articleNumber: 18,
    title: 'Internal Reporting and MLRO Functions',
    description: 'Specifies the internal reporting chain, MLRO qualifications and independence requirements, and the process for internal escalation of suspicions. Defines MLRO deputy arrangements.',
    fdlReference: 'FDL 10/2025 Art. 13-14',
    crReference: 'CR 134/2025 Art. 18',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 18',
    category: 'obligation',
    penaltyCategory: 'administrative',
  },
  {
    articleNumber: 19,
    title: 'MLRO Appointment and Reporting',
    description: 'Establishes requirements for MLRO appointment, registration with the FIU, deputy MLRO arrangements, and annual MLRO reporting obligations to the supervisory authority.',
    fdlReference: 'FDL 10/2025 Art. 14',
    crReference: 'CR 134/2025 Art. 19',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 19',
    category: 'procedural',
  },
  {
    articleNumber: 20,
    title: 'Internal Policies, Controls, and Procedures',
    description: 'Requires documented AML/CFT policies, procedures, and controls approved by senior management. Mandates annual review and update of policies. Covers group-wide programmes for financial groups.',
    fdlReference: 'FDL 10/2025 Art. 15',
    crReference: 'CR 134/2025 Art. 20',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 20',
    category: 'obligation',
    penaltyCategory: 'administrative',
  },
  {
    articleNumber: 21,
    title: 'Independent Audit Function',
    description: 'Mandates an independent audit of the AML/CFT compliance programme at least annually, or more frequently for higher-risk entities. Specifies audit scope, qualification of auditors, and reporting requirements.',
    fdlReference: 'FDL 10/2025 Art. 15',
    crReference: 'CR 134/2025 Art. 21',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 21',
    category: 'obligation',
    penaltyCategory: 'administrative',
  },
  {
    articleNumber: 22,
    title: 'Enterprise-Wide Risk Assessment',
    description: 'Requires entities to conduct and document an enterprise-wide risk assessment (EWRA) covering customer, country/territory, product/service, and transaction risk categories. Specifies minimum assessment methodology.',
    fdlReference: 'FDL 10/2025 Art. 16-17',
    crReference: 'CR 134/2025 Art. 22',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 22',
    category: 'obligation',
    penaltyCategory: 'regulatory',
  },
  {
    articleNumber: 23,
    title: 'Risk Assessment Methodology',
    description: 'Prescribes the methodology for conducting risk assessments, including inherent risk scoring, control effectiveness evaluation, and residual risk determination. Requires documentation of risk appetite statements.',
    fdlReference: 'FDL 10/2025 Art. 17',
    crReference: 'CR 134/2025 Art. 23',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 23',
    category: 'procedural',
  },
  {
    articleNumber: 24,
    title: 'Risk Mitigation Measures',
    description: 'Defines the risk mitigation measures that must be applied proportionate to the assessed risk level. Requires documented action plans for identified gaps and remediation timelines.',
    fdlReference: 'FDL 10/2025 Art. 17',
    crReference: 'CR 134/2025 Art. 24',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 24',
    category: 'obligation',
    penaltyCategory: 'administrative',
  },
  {
    articleNumber: 25,
    title: 'Targeted Financial Sanctions — Implementation',
    description: 'Specifies the procedures for implementing targeted financial sanctions, including screening requirements, immediate freezing obligations, and reporting to the UAE Sanctions Committee within 24 hours of a match.',
    fdlReference: 'FDL 10/2025 Art. 18',
    crReference: 'CR 134/2025 Art. 25',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 25',
    category: 'obligation',
    penaltyCategory: 'criminal',
  },
  {
    articleNumber: 26,
    title: 'Sanctions Screening Requirements',
    description: 'Mandates real-time screening of customers, beneficial owners, and transactions against UAE Local Terrorist List, UN Security Council Consolidated List, and other relevant sanctions lists. Specifies screening frequency and technology requirements.',
    fdlReference: 'FDL 10/2025 Art. 18',
    crReference: 'CR 134/2025 Art. 26',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 26',
    category: 'obligation',
    penaltyCategory: 'criminal',
  },
  {
    articleNumber: 27,
    title: 'Freezing and De-Freezing Procedures',
    description: 'Outlines the procedures for freezing funds or assets of designated persons, de-freezing procedures upon delisting, and the handling of prior obligations. Includes provisions for basic expenses exceptions.',
    fdlReference: 'FDL 10/2025 Art. 18',
    crReference: 'CR 134/2025 Art. 27',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 27',
    category: 'procedural',
  },
  {
    articleNumber: 28,
    title: 'Administrative Penalties Schedule',
    description: 'Establishes the schedule of administrative penalties for non-compliance with AML/CFT obligations, including fine ranges for different categories of violations and escalation provisions for repeat offenders.',
    fdlReference: 'FDL 10/2025 Art. 21',
    crReference: 'CR 134/2025 Art. 28',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 28',
    category: 'penalty',
  },
  {
    articleNumber: 29,
    title: 'Enforcement Actions',
    description: 'Details the enforcement actions available to supervisory authorities, including written warnings, fines, restrictions on business activities, suspension of licenses, and revocation of licenses.',
    fdlReference: 'FDL 10/2025 Art. 21',
    crReference: 'CR 134/2025 Art. 29',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 29',
    category: 'penalty',
  },
  {
    articleNumber: 30,
    title: 'Supervisory Examination Procedures',
    description: 'Specifies the procedures for supervisory examinations, including on-site inspection protocols, document request powers, and reporting requirements for examined entities.',
    fdlReference: 'FDL 10/2025 Art. 21',
    crReference: 'CR 134/2025 Art. 30',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 30',
    category: 'procedural',
  },
  {
    articleNumber: 31,
    title: 'International Cooperation Framework',
    description: 'Establishes the framework for international cooperation, including mutual legal assistance, extradition, and information exchange with foreign FIUs and competent authorities.',
    fdlReference: 'FDL 10/2025 Art. 22',
    crReference: 'CR 134/2025 Art. 31',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 31',
    category: 'procedural',
  },
  {
    articleNumber: 32,
    title: 'Mutual Legal Assistance',
    description: 'Details the procedures for receiving and executing mutual legal assistance requests, including dual criminality requirements, scope of assistance, and confidentiality protections.',
    fdlReference: 'FDL 10/2025 Art. 22',
    crReference: 'CR 134/2025 Art. 32',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 32',
    category: 'procedural',
  },
  {
    articleNumber: 33,
    title: 'Cross-Border Information Exchange',
    description: 'Specifies the conditions and procedures for cross-border information exchange, including FIU-to-FIU exchanges, supervisory information sharing, and safeguards for received information.',
    fdlReference: 'FDL 10/2025 Art. 22',
    crReference: 'CR 134/2025 Art. 33',
    repealedLawRef: 'Cabinet Decision 10/2019 Art. 33',
    category: 'procedural',
  },
];

// ─── CBUAE Notice 3551/2021 References ──────────────────────────────────────────

interface CBUAENoticeRef {
  section: string;
  title: string;
  description: string;
  noticeId: string;
}

const CBUAE_NOTICE_3551_REFS: CBUAENoticeRef[] = [
  {
    section: '3.1',
    title: 'Governance and Oversight',
    description: 'Board and senior management responsibilities for AML/CFT compliance, including establishment of compliance function, allocation of resources, and oversight of risk assessment outcomes.',
    noticeId: 'CBUAE-3551-S3.1',
  },
  {
    section: '3.2',
    title: 'MLRO Function and Reporting',
    description: 'MLRO appointment requirements, independence, access to information, deputy arrangements, and reporting obligations to the board and FIU.',
    noticeId: 'CBUAE-3551-S3.2',
  },
  {
    section: '4.1',
    title: 'Customer Risk Assessment',
    description: 'Customer risk rating methodology, risk factors, and scoring criteria for categorising customers into low, medium, and high risk categories.',
    noticeId: 'CBUAE-3551-S4.1',
  },
  {
    section: '4.2',
    title: 'Country and Geographic Risk',
    description: 'Jurisdictional risk assessment criteria, high-risk jurisdiction lists, and enhanced measures for transactions involving FATF grey-listed and black-listed countries.',
    noticeId: 'CBUAE-3551-S4.2',
  },
  {
    section: '4.3',
    title: 'Product and Service Risk',
    description: 'Product risk assessment including anonymous transactions, private banking, correspondent banking, trade finance, and virtual asset services.',
    noticeId: 'CBUAE-3551-S4.3',
  },
  {
    section: '5.1',
    title: 'CDD Measures and Thresholds',
    description: 'Detailed CDD measures, identification requirements, and transaction thresholds. CTR threshold of AED 55,000 and cash bearer withdrawal threshold of AED 3,500.',
    noticeId: 'CBUAE-3551-S5.1',
  },
  {
    section: '5.2',
    title: 'EDD for PEPs and High-Risk Customers',
    description: 'Enhanced due diligence measures for PEPs, high-risk customers, and complex structures. Source of wealth and source of funds verification requirements.',
    noticeId: 'CBUAE-3551-S5.2',
  },
  {
    section: '6.1',
    title: 'Transaction Monitoring and Filtering',
    description: 'Transaction monitoring programme requirements, including automated filtering, threshold-based alerts, and behavioural analysis. CTR reporting threshold of AED 55,000.',
    noticeId: 'CBUAE-3551-S6.1',
  },
  {
    section: '6.2',
    title: 'Suspicious Activity Reporting',
    description: 'SAR filing procedures, content requirements, and the 30-calendar-day deadline. goAML registration and filing obligations. Tipping-off prohibition reminders.',
    noticeId: 'CBUAE-3551-S6.2',
  },
  {
    section: '7.1',
    title: 'Sanctions Compliance Programme',
    description: 'Sanctions screening requirements, real-time vs batch screening, false positive management, and escalation procedures for confirmed matches.',
    noticeId: 'CBUAE-3551-S7.1',
  },
  {
    section: '7.2',
    title: 'Sanctions Screening Technology',
    description: 'Technology requirements for sanctions screening systems, including fuzzy matching algorithms, list update frequency, and quality assurance testing.',
    noticeId: 'CBUAE-3551-S7.2',
  },
  {
    section: '8.1',
    title: 'Record Keeping and Documentation',
    description: 'Record retention requirements, document management systems, and availability of records for supervisory examination. Five-year minimum retention period.',
    noticeId: 'CBUAE-3551-S8.1',
  },
  {
    section: '9.1',
    title: 'Training and Awareness',
    description: 'AML/CFT training programme requirements, including new joiner training, annual refresher training, role-specific training, and training effectiveness assessment.',
    noticeId: 'CBUAE-3551-S9.1',
  },
];

// ─── REGULATORY_REFS Object ─────────────────────────────────────────────────────

/**
 * Master mapping object mapping old Law 20/2018 references to
 * the current FDL 10/2025 and CR 134/2025 references.
 */
export const REGULATORY_REFS: Record<string, RegulatoryRef> = {
  // FDL 10/2025 Article mappings
  'FDL-10-2025-Art-4': {
    key: 'FDL-10-2025-Art-4',
    label: 'Scope of Application',
    citation: 'Federal Decree-Law No. 10 of 2025, Article 4',
    repealedRef: 'Law 20/2018 Art. 3',
    description: 'Defines entities subject to AML/CFT obligations including FIs, DNFBPs, and VASPs.',
    penaltyCategory: 'regulatory',
  },
  'FDL-10-2025-Art-5': {
    key: 'FDL-10-2025-Art-5',
    label: 'National AML/CFT Committee',
    citation: 'Federal Decree-Law No. 10 of 2025, Article 5',
    repealedRef: 'Law 20/2018 Art. 4',
    description: 'Establishes the National Committee for AML/CFT oversight and coordination.',
  },
  'FDL-10-2025-Art-6': {
    key: 'FDL-10-2025-Art-6',
    label: 'Financial Intelligence Unit',
    citation: 'Federal Decree-Law No. 10 of 2025, Article 6',
    repealedRef: 'Law 20/2018 Art. 5',
    description: 'Designates the FIU as the central unit for receiving and analyzing STR/SARs.',
  },
  'FDL-10-2025-Art-7': {
    key: 'FDL-10-2025-Art-7',
    label: 'Customer Due Diligence',
    citation: 'Federal Decree-Law No. 10 of 2025, Article 7',
    repealedRef: 'Law 20/2018 Art. 6',
    description: 'Mandates CDD measures before establishing business relationships and for occasional transactions.',
    penaltyCategory: 'criminal',
  },
  'FDL-10-2025-Art-8': {
    key: 'FDL-10-2025-Art-8',
    label: 'Suspicious Transaction Reporting',
    citation: 'Federal Decree-Law No. 10 of 2025, Article 8',
    repealedRef: 'Law 20/2018 Art. 7',
    description: 'Requires SAR filing within 30 calendar days. Sets content and confidentiality requirements.',
    penaltyCategory: 'criminal',
  },
  'FDL-10-2025-Art-9': {
    key: 'FDL-10-2025-Art-9',
    label: 'Enhanced Due Diligence',
    citation: 'Federal Decree-Law No. 10 of 2025, Article 9',
    repealedRef: 'Law 20/2018 Art. 8',
    description: 'Requires EDD for PEPs, correspondent banking, and higher-risk jurisdictions.',
    penaltyCategory: 'criminal',
  },
  'FDL-10-2025-Art-10': {
    key: 'FDL-10-2025-Art-10',
    label: 'Ongoing Monitoring',
    citation: 'Federal Decree-Law No. 10 of 2025, Article 10',
    repealedRef: 'Law 20/2018 Art. 9',
    description: 'Requires continuous monitoring of business relationships and transaction scrutiny.',
    penaltyCategory: 'administrative',
  },
  'FDL-10-2025-Art-11': {
    key: 'FDL-10-2025-Art-11',
    label: 'Record Keeping',
    citation: 'Federal Decree-Law No. 10 of 2025, Article 11',
    repealedRef: 'Law 20/2018 Art. 10',
    description: 'Mandates 5-year minimum retention of CDD records, transactions, and SAR documentation.',
    penaltyCategory: 'administrative',
  },
  'FDL-10-2025-Art-12': {
    key: 'FDL-10-2025-Art-12',
    label: 'Tipping-Off Prohibition',
    citation: 'Federal Decree-Law No. 10 of 2025, Article 12',
    repealedRef: 'Law 20/2018 Art. 11',
    description: 'Prohibits disclosure to the subject or third parties that a SAR has been filed. Criminal offence.',
    penaltyCategory: 'criminal',
  },
  'FDL-10-2025-Art-13': {
    key: 'FDL-10-2025-Art-13',
    label: 'Internal Reporting Procedures',
    citation: 'Federal Decree-Law No. 10 of 2025, Article 13',
    repealedRef: 'Law 20/2018 Art. 12',
    description: 'Requires internal reporting procedures and MLRO appointment.',
    penaltyCategory: 'administrative',
  },
  'FDL-10-2025-Art-14': {
    key: 'FDL-10-2025-Art-14',
    label: 'MLRO Role and Responsibilities',
    citation: 'Federal Decree-Law No. 10 of 2025, Article 14',
    repealedRef: 'Law 20/2018 Art. 13',
    description: 'Defines the MLRO role, qualifications, and reporting obligations.',
  },
  'FDL-10-2025-Art-15': {
    key: 'FDL-10-2025-Art-15',
    label: 'Internal Controls and Compliance',
    citation: 'Federal Decree-Law No. 10 of 2025, Article 15',
    repealedRef: 'Law 20/2018 Art. 14',
    description: 'Requires internal AML/CFT policies, independent audit, employee screening, and training.',
    penaltyCategory: 'administrative',
  },
  'FDL-10-2025-Art-16': {
    key: 'FDL-10-2025-Art-16',
    label: 'National Risk Assessment',
    citation: 'Federal Decree-Law No. 10 of 2025, Article 16',
    repealedRef: 'Law 20/2018 Art. 15',
    description: 'Requires obliged entities to identify, assess, and understand ML/TF risks proportionately.',
    penaltyCategory: 'regulatory',
  },
  'FDL-10-2025-Art-17': {
    key: 'FDL-10-2025-Art-17',
    label: 'Risk Assessment by Obliged Entities',
    citation: 'Federal Decree-Law No. 10 of 2025, Article 17',
    repealedRef: 'Law 20/2018 Art. 16',
    description: 'Mandates enterprise-wide risk assessments including customer, jurisdictional, product, and transaction risk.',
    penaltyCategory: 'administrative',
  },
  'FDL-10-2025-Art-18': {
    key: 'FDL-10-2025-Art-18',
    label: 'Targeted Financial Sanctions',
    citation: 'Federal Decree-Law No. 10 of 2025, Article 18',
    repealedRef: 'Law 20/2018 Art. 17',
    description: 'Requires implementation of UNSC sanctions, immediate freezing, and reporting to UAE Sanctions Committee.',
    penaltyCategory: 'criminal',
  },
  'FDL-10-2025-Art-19': {
    key: 'FDL-10-2025-Art-19',
    label: 'Penalties for Money Laundering',
    citation: 'Federal Decree-Law No. 10 of 2025, Article 19',
    repealedRef: 'Law 20/2018 Art. 18',
    description: 'Criminal penalties: up to 10 years imprisonment and/or AED 100,000–5,000,000 fine.',
    penaltyCategory: 'criminal',
  },
  'FDL-10-2025-Art-20': {
    key: 'FDL-10-2025-Art-20',
    label: 'Penalties for Terrorism Financing',
    citation: 'Federal Decree-Law No. 10 of 2025, Article 20',
    repealedRef: 'Law 20/2018 Art. 19',
    description: 'Criminal penalties: up to 10 years imprisonment and/or AED 100,000–5,000,000 fine.',
    penaltyCategory: 'criminal',
  },
  'FDL-10-2025-Art-21': {
    key: 'FDL-10-2025-Art-21',
    label: 'Administrative Penalties',
    citation: 'Federal Decree-Law No. 10 of 2025, Article 21',
    repealedRef: 'Law 20/2018 Art. 20',
    description: 'Supervisory authority powers: fines, activity restrictions, and license revocation.',
    penaltyCategory: 'administrative',
  },
  'FDL-10-2025-Art-22': {
    key: 'FDL-10-2025-Art-22',
    label: 'Cooperation and Information Exchange',
    citation: 'Federal Decree-Law No. 10 of 2025, Article 22',
    repealedRef: 'Law 20/2018 Art. 21',
    description: 'Framework for domestic and international cooperation, mutual legal assistance, and information exchange.',
  },
  // CR 134/2025 key references
  'CR-134-2025-Art-10': {
    key: 'CR-134-2025-Art-10',
    label: 'SAR Filing Procedures',
    citation: 'Cabinet Resolution No. 134 of 2025, Article 10',
    repealedRef: 'Cabinet Decision 10/2019 Art. 10',
    description: 'SAR/STR filing procedure with 30-calendar-day deadline and content requirements.',
    penaltyCategory: 'criminal',
  },
  'CR-134-2025-Art-17': {
    key: 'CR-134-2025-Art-17',
    label: 'Tipping-Off Prohibition Detail',
    citation: 'Cabinet Resolution No. 134 of 2025, Article 17',
    repealedRef: 'Cabinet Decision 10/2019 Art. 17',
    description: 'Elaborates on tipping-off prohibition, prohibited disclosures, and exceptions.',
    penaltyCategory: 'criminal',
  },
  'CR-134-2025-Art-25': {
    key: 'CR-134-2025-Art-25',
    label: 'Sanctions Implementation',
    citation: 'Cabinet Resolution No. 134 of 2025, Article 25',
    repealedRef: 'Cabinet Decision 10/2019 Art. 25',
    description: 'Procedures for implementing targeted financial sanctions and immediate freezing.',
    penaltyCategory: 'criminal',
  },
  'CR-134-2025-Art-26': {
    key: 'CR-134-2025-Art-26',
    label: 'Sanctions Screening Requirements',
    citation: 'Cabinet Resolution No. 134 of 2025, Article 26',
    repealedRef: 'Cabinet Decision 10/2019 Art. 26',
    description: 'Real-time screening against UAE Local Terrorist List, UNSC Consolidated List, and other lists.',
    penaltyCategory: 'criminal',
  },
  // CBUAE Notice 3551/2021 references
  'CBUAE-3551-S5.1': {
    key: 'CBUAE-3551-S5.1',
    label: 'CDD Measures and Thresholds',
    citation: 'CBUAE Notice No. 3551/2021, Section 5.1',
    repealedRef: 'N/A — Supplementary guidance',
    description: 'CTR threshold AED 55,000; Cash Bearer Withdrawal threshold AED 3,500.',
    penaltyCategory: 'regulatory',
  },
  'CBUAE-3551-S6.1': {
    key: 'CBUAE-3551-S6.1',
    label: 'Transaction Monitoring and Filtering',
    citation: 'CBUAE Notice No. 3551/2021, Section 6.1',
    repealedRef: 'N/A — Supplementary guidance',
    description: 'Transaction monitoring programme requirements and CTR reporting threshold of AED 55,000.',
    penaltyCategory: 'regulatory',
  },
  'CBUAE-3551-S6.2': {
    key: 'CBUAE-3551-S6.2',
    label: 'SAR Filing and Tipping-Off',
    citation: 'CBUAE Notice No. 3551/2021, Section 6.2',
    repealedRef: 'N/A — Supplementary guidance',
    description: 'SAR filing procedures, 30-day deadline, goAML obligations, and tipping-off prohibition.',
    penaltyCategory: 'criminal',
  },
  'CBUAE-3551-S7.1': {
    key: 'CBUAE-3551-S7.1',
    label: 'Sanctions Compliance Programme',
    citation: 'CBUAE Notice No. 3551/2021, Section 7.1',
    repealedRef: 'N/A — Supplementary guidance',
    description: 'Sanctions screening, false positive management, and escalation for confirmed matches.',
    penaltyCategory: 'regulatory',
  },
};

// ─── Exported Constants ──────────────────────────────────────────────────────────

/** SAR filing deadline: 30 calendar days per FDL 10/2025 Art. 8 */
export const SAR_FILING_DEADLINE_DAYS = 30;

/** CTR reporting threshold: AED 55,000 per CBUAE Notice 3551/2021 */
export const CTR_THRESHOLD_AED = 55_000;

/** Cash Bearer Withdrawal threshold: AED 3,500 per CBUAE Notice 3551/2021 */
export const CBWT_THRESHOLD_AED = 3_500;

/** Record retention period: 5 years per FDL 10/2025 Art. 11 */
export const RECORD_RETENTION_YEARS = 5;

// ─── Exported Functions ──────────────────────────────────────────────────────────

/**
 * Retrieve a regulatory reference by its key.
 * Returns undefined if the key does not exist.
 */
export function getRegulatoryRef(key: string): RegulatoryRef | undefined {
  return REGULATORY_REFS[key];
}

/**
 * Retrieve the full law reference metadata for FDL 10/2025, CR 134/2025,
 * or CBUAE Notice 3551/2021.
 */
export function getLawReference(lawId?: 'FDL-10-2025' | 'CR-134-2025' | 'CBUAE-3551-2021'): LawReference {
  switch (lawId) {
    case 'CR-134-2025':
      return CR_134_2025;
    case 'CBUAE-3551-2021':
      return CBUAE_NOTICE_3551;
    default:
      return FDL_10_2025;
  }
}

/**
 * Retrieve an article reference from FDL 10/2025 or CR 134/2025.
 * Defaults to FDL 10/2025 articles.
 */
export function getArticleReference(article: number, source: 'FDL-10-2025' | 'CR-134-2025' = 'FDL-10-2025'): ArticleReference | undefined {
  const articles = source === 'FDL-10-2025' ? FDL_10_2025_ARTICLES : CR_134_2025_ARTICLES;
  return articles.find((a) => a.articleNumber === article);
}

/**
 * Get all FDL 10/2025 article references (Art. 4–22).
 */
export function getAllFDLArticles(): ArticleReference[] {
  return [...FDL_10_2025_ARTICLES];
}

/**
 * Get all CR 134/2025 article references.
 */
export function getAllCRArticles(): ArticleReference[] {
  return [...CR_134_2025_ARTICLES];
}

/**
 * Get all CBUAE Notice 3551/2021 section references.
 */
export function getAllCBUAENoticeRefs(): CBUAENoticeRef[] {
  return [...CBUAE_NOTICE_3551_REFS];
}

/**
 * Return the legal warning text for the tipping-off prohibition
 * per FDL 10/2025 Art. 12 and CR 134/2025 Art. 17.
 */
export function getTippingOffWarning(): string {
  return (
    'WARNING — TIPPING-OFF PROHIBITION (FDL 10/2025 Art. 12 / CR 134/2025 Art. 17):\n\n' +
    'It is a criminal offence under Federal Decree-Law No. 10 of 2025, Article 12, ' +
    'and Cabinet Resolution No. 134 of 2025, Article 17, to disclose to any person ' +
    '(including the subject of a report) that a Suspicious Activity Report (SAR) has ' +
    'been or will be filed with the Financial Intelligence Unit (FIU), or that an ' +
    'investigation under this Decree-Law is being or may be carried out.\n\n' +
    'Any person who commits such disclosure shall be liable to imprisonment and/or a fine. ' +
    'This prohibition applies to all employees, officers, and agents of the institution, ' +
    'both during and after the course of their employment or engagement.\n\n' +
    'Violations must be reported immediately to the MLRO and Compliance Department.'
  );
}

/**
 * Return the SAR filing deadline in calendar days.
 * Per FDL 10/2025 Art. 8, the deadline is 30 calendar days
 * from the date of forming a suspicion.
 */
export function getSARFilingDeadline(): number {
  return SAR_FILING_DEADLINE_DAYS;
}

/**
 * Return the CTR (Currency Transaction Report) threshold in AED.
 * Per CBUAE Notice 3551/2021, Section 5.1, the threshold is AED 55,000.
 */
export function getCTRThreshold(): number {
  return CTR_THRESHOLD_AED;
}

/**
 * Return the CBWT (Cash Bearer Withdrawal Threshold) in AED.
 * Per CBUAE Notice 3551/2021, Section 5.1, the threshold is AED 3,500.
 */
export function getCBWTThreshold(): number {
  return CBWT_THRESHOLD_AED;
}

/**
 * Look up the repealed Law 20/2018 reference for a given current reference key.
 * Useful for migration documentation and gap analysis.
 */
export function getRepealedRef(key: string): string | undefined {
  return REGULATORY_REFS[key]?.repealedRef;
}

/**
 * Find all current references that replaced a specific repealed Law 20/2018 article.
 * Useful for regulatory migration tracking.
 */
export function findReplacementRefs(repealedRef: string): RegulatoryRef[] {
  return Object.values(REGULATORY_REFS).filter(
    (ref) => ref.repealedRef === repealedRef
  );
}

/**
 * Get all references that carry a specific penalty category.
 */
export function getRefsByPenaltyCategory(category: 'criminal' | 'administrative' | 'regulatory'): RegulatoryRef[] {
  return Object.values(REGULATORY_REFS).filter(
    (ref) => ref.penaltyCategory === category
  );
}
