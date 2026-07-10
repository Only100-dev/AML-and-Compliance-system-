/**
 * RAG AI Policy Wizard API — IC-OS Compliance Platform
 * P3-1: AI-powered policy generation with hallucination guard
 *
 * Uses z-ai-web-dev-sdk for LLM-powered policy drafting with:
 *   - Regulatory knowledge base grounding
 *   - Hallucination prevention
 *   - Confidence scoring
 *   - Gap identification
 *   - Jurisdiction-aware system prompts (Phase 2, Action 2.5)
 *
 * Reference: Jurisdiction-aware (CBUAE/SAMA/CBB/QCB/CBOA/CBK), FATF Recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod/v4';
import { authGuard } from '@/lib/auth-guard';
import { stripPIIFromText } from '@/lib/pii';
import { applyRateLimit } from '@/lib/rate-limit';
import { ALL_JURISDICTION_CODES } from '@/lib/constants/jurisdictions';
import { ACTIVE_AI_MODEL, AI_THINKING_CONFIG } from '@/lib/ai/model';
import { getSystemPrompt } from '@/lib/prompts';
import { getRegulatoryThresholds } from '@/lib/regulatory/thresholds';
import {
  mapRegulations,
  generatePolicyDraft,
  reviewPolicyDraft,
  REGULATORY_KNOWLEDGE_BASE,
  HALLUCINATION_GUARD,
  type PolicyType,
  type PolicyCategory,
  type Jurisdiction,
  type PolicyDraft,
  type ReviewResult,
  type RegulatoryMapEntry,
} from '@/lib/compliance/rag-policy-wizard';

// ─── Zod Validation ─────────────────────────────────────────────────────────

const policyWizardRequestSchema = z.object({
  action: z.enum(['start', 'map', 'draft', 'review', 'ai-enhance', 'save']),
  // Step 1: Start session
  policyType: z.enum([
    'aml_cft', 'sanctions_screening', 'cdd_kyc', 'sar_filing',
    'pep_edd', 'training', 'record_keeping', 'risk_assessment',
    'vendor_dd', 'data_privacy', 'business_continuity', 'outsourcing',
  ]).optional(),
  category: z.enum([
    'AML/CFT', 'Sanctions', 'KYC/CDD', 'Reporting', 'Governance',
    'Operations', 'IT & Security', 'Data Privacy', 'Training', 'Vendor Management',
  ]).optional(),
  jurisdiction: z.enum([...ALL_JURISDICTION_CODES]).optional(),
  // Step 2: Map regulations
  sessionId: z.string().optional(),
  regulatoryMap: z.array(z.object({
    entry: z.object({
      id: z.string(),
      regulation: z.string(),
      article: z.string(),
      requirement: z.string(),
      category: z.string(),
      severity: z.enum(['critical', 'high', 'medium', 'low']),
    }),
    addressed: z.boolean(),
    coverageConfidence: z.number(),
    draftSection: z.string().optional(),
  })).optional(),
  // Step 3: AI-enhance draft
  draft: z.any().optional(),
  sectionTitle: z.string().optional(),
  sectionContent: z.string().optional(),
  // Step 5: Save
  policyId: z.string().optional(),
  title: z.string().optional(),
  version: z.string().optional(),
});

// ─── AI Enhancement with z-ai-web-dev-sdk ────────────────────────────────────

async function enhanceWithAI(
  sectionTitle: string,
  sectionContent: string,
  regulatoryMap: RegulatoryMapEntry[],
  policyType: string,
  jurisdictionId: string = 'AE',
): Promise<{ enhancedContent: string; confidence: number; sources: string[] }> {
  const relevantEntries = regulatoryMap
    .filter(m => m.entry.severity === 'critical' || m.entry.severity === 'high')
    .slice(0, 10);

  const regulatoryContext = relevantEntries
    .map(e => `${e.entry.regulation} ${e.entry.article}: ${e.entry.requirement}`)
    .join('\n');

  // Load jurisdiction-aware system prompt via factory
  const thresholds = getRegulatoryThresholds(jurisdictionId);
  let systemPrompt: string;
  try {
    const result = await getSystemPrompt(jurisdictionId, 'policy');
    systemPrompt = result.prompt;
  } catch {
    systemPrompt = `You are a policy drafting expert for ${thresholds.regulatorName}. You MUST follow these rules:
1. Only reference regulations that exist in the provided regulatory context
2. Never fabricate article numbers or regulation names
3. All factual claims must cite the specific regulation and article
4. Use exact threshold values from the regulations
5. If uncertain about a regulation, flag it for manual review with [REVIEW NEEDED]
6. Output structured policy text that fits the section title
7. Primary regulations: ${thresholds.primaryRegulations.join(', ')}`;
  }

  const userPrompt = `Enhance the following policy section with regulatory-grounded content.

**Regulatory Context (ONLY use these references):**
${regulatoryContext || 'No specific regulations mapped yet.'}

**Policy Type:** ${policyType}
**Section Title:** ${sectionTitle}

**Current Content:**
${sectionContent}

**Instructions:**
- Enhance the content with specific regulatory references
- Add any missing requirements from the regulatory context
- Ensure all thresholds and deadlines match the regulations exactly
- Flag any areas needing manual review with [REVIEW NEEDED]
- Do NOT invent regulatory references not in the provided context`;

  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    // Timeout guard: prevent indefinite hangs on LLM calls (30s max)
    const LLM_TIMEOUT_MS = 30_000;
    const completion = await Promise.race([
      zai.chat.completions.create({
        model: ACTIVE_AI_MODEL,
        messages: [
          { role: 'assistant', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        thinking: AI_THINKING_CONFIG,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`LLM call timed out after ${LLM_TIMEOUT_MS / 1000}s`)), LLM_TIMEOUT_MS)
      ),
    ]);

    const enhancedContent = stripPIIFromText(completion.choices[0]?.message?.content || sectionContent);
    const sources = relevantEntries.map(e => `${e.entry.regulation} ${e.entry.article}`);

    return {
      enhancedContent,
      confidence: 80,
      sources,
    };
  } catch {
    // Fallback: Template-based enhancement without LLM
    return {
      enhancedContent: sectionContent + `\n\n[AI Enhancement unavailable - manual review required. Ground your content in ${thresholds.primaryRegulations.join(', ')}.]`,
      confidence: 40,
      sources: relevantEntries.map(e => `${e.entry.regulation} ${e.entry.article}`),
    };
  }
}

// ─── POST Handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'SENSITIVE');
    if (rateLimitError) return rateLimitError;
    const body = await request.json();
    const validated = policyWizardRequestSchema.parse(body);
    const { action } = validated;

    // Extract jurisdiction from session
    const session = auth.session;
    const sessionJurisdictionId = (session?.user as Record<string, unknown>)?.jurisdictionId as string
      || (session?.user as Record<string, unknown>)?.jurisdiction as string
      || 'AE';

    switch (action) {
      // ── Step 1: Start Session ────────────────────────────────────────
      case 'start': {
        const { policyType, category, jurisdiction } = validated;

        if (!policyType || !category || !jurisdiction) {
          return NextResponse.json(
            { success: false, error: 'policyType, category, and jurisdiction are required for start action' },
            { status: 400 }
          );
        }

        const sessionId = `POL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const regulatoryMap = mapRegulations(
          policyType as PolicyType,
          category as PolicyCategory,
          jurisdiction as Jurisdiction
        );

        return NextResponse.json({
          success: true,
          data: {
            sessionId,
            policyType,
            category,
            jurisdiction,
            currentStep: 1,
            regulatoryMap,
            knowledgeBaseSize: REGULATORY_KNOWLEDGE_BASE.length,
            hallucinationGuardRules: Object.keys(HALLUCINATION_GUARD).length,
          },
        });
      }

      // ── Step 2: Map Regulations ──────────────────────────────────────
      case 'map': {
        const { regulatoryMap, policyType, category, jurisdiction } = validated;

        if (!policyType || !category || !jurisdiction) {
          return NextResponse.json(
            { success: false, error: 'policyType, category, and jurisdiction are required' },
            { status: 400 }
          );
        }

        const freshMap = mapRegulations(
          policyType as PolicyType,
          category as PolicyCategory,
          jurisdiction as Jurisdiction
        );

        // Merge with any user-provided overrides
        const mergedMap = regulatoryMap
          ? freshMap.map(entry => {
              const override = regulatoryMap.find((r: { entry: { id: string } }) => r.entry.id === entry.entry.id);
              if (override) {
                return { ...entry, addressed: override.addressed, coverageConfidence: override.coverageConfidence };
              }
              return entry;
            })
          : freshMap;

        const totalMapped = mergedMap.length;
        const criticalCount = mergedMap.filter(m => m.entry.severity === 'critical').length;
        const highCount = mergedMap.filter(m => m.entry.severity === 'high').length;

        return NextResponse.json({
          success: true,
          data: {
            regulatoryMap: mergedMap,
            summary: {
              totalMapped,
              criticalCount,
              highCount,
              mediumCount: mergedMap.filter(m => m.entry.severity === 'medium').length,
              lowCount: mergedMap.filter(m => m.entry.severity === 'low').length,
            },
          },
        });
      }

      // ── Step 3: Generate Draft ───────────────────────────────────────
      case 'draft': {
        const { policyType, category, jurisdiction } = validated;

        if (!policyType || !category || !jurisdiction) {
          return NextResponse.json(
            { success: false, error: 'policyType, category, and jurisdiction are required' },
            { status: 400 }
          );
        }

        const regulatoryMap = mapRegulations(
          policyType as PolicyType,
          category as PolicyCategory,
          jurisdiction as Jurisdiction
        );

        const draft = generatePolicyDraft(regulatoryMap, policyType as PolicyType);

        return NextResponse.json({
          success: true,
          data: {
            draft,
            regulatoryMap,
            hallucinationGuard: Object.values(HALLUCINATION_GUARD).map(rule => ({
              id: rule.id,
              description: rule.description,
              enforcement: rule.enforcement,
            })),
          },
        });
      }

      // ── Step 4: Review Draft ─────────────────────────────────────────
      case 'review': {
        const { draft, regulatoryMap } = validated;

        if (!draft || !regulatoryMap) {
          return NextResponse.json(
            { success: false, error: 'draft and regulatoryMap are required for review' },
            { status: 400 }
          );
        }

        const reviewResult = reviewPolicyDraft(
          draft as PolicyDraft,
          regulatoryMap as RegulatoryMapEntry[]
        );

        return NextResponse.json({
          success: true,
          data: {
            reviewResult,
            draft,
          },
        });
      }

      // ── Step 5: AI-Enhance Section ───────────────────────────────────
      case 'ai-enhance': {
        const { sectionTitle, sectionContent, regulatoryMap, policyType, jurisdiction } = validated;

        if (!sectionTitle || !sectionContent) {
          return NextResponse.json(
            { success: false, error: 'sectionTitle and sectionContent are required for ai-enhance' },
            { status: 400 }
          );
        }

        // Use the request jurisdiction if provided, otherwise fall back to session jurisdiction
        const effectiveJurisdictionId = jurisdiction
          || sessionJurisdictionId;

        const result = await enhanceWithAI(
          sectionTitle,
          sectionContent,
          (regulatoryMap as RegulatoryMapEntry[]) || [],
          policyType || 'aml_cft',
          effectiveJurisdictionId,
        );

        // Audit log for AI enhancement
        try {
          await db.auditLog.create({
            data: {
              userId: 'system',
              action: 'AI_POLICY_ENHANCE',
              resource: 'policy_wizard',
              resourceId: validated.sessionId || 'no-session',
              details: JSON.stringify({
                sectionTitle,
                policyType,
                confidence: result.confidence,
                sourcesCount: result.sources.length,
                jurisdictionId: effectiveJurisdictionId,
              }),
            },
          });
        } catch {
          // Audit log failure shouldn't break the response
        }

        return NextResponse.json({
          success: true,
          data: result,
          disclaimer: 'AI-enhanced content requires manual review. All regulatory references must be verified against official sources.',
        });
      }

      // ── Step 6: Save Policy ──────────────────────────────────────────
      case 'save': {
        const { title, policyType, category, jurisdiction, draft, sessionId } = validated;

        if (!title || !policyType) {
          return NextResponse.json(
            { success: false, error: 'title and policyType are required for save' },
            { status: 400 }
          );
        }

        try {
          const policy = await db.policy.create({
            data: {
              title,
              policyNumber: `POL-${policyType.toUpperCase()}-${Date.now()}`,
              category: category || 'AML/CFT',
              version: '1.0-draft',
              status: 'draft',
              department: 'Compliance',
              owner: 'MLRO',
              aiReviewed: true,
              aiConfidence: (draft as PolicyDraft)?.overallConfidence || 0,
              documentUrl: sessionId || undefined,
            },
          });

          // Audit log
          await db.auditLog.create({
            data: {
              userId: 'system',
              action: 'POLICY_CREATED_VIA_WIZARD',
              resource: 'policy',
              resourceId: policy.id,
              details: JSON.stringify({
                policyNumber: policy.policyNumber,
                policyType,
                aiConfidence: policy.aiConfidence,
                jurisdictionId: jurisdiction || sessionJurisdictionId,
              }),
            },
          });

          return NextResponse.json({
            success: true,
            data: policy,
          });
        } catch {
          return NextResponse.json(
            { success: false, error: 'Failed to save policy' },
            { status: 500 }
          );
        }
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Policy wizard operation failed' },
      { status: 500 }
    );
  }
}

// ─── GET Handler — Knowledge Base ────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'SENSITIVE');
    if (rateLimitError) return rateLimitError;
    return NextResponse.json({
      success: true,
      data: {
        knowledgeBase: REGULATORY_KNOWLEDGE_BASE,
        hallucinationGuard: Object.values(HALLUCINATION_GUARD),
        policyTypes: [
          'aml_cft', 'sanctions_screening', 'cdd_kyc', 'sar_filing',
          'pep_edd', 'training', 'record_keeping', 'risk_assessment',
          'vendor_dd', 'data_privacy', 'business_continuity', 'outsourcing',
        ],
        categories: [
          'AML/CFT', 'Sanctions', 'KYC/CDD', 'Reporting', 'Governance',
          'Operations', 'IT & Security', 'Data Privacy', 'Training', 'Vendor Management',
        ],
        jurisdictions: [...ALL_JURISDICTION_CODES],
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch knowledge base' },
      { status: 500 }
    );
  }
}
