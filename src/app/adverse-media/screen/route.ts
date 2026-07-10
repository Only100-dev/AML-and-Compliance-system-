import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { createAuditLog } from '@/lib/audit';
import ZAI from 'z-ai-web-dev-sdk';
import { applyRateLimit } from '@/lib/rate-limit';

// ─── Zod Validation Schema ──────────────────────────────────────────────────

const AdverseMediaScreenSchema = z.object({
  subjectName: z.string().min(1, 'Subject name is required'),
  subjectType: z.enum(['INDIVIDUAL', 'ENTITY']),
  keywords: z.string().optional(),
  sources: z.array(z.string()).optional(),
  aka: z.string().optional(),
  nationality: z.string().optional(),
});

type AdverseMediaScreenInput = z.infer<typeof AdverseMediaScreenSchema>;

// ─── Risk Relevance Heuristic ───────────────────────────────────────────────

const HIGH_RISK_KEYWORDS = ['money laundering', 'sanctions', 'fraud', 'terror'];
const MEDIUM_RISK_KEYWORDS = ['AML', 'compliance', 'regulatory'];

function determineRiskRelevance(snippet: string): 'high' | 'medium' | 'low' {
  const lowerSnippet = snippet.toLowerCase();

  for (const keyword of HIGH_RISK_KEYWORDS) {
    if (lowerSnippet.includes(keyword.toLowerCase())) {
      return 'high';
    }
  }

  for (const keyword of MEDIUM_RISK_KEYWORDS) {
    if (lowerSnippet.includes(keyword.toLowerCase())) {
      return 'medium';
    }
  }

  return 'low';
}

// ─── POST: Perform Real Adverse Media Screening ─────────────────────────────

export async function POST(request: NextRequest) {
  // ── Step 1: Auth Guard ──────────────────────────────────────────────────
  const auth = await authGuard({
    allowedRoles: ['admin', 'mlro', 'compliance_officer', 'compliance_manager'],
  });

  if (!auth.authorized) {
    return auth.error ?? NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }
  const rateLimitError = applyRateLimit(auth, request, 'WRITE');
  if (rateLimitError) return rateLimitError;

  const userId = (auth.session?.user as Record<string, unknown>)?.userId as string ?? 'unknown';
  const userName = (auth.session?.user as Record<string, unknown>)?.name as string ?? 'Unknown User';

  // ── Step 2: Validate Request Body ───────────────────────────────────────
  let parsed: AdverseMediaScreenInput;
  try {
    const body = await request.json();
    const result = AdverseMediaScreenSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: result.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 422 }
      );
    }

    parsed = result.data;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 422 }
    );
  }

  const { subjectName, subjectType, keywords, sources, aka, nationality } = parsed;

  // ── Step 3: Construct Search Query ──────────────────────────────────────
  const searchQuery = [subjectName, keywords].filter(Boolean).join(' ');

  // ── Step 4: Compute SHA-256 Search Hash for Auditability ────────────────
  const searchHash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        subjectName,
        keywords,
        sources,
        timestamp: Date.now(),
      })
    )
    .digest('hex');

  // ── Step 5: Execute Real Web Search via z-ai-web-dev-sdk ────────────────
  let rawResults: Array<{
    url: string;
    name: string;
    snippet: string;
    host_name: string;
    rank: number;
    date: string;
    favicon: string;
  }> = [];

  let searchError: string | null = null;

  try {
    const zai = await ZAI.create();
    rawResults = (await zai.functions.invoke('web_search', {
      query: searchQuery,
      num: 10,
    })) as typeof rawResults;
  } catch (err) {
    console.error('[ADVERSE_MEDIA_SCREEN] Web search failed:', err);
    searchError = err instanceof Error ? err.message : 'Unknown web search error';
    // Do NOT fail the whole request — continue with empty results
  }

  // ── Step 6: Transform Results into Structured Format ────────────────────
  const structuredResults = rawResults.map((result, index) => ({
    id: crypto.randomUUID(),
    title: result.name || 'Untitled',
    source: result.host_name || 'Unknown Source',
    url: result.url,
    date: result.date || null,
    snippet: result.snippet || '',
    riskRelevance: determineRiskRelevance(result.snippet || ''),
    rank: result.rank ?? index + 1,
  }));

  // If search failed, add a note to the results
  if (searchError) {
    structuredResults.unshift({
      id: crypto.randomUUID(),
      title: 'Search Error Notice',
      source: 'system',
      url: '',
      date: new Date().toISOString(),
      snippet: `Web search could not be completed: ${searchError}. Results are empty. Manual review recommended.`,
      riskRelevance: 'high' as const,
      rank: 0,
    });
  }

  // ── Step 7: Persist Screening Session to Database ───────────────────────
  let session;
  try {
    const searchConfig = JSON.stringify({
      subjectType,
      keywords: keywords || null,
      sources: sources || [],
      aka: aka || null,
      nationality: nationality || null,
      searchQuery,
      searchedAt: new Date().toISOString(),
      searchError,
    });

    session = await db.adverseMediaSession.create({
      data: {
        subjectType,
        subjectName,
        aka: aka || null,
        nationality: nationality || null,
        searchConfig,
        results: JSON.stringify(structuredResults),
        decision: null,
        rationale: null,
        createdBy: userId,
      },
    });
  } catch (dbError) {
    console.error('[ADVERSE_MEDIA_SCREEN] Database error:', dbError);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to persist adverse media screening session',
        // Mask any internal details that could leak API keys
      },
      { status: 500 }
    );
  }

  // ── Step 8: Create Audit Log Entry ──────────────────────────────────────
  try {
    await createAuditLog({
      userId,
      action: 'ADVERSE_MEDIA_SCREEN',
      resourceType: 'AdverseMediaSession',
      resourceId: session.id,
      details: `Adverse media screening performed for ${subjectType} "${subjectName}" by ${userName}. Query: "${searchQuery}". Results: ${structuredResults.length}. Hash: ${searchHash.substring(0, 16)}...`,
      changes: {
        subjectName,
        subjectType,
        searchQuery,
        resultCount: structuredResults.length,
        highRiskCount: structuredResults.filter(r => r.riskRelevance === 'high').length,
        mediumRiskCount: structuredResults.filter(r => r.riskRelevance === 'medium').length,
        searchError: searchError ? true : false,
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });
  } catch (auditError) {
    // Audit log failure should not fail the request, but log it
    console.error('[ADVERSE_MEDIA_SCREEN] Audit log creation failed:', auditError);
  }

  // ── Step 9: Return Success Response ─────────────────────────────────────
  return NextResponse.json(
    {
      success: true,
      data: {
        sessionId: session.id,
        results: structuredResults,
        searchHash,
        resultCount: structuredResults.length,
      },
      message: 'Adverse media screening completed',
    },
    { status: 201 }
  );
}
