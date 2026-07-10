#!/usr/bin/env node
/**
 * IC-OS v7.3.0 — Phase 4 Step 3 — Load Test Runner (Task P4-3-b)
 * ==============================================================
 * Runs a configurable HTTP load test against the 4 endpoints under test:
 *
 *   1. GET /api/tasks/my-tasks     (withRBAC — canViewUnifiedTasks)
 *   2. GET /api/complaints          (withRBAC — canManageComplaints)
 *   3. GET /api/audit/integrity     (authGuard)
 *   4. GET /api/department-risk     (authGuard + canViewRiskAssessment)
 *
 * All endpoints are exercised with dev-mode auth headers
 * (`x-user-id` + `x-user-role=admin`); `withRBAC` reads these directly
 * and `authGuard` (which uses the dev-mode synthetic admin) ignores them
 * harmlessly.
 *
 * ARCHITECTURE
 *   - Node's built-in `http` module (NOT fetch-in-a-loop — too slow).
 *   - One `http.Agent({ keepAlive: true, maxSockets: 200 })` per endpoint
 *     for connection reuse (avoids TCP/TLS handshake overhead per request).
 *   - Worker-pool pattern: `CONCURRENT_USERS` independent `setInterval`
 *     tickers, each firing one request every `1000 / RPS` ms. This paces
 *     the load evenly instead of bursting.
 *   - Response bodies are discarded (`res.resume()`) — we measure HTTP
 *     status + latency, not body throughput. This keeps memory bounded
 *     (latency arrays grow to ~60k floats for a 60s test — ~500KB, fine).
 *
 * METRICS (per endpoint)
 *   - totalSent / totalReceived
 *   - status code histogram (2xx / 3xx / 4xx / 5xx + exact codes)
 *   - latency: min / max / mean / p50 / p95 / p99 (ms, end-to-end)
 *   - error rate = (5xx + network errors + timeouts) / totalSent
 *   - throughput = totalReceived / durationSeconds
 *
 * PASS / FAIL CRITERIA
 *   All endpoints must satisfy:  p95 < 300ms  AND  errorRate < 0.1%
 *   Exit 0 if all pass, exit 1 otherwise. A JSON report is always written
 *   to /home/z/my-project/load-test-results.json for the orchestrator.
 *
 * CONFIGURATION (env vars)
 *   LOAD_TEST_CONCURRENCY  — concurrent users per endpoint   (default 100)
 *   LOAD_TEST_RPS          — requests/sec/user               (default 10)
 *   LOAD_TEST_DURATION     — seconds per endpoint             (default 60)
 *   LOAD_TEST_TARGET       — base URL                         (default http://localhost:3000)
 *
 *   The full 5-minute run is invoked with LOAD_TEST_DURATION=300.
 *   The orchestrator may run a shorter 60s smoke first.
 *
 * SIGNALS
 *   SIGINT (Ctrl+C): gracefully stops the current endpoint, writes a
 *   partial JSON report, and exits 130. A second SIGINT force-exits.
 *
 * USAGE
 *   node scripts/load-test.mjs
 *   LOAD_TEST_DURATION=300 node scripts/load-test.mjs   # full 5-min run
 *   LOAD_TEST_CONCURRENCY=20 LOAD_TEST_RPS=5 node scripts/load-test.mjs  # light
 */

import http from 'node:http';
import { writeFileSync } from 'node:fs';

// ─── Configuration ───────────────────────────────────────────────────────────

