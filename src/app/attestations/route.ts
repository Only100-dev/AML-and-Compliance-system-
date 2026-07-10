import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { createUniversalTask, completeUniversalTask } from '@/lib/universal-task';
import { createAuditLog } from '@/lib/audit';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createAttestationSchema = z.object({
  policyId: z.string().min(1, 'Policy ID is required'),
  policyNumber: z.string().min(1, 'Policy number is required'),
  policyTitle: z.string().min(1, 'Policy title is required'),
  userId: z.string().min(1, 'User ID is required'),
  userName: z.string().min(1, 'User name is required'),
  department: z.string().min(1, 'Department is required'),
  version: z.string().min(1, 'Policy version is required'),
  attestationDeadline: z.string().min(1, 'Attestation deadline is required'), // ISO date string
});

const acknowledgeAttestationSchema = z.object({
  attestationId: z.string().min(1, 'Attestation ID is required'),
  userId: z.string().min(1, 'User ID is required'),
});

// ─── GET: List Attestations ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;
    const { searchParams } = new URL(request.url);
    const policyId = searchParams.get('policyId');
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const department = searchParams.get('department');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // ─── /overdue sub-path ───────────────────────────────────────────────
    const pathSegments = request.nextUrl.pathname.split('/');
    const lastSegment = pathSegments[pathSegments.length - 1];

    if (lastSegment === 'overdue') {
      return handleGetOverdue(searchParams, page, limit);
    }

    const where: Record<string, unknown> = {};

    if (policyId) where.policyId = policyId;
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (department) where.department = department;

    const [attestations, total] = await Promise.all([
      db.policyAttestation.findMany({
        where,
        orderBy: [{ attestationDeadline: 'asc' }, { status: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.policyAttestation.count({ where }),
    ]);

    // Enrich with overdue calculation
    const now = new Date();
    const enrichedAttestations = attestations.map(attestation => {
      const isOverdue = attestation.status === 'pending' && new Date(attestation.attestationDeadline) < now;
      return {
        ...attestation,
        isOverdue,
        computedStatus: isOverdue ? 'overdue' : attestation.status,
      };
    });

    return NextResponse.json({
      success: true,
      data: enrichedAttestations,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        summary: {
          pending: attestations.filter(a => a.status === 'pending').length,
          acknowledged: attestations.filter(a => a.status === 'acknowledged').length,
          overdue: attestations.filter(a => a.status === 'pending' && new Date(a.attestationDeadline) < now).length,
        },
      },
    });
  } catch (error) {
    console.error('[ATTESTATIONS_GET] Error listing attestations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list attestations' },
      { status: 500 }
    );
  }
}

// ─── GET /overdue Handler ────────────────────────────────────────────────────

