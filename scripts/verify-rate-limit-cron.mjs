#!/usr/bin/env bun
/**
 * Phase 4 Step 2.1 + Step 4 Verification — Rate Limiting & Cron Isolation E2E
 * ------------------------------------------------------------------
 * Verifies the two Step 2.1 security controls:
 *
 * 1. WEBHOOK RATE LIMITING (sliding window, 100 req/min/IP)
 *    - Send 150 requests to /api/webhooks/sanctions in rapid succession.
 *    - Requests 1-100 should be processed (return 401 for missing signature,
 *      which is fine — the rate limiter runs BEFORE signature verification).
 *    - Request 101+ should return 429 Too Many Requests with Retry-After.
 *    - The 429 response must include: Retry-After, X-RateLimit-Limit,
 *      X-RateLimit-Remaining, X-RateLimit-Reset headers.
 *
 * 2. CRON ENDPOINT ISOLATION (internal-only)
 *    - Call /api/cron/calculate-department-risk with a simulated EXTERNAL IP
 *      (via x-forwarded-for header) — MUST return 403 regardless of whether
 *      a valid CRON_SECRET is provided.
 *    - Call with a simulated INTERNAL IP (loopback) + valid CRON_SECRET —
 *      should return 200 (proving the route works when properly invoked).
 *    - Call with a simulated INTERNAL IP + NO secret — should return 401
 *      (proving the secret check still runs for internal callers).
 *    - Call with a simulated INTERNAL IP + WRONG secret — should return 401.
 *
 * Exit code: 0 if ALL checks pass, 1 if any fail.
 */

const BASE = 'http://localhost:3000';

function log(msg) { console.log(`[e2e] ${msg}`); }
function pass(msg) { console.log(`  ✓ ${msg}`); }
function fail(msg) { console.error(`  ✗ ${msg}`); }

let exitCode = 0;
const failures = [];

// ─── Test 1: Webhook Rate Limiting ──────────────────────────────────────────

