# Kiaros Completion Roadmap

**Date:** 2026-07-06
**Authority:** Owner directive 2026-07-06 — "Complete Kiaros." The product
objective governs phase order.
**Scope rule:** Kiaros itself only. Mission Control integration, OpenClaw
execution, Hermes, and ecosystem expansion are excluded — none are required
for the conversational lifecycle.

---

## 1. The Product Objective, Restated as a Testable Lifecycle

```
READY ──(mic press / conversation mode)──▶ LISTENING
  LISTENING ──(final transcript)──▶ THINKING (exactly one request)
  THINKING ──(reply)──▶ SPEAKING (exactly one spoken reply)
  SPEAKING ──(speech ends)──▶ READY (or auto-LISTENING in conversation mode)
Every error path from every state ──▶ READY. Always. No refresh.
```

Stability criteria: no loops (Kiaros never hears itself), no duplicate
responses, no stalled states, repeatable over many consecutive turns.

## 2. Gap Analysis (audited against the code, 2026-07-06)

| # | Objective criterion | Current state | Gap |
|---|---|---|---|
| 1 | Speak naturally | Push-to-talk, one utterance per mic press | **Conversation mode**: hands-free auto-relisten after Kiaros speaks, with bounded idle timeout |
| 2 | Listens reliably | Web Speech recognition works; single-shot; no-speech/aborted handled partially | Bounded auto-restart, all error paths → ready, echo protection |
| 3 | Understands natural language | ✅ LLM pipeline (Phase 5, model-agnostic) | — |
| 4 | Responds intelligently | ✅ LLM + context + approval awareness | — |
| 5 | **Speaks naturally** | **UNWIRED — no code ever calls speak(); Kiaros has never voiced a reply.** `autoSpeak` setting has no consumer | Wire reply → TTS; fix synthesis defects (below) |
| 6 | Returns to ready state | State machine exists but paths leak (stuck `speaking`, error dead-ends) | Watchdogs + exhaustive error→ready mapping |
| 7 | Stable, repeatable lifecycle | Orchestration scattered across VoiceButton effect / ConversationPanel callback / two stores | **Single loop orchestrator** in voiceStore |
| 8 | No loops | Mic could reopen during/after TTS → Kiaros hears itself | Never listen while speaking; self-echo transcript filter |
| 9 | **No duplicate responses** | **CONFIRMED BUG**: VoiceButton's transcript effect re-fires when the memoized callback identity changes after the reply (status flips) → same transcript resubmitted | Exactly-once submission: explicit completion callback, transcript cleared on consume; kill the effect-based path |
| 10 | No stalled states | `speaking` can stick (Chrome onend not guaranteed; >15s utterances die silently); spurious `interrupted` errors from shared synthesis callbacks | Sentence chunking + resume keepalive + per-utterance callbacks + watchdog timer |
| 11 | No manual refreshes | Desktop polls Core /health every 5s and reconnects | Verify recovery mid-conversation; ensure `thinking` never sticks on abort |
| 12 | No placeholder conversation behavior | Template ResponseGenerator still answers when the LLM fails — pretend-understanding canned replies | Replace with **honest degraded mode** ("my language model is unreachable") and retire the template generator from the conversation path |

Additional latent defects found in audit: `getVoices()` empty until
`voiceschanged` (default/selectable voices broken on first load);
React StrictMode double-mount effects; jarvisStore.sendMessage doesn't
return the reply (voice can't know what to speak).

## 3. Dependencies

**None new.** Everything needed exists: browser Web Speech API (recognition
requires a Chromium-family browser — a documented platform constraint), the
Phase 5 model-agnostic LLM layer (loop must remain functional in degraded
mode with no provider at all), Phase 4 persistence.

**Explicitly excluded as not required:** wake-word detection (needs a new
local wake-engine dependency — recorded as an owner-optional enhancement;
conversation mode delivers hands-free multi-turn after one press),
streaming LLM/TTS (latency optimization, not a stability requirement),
the reserved port-3013 Voice Service, and all ecosystem integration.

## 4. The Remaining Phases

### Phase 7 — Conversational Loop Core (implementation)
1. **Loop orchestrator** in voiceStore: `converse()` owns
   listen → transcribe → send → speak → ready/relisten. One owner of state.
2. Exactly-once submission (kills the duplicate bug); transcript consumed
   atomically; VoiceButton becomes presentational + press handling only.
3. **Wire speech output**: jarvisStore.sendMessage returns the reply; the
   orchestrator speaks it (respecting autoSpeak); barge-in — mic press
   while speaking stops TTS and starts listening.
4. Synthesis hardening: per-utterance callbacks (no stale-callback error
   leaks), `interrupted/canceled` treated as benign, sentence chunking with
   Chrome resume keepalive, `voiceschanged` voice loading, speak watchdog
   guaranteeing return to ready.
5. Recognition hardening: benign no-speech in conversation mode with
   bounded re-listen (then ready), all recognition errors → ready.
6. **Conversation mode** (persisted setting, default on): after Kiaros
   finishes speaking, auto-relisten with echo protection — never while
   speaking, short settle delay, self-echo transcript filter.
7. **Honest degraded mode**: LLM unreachable → truthful spoken/text status
   reply; template ResponseGenerator retired from the conversation path
   (placeholder behavior removed).
8. StrictMode-safe idempotent init; `thinking` state cannot stick on abort.

### Phase 8 — Lifecycle Stability Proof (verification)
1. **Automated multi-turn voice-loop E2E**: Playwright with an injected
   mock `SpeechRecognition` and a spied `speechSynthesis` — drive 5+
   consecutive spoken turns headlessly; assert exactly one request and one
   spoken reply per turn, state returns to ready/listening every turn,
   zero console errors, no resubmissions.
2. Resilience: Core restart mid-conversation (recovers, no refresh); LLM
   provider down (honest degraded reply; loop keeps cycling); long-reply
   chunked speech completes.
3. Soak run (10+ turns) for repeatability.
4. Owner acceptance script — the final mic-in-hand checklist (the only
   step automation cannot perform).

**Definition of done:** every §2 gap closed, Phase 8 automated proofs green,
docs/QA trail complete. Kiaros is then functionally complete as a
conversational assistant; everything beyond is ecosystem, not Kiaros.

## 5. Owner-Optional Items Recorded (not blocking completion)

- Wake word ("Hey Kiaros") — new dependency, owner decision.
- Higher-quality TTS/STT engines (local Whisper etc.) — port 3013 territory.
- Streaming replies for lower latency.
- Anthropic key for a stronger brain (loop is model-agnostic regardless).
