/**
 * Kingdom of Saudi Arabia — SAMA AML/CFT Rules
 * Regulatory Reference Database
 *
 * Maps SAMA regulatory articles to compliance requirements.
 * Reference: SAMA (https://www.sama.gov.sa)
 *
 * Phase 2 (Action 2.6): Per-country regulatory reference database.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SAMARegulatoryRef {
  ruleNumber: string;
  section: string;
  title: string;
  requirement: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'AML' | 'CFT' | 'Sanctions' | 'CDD' | 'Reporting' | 'Governance' | 'Record_Keeping';
}

export interface KSALawRef {
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

// ─── SAMA AML/CFT Rules References ──────────────────────────────────────────

export const SAMA_AML_REFS: SAMARegulatoryRef[] = [
  // SAMA AML/CFT Rules 2017
  {
    ruleNumber: 'Rule-1',
    section: '1.1',
    title: 'Scope and Application',
    requirement: 'These Rules apply to all financial institutions supervised by SAMA.',
    severity: 'medium',
    category: 'Governance',
  },
  {
    ruleNumber: 'Rule-1',
    section: '1.2',
    title: 'Legal Framework',
    requirement: 'These Rules are issued pursuant to the Banking Control Law and the Anti-Money Laundering Law (Royal Decree M/39).',
    severity: 'medium',
    category: 'Governance',
  },
  {
    ruleNumber: 'Rule-2',
    section: '2.1',
    title: 'Customer Due Diligence',
    requirement: 'Financial institutions must apply CDD measures when establishing a business relationship, carrying out occasional transactions above SAR 60,000, or when there is suspicion of ML/TF.', // Verify with SME
    severity: 'critical',
    category: 'CDD',
  },
  {
    ruleNumber: 'Rule-2',
    section: '2.2',
    title: 'Enhanced Due Diligence',
    requirement: 'EDD must be applied for PEPs, correspondent banking relationships, and transactions involving high-risk jurisdictions.',
    severity: 'critical',
    category: 'CDD',
  },
  {
    ruleNumber: 'Rule-2',
    section: '2.3',
    title: 'Beneficial Ownership Identification',
    requirement: 'Financial institutions must identify and verify the beneficial owner(s) of all customers, including legal persons and arrangements. The threshold for identification is 25% ownership or control.', // Verify with SME
    severity: 'critical',
    category: 'CDD',
  },
  {
    ruleNumber: 'Rule-2',
    section: '2.4',
    title: 'Ongoing Monitoring',
    requirement: 'Financial institutions must conduct ongoing monitoring of the business relationship and scrutinize transactions to ensure consistency with knowledge of the customer.',
    severity: 'high',
    category: 'AML',
  },
  {
    ruleNumber: 'Rule-3',
    section: '3.1',
    title: 'SAR/STR Reporting',
    requirement: 'Suspicious Activity/Transaction Reports must be filed with SAMA FIU within 15 calendar days of detection.', // Verify with SME
    severity: 'critical',
    category: 'Reporting',
  },
  {
    ruleNumber: 'Rule-3',
    section: '3.2',
    title: 'Currency Transaction Reporting',
    requirement: 'CTRs must be filed for cash transactions exceeding SAR 60,000 or equivalent.', // Verify with SME
    severity: 'high',
    category: 'Reporting',
  },
  {
    ruleNumber: 'Rule-3',
    section: '3.3',
    title: 'Tipping-Off Prohibition',
    requirement: 'Financial institutions and their employees must not disclose to the customer or any third party that an SAR/STR has been filed.',
    severity: 'critical',
    category: 'Reporting',
  },
  {
    ruleNumber: 'Rule-4',
    section: '4.1',
    title: 'Sanctions Screening',
    requirement: 'Financial institutions must screen against UN, OFAC, and local Saudi sanctions lists. Fail-closed approach required.',
    severity: 'critical',
    category: 'Sanctions',
  },
  {
    ruleNumber: 'Rule-4',
    section: '4.2',
    title: 'Asset Freezing',
    requirement: 'Financial institutions must immediately freeze the assets of designated persons/entities and report to SAMA.',
    severity: 'critical',
    category: 'Sanctions',
  },
  {
    ruleNumber: 'Rule-5',
    section: '5.1',
    title: 'Record Keeping',
    requirement: 'All CDD records, transaction data, and SAR filings must be retained for 10 years after the business relationship ends.', // Verify with SME
    severity: 'high',
    category: 'Record_Keeping',
  },
  {
    ruleNumber: 'Rule-6',
    section: '6.1',
    title: 'MLRO Appointment',
    requirement: 'Financial institutions must appoint a qualified MLRO approved by SAMA.',
    severity: 'critical',
    category: 'Governance',
  },
  {
    ruleNumber: 'Rule-7',
    section: '7.1',
    title: 'Training',
    requirement: 'All staff must receive AML/CFT training upon joining and annually thereafter.',
    severity: 'high',
    category: 'AML',
  },
  {
    ruleNumber: 'Rule-8',
    section: '8.1',
    title: 'Independent Audit',
    requirement: 'Financial institutions must conduct an independent audit of their AML/CFT programme at least annually.',
    severity: 'high',
    category: 'Governance',
  },
  {
    ruleNumber: 'Rule-9',
    section: '9.1',
    title: 'Risk Assessment',
    requirement: 'Financial institutions must conduct a comprehensive enterprise-wide AML/CFT risk assessment at least annually.',
    severity: 'high',
    category: 'Governance',
  },
];

// ─── KSA AML/CFT Laws ───────────────────────────────────────────────────────

export const KSA_AML_LAWS: KSALawRef[] = [
  {
    lawId: 'Royal-Decree-M39',
    title: 'Anti-Money Laundering Law (Royal Decree M/39)',
    year: 2018,
    description: 'The primary KSA anti-money laundering law.',
    keyArticles: [
      {
        article: 'Art. 1',
        title: 'Definitions',
        description: 'Defines money laundering, proceeds, and predicate offences.',
      },
      {
        article: 'Art. 2',
        title: 'Money Laundering Offence',
        description: 'Criminalizes money laundering activities including conversion, transfer, and concealment of proceeds.',
      },
      {
        article: 'Art. 5',
        title: 'Reporting Obligation',
        description: 'Requires financial institutions to report suspicious transactions.',
      },
      {
        article: 'Art. 7',
        title: 'CDD Requirements',
        description: 'Mandates customer identification and verification.',
      },
      {
        article: 'Art. 9',
        title: 'Record Keeping',
        description: 'Specifies record retention requirements.',
      },
      {
        article: 'Art. 12',
        title: 'Penalties',
        description: 'Specifies criminal and administrative penalties for AML violations, including imprisonment up to 10 years and fines up to SAR 5,000,000.', // Verify with SME
      },
    ],
  },
  {
    lawId: 'Terrorism-Financing-Control-Law',
    title: 'Terrorism Financing Control Law',
    year: 2018,
    description: 'KSA law specifically addressing terrorism financing and sanctions.',
    keyArticles: [
      {
        article: 'Art. 1',
        title: 'Terrorism Financing Offence',
        description: 'Defines and criminalizes terrorism financing.',
      },
      {
        article: 'Art. 3',
        title: 'Freezing of Assets',
        description: 'Requires freezing of assets of designated entities.',
      },
      {
        article: 'Art. 5',
        title: 'Reporting Obligation',
        description: 'Obligation to report knowledge or suspicion of terrorism financing to the competent authority.',
      },
    ],
  },
  {
    lawId: 'SAMA-Implementing-Regulation',
    title: 'SAMA Implementing Regulation for AML/CFT',
    year: 2018,
    description: 'Detailed implementing rules for the AML law, issued by SAMA.',
    keyArticles: [
      {
        article: 'Art. 3',
        title: 'CDD Procedures',
        description: 'Detailed customer due diligence procedures and timelines.',
      },
      {
        article: 'Art. 5',
        title: 'STR Filing Procedures',
        description: 'Procedures and timelines for filing suspicious transaction reports with SAMA FIU.',
      },
      {
        article: 'Art. 7',
        title: 'Beneficial Ownership',
        description: 'Requirements for identifying beneficial owners of legal persons and arrangements.',
      },
    ],
  },
];

// ─── KSA Labor / GOSI References ────────────────────────────────────────────

export const KSA_LABOR_REFS = {
  gosi: {
    employerRate: 11.75, // % of salary
    employeeRate: 9.75,  // % of salary
    authority: 'General Organization for Social Insurance (GOSI)',
    description: 'Saudi social insurance scheme covering old-age, disability, survivors\' benefits, and occupational hazards.',
  },
  nitaqat: {
    tiers: ['Platinum', 'Gold', 'Green', 'Yellow', 'Red'] as const,
    description: 'Saudization program requiring private sector companies to hire Saudi nationals based on company size and industry.',
    minimumSaudizationRate: 'Varies by Nitaqat tier and industry — typically 10-30% for Green tier.', // Verify with SME
  },
  mhrsd: {
    authority: 'Ministry of Human Resources and Social Development (MHRSD)',
    description: 'Regulates labor relations, work permits, and employment standards in KSA.',
    keyReference: 'Labour Law (Royal Decree M/51)',
  },
};
