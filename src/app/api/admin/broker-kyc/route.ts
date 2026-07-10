import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { checkPermission, type ComplianceRole } from '@/lib/compliance/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import crypto from 'crypto';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createBrokerKYCSchema = z.object({
  brokerName: z.string().min(1, 'Broker name is required'),
  tradeLicenseNumber: z.string().min(1, 'Trade license number is required'),
  cbuaeRegistrationNo: z.string().optional(),
  brokerType: z.enum(['INDIVIDUAL', 'CORPORATE'], {
    error: 'Broker type must be INDIVIDUAL or CORPORATE',
  }),
  riskRating: z.enum(['low', 'medium', 'high'], {
    error: 'Risk rating must be low, medium, or high',
  }).default('medium'),
});

// ─── GET /api/broker-kyc ────────────────────────────────────────────────────
// List broker KYC records with optional filters
// Auth: canManageBrokerKYC

export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard();
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (auth.session?.user as Record<string, unknown>)?.role as ComplianceRole;
    if (!checkPermission(userRole, 'canManageBrokerKYC')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Permission denied',
          message: `Role "${userRole}" does not have permission "canManageBrokerKYC".`,
          regulatoryRef: 'CBUAE Insurance Board Resolution No. 4/2022; FDL 10/2025 Art. 7, 9',
        },
        { status: 403 }
      );
    }

    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const riskRating = searchParams.get('riskRating');
    const brokerType = searchParams.get('brokerType');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (riskRating) where.riskRating = riskRating;
    if (brokerType) where.brokerType = brokerType;

    const records = await db.brokerKYC.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    console.error('Failed to fetch broker KYC records:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch broker KYC records' },
      { status: 500 }
    );
  }
}

// ─── POST /api/broker-kyc ───────────────────────────────────────────────────
// Create broker KYC record
// Auth: canManageBrokerKYC
// Golden Path: Prisma → Zod → AuthGuard → SHA-256 Audit Trail

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard();
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (auth.session?.user as Record<string, unknown>)?.role as ComplianceRole;
    if (!checkPermission(userRole, 'canManageBrokerKYC')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Permission denied',
          message: `Role "${userRole}" does not have permission "canManageBrokerKYC".`,
          regulatoryRef: 'CBUAE Insurance Board Resolution No. 4/2022; FDL 10/2025 Art. 7, 9',
        },
        { status: 403 }
      );
    }

    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = createBrokerKYCSchema.safeParse(body);
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

    // SHA-256 hash of the record data
    const hashPayload = JSON.stringify({
      brokerName: data.brokerName,
      tradeLicenseNumber: data.tradeLicenseNumber,
      cbuaeRegistrationNo: data.cbuaeRegistrationNo,
      brokerType: data.brokerType,
      riskRating: data.riskRating,
      timestamp: new Date().toISOString(),
    });
    const sha256Hash = crypto.createHash('sha256').update(hashPayload).digest('hex');

    const record = await db.brokerKYC.create({
      data: {
        brokerName: data.brokerName,
        tradeLicenseNumber: data.tradeLicenseNumber,
        cbuaeRegistrationNo: data.cbuaeRegistrationNo ?? null,
        brokerType: data.brokerType,
        riskRating: data.riskRating,
        status: 'PENDING',
        sha256Hash,
      },
    });

    // Audit log
    await createAuditLog({
      userId,
      action: 'BROKER_KYC_CREATED',
      resourceType: 'BrokerKYC',
      resourceId: record.id,
      details: `Created broker KYC for "${data.brokerName}" (${data.brokerType}, risk: ${data.riskRating})`,
      changes: {
        brokerName: data.brokerName,
        tradeLicenseNumber: data.tradeLicenseNumber,
        brokerType: data.brokerType,
        riskRating: data.riskRating,
        sha256Hash,
      },
    });

    return NextResponse.json(
      { success: true, data: record },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create broker KYC record:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create broker KYC record' },
      { status: 500 }
    );
  }
}
