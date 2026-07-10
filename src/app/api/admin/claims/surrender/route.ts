import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import { applyRateLimit } from '@/lib/rate-limit';

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const surrenderBlockSchema = z.object({
  claimId: z.string().min(1),
  policyIssuanceDate: z.string().min(1),
  payoutBankAccount: z.string().min(1),
  originalPremiumBankAccount: z.string().min(1),
  userId: z.string().min(1),
  userName: z.string().min(1),
});

// POST /api/claims/surrender — Early Surrender & Third-Party Payout Block
export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer', 'dept_head'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = surrenderBlockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { claimId, policyIssuanceDate, payoutBankAccount, originalPremiumBankAccount, userId, userName } = parsed.data;

    const issuanceDate = new Date(policyIssuanceDate);
    const now = new Date();
    const daysSinceIssuance = Math.floor((now.getTime() - issuanceDate.getTime()) / (1000 * 60 * 60 * 24));

    const normalizeAccount = (acc: string) => acc.replace(/[\s-]/g, '').toUpperCase();
    const isThirdParty = normalizeAccount(payoutBankAccount) !== normalizeAccount(originalPremiumBankAccount);

    // Hard business rule: Early Surrender (<30 days) + Third-Party Payout = BLOCK
    if (daysSinceIssuance < 30 && isThirdParty) {
      const claim = await db.claim.update({
        where: { id: claimId },
        data: {
          status: 'investigation',
          siuFlagged: true,
          updatedAt: new Date(),
        },
      });

      await createAuditLog({
        userId,
        action: 'THIRD_PARTY_EARLY_SURRENDER_BLOCKED',
        resourceType: 'Claim',
        resourceId: claimId,
        details: `Early surrender blocked: ${daysSinceIssuance} days since issuance, payout to third-party account. Payout: ${payoutBankAccount.substring(0, 4)}****, Original: ${originalPremiumBankAccount.substring(0, 4)}****. Escalated to MLRO EDD per QCB AML Rules §4.1.`,
      });

      return NextResponse.json({
        success: true,
        data: {
          blocked: true,
          reason: 'THIRD_PARTY_EARLY_SURRENDER',
          daysSinceIssuance,
          requiresMLROEDD: true,
          regulatoryReference: 'QCB AML Rules for Insurance Companies, §4.1; CBUAE Insurance Regulations',
          claimStatus: claim.status,
          audited: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        blocked: false,
        daysSinceIssuance,
        isThirdParty,
        reason: daysSinceIssuance >= 30
          ? 'Policy issued more than 30 days ago — standard surrender process applies'
          : 'Payout account matches original premium account — no third-party risk',
      },
    });
  } catch (error) {
    console.error('[Surrender Block API] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process surrender validation' },
      { status: 500 }
    );
  }
}
