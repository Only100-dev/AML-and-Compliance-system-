/**
 * ════════════════════════════════════════════════════════════════════════════
 * IC-OS v7.3.0 — Intelligence Engine Seed: GCC Regulatory & Operational Data
 * ════════════════════════════════════════════════════════════════════════════
 * Purpose: Populate IntelligenceItem + IntelligenceEntity tables with 20
 *          realistic records distributed across all 6 GCC jurisdictions for
 *          the AI-Powered Regulatory & Operational Intelligence Search Engine.
 *
 * Records created (when IntelligenceItem table is empty):
 *   - 20 IntelligenceItem records across AE/SA/BH/QA/OM/KW
 *   - 50+ IntelligenceEntity records (2-4 per item)
 *
 * Category distribution:
 *   REGULATORY  (7) | POLICY (4) | OPERATIONAL (3) | NEWS (2) | RISK (2) | TREND (2)
 *
 * Jurisdiction distribution:
 *   AE (4) | SA (4) | BH (3) | QA (3) | OM (2) | KW (4)
 *
 * IDEMPOTENCY:
 *   Gated by `count() > 0` check on IntelligenceItem. Re-runs skip and
 *   print a clear "already has N records, skipping" message. Safe to
 *   re-run without duplicating data.
 *
 * Usage:
 *   bun run prisma/seed-intelligence.ts
 * ════════════════════════════════════════════════════════════════════════════
 */

import { db } from '@/lib/db';

// ─── Date helpers ────────────────────────────────────────────────────────────

/** Returns a Date `days` days from now (negative = past). */
function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Type definitions ────────────────────────────────────────────────────────

type Category = 'REGULATORY' | 'POLICY' | 'OPERATIONAL' | 'NEWS' | 'RISK' | 'TREND';
type Credibility = 'HIGH' | 'MEDIUM' | 'LOW';
type SourceType = 'MANUAL' | 'AUTO_SCRAPER' | 'AI_GENERATED';
type EntityType = 'REGULATION' | 'AGENCY' | 'DEPARTMENT' | 'CONTROL' | 'PERSON';

interface EntitySeed {
  name: string;
  type: EntityType;
  metadata?: string;
}

interface IntelligenceSeed {
  jurisdictionCode: string;
  title: string;
  summary: string;
  fullContent: string;
  sourceUrl: string;
  sourceCredibility: Credibility;
  publishDate: Date;
  effectiveDate: Date | null;
  category: Category;
  riskScore: number;
  impactScore: number;
  aiConfidenceScore: number;
  aiSummary: string | null;
  aiRiskAssessment: string | null;
  aiRecommendedActions: string | null;
  sourceType: SourceType;
  isRead: boolean;
  entities: EntitySeed[];
}

// ─── Seed data definitions ───────────────────────────────────────────────────

