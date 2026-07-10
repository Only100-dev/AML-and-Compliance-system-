import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';

/**
 * DMLRO Delegation Status API — GAP 2.3
 * Check if a specific user has active DMLRO delegation.
 *
 * Per FDL 10/2025 Art. 13-14 and CBUAE Notice 3551/2021 S3.2:
 *   - A compliance_manager with active delegation can act as DMLRO
 *   - Delegations auto-expire past their delegationExpiry date
 *   - All status checks are logged for audit compliance
 *
 * GET /api/dmlro/status?userId=xxx
 */

export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({ requireAuth: true });
    if (!auth.authorized || !auth.session) {
      return auth.error ?? NextResponse.json(
        { success: false, error: 'Authentication required', regulatoryRef: 'FDL 10/2025 Art. 15' },
        { status: 401 }
      );
    }

    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'userId query parameter is required',
          regulatoryRef: 'FDL 10/2025 Art. 15',
        },
        { status: 400 }
      );
    }

    // Find the user
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found', regulatoryRef: 'FDL 10/2025 Art. 15' },
        { status: 404 }
      );
    }

    // Check if this user is designated as a deputy by any MLRO
    // A user is a deputy if some MLRO has set their deputyUserId to this user's ID
    const delegatingMlro = await db.user.findFirst({
      where: {
        deputyUserId: userId,
        delegationActive: true,
      },
    });

    if (!delegatingMlro) {
      return NextResponse.json({
        success: true,
        isDeputy: false,
        delegationActive: false,
        mlroName: '',
        expiresAt: '',
        regulatoryRef: 'FDL 10/2025 Art. 13-14; CBUAE Notice 3551/2021 S3.2',
      });
    }

    // Check if delegation has expired (auto-expire check)
    const now = new Date();
    let delegationActive = true;
    let expiresAt = '';

    if (delegatingMlro.delegationExpiry) {
      expiresAt = delegatingMlro.delegationExpiry.toISOString();

      if (now > delegatingMlro.delegationExpiry) {
        // Delegation has expired — auto-expire it
        delegationActive = false;

        // Update the MLRO user to clear delegation
        await db.user.update({
          where: { id: delegatingMlro.id },
          data: {
            delegationActive: false,
            deputyUserId: null,
            delegationExpiry: null,
            delegationReason: null,
          },
        });

        // Log the auto-expiry
        const logPayload = JSON.stringify({
          mlroUserId: delegatingMlro.id,
          mlroName: delegatingMlro.name,
          deputyUserId: userId,
          deputyName: user.name,
          action: 'EXPIRED',
          reason: 'Auto-expired: delegation period exceeded on status check',
          timestamp: now.toISOString(),
        });

        const sha256Hash = crypto.createHash('sha256').update(logPayload).digest('hex');

        await db.dMLRODelegationLog.create({
          data: {
            mlroUserId: delegatingMlro.id,
            mlroName: delegatingMlro.name,
            deputyUserId: userId,
            deputyName: user.name,
            action: 'EXPIRED',
            reason: 'Auto-expired: delegation period exceeded on status check',
            activatedAt: null,
            deactivatedAt: now,
            expiryDate: delegatingMlro.delegationExpiry,
            sha256Hash,
          },
        });

        await db.auditLog.create({
          data: {
            userId: delegatingMlro.id,
            action: 'DMLRO_DELEGATION_EXPIRED',
            resource: 'dmlro_delegation',
            resourceId: userId,
            details: JSON.stringify({
              tag: `DMLRO_DELEGATION_EXPIRED — ${user.name} delegation expired`,
              deputyName: user.name,
              expiredAt: now.toISOString(),
              originalExpiry: delegatingMlro.delegationExpiry.toISOString(),
            }),
            sha256Hash,
            ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? null,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      isDeputy: true,
      delegationActive,
      mlroName: delegatingMlro.name,
      expiresAt,
      regulatoryRef: 'FDL 10/2025 Art. 13-14; CBUAE Notice 3551/2021 S3.2',
    });
  } catch (error) {
    console.error('[DMLRO-STATUS] GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to check DMLRO delegation status';
    return NextResponse.json(
      { success: false, error: message, regulatoryRef: 'FDL 10/2025 Art. 15' },
      { status: 500 }
    );
  }
}
