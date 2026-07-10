import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { checkPermission, type ComplianceRole } from '@/lib/compliance/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import crypto from 'crypto';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createEarlySurrenderSchema = z.object({
  policyNumber: z.string().min(1, 'Policy number is required'),
  policyholderName: z.string().min(1, 'Policyholder name is required'),
  productType: z.string().min(1, 'Product type is required'),
  inceptionDate: z.string().min(1, 'Inception date is required'),
  surrenderDate: z.string().min(1, 'Surrender date is required'),
  surrenderValueAED: z.number().min(0, 'Surrender value must be non-negative'),
  premiumsPaidAED: z.number().min(0, 'Premiums paid must be non-negative'),
  isThirdPartyPayout: z.boolean().default(false),
  coolingOffPeriodDays: z.number().int().min(1).max(90).default(30),
  // Traceability FKs (Pre-UAT Polish Fix #1)
  customerId: z.string().optional(),   // FK → User.id
  policyId: z.string().optional(),     // FK → Policy.id
  caseId: z.string().optional(),       // FK → ComplianceCase.id
});

// ─── GET /api/early-surrender ────────────────────────────────────────────────
// List early surrender records with optional filters and summary stats
// Auth: canManageEarlySurrender

export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard();
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (auth.session?.user as Record<string, unknown>)?.role as ComplianceRole;
    if (!checkPermission(userRole, 'canManageEarlySurrender')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Permission denied',
          message: `Role "${userRole}" does not have permission "canManageEarlySurrender".`,
          regulatoryRef: 'CBUAE Insurance AML Guidelines; FDL 10/2025 Art. 13-14',
        },
        { status: 403 }
      );
    }

    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;

    const { searchParams } = new URL(request.url);
    const policyNumber = searchParams.get('policyNumber');
    const highMLRFlag = searchParams.get('highMLRFlag');
    const reviewStatus = searchParams.get('reviewStatus');
    const coolingOffStatus = searchParams.get('coolingOffStatus');

    const where: Record<string, unknown> = {};
    if (policyNumber) where.policyNumber = { contains: policyNumber };
    if (highMLRFlag !== null) where.highMLRFlag = highMLRFlag === 'true';
    if (reviewStatus) where.reviewStatus = reviewStatus;
    if (coolingOffStatus) where.coolingOffStatus = coolingOffStatus;

    const [records, total, mlrFlagged, withinCoolingOff, pendingReview] = await Promise.all([
      db.earlySurrenderRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      }),
      db.earlySurrenderRecord.count({ where }),
      db.earlySurrenderRecord.count({ where: { highMLRFlag: true } }),
      db.earlySurrenderRecord.count({ where: { coolingOffStatus: 'WITHIN_COOLING_OFF' } }),
      db.earlySurrenderRecord.count({ where: { reviewStatus: 'PENDING_REVIEW', highMLRFlag: true } }),
    ]);

    return NextResponse.json({
      success: true,
      data: records,
      summary: { total, mlrFlagged, withinCoolingOff, pendingReview },
    });
  } catch (error) {
    console.error('Failed to fetch early surrender records:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch early surrender records' },
      { status: 500 }
    );
  }
}

