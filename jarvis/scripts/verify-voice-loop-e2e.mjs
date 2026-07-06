// Kiaros voice-loop E2E — Governance Phase 8 (completion proof).
//
// Drives the FULL conversational lifecycle headlessly by injecting a mock
// SpeechRecognition and a spied speechSynthesis before the app loads:
//   ready → listening → (scripted utterance) → thinking → speaking → listening
// across multiple consecutive turns, asserting the owner's completion
// criteria: exactly one request per utterance, exactly one spoken reply per
// request, echo transcripts filtered, bounded silence handling, return to
// ready, zero console errors.
//
// Requires Core (3010) + Desktop (3011) running. Run from repo root:
//   node jarvis/scripts/verify-voice-loop-e2e.mjs
import { chromium } from '../../node_modules/@playwright/test/index.mjs';

const DESKTOP_URL = 'http://localhost:3011';
const SCREENSHOT = process.env.E2E_SCREENSHOT || 'AUDIT/voice_loop_e2e_latest.png';
const TURNS = parseInt(process.env.E2E_TURNS || '5', 10);
const TURN_TIMEOUT_MS = 90000;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ permissions: ['microphone'] });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => consoleErrors.push(String(err)));

// ---- Inject mocks before any app code runs ----
await page.addInitScript(() => {
  // Spy + fake for speech synthesis: records every utterance, "speaks"
  // instantly, fires onstart/onend like the real thing.
  const speechLog = [];
  window.__speechLog = speechLog;
  let speakingCount = 0;
  // window.speechSynthesis is a getter-only accessor — plain assignment
  // silently no-ops. defineProperty is required to install the spy.
  const speechSynthesisMock = {
    get speaking() { return speakingCount > 0; },
    paused: false,
    pending: false,
    speak(utt) {
      speechLog.push(utt.text);
      speakingCount++;
      setTimeout(() => utt.onstart && utt.onstart(), 5);
      setTimeout(() => {
        speakingCount = Math.max(0, speakingCount - 1);
        utt.onend && utt.onend();
      }, 40);
    },
    cancel() { speakingCount = 0; },
    pause() {}, resume() {},
    getVoices() { return []; },
    addEventListener() {}, removeEventListener() {},
  };
  Object.defineProperty(window, 'speechSynthesis', {
    value: speechSynthesisMock,
    configurable: true,
    writable: true,
  });

  // Mock SpeechRecognition with a scripting hook (window.__mockSpeech).
  class MockSpeechRecognition {
    constructor() {
      this.continuous = false;
      this.interimResults = true;
      this.lang = 'en-US';
      this.onstart = null; this.onresult = null; this.onend = null; this.onerror = null;
      this._listening = false;
    }
    start() {
      if (this._listening) throw new DOMException('already started', 'InvalidStateError');
      this._listening = true;
      window.__mockSpeech.active = this;
      window.__mockSpeech.startCount++;
      setTimeout(() => this.onstart && this.onstart(), 5);
    }
    stop() {
      if (!this._listening) return;
      this._listening = false;
      const self = this;
      setTimeout(() => self.onend && self.onend(), 5);
    }
    abort() { this.stop(); }
  }
  window.__mockSpeech = {
    active: null,
    startCount: 0,
    // Deliver a final transcript to the listening recognizer.
    emit(text) {
      const rec = window.__mockSpeech.active;
      if (!rec || !rec._listening) return false;
      const result = [{ transcript: text, confidence: 0.95 }];
      result.isFinal = true;
      const event = { results: [result], resultIndex: 0 };
      rec.onresult && rec.onresult(event);
      rec._listening = false;
      setTimeout(() => rec.onend && rec.onend(), 5);
      return true;
    },
    // Simulate a silent listen window (no-speech).
    silence() {
      const rec = window.__mockSpeech.active;
      if (!rec || !rec._listening) return false;
      rec._listening = false;
      rec.onerror && rec.onerror({ error: 'no-speech' });
      setTimeout(() => rec.onend && rec.onend(), 5);
      return true;
    },
  };
  window.SpeechRecognition = MockSpeechRecognition;
  window.webkitSpeechRecognition = MockSpeechRecognition;

  // Fake mic permission plumbing.
  if (navigator.permissions) {
    const origQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (d) =>
      d && d.name === 'microphone'
        ? Promise.resolve({ state: 'granted' })
        : origQuery(d);
  }
  if (navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.resolve({ getTracks: () => [{ stop() {} }] });
  }
});

const micButton = () => page.locator('.conversation-input-area button').first();
const buttonTitle = async () => (await micButton().getAttribute('title')) || '';
const userMsgCount = () => page.locator('.message.user').count();
const jarvisMsgCount = () =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('.message.jarvis'))
      .filter((el) => !(el.textContent || '').includes('Processing')).length,
  );
const spokenCount = () => page.evaluate(() => window.__speechLog.length);

