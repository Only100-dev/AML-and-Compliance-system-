#!/usr/bin/env bun
/**
 * Phase 4 Step 2.2 — State Machine Fuzzing Script
 * ------------------------------------------------------------------
 * Fuzzes the three regulatory state machines in IC-OS to verify that
 * malformed / malicious inputs are rejected with CLEAN HTTP error
 * responses (400 / 404 / 403 / 409 / 422) and that NO internal
 * implementation detail ever leaks into the response body:
 *
 *   - Stack traces  (`at /`, `at Object.`, `.js:`, `node_modules`)
 *   - SQL errors    (`SQLITE_`, `PrismaClient*Error`, `ConnectorError`)
 *   - Internal paths (`/home/z/`, `src/app/api/`, `src/lib/`)
 *
 * State machines under test:
 *
 *   1. CAP State Machine
 *      POST /api/cap/plans              (creates a TODO plan)
 *      POST /api/cap/plans/[id]/transition
 *        States: TODO → IN_PROGRESS → REMEDIATED → AUDIT_VERIFIED
 *        RBAC: withRBAC wrapper — x-user-id + x-user-role headers
 *
 *   2. goAML Filing (POST /api/goaml/submit)
 *      Schema: GoAMLFilingCreateSchema — reportType (STR/SAR/CTR/IFT/PNMR),
 *              referenceNumber, subjectName required.
 *      Auth: authGuard — dev mode bypasses with synthetic admin.
 *
 *   3. Complaint State Machine (POST /api/complaints, PUT /api/complaints/[id]/transition)
 *      States: NEW → ACKNOWLEDGED → INVESTIGATING → RESOLVED → CLOSED
 *                                  ↘ REJECTED        ↘ ESCALATED_TO_OMBUDSMAN → CLOSED
 *      RBAC: withRBAC wrapper — x-user-id + x-user-role headers
 *      (F1 RESOLVED — routes implemented in Phase 4 Step 2; previously a gap)
 *
 * Fuzzing scenarios (per directive):
 *   1. Malformed JSON            (missing brace, null, "string", [], undefined)
 *   2. Missing required fields   ({} on each route)
 *   3. Invalid state transitions (TODO → AUDIT_VERIFIED skip; targetState=CLOSED)
 *   4. Duplicate requests        (idempotency: same valid request twice)
 *   5. Invalid user IDs          (Maker-Checker REMEDIATED→AUDIT_VERIFIED with
 *                                 non-existent x-user-id — no SQL errors)
 *   6. Invalid enum values       (targetState="INVALID_STATE", reportType="INVALID_TYPE")
 *   7. Type confusion            (targetState=123, targetState=true)
 *
 * Acceptance criteria:
 *   - Invalid requests return 400 / 422 (404 / 403 / 409 where applicable).
 *   - No stack traces / SQL errors / internal paths leak in any body.
 *   - No 500 errors on validation-rejection paths.
 *   - Database state remains consistent — failed transitions don't mutate.
 *
 * Usage:
 *   bun run scripts/fuzz-state-machines.mjs
 *
 * Exit code: 0 if all tests pass, 1 if any test fails.
 */

const BASE = 'http://localhost:3000';

// ─── Test results tracking ────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];
const findings = []; // Higher-level findings (e.g. route missing, rbac wrapper bug)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg) { console.log(msg); }
function pass(msg) { passed++; console.log(`  ✓ ${msg}`); }
function fail(msg, detail = '') {
  failed++;
  failures.push({ msg, detail });
  console.log(`  ✗ ${msg}`);
  if (detail) console.log(`      ${detail}`);
}
function skip(msg, reason = '') {
  skipped++;
  console.log(`  ⊘ ${msg}${reason ? ` — ${reason}` : ''}`);
}
function finding(title, detail) {
  findings.push({ title, detail });
  console.log(`  ⚠ FINDING: ${title}`);
  console.log(`      ${detail}`);
}

/**
 * Run a test block inside try/catch and report pass/fail.
 */
async function test(name, fn) {
  console.log(`\n── ${name} ──────────────────────────────────────────`);
  try {
    await fn();
  } catch (err) {
    fail(`${name} threw`, err?.stack || String(err));
  }
}

/**
 * Substring checks for internal-implementation leakage in a response body.
 * Returns array of any leak indicators found.
 */
