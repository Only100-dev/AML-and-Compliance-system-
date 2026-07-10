/**
 * Board Digital Acknowledgment API
 * CBUAE Notice 3551/2021 S3.1
 *
 * POST: Digital acknowledgment with watermark and SHA-256 non-repudiation
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRBAC } from '@/lib/compliance/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import { createHash } from 'crypto';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const acknowledgeDocumentSchema = z.object({
  documentId: z.string().min(1, 'Document ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  userName: z.string().min(1, 'User name is required'),
  userEmail: z.string().email('Valid email is required'),
});

// ─── Helper ──────────────────────────────────────────────────────────────────

function getRBACContext(request: NextRequest) {
  const raw = request.headers.get('x-rbac-context');
  if (raw) {
    try { return JSON.parse(raw); } catch { /* fall through */ }
  }
  return {
    userId: request.headers.get('x-user-id') ?? 'unknown',
    role: request.headers.get('x-user-role') ?? 'unknown',
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  };
}

// ─── POST /api/board/acknowledge ─────────────────────────────────────────────

export const POST = withRBAC(
  async (request: NextRequest) => {
    try {
      const ctx = getRBACContext(request);
      const body = await request.json();
      const parsed = acknowledgeDocumentSchema.safeParse(body);

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

      const { documentId, userId, userName, userEmail } = parsed.data;

      // Verify document exists
      const document = await db.boardDocument.findUnique({ where: { id: documentId } });
      if (!document) {
        return NextResponse.json(
          { success: false, error: 'Board document not found' },
          { status: 404 },
        );
      }

      // Check if already acknowledged by this user
      const existing = await db.digitalAcknowledgment.findFirst({
        where: { documentId, userId },
      });
      if (existing) {
        return NextResponse.json(
          {
            success: false,
            error: 'Document already acknowledged by this user',
            regulatoryRef: 'CBUAE Notice 3551/2021 S3.1',
          },
          { status: 409 },
        );
      }

      // Generate watermark text
      const watermarkText = `${userName} | ${userEmail} | ${new Date().toISOString()}`;

      // Compute SHA-256 hash for non-repudiation
      const hashPayload = JSON.stringify({
        documentId,
        userId,
        userName,
        userEmail,
        watermarkText,
        acknowledgedAt: new Date().toISOString(),
      });
      const sha256Hash = createHash('sha256').update(hashPayload).digest('hex');

      // Create digital acknowledgment
      const acknowledgment = await db.digitalAcknowledgment.create({
        data: {
          documentId,
          userId,
          userName,
          userEmail,
          acknowledgedAt: new Date(),
          ipAddress: ctx.ipAddress,
          watermarkText,
          sha256Hash,
        },
      });

      // Audit log with SHA-256
      await createAuditLog({
        userId: ctx.userId,
        action: 'BOARD_DOCUMENT_ACKNOWLEDGED',
        resourceType: 'DigitalAcknowledgment',
        resourceId: acknowledgment.id,
        details: `Board member ${userName} acknowledged document "${document.title}" with watermark`,
        ipAddress: ctx.ipAddress,
      });

      return NextResponse.json({
        success: true,
        data: acknowledgment,
      }, { status: 201 });
    } catch (error) {
      console.error('Failed to acknowledge board document:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to acknowledge board document' },
        { status: 500 },
      );
    }
  },
  'canAcknowledgeBoardDocument',
);
