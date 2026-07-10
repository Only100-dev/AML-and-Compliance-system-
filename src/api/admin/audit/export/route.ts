/**
 * GET /api/admin/audit/export
 * Phase 3.2 — Advanced Audit Trail Visualization & Export
 *
 * Generates a compliance-grade export (CSV or JSON) of audit logs, including
 * the per-entry SHA-256 hash chain, for regulatory review.
 *
 * FDL 10/2025 Art. 11, 15 — Audit Trail Integrity & Regulatory Examination
 * CBUAE Notice 3551/2021 S3.1 — Governance & Audit Trail Retention
 *
 * Query params (all optional):
 *   - format:   'csv' (default) | 'json'
 *   - from:     ISO date — lower bound on createdAt (inclusive)
 *   - to:       ISO date — upper bound on createdAt (inclusive)
 *   - resource: exact resource type filter (e.g. 'PolicyAttestation')
 *   - userId:   exact userId filter
 *   - action:   exact action filter (e.g. 'APPROVE', 'AUDIT_EXPORT')
 *   - limit:    optional cap on entries returned (default: none; max: 10_000)
 *
 * Authorization: `withRBAC(..., 'canExportData')` — admin, mlro, and
 * compliance_manager. The task spec mentions an "auditor" role, but rbac.ts
 * does NOT define one (COMPLIANCE_ROLES = admin, mlro, compliance_manager,
 * compliance_officer, dept_head, board). The audit/review equivalent roles
 * in the existing RBAC matrix are compliance_manager and mlro, both of which
 * already hold `canExportData`. So the effective role set for this endpoint
 * is { admin, mlro, compliance_manager } — the same trio that can call
 * `/api/audit/integrity`. This is the "auditing the auditors" surface.
 *
 * Self-audit: every export call writes its own AUDIT_EXPORT entry via
 * `createAuditLog()` (action `AUDIT_EXPORT`, resource `AuditLog`, details
 * JSON-encoded with format + filters + count). This entry is created AFTER
 * the snapshot is read, so it does NOT appear in the current export — it
 * will appear in the next export. This keeps each export a consistent
 * point-in-time snapshot.
 *
 * Hash chain verification:
 *   The AuditLog table uses PER-ENTRY SHA-256 (not a threaded chain) per
 *   `src/lib/audit.ts::createAuditLog()`. The formula is:
 *     SHA-256(JSON.stringify({ userId, action, resource, resourceId,
 *                              details, createdAt }))
 *   This MUST match the verification formula in
 *   `src/app/api/audit/integrity/route.ts` exactly. The `chainVerification`
 *   object in the JSON response recomputes each entry's hash and reports:
 *     - totalEntries:    count of entries in the export
 *     - verifiedEntries: entries whose stored sha256Hash matches the
 *                        recomputed hash (excludes missing/mismatched)
 *     - missingHashCount: entries with no sha256Hash at all
 *     - chainValid:      true iff missingHashCount === 0 AND no mismatches
 *   For CSV exports, the same verification is computed but only surfaced
 *   via response headers (X-Audit-Chain-Valid, X-Audit-Verified-Count) so
 *   the CSV body remains RFC-4180 compliant.
 *
 * Schema note: the AuditLog Prisma model does NOT have `previousValue` /
 * `newValue` JSONB columns (the schema is frozen). The CSV therefore
 * emits those columns as empty strings (forward-compat placeholders) and
 * ALSO emits the `details` column — which is where many routes encode
 * change payloads as JSON strings. Reviewers can parse `details` to
 * recover per-entry change data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { withRBAC } from '@/lib/compliance/rbac';
import { createAuditLog } from '@/lib/audit';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRBACContext(request: NextRequest) {
  // withRBAC attaches the parsed context as `x-rbac-context`; fall back to
  // the raw request headers if the wrapper hasn't run (defensive — should
  // always be set when withRBAC wraps the handler).
  const raw = request.headers.get('x-rbac-context');
  if (raw) {
    try {
      return JSON.parse(raw) as {
        userId: string;
        role: string;
        ipAddress?: string;
      };
    } catch {
      /* fall through */
    }
  }
  return {
    userId: request.headers.get('x-user-id') ?? 'unknown',
    role: request.headers.get('x-user-role') ?? 'unknown',
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  };
}

