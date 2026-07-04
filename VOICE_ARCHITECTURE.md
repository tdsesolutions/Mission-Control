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

### The loop as wired today

```
VoiceButton press
  → voiceStore.startListening()            (permission check/request first)
    → VoiceManager.startListening()
      → SpeechRecognitionService (interim + final transcripts)
        → final transcript
          → ConversationPanel.handleVoiceTranscript (memoized callback)
            → jarvisStore.sendMessage()     ← SAME PATH AS TYPED CHAT
              → POST 3010 /api/v1/conversation/message
                → ConversationManager (rule-based; see MESSAGE_ROUTING.md)
              ← response text
            → rendered in chat
          → if autoSpeak: VoiceManager.speak() → SpeechSynthesisService
```

**Architectural rule preserved here and to be kept:** voice input flows
through the existing text-chat path (`jarvisStore.sendMessage`). There is no
parallel voice-only pipeline into Core. Any future change must keep a single
conversation entry point.

### State machine (`VoiceManager`)

```
idle → listening → recognizing → thinking → (response) → speaking → idle
                              ↘ error (any stage)
```

Guards: `isStarting` flag prevents duplicate starts; `onEnd` only resets to
idle from listening/recognizing/thinking states.

## 4. Known Defects and Stale Flags (documented, NOT yet fixed)

Per the Phase 1 audit and the standing instruction, these are recorded but
must not be fixed outside an approved phase:

1. **Desktop build broken:** `App.tsx:9` imports `./components/StatusBar`,
   which no longer exists (replaced by `Header.tsx` on 2026-07-02). Blocks
   `tsc && vite build`; dev server behavior at the time of audit is what
   masked it.
2. **`voiceStore.processTranscript()`** uses CommonJS `require('./jarvisStore')`
   in an ESM/browser bundle. Currently dead code (the live path goes through
   `VoiceButton` → `ConversationPanel` callback), but it will throw if ever
   invoked.
3. **`FEATURES.VOICE = false`** in `jarvis/shared/constants/index.ts` — stale;
   voice is implemented. Phase 11 docs also still describe voice as
   "deferred".
4. `ConversationPanel.tsx` was modified the morning of 2026-07-04 — the voice
   phase is mid-flight; treat the working tree as unstable.

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
| Understanding | Regex intent scoring, canned responses, **no LLM** | LLM-backed conversation in Kiaros Core |
| Memory | In-memory (lost on restart); JSON MemoryService unused by routes | Persistent conversation + context memory wired into the pipeline |
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
