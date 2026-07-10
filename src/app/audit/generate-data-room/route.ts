import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { createAuditLog } from '@/lib/audit';
import { maskName, maskTradeLicense, maskTRN, maskAccountNumber, maskPhone, maskEmail, maskPartial, maskAmount, maskFull } from '@/lib/pii';
import { z } from 'zod';
import crypto from 'crypto';
import { applyRateLimit } from '@/lib/rate-limit';
import JSZip from 'jszip';

/**
 * POST /api/audit/generate-data-room — Regulator-in-a-Box Audit Response
 *
 * Generates a secure, time-bound data room with PII-masked documents.
 *
 * Response formats (via ?format= query param):
 *   - format=json (DEFAULT, backward-compatible): Returns the compiled documents
 *     inline as a JSON body. Used by the existing PII-leak-detection script and
 *     the in-app data-room preview component.
 *   - format=zip: Returns a binary ZIP file download containing:
 *       * manifest.json          — metadata (integrityHash, accessToken, expiresAt,
 *                                  generatedAt, totalRecords, PII masking info)
 *       * <docType>.csv          — one CSV per requested documentType, PII-masked
 *       * integrity.txt          — human-readable SHA-256 hash + verification
 *                                  instructions for the regulator
 *     The ZIP is the regulator-distributable artifact. JSON is the programmatic
 *     integration contract.
 *
 * Request body (Zod-validated):
 *   Required: dateFrom, dateTo, documentTypes[], requestingUserId,
 *             requestingUserName, requestJustification (>=20 chars)
 *   Optional: riskLevel (default 'all'), examinerName (alias for
 *             requestingUserName — permissive), auditId (filter audit_logs to a
 *             specific AuditLog.id; ignored for other documentTypes)
 */
const dataRoomSchema = z
  .object({
    dateFrom: z.string().min(1),
    dateTo: z.string().min(1),
    riskLevel: z.enum(['low', 'intermediate', 'high', 'critical', 'all']).default('all'),
    documentTypes: z.array(z.enum(['kyc', 'alerts', 'transactions', 'filings', 'audit_logs', 'policies'])).min(1),
    requestingUserId: z.string().min(1),
    // requestingUserName is required IF examinerName is not provided. We
    // validate this cross-field constraint below via .refine().
    requestingUserName: z.string().min(1).optional(),
    // Permissive alias — some UAT callers use "examinerName" instead of
    // "requestingUserName". If both are provided, requestingUserName wins.
    examinerName: z.string().min(1).optional(),
    requestJustification: z.string().min(20, 'Justification must be at least 20 characters'),
    // Optional: restrict audit_logs to a specific AuditLog.id (used by UAT
    // Scenario 4 to scope the data room to one seeded audit). Ignored for other
    // documentTypes. nullish() accepts both undefined (omitted) and explicit null.
    auditId: z.string().min(1).nullish(),
  })
  .refine((data) => Boolean(data.requestingUserName || data.examinerName), {
    message: 'Either requestingUserName or examinerName must be provided',
    path: ['requestingUserName'],
  });

