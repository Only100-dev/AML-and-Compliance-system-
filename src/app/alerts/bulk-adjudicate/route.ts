import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { createAuditLog } from '@/lib/audit';
import { applyRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const bulkAdjudicateSchema = z.object({
  alertIds: z.array(z.string().min(1)).min(1, 'At least one alert ID is required').max(500, 'Maximum 500 alerts can be bulk adjudicated per request to prevent database lockups'),
  decision: z.literal('FALSE_POSITIVE', { message: 'Only FALSE_POSITIVE decision is supported for bulk adjudication' }),
  bulkJustification: z.string().min(20, 'Bulk justification must be at least 20 characters for audit trail compliance'),
  userId: z.string().min(1, 'User ID is required'),
  userName: z.string().min(1, 'User name is required'),
});

// POST /api/alerts/bulk-adjudicate — Bulk false positive adjudication
export async function POST(request: NextRequest) {
  try {
    // Auth guard
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit check
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;

    // Parse and validate body
    const body = await request.json();
    const parsed = bulkAdjudicateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { alertIds, decision, bulkJustification, userId, userName } = parsed.data;

    // Fetch all alerts by IDs
    const alerts = await db.aMLAlert.findMany({
      where: { id: { in: alertIds } },
    });

    if (alerts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No alerts found for the provided IDs' },
        { status: 404 }
      );
    }

    // Validate that all alerts share at least one common attribute
    const jurisdictions = new Set(alerts.map((a) => a.jurisdiction));
    const alertTypes = new Set(alerts.map((a) => a.alertType));
    const aiFlagsSets = alerts.map((a) => {
      if (!a.aiFlags) return new Set<string>();
      return new Set(a.aiFlags.split(',').map((s) => s.trim()));
    });
    // Check for common AI flags
    const commonFlags = aiFlagsSets.reduce((acc, set) => {
      if (acc === null) return set;
      return new Set([...acc].filter((x) => set.has(x)));
    }, null as Set<string> | null);

    const sharesJurisdiction = jurisdictions.size === 1;
    const sharesAlertType = alertTypes.size === 1;
    const sharesCommonFlag = commonFlags && commonFlags.size > 0;

    if (!sharesJurisdiction && !sharesAlertType && !sharesCommonFlag) {
      return NextResponse.json(
        {
          success: false,
          error: 'Alerts do not share a common attribute (jurisdiction, alert type, or AI flag). Bulk adjudication requires at least one shared attribute for compliance.',
          sharedAttributes: {
            jurisdictions: [...jurisdictions],
            alertTypes: [...alertTypes],
          },
        },
        { status: 400 }
      );
    }

    // Chunk processing for large bulk operations (max 500 items, processed in batches of 100)
    const CHUNK_SIZE = 100;
    let totalUpdated = 0;

    for (let i = 0; i < alertIds.length; i += CHUNK_SIZE) {
      const chunk = alertIds.slice(i, i + CHUNK_SIZE);
      const chunkResult = await db.aMLAlert.updateMany({
        where: { id: { in: chunk } },
        data: {
          status: 'closed',
          approvedBy: userName,
          updatedAt: new Date(),
        },
      });
      totalUpdated += chunkResult.count;
    }

    // Create a single SHA-256 audit log entry for the bulk action
    await createAuditLog({
      userId,
      action: 'BULK_ADJUDICATE_FALSE_POSITIVE',
      resourceType: 'AMLAlert',
      resourceId: alertIds.join(','),
      details: `Bulk adjudication of ${totalUpdated} alerts as ${decision}. Justification: ${bulkJustification}. Shared attribute: ${sharesJurisdiction ? `Jurisdiction: ${[...jurisdictions][0]}` : sharesAlertType ? `Alert Type: ${[...alertTypes][0]}` : `Common Flag: ${[...commonFlags!][0]}`}`,
    });

    return NextResponse.json({
      success: true,
      data: {
        updatedCount: totalUpdated,
        decision,
        sharedAttribute: sharesJurisdiction ? 'jurisdiction' : sharesAlertType ? 'alertType' : 'aiFlag',
        audited: true,
        chunked: alertIds.length > CHUNK_SIZE,
      },
    });
  } catch (error) {
    console.error('[Bulk Adjudicate API] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to execute bulk adjudication' },
      { status: 500 }
    );
  }
}