const CONFIG = {
  CONCURRENT_USERS: parseInt(process.env.LOAD_TEST_CONCURRENCY ?? '100', 10),
  REQUESTS_PER_SECOND_PER_USER: parseInt(process.env.LOAD_TEST_RPS ?? '10', 10),
  DURATION_SECONDS: parseInt(process.env.LOAD_TEST_DURATION ?? '60', 10),
  TARGET_BASE_URL: process.env.LOAD_TEST_TARGET ?? 'http://localhost:3000',
  REQUEST_TIMEOUT_MS: 30000,
  GRACE_PERIOD_MS: 3000, // wait for in-flight responses after duration
  P95_THRESHOLD_MS: 300,
  ERROR_RATE_THRESHOLD: 0.001, // 0.1%
  REPORT_PATH: '/home/z/my-project/load-test-results.json',
  ENDPOINTS: [
    {
      name: 'my-tasks',
      method: 'GET',
      path: '/api/tasks/my-tasks?limit=50',
      headers: { 'x-user-id': 'loadtest-user-001', 'x-user-role': 'admin' },
    },
    {
      name: 'complaints',
      method: 'GET',
      path: '/api/complaints?limit=50',
      headers: { 'x-user-id': 'loadtest-user-001', 'x-user-role': 'admin' },
    },
    {
      name: 'audit-integrity',
      method: 'GET',
      path: '/api/audit/integrity',
      headers: { 'x-user-id': 'loadtest-user-001', 'x-user-role': 'admin' },
    },
    {
      name: 'department-risk',
      method: 'GET',
      path: '/api/department-risk',
      headers: { 'x-user-id': 'loadtest-user-001', 'x-user-role': 'admin' },
    },
  ],
};

// Parse target URL once
const _target = new URL(CONFIG.TARGET_BASE_URL);
const TARGET_HOST = _target.hostname;
const TARGET_PORT = _target.port ? parseInt(_target.port, 10) : 80;
const TARGET_PATH_PREFIX = _target.pathname.replace(/\/+$/, ''); // strip trailing slash

// Global state — shared with SIGINT handler
const state = {
  stopped: false, // set true on SIGINT or natural completion
  results: [], // accumulated per-endpoint results
  currentEndpoint: null,
};

// ─── HTTP request helper ─────────────────────────────────────────────────────
// Fires a single request, records latency + status. Returns nothing —
// metrics are written into the `metrics` object captured by closure.

function fireRequest(endpoint, agent, metrics, userId) {
  metrics.totalSent++;
  const reqStart = process.hrtime.bigint();
  let settled = false;

  // Distribute across 50 synthetic users to avoid single-user rate limiting.
  // The READ tier allows 100 req/min/user = 1.67 rps. With 50 users, the
  // aggregate budget is 83 rps — comfortably above the load-test target of
  // CONCURRENT_USERS × RPS (e.g., 100 × 10 = 1,000 rps needs ≥10 users).
  // If userId is provided, override the static x-user-id header.
  const headers = { ...endpoint.headers, Connection: 'keep-alive' };
  if (userId) headers['x-user-id'] = userId;

  const options = {
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: TARGET_PATH_PREFIX + endpoint.path,
    method: endpoint.method,
    headers,
    agent,
    timeout: CONFIG.REQUEST_TIMEOUT_MS,
  };

  const req = http.request(options, (res) => {
    // Discard the body — we only care about status + latency.
    res.resume();
    res.on('end', () => {
      if (settled) return;
      settled = true;
      const latencyMs = Number(process.hrtime.bigint() - reqStart) / 1e6;
      metrics.latencies.push(latencyMs);
      metrics.totalReceived++;
      const code = res.statusCode;
      metrics.statusCounts[code] = (metrics.statusCounts[code] || 0) + 1;
      if (code >= 500) metrics.errors++;
    });
    res.on('error', () => {
      if (settled) return;
      settled = true;
      metrics.networkErrors++;
      metrics.errors++;
    });
  });

  req.on('error', () => {
    if (settled) return;
    settled = true;
    metrics.networkErrors++;
    metrics.errors++;
  });

  req.on('timeout', () => {
    if (settled) return;
    settled = true;
    metrics.timeouts++;
    metrics.errors++;
    req.destroy();
  });

  req.end();
}

// ─── Per-endpoint test runner ────────────────────────────────────────────────