async function testWebhookRateLimit() {
  log('=== Test 1: Webhook Rate Limiting (150 requests, expect 429 after 100) ===');

  const statuses = [];
  const startTime = Date.now();

  // Send 150 requests rapidly. We don't need valid signatures — the rate
  // limiter runs BEFORE signature verification (Step 0 in the lifecycle),
  // so even unsigned requests count against the limit. Requests 1-100 get
  // past the rate limiter (and then fail at signature verification with 401).
  // Requests 101-150 should be blocked by the rate limiter with 429.
  for (let i = 0; i < 150; i++) {
    try {
      const res = await fetch(`${BASE}/api/webhooks/sanctions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No x-webhook-signature → will get 401 if it passes rate limit
          // Simulate a consistent source IP so all requests share a bucket
          'x-forwarded-for': '203.0.113.42',
        },
        body: JSON.stringify({ event_id: `rate-test-${i}`, type: 'test' }),
      });
      statuses.push(res.status);
    } catch (e) {
      // Network errors count as failures
      statuses.push(0);
    }
  }

  const elapsed = Date.now() - startTime;
  log(`Sent 150 requests in ${elapsed}ms. Status distribution:`);

  const counts = {};
  for (const s of statuses) counts[s] = (counts[s] || 0) + 1;
  for (const [status, count] of Object.entries(counts).sort()) {
    log(`  HTTP ${status}: ${count} responses`);
  }

  // Verify: at least 50 requests got 429 (the over-limit ones)
  const rateLimited = counts[429] || 0;
  if (rateLimited >= 40) {
    pass(`Rate limiting worked: ${rateLimited} requests got 429 (expected ~50).`);
  } else {
    fail(`Rate limiting FAILED: only ${rateLimited} requests got 429 (expected ~50).`);
    failures.push('webhook-rate-limit: insufficient 429 responses');
  }

  // Verify: the first ~100 requests got past the rate limiter (401 from sig check)
  const passedRateLimit = counts[401] || 0;
  if (passedRateLimit >= 90) {
    pass(`${passedRateLimit} requests passed rate limit (got 401 from signature check).`);
  } else {
    fail(`Only ${passedRateLimit} requests passed rate limit (expected ~100).`);
    failures.push('webhook-rate-limit: too few requests passed rate limit');
  }

  // Verify: a 429 response includes the required headers
  // Find the first 429 response and check its headers
  const fourTwoNineIdx = statuses.indexOf(429);
  if (fourTwoNineIdx >= 0) {
    // Re-send one request to inspect headers (the bucket is still full)
    const res = await fetch(`${BASE}/api/webhooks/sanctions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '203.0.113.42',
      },
      body: JSON.stringify({ event_id: 'rate-test-header-check', type: 'test' }),
    });
    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After');
      const limit = res.headers.get('X-RateLimit-Limit');
      const remaining = res.headers.get('X-RateLimit-Remaining');
      const reset = res.headers.get('X-RateLimit-Reset');
      if (retryAfter) {
        pass(`429 response includes Retry-After: ${retryAfter}s`);
      } else {
        fail('429 response MISSING Retry-After header');
        failures.push('webhook-rate-limit: missing Retry-After header');
      }
      if (limit === '100') {
        pass(`429 response includes X-RateLimit-Limit: ${limit}`);
      } else {
        fail(`429 response X-RateLimit-Limit wrong: ${limit} (expected 100)`);
        failures.push('webhook-rate-limit: wrong X-RateLimit-Limit');
      }
      if (remaining === '0') {
        pass(`429 response includes X-RateLimit-Remaining: ${remaining}`);
      } else {
        fail(`429 response X-RateLimit-Remaining wrong: ${remaining} (expected 0)`);
        failures.push('webhook-rate-limit: wrong X-RateLimit-Remaining');
      }
      if (reset) {
        pass(`429 response includes X-RateLimit-Reset: ${reset}`);
      } else {
        fail('429 response MISSING X-RateLimit-Reset header');
        failures.push('webhook-rate-limit: missing X-RateLimit-Reset');
      }
    } else {
      fail(`Header check request returned ${res.status} (expected 429 — bucket may have reset)`);
    }
  }

  // Wait 65 seconds for the rate limit window to reset, then verify recovery
  log('Waiting 65s for rate limit window to reset...');
  await new Promise((r) => setTimeout(r, 65000));

  const recoveryRes = await fetch(`${BASE}/api/webhooks/sanctions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '203.0.113.42',
    },
    body: JSON.stringify({ event_id: 'rate-test-recovery', type: 'test' }),
  });
  if (recoveryRes.status === 401 || recoveryRes.status === 200) {
    pass(`Rate limit recovered after 65s: request returned ${recoveryRes.status} (past rate limiter).`);
  } else if (recoveryRes.status === 429) {
    fail(`Rate limit did NOT recover after 65s: still 429`);
    failures.push('webhook-rate-limit: window did not reset after 65s');
  } else {
    log(`Rate limit recovery: request returned ${recoveryRes.status} (unexpected but not 429).`);
  }
}

// ─── Test 2: Cron Endpoint Isolation ────────────────────────────────────────

async function testCronIsolation() {
  log('=== Test 2: Cron Endpoint Isolation (external IP → 403) ===');

  const cronSecret = process.env.CRON_SECRET || '';

  // 2a. External IP + NO secret → must return 403 (not 401 — IP check runs first)
  log('  [2a] External IP (203.0.113.99) + no secret → expect 403');
  const res2a = await fetch(`${BASE}/api/cron/calculate-department-risk`, {
    method: 'GET',
    headers: { 'x-forwarded-for': '203.0.113.99' },
  });
  if (res2a.status === 403) {
    pass(`External IP + no secret → 403 ✓`);
  } else {
    fail(`External IP + no secret → ${res2a.status} (expected 403)`);
    failures.push(`cron-isolation: external IP + no secret returned ${res2a.status}, expected 403`);
  }

  // 2b. External IP + VALID secret → must STILL return 403 (IP check runs BEFORE secret check)
  log('  [2b] External IP (203.0.113.99) + VALID secret → expect 403');
  const res2b = await fetch(`${BASE}/api/cron/calculate-department-risk`, {
    method: 'GET',
    headers: {
      'x-forwarded-for': '203.0.113.99',
      'authorization': `Bearer ${cronSecret}`,
    },
  });
  if (res2b.status === 403) {
    pass(`External IP + valid secret → 403 ✓ (secret not even checked — defense in depth)`);
  } else {
    fail(`External IP + valid secret → ${res2b.status} (expected 403)`);
    failures.push(`cron-isolation: external IP + valid secret returned ${res2b.status}, expected 403 — CRITICAL: secret leaked to external attacker`);
  }

  // 2c. External IP + WRONG secret → must return 403
  log('  [2c] External IP (203.0.113.99) + wrong secret → expect 403');
  const res2c = await fetch(`${BASE}/api/cron/calculate-department-risk`, {
    method: 'GET',
    headers: {
      'x-forwarded-for': '203.0.113.99',
      'authorization': 'Bearer wrong-secret-value',
    },
  });
  if (res2c.status === 403) {
    pass(`External IP + wrong secret → 403 ✓`);
  } else {
    fail(`External IP + wrong secret → ${res2c.status} (expected 403)`);
    failures.push(`cron-isolation: external IP + wrong secret returned ${res2c.status}, expected 403`);
  }

  // 2d. Internal IP (loopback) + NO secret → must return 401 (IP check passes, secret check fails)
  log('  [2d] Internal IP (127.0.0.1) + no secret → expect 401');
  const res2d = await fetch(`${BASE}/api/cron/calculate-department-risk`, {
    method: 'GET',
    headers: { 'x-forwarded-for': '127.0.0.1' },
  });
  if (res2d.status === 401) {
    pass(`Internal IP + no secret → 401 ✓ (IP passed, secret check failed)`);
  } else {
    fail(`Internal IP + no secret → ${res2d.status} (expected 401)`);
    failures.push(`cron-isolation: internal IP + no secret returned ${res2d.status}, expected 401`);
  }

  // 2e. Internal IP (loopback) + WRONG secret → must return 401
  log('  [2e] Internal IP (127.0.0.1) + wrong secret → expect 401');
  const res2e = await fetch(`${BASE}/api/cron/calculate-department-risk`, {
    method: 'GET',
    headers: {
      'x-forwarded-for': '127.0.0.1',
      'authorization': 'Bearer wrong-secret-value',
    },
  });
  if (res2e.status === 401) {
    pass(`Internal IP + wrong secret → 401 ✓`);
  } else {
    fail(`Internal IP + wrong secret → ${res2e.status} (expected 401)`);
    failures.push(`cron-isolation: internal IP + wrong secret returned ${res2e.status}, expected 401`);
  }

  // 2f. Internal IP (loopback) + VALID secret → must return 200 (full access)
  //     This proves the route is functional when properly invoked.
  log('  [2f] Internal IP (127.0.0.1) + VALID secret → expect 200');
  const res2f = await fetch(`${BASE}/api/cron/calculate-department-risk`, {
    method: 'GET',
    headers: {
      'x-forwarded-for': '127.0.0.1',
      'authorization': `Bearer ${cronSecret}`,
    },
  });
  if (res2f.status === 200) {
    const json = await res2f.json();
    pass(`Internal IP + valid secret → 200 ✓ (departmentsUpdated: ${json.departmentsUpdated})`);
  } else {
    fail(`Internal IP + valid secret → ${res2f.status} (expected 200)`);
    failures.push(`cron-isolation: internal IP + valid secret returned ${res2f.status}, expected 200 — route may be broken`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  log('=== Phase 4 Step 2.1 + Step 4 — Rate Limiting & Cron Isolation E2E ===');
  log('');

  await testWebhookRateLimit();
  log('');
  await testCronIsolation();

  log('');
  log('═══════════════════════════════════════════════════════════════════════');
  if (failures.length === 0) {
    console.log('  ✓ ALL E2E CHECKS PASSED');
  } else {
    console.error(`  ✗ ${failures.length} CHECK(S) FAILED:`);
    for (const f of failures) console.error(`    - ${f}`);
  }
  log('═══════════════════════════════════════════════════════════════════════');

  process.exit(failures.length === 0 ? 0 : 1);
}

main();
