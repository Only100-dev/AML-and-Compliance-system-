/**
 * Audit Log Integrity Verification Endpoint — Fix 3 + Addendum E
 *
 * GET /api/audit/integrity?auditId=xxx
 *
 * Recomputes the SHA-256 hash of an AuditLog record and compares it to the
 * stored sha256Hash. Returns whether the record is tamper-evident.
 *
 * Uses stableStringify() for deterministic key ordering so that hash
 * recomputation is always consistent regardless of DB/ORM key reordering.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stableStringify } from '@/lib/stable-stringify';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const auditId = searchParams.get('auditId');

    if (!auditId) {
      return NextResponse.json(
        { success: false, error: 'auditId query parameter is required' },
        { status: 400 },
      );
    }

    const auditLog = await db.auditLog.findUnique({
      where: { id: auditId },
    });

    if (!auditLog) {
      return NextResponse.json(
        { success: false, error: 'Audit log record not found' },
        { status: 404 },
      );
    }

    if (!auditLog.sha256Hash) {
      return NextResponse.json({
        success: true,
        auditId,
        status: 'NO_HASH',
        message: 'Record has no stored hash. Integrity verification not possible.',
      });
    }

    // Recompute the hash using the EXACT same formula as createAuditLog()
    // MUST match: { userId, action, resource, resourceId, details, createdAt }
    const recomputedPayload = stableStringify({
      userId: auditLog.userId,
      action: auditLog.action,
      resource: auditLog.resource,
      resourceId: auditLog.resourceId,
      details: auditLog.details,
      createdAt: auditLog.createdAt.toISOString(),
    });

    const recomputedHash = crypto
      .createHash('sha256')
      .update(recomputedPayload)
      .digest('hex');

    const valid = recomputedHash === auditLog.sha256Hash;

    return NextResponse.json({
      success: true,
      auditId,
      valid,
      storedHash: auditLog.sha256Hash,
      recomputedHash,
      status: valid ? 'INTEGRITY_VERIFIED' : 'INTEGRITY_FAILED',
      message: valid
        ? 'Record integrity verified — SHA-256 hash matches.'
        : 'INTEGRITY FAILURE — SHA-256 hash mismatch. Record may have been tampered with.',
    });
  } catch (error) {
    console.error('[Audit Integrity] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error during integrity verification' },
      { status: 500 },
    );
  }
}