async function handleGetOverdue(searchParams: URLSearchParams, page: number, limit: number) {
  try {
    const policyId = searchParams.get('policyId');
    const userId = searchParams.get('userId');
    const department = searchParams.get('department');

    const now = new Date();

    const where: Record<string, unknown> = {
      status: 'pending',
      attestationDeadline: { lt: now },
    };

    if (policyId) where.policyId = policyId;
    if (userId) where.userId = userId;
    if (department) where.department = department;

    const [overdueAttestations, total] = await Promise.all([
      db.policyAttestation.findMany({
        where,
        orderBy: { attestationDeadline: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.policyAttestation.count({ where }),
    ]);

    // Enrich with days overdue
    const enriched = overdueAttestations.map(attestation => {
      const deadline = new Date(attestation.attestationDeadline);
      const daysOverdue = Math.ceil((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));
      return {
        ...attestation,
        daysOverdue,
        computedStatus: 'overdue',
      };
    });

    return NextResponse.json({
      success: true,
      data: enriched,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[ATTESTATIONS_OVERDUE_GET] Error listing overdue attestations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list overdue attestations' },
      { status: 500 }
    );
  }
}

// ─── POST: Create Attestation Record ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;
    const body = await request.json();
    const parsed = createAttestationSchema.safeParse(body);

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

    const {
      policyId,
      policyNumber,
      policyTitle,
      userId,
      userName,
      department,
      version,
      attestationDeadline,
    } = parsed.data;

    // Check for duplicate attestation (same user + same policy + same version + pending)
    const existingPending = await db.policyAttestation.findFirst({
      where: {
        policyId,
        userId,
        version,
        status: 'pending',
      },
    });

    if (existingPending) {
      return NextResponse.json(
        {
          success: false,
          error: 'A pending attestation already exists for this user, policy, and version.',
          code: 'DUPLICATE_ATTESTATION',
          data: { existingAttestationId: existingPending.id },
        },
        { status: 409 }
      );
    }

    const attestation = await db.policyAttestation.create({
      data: {
        policyId,
        policyNumber,
        policyTitle,
        userId,
        userName,
        department,
        status: 'pending',
        attestationDeadline: new Date(attestationDeadline),
        version,
      },
    });

    // ─── Create a calendar event for the attestation deadline ────────────
    await db.calendarEvent.create({
      data: {
        title: `Policy Attestation Due: ${policyTitle} (v${version})`,
        description: `${userName} from ${department} must acknowledge policy "${policyTitle}" (v${version}) by the deadline.`,
        eventType: 'policy',
        eventDate: new Date(attestationDeadline),
        priority: 'high',
        jurisdiction: 'CBUAE',
        status: 'upcoming',
        sourceModule: 'attestations',
        sourceEntityId: attestation.id,
      },
    });

    // ─── Audit Log (v7.3.0-RC1-uat-final: use createAuditLog() so the
    // entry gets a SHA-256 integrity hash + PII sanitization. The previous
    // direct db.auditLog.create() bypassed hashing, producing null-hash
    // entries that broke /api/audit/integrity verification.)
    await createAuditLog({
      userId,
      action: 'ATTESTATION_CREATED',
      resourceType: 'PolicyAttestation',
      resourceId: attestation.id,
      details: JSON.stringify({
        policyId,
        policyNumber,
        policyTitle,
        userName,
        department,
        version,
        attestationDeadline,
      }),
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
    });

    // ─── Surface in the assignee's unified "My Tasks" inbox ─────────────
    // v7.3.0-RC1-uat-ready (Blocker 2): Wire createUniversalTask() into
    // attestation creation so the assigned user sees the attestation deadline
    // in their unified inbox. Non-blocking.
    await createUniversalTask({
      taskType: 'POLICY_ATTESTATION',
      sourceId: attestation.id,
      sourceEntityType: 'PolicyAttestation',
      sourceModule: 'POLICY_ATTESTATION',
      title: `Attestation Due: ${policyTitle} (v${version})`,
      description: `${userName} (${department}) must acknowledge policy ${policyNumber} by ${attestationDeadline}.`,
      assignedToId: userId,
      assignedToName: userName,
      priority: 'HIGH',
      status: 'OPEN',
      dueDate: new Date(attestationDeadline),
    });

    return NextResponse.json({
      success: true,
      data: attestation,
      meta: {
        regulatoryBasis: 'CR 134/2025 — Policy attestation tracking',
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[ATTESTATIONS_POST] Error creating attestation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create attestation' },
      { status: 500 }
    );
  }
}

// ─── PUT: Acknowledge Attestation ────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;
    const body = await request.json();
    const parsed = acknowledgeAttestationSchema.safeParse(body);

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

    const { attestationId, userId } = parsed.data;

    // Fetch existing attestation
    const existingAttestation = await db.policyAttestation.findUnique({
      where: { id: attestationId },
    });

    if (!existingAttestation) {
      return NextResponse.json(
        { success: false, error: `Attestation with ID "${attestationId}" not found` },
        { status: 404 }
      );
    }

    // Verify user is the attestation owner
    if (existingAttestation.userId !== userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Only the assigned user can acknowledge this attestation.',
          code: 'UNAUTHORIZED_ATTESTATION',
        },
        { status: 403 }
      );
    }

    // Check if already acknowledged
    if (existingAttestation.status === 'acknowledged') {
      return NextResponse.json(
        {
          success: false,
          error: 'This attestation has already been acknowledged.',
          code: 'ALREADY_ACKNOWLEDGED',
        },
        { status: 422 }
      );
    }

    // Record IP address, user agent, timestamp
    const ipAddress = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const acknowledgedAt = new Date();

    // Update attestation status
    const updatedAttestation = await db.policyAttestation.update({
      where: { id: attestationId },
      data: {
        status: 'acknowledged',
        acknowledgedAt,
        ip4Address: ipAddress,
        userAgent,
      },
    });

    // ─── Audit Log (v7.3.0-RC1-uat-final: use createAuditLog() so the
    // entry gets a SHA-256 integrity hash + PII sanitization, matching the
    // /api/audit/integrity verifier formula exactly.)
    await createAuditLog({
      userId,
      action: 'ATTESTATION_ACKNOWLEDGED',
      resourceType: 'PolicyAttestation',
      resourceId: attestationId,
      details: JSON.stringify({
        policyId: existingAttestation.policyId,
        policyNumber: existingAttestation.policyNumber,
        policyTitle: existingAttestation.policyTitle,
        version: existingAttestation.version,
        userName: existingAttestation.userName,
        department: existingAttestation.department,
        acknowledgedAt: acknowledgedAt.toISOString(),
        ipAddress,
        userAgent,
      }),
      ipAddress: ipAddress ?? undefined,
    });

    // ─── Complete the UniversalTask row for this attestation ────────────
    // v7.3.0-RC1-uat-ready (Blocker 2): Once acknowledged, the attestation
    // task is removed from the assignee's active inbox (status → DONE).
    // Non-blocking — failure here is logged + swallowed.
    await completeUniversalTask({
      taskType: 'POLICY_ATTESTATION',
      sourceId: attestationId,
      assignedToId: userId,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updatedAttestation,
        acknowledgedAt,
        ip4Address: ipAddress,
        userAgent,
      },
      meta: {
        previousStatus: existingAttestation.status,
        newStatus: 'acknowledged',
        auditTrail: {
          ip: ipAddress,
          userAgent,
          timestamp: acknowledgedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('[ATTESTATIONS_PUT] Error acknowledging attestation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to acknowledge attestation' },
      { status: 500 }
    );
  }
}
