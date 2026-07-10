/**
 * Bahrain CBB Rulebook Volume 3 — Financial Crime Module
 * Regulatory Reference Database
 *
 * Maps CBB regulatory articles to compliance requirements.
 * Reference: CBB Rulebook (https://www.cbb.gov.bh)
 *
 * Phase 2 (Action 2.6): Per-country regulatory reference database.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CBBRegulatoryRef {
  module: string;       // e.g., "FC-1", "FC-2", "FC-3"
  section: string;      // e.g., "FC-2.1", "FC-3.1"
  title: string;
  requirement: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'AML' | 'CFT' | 'Sanctions' | 'CDD' | 'Reporting' | 'Governance' | 'Record_Keeping';
}

export interface BahrainLawRef {
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

// ─── CBB Rulebook Volume 3 — Financial Crime Module References ───────────────

export const CBB_VOLUME3_REFS: CBBRegulatoryRef[] = [
  // FC-1: Introduction
  {
    module: 'FC-1',
    section: 'FC-1.1',
    title: 'Scope of Application',
    requirement: 'This Module applies to all licensees authorised by the CBB.',
    severity: 'medium',
    category: 'Governance',
  },
  {
    module: 'FC-1',
    section: 'FC-1.2',
    title: 'Compliance with the Module',
    requirement: 'Licensees must comply with all requirements of this Module. Contravention may result in enforcement action by the CBB.',
    severity: 'high',
    category: 'Governance',
  },

  // FC-2: AML/CFT Obligations
  {
    module: 'FC-2',
    section: 'FC-2.1',
    title: 'Customer Due Diligence',
    requirement: 'Licensees must apply CDD measures when establishing a business relationship, carrying out an occasional transaction, or when there is a suspicion of ML/TF.',
    severity: 'critical',
    category: 'CDD',
  },
  {
    module: 'FC-2',
    section: 'FC-2.2',
    title: 'Enhanced Due Diligence',
    requirement: 'EDD must be applied for PEPs, high-risk business relationships, and transactions involving high-risk jurisdictions. Senior management approval required.',
    severity: 'critical',
    category: 'CDD',
  },
  {
    module: 'FC-2',
    section: 'FC-2.3',
    title: 'Ongoing Monitoring',
    requirement: 'Licensees must conduct ongoing monitoring of the business relationship including scrutiny of transactions to ensure consistency with the licensee\'s knowledge of the customer.',
    severity: 'high',
    category: 'AML',
  },
  {
    module: 'FC-2',
    section: 'FC-2.4',
    title: 'Simplified Due Diligence',
    requirement: 'SDD may be applied only where the ML/TF risk is demonstrably lower. Must be documented and approved by the compliance function.',
    severity: 'medium',
    category: 'CDD',
  },
  {
    module: 'FC-2',
    section: 'FC-2.5',
    title: 'Beneficial Ownership Identification',
    requirement: 'Licensees must identify and verify the beneficial owner(s) of all customers, including legal persons and arrangements. The threshold for identification is 25% ownership or control.', // Verify with SME
    severity: 'critical',
    category: 'CDD',
  },

  // FC-3: Reporting Requirements
  {
    module: 'FC-3',
    section: 'FC-3.1',
    title: 'MLRO Appointment',
    requirement: 'Licensees must appoint an MLRO who is approved by the CBB. The MLRO is the single point of contact for all STR filings.',
    severity: 'critical',
    category: 'Governance',
  },
  {
    module: 'FC-3',
    section: 'FC-3.2',
    title: 'Suspicious Transaction Reporting',
    requirement: 'STRs must be filed with the CBB Financial Intelligence Directorate (FID) within 5 business days of detection.',
    severity: 'critical',
    category: 'Reporting',
  },
  {
    module: 'FC-3',
    section: 'FC-3.3',
    title: 'Currency Transaction Reporting',
    requirement: 'CTRs must be filed for all cash transactions exceeding BHD 10,000 or equivalent.',
    severity: 'high',
    category: 'Reporting',
  },
  {
    module: 'FC-3',
    section: 'FC-3.4',
    title: 'Tipping-Off Prohibition',
    requirement: 'Licensees and their employees must not disclose to the customer or any third party that an STR has been filed or that an investigation is underway.',
    severity: 'critical',
    category: 'Reporting',
  },

  // FC-4: Sanctions
  {
    module: 'FC-4',
    section: 'FC-4.1',
    title: 'Sanctions Screening',
    requirement: 'Licensees must screen all customers, transactions, and counterparties against applicable sanctions lists (UN, OFAC, EU, HMT, Bahrain Local List).',
    severity: 'critical',
    category: 'Sanctions',
  },
  {
    module: 'FC-4',
    section: 'FC-4.2',
    title: 'Freezing of Assets',
    requirement: 'Licensees must immediately freeze the assets of any person or entity designated on a sanctions list and report to the CBB.',
    severity: 'critical',
    category: 'Sanctions',
  },
  {
    module: 'FC-4',
    section: 'FC-4.3',
    title: 'Sanctions List Updates',
    requirement: 'Licensees must implement procedures to ensure timely identification of updates to sanctions lists and apply them immediately.',
    severity: 'high',
    category: 'Sanctions',
  },

  // FC-5: Record Keeping
  {
    module: 'FC-5',
    section: 'FC-5.1',
    title: 'Record Retention',
    requirement: 'All CDD records, transaction data, and STR filings must be retained for a minimum of 5 years after the business relationship ends.', // Verify with SME — some sources indicate 10 years
    severity: 'high',
    category: 'Record_Keeping',
  },
  {
    module: 'FC-5',
    section: 'FC-5.2',
    title: 'Availability of Records',
    requirement: 'Records must be made available to the CBB upon request within a reasonable timeframe.',
    severity: 'medium',
    category: 'Record_Keeping',
  },

  // FC-6: Governance
  {
    module: 'FC-6',
    section: 'FC-6.1',
    title: 'Board and Senior Management Oversight',
    requirement: 'The board of directors is ultimately responsible for ensuring the licensee maintains effective AML/CFT controls.',
    severity: 'high',
    category: 'Governance',
  },
  {
    module: 'FC-6',
    section: 'FC-6.2',
    title: 'Independent Audit',
    requirement: 'An independent audit of the AML/CFT programme must be conducted at least annually.',
    severity: 'high',
    category: 'Governance',
  },
  {
    module: 'FC-6',
    section: 'FC-6.3',
    title: 'Training',
    requirement: 'All employees must receive AML/CFT training upon joining and annually thereafter. Role-specific training for compliance staff.',
    severity: 'high',
    category: 'AML',
  },
  {
    module: 'FC-6',
    section: 'FC-6.4',
    title: 'Risk Assessment',
    requirement: 'Licensees must conduct a comprehensive AML/CFT risk assessment at least annually and whenever material changes occur.',
    severity: 'high',
    category: 'Governance',
  },
];

// ─── Bahrain AML/CFT Laws ───────────────────────────────────────────────────

export const BAHRAIN_AML_LAWS: BahrainLawRef[] = [
  {
    lawId: 'Decree-Law-4-2001',
    title: 'Decree Law No. 4 of 2001 on Prevention of Money Laundering',
    year: 2001,
    description: 'The primary Bahraini AML law, as amended by Law No. 54 of 2006.',
    keyArticles: [
      {
        article: 'Art. 2',
        title: 'Money Laundering Offence',
        description: 'Defines the offence of money laundering and specifies the predicate offences.',
      },
      {
        article: 'Art. 4',
        title: 'Reporting Obligation',
        description: 'Requires financial institutions to report suspicious transactions to the relevant authority.',
      },
      {
        article: 'Art. 7',
        title: 'CDD Requirements',
        description: 'Mandates customer identification and verification procedures.',
      },
      {
        article: 'Art. 9',
        title: 'Record Keeping',
        description: 'Requires retention of records for a minimum period after the business relationship ends.',
      },
    ],
  },
  {
    lawId: 'Law-Decree-58-2006',
    title: 'Law Decree No. 58 of 2006 on Combating Terrorism Financing',
    year: 2006,
    description: 'Bahrain law specifically addressing terrorism financing.',
    keyArticles: [
      {
        article: 'Art. 1',
        title: 'Terrorism Financing Offence',
        description: 'Defines the offence of financing terrorism and terrorist acts.',
      },
      {
        article: 'Art. 3',
        title: 'Freezing of Terrorist Assets',
        description: 'Requires immediate freezing of assets belonging to designated terrorist entities.',
      },
    ],
  },
  {
    lawId: 'Law-54-2006',
    title: 'Law No. 54 of 2006 (Amending Decree Law No. 4 of 2001)',
    year: 2006,
    description: 'Amendment to the AML law expanding scope and penalties.',
    keyArticles: [
      {
        article: 'Art. 1',
        title: 'Expanded Predicate Offences',
        description: 'Expanded the list of predicate offences for money laundering.',
      },
    ],
  },
  {
    lawId: 'Law-54-2018',
    title: 'Law No. 54 of 2018 on Combating Money Laundering and Terrorism Financing',
    year: 2018,
    description: 'Comprehensive replacement AML/CFT law aligning Bahrain with FATF recommendations.',
    keyArticles: [
      {
        article: 'Art. 2',
        title: 'Money Laundering Offence (Updated)',
        description: 'Revised and expanded definition of money laundering, including self-laundering.',
      },
      {
        article: 'Art. 4',
        title: 'Terrorism Financing Offence (Updated)',
        description: 'Revised definition of terrorism financing aligned with international conventions.',
      },
      {
        article: 'Art. 6',
        title: 'CDD and Record-Keeping Obligations',
        description: 'Comprehensive CDD, EDD, and record-keeping requirements for financial institutions.',
      },
      {
        article: 'Art. 10',
        title: 'STR Reporting Obligation',
        description: 'Mandatory suspicious transaction reporting to the Financial Intelligence Directorate.',
      },
      {
        article: 'Art. 14',
        title: 'Penalties',
        description: 'Specifies criminal penalties including imprisonment and fines for AML/CFT violations.', // Verify with SME
      },
    ],
  },
];

// ─── Bahrain Labor / SIO References ─────────────────────────────────────────

export const BAHRAIN_LABOR_REFS = {
  sio: {
    employerRate: 7,    // % of salary — Social Insurance Organization
    employeeRate: 5,    // % of salary
    authority: 'Social Insurance Organization (SIO)',
    description: 'Bahrain social insurance scheme covering old-age, disability, and survivors\' benefits.',
  },
  lmra: {
    authority: 'Labour Market Regulatory Authority (LMRA)',
    description: 'Regulates expatriate work permits, labour mobility, and Bahrainization quotas.',
    bahrainizationQuota: 'Varies by sector — typically 20-50% Bahraini workforce requirement.', // Verify with SME
  },
  labourLaw: {
    authority: 'Ministry of Labour',
    description: 'Bahrain Labour Law (Law No. 36 of 2012) governing employment relationships.',
    keyReference: 'Law No. 36 of 2012 (Promulgating the Labour Law in the Private Sector)',
  },
};
