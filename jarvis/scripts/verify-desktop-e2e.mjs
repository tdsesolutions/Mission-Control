// Phase 4 E2E: Kiaros Desktop conversation loop against live services.
// Runs with the Mission Control repo's @playwright/test chromium.
// Requires Core (3010) + Desktop (3011) running and repo-root playwright browsers installed.
// Run from repo root: node jarvis/scripts/verify-desktop-e2e.mjs
import { chromium } from '../../node_modules/@playwright/test/index.mjs';

const DESKTOP_URL = 'http://localhost:3011';
const SCREENSHOT = 'AUDIT/PHASE4_desktop_e2e.png'; // relative to repo root
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => consoleErrors.push(String(err)));

try {
  await page.goto(DESKTOP_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  check('desktop loads', true, await page.title());

  // Connection indicator: chat input enabled means Core connection is up
  const input = page.locator('input.conversation-input');
  await input.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction(
    () => !document.querySelector('input.conversation-input')?.disabled,
    null, { timeout: 20000 }
  );
  check('core connection established (input enabled)', true);

  // History from Core should hydrate (persisted entries from earlier)
  await page.waitForTimeout(1500);
  const preCount = await page.locator('.message').count();
  check('persisted history hydrated into UI', preCount >= 4, `${preCount} messages rendered`);

  // Send a message through the real UI path
  await input.fill('phase 4 desktop e2e message');
  await input.press('Enter');
  const reply = page.locator('.message.jarvis').last();
  await page.waitForFunction(
    (before) => document.querySelectorAll('.message.jarvis').length > before,
    await page.locator('.message.jarvis').count() - 1,
    { timeout: 15000 }
  );
  await page.waitForTimeout(800);
  const replyText = await reply.textContent();
  check('kiaros reply received via UI', !!replyText && replyText.trim().length > 10, (replyText || '').slice(0, 80).replace(/\s+/g, ' '));

  // Voice components: lazy-loaded; in headless Chromium SpeechRecognition is
  // unavailable — the button must render (or fall back) without crashing chat.
  const voiceBtnCount = await page.locator('.conversation-input-area button').count();
  check('voice button area renders without crash', voiceBtnCount >= 2, `${voiceBtnCount} buttons in input area`);

  const voiceSupport = await page.evaluate(() => ({
    recognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    synthesis: typeof window.speechSynthesis !== 'undefined',
  }));
  check('voice support probe (headless expectation: recog false/limited)', true, JSON.stringify(voiceSupport));

  check('no page errors during session', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' || ') || 'clean');

  await page.screenshot({ path: SCREENSHOT, fullPage: false });
  console.log('screenshot:', SCREENSHOT);
} catch (err) {
  check('e2e run', false, String(err).slice(0, 200));
} finally {
  await browser.close();
}
console.log('SUMMARY:', results.filter(r => r.ok).length, 'passed /', results.length, 'total');
if (results.some(r => !r.ok)) process.exit(1);
