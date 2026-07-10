/**
 * Board Document Management API
 * CBUAE Notice 3551/2021 S3.1
 *
 * GET: List board documents with filtering
 * POST: Create board document with watermark and audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRBAC, type ComplianceRole } from '@/lib/compliance/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import { createHash } from 'crypto';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createBoardDocumentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  documentType: z.enum([
    'ANNUAL_COMPLIANCE_REPORT',
    'RISK_APPETITE_STATEMENT',
    'BOARD_MINUTES',
    'POLICY_UPDATE',
  ], { error: 'documentType must be one of: ANNUAL_COMPLIANCE_REPORT, RISK_APPETITE_STATEMENT, BOARD_MINUTES, POLICY_UPDATE' }),
  content: z.string().optional(),
  fileUrl: z.string().optional(),
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

// ─── GET /api/board/documents ────────────────────────────────────────────────

export const GET = withRBAC(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const documentType = searchParams.get('documentType');
      const status = searchParams.get('status');

      const where: Record<string, unknown> = {};
      if (documentType) where.documentType = documentType;
      if (status) where.status = status;

      const documents = await db.boardDocument.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
      });

      return NextResponse.json({ success: true, data: documents });
    } catch (error) {
      console.error('Failed to list board documents:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to list board documents' },
        { status: 500 },
      );
    }
  },
  'canAccessBoardPortal',
);

// ─── POST /api/board/documents ───────────────────────────────────────────────

export const POST = withRBAC(
  async (request: NextRequest) => {
    try {
      const ctx = getRBACContext(request);
      const body = await request.json();
      const parsed = createBoardDocumentSchema.safeParse(body);

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

      const { title, documentType, content, fileUrl } = parsed.data;

      const document = await db.boardDocument.create({
        data: {
          title,
          documentType,
          content: content ?? null,
          fileUrl: fileUrl ?? null,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          publishedBy: ctx.userId,
          watermarkEnabled: true,
        },
      });

      // Audit log with SHA-256
      const hashPayload = JSON.stringify({
        action: 'CREATE_BOARD_DOCUMENT',
        documentId: document.id,
        documentType,
        userId: ctx.userId,
        timestamp: new Date().toISOString(),
      });
      const sha256Hash = createHash('sha256').update(hashPayload).digest('hex');

      await createAuditLog({
        userId: ctx.userId,
        action: 'CREATE_BOARD_DOCUMENT',
        resourceType: 'BoardDocument',
        resourceId: document.id,
        details: `Created board document "${title}" of type ${documentType}`,
        ipAddress: ctx.ipAddress,
      });

      return NextResponse.json({
        success: true,
        data: { ...document, _auditHash: sha256Hash },
      }, { status: 201 });
    } catch (error) {
      console.error('Failed to create board document:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create board document' },
        { status: 500 },
      );
    }
  },
  'canAccessBoardPortal',
);
