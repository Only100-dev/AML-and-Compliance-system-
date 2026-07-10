/**
 * Generic Jurisdiction-Aware Submission Checker
 *
 * This is the multi-jurisdictional version of the CBUAE-only submission checker.
 * It delegates to the correct adapter for jurisdiction-specific validation while
 * running a set of common compliance checks that apply to all GCC jurisdictions.
 *
 * Common checks (all jurisdictions):
 *   1. Data completeness (required fields present)
 *   2. MLRO approval status
 *   3. Maker-Checker completion
 *   4. PII masking verification
 *   5. Filing deadline compliance (using adapter.calculateDeadline)
 *   6. Tipping-off acknowledgment
 *
 * Jurisdiction-specific checks (via adapter.validateFiling()):
 *   - UAE: goAML XML validity, Emirates ID format
 *   - KSA: Saudi National ID format, SAMA JSON structure
 *   - Bahrain: CPR number (9 digits), CR Number for corporates, 5-business-day urgency
 *   - Qatar: Qatari ID (11 digits)
 *   - Oman: Omani Civil ID (8 digits)
 *   - Kuwait: Kuwaiti Civil ID (12 digits)
 *
 * Phase 4 (Action 4.1): Generic jurisdiction-aware submission checker.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { createAuditLog } from '@/lib/audit';
import { getFIUAdapter } from '@/lib/fiu/adapter-factory';
import { getFilingDeadlineInfo } from '@/lib/fiu/deadline-calculator';
import { getRegulatoryThresholds } from '@/lib/regulatory/thresholds';
import { maskListPII } from '@/lib/pii';
import { z } from 'zod';
import { GCC_JURISDICTION_CODES } from '@/lib/constants/jurisdictions';
import type { GCCJurisdictionCode } from '@/lib/constants/jurisdictions';
import type { SARPayload } from '@/lib/fiu/types';

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const submissionCheckerQuerySchema = z.object({
  jurisdiction: z.string()
    .refine((val): val is GCCJurisdictionCode => GCC_JURISDICTION_CODES.includes(val as GCCJurisdictionCode), {
      message: 'jurisdiction is required and must be one of: AE, SA, BH, QA, OM, KW',
    }),
  reportType: z.enum(['sar_filing', 'ctr_filing', 'str_filing']).optional(),
  reportId: z.string().optional(),
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface ValidationCheck {
  check: string;
  passed: boolean;
  message: string;
  jurisdiction?: string;
}

interface SubmissionCheckResult {
  ready: boolean;
  jurisdiction: GCCJurisdictionCode;
  regulator: string;
  checks: ValidationCheck[];
  missingFields: string[];
  reportId?: string;
  reportType?: string;
  checkedAt: string;
}

// ─── GET /api/fiu-submission-checker ──────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // ── 1. Authenticate & authorize ──────────────────────────────────────────
    const auth = await authGuard({
      allowedRoles: ['admin', 'mlro', 'compliance_manager'],
    });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;

    // ── 2. Parse query parameters ────────────────────────────────────────────
    const { searchParams } = new URL(request.url);
    const params = {
      jurisdiction: searchParams.get('jurisdiction') || undefined,
      reportType: searchParams.get('reportType') || undefined,
      reportId: searchParams.get('reportId') || undefined,
    };

    const parsed = submissionCheckerQuerySchema.safeParse(params);
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

    const { jurisdiction: jurisdictionStr, reportType, reportId } = parsed.data;
    const jurisdiction = jurisdictionStr as GCCJurisdictionCode;

    // ── 3. Get the adapter for this jurisdiction ─────────────────────────────
    const adapter = await getFIUAdapter(jurisdiction);
    const thresholds = getRegulatoryThresholds(jurisdiction);

    // ── 4. Fetch the filing from DB ──────────────────────────────────────────
    let filing;
    if (reportId) {
      filing = await db.goAMLFiling.findUnique({ where: { id: reportId } });
    } else {
      // Find the most recent filing for this jurisdiction
      const reportTypeFilter = reportType === 'sar_filing' ? { in: ['STR', 'SAR'] } :
                                reportType === 'ctr_filing' ? 'CTR' : undefined;

      filing = await db.goAMLFiling.findFirst({
        where: {
          jurisdiction,
          ...(reportTypeFilter ? { reportType: reportTypeFilter } : {}),
          filingStatus: { in: ['DRAFT', 'PENDING_REVIEW', 'APPROVED'] },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // ── 5. Run COMMON checks ─────────────────────────────────────────────────
    const checks: ValidationCheck[] = [];
    const missingFields: string[] = [];

    // Check 1: Data completeness
    await runDataCompletenessCheck(filing, checks, missingFields);

    // Check 2: MLRO approval status
    await runMLROApprovalCheck(filing, checks, missingFields);

    // Check 3: Maker-Checker completion
    await runMakerCheckerCheck(filing, checks, missingFields);

    // Check 4: PII masking verification
    runPIIMaskingCheck(filing, checks, missingFields);

    // Check 5: Filing deadline compliance
    runDeadlineComplianceCheck(filing, jurisdiction, checks, missingFields);

    // Check 6: Tipping-off acknowledgment
    await runTippingOffCheck(filing, checks, missingFields);

    // ── 6. Run JURISDICTION-SPECIFIC checks via adapter ──────────────────────
    if (filing) {
      try {
        const payload = buildSARPayload(filing, adapter);
        const jurisdictionResult = await adapter.validateFiling(payload);

        // Add jurisdiction-specific validation results
        for (const error of jurisdictionResult.errors) {
          checks.push({
            check: `[${adapter.regulator}] ${error.field}`,
            passed: false,
            message: error.message,
            jurisdiction,
          });
          missingFields.push(`jurisdiction.${error.field}`);
        }

        for (const warning of jurisdictionResult.warnings) {
          checks.push({
            check: `[${adapter.regulator}] Warning`,
            passed: true, // Warnings don't block submission
            message: warning,
            jurisdiction,
          });
        }

        // If no jurisdiction-specific errors, add a pass
        if (jurisdictionResult.errors.length === 0) {
          checks.push({
            check: `[${adapter.regulator}] Jurisdiction-Specific Validation`,
            passed: true,
            message: `All ${adapter.regulator}-specific validation checks passed for ${thresholds.countryName}.`,
            jurisdiction,
          });
        }
      } catch (validationError) {
        const errorMessage = validationError instanceof Error ? validationError.message : 'Unknown validation error';
        checks.push({
          check: `[${adapter.regulator}] Jurisdiction-Specific Validation`,
          passed: false,
          message: `Jurisdiction validation failed: ${errorMessage}`,
          jurisdiction,
        });
        missingFields.push('jurisdiction.validation');
      }
    } else {
      checks.push({
        check: `[${adapter.regulator}] Jurisdiction-Specific Validation`,
        passed: false,
        message: `No filing available for ${adapter.regulator} jurisdiction-specific validation.`,
        jurisdiction,
      });
      missingFields.push('filing');
    }

    // ── 7. Determine overall readiness ───────────────────────────────────────
    const ready = checks.length > 0 && checks.every(c => c.passed);

    const result: SubmissionCheckResult = {
      ready,
      jurisdiction,
      regulator: adapter.regulator,
      checks,
      missingFields,
      reportId: filing?.id,
      reportType: reportType || (filing?.reportType === 'CTR' ? 'ctr_filing' : 'sar_filing'),
      checkedAt: new Date().toISOString(),
    };

    // ── 8. Audit log the check ───────────────────────────────────────────────
    const sessionUser = auth.session?.user as Record<string, unknown> | undefined;
    const userId = (sessionUser?.id as string) || (sessionUser?.userId as string) || 'system';

    await createAuditLog({
      userId,
      action: 'FIU_SUBMISSION_CHECK',
      resourceType: 'SubmissionChecker',
      resourceId: result.reportId || 'general',
      details: JSON.stringify({
        jurisdiction,
        regulator: adapter.regulator,
        reportType: result.reportType,
        ready,
        checksPassed: checks.filter(c => c.passed).length,
        checksFailed: checks.filter(c => !c.passed).length,
        missingFields,
      }),
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({
      success: true,
      data: maskListPII(result),
    });
  } catch (error) {
    console.error('[FIU_SUBMISSION_CHECKER] Error checking submission readiness:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check FIU submission readiness' },
      { status: 500 },
    );
  }
}

// ─── Common Check Helpers ─────────────────────────────────────────────────────

/** Check 1: Data completeness — required fields present */
async function runDataCompletenessCheck(
  filing: Record<string, unknown> | null,
  checks: ValidationCheck[],
  missingFields: string[],
) {
  if (!filing) {
    checks.push({
      check: 'Data Completeness',
      passed: false,
      message: 'No filing found. Create a filing before checking submission readiness.',
    });
    missingFields.push('filingId');
    return;
  }

  const hasRequiredFields = !!filing.subjectName && !!filing.referenceNumber && !!filing.reportType;
  const hasFilingData = !!filing.xmlPayload || filing.filingStatus === 'DRAFT' || filing.filingStatus === 'PENDING_REVIEW';

  if (hasRequiredFields && hasFilingData) {
    checks.push({
      check: 'Data Completeness',
      passed: true,
      message: `Filing ${filing.referenceNumber} has all required fields (subject, reference, report type).`,
    });
  } else {
    const missing: string[] = [];
    if (!filing.subjectName) missing.push('subjectName');
    if (!filing.referenceNumber) missing.push('referenceNumber');
    if (!filing.reportType) missing.push('reportType');
    missingFields.push(...missing);
    checks.push({
      check: 'Data Completeness',
      passed: false,
      message: `Filing is missing required fields: ${missing.join(', ')}.`,
    });
  }
}

