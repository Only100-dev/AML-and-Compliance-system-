import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { calculateCombinedRisk, SCORECARD_THEMES, REGULATOR_COLUMNS, GAP_RATING_CRITERIA, type GapRating } from '@/lib/scorecard/types';
import { GCC_JURISDICTION_CODES } from '@/lib/constants/jurisdictions';
import { withAuditLog } from '@/lib/audit-worm';

// GET /api/audit-scorecard — Fetch audit scorecard data
export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard();
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;

    const { searchParams } = new URL(request.url);
    const jurisdictionId = searchParams.get('jurisdictionId');

    // Build where clause
    const where: Record<string, unknown> = {};
    if (jurisdictionId) where.jurisdictionId = jurisdictionId;

    // Fetch all scorecard entries
    const scorecardEntries = await db.auditScorecard.findMany({ where });

    // Organize into theme-based structure
    const themes = SCORECARD_THEMES.map(theme => {
      const regulators: Record<string, { regulator: string; jurisdiction: string; gapRating: number; evidence?: string; lastAssessedAt?: string }> = {};

      // For each regulator column, find the matching scorecard entry
      REGULATOR_COLUMNS.forEach(col => {
        if (jurisdictionId && col.jurisdiction !== jurisdictionId) return;

        const entry = scorecardEntries.find(
          e => e.theme === theme.code && e.regulator === col.code && e.jurisdictionId === col.jurisdiction
        );

        regulators[col.code] = {
          regulator: col.code,
          jurisdiction: col.jurisdiction,
          gapRating: entry?.gapRating ?? 0,
          evidence: entry?.evidence ? (typeof entry.evidence === 'string' ? entry.evidence : JSON.stringify(entry.evidence)) : undefined,
          lastAssessedAt: entry?.lastAssessedAt?.toISOString(),
        };
      });

      const combinedRisk = calculateCombinedRisk(
        Object.fromEntries(
          Object.entries(regulators).map(([key, val]) => [key, { ...val, jurisdiction: val.jurisdiction as 'AE' | 'SA' | 'BH' | 'QA' | 'OM' | 'KW' }])
        )
      );

      return {
        theme,
        regulators,
        combinedRisk,
      };
    });

    // Calculate summary statistics
    const summary = {
      totalThemes: themes.length,
      criticalThemes: themes.filter(t => t.combinedRisk === 'Critical').length,
      highThemes: themes.filter(t => t.combinedRisk === 'High').length,
      mediumThemes: themes.filter(t => t.combinedRisk === 'Medium').length,
      lowThemes: themes.filter(t => t.combinedRisk === 'Low').length,
    };

    return NextResponse.json({
      success: true,
      data: { themes, summary },
    });
  } catch (error) {
    console.error('Failed to fetch audit scorecard:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit scorecard' },
      { status: 500 }
    );
  }
}

// PUT /api/audit-scorecard — Update a scorecard rating
export const PUT = withAuditLog(
  async (request: NextRequest) => {
  try {
    const auth = await authGuard();
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const { jurisdictionId, theme, regulator, gapRating, evidence } = body as {
      jurisdictionId: string;
      theme: string;
      regulator: string;
      gapRating: number;
      evidence?: string;
    };

    if (!jurisdictionId || !theme || !regulator || gapRating === undefined) {
      return NextResponse.json(
        { success: false, error: 'jurisdictionId, theme, regulator, and gapRating are required' },
        { status: 400 }
      );
    }

    if (![0, 1, 2, 3].includes(gapRating)) {
      return NextResponse.json(
        { success: false, error: 'gapRating must be 0, 1, 2, or 3' },
        { status: 400 }
      );
    }

    const userName = (auth.user as Record<string, unknown>)?.name as string || 'Unknown';

    // Upsert the scorecard entry
    const entry = await db.auditScorecard.upsert({
      where: {
        jurisdictionId_theme_regulator: { jurisdictionId, theme, regulator },
      },
      update: {
        gapRating,
        evidence: evidence || null,
        lastAssessedBy: userName,
        lastAssessedAt: new Date(),
      },
      create: {
        jurisdictionId,
        theme,
        regulator,
        gapRating,
        evidence: evidence || null,
        lastAssessedBy: userName,
        lastAssessedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    console.error('Failed to update audit scorecard:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update audit scorecard' },
      { status: 500 }
    );
  }
  },
  { entityType: 'AuditScorecard' }
);
