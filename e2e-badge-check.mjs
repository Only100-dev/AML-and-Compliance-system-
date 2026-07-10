import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';

function waitForServer(port, maxWait = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (Date.now() - start > maxWait) { reject(new Error('Timeout')); return; }
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => resolve(true));
      req.on('error', () => setTimeout(check, 1000));
    };
    check();
  });
}

async function runTest() {
  console.log('=== Starting Next.js dev server ===');
  const server = spawn('node', ['node_modules/.bin/next', 'dev', '-p', '3000', '-H', '0.0.0.0'], {
    cwd: '/home/z/my-project',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  try { await waitForServer(3000); console.log('  Server ready!\n'); } catch(e) { server.kill(); process.exit(1); }

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('webpack-hmr')) consoleErrors.push(msg.text().substring(0, 200)); });

  try {
    // Navigate
    await page.goto('http://127.0.0.1:3000/', { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: '/home/z/my-project/e2e-final-1-dashboard.png' });

    // Click FAB
    await page.evaluate(() => {
      const div = document.querySelector('div.fixed.bottom-6') || document.querySelector('div[class*="fixed"][class*="bottom"]');
      if (div) {
        const btn = div.querySelector('button.rounded-full');
        if (btn) btn.click();
      }
    });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/home/z/my-project/e2e-final-2-chat-open.png' });

    // Type query
    const chatInput = page.locator('div.fixed input[placeholder*="Ask"]').first();
    await chatInput.click();
    await chatInput.fill('How do I handle an early surrender?');

    // Click send
    const sendBtn = page.locator('div.fixed button:has(svg[class*="lucide-send"])').first();
    await sendBtn.click();

    // Wait for response
    console.log('Waiting for AI response...');
    await page.waitForTimeout(15000); // 15s should be enough
    await page.screenshot({ path: '/home/z/my-project/e2e-final-3-response.png' });

    // Detailed check of scenario badges area
    const badgeInfo = await page.evaluate(() => {
      // Check all Badge elements
      const allBadges = document.querySelectorAll('[class*="badge" i], [class*="Badge" i], [data-slot="badge"]');
      const badgeTexts = [];
      for (const b of allBadges) {
        badgeTexts.push({ text: b.textContent?.trim().substring(0, 50), class: b.className.substring(0, 80) });
      }
      
      // Also check the Referenced Scenarios section
      const refSection = document.body.innerText.includes('Referenced Scenarios');
      
      // Get the full HTML of the last assistant message area
      const assistantBubbles = document.querySelectorAll('[class*="bg-slate-800"][class*="rounded-2xl"]');
      let lastAssistantHTML = '';
      for (const bubble of assistantBubbles) {
        lastAssistantHTML = bubble.innerHTML.substring(0, 3000);
      }
      
      return { badgeTexts, refSection, lastAssistantHTML };
    });
    
    console.log('\n=== Badge Info ===');
    console.log('Badges found:', badgeInfo.badgeTexts.length);
    badgeInfo.badgeTexts.forEach(b => console.log('  Badge:', b.text, '| class:', b.class));
    console.log('Has "Referenced Scenarios" section:', badgeInfo.refSection);
    console.log('\nLast assistant HTML (first 1500 chars):');
    console.log(badgeInfo.lastAssistantHTML.substring(0, 1500));

    // Also check the API response directly via curl
    const apiResponse = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/chat/scenarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'How do I handle an early surrender?', userId: 'test', sessionId: 'test-e2e' })
        });
        const data = await res.json();
        return { success: data.success, scenarioCount: data.scenarios?.length, scenarios: data.scenarios?.map(s => ({ id: s.id, title: s.title, packNumber: s.packNumber, riskLevel: s.riskLevel })) };
      } catch(e) {
        return { error: e.message };
      }
    });
    console.log('\n=== Direct API Response ===');
    console.log(JSON.stringify(apiResponse, null, 2));

    // Full page screenshot for the report
    await page.screenshot({ path: '/home/z/my-project/e2e-final-4-full.png', fullPage: false });

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
    server.kill();
    console.log('\nConsole errors:', consoleErrors.length ? consoleErrors.join('; ') : 'None');
    console.log('Done.');
  }
}

runTest().catch(e => console.error('FATAL:', e));
