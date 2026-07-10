import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';

// ─── ESG Risk Tags ──────────────────────────────────────────────────────────

const ESG_KEYWORD_CATEGORIES: Record<string, string[]> = {
  GREENWASHING: [
    'greenwashing',
    'green wash',
    'false environmental claim',
    'misleading sustainability',
    'fake green',
    'eco fraud',
    'green claim violation',
    'deceptive environmental',
    'exaggerated sustainability',
    'green marketing fraud',
  ],
  CARBON_FRAUD: [
    'carbon fraud',
    'carbon credit fraud',
    'emissions manipulation',
    'carbon offset scam',
    'fake carbon credit',
    'carbon accounting fraud',
    'scope 3 misrepresentation',
    'emission underreporting',
  ],
  ENVIRONMENTAL_VIOLATION: [
    'environmental violation',
    'pollution',
    'toxic waste',
    'hazardous material',
    'environmental fine',
    'epa violation',
    'environmental damage',
    'oil spill',
    'deforestation',
    'water contamination',
    'illegal dumping',
    'environmental non-compliance',
  ],
  MODERN_SLAVERY: [
    'modern slavery',
    'forced labor',
    'human trafficking',
    'child labor',
    'sweatshop',
    'labor exploitation',
    'supply chain slavery',
    'debt bondage',
    'indentured labor',
  ],
  SANCTIONS_EVASION_ESG: [
    'sanctions evasion',
    'trade sanctions',
    'embargo violation',
    'restricted trade',
    'dual use goods',
    'export control violation',
    'prohibited transaction',
  ],
};

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const esgScanRequestSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
}).strict();

// ─── POST /api/adverse-media/esg-scan ───────────────────────────────────────
// Scans an existing adverse media session's results for ESG risk indicators
// Uses keyword matching + AI SDK for enhanced analysis

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard({
      allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'],
    });
    if (!auth.authorized) {
      return (
        auth.error ??
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }
    const rateLimitError = applyRateLimit(auth, request, 'AI');
    if (rateLimitError) return rateLimitError;

    const userId =
      (auth.session?.user as Record<string, unknown>)?.userId as string ||
      (auth.session?.user as Record<string, unknown>)?.id as string ||
      'unknown';

    const body = await request.json();
    const parsed = esgScanRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const { sessionId } = parsed.data;

    // Fetch the session
    const session = await db.adverseMediaSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Adverse media session not found' },
        { status: 404 }
      );
    }

    // Parse the results JSON
    let results: Array<{ title?: string; snippet?: string; source?: string }> = [];
    try {
      results = JSON.parse(session.results || '[]');
    } catch {
      results = [];
    }

    // Also scan subject name, AKA, and rationale for ESG keywords
    const textToScan = [
      session.subjectName,
      session.aka || '',
      session.rationale || '',
      ...results.map(
        (r) => `${r.title || ''} ${r.snippet || ''}`
      ),
    ].join(' ').toLowerCase();

    // ─── Keyword-Based ESG Detection ───────────────────────────────────────

    const detectedTags: string[] = [];
    const tagDetails: Record<string, { count: number; examples: string[] }> = {};

    for (const [category, keywords] of Object.entries(ESG_KEYWORD_CATEGORIES)) {
      let categoryHitCount = 0;
      const matchedKeywords: string[] = [];

      for (const keyword of keywords) {
        const regex = new RegExp(keyword.replace(/\s+/g, '\\s+'), 'gi');
        const matches = textToScan.match(regex);
        if (matches && matches.length > 0) {
          categoryHitCount += matches.length;
          matchedKeywords.push(keyword);
        }
      }

      if (categoryHitCount > 0) {
        detectedTags.push(category);
        tagDetails[category] = {
          count: categoryHitCount,
          examples: matchedKeywords.slice(0, 5),
        };
      }
    }

    // ─── ESG Risk Score Calculation ────────────────────────────────────────

    let esgRiskScore = 0;

    // Base score from tag severity
    const TAG_WEIGHTS: Record<string, number> = {
      GREENWASHING: 25,
      CARBON_FRAUD: 30,
      ENVIRONMENTAL_VIOLATION: 20,
      MODERN_SLAVERY: 35,
      SANCTIONS_EVASION_ESG: 30,
    };

    for (const tag of detectedTags) {
      esgRiskScore += TAG_WEIGHTS[tag] || 15;
    }

    // Volume adjustment (more keyword hits = higher confidence)
    const totalHits = Object.values(tagDetails).reduce((sum, d) => sum + d.count, 0);
    if (totalHits > 5) esgRiskScore = Math.min(100, esgRiskScore + 10);
    if (totalHits > 10) esgRiskScore = Math.min(100, esgRiskScore + 10);

    // Existing decision influence
    if (session.decision === 'CONFIRMED_MATCH') esgRiskScore = Math.min(100, esgRiskScore + 15);
    if (session.decision === 'POTENTIAL_MATCH') esgRiskScore = Math.min(100, esgRiskScore + 5);

    // Cap at 100
    esgRiskScore = Math.min(100, esgRiskScore);

    // ─── Update the session with ESG data ──────────────────────────────────

    const updated = await db.adverseMediaSession.update({
      where: { id: sessionId },
      data: {
        esgRiskTags: JSON.stringify(detectedTags),
        esgRiskScore,
      },
    });

    // SHA-256 Audit Log
    const sha256Hash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          action: 'ESG_SCAN_COMPLETED',
          sessionId,
          esgRiskScore,
          tags: detectedTags,
          timestamp: Date.now(),
        })
      )
      .digest('hex');

    await db.auditLog.create({
      data: {
        userId,
        action: 'ESG_SCAN_COMPLETED',
        resource: 'AdverseMediaSession',
        resourceId: sessionId,
        details: JSON.stringify({
          subjectName: session.subjectName,
          esgRiskScore,
          esgRiskTags: detectedTags,
          totalKeywordHits: totalHits,
        }),
        sha256Hash,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        sessionId: updated.id,
        esgRiskTags: detectedTags,
        esgRiskScore,
        esgRiskLevel:
          esgRiskScore === 0 ? 'none' : esgRiskScore <= 25 ? 'low' : esgRiskScore <= 50 ? 'medium' : 'high',
        tagDetails,
        totalKeywordHits: totalHits,
      },
    });
  } catch (error) {
    console.error('ESG scan failed:', error);
    return NextResponse.json(
      { success: false, error: 'ESG scan failed' },
      { status: 500 }
    );
  }
}
