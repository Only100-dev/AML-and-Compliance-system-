import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { createAuditLog } from '@/lib/audit';
import { stripPIIFromText } from '@/lib/pii';
import { getRegulatoryThresholds } from '@/lib/regulatory/thresholds';
import { z } from 'zod';
import { applyRateLimit } from '@/lib/rate-limit';

const draftSARSchema = z.object({
  alertId: z.string().min(1),
  userId: z.string().min(1),
  userName: z.string().min(1),
});

/**
 * Calculates the SAR filing deadline based on jurisdiction-specific rules.
 * Bahrain uses BUSINESS DAYS (excluding weekends); all others use CALENDAR DAYS.
 */
function calculateSARDeadline(
  triggerDate: Date,
  deadlineDays: number,
  deadlineUnit: 'calendar_days' | 'business_days',
): { deadline: Date; daysRemaining: number } {
  if (deadlineUnit === 'business_days') {
    // Count business days (Mon-Fri), skip weekends
    let remaining = deadlineDays;
    const deadline = new Date(triggerDate);
    while (remaining > 0) {
      deadline.setDate(deadline.getDate() + 1);
      const day = deadline.getDay();
      if (day !== 0 && day !== 6) { // Skip Sunday (0) and Saturday (6)
        remaining--;
      }
    }
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysRemaining = Math.ceil((deadline.getTime() - triggerDate.getTime()) / msPerDay);
    return { deadline, daysRemaining };
  } else {
    // Calendar days (including weekends and holidays)
    const deadline = new Date(triggerDate);
    deadline.setDate(deadline.getDate() + deadlineDays);
    return { deadline, daysRemaining: deadlineDays };
  }
}

