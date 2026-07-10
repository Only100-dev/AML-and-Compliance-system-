import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { z } from 'zod';
import { applyRateLimit } from '@/lib/rate-limit';
import { AI_CONFIG_DEFAULT_MODEL, AI_PROVIDER } from '@/lib/ai/model';

// ─── Zod Validation Schema ──────────────────────────────────────────────────
const AIConfigUpdateSchema = z.object({
  provider: z.enum(['z-ai', 'openai', 'anthropic']).optional(),
  apiKey: z.string().min(1).optional(),
  defaultModel: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(100).max(8192).optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(0).max(2).optional(),
  presencePenalty: z.number().min(0).max(2).optional(),
  monthlyTokenQuota: z.number().int().min(1000).optional(),
});

// ─── Default config values when no active config exists ─────────────────────
const DEFAULT_CONFIG = {
  provider: AI_PROVIDER,
  apiKey: null,
  defaultModel: AI_CONFIG_DEFAULT_MODEL,
  temperature: 0.3,
  maxTokens: 2048,
  topP: 0.9,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
  monthlyTokenQuota: 500000,
  isActive: true,
};

// ─── Mask API key for secure responses ──────────────────────────────────────
function maskApiKey(apiKey: string | null): string {
  if (!apiKey) return '';
  return 'sk-***masked***';
}

// ─── GET /api/admin/ai-config ───────────────────────────────────────────────
// Fetch the current active AI engine configuration.
// Returns default values if no active config exists in the database.
// The apiKey is NEVER returned in plaintext — always masked.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // ── 1. Authenticate & Authorize ─────────────────────────────────────────
  const { session, authorized, error } = await authGuard({
    allowedRoles: ['admin', 'mlro', 'compliance_manager'],
  });

  if (!authorized || error) {
    return error ?? NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 },
    );
  }

  // Rate limit: READ tier (100 req/min)
  const auth = { session, authorized };
  const rateLimitError = applyRateLimit(auth, request, 'READ');
  if (rateLimitError) return rateLimitError;

  // ── 2. Fetch active config ──────────────────────────────────────────────
  try {
    const config = await db.aIEngineConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!config) {
      // No active config — return defaults with masked (empty) apiKey
      return NextResponse.json({
        success: true,
        data: {
          ...DEFAULT_CONFIG,
          id: null,
          apiKey: '',
          createdAt: null,
          updatedAt: null,
        },
      });
    }

    // ── 3. Mask apiKey before returning ──────────────────────────────────
    const { apiKey, ...safeConfig } = config;

    return NextResponse.json({
      success: true,
      data: {
        ...safeConfig,
        apiKey: maskApiKey(apiKey),
      },
    });
  } catch (dbError) {
    console.error('[admin/ai-config GET] Database error:', dbError);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch AI configuration due to a database error.' },
      { status: 500 },
    );
  }
}

// ─── PUT /api/admin/ai-config ───────────────────────────────────────────────
// Update or create the AI engine configuration (upsert pattern).
// If an active config exists, it is updated; otherwise a new one is created.
// An audit log entry is created for every update.
// The apiKey is masked in the response — never returned in plaintext.
// ─────────────────────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  // ── 1. Authenticate & Authorize ─────────────────────────────────────────
  const { session, authorized, error } = await authGuard({
    allowedRoles: ['admin', 'mlro', 'compliance_manager'],
  });

  if (!authorized || error) {
    return error ?? NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 },
    );
  }

  // Rate limit: SENSITIVE tier (10 req/min)
  const auth = { session, authorized };
  const rateLimitError = applyRateLimit(auth, request, 'SENSITIVE');
  if (rateLimitError) return rateLimitError;

  const userId = (session?.user as Record<string, unknown>)?.userId as string || 'system';

  // ── 2. Parse request body ───────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON payload' },
      { status: 400 },
    );
  }

  // ── 3. Validate with Zod ────────────────────────────────────────────────
  const parseResult = AIConfigUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    const fieldErrors = parseResult.error.flatten().fieldErrors;
    return NextResponse.json(
      {
        success: false,
        error: 'Validation failed',
        details: fieldErrors,
      },
      { status: 422 },
    );
  }

  const validated = parseResult.data;

  // ── 4. Upsert: find existing active config or create new ────────────────
  try {
    const existingConfig = await db.aIEngineConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    let config;

    if (existingConfig) {
      // Update existing active config
      // Only update fields that were provided in the request
      const updateData: Record<string, unknown> = {};
      if (validated.provider !== undefined) updateData.provider = validated.provider;
      if (validated.apiKey !== undefined) updateData.apiKey = validated.apiKey;
      if (validated.defaultModel !== undefined) updateData.defaultModel = validated.defaultModel;
      if (validated.temperature !== undefined) updateData.temperature = validated.temperature;
      if (validated.maxTokens !== undefined) updateData.maxTokens = validated.maxTokens;
      if (validated.topP !== undefined) updateData.topP = validated.topP;
      if (validated.frequencyPenalty !== undefined) updateData.frequencyPenalty = validated.frequencyPenalty;
      if (validated.presencePenalty !== undefined) updateData.presencePenalty = validated.presencePenalty;
      if (validated.monthlyTokenQuota !== undefined) updateData.monthlyTokenQuota = validated.monthlyTokenQuota;

      config = await db.aIEngineConfig.update({
        where: { id: existingConfig.id },
        data: updateData,
      });
    } else {
      // Create new config with defaults + provided values
      config = await db.aIEngineConfig.create({
        data: {
          provider: validated.provider ?? DEFAULT_CONFIG.provider,
          apiKey: validated.apiKey ?? DEFAULT_CONFIG.apiKey,
          defaultModel: validated.defaultModel ?? DEFAULT_CONFIG.defaultModel,
          temperature: validated.temperature ?? DEFAULT_CONFIG.temperature,
          maxTokens: validated.maxTokens ?? DEFAULT_CONFIG.maxTokens,
          topP: validated.topP ?? DEFAULT_CONFIG.topP,
          frequencyPenalty: validated.frequencyPenalty ?? DEFAULT_CONFIG.frequencyPenalty,
          presencePenalty: validated.presencePenalty ?? DEFAULT_CONFIG.presencePenalty,
          monthlyTokenQuota: validated.monthlyTokenQuota ?? DEFAULT_CONFIG.monthlyTokenQuota,
          isActive: true,
        },
      });
    }

    // ── 5. Create audit log entry ───────────────────────────────────────
    await db.auditLog.create({
      data: {
        userId,
        action: 'AI_CONFIG_UPDATE',
        resource: 'AIEngineConfig',
        resourceId: config.id,
        jurisdiction: 'AE',
        details: JSON.stringify({
          updatedFields: Object.keys(validated),
          provider: config.provider,
          defaultModel: config.defaultModel,
        }),
      },
    });

    // ── 6. Mask apiKey in response ──────────────────────────────────────
    const { apiKey, ...safeConfig } = config;

    return NextResponse.json({
      success: true,
      data: {
        ...safeConfig,
        apiKey: maskApiKey(apiKey),
      },
      message: 'AI configuration updated successfully',
    });
  } catch (dbError) {
    console.error('[admin/ai-config PUT] Database error:', dbError);
    return NextResponse.json(
      { success: false, error: 'Failed to update AI configuration due to a database error.' },
      { status: 500 },
    );
  }
}