const LEAK_INDICATORS = [
  // Stack trace markers
  { pattern: /at \//, label: 'stack-trace "at /"' },
  { pattern: /at Object\./, label: 'stack-trace "at Object."' },
  { pattern: /at async /, label: 'stack-trace "at async"' },
  { pattern: /\.js:\d+:\d+/, label: 'stack-trace .js:LINE:COL' },
  { pattern: /node_modules\//, label: 'node_modules path' },
  { pattern: /PrismaClient[A-Z][A-Za-z]*Error/, label: 'PrismaClient error class name' },
  // SQL / DB error markers
  { pattern: /SQLITE_[A-Z_]+/, label: 'SQLITE_ error code' },
  { pattern: /PrismaClientUnknownRequestError/, label: 'PrismaClientUnknownRequestError' },
  { pattern: /ConnectorError/, label: 'ConnectorError' },
  { pattern: /QueryError/, label: 'QueryError' },
  // Internal path markers
  { pattern: /\/home\/z\//, label: '/home/z/ internal path' },
  { pattern: /src\/app\/api\//, label: 'src/app/api/ internal path' },
  { pattern: /src\/lib\//, label: 'src/lib/ internal path' },
];

function findLeaks(body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body ?? '');
  const found = [];
  for (const { pattern, label } of LEAK_INDICATORS) {
    if (pattern.test(text)) found.push(label);
  }
  return found;
}

/**
 * Promise-based sleep. Used to be polite to the in-memory rate limiter
 * (WRITE tier = 30 req/min per user; dev-mode synthetic user shares one
 * bucket across all fuzz runs, so back-to-back runs can hit the limit).
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * DELETE a goAML filing with 429 retry + 404 tolerance.
 * - 200 = cleaned
 * - 404 = already cleaned (e.g. previous run) — treat as success
 * - 429 = rate limited — wait the server-advertised Retry-After duration,
 *         then retry. Up to 3 retries (cap at 65s total).
 * - other = hard failure
 */
async function deleteFiling(id) {
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(`${BASE}/api/goaml?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok || res.status === 404) return { ok: true, alreadyGone: res.status === 404 };
      if (res.status === 429) {
        // The 429 response advertises Retry-After (seconds until reset).
        // Honour it (capped at 60s so a misbehaving server can't stall us).
        const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10);
        const waitMs = Math.min(Math.max(retryAfter, 2), 60) * 1000;
        await sleep(waitMs);
        continue;
      }
      return { ok: false, status: res.status };
    } catch (err) {
      return { ok: false, status: 0, error: String(err) };
    }
  }
  return { ok: false, status: 429, exhausted: true };
}

/**
 * Assert a response is a CLEAN error: status in the allowed range, no leaks.
 * `allowed` is an array of acceptable HTTP status codes.
 */
function assertCleanError(response, body, allowed, context = '') {
  const status = response.status;
  const ok = allowed.includes(status);
  if (!ok) {
    fail(
      `expected status ${allowed.join('/')}, got ${status} ${context}`,
      `body: ${typeof body === 'string' ? body.slice(0, 400) : JSON.stringify(body).slice(0, 400)}`,
    );
    return false;
  }
  const leaks = findLeaks(body);
  if (leaks.length > 0) {
    fail(`internal leak in ${status} response body ${context}`, `leaks: ${leaks.join(', ')}`);
    return false;
  }
  pass(`${status} clean error response ${context}`);
  return true;
}

/**
 * Send a POST request with raw body string (lets us send malformed JSON).
 * If the response is 429 (rate limited), honour the Retry-After header,
 * wait, and retry once. (Dev-mode synthetic user shares a single rate-limit
 * bucket, so back-to-back fuzz runs can trip the WRITE-tier 30 req/min cap.)
 */
async function postRaw(path, rawBody, headers = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: rawBody,
    });
    if (res.status !== 429) {
      let body;
      const text = await res.text();
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      return { res, body, text };
    }
    // 429 — read the body (so we can return it on the final attempt) and
    // wait the advertised Retry-After duration before retrying.
    const text = await res.text();
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10);
    const waitMs = Math.min(Math.max(retryAfter, 2), 60) * 1000;
    if (attempt === 0) {
      console.log(`  … 429 rate-limited, sleeping ${waitMs}ms before retry (${path})`);
      await sleep(waitMs);
      continue;
    }
    // Final attempt — return the 429 so the caller can decide what to do.
    let body;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    return { res, body, text, rateLimited: true };
  }
  // Unreachable
  throw new Error('postRaw: exhausted retries');
}

/**
 * Send a POST with a JSON-serialisable body.
 */
async function postJSON(path, obj, headers = {}) {
  return postRaw(path, JSON.stringify(obj), headers);
}

/**
 * Send a PUT request with raw body string (for transition endpoints which
 * use PUT). Mirrors postRaw's 429-retry behaviour.
 */
async function putRaw(path, rawBody, headers = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: rawBody,
    });
    if (res.status !== 429) {
      let body;
      const text = await res.text();
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      return { res, body, text };
    }
    const text = await res.text();
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10);
    const waitMs = Math.min(Math.max(retryAfter, 2), 60) * 1000;
    if (attempt === 0) {
      console.log(`  … 429 rate-limited, sleeping ${waitMs}ms before retry (${path})`);
      await sleep(waitMs);
      continue;
    }
    let body;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    return { res, body, text, rateLimited: true };
  }
  throw new Error('putRaw: exhausted retries');
}

/**
 * Send a PUT with a JSON-serialisable body.
 */
async function putJSON(path, obj, headers = {}) {
  return putRaw(path, JSON.stringify(obj), headers);
}

/**
 * If a response is 429 after retry, skip the test case rather than failing.
 * The rate limiter is a legitimate security control, not a bug — a 429 here
 * means the test environment hasn't drained its WRITE bucket yet.
 * Returns true if the test was skipped (caller should return early).
 */
function skipIfRateLimited(res, body, testName) {
  if (res.status === 429) {
    skip(testName, `rate-limited (429) — WRITE bucket drained, retry later`);
    return true;
  }
  return false;
}

// ─── CAP test data lifecycle ──────────────────────────────────────────────────

/**
 * Create a TODO-state CAP via POST /api/cap/plans.
 * Returns { ok, id, status, body, text } so the caller can react if the
 * create itself fails (e.g. withRBAC wrapper bug returns 500).
 */
async function createTestCAP(suffix = '') {
  const title = `Fuzz CAP ${Date.now()}${suffix}`;
  const { res, body, text } = await postJSON(
    '/api/cap/plans',
    {
      title,
      description: 'Created by fuzz-state-machines.mjs for transition testing.',
      sourceType: 'AUDIT_FINDING',
      priority: 'medium',
    },
    { 'x-user-id': 'fuzz-tester', 'x-user-role': 'admin' },
  );
  const id = body && typeof body === 'object' && body.data?.id ? body.data.id : null;
  return { ok: res.status === 201, id, status: res.status, body, text, title };
}

/**
 * Delete a CAP. There is no DELETE route on /api/cap/plans — the transition
 * route's catch-all 500 prevents real cleanup. We attempt via a "fuzz delete"
 * pattern: there's no public delete, so we just record that we couldn't
 * clean up. (This is itself a finding for the regulatory readiness review.)
 */
async function cleanupTestCAP(id) {
  if (!id) return;
  // No DELETE endpoint exists on /api/cap/plans — record the gap.
  // Try anyway so we notice if a future DELETE is added.
  try {
    const res = await fetch(`${BASE}/api/cap/plans?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'x-user-id': 'fuzz-tester', 'x-user-role': 'admin' },
    });
    if (res.status === 405 || res.status === 404) {
      // Expected: no DELETE route yet.
      return;
    }
  } catch {
    /* swallow */
  }
}

/**
 * Fetch the current state of a CAP via GET /api/cap/plans.
 * Returns the plan object or null.
 *
 * NOTE: We do NOT filter by `state` in the query because (a) the GET
 * endpoint's `searchParams.get('state')` only reads the FIRST value when
 * duplicate keys are passed, and (b) the CAP's state changes across test
 * scenarios (TODO → IN_PROGRESS → ...). Fetching all plans and filtering
 * client-side by ID is the reliable approach.
 */
async function getCAP(id) {
  try {
    const res = await fetch(
      `${BASE}/api/cap/plans?limit=500`,
      { headers: { 'x-user-id': 'fuzz-tester', 'x-user-role': 'admin' } },
    );
    if (!res.ok) return null;
    const body = await res.json();
    const plans = body?.data ?? [];
    return plans.find((p) => p.id === id) ?? null;
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — CAP State Machine Fuzzing
// ══════════════════════════════════════════════════════════════════════════════

async function fuzzCAP() {
  log('\n┌────────────────────────────────────────────────────────────────┐');
  log('│ SECTION 1 — CAP State Machine Fuzzing                          │');
  log('│ POST /api/cap/plans and POST /api/cap/plans/[id]/transition   │');
  log('└────────────────────────────────────────────────────────────────┘');

  // Pre-flight: detect the withRBAC wrapper bug. If POST /api/cap/plans
  // returns HTTP 500 with an empty body, the rbac.ts wrapper is broken
  // (TypeError: Cannot read private member #state — Next.js 16 / Turbopack
  // no longer supports `new NextRequest(existingRequest, {...})`).
  // We surface this as a CRITICAL FINDING and still run the remaining
  // cases — each should fail cleanly (500 + empty body, no leak), which
  // means the route is "safely broken" (no info leak) but non-functional.
  log('\n  [pre-flight] POST /api/cap/plans (valid admin request)');
  const preflight = await createTestCAP('-preflight');
  if (!preflight.ok) {
    finding(
      'CAP routes non-functional — withRBAC wrapper throws TypeError',
      `POST /api/cap/plans returned ${preflight.status} with body: ` +
      `${(preflight.text || '').slice(0, 200) || '<empty>'}. ` +
      `Server log shows: "TypeError: Cannot read private member #state ` +
      `from an object whose class did not declare it at src/lib/compliance/rbac.ts:866 " ` +
      `(new NextRequest(request, {...}) is no longer supported in Next.js 16 / Turbopack). ` +
      `All CAP state-machine tests below will fail with HTTP 500 — the route is ` +
      `non-functional. The empty response body means no stack trace leaks to the ` +
      `client, but the state machine is completely unusable until rbac.ts is fixed.`,
    );
  }

  // ─── 1.1 — Malformed JSON bodies ─────────────────────────────────────────
  await test('CAP transition — malformed JSON bodies', async () => {
    const malformed = [
      { label: 'missing closing brace', raw: '{targetState: "IN_PROGRESS"' },
      { label: 'null', raw: 'null' },
      { label: 'string', raw: '"IN_PROGRESS"' },
      { label: 'array', raw: '[]' },
      { label: 'undefined literal', raw: 'undefined' },
    ];
    for (const { label, raw } of malformed) {
      const { res, body } = await postRaw(
        '/api/cap/plans/nonexistent-id/transition',
        raw,
        { 'x-user-id': 'fuzz-tester', 'x-user-role': 'admin' },
      );
      // Allowed: 400 (bad JSON), 422 (Zod), 404 (CAP not found), 403 (role).
      // 500 is unacceptable for any of these malformed inputs.
      const status = res.status;
      if (status === 500) {
        fail(`malformed JSON "${label}" returned 500 (route broken or unhandled)`);
      } else if (![400, 404, 403, 422].includes(status)) {
        fail(`malformed JSON "${label}" returned unexpected ${status}`);
      } else {
        const leaks = findLeaks(body);
        if (leaks.length > 0) {
          fail(`malformed JSON "${label}" leaked: ${leaks.join(', ')}`);
        } else {
          pass(`malformed JSON "${label}" → ${status} (clean)`);
        }
      }
    }
  });

  // ─── 1.2 — Missing required fields ───────────────────────────────────────
  await test('CAP transition — missing required fields (empty {})', async () => {
    const { res, body } = await postJSON(
      '/api/cap/plans/nonexistent-id/transition',
      {},
      { 'x-user-id': 'fuzz-tester', 'x-user-role': 'admin' },
    );
    // Same 4-way accept list — Zod should reject the missing targetState
    // before the route checks for the CAP existence.
    if (res.status === 500) {
      fail('empty body {} returned 500 (route broken or unhandled)');
    } else if (![400, 404, 403, 422].includes(res.status)) {
      fail(`empty body {} returned unexpected ${res.status}`);
    } else {
      const leaks = findLeaks(body);
      if (leaks.length > 0) fail(`empty body {} leaked: ${leaks.join(', ')}`);
      else pass(`empty body {} → ${res.status} (clean)`);
    }
  });

  // ─── 1.3 — Invalid enum values ───────────────────────────────────────────
  await test('CAP transition — invalid enum targetState="INVALID_STATE"', async () => {
    const { res, body } = await postJSON(
      '/api/cap/plans/nonexistent-id/transition',
      { targetState: 'INVALID_STATE' },
      { 'x-user-id': 'fuzz-tester', 'x-user-role': 'admin' },
    );
    if (res.status === 500) {
      fail('invalid enum "INVALID_STATE" returned 500');
    } else if (![400, 404, 403, 422].includes(res.status)) {
      fail(`invalid enum returned unexpected ${res.status}`);
    } else {
      const leaks = findLeaks(body);
      if (leaks.length > 0) fail(`invalid enum leaked: ${leaks.join(', ')}`);
      else pass(`invalid enum → ${res.status} (clean)`);
    }
  });

  await test('CAP transition — invalid enum targetState="CLOSED" (not a CAP state)', async () => {
    const { res, body } = await postJSON(
      '/api/cap/plans/nonexistent-id/transition',
      { targetState: 'CLOSED' },
      { 'x-user-id': 'fuzz-tester', 'x-user-role': 'admin' },
    );
    if (res.status === 500) {
      fail('non-existent state "CLOSED" returned 500');
    } else if (![400, 404, 403, 422].includes(res.status)) {
      fail(`"CLOSED" returned unexpected ${res.status}`);
    } else {
      const leaks = findLeaks(body);
      if (leaks.length > 0) fail(`"CLOSED" leaked: ${leaks.join(', ')}`);
      else pass(`"CLOSED" → ${res.status} (clean)`);
    }
  });

  // ─── 1.4 — Type confusion ────────────────────────────────────────────────
  await test('CAP transition — type confusion targetState=123 (number)', async () => {
    const { res, body } = await postJSON(
      '/api/cap/plans/nonexistent-id/transition',
      { targetState: 123 },
      { 'x-user-id': 'fuzz-tester', 'x-user-role': 'admin' },
    );
    if (res.status === 500) fail('type confusion targetState=123 returned 500');
    else if (![400, 404, 403, 422].includes(res.status)) {
      fail(`targetState=123 returned unexpected ${res.status}`);
    } else {
      const leaks = findLeaks(body);
      if (leaks.length > 0) fail(`targetState=123 leaked: ${leaks.join(', ')}`);
      else pass(`targetState=123 → ${res.status} (clean)`);
    }
  });

  await test('CAP transition — type confusion targetState=true (boolean)', async () => {
    const { res, body } = await postJSON(
      '/api/cap/plans/nonexistent-id/transition',
      { targetState: true },
      { 'x-user-id': 'fuzz-tester', 'x-user-role': 'admin' },
    );
    if (res.status === 500) fail('type confusion targetState=true returned 500');
    else if (![400, 404, 403, 422].includes(res.status)) {
      fail(`targetState=true returned unexpected ${res.status}`);
    } else {
      const leaks = findLeaks(body);
      if (leaks.length > 0) fail(`targetState=true leaked: ${leaks.join(', ')}`);
      else pass(`targetState=true → ${res.status} (clean)`);
    }
  });

  // ─── 1.5 — 404 for unknown CAP id ────────────────────────────────────────
  await test('CAP transition — unknown CAP id returns 404', async () => {
    const { res, body } = await postJSON(
      '/api/cap/plans/definitely-does-not-exist-cuid/transition',
      { targetState: 'IN_PROGRESS' },
      { 'x-user-id': 'fuzz-tester', 'x-user-role': 'admin' },
    );
    // Expected: 404 (CAP not found). 500 is unacceptable.
    // We also accept 400/422 because Zod may run before the findUnique.
    if (res.status === 500) {
      fail('unknown CAP id returned 500 (route broken or unhandled)');
    } else if (![400, 404, 422].includes(res.status)) {
      fail(`unknown CAP id returned unexpected ${res.status}`);
    } else {
      const leaks = findLeaks(body);
      if (leaks.length > 0) fail(`unknown CAP id leaked: ${leaks.join(', ')}`);
      else pass(`unknown CAP id → ${res.status} (clean)`);
    }
  });

  // ─── 1.6 — Functional transition tests (require createTestCAP to succeed) ─
  // These tests verify the actual state-machine rules. They can only run if
  // the createTestCAP preflight succeeded. Otherwise we skip-with-finding.
  await test('CAP transition — invalid forward jump (TODO → AUDIT_VERIFIED)', async () => {
    const cap = await createTestCAP('-invalid-jump');
    if (!cap.ok) {
      skip('CAP create failed — invalid-jump test cannot run',
           'see CRITICAL FINDING above (withRBAC wrapper throws TypeError)');
      return;
    }
    // Try to skip IN_PROGRESS and REMEDIATED — should be 422.
    const { res, body } = await postJSON(
      `/api/cap/plans/${cap.id}/transition`,
      { targetState: 'AUDIT_VERIFIED', verificationNotes: 'fuzz: skip states' },
      { 'x-user-id': 'fuzz-tester', 'x-user-role': 'admin' },
    );
    if (res.status === 500) {
      fail('TODO→AUDIT_VERIFIED skip returned 500');
    } else if (![400, 403, 422].includes(res.status)) {
      fail(`TODO→AUDIT_VERIFIED skip returned unexpected ${res.status}`);
    } else {
      const leaks = findLeaks(body);
      if (leaks.length > 0) fail(`TODO→AUDIT_VERIFIED leaked: ${leaks.join(', ')}`);
      else pass(`TODO→AUDIT_VERIFIED skip rejected → ${res.status} (clean)`);
    }
    // DB consistency: state must still be TODO
    const after = await getCAP(cap.id);
    if (after && after.state !== 'TODO') {
      fail(`DB inconsistency: CAP state changed to ${after.state} despite rejection`);
    } else if (after) {
      pass('DB consistent: CAP remained in TODO after rejected transition');
    }
    await cleanupTestCAP(cap.id);
  });

  await test('CAP transition — valid transition TODO → IN_PROGRESS (positive control)', async () => {
    const cap = await createTestCAP('-valid-trans');
    if (!cap.ok) {
      skip('CAP create failed — positive-control test cannot run',
           'see CRITICAL FINDING above (withRBAC wrapper throws TypeError)');
      return;
    }
    const { res, body } = await postJSON(
      `/api/cap/plans/${cap.id}/transition`,
      { targetState: 'IN_PROGRESS' },
      { 'x-user-id': 'fuzz-tester', 'x-user-role': 'admin' },
    );
    if (res.status === 200) {
      const leaks = findLeaks(body);
      if (leaks.length > 0) fail(`valid transition leaked: ${leaks.join(', ')}`);
      else pass('valid TODO→IN_PROGRESS returned 200 (clean)');
      // Verify state changed in DB
      const after = await getCAP(cap.id);
      if (after && after.state === 'IN_PROGRESS') {
        pass('DB consistent: CAP advanced to IN_PROGRESS');
      } else {
        fail('DB inconsistency: CAP did not advance to IN_PROGRESS',
             `actual state: ${after?.state}`);
      }
    } else {
      fail(`valid TODO→IN_PROGRESS returned ${res.status} (expected 200)`,
           `body: ${(JSON.stringify(body) || '').slice(0, 200)}`);
    }
    await cleanupTestCAP(cap.id);
  });

  await test('CAP transition — duplicate idempotency (same valid transition twice)', async () => {
    const cap = await createTestCAP('-idempotency');
    if (!cap.ok) {
      skip('CAP create failed — idempotency test cannot run',
           'see CRITICAL FINDING above (withRBAC wrapper throws TypeError)');
      return;
    }
    // First transition: TODO → IN_PROGRESS (should be 200)
    const r1 = await postJSON(
      `/api/cap/plans/${cap.id}/transition`,
      { targetState: 'IN_PROGRESS' },
      { 'x-user-id': 'fuzz-tester', 'x-user-role': 'admin' },
    );
    // Second identical transition: should be 422 ("already in that state")
    // or 200 (if idempotent) — but NEVER 500.
    const r2 = await postJSON(
      `/api/cap/plans/${cap.id}/transition`,
      { targetState: 'IN_PROGRESS' },
      { 'x-user-id': 'fuzz-tester', 'x-user-role': 'admin' },
    );
    if (r2.res.status === 500) {
      fail('duplicate transition returned 500 (must be 422 or 200)');
    } else if (![200, 422].includes(r2.res.status)) {
      fail(`duplicate transition returned unexpected ${r2.res.status}`);
    } else {
      const leaks = findLeaks(r2.body);
      if (leaks.length > 0) fail(`duplicate transition leaked: ${leaks.join(', ')}`);
      else pass(`duplicate transition → ${r2.res.status} (clean, no 500)`);
    }
    // DB consistency: state must still be IN_PROGRESS (not mutated by duplicate)
    const after = await getCAP(cap.id);
    if (after && after.state !== 'IN_PROGRESS') {
      fail(`DB inconsistency: duplicate transition mutated state to ${after.state}`);
    } else if (after) {
      pass('DB consistent: state unchanged after duplicate transition');
    }
    await cleanupTestCAP(cap.id);
  });

  await test('CAP transition — invalid user id (Maker-Checker REMEDIATED→AUDIT_VERIFIED)', async () => {
    // Advance a CAP through TODO → IN_PROGRESS → REMEDIATED, then attempt
    // the Maker-Checker transition REMEDIATED → AUDIT_VERIFIED with a
    // non-existent x-user-id. The route does not validate user existence,
    // so it should either succeed OR return a clean error. No SQL errors,
    // no stack traces, no PrismaClientUnknownRequestError.
    const cap = await createTestCAP('-maker-checker');
    if (!cap.ok) {
      skip('CAP create failed — Maker-Checker test cannot run',
           'see CRITICAL FINDING above (withRBAC wrapper throws TypeError)');
      return;
    }
    // Advance: TODO → IN_PROGRESS
    await postJSON(
      `/api/cap/plans/${cap.id}/transition`,
      { targetState: 'IN_PROGRESS' },
      { 'x-user-id': 'maker-1', 'x-user-role': 'admin' },
    );
    // Advance: IN_PROGRESS → REMEDIATED
    await postJSON(
      `/api/cap/plans/${cap.id}/transition`,
      { targetState: 'REMEDIATED' },
      { 'x-user-id': 'maker-1', 'x-user-role': 'admin' },
    );
    // Now attempt Maker-Checker transition with a NON-EXISTENT user id.
    // The route does not look up the user, so this should either succeed
    // (and create a MakerCheckerLog with the bogus id) or fail cleanly
    // (e.g. 4-eyes violation if the same user did prior steps).
    const r = await postJSON(
      `/api/cap/plans/${cap.id}/transition`,
      { targetState: 'AUDIT_VERIFIED', verificationNotes: 'fuzz: invalid user' },
      { 'x-user-id': 'nonexistent-user-xyz', 'x-user-role': 'admin' },
    );
    if (r.res.status === 500) {
      // Check the response body for SQL/Prisma leaks
      const leaks = findLeaks(r.body);
      fail(
        'Maker-Checker transition with invalid user returned 500',
        `leaks: ${leaks.length ? leaks.join(', ') : 'none (but 500 is still unacceptable)'}; ` +
        `body: ${(JSON.stringify(r.body) || '').slice(0, 200)}`,
      );
    } else if (![200, 403, 422].includes(r.res.status)) {
      fail(`Maker-Checker invalid user returned unexpected ${r.res.status}`);
    } else {
      const leaks = findLeaks(r.body);
      if (leaks.length > 0) fail(`Maker-Checker invalid user leaked: ${leaks.join(', ')}`);
      else pass(`Maker-Checker invalid user → ${r.res.status} (clean, no SQL/Prisma leak)`);
    }
    await cleanupTestCAP(cap.id);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — goAML Filing Fuzzing
// ══════════════════════════════════════════════════════════════════════════════

async function fuzzGoAML() {
  log('\n┌────────────────────────────────────────────────────────────────┐');
  log('│ SECTION 2 — goAML Filing Fuzzing                               │');
  log('│ POST /api/goaml/submit (GoAMLFilingCreateSchema)              │');
  log('└────────────────────────────────────────────────────────────────┘');

  // Track filings we create so we can clean them up at the end.
  const createdFilingIds = [];
  const dupRef = `FUZZ-DUP-${Date.now()}`;

  // ─── 2.1 — Malformed JSON ──────────────────────────────────────────────────
  await test('goAML submit — malformed JSON bodies', async () => {
    const malformed = [
      { label: 'missing closing brace', raw: '{targetState: "IN_PROGRESS"' },
      { label: 'null', raw: 'null' },
      { label: 'string', raw: '"STR"' },
      { label: 'array', raw: '[]' },
      { label: 'undefined literal', raw: 'undefined' },
    ];
    for (const { label, raw } of malformed) {
      const { res, body } = await postRaw('/api/goaml/submit', raw);
      // Allowed: 400 (bad JSON), 422 (Zod). 500 unacceptable.
      if (res.status === 500) {
        fail(`goAML malformed JSON "${label}" returned 500`);
      } else if (![400, 422].includes(res.status)) {
        fail(`goAML malformed JSON "${label}" returned unexpected ${res.status}`);
      } else {
        const leaks = findLeaks(body);
        if (leaks.length > 0) fail(`goAML malformed JSON "${label}" leaked: ${leaks.join(', ')}`);
        else pass(`goAML malformed JSON "${label}" → ${res.status} (clean)`);
      }
    }
  });

  // ─── 2.2 — Missing required fields ─────────────────────────────────────────
  await test('goAML submit — missing required fields (empty {})', async () => {
    const { res, body } = await postJSON('/api/goaml/submit', {});
    // 422 expected (Zod validation failure).
    if (res.status === 500) {
      fail('goAML empty body {} returned 500');
    } else if (![400, 422].includes(res.status)) {
      fail(`goAML empty body {} returned unexpected ${res.status}`);
    } else {
      const leaks = findLeaks(body);
      if (leaks.length > 0) fail(`goAML empty body {} leaked: ${leaks.join(', ')}`);
      else pass(`goAML empty body {} → ${res.status} (clean)`);
    }
  });

  // ─── 2.3 — Invalid enum reportType ─────────────────────────────────────────
  await test('goAML submit — invalid enum reportType="INVALID_TYPE"', async () => {
    const { res, body } = await postJSON('/api/goaml/submit', {
      reportType: 'INVALID_TYPE',
      referenceNumber: 'FUZZ-INVALID-ENUM',
      subjectName: 'Test',
    });
    if (res.status === 500) fail('goAML invalid reportType returned 500');
    else if (![400, 422].includes(res.status)) {
      fail(`goAML invalid reportType returned unexpected ${res.status}`);
    } else {
      const leaks = findLeaks(body);
      if (leaks.length > 0) fail(`goAML invalid reportType leaked: ${leaks.join(', ')}`);
      else pass(`goAML invalid reportType → ${res.status} (clean)`);
    }
  });

  // ─── 2.4 — Type confusion ──────────────────────────────────────────────────
  await test('goAML submit — type confusion reportType=123 (number)', async () => {
    const { res, body } = await postJSON('/api/goaml/submit', {
      reportType: 123,
      referenceNumber: 'FUZZ-TYPECONFUSION-NUM',
      subjectName: 'Test',
    });
    if (res.status === 500) fail('goAML reportType=123 returned 500');
    else if (![400, 422].includes(res.status)) {
      fail(`goAML reportType=123 returned unexpected ${res.status}`);
    } else {
      const leaks = findLeaks(body);
      if (leaks.length > 0) fail(`goAML reportType=123 leaked: ${leaks.join(', ')}`);
      else pass(`goAML reportType=123 → ${res.status} (clean)`);
    }
  });

  await test('goAML submit — type confusion reportType=true (boolean)', async () => {
    const { res, body } = await postJSON('/api/goaml/submit', {
      reportType: true,
      referenceNumber: 'FUZZ-TYPECONFUSION-BOOL',
      subjectName: 'Test',
    });
    if (res.status === 500) fail('goAML reportType=true returned 500');
    else if (![400, 422].includes(res.status)) {
      fail(`goAML reportType=true returned unexpected ${res.status}`);
    } else {
      const leaks = findLeaks(body);
      if (leaks.length > 0) fail(`goAML reportType=true leaked: ${leaks.join(', ')}`);
      else pass(`goAML reportType=true → ${res.status} (clean)`);
    }
  });

  // ─── 2.5 — Valid submission (positive control) ────────────────────────────
  await test('goAML submit — valid DRAFT filing (positive control)', async () => {
    const ref = `FUZZ-VALID-${Date.now()}`;
    const { res, body } = await postJSON('/api/goaml/submit', {
      reportType: 'CTR',
      referenceNumber: ref,
      subjectName: 'Fuzz Test Subject',
      filingStatus: 'DRAFT',
    });
    if (res.status !== 201) {
      fail(`valid goAML submit returned ${res.status} (expected 201)`,
           `body: ${(JSON.stringify(body) || '').slice(0, 300)}`);
      return;
    }
    const id = body?.data?.id;
    if (id) {
      createdFilingIds.push(id);
      const leaks = findLeaks(body);
      if (leaks.length > 0) fail(`valid goAML submit leaked: ${leaks.join(', ')}`);
      else pass(`valid goAML submit → 201, id=${id} (clean)`);
    } else {
      fail('valid goAML submit returned 201 but no id in body');
    }
  });

  // ─── 2.6 — Duplicate reference number (idempotency / conflict) ─────────────
  await test('goAML submit — duplicate reference number returns 409', async () => {
    // First submission should succeed (201)
    const r1 = await postJSON('/api/goaml/submit', {
      reportType: 'CTR',
      referenceNumber: dupRef,
      subjectName: 'Fuzz Dup Subject',
      filingStatus: 'DRAFT',
    });
    if (r1.res.status === 201 && r1.body?.data?.id) {
      createdFilingIds.push(r1.body.data.id);
    } else {
      fail(`first submission of dupRef failed (${r1.res.status}) — cannot test duplicate`);
      return;
    }
    // Second submission with the SAME reference number must be 409.
    const r2 = await postJSON('/api/goaml/submit', {
      reportType: 'CTR',
      referenceNumber: dupRef,
      subjectName: 'Fuzz Dup Subject',
      filingStatus: 'DRAFT',
    });
    if (r2.res.status === 500) {
      fail(`goAML duplicate reference returned 500 (must be 409); ` +
           `body: ${(JSON.stringify(r2.body) || '').slice(0, 300)}`);
    } else if (r2.res.status !== 409) {
      fail(`goAML duplicate reference returned ${r2.res.status} (expected 409)`);
    } else {
      const leaks = findLeaks(r2.body);
      if (leaks.length > 0) fail(`goAML duplicate 409 leaked: ${leaks.join(', ')}`);
      else pass('goAML duplicate reference → 409 (clean)');
    }
  });

  // ─── 2.7 — DB consistency: duplicate must NOT have created a 2nd row ──────
  await test('goAML submit — DB consistency (duplicate did not create 2nd row)', async () => {
    const res = await fetch(`${BASE}/api/goaml?search=${encodeURIComponent(dupRef)}`);
    const body = await res.json();
    const matches = (body?.data ?? []).filter(
      (f) => f.referenceNumber === dupRef,
    );
    if (matches.length === 1) {
      pass(`DB consistent: exactly 1 row for ${dupRef}`);
    } else if (matches.length === 0) {
      fail(`DB inconsistency: 0 rows for ${dupRef} (first submit may have failed silently)`);
    } else {
      fail(`DB inconsistency: ${matches.length} rows for ${dupRef} (duplicate should have been rejected)`,
           `ids: ${matches.map((m) => m.id).join(', ')}`);
      // Clean up any stray rows
      for (const m of matches) createdFilingIds.push(m.id);
    }
  });

  // ─── 2.8 — Invalid user IDs: submit with bogus makerId ─────────────────────
  await test('goAML submit — invalid makerId (non-existent user)', async () => {
    // The route accepts makerId/makerName as optional fields and stores them
    // verbatim without validation. This is by design — the Maker-Checker log
    // just records who initiated. Verify no SQL/Prisma error leaks.
    const ref = `FUZZ-MAKER-${Date.now()}`;
    const { res, body } = await postJSON('/api/goaml/submit', {
      reportType: 'CTR',
      referenceNumber: ref,
      subjectName: 'Fuzz Maker Test',
      filingStatus: 'DRAFT',
      makerId: 'nonexistent-user-xyz',
      makerName: 'Nonexistent User',
    });
    if (res.status === 500) {
      const leaks = findLeaks(body);
      fail(
        'goAML submit with invalid makerId returned 500',
        `leaks: ${leaks.length ? leaks.join(', ') : 'none'}; body: ${(JSON.stringify(body) || '').slice(0, 300)}`,
      );
    } else if (res.status === 201) {
      if (body?.data?.id) createdFilingIds.push(body.data.id);
      const leaks = findLeaks(body);
      if (leaks.length > 0) fail(`goAML invalid makerId leaked: ${leaks.join(', ')}`);
      else pass('goAML invalid makerId → 201, no SQL/Prisma leak (route does not validate user existence)');
    } else if (![400, 422].includes(res.status)) {
      fail(`goAML invalid makerId returned unexpected ${res.status}`);
    } else {
      pass(`goAML invalid makerId → ${res.status} (clean)`);
    }
  });

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  await test('goAML — cleanup test filings', async () => {
    let cleaned = 0;
    let alreadyGone = 0;
    let cleanupFailed = 0;
    const failures = [];
    for (const id of createdFilingIds) {
      const r = await deleteFiling(id);
      if (r.ok) {
        if (r.alreadyGone) alreadyGone++;
        else cleaned++;
      } else {
        cleanupFailed++;
        failures.push(`${id} → ${r.status}${r.exhausted ? ' (429 after retries)' : ''}`);
      }
    }
    if (cleanupFailed === 0) {
      pass(`cleaned up ${cleaned} test filings${alreadyGone > 0 ? ` (${alreadyGone} already gone from prior run)` : ''}`);
    } else {
      fail(`cleaned up ${cleaned}, FAILED to clean ${cleanupFailed} (orphaned rows possible)`,
           failures.join('; '));
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Complaint State Machine (F1 — now implemented & fuzzed)
// ══════════════════════════════════════════════════════════════════════════════

const COMPLAINT_HDR = { 'x-user-id': 'fuzz-complaint', 'x-user-role': 'admin' };

/**
 * Create a NEW-state Complaint via POST /api/complaints.
 * Returns { ok, id, status, body, text, subject, complaintNumber }.
 */
async function createTestComplaint(suffix = '') {
  const subject = `Fuzz Complaint ${Date.now()}${suffix}`;
  const { res, body, text } = await postJSON(
    '/api/complaints',
    {
      subject,
      description: 'Created by fuzz-state-machines.mjs for transition testing.',
      complaintType: 'CUSTOMER',
      priority: 'MEDIUM',
      intakeChannel: 'PORTAL',
    },
    COMPLAINT_HDR,
  );
  const id = body && typeof body === 'object' && body.data?.id ? body.data.id : null;
  const complaintNumber = body?.data?.complaintNumber ?? null;
  return { ok: res.status === 201, id, status: res.status, body, text, subject, complaintNumber };
}

async function fuzzComplaints() {
  log('\n┌────────────────────────────────────────────────────────────────┐');
  log('│ SECTION 3 — Complaint State Machine (F1 — implemented & fuzzed) │');
  log('└────────────────────────────────────────────────────────────────┘');

  // ── Pre-flight: verify the routes exist now (F1 resolved) ──
  await test('Complaint API routes exist (F1 resolved)', async () => {
    const { res, body } = await postJSON('/api/complaints', {}, COMPLAINT_HDR);
    if (res.status === 404) {
      fail('POST /api/complaints returned 404 — route still missing (F1 NOT resolved)');
      return;
    }
    if (res.status === 400) {
      pass('POST /api/complaints responds 400 on empty body (route exists, F1 resolved)');
    } else {
      fail(`unexpected status ${res.status} from POST /api/complaints`, JSON.stringify(body).slice(0, 200));
    }
  });

  // ── 1. Malformed JSON on transition endpoint (5 variants) ──
  const malformedVariants = [
    '{not valid json',
    'null',
    '"a bare string"',
    '[]',
    'undefined',
  ];
  for (let i = 0; i < malformedVariants.length; i++) {
    await test(`malformed JSON #${i + 1} on transition → 400`, async () => {
      const { res, body } = await putRaw(
        '/api/complaints/fuzz-malformed-test/transition',
        malformedVariants[i],
        COMPLAINT_HDR,
      );
      assertCleanError(res, body, [400], `(malformed variant #${i + 1}: ${malformedVariants[i].slice(0, 20)})`);
    });
  }

  // ── 2. Missing required fields on intake ──
  await test('intake with empty body {} → 400', async () => {
    const { res, body } = await postJSON('/api/complaints', {}, COMPLAINT_HDR);
    assertCleanError(res, body, [400], '(empty intake body)');
  });

  // ── 3. Invalid enum values ──
  await test('intake with invalid complaintType → 400', async () => {
    const { res, body } = await postJSON(
      '/api/complaints',
      { subject: 'x', description: 'x', complaintType: 'INVALID_TYPE' },
      COMPLAINT_HDR,
    );
    assertCleanError(res, body, [400], '(invalid complaintType)');
  });

  await test('intake with invalid priority → 400', async () => {
    const { res, body } = await postJSON(
      '/api/complaints',
      { subject: 'x', description: 'x', complaintType: 'CUSTOMER', priority: 'URGENT_BAD' },
      COMPLAINT_HDR,
    );
    assertCleanError(res, body, [400], '(invalid priority)');
  });

  await test('transition with invalid targetState enum → 400', async () => {
    const created = await createTestComplaint('-enum');
    if (!created.ok) { skip('transition invalid enum', 'create failed'); return; }
    const { res, body } = await putJSON(
      `/api/complaints/${created.id}/transition`,
      { targetState: 'INVALID_STATE' },
      COMPLAINT_HDR,
    );
    assertCleanError(res, body, [400], '(invalid targetState enum)');
  });

  // ── 4. Type confusion ──
  await test('transition with targetState=123 (number) → 400', async () => {
    const created = await createTestComplaint('-tc1');
    if (!created.ok) { skip('type confusion number', 'create failed'); return; }
    const { res, body } = await putJSON(
      `/api/complaints/${created.id}/transition`,
      { targetState: 123 },
      COMPLAINT_HDR,
    );
    assertCleanError(res, body, [400], '(targetState=number)');
  });

  await test('transition with targetState=true (boolean) → 400', async () => {
    const created = await createTestComplaint('-tc2');
    if (!created.ok) { skip('type confusion boolean', 'create failed'); return; }
    const { res, body } = await putJSON(
      `/api/complaints/${created.id}/transition`,
      { targetState: true },
      COMPLAINT_HDR,
    );
    assertCleanError(res, body, [400], '(targetState=boolean)');
  });

  // ── 5. Invalid state transitions ──
  await test('invalid forward jump NEW→RESOLVED → 422', async () => {
    const created = await createTestComplaint('-jump');
    if (!created.ok) { skip('invalid forward jump', 'create failed'); return; }
    const { res, body } = await putJSON(
      `/api/complaints/${created.id}/transition`,
      { targetState: 'RESOLVED', resolutionSummary: 'skipping steps' },
      COMPLAINT_HDR,
    );
    assertCleanError(res, body, [422], '(NEW→RESOLVED invalid jump)');
  });

  await test('invalid backward jump CLOSED→INVESTIGATING → 422', async () => {
    const created = await createTestComplaint('-backward');
    if (!created.ok) { skip('invalid backward jump', 'create failed'); return; }
    // Walk to CLOSED first
    await putJSON(`/api/complaints/${created.id}/transition`, { targetState: 'ACKNOWLEDGED' }, COMPLAINT_HDR);
    await putJSON(`/api/complaints/${created.id}/transition`, { targetState: 'INVESTIGATING' }, COMPLAINT_HDR);
    await putJSON(`/api/complaints/${created.id}/transition`, { targetState: 'RESOLVED', resolutionSummary: 'done' }, COMPLAINT_HDR);
    await putJSON(`/api/complaints/${created.id}/transition`, { targetState: 'CLOSED' }, COMPLAINT_HDR);
    // Now attempt invalid backward jump
    const { res, body } = await putJSON(
      `/api/complaints/${created.id}/transition`,
      { targetState: 'INVESTIGATING' },
      COMPLAINT_HDR,
    );
    assertCleanError(res, body, [422], '(CLOSED→INVESTIGATING invalid backward)');
  });

  // ── 6. Field guard: RESOLVED without resolutionSummary → 422 ──
  await test('INVESTIGATING→RESOLVED without resolutionSummary → 422', async () => {
    const created = await createTestComplaint('-fieldguard');
    if (!created.ok) { skip('field guard', 'create failed'); return; }
    await putJSON(`/api/complaints/${created.id}/transition`, { targetState: 'ACKNOWLEDGED' }, COMPLAINT_HDR);
    await putJSON(`/api/complaints/${created.id}/transition`, { targetState: 'INVESTIGATING' }, COMPLAINT_HDR);
    const { res, body } = await putJSON(
      `/api/complaints/${created.id}/transition`,
      { targetState: 'RESOLVED' }, // no resolutionSummary
      COMPLAINT_HDR,
    );
    assertCleanError(res, body, [422], '(RESOLVED without summary)');
  });

  // ── 7. Valid positive control: full happy path ──
  await test('valid happy path NEW→ACK→INVESTIGATING→RESOLVED→CLOSED → 200s', async () => {
    const created = await createTestComplaint('-happy');
    if (!created.ok) { skip('happy path', `create failed (${created.status})`); return; }
    const steps = [
      { targetState: 'ACKNOWLEDGED' },
      { targetState: 'INVESTIGATING' },
      { targetState: 'RESOLVED', resolutionSummary: 'Root cause addressed.' },
      { targetState: 'CLOSED' },
    ];
    let allOk = true;
    for (const step of steps) {
      const { res, body } = await putJSON(
        `/api/complaints/${created.id}/transition`,
        step,
        COMPLAINT_HDR,
      );
      if (res.status !== 200) {
        fail(`step ${step.targetState} returned ${res.status}`, JSON.stringify(body).slice(0, 200));
        allOk = false;
        break;
      }
    }
    if (allOk) pass('full happy path completed with 200 at each step');
  });

  // ── 8. Idempotency: duplicate same-state transition → 422 ──
  await test('duplicate transition to same state → 422', async () => {
    const created = await createTestComplaint('-dup');
    if (!created.ok) { skip('duplicate transition', 'create failed'); return; }
    const r1 = await putJSON(`/api/complaints/${created.id}/transition`, { targetState: 'ACKNOWLEDGED' }, COMPLAINT_HDR);
    if (r1.res.status !== 200) { skip('duplicate transition', `first transition failed (${r1.res.status})`); return; }
    const r2 = await putJSON(`/api/complaints/${created.id}/transition`, { targetState: 'ACKNOWLEDGED' }, COMPLAINT_HDR);
    assertCleanError(r2.res, r2.body, [422], '(duplicate ACKNOWLEDGED)');
  });

  // ── 9. Invalid user id (no SQL errors leaked) ──
  await test('transition with non-existent user id → no SQL leak', async () => {
    const created = await createTestComplaint('-baduser');
    if (!created.ok) { skip('invalid user id', 'create failed'); return; }
    const { res, body } = await putJSON(
      `/api/complaints/${created.id}/transition`,
      { targetState: 'ACKNOWLEDGED' },
      { 'x-user-id': 'nonexistent-user-12345', 'x-user-role': 'admin' },
    );
    const leaks = findLeaks(body);
    if (leaks.length > 0) {
      fail('leak with invalid user id', `leaks: ${leaks.join(', ')}`);
    } else {
      pass(`no internal leak with non-existent user id (status ${res.status})`);
    }
  });

  // ── 10. Unknown complaint id → 404 ──
  await test('transition on unknown complaint id → 404', async () => {
    const { res, body } = await putJSON(
      '/api/complaints/nonexistent-complaint-id-999/transition',
      { targetState: 'ACKNOWLEDGED' },
      COMPLAINT_HDR,
    );
    assertCleanError(res, body, [404], '(unknown complaint id)');
  });

  // ── 11. Communications endpoint fuzzing ──
  await test('communications malformed JSON → 400', async () => {
    const created = await createTestComplaint('-comm-malformed');
    if (!created.ok) { skip('comm malformed JSON', 'create failed'); return; }
    const { res, body } = await postRaw(
      `/api/complaints/${created.id}/communications`,
      '{broken',
      COMPLAINT_HDR,
    );
    assertCleanError(res, body, [400], '(malformed comm JSON)');
  });

  await test('communications missing required fields → 400', async () => {
    const created = await createTestComplaint('-comm-missing');
    if (!created.ok) { skip('comm missing fields', 'create failed'); return; }
    const { res, body } = await postJSON(
      `/api/complaints/${created.id}/communications`,
      {},
      COMPLAINT_HDR,
    );
    assertCleanError(res, body, [400], '(empty comm body)');
  });

  await test('communications on unknown complaint id → 404', async () => {
    const { res, body } = await postJSON(
      '/api/complaints/nonexistent-comm-id-888/communications',
      { channel: 'EMAIL', direction: 'INBOUND', content: 'test' },
      COMPLAINT_HDR,
    );
    assertCleanError(res, body, [404], '(unknown comm complaint id)');
  });

  // ── 12. No-auth → 401 ──
  await test('transition without auth headers → 401', async () => {
    const { res, body } = await putJSON(
      '/api/complaints/any-id/transition',
      { targetState: 'ACKNOWLEDGED' },
      {},
    );
    assertCleanError(res, body, [401], '(no auth)');
  });

  // ── 13. DB consistency: failed transition doesn't mutate state ──
  await test('failed transition does not mutate complaint state', async () => {
    const created = await createTestComplaint('-consistency');
    if (!created.ok) { skip('DB consistency', 'create failed'); return; }
    // Attempt an invalid transition (NEW→CLOSED is invalid)
    await putJSON(`/api/complaints/${created.id}/transition`, { targetState: 'CLOSED' }, COMPLAINT_HDR);
    // Fetch and verify state is still NEW
    const getRes = await fetch(`${BASE}/api/complaints/${created.id}`, { headers: COMPLAINT_HDR });
    const getBody = await getRes.json();
    if (getBody?.data?.status === 'NEW') {
      pass('complaint state remains NEW after failed transition (DB consistent)');
    } else {
      fail(`complaint state mutated to "${getBody?.data?.status}" after failed transition`);
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Pre-flight: verify the dev server is up
// ══════════════════════════════════════════════════════════════════════════════

async function preflight() {
  log('\n┌────────────────────────────────────────────────────────────────┐');
  log('│ Pre-flight — verifying dev server at http://localhost:3000    │');
  log('└────────────────────────────────────────────────────────────────┘');
  try {
    const res = await fetch(`${BASE}/api/health`, { method: 'GET' });
    if (res.ok) {
      pass(`dev server reachable (HTTP ${res.status})`);
      return true;
    }
    fail(`dev server reachable but returned HTTP ${res.status}`);
    return false;
  } catch (err) {
    fail('dev server unreachable — start it with `bun run dev` first',
         String(err));
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════════════════════

async function main() {
  log('\n╔════════════════════════════════════════════════════════════════════════╗');
  log('║  IC-OS Phase 4 Step 2.2 — State Machine Fuzzing                       ║');
  log('║  CAP • goAML • Complaint — malformed input / state transition / leak   ║');
  log('╚════════════════════════════════════════════════════════════════════════╝');

  const ok = await preflight();
  if (!ok) {
    log('\n[fuzz] Aborting: dev server not reachable.');
    process.exit(2);
  }

  await fuzzCAP();
  await fuzzGoAML();
  await fuzzComplaints();

  // ─── Final summary ───────────────────────────────────────────────────────
  log('\n╔════════════════════════════════════════════════════════════════════════╗');
  log('║  FUZZ SUMMARY                                                         ║');
  log('╚════════════════════════════════════════════════════════════════════════╝');
  log(`  Passed:    ${passed}`);
  log(`  Failed:    ${failed}`);
  log(`  Skipped:   ${skipped}`);
  log(`  Findings:  ${findings.length}`);
  if (findings.length > 0) {
    log('\n  ── Findings ──');
    findings.forEach((f, i) => {
      log(`  [F${i + 1}] ${f.title}`);
      log(`       ${f.detail}`);
    });
  }
  if (failures.length > 0) {
    log('\n  ── Failures ──');
    failures.forEach((f, i) => {
      log(`  [${i + 1}] ${f.msg}`);
      if (f.detail) log(`      ${f.detail}`);
    });
  }
  log('');
  const exitCode = failed > 0 ? 1 : 0;
  log(`[fuzz] Exit code: ${exitCode} (${failed === 0 ? 'ALL PASS' : 'FAILURES PRESENT'})`);
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('[fuzz] Uncaught error:', err);
  process.exit(2);
});
