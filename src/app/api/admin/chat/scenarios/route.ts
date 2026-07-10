/**
 * Scenario-Based RAG Chat API — IC-OS Compliance Platform
 *
 * Provides zero-hallucination, scenario-grounded AI responses by:
 *   1. Searching the ScenarioKnowledge database for relevant scenarios
 *   2. Constructing a context-enriched prompt with matched scenarios
 *   3. Using z-ai-web-dev-sdk for LLM completion
 *   4. Logging all interactions for audit trail
 *
 * SQLite Compatibility: Uses Prisma findMany (not raw pgvector SQL).
 * Fallback: If primary search fails, falls back to SQLite contains() text search.
 * Error Handling: Returns structured JSON on all error paths — no broken streams.
 *
 * Reference: FDL 10/2025, CR 134/2025, CBUAE Notice 3551/2021
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { authGuard } from '@/lib/auth-guard';
import { ACTIVE_AI_MODEL, AI_THINKING_CONFIG } from '@/lib/ai/model';
import { sanitizeObject, stripPIIFromText } from '@/lib/pii';
import { applyRateLimit } from '@/lib/rate-limit';

// ─── Zod Validation ─────────────────────────────────────────────────────────

// ─── Confidence Threshold ──────────────────────────────────────────────────
// Minimum score for a scenario to be considered relevant enough for LLM injection.
// Below this threshold, we bypass the LLM entirely to prevent hallucination
// from weak/irrelevant context.
const MIN_RELEVANCE_SCORE = 3;

// Standardized fallback message when no relevant scenarios are found
const NO_CONTEXT_FALLBACK =
  'I could not find a specific predefined workflow for this in the IC-OS Knowledge Base. Please consult the MLRO or refer to the CBUAE/Regulatory manual.';

const scenarioChatSchema = z.object({
  message: z.string().min(1).max(4000),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
});

// ─── Keyword-to-Tag Mapping ─────────────────────────────────────────────────

const KEYWORD_TAG_MAP: Record<string, string[]> = {
  'early surrender': ['EarlySurrender', 'ThirdPartyPayout', 'Layering'],
  'takaful': ['Takaful', 'Hibah', 'ShariaCompliance'],
  'hibah': ['Hibah', 'Takaful', 'PEP'],
  'pep': ['PEP', 'RCA', 'EDD'],
  'politically exposed': ['PEP', 'RCA', 'EDD'],
  'sanctions': ['Sanctions', 'OFAC50Rule', 'SDN'],
  'ubo': ['UBO', 'ShellCompany', 'OFAC50Rule'],
  'beneficial ownership': ['UBO', 'ShellCompany', 'OFAC50Rule'],
  'goaml': ['goAML', 'SAR', 'STR', 'CTR'],
  'sar': ['SAR', 'goAML', 'STR'],
  'str': ['STR', 'goAML', 'SAR'],
  'ctr': ['CTR', 'goAML', 'CashTransaction'],
  'structur': ['Structuring', 'Smurfing', 'Layering'],
  'smurfing': ['Smurfing', 'Structuring'],
  'layering': ['Layering', 'Structuring'],
  'fraud ring': ['FraudRing', 'GraphAnalytics', 'Collusion'],
  'graph': ['GraphAnalytics', 'FraudRing', 'NetworkAnalysis'],
  'black swan': ['BlackSwan', 'GeopoliticalShock', 'CrisisManagement'],
  'vasp': ['VASP', 'Crypto', 'VARA'],
  'crypto': ['Crypto', 'VASP', 'Blockchain'],
  'esg': ['ESG', 'Greenwashing', 'Sustainability'],
  'broker': ['Broker', 'PremiumSplitting', 'Intermediary'],
  'reinsurance': ['Reinsurance', 'Retrocession', 'CounterpartyDD'],
  'captive': ['CaptiveInsurance', 'FundShifting', 'TransferPricing'],
  'micro-policy': ['MicroPolicy', 'InsurTech', 'BotFraud'],
  'insurtech': ['InsurTech', 'MicroPolicy', 'DigitalOnboarding'],
  'training': ['Training', 'Certification', 'AMLTraining'],
  'audit': ['Audit', 'Inspection', 'RegulatoryExamination'],
  'whistleblower': ['Whistleblower', 'IncidentManagement', 'InsiderThreat'],
  'dual-use': ['DualUseGoods', 'MarineCargo', 'ExportControl'],
  'unclaimed': ['UnclaimedFunds', 'DormantAccount', 'ReKYC'],
  'parametric': ['ParametricInsurance', 'SmartContract', 'Oracle'],
  'de-risk': ['DeRisking', 'ManagedExit', 'RunOff'],
  'disaster recovery': ['DisasterRecovery', 'BusinessContinuity', 'ComplianceVault'],
  'side-letter': ['SideLetter', 'Reinsurance', 'NLP'],
  'shadow director': ['ShadowDirector', 'AdverseMedia', 'UBO'],
  'circuit breaker': ['CircuitBreaker', 'APIFailure', 'DegradedMode'],
  'tipping-off': ['TippingOff', 'SAR', 'DLP'],
  'right to be forgotten': ['RightToBeForgotten', 'PDPL', 'LegalHold'],
  'pdpl': ['PDPL', 'DataPrivacy', 'DataResidency'],
  'data residency': ['DataResidency', 'PDPL', 'CrossBorder'],
  'marine cargo': ['MarineCargo', 'TradeBased', 'Structuring'],
  'trade-based': ['TBML', 'TradeBased', 'InvoiceFraud'],
  'invoice': ['InvoiceFraud', 'TBML', 'TradeCredit'],
  'medical tourism': ['MedicalTourism', 'HealthInsurance', 'BillingFraud'],
  'health insurance': ['HealthInsurance', 'MedicalFraud', 'BillingAnomaly'],
  'claim': ['Claims', 'FraudDetection', 'SIU'],
  'dormant': ['DormantAccount', 'UnclaimedFunds', 'Reactivation'],
  'retrocession': ['Retrocession', 'Reinsurance', 'KYCC'],
  'supply chain': ['SupplyChain', 'VendorDD', 'ThirdPartyRisk'],
  'vendor': ['VendorDD', 'ThirdPartyRisk', 'SupplyChain'],
  'identity': ['IdentityVerification', 'Deepfake', 'SyntheticIdentity'],
  'deepfake': ['Deepfake', 'SyntheticIdentity', 'LivenessDetection'],
  'ransomware': ['Ransomware', 'CyberInsurance', 'SanctionsEvasion'],
  'cyber': ['CyberInsurance', 'Ransomware', 'DataBreach'],
  'model drift': ['ModelDrift', 'AI', 'MRM'],
  'model risk': ['MRM', 'AI', 'ModelDrift'],
  'agentic': ['AgenticAI', 'AutonomousSAR', 'PolicyAgent'],
  'autonomous sar': ['AutonomousSAR', 'AgenticAI', 'SAR'],
  'gold': ['Gold', 'TBML', 'DualUseGoods'],
  'premium financ': ['PremiumFinancing', 'SOF', 'Layering'],
  'ofac 50': ['OFAC50Rule', 'UBO', 'Sanctions'],
  '50% rule': ['OFAC50Rule', 'UBO', 'Sanctions'],
  'royal family': ['RoyalFamily', 'PEP', 'GCCPEP', 'ExtremeEDD'],
  'gcc pep': ['GCCPEP', 'PEP', 'RoyalFamily', 'SOE'],
  'soe': ['SOE', 'PEP', 'GCCPEP'],
  'maker-checker': ['MakerChecker', 'FourEyes', 'ApprovalWorkflow'],
  'four eyes': ['FourEyes', 'MakerChecker'],
  'sunset clause': ['SunsetClause', 'Sanctions', 'Reassessment'],
  'fuzzy match': ['FuzzyMatching', 'Sanctions', 'PhoneticMatch'],
  'aml assessment': ['AMLAssessment', 'SelfAssessment'],
  'risk assessment': ['RiskAssessment', 'EnterpriseWide'],
  'emirates id': ['EmiratesID', 'DocumentExpiry', 'KYC'],
  'iqama': ['Iqama', 'DocumentExpiry', 'KSA'],
  'civil id': ['CivilID', 'DocumentExpiry', 'Kuwait'],
  'document expir': ['DocumentExpiry', 'Renewal', 'Restriction'],
  'beneath threshold': ['Structuring', 'ThresholdAvoidance'],
  'kyc': ['KYC', 'UBO', 'EDD', 'CDD'],
  'cdd': ['CDD', 'KYC', 'EDD'],
  'edd': ['EDD', 'KYC', 'PEP'],
  'mlro': ['MLRO', 'SAR', 'Compliance'],
  'aml': ['AML', 'AlertTriage', 'TransactionMonitoring'],
  'screening': ['Screening', 'Sanctions', 'AdverseMedia'],
  'reporting': ['Reporting', 'goAML', 'CBUAE'],
};

// ─── RAG Search Function (SQLite-Compatible) ─────────────────────────────────

interface MatchedScenario {
  id: string;
  title: string;
  packNumber: number;
  category: string;
  scenarioText: string;
  complexity: string;
  systemWorkflow: string;
  regulatoryAnchor: string;
  tags: string;
  riskLevel: string;
  score: number;
}

/**
 * Primary search: In-memory scoring across all active scenarios.
 * This works with SQLite (no pgvector required) and handles 122 records efficiently.
 */