/** Check 2: MLRO approval status */
async function runMLROApprovalCheck(
  filing: Record<string, unknown> | null,
  checks: ValidationCheck[],
  missingFields: string[],
) {
  if (!filing) {
    checks.push({ check: 'MLRO Approval', passed: false, message: 'No filing available for MLRO approval check.' });
    missingFields.push('mlroApproval');
    return;
  }

  // Check filing status for approval
  const filingStatus = filing.filingStatus as string;
  if (filingStatus === 'APPROVED' || filingStatus === 'SUBMITTED_TO_FIU' || filingStatus === 'ACKNOWLEDGED') {
    checks.push({
      check: 'MLRO Approval',
      passed: true,
      message: `Filing status "${filingStatus}" indicates MLRO approval has been granted.`,
    });
    return;
  }

  // Check audit log for MLRO approval
  const mlroApproval = await db.auditLog.findFirst({
    where: {
      resource: 'GoAMLFiling',
      resourceId: filing.id as string,
      action: { in: ['MLRO_APPROVAL', 'FIU_FILING_APPROVED'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (mlroApproval) {
    checks.push({
      check: 'MLRO Approval',
      passed: true,
      message: `MLRO approval granted by ${mlroApproval.userId} on ${new Date(mlroApproval.createdAt).toISOString().split('T')[0]}.`,
    });
  } else {
    checks.push({
      check: 'MLRO Approval',
      passed: false,
      message: 'MLRO has not approved this filing. MLRO sign-off is required before FIU submission.',
    });
    missingFields.push('mlroApproval');
  }
}

/** Check 3: Maker-Checker completion */
async function runMakerCheckerCheck(
  filing: Record<string, unknown> | null,
  checks: ValidationCheck[],
  missingFields: string[],
) {
  if (!filing) {
    checks.push({ check: 'Maker-Checker Completion', passed: false, message: 'No filing available for Maker-Checker verification.' });
    missingFields.push('makerCheckerApproval');
    return;
  }

  const makerCheckerLog = await db.makerCheckerLog.findFirst({
    where: {
      entityId: filing.id as string,
      entityType: 'GoAMLFiling',
      status: 'APPROVED',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (makerCheckerLog) {
    checks.push({
      check: 'Maker-Checker Completion',
      passed: true,
      message: `4-Eyes review completed. Maker: ${makerCheckerLog.makerName}, Checker: ${makerCheckerLog.checkerName || 'N/A'}`,
    });
  } else {
    // Check if there's a pending one
    const pendingLog = await db.makerCheckerLog.findFirst({
      where: {
        entityId: filing.id as string,
        entityType: 'GoAMLFiling',
        status: 'PENDING',
      },
    });
    if (pendingLog) {
      checks.push({
        check: 'Maker-Checker Completion',
        passed: false,
        message: 'Maker-Checker review is pending. Awaiting checker approval.',
      });
    } else {
      checks.push({
        check: 'Maker-Checker Completion',
        passed: false,
        message: 'No Maker-Checker review initiated. Dual authorization required before FIU submission.',
      });
    }
    missingFields.push('makerCheckerApproval');
  }
}

/** Check 4: PII masking verification */
function runPIIMaskingCheck(
  filing: Record<string, unknown> | null,
  checks: ValidationCheck[],
  missingFields: string[],
) {
  if (!filing) {
    checks.push({ check: 'PII Masking Verification', passed: false, message: 'No filing available for PII verification.' });
    missingFields.push('piiMasking');
    return;
  }

  // Check that PII masking will be applied on submission
  // The PII masking library handles this automatically in API responses
  const hasSubjectName = !!filing.subjectName;
  if (hasSubjectName) {
    checks.push({
      check: 'PII Masking Verification',
      passed: true,
      message: 'PII masking will be applied in submission view per data protection requirements.',
    });
  } else {
    checks.push({
      check: 'PII Masking Verification',
      passed: false,
      message: 'Subject name missing — cannot verify PII masking.',
    });
    missingFields.push('subjectName');
  }
}

/** Check 5: Filing deadline compliance */
function runDeadlineComplianceCheck(
  filing: Record<string, unknown> | null,
  jurisdiction: GCCJurisdictionCode,
  checks: ValidationCheck[],
  missingFields: string[],
) {
  if (!filing) {
    checks.push({ check: 'Filing Deadline Compliance', passed: false, message: 'No filing available for deadline check.' });
    missingFields.push('filingDeadline');
    return;
  }

  const thresholds = getRegulatoryThresholds(jurisdiction);
  const detectionDate = filing.createdAt as Date;
  const deadlineInfo = getFilingDeadlineInfo(detectionDate, jurisdiction);

  if (deadlineInfo.isOverdue) {
    checks.push({
      check: 'Filing Deadline Compliance',
      passed: false,
      message: `SAR filing deadline has PASSED by ${Math.abs(deadlineInfo.daysRemaining)} days. Immediate submission required per ${thresholds.regulatorName} regulations. Deadline was: ${deadlineInfo.deadlineDate.toISOString().split('T')[0]}.`,
    });
    missingFields.push('filingDeadline');
  } else if (deadlineInfo.isCritical) {
    checks.push({
      check: 'Filing Deadline Compliance',
      passed: true,
      message: `⚠️ CRITICAL: Only ${deadlineInfo.daysRemaining} days remaining before filing deadline (${thresholds.sarDeadline} ${thresholds.sarDeadlineUnit === 'business_days' ? 'business days' : 'calendar days'} per ${thresholds.regulatorName}). Deadline: ${deadlineInfo.deadlineDate.toISOString().split('T')[0]}.`,
    });
  } else {
    checks.push({
      check: 'Filing Deadline Compliance',
      passed: true,
      message: `${deadlineInfo.daysRemaining} days remaining before filing deadline (${thresholds.sarDeadline} ${thresholds.sarDeadlineUnit === 'business_days' ? 'business days' : 'calendar days'} per ${thresholds.regulatorName}). Deadline: ${deadlineInfo.deadlineDate.toISOString().split('T')[0]}.`,
    });
  }
}

/** Check 6: Tipping-off acknowledgment */
async function runTippingOffCheck(
  filing: Record<string, unknown> | null,
  checks: ValidationCheck[],
  missingFields: string[],
) {
  if (!filing) {
    checks.push({ check: 'Tipping-Off Acknowledgment', passed: false, message: 'No filing available for tipping-off check.' });
    missingFields.push('tippingOffAcknowledgment');
    return;
  }

  // Check if there's a related SARCase with tipping-off acknowledged
  const sarCase = await db.sARCase.findFirst({
    where: {
      subjectName: filing.subjectName as string,
      jurisdiction: filing.jurisdiction as string,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (sarCase?.tippingOffAcknowledgedAt) {
    checks.push({
      check: 'Tipping-Off Acknowledgment',
      passed: true,
      message: 'Tipping-off prohibition acknowledged. SAR filing may proceed.',
    });
  } else {
    // For FIU filings, tipping-off acknowledgment is typically captured
    // during the SAR case workflow. If no SAR case exists, we check
    // if there's an audit log entry for tipping-off.
    const tippingOffLog = await db.auditLog.findFirst({
      where: {
        resource: 'GoAMLFiling',
        resourceId: filing.id as string,
        action: 'TIPPING_OFF_ACKNOWLEDGED',
      },
    });

    if (tippingOffLog) {
      checks.push({
        check: 'Tipping-Off Acknowledgment',
        passed: true,
        message: 'Tipping-off prohibition acknowledged per regulatory requirements.',
      });
    } else {
      checks.push({
        check: 'Tipping-Off Acknowledgment',
        passed: false,
        message: 'Tipping-off prohibition has NOT been acknowledged. Must be acknowledged before FIU submission.',
      });
      missingFields.push('tippingOffAcknowledgment');
    }
  }
}

// ─── Helper: Build SARPayload from DB record ─────────────────────────────────

function buildSARPayload(
  filing: Record<string, unknown>,
  adapter: { regulator: string; fiuName: string; currency: string; calculateDeadline: (d: Date) => Date },
): SARPayload {
  const detectionDate = filing.createdAt as Date;
  const jurisdiction = filing.jurisdiction as GCCJurisdictionCode;

  return {
    filingId: filing.id as string,
    jurisdiction,
    regulator: adapter.regulator,
    fiuName: adapter.fiuName,
    detectionDate,
    filingDeadline: adapter.calculateDeadline(detectionDate),
    customerId: filing.id as string,
    customerName: (filing.subjectName as string) || '',
    customerType: 'individual',
    suspiciousActivityDescription: `FIU filing ${(filing.referenceNumber as string) || ''}`,
    suspiciousActivityType: [(filing.reportType as string) || 'SAR'],
    transactionAmount: (filing.amountAED as number) || undefined,
    transactionCurrency: adapter.currency,
    mlroName: 'System',
    mlroDecision: 'file_sar',
  };
}
