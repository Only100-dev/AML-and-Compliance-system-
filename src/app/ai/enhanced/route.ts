/**
 * Enhanced AI API — IC-OS Compliance Platform
 * P3-1: Real AI integration using z-ai-web-dev-sdk
 *
 * Provides production LLM-backed chat completions with:
 *   - Jurisdiction-aware regulatory system prompts (via Prompt Factory)
 *   - Multi-turn conversation support
 *   - Hallucination guard for compliance content
 *   - Fallback to rule-based responses on SDK failure
 *
 * Phase 2 (Actions 2.5): Refactored to use jurisdiction-aware prompts
 * from the centralized Prompt Factory instead of hardcoded UAE prompts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { authGuard } from '@/lib/auth-guard';
import { stripPIIFromText } from '@/lib/pii';
import { applyRateLimit } from '@/lib/rate-limit';
import { ACTIVE_AI_MODEL, AI_THINKING_CONFIG } from '@/lib/ai/model';
import { getSystemPrompt, type PromptModule } from '@/lib/prompts';
import { getRegulatoryThresholds } from '@/lib/regulatory/thresholds';

// ─── Zod Validation ─────────────────────────────────────────────────────────

const chatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  userId: z.string().optional(),
  contextModule: z.enum([
    'general', 'goAML', 'kyc', 'sanctions', 'aml', 'sar',
    'policy', 'training', 'regulatory', 'risk', 'adverse_media',
    'audit', 'reporting', 'vasp', 'labor', 'legal',
  ]).optional().default('general'),
  sessionId: z.string().optional(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
});

// ─── Jurisdiction-Aware System Prompts (via Prompt Factory) ────────────────

/**
 * Loads the jurisdiction-aware system prompt for the given context module.
 * Falls back to 'general' if the specific module is not found.
 */
async function loadSystemPrompt(
  jurisdiction: string,
  contextModule: string,
): Promise<string> {
  try {
    const result = await getSystemPrompt(jurisdiction, contextModule as PromptModule);
    return result.prompt;
  } catch {
    // Fallback to general module for this jurisdiction
    try {
      const result = await getSystemPrompt(jurisdiction, 'general');
      return result.prompt;
    } catch {
      // Ultimate fallback — use thresholds for a generic prompt
      const thresholds = getRegulatoryThresholds(jurisdiction);
      return `You are a compliance assistant for ${thresholds.regulatorName} (${thresholds.jurisdiction}). Provide guidance based on ${thresholds.regulatorName} regulations. If uncertain, say "Consult your compliance officer."`;
    }
  }
}

// ─── Jurisdiction-Aware Fallback Rule-Based Responses ──────────────────────