async function searchRelevantScenarios(query: string, limit: number = 5): Promise<MatchedScenario[]> {
  const lowerQuery = query.toLowerCase();
  const scoredScenarios: MatchedScenario[] = [];

  try {
    // Fetch all active scenarios (acceptable for 122 records)
    const allScenarios = await db.scenarioKnowledge.findMany({
      where: { isActive: true },
    });

    for (const scenario of allScenarios) {
      let score = 0;
      const searchVec = scenario.searchVector?.toLowerCase() || '';

      // Strategy 1: Tag matching via keyword-to-tag map
      for (const [keyword, tags] of Object.entries(KEYWORD_TAG_MAP)) {
        if (lowerQuery.includes(keyword)) {
          try {
            const scenarioTags: string[] = JSON.parse(scenario.tags || '[]');
            const overlap = tags.filter(t => scenarioTags.some(st => st.toLowerCase().includes(t.toLowerCase())));
            score += overlap.length * 3; // High weight for tag matches
          } catch {
            // Skip if tags parsing fails
          }
        }
      }

      // Strategy 2: Category matching
      const categoryWords = scenario.category.toLowerCase().split(/\s+/);
      for (const word of categoryWords) {
        if (word.length > 3 && lowerQuery.includes(word)) {
          score += 2;
        }
      }

      // Strategy 3: Direct keyword matching in searchVector
      const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 3);
      for (const word of queryWords) {
        if (searchVec.includes(word)) {
          score += 1;
        }
      }

      // Strategy 4: Exact phrase matching bonus
      if (searchVec.includes(lowerQuery)) {
        score += 5;
      }

      // Strategy 5: Title matching bonus
      if (scenario.title.toLowerCase().includes(lowerQuery) || lowerQuery.includes(scenario.title.toLowerCase())) {
        score += 4;
      }

      if (score > 0) {
        scoredScenarios.push({
          id: scenario.id,
          title: scenario.title,
          packNumber: scenario.packNumber,
          category: scenario.category,
          scenarioText: scenario.scenarioText,
          complexity: scenario.complexity,
          systemWorkflow: scenario.systemWorkflow,
          regulatoryAnchor: scenario.regulatoryAnchor,
          tags: scenario.tags,
          riskLevel: scenario.riskLevel,
          score,
        });
      }
    }

    // Sort by score descending, return top N
    scoredScenarios.sort((a, b) => b.score - a.score);
  } catch (primaryError) {
    console.error('[RAG] Primary search failed, using SQLite contains fallback:', primaryError);

    // CRITICAL FALLBACK: If the primary Prisma query fails for any reason
    // (e.g., schema mismatch, connection issue), use a simpler contains search
    try {
      const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 3);
      const fallbackScenarios = await db.scenarioKnowledge.findMany({
        where: {
          isActive: true,
          OR: [
            { title: { contains: lowerQuery } },
            { scenarioText: { contains: lowerQuery } },
            ...queryWords.map(word => ({
              searchVector: { contains: word } as const,
            })).slice(0, 5), // Limit OR conditions for SQLite
          ],
        },
        take: limit,
      });

      for (const scenario of fallbackScenarios) {
        scoredScenarios.push({
          id: scenario.id,
          title: scenario.title,
          packNumber: scenario.packNumber,
          category: scenario.category,
          scenarioText: scenario.scenarioText,
          complexity: scenario.complexity,
          systemWorkflow: scenario.systemWorkflow,
          regulatoryAnchor: scenario.regulatoryAnchor,
          tags: scenario.tags,
          riskLevel: scenario.riskLevel,
          score: 1, // Base score for fallback matches
        });
      }
    } catch (fallbackError) {
      console.error('[RAG] SQLite fallback search also failed:', fallbackError);
      // Return empty — the route handler will use the "no scenarios" response path
    }
  }

  return scoredScenarios.slice(0, limit);
}