function computeSHA256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * RFC-4180 CSV field escaping: fields containing commas, double-quotes,
 * carriage returns, or newlines are wrapped in double-quotes, and any
 * internal double-quotes are doubled.
 */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : String(value);
  if (str === '') return '';
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Recompute the per-entry SHA-256 hash using the SAME formula as
 * `src/lib/audit.ts::createAuditLog()` and
 * `src/app/api/audit/integrity/route.ts`. Any divergence here would
 * produce false mismatches.
 */
function recomputeHash(entry: {
  userId: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: string | null;
  createdAt: Date;
}): string {
  const hashPayload = JSON.stringify({
    userId: entry.userId,
    action: entry.action,
    resource: entry.resource,
    resourceId: entry.resourceId,
    details: entry.details ?? '',
    createdAt: entry.createdAt.toISOString(),
  });
  return computeSHA256(hashPayload);
}

interface ChainVerification {
  totalEntries: number;
  verifiedEntries: number;
  missingHashCount: number;
  mismatchCount: number;
  chainValid: boolean;
  hashFormula: string;
  verificationTimestamp: string;
}

function verifyChain(entries: Array<{
  sha256Hash: string | null;
  userId: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: string | null;
  createdAt: Date;
}>): ChainVerification {
  let verifiedEntries = 0;
  let missingHashCount = 0;
  let mismatchCount = 0;
  for (const entry of entries) {
    if (!entry.sha256Hash) {
      missingHashCount++;
      continue;
    }
    const expected = recomputeHash(entry);
    if (entry.sha256Hash === expected) {
      verifiedEntries++;
    } else {
      mismatchCount++;
    }
  }
  return {
    totalEntries: entries.length,
    verifiedEntries,
    missingHashCount,
    mismatchCount,
    chainValid: missingHashCount === 0 && mismatchCount === 0,
    hashFormula:
      'SHA-256(JSON.stringify({ userId, action, resource, resourceId, details, createdAt }))',
    verificationTimestamp: new Date().toISOString(),
  };
}

// ─── Query param parsing ──────────────────────────────────────────────────────

interface ExportFilters {
  format: 'csv' | 'json';
  from: string | null;
  to: string | null;
  resource: string | null;
  userId: string | null;
  action: string | null;
  limit: number | null;
}

function parseFilters(searchParams: URLSearchParams): ExportFilters {
  const formatRaw = (searchParams.get('format') ?? 'csv').toLowerCase();
  const format: 'csv' | 'json' = formatRaw === 'json' ? 'json' : 'csv';
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const resource = searchParams.get('resource');
  const userId = searchParams.get('userId');
  const action = searchParams.get('action');
  const limitRaw = searchParams.get('limit');
  let limit: number | null = null;
  if (limitRaw) {
    const n = parseInt(limitRaw, 10);
    if (Number.isFinite(n) && n > 0) {
      limit = Math.min(n, 10_000); // hard cap to prevent abuse
    }
  }
  return { format, from, to, resource, userId, action, limit };
}

