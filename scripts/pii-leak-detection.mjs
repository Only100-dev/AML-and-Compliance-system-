#!/usr/bin/env bun
/**
 * Phase 4 Step 2.3 — PII Leak Detection Script (P0 BLOCKER)
 * ------------------------------------------------------------------
 * Verifies that /api/audit/generate-data-room does NOT leak any raw PII
 * in its JSON response. This is the highest-risk security verification
 * in Phase 4: a regulator-facing data room that leaks PII is a P0
 * regulatory breach under CBUAE Notice 3551/2021 and FDL 10/2025 Art. 12.
 *
 * METHODOLOGY:
 *   1. POST /api/test/pii-fixtures (dev-only endpoint) — the Next.js
 *      server inserts mock records with KNOWN PII sentinels into every
 *      table the data room reads from (CorporateKYC, AMLAlert, Claim,
 *      GoAMLFiling, AuditLog, Policy). Routing the inserts through the
 *      server's own Prisma client avoids the SQLite concurrency conflict
 *      that occurs when an external process writes to the same DB file.
 *   2. POST /api/audit/generate-data-room with ALL document types.
 *   3. Stringify the response body and search for each known PII value.
 *      A single substring match = P0 LEAK (script exits 1).
 *   4. Also verify the masked representations ARE present (sanity check
 *      that the masking functions actually ran).
 *   5. DELETE /api/test/pii-fixtures to clean up the mock records.
 *
 * KNOWN PII SENTINELS (returned by the fixtures endpoint):
 *   - Full name:        "Mohammed Ahmed Al-Rashid"
 *   - Emirates ID:      "784-1990-1234567-1"
 *   - Phone:            "+971501234567"
 *   - Email:            "ahmed.mohammed@nbad.ae"
 *   - IBAN:             "AE070331234567890123456"
 *   - Trade license:    "CN-123456-PII"
 *   - TRN:              "100123456700003"
 *
 * ACCEPTANCE CRITERIA (verbatim from directive):
 *   If ANY raw PII is found in the "masked" output → P0 BLOCKER.
 */

const BASE = 'http://localhost:3000';

function log(msg) { console.log(`[pii-leak] ${msg}`); }
function pass(msg) { console.log(`  ✓ ${msg}`); }
function fail(msg) { console.error(`  ✗ ${msg}`); }

let exitCode = 0;

async function insertFixtures() {
  log('POST /api/test/pii-fixtures (inserting mock PII via server Prisma)...');
  const res = await fetch(`${BASE}/api/test/pii-fixtures`, { method: 'POST' });
  if (!res.ok) {
    fail(`Fixtures endpoint returned ${res.status}: ${await res.text()}`);
    return null;
  }
  const json = await res.json();
  if (!json.success) {
    fail(`Fixtures endpoint returned success=false: ${JSON.stringify(json)}`);
    return null;
  }
  pass(`Inserted ${json.inserted} mock records with PII sentinels.`);
  return json.sentinels;
}

async function generateDataRoom() {
  log('POST /api/audit/generate-data-room with ALL document types...');
  const fromDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const toDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const res = await fetch(`${BASE}/api/audit/generate-data-room`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateFrom: fromDate,
      dateTo: toDate,
      riskLevel: 'all',
      documentTypes: ['kyc', 'alerts', 'transactions', 'filings', 'audit_logs', 'policies'],
      requestingUserId: 'pii-leak-tester',
      requestingUserName: 'PII Leak Tester',
      requestJustification: 'Phase 4 Step 2.3 PII leak detection test — regulator data room verification.',
    }),
  });

  if (!res.ok) {
    fail(`Data room API returned ${res.status}: ${await res.text()}`);
    return null;
  }
  const json = await res.json();
  if (!json.success) {
    fail(`Data room API returned success=false: ${JSON.stringify(json)}`);
    return null;
  }
  const totalRecords = json.data?.metadata?.totalRecords ?? 0;
  pass(`Data room generated: ${totalRecords} records, integrityHash=${json.data?.integrityHash?.slice(0, 16)}...`);
  return json;
}

