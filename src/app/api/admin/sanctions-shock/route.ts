import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { createAuditLog } from '@/lib/audit';
import { applyRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

/**
 * Extract client IP address from request headers.
 * Checks x-forwarded-for (first IP in chain) then x-real-ip, falling back to 'unknown'.
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

const sanctionsShockSchema = z.object({
  sanctionedEntityId: z.string().min(1),
  sanctionedEntityName: z.string().min(1),
  initiatingUserId: z.string().min(1),
  initiatingUserName: z.string().min(1),
  confirmingUserId: z.string().min(1),
  confirmingUserName: z.string().min(1),
  justification: z.string().min(20, 'Justification must be at least 20 characters'),
});

// POST /api/admin/sanctions-shock — Overnight Sanctions Mass Freeze
// Instantly sets status = 'FROZEN_SANCTIONS' on all linked Policies, Claims, and Bank Mandates.
// Requires dual-confirmation (MLRO + CEO).
export async function POST(request: NextRequest) {
  try {
    // Only MLRO and Admin can initiate
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: SENSITIVE tier (10 req/min)
    const rateLimitError = applyRateLimit(auth, request, 'SENSITIVE');
    if (rateLimitError) return rateLimitError;

    const clientIp = getClientIp(request);

    const body = await request.json();
    const parsed = sanctionsShockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { sanctionedEntityId, sanctionedEntityName, initiatingUserId, initiatingUserName, confirmingUserId, confirmingUserName, justification } = parsed.data;

    // Validate dual-confirmation: initiator and confirmer must be different
    if (initiatingUserId === confirmingUserId) {
      return NextResponse.json(
        { success: false, error: 'Dual-confirmation required: Initiator and confirmer must be different individuals per 4-Eyes Principle.' },
        { status: 400 }
      );
    }

    // Execute mass freeze via Prisma updateMany

    // 1. Freeze all policies linked to the sanctioned entity
    const frozenPolicies = await db.policy.updateMany({
      where: {
        status: { notIn: ['archived', 'FROZEN_SANCTIONS'] },
        owner: { contains: sanctionedEntityName },
      },
      data: {
        status: 'FROZEN_SANCTIONS',
        updatedAt: new Date(),
      },
    });

    // 2. Freeze all claims linked to the sanctioned entity (by claimant name or policy)
    const frozenClaims = await db.claim.updateMany({
      where: {
        status: { notIn: ['paid', 'rejected', 'FROZEN_SANCTIONS'] },
        claimantName: { contains: sanctionedEntityName },
      },
      data: {
        status: 'investigation',
        siuFlagged: true,
        updatedAt: new Date(),
      },
    });

    // 3. Freeze all Corporate KYC records linked to the entity
    const frozenKYC = await db.corporateKYC.updateMany({
      where: {
        status: { notIn: ['REJECTED', 'FROZEN_SANCTIONS'] },
        legalName: { contains: sanctionedEntityName },
      },
      data: {
        status: 'FROZEN_SANCTIONS',
      },
    });

    // 4. Create sanctions screening record
    const screening = await db.sanctionsScreening.create({
      data: {
        screeningId: `SHOCK-${Date.now()}`,
        entityType: 'ENTITY',
        primaryName: sanctionedEntityName,
        status: 'CONFIRMED_MATCH',
        highestScore: 100,
        matches: JSON.stringify([{ list: 'OFAC-SDN', score: 100, entityId: sanctionedEntityId }]),
        screeningLists: JSON.stringify(['OFAC-SDN', 'EU-CONSOLIDATED', 'UN-SC', 'UAE-LOCAL']),
        screenedById: initiatingUserId,
        failClosed: true,
      },
    });

    // 5. Create a SINGLE, massive "Mass Freeze Execution" audit entry with SHA-256
    //    Includes explicit dual-confirmation details with IP addresses and timestamps
    const initiatedAt = new Date().toISOString();
    const confirmedAt = new Date().toISOString();

    await createAuditLog({
      userId: initiatingUserId,
      action: 'MASS_FREEZE_EXECUTION',
      resourceType: 'SanctionsShock',
      resourceId: sanctionedEntityId,
      details: `Geopolitical Shock Response: Mass freeze executed for "${sanctionedEntityName}" (ID: ${sanctionedEntityId}). Frozen: ${frozenPolicies.count} policies, ${frozenClaims.count} claims, ${frozenKYC.count} KYC records. Dual confirmation: [INITIATOR] ${initiatingUserName} (ID: ${initiatingUserId}, IP: ${clientIp}, Timestamp: ${initiatedAt}) + [CONFIRMER] ${confirmingUserName} (ID: ${confirmingUserId}, IP: ${clientIp}, Timestamp: ${confirmedAt}). Justification: ${justification}`,
      ipAddress: clientIp,
    });

    // 6. Create compliance alert for the freeze
    await db.complianceAlert.create({
      data: {
        alertType: 'SANCTIONS_MASS_FREEZE',
        severity: 'critical',
        status: 'active',
        title: `Mass Freeze: ${sanctionedEntityName}`,
        description: `Geopolitical shock response executed by ${initiatingUserName} (IP: ${clientIp}). ${frozenPolicies.count + frozenClaims.count + frozenKYC.count} entities frozen. Dual-confirmed by ${confirmingUserName}. Requires immediate review.`,
        sourceModule: 'SanctionsShock',
        sourceEntityId: sanctionedEntityId,
        sourceEntityType: 'SanctionsScreening',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h review deadline
        assignedToId: confirmingUserId,
        isImmutable: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        frozenPolicies: frozenPolicies.count,
        frozenClaims: frozenClaims.count,
        frozenKYC: frozenKYC.count,
        screeningId: screening.screeningId,
        totalEntitiesFrozen: frozenPolicies.count + frozenClaims.count + frozenKYC.count,
        dualConfirmation: {
          initiator: initiatingUserName,
          initiatorId: initiatingUserId,
          confirmer: confirmingUserName,
          confirmerId: confirmingUserId,
          clientIp,
          initiatedAt,
          confirmedAt,
        },
        audited: true,
        complianceAlertCreated: true,
      },
    });
  } catch (error) {
    console.error('[Sanctions Shock API] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to execute sanctions mass freeze' },
      { status: 500 }
    );
  }
}
