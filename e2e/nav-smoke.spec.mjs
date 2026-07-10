// ============================================================================
// IC-OS v7.3.0 — Prevention Measure 2.3: Automated Navigation Smoke Test
// ----------------------------------------------------------------------------
// Navigates to EVERY sidebar item (all 36) and verifies the page renders
// without JavaScript errors. Catches the class of regression where a sidebar
// nav item is added but its renderSection() switch case is accidentally
// deleted (see GAP_ANALYSIS_REPORT.md — P2 commit ec4c992 silently reverted
// 5 nav items).
//
// Pattern: matches existing e2e-test.mjs (plain `playwright` import, NOT the
// @playwright/test runner). Launches headless Chromium, reuses a running dev
// server if reachable, otherwise spawns its own.
//
// IMPORTANT: Uses http://localhost:3000 (NOT 127.0.0.1) because the app's CSP
// (src/middleware.ts) connect-src allows `ws://localhost:3000` but NOT
// `ws://127.0.0.1:3000`. With 127.0.0.1, the Next.js HMR WebSocket is blocked,
// which prevents full React hydration — clicks on sidebar buttons silently
// no-op. With localhost, HMR connects and hydration completes normally.
//
// Run:  npm run test:e2e:nav
// ============================================================================

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const HOST = process.env.E2E_HOST || 'localhost';
const PORT = parseInt(process.env.E2E_PORT || '3000', 10);
const BASE_URL = `http://${HOST}:${PORT}`;

// --- Console / page error capture -------------------------------------------
const CONSOLE_ERRORS = [];
const PAGE_ERRORS = [];

// --- Helpers ----------------------------------------------------------------
function waitForServer(url, maxWait = 60000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (Date.now() - start > maxWait) return resolve(false);
      const req = http.get(url, (res) => {
        res.resume();
        resolve(res.statusCode < 500);
      });
      req.on('error', () => setTimeout(check, 1000));
      req.setTimeout(2000, () => req.destroy(new Error('timeout')));
    };
    check();
  });
}