function searchForPii(haystack, piiValue, label) {
  const matches = haystack.split(piiValue).length - 1;
  if (matches > 0) {
    fail(`P0 LEAK: raw "${label}" (${piiValue}) found ${matches}x in data room output!`);
    return false;
  }
  pass(`No leak: "${label}" not found in output.`);
  return true;
}

function verifyMaskingPresent(haystack) {
  // Sanity: confirm masking functions actually ran.
  // maskName("Mohammed Ahmed Al-Rashid") → "M. A. A."
  if (haystack.includes('M. A. A.')) {
    pass(`Masking verified: "M. A. A." (maskName initials) present in output.`);
  } else {
    fail(`Sanity check: "M. A. A." (expected maskName output) NOT found — masking may not have run.`);
    exitCode = 1;
  }
  // maskFull returns "********" — should appear for audit log details + uboDetails
  if (haystack.includes('********')) {
    pass(`Masking verified: "********" (maskFull) present in output (audit log details / UBO details).`);
  } else {
    fail(`Sanity check: "********" (expected maskFull output) NOT found — audit log details masking may not have run.`);
    exitCode = 1;
  }
}

async function cleanupFixtures() {
  log('DELETE /api/test/pii-fixtures (cleaning up mock records)...');
  try {
    const res = await fetch(`${BASE}/api/test/pii-fixtures`, { method: 'DELETE' });
    if (res.ok) {
      const json = await res.json();
      pass(`Cleanup: ${JSON.stringify(json.deleted)}`);
    } else {
      fail(`Cleanup returned ${res.status}`);
    }
  } catch (e) {
    fail(`Cleanup error: ${e.message}`);
  }
}

async function main() {
  log('=== Phase 4 Step 2.3 — PII Leak Detection (P0) ===');
  let sentinels = null;
  try {
    sentinels = await insertFixtures();
    if (!sentinels) {
      fail('Fixture insertion failed — cannot verify PII masking.');
      exitCode = 1;
      return;
    }

    const dataRoom = await generateDataRoom();
    if (!dataRoom) {
      fail('Data room generation failed — cannot verify PII masking.');
      exitCode = 1;
      return;
    }

    const haystack = JSON.stringify(dataRoom);
    log(`Response size: ${haystack.length} bytes. Searching for ${Object.keys(sentinels).length} PII sentinels...`);

    let allClean = true;
    allClean = searchForPii(haystack, sentinels.fullName, 'full name') && allClean;
    allClean = searchForPii(haystack, sentinels.emiratesId, 'Emirates ID') && allClean;
    allClean = searchForPii(haystack, sentinels.phone, 'phone number') && allClean;
    allClean = searchForPii(haystack, sentinels.email, 'email') && allClean;
    allClean = searchForPii(haystack, sentinels.iban, 'IBAN') && allClean;
    allClean = searchForPii(haystack, sentinels.tradeLicense, 'trade license') && allClean;
    allClean = searchForPii(haystack, sentinels.trn, 'TRN') && allClean;

    verifyMaskingPresent(haystack);

    log('');
    if (allClean && exitCode === 0) {
      console.log('═'.repeat(70));
      console.log('  ✓ PII LEAK DETECTION: PASS — 0 raw PII values in data room output.');
      console.log('═'.repeat(70));
      exitCode = 0;
    } else {
      console.log('═'.repeat(70));
      console.error('  ✗ PII LEAK DETECTION: FAIL — P0 BLOCKER. Raw PII found in output.');
      console.error('    Halting all other work per directive. Fix immediately.');
      console.log('═'.repeat(70));
      exitCode = 1;
    }
  } finally {
    await cleanupFixtures();
  }
  process.exit(exitCode);
}

main();
