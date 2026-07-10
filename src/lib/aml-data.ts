// ─── UAE AML/CFT/CPF Self-Assessment Data for Financial Institutions (FIs) ───
// Strict FI terminology — zero DNFBP references
// Based on Federal Decree-Law No. 10 of 2025 & Cabinet Resolution No. 134 of 2025

export type Rating = 'C' | 'LC' | 'PC' | 'NC' | 'NA';

export const SCORING_WEIGHTS: Record<Rating, number> = {
  C: 3,
  LC: 2,
  PC: 1,
  NC: 0,
  NA: 0, // NA is excluded from denominator
};

export const RATING_LABELS: Record<Rating, string> = {
  C: 'Compliant',
  LC: 'Largely Compliant',
  PC: 'Partially Compliant',
  NC: 'Non-Compliant',
  NA: 'N/A',
};

export const RATING_COLORS: Record<Rating, string> = {
  C: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
  LC: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
  PC: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
  NC: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
  NA: 'bg-slate-500/15 border-slate-500/30 text-slate-400',
};

export const SECTOR_BENCHMARKS: Record<string, number> = {
  GOV: 72,
  POL: 65,
  CDD: 68,
  EDD: 60,
  MON: 63,
  STR: 71,
  TFS: 58,
  REC: 74,
  TRN: 67,
  REG: 55,
};

export interface AMLQuestion {
  id: string;
  text: string;
  isCritical: boolean;
  hint: string;
}

export interface AMLSection {
  id: string;
  title: string;
  questions: AMLQuestion[];
}

