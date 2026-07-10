/**
 * Board Critical Escalations Feed API
 * CBUAE Notice 3551/2021 S3.1
 *
 * GET: Fetch critical escalations (Red-status AML alerts + escalated SARs)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRBAC } from '@/lib/compliance/rbac';

// ─── GET /api/board/escalations ─────────────────────────────────────────────

export const GET = withRBAC(
  async (_request: NextRequest) => {
    try {
      // Fetch high/critical AML alerts that are new or escalated
      const criticalAlerts = await db.aMLAlert.findMany({
        where: {
          riskLevel: { in: ['high', 'critical'] },
          status: { in: ['new', 'escalated'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Fetch escalated SAR cases
      const escalatedSARs = await db.sARCase.findMany({
        where: {
          status: 'ESCALATED',
        },
        orderBy: { createdAt: 'desc' },
      });

      // Combine and sort by urgency: critical first, then by date
      const combined = [
        ...criticalAlerts.map((a) => ({
          id: a.id,
          type: 'AML_ALERT' as const,
          source: 'aml',
          riskLevel: a.riskLevel,
          status: a.status,
          description: a.description,
          caseId: a.caseId,
          createdAt: a.createdAt,
          urgencyScore: a.riskLevel === 'critical' ? 100 : 80,
        })),
        ...escalatedSARs.map((s) => ({
          id: s.id,
          type: 'SAR_CASE' as const,
          source: 'sar',
          riskLevel: s.riskLevel,
          status: s.status,
          description: s.narrative ?? `SAR Case ${s.caseNumber}`,
          caseId: s.caseNumber,
          createdAt: s.createdAt,
          urgencyScore: 90,
        })),
      ].sort((a, b) => {
        // Sort by urgency score descending, then by creation date descending
        if (b.urgencyScore !== a.urgencyScore) return b.urgencyScore - a.urgencyScore;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      return NextResponse.json({
        success: true,
        data: combined,
        meta: {
          totalAlerts: criticalAlerts.length,
          totalSARs: escalatedSARs.length,
          totalEscalations: combined.length,
        },
      });
    } catch (error) {
      console.error('Failed to fetch critical escalations:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch critical escalations' },
        { status: 500 },
      );
    }
  },
  'canAccessBoardPortal',
);
