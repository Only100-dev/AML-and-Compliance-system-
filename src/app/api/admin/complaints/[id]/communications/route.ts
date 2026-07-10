/**
 * Complaint Communication Log API — CBUAE Notice 3551/2021; FDL 10/2025 Art. 13
 *
 * POST /api/complaints/[id]/communications — Append a communication entry
 *   (email/phone/letter/portal/in-person) to the complaint's audit trail.
 *
 * Communications are persisted as AuditLog entries (action =
 * 'COMPLAINT_COMMUNICATION') rather than a dedicated CommunicationLog table.
 * Rationale:
 *   1. Keeps the DB schema frozen (no new table → no migration risk pre-UAT).
 *   2. Integrates every communication into the SHA-256 tamper-evident hash
 *      chain, so correspondence cannot be silently altered.
 *   3. The audit logger sanitizes PII from `details` + `changes` at rest
 *      (shift-left mandate, Step 2.3), so customer PII in correspondence is
 *      automatically masked — no raw PII persists in the DB.
 *
 * If the business later needs raw (unmasked) correspondence for active
 * investigations, that is a gated PII-reveal action (canRevealPII), separate
 * from this append-only log.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRBAC, type ComplianceRole } from '@/lib/compliance/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const addCommunicationSchema = z.object({
  channel: z.enum(['EMAIL', 'PHONE', 'PORTAL', 'LETTER', 'IN_PERSON', 'INTERNAL_MEMO'], {
    error:
      'channel must be one of: EMAIL, PHONE, PORTAL, LETTER, IN_PERSON, INTERNAL_MEMO',
  }),
  direction: z.enum(['INBOUND', 'OUTBOUND'], {
    error: 'direction must be one of: INBOUND, OUTBOUND',
  }),
  content: z.string().min(1, 'content is required').max(10000, 'content too long'),
  authorId: z.string().optional(),
  authorName: z.string().optional(),
});

// ─── Helper ──────────────────────────────────────────────────────────────────

function getRBACContext(request: NextRequest) {
  const raw = request.headers.get('x-rbac-context');
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      /* fall through */
    }
  }
  return {
    userId: request.headers.get('x-user-id') ?? 'unknown',
    role: (request.headers.get('x-user-role') as ComplianceRole) ?? 'unknown',
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  };
}

// ─── POST /api/complaints/[id]/communications ────────────────────────────────

export const POST = withRBAC(
  async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> },
  ) => {
    try {
      const params = context ? await context.params : {};
      const { id } = params;
      const ctx = getRBACContext(request);

      // Defensive JSON parse
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid JSON payload' },
          { status: 400 },
        );
      }
      const parsed = addCommunicationSchema.safeParse(body);
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
          { status: 400 },
        );
      }

      const { channel, direction, content, authorName } = parsed.data;

      // Verify the complaint exists
      const complaint = await db.complaint.findUnique({ where: { id } });
      if (!complaint) {
        return NextResponse.json(
          { success: false, error: 'Complaint not found' },
          { status: 404 },
        );
      }

      // Append to the audit trail. createAuditLog sanitizes the content of PII
      // at rest and computes the SHA-256 integrity hash.
      const auditLog = await createAuditLog({
        userId: ctx.userId,
        action: 'COMPLAINT_COMMUNICATION',
        resourceType: 'Complaint',
        resourceId: id,
        details: `${direction} ${channel} communication logged for complaint ${complaint.complaintNumber}`,
        changes: {
          channel,
          direction,
          content,
          authorId: ctx.userId,
          authorName: authorName ?? null,
        },
        ipAddress: ctx.ipAddress,
      });

      return NextResponse.json(
        {
          success: true,
          data: {
            id: auditLog.id,
            complaintId: id,
            loggedAt: auditLog.createdAt,
            loggedBy: ctx.userId,
            channel,
            direction,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      console.error('Failed to log complaint communication:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to log complaint communication' },
        { status: 500 },
      );
    }
  },
  'canManageComplaints',
);
