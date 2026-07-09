# Voice Architecture

**Project:** Kiaros / Mission Control / OpenClaw
**Version:** 2.0
**Date:** 2026-07-09
**Status:** Reference + target definition
**Source:** Phase 1 Architecture Audit (2026-07-04); v2.0 owner-directed
cloud-provider upgrade (2026-07-09)

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

## 2. Design Decision of Record (amended v2.0, owner-directed 2026-07-09)

Voice runs **inside the Desktop browser app** behind a two-engine
abstraction:

- **Browser engines (default, always present):** Web Speech API recognition
  + synthesis. Fully local; raw audio never leaves the browser.
- **Cloud engines (opt-in, owner-configured):** Deepgram STT and ElevenLabs
  TTS, reached **exclusively through Kiaros Core proxy endpoints** —
  `ws://localhost:3010/ws/voice/stt` (audio relay) and
  `POST http://localhost:3010/api/v1/voice/tts` (audio synthesis).
  `GET /api/v1/voice/config` reports capability booleans only. API keys
  live in `jarvis/.env` (`DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`,
  `ELEVENLABS_VOICE_ID` — default voice `bIHbv24MWmeRgasZH58o`) and never
  reach the browser.

**Privacy invariant (amended):** with no keys configured, behavior is
unchanged from v1.0 — audio never leaves the browser. Configuring a cloud
key is the owner's explicit opt-in for audio (STT) or reply text (TTS) to
reach that provider, via Core. The Desktop still never contacts any
non-localhost host itself.

**Fallback invariant (new):** any cloud engine failure degrades to the
browser engine — automatically, per pass, surfaced honestly in the UI
("fallback" tag; degraded for 60s before retry). Kiaros is never mute and
never fakes a provider.

The originally-planned standalone Voice Service on port 3013
(AI_SERVICE_PORT_REGISTRY.md) was **not built**; the Core proxy fills that
role inside port 3010. Port 3013 remains reserved for local STT/TTS models
or wake-word processing if approved later.

Remaining constraints:
- No wake word; push-to-talk + bounded hands-free conversation mode only.
- Recognition language is a setting (default `en-US`), applied to both
  engine families.

## 3. Current Implementation (as of 2026-07-04)

All files under `jarvis/desktop/src/services/voice/` and
`jarvis/desktop/src/stores/voiceStore.ts`. Written 2026-07-02/03 in an
**undocumented build phase** (no PHASE12 report/audit exists — see
CURRENT_PHASE.md).

### Components

| Component | Responsibility |
|---|---|
| `VoiceManager` | Engine selection facade (browser vs cloud, per owner preference + capability + degradation); settings-applied speech; NO loop state |
| `SpeechRecognitionService` | Web Speech recognition wrapper (browser STT engine); interim results; language-configurable; lazy init |
| `SpeechSynthesisService` | Web Speech TTS wrapper (browser TTS engine); rate/pitch/volume/voice selection |
| `DeepgramSttEngine` | Cloud STT engine: mic → MediaRecorder → Core `/ws/voice/stt` relay → Deepgram; same one-pass callback contract as the browser engine (v2.0) |
| `ElevenLabsTtsEngine` | Cloud TTS engine: text → Core `/api/v1/voice/tts` → ElevenLabs audio → `HTMLAudioElement`; exactly-once `onDone`, playback watchdog (v2.0) |
| `VoiceSettingsManager` | Settings persistence (localStorage): enabled, muted, autoSpeak, rate, pitch, volume, voiceURI, sttProvider, ttsProvider, language |
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

- Send audio (or transcripts) to any non-localhost destination **from the
  browser**. Cloud providers are reachable only through Kiaros Core's proxy,
  only when the owner has configured a key, and keys never reach the browser.
- Talk to Mission Control or the OpenClaw Gateway directly — voice is a
  Desktop input modality; everything routes through Kiaros Core.
- Trigger execution outside the sanctioned dispatch path. Since 2026-07-09
  a spoken action request gets exactly the same handling as typed text:
  ConversationManager → TaskDispatcher → Approval Engine decision →
  auto-dispatch (levels 0–1) / owner-approval queue (levels 2–3) /
  rejection. Voice has no separate execution powers and never bypasses
  the engine (Constitution v1.3 Art. V).
- Bypass or duplicate the text-chat conversation path.
- Break text chat when voice fails — the lazy-load isolation pattern is a
  deliberate invariant, not an accident.

## 6. Roadmap to "Natural Conversation" (PLANNED — not scheduled)

Gap analysis between today and the Article-I goal, for future phase planning:

| Capability | Today | Needed for natural conversation |
|---|---|---|
| Speech → text | Push-to-talk + bounded hands-free; browser STT default, **Deepgram on key (v2.0)** | Continuous listening or wake word |
| Understanding | ✅ LLM-backed since Phase 5 (model-agnostic provider; local Ollama today, Anthropic on key) | — |
| Memory | Conversation history persists via MemoryService (Phase 4); working context still resets | Context memory wired into the pipeline |
| Text → speech | Browser TTS default, **ElevenLabs on key (v2.0, voice `bIHbv24MWmeRgasZH58o`)** | Streaming TTS for lower latency |
| Acting on speech | ✅ IMPLEMENTED 2026-07-09: spoken action requests dispatch through TaskDispatcher → Approval Engine → real MC task (or owner-approval hold) | — |

The Constitution's ordering constraint (LLM quality and Approval Engine
before autonomous action) was satisfied: both preceded the 2026-07-09
dispatch wiring.

---

## Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-04 | Initial version (Phase 2 deliverable) |
| 2.0 | 2026-07-09 | Owner-directed cloud providers: Deepgram STT + ElevenLabs TTS via Core proxy (keys server-side only); privacy invariant amended to opt-in; fallback invariant added; language setting; provider selection UI |
| 2.1 | 2026-07-09 | PSE mission: §5/§6 updated — spoken action requests now dispatch through the TaskDispatcher/Approval Engine identically to typed text (no separate voice execution powers) |