function getFallbackResponse(message: string, contextModule?: string, jurisdiction?: string): string {
  const j = jurisdiction || 'AE';
  const thresholds = getRegulatoryThresholds(j);
  const lowerMsg = message.toLowerCase();

  if (contextModule === 'goAML' || lowerMsg.includes('str') || lowerMsg.includes('sar')) {
    return `⚠️ AI service temporarily unavailable. For immediate SAR/STR guidance:

• **SAR/STR Filing Deadline**: Within ${thresholds.sarDeadline} ${thresholds.sarDeadlineUnit === 'business_days' ? 'business days' : 'calendar days'} of detection
• **CTR Threshold**: Cash transactions ≥ ${thresholds.currency} ${thresholds.ctr.toLocaleString()}
• **FIU**: ${thresholds.fiuName}
• **Filing Format**: ${thresholds.sarFilingFormat}
• **Tipping-Off Prohibition**: Never disclose SAR filing to subject

Contact your MLRO for urgent filing questions.`;
  }

  if (lowerMsg.includes('kyc') || lowerMsg.includes('ubo') || lowerMsg.includes('pep')) {
    return `⚠️ AI service temporarily unavailable. For KYC/CDD guidance:

• **UBO Threshold**: ≥${thresholds.beneficialOwnershipThreshold}% ownership or control
• **PEP Screening**: Mandatory for all senior management
• **EDD Required**: PEPs, high-risk jurisdictions, correspondent banking
• **Record Retention**: ${thresholds.recordRetentionYears} years minimum`;
  }

  if (lowerMsg.includes('sanction')) {
    return `⚠️ AI service temporarily unavailable. For sanctions guidance:

• **OFAC 50% Rule**: Sanctioned ownership ≥50% = entity blocked
• **Screening Lists**: UN, OFAC SDN, EU, HMT, + Local List
• **Freezing Obligation**: Immediately upon match
• **Fail-Closed**: Screening errors default to blocking`;
  }

  return `⚠️ AI service temporarily unavailable. For immediate compliance queries:

1. **${thresholds.regulatorName} Regulatory Portal**
2. **FIU**: ${thresholds.fiuName}
3. **SAR/STR Deadline**: ${thresholds.sarDeadline} ${thresholds.sarDeadlineUnit === 'business_days' ? 'business days' : 'calendar days'}
4. **CTR Threshold**: ${thresholds.currency} ${thresholds.ctr.toLocaleString()}

Contact your compliance team for urgent matters.`;
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
    const validated = chatRequestSchema.parse(body);
    const { message, userId, contextModule, sessionId, conversationHistory } = validated;

    // Extract jurisdiction from session
    const session = auth.session;
    const jurisdictionId = (session?.user as Record<string, unknown>)?.jurisdictionId as string
      || (session?.user as Record<string, unknown>)?.jurisdiction as string
      || 'AE';

    // Load jurisdiction-aware system prompt
    const systemPrompt = await loadSystemPrompt(jurisdictionId, contextModule);

    // Build messages array for multi-turn conversation
    const messages: Array<{ role: 'system' | 'assistant' | 'user'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history if provided
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-10);
      for (const msg of recentHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: message });

    let aiResponse: string;
    let modelUsed: string = ACTIVE_AI_MODEL;
    const startTime = Date.now();

    try {
      // Use z-ai-web-dev-sdk for production LLM calls
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();

      // Timeout guard: prevent indefinite hangs on LLM calls (30s max)
      const LLM_TIMEOUT_MS = 30_000;
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

      aiResponse = completion.choices[0]?.message?.content || '';

      if (!aiResponse || aiResponse.trim().length === 0) {
        throw new Error('Empty response from AI SDK');
      }

      modelUsed = ACTIVE_AI_MODEL;
    } catch {
      // Fallback: rule-based regulatory guidance when the backend AI SDK is unavailable
      modelUsed = 'fallback-rule-engine';
      aiResponse = getFallbackResponse(message, contextModule, jurisdictionId);
    }

    // PII stripping — zero-leakage AI defense
    // Ensure no real Emirates IDs, passports, IBANs, or phone numbers
    // leak through the LLM response to the user
    aiResponse = stripPIIFromText(aiResponse);

    const latencyMs = Date.now() - startTime;

    // Log to Database for Audit Trail
    if (sessionId) {
      try {
        const existingSession = await db.aIChatSession.findUnique({
          where: { id: sessionId },
        });

        if (!existingSession && userId) {
          await db.aIChatSession.create({
            data: {
              id: sessionId,
              userId,
              contextModule,
            },
          });
        }

        await db.aIChatMessage.create({
          data: {
            sessionId,
            role: 'user',
            content: message,
          },
        });

        await db.aIChatMessage.create({
          data: {
            sessionId,
            role: 'assistant',
            content: aiResponse,
            modelUsed,
            latencyMs,
          },
        });
      } catch {
        // Log failure shouldn't break the response
      }
    }

    // Create audit log for compliance traceability — includes jurisdiction
    try {
      await db.auditLog.create({
        data: {
          userId: userId || 'anonymous',
          action: 'AI_CHAT_QUERY',
          resource: 'ai_enhanced',
          resourceId: sessionId || 'no-session',
          details: JSON.stringify({
            contextModule,
            modelUsed,
            latencyMs,
            messageLength: message.length,
            responseLength: aiResponse.length,
            jurisdictionId,
          }),
        },
      });
    } catch {
      // Audit log failure shouldn't break the response
    }

    const thresholds = getRegulatoryThresholds(jurisdictionId);

    return NextResponse.json({
      success: true,
      response: aiResponse,
      modelUsed,
      latencyMs,
      contextModule,
      disclaimer: `AI responses are for guidance only. Always verify with official ${thresholds.regulatorName} regulatory texts. Per ${thresholds.regulatorName} requirements, MLRO consultation is required for critical compliance decisions.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        response: '⚠️ An unexpected error occurred. Please try again or contact your system administrator.',
        modelUsed: 'error',
        disclaimer: 'AI responses are for guidance only.',
      },
      { status: 500 }
    );
  }
}

// ─── GET Handler — Session History ───────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'SENSITIVE');
    if (rateLimitError) return rateLimitError;
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const messages = await db.aIChatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: messages,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch chat history' },
      { status: 500 }
    );
  }
}
