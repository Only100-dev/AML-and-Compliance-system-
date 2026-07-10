#!/usr/bin/env bun
/**
 * ============================================================================
 * IC-OS Audit-Logging Convention Checker  (Phase 1 — file-level)
 * ============================================================================
 *
 * WHAT THIS SCRIPT DOES
 * ---------------------
 * Walks every `route.ts` / `route.tsx` file under `src/app/api/` and enforces
 * the IC-OS Engineering Mandate: "Every state-changing API endpoint must
 * include createAuditLog()."  A route file is considered to perform state
 * changes if it exports at least one of the HTTP methods POST, PUT, PATCH, or
 * DELETE.  If it does, the file content MUST contain the literal token
 * `createAuditLog` (i.e. a call to the canonical audit-logging helper).  Files
 * that only export GET/HEAD/OPTIONS are not subject to the rule.
 *
 * The checker is intentionally syntactic / file-level — it does NOT parse the
 * AST and therefore cannot detect partial-audit cases (e.g. a file that audits
 * POST but forgets to audit PUT).  That deeper analysis is Phase 2, which will
 * be implemented as a custom ESLint AST rule (see "Phase 2" below).
 *
 * HOW TO RUN
 * ----------
 *   bun run scripts/check-audit-logging.ts
 *   # or, via the wired-in npm script:
 *   bun run check:audit
 *   # or, as part of the full lint chain:
 *   bun run lint        # → eslint . && bun run check:audit
 *
 * Exit code is 0 if no violations, 1 if any violation is found — so the check
 * is gating and will fail `bun run lint` (and therefore CI).
 *
 * ESCAPE-HATCH COMMENT MARKER
 * ---------------------------
 * If a particular file legitimately cannot or should not call createAuditLog
 * (e.g. it is a pure read endpoint that happens to export a POST stub for CORS
 * preflight, or it is internal infrastructure), add this comment near the top
 * of the file:
 *
 *   // @audit-logging-exempt: <short reason>
 *
 * The marker may appear anywhere in the file but convention is to place it in
 * the file header.  The reason text is captured in the report.  Use sparingly —
 * every exemption is a deliberate, reviewable decision recorded in the output.
 *
 * BUILT-IN ALLOWLIST
 * ------------------
 * A small set of paths are ALWAYS exempt because they are framework callbacks
 * or genuinely stateless utilities.  The current built-in allowlist is in the
 * `BUILT_IN_EXEMPTIONS` map below.  To add a new built-in exemption:
 *   1. Add an entry: `'src/app/api/<path>/route.ts': '<reason>'`.
 *   2. Re-run `bun run check:audit` and confirm the file moved to "Exempt".
 *   3. Commit the change with a clear message referencing the exemption
 *      rationale.  Built-in exemptions should be RARE — prefer the per-file
 *      `// @audit-logging-exempt:` marker for project-specific exemptions.
 *
 * PHASE 2 — ESLint AST Rule (planned)
 * -----------------------------------
 * This Phase-1 script catches the common case: a route file with NO
 * createAuditLog call at all.  Phase 2 will add a custom ESLint rule
 * (eslint-plugin-icos-audit) that walks each exported handler's AST and flags
 * handlers that do not invoke createAuditLog on their primary success path.
 * That will catch:
 *   - Partial-audit files (e.g. POST audited, PUT not).
 *   - Files that call createAuditLog only inside an error branch.
 *   - Files that import but never invoke createAuditLog.
 * Until Phase 2 lands, treat a clean Phase-1 report as necessary-but-not-
 * sufficient evidence of audit coverage.
 *
 * Author: P0-1c-checker (IC-OS P0 Security Sprint)
 * ============================================================================
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// ─── Configuration ─────────────────────────────────────────────────────────

const ROOT = process.cwd();
const API_ROOT = join(ROOT, 'src', 'app', 'api');
const STATE_METHODS = ['DELETE', 'PATCH', 'POST', 'PUT'] as const;
const STATE_METHOD_SET = new Set<string>(STATE_METHODS);
const AUDIT_TOKEN = 'createAuditLog';
const EXEMPT_MARKER = /\/\/\s*@audit-logging-exempt:\s*(.+)/;

/**
 * Built-in allowlist.  Keys are POSIX-style project-relative paths.
 * Each value is the human-readable reason shown in the report.
 *
 * These paths are exempt for one of three reasons:
 *   (a) Framework callback — NextAuth handler re-exported via `export { handler as ... }`.
 *   (b) Auditor read-only stubs — POST/PUT/DELETE return 403 by design.
 *   (c) Stateless utility — no database writes; nothing to audit.
 *   (d) Internal infrastructure — idempotency cache, not business state.
 */
