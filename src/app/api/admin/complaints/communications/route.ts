import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { createAuditLog } from '@/lib/audit';
import { resolveActorId } from '@/lib/audit-actor';

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const createCommunicationSchema = z.object({
  complaintId: z.string().min(1, 'complaintId is required'),
  direction: z.enum(['INBOUND', 'OUTBOUND']),
  channel: z.enum(['portal', 'email', 'phone', 'letter', 'sms']).default('portal'),
  authorName: z.string().min(1, 'authorName is required'),
  authorRole: z.string().optional(),
  message: z.string().min(1, 'message is required'),
  isSystemNote: z.boolean().default(false),
});

// GET /api/complaints/communications?complaintId=... — list communications for a complaint
export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({
      allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'],
    });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;

    const { searchParams } = new URL(request.url);
    const complaintId = searchParams.get('complaintId');
    if (!complaintId) {
      return NextResponse.json(
        { success: false, error: 'complaintId query parameter is required' },
        { status: 400 },
      );
    }

    const communications = await db.complaintCommunication.findMany({
      where: { complaintId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, data: communications });
  } catch (error) {
    console.error('[COMPLAINT_COMM_GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch communications' },
      { status: 500 },
    );
  }
}

// POST /api/complaints/communications — append a communication log entry
export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard({
      allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'],
    });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = createCommunicationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const complaint = await db.complaint.findUnique({ where: { id: data.complaintId } });
    if (!complaint) {
      return NextResponse.json({ success: false, error: 'Complaint not found' }, { status: 404 });
    }

    const comm = await db.complaintCommunication.create({
      data: {
        complaintId: data.complaintId,
        direction: data.direction,
        channel: data.channel,
        authorName: data.authorName,
        authorRole: data.authorRole ?? null,
        message: data.message,
        isSystemNote: data.isSystemNote,
      },
    });

    const actorId = resolveActorId(auth);
    await createAuditLog({
      userId: actorId,
      action: 'COMPLAINT_COMMUNICATION_LOGGED',
      resourceType: 'Complaint',
      resourceId: data.complaintId,
      details: `${data.direction} ${data.channel} communication logged on complaint ${complaint.complaintNumber}.`,
      changes: {
        direction: data.direction,
        channel: data.channel,
        authorName: data.authorName,
        messageLength: data.message.length,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
    }).catch((e) => console.error('[complaints/communications] audit log failed:', e));

    return NextResponse.json({ success: true, data: comm }, { status: 201 });
  } catch (error) {
    console.error('[COMPLAINT_COMM_POST] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to log communication' },
      { status: 500 },
    );
  }
}
