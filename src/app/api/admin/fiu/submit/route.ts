/**
 * Generic FIU Submission — Multi-Jurisdictional Adapter-Based Filing
 *
 * Submits a filing to the jurisdiction's FIU via the adapter factory.
 * Only MLRO and admin can submit (PRINCIPLE F: Maker-Checker enforcement).
 *
 * Flow:
 *   1. Verify filing exists and is APPROVED (Maker-Checker completed)
 *   2. Get the jurisdiction-specific adapter via getFIUAdapter()
 *   3. Build SARPayload from the DB record
 *   4. Generate the filing string via adapter.generateFiling()
 *   5. Validate the format via adapter.validateFormat()
 *   6. Submit via adapter.submit()
 *   7. Update the GoAMLFiling record with submission result
 *   8. Audit log the submission
 *   9. If manual_fallback, create a ComplianceAlert with severity 'critical'
 *
 * PRINCIPLE A: Filing accuracy is criminal liability.
 * PRINCIPLE E: Mandatory manual fallback on electronic submission failure.
 * PRINCIPLE F: ONLY MLRO can submit — Maker-Checker enforcement.
 *
 * Phase 4 (Action 4.1): Generic FIU submission.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { createAuditLog } from '@/lib/audit';
import { getFIUAdapter } from '@/lib/fiu/adapter-factory';
import type { SARPayload } from '@/lib/fiu/types';
import { getRegulatoryThresholds } from '@/lib/regulatory/thresholds';
import { z } from 'zod';
import crypto from 'crypto';

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const submitFilingSchema = z.object({
  filingId: z.string().min(1, 'Filing ID is required'),
});

// ─── POST /api/fiu/submit ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── 1. Authenticate — ONLY MLRO and admin can submit (PRINCIPLE F) ───────
    const auth = await authGuard({
      allowedRoles: ['admin', 'mlro'],
    });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'SENSITIVE');
    if (rateLimitError) return rateLimitError;

    // ── 2. Parse & validate body ─────────────────────────────────────────────
    const body = await request.json();
    const parsed = submitFilingSchema.safeParse(body);

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
        { status: 400 },
      );
    }

    const { filingId } = parsed.data;

    // ── 3. Fetch the filing from DB ──────────────────────────────────────────
    const filing = await db.goAMLFiling.findUnique({ where: { id: filingId } });

    if (!filing) {
      return NextResponse.json(
        { success: false, error: 'FIU filing not found' },
        { status: 404 },
      );
    }

    // ── 4. Verify filingStatus is APPROVED (Maker-Checker enforcement) ───────
    if (filing.filingStatus !== 'APPROVED') {
      return NextResponse.json(
        {
          success: false,
          error: `Filing is in "${filing.filingStatus}" status. Only APPROVED filings can be submitted to FIU (PRINCIPLE F: Maker-Checker enforcement).`,
          violation: 'MAKER_CHECKER_NOT_COMPLETED',
          currentStatus: filing.filingStatus,
          requiredStatus: 'APPROVED',
        },
        { status: 409 },
      );
    }

    // ── 5. Get the jurisdiction-specific adapter ─────────────────────────────
    const jurisdiction = filing.jurisdiction as 'AE' | 'SA' | 'BH' | 'QA' | 'OM' | 'KW';
    const adapter = await getFIUAdapter(jurisdiction);
    const thresholds = getRegulatoryThresholds(jurisdiction);

    // ── 6. Build SARPayload from DB record ───────────────────────────────────
    const sessionUser = auth.session?.user as Record<string, unknown> | undefined;
    const userId = (sessionUser?.id as string) || (sessionUser?.userId as string) || 'system';
    const userName = (sessionUser?.name as string) || 'System';

    const payload: SARPayload = {
      filingId: filing.id,
      jurisdiction,
      regulator: adapter.regulator,
      fiuName: adapter.fiuName,
      detectionDate: filing.createdAt,
      filingDeadline: adapter.calculateDeadline(filing.createdAt),
      customerId: filing.id, // Using filing ID as customer reference
      customerName: filing.subjectName,
      customerType: 'individual', // Default, can be enhanced
      nationalId: undefined,
      suspiciousActivityDescription: `FIU filing ${filing.referenceNumber}`,
      suspiciousActivityType: [filing.reportType],
      transactionAmount: filing.amountAED ?? undefined,
      transactionCurrency: adapter.currency,
      mlroName: userName,
      mlroDecision: 'file_sar',
    };

    // ── 7. Generate the filing string via adapter ────────────────────────────
    let filingString: string;
    try {
      filingString = await adapter.generateFiling(payload);
    } catch (genError) {
      const errorMessage = genError instanceof Error ? genError.message : 'Unknown error';
      console.error('[FIU_SUBMIT] Filing generation failed:', errorMessage);

      // Audit the generation failure
      await createAuditLog({
        userId,
        action: 'FIU_FILING_GENERATION_FAILED',
        resourceType: 'GoAMLFiling',
        resourceId: filingId,
        details: JSON.stringify({
          jurisdiction,
          referenceNumber: filing.referenceNumber,
          error: errorMessage,
        }),
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
      });

      return NextResponse.json(
        {
          success: false,
          error: `Filing generation failed for ${adapter.regulator}: ${errorMessage}`,
        },
        { status: 500 },
      );
    }

    // ── 8. Validate the generated format ─────────────────────────────────────
    const formatValidation = await adapter.validateFormat(filingString);

    if (!formatValidation.valid) {
      // Audit the validation failure
      await createAuditLog({
        userId,
        action: 'FIU_FILING_FORMAT_VALIDATION_FAILED',
        resourceType: 'GoAMLFiling',
        resourceId: filingId,
        details: JSON.stringify({
          jurisdiction,
          referenceNumber: filing.referenceNumber,
          errors: formatValidation.errors.map(e => ({ field: e.field, message: e.message })),
        }),
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
      });

      return NextResponse.json(
        {
          success: false,
          error: `Filing format validation failed for ${adapter.regulator}. Fix errors before resubmitting.`,
          violation: 'FORMAT_VALIDATION_FAILED',
          validationErrors: formatValidation.errors,
          validationWarnings: formatValidation.warnings,
          regulatoryRef: thresholds.primaryRegulations[0],
        },
        { status: 422 },
      );
    }

    // ── 9. Submit to FIU via adapter ─────────────────────────────────────────
    let submissionResult;
    try {
      submissionResult = await adapter.submit(filingString, filingId);
    } catch (submitError) {
      const errorMessage = submitError instanceof Error ? submitError.message : 'Unknown error';
      console.error('[FIU_SUBMIT] FIU submission failed:', errorMessage);

      // PRINCIPLE E: Mandatory manual fallback on failure
      await handleManualFallback(filing, jurisdiction, userId, errorMessage, request);

      return NextResponse.json(
        {
          success: false,
          error: `FIU submission failed for ${adapter.regulator}: ${errorMessage}`,
          fallbackInitiated: true,
          regulatoryRef: thresholds.primaryRegulations[0],
        },
        { status: 502 },
      );
    }

    // ── 10. Update the GoAMLFiling record with submission result ─────────────
    const newStatus = submissionResult.status === 'manual_fallback'
      ? 'MANUAL_FALLBACK'
      : submissionResult.mode === 'direct_api' || submissionResult.mode === 'rpa_simulation'
        ? 'SUBMITTED_TO_FIU'
        : 'MANUAL_FALLBACK';

    await db.goAMLFiling.update({
      where: { id: filingId },
      data: {
        filingStatus: newStatus,
        xmlPayload: filingString,
        fiuAcknowledgementId: submissionResult.fiuReceiptNumber,
        submittedAt: new Date(),
      },
    });

    // ── 11. Compute integrity hash for the submission ────────────────────────
    const integrityHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ filingId, filingString, submittedAt: new Date().toISOString() }))
      .digest('hex');

    // ── 12. Audit log the submission ─────────────────────────────────────────
    await createAuditLog({
      userId,
      action: 'FIU_FILING_SUBMITTED',
      resourceType: 'GoAMLFiling',
      resourceId: filingId,
      details: JSON.stringify({
        jurisdiction,
        referenceNumber: filing.referenceNumber,
        regulator: adapter.regulator,
        submissionMode: submissionResult.mode,
        submissionId: submissionResult.submissionId,
        fiuReceiptNumber: submissionResult.fiuReceiptNumber,
        integrityHash,
        newStatus,
      }),
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    // ── 13. Handle manual fallback (PRINCIPLE E) ─────────────────────────────
    if (submissionResult.status === 'manual_fallback' || newStatus === 'MANUAL_FALLBACK') {
      await createComplianceAlert(filing, jurisdiction, submissionResult.errorMessage || 'FIU submission returned manual_fallback status');
    }

    // ── 14. Return result ────────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      data: {
        filingId,
        submissionId: submissionResult.submissionId,
        fiuReceiptNumber: submissionResult.fiuReceiptNumber,
        submittedAt: submissionResult.submittedAt,
        status: newStatus,
        mode: submissionResult.mode,
        integrityHash,
        jurisdiction,
        regulator: adapter.regulator,
      },
      warnings: formatValidation.warnings,
      message: newStatus === 'MANUAL_FALLBACK'
        ? `Filing submitted with MANUAL_FALLBACK status. A compliance alert has been created. Follow manual submission procedures for ${adapter.regulator}.`
        : `Filing successfully submitted to ${adapter.fiuName} via ${submissionResult.mode}. Receipt: ${submissionResult.fiuReceiptNumber || 'pending'}`,
    });
  } catch (error) {
    console.error('[FIU_SUBMIT] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit FIU filing' },
      { status: 500 },
    );
  }
}

// ─── Helper: Handle manual fallback (PRINCIPLE E) ─────────────────────────────

async function handleManualFallback(
  filing: { id: string; referenceNumber: string; jurisdiction: string },
  jurisdiction: string,
  userId: string,
  reason: string,
  request: NextRequest,
) {
  // Create a critical compliance alert
  await createComplianceAlert(filing, jurisdiction, reason);

  // Audit the fallback initiation
  await createAuditLog({
    userId,
    action: 'FIU_MANUAL_FALLBACK_INITIATED',
    resourceType: 'GoAMLFiling',
    resourceId: filing.id,
    details: JSON.stringify({
      jurisdiction,
      referenceNumber: filing.referenceNumber,
      reason,
      principle: 'PRINCIPLE_E: Mandatory manual fallback on electronic submission failure',
    }),
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  });
}

// ─── Helper: Create ComplianceAlert for manual fallback ────────────────────────

async function createComplianceAlert(
  filing: { id: string; referenceNumber: string; jurisdiction: string },
  jurisdiction: string,
  reason: string,
) {
  const thresholds = getRegulatoryThresholds(jurisdiction);

  await db.complianceAlert.create({
    data: {
      alertType: 'MLRO_ESCALATION',
      severity: 'critical',
      status: 'active',
      title: `FIU Manual Fallback Required — ${filing.referenceNumber}`,
      description: `Electronic submission to ${thresholds.fiuName} failed. Manual submission required per PRINCIPLE E. Reason: ${reason}. Filing must be submitted manually before the deadline to avoid regulatory breach.`,
      sourceModule: 'FIU_FILING',
      sourceEntityId: filing.id,
      sourceEntityType: 'GoAMLFiling',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours to complete manual submission
      isImmutable: true,
    },
  });
}
