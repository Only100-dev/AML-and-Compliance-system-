#!/usr/bin/env bun
/**
 * IC-OS Shift-Left Audit Checker
 *
 * Static-analysis guard that enforces security-critical invariants across the
 * codebase. Run via `bun run check:audit`. Exits non-zero on any FAIL so CI
 * pipelines can block merges that violate the invariants.
 *
 * Checks:
 *   1. RBAC dev-bypass env-guard  — the authGuard dev bypass MUST be wrapped in
 *      `if (process.env.NODE_ENV === 'development')` AND carry the marker
 *      comment `// CRITICAL: NEVER REMOVE THIS ENV CHECK`. Fails if the bypass
 *      can execute outside development.
 *   2. Webhook signature validation — every route under /api/webhooks/ MUST call
 *      verifyWebhookSignature BEFORE any `db.` access. Fails on missing or
 *      out-of-order validation.
 *   3. Cron secret protection — every route under /api/cron/ MUST check the
 *      CRON_SECRET bearer token. Fails if missing.
 *   4. State-mutating route audit logging — POST/PUT/DELETE/PATCH routes that
 *      mutate the DB (create/update/delete/upsert) SHOULD write an AuditLog.
 *      Warns (does not fail) when a mutating route lacks audit logging.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, sep } from 'path';

const SRC = join(import.meta.dir, '..', 'src');
const ROUTES = join(SRC, 'app', 'api');

type Severity = 'PASS' | 'FAIL' | 'WARN';
interface Finding {
  severity: Severity;
  check: string;
  file: string;
  message: string;
}

const findings: Finding[] = [];

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, acc);
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      acc.push(full);
    }
  }
  return acc;
}

function rel(path: string): string {
  return path.split(sep).slice(-4).join(sep);
}

// ─── Check 1: RBAC dev-bypass env-guard ─────────────────────────────────────
function checkRBACBypass() {
  const guardPath = join(SRC, 'lib', 'auth-guard.ts');
  if (!existsSync(guardPath)) {
    findings.push({ severity: 'FAIL', check: 'rbac-bypass', file: 'lib/auth-guard.ts', message: 'auth-guard.ts not found' });
    return;
  }
  const src = readFileSync(guardPath, 'utf8');

  // Locate the dev-bypass block: a conditional granting access with a synthetic dev user.
  const bypassMatch = src.match(/Dev\s+User|dev@icos\.local|dev-user/i);
  if (!bypassMatch) {
    // No dev bypass present — nothing to enforce. (Not a failure; means the bypass
    // was removed entirely, which is the most secure state.)
    findings.push({ severity: 'PASS', check: 'rbac-bypass', file: 'lib/auth-guard.ts', message: 'No dev-bypass block detected (most secure)' });
    return;
  }

  // The bypass exists — verify it is wrapped in a NODE_ENV === 'development' guard.
  const envGuardRegex = /process\.env\.NODE_ENV\s*===\s*['"]development['"]/;
  if (!envGuardRegex.test(src)) {
    findings.push({ severity: 'FAIL', check: 'rbac-bypass', file: 'lib/auth-guard.ts', message: 'Dev-bypass block exists but is NOT wrapped in process.env.NODE_ENV === "development" guard' });
    return;
  }

  // Verify the marker comment is present (shift-left signal for reviewers).
  if (!/CRITICAL:\s*NEVER\s+REMOVE\s+THIS\s+ENV\s+CHECK/.test(src)) {
    findings.push({ severity: 'FAIL', check: 'rbac-bypass', file: 'lib/auth-guard.ts', message: 'Dev-bypass block missing the "// CRITICAL: NEVER REMOVE THIS ENV CHECK" marker comment' });
    return;
  }

  // Verify the env guard appears on a line BEFORE the synthetic-user return, i.e.
  // the bypass is inside the guarded branch (heuristic: env guard line number < bypass line number).
  const envLine = src.split('\n').findIndex((l) => envGuardRegex.test(l));
  const bypassLine = src.split('\n').findIndex((l) => /dev@icos\.local|Dev\s+User/i.test(l));
  if (envLine === -1 || bypassLine === -1 || bypassLine < envLine) {
    findings.push({ severity: 'FAIL', check: 'rbac-bypass', file: 'lib/auth-guard.ts', message: 'Dev-bypass block appears BEFORE the NODE_ENV guard — bypass is not protected' });
    return;
  }

  findings.push({ severity: 'PASS', check: 'rbac-bypass', file: 'lib/auth-guard.ts', message: 'Dev-bypass is wrapped in NODE_ENV === "development" guard with marker comment' });
}

// ─── Check 2: Webhook signature validation ordering ─────────────────────────
function checkWebhooks() {
  const webhooksDir = join(ROUTES, 'webhooks');
  if (!existsSync(webhooksDir)) {
    findings.push({ severity: 'PASS', check: 'webhook-sig', file: 'api/webhooks/', message: 'No webhook routes (skipped)' });
    return;
  }
  const files = walk(webhooksDir).filter((f) => f.endsWith('route.ts'));
  if (files.length === 0) {
    findings.push({ severity: 'WARN', check: 'webhook-sig', file: 'api/webhooks/', message: 'Webhooks directory exists but contains no route.ts files' });
    return;
  }
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const sigIdx = src.indexOf('verifyWebhookSignature');
    const dbIdx = src.search(/\bdb\./);
    if (sigIdx === -1) {
      findings.push({ severity: 'FAIL', check: 'webhook-sig', file: rel(file), message: 'Webhook route does not call verifyWebhookSignature' });
    } else if (dbIdx !== -1 && dbIdx < sigIdx) {
      findings.push({ severity: 'FAIL', check: 'webhook-sig', file: rel(file), message: 'Webhook route accesses db BEFORE verifying signature' });
    } else {
      findings.push({ severity: 'PASS', check: 'webhook-sig', file: rel(file), message: 'Signature verified before any db access' });
    }
  }
}

// ─── Check 3: Cron secret protection ────────────────────────────────────────
function checkCron() {
  const cronDir = join(ROUTES, 'cron');
  if (!existsSync(cronDir)) {
    findings.push({ severity: 'PASS', check: 'cron-secret', file: 'api/cron/', message: 'No cron routes (skipped)' });
    return;
  }
  const files = walk(cronDir).filter((f) => f.endsWith('route.ts'));
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const hasSecret = /CRON_SECRET/.test(src);
    const hasBearer = /authorization/i.test(src) && /bearer/i.test(src);
    if (!hasSecret || !hasBearer) {
      findings.push({ severity: 'FAIL', check: 'cron-secret', file: rel(file), message: `Cron route missing CRON_SECRET bearer check (secret=${hasSecret}, bearer=${hasBearer})` });
    } else {
      findings.push({ severity: 'PASS', check: 'cron-secret', file: rel(file), message: 'CRON_SECRET bearer check present' });
    }
  }
}

// ─── Check 4: State-mutating route audit logging (heuristic WARN) ───────────
function checkAuditLogging() {
  const files = walk(ROUTES).filter((f) => f.endsWith('route.ts'));
  let checked = 0;
  let warned = 0;
  for (const file of files) {
    // Skip read-only GET-only routes (no mutation keywords).
    const src = readFileSync(file, 'utf8');
    const mutates = /\bdb\.(\w+)\.(create|update|delete|upsert|deleteMany|updateMany|createMany)/.test(src) ||
      /\.\$transaction/.test(src);
    if (!mutates) continue;
    checked++;
    const hasAudit = /createAuditLog|AuditLog|\baudit\b/i.test(src);
    if (!hasAudit) {
      warned++;
      findings.push({ severity: 'WARN', check: 'audit-log', file: rel(file), message: 'Mutating route has no detectable audit-log call' });
    }
  }
  if (checked > 0) {
    findings.push({ severity: 'PASS', check: 'audit-log', file: 'api/', message: `${checked - warned}/${checked} mutating routes have audit logging` });
  }
}

// ─── Run all checks ─────────────────────────────────────────────────────────
checkRBACBypass();
checkWebhooks();
checkCron();
checkAuditLogging();

// ─── Report ─────────────────────────────────────────────────────────────────
const fails = findings.filter((f) => f.severity === 'FAIL');
const warns = findings.filter((f) => f.severity === 'WARN');
const passes = findings.filter((f) => f.severity === 'PASS');

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  IC-OS SHIFT-LEFT AUDIT CHECKER');
console.log('═══════════════════════════════════════════════════════════════');
for (const f of findings) {
  const icon = f.severity === 'PASS' ? '✅' : f.severity === 'WARN' ? '⚠️ ' : '❌';
  console.log(`  ${icon} [${f.severity}] ${f.check.padEnd(14)} ${f.file}`);
  console.log(`      ${f.message}`);
}
console.log('───────────────────────────────────────────────────────────────');
console.log(`  Total: ${findings.length}  |  PASS: ${passes.length}  |  WARN: ${warns.length}  |  FAIL: ${fails.length}`);
console.log('═══════════════════════════════════════════════════════════════\n');

if (fails.length > 0) {
  console.error(`❌ AUDIT CHECK FAILED — ${fails.length} invariant(s) violated. Fix before merging.`);
  process.exit(1);
}
console.log('✅ Audit check passed — all security invariants hold.');
process.exit(0);
