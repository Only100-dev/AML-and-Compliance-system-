#!/usr/bin/env node
/**
 * Verify Attestations Route Audit-Hash Fix (v7.3.0-RC1-uat-final)
 * ----------------------------------------------------------------
 * End-to-end proof that the root-cause fix works: calling
 * POST /api/attestations now creates an AuditLog entry WITH a sha256Hash
 * (via createAuditLog()), and PUT /api/attestations (acknowledge) likewise.
 *
 * Flow:
 *   1. POST /api/attestations  → expect 201, capture attestationId
 *   2. Query DB: the ATTESTATION_CREATED audit log MUST have non-null sha256Hash
 *   3. PUT  /api/attestations  → expect 200 (acknowledge)
 *   4. Query DB: the ATTESTATION_ACKNOWLEDGED audit log MUST have non-null sha256Hash
 *   5. Re-run the verifier formula on both → hash MUST match (proves no mismatch)
 *   6. GET /api/audit/integrity?fresh=1 → valid=true, 0 violations, 0 missing
 *   7. CLEANUP: delete the 2 audit logs, the universal task, calendar event,
 *      and the attestation row (transactional). Uses a distinct sentinel
 *      "UAT-ROUTE-FIX-VERIFY" so cleanup is surgical.
 *
 * Usage: node scripts/verify-attestation-audit-fix.mjs
 */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const db = new PrismaClient();
const BASE = 'http://localhost:3000';
const SENTINEL = 'UAT-ROUTE-FIX-VERIFY';
const AUTH_HEADERS = { 'x-user-id': 'u', 'x-user-role': 'admin', 'content-type': 'application/json' };

function computeSHA256(data) {
  return createHash('sha256').update(data).digest('hex');
}
function expectedHash(entry) {
  return computeSHA256(JSON.stringify({
    userId: entry.userId,
    action: entry.action,
    resource: entry.resource,
    resourceId: entry.resourceId,
    details: entry.details ?? '',
    createdAt: entry.createdAt.toISOString(),
  }));
}

const results = { steps: [], cleanup: {}, passed: false };

function logStep(name, ok, detail) {
  const mark = ok ? '✓ PASS' : '✗ FAIL';
  console.log(`  ${mark} — ${name}${detail ? ': ' + detail : ''}`);
  results.steps.push({ name, ok, detail });
}