const BUILT_IN_EXEMPTIONS: Record<string, string> = {
  'src/app/api/auth/[...nextauth]/route.ts':
    'NextAuth callback handler (re-export form) — auth framework, not business state',
  'src/app/api/audit/point-in-time/route.ts':
    'Auditor read-only — POST/PUT/DELETE are 403 stubs by design (FDL 10/2025 Art. 11,15)',
  'src/app/api/audit/integrity/route.ts':
    'GET-only audit-integrity verifier (no state change; defense-in-depth exemption)',
  'src/app/api/goaml/validate/route.ts':
    'Stateless XML validation utility — no `db` import, no DB writes',
  'src/app/api/goaml-xml/route.ts':
    'Stateless XML generation utility — no `db` import, no DB writes',
  'src/app/api/bordereaux/validate/route.ts':
    'Stateless validation utility (per audit brief; see P0-1c-checker notes)',
  'src/app/api/idempotency/route.ts':
    'Internal idempotency-cache infrastructure (not business state)',
};

// ─── Types ─────────────────────────────────────────────────────────────────

interface Violation {
  file: string;
  methods: string[];
  reason: string;
}

interface ExemptEntry {
  file: string;
  reason: string;
}

// ─── Filesystem walker ─────────────────────────────────────────────────────

/** Recursively collect all `route.{ts,tsx}` files under `dir`, sorted. */
function walkRoutes(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walkRoutes(full, out);
    } else if (entry === 'route.ts' || entry === 'route.tsx') {
      out.push(full);
    }
  }
  return out;
}

// ─── Export-form detection ─────────────────────────────────────────────────

interface ExtractResult {
  /** Set of state-changing HTTP methods exported by this file. */
  methods: Set<string>;
  /** True if the file uses the NextAuth `export { handler as METHOD }` form. */
  usesNextAuthReExport: boolean;
}

/**
 * Extract the state-changing HTTP methods exported by a route file.
 *
 * Handles all five forms enumerated in the audit brief:
 *   1. `export async function POST(...)`
 *   2. `export function POST(...)`
 *   3. `export const POST = ...`
 *   4. `export const POST = withRBAC(...)(async ...)`  (HOC-wrapped — same regex as #3)
 *   5. `export { handler as GET, handler as POST }`    (NextAuth re-export form)
 *
 * Form #5 is auto-exempted by the caller (it is a framework callback pattern).
 */
