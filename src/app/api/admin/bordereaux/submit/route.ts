import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { BordereauxSubmitSchema } from '@/lib/validations/bordereaux';
import crypto from 'crypto';

// ─── POST /api/bordereaux/submit ────────────────────────────────────────────
// Marks a validated bordereaux submission as "submitted" to CBUAE
// Only works if 100% validation passed (status = "validated")

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard({
      allowedRoles: ['admin', 'mlro', 'compliance_manager'],
    });
    if (!auth.authorized) {
      return (
        auth.error ??
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;

    const userId =
      (auth.session?.user as Record<string, unknown>)?.userId as string ||
      (auth.session?.user as Record<string, unknown>)?.id as string ||
      'unknown';

    const body = await request.json();
    const parsed = BordereauxSubmitSchema.safeParse(body);

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
        { status: 400 }
      );
    }

    const { submissionId } = parsed.data;

    // Fetch the submission
    const submission = await db.bordereauxSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      return NextResponse.json(
        { success: false, error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Only allow submission if 100% validation passed
    if (submission.status !== 'validated') {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot submit: submission status is "${submission.status}". Only "validated" submissions can be submitted to CBUAE.`,
          currentStatus: submission.status,
          errorCount: submission.errorCount,
        },
        { status: 400 }
      );
    }

    // Update submission status
    const updated = await db.bordereauxSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'submitted',
        submittedAt: new Date(),
      },
    });

    // SHA-256 Audit Log
    const sha256Hash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          action: 'BORDEREAUX_SUBMITTED',
          submissionId,
          timestamp: Date.now(),
        })
      )
      .digest('hex');

    await db.auditLog.create({
      data: {
        userId,
        action: 'BORDEREAUX_SUBMITTED',
        resource: 'BordereauxSubmission',
        resourceId: submissionId,
        details: JSON.stringify({
          fileName: submission.fileName,
          quarter: submission.quarter,
          brokerId: submission.brokerId,
          recordCount: submission.recordCount,
          submittedAt: updated.submittedAt,
        }),
        sha256Hash,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        submissionId: updated.id,
        status: updated.status,
        submittedAt: updated.submittedAt,
        fileName: updated.fileName,
        recordCount: updated.recordCount,
        quarter: updated.quarter,
      },
    });
  } catch (error) {
    console.error('Bordereaux submission failed:', error);
    return NextResponse.json(
      { success: false, error: 'Bordereaux submission failed' },
      { status: 500 }
    );
  }
}