function buildPrismaWhere(filters: ExportFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const createdAtRange: Record<string, unknown> = {};
  if (filters.from) {
    const d = new Date(filters.from);
    if (!isNaN(d.getTime())) createdAtRange.gte = d;
  }
  if (filters.to) {
    const d = new Date(filters.to);
    if (!isNaN(d.getTime())) createdAtRange.lte = d;
  }
  if (Object.keys(createdAtRange).length > 0) {
    where.createdAt = createdAtRange;
  }
  if (filters.resource) where.resource = filters.resource;
  if (filters.userId) where.userId = filters.userId;
  if (filters.action) where.action = filters.action;
  return where;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const GET = withRBAC(
  async (request: NextRequest) => {
    try {
      const ctx = getRBACContext(request);
      const url = new URL(request.url);
      const filters = parseFilters(url.searchParams);

      // Query the AuditLog table ordered by createdAt ASC (chronological
      // for the hash chain — the integrity endpoint uses the same order).
      const where = buildPrismaWhere(filters);
      const entries = await db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        ...(filters.limit ? { take: filters.limit } : {}),
      });

      // Compute chain verification (per-entry SHA-256).
      const chainVerification = verifyChain(entries);

      // Self-audit: log the export action itself. Created AFTER the
      // snapshot read so this entry is not in the current export.
      try {
        await createAuditLog({
          userId: ctx.userId,
          action: 'AUDIT_EXPORT',
          resourceType: 'AuditLog',
          resourceId: 'export',
          details: JSON.stringify({
            format: filters.format,
            filters: {
              from: filters.from,
              to: filters.to,
              resource: filters.resource,
              userId: filters.userId,
              action: filters.action,
              limit: filters.limit,
            },
            count: entries.length,
            chainValid: chainVerification.chainValid,
          }),
          ipAddress: ctx.ipAddress,
        });
      } catch (auditErr) {
        // The export itself must still succeed even if the self-audit log
        // write fails (e.g. DB contention). Surface a console warning.
        console.warn(
          '[AUDIT_EXPORT] Failed to write self-audit entry:',
          auditErr,
        );
      }

      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

      // ─── JSON format ────────────────────────────────────────────────────
      if (filters.format === 'json') {
        const payload = {
          success: true,
          exportedAt: new Date().toISOString(),
          exportedBy: { userId: ctx.userId, role: ctx.role },
          filters: {
            from: filters.from,
            to: filters.to,
            resource: filters.resource,
            userId: filters.userId,
            action: filters.action,
            limit: filters.limit,
          },
          entries: entries.map((e) => ({
            id: e.id,
            createdAt: e.createdAt.toISOString(),
            userId: e.userId,
            action: e.action,
            resource: e.resource,
            resourceId: e.resourceId ?? '',
            details: e.details ?? '',
            aiConfidence: e.aiConfidence,
            sha256Hash: e.sha256Hash ?? '',
            ipAddress: e.ipAddress ?? '',
            // previousValue/newValue are forward-compat fields — the
            // current AuditLog schema does not have dedicated JSONB
            // columns; change data lives in `details` (above) as a JSON
            // string for routes that encode it.
            previousValue: null,
            newValue: null,
          })),
          chainVerification,
          regulatoryRef: 'FDL 10/2025 Art. 11, 15; CR 134/2025 Art. 16, 21',
        };
        return NextResponse.json(payload, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="audit-export-${today}.json"`,
            'X-Audit-Chain-Valid': String(chainVerification.chainValid),
            'X-Audit-Verified-Count': String(chainVerification.verifiedEntries),
            'X-Audit-Total-Count': String(chainVerification.totalEntries),
          },
        });
      }

      // ─── CSV format (default) ───────────────────────────────────────────
      // Columns per Phase 3.2 spec:
      //   createdAt, userId, action, resource, resourceId, ipAddress,
      //   previousValue, newValue, sha256Hash
      // PLUS `details` (extra column — contains the JSON-encoded change
      // payload written by many routes; the spec's previousValue/newValue
      // columns are forward-compat placeholders that are empty in v7.3.0
      // because the AuditLog schema is frozen and has no JSONB columns).
      const csvHeaders = [
        'createdAt',
        'userId',
        'action',
        'resource',
        'resourceId',
        'ipAddress',
        'previousValue',
        'newValue',
        'sha256Hash',
        'details',
      ];
      const csvRows = entries.map((e) => [
        e.createdAt.toISOString(),
        e.userId,
        e.action,
        e.resource,
        e.resourceId ?? '',
        e.ipAddress ?? '',
        '', // previousValue — not in v7.3.0 schema (forward-compat)
        '', // newValue — not in v7.3.0 schema (forward-compat)
        e.sha256Hash ?? '',
        e.details ?? '',
      ]);
      const csvBody = [
        csvHeaders.map(csvEscape).join(','),
        ...csvRows.map((row) => row.map(csvEscape).join(',')),
      ].join('\r\n');

      return new NextResponse(csvBody, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit-export-${today}.csv"`,
          'X-Audit-Chain-Valid': String(chainVerification.chainValid),
          'X-Audit-Verified-Count': String(chainVerification.verifiedEntries),
          'X-Audit-Total-Count': String(chainVerification.totalEntries),
          'X-Audit-Missing-Hash-Count': String(chainVerification.missingHashCount),
          'X-Audit-Mismatch-Count': String(chainVerification.mismatchCount),
        },
      });
    } catch (error) {
      console.error('[AUDIT_EXPORT] Failed to generate export:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate audit export',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 },
      );
    }
  },
  // canExportData — roles: compliance_manager, mlro, admin
  // (rbac.ts does not define an `auditor` role; these three roles are the
  //  audit/review-authorized trio per the existing permission matrix.)
  'canExportData',
);
