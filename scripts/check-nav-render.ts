#!/usr/bin/env bun
/**
 * ============================================================================
 * IC-OS Sidebar → Render-Case Verification Guard
 * ============================================================================
 *
 * WHAT THIS SCRIPT DOES
 * ---------------------
 * Static-analysis guard that prevents the class of regression observed in
 * commit ec4c992 (P2 sprint): a bulk commit silently deleted 10 lazy imports
 * + 10 switch cases from the root page (now DashboardApp.tsx), causing 5 sidebar nav items to
 * fall through to the default <CommandCenter/> — effectively breaking 3
 * regulatory sections (Vendor Risk, Resiliency Hub, Bordereaux) without any
 * error message or worklog acknowledgement.
 *
 * This guard enforces a simple invariant:
 *   EVERY sidebar nav item ID MUST have a matching `case '<id>':` in the
 *   renderSection() switch of src/components/ic-os/DashboardApp.tsx
 *   (the render logic was extracted from page.tsx in the v7.3.0-RC1 Gap
 *   Remediation sprint — page.tsx is now a session-gate server component).
 *
 * If a sidebar item is added without a render case (or an existing render
 * case is deleted while the sidebar item remains), this check FAILS the
 * build. This makes accidental-revert regressions impossible to merge.
 *
 * HOW TO RUN
 * ----------
 *   bun run scripts/check-nav-render.ts
 *   # or, via the wired-in npm script (runs as part of `bun run lint`):
 *   bun run lint
 *
 * Exit code is 0 if every sidebar item has a render case, 1 if any item is
 * missing its case — so the check is gating and will fail `bun run lint`
 * (and therefore CI).
 *
 * Author: UAT Hotfix Prevention Measures (Prevention 2.1)
 * Trigger: RCA of P2 commit ec4c992 silent regression
 * ============================================================================
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

// ─── Files under contract ───────────────────────────────────────────────────
const SIDEBAR_PATH = join(ROOT, 'src', 'components', 'ic-os', 'layout', 'Sidebar.tsx');
// The renderSection() switch lives in DashboardApp.tsx (extracted from page.tsx
// when page.tsx became a session-gating server component). The invariant is the
// same: every sidebar item ID must have a matching case here.
const PAGE_PATH = join(ROOT, 'src', 'components', 'ic-os', 'DashboardApp.tsx');

// ─── ANSI colors ────────────────────────────────────────────────────────────
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

// ─── Extraction helpers ─────────────────────────────────────────────────────

/**
 * Extract all nav item IDs from Sidebar.tsx.
 * Matches patterns like:  { id: 'command-center', label: '...', ... }
 * Ignores `key={item.id}` / `data-sidebar-item={item.id}` (those reference a
 * variable, not a literal). We only want literal string IDs in the nav arrays.
 */
function extractSidebarIds(): Set<string> {
  if (!existsSync(SIDEBAR_PATH)) {
    console.error(`${RED}FAIL${RESET} Sidebar not found: ${SIDEBAR_PATH}`);
    process.exit(1);
  }
  const src = readFileSync(SIDEBAR_PATH, 'utf8');
  const ids = new Set<string>();
  // Match: id: 'some-kebab-id'  OR  id: "some-kebab-id"
  // (Only literal strings — not {item.id} variable refs.)
  const re = /\bid:\s*['"]([a-z0-9-]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    ids.add(m[1]);
  }
  return ids;
}

/**
 * Extract all render-case IDs from page.tsx's renderSection() switch.
 * Matches:  case 'some-kebab-id':
 */
function extractRenderCaseIds(): Set<string> {
  if (!existsSync(PAGE_PATH)) {
    console.error(`${RED}FAIL${RESET} DashboardApp.tsx not found: ${PAGE_PATH}`);
    process.exit(1);
  }
  const src = readFileSync(PAGE_PATH, 'utf8');
  const ids = new Set<string>();
  // Match: case 'some-kebab-id':  (inside the switch)
  const re = /case\s+['"]([a-z0-9-]+)['"]:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    ids.add(m[1]);
  }
  return ids;
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const sidebarIds = extractSidebarIds();
  const renderCaseIds = extractRenderCaseIds();

  console.log(`${CYAN}━━━ Sidebar → Render-Case Verification ━━━${RESET}`);
  console.log(`${GRAY}Sidebar items : ${sidebarIds.size}${RESET}`);
  console.log(`${GRAY}Render cases  : ${renderCaseIds.size}${RESET}`);
  console.log('');

  // Check 1 (FAIL): every sidebar item MUST have a render case.
  const missingRenderCases: string[] = [];
  for (const id of sidebarIds) {
    if (!renderCaseIds.has(id)) {
      missingRenderCases.push(id);
    }
  }

  // Check 2 (WARN): orphaned render cases (case exists, no sidebar item).
  // Not a hard failure — some cases are routed to from CommandMenu only — but
  // worth surfacing so devs can decide whether to add a sidebar entry or
  // remove dead code.
  const orphanedRenderCases: string[] = [];
  for (const id of renderCaseIds) {
    if (!sidebarIds.has(id)) {
      orphanedRenderCases.push(id);
    }
  }

  let failed = false;

  if (missingRenderCases.length > 0) {
    console.error(`${RED}${BOLD}FAIL${RESET} ${missingRenderCases.length} sidebar item(s) have NO render case in DashboardApp.tsx:`);
    console.error(`${RED}      These items will silently fall through to the default <CommandCenter/>${RESET}`);
    console.error(`${RED}      when clicked — the exact regression observed in P2 commit ec4c992.${RESET}`);
    for (const id of missingRenderCases) {
      console.error(`        ${RED}• ${id}${RESET}`);
    }
    console.error('');
    console.error(`${YELLOW}Fix:${RESET} add the missing lazy import + switch case to src/components/ic-os/DashboardApp.tsx.`);
    console.error(`${YELLOW}Example:${RESET}`);
    console.error(`  const MyComponent = lazy(() => import('@/components/.../MyComponent').then(m => ({ default: m.MyComponent })));`);
    console.error(`  // ...inside renderSection() switch:`);
    console.error(`  case '${missingRenderCases[0]}':`);
    console.error(`    return <ModuleErrorBoundary moduleName="..."><MyComponent /></ModuleErrorBoundary>;`);
    failed = true;
  }

  if (orphanedRenderCases.length > 0) {
    console.warn(`${YELLOW}WARN${RESET} ${orphanedRenderCases.length} render case(s) have no sidebar item (may be CommandMenu-only):`);
    for (const id of orphanedRenderCases) {
      console.warn(`        ${YELLOW}• ${id}${RESET}`);
    }
    console.warn(`${GRAY}      (Not a failure — informational. Verify these are intentional.)${RESET}`);
  }

  if (!failed) {
    console.log(`${GREEN}${BOLD}PASS${RESET} All ${sidebarIds.size} sidebar items have a matching render case in DashboardApp.tsx.`);
    if (orphanedRenderCases.length > 0) {
      console.log(`${GRAY}     (${orphanedRenderCases.length} orphaned render case(s) warned above.)${RESET}`);
    }
    process.exit(0);
  } else {
    console.error('');
    console.error(`${RED}━━━ ${missingRenderCases.length} FAIL(s) — blocking merge. Restore the render cases or remove the sidebar items. ━━━${RESET}`);
    process.exit(1);
  }
}

main();
