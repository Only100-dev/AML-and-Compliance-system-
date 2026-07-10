import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const reportIncidentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  incidentType: z.string().optional(),
});

// ─── POST /api/bcp/report-incident — Report an incident ─────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = reportIncidentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Generate a unique case number like INC-{timestamp}
    const caseNumber = `INC-${Date.now()}`;

    // Map severity to priority for ComplianceCase
    const priorityMap: Record<string, string> = {
      low: 'low',
      medium: 'normal',
      high: 'high',
      critical: 'urgent',
    };

    const complianceCase = await db.complianceCase.create({
      data: {
        caseNumber,
        title: data.title,
        caseType: 'INCIDENT_RESPONSE',
        status: 'open',
        priority: priorityMap[data.severity] || 'normal',
        riskLevel: data.severity,
        description: data.description
          ? `${data.incidentType ? `[Type: ${data.incidentType}] ` : ''}${data.description}`
          : data.incidentType
            ? `[Type: ${data.incidentType}]`
            : null,
      },
    });

    // SHA-256 Audit Log
    const userId = (auth.session?.user as Record<string, unknown>)?.userId as string
      || (auth.session?.user as Record<string, unknown>)?.id as string
      || 'unknown';

    const sha256Hash = crypto
      .createHash('sha256')
      .update(JSON.stringify({
        action: 'INCIDENT_REPORTED',
        caseId: complianceCase.id,
        caseNumber,
        timestamp: Date.now(),
      }))
      .digest('hex');

    await db.auditLog.create({
      data: {
        userId,
        action: 'INCIDENT_REPORTED',
        resource: 'ComplianceCase',
        resourceId: complianceCase.id,
        details: JSON.stringify({
          caseNumber,
          title: data.title,
          severity: data.severity,
          incidentType: data.incidentType,
        }),
        sha256Hash,
      },
    });

    return NextResponse.json({ success: true, data: complianceCase }, { status: 201 });
  } catch (error) {
    console.error('Failed to report incident:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to report incident' },
      { status: 500 }
    );
  }
}
