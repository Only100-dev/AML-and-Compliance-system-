/**
 * Master Brain Orchestration API — IC-OS Compliance Platform
 *
 * POST /api/ai/orchestrate
 *
 * The Dual-Master-Brain endpoint: GLM-5.2 (synthesis) + Qwen3.7-Plus
 * (compliance review) act as the Executive AI Committee. Agentic tools
 * (search_knowledge_base, get_user_role_permissions, fetch_internal_sop)
 * ground the synthesis in real system state.
 *
 * Every call produces a full Chain-of-Thought audit log entry for the
 * Master Brain Oversight panel.
 *
 * Reference: Jurisdiction-aware (CBUAE/SAMA/CBB/QCB/CBOA/CBK)
 * Architecture: Dual-Master-Brain (Directive 1-5)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { orchestrateMasterBrain } from '@/lib/ai/master-brain';
import { DEFAULT_TOOL_PERMISSIONS, type ToolPermissions } from '@/lib/ai/model';

// ─── Zod Validation ──────────────────────────────────────────────────────────

const orchestrateSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(8000, 'Prompt too long'),
  userId: z.string().optional(),
  contextModule: z.string().optional(),
  sessionId: z.string().optional(),
  jurisdictionId: z.string().optional(),
  permissions: z.object({
    search_knowledge_base: z.boolean().optional(),
    get_user_role_permissions: z.boolean().optional(),
    fetch_internal_sop: z.boolean().optional(),
  }).optional(),
});

// ─── POST Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard({
      allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'],
    });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }
    const rateLimitError = applyRateLimit(auth, request, 'SENSITIVE');
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const validated = orchestrateSchema.parse(body);

    // Merge provided permissions with defaults
    const permissions: ToolPermissions = {
      ...DEFAULT_TOOL_PERMISSIONS,
      ...(validated.permissions ?? {}),
    };

    const session = auth.session;
    const userRole = (session?.user as Record<string, unknown>)?.role as string || 'compliance_officer';
    const userName = (session?.user as Record<string, unknown>)?.name as string || 'Unknown';

    // ── Extract jurisdiction from session or request body ─────────────────
    const jurisdictionId = (session?.user as Record<string, unknown>)?.jurisdictionId as string
      || (session?.user as Record<string, unknown>)?.jurisdiction as string
      || validated.jurisdictionId
      || 'AE';

    // ── Invoke the Dual-Master-Brain Orchestrator ──────────────────────────
    const result = await orchestrateMasterBrain({
      prompt: validated.prompt,
      userRole,
      userName,
      contextModule: validated.contextModule,
      sessionId: validated.sessionId,
      permissions,
      jurisdictionId,
    });

    // ── Audit Log: Chain-of-Thought (for Master Brain Oversight panel) ─────
    try {
      const auditDetails = {
        prompt: validated.prompt.slice(0, 500),
        userRole,
        contextModule: validated.contextModule,
        jurisdictionId,
        verdict: result.verdict,
        modelsUsed: result.modelsUsed,
        totalLatencyMs: result.totalLatencyMs,
        toolsUsed: result.toolsUsed.map((t) => ({
          tool: t.tool,
          args: t.args,
          resultLength: t.result.length,
        })),
        chainOfThoughtPhases: result.chainOfThought.map((p) => ({
          brain: p.brain,
          phase: p.phase,
          model: p.model,
          latencyMs: p.latencyMs,
        })),
        synthesisLength: result.synthesis.length,
        reviewLength: result.review.length,
      };

      const userId = (session?.user as Record<string, unknown>)?.userId as string || 'system';

      await db.auditLog.create({
        data: {
          userId,
          action: 'MASTER_BRAIN_ORCHESTRATION',
          resource: 'ai_master_brain',
          resourceId: validated.sessionId || 'no-session',
          details: JSON.stringify(auditDetails),
          aiConfidence: result.verdict === 'APPROVED' ? 0.95 : result.verdict === 'APPROVED_WITH_ANNOTATIONS' ? 0.8 : 0.5,
        },
      });
    } catch {
      // Audit log failure shouldn't break the response
    }

    // ── Persist chat session + messages (if sessionId provided) ─────────────
    if (validated.sessionId && validated.userId) {
      try {
        const existingSession = await db.aIChatSession.findUnique({
          where: { id: validated.sessionId },
        });

        if (!existingSession) {
          await db.aIChatSession.create({
            data: {
              id: validated.sessionId,
              userId: validated.userId,
              contextModule: validated.contextModule || 'master-brain',
            },
          });
        }

        await db.aIChatMessage.create({
          data: {
            sessionId: validated.sessionId,
            role: 'user',
            content: validated.prompt,
          },
        });

        await db.aIChatMessage.create({
          data: {
            sessionId: validated.sessionId,
            role: 'assistant',
            content: result.consensus,
            modelUsed: `master-brain (${result.modelsUsed.synthesis} + ${result.modelsUsed.review})`,
            latencyMs: result.totalLatencyMs,
          },
        });
      } catch {
        // Session persistence failure shouldn't break the response
      }
    }

    return NextResponse.json({
      success: result.success,
      data: {
        consensus: result.consensus,
        verdict: result.verdict,
        synthesis: result.synthesis,
        review: result.review,
        toolsUsed: result.toolsUsed,
        chainOfThought: result.chainOfThought,
        totalLatencyMs: result.totalLatencyMs,
        modelsUsed: result.modelsUsed,
      },
      disclaimer: result.disclaimer,
      error: result.error,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: 'Master Brain orchestration failed',
        disclaimer: 'AI responses are for guidance only.',
      },
      { status: 500 },
    );
  }
}

// ─── GET Handler — Recent Orchestrations (for Oversight panel) ───────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({
      allowedRoles: ['admin', 'mlro', 'compliance_manager'],
    });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;

    // Fetch recent Master Brain audit logs
    const recentLogs = await db.auditLog.findMany({
      where: { action: 'MASTER_BRAIN_ORCHESTRATION' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const orchestrations = recentLogs.map((log) => {
      let details: Record<string, unknown> = {};
      try {
        details = JSON.parse(log.details);
      } catch {
        // keep empty
      }
      return {
        id: log.id,
        userId: log.userId,
        createdAt: log.createdAt.toISOString(),
        prompt: (details.prompt as string) ?? '',
        userRole: (details.userRole as string) ?? '',
        contextModule: (details.contextModule as string) ?? '',
        verdict: (details.verdict as string) ?? '',
        modelsUsed: (details.modelsUsed as { synthesis: string; review: string }) ?? { synthesis: '', review: '' },
        totalLatencyMs: (details.totalLatencyMs as number) ?? 0,
        toolsUsed: (details.toolsUsed as Array<{ tool: string; resultLength: number }>) ?? [],
        chainOfThoughtPhases: (details.chainOfThoughtPhases as Array<Record<string, unknown>>) ?? [],
      };
    });

    return NextResponse.json({
      success: true,
      data: orchestrations,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orchestration logs' },
      { status: 500 },
    );
  }
}
