/**
 * Oman — CBOA AML/CFT Directive and Royal Decree 34/2015
 * Regulatory Reference Database
 *
 * Maps CBOA regulatory articles to compliance requirements.
 * Reference: Central Bank of Oman (https://www.cbo.gov.om)
 *
 * Phase 2 (Action 2.6): Per-country regulatory reference database.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CBOARegulatoryRef {
  module: string;       // e.g., "CBOA-AML-1", "CBOA-AML-2"
  section: string;      // e.g., "3.1", "4.2"
  title: string;
  requirement: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'AML' | 'CFT' | 'Sanctions' | 'CDD' | 'Reporting' | 'Governance' | 'Record_Keeping';
}

export interface OmanLawRef {
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

// ─── CBOA AML/CFT Directive References ───────────────────────────────────────

export const CBOA_AML_REFS: CBOARegulatoryRef[] = [
  // CBOA AML/CFT Directive 2016 — Section 1: Introduction
  {
    module: 'CBOA-AML-1',
    section: '1.1',
    title: 'Scope and Application',
    requirement: 'This Directive applies to all banks, financial institutions, and money changers licensed and supervised by the Central Bank of Oman.',
    severity: 'medium',
    category: 'Governance',
  },
  {
    module: 'CBOA-AML-1',
    section: '1.2',
    title: 'Legal Framework',
    requirement: 'This Directive is issued pursuant to Royal Decree 34/2015 (AML/CFT Law) and the Banking Law.',
    severity: 'medium',
    category: 'Governance',
  },

  // Section 2: CDD
  {
    module: 'CBOA-AML-2',
    section: '2.1',
    title: 'Customer Due Diligence',
    requirement: 'Banks must apply CDD measures when establishing a business relationship, carrying out occasional transactions above OMR 15,000, or when there is suspicion of ML/TF.', // Verify with SME
    severity: 'critical',
    category: 'CDD',
  },
  {
    module: 'CBOA-AML-2',
    section: '2.2',
    title: 'Enhanced Due Diligence',
    requirement: 'EDD must be applied for PEPs, correspondent banking relationships, and transactions involving high-risk jurisdictions. Senior management approval required.',
    severity: 'critical',
    category: 'CDD',
  },
  {
    module: 'CBOA-AML-2',
    section: '2.3',
    title: 'Beneficial Ownership Identification',
    requirement: 'Banks must identify and verify the beneficial owner(s) of all customers. Threshold: 25% ownership or control.', // Verify with SME
    severity: 'critical',
    category: 'CDD',
  },
  {
    module: 'CBOA-AML-2',
    section: '2.4',
    title: 'Ongoing Monitoring',
    requirement: 'Banks must conduct ongoing monitoring of the business relationship and scrutinise transactions to ensure consistency with knowledge of the customer.',
    severity: 'high',
    category: 'AML',
  },
  {
    module: 'CBOA-AML-2',
    section: '2.5',
    title: 'Simplified Due Diligence',
    requirement: 'SDD may be applied only where the ML/TF risk is demonstrably lower. Must be documented and approved by the compliance function.',
    severity: 'medium',
    category: 'CDD',
  },

  // Section 3: Reporting
  {
    module: 'CBOA-AML-3',
    section: '3.1',
    title: 'MLRO Appointment',
    requirement: 'Banks must appoint a qualified MLRO approved by the CBOA. The MLRO is the single point of contact for all STR filings.',
    severity: 'critical',
    category: 'Governance',
  },
  {
    module: 'CBOA-AML-3',
    section: '3.2',
    title: 'Suspicious Transaction Reporting',
    requirement: 'STRs must be filed with the National Center for Financial Intelligence (NCFI) within 7 business days of detection.', // Verify with SME
    severity: 'critical',
    category: 'Reporting',
  },
  {
    module: 'CBOA-AML-3',
    section: '3.3',
    title: 'Currency Transaction Reporting',
    requirement: 'CTRs must be filed for cash transactions exceeding OMR 15,000 or equivalent.', // Verify with SME
    severity: 'high',
    category: 'Reporting',
  },
  {
    module: 'CBOA-AML-3',
    section: '3.4',
    title: 'Tipping-Off Prohibition',
    requirement: 'Banks and their employees must not disclose to the customer or any third party that an STR has been filed.',
    severity: 'critical',
    category: 'Reporting',
  },

  // Section 4: Sanctions
  {
    module: 'CBOA-AML-4',
    section: '4.1',
    title: 'Sanctions Screening',
    requirement: 'Banks must screen against UN, OFAC, EU, and local Oman sanctions lists. Fail-closed approach required.',
    severity: 'critical',
    category: 'Sanctions',
  },
  {
    module: 'CBOA-AML-4',
    section: '4.2',
    title: 'Asset Freezing',
    requirement: 'Banks must immediately freeze the assets of designated persons/entities and report to the CBOA and NCFI.',
    severity: 'critical',
    category: 'Sanctions',
  },

  // Section 5: Record Keeping
  {
    module: 'CBOA-AML-5',
    section: '5.1',
    title: 'Record Retention',
    requirement: 'All CDD records, transaction data, and STR filings must be retained for a minimum of 10 years after the business relationship ends.',
    severity: 'high',
    category: 'Record_Keeping',
  },

  // Section 6: Governance
  {
    module: 'CBOA-AML-6',
    section: '6.1',
    title: 'Board and Senior Management Oversight',
    requirement: 'The board of directors is ultimately responsible for ensuring the bank maintains effective AML/CFT controls.',
    severity: 'high',
    category: 'Governance',
  },
  {
    module: 'CBOA-AML-6',
    section: '6.2',
    title: 'Independent Audit',
    requirement: 'An independent audit of the AML/CFT programme must be conducted at least annually.',
    severity: 'high',
    category: 'Governance',
  },
  {
    module: 'CBOA-AML-6',
    section: '6.3',
    title: 'Training',
    requirement: 'All employees must receive AML/CFT training upon joining and annually thereafter. Role-specific training for compliance staff.',
    severity: 'high',
    category: 'AML',
  },
  {
    module: 'CBOA-AML-6',
    section: '6.4',
    title: 'Risk Assessment',
    requirement: 'Banks must conduct a comprehensive enterprise-wide AML/CFT risk assessment at least annually.',
    severity: 'high',
    category: 'Governance',
  },
];

// ─── Oman AML/CFT Laws ──────────────────────────────────────────────────────

export const OMAN_AML_LAWS: OmanLawRef[] = [
  {
    lawId: 'Royal-Decree-34-2015',
    title: 'Royal Decree No. 34/2015 on Combating Money Laundering and Terrorism Financing',
    year: 2015,
    description: 'The primary Oman AML/CFT law, replacing the prior 2002 legislation.',
    keyArticles: [
      {
        article: 'Art. 1',
        title: 'Definitions',
        description: 'Defines money laundering, terrorism financing, proceeds, and predicate offences.',
      },
      {
        article: 'Art. 2',
        title: 'Money Laundering Offence',
        description: 'Criminalizes money laundering activities including conversion, transfer, and concealment of proceeds.',
      },
      {
        article: 'Art. 3',
        title: 'Terrorism Financing Offence',
        description: 'Criminalizes the financing of terrorism and terrorist organisations.',
      },
      {
        article: 'Art. 6',
        title: 'CDD Requirements',
        description: 'Mandates customer identification, verification, and ongoing monitoring procedures.',
      },
      {
        article: 'Art. 8',
        title: 'STR Reporting',
        description: 'Requires financial institutions to report suspicious transactions to the NCFI.',
      },
      {
        article: 'Art. 10',
        title: 'Tipping-Off Prohibition',
        description: 'Prohibits disclosure of STR filings to the subject or third parties.',
      },
      {
        article: 'Art. 12',
        title: 'Record Keeping',
        description: 'Specifies record retention requirements for CDD and transaction data.',
      },
      {
        article: 'Art. 16',
        title: 'Penalties',
        description: 'Specifies criminal penalties including imprisonment and fines for AML/CFT violations.', // Verify with SME
      },
    ],
  },
  {
    lawId: 'Executive-Regulation-RD34-2015',
    title: 'Executive Regulation of the AML/CFT Law (Royal Decree 34/2015)',
    year: 2017,
    description: 'Detailed implementing regulation providing specific procedures for CDD, reporting, and compliance.',
    keyArticles: [
      {
        article: 'Art. 4',
        title: 'CDD Procedures',
        description: 'Detailed procedures for customer identification, verification, and risk classification.',
      },
      {
        article: 'Art. 6',
        title: 'Enhanced Due Diligence',
        description: 'Specific EDD measures for PEPs, high-risk customers, and high-risk jurisdictions.',
      },
      {
        article: 'Art. 9',
        title: 'STR Filing Procedures',
        description: 'Procedures and timelines for filing suspicious transaction reports with the NCFI.',
      },
      {
        article: 'Art. 11',
        title: 'Beneficial Ownership',
        description: 'Requirements for identifying and verifying beneficial owners of legal persons and arrangements.',
      },
    ],
  },
  {
    lawId: 'CBOA-CDD-Guidelines',
    title: 'CBOA CDD Guidelines',
    year: 2017,
    description: 'CBOA guidelines providing detailed CDD procedures for banks and financial institutions.',
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

// ─── Oman Labor / PASI References ────────────────────────────────────────────

export const OMAN_LABOR_REFS = {
  pasi: {
    employerRate: 10.5,  // % of salary — Public Authority for Social Insurance
    employeeRate: 6.5,   // % of salary
    authority: 'Public Authority for Social Insurance (PASI)',
    description: 'Oman social insurance scheme covering old-age, disability, and survivors\' benefits for Omani nationals in the private sector.',
  },
  omanization: {
    authority: 'Ministry of Labour',
    description: 'Omanization program requiring companies to employ a minimum percentage of Omani nationals.',
    quotaBySector: 'Varies by sector — typically 35-95% for insurance, banking, and government-related sectors.', // Verify with SME
    minimumQuota: 'Companies with 25+ employees must meet minimum Omanization rates set by the Ministry of Labour.',
  },
  labourLaw: {
    authority: 'Ministry of Labour',
    description: 'Oman Labour Law (Royal Decree 35/2003) governing employment relationships in the private sector.',
    keyReference: 'Royal Decree 35/2003 (Labour Law)',
  },
  wps: {
    authority: 'Ministry of Labour',
    description: 'Wage Protection System requiring employers to pay wages through approved banks.',
  },
};
