/**
 * P3 Step 2 — Cron Route: Calculate Department Risk Scores
 * ------------------------------------------------------------------
 * Nightly cron job endpoint that recomputes the dynamic per-department
 * risk score for every department that has at least one CAP, Complaint,
 * or ComplianceAudit finding.
 *
 * Security (mandate): this route is protected by TWO layers:
 *   1. IP Isolation (Phase 4 Step 2.1) — Only internal IPs (loopback,
 *      private VPC ranges, or IPs listed in CRON_ALLOWED_IPS) may reach
 *      the route. External IPs receive 403 Forbidden WITHOUT the
 *      CRON_SECRET being read, so a leaked secret cannot be exploited
 *      from the public internet. This is defense-in-depth.
 *   2. CRON_SECRET — The request must include an
 *      `Authorization: Bearer <CRON_SECRET>` header. All requests
 *      without a matching header — or when CRON_SECRET is not configured
 *      at all — are rejected with 401 Unauthorized (fail-closed).
 *
 * Audit trail: ONE summary AuditLog entry is written per successful run
 * (departmentsUpdated count), so there's an audit trail that the cron
 * executed without spamming AuditLog with per-department rows.
 */

import { NextResponse } from 'next/server';
import { calculateAllDepartmentRiskScores } from '@/lib/risk/department-risk-engine';
import { createAuditLog } from '@/lib/audit';
import { enforceCronIsolation } from '@/lib/cron/isolation';

// ─── Security ────────────────────────────────────────────────────────────

/**
 * Verify the Authorization header against CRON_SECRET.
 *
 * Returns `true` only when CRON_SECRET is configured AND the request
 * carries `Authorization: Bearer <CRON_SECRET>`. Fails closed otherwise.
 */
function verifyCronSecret(request: Request): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn(
      '[CRON calculate-department-risk] CRON_SECRET env var is not set — rejecting request (fail-closed).',
    );
    return { ok: false, reason: 'CRON_SECRET not configured' };
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return { ok: false, reason: 'Missing Authorization header' };
  }

  const expected = `Bearer ${secret}`;
  // Constant-time-ish comparison to avoid trivial timing attacks.
  if (authHeader.length !== expected.length) {
    return { ok: false, reason: 'Invalid Authorization header' };
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= authHeader.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) {
    return { ok: false, reason: 'Invalid Authorization header' };
  }
  return { ok: true };
}

// ─── Handler ─────────────────────────────────────────────────────────────

async function runCron(request: Request) {
  // 0) IP Isolation — reject ALL external callers with 403, regardless of
  //    whether they have the CRON_SECRET. This is defense-in-depth: even
  //    if the secret leaks, an external attacker cannot invoke the cron.
  //    The CRON_SECRET is not even read for external callers.
  const isolation = enforceCronIsolation(request);
  if (isolation) return isolation;

  // 1) Auth — fail closed.
  const auth = verifyCronSecret(request);
  if (!auth.ok) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // 2) Compute + upsert per-department scores.
    const { results, log } = await calculateAllDepartmentRiskScores();

    // 3) Write a single summary AuditLog entry so there's a tamper-evident
    //    trail that the cron executed. Per-department rows are intentionally
    //    NOT logged (too noisy).
    try {
      await createAuditLog({
        userId: 'system-cron',
        action: 'CRON_DEPARTMENT_RISK_CALCULATED',
        resourceType: 'DepartmentRiskScore',
        resourceId: 'batch',
        details: `Nightly department risk cron completed. ${results.length} department(s) updated.`,
        changes: {
          departmentsUpdated: results.length,
          scores: results.map((r) => ({ departmentId: r.departmentId, score: r.score })),
        },
        ipAddress: undefined,
      });
    } catch (auditError) {
      // Don't fail the cron response just because audit logging failed;
      // surface it in the response body instead.
      const message = auditError instanceof Error ? auditError.message : String(auditError);
      console.error(
        '[CRON calculate-department-risk] AuditLog write failed:',
        message,
      );
      log.push(`  WARN: AuditLog write failed: ${message}`);
    }

    // 4) Respond.
    return NextResponse.json(
      {
        status: 'ok',
        calculatedAt: new Date().toISOString(),
        departmentsUpdated: results.length,
        results,
        log,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      '[CRON calculate-department-risk] Unhandled error:',
      message,
    );
    return NextResponse.json(
      { status: 'error', message },
      { status: 500 },
    );
  }
}

// ─── Route Exports ───────────────────────────────────────────────────────
// Cron triggers typically hit GET; we also export POST for flexibility.
// Both are protected by the same CRON_SECRET check.

export async function GET(request: Request) {
  return runCron(request);
}

export async function POST(request: Request) {
  return runCron(request);
}