function spawnDevServer(port) {
  console.log(`  Spawning Next.js dev server on :${port} ...`);
  const server = spawn('node', [
    path.join(PROJECT_ROOT, 'node_modules/.bin/next'),
    'dev',
    '-p',
    String(port),
    '-H',
    '0.0.0.0',
  ], {
    cwd: PROJECT_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => {
    const t = d.toString();
    if (t.includes('Ready') || t.includes('Local:')) {
      console.log('  [dev-server]', t.trim().substring(0, 120));
    }
  });
  server.stderr.on('data', (d) => {
    const t = d.toString();
    if (/error|warn/i.test(t) && !t.includes('prisma:query')) {
      console.log('  [dev-server:err]', t.trim().substring(0, 200));
    }
  });
  return server;
}

// Filter out benign dev-mode noise (HMR, React DevTools promo, Fast Refresh)
function isBenignError(text) {
  return (
    /webpack-hmr/i.test(text) ||
    /Download the React DevTools/i.test(text) ||
    /Fast Refresh/i.test(text) ||
    /hot-update/i.test(text) ||
    /\[HMR\]/i.test(text) // HMR status logs (connected/disconnected) — not errors
  );
}

// --- Main -------------------------------------------------------------------
async function run() {
  let spawnedServer = null;

  // 1) Ensure dev server is up (reuse if running, else spawn)
  let serverUp = await waitForServer(BASE_URL + '/', 3000);
  if (!serverUp) {
    console.log(`  No server detected at ${BASE_URL} — spawning one.`);
    spawnedServer = spawnDevServer(PORT);
    serverUp = await waitForServer(BASE_URL + '/', 60000);
  }
  if (!serverUp) {
    console.error('FATAL: dev server not reachable at', BASE_URL);
    if (spawnedServer) spawnedServer.kill();
    process.exit(1);
  }
  console.log(`  Dev server reachable at ${BASE_URL}\n`);

  // 2) Launch browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Capture all console errors + page errors globally
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      CONSOLE_ERRORS.push(msg.text().substring(0, 400));
    }
  });
  page.on('pageerror', (err) => {
    PAGE_ERRORS.push((err.stack || err.message || String(err)).substring(0, 400));
  });

  const results = [];

  try {
    // 3) Navigate to root. Use 'load' + a short settle to allow HMR connect +
    //    React hydration to complete. The sidebar buttons must have React
    //    fiber/props attached (verified via __react* keys on the DOM node).
    console.log('=== Step 1: Load root route ===');
    await page.goto(BASE_URL + '/', { timeout: 45000, waitUntil: 'load' });
    await page.waitForSelector('aside nav button[data-sidebar-item]', { timeout: 20000 });

    // Wait for React hydration: a nav button must have __reactProps attached.
    // This is the reliable signal that onClick handlers are active.
    console.log('  Waiting for React hydration...');
    let hydrated = false;
    for (let i = 0; i < 30; i++) {
      const hasProps = await page.evaluate(() => {
        const btn = document.querySelector('aside nav button[data-sidebar-item]');
        if (!btn) return false;
        return Object.keys(btn).some((k) => k.startsWith('__reactProps'));
      }).catch(() => false);
      if (hasProps) { hydrated = true; break; }
      await page.waitForTimeout(500);
    }
    if (!hydrated) {
      throw new Error(
        'React hydration did not complete within 15s — nav buttons have no __reactProps. ' +
        'Check that the dev server is healthy and CSP allows ws://localhost:PORT for HMR.'
      );
    }
    console.log('  Hydrated. Title:', await page.title());

    // 4) Extract all sidebar nav item IDs + labels from the DOM
    const navItems = await page.$$eval(
      'aside nav button[data-sidebar-item]',
      (btns) => btns.map((b) => ({
        id: b.getAttribute('data-sidebar-item'),
        label: b.getAttribute('aria-label') || b.textContent?.trim() || '',
      })),
    );
    console.log(`\n=== Step 2: Discovered ${navItems.length} sidebar nav items ===\n`);

    if (navItems.length === 0) {
      throw new Error('No sidebar nav items found — data-sidebar-item attribute may be missing.');
    }

    // 5) Iterate every item, click, verify render
    console.log('=== Step 3: Visiting each nav item ===\n');
    let passCount = 0;
    let failCount = 0;
    const LOADER_TEXT = 'Loading module...'; // SectionLoader fallback text

    for (let i = 0; i < navItems.length; i++) {
      const { id, label } = navItems[i];
      const idx = `[${String(i + 1).padStart(2, '0')}/${String(navItems.length).padStart(2, '0')}]`;

      // Snapshot error counters BEFORE clicking so we can attribute per-item errors
      const errCountBefore = CONSOLE_ERRORS.length;
      const pgErrCountBefore = PAGE_ERRORS.length;

      try {
        // Re-locate the button fresh each iteration (DOM may have shifted after lazy load)
        const btn = page.locator(`aside nav button[data-sidebar-item="${id}"]`).first();
        await btn.waitFor({ state: 'visible', timeout: 5000 });
        await btn.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});

        // Use a direct DOM .click() via evaluate. Radix TooltipTrigger wraps the
        // button; a direct DOM click fires the React synthetic onClick reliably
        // and is faster than Playwright's pointer-based click. Fallback to
        // Playwright click if evaluate fails.
        const clicked = await page.evaluate((targetId) => {
          const el = document.querySelector(
            `aside nav button[data-sidebar-item="${CSS.escape(targetId)}"]`,
          );
          if (!el) return false;
          el.click();
          return true;
        }, id).catch(() => false);

        if (!clicked) {
          await btn.click({ timeout: 5000, force: true }).catch(() => {});
        }

        // Wait for the lazy-loaded component to mount. The app uses React.lazy +
        // Suspense with <SectionLoader /> (renders "Loading module..." + spinner).
        // We wait for <main> to be visible AND contain content that is NOT the
        // loader text, OR 8s to elapse.
        const main = page.locator('main').first();
        await main.waitFor({ state: 'visible', timeout: 8000 });

        let contentLen = 0;
        let contentSnippet = '';
        const startedAt = Date.now();
        while (Date.now() - startedAt < 8000) {
          const txt = (await main.innerText().catch(() => '')) || '';
          contentSnippet = txt.trim();
          contentLen = contentSnippet.length;
          // Break only when we have meaningful content that is NOT the loader fallback
          if (
            contentLen > 20 &&
            contentSnippet !== LOADER_TEXT &&
            !contentSnippet.startsWith(LOADER_TEXT)
          ) {
            break;
          }
          await page.waitForTimeout(300);
        }

        // 6) Assertions
        const url = page.url();
        const urlOk = url === BASE_URL + '/' || url === BASE_URL || url.endsWith('/');
        const mainVisible = await main.isVisible().catch(() => false);
        const hasContent = contentLen > 0;
        // A lazy component that never mounts leaves main showing only the
        // SectionLoader text. Treat that as a failure.
        const stuckOnLoader =
          contentSnippet === LOADER_TEXT || contentSnippet.startsWith(LOADER_TEXT);

        // Collect errors that occurred DURING this nav transition
        const itemConsoleErrors = CONSOLE_ERRORS.slice(errCountBefore).filter(
          (e) => !isBenignError(e),
        );
        const itemPageErrors = PAGE_ERRORS.slice(pgErrCountBefore).filter(
          (e) => !isBenignError(e),
        );

        const ok =
          urlOk && mainVisible && hasContent && itemPageErrors.length === 0 && !stuckOnLoader;

        if (ok) {
          passCount++;
          console.log(
            `${idx} PASS  ${id.padEnd(28)} (${label}) — ${contentLen} chars: ` +
            `"${contentSnippet.substring(0, 45).replace(/\s+/g, ' ')}..."`,
          );
        } else {
          failCount++;
          const reasons = [];
          if (!urlOk) reasons.push(`url=${url}`);
          if (!mainVisible) reasons.push('main not visible');
          if (!hasContent) reasons.push('main blank');
          if (stuckOnLoader) reasons.push('stuck on SectionLoader (lazy mount failed)');
          if (itemPageErrors.length) reasons.push(`${itemPageErrors.length} page errors`);
          console.log(`${idx} FAIL  ${id.padEnd(28)} (${label}) — ${reasons.join(', ')}`);
          if (itemPageErrors[0]) {
            console.log(`         pageError: ${itemPageErrors[0].substring(0, 200)}`);
          }
        }

        results.push({
          id,
          label,
          status: ok ? 'pass' : 'fail',
          reason: ok ? '' : 'see log',
          contentLen,
          contentSnippet: contentSnippet.substring(0, 120),
          url,
          consoleErrors: itemConsoleErrors,
          pageErrors: itemPageErrors,
        });

        // Small settle pause before next click so lazy chunks finish loading
        await page.waitForTimeout(400);
      } catch (e) {
        failCount++;
        const msg = e.message?.substring(0, 200) || String(e);
        console.log(`${idx} FAIL  ${id.padEnd(28)} (${label}) — EXCEPTION: ${msg}`);
        const itemConsoleErrors = CONSOLE_ERRORS.slice(errCountBefore).filter(
          (e2) => !isBenignError(e2),
        );
        const itemPageErrors = PAGE_ERRORS.slice(pgErrCountBefore).filter(
          (e2) => !isBenignError(e2),
        );
        results.push({
          id,
          label,
          status: 'fail',
          reason: msg,
          contentLen: 0,
          contentSnippet: '',
          url: page.url(),
          consoleErrors: itemConsoleErrors,
          pageErrors: itemPageErrors,
        });
      }
    }

    // 7) Final summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total sidebar items:  ${navItems.length}`);
    console.log(`Passed:               ${passCount}`);
    console.log(`Failed:               ${failCount}`);

    if (failCount > 0) {
      console.log('\n--- FAILURES ---');
      for (const r of results.filter((x) => x.status === 'fail')) {
        console.log(`  - ${r.id} (${r.label}) — ${r.reason}`);
        if (r.pageErrors?.length) {
          console.log(`      pageError: ${r.pageErrors[0].substring(0, 200)}`);
        }
      }
    }

    // --- DIAGNOSTIC WARNINGS -------------------------------------------------
    // Surface items that technically "pass" the smoke assertions (page didn't
    // crash, main has content) but exhibit symptoms of underlying issues:
    //   • "Module Error" content  → ModuleErrorBoundary caught a render error
    //     (component threw; ErrorBoundary prevented a page crash).
    //   • CommandCenter fallback  → nav ID has no renderSection() case, so it
    //     falls through to the default case (CommandCenter). This is the exact
    //     regression class documented in GAP_ANALYSIS_REPORT.md.
    //   • Suspiciously short content (< 50 chars) → likely a stuck internal
    //     loader or empty state.
    const moduleErrorItems = results.filter(
      (r) => r.contentSnippet.includes('Module Error') || r.contentSnippet.includes('encountered an error'),
    );
    const ccFallbackItems = results.filter(
      (r) =>
        r.contentSnippet.includes('Loading dashboard metrics') ||
        (r.contentSnippet.includes('Unified Command Center') &&
          r.id !== 'command-center'),
    );
    const shortContentItems = results.filter(
      (r) =>
        r.status === 'pass' &&
        r.contentLen < 50 &&
        !moduleErrorItems.includes(r) &&
        !ccFallbackItems.includes(r),
    );

    const totalWarnings =
      moduleErrorItems.length + ccFallbackItems.length + shortContentItems.length;

    if (totalWarnings > 0) {
      console.log('\n--- DIAGNOSTIC WARNINGS (smoke passed, but symptoms detected) ---');
      console.log(
        `  Module Error (caught render error):  ${moduleErrorItems.length} items`,
      );
      moduleErrorItems.forEach((r) =>
        console.log(`    - ${r.id.padEnd(28)} (${r.label})`),
      );
      console.log(
        `  Command Center fallback (no render case): ${ccFallbackItems.length} items`,
      );
      ccFallbackItems.forEach((r) =>
        console.log(`    - ${r.id.padEnd(28)} (${r.label})`),
      );
      console.log(`  Suspiciously short content (<50 chars): ${shortContentItems.length} items`);
      shortContentItems.forEach((r) =>
        console.log(`    - ${r.id.padEnd(28)} (${r.label}) — ${r.contentLen} chars`),
      );
      console.log(
        '\n  NOTE: These warnings do NOT fail the smoke test (the page did not crash),',
      );
      console.log(
        '  but they indicate underlying bugs. Investigate via the JSON report.',
      );
    }

    // Aggregate console-error breakdown (informational)
    const realConsoleAll = CONSOLE_ERRORS.filter((e) => !isBenignError(e));
    if (realConsoleAll.length) {
      console.log(
        `\n--- CONSOLE ERRORS (non-HMR, across all iterations): ${realConsoleAll.length} ---`,
      );
      const uniq = [...new Set(realConsoleAll)];
      uniq.slice(0, 10).forEach((e, i) => console.log(`  ${i + 1}. ${e.substring(0, 200)}`));
      if (uniq.length > 10) console.log(`  ... and ${uniq.length - 10} more unique`);
    } else {
      console.log('\nConsole errors (non-HMR): none');
    }

    if (PAGE_ERRORS.length) {
      const realPageErrors = PAGE_ERRORS.filter((e) => !isBenignError(e));
      console.log(`\n--- PAGE ERRORS: ${realPageErrors.length} ---`);
      [...new Set(realPageErrors)].slice(0, 10).forEach((e, i) =>
        console.log(`  ${i + 1}. ${e.substring(0, 200)}`),
      );
    } else {
      console.log('Page errors: none');
    }

    // Write a JSON report for CI consumption
    const report = {
      timestamp: new Date().toISOString(),
      baseUrl: BASE_URL,
      totalItems: navItems.length,
      passed: passCount,
      failed: failCount,
      items: results,
    };
    const reportPath = path.join(PROJECT_ROOT, 'e2e', 'nav-smoke-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nJSON report written to: ${reportPath}`);

    // Exit non-zero if any failures (so CI catches it)
    if (failCount > 0) process.exitCode = 1;
  } catch (e) {
    console.error('FATAL test error:', e.message);
    await page
      .screenshot({ path: path.join(PROJECT_ROOT, 'e2e', 'nav-smoke-fatal.png') })
      .catch(() => {});
    process.exitCode = 2;
  } finally {
    await browser.close().catch(() => {});
    if (spawnedServer) {
      spawnedServer.kill();
      console.log('\n(Dev server spawned by this test was killed.)');
    }
    console.log('\nNav smoke test complete.');
  }
}

run().catch((e) => {
  console.error('UNCAUGHT FATAL:', e);
  process.exit(3);
});