export const AML_SECTIONS: AMLSection[] = [
  {
    id: 'GOV',
    title: '1. Governance & Oversight',
    questions: [
      { id: 'GOV-1', text: 'Has the FI\'s Board of Directors approved a written AML/CFT/CPF policy?', isCritical: true, hint: 'FDL 10/2025 Art. 4 requires Board-level approval of AML frameworks.' },
      { id: 'GOV-2', text: 'Is there a designated, empowered MLRO with direct access to the Board?', isCritical: true, hint: 'Cabinet Resolution 134/2025 mandates an independent MLRO.' },
      { id: 'GOV-3', text: 'Does the FI conduct annual AML/CFT/CPF risk assessments at the enterprise level?', isCritical: true, hint: 'CR 134/2025 Art. 5 requires enterprise-wide risk assessments.' },
      { id: 'GOV-4', text: 'Are there documented escalation procedures for suspicious activity reporting?', isCritical: false, hint: 'FDL 10/2025 Art. 8 mandates clear STR escalation protocols.' },
      { id: 'GOV-5', text: 'Does the Board receive quarterly compliance reports from the MLRO?', isCritical: false, hint: 'CBUAE guidance recommends quarterly Board reporting.' },
    ],
  },
  {
    id: 'POL',
    title: '2. Internal Policies & Procedures',
    questions: [
      { id: 'POL-1', text: 'Are AML/CFT/CPF policies reviewed and updated at least annually?', isCritical: true, hint: 'FDL 10/2025 requires annual policy review for FIs.' },
      { id: 'POL-2', text: 'Do policies explicitly cover all product lines and delivery channels?', isCritical: false, hint: 'CR 134/2025 Art. 3 requires coverage of all FI channels.' },
      { id: 'POL-3', text: 'Is there a documented compliance risk appetite framework approved by the Board?', isCritical: false, hint: 'CBUAE guidance requires documented risk appetite.' },
      { id: 'POL-4', text: 'Are there specific procedures for correspondent banking relationships?', isCritical: true, hint: 'FDL 10/2025 Art. 14 requires enhanced due diligence for correspondent banking.' },
      { id: 'POL-5', text: 'Do policies address virtual asset service provider (VASP) interactions?', isCritical: false, hint: 'CBUAE guidance on VASPs requires specific FI controls.' },
    ],
  },
  {
    id: 'CDD',
    title: '3. Customer Due Diligence (CDD)',
    questions: [
      { id: 'CDD-1', text: 'Is CDD performed before establishing a business relationship?', isCritical: true, hint: 'FDL 10/2025 Art. 6 requires CDD prior to establishing FI relationships.' },
      { id: 'CDD-2', text: 'Are customer identification records maintained for at least 5 years after termination?', isCritical: true, hint: 'CR 134/2025 Art. 19 mandates 5-year record retention for FIs.' },
      { id: 'CDD-3', text: 'Is there a process for ongoing monitoring of customer transactions?', isCritical: true, hint: 'FDL 10/2025 Art. 7 requires ongoing transaction monitoring for FIs.' },
      { id: 'CDD-4', text: 'Are there documented procedures for updating customer identification data?', isCritical: false, hint: 'CR 134/2025 requires periodic KYC refresh for FI customers.' },
      { id: 'CDD-5', text: 'Does the FI verify beneficial ownership for all corporate customers?', isCritical: true, hint: 'FDL 10/2025 Art. 6(3) requires UBO identification for FI onboarding.' },
    ],
  },
  {
    id: 'EDD',
    title: '4. Enhanced Due Diligence (EDD)',
    questions: [
      { id: 'EDD-1', text: 'Are EDD measures applied to PEPs and their associates?', isCritical: true, hint: 'FDL 10/2025 Art. 9 requires EDD for PEPs in FI relationships.' },
      { id: 'EDD-2', text: 'Is there senior management approval for PEP business relationships?', isCritical: true, hint: 'CR 134/2025 Art. 10 requires senior approval for PEP FI accounts.' },
      { id: 'EDD-3', text: 'Does the FI apply EDD for high-risk jurisdictions identified by FATF/CBUAE?', isCritical: true, hint: 'FDL 10/2025 Art. 10 mandates EDD for high-risk jurisdictions.' },
      { id: 'EDD-4', text: 'Are there specific EDD procedures for complex or unusual large transactions?', isCritical: false, hint: 'CR 134/2025 requires EDD for complex FI transactions.' },
      { id: 'EDD-5', text: 'Does the FI have procedures for handling shell bank relationships?', isCritical: true, hint: 'FDL 10/2025 Art. 14 prohibits FI relationships with shell banks.' },
    ],
  },
  {
    id: 'MON',
    title: '5. Transaction Monitoring',
    questions: [
      { id: 'MON-1', text: 'Does the FI operate an automated transaction monitoring system?', isCritical: true, hint: 'CBUAE guidance mandates automated monitoring for FIs.' },
      { id: 'MON-2', text: 'Are monitoring rules calibrated to the FI\'s risk profile and product types?', isCritical: false, hint: 'CR 134/2025 requires risk-based monitoring for FIs.' },
      { id: 'MON-3', text: 'Are alerts investigated and dispositioned within defined SLAs?', isCritical: true, hint: 'CBUAE expects timely FI alert resolution.' },
      { id: 'MON-4', text: 'Is there a process for periodic tuning and validation of monitoring scenarios?', isCritical: false, hint: 'Best practice requires annual FI scenario tuning.' },
      { id: 'MON-5', text: 'Does the monitoring system cover all transaction channels including digital?', isCritical: true, hint: 'FDL 10/2025 requires comprehensive FI channel coverage.' },
    ],
  },
  {
    id: 'STR',
    title: '6. Suspicious Transaction Reporting',
    questions: [
      { id: 'STR-1', text: 'Does the FI file STRs via the goAML system within the prescribed timeframe?', isCritical: true, hint: 'FDL 10/2025 Art. 8 requires prompt STR filing for FIs.' },
      { id: 'STR-2', text: 'Is tipping-off prohibited and enforced through documented procedures?', isCritical: true, hint: 'FDL 10/2025 Art. 12 prohibits tipping off for FI staff.' },
      { id: 'STR-3', text: 'Are all STR filings reviewed and approved by the MLRO before submission?', isCritical: false, hint: 'Best practice: MLRO review before FI STR submission.' },
      { id: 'STR-4', text: 'Does the FI maintain a register of all STRs filed?', isCritical: false, hint: 'CR 134/2025 requires FI STR register maintenance.' },
      { id: 'STR-5', text: 'Is there follow-up reporting for continuing suspicious activity?', isCritical: true, hint: 'FDL 10/2025 requires continuing STR reporting for FIs.' },
    ],
  },
  {
    id: 'TFS',
    title: '7. Targeted Financial Sanctions',
    questions: [
      { id: 'TFS-1', text: 'Does the FI screen all customers and transactions against UN and local sanctions lists?', isCritical: true, hint: 'FDL 10/2025 Art. 15 mandates sanctions screening for FIs.' },
      { id: 'TFS-2', text: 'Are sanctions screening systems updated within 24 hours of list changes?', isCritical: true, hint: 'CBUAE requires 24-hour FI sanctions list updates.' },
      { id: 'TFS-3', text: 'Is there an immediate freezing procedure for sanctioned matches?', isCritical: true, hint: 'FDL 10/2025 Art. 16 requires immediate FI asset freezing.' },
      { id: 'TFS-4', text: 'Does the FI report sanctions matches to the Competent Authority promptly?', isCritical: true, hint: 'CR 134/2025 requires prompt FI sanctions reporting.' },
      { id: 'TFS-5', text: 'Are there procedures for handling false positives in sanctions screening?', isCritical: false, hint: 'Best practice: documented FI false positive resolution.' },
    ],
  },
  {
    id: 'REC',
    title: '8. Record Keeping',
    questions: [
      { id: 'REC-1', text: 'Does the FI retain all CDD records for at least 5 years after business relationship ends?', isCritical: true, hint: 'FDL 10/2025 Art. 18 mandates 5-year FI record retention.' },
      { id: 'REC-2', text: 'Are transaction records maintained for at least 5 years?', isCritical: true, hint: 'CR 134/2025 Art. 19 requires 5-year FI transaction retention.' },
      { id: 'REC-3', text: 'Are records stored in a manner that allows timely retrieval for CBUAE inspections?', isCritical: false, hint: 'CBUAE requires timely FI record production.' },
      { id: 'REC-4', text: 'Is there a data retention and destruction policy approved by the Board?', isCritical: false, hint: 'Best practice: documented FI data lifecycle management.' },
      { id: 'REC-5', text: 'Does the FI maintain audit trails for all compliance actions?', isCritical: true, hint: 'FDL 10/2025 requires FI audit trail maintenance.' },
    ],
  },
  {
    id: 'TRN',
    title: '9. Training & Awareness',
    questions: [
      { id: 'TRN-1', text: 'Does the FI provide AML/CFT/CPF training to all employees at onboarding?', isCritical: true, hint: 'FDL 10/2025 Art. 20 requires initial FI staff training.' },
      { id: 'TRN-2', text: 'Is annual refresher training mandatory for all staff?', isCritical: true, hint: 'CR 134/2025 mandates annual FI refresher training.' },
      { id: 'TRN-3', text: 'Is there specialized training for MLRO and compliance staff?', isCritical: false, hint: 'CBUAE guidance recommends specialized FI compliance training.' },
      { id: 'TRN-4', text: 'Does training cover sanctions screening, PEP identification, and red flag indicators?', isCritical: true, hint: 'CR 134/2025 requires comprehensive FI training content.' },
      { id: 'TRN-5', text: 'Are training records maintained and available for regulatory review?', isCritical: false, hint: 'CBUAE expects FI training record documentation.' },
    ],
  },
  {
    id: 'REG',
    title: '10. Regulatory Compliance & Reporting',
    questions: [
      { id: 'REG-1', text: 'Does the FI submit quarterly compliance reports to CBUAE as required?', isCritical: true, hint: 'CBUAE requires quarterly FI compliance reporting.' },
      { id: 'REG-2', text: 'Is there a process for tracking and implementing new CBUAE circulars and regulations?', isCritical: true, hint: 'FDL 10/2025 requires FI regulatory tracking.' },
      { id: 'REG-3', text: 'Does the FI cooperate fully with CBUAE examinations and on-site inspections?', isCritical: true, hint: 'FDL 10/2025 Art. 22 mandates FI regulatory cooperation.' },
      { id: 'REG-4', text: 'Are there procedures for implementing remediation actions from regulatory findings?', isCritical: false, hint: 'Best practice: documented FI remediation tracking.' },
      { id: 'REG-5', text: 'Does the FI conduct independent audits of its AML/CFT/CPF program?', isCritical: true, hint: 'CR 134/2025 requires independent FI AML audits.' },
      { id: 'REG-6', text: 'Does the FI maintain a goAML registration and ensure timely filing of all report types?', isCritical: true, hint: 'CBUAE mandates goAML registration and FI filing compliance.' },
    ],
  },
];

// Total: 5+5+5+5+5+5+5+5+5+6 = 51 questions
export const TOTAL_QUESTIONS = AML_SECTIONS.reduce((sum, s) => sum + s.questions.length, 0);
