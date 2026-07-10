#!/usr/bin/env bun
/**
 * ============================================================================
 * IC-OS RBAC Dev-Bypass Security Check
 * ============================================================================
 *
 * WHAT THIS SCRIPT DOES
 * ---------------------
 * Enforces the P2 mandate: the development-only RBAC / auth bypass must NEVER
 * execute outside of development. This is a STATIC grep-based guard that fails
 * the build (and therefore `bun run lint` / CI) if any of the following hold:
 *
 *   1. A dev-bypass assignment (`userRole = 'admin'`, `userId = 'dev-user'`,
 *      or a synthetic `session.user` dev object) appears in rbac.ts or
 *      auth-guard.ts WITHOUT being inside an
 *      `if (... NODE_ENV === 'development')` guarded block.
 *
 *   2. The mandatory marker comment `// CRITICAL: NEVER REMOVE THIS ENV CHECK`
 *      is missing immediately above the guard. This makes intent explicit and
 *      trips the check if someone deletes the guard but leaves the bypass.
 *
 *   3. The bypass guard's condition does not actually reference
 *      `NODE_ENV === 'development'` (e.g. someone weakens it to
 *      `process.env.NODE_ENV !== 'production'` which would let test/staging
 *      through).
 *
 * The check is intentionally syntactic — it does not parse the AST — but it
 * is sufficient to catch the regression classes that matter: removal of the
 * env guard, weakening of the condition, or silent deletion of the marker.
 *
 * HOW TO RUN
 * ----------
 *   bun run scripts/check-rbac-dev-bypass.ts
 *   # or, via the wired-in npm script (runs as part of check:audit → lint → CI):
 *   bun run check:audit
 *
 * Exit code is 0 if all guards are intact, 1 if any violation is found — so
 * the check is gating and will fail `bun run lint` (and therefore CI).
 *
 * Author: P2 Security Hardening (Complaint Management & DMS Sprint)
 * ============================================================================
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

// ─── Files under contract ───────────────────────────────────────────────────
// Each entry maps a source file to the set of dev-bypass "fingerprints" it is
// permitted to contain, provided every fingerprint is guarded by an
// `if (... NODE_ENV === 'development')` block annotated with the CRITICAL
// marker comment.
interface FileContract {
  path: string;
  // Substrings that indicate a dev-bypass assignment. Each occurrence MUST be
  // preceded (within GUARD_WINDOW lines above) by a NODE_ENV === 'development'
  // guard line AND a CRITICAL marker line.
  fingerprints: string[];
}

const CONTRACTS: FileContract[] = [
  {
    path: 'src/lib/compliance/rbac.ts',
    fingerprints: ["userRole = 'admin'", "userId = 'dev-user'"],
  },
  {
    path: 'src/lib/auth-guard.ts',
    fingerprints: ["role: 'admin'", "userId: 'dev-user'", "name: 'Dev User'"],
  },
];

// ─── Configuration ──────────────────────────────────────────────────────────

const GUARD_WINDOW = 15; // lines above a fingerprint to look for the guard
const ENV_GUARD_RE = /NODE_ENV\s*===\s*['"]development['"]/;
const CRITICAL_MARKER = '// CRITICAL: NEVER REMOVE THIS ENV CHECK';
// Reject weakened conditions that are NOT the strict development check.
// Allowed:  process.env.NODE_ENV === 'development'
// Rejected: process.env.NODE_ENV !== 'production'  (lets test/staging through)
// Rejected: process.env.NODE_ENV === 'test'
const WEAKENED_GUARD_RE =
  /NODE_ENV\s*!==\s*['"]production['"]|NODE_ENV\s*===\s*['"]test['"]/;

// ─── Types ──────────────────────────────────────────────────────────────────

interface Violation {
  file: string;
  line: number;
  fingerprint: string;
  reason: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function readLines(relPath: string): string[] {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) {
    console.error(`[check-rbac-dev-bypass] MISSING FILE: ${relPath}`);
    return [];
  }
  return readFileSync(abs, 'utf8').split('\n');
}

/**
 * For a given fingerprint occurrence at `lineIdx`, walk upward up to
 * GUARD_WINDOW lines and verify:
 *   (a) a NODE_ENV === 'development' guard exists in the window, AND
 *   (b) the CRITICAL marker comment exists in the window, AND
 *   (c) NO weakened guard condition exists in the window.
 */
function isFingerprintGuarded(
  lines: string[],
  lineIdx: number
): { ok: true } | { ok: false; reason: string } {
  const start = Math.max(0, lineIdx - GUARD_WINDOW);
  let sawEnvGuard = false;
  let sawCriticalMarker = false;
  let sawWeakened = false;

  for (let i = start; i <= lineIdx; i++) {
    const line = lines[i] ?? '';
    if (ENV_GUARD_RE.test(line)) sawEnvGuard = true;
    if (line.includes(CRITICAL_MARKER)) sawCriticalMarker = true;
    if (WEAKENED_GUARD_RE.test(line)) sawWeakened = true;
  }

  if (sawWeakened) {
    return {
      ok: false,
      reason:
        'Weakened NODE_ENV guard detected (e.g. !== "production" or === "test"). ' +
        'Bypass must be gated on the strict `NODE_ENV === "development"` check.',
    };
  }
  if (!sawEnvGuard) {
    return {
      ok: false,
      reason:
        'Dev-bypass assignment is NOT inside an `if (... NODE_ENV === "development")` ' +
        'guarded block. This would let the bypass execute in production.',
    };
  }
  if (!sawCriticalMarker) {
    return {
      ok: false,
      reason: `Missing mandatory marker comment "${CRITICAL_MARKER}" ` +
        'above the env guard. The marker makes the security intent explicit.',
    };
  }
  return { ok: true };
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main(): void {
  const violations: Violation[] = [];

  for (const contract of CONTRACTS) {
    const lines = readLines(contract.path);
    if (lines.length === 0) {
      // Missing file already reported; treat as a violation to be safe.
      violations.push({
        file: contract.path,
        line: 0,
        fingerprint: '(file missing)',
        reason: 'Source file not found — cannot verify RBAC dev-bypass guard.',
      });
      continue;
    }

    for (const fingerprint of contract.fingerprints) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(fingerprint)) {
          const guard = isFingerprintGuarded(lines, i);
          if (!guard.ok) {
            violations.push({
              file: contract.path,
              line: i + 1,
              fingerprint,
              reason: guard.reason,
            });
          }
        }
      }
    }
  }

  // ─── Report ──────────────────────────────────────────────────────────────
  const lines: string[] = [];
  lines.push('IC-OS RBAC Dev-Bypass Security Check');
  lines.push('=====================================');
  lines.push(`Files under contract: ${CONTRACTS.length}`);
  lines.push(`  - ${CONTRACTS.map((c) => c.path).join('\n  - ')}`);
  lines.push(`Violations: ${violations.length}`);
  lines.push('');

  if (violations.length === 0) {
    lines.push('Result: PASS — all RBAC dev-bypasses are correctly gated on');
    lines.push('        NODE_ENV === "development" and carry the CRITICAL marker.');
  } else {
    lines.push('Violations (RBAC bypass executed outside development risk):');
    for (const v of violations) {
      lines.push(
        `  - ${v.file}:${v.line} — fingerprint "${v.fingerprint}" — ${v.reason}`
      );
    }
    lines.push('');
    lines.push('Result: FAIL — fix the guards above before committing.');
    lines.push('        Mandate ref: P2 RBAC Security Hardening.');
  }

  console.log(lines.join('\n'));
  process.exit(violations.length > 0 ? 1 : 0);
}

main();