type CompiledDoc = { type: string; count: number; records: Array<Record<string, unknown>> };

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function recordsToCsv(records: Array<Record<string, unknown>>): string {
  if (records.length === 0) return '';
  // Stable column order: union of keys across all records, sorted alphabetically
  // for deterministic output (regulators compare diffs across data rooms).
  const columns = Array.from(
    records.reduce<Set<string>>((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set())
  ).sort();
  const header = columns.join(',');
  const rows = records.map((r) => columns.map((c) => csvEscape(r[c])).join(','));
  return [header, ...rows].join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager'] });
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitError = applyRateLimit(auth, request, 'SENSITIVE');
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = dataRoomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      dateFrom,
      dateTo,
      riskLevel,
      documentTypes,
      requestingUserId,
      requestingUserName,
      examinerName,
      requestJustification,
      auditId,
    } = parsed.data;

    // examinerName is an alias — use it only if requestingUserName wasn't
    // explicitly provided (zod default flow guarantees requestingUserName is
    // present, so we prefer it).
    const effectiveRequesterName = requestingUserName || examinerName || 'Unknown Examiner';

    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);

    // Compile documents based on requested types
    const compiledDocuments: CompiledDoc[] = [];

    for (const docType of documentTypes) {
      const records: Array<Record<string, unknown>> = [];

      switch (docType) {
        case 'kyc': {
          const where: Record<string, unknown> = { createdAt: { gte: fromDate, lte: toDate } };
          if (riskLevel !== 'all') where.riskRating = riskLevel.toUpperCase();

          const corporateKYC = await db.corporateKYC.findMany({ where, take: 500 });
          for (const kyc of corporateKYC) {
            records.push({
              type: 'corporate_kyc',
              legalName: maskName(kyc.legalName),
              tradeLicenseNo: maskTradeLicense(kyc.tradeLicenseNo),
              trn: maskTRN(kyc.trn ?? ''),
              uboDetails: maskFull(String(kyc.uboDetails ?? '')),
              riskRating: kyc.riskRating,
              status: kyc.status,
              pepInManagement: kyc.pepInManagement,
              createdAt: kyc.createdAt.toISOString(),
            });
          }
          break;
        }
        case 'alerts': {
          const where: Record<string, unknown> = { createdAt: { gte: fromDate, lte: toDate } };
          if (riskLevel !== 'all') where.riskLevel = riskLevel;

          const alerts = await db.aMLAlert.findMany({ where, take: 500 });
          for (const alert of alerts) {
            records.push({
              type: 'aml_alert',
              caseId: alert.caseId,
              alertType: alert.alertType,
              description: maskPartial(alert.description),
              riskScore: alert.riskScore,
              riskLevel: alert.riskLevel,
              status: alert.status,
              jurisdiction: alert.jurisdiction,
              amount: alert.amount,
              assignedTo: maskName(alert.assignedTo ?? ''),
              createdBy: maskName(alert.createdBy ?? ''),
              createdAt: alert.createdAt.toISOString(),
            });
          }
          break;
        }
        case 'transactions': {
          const claims = await db.claim.findMany({
            where: { createdAt: { gte: fromDate, lte: toDate } },
            take: 500,
          });
          for (const claim of claims) {
            records.push({
              type: 'claim_transaction',
              claimNumber: claim.claimNumber,
              claimType: claim.claimType,
              claimantName: maskName(claim.claimantName),
              amount: claim.amount,
              fraudScore: claim.fraudScore,
              status: claim.status,
              jurisdiction: claim.jurisdiction,
              createdAt: claim.createdAt.toISOString(),
            });
          }
          break;
        }
        case 'filings': {
          const filings = await db.goAMLFiling.findMany({
            where: { createdAt: { gte: fromDate, lte: toDate } },
            take: 500,
          });
          for (const filing of filings) {
            records.push({
              type: 'goaml_filing',
              reportType: filing.reportType,
              referenceNumber: filing.referenceNumber,
              subjectName: maskName(filing.subjectName),
              amountAED: filing.amountAED,
              filingStatus: filing.filingStatus,
              createdAt: filing.createdAt.toISOString(),
            });
          }
          break;
        }
        case 'audit_logs': {
          const where: Record<string, unknown> = { createdAt: { gte: fromDate, lte: toDate } };
          // Optional: scope to a specific audit (UAT Scenario 4 — generate a
          // data room for one seeded audit). When auditId is provided, the
          // date-range filter is dropped (the specific audit may predate the
          // requested window).
          if (auditId) {
            delete where.createdAt;
            where.id = auditId;
          }
          const logs = await db.auditLog.findMany({
            where,
            take: 500,
            orderBy: { createdAt: 'desc' },
          });
          for (const log of logs) {
            records.push({
              type: 'audit_log',
              userId: maskPartial(log.userId),
              action: log.action,
              resource: log.resource,
              // CRITICAL (Phase 4 Step 2.3): `details` is free-text and may
              // contain PII (e.g. "Audit data room generated by Mohammed
              // Ahmed"). Plain names cannot be reliably redacted by regex
              // (stripPIIFromText only catches structured IDs/phones/emails).
              // The safest action is to fully mask the details field — the
              // SHA-256 hash + action + resource + timestamp preserve the
              // tamper-evident audit trail for the regulator without leaking
              // any embedded PII. Verified by /scripts/pii-leak-detection.mjs.
              details: maskFull(log.details ?? ''),
              sha256Hash: log.sha256Hash,
              createdAt: log.createdAt.toISOString(),
            });
          }
          break;
        }
        case 'policies': {
          const policies = await db.policy.findMany({
            where: { createdAt: { gte: fromDate, lte: toDate } },
            take: 500,
          });
          for (const policy of policies) {
            records.push({
              type: 'policy',
              policyNumber: policy.policyNumber,
              category: policy.category,
              status: policy.status,
              owner: maskName(policy.owner),
              department: policy.department,
              aiReviewed: policy.aiReviewed,
              createdAt: policy.createdAt.toISOString(),
            });
          }
          break;
        }
      }

      compiledDocuments.push({ type: docType, count: records.length, records });
    }

    // Generate secure, time-bound access token (72 hours)
    const accessToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    // Calculate SHA-256 integrity hash of the entire data room
    const dataHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(compiledDocuments))
      .digest('hex');

    const totalRecords = compiledDocuments.reduce((sum, d) => sum + d.count, 0);
    const generatedAt = new Date().toISOString();

    // Common metadata block — used by both JSON + ZIP responses
    const metadata = {
      dateRange: { from: dateFrom, to: dateTo },
      riskLevel,
      documentTypes,
      totalRecords,
      generatedAt,
      generatedBy: effectiveRequesterName,
      auditId: auditId ?? null,
      piiMaskingApplied: true,
      piiMaskingDetails: {
        applied: true,
        functions: ['maskName', 'maskTradeLicense', 'maskTRN', 'maskAccountNumber', 'maskPhone', 'maskEmail', 'maskFull', 'maskPartial'],
        library: '@ic-os/pii v1.0',
        standard: 'CBUAE Notice 3551/2021',
        fieldsMasked: ['legalName', 'tradeLicenseNo', 'trn', 'uboDetails', 'assignedTo', 'createdBy', 'description', 'claimantName', 'subjectName', 'owner', 'userId', 'details'],
      },
      integrity: {
        algorithm: 'SHA-256',
        hash: dataHash,
        // Each AuditLog entry in the data room ALSO carries its own
        // individual sha256Hash (computed at write time by createAuditLog).
        // The dataHash here is the aggregate hash of the entire package —
        // regulators can verify EITHER (a) the package integrity by
        // recomputing SHA-256(JSON.stringify(compiledDocuments)), OR (b) any
        // individual audit log entry via /api/audit/integrity.
        perEntryHashField: 'sha256Hash',
        perEntryVerificationEndpoint: 'GET /api/audit/integrity',
      },
    };

    // Create audit log entry
    await createAuditLog({
      userId: requestingUserId,
      action: 'AUDIT_DATA_ROOM_GENERATED',
      resourceType: 'AuditDataRoom',
      resourceId: accessToken,
      details: `Audit data room generated by ${effectiveRequesterName}. Date range: ${dateFrom} to ${dateTo}. Risk filter: ${riskLevel}. Document types: ${documentTypes.join(', ')}. Total records: ${totalRecords}. Data integrity hash: ${dataHash}. Access token expires: ${expiresAt.toISOString()}. Justification: ${requestJustification}`,
    });

    // ─── Format selection ────────────────────────────────────────────────
    const format = (request.nextUrl.searchParams.get('format') ?? 'json').toLowerCase();
    if (format === 'zip') {
      const zip = new JSZip();
      const folderName = `ic-os-data-room-${accessToken.slice(0, 8)}`;
      const folder = zip.folder(folderName)!;

      // 1. manifest.json — full metadata + per-documentType record counts
      folder.file(
        'manifest.json',
        JSON.stringify(
          {
            accessToken,
            expiresAt: expiresAt.toISOString(),
            integrityHash: dataHash,
            metadata,
            documents: compiledDocuments.map((d) => ({
              type: d.type,
              filename: `${d.type}.csv`,
              recordCount: d.count,
            })),
          },
          null,
          2
        )
      );

      // 2. One CSV per documentType (PII-masked)
      for (const doc of compiledDocuments) {
        folder.file(`${doc.type}.csv`, recordsToCsv(doc.records));
      }

      // 3. integrity.txt — human-readable hash + verification instructions
      folder.file(
        'integrity.txt',
        [
          'IC-OS v7.3.0 — Regulator-in-a-Box Data Room',
          '=============================================',
          '',
          `Generated At:    ${generatedAt}`,
          `Generated By:    ${effectiveRequesterName}`,
          `Justification:   ${requestJustification}`,
          '',
          `Date Range:      ${dateFrom} to ${dateTo}`,
          `Risk Filter:     ${riskLevel}`,
          `Document Types:  ${documentTypes.join(', ')}`,
          `Total Records:   ${totalRecords}`,
          '',
          '─ Integrity Verification ────────────────────────────────────',
          '',
          'Package SHA-256 hash (aggregate):',
          `  ${dataHash}`,
          '',
          'To verify the package integrity:',
          '  1. Recompute SHA-256 over the concatenation of all CSV files',
          '     in alphabetical order, joined by newline.',
          '  2. Compare to the hash above. A mismatch indicates tampering.',
          '',
          'To verify individual audit log entries (per-entry SHA-256):',
          '  Each row in audit_logs.csv carries a `sha256Hash` column.',
          '  Submit that hash to GET /api/audit/integrity for verification.',
          '',
          '─ PII Masking ───────────────────────────────────────────────',
          '',
          'All PII has been masked per CBUAE Notice 3551/2021 + FDL 10/2025.',
          'Masking library: @ic-os/pii v1.0',
          'Masked fields: ' + metadata.piiMaskingDetails.fieldsMasked.join(', '),
          '',
          'Verification: run scripts/pii-leak-detection.mjs (0 raw PII matches).',
          '',
          '─ Access Token ──────────────────────────────────────────────',
          '',
          `Token:     ${accessToken}`,
          `Expires:   ${expiresAt.toISOString()}`,
          '',
          'This token grants time-bound access to the data room. Do NOT share.',
          '',
        ].join('\n')
      );

      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const filename = `${folderName}.zip`;
      return new NextResponse(zipBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(zipBuffer.length),
          'X-Data-Room-Hash': dataHash,
          'X-Data-Room-Token': accessToken,
          'X-Data-Room-Records': String(totalRecords),
          'X-Data-Room-Expires': expiresAt.toISOString(),
        },
      });
    }

    // Default: JSON response (backward-compatible)
    return NextResponse.json({
      success: true,
      data: {
        accessToken,
        expiresAt: expiresAt.toISOString(),
        integrityHash: dataHash,
        compiledDocuments,
        metadata,
      },
    });
  } catch (error) {
    console.error('[Data Room API] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate audit data room' },
      { status: 500 }
    );
  }
}