async function main() {
  console.log('═'.repeat(72));
  console.log(' Verify Attestations Route Audit-Hash Fix');
  console.log('═'.repeat(72));
  console.log(` Sentinel: ${SENTINEL}`);
  console.log('');

  // ── Pre-flight: capture baseline integrity count ──────────────────────
  const baselineTotal = await db.auditLog.count();
  const baselineNull = await db.auditLog.count({ where: { sha256Hash: null } });
  console.log(` Baseline: ${baselineTotal} audit entries, ${baselineNull} null-hash`);
  console.log('─'.repeat(72));

  // ── Step 1: POST /api/attestations ────────────────────────────────────
  console.log(' Step 1: POST /api/attestations (create test attestation)');
  const createBody = {
    policyId: 'test-policy-' + SENTINEL,
    policyNumber: SENTINEL,
    policyTitle: 'Route Fix Verification Policy',
    userId: 'u',
    userName: 'Verify Script',
    department: 'Compliance',
    version: '1.0',
    attestationDeadline: new Date(Date.now() + 7 * 86400000).toISOString(),
  };
  const createRes = await fetch(`${BASE}/api/attestations`, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify(createBody),
  });
  const createJson = await createRes.json();
  const attestationId = createJson?.data?.id;
  logStep('POST returns 201', createRes.status === 201, `status=${createRes.status}`);
  logStep('Response has attestation id', !!attestationId, `id=${attestationId}`);

  if (!attestationId) {
    console.log(' ✗ ABORT: no attestation id, cannot continue.');
    console.log(JSON.stringify(createJson, null, 2));
    return;
  }

  // ── Step 2: ATTESTATION_CREATED audit log has sha256Hash ──────────────
  console.log(' Step 2: verify ATTESTATION_CREATED audit log has a hash');
  const createdAudit = await db.auditLog.findFirst({
    where: { action: 'ATTESTATION_CREATED', resourceId: attestationId },
    orderBy: { createdAt: 'desc' },
  });
  logStep('Audit entry exists', !!createdAudit, `id=${createdAudit?.id}`);
  logStep('sha256Hash is non-null', !!createdAudit?.sha256Hash, `hash=${createdAudit?.sha256Hash?.slice(0, 16)}…`);
  const createdHashMatches =
    createdAudit?.sha256Hash && createdAudit.sha256Hash === expectedHash(createdAudit);
  logStep('Hash matches verifier formula', !!createdHashMatches, createdHashMatches ? 'match' : 'MISMATCH');

  // ── Step 3: PUT /api/attestations (acknowledge) ───────────────────────
  console.log(' Step 3: PUT /api/attestations (acknowledge)');
  const ackRes = await fetch(`${BASE}/api/attestations`, {
    method: 'PUT',
    headers: AUTH_HEADERS,
    body: JSON.stringify({ attestationId, userId: 'u' }),
  });
  const ackJson = await ackRes.json();
  logStep('PUT returns 200', ackRes.status === 200, `status=${ackRes.status}`);

  // ── Step 4: ATTESTATION_ACKNOWLEDGED audit log has sha256Hash ─────────
  console.log(' Step 4: verify ATTESTATION_ACKNOWLEDGED audit log has a hash');
  const ackAudit = await db.auditLog.findFirst({
    where: { action: 'ATTESTATION_ACKNOWLEDGED', resourceId: attestationId },
    orderBy: { createdAt: 'desc' },
  });
  logStep('Audit entry exists', !!ackAudit, `id=${ackAudit?.id}`);
  logStep('sha256Hash is non-null', !!ackAudit?.sha256Hash, `hash=${ackAudit?.sha256Hash?.slice(0, 16)}…`);
  const ackHashMatches = ackAudit?.sha256Hash && ackAudit.sha256Hash === expectedHash(ackAudit);
  logStep('Hash matches verifier formula', !!ackHashMatches, ackHashMatches ? 'match' : 'MISMATCH');

  // ── Step 5: Integrity endpoint still clean ────────────────────────────
  console.log(' Step 5: GET /api/audit/integrity?fresh=1');
  const integrityRes = await fetch(`${BASE}/api/audit/integrity?fresh=1`, { headers: AUTH_HEADERS });
  const integrityJson = await integrityRes.json();
  const d = integrityJson?.data ?? {};
  logStep('valid=true', d.valid === true, `valid=${d.valid}`);
  logStep('0 violations', Array.isArray(d.violations) && d.violations.length === 0, `violations=${d.violations?.length}`);
  logStep('0 missingHashCount', d.missingHashCount === 0, `missing=${d.missingHashCount}`);
  logStep('verifiedEntries === totalEntries', d.verifiedEntries === d.totalEntries, `${d.verifiedEntries}/${d.totalEntries}`);

  console.log('─'.repeat(72));

  // ── Step 6: CLEANUP (transactional, surgical by sentinel) ─────────────
  console.log(' Step 6: cleanup test records (transactional)');
  const auditIds = [createdAudit?.id, ackAudit?.id].filter(Boolean);
  const cleanup = await db.$transaction(async (tx) => {
    const t = await tx.universalTask.deleteMany({ where: { sourceId: attestationId } });
    const c = await tx.calendarEvent.deleteMany({ where: { sourceEntityId: attestationId } });
    const a = await tx.policyAttestation.deleteMany({ where: { id: attestationId } });
    const l = await tx.auditLog.deleteMany({ where: { id: { in: auditIds } } });
    return { t: t.count, c: c.count, a: a.count, l: l.count };
  });
  results.cleanup = cleanup;
  console.log(`   Deleted: ${cleanup.l} audit logs, ${cleanup.t} tasks, ${cleanup.c} calendar events, ${cleanup.a} attestations`);

  // ── Final: confirm we're back to baseline ─────────────────────────────
  const finalTotal = await db.auditLog.count();
  const finalNull = await db.auditLog.count({ where: { sha256Hash: null } });
  console.log(` Post-cleanup: ${finalTotal} audit entries, ${finalNull} null-hash (baseline was ${baselineTotal})`);

  const allPassed = results.steps.every((s) => s.ok) && finalTotal === baselineTotal && finalNull === 0;
  results.passed = allPassed;

  console.log('─'.repeat(72));
  console.log(` RESULT: ${allPassed ? '✓ ALL CHECKS PASSED — root-cause fix verified' : '✗ SOME CHECKS FAILED'}`);
  console.log('═'.repeat(72));
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error('[verify] FAILED:', e);
    results.passed = false;
    db.$disconnect();
    process.exit(1);
  });