async function waitForListening(timeout = 20000) {
  // The UI flips to "Listening" ~450ms before the recognition engine truly
  // starts (settle delay + engine start deferral) — sync with the MOCK's
  // actual listening flag so emits can never land in the gap.
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('.conversation-input-area button');
      const uiListening = btn && (btn.getAttribute('title') || '').startsWith('Listening');
      return uiListening && window.__mockSpeech.active && window.__mockSpeech.active._listening === true;
    },
    null, { timeout },
  );
}

try {
  await page.goto(DESKTOP_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(
    () => !document.querySelector('input.conversation-input')?.disabled,
    null, { timeout: 20000 },
  );
  check('desktop loads, core connected', true);

  // ---- Start the conversation loop ----
  await micButton().click();
  await waitForListening();
  check('mic press → listening', true);

  // ---- N consecutive spoken turns ----
  let allTurnsClean = true;
  const turnDetails = [];
  for (let turn = 1; turn <= TURNS; turn++) {
    const usersBefore = await userMsgCount();
    const jarvisBefore = await jarvisMsgCount();
    const spokenBefore = await spokenCount();

    const delivered = await page.evaluate(
      (t) => window.__mockSpeech.emit(`voice loop turn ${t}, please answer in one short sentence`),
      turn,
    );
    if (!delivered) { allTurnsClean = false; turnDetails.push(`turn ${turn}: emit failed`); break; }

    // Wait for: reply spoken AND loop back to listening (conversation mode).
    await page.waitForFunction(
      (before) => window.__speechLog.length > before,
      spokenBefore, { timeout: TURN_TIMEOUT_MS },
    );
    await waitForListening(TURN_TIMEOUT_MS);

    // Settle, then audit the turn.
    await page.waitForTimeout(300);
    const usersAfter = await userMsgCount();
    const jarvisAfter = await jarvisMsgCount();

    const oneRequest = usersAfter - usersBefore === 1;
    const oneReply = jarvisAfter - jarvisBefore === 1;
    if (!oneRequest || !oneReply) {
      allTurnsClean = false;
      turnDetails.push(`turn ${turn}: requests+${usersAfter - usersBefore}, replies+${jarvisAfter - jarvisBefore}`);
    } else {
      turnDetails.push(`turn ${turn}: 1 request, 1 reply, spoken, relistened`);
    }
  }
  check(`${TURNS} consecutive turns: exactly one request + one spoken reply each, auto-relisten`,
    allTurnsClean, turnDetails[turnDetails.length - 1]);

  // ---- Echo protection: Kiaros must ignore its own voice ----
  const lastSpoken = await page.evaluate(() => window.__speechLog[window.__speechLog.length - 1]);
  const usersBeforeEcho = await userMsgCount();
  await waitForListening();
  const echoDelivered = await page.evaluate((t) => window.__mockSpeech.emit(t), lastSpoken);
  await waitForListening(20000); // echo → filtered → relisten
  await page.waitForTimeout(400);
  const usersAfterEcho = await userMsgCount();
  check('echo transcript filtered (no self-conversation loop)',
    echoDelivered && usersAfterEcho === usersBeforeEcho,
    `delivered=${echoDelivered}, user messages ${usersBeforeEcho}→${usersAfterEcho}`);

  // ---- Bounded silence: loop must end at ready, not spin ----
  let silences = 0;
  for (let i = 0; i < 4; i++) {
    try {
      await waitForListening(5000);
    } catch {
      break; // loop already returned to ready
    }
    const ok = await page.evaluate(() => window.__mockSpeech.silence());
    if (!ok) break;
    silences++;
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(800);
  const titleAfterSilence = await buttonTitle();
  check('bounded silence → returns to ready (no infinite hot-mic)',
    titleAfterSilence.startsWith('Press to talk') || titleAfterSilence.startsWith('Press to enable'),
    `after ${silences} silent windows: "${titleAfterSilence}"`);

  // ---- Restart the loop once more to prove repeatability ----
  await micButton().click();
  await waitForListening();
  const spokenBeforeFinal = await spokenCount();
  const restartDelivered = await page.evaluate(() => window.__mockSpeech.emit('one more turn to prove repeatability'));
  if (!restartDelivered) throw new Error('restart emit not delivered');
  await page.waitForFunction((b) => window.__speechLog.length > b, spokenBeforeFinal, { timeout: TURN_TIMEOUT_MS });
  check('loop restarts cleanly after ready', true);

  // ---- Manual stop → ready ----
  await micButton().click();
  await page.waitForTimeout(400);
  const titleAfterStop = await buttonTitle();
  check('manual stop → ready', titleAfterStop.startsWith('Press to talk'), `"${titleAfterStop}"`);

  check('zero console/page errors across the whole session',
    consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' || ') || 'clean');

  await page.screenshot({ path: SCREENSHOT });
  console.log('screenshot:', SCREENSHOT);
} catch (err) {
  check('voice-loop e2e run', false, String(err).slice(0, 250));
} finally {
  await browser.close();
}
console.log('SUMMARY:', results.filter((r) => r.ok).length, 'passed /', results.length, 'total');
if (results.some((r) => !r.ok)) process.exit(1);
