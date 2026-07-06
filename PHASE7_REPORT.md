# Phase 7 Report — Conversational Loop Core

**Era:** Governance
**Phase:** 7 (first phase of the Kiaros Completion Roadmap)
**Date:** 2026-07-06
**Status:** ✅ COMPLETE
**Authority:** Owner directive 2026-07-06 ("Complete Kiaros") + KIAROS_COMPLETION_ROADMAP.md
**Change class:** C1 (Kiaros-internal)

---

## 1. What Was Implemented

### The two headline gaps (found in the roadmap audit)
1. **Kiaros had never spoken.** No code called `speak()` on replies — the
   `autoSpeak` setting had no consumer. Now: `jarvisStore.sendMessage`
   returns the reply text; the loop orchestrator speaks it.
2. **Duplicate submissions.** `VoiceButton`'s transcript-watching React
   effect re-fired when its memoized callback identity changed after each
   reply, resubmitting the same transcript. The effect is gone; submission
   now happens exactly once inside the recognition callback, atomically
   guarded.

### The loop orchestrator (`voiceStore` rewritten)
Single owner of the lifecycle:
`ready → listening → thinking → speaking → ready | listening (conversation mode)`
- **Exactly-once submission** per final transcript AND **exactly-once
  conclusion** per listen cycle (Web Speech fires `onerror` *and* `onend`
  for the same cycle — double-armed relistens caused `InvalidStateError`;
  found by the automated loop proof, fixed with a conclude-once guard).
- **Conversation mode** (persisted setting, default on): auto-relisten
  after Kiaros finishes speaking; bounded silent re-listens (2) then ready
  — no infinite hot-mic.
- **Echo protection** (Kiaros never converses with itself): never listens
  while speaking + settle delay; transcripts contained in the last-spoken
  text (or ≥80% token overlap) are dropped; short transcripts exactly
  matching recent speech within a 7s window are dropped (found live: short
  replies like "Settled." slipped under the containment minimum).
- **Barge-in:** mic press while speaking stops TTS and listens immediately.
- Generation counter invalidates all stale async continuations on stop.

### Speech synthesis hardening (`SpeechSynthesisService` rewritten)
- Sentence chunking (Chrome kills ~15s+ utterances) + resume keepalive.
- Per-session callbacks with a session token — cancelling speech can no
  longer leak `interrupted` errors into the next session's handlers.
- `interrupted`/`canceled` treated as deliberate, not errors.
- Per-chunk watchdog guarantees `onDone` always fires — a stuck `speaking`
  state is impossible by construction.
- `voiceschanged` handling (voices list is empty until the event on Chrome).

### Honest degraded mode (placeholder behavior removed)
The template `ResponseGenerator` is **deleted**. When the LLM is
unconfigured or unreachable, Kiaros says so plainly ("I heard you: … My
language model isn't configured / I couldn't reach my language model") —
never mute, never pretending to understand. `responseSource` is now
`'llm' | 'degraded'`.

### Reliability details
- StrictMode-safe idempotent init (was leaking a second polling interval).
- `thinking` cannot stick: sendMessage resolves in `finally`; recognition
  error taxonomy all routes to ready.
- Deferred recognition start wrapped (benign `InvalidStateError` guard).

## 2. What Was Verified
Builds clean (core `tsc`, desktop `tsc && vite`); 40/40 approval suite
unaffected; standard 7/7 E2E; degraded-mode replies verified for both
failure shapes; and the full Phase 8 lifecycle proofs (see PHASE8_REPORT.md)
— which also *discovered* two of the bugs fixed above, exactly as a
verification phase should.