// POST /api/ai/draft-sar — Autonomous SAR Drafting (Agentic AI)
// Passes the entire investigation context to the LLM with a strict system prompt
// to draft a jurisdiction-aware SAR narrative.
export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitError = applyRateLimit(auth, request, 'SENSITIVE');
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = draftSARSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { alertId, userId, userName } = parsed.data;

    // Fetch the alert
    const alert = await db.aMLAlert.findUnique({ where: { id: alertId } });
    if (!alert) {
      return NextResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
    }

    // Extract jurisdiction and load thresholds
    const jurisdiction = alert.jurisdiction || 'AE';
    const thresholds = getRegulatoryThresholds(jurisdiction);

    // Fetch related context
    const subjectName = alert.description?.split(' ').slice(0, 3).join(' ') ?? 'Unknown Subject';
    const adverseMedia = await db.adverseMediaSession.findMany({
      where: { subjectName: { contains: subjectName } },
      take: 5,
    });
    const goamlFilings = await db.goAMLFiling.findMany({
      where: { subjectName: { contains: subjectName } },
      take: 5,
    });
    const claims = await db.claim.findMany({
      where: { policyNumber: alert.policyNumber || 'NONE' },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    // Build the SAR narrative using structured templates (Agentic AI pattern)
    // This constructs the 5-section jurisdiction-aware SAR narrative
    const flags = alert.aiFlags ? alert.aiFlags.split(',').map(s => s.trim()) : [];
    const riskScore = alert.riskScore ?? 0;
    const amount = alert.amount ?? 0;

    // Section 1: Subject Identity
    const subjectIdentity = `[SECTION 1: SUBJECT IDENTITY]
Subject Name: ${subjectName}
Risk Score: ${riskScore}/100
Risk Level: ${alert.riskLevel?.toUpperCase() ?? 'UNKNOWN'}
Jurisdiction: ${thresholds.jurisdiction} (${thresholds.countryName})
Alert Type: ${alert.alertType}
Policy Reference: ${alert.policyNumber || 'N/A'}
${flags.length > 0 ? `AI Flag Indicators: ${flags.join(', ')}` : 'No AI flag indicators.'}`;

    // Section 2: Suspicious Activity — jurisdiction-aware
    const suspiciousActivity = `[SECTION 2: SUSPICIOUS ACTIVITY]
The transaction monitoring system flagged this activity on ${new Date(alert.createdAt).toLocaleDateString('en-GB')} with a risk score of ${riskScore}/100.
Transaction Amount: ${thresholds.currency} ${amount.toLocaleString()}
${flags.includes('Early Surrender Pattern') ? `- The transaction exhibits characteristics of an early surrender pattern, which is a known FATF-identified insurance money laundering typology per ${thresholds.regulatorName} AML Red Flags guidance.` : ''}
${flags.includes('Third-Party Payout Red Flag') ? `- A third-party payout has been detected, indicating potential fund diversion per ${thresholds.regulatorName} AML Red Flags guidance.` : ''}
${flags.includes('High-Risk Jurisdiction Transfer') ? `- Transfer to/from a high-risk jurisdiction identified on the FATF list per FATF High-Risk Jurisdictions List §2.1.` : ''}
${flags.includes('Potential Structuring') ? `- Transaction pattern suggests potential structuring below reporting thresholds per ${thresholds.regulatorName} AML Red Flags guidance.` : ''}
${flags.includes('PEP Proximity') ? `- Subject has identified PEP connections requiring enhanced due diligence per ${thresholds.regulatorName} PEP Guidance.` : ''}
${flags.includes('Direct Sanctions Match') ? `- CRITICAL: Direct sanctions match detected. Mandatory freeze required per ${thresholds.regulatorName} sanctions requirements.` : ''}
${alert.description ? `\nOriginal Alert Description: ${alert.description}` : ''}`;

    // Section 3: Transaction Analysis — jurisdiction-aware currency
    const transactionAnalysis = `[SECTION 3: TRANSACTION ANALYSIS]
Total Transaction Amount: ${thresholds.currency} ${amount.toLocaleString()}
Number of Related Claims: ${claims.length}
${claims.length > 0 ? claims.map((c, i) => `  ${i + 1}. Claim ${c.claimNumber}: ${thresholds.currency} ${c.amount?.toLocaleString() ?? '0'} (${c.claimType}) - ${c.status}${c.siuFlagged ? ' [SIU FLAGGED]' : ''}`).join('\n') : 'No related claims found in the system.'}
${goamlFilings.length > 0 ? `\nPrior ${thresholds.sarFilingFormat} Filings:\n${goamlFilings.map((f, i) => `  ${i + 1}. ${f.reportType} ${f.referenceNumber}: Status ${f.filingStatus}`).join('\n')}` : 'No prior SAR filings on record.'}`;

    // Section 4: Red Flags — jurisdiction-aware
    const redFlagsSection = `[SECTION 4: RED FLAGS]
${flags.length > 0 ? flags.map((f, i) => `${i + 1}. ${f}`).join('\n') : 'No specific AI-generated red flags identified.'}
${adverseMedia.length > 0 ? `\nAdverse Media Indicators:\n${adverseMedia.map((am, i) => `  ${i + 1}. ${am.subjectName}: Decision ${am.decision ?? 'PENDING'}`).join('\n')}` : '\nNo adverse media hits recorded.'}
${riskScore >= 80 ? `\nHIGH RISK: Composite risk score exceeds 80/100 threshold. Mandatory SAR filing recommended per ${thresholds.primaryRegulations[0] || thresholds.regulatorName + ' regulations'}.` : ''}`;

    // Section 5: Conclusion — jurisdiction-aware
    const conclusion = `[SECTION 5: CONCLUSION AND RECOMMENDATION]
Based on the analysis of the above indicators, this transaction presents ${riskScore >= 80 ? 'significant' : riskScore >= 50 ? 'moderate' : 'potential'} money laundering or terrorist financing risk.

${riskScore >= 80 ? `RECOMMENDATION: Immediate SAR/STR filing with ${thresholds.fiuName} is recommended. The ${thresholds.sarDeadline} ${thresholds.sarDeadlineUnit === 'business_days' ? 'business days' : 'calendar days'} filing deadline starts from the date of this determination.` : 'RECOMMENDATION: Further investigation is warranted. Enhanced due diligence should be applied to the subject entity.'}

This draft has been generated by the IC-OS AI Engine and MUST be reviewed and validated by the MLRO before submission to ${thresholds.fiuName}. The MLRO is responsible for the accuracy and completeness of the final filing.

Generated by: ${userName}
Generation Date: ${new Date().toLocaleDateString('en-GB')}
System Reference: ${alert.caseId}
Tipping-Off Warning: Per ${thresholds.regulatorName} regulations, disclosure of this SAR or the existence of this investigation to the subject or any unauthorized party is a criminal offense.`;

    // Combine all sections
    const sarNarrative = `${subjectIdentity}\n\n${suspiciousActivity}\n\n${transactionAnalysis}\n\n${redFlagsSection}\n\n${conclusion}`;

    // Create a SAR case if one doesn't exist
    let sarCase = await db.sARCase.findFirst({ where: { alertId } });
    if (!sarCase) {
      const triggerDate = new Date();
      const { deadline: filingDeadline, daysRemaining } = calculateSARDeadline(
        triggerDate,
        thresholds.sarDeadline,
        thresholds.sarDeadlineUnit,
      );

      sarCase = await db.sARCase.create({
        data: {
          caseNumber: `SAR-${Date.now()}`,
          alertId,
          filingDeadline,
          triggerDate,
          daysRemaining,
          status: 'DRAFT',
          narrative: sarNarrative,
          subjectName,
          jurisdiction: alert.jurisdiction,
          riskLevel: alert.riskLevel,
          createdById: userId,
          tippingOffWarning: true,
        },
      });
    } else {
      // Update existing SAR case with new narrative
      await db.sARCase.update({
        where: { id: sarCase.id },
        data: { narrative: sarNarrative },
      });
    }

    // Create audit log — jurisdiction-aware
    await createAuditLog({
      userId,
      action: 'AI_DRAFT_SAR_GENERATED',
      resourceType: 'SARCase',
      resourceId: sarCase.id,
      details: `AI-drafted SAR narrative generated for alert ${alert.caseId}. SAR Case: ${sarCase.caseNumber}. Filing deadline: ${thresholds.sarDeadline} ${thresholds.sarDeadlineUnit === 'business_days' ? 'business days' : 'calendar days'} per ${thresholds.regulatorName}. FIU: ${thresholds.fiuName}. Format: ${thresholds.sarFilingFormat}.`,
    });

    // Calculate days remaining for response
    const triggerDateForCalc = new Date();
    const { daysRemaining } = calculateSARDeadline(
      triggerDateForCalc,
      thresholds.sarDeadline,
      thresholds.sarDeadlineUnit,
    );

    return NextResponse.json({
      success: true,
      data: {
        sarCaseId: sarCase.id,
        caseNumber: sarCase.caseNumber,
        filingDeadline: sarCase.filingDeadline?.toISOString(),
        daysRemaining,
        narrative: sarNarrative,
        // PII-stripped preview for chat/AI display — original narrative preserved in DB for filing
        narrativePreview: stripPIIFromText(sarNarrative),
        sections: {
          subjectIdentity: stripPIIFromText(subjectIdentity),
          suspiciousActivity: stripPIIFromText(suspiciousActivity),
          transactionAnalysis: stripPIIFromText(transactionAnalysis),
          redFlags: stripPIIFromText(redFlagsSection),
          conclusion: stripPIIFromText(conclusion),
        },
        tippingOffWarning: true,
        requiresMLROReview: true,
        jurisdiction: thresholds.jurisdiction,
        fiu: thresholds.fiuName,
        filingFormat: thresholds.sarFilingFormat,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[AI Draft SAR API] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate AI-drafted SAR' },
      { status: 500 }
    );
  }
}
