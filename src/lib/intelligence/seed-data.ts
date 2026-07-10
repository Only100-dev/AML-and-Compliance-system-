/**
 * Intelligence Seed Data — Generates realistic GCC regulatory intelligence
 * for demonstration and testing of the Intelligence Engine.
 */
import { db } from '@/lib/db';
import { GCC_JURISDICTIONS, JURISDICTION_CONTEXTS } from './jurisdiction-contexts';

const SEED_ITEMS = [
  { title: 'SAMA Updates AML/CFT Rules for Digital Banking', summary: 'SAMA issued updated AML/CFT guidelines specifically addressing digital banking operations, requiring enhanced transaction monitoring and customer due diligence for fintech platforms.', sourceName: 'SAMA', category: 'REGULATORY', riskScore: 78, riskLevel: 'HIGH', credibility: 'OFFICIAL', jurisdictionId: 'SA', regulator: 'SAMA', tags: '["AML","digital banking","fintech"]' },
  { title: 'CBUAE Enforcement Action: Insurance Broker Penalties', summary: 'CBUAE imposed administrative penalties on three insurance brokers for non-compliance with AML reporting requirements under Notice 3551/2021.', sourceName: 'CBUAE', category: 'ENFORCEMENT', riskScore: 85, riskLevel: 'HIGH', credibility: 'OFFICIAL', jurisdictionId: 'AE', regulator: 'CBUAE', tags: '["enforcement","insurance","AML reporting"]' },
  { title: 'CBB Issues New Guidance on Beneficial Ownership', summary: 'The Central Bank of Bahrain released comprehensive guidance on beneficial ownership identification and verification, aligning with FATF Recommendation 24.', sourceName: 'CBB', category: 'GUIDANCE', riskScore: 45, riskLevel: 'MEDIUM', credibility: 'OFFICIAL', jurisdictionId: 'BH', regulator: 'CBB', tags: '["beneficial ownership","FATF","CDD"]' },
  { title: 'QCB Tightens Crypto Asset Service Provider Requirements', summary: 'Qatar Central Bank announced stricter requirements for Virtual Asset Service Providers (VASPs), including mandatory AML programs and periodic audits.', sourceName: 'QCB', category: 'REGULATORY', riskScore: 72, riskLevel: 'HIGH', credibility: 'OFFICIAL', jurisdictionId: 'QA', regulator: 'QCB', tags: '["crypto","VASP","virtual assets"]' },
  { title: 'CBOA Issues Advisory on PEP Risk Management', summary: 'The Central Bank of Oman issued an advisory on enhanced due diligence measures for Politically Exposed Persons (PEPs), including domestic PEPs.', sourceName: 'CBOA', category: 'ADVISORY', riskScore: 55, riskLevel: 'MEDIUM', credibility: 'OFFICIAL', jurisdictionId: 'OM', regulator: 'CBOA', tags: '["PEP","EDD","risk management"]' },
  { title: 'CBK Proposes New Sanctions Screening Standards', summary: 'The Central Bank of Kuwait proposed new standards for real-time sanctions screening, requiring automated screening for all transactions above KWD 5,000.', sourceName: 'CBK', category: 'REGULATORY', riskScore: 68, riskLevel: 'MEDIUM', credibility: 'VERIFIED', jurisdictionId: 'KW', regulator: 'CBK', tags: '["sanctions","screening","real-time"]' },
  { title: 'SAMA Warns of Rising Trade-Based Money Laundering', summary: 'SAMA issued an industry-wide alert about increasing trade-based money laundering (TBML) patterns in the GCC region, with specific red flags for over/under-invoicing.', sourceName: 'SAMA', category: 'ADVISORY', riskScore: 90, riskLevel: 'CRITICAL', credibility: 'OFFICIAL', jurisdictionId: 'SA', regulator: 'SAMA', tags: '["TBML","trade finance","red flags"]' },
  { title: 'CBB Enforcement: Bank Fined for SAR Filing Delays', summary: 'Central Bank of Bahrain fined a local bank BHD 250,000 for systematic delays in Suspicious Activity Report filings, citing CBB Rulebook violations.', sourceName: 'CBB', category: 'ENFORCEMENT', riskScore: 82, riskLevel: 'HIGH', credibility: 'OFFICIAL', jurisdictionId: 'BH', regulator: 'CBB', tags: '["SAR","filing delays","enforcement"]' },
  { title: 'CBUAE Introduces ESG Risk Assessment Framework', summary: 'CBUAE published a new Environmental, Social, and Governance risk assessment framework for financial institutions, with compliance deadlines in Q3 2025.', sourceName: 'CBUAE', category: 'REGULATORY', riskScore: 40, riskLevel: 'LOW', credibility: 'OFFICIAL', jurisdictionId: 'AE', regulator: 'CBUAE', tags: '["ESG","risk assessment","sustainability"]' },
  { title: 'GCC Cross-Border AML Coordination Framework', summary: 'A new cross-border coordination framework between GCC financial intelligence units has been established to share SARs and coordinate investigations across jurisdictions.', sourceName: 'GCC Secretariat', category: 'REGULATORY', riskScore: 65, riskLevel: 'MEDIUM', credibility: 'VERIFIED', jurisdictionId: 'AE', regulator: 'CBUAE', tags: '["cross-border","FIU coordination","GCC"]' },
  { title: 'QCB Updates Terrorist Financing Watchlist Procedures', summary: 'Qatar Central Bank updated its procedures for maintaining and screening against terrorist financing watchlists, including UN, EU, and local lists.', sourceName: 'QCB', category: 'GUIDANCE', riskScore: 75, riskLevel: 'HIGH', credibility: 'OFFICIAL', jurisdictionId: 'QA', regulator: 'QCB', tags: '["terrorist financing","watchlist","screening"]' },
  { title: 'CBOA Mandates Enhanced Customer Risk Rating', summary: 'Central Bank of Oman mandated the implementation of dynamic customer risk rating systems, requiring periodic re-evaluation based on transaction patterns.', sourceName: 'CBOA', category: 'REGULATORY', riskScore: 58, riskLevel: 'MEDIUM', credibility: 'OFFICIAL', jurisdictionId: 'OM', regulator: 'CBOA', tags: '["risk rating","dynamic scoring","CDD"]' },
];

