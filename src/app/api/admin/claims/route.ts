import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { authGuard } from '@/lib/auth-guard';
import { maskListPII } from '@/lib/pii';
import { applyRateLimit } from '@/lib/rate-limit';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createClaimSchema = z.object({
  policyNumber: z.string().min(1, 'Policy number is required'),
  claimType: z.string().min(1, 'Claim type is required'),
  claimantName: z.string().min(1, 'Claimant name is required'),
  description: z.string().min(1, 'Description is required'),
  amount: z.number().positive('Amount must be a positive number'),
});

const updateClaimSchema = z.object({
  id: z.string().min(1, 'Claim ID is required'),
  status: z.string().optional(),
  priority: z.string().optional(),
  assignedAdjuster: z.string().optional(),
  siuFlagged: z.boolean().optional(),
  fraudScore: z.number().min(0).max(1).optional(),
  // Third-party early surrender block fields
  payoutBankAccount: z.string().optional(),
  originalPremiumBankAccount: z.string().optional(),
  daysSinceIssuance: z.number().int().min(0).optional(),
  userId: z.string().optional(),
});

// ─── GET: List Claims with Role-Based Filtering ─────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;
    const { searchParams } = new URL(request.url);
    const persona = searchParams.get('persona') || 'claimant';
    const status = searchParams.get('status');
    const jurisdiction = searchParams.get('jurisdiction');
    const claimType = searchParams.get('claimType');

    // Build where clause based on optional filters
    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (jurisdiction) where.jurisdiction = jurisdiction;
    if (claimType) where.claimType = claimType;

    // Role-based filtering
    if (persona === 'siu') {
      // SIU: only siuFlagged=true OR fraudScore >= 0.4
      where.OR = [
        { siuFlagged: true },
        { fraudScore: { gte: 0.4 } },
      ];
    } else if (persona === 'adjuster') {
      // Adjuster: only status in ['under_review', 'submitted']
      where.status = status
        ? where.status // keep explicit filter if provided and it's in the allowed set
        : { in: ['under_review', 'submitted'] };
      // If status filter was explicitly provided, override the adjuster default
      if (status) {
        where.status = status;
      }
    }
    // 'claimant' and 'supervisor' see all claims (no additional filtering)

    const claims = await db.claim.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: maskListPII(claims),
      meta: { persona, total: claims.length },
    });
  } catch (error) {
    console.error('[CLAIMS_GET] Error fetching claims:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch claims' },
      { status: 500 }
    );
  }
}

// ─── POST: Create New Claim ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;
    const body = await request.json();
    const parsed = createClaimSchema.safeParse(body);

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

    const { policyNumber, claimType, claimantName, description, amount } = parsed.data;

    // Auto-generate sequential claim number
    const year = new Date().getFullYear();
    const latestClaim = await db.claim.findFirst({
      where: { claimNumber: { startsWith: `CLM-${year}-` } },
      orderBy: { claimNumber: 'desc' },
    });

    let nextSeq = 1;
    if (latestClaim?.claimNumber) {
      const parts = latestClaim.claimNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }
    const claimNumber = `CLM-${year}-${String(nextSeq).padStart(5, '0')}`;

    const claim = await db.claim.create({
      data: {
        claimNumber,
        policyNumber,
        claimType,
        claimantName,
        description,
        amount,
        status: 'submitted',
        fraudScore: 0,
        siuFlagged: false,
      },
    });

    return NextResponse.json({
      success: true,
      data: claim,
    }, { status: 201 });
  } catch (error) {
    console.error('[CLAIMS_POST] Error creating claim:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create claim' },
      { status: 500 }
    );
  }
}

// ─── PATCH: Update Existing Claim ────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;
    const body = await request.json();
    const parsed = updateClaimSchema.safeParse(body);

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

    const { id, status, priority, assignedAdjuster, siuFlagged, fraudScore } = parsed.data;

    // Check claim exists
    const existing = await db.claim.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Claim with ID "${id}" not found` },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (assignedAdjuster !== undefined) updateData.assignedAdjuster = assignedAdjuster;
    if (siuFlagged !== undefined) updateData.siuFlagged = siuFlagged;
    if (fraudScore !== undefined) updateData.fraudScore = fraudScore;

    // Auto-set siuFlagged=true when status changes to 'investigation' and siuFlagged is not already true
    if (status === 'investigation' && siuFlagged !== true) {
      updateData.siuFlagged = true;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // EARLY SURRENDER & THIRD-PARTY PAYOUT BLOCK
    // Per QCB AML Rules for Insurance Companies, §4.1; CBUAE Insurance Regulations
    // "Original Payment Method" rule: If a surrender is requested within 30 days
    // of issuance and payout targets a different bank account than the original
    // premium payment, block and escalate to MLRO EDD review.
    // ═══════════════════════════════════════════════════════════════════════
    const isSurrenderClaim = existing.claimType.toLowerCase().includes('surrender');
    const { payoutBankAccount, originalPremiumBankAccount, daysSinceIssuance, userId } = parsed.data;

    if (
      isSurrenderClaim &&
      payoutBankAccount &&
      originalPremiumBankAccount &&
      daysSinceIssuance !== undefined &&
      daysSinceIssuance < 30 &&
      payoutBankAccount !== originalPremiumBankAccount
    ) {
      // BLOCK the transaction — escalate to MLRO EDD review
      updateData.status = 'PENDING_MLRO_REVIEW';

      // Create audit log for the block
      await createAuditLog({
        userId: userId || 'system',
        action: 'THIRD_PARTY_EARLY_SURRENDER_BLOCK',
        resourceType: 'Claim',
        resourceId: id,
        details: `Third-party early surrender blocked for claim ${existing.claimNumber}. Days since issuance: ${daysSinceIssuance}. Payout bank differs from original premium bank. Escalated to MLRO EDD review per CBUAE Insurance Regulations.`,
        changes: {
          claimId: id,
          claimNumber: existing.claimNumber,
          daysSinceIssuance,
          payoutBankAccount,
          originalPremiumBankAccount,
          blocked: true,
          reason: 'THIRD_PARTY_EARLY_SURRENDER',
          requiresMLROEDD: true,
        },
      });

      const updated = await db.claim.update({
        where: { id },
        data: updateData,
      });

      return NextResponse.json({
        success: true,
        data: updated,
        blocked: true,
        reason: 'THIRD_PARTY_EARLY_SURRENDER',
        requiresMLROEDD: true,
      });
    }

    const updated = await db.claim.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('[CLAIMS_PATCH] Error updating claim:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update claim' },
      { status: 500 }
    );
  }
}