const INTELLIGENCE_SEEDS: IntelligenceSeed[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // AE — United Arab Emirates (CBUAE) — 4 items
  // ═══════════════════════════════════════════════════════════════════════

  // 1. CBUAE AML guidelines for VASPs
  {
    jurisdictionCode: 'AE',
    title: 'CBUAE Updates AML/CFT Guidelines for Virtual Asset Service Providers',
    summary:
      'The Central Bank of the UAE has issued revised AML/CFT guidelines specifically targeting Virtual Asset Service Providers (VASPs), requiring enhanced customer due diligence, transaction monitoring, and SAR filing obligations aligned with FATF Recommendation 15.',
    fullContent:
      'The Central Bank of the UAE (CBUAE) has published Circular No. 128/2025 updating its AML/CFT guidelines for Virtual Asset Service Providers operating within the UAE. Key changes include: (1) Mandatory enhanced due diligence for all VASP customers with transaction volumes exceeding AED 55,000 per month; (2) Real-time transaction monitoring requirements for cross-border virtual asset transfers; (3) Updated SAR filing timelines — suspicious activity reports must be filed within 48 hours of detection; (4) New record-keeping requirements of 7 years for all virtual asset transactions; (5) Mandatory appointment of a dedicated AML Compliance Officer with direct board reporting line. The guidelines take effect on June 1, 2025, with a 90-day grace period for existing VASPs to achieve compliance.',
    sourceUrl: 'https://cbuae.gov.ae/circulars/128-2025-aml-vasp',
    sourceCredibility: 'HIGH',
    publishDate: daysFromNow(-12),
    effectiveDate: daysFromNow(78),
    category: 'REGULATORY',
    riskScore: 80,
    impactScore: 85,
    aiConfidenceScore: 92,
    aiSummary:
      'CBUAE Circular 128/2025 introduces stringent AML/CFT requirements for VASPs, including enhanced CDD, real-time monitoring, and 48-hour SAR filing. Insurance firms offering crypto-related coverage products must update their compliance frameworks within the 90-day transition period. Non-compliance penalties include license revocation and fines up to AED 10 million.',
    aiRiskAssessment:
      'HIGH RISK — The 48-hour SAR filing window represents a significant operational challenge for firms with manual reporting processes. Enhanced CDD requirements for virtual asset transactions will increase compliance costs by an estimated 30-40%. The real-time monitoring mandate requires immediate technology investment. Firms without automated AML systems face regulatory action risk.',
    aiRecommendedActions:
      '["Audit current SAR filing processes and implement automated reporting workflows", "Evaluate AML transaction monitoring systems for virtual asset capability", "Appoint dedicated VASP AML Compliance Officer with board-level access", "Update customer risk scoring models to include virtual asset exposure factors", "Schedule compliance gap analysis within 30 days"]',
    sourceType: 'AUTO_SCRAPER',
    isRead: false,
    entities: [
      { name: 'CBUAE Circular 128/2025', type: 'REGULATION', metadata: '{"circularNumber":"128/2025","status":"effective"}' },
      { name: 'Central Bank of the UAE', type: 'AGENCY' },
      { name: 'Virtual Asset Service Providers (VASPs)', type: 'DEPARTMENT', metadata: '{"sector":"virtual_assets","fATFRecommendation":15}' },
      { name: 'Enhanced Customer Due Diligence', type: 'CONTROL', metadata: '{"threshold":"AED 55,000/month"}' },
    ],
  },

  // 2. UAE FIU SAR filing deadlines
  {
    jurisdictionCode: 'AE',
    title: 'UAE FIU Issues Updated SAR Filing Deadlines and Format Requirements',
    summary:
      'The UAE Financial Intelligence Unit has revised SAR filing deadlines from 5 business days to 72 hours for high-priority suspicious activity, with new mandatory data fields and XML-based submission format requirements effective April 2025.',
    fullContent:
      'The UAE Financial Intelligence Unit (FIU) has issued Administrative Decision No. 7/2025 updating the Suspicious Activity Report filing framework. Key changes: (1) High-priority SARs (involving terrorism financing, PEPs, or transactions exceeding AED 1 million) must be filed within 72 hours of detection, reduced from 5 business days; (2) Standard SAR filing window remains 5 business days; (3) New mandatory data fields include source of wealth declaration, beneficial ownership chain, and digital wallet identifiers; (4) All SARs must be submitted via the goAML system in the new XML 3.0 format; (5) Automatic escalation to CBUAE for SARs involving virtual asset service providers. The changes take effect on April 15, 2025.',
    sourceUrl: 'https://fiu.gov.ae/admin-decisions/7-2025-sar-filing',
    sourceCredibility: 'HIGH',
    publishDate: daysFromNow(-8),
    effectiveDate: daysFromNow(45),
    category: 'REGULATORY',
    riskScore: 75,
    impactScore: 80,
    aiConfidenceScore: 89,
    aiSummary:
      'UAE FIU Administrative Decision 7/2025 shortens the SAR filing window for high-priority cases to 72 hours and introduces XML 3.0 format requirements. All regulated entities must update their goAML submission pipelines and train compliance staff on the new priority classification criteria.',
    aiRiskAssessment:
      'MEDIUM-HIGH RISK — The compressed 72-hour window for high-priority SARs demands automated detection-to-filing workflows. Manual processes will likely miss the deadline, exposing firms to regulatory penalties. The XML 3.0 format migration requires IT system updates.',
    aiRecommendedActions:
      '["Update goAML system integration to support XML 3.0 format", "Implement automated SAR priority classification rules", "Train compliance team on 72-hour filing requirements for high-priority cases", "Review and update internal SAR escalation procedures"]',
    sourceType: 'AUTO_SCRAPER',
    isRead: false,
    entities: [
      { name: 'UAE FIU Administrative Decision 7/2025', type: 'REGULATION' },
      { name: 'UAE Financial Intelligence Unit', type: 'AGENCY' },
      { name: 'goAML System', type: 'CONTROL', metadata: '{"formatVersion":"XML 3.0"}' },
    ],
  },

  // 3. Insurance Authority Takaful regulation overhaul
  {
    jurisdictionCode: 'AE',
    title: 'UAE Insurance Authority Announces Comprehensive Takaful Regulation Overhaul',
    summary:
      'The UAE Insurance Authority has proposed a complete restructuring of Takaful insurance regulations, introducing new governance requirements for Sharia supervisory boards, mandatory segregation of participant and shareholder funds, and updated solvency margin calculations for Takaful operators.',
    fullContent:
      'The UAE Insurance Authority has released a consultation paper proposing a comprehensive overhaul of the Takaful insurance regulatory framework. Major proposed changes include: (1) Mandatory appointment of independent Sharia Supervisory Board members with minimum 10 years Islamic finance experience; (2) Complete segregation of Participant Takaful Fund (PTF) and Shareholders Fund with quarterly reconciliation requirements; (3) Revised solvency margin calculation using a risk-based capital approach specific to Takaful structures; (4) New disclosure requirements for surplus distribution policies; (5) Restrictions on the types of investments permitted for PTF assets; (6) Mandatory annual Sharia compliance audit by an approved external auditor. The consultation period runs through May 2025, with expected implementation in Q4 2025.',
    sourceUrl: 'https://ia.gov.ae/consultations/takaful-overhaul-2025',
    sourceCredibility: 'HIGH',
    publishDate: daysFromNow(-25),
    effectiveDate: daysFromNow(210),
    category: 'POLICY',
    riskScore: 65,
    impactScore: 72,
    aiConfidenceScore: 78,
    aiSummary:
      'The proposed Takaful regulation overhaul will require significant operational and governance changes for all UAE Takaful operators. The mandatory fund segregation and new RBC solvency calculations may increase capital requirements by 15-25%. Sharia Supervisory Board independence requirements may require board restructuring.',
    aiRiskAssessment: null,
    aiRecommendedActions: null,
    sourceType: 'MANUAL',
    isRead: false,
    entities: [
      { name: 'UAE Insurance Authority Takaful Consultation', type: 'REGULATION' },
      { name: 'UAE Insurance Authority', type: 'AGENCY' },
      { name: 'Sharia Supervisory Board', type: 'DEPARTMENT', metadata: '{"minExperience":"10 years"}' },
    ],
  },

  // 4. ESG reporting requirements for UAE insurance
  {
    jurisdictionCode: 'AE',
    title: 'Growing ESG Reporting Requirements for UAE Insurance Companies',
    summary:
      'Multiple UAE regulators are converging on mandatory ESG disclosure requirements for insurance companies, with CBUAE and the Insurance Authority coordinating on a unified reporting framework expected by Q3 2025.',
    fullContent:
      'A trend analysis of recent regulatory developments indicates a convergence toward mandatory ESG reporting for UAE insurance companies. CBUAE, the Insurance Authority, and the Securities and Commodities Authority (SCA) are coordinating on a unified ESG disclosure framework. Key indicators: (1) CBUAE included ESG risk factors in its 2024 insurance supervision guidelines; (2) The Insurance Authority published an ESG integration guidance note for investment-linked insurance products; (3) SCA has mandated ESG disclosures for all listed companies including insurance firms; (4) The Dubai International Financial Centre (DIFC) has already implemented mandatory climate-related financial disclosures. Industry expectations point to a unified mandatory framework by Q3 2025.',
    sourceUrl: 'https://insuranceindustry.ae/esg-reporting-trend-2025',
    sourceCredibility: 'MEDIUM',
    publishDate: daysFromNow(-5),
    effectiveDate: null,
    category: 'TREND',
    riskScore: 55,
    impactScore: 60,
    aiConfidenceScore: 72,
    aiSummary:
      'ESG reporting requirements are rapidly becoming mandatory across UAE insurance sector. Firms should begin preparing for unified disclosure standards covering climate risk, social impact, and governance metrics. Early adoption will reduce transition costs and competitive disadvantage.',
    aiRiskAssessment: null,
    aiRecommendedActions: null,
    sourceType: 'AI_GENERATED',
    isRead: true,
    entities: [
      { name: 'CBUAE ESG Framework', type: 'REGULATION' },
      { name: 'Securities and Commodities Authority', type: 'AGENCY' },
      { name: 'ESG Disclosure Standards', type: 'CONTROL' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SA — Kingdom of Saudi Arabia (SAMA) — 4 items
  // ═══════════════════════════════════════════════════════════════════════

  // 5. SAMA AML/CFT Guidelines for insurance sector
  {
    jurisdictionCode: 'SA',
    title: 'SAMA Releases Updated AML/CFT Guidelines for the Insurance Sector',
    summary:
      'SAMA has issued comprehensive AML/CFT guidelines specifically for insurance companies operating in KSA, mandating risk-based approaches for policy underwriting, claims processing, and beneficiary verification with enhanced due diligence for high-risk products.',
    fullContent:
      'The Saudi Arabian Monetary Authority (SAMA) has issued the updated AML/CFT Guidelines for Insurance Companies (Version 3.0), superseding the 2021 version. Key provisions include: (1) Mandatory risk-based approach for all insurance product categories, with specific risk matrices for life insurance, health insurance, and property/casualty; (2) Enhanced customer due diligence for policies with annual premiums exceeding SAR 500,000; (3) Beneficial owner identification requirements for all corporate policyholders, including verification of ownership chains exceeding 25% threshold; (4) Mandatory suspicious transaction reporting for claims that exhibit red flags including early policy cancellation, unusual beneficiary structures, and premium financing anomalies; (5) New obligations for insurance intermediaries and brokers to conduct independent AML assessments; (6) Quarterly compliance reporting to SAMA using the new standardized template. Effective date: May 1, 2025.',
    sourceUrl: 'https://sama.gov.sa/guidelines/aml-cft-insurance-v3',
    sourceCredibility: 'HIGH',
    publishDate: daysFromNow(-18),
    effectiveDate: daysFromNow(60),
    category: 'REGULATORY',
    riskScore: 85,
    impactScore: 88,
    aiConfidenceScore: 94,
    aiSummary:
      'SAMA AML/CFT Guidelines v3.0 introduces sector-specific risk matrices and enhanced CDD thresholds for insurance. The SAR 500,000 premium threshold will affect approximately 12% of existing life insurance policies. Insurance intermediaries now face independent AML obligations requiring significant process redesign.',
    aiRiskAssessment:
      'HIGH RISK — Insurance companies must overhaul their risk assessment methodologies to incorporate the new product-specific risk matrices. The extended beneficiary verification requirements for corporate policyholders will significantly slow onboarding processes. Intermediary AML obligations create compliance gaps if not addressed through contractual amendments.',
    aiRecommendedActions:
      '["Develop product-specific AML risk matrices for life, health, and P&C insurance", "Update corporate onboarding workflows to verify beneficial ownership at 25% threshold", "Amend intermediary and broker agreements to include AML compliance obligations", "Implement automated SAR detection for claims red flags", "Configure quarterly SAMA compliance reporting templates"]',
    sourceType: 'AUTO_SCRAPER',
    isRead: false,
    entities: [
      { name: 'SAMA AML/CFT Insurance Guidelines v3.0', type: 'REGULATION', metadata: '{"version":"3.0","supersedes":"2021 version"}' },
      { name: 'Saudi Arabian Monetary Authority', type: 'AGENCY' },
      { name: 'Insurance Intermediary AML Framework', type: 'CONTROL' },
      { name: 'Risk-Based Approach Matrix', type: 'CONTROL', metadata: '{"categories":["life","health","property_casualty"]}' },
    ],
  },

  // 6. SIA motor insurance tariff
  {
    jurisdictionCode: 'SA',
    title: 'Saudi Insurance Authority Proposes New Motor Insurance Tariff Structure',
    summary:
      'The Saudi Insurance Authority (SIA) has proposed a revised motor insurance tariff structure introducing usage-based pricing, mandatory telematics integration for comprehensive policies, and revised no-claim discount scales.',
    fullContent:
      'The Saudi Insurance Authority (SIA) has published a consultation paper on the revised Motor Insurance Tariff Structure. Key proposals: (1) Introduction of usage-based insurance (UBI) pricing models as an approved rating methodology; (2) Mandatory telematics device integration for all comprehensive motor policies issued after January 2026; (3) Revised No-Claim Discount (NCD) scale from the current 5-tier to an 8-tier system; (4) New minimum premium floor for third-party liability coverage at SAR 800; (5) Mandatory inclusion of natural peril coverage (sandstorm, flooding) in comprehensive policies; (6) Introduction of pay-per-mile policies for low-usage vehicles. Public consultation ends April 30, 2025.',
    sourceUrl: 'https://sia.gov.sa/consultations/motor-tariff-2025',
    sourceCredibility: 'HIGH',
    publishDate: daysFromNow(-15),
    effectiveDate: daysFromNow(270),
    category: 'POLICY',
    riskScore: 60,
    impactScore: 68,
    aiConfidenceScore: 76,
    aiSummary:
      'The proposed motor insurance tariff restructuring will modernize the Saudi motor insurance market with UBI pricing and telematics integration. Insurers need to invest in telematics infrastructure and revise rating algorithms. The minimum premium floor may affect market competitiveness for budget insurers.',
    aiRiskAssessment: null,
    aiRecommendedActions: null,
    sourceType: 'MANUAL',
    isRead: false,
    entities: [
      { name: 'SIA Motor Tariff Consultation 2025', type: 'REGULATION' },
      { name: 'Saudi Insurance Authority', type: 'AGENCY' },
      { name: 'Telematics Integration Unit', type: 'CONTROL', metadata: '{"requirement":"mandatory","effectiveDate":"2026-01-01"}' },
    ],
  },

  // 7. SAFIU STR reporting for digital transactions
  {
    jurisdictionCode: 'SA',
    title: 'SAFIU Mandates Enhanced STR Reporting for Digital Payment Transactions',
    summary:
      'The Saudi Financial Investigation Unit (SAFIU) has mandated enhanced Suspicious Transaction Report filing requirements for digital payment transactions, including real-time reporting for transactions exceeding SAR 200,000 through digital channels.',
    fullContent:
      'SAFIU has issued Directive No. 12/2025 requiring enhanced STR reporting for digital payment transactions. Key requirements: (1) Real-time STR filing for digital transactions exceeding SAR 200,000 flagged by automated monitoring systems; (2) Mandatory inclusion of device fingerprinting data, IP geolocation, and digital payment channel identifiers in all STR submissions; (3) New red flag indicators specific to digital payment fraud including velocity checks, device cloning patterns, and cross-channel abuse; (4) Quarterly STR filing statistics must be reported to SAFIU via the MASAQ system; (5) Annual independent audit of digital payment STR detection effectiveness. Effective immediately.',
    sourceUrl: 'https://safiu.gov.sa/directives/12-2025-str-digital',
    sourceCredibility: 'HIGH',
    publishDate: daysFromNow(-3),
    effectiveDate: daysFromNow(0),
    category: 'REGULATORY',
    riskScore: 78,
    impactScore: 82,
    aiConfidenceScore: 88,
    aiSummary:
      'SAFIU Directive 12/2025 requires immediate compliance with enhanced digital payment STR reporting. The real-time filing requirement for SAR 200,000+ digital transactions demands automated monitoring and reporting infrastructure. Device fingerprinting and IP geolocation data collection raises privacy compliance considerations.',
    aiRiskAssessment:
      'MEDIUM-HIGH RISK — Real-time STR filing for digital transactions requires sophisticated automated monitoring systems. Firms relying on manual review processes will be unable to meet the instant reporting requirement. Device fingerprinting data collection must comply with Saudi Personal Data Protection Law.',
    aiRecommendedActions:
      '["Deploy automated STR detection for digital payment transactions above SAR 200,000", "Integrate device fingerprinting and IP geolocation into transaction monitoring", "Update MASAQ reporting templates for quarterly STR statistics", "Conduct privacy impact assessment for device data collection"]',
    sourceType: 'AUTO_SCRAPER',
    isRead: false,
    entities: [
      { name: 'SAFIU Directive 12/2025', type: 'REGULATION' },
      { name: 'Saudi Financial Investigation Unit', type: 'AGENCY' },
      { name: 'MASAQ Reporting System', type: 'CONTROL' },
      { name: 'Device Fingerprinting Module', type: 'CONTROL', metadata: '{"dataPoints":["deviceID","ipGeolocation","digitalChannelID"]}' },
    ],
  },

  // 8. KSA Beneficial Ownership registry
  {
    jurisdictionCode: 'SA',
    title: 'KSA Implementing Beneficial Ownership Registry Requirements for Financial Sector',
    summary:
      'Saudi Arabia is implementing a central beneficial ownership registry for the financial sector, requiring all regulated entities to submit verified beneficial ownership data within 180 days, with penalties for non-disclosure of ownership chains above 10% threshold.',
    fullContent:
      'The Kingdom of Saudi Arabia is implementing a central Beneficial Ownership (BO) registry as part of its FATF compliance commitments. Key requirements: (1) All SAMA-regulated entities must submit verified beneficial ownership data for all corporate customers; (2) Ownership disclosure threshold set at 10% (lower than the standard 25% FATF threshold); (3) Monthly updates required for any changes in beneficial ownership structures; (4) Non-compliance penalties include SAR 500,000 per violation and potential license suspension; (5) Existing customers must be re-verified within 180 days of the effective date; (6) Insurance companies must verify BO for all policyholders with annual premiums exceeding SAR 100,000. Implementation begins June 2025.',
    sourceUrl: 'https://mof.gov.sa/beneficial-ownership/registry-2025',
    sourceCredibility: 'HIGH',
    publishDate: daysFromNow(-30),
    effectiveDate: daysFromNow(90),
    category: 'OPERATIONAL',
    riskScore: 70,
    impactScore: 75,
    aiConfidenceScore: 82,
    aiSummary:
      'The KSA beneficial ownership registry introduces a 10% ownership disclosure threshold — significantly lower than FATF standard. Insurance companies face a massive re-verification exercise for existing customers. The 180-day compliance window is tight given the volume of re-verification required.',
    aiRiskAssessment: null,
    aiRecommendedActions: null,
    sourceType: 'MANUAL',
    isRead: false,
    entities: [
      { name: 'KSA BO Registry Regulation 2025', type: 'REGULATION', metadata: '{"threshold":"10%","penalty":"SAR 500,000/violation"}' },
      { name: 'Ministry of Finance Saudi Arabia', type: 'AGENCY' },
      { name: 'Beneficial Ownership Verification Unit', type: 'DEPARTMENT' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // BH — Kingdom of Bahrain (CBB) — 3 items
  // ═══════════════════════════════════════════════════════════════════════

  // 9. CBB Rulebook update for insurance firms
  {
    jurisdictionCode: 'BH',
    title: 'CBB Updates Rulebook Volume 3 for Insurance Firms — Enhanced Governance Requirements',
    summary:
      'The Central Bank of Bahrain has updated Rulebook Volume 3 (Insurance) with enhanced corporate governance requirements, including mandatory board risk committee formation, updated actuarial reporting standards, and revised fit-and-proper criteria for senior management.',
    fullContent:
      'The Central Bank of Bahrain (CBB) has published updates to Rulebook Volume 3 (Insurance Business) effective immediately. Major changes: (1) Mandatory Board Risk Committee for all Category 1 and 2 insurance firms, with at least one member holding a professional risk management certification; (2) Updated actuarial reporting standards requiring stochastic modeling for life insurance reserving; (3) Revised Fit and Proper criteria for senior management including mandatory Bahrain residency for CEO and CFO positions; (4) New requirements for internal audit function independence — internal auditors must report directly to the Board Audit Committee; (5) Enhanced disclosure requirements for related party transactions exceeding BHD 50,000; (6) Mandatory annual Board effectiveness review conducted by an external evaluator. Compliance deadline: September 30, 2025.',
    sourceUrl: 'https://cbb.gov.bh/rulebook/volume3-update-2025',
    sourceCredibility: 'HIGH',
    publishDate: daysFromNow(-20),
    effectiveDate: daysFromNow(180),
    category: 'REGULATORY',
    riskScore: 65,
    impactScore: 70,
    aiConfidenceScore: 85,
    aiSummary:
      'CBB Rulebook Volume 3 updates introduce significant governance restructuring requirements for Bahraini insurance firms. The mandatory Board Risk Committee and CEO/CFO residency requirements may require board and management changes. Stochastic actuarial modeling requirements necessitate methodology upgrades.',
    aiRiskAssessment:
      'MEDIUM RISK — The CEO/CFO Bahrain residency requirement may create talent acquisition challenges for international insurance firms. Board Risk Committee formation with certified risk professionals is achievable but requires recruitment within the 6-month compliance window.',
    aiRecommendedActions:
      '["Establish Board Risk Committee with certified risk management professional", "Verify CEO/CFO Bahrain residency compliance", "Upgrade actuarial systems to support stochastic modeling for life reserving", "Engage external evaluator for Board effectiveness review", "Update related party transaction disclosure procedures for BHD 50,000 threshold"]',
    sourceType: 'MANUAL',
    isRead: false,
    entities: [
      { name: 'CBB Rulebook Volume 3 (2025 Update)', type: 'REGULATION' },
      { name: 'Central Bank of Bahrain', type: 'AGENCY' },
      { name: 'Board Risk Committee', type: 'DEPARTMENT', metadata: '{"requirement":"mandatory","categories":["1","2"]}' },
      { name: 'Stochastic Actuarial Modeling', type: 'CONTROL', metadata: '{"application":"life_insurance_reserving"}' },
    ],
  },

  // 10. Bahrain FIU cross-border monitoring
  {
    jurisdictionCode: 'BH',
    title: 'Bahrain FIU Tightens Cross-Border Transaction Monitoring Requirements',
    summary:
      'The Bahrain Financial Intelligence Unit has issued new cross-border transaction monitoring guidelines requiring real-time screening for all international transfers exceeding BHD 10,000 and mandatory Originator/Beneficiary information completeness checks.',
    fullContent:
      'The Bahrain FIU has issued Guidance Note GN-2025-04 tightening cross-border transaction monitoring requirements for all financial institutions including insurance companies. Key provisions: (1) Real-time sanctions and PEP screening for all international transfers exceeding BHD 10,000; (2) Mandatory completeness checks on Originator and Beneficiary information for all wire transfers; (3) Enhanced monitoring for cross-border transactions involving high-risk jurisdictions per the Bahrain National Risk Assessment; (4) Monthly cross-border transaction reporting to the FIU with statistical breakdown; (5) Mandatory batch screening for accumulated small-value international transfers from the same originator within a 7-day window (aggregation threshold: BHD 30,000). Effective: May 1, 2025.',
    sourceUrl: 'https://fiu.gov.bh/guidance/gn-2025-04-crossborder',
    sourceCredibility: 'HIGH',
    publishDate: daysFromNow(-10),
    effectiveDate: daysFromNow(55),
    category: 'OPERATIONAL',
    riskScore: 60,
    impactScore: 65,
    aiConfidenceScore: 81,
    aiSummary:
      'Bahrain FIU Guidance Note GN-2025-04 extends cross-border monitoring obligations to insurance companies for the first time. The BHD 10,000 real-time screening threshold and 7-day aggregation rule at BHD 30,000 require automated monitoring systems capable of multi-window aggregation.',
    aiRiskAssessment: null,
    aiRecommendedActions: null,
    sourceType: 'AUTO_SCRAPER',
    isRead: false,
    entities: [
      { name: 'Bahrain FIU Guidance Note GN-2025-04', type: 'REGULATION' },
      { name: 'Bahrain Financial Intelligence Unit', type: 'AGENCY' },
      { name: 'Cross-Border Screening Module', type: 'CONTROL', metadata: '{"thresholds":{"realTime":"BHD 10,000","aggregation7Day":"BHD 30,000"}}' },
    ],
  },

  // 11. CBB cyber insurance guidance
  {
    jurisdictionCode: 'BH',
    title: 'CBB Issues Guidance on Cyber Insurance Requirements for Financial Institutions',
    summary:
      'The Central Bank of Bahrain has issued guidance requiring all Category 1 financial institutions to maintain minimum cyber insurance coverage of BHD 2 million, with specific policy requirements for ransomware, data breach, and business interruption coverage.',
    fullContent:
      'The CBB has issued Guidance Letter GL-2025-03 establishing minimum cyber insurance requirements for financial institutions. Key provisions: (1) Category 1 financial institutions must maintain minimum cyber insurance coverage of BHD 2 million; (2) Category 2 institutions must maintain BHD 1 million minimum coverage; (3) Policies must specifically cover ransomware payments, data breach notification costs, regulatory fines, and business interruption; (4) Annual cybersecurity assessment by an approved assessor is a prerequisite for policy renewal; (5) Insurance policies must include first-party and third-party coverage; (6) Deductibles may not exceed 10% of the coverage limit. Implementation deadline: December 31, 2025.',
    sourceUrl: 'https://cbb.gov.bh/guidance/gl-2025-03-cyber-insurance',
    sourceCredibility: 'HIGH',
    publishDate: daysFromNow(-22),
    effectiveDate: daysFromNow(270),
    category: 'POLICY',
    riskScore: 50,
    impactScore: 55,
    aiConfidenceScore: 74,
    aiSummary:
      'CBB Guidance Letter GL-2025-03 establishes minimum cyber insurance coverage requirements for Bahraini financial institutions. The BHD 2 million minimum for Category 1 firms may increase insurance costs significantly. The annual cybersecurity assessment requirement creates an ongoing compliance obligation.',
    aiRiskAssessment: null,
    aiRecommendedActions: null,
    sourceType: 'MANUAL',
    isRead: true,
    entities: [
      { name: 'CBB Guidance Letter GL-2025-03', type: 'REGULATION' },
      { name: 'Central Bank of Bahrain', type: 'AGENCY' },
      { name: 'Cyber Insurance Coverage Standard', type: 'CONTROL', metadata: '{"minimumCat1":"BHD 2,000,000","minimumCat2":"BHD 1,000,000","maxDeductible":"10%"}' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // QA — State of Qatar (QCB) — 3 items
  // ═══════════════════════════════════════════════════════════════════════

  // 12. QCB insurance sector stress testing
  {
    jurisdictionCode: 'QA',
    title: 'QCB Mandates Insurance Sector Stress Testing Framework',
    summary:
      'The Qatar Central Bank has mandated a comprehensive stress testing framework for all insurance companies, requiring semi-annual scenario-based testing covering market risk, credit risk, and catastrophic event scenarios with reporting to QCB by March and September each year.',
    fullContent:
      'The Qatar Central Bank (QCB) has issued Directive QCB/INS/2025/003 mandating a comprehensive stress testing framework for the insurance sector. Requirements: (1) Semi-annual stress testing in March and September; (2) Three mandatory scenarios — baseline, adverse, and severely adverse; (3) Market risk scenarios including 30% equity market decline, 200bps interest rate shock, and 20% real estate value decline; (4) Credit risk scenarios including sovereign downgrade and corporate default rate doubling; (5) Catastrophic event scenarios including pandemic, natural disaster, and cyber attack; (6) Results must include impact on solvency margin, technical provisions, and investment portfolio; (7) Stress testing methodology must be approved by QCB prior to first submission; (8) Results must be submitted within 30 business days of the testing period end. First submission deadline: September 30, 2025.',
    sourceUrl: 'https://qcb.gov.qa/directives/ins-2025-003-stress-testing',
    sourceCredibility: 'HIGH',
    publishDate: daysFromNow(-14),
    effectiveDate: daysFromNow(180),
    category: 'REGULATORY',
    riskScore: 70,
    impactScore: 73,
    aiConfidenceScore: 86,
    aiSummary:
      'QCB Directive QCB/INS/2025/003 introduces mandatory semi-annual stress testing for all Qatari insurance companies. The prescribed scenarios are comprehensive and cover market, credit, and catastrophe risks. Methodology approval by QCB adds a regulatory dependency that firms should address immediately.',
    aiRiskAssessment:
      'MEDIUM RISK — Insurance companies with limited actuarial and risk management capabilities may struggle to develop compliant stress testing methodologies. The QCB methodology approval requirement means first submissions should be prepared well in advance. The prescribed market shock scenarios (30% equity decline, 200bps rate shock) are severe and may require capital planning adjustments.',
    aiRecommendedActions:
      '["Develop stress testing methodology and submit for QCB approval immediately", "Build scenario models for market risk, credit risk, and catastrophe scenarios", "Establish semi-annual stress testing governance and reporting process", "Assess capital adequacy under severely adverse scenarios", "Train risk management team on QCB stress testing requirements"]',
    sourceType: 'AUTO_SCRAPER',
    isRead: false,
    entities: [
      { name: 'QCB Directive QCB/INS/2025/003', type: 'REGULATION' },
      { name: 'Qatar Central Bank', type: 'AGENCY' },
      { name: 'Stress Testing Framework', type: 'CONTROL', metadata: '{"frequency":"semi-annual","scenarios":["baseline","adverse","severely_adverse"]}' },
      { name: 'Insurance Supervision Department', type: 'DEPARTMENT' },
    ],
  },

  // 13. Qatar FIU goAML reporting thresholds
  {
    jurisdictionCode: 'QA',
    title: 'Qatar FIU Updates goAML Reporting Thresholds and Category Definitions',
    summary:
      'The Qatar Financial Information Unit has updated goAML reporting thresholds, lowering the cash transaction reporting threshold from QAR 200,000 to QAR 150,000 and introducing new categories for virtual asset-related suspicious activity reports.',
    fullContent:
      'The Qatar Financial Information Unit (QFIU) has issued Administrative Order AO-2025-02 updating goAML reporting requirements. Key changes: (1) Cash Transaction Report (CTR) threshold lowered from QAR 200,000 to QAR 150,000; (2) New SAR category for virtual asset-related suspicious activities; (3) Wire Transfer Report threshold remains at QAR 100,000 for international transfers; (4) Mandatory cross-reference to UN Security Council sanctions lists in all SAR filings; (5) Updated typologies guidance for insurance sector — new red flags for premium financing fraud, nominee policyholders, and claims laundering; (6) Monthly CTR statistics reporting requirement introduced. Effective: June 1, 2025.',
    sourceUrl: 'https://qfiu.gov.qa/admin-orders/ao-2025-02-goaml',
    sourceCredibility: 'HIGH',
    publishDate: daysFromNow(-7),
    effectiveDate: daysFromNow(85),
    category: 'REGULATORY',
    riskScore: 72,
    impactScore: 70,
    aiConfidenceScore: 87,
    aiSummary:
      'QFIU Administrative Order AO-2025-02 lowers the CTR threshold to QAR 150,000, which will increase reportable transaction volumes by an estimated 20-25%. The new virtual asset SAR category reflects emerging regulatory focus on crypto-related financial crime in Qatar.',
    aiRiskAssessment: null,
    aiRecommendedActions: null,
    sourceType: 'AUTO_SCRAPER',
    isRead: false,
    entities: [
      { name: 'QFIU Administrative Order AO-2025-02', type: 'REGULATION' },
      { name: 'Qatar Financial Information Unit', type: 'AGENCY' },
      { name: 'goAML Reporting System', type: 'CONTROL', metadata: '{"ctrThreshold":"QAR 150,000","wtrThreshold":"QAR 100,000"}' },
    ],
  },

  // 14. QFCRA InsurTech licensing
  {
    jurisdictionCode: 'QA',
    title: 'QFCRA Announces InsurTech Licensing Framework for Digital Insurance Platforms',
    summary:
      'The Qatar Financial Centre Regulatory Authority has launched a dedicated InsurTech licensing framework, offering sandbox environments, reduced capital requirements for early-stage digital insurers, and a fast-track approval process for innovative insurance products.',
    fullContent:
      'The Qatar Financial Centre Regulatory Authority (QFCRA) has announced the InsurTech Licensing Framework (ILF) as part of Qatar National Vision 2030 financial sector development. Key features: (1) Sandbox environment with 12-month testing period for new digital insurance products; (2) Reduced minimum capital requirement of QAR 5 million for sandbox licensees (compared to QAR 25 million for full insurance licenses); (3) Fast-track 60-day approval process for InsurTech license applications; (4) Mandatory API integration with QCB regulatory reporting systems; (5) Consumer protection requirements including real-time policy disclosure and AI decision explainability; (6) Graduated licensing path from sandbox to full license upon meeting performance criteria. Applications open July 1, 2025.',
    sourceUrl: 'https://qfcra.gov.qa/frameworks/insurtech-licensing-2025',
    sourceCredibility: 'HIGH',
    publishDate: daysFromNow(-4),
    effectiveDate: daysFromNow(120),
    category: 'TREND',
    riskScore: 45,
    impactScore: 50,
    aiConfidenceScore: 70,
    aiSummary:
      'QFCRA InsurTech Licensing Framework positions Qatar as a regional hub for digital insurance innovation. The 80% capital reduction for sandbox licensees and 60-day fast-track approval create attractive market entry conditions. AI explainability requirements are noteworthy as a regional first.',
    aiRiskAssessment: null,
    aiRecommendedActions: null,
    sourceType: 'MANUAL',
    isRead: true,
    entities: [
      { name: 'QFCRA InsurTech Licensing Framework', type: 'REGULATION' },
      { name: 'Qatar Financial Centre Regulatory Authority', type: 'AGENCY' },
      { name: 'InsurTech Sandbox Environment', type: 'CONTROL', metadata: '{"testPeriod":"12 months","minCapital":"QAR 5,000,000","approvalDays":60}' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // OM — Sultanate of Oman (CBOA) — 2 items
  // ═══════════════════════════════════════════════════════════════════════

  // 15. CBOA sanctions screening requirements
  {
    jurisdictionCode: 'OM',
    title: 'CBOA Strengthens Sanctions Screening Requirements for Insurance Sector',
    summary:
      'The Central Bank of Oman has strengthened sanctions screening requirements for the insurance sector, mandating real-time OFAC, EU, and UN sanctions list screening for all policy issuance, claims payments, and beneficiary changes, with quarterly compliance attestation.',
    fullContent:
      'The Central Bank of Oman (CBOA) has issued Circular CB/INS/2025/008 strengthening sanctions screening requirements for the insurance sector. Key provisions: (1) Real-time screening against OFAC SDN List, EU Consolidated List, and UN Security Council Sanctions Lists for all policy issuance, claims payments, and beneficiary changes; (2) Quarterly compliance attestation to CBOA confirming screening coverage; (3) Mandatory false positive reduction program with target false positive rate below 5%; (4) Enhanced screening for policyholders with connections to high-risk jurisdictions (Iran, North Korea, Syria); (5) Immediate blocking of transactions matching sanctions hits with reporting to CBOA within 24 hours; (6) Annual independent review of sanctions screening effectiveness. Effective: April 1, 2025.',
    sourceUrl: 'https://cboa.gov.om/circulars/cb-ins-2025-008-sanctions',
    sourceCredibility: 'HIGH',
    publishDate: daysFromNow(-28),
    effectiveDate: daysFromNow(30),
    category: 'REGULATORY',
    riskScore: 75,
    impactScore: 78,
    aiConfidenceScore: 90,
    aiSummary:
      'CBOA Circular CB/INS/2025/008 extends real-time sanctions screening to the Omani insurance sector for the first time. The 5% false positive rate target is aggressive and requires tuned screening algorithms. The 24-hour blocking and reporting requirement for confirmed hits demands streamlined escalation procedures.',
    aiRiskAssessment:
      'MEDIUM-HIGH RISK — Insurance companies without existing real-time sanctions screening systems face a significant implementation challenge within the 30-day effective period. The 5% false positive target requires careful list tuning and fuzzy matching optimization. High-risk jurisdiction screening for Iran, North Korea, and Syria connections demands enhanced due diligence workflows.',
    aiRecommendedActions:
      '["Implement real-time sanctions screening for policy issuance, claims, and beneficiary changes", "Tune screening algorithms to achieve sub-5% false positive rate", "Establish 24-hour blocking and reporting escalation process", "Develop quarterly CBOA compliance attestation reporting", "Engage independent reviewer for annual sanctions screening audit"]',
    sourceType: 'AUTO_SCRAPER',
    isRead: false,
    entities: [
      { name: 'CBOA Circular CB/INS/2025/008', type: 'REGULATION' },
      { name: 'Central Bank of Oman', type: 'AGENCY' },
      { name: 'Sanctions Screening System', type: 'CONTROL', metadata: '{"lists":["OFAC_SDN","EU_Consolidated","UN_SC"],"falsePositiveTarget":"5%"}' },
      { name: 'OFAC SDN List', type: 'CONTROL' },
    ],
  },

  // 16. Oman FIU PEP identification guidance
  {
    jurisdictionCode: 'OM',
    title: 'Oman FIU Issues Guidance on Politically Exposed Person Identification and Monitoring',
    summary:
      'The Oman Financial Intelligence Unit has issued comprehensive guidance on PEP identification, classification, and ongoing monitoring requirements for financial institutions, with specific provisions for insurance sector PEP risk assessment.',
    fullContent:
      'The Oman FIU has issued Guidance Note GN/2025/01 on PEP identification and monitoring. Key provisions: (1) PEP classification into four tiers — Heads of State, Senior Government Officials, Senior Political Party Officials, and Family/Close Associates; (2) Mandatory PEP screening at policy issuance for all policies with annual premiums exceeding OMR 10,000; (3) Enhanced due diligence for Tier 1 and Tier 2 PEPs including source of wealth verification and senior management approval; (4) Ongoing monitoring of PEP status changes with quarterly re-screening requirement; (5) Specific insurance sector guidance: policy beneficiary changes for PEP policyholders require additional screening; (6) Record-keeping requirements of 10 years post-relationship termination; (7) Mandatory PEP register maintenance with annual reporting to Oman FIU. Effective: May 15, 2025.',
    sourceUrl: 'https://fiu.gov.om/guidance/gn-2025-01-pep',
    sourceCredibility: 'HIGH',
    publishDate: daysFromNow(-16),
    effectiveDate: daysFromNow(70),
    category: 'OPERATIONAL',
    riskScore: 55,
    impactScore: 58,
    aiConfidenceScore: 79,
    aiSummary:
      'Oman FIU Guidance GN/2025/01 provides detailed PEP classification and monitoring requirements with insurance-specific provisions. The four-tier PEP classification is more granular than most GCC jurisdictions. The OMR 10,000 screening threshold for policy issuance will affect a significant portion of life and savings policies.',
    aiRiskAssessment: null,
    aiRecommendedActions: null,
    sourceType: 'MANUAL',
    isRead: false,
    entities: [
      { name: 'Oman FIU Guidance GN/2025/01', type: 'REGULATION' },
      { name: 'Oman Financial Intelligence Unit', type: 'AGENCY' },
      { name: 'PEP Classification System', type: 'CONTROL', metadata: '{"tiers":["head_of_state","senior_govt","senior_political","family_associates"],"screeningThreshold":"OMR 10,000"}' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // KW — State of Kuwait (CBK) — 4 items
  // ═══════════════════════════════════════════════════════════════════════

  // 17. CBK AML/CFT instructions for insurance
  {
    jurisdictionCode: 'KW',
    title: 'CBK Updates AML/CFT Instructions for Insurance Companies',
    summary:
      'The Central Bank of Kuwait has issued updated AML/CFT instructions for insurance companies, introducing mandatory AI-assisted transaction monitoring, enhanced customer risk rating methodologies, and new obligations for group-wide AML compliance for insurance conglomerates.',
    fullContent:
      'The Central Bank of Kuwait (CBK) has issued updated AML/CFT Instructions for Insurance Companies (Version 4.0). Key changes: (1) Mandatory AI-assisted transaction monitoring systems with minimum 95% detection rate for known typologies; (2) Updated customer risk rating methodology with 5-tier classification (Low, Medium-Low, Medium, Medium-High, High); (3) Group-wide AML compliance obligations for insurance conglomerates with cross-border operations; (4) Mandatory AML training program with 24 annual hours for compliance staff and 8 hours for front-line employees; (5) New requirement for independent AML audit by CBK-approved auditors; (6) Enhanced record-keeping requirements for insurance policy documents — 10 years from policy termination; (7) Whistleblower protection program requirements for AML reporting. Effective: July 1, 2025, with 6-month transition period.',
    sourceUrl: 'https://cbk.gov.kw/instructions/aml-cft-insurance-v4',
    sourceCredibility: 'HIGH',
    publishDate: daysFromNow(-9),
    effectiveDate: daysFromNow(110),
    category: 'REGULATORY',
    riskScore: 80,
    impactScore: 82,
    aiConfidenceScore: 91,
    aiSummary:
      'CBK AML/CFT Instructions v4.0 is the first GCC regulation to mandate AI-assisted transaction monitoring with a quantified detection rate threshold (95%). The 5-tier customer risk rating system aligns with emerging international best practices. Group-wide compliance obligations will impact regional insurance groups operating across multiple GCC jurisdictions.',
    aiRiskAssessment:
      'HIGH RISK — The AI-assisted monitoring requirement with 95% detection rate is technically demanding and may require significant technology investment. The group-wide AML compliance obligation creates cross-border regulatory complexity. The 24-hour annual training requirement for compliance staff is substantially higher than regional norms.',
    aiRecommendedActions:
      '["Evaluate and deploy AI-assisted transaction monitoring systems with 95% detection capability", "Upgrade customer risk rating methodology from current system to 5-tier classification", "Establish group-wide AML compliance governance for cross-border operations", "Develop 24-hour annual AML training curriculum for compliance staff", "Engage CBK-approved auditor for independent AML audit"]',
    sourceType: 'AUTO_SCRAPER',
    isRead: false,
    entities: [
      { name: 'CBK AML/CFT Insurance Instructions v4.0', type: 'REGULATION', metadata: '{"version":"4.0","aiDetectionRate":"95%"}' },
      { name: 'Central Bank of Kuwait', type: 'AGENCY' },
      { name: 'AI Transaction Monitoring System', type: 'CONTROL', metadata: '{"minDetectionRate":"95%","typologies":"known"}' },
      { name: '5-Tier Customer Risk Rating', type: 'CONTROL', metadata: '{"tiers":["low","medium_low","medium","medium_high","high"]}' },
    ],
  },

  // 18. Kuwait FIU suspicious activity monitoring
  {
    jurisdictionCode: 'KW',
    title: 'Kuwait FIU Enhances Suspicious Activity Monitoring Guidelines for Insurance Sector',
    summary:
      'The Kuwait Financial Intelligence Unit has enhanced suspicious activity monitoring guidelines for the insurance sector, identifying 15 new red flag indicators and mandating automated detection for premium financing fraud and claims laundering patterns.',
    fullContent:
      'The Kuwait FIU has issued Enhanced Monitoring Guidelines EMG/2025/03 for the insurance sector. Key updates: (1) 15 new red flag indicators for insurance-specific suspicious activity, including: unusual premium financing structures, rapid succession of policy ownership changes, claims submitted shortly after policy inception, geographic mismatches between policyholder and insured risk, and nominee structures in group policies; (2) Mandatory automated detection systems for premium financing fraud and claims laundering patterns; (3) Quarterly suspicious activity trend reporting to Kuwait FIU; (4) Cross-referencing requirement with Kuwait Anti-Corruption Authority (Nazaha) for PEP-related suspicious activities; (5) Updated SAR filing template with 12 new insurance-specific data fields; (6) Mandatory investigation of all claims exceeding KWD 50,000 filed within 6 months of policy inception. Effective: August 1, 2025.',
    sourceUrl: 'https://kwfiu.gov.kw/guidelines/emg-2025-03-insurance',
    sourceCredibility: 'HIGH',
    publishDate: daysFromNow(-6),
    effectiveDate: daysFromNow(140),
    category: 'RISK',
    riskScore: 68,
    impactScore: 72,
    aiConfidenceScore: 84,
    aiSummary:
      'Kuwait FIU EMG/2025/03 introduces 15 insurance-specific red flag indicators and mandates automated detection for premium financing fraud and claims laundering. The KWD 50,000 threshold for claims investigation within 6 months of policy inception will require claims process redesign. Nazaha cross-referencing adds a unique anti-corruption dimension.',
    aiRiskAssessment:
      'MEDIUM RISK — The 15 new red flag indicators require updates to transaction monitoring rule sets and staff training. Automated detection for premium financing fraud and claims laundering may require specialized analytics tools. The Nazaha cross-referencing obligation creates an additional reporting channel that must be integrated into SAR workflows.',
    aiRecommendedActions:
      '["Update transaction monitoring rules to include 15 new insurance red flags", "Implement automated premium financing fraud detection", "Deploy claims laundering pattern detection algorithms", "Integrate Nazaha cross-referencing into PEP SAR workflows", "Redesign claims investigation process for KWD 50,000 / 6-month threshold"]',
    sourceType: 'AUTO_SCRAPER',
    isRead: false,
    entities: [
      { name: 'Kuwait FIU EMG/2025/03', type: 'REGULATION' },
      { name: 'Kuwait Financial Intelligence Unit', type: 'AGENCY' },
      { name: 'Kuwait Anti-Corruption Authority (Nazaha)', type: 'AGENCY' },
      { name: 'Claims Laundering Detection Module', type: 'CONTROL', metadata: '{"threshold":"KWD 50,000","timeWindow":"6 months"}' },
    ],
  },

  // 19. CBK corporate governance
  {
    jurisdictionCode: 'KW',
    title: 'CBK Proposes New Corporate Governance Requirements for Insurance Companies',
    summary:
      'The Central Bank of Kuwait has proposed comprehensive corporate governance requirements for insurance companies, including board independence mandates, risk management committee obligations, and new remuneration disclosure requirements aligned with Islamic finance principles.',
    fullContent:
      'The Central Bank of Kuwait has published a consultation paper on Corporate Governance Requirements for Insurance Companies. Key proposals: (1) Board of Directors must include minimum 40% independent directors (up from current 30%); (2) Mandatory Risk Management Committee with at least 3 members, all non-executive; (3) New remuneration disclosure requirements aligned with Islamic finance principles — variable remuneration capped at 50% of fixed remuneration; (4) Mandatory Board skills matrix disclosure including insurance, risk management, and digital transformation competencies; (5) Annual Board self-assessment with external validation every 3 years; (6) Chief Risk Officer direct reporting line to Board Risk Committee with protection against discretionary termination; (7) Related party transaction approval threshold lowered to KWD 25,000. Consultation period through June 2025.',
    sourceUrl: 'https://cbk.gov.kw/consultations/corporate-governance-insurance-2025',
    sourceCredibility: 'HIGH',
    publishDate: daysFromNow(-11),
    effectiveDate: daysFromNow(240),
    category: 'POLICY',
    riskScore: 55,
    impactScore: 60,
    aiConfidenceScore: 75,
    aiSummary:
      'CBK corporate governance proposals align with regional trends toward enhanced board oversight. The 40% independent director requirement and Islamic finance-aligned remuneration caps are notable differentiators. The CRO protection clause is a regional first for insurance sector governance.',
    aiRiskAssessment: null,
    aiRecommendedActions: null,
    sourceType: 'MANUAL',
    isRead: false,
    entities: [
      { name: 'CBK Corporate Governance Consultation 2025', type: 'REGULATION' },
      { name: 'Central Bank of Kuwait', type: 'AGENCY' },
      { name: 'Board Risk Management Committee', type: 'DEPARTMENT', metadata: '{"minMembers":3,"composition":"all_non_executive"}' },
    ],
  },

  // 20. GCC-wide digital identity initiative
  {
    jurisdictionCode: 'KW',
    title: 'GCC-Wide Digital Identity Verification Initiative for Financial Services Launches Pilot Phase',
    summary:
      'A GCC-wide digital identity verification initiative has entered pilot phase, enabling cross-border e-KYC verification between UAE, Saudi Arabia, and Kuwait financial institutions, with plans to extend to all six GCC member states by 2027.',
    fullContent:
      'The GCC Digital Identity Verification Initiative (GCC-DIVI) has launched its pilot phase, enabling real-time cross-border e-KYC verification between financial institutions in the UAE, Saudi Arabia, and Kuwait. Key details: (1) Pilot covers 12 financial institutions across the three countries; (2) Digital identity tokens comply with ISO 18013-5 standard for mobile driving license and digital ID; (3) Cross-border verification completes in under 30 seconds; (4) Privacy-by-design architecture with no central data repository — peer-to-peer verification only; (5) Insurance sector use cases include cross-border policy issuance and claims verification; (6) Bahrain, Qatar, and Oman scheduled to join in Phase 2 (Q1 2026); (7) Full GCC coverage expected by 2027. The initiative is supported by CBUAE, SAMA, and CBK, with technical coordination by the GCC Secretariat.',
    sourceUrl: 'https://gcc-sg.org/initiatives/gcc-divi-pilot-2025',
    sourceCredibility: 'MEDIUM',
    publishDate: daysFromNow(-2),
    effectiveDate: null,
    category: 'NEWS',
    riskScore: 40,
    impactScore: 45,
    aiConfidenceScore: 65,
    aiSummary:
      'The GCC-DIVI pilot represents a significant step toward seamless cross-border financial services in the GCC. For insurance companies, this could streamline cross-border policy issuance and claims processing. The privacy-by-design architecture addresses data sovereignty concerns that have previously hindered regional KYC sharing.',
    aiRiskAssessment: null,
    aiRecommendedActions: null,
    sourceType: 'AI_GENERATED',
    isRead: true,
    entities: [
      { name: 'GCC Digital Identity Verification Initiative (GCC-DIVI)', type: 'REGULATION', metadata: '{"standard":"ISO 18013-5","verificationTime":"30 seconds","phases":3}' },
      { name: 'GCC Secretariat General', type: 'AGENCY' },
      { name: 'Cross-Border e-KYC System', type: 'CONTROL', metadata: '{"architecture":"peer-to-peer","dataStorage":"decentralized"}' },
    ],
  },
];

// ─── Main seed function ──────────────────────────────────────────────────────

async function seedIntelligence() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  IC-OS Intelligence Engine Seed — GCC Regulatory Data');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── Step 1: Get jurisdiction IDs from DB ──────────────────────────────────
  console.log('📋 Step 1: Fetching jurisdictions from database...');
  const jurisdictions = await db.jurisdiction.findMany();
  const jMap = Object.fromEntries(jurisdictions.map((j) => [j.code, j.id]));

  // Verify all 6 GCC jurisdictions exist
  const requiredCodes = ['AE', 'SA', 'BH', 'QA', 'OM', 'KW'];
  for (const code of requiredCodes) {
    if (!jMap[code]) {
      console.error(`❌ Jurisdiction with code "${code}" not found in database. Please run the base seed first.`);
      process.exit(1);
    }
  }
  console.log(`   ✅ All 6 GCC jurisdictions found: ${jurisdictions.map((j) => `${j.code} (${j.regulatorName})`).join(', ')}\n`);

  // ── Step 2: Check idempotency ────────────────────────────────────────────
  const existingCount = await db.intelligenceItem.count();
  if (existingCount > 0) {
    console.log(`⏭️  IntelligenceItem table already has ${existingCount} records, skipping seed.\n`);
    return;
  }

  // ── Step 3: Create IntelligenceItem + IntelligenceEntity records ──────────
  console.log(`📝 Step 2: Creating ${INTELLIGENCE_SEEDS.length} IntelligenceItem records...`);
  let entityCount = 0;

  for (let i = 0; i < INTELLIGENCE_SEEDS.length; i++) {
    const seed = INTELLIGENCE_SEEDS[i];
    const jurisdictionId = jMap[seed.jurisdictionCode];
    if (!jurisdictionId) {
      console.warn(`   ⚠️  Skipping item "${seed.title}" — jurisdiction ${seed.jurisdictionCode} not found`);
      continue;
    }

    const item = await db.intelligenceItem.create({
      data: {
        title: seed.title,
        summary: seed.summary,
        fullContent: seed.fullContent,
        sourceUrl: seed.sourceUrl,
        sourceCredibility: seed.sourceCredibility,
        publishDate: seed.publishDate,
        effectiveDate: seed.effectiveDate,
        category: seed.category,
        riskScore: seed.riskScore,
        impactScore: seed.impactScore,
        aiConfidenceScore: seed.aiConfidenceScore,
        aiSummary: seed.aiSummary,
        aiRiskAssessment: seed.aiRiskAssessment,
        aiRecommendedActions: seed.aiRecommendedActions,
        sourceType: seed.sourceType,
        isRead: seed.isRead,
        jurisdictionId,
        entities: {
          create: seed.entities.map((e) => ({
            name: e.name,
            type: e.type,
            metadata: e.metadata,
          })),
        },
      },
      include: { entities: true },
    });

    entityCount += item.entities.length;
    console.log(`   ${i + 1}/${INTELLIGENCE_SEEDS.length}. [${seed.jurisdictionCode}] ${seed.category} — ${seed.title} (${item.entities.length} entities)`);
  }

  // ── Step 4: Summary ──────────────────────────────────────────────────────
  const finalCount = await db.intelligenceItem.count();
  const finalEntityCount = await db.intelligenceEntity.count();

  // Category breakdown
  const categoryBreakdown: Record<string, number> = {};
  for (const seed of INTELLIGENCE_SEEDS) {
    categoryBreakdown[seed.category] = (categoryBreakdown[seed.category] || 0) + 1;
  }

  // Jurisdiction breakdown
  const jurisdictionBreakdown: Record<string, number> = {};
  for (const seed of INTELLIGENCE_SEEDS) {
    jurisdictionBreakdown[seed.jurisdictionCode] = (jurisdictionBreakdown[seed.jurisdictionCode] || 0) + 1;
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  ✅ Seed Complete — Summary');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  IntelligenceItem records : ${finalCount}`);
  console.log(`  IntelligenceEntity records: ${finalEntityCount}`);
  console.log('\n  📊 By Category:');
  for (const [cat, count] of Object.entries(categoryBreakdown).sort()) {
    console.log(`     ${cat.padEnd(14)}: ${count}`);
  }
  console.log('\n  🌍 By Jurisdiction:');
  for (const [code, count] of Object.entries(jurisdictionBreakdown).sort()) {
    const j = jurisdictions.find((j) => j.code === code);
    console.log(`     ${code} (${j?.regulatorName?.padEnd(5) ?? '???'}) : ${count}`);
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// ── Execute ──────────────────────────────────────────────────────────────────

seedIntelligence()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