const SEED_TRENDS = [
  { title: 'GCC-Wide Digital Banking AML Convergence', description: 'Regulatory frameworks across all 6 GCC jurisdictions are converging on common AML/CFT requirements for digital banking and fintech operations.', trendType: 'EMERGING_REGULATION', severity: 'HIGH', confidence: 87, jurisdictions: '["AE","SA","BH","QA","OM","KW"]', sources: '["SAMA","CBUAE","CBB"]', aiModel: 'GLM-5.2', verifiedBy: 'Qwen3.7-Plus', verificationStatus: 'VERIFIED' },
  { title: 'Rising Enforcement Actions for SAR Filing Delays', description: 'Enforcement actions across GCC are increasingly targeting institutions with delayed SAR filings, with penalties doubling year-over-year.', trendType: 'ENFORCEMENT_TREND', severity: 'HIGH', confidence: 92, jurisdictions: '["AE","SA","BH"]', sources: '["CBUAE","SAMA","CBB"]', aiModel: 'GLM-5.2', verifiedBy: 'Qwen3.7-Plus', verificationStatus: 'VERIFIED' },
  { title: 'Cross-Border TBML Pattern Escalation', description: 'Trade-based money laundering patterns are shifting toward complex multi-jurisdictional structures exploiting GCC free trade zones.', trendType: 'RISK_ESCALATION', severity: 'CRITICAL', confidence: 84, jurisdictions: '["AE","SA","BH","QA"]', sources: '["FATF","SAMA","CBUAE"]', aiModel: 'GLM-5.2', verifiedBy: 'Qwen3.7-Plus', verificationStatus: 'VERIFIED' },
  { title: 'Crypto/VASP Regulation Standardization', description: 'GCC regulators are moving toward standardized VASP regulation, with QCB and CBUAE leading the framework development.', trendType: 'INDUSTRY_SHIFT', severity: 'MEDIUM', confidence: 78, jurisdictions: '["AE","QA","SA"]', sources: '["QCB","CBUAE","SAMA"]', aiModel: 'GLM-5.2', verifiedBy: 'Qwen3.7-Plus', verificationStatus: 'PENDING' },
  { title: 'PEP Due Diligence Harmonization', description: 'GCC regulators are harmonizing PEP due diligence requirements, with CBOA and CBB issuing aligned guidance.', trendType: 'CROSS_JURISDICTION', severity: 'MEDIUM', confidence: 71, jurisdictions: '["BH","OM","KW"]', sources: '["CBB","CBOA","CBK"]', aiModel: 'GLM-5.2', verifiedBy: null, verificationStatus: 'PENDING' },
];

export async function seedIntelligenceData() {
  // Check if data already exists
  const existingItems = await db.intelligenceItem.count();
  if (existingItems > 0) return { itemsExisting: existingItems, seeded: false };

  // Seed intelligence items
  const items = [];
  for (const item of SEED_ITEMS) {
    const created = await db.intelligenceItem.create({
      data: {
        ...item,
        publishedDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        aiSummary: `AI Analysis: ${item.summary}`,
        aiVerified: Math.random() > 0.3,
        sourceLineage: JSON.stringify([item.sourceName]),
        chainOfThought: JSON.stringify({
          reasoning: `Identified ${item.category.toLowerCase()} intelligence from ${item.sourceName}`,
          confidence: item.riskScore,
        }),
      },
    });
    items.push(created);
  }

  // Seed trend signals
  for (const trend of SEED_TRENDS) {
    await db.trendSignal.create({
      data: {
        ...trend,
        chainOfThought: JSON.stringify({
          reasoning: `Cross-jurisdictional analysis detected ${trend.trendType.replace('_', ' ').toLowerCase()}`,
          methodology: 'Pattern matching across GCC regulatory publications',
        }),
      },
    });
  }

  // Seed agent config
  const existingConfig = await db.agentConfig.count();
  if (existingConfig === 0) {
    await db.agentConfig.create({
      data: {
        isScannerActive: true,
        scanIntervalMinutes: 60,
        confidenceThreshold: 50,
        riskThreshold: 70,
        maxItemsPerScan: 50,
        enabledJurisdictions: JSON.stringify(['AE', 'SA', 'BH', 'QA', 'OM', 'KW']),
        enabledSources: JSON.stringify(['SAMA', 'CBUAE', 'CBB', 'QCB', 'CBOA', 'CBK', 'FATF', 'GCC Secretariat']),
      },
    });
  }

  // Seed a scan log
  await db.agentScanLog.create({
    data: {
      scanType: 'SCHEDULED',
      jurisdictionId: null,
      sourcesQueried: JSON.stringify(['SAMA', 'CBUAE', 'CBB', 'QCB', 'CBOA', 'CBK']),
      sourcesIgnored: JSON.stringify(['social_media', 'unverified_blogs']),
      itemsFound: 12,
      itemsIngested: 12,
      trendSignalsGenerated: 5,
      confidenceThreshold: 50,
      riskThreshold: 70,
      status: 'COMPLETED',
      duration: 8400,
      triggeredBy: 'system',
      aiModel: 'GLM-5.2',
      completedAt: new Date(),
    },
  });

  return { itemsSeeded: items.length, seeded: true };
}
