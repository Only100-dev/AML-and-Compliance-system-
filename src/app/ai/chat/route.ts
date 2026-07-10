import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { ACTIVE_AI_MODEL, AI_THINKING_CONFIG } from '@/lib/ai/model';
import { getSystemPrompt, type PromptModule } from '@/lib/prompts';
import { getRegulatoryThresholds } from '@/lib/regulatory/thresholds';
import { withAuditLog } from '@/lib/audit-worm';

const chatQuerySchema = z.object({
  sessionId: z.string().optional(),
});

const chatMessageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(10000, 'Message too long'),
  userId: z.string().optional(),
  contextModule: z.string().optional(),
  sessionId: z.string().optional(),
});

/**
 * GET /api/ai/chat
 * List AI chat sessions with optional filters.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'SENSITIVE');
    if (rateLimitError) return rateLimitError;
    const { searchParams } = new URL(request.url);
    const queryParsed = chatQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!queryParsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: queryParsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const sessionId = queryParsed.data.sessionId;

    // If sessionId is provided, return messages for that session
    if (sessionId) {
      const messages = await db.aIChatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
      });

      return NextResponse.json({
        success: true,
        data: messages.map((m) => ({
          id: m.id,
          sessionId: m.sessionId,
          role: m.role,
          content: m.content,
          modelUsed: m.modelUsed,
          latencyMs: m.latencyMs,
          createdAt: m.createdAt.toISOString(),
        })),
      });
    }

    // Otherwise, return list of chat sessions
    const sessions = await db.aIChatSession.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: sessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        contextModule: s.contextModule,
        createdAt: s.createdAt.toISOString(),
        messageCount: s._count.messages,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch AI chat sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch AI chat sessions' },
      { status: 500 },
    );
  }
}

export const POST = withAuditLog(
  async (request: Request) => {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'SENSITIVE');
    if (rateLimitError) return rateLimitError;
    const parsed = chatMessageSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { message, contextModule, sessionId } = parsed.data;

    // Extract jurisdiction from session
    const session = auth.session;
    const jurisdictionId = (session?.user as Record<string, unknown>)?.jurisdictionId as string
      || (session?.user as Record<string, unknown>)?.jurisdiction as string
      || 'AE';

    // 1. Load jurisdiction-aware system prompt via factory
    let systemPrompt: string;
    try {
      const moduleMap: Record<string, string> = {
        goAML: 'goAML',
        aml: 'aml',
        sanctions: 'sanctions',
        kyc: 'kyc',
        sar: 'sar_narrative',
        policy: 'policy',
        regulatory: 'regulatory',
        risk: 'risk',
        adverse_media: 'adverse_media',
        audit: 'audit',
        reporting: 'reporting',
        training: 'training',
        labor: 'labor',
        legal: 'legal',
        vasp: 'vasp',
      };
      const promptModule = moduleMap[contextModule || ''] || 'general';
      const result = await getSystemPrompt(jurisdictionId, promptModule as PromptModule);
      systemPrompt = result.prompt;
    } catch {
      // Fallback to a jurisdiction-aware generic prompt
      const thresholds = getRegulatoryThresholds(jurisdictionId);
      systemPrompt = `You are the IC-OS Compliance Assistant for ${thresholds.regulatorName} (${thresholds.jurisdiction}). Be concise, professional, and helpful. Base your answers strictly on ${thresholds.regulatorName} regulations. Never reveal that you are an AI — always respond as a compliance expert.`;
    }

    // 2. Call the backend AI service (z-ai-web-dev-sdk) with a timeout guard
    let aiResponse: string;
    let modelUsed: string = ACTIVE_AI_MODEL;
    const startTime = Date.now();

    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();

      const LLM_TIMEOUT_MS = 30_000;
      const completion = await Promise.race([
        zai.chat.completions.create({
          model: ACTIVE_AI_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
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

    const latencyMs = Date.now() - startTime;

    // 3. Log to Database for Audit Trail
    if (sessionId) {
      try {
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

    const thresholds = getRegulatoryThresholds(jurisdictionId);

    return NextResponse.json({
      success: true,
      response: aiResponse,
      modelUsed,
      latencyMs,
      disclaimer: `AI responses are for guidance only. Always verify with official ${thresholds.regulatorName} regulatory texts.`,
    });
  } catch {
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
  },
  { entityType: 'AIChat' }
);

// ─── Jurisdiction-Aware Rule-Based Fallback Responses ─────────────────────────

function getFallbackResponse(message: string, contextModule?: string, jurisdiction?: string): string {
  const j = jurisdiction || 'AE';
  const thresholds = getRegulatoryThresholds(j);
  const lowerMsg = message.toLowerCase();

  if (contextModule === 'goAML' || lowerMsg.includes('str') || lowerMsg.includes('sar')) {
    return `⚠️ AI service is temporarily unavailable. For immediate SAR/STR guidance:

• **SAR/STR Filing Deadline**: Within ${thresholds.sarDeadline} ${thresholds.sarDeadlineUnit === 'business_days' ? 'business days' : 'calendar days'} of detection
• **CTR Threshold**: Cash transactions ≥ ${thresholds.currency} ${thresholds.ctr.toLocaleString()}
• **FIU**: ${thresholds.fiuName}
• **Filing Format**: ${thresholds.sarFilingFormat}
• **Tipping-Off Prohibition**: Never disclose SAR filing to subject

Contact your MLRO for urgent filing questions.`;
  }

  if (lowerMsg.includes('kyc') || lowerMsg.includes('ubo') || lowerMsg.includes('pep')) {
    return `⚠️ AI service is temporarily unavailable. For KYC/CDD guidance:

• **UBO Threshold**: ≥${thresholds.beneficialOwnershipThreshold}% ownership or control
• **PEP Screening**: Mandatory for all senior management
• **EDD Required**: PEPs, high-risk jurisdictions, correspondent banking
• **Record Retention**: ${thresholds.recordRetentionYears} years minimum

Refer to ${thresholds.regulatorName} CDD guidance.`;
  }

  if (lowerMsg.includes('sanction')) {
    return `⚠️ AI service is temporarily unavailable. For sanctions guidance:

• **OFAC 50% Rule**: Sanctioned ownership ≥50% = entity blocked
• **Screening Lists**: UN, OFAC SDN, EU, HMT, + Local Terrorist List
• **Fail-Closed**: Screening errors default to blocking

Refer to ${thresholds.regulatorName} sanctions guidance.`;
  }

  return `⚠️ AI service is temporarily unavailable. For immediate compliance queries:

1. **${thresholds.regulatorName} Regulatory Portal**
2. **FIU**: ${thresholds.fiuName}
3. **SAR/STR Deadline**: ${thresholds.sarDeadline} ${thresholds.sarDeadlineUnit === 'business_days' ? 'business days' : 'calendar days'}
4. **CTR Threshold**: ${thresholds.currency} ${thresholds.ctr.toLocaleString()}

Contact your compliance team for urgent matters.`;
}
