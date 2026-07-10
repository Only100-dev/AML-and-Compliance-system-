/**
 * Kuwait — CBK AML/CFT Instructions and Law 106/2013
 * Regulatory Reference Database
 *
 * Maps CBK regulatory articles to compliance requirements.
 * Reference: Central Bank of Kuwait (https://www.cbk.gov.kw)
 *
 * Phase 2 (Action 2.6): Per-country regulatory reference database.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CBKRegulatoryRef {
  module: string;       // e.g., "CBK-AML-1", "CBK-AML-2"
  section: string;      // e.g., "3.1", "4.2"
  title: string;
  requirement: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'AML' | 'CFT' | 'Sanctions' | 'CDD' | 'Reporting' | 'Governance' | 'Record_Keeping';
}

export interface KuwaitLawRef {
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

// ─── CBK AML/CFT Instructions References ─────────────────────────────────────

export const CBK_AML_REFS: CBKRegulatoryRef[] = [
  // CBK AML/CFT Instructions 2014 — Section 1: Introduction
  {
    module: 'CBK-AML-1',
    section: '1.1',
    title: 'Scope and Application',
    requirement: 'These Instructions apply to all banks, financial institutions, exchange companies, and investment companies licensed and supervised by the Central Bank of Kuwait.',
    severity: 'medium',
    category: 'Governance',
  },
  {
    module: 'CBK-AML-1',
    section: '1.2',
    title: 'Legal Framework',
    requirement: 'These Instructions are issued pursuant to Law No. 106 of 2013 on Anti-Money Laundering and Combating the Financing of Terrorism and the CBK Law.',
    severity: 'medium',
    category: 'Governance',
  },

  // Section 2: CDD
  {
    module: 'CBK-AML-2',
    section: '2.1',
    title: 'Customer Due Diligence',
    requirement: 'Banks must apply CDD measures when establishing a business relationship, carrying out occasional transactions above KWD 25,000, or when there is suspicion of ML/TF.', // Verify with SME
    severity: 'critical',
    category: 'CDD',
  },
  {
    module: 'CBK-AML-2',
    section: '2.2',
    title: 'Enhanced Due Diligence',
    requirement: 'EDD must be applied for PEPs, correspondent banking relationships, and transactions involving high-risk jurisdictions. Senior management approval required.',
    severity: 'critical',
    category: 'CDD',
  },
  {
    module: 'CBK-AML-2',
    section: '2.3',
    title: 'Beneficial Ownership Identification',
    requirement: 'Banks must identify and verify the beneficial owner(s) of all customers. Threshold: 25% ownership or control.', // Verify with SME
    severity: 'critical',
    category: 'CDD',
  },
  {
    module: 'CBK-AML-2',
    section: '2.4',
    title: 'Ongoing Monitoring',
    requirement: 'Banks must conduct ongoing monitoring of the business relationship and scrutinise transactions to ensure consistency with knowledge of the customer.',
    severity: 'high',
    category: 'AML',
  },
  {
    module: 'CBK-AML-2',
    section: '2.5',
    title: 'Simplified Due Diligence',
    requirement: 'SDD may be applied only where the ML/TF risk is demonstrably lower. Must be documented and approved by the compliance function.',
    severity: 'medium',
    category: 'CDD',
  },

  // Section 3: Reporting
  {
    module: 'CBK-AML-3',
    section: '3.1',
    title: 'MLRO Appointment',
    requirement: 'Banks must appoint a qualified MLRO approved by the CBK. The MLRO is the single point of contact for all STR filings.',
    severity: 'critical',
    category: 'Governance',
  },
  {
    module: 'CBK-AML-3',
    section: '3.2',
    title: 'Suspicious Transaction Reporting',
    requirement: 'STRs must be filed with the Kuwait Financial Intelligence Unit (KFIU) within 10 business days of detection.', // Verify with SME
    severity: 'critical',
    category: 'Reporting',
  },
  {
    module: 'CBK-AML-3',
    section: '3.3',
    title: 'Currency Transaction Reporting',
    requirement: 'CTRs must be filed for cash transactions exceeding KWD 25,000 or equivalent.', // Verify with SME
    severity: 'high',
    category: 'Reporting',
  },
  {
    module: 'CBK-AML-3',
    section: '3.4',
    title: 'Tipping-Off Prohibition',
    requirement: 'Banks and their employees must not disclose to the customer or any third party that an STR has been filed.',
    severity: 'critical',
    category: 'Reporting',
  },

  // Section 4: Sanctions
  {
    module: 'CBK-AML-4',
    section: '4.1',
    title: 'Sanctions Screening',
    requirement: 'Banks must screen against UN, OFAC, EU, and local Kuwait sanctions lists. Fail-closed approach required.',
    severity: 'critical',
    category: 'Sanctions',
  },
  {
    module: 'CBK-AML-4',
    section: '4.2',
    title: 'Asset Freezing',
    requirement: 'Banks must immediately freeze the assets of designated persons/entities and report to the CBK and KFIU.',
    severity: 'critical',
    category: 'Sanctions',
  },
  {
    module: 'CBK-AML-4',
    section: '4.3',
    title: 'Sanctions List Updates',
    requirement: 'Banks must implement procedures to ensure timely identification of updates to sanctions lists and apply them immediately.',
    severity: 'high',
    category: 'Sanctions',
  },

  // Section 5: Record Keeping
  {
    module: 'CBK-AML-5',
    section: '5.1',
    title: 'Record Retention',
    requirement: 'All CDD records, transaction data, and STR filings must be retained for a minimum of 10 years after the business relationship ends.',
    severity: 'high',
    category: 'Record_Keeping',
  },

  // Section 6: Governance
  {
    module: 'CBK-AML-6',
    section: '6.1',
    title: 'Board and Senior Management Oversight',
    requirement: 'The board of directors is ultimately responsible for ensuring the bank maintains effective AML/CFT controls.',
    severity: 'high',
    category: 'Governance',
  },
  {
    module: 'CBK-AML-6',
    section: '6.2',
    title: 'Independent Audit',
    requirement: 'An independent audit of the AML/CFT programme must be conducted at least annually.',
    severity: 'high',
    category: 'Governance',
  },
  {
    module: 'CBK-AML-6',
    section: '6.3',
    title: 'Training',
    requirement: 'All employees must receive AML/CFT training upon joining and annually thereafter. Role-specific training for compliance staff.',
    severity: 'high',
    category: 'AML',
  },
  {
    module: 'CBK-AML-6',
    section: '6.4',
    title: 'Risk Assessment',
    requirement: 'Banks must conduct a comprehensive enterprise-wide AML/CFT risk assessment at least annually.',
    severity: 'high',
    category: 'Governance',
  },
];

// ─── Kuwait AML/CFT Laws ────────────────────────────────────────────────────

export const KUWAIT_AML_LAWS: KuwaitLawRef[] = [
  {
    lawId: 'Law-106-2013',
    title: 'Law No. 106 of 2013 on Anti-Money Laundering and Combating the Financing of Terrorism',
    year: 2013,
    description: 'The primary Kuwait AML/CFT law, replacing the prior 2002 legislation.',
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
        description: 'Criminalizes the financing of terrorism, terrorist acts, and terrorist organisations.',
      },
      {
        article: 'Art. 7',
        title: 'CDD Requirements',
        description: 'Mandates customer identification, verification, and ongoing monitoring procedures.',
      },
      {
        article: 'Art. 9',
        title: 'STR Reporting',
        description: 'Requires financial institutions to report suspicious transactions to the KFIU.',
      },
      {
        article: 'Art. 11',
        title: 'Tipping-Off Prohibition',
        description: 'Prohibits disclosure of STR filings to the subject or third parties.',
      },
      {
        article: 'Art. 13',
        title: 'Record Keeping',
        description: 'Specifies record retention requirements for CDD and transaction data.',
      },
      {
        article: 'Art. 17',
        title: 'Penalties',
        description: 'Specifies criminal penalties including imprisonment and fines for AML/CFT violations.', // Verify with SME
      },
    ],
  },
  {
    lawId: 'Ministerial-Resolution-174-2014',
    title: 'Ministerial Resolution No. 174/2014 (Executive By-Law of Law 106/2013)',
    year: 2014,
    description: 'Detailed executive regulation providing specific procedures for CDD, reporting, and compliance under Law 106/2013.',
    keyArticles: [
      {
        article: 'Art. 4',
        title: 'CDD Procedures',
        description: 'Detailed procedures for customer identification, verification, and risk classification.',
      },
      {
        article: 'Art. 7',
        title: 'Enhanced Due Diligence',
        description: 'Specific EDD measures for PEPs, high-risk customers, and high-risk jurisdictions.',
      },
      {
        article: 'Art. 10',
        title: 'STR Filing Procedures',
        description: 'Procedures and timelines for filing suspicious transaction reports with the KFIU.',
      },
      {
        article: 'Art. 13',
        title: 'Beneficial Ownership',
        description: 'Requirements for identifying and verifying beneficial owners of legal persons and arrangements.',
      },
      {
        article: 'Art. 16',
        title: 'Record Retention',
        description: 'Detailed record retention requirements and availability for competent authorities.',
      },
    ],
  },
  {
    lawId: 'CBK-CDD-Directives',
    title: 'CBK CDD Directives',
    year: 2015,
    description: 'CBK directives providing detailed CDD procedures for banks and financial institutions.',
    keyArticles: [
      {
        article: 'Sec. 3',
        title: 'Customer Identification',
        description: 'Requirements for verifying customer identity using reliable, independent source documents.',
      },
      {
        article: 'Sec. 5',
        title: 'PEP Procedures',
        description: 'Enhanced due diligence requirements for politically exposed persons.',
      },
      {
        article: 'Sec. 8',
        title: 'Correspondent Banking',
        description: 'EDD requirements for cross-border correspondent banking relationships.',
      },
    ],
  },
];

// ─── Kuwait Labor / PIFSS References ─────────────────────────────────────────

export const KUWAIT_LABOR_REFS = {
  pifss: {
    employerRate: 11.5,  // % of salary — Public Institution for Social Security
    employeeRate: 7.5,   // % of salary
    authority: 'Public Institution for Social Security (PIFSS)',
    description: 'Kuwait social insurance scheme covering old-age, disability, survivors\' benefits, and employment injuries.',
  },
  kuwaitization: {
    authority: 'Ministry of Social Affairs and Labour',
    description: 'Kuwaitization policy requiring private sector companies to employ a minimum percentage of Kuwaiti nationals.',
    targetRate: 'Varies by sector — typically 10-40% depending on industry and company size.', // Verify with SME
    minimumRequirement: 'Companies must meet Kuwaitization quotas as set by the Manpower and Government Restructuring Programme (MGRP).',
  },
  labourLaw: {
    authority: 'Ministry of Social Affairs and Labour',
    description: 'Kuwait Labour Law (Law No. 6 of 2010) governing employment relationships in the private sector.',
    keyReference: 'Law No. 6 of 2010 (Labour Law in the Private Sector)',
  },
  wps: {
    authority: 'Ministry of Social Affairs and Labour',
    description: 'Wage Protection System requiring employers to pay wages through approved banks within specified timelines.',
  },
};
