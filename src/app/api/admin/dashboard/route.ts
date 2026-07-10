import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { sanitizeObject } from '@/lib/pii';
import { applyRateLimit } from '@/lib/rate-limit';

const dashboardQuerySchema = z.object({
  jurisdiction: z.string().optional(),
});

// GET /api/dashboard - Fetch dashboard metrics
export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard();
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;
    const { searchParams } = new URL(request.url);
    const parsed = dashboardQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const jurisdiction = parsed.data.jurisdiction || 'ALL';

    // Fetch KRI metrics
    const kriWhere: Record<string, unknown> = {};
    if (jurisdiction !== 'ALL') kriWhere.jurisdiction = jurisdiction;

    const kriMetrics = await db.kRIMetric.findMany({ where: kriWhere });

    // Fetch compliance metrics by counting records
    const [
      totalRegulations,
      compliantRegulations,
      partialRegulations,
      nonCompliantRegulations,
      pendingRegulations,
      totalPolicies,
      publishedPolicies,
      draftPolicies,
      underReviewPolicies,
      aiReviewedPolicies,
      totalAudits,
      scheduledAudits,
      inProgressAudits,
      completedAudits,
      overdueRemediation,
      totalLabor,
      compliantLabor,
      partialLabor,
      nonCompliantLabor,
      totalCases,
      openCases,
      urgentCases,
      totalCourses,
      mandatoryCourses,
      totalEnrollments,
      completedEnrollments,
      overdueEnrollments,
      recentAuditLogs,
    ] = await Promise.all([
      // Regulations
      db.regulation.count({ where: kriWhere }),
      db.regulation.count({ where: { ...kriWhere, complianceStatus: 'COMPLIANT' } }),
      db.regulation.count({ where: { ...kriWhere, complianceStatus: 'PARTIAL' } }),
      db.regulation.count({ where: { ...kriWhere, complianceStatus: 'NON_COMPLIANT' } }),
      db.regulation.count({ where: { ...kriWhere, complianceStatus: 'PENDING' } }),
      // Policies
      db.policy.count(),
      db.policy.count({ where: { status: 'published' } }),
      db.policy.count({ where: { status: 'draft' } }),
      db.policy.count({ where: { status: 'under_review' } }),
      db.policy.count({ where: { aiReviewed: true } }),
      // Audits
      db.complianceAudit.count({ where: kriWhere }),
      db.complianceAudit.count({ where: { ...kriWhere, status: 'scheduled' } }),
      db.complianceAudit.count({ where: { ...kriWhere, status: 'in_progress' } }),
      db.complianceAudit.count({ where: { ...kriWhere, status: 'completed' } }),
      db.complianceAudit.count({ where: { ...kriWhere, remediationStatus: 'overdue' } }),
      // Labor
      db.laborLawCompliance.count(),
      db.laborLawCompliance.count({ where: { complianceStatus: 'COMPLIANT' } }),
      db.laborLawCompliance.count({ where: { complianceStatus: 'PARTIAL' } }),
      db.laborLawCompliance.count({ where: { complianceStatus: 'NON_COMPLIANT' } }),
      // Legal
      db.legalCase.count(),
      db.legalCase.count({ where: { status: 'open' } }),
      db.legalCase.count({ where: { priority: 'urgent' } }),
      // Training
      db.trainingCourse.count(),
      db.trainingCourse.count({ where: { isMandatory: true } }),
      db.trainingEnrollment.count(),
      db.trainingEnrollment.count({ where: { status: 'completed' } }),
      db.trainingEnrollment.count({ where: { status: 'overdue' } }),
      // Recent audit logs
      db.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Calculate compliance score
    const complianceScore = totalRegulations > 0
      ? Math.round((compliantRegulations / totalRegulations) * 100 * 10) / 10
      : 0;

    // Training completion rate
    const trainingCompletionRate = totalEnrollments > 0
      ? Math.round((completedEnrollments / totalEnrollments) * 100 * 10) / 10
      : 0;

    // Labor compliance rate
    const laborComplianceRate = totalLabor > 0
      ? Math.round((compliantLabor / totalLabor) * 100 * 10) / 10
      : 0;

    const dashboard = {
      complianceScore,
      jurisdiction,
      lastUpdated: new Date().toISOString(),
      kriMetrics: kriMetrics.map(k => ({
        id: k.id,
        name: k.name,
        value: k.value,
        target: k.target,
        trend: k.trend,
        jurisdiction: k.jurisdiction,
        category: k.category,
      })),
      regulations: {
        total: totalRegulations,
        compliant: compliantRegulations,
        partial: partialRegulations,
        nonCompliant: nonCompliantRegulations,
        pending: pendingRegulations,
      },
      policies: {
        total: totalPolicies,
        published: publishedPolicies,
        draft: draftPolicies,
        underReview: underReviewPolicies,
        aiReviewed: aiReviewedPolicies,
      },
      audits: {
        total: totalAudits,
        scheduled: scheduledAudits,
        inProgress: inProgressAudits,
        completed: completedAudits,
        overdueRemediation,
      },
      labor: {
        total: totalLabor,
        compliant: compliantLabor,
        partial: partialLabor,
        nonCompliant: nonCompliantLabor,
        complianceRate: laborComplianceRate,
      },
      legal: {
        total: totalCases,
        open: openCases,
        urgent: urgentCases,
      },
      training: {
        totalCourses,
        mandatoryCourses,
        totalEnrollments,
        completedEnrollments,
        overdueEnrollments,
        completionRate: trainingCompletionRate,
      },
      recentAuditLogs,
    };

    return NextResponse.json({ success: true, data: sanitizeObject(dashboard) });
  } catch (error) {
    console.error('Failed to fetch dashboard metrics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard metrics' },
      { status: 500 }
    );
  }
}
