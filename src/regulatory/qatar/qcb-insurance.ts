/**
 * Qatar — QCB AML/CFT Instructions and Law 20/2019
 * Regulatory Reference Database
 *
 * Maps QCB regulatory articles to compliance requirements.
 * Reference: Qatar Central Bank (https://www.qcb.gov.qa)
 *
 * Phase 2 (Action 2.6): Per-country regulatory reference database.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QCBRegulatoryRef {
  module: string;       // e.g., "QCB-AML-1", "QCB-AML-2"
  section: string;      // e.g., "4.1", "5.2"
  title: string;
  requirement: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'AML' | 'CFT' | 'Sanctions' | 'CDD' | 'Reporting' | 'Governance' | 'Record_Keeping';
}

export interface QatarLawRef {
  lawId: string;
  title: string;
  year: number;
  description: string;
  keyArticles: Array<{
    article: string;
    title: string;
    description: string;
  }>;
}

// ─── QCB AML/CFT Instructions References ─────────────────────────────────────

export const QCB_AML_REFS: QCBRegulatoryRef[] = [
  // QCB AML/CFT Instructions — Section 1: Introduction
  {
    module: 'QCB-AML-1',
    section: '1.1',
    title: 'Scope and Application',
    requirement: 'These Instructions apply to all financial institutions, designated non-financial businesses and professions (DNFBPs), and non-profit organisations subject to QCB oversight.',
    severity: 'medium',
    category: 'Governance',
  },
  {
    module: 'QCB-AML-1',
    section: '1.2',
    title: 'Legal Framework',
    requirement: 'These Instructions are issued pursuant to Law No. 20 of 2019 on Anti-Money Laundering and Combating the Financing of Terrorism.',
    severity: 'medium',
    category: 'Governance',
  },

  // Section 2: CDD
  {
    module: 'QCB-AML-2',
    section: '2.1',
    title: 'Customer Due Diligence',
    requirement: 'Financial institutions must apply CDD measures when establishing a business relationship, carrying out occasional transactions above QAR 200,000, or when there is suspicion of ML/TF.', // Verify with SME
    severity: 'critical',
    category: 'CDD',
  },
  {
    module: 'QCB-AML-2',
    section: '2.2',
    title: 'Enhanced Due Diligence',
    requirement: 'EDD must be applied for PEPs, correspondent banking relationships, and transactions involving high-risk jurisdictions. Senior management approval required.',
    severity: 'critical',
    category: 'CDD',
  },
  {
    module: 'QCB-AML-2',
    section: '2.3',
    title: 'Beneficial Ownership Identification',
    requirement: 'Financial institutions must identify and verify the beneficial owner(s) of all customers. Threshold: 25% ownership or control (Decision No. 1/2020).', // Verify with SME
    severity: 'critical',
    category: 'CDD',
  },
  {
    module: 'QCB-AML-2',
    section: '2.4',
    title: 'Ongoing Monitoring',
    requirement: 'Financial institutions must conduct ongoing monitoring of business relationships and scrutiny of transactions.',
    severity: 'high',
    category: 'AML',
  },
  {
    module: 'QCB-AML-2',
    section: '2.5',
    title: 'Simplified Due Diligence',
    requirement: 'SDD may be applied only where the ML/TF risk is demonstrably lower. Must be documented and approved by the compliance function.',
    severity: 'medium',
    category: 'CDD',
  },

  // Section 3: Reporting
  {
    module: 'QCB-AML-3',
    section: '3.1',
    title: 'MLRO Appointment',
    requirement: 'Financial institutions must appoint an MLRO who is approved by QCB. The MLRO is the single point of contact for all STR filings.',
    severity: 'critical',
    category: 'Governance',
  },
  {
    module: 'QCB-AML-3',
    section: '3.2',
    title: 'Suspicious Transaction Reporting',
    requirement: 'STRs must be filed with the Qatar Financial Information Unit (QFIU) within 3 business days of detection.',
    severity: 'critical',
    category: 'Reporting',
  },
  {
    module: 'QCB-AML-3',
    section: '3.3',
    title: 'Currency Transaction Reporting',
    requirement: 'CTRs must be filed for cash transactions exceeding QAR 200,000 or equivalent.', // Verify with SME
    severity: 'high',
    category: 'Reporting',
  },
  {
    module: 'QCB-AML-3',
    section: '3.4',
    title: 'Tipping-Off Prohibition',
    requirement: 'Financial institutions and their employees must not disclose to the customer or any third party that an STR has been filed.',
    severity: 'critical',
    category: 'Reporting',
  },

  // Section 4: Sanctions
  {
    module: 'QCB-AML-4',
    section: '4.1',
    title: 'Sanctions Screening',
    requirement: 'Financial institutions must screen against UN, OFAC, EU, and local Qatar sanctions lists. Fail-closed approach required for matches.',
    severity: 'critical',
    category: 'Sanctions',
  },
  {
    module: 'QCB-AML-4',
    section: '4.2',
    title: 'Asset Freezing',
    requirement: 'Financial institutions must immediately freeze the assets of designated persons/entities and report to QCB.',
    severity: 'critical',
    category: 'Sanctions',
  },

  // Section 5: Record Keeping
  {
    module: 'QCB-AML-5',
    section: '5.1',
    title: 'Record Retention',
    requirement: 'All CDD records, transaction data, and STR filings must be retained for a minimum of 10 years after the business relationship ends.',
    severity: 'high',
    category: 'Record_Keeping',
  },

  // Section 6: Governance
  {
    module: 'QCB-AML-6',
    section: '6.1',
    title: 'Board and Senior Management Oversight',
    requirement: 'The board of directors is ultimately responsible for ensuring effective AML/CFT controls within the institution.',
    severity: 'high',
    category: 'Governance',
  },
  {
    module: 'QCB-AML-6',
    section: '6.2',
    title: 'Independent Audit',
    requirement: 'An independent audit of the AML/CFT programme must be conducted at least annually.',
    severity: 'high',
    category: 'Governance',
  },
  {
    module: 'QCB-AML-6',
    section: '6.3',
    title: 'Training',
    requirement: 'All employees must receive AML/CFT training upon joining and annually thereafter. Role-specific training required for compliance staff.',
    severity: 'high',
    category: 'AML',
  },
  {
    module: 'QCB-AML-6',
    section: '6.4',
    title: 'Risk Assessment',
    requirement: 'Financial institutions must conduct a comprehensive enterprise-wide AML/CFT risk assessment at least annually.',
    severity: 'high',
    category: 'Governance',
  },
];

// ─── Qatar AML/CFT Laws ─────────────────────────────────────────────────────

export const QATAR_AML_LAWS: QatarLawRef[] = [
  {
    lawId: 'Law-20-2019',
    title: 'Law No. 20 of 2019 on Anti-Money Laundering and Combating the Financing of Terrorism',
    year: 2019,
    description: 'The primary Qatar AML/CFT law, replacing the prior 2010 legislation.',
    keyArticles: [
      {
        article: 'Art. 1',
        title: 'Definitions',
        description: 'Defines money laundering, terrorism financing, proceeds, and predicate offences.',
      },
      {
        article: 'Art. 2',
        title: 'Money Laundering Offence',
        description: 'Criminalizes money laundering including conversion, transfer, concealment, and acquisition of proceeds.',
      },
      {
        article: 'Art. 3',
        title: 'Terrorism Financing Offence',
        description: 'Criminalizes the financing of terrorism and terrorist acts.',
      },
      {
        article: 'Art. 5',
        title: 'CDD Requirements',
        description: 'Mandates customer identification, verification, and ongoing monitoring procedures.',
      },
      {
        article: 'Art. 7',
        title: 'STR Reporting',
        description: 'Requires financial institutions to report suspicious transactions to the QFIU.',
      },
      {
        article: 'Art. 9',
        title: 'Tipping-Off Prohibition',
        description: 'Prohibits disclosure of STR filings to the subject or third parties.',
      },
      {
        article: 'Art. 11',
        title: 'Record Keeping',
        description: 'Specifies record retention requirements for CDD and transaction data.',
      },
      {
        article: 'Art. 15',
        title: 'Penalties',
        description: 'Specifies criminal penalties including imprisonment and fines for AML/CFT violations.', // Verify with SME
      },
    ],
  },
  {
    lawId: 'Decision-1-2020',
    title: 'Decision No. 1 of 2020 on Beneficial Ownership',
    year: 2020,
    description: 'Qatar regulation on beneficial ownership transparency and disclosure requirements.',
    keyArticles: [
      {
        article: 'Art. 2',
        title: 'Beneficial Owner Definition',
        description: 'Defines beneficial owner as any natural person who ultimately owns or controls 25% or more of the legal person.', // Verify with SME
      },
      {
        article: 'Art. 4',
        title: 'Disclosure Obligation',
        description: 'Legal persons must maintain accurate and current information on their beneficial owners and make it available to competent authorities.',
      },
      {
        article: 'Art. 6',
        title: 'Non-Compliance Penalties',
        description: 'Specifies administrative penalties for failure to comply with beneficial ownership disclosure requirements.', // Verify with SME
      },
    ],
  },
  {
    lawId: 'QCB-CDD-Directives',
    title: 'QCB CDD Directives',
    year: 2020,
    description: 'QCB directives providing detailed CDD procedures and requirements for financial institutions.',
    keyArticles: [
      {
        article: 'Sec. 3',
        title: 'Customer Identification',
        description: 'Detailed requirements for verifying customer identity using reliable, independent source documents.',
      },
      {
        article: 'Sec. 5',
        title: 'PEP Procedures',
        description: 'Enhanced due diligence requirements for politically exposed persons.',
      },
      {
        article: 'Sec. 7',
        title: 'Correspondent Banking',
        description: 'EDD requirements for correspondent banking relationships.',
      },
    ],
  },
];

// ─── Qatar Labor / GRSIA References ─────────────────────────────────────────

export const QATAR_LABOR_REFS = {
  grsia: {
    employerRate: 10,    // % of salary — General Retirement and Social Insurance Authority
    employeeRate: 5,     // % of salary
    authority: 'General Retirement and Social Insurance Authority (GRSIA)',
    description: 'Qatar social insurance scheme covering pensions, disability, and survivors\' benefits for Qatari nationals.',
  },
  qatarization: {
    authority: 'Ministry of Labour',
    description: 'Qatarization program requiring companies in certain sectors to employ a minimum percentage of Qatari nationals.',
    targetRate: 'Varies by sector — typically 20-50% for financial services and energy sectors.', // Verify with SME
  },
  labourLaw: {
    authority: 'Ministry of Labour',
    description: 'Qatar Labour Law (Law No. 14 of 2004) governing employment relationships in the private sector.',
    keyReference: 'Law No. 14 of 2004 (Labour Law)',
  },
  wps: {
    authority: 'Ministry of Labour',
    description: 'Wage Protection System (WPS) requiring employers to pay wages through approved banks within 7 days of the due date.',
  },
};