// ─── RAG System Prompt ───────────────────────────────────────────────────────

function buildRAGPrompt(scenarios: MatchedScenario[]): string {
  const context = scenarios
    .map(
      (s) =>
        `### Pack ${s.packNumber} — "${s.title}" (${s.category})
Scenario: ${s.scenarioText}
Complexity: ${s.complexity}
System Workflow: ${s.systemWorkflow}
Regulatory Anchor: ${s.regulatoryAnchor}
Risk Level: ${s.riskLevel}`
    )
    .join('\n\n---\n\n');

  return `You are the IC-OS Expert Compliance Assistant, a hyper-specialized AI trained on 122 battle-tested operational scenarios for UAE/GCC AML/CFT compliance (Packs 1-11).

CRITICAL RULES:
1. Answer using ONLY the provided scenario context below. Never fabricate regulatory references or workflows.
2. Always cite the Pack number and Scenario Title when referencing a scenario (e.g., "Per Pack 5, 'The Early Surrender & Third-Party Payout Exploit'...").
3. If the answer isn't in the provided context, state: "I cannot find a specific predefined workflow for this in the IC-OS knowledge base. Please escalate to the MLRO."
4. Keep responses structured, actionable, and aligned with UAE/GCC AML/CFT standards.
5. For critical compliance decisions, always recommend consulting the MLRO.
6. Never provide legal advice — recommend Legal Advisory for complex legal questions.
7. Remind users that AI responses are guidance only and must be verified against official regulatory texts.

RELEVANT KNOWLEDGE BASE CONTEXT:
${context}

FORMAT YOUR RESPONSE AS:
- **Scenario Reference**: Pack X — "Title"
- **Regulatory Basis**: [from regulatoryAnchor]
- **Recommended Workflow**: [from systemWorkflow]
- **Key Risk**: [from complexity]
- **Next Steps**: Actionable recommendations`;
}

