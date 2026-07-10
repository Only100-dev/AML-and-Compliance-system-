/**
 * Complaint Detail API — CBUAE Notice 3551/2021; FDL 10/2025 Art. 13
 *
 * GET /api/complaints/[id] — Fetch a single complaint, hydrating the
 *                             communication log + transition history from the
 *                             tamper-evident audit trail.
 *
 * Communications are stored as AuditLog entries (PII-sanitized at rest by the
 * audit logger) rather than a dedicated CommunicationLog table. This keeps the
 * schema frozen, integrates communications into the SHA-256 hash chain, and
 * ensures no raw PII from customer correspondence persists in the DB.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRBAC } from '@/lib/compliance/rbac';

// ─── GET /api/complaints/[id] ────────────────────────────────────────────────

export const GET = withRBAC(
  async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> },
  ) => {
    try {
      const params = context ? await context.params : {};
      const { id } = params;

      const complaint = await db.complaint.findUnique({ where: { id } });
      if (!complaint) {
        return NextResponse.json(
          { success: false, error: 'Complaint not found' },
          { status: 404 },
        );
      }

      // Hydrate the communication log from the audit trail. Communications are
      // logged with action 'COMPLAINT_COMMUNICATION' and resourceId = complaint
      // id. Ordered oldest-first for natural chronological reading.
      const communicationLogs = await db.auditLog.findMany({
        where: {
          resource: 'Complaint',
          resourceId: id,
          action: 'COMPLAINT_COMMUNICATION',
        },
        orderBy: { createdAt: 'asc' },
      });

      // Also hydrate the state-transition history for the detail view.
      const transitionHistory = await db.auditLog.findMany({
        where: {
          resource: 'Complaint',
          resourceId: id,
          action: 'TRANSITION_COMPLAINT',
        },
        orderBy: { createdAt: 'asc' },
      });

      return NextResponse.json({
        success: true,
        data: {
          ...complaint,
          communications: communicationLogs.map((log) => ({
            id: log.id,
            loggedAt: log.createdAt,
            loggedBy: log.userId,
            // details holds the sanitized summary line
            summary: log.details,
          })),
          transitionHistory: transitionHistory.map((log) => ({
            id: log.id,
            at: log.createdAt,
            by: log.userId,
            summary: log.details,
          })),
        },
      });
    } catch (error) {
      console.error('Failed to fetch complaint:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch complaint' },
        { status: 500 },
      );
    }
  },
  'canManageComplaints',
);