function runEndpointTest(endpoint, durationSec) {
  return new Promise((resolve) => {
    const agent = new http.Agent({
      keepAlive: true,
      maxSockets: Math.max(200, CONFIG.CONCURRENT_USERS + 50),
      timeout: CONFIG.REQUEST_TIMEOUT_MS,
    });
    const metrics = {
      endpoint: endpoint.name,
      path: endpoint.path,
      totalSent: 0,
      totalReceived: 0,
      statusCounts: {},
      latencies: [],
      errors: 0,
      networkErrors: 0,
      timeouts: 0,
    };
    const intervals = [];
    const tickMs = 1000 / CONFIG.REQUESTS_PER_SECOND_PER_USER;
    const startTime = Date.now();
    const endTime = startTime + durationSec * 1000;
    let resolved = false;

    // Pool of 600 synthetic users — distributes rate-limit budget.
    // READ tier = 100 req/min/user = 1.67 rps/user.
    // 600 users × 1.67 rps = 1,000 rps aggregate budget (matches the
    // v7.3.0 load-test target of 100 concurrent × 10 rps = 1,000 rps).
    // Users 001-050 have assigned UniversalTasks (from mock data); 051-600
    // return empty results (still 200 OK — exercises the query path).
    const USER_POOL = Array.from({ length: 600 }, (_, i) =>
      `loadtest-user-${String(i + 1).padStart(3, '0')}`
    );

    const fire = () => {
      if (state.stopped || Date.now() >= endTime) return;
      // Round-robin a user from the pool — distributes rate-limit budget.
      const userId = USER_POOL[metrics.totalSent % USER_POOL.length];
      fireRequest(endpoint, agent, metrics, userId);
    };

    // Spawn CONCURRENT_USERS independent tickers
    for (let i = 0; i < CONFIG.CONCURRENT_USERS; i++) {
      // Stagger the first tick of each worker slightly to avoid a thundering
      // herd at t=0 — each worker's first fire is offset by a random sub-tick.
      const iv = setInterval(fire, tickMs);
      intervals.push(iv);
    }

    const stop = (graceMs) => {
      intervals.forEach(clearInterval);
      intervals.length = 0;
      // NOTE: do NOT .unref() this timer — it must fire to resolve the
      // promise even if all in-flight requests have already completed
      // (otherwise Node could exit with no active handles before the
      // summary table prints). The grace period is short (1-3s) so the
      // keep-alive cost is negligible.
      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        agent.destroy();
        resolve(metrics);
      }, graceMs);
    };

    // Natural end
    setTimeout(() => stop(CONFIG.GRACE_PERIOD_MS), durationSec * 1000);

    // Early-stop poller (responds to SIGINT within ~200ms)
    const stopChecker = setInterval(() => {
      if (state.stopped) {
        clearInterval(stopChecker);
        stop(1000); // shorter grace on interrupt
      }
    }, 200);
    intervals.push(stopChecker);

    // Live progress every 10s
    const progress = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const errPct = metrics.totalSent > 0
        ? ((metrics.errors / metrics.totalSent) * 100).toFixed(2)
        : '0.00';
      process.stdout.write(
        `  [${elapsed}s] sent=${metrics.totalSent.toLocaleString()} ` +
        `recv=${metrics.totalReceived.toLocaleString()} ` +
        `err=${metrics.errors.toLocaleString()} (${errPct}%)   \r`,
      );
      if (state.stopped) clearInterval(progress);
    }, 10000);
    intervals.push(progress);
  });
}

// ─── Percentile computation ──────────────────────────────────────────────────

function computePercentiles(latencies) {
  if (latencies.length === 0) {
    return { min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0 };
  }
  // Copy + sort (don't mutate the original array — it may be inspected later).
  const sorted = latencies.slice().sort((a, b) => a - b);
  const n = sorted.length;
  // Nearest-rank percentile (inclusive). p95 of 100 samples = index 94.
  const pct = (p) => {
    const idx = Math.min(n - 1, Math.max(0, Math.ceil((p / 100) * n) - 1));
    return sorted[idx];
  };
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    min: sorted[0],
    max: sorted[n - 1],
    mean: sum / n,
    p50: pct(50),
    p95: pct(95),
    p99: pct(99),
  };
}