// ─── Fallback Response Builder ───────────────────────────────────────────────

function buildFallbackResponse(scenarios: MatchedScenario[], query: string): string {
  if (scenarios.length === 0) {
    return `I cannot find a specific predefined workflow for "${query}" in the IC-OS knowledge base. Please escalate to the MLRO.\n\n💡 Try asking about: early surrender, Takaful, PEP, sanctions, UBO, goAML, SAR, structuring, fraud rings, VASP, ESG, reinsurance, or any other AML/CFT compliance topic.`;
  }

  return scenarios
    .map(
      (s) =>
        `**Pack ${s.packNumber} — "${s.title}"** (${s.category})\n` +
        `• **Risk Level**: ${s.riskLevel.toUpperCase()}\n` +
        `• **Scenario**: ${s.scenarioText}\n` +
        `• **Complexity**: ${s.complexity}\n` +
        `• **System Workflow**: ${s.systemWorkflow}\n` +
        `• **Regulatory Anchor**: ${s.regulatoryAnchor}`
    )
    .join('\n\n---\n\n') +
    '\n\n⚠️ AI service temporarily unavailable. Above are direct scenario matches from the knowledge base. Consult the MLRO for critical decisions.';
}

// ─── POST Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard();
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'SENSITIVE');
    if (rateLimitError) return rateLimitError;
    // Step 0: Parse and validate input
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body', response: 'Invalid request format.', scenarios: [], modelUsed: 'error' },
        { status: 400 }
      );
    }

    const validated = scenarioChatSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validated.error.issues, response: 'Request validation failed.', scenarios: [], modelUsed: 'error' },
        { status: 400 }
      );
    }

    const { message, userId, sessionId, conversationHistory } = validated.data;
    const startTime = Date.now();

    // Step 1: Search for relevant scenarios (with SQLite fallback built-in)
    const matchedScenarios = await searchRelevantScenarios(message, 5);

    // Step 2: Empty Context Fallback — If no scenarios matched OR the top score is
    // below the minimum relevance threshold, bypass the LLM entirely and return
    // a standardized fallback. Passing empty/low-quality context to the LLM risks
    // hallucination, which violates the zero-hallucination design principle.
    const topScore = matchedScenarios.length > 0 ? matchedScenarios[0].score : 0;
    if (matchedScenarios.length === 0 || topScore < MIN_RELEVANCE_SCORE) {
      return NextResponse.json({
        success: true,
        response: NO_CONTEXT_FALLBACK,
        scenarios: [],
        modelUsed: matchedScenarios.length === 0 ? 'fallback-no-match' : 'fallback-low-confidence',
        latencyMs: Date.now() - startTime,
        matchedCount: matchedScenarios.length,
        topRelevanceScore: topScore,
        confidenceThreshold: MIN_RELEVANCE_SCORE,
        disclaimer: 'AI responses are for guidance only. Always verify with official UAE regulatory texts.',
      });
    }

    // Step 3: Build RAG prompt with matched scenarios
    const ragSystemPrompt = buildRAGPrompt(matchedScenarios);

    // Step 4: Build messages array for LLM
    const messages: Array<{ role: 'assistant' | 'user'; content: string }> = [
      { role: 'assistant', content: ragSystemPrompt },
    ];

    // Add conversation history (last 8 messages for context window management)
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-8);
      for (const msg of recentHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: message });

    // Step 5: Try AI response with robust fallback chain
    let aiResponse: string;
    let modelUsed: string = ACTIVE_AI_MODEL;

    try {
      // Primary: Use z-ai-web-dev-sdk for production LLM calls
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();

      // Timeout guard: prevent indefinite hangs on LLM calls (30s max)
      const LLM_TIMEOUT_MS = 30_000;
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), LLM_TIMEOUT_MS);

      const completion = await Promise.race([
        zai.chat.completions.create({
          model: ACTIVE_AI_MODEL,
          messages,
          thinking: AI_THINKING_CONFIG,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`LLM call timed out after ${LLM_TIMEOUT_MS / 1000}s`)), LLM_TIMEOUT_MS)
        ),
      ]);

      clearTimeout(timeoutId);

      aiResponse = completion.choices[0]?.message?.content || '';

      if (!aiResponse || aiResponse.trim().length === 0) {
        throw new Error('Empty response from AI SDK');
      }

      modelUsed = ACTIVE_AI_MODEL;
    } catch (sdkError) {
      const errorMsg = sdkError instanceof Error ? sdkError.message : 'unknown';
      if (errorMsg.includes('timed out')) {
        console.warn('[RAG] z-ai-web-dev-sdk timed out, using scenario fallback');
      } else {
        console.warn('[RAG] z-ai-web-dev-sdk failed, using scenario fallback:', errorMsg);
      }

      // Fallback: Use scenario data directly — no hallucination risk
      modelUsed = 'fallback-scenario-rag';
      aiResponse = buildFallbackResponse(matchedScenarios, message);
    }

    // Step 5.5: PII stripping — zero-leakage AI defense
    // If the LLM somehow includes a real Emirates ID, passport, IBAN, or phone
    // number in its response, strip it before the text reaches the user.
    aiResponse = stripPIIFromText(aiResponse);

    const latencyMs = Date.now() - startTime;

    // Step 6: Audit logging (non-blocking — never break the response)
    try {
      await db.auditLog.create({
        data: {
          userId: userId || 'anonymous',
          action: 'RAG_SCENARIO_CHAT',
          resource: 'scenario_knowledge',
          resourceId: sessionId || 'no-session',
          details: JSON.stringify({
            messageLength: message.length,
            matchedScenarios: matchedScenarios.length,
            scenarioIds: matchedScenarios.map((s) => s.id),
            modelUsed,
            latencyMs,
          }),
        },
      });
    } catch {
      // Audit log failure shouldn't break the response
    }

    // Step 7: Track scenario references (non-blocking)
    if (sessionId && matchedScenarios.length > 0) {
      try {
        for (const scenario of matchedScenarios.slice(0, 3)) { // Limit to top 3 for performance
          await db.scenarioChatReference.create({
            data: {
              chatSessionId: sessionId,
              scenarioId: scenario.id,
              relevanceScore: Math.min(scenario.score / 20, 1.0), // Normalize to 0-1
            },
          });
        }
      } catch {
        // Reference tracking failure shouldn't break the response
      }
    }

    // Step 8: Return success response
    return NextResponse.json({
      success: true,
      response: aiResponse,
      scenarios: matchedScenarios.map((s) => ({
        id: s.id,
        title: s.title,
        packNumber: s.packNumber,
        category: s.category,
        relevanceScore: s.score,
        riskLevel: s.riskLevel,
      })),
      modelUsed,
      latencyMs,
      matchedCount: matchedScenarios.length,
      disclaimer:
        'AI responses are for guidance only. Always verify with official UAE regulatory texts. Per FDL 10/2025, MLRO consultation is required for critical compliance decisions.',
    });
  } catch (error) {
    // Catch-all: Any unexpected error returns structured JSON, never a broken stream
    console.error('[RAG] Unhandled error in chat/scenarios:', error);

    const isZodError = error instanceof z.ZodError;

    return NextResponse.json(
      {
        success: false,
        response: isZodError
          ? 'Invalid request format. Please check your input and try again.'
          : 'The knowledge base is currently unavailable. Please contact the MLRO or try again shortly.',
        scenarios: [],
        modelUsed: 'error',
        matchedCount: 0,
        disclaimer: 'AI responses are for guidance only.',
        ...(isZodError ? { details: (error as z.ZodError).issues } : {}),
      },
      { status: isZodError ? 400 : 500 }
    );
  }
}

// ─── GET Handler — Scenario Search ───────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard();
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'SENSITIVE');
    if (rateLimitError) return rateLimitError;
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const packNumber = searchParams.get('pack');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (query) {
      const scenarios = await searchRelevantScenarios(query, limit);
      return NextResponse.json({ success: true, data: scenarios });
    }

    // Browse by pack or category
    const where: Record<string, unknown> = { isActive: true };
    if (packNumber) where.packNumber = parseInt(packNumber, 10);
    if (category) where.category = category;

    const scenarios = await db.scenarioKnowledge.findMany({
      where,
      take: limit,
      orderBy: { packNumber: 'asc' },
      select: {
        id: true,
        packNumber: true,
        category: true,
        title: true,
        riskLevel: true,
        tags: true,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, data: scenarios });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to search scenarios' },
      { status: 500 }
    );
  }
}