// ─── POST /api/early-surrender ───────────────────────────────────────────────
// Create early surrender record with AUTO-MLR logic
// Auth: canManageEarlySurrender
// HARD-BLOCK: IF financialLossPct > 20 AND isThirdPartyPayout → highMLRFlag, AMLAlert, Notification

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard();
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (auth.session?.user as Record<string, unknown>)?.role as ComplianceRole;
    if (!checkPermission(userRole, 'canManageEarlySurrender')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Permission denied',
          message: `Role "${userRole}" does not have permission "canManageEarlySurrender".`,
          regulatoryRef: 'CBUAE Insurance AML Guidelines; FDL 10/2025 Art. 13-14',
        },
        { status: 403 }
      );
    }

    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = createEarlySurrenderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const userId = ((auth.session?.user as Record<string, unknown>)?.userId as string) ||
      ((auth.session?.user as Record<string, unknown>)?.id as string) || 'unknown';

    // ── AUTO-MLR CALCULATIONS ──────────────────────────────────────────────
    const inceptionDate = new Date(data.inceptionDate);
    const surrenderDate = new Date(data.surrenderDate);

    // 1. Days since inception
    const diffMs = surrenderDate.getTime() - inceptionDate.getTime();
    const daysSinceInception = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // 2. Financial loss
    const financialLossAED = data.premiumsPaidAED - data.surrenderValueAED;

    // 3. Financial loss percentage
    const financialLossPct = data.premiumsPaidAED > 0
      ? (financialLossAED / data.premiumsPaidAED) * 100
      : 0;

    // 4. Cooling-off status
    const coolingOffStatus = daysSinceInception <= data.coolingOffPeriodDays
      ? 'WITHIN_COOLING_OFF'
      : 'OUTSIDE_COOLING_OFF';

    // 5. HARD-BLOCK MLR check
    const highMLRFlag = financialLossPct > 20 && data.isThirdPartyPayout === true;

    // SHA-256 hash of the record data
    const hashPayload = JSON.stringify({
      policyNumber: data.policyNumber,
      policyholderName: data.policyholderName,
      surrenderValueAED: data.surrenderValueAED,
      premiumsPaidAED: data.premiumsPaidAED,
      financialLossAED,
      financialLossPct,
      daysSinceInception,
      isThirdPartyPayout: data.isThirdPartyPayout,
      highMLRFlag,
      timestamp: new Date().toISOString(),
    });
    const sha256Hash = crypto.createHash('sha256').update(hashPayload).digest('hex');

    // Create the record
    const record = await db.earlySurrenderRecord.create({
      data: {
        policyNumber: data.policyNumber,
        policyholderName: data.policyholderName,
        productType: data.productType,
        inceptionDate,
        surrenderDate,
        surrenderValueAED: data.surrenderValueAED,
        premiumsPaidAED: data.premiumsPaidAED,
        financialLossAED,
        financialLossPct,
        daysSinceInception,
        isThirdPartyPayout: data.isThirdPartyPayout,
        coolingOffPeriodDays: data.coolingOffPeriodDays,
        isWithinCoolingOff: coolingOffStatus === 'WITHIN_COOLING_OFF',
        coolingOffStatus,
        highMLRFlag,
        mlrTriggerReason: highMLRFlag
          ? `Financial loss ${financialLossPct.toFixed(1)}% > 20% with third-party payout (4-eyes MLR trigger per CBUAE AML Guidelines)`
          : null,
        mlrFlaggedAt: highMLRFlag ? new Date() : null,
        createdBy: userId,
        sha256Hash,
        // Traceability FKs (Pre-UAT Polish Fix #1)
        customerId: data.customerId ?? null,
        policyId: data.policyId ?? null,
        caseId: data.caseId ?? null,
      },
    });

    // If MLR flagged → auto-create AMLAlert and Notification for MLRO
    if (highMLRFlag) {
      const alertCaseId = `ES-MLR-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      const alert = await db.aMLAlert.create({
        data: {
          caseId: alertCaseId,
          alertType: 'EARLY_SURRENDER_MLR',
          description: `High MLR flag triggered for policy ${data.policyNumber}: Financial loss ${financialLossPct.toFixed(1)}% with third-party payout. Policyholder: ${data.policyholderName}.`,
          riskLevel: 'high',
          riskScore: 85.0,
          status: 'new',
          policyNumber: data.policyNumber,
          amount: financialLossAED,
          createdBy: userId,
          jurisdiction: 'CBUAE',
        },
      });

      // Link alert to record
      await db.earlySurrenderRecord.update({
        where: { id: record.id },
        data: { linkedAlertId: alert.id, alertGenerated: true },
      });

      // Create urgent notification for MLRO users
      const mlroUsers = await db.user.findMany({
        where: { role: 'mlro', isActive: true },
      });

      for (const mlro of mlroUsers) {
        await db.notification.create({
          data: {
            userId: mlro.id,
            userName: mlro.name,
            type: 'sanctions_hit',
            title: 'URGENT: High MLR Flag — Early Surrender',
            message: `Policy ${data.policyNumber} has triggered a high MLR flag. Financial loss: ${financialLossPct.toFixed(1)}% with third-party payout. Immediate review required per CBUAE AML Guidelines.`,
            priority: 'urgent',
            sourceModule: 'early_surrender',
            sourceEntityId: record.id,
            actionUrl: `/early-surrender?id=${record.id}`,
          },
        });
      }
    }

    // Audit log
    const auditAction = highMLRFlag ? 'EARLY_SURRENDER_CREATED_WITH_MLR' : 'EARLY_SURRENDER_CREATED';
    await createAuditLog({
      userId,
      action: auditAction,
      resourceType: 'EarlySurrenderRecord',
      resourceId: record.id,
      details: highMLRFlag
        ? `Created early surrender for policy ${data.policyNumber} with HIGH MLR flag (loss: ${financialLossPct.toFixed(1)}%, third-party payout)`
        : `Created early surrender for policy ${data.policyNumber} (loss: ${financialLossPct.toFixed(1)}%)`,
      changes: {
        policyNumber: data.policyNumber,
        financialLossAED,
        financialLossPct,
        highMLRFlag,
        coolingOffStatus,
        sha256Hash,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: record,
        mlrFlagged: highMLRFlag,
        autoCalculations: {
          daysSinceInception,
          financialLossAED,
          financialLossPct,
          coolingOffStatus,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create early surrender record:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create early surrender record' },
      { status: 500 }
    );
  }
}