function bucketStatusCodes(counts) {
  const buckets = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, other: 0 };
  for (const [code, count] of Object.entries(counts)) {
    const c = parseInt(code, 10);
    if (c >= 200 && c < 300) buckets['2xx'] += count;
    else if (c >= 300 && c < 400) buckets['3xx'] += count;
    else if (c >= 400 && c < 500) buckets['4xx'] += count;
    else if (c >= 500 && c < 600) buckets['5xx'] += count;
    else buckets.other += count;
  }
  return buckets;
}

// ─── Summary table ───────────────────────────────────────────────────────────

function padLeft(s, w) {
  s = String(s);
  return s.length >= w ? s : ' '.repeat(w - s.length) + s;
}
function padRight(s, w) {
  s = String(s);
  return s.length >= w ? s : s + ' '.repeat(w - s.length);
}

function printSummaryTable(results) {
  const dur = CONFIG.DURATION_SECONDS;
  const conc = CONFIG.CONCURRENT_USERS;
  const rps = CONFIG.REQUESTS_PER_SECOND_PER_USER;
  const headerTitle =
    `  LOAD TEST SUMMARY  (duration: ${dur}s, concurrency: ${conc}, target rps/user: ${rps})`;

  // Column widths (interior content, excluding the leading/trailing space).
  // W.ep=16 fits the longest endpoint name 'audit-integrity' (15 chars) + 1 pad.
  const W = { ep: 16, total: 9, c2: 9, c4: 9, c5: 9, p95: 9, err: 9 };
  const inner =
    W.ep + W.total + W.c2 + W.c4 + W.c5 + W.p95 + W.err + 6 /* separators */;
  // +1 guarantees the title has at least one trailing space inside the box.
  const topWidth = Math.max(headerTitle.length + 1, inner);

  const line = (l, r, fill) =>
    l + fill.repeat(Math.max(1, topWidth - l.length - r.length)) + r;

  console.log(line('╔', '╗', '═'));
  console.log('║' + padRight(headerTitle, topWidth) + '║');
  console.log(line('╠', '╣', '═'));
  // Column header row
  const cols = [
    padRight('Endpoint', W.ep),
    padLeft('Total', W.total),
    padLeft('2xx', W.c2),
    padLeft('4xx', W.c4),
    padLeft('5xx', W.c5),
    padLeft('p95 (ms)', W.p95),
    padLeft('Err %', W.err),
  ];
  console.log('║ ' + cols.join(' ║ ') + ' ║');
  console.log(line('╠', '╣', '═'));

  for (const r of results) {
    const b = bucketStatusCodes(r.statusCounts);
    const errPct = r.totalSent > 0
      ? ((r.errors / r.totalSent) * 100).toFixed(3) + '%'
      : '0.000%';
    const row = [
      padRight(r.endpoint, W.ep),
      padLeft(String(r.totalReceived), W.total),
      padLeft(String(b['2xx']), W.c2),
      padLeft(String(b['4xx']), W.c4),
      padLeft(String(b['5xx']), W.c5),
      padLeft(r.p95.toFixed(0), W.p95),
      padLeft(errPct, W.err),
    ];
    console.log('║ ' + row.join(' ║ ') + ' ║');
  }
  console.log(line('╚', '╝', '═'));
}

// ─── JSON report ─────────────────────────────────────────────────────────────

function writeJsonReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    target: CONFIG.TARGET_BASE_URL,
    config: {
      CONCURRENT_USERS: CONFIG.CONCURRENT_USERS,
      REQUESTS_PER_SECOND_PER_USER: CONFIG.REQUESTS_PER_SECOND_PER_USER,
      DURATION_SECONDS: CONFIG.DURATION_SECONDS,
      P95_THRESHOLD_MS: CONFIG.P95_THRESHOLD_MS,
      ERROR_RATE_THRESHOLD: CONFIG.ERROR_RATE_THRESHOLD,
    },
    endpoints: results.map((r) => {
      const b = bucketStatusCodes(r.statusCounts);
      const errorRate = r.totalSent > 0 ? r.errors / r.totalSent : 0;
      const throughput = CONFIG.DURATION_SECONDS > 0
        ? r.totalReceived / CONFIG.DURATION_SECONDS
        : 0;
      const pass =
        r.p95 < CONFIG.P95_THRESHOLD_MS && errorRate < CONFIG.ERROR_RATE_THRESHOLD;
      return {
        endpoint: r.endpoint,
        path: r.path,
        totalSent: r.totalSent,
        totalReceived: r.totalReceived,
        statusBuckets: b,
        statusCounts: r.statusCounts,
        latencyMs: {
          min: Number(r.min.toFixed(2)),
          max: Number(r.max.toFixed(2)),
          mean: Number(r.mean.toFixed(2)),
          p50: Number(r.p50.toFixed(2)),
          p95: Number(r.p95.toFixed(2)),
          p99: Number(r.p99.toFixed(2)),
        },
        errors: r.errors,
        networkErrors: r.networkErrors,
        timeouts: r.timeouts,
        errorRate: Number(errorRate.toFixed(6)),
        throughputRps: Number(throughput.toFixed(2)),
        pass,
      };
    }),
    overallPass:
      results.length > 0 &&
      results.every((r) => {
        const errorRate = r.totalSent > 0 ? r.errors / r.totalSent : 0;
        return r.p95 < CONFIG.P95_THRESHOLD_MS && errorRate < CONFIG.ERROR_RATE_THRESHOLD;
      }),
    interrupted: state.stopped && results.length < CONFIG.ENDPOINTS.length,
  };
  writeFileSync(CONFIG.REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nJSON report written to ${CONFIG.REPORT_PATH}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('  IC-OS v7.3.0 — Phase 4 Step 3 — Load Test Runner (P4-3-b)');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(`  Target       : ${CONFIG.TARGET_BASE_URL}`);
  console.log(`  Concurrency  : ${CONFIG.CONCURRENT_USERS} users/endpoint`);
  console.log(`  RPS/user     : ${CONFIG.REQUESTS_PER_SECOND_PER_USER}`);
  console.log(`  Duration     : ${CONFIG.DURATION_SECONDS}s/endpoint ` +
    `(~${CONFIG.DURATION_SECONDS * CONFIG.ENDPOINTS.length}s total)`);
  console.log(`  Pass criteria: p95 < ${CONFIG.P95_THRESHOLD_MS}ms AND err < ${(CONFIG.ERROR_RATE_THRESHOLD * 100).toFixed(2)}%`);
  console.log(`  Endpoints    : ${CONFIG.ENDPOINTS.map((e) => e.name).join(', ')}`);
  console.log('──────────────────────────────────────────────────────────────────');

  // Pre-flight: warn if target is unreachable (single connectivity probe).
  await preflightProbe();

  for (const ep of CONFIG.ENDPOINTS) {
    if (state.stopped) break;
    state.currentEndpoint = ep;
    console.log(`\n=== Testing ${ep.name} ===  ${ep.method} ${ep.path}`);
    const m = await runEndpointTest(ep, CONFIG.DURATION_SECONDS);
    const p = computePercentiles(m.latencies);
    const errorRate = m.totalSent > 0 ? m.errors / m.totalSent : 0;
    const throughput = CONFIG.DURATION_SECONDS > 0
      ? m.totalReceived / CONFIG.DURATION_SECONDS
      : 0;
    const result = {
      ...m,
      ...p,
      errorRate,
      throughput,
    };
    state.results.push(result);
    console.log(''); // newline after the \r progress meter
    console.log(
      `  Sent: ${m.totalSent.toLocaleString()}  ` +
      `Recv: ${m.totalReceived.toLocaleString()}  ` +
      `Err: ${m.errors.toLocaleString()} (${(errorRate * 100).toFixed(3)}%)`,
    );
    console.log(
      `  Latency (ms): min=${p.min.toFixed(1)}  mean=${p.mean.toFixed(1)}  ` +
      `p50=${p.p50.toFixed(1)}  p95=${p.p95.toFixed(1)}  p99=${p.p99.toFixed(1)}  max=${p.max.toFixed(1)}`,
    );
    console.log(`  Throughput: ${throughput.toFixed(1)} req/s`);
    console.log(`  Status: ${JSON.stringify(bucketStatusCodes(m.statusCounts))}`);
  }

  state.stopped = true;
  console.log('\n');
  printSummaryTable(state.results);
  writeJsonReport(state.results);

  // A run with zero completed endpoints is a failure (vacuous truth guard).
  const allPass =
    state.results.length > 0 &&
    state.results.every((r) => {
      const errorRate = r.totalSent > 0 ? r.errors / r.totalSent : 0;
      return r.p95 < CONFIG.P95_THRESHOLD_MS && errorRate < CONFIG.ERROR_RATE_THRESHOLD;
    });

  if (allPass) {
    console.log('\n✓ ALL ENDPOINTS PASS — p95 < 300ms and error rate < 0.1% on every endpoint.');
    process.exit(0);
  } else {
    console.log('\n✗ LOAD TEST FAILED — at least one endpoint exceeded p95>300ms or error rate>=0.1%.');
    console.log('  See /home/z/my-project/load-test-results.json for details.');
    process.exit(1);
  }
}

