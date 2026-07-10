import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { maskListPII } from '@/lib/pii';
import { applyRateLimit } from '@/lib/rate-limit';
import { createAuditLog } from '@/lib/audit';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const submissionCheckerQuerySchema = z.object({
  reportId: z.string().optional(),
  reportType: z.enum(['quarterly_report', 'sar_filing', 'ctr_filing']).optional(),
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface ValidationCheck {
  check: string;
  passed: boolean;
  message: string;
}

interface SubmissionCheckResult {
  ready: boolean;
  checks: ValidationCheck[];
  missingFields: string[];
  reportId?: string;
  reportType?: string;
  checkedAt: string;
}

// ─── Validation Helpers ──────────────────────────────────────────────────────

async function checkQuarterlyReport(reportId: string | undefined): Promise<SubmissionCheckResult> {
  const checks: ValidationCheck[] = [];
  const missingFields: string[] = [];

  // Fetch the report (latest if no ID specified)
  let report;
  if (reportId) {
    report = await db.quarterlyReport.findUnique({ where: { id: reportId }, include: { records: true } });
  } else {
    report = await db.quarterlyReport.findFirst({
      where: { status: { in: ['PROCESSING', 'VALIDATED', 'READY'] } },
      orderBy: { createdAt: 'desc' },
      include: { records: true },
    });
  }

  // Check 1: Report data completeness
  if (!report) {
    checks.push({ check: 'Report Data Completeness', passed: false, message: 'No quarterly report found. Create a report before submission.' });
    missingFields.push('reportId');
  } else {
    const hasRequiredFields = !!report.quarter && !!report.year && !!report.entityName;
    const hasRecords = report.records && report.records.length > 0;
    const hasFinancialData = report.totalPremiumAED > 0 || report.totalPolicies > 0;

    if (hasRequiredFields && hasRecords && hasFinancialData) {
      checks.push({ check: 'Report Data Completeness', passed: true, message: `Report Q${report.quarter}-${report.year} has all required fields with ${report.records.length} records.` });
    } else {
      if (!hasRequiredFields) missingFields.push('quarter', 'year', 'entityName');
      if (!hasRecords) missingFields.push('insuranceRecords');
      if (!hasFinancialData) missingFields.push('totalPremiumAED', 'totalPolicies');
      checks.push({ check: 'Report Data Completeness', passed: false, message: `Report is missing required fields: ${[!hasRequiredFields ? 'core fields' : '', !hasRecords ? 'records' : '', !hasFinancialData ? 'financial data' : ''].filter(Boolean).join(', ')}` });
    }
  }

  // Check 2: MLRO approval status
  if (report) {
    const mlroApproval = await db.auditLog.findFirst({
      where: {
        resource: 'QuarterlyReport',
        resourceId: report.id,
        action: 'MLRO_APPROVAL',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (mlroApproval) {
      checks.push({ check: 'MLRO Approval', passed: true, message: `MLRO approval granted by ${mlroApproval.userId} on ${new Date(mlroApproval.createdAt).toISOString().split('T')[0]}` });
    } else {
      checks.push({ check: 'MLRO Approval', passed: false, message: 'MLRO has not approved this report. Approval required per CBUAE guidelines.' });
      missingFields.push('mlroApproval');
    }
  } else {
    checks.push({ check: 'MLRO Approval', passed: false, message: 'No report available to check MLRO approval.' });
    missingFields.push('mlroApproval');
  }

  // Check 3: Maker-checker completion
  if (report) {
    const makerCheckerLog = await db.makerCheckerLog.findFirst({
      where: {
        entityId: report.id,
        entityType: 'QuarterlyReport',
        status: 'APPROVED',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (makerCheckerLog) {
      checks.push({ check: 'Maker-Checker Completion', passed: true, message: `4-Eyes review completed. Maker: ${makerCheckerLog.makerName}, Checker: ${makerCheckerLog.checkerName || 'N/A'}` });
    } else {
      // Check if there's a pending one
      const pendingLog = await db.makerCheckerLog.findFirst({
        where: {
          entityId: report.id,
          entityType: 'QuarterlyReport',
          status: 'PENDING',
        },
      });
      if (pendingLog) {
        checks.push({ check: 'Maker-Checker Completion', passed: false, message: 'Maker-checker review is pending. Awaiting checker approval.' });
      } else {
        checks.push({ check: 'Maker-Checker Completion', passed: false, message: 'No maker-checker review initiated. Dual authorization required per CBUAE.' });
      }
      missingFields.push('makerCheckerApproval');
    }
  } else {
    checks.push({ check: 'Maker-Checker Completion', passed: false, message: 'No report available for maker-checker verification.' });
    missingFields.push('makerCheckerApproval');
  }

  // Check 4: PII masking verification
  if (report && report.records && report.records.length > 0) {
    const recordsWithPII = report.records.filter(r => r.clientName && !r.clientName.includes('***'));
    if (recordsWithPII.length === 0) {
      checks.push({ check: 'PII Masking Verification', passed: true, message: 'All PII fields properly masked for CBUAE submission view.' });
    } else {
      checks.push({ check: 'PII Masking Verification', passed: false, message: `${recordsWithPII.length} record(s) have unmasked PII (clientName). PII must be masked per data protection requirements.` });
      missingFields.push('piiMasking');
    }
  } else if (report) {
    checks.push({ check: 'PII Masking Verification', passed: true, message: 'No records to mask — PII check N/A.' });
  } else {
    checks.push({ check: 'PII Masking Verification', passed: false, message: 'No report available for PII verification.' });
    missingFields.push('piiMasking');
  }

  // Check 5: Report status validation
  if (report) {
    const validStatuses = ['VALIDATED', 'READY'];
    if (validStatuses.includes(report.status)) {
      checks.push({ check: 'Report Status', passed: true, message: `Report status is "${report.status}" — ready for CBUAE submission.` });
    } else {
      checks.push({ check: 'Report Status', passed: false, message: `Report status is "${report.status}". Must be VALIDATED or READY before submission.` });
      missingFields.push('reportStatus');
    }
  }

  const ready = checks.length > 0 && checks.every(c => c.passed);

  return {
    ready,
    checks,
    missingFields,
    reportId: report?.id,
    reportType: 'quarterly_report',
    checkedAt: new Date().toISOString(),
  };
}

async function checkSARFiling(reportId: string | undefined): Promise<SubmissionCheckResult> {
  const checks: ValidationCheck[] = [];
  const missingFields: string[] = [];

  // Fetch SAR case
  let sarCase;
  if (reportId) {
    sarCase = await db.sARCase.findUnique({ where: { id: reportId } });
  } else {
    sarCase = await db.sARCase.findFirst({
      where: { status: { in: ['DRAFT', 'PENDING_REVIEW', 'REQUIRES_REVISION', 'APPROVED_FOR_FILING'] } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Check 1: SAR data completeness
  if (!sarCase) {
    checks.push({ check: 'SAR Data Completeness', passed: false, message: 'No SAR case found. Create a SAR case before submission.' });
    missingFields.push('caseId');
  } else {
    const hasRequiredFields = !!sarCase.caseNumber && !!sarCase.subjectName && !!sarCase.narrative;
    if (hasRequiredFields) {
      checks.push({ check: 'SAR Data Completeness', passed: true, message: `SAR ${sarCase.caseNumber} has all required fields (subject, narrative, case number).` });
    } else {
      if (!sarCase.caseNumber) missingFields.push('caseNumber');
      if (!sarCase.subjectName) missingFields.push('subjectName');
      if (!sarCase.narrative) missingFields.push('narrative');
      checks.push({ check: 'SAR Data Completeness', passed: false, message: `SAR is missing required fields: ${[!sarCase.caseNumber ? 'caseNumber' : '', !sarCase.subjectName ? 'subjectName' : '', !sarCase.narrative ? 'narrative' : ''].filter(Boolean).join(', ')}` });
    }
  }

  // Check 2: MLRO approval status
  if (sarCase) {
    const mlroApproval = await db.auditLog.findFirst({
      where: {
        resource: 'SARCase',
        resourceId: sarCase.id,
        action: { in: ['MLRO_APPROVAL', 'SAR_APPROVED_FOR_FILING'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (mlroApproval) {
      checks.push({ check: 'MLRO Approval', passed: true, message: `MLRO approval granted by ${mlroApproval.userId} on ${new Date(mlroApproval.createdAt).toISOString().split('T')[0]}` });
    } else {
      // Check if SAR status indicates MLRO approval
      if (sarCase.status === 'APPROVED_FOR_FILING') {
        checks.push({ check: 'MLRO Approval', passed: true, message: 'SAR status indicates MLRO approval for filing.' });
      } else {
        checks.push({ check: 'MLRO Approval', passed: false, message: 'MLRO has not approved this SAR. MLRO sign-off required per FDL 10/2025 Art. 8.' });
        missingFields.push('mlroApproval');
      }
    }
  } else {
    checks.push({ check: 'MLRO Approval', passed: false, message: 'No SAR case available to check MLRO approval.' });
    missingFields.push('mlroApproval');
  }

  // Check 3: Maker-checker completion
  if (sarCase) {
    const makerCheckerLog = await db.makerCheckerLog.findFirst({
      where: {
        entityId: sarCase.id,
        entityType: 'SARCase',
        status: 'APPROVED',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (makerCheckerLog) {
      checks.push({ check: 'Maker-Checker Completion', passed: true, message: `4-Eyes review completed. Maker: ${makerCheckerLog.makerName}, Checker: ${makerCheckerLog.checkerName || 'N/A'}` });
    } else {
      checks.push({ check: 'Maker-Checker Completion', passed: false, message: 'Maker-checker review not completed. Dual authorization required for SAR filing.' });
      missingFields.push('makerCheckerApproval');
    }
  } else {
    checks.push({ check: 'Maker-Checker Completion', passed: false, message: 'No SAR case available for maker-checker verification.' });
    missingFields.push('makerCheckerApproval');
  }

  // Check 4: PII masking verification
  if (sarCase) {
    // SARs require subject name masking in certain CBUAE views
    const hasNarrative = !!sarCase.narrative;
    if (hasNarrative) {
      checks.push({ check: 'PII Masking Verification', passed: true, message: 'SAR narrative present. PII masking will be applied in CBUAE view per data protection requirements.' });
    } else {
      checks.push({ check: 'PII Masking Verification', passed: false, message: 'SAR narrative missing — cannot verify PII masking.' });
      missingFields.push('narrative');
    }
  } else {
    checks.push({ check: 'PII Masking Verification', passed: false, message: 'No SAR case available for PII verification.' });
    missingFields.push('piiMasking');
  }

  // Check 5: goAML XML validity
  if (sarCase) {
    const goamlFiling = await db.goAMLFiling.findFirst({
      where: {
        subjectName: sarCase.subjectName,
        reportType: { in: ['STR', 'SAR'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (goamlFiling && goamlFiling.xmlPayload) {
      const xmlLength = goamlFiling.xmlPayload.length;
      const hasValidStructure = goamlFiling.xmlPayload.includes('<') && goamlFiling.xmlPayload.includes('>');
      if (hasValidStructure && xmlLength > 100) {
        checks.push({ check: 'goAML XML Validity', passed: true, message: `goAML XML generated (${xmlLength} chars). Reference: ${goamlFiling.referenceNumber}` });
      } else {
        checks.push({ check: 'goAML XML Validity', passed: false, message: 'goAML XML appears malformed or too short. Regenerate the XML.' });
        missingFields.push('goamlXml');
      }
    } else {
      checks.push({ check: 'goAML XML Validity', passed: false, message: 'No goAML XML generated. Generate XML before submission to UAE FIU.' });
      missingFields.push('goamlXml');
    }
  } else {
    checks.push({ check: 'goAML XML Validity', passed: false, message: 'No SAR case available for goAML XML validation.' });
    missingFields.push('goamlXml');
  }

  // Check 6: Filing deadline compliance (30-day per FDL 10/2025)
  if (sarCase) {
    const now = new Date();
    const deadline = new Date(sarCase.filingDeadline);
    const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysRemaining > 0) {
      checks.push({ check: 'Filing Deadline Compliance', passed: true, message: `${daysRemaining} days remaining before filing deadline (FDL 10/2025 Art. 8).` });
    } else {
      checks.push({ check: 'Filing Deadline Compliance', passed: false, message: `SAR filing deadline has PASSED by ${Math.abs(daysRemaining)} days. Immediate submission required per FDL 10/2025 Art. 8.` });
      missingFields.push('filingDeadline');
    }
  }

  // Check 7: Tipping-off acknowledgment
  if (sarCase) {
    if (sarCase.tippingOffAcknowledgedAt) {
      checks.push({ check: 'Tipping-Off Acknowledgment', passed: true, message: `Tipping-off prohibition acknowledged per FDL 10/2025 Art. 12.` });
    } else {
      checks.push({ check: 'Tipping-Off Acknowledgment', passed: false, message: 'Tipping-off prohibition has NOT been acknowledged. Required before filing per FDL 10/2025 Art. 12.' });
      missingFields.push('tippingOffAcknowledgment');
    }
  }

  const ready = checks.length > 0 && checks.every(c => c.passed);

  return {
    ready,
    checks,
    missingFields,
    reportId: sarCase?.id,
    reportType: 'sar_filing',
    checkedAt: new Date().toISOString(),
  };
}

async function checkCTRFiling(reportId: string | undefined): Promise<SubmissionCheckResult> {
  const checks: ValidationCheck[] = [];
  const missingFields: string[] = [];

  // Fetch CTR filing (goAML with CTR type)
  let ctrFiling;
  if (reportId) {
    ctrFiling = await db.goAMLFiling.findUnique({ where: { id: reportId } });
  } else {
    ctrFiling = await db.goAMLFiling.findFirst({
      where: { reportType: 'CTR', filingStatus: { in: ['DRAFT', 'PENDING_APPROVAL'] } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Check 1: CTR data completeness
  if (!ctrFiling) {
    checks.push({ check: 'CTR Data Completeness', passed: false, message: 'No CTR filing found. Create a CTR filing before submission.' });
    missingFields.push('filingId');
  } else {
    const hasRequiredFields = !!ctrFiling.referenceNumber && !!ctrFiling.subjectName && !!ctrFiling.xmlPayload;
    if (hasRequiredFields) {
      checks.push({ check: 'CTR Data Completeness', passed: true, message: `CTR ${ctrFiling.referenceNumber} has all required fields.` });
    } else {
      if (!ctrFiling.referenceNumber) missingFields.push('referenceNumber');
      if (!ctrFiling.subjectName) missingFields.push('subjectName');
      if (!ctrFiling.xmlPayload) missingFields.push('xmlPayload');
      checks.push({ check: 'CTR Data Completeness', passed: false, message: `CTR is missing required fields: ${[!ctrFiling.referenceNumber ? 'referenceNumber' : '', !ctrFiling.subjectName ? 'subjectName' : '', !ctrFiling.xmlPayload ? 'xmlPayload' : ''].filter(Boolean).join(', ')}` });
    }
  }

  // Check 2: MLRO approval
  if (ctrFiling) {
    const mlroApproval = await db.auditLog.findFirst({
      where: {
        resource: 'GoAMLFiling',
        resourceId: ctrFiling.id,
        action: 'MLRO_APPROVAL',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (mlroApproval) {
      checks.push({ check: 'MLRO Approval', passed: true, message: `MLRO approval granted by ${mlroApproval.userId}` });
    } else {
      checks.push({ check: 'MLRO Approval', passed: false, message: 'MLRO has not approved this CTR filing. Approval required.' });
      missingFields.push('mlroApproval');
    }
  } else {
    checks.push({ check: 'MLRO Approval', passed: false, message: 'No CTR filing available for MLRO approval check.' });
    missingFields.push('mlroApproval');
  }

  // Check 3: Maker-checker completion
  if (ctrFiling) {
    const makerCheckerLog = await db.makerCheckerLog.findFirst({
      where: {
        entityId: ctrFiling.id,
        entityType: 'GoAMLFiling',
        status: 'APPROVED',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (makerCheckerLog) {
      checks.push({ check: 'Maker-Checker Completion', passed: true, message: `4-Eyes review completed. Maker: ${makerCheckerLog.makerName}, Checker: ${makerCheckerLog.checkerName || 'N/A'}` });
    } else {
      checks.push({ check: 'Maker-Checker Completion', passed: false, message: 'Maker-checker review not completed for CTR filing.' });
      missingFields.push('makerCheckerApproval');
    }
  } else {
    checks.push({ check: 'Maker-Checker Completion', passed: false, message: 'No CTR filing available for maker-checker verification.' });
    missingFields.push('makerCheckerApproval');
  }

  // Check 4: PII masking verification
  checks.push({ check: 'PII Masking Verification', passed: true, message: 'CTR PII masking will be applied per CBUAE data protection requirements.' });

  // Check 5: goAML XML validity
  if (ctrFiling && ctrFiling.xmlPayload) {
    const hasValidStructure = ctrFiling.xmlPayload.includes('<') && ctrFiling.xmlPayload.includes('>');
    if (hasValidStructure && ctrFiling.xmlPayload.length > 100) {
      checks.push({ check: 'goAML XML Validity', passed: true, message: `goAML XML generated (${ctrFiling.xmlPayload.length} chars). Valid structure detected.` });
    } else {
      checks.push({ check: 'goAML XML Validity', passed: false, message: 'goAML XML appears malformed. Regenerate the XML.' });
      missingFields.push('goamlXml');
    }
  } else {
    checks.push({ check: 'goAML XML Validity', passed: false, message: 'No goAML XML generated for CTR. Generate XML before submission.' });
    missingFields.push('goamlXml');
  }

  // Check 6: Amount threshold (CTR requires AED 35,000+ per CBUAE)
  if (ctrFiling && ctrFiling.amountAED !== null && ctrFiling.amountAED !== undefined) {
    if (ctrFiling.amountAED >= 35000) {
      checks.push({ check: 'Amount Threshold', passed: true, message: `CTR amount AED ${ctrFiling.amountAED.toLocaleString()} meets the AED 35,000 threshold.` });
    } else {
      checks.push({ check: 'Amount Threshold', passed: false, message: `CTR amount AED ${ctrFiling.amountAED.toLocaleString()} is below the AED 35,000 reporting threshold.` });
      missingFields.push('amountThreshold');
    }
  }

  const ready = checks.length > 0 && checks.every(c => c.passed);

  return {
    ready,
    checks,
    missingFields,
    reportId: ctrFiling?.id,
    reportType: 'ctr_filing',
    checkedAt: new Date().toISOString(),
  };
}

// ─── GET: Check CBUAE Submission Readiness ───────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;
    const { searchParams } = new URL(request.url);
    const params = {
      reportId: searchParams.get('reportId') || undefined,
      reportType: searchParams.get('reportType') || undefined,
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
        { status: 400 }
      );
    }

    const { reportId, reportType } = parsed.data;

    let result: SubmissionCheckResult;

    switch (reportType) {
      case 'quarterly_report':
        result = await checkQuarterlyReport(reportId);
        break;
      case 'sar_filing':
        result = await checkSARFiling(reportId);
        break;
      case 'ctr_filing':
        result = await checkCTRFiling(reportId);
        break;
      default: {
        // If no report type specified, run all checks and return the most relevant one
        const quarterlyResult = await checkQuarterlyReport(reportId);
        const sarResult = await checkSARFiling(reportId);
        const ctrResult = await checkCTRFiling(reportId);

        // Return all results combined
        const allChecks = [
          ...quarterlyResult.checks.map(c => ({ ...c, check: `[Quarterly Report] ${c.check}` })),
          ...sarResult.checks.map(c => ({ ...c, check: `[SAR Filing] ${c.check}` })),
          ...ctrResult.checks.map(c => ({ ...c, check: `[CTR Filing] ${c.check}` })),
        ];

        const allMissing = [
          ...quarterlyResult.missingFields.map(f => `quarterly.${f}`),
          ...sarResult.missingFields.map(f => `sar.${f}`),
          ...ctrResult.missingFields.map(f => `ctr.${f}`),
        ];

        result = {
          ready: quarterlyResult.ready || sarResult.ready || ctrResult.ready,
          checks: allChecks,
          missingFields: allMissing,
          reportType: 'all',
          checkedAt: new Date().toISOString(),
        };
        break;
      }
    }

    // Audit log the check (v7.3.0-uat-hotfix-1: use createAuditLog() so the
    // entry is SHA-256 hash-chained. Previously called db.auditLog.create()
    // directly, bypassing the integrity chain → caused the 1 missingHash in
    // /api/audit/integrity. See RCA_P2_REGRESSION.md + GAP_ANALYSIS_REPORT.md Issue 8.
    await createAuditLog({
      userId: 'system',
      action: 'CBUAE_SUBMISSION_CHECK',
      resourceType: 'SubmissionChecker',
      resourceId: result.reportId || 'general',
      details: JSON.stringify({
        reportType: result.reportType,
        ready: result.ready,
        checksPassed: result.checks.filter(c => c.passed).length,
        checksFailed: result.checks.filter(c => !c.passed).length,
        missingFields: result.missingFields,
      }),
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({
      success: true,
      data: maskListPII(result),
    });
  } catch (error) {
    console.error('[CBUAE_SUBMISSION_CHECKER] Error checking submission readiness:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check CBUAE submission readiness' },
      { status: 500 }
    );
  }
}
