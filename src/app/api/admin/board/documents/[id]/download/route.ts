/**
 * Board Document Download API
 * CBUAE Notice 3551/2021 S3.1 + Section 10.7
 *
 * Section 10.7 Mandate: Board Members are strictly view-only. They may NOT
 * download board documents under any circumstance. This endpoint enforces
 * that mandate at the API boundary — a 403 Forbidden is returned whenever
 * the requester's role is `board`.
 *
 * For non-board roles (admin / mlro / compliance_manager / compliance_officer /
 * dept_head), file storage is not yet backed by a real blob store in this
 * environment; the endpoint therefore returns a 404 stub indicating that
 * download is not yet wired up. The 403-for-board guard is the critical
 * compliance requirement and is fully enforced here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRBAC } from '@/lib/compliance/rbac';
import { createAuditLog } from '@/lib/audit';

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

// ─── GET /api/board/documents/[id]/download ─────────────────────────────────

export const GET = withRBAC(
  async (request: NextRequest, context?: { params: Promise<Record<string, string>> }) => {
    try {
      const params = context ? await context.params : {};
      const { id } = params;
      const ctx = getRBACContext(request);

      // ─── Section 10.7 — Board View-Only Enforcement ──────────────────────
      // Board Members ('board' role) may NEVER download a board document.
      // This is the critical compliance guard — it is checked FIRST, before
      // any database lookup, so the 403 is returned deterministically for
      // every board-member request regardless of whether the document exists.
      if (ctx.role === 'board') {
        // Audit the denied attempt for non-repudiation.
        try {
          await createAuditLog({
            userId: ctx.userId,
            action: 'DOWNLOAD_BOARD_DOCUMENT_DENIED',
            resourceType: 'BoardDocument',
            resourceId: id,
            details: 'Download denied — Board Members have view-only access (Section 10.7)',
            ipAddress: ctx.ipAddress,
          });
        } catch {
          // Audit failure must NOT mask the 403 enforcement.
        }

        return NextResponse.json(
          {
            success: false,
            error: 'Forbidden: Board Members have view-only access (Section 10.7)',
            regulatoryRef: 'Section 10.7 — Board View-Only Mandate',
          },
          { status: 403 },
        );
      }

      // For authorized non-board roles: verify the document exists. If no
      // backing blob/file is configured (the current state of this env),
      // return a 404 stub so callers know downloads are not yet wired up.
      const document = await db.boardDocument.findUnique({ where: { id } });
      if (!document) {
        return NextResponse.json(
          { success: false, error: 'Board document not found' },
          { status: 404 },
        );
      }

      if (!document.fileUrl) {
        return NextResponse.json(
          {
            success: false,
            error: 'No downloadable file is attached to this document',
          },
          { status: 404 },
        );
      }

      // If we reach here, the document has a fileUrl — return it as a
      // signed/stub redirect. Real blob storage integration is out of scope
      // for this compliance pass; the 403-for-board guard is the requirement.
      return NextResponse.json({
        success: true,
        data: { id: document.id, fileUrl: document.fileUrl },
      });
    } catch (error) {
      console.error('Failed to process board document download:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to process download request' },
        { status: 500 },
      );
    }
  },
  'canAccessBoardPortal',
);
