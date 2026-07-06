# Voice Architecture

**Project:** Kiaros / Mission Control / OpenClaw
**Version:** 1.0
**Date:** 2026-07-04
**Status:** Reference + target definition
**Source:** Phase 1 Architecture Audit (2026-07-04)

---

## 1. The Goal

**The owner speaks to Kiaros naturally, and Kiaros speaks back.** Voice is the
primary intended interface, not an add-on. Everything in this document serves
that loop:

```
Owner speaks
  → microphone → speech recognition → text
    → Kiaros conversation engine → response text
      → speech synthesis → Kiaros speaks
```

## 2. Design Decision of Record

Voice is implemented **inside the Desktop browser app** using the Web Speech
API. The originally-planned standalone Voice Service on port 3013
(AI_SERVICE_PORT_REGISTRY.md) was **not built** and is superseded for now.
Port 3013 remains reserved in case a server-side voice engine (local STT/TTS
models, wake word, streaming) is approved in a future phase.

Consequences of this decision:
- **Privacy:** raw audio never leaves the browser; only recognized text is
  sent, and only to `localhost:3010`.
- **Constraint:** recognition quality, voice options, and continuous-listening
  behavior are limited to what the browser (effectively Chrome's
  `webkitSpeechRecognition`) provides.
- **Constraint:** no wake word, no barge-in, no server-side audio processing
  until a dedicated phase changes this decision.

## 3. Current Implementation (as of 2026-07-04)

All files under `jarvis/desktop/src/services/voice/` and
`jarvis/desktop/src/stores/voiceStore.ts`. Written 2026-07-02/03 in an
**undocumented build phase** (no PHASE12 report/audit exists — see
CURRENT_PHASE.md).

### Components

| Component | Responsibility |
|---|---|
| `VoiceManager` | Orchestrator; owns the voice state machine and callback wiring |
| `SpeechRecognitionService` | Web Speech recognition wrapper; interim results; max 3 auto-restart attempts; lazy init |
| `SpeechSynthesisService` | Web Speech TTS wrapper; rate/pitch/volume/voice selection |
| `VoiceSettingsManager` | Settings persistence (localStorage): enabled, muted, autoSpeak, rate, pitch, volume, voiceURI |
| `voiceStore` (Zustand) | UI-facing state: permission tracking (`navigator.permissions` + `getUserMedia` fallback), listening/speaking flags, transcript, error surface |
| `VoiceButton` / `VoiceStatusIndicator` / `VoiceSettingsPanel` | UI, **lazy-loaded with `.catch()` fallbacks** so voice failures can never break text chat |

### The conversational loop (Phases 7–8 — the completed architecture)

```
Mic press → voiceStore.toggleConversation()      [voiceStore = SINGLE owner]
  ready → listening → (final transcript, EXACTLY-ONCE submit)
    → thinking: jarvisStore.sendMessage()        ← SAME PATH AS TYPED CHAT
        → POST 3010 /api/v1/conversation/message → LLM reply
    → speaking: chunked TTS (watchdogged, keepalive, exactly-once done)
    → conversation mode ON:  settle 400ms → listening (hands-free multi-turn)
      conversation mode OFF: ready
  Bounded silence (2 quiet windows) → ready.  Every error path → ready.
  Barge-in: press while speaking = stop TTS + listen immediately.
```

Loop-integrity invariants (all automated in
`jarvis/scripts/verify-voice-loop-e2e.mjs`):
- Exactly one submission per final transcript; exactly one conclusion per
  listen cycle (Web Speech fires `onerror` AND `onend` — conclude-once).
- Exactly one spoken reply per request (per-session synthesis callbacks).
- Never listening while speaking; echo filter (containment, 80% token
  overlap, and a 7s exact-match window for short replies) — Kiaros cannot
  converse with itself.
- No stuck states: synthesis watchdog per chunk, `thinking` resolves in
  `finally`, generation counter invalidates stale continuations on stop.

**Architectural rules to preserve:** voice flows through the single
text-chat entry point (`jarvisStore.sendMessage`); the voiceStore is the
only owner of loop state (submission via React effects is FORBIDDEN — it
caused the historical duplicate-reply bug).

## 4. Defect History (all resolved)

Recorded in the Phase 1 audit, fixed under change control:

1. ~~Desktop build broken (stale `StatusBar` import in `App.tsx`)~~ — fixed
   Governance Phase 3.
2. ~~`voiceStore.processTranscript()` CommonJS `require()` in ESM bundle~~ —
   fixed Governance Phase 3 (static import; no circular dependency).
3. ~~`FEATURES.VOICE = false` stale flag~~ — fixed Governance Phase 3.
4. ~~B12 voice work unverified/mid-flight~~ — closed Governance Phase 4:
   full builds pass, browser E2E passes 7/7 (see PHASE4_REPORT.md), and
   conversation history now persists across Core restarts.
5. ~~ServicePanel fetched Mission Control and the OpenClaw Gateway directly
   from the browser~~ (boundary violation, MESSAGE_ROUTING.md §7; also
   caused permanent CORS console errors) — fixed Governance Phase 4: the
   Desktop reads ecosystem health from Kiaros Core's
   `GET /api/v1/status/services` only.

### Persistence (added Governance Phase 4)

Conversation history is persisted through the shared `MemoryService`
(`jarvis/core/memory/jarvis-memory.json`, key `conversation.history`,
capped at 100 entries, written after each exchange) and survives Core
restarts. See STATE_MANAGEMENT.md §2.

## 5. What Voice Must Never Do

- Send audio (or transcripts) to any non-localhost destination.
- Talk to Mission Control or the OpenClaw Gateway directly — voice is a
  Desktop input modality; everything routes through Kiaros Core.
- Trigger task execution while the Approval Engine is unimplemented
  (Constitution Art. V). A spoken "create a task" may only produce the same
  canned/conversational handling that typed text gets today.
- Bypass or duplicate the text-chat conversation path.
- Break text chat when voice fails — the lazy-load isolation pattern is a
  deliberate invariant, not an accident.

## 6. Roadmap to "Natural Conversation" (PLANNED — not scheduled)

Gap analysis between today and the Article-I goal, for future phase planning:

| Capability | Today | Needed for natural conversation |
|---|---|---|
| Speech → text | Push-to-talk, single utterance, browser STT | Continuous listening or wake word; better STT if browser quality insufficient |
| Understanding | ✅ LLM-backed since Phase 5 (model-agnostic provider; local Ollama today, Anthropic on key) | — |
| Memory | Conversation history persists via MemoryService (Phase 4); working context still resets | Context memory wired into the pipeline |
| Text → speech | Browser TTS, configurable voice | Possibly higher-quality local TTS (would justify building port-3013 service) |
| Acting on speech | Nothing reaches Mission Control | Core → MC task creation, gated by an implemented Approval Engine |

Ordering constraint from the Constitution: **LLM/conversation quality and
Approval Engine come before autonomous action**, regardless of how good the
voice loop gets.

---

## Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-04 | Initial version (Phase 2 deliverable) |