function extractStateMethods(content: string): ExtractResult {
  const methods = new Set<string>();
  let usesNextAuthReExport = false;

  for (const m of STATE_METHODS) {
    // Form 1 & 2: `export [async] function POST`
    const fnDeclRe = new RegExp(
      `^export\\s+(?:async\\s+)?function\\s+${m}\\b`,
      'm',
    );
    if (fnDeclRe.test(content)) {
      methods.add(m);
      continue;
    }

    // Form 3 & 4: `export const POST =`  (covers plain const and HOC-wrapped const)
    const constRe = new RegExp(`^export\\s+const\\s+${m}\\s*=`, 'm');
    if (constRe.test(content)) {
      methods.add(m);
      continue;
    }

    // Form 5: `export { ... as POST, ... }`  (NextAuth re-export form)
    const reExportRe = new RegExp(
      `^export\\s*\\{[^}]*\\bas\\s+${m}\\b[^}]*\\}`,
      'm',
    );
    if (reExportRe.test(content)) {
      methods.add(m);
      usesNextAuthReExport = true;
      continue;
    }
  }

  return { methods, usesNextAuthReExport };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Convert an absolute path to a POSIX-style project-relative path. */
function rel(p: string): string {
  return relative(ROOT, p).split(/[\\/]/).join('/');
}

/** Top-level route category (the first path segment under `src/app/api/`). */
function category(relPath: string): string {
  // relPath looks like `src/app/api/<cat>/.../route.ts`
  const parts = relPath.split('/');
  return parts.length >= 4 ? parts[3] : '(root)';
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main(): void {
  const files = walkRoutes(API_ROOT).sort();

  const violations: Violation[] = [];
  const exempt: ExemptEntry[] = [];
  let stateChangingCount = 0;

  for (const file of files) {
    const relPath = rel(file);

    let content: string;
    try {
      content = readFileSync(file, 'utf8');
    } catch (err) {
      // Unreadable file — surface as a violation so it gets attention.
      violations.push({
        file: relPath,
        methods: [],
        reason: `UNREADABLE_FILE: ${(err as Error).message}`,
      });
      continue;
    }

    // Built-in path-based allowlist.
    if (Object.prototype.hasOwnProperty.call(BUILT_IN_EXEMPTIONS, relPath)) {
      exempt.push({
        file: relPath,
        reason: BUILT_IN_EXEMPTIONS[relPath],
      });
      continue;
    }

    const { methods, usesNextAuthReExport } = extractStateMethods(content);

    // No state-changing exports → not subject to the rule.
    if (methods.size === 0) continue;
    stateChangingCount++;

    // Per-file escape hatch (`// @audit-logging-exempt: <reason>`).
    const marker = content.match(EXEMPT_MARKER);
    if (marker) {
      exempt.push({
        file: relPath,
        reason: `per-file marker — ${marker[1].trim()}`,
      });
      continue;
    }

    // NextAuth re-export form is auto-exempt (framework callback).
    if (usesNextAuthReExport) {
      exempt.push({
        file: relPath,
        reason:
          'NextAuth `export { handler as METHOD }` re-export form (auto-exempt)',
      });
      continue;
    }

    // The actual rule: file must contain the literal token `createAuditLog`.
    if (content.includes(AUDIT_TOKEN)) continue;

    violations.push({
      file: relPath,
      methods: Array.from(methods).sort(),
      reason: 'STATE_CHANGE_WITHOUT_AUDIT_LOG',
    });
  }

  // Deterministic ordering — sort by file path.
  violations.sort((a, b) => a.file.localeCompare(b.file));
  exempt.sort((a, b) => a.file.localeCompare(b.file));

  // ─── Report ──────────────────────────────────────────────────────────────

  const lines: string[] = [];
  lines.push('IC-OS Audit-Logging Convention Check');
  lines.push('=====================================');
  lines.push(`Total route files scanned: ${files.length}`);
  lines.push(`State-changing route files: ${stateChangingCount}`);
  lines.push(`Exempt: ${exempt.length} (listed below)`);
  lines.push(`Violations: ${violations.length} (listed below)`);
  lines.push('');

  lines.push('Exempt files:');
  if (exempt.length === 0) {
    lines.push('  (none)');
  } else {
    for (const e of exempt) {
      lines.push(`  - ${e.file} — ${e.reason}`);
    }
  }
  lines.push('');

  lines.push('Violations (state-changing routes without createAuditLog):');
  if (violations.length === 0) {
    lines.push('  (none — all state-changing routes are audit-logged ✓)');
  } else {
    for (const v of violations) {
      const methodsStr = v.methods.length > 0 ? v.methods.join(', ') : '(unknown)';
      lines.push(`  - ${v.file} — methods: ${methodsStr} — ${v.reason}`);
    }
  }
  lines.push('');

  // Category breakdown for triage.
  if (violations.length > 0) {
    const byCat = new Map<string, number>();
    for (const v of violations) {
      const c = category(v.file);
      byCat.set(c, (byCat.get(c) ?? 0) + 1);
    }
    lines.push('Violations by route category (top-level path segment):');
    const cats = Array.from(byCat.entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });
    for (const [c, n] of cats) {
      lines.push(`  - ${c}: ${n}`);
    }
    lines.push('');
  }

  lines.push(
    violations.length === 0
      ? 'Result: PASS — all state-changing routes invoke createAuditLog.'
      : `Result: FAIL — ${violations.length} state-changing route(s) missing createAuditLog.`,
  );

  console.log(lines.join('\n'));

  process.exit(violations.length > 0 ? 1 : 0);
}

main();
