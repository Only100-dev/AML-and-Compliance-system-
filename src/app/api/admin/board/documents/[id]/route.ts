/**
 * Board Document Detail API
 * CBUAE Notice 3551/2021 S3.1
 *
 * GET: Get specific board document
 * PUT: Update board document with audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRBAC } from '@/lib/compliance/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import { createHash } from 'crypto';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const updateBoardDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  documentType: z.enum([
    'ANNUAL_COMPLIANCE_REPORT',
    'RISK_APPETITE_STATEMENT',
    'BOARD_MINUTES',
    'POLICY_UPDATE',
  ]).optional(),
  content: z.string().nullable().optional(),
  fileUrl: z.string().nullable().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
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

// ─── GET /api/board/documents/[id] ──────────────────────────────────────────

export const GET = withRBAC(
  async (request: NextRequest, context?: { params: Promise<Record<string, string>> }) => {
    try {
      const params = context ? await context.params : {};
      const { id } = params;

      const document = await db.boardDocument.findUnique({ where: { id } });

      if (!document) {
        return NextResponse.json(
          { success: false, error: 'Board document not found' },
          { status: 404 },
        );
      }

      return NextResponse.json({ success: true, data: document });
    } catch (error) {
      console.error('Failed to fetch board document:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch board document' },
        { status: 500 },
      );
    }
  },
  'canAccessBoardPortal',
);

// ─── PUT /api/board/documents/[id] ──────────────────────────────────────────

export const PUT = withRBAC(
  async (request: NextRequest, context?: { params: Promise<Record<string, string>> }) => {
    try {
      const params = context ? await context.params : {};
      const { id } = params;
      const ctx = getRBACContext(request);

      const existing = await db.boardDocument.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Board document not found' },
          { status: 404 },
        );
      }

      const body = await request.json();
      const parsed = updateBoardDocumentSchema.safeParse(body);

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

      const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
      if (parsed.data.status === 'PUBLISHED' && !existing.publishedAt) {
        updateData.publishedAt = new Date();
        updateData.publishedBy = ctx.userId;
      }

      const document = await db.boardDocument.update({
        where: { id },
        data: updateData,
      });

      // Audit log with SHA-256
      const hashPayload = JSON.stringify({
        action: 'UPDATE_BOARD_DOCUMENT',
        documentId: id,
        changes: parsed.data,
        userId: ctx.userId,
        timestamp: new Date().toISOString(),
      });
      const sha256Hash = createHash('sha256').update(hashPayload).digest('hex');

      await createAuditLog({
        userId: ctx.userId,
        action: 'UPDATE_BOARD_DOCUMENT',
        resourceType: 'BoardDocument',
        resourceId: id,
        details: `Updated board document "${existing.title}"`,
        changes: parsed.data as Record<string, unknown>,
        ipAddress: ctx.ipAddress,
      });

      return NextResponse.json({
        success: true,
        data: { ...document, _auditHash: sha256Hash },
      });
    } catch (error) {
      console.error('Failed to update board document:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update board document' },
        { status: 500 },
      );
    }
  },
  'canAccessBoardPortal',
);
