import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { checkPermission, type ComplianceRole } from '@/lib/compliance/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import crypto from 'crypto';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const reviewMLRSchema = z.object({
  recordId: z.string().min(1, 'Record ID is required'),
  mlrResolution: z.enum(['CONFIRMED_MLR', 'FALSE_POSITIVE', 'ESCALATED_TO_SAR'], {
    error: 'Resolution must be CONFIRMED_MLR, FALSE_POSITIVE, or ESCALATED_TO_SAR',
  }),
  reviewNotes: z.string().min(10, 'Review notes must be at least 10 characters'),
});

// ─── POST /api/early-surrender/review-mlr ────────────────────────────────────
// Review and resolve High MLR flag
// Auth: canReviewMLRFlag (MLRO/admin only)
// Maker-Checker: reviewer cannot be same as creator (4-eyes principle)
// WORM: cannot re-review if already resolved
// If ESCALATED_TO_SAR: auto-create SAR Case Draft

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard();
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (auth.session?.user as Record<string, unknown>)?.role as ComplianceRole;
    if (!checkPermission(userRole, 'canReviewMLRFlag')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Permission denied',
          message: `Role "${userRole}" does not have permission "canReviewMLRFlag". Only MLRO or admin can review MLR flags.`,
          regulatoryRef: 'CBUAE Insurance AML Guidelines; FDL 10/2025 Art. 13-14, 15',
        },
        { status: 403 }
      );
    }

    const rateLimitError = applyRateLimit(auth, request, 'SENSITIVE');
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = reviewMLRSchema.safeParse(body);
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

    // Fetch the record
    const record = await db.earlySurrenderRecord.findUnique({
      where: { id: data.recordId },
    });

    if (!record) {
      return NextResponse.json(
        { success: false, error: 'Early surrender record not found' },
        { status: 404 }
      );
    }

    // Verify MLR flag is active
    if (!record.highMLRFlag) {
      return NextResponse.json(
        { success: false, error: 'This record does not have an active MLR flag to review' },
        { status: 400 }
      );
    }

    // WORM: Cannot re-review if already resolved
    if (record.mlrResolution) {
      return NextResponse.json(
        {
          success: false,
          error: 'WORM VIOLATION: This MLR flag has already been resolved and cannot be re-reviewed.',
          currentResolution: record.mlrResolution,
          reviewedAt: record.mlrReviewedAt,
        },
        { status: 409 }
      );
    }

    // Maker-Checker: reviewer cannot be same as creator (4-eyes principle)
    if (record.createdBy && record.createdBy === userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'SECURITY VIOLATION: 4-eyes principle — reviewer cannot be the same person who created the record.',
          violation: 'MAKER_CHECKER_SAME_PERSON',
          regulatoryRef: 'FDL 10/2025 Art. 15; CBUAE Insurance AML Guidelines',
        },
        { status: 403 }
      );
    }

    // Update the record with resolution
    const updatedRecord = await db.earlySurrenderRecord.update({
      where: { id: data.recordId },
      data: {
        mlrResolution: data.mlrResolution,
        reviewNotes: data.reviewNotes,
        mlrReviewedById: userId,
        mlrReviewedAt: new Date(),
        reviewStatus: data.mlrResolution === 'ESCALATED_TO_SAR' ? 'ESCALATED' : 'APPROVED',
      },
    });

    // If ESCALATED_TO_SAR: auto-create SAR Case Draft
    let sarCase = null;
    if (data.mlrResolution === 'ESCALATED_TO_SAR') {
      const currentYear = new Date().getFullYear();
      // Count existing SAR cases this year for sequential numbering
      const sarCount = await db.sARCase.count({
        where: {
          caseNumber: { startsWith: `SAR-${currentYear}-` },
        },
      });
      const caseNumber = `SAR-${currentYear}-${String(sarCount + 1).padStart(4, '0')}`;

      const filingDeadline = new Date();
      filingDeadline.setDate(filingDeadline.getDate() + 30);

      sarCase = await db.sARCase.create({
        data: {
          caseNumber,
          triggerDate: new Date(),
          filingDeadline,
          daysRemaining: 30,
          status: 'DRAFT',
          narrative: `Auto-generated from Early Surrender MLR escalation. Policy: ${record.policyNumber}. Financial loss: ${record.financialLossPct.toFixed(1)}%. Third-party payout: ${record.isThirdPartyPayout}. Review notes: ${data.reviewNotes}`,
          subjectName: record.policyholderName,
          subjectType: 'INDIVIDUAL',
          riskLevel: 'high',
          createdById: userId,
          tippingOffWarning: true,
        },
      });
    }

    // Create notification to creator + MLRO users
    const notifications: unknown[] = [];

    // Notify creator
    if (record.createdBy) {
      const creator = await db.user.findUnique({ where: { id: record.createdBy } });
      if (creator) {
        const notif = await db.notification.create({
          data: {
            userId: creator.id,
            userName: creator.name,
            type: 'maker_checker_pending',
            title: 'MLR Flag Review Completed',
            message: `The MLR flag for policy ${record.policyNumber} has been resolved as "${data.mlrResolution}". Reviewer notes: ${data.reviewNotes}`,
            priority: data.mlrResolution === 'ESCALATED_TO_SAR' ? 'urgent' : 'high',
            sourceModule: 'early_surrender',
            sourceEntityId: record.id,
            actionUrl: `/early-surrender?id=${record.id}`,
          },
        });
        notifications.push(notif);
      }
    }

    // Notify MLRO users (if reviewer is not MLRO themselves)
    if (userRole !== 'mlro') {
      const mlroUsers = await db.user.findMany({ where: { role: 'mlro', isActive: true } });
      for (const mlro of mlroUsers) {
        const notif = await db.notification.create({
          data: {
            userId: mlro.id,
            userName: mlro.name,
            type: 'maker_checker_pending',
            title: 'MLR Flag Resolved',
            message: `The MLR flag for policy ${record.policyNumber} has been resolved as "${data.mlrResolution}" by ${userRole}.`,
            priority: 'high',
            sourceModule: 'early_surrender',
            sourceEntityId: record.id,
            actionUrl: `/early-surrender?id=${record.id}`,
          },
        });
        notifications.push(notif);
      }
    }

    // SHA-256 Audit Trail
    const hashPayload = JSON.stringify({
      action: 'MLR_FLAG_REVIEWED',
      resourceType: 'EarlySurrenderRecord',
      resourceId: data.recordId,
      userId,
      mlrResolution: data.mlrResolution,
      timestamp: new Date().toISOString(),
    });
    const sha256Hash = crypto.createHash('sha256').update(hashPayload).digest('hex');

    await createAuditLog({
      userId,
      action: 'MLR_FLAG_REVIEWED',
      resourceType: 'EarlySurrenderRecord',
      resourceId: data.recordId,
      details: `MLR flag for policy ${record.policyNumber} resolved as "${data.mlrResolution}". Notes: ${data.reviewNotes}`,
      changes: {
        mlrResolution: data.mlrResolution,
        reviewStatus: updatedRecord.reviewStatus,
        sarCaseId: sarCase?.id ?? null,
        sha256Hash,
      },
    });

    return NextResponse.json({
      success: true,
      data: { ...updatedRecord, sha256Hash },
      sarCase,
      notificationsSent: notifications.length,
      message: data.mlrResolution === 'ESCALATED_TO_SAR'
        ? `MLR flag escalated to SAR. Draft case ${sarCase?.caseNumber} created with 30-day filing deadline.`
        : `MLR flag resolved as "${data.mlrResolution}".`,
    });
  } catch (error) {
    console.error('Failed to review MLR flag:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to review MLR flag' },
      { status: 500 }
    );
  }
}