// ─── Pre-flight connectivity probe ───────────────────────────────────────────

async function preflightProbe() {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: TARGET_HOST,
        port: TARGET_PORT,
        path: TARGET_PATH_PREFIX + '/api/health',
        method: 'GET',
        timeout: 5000,
      },
      (res) => {
        res.resume();
        res.on('end', () => {
          if (res.statusCode && res.statusCode < 500) {
            console.log(`  Pre-flight: target reachable (GET /api/health → ${res.statusCode}).`);
          } else {
            console.warn(
              `  ⚠ Pre-flight: /api/health returned ${res.statusCode} — server may be unhealthy. Proceeding anyway.`,
            );
          }
          resolve();
        });
      },
    );
    req.on('error', (e) => {
      console.warn(
        `  ⚠ Pre-flight: cannot reach ${CONFIG.TARGET_BASE_URL} (${e.message}). ` +
        `Is the dev server running on port ${TARGET_PORT}? Proceeding anyway — ` +
        `endpoints will record network errors.`,
      );
      resolve();
    });
    req.on('timeout', () => {
      console.warn('  ⚠ Pre-flight: /api/health timed out. Proceeding anyway.');
      req.destroy();
      resolve();
    });
    req.end();
  });
}

// ─── SIGINT handler ──────────────────────────────────────────────────────────

// v7.3.0: catch unhandled errors so the script always writes a partial
// JSON report (otherwise the orchestrator can't diagnose crashes).
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled promise rejection:', reason);
  try {
    if (state.results.length > 0) {
      writeJsonReport(state.results);
      console.error('[FATAL] Partial JSON report written before crash.');
    }
  } catch (e) { /* ignore */ }
  process.exit(2);
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
  try {
    if (state.results.length > 0) {
      writeJsonReport(state.results);
      console.error('[FATAL] Partial JSON report written before crash.');
    }
  } catch (e) { /* ignore */ }
  process.exit(3);
});

let sigintCount = 0;
process.on('SIGINT', () => {
  sigintCount++;
  if (sigintCount >= 2) {
    console.error('\n[SIGINT×2] Forcing immediate exit.');
    process.exit(130);
  }
  console.log('\n[SIGINT] Graceful stop requested — finishing in-flight requests...');
  state.stopped = true;
  // The current runEndpointTest's stop-checker will detect state.stopped
  // within ~200ms, drain in-flight requests (1s grace), then resolve.
  // main() continues to the summary/report/exit. If we're between endpoints
  // (no current test running), write the partial report now.
  setTimeout(() => {
    if (state.results.length > 0) {
      console.log('\n[SIGINT] Writing partial report...');
      printSummaryTable(state.results);
      writeJsonReport(state.results);
    }
    process.exit(130);
  }, 3000);
});

main().catch((e) => {
  console.error('[FATAL] Load test runner crashed:', e);
  process.exit(1);
});
