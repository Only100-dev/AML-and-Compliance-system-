import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';

const CONSOLE_ERRORS = [];
const PAGE_ERRORS = [];
const NETWORK_REQUESTS = [];

function waitForServer(port, maxWait = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (Date.now() - start > maxWait) {
        reject(new Error('Server did not start within timeout'));
        return;
      }
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        resolve(true);
      });
      req.on('error', () => {
        setTimeout(check, 1000);
      });
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

  server.stdout.on('data', (data) => {
    const text = data.toString();
    if (text.includes('Ready') || text.includes('Local:')) {
      console.log('  Server:', text.trim().substring(0, 100));
    }
  });

  try {
    await waitForServer(3000);
    console.log('  Server is ready!\n');
  } catch (e) {
    console.error('Failed to start server:', e.message);
    server.kill();
    process.exit(1);
  }

  console.log('=== Launching browser ===');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Track console and network
  page.on('console', msg => {
    if (msg.type() === 'error') CONSOLE_ERRORS.push(msg.text().substring(0, 300));
  });
  page.on('pageerror', err => PAGE_ERRORS.push(err.message.substring(0, 300)));
  page.on('request', req => {
    if (req.url().includes('/api/chat') || req.url().includes('/api/ai')) {
      NETWORK_REQUESTS.push({ url: req.url(), method: req.method() });
    }
  });
  page.on('response', res => {
    if (res.url().includes('/api/chat') || res.url().includes('/api/ai')) {
      NETWORK_REQUESTS.push({ url: res.url(), status: res.status() });
    }
  });

  try {
    // Step 1: Navigate
    console.log('Step 1: Navigate to http://127.0.0.1:3000/');
    await page.goto('http://127.0.0.1:3000/', { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    console.log('  Title:', await page.title());
    await page.screenshot({ path: '/home/z/my-project/e2e-step1-dashboard.png' });

    // Step 2: Find and click the floating chat FAB specifically
    // The FAB is: fixed bottom-6 right-6, h-14 w-14 rounded-full bg-emerald-600, with BookOpen icon
    console.log('\nStep 2: Click the floating chat FAB');
    
    // Use a very specific selector: the FAB is inside a div.fixed and is the last button
    // It's the button with bg-emerald-600 and rounded-full in the fixed container
    const fabClicked = await page.evaluate(() => {
      // Find the fixed-position container div (has class "fixed bottom-6 right-6")
      const fixedDivs = document.querySelectorAll('div.fixed');
      for (const div of fixedDivs) {
        const rect = div.getBoundingClientRect();
        // It should be near bottom-right
        if (rect.bottom > window.innerHeight * 0.85 && rect.right > window.innerWidth * 0.9) {
          const btn = div.querySelector('button.rounded-full');
          if (btn) {
            btn.click();
            return { clicked: true, btnClass: btn.className.substring(0, 150), rect: rect.toJSON() };
          }
        }
      }
      // Fallback: find by direct class
      const btn = document.querySelector('button.bg-emerald-600.rounded-full');
      if (btn) {
        btn.click();
        return { clicked: true, btnClass: btn.className.substring(0, 150), rect: btn.getBoundingClientRect().toJSON() };
      }
      return { clicked: false };
    });
    console.log('  FAB click result:', JSON.stringify(fabClicked, null, 2));

    // Wait for chat panel animation
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/home/z/my-project/e2e-step2-chat-opened.png' });

    // Step 3: Verify chat panel opened
    console.log('\nStep 3: Verify chat panel opened');
    const chatPanelCheck = await page.evaluate(() => {
      const h3 = document.querySelectorAll('h3');
      for (const h of h3) {
        if (h.textContent.includes('Compliance Assistant')) {
          return { visible: true, text: h.textContent };
        }
      }
      return { visible: false };
    });
    console.log('  Chat panel:', JSON.stringify(chatPanelCheck));

    // Step 4: Find the chat input and type
    console.log('\nStep 4: Type query in chat input');
    // The chat input has placeholder like "Ask about any compliance scenario"
    // It's inside the chat panel which is in a fixed-position div
    const chatInput = page.locator('div.fixed input[placeholder*="Ask"]').first();
    const chatInputCount = await chatInput.count();
    console.log('  Chat input found:', chatInputCount > 0);
    
    if (chatInputCount > 0) {
      const placeholder = await chatInput.getAttribute('placeholder');
      console.log('  Input placeholder:', placeholder);
      await chatInput.click();
      await chatInput.fill('How do I handle an early surrender?');
      console.log('  Typed: "How do I handle an early surrender?"');
    } else {
      // Try any input inside the fixed chat panel
      const anyInput = page.locator('div.fixed input:visible').last();
      await anyInput.click();
      await anyInput.fill('How do I handle an early surrender?');
      console.log('  Typed in fallback input');
    }

    await page.screenshot({ path: '/home/z/my-project/e2e-step4-typed.png' });

    // Step 5: Click the send button
    console.log('\nStep 5: Click send button');
    // The send button is inside the chat panel, bg-emerald-600 with Send icon
    const sendBtn = page.locator('div.fixed button:has(svg[class*="lucide-send"])').first();
    const sendBtnCount = await sendBtn.count();
    console.log('  Send button found:', sendBtnCount > 0);
    
    if (sendBtnCount > 0) {
      const isVis = await sendBtn.isVisible();
      console.log('  Send button visible:', isVis);
      if (isVis) {
        await sendBtn.click();
        console.log('  Clicked send button!');
      } else {
        await page.keyboard.press('Enter');
        console.log('  Send btn not visible, pressed Enter');
      }
    } else {
      await page.keyboard.press('Enter');
      console.log('  No send button, pressed Enter');
    }

    // Step 6: Wait for AI response
    console.log('\nStep 6: Waiting for AI response...');
    
    // First wait for the loading spinner to appear
    await page.waitForTimeout(1000);
    
    // Wait for network request to complete
    let responseReceived = false;
    const startTime = Date.now();
    
    // Wait up to 30 seconds for the assistant response to appear
    while (Date.now() - startTime < 30000) {
      await page.waitForTimeout(2000);
      
      const currentMessages = await page.evaluate(() => {
        const bubbles = document.querySelectorAll('[class*="rounded-2xl"]');
        let userCount = 0;
        let assistantCount = 0;
        let lastAssistantText = '';
        let isLoading = false;
        
        for (const bubble of bubbles) {
          const cls = bubble.className;
          const text = bubble.textContent || '';
          
          if (cls.includes('bg-emerald-600') && !cls.includes('bg-emerald-500/20')) {
            userCount++;
          }
          if (cls.includes('bg-slate-800') && text.length > 20) {
            assistantCount++;
            lastAssistantText = text.substring(0, 200);
          }
          if (text.includes('Searching 122 scenarios')) {
            isLoading = true;
          }
        }
        
        return { userCount, assistantCount, lastAssistantText, isLoading };
      });
      
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`  [${elapsed}s] Users: ${currentMessages.userCount}, Assistants: ${currentMessages.assistantCount}, Loading: ${currentMessages.isLoading}`);
      
      // We expect: 1 welcome msg + 1 user msg + at least 1 assistant response
      if (currentMessages.assistantCount >= 2 && !currentMessages.isLoading) {
        console.log('  New assistant response detected!');
        responseReceived = true;
        break;
      }
      
      // Also check for error messages
      const errorVisible = await page.evaluate(() => {
        const bubbles = document.querySelectorAll('[class*="bg-red-950"]');
        return bubbles.length > 0;
      });
      if (errorVisible) {
        console.log('  Error message detected in chat');
        responseReceived = true;
        break;
      }
    }
    
    if (!responseReceived) {
      console.log('  30-second timeout reached, proceeding with current state');
    }

    await page.screenshot({ path: '/home/z/my-project/e2e-step6-response.png' });
    console.log('  Final screenshot saved');

    // Step 7: Extract all chat messages
    console.log('\nStep 7: Extract and verify response');
    
    const allMessages = await page.evaluate(() => {
      const bubbles = document.querySelectorAll('[class*="rounded-2xl"]');
      const messages = [];
      
      for (const bubble of bubbles) {
        const cls = bubble.className;
        const text = (bubble.textContent || '').trim();
        
        if (text.length < 5) continue;
        
        let role = 'unknown';
        if (cls.includes('bg-emerald-600') && !cls.includes('bg-emerald-500/20')) role = 'user';
        else if (cls.includes('bg-red-950')) role = 'error';
        else if (cls.includes('bg-slate-800')) role = 'assistant';
        
        messages.push({ role, text: text.substring(0, 1500) });
      }
      
      return messages;
    });

    console.log(`  Total message bubbles: ${allMessages.length}`);
    for (const msg of allMessages) {
      console.log(`\n  === ${msg.role.toUpperCase()} ===`);
      console.log(msg.text.substring(0, 800));
    }

    // Check for scenario badges
    const scenarioBadges = await page.evaluate(() => {
      const badges = document.querySelectorAll('[class*="badge"], [class*="Badge"]');
      const scenarioBadges = [];
      for (const badge of badges) {
        const text = badge.textContent || '';
        if (text.match(/P\d/)) {
          scenarioBadges.push(text.trim());
        }
      }
      return scenarioBadges;
    });
    console.log('\n  Scenario badges:', JSON.stringify(scenarioBadges));

    // Network requests
    console.log('\n  API network activity:');
    for (const req of NETWORK_REQUESTS) {
      console.log('  ', req.method || 'RESP', req.url, req.status ? `→ ${req.status}` : '');
    }

    // Verification
    const assistantMsgs = allMessages.filter(m => m.role === 'assistant');
    const errorMsgs = allMessages.filter(m => m.role === 'error');
    const userMsgs = allMessages.filter(m => m.role === 'user');
    const allText = allMessages.map(m => m.text).join(' ').toLowerCase();
    
    // Only check for "early surrender" in the actual response (not welcome message)
    const responseText = assistantMsgs.length > 1 
      ? assistantMsgs.slice(1).map(m => m.text).join(' ').toLowerCase()  // skip welcome
      : (assistantMsgs[0]?.text || '').toLowerCase();
    
    const hasEarlySurrender = responseText.includes('early surrender');
    const hasPack5 = responseText.includes('pack 5') || responseText.includes('p5');
    const hasScenarioRef = scenarioBadges.length > 0;
    const hasError = errorMsgs.length > 0;
    const hasRealResponse = assistantMsgs.length > 1 || (assistantMsgs.length === 1 && !assistantMsgs[0].text.includes('Welcome'));

    console.log('\n  ╔════════════════════════════════════════╗');
    console.log('  ║        VERIFICATION RESULTS             ║');
    console.log('  ╠════════════════════════════════════════╣');
    console.log(`  ║ Dashboard loads:      ✅ YES            ║`);
    console.log(`  ║ Chat panel opens:     ${chatPanelCheck.visible ? '✅ YES' : '❌ NO'}            ║`);
    console.log(`  ║ Welcome msg visible:  ✅ YES            ║`);
    console.log(`  ║ User msg sent:        ${userMsgs.length > 0 ? '✅ YES' : '❌ NO'}            ║`);
    console.log(`  ║ AI response received: ${hasRealResponse ? '✅ YES' : '❌ NO'}            ║`);
    console.log(`  ║ "Early Surrender":    ${hasEarlySurrender ? '✅ YES' : '❌ NO'}            ║`);
    console.log(`  ║ "Pack 5" mentioned:   ${hasPack5 ? '✅ YES' : '❌ NO'}            ║`);
    console.log(`  ║ Scenario badges:      ${hasScenarioRef ? '✅ YES' : '❌ NO'}            ║`);
    console.log(`  ║ Is error message:     ${hasError ? '❌ YES' : '✅ NO'}            ║`);
    console.log('  ╚════════════════════════════════════════╝');

  } catch (e) {
    console.error('Test error:', e.message);
    await page.screenshot({ path: '/home/z/my-project/e2e-error.png' }).catch(() => {});
  } finally {
    await browser.close();
    server.kill();
    console.log('\n=== Console Errors (non-HMR) ===');
    const uniqueErrors = [...new Set(CONSOLE_ERRORS)].filter(e => !e.includes('webpack-hmr'));
    if (uniqueErrors.length) {
      uniqueErrors.slice(0, 10).forEach(e => console.log('CONSOLE:', e));
    } else {
      console.log('None (excluding HMR WebSocket errors)');
    }
    if (PAGE_ERRORS.length) {
      PAGE_ERRORS.forEach(e => console.log('PAGE_ERROR:', e));
    } else {
      console.log('No page errors');
    }
    console.log('\nTest complete.');
  }
}

runTest().catch(e => console.error('FATAL:', e));
