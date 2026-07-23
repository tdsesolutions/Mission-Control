# Voice Identity & Telephony Plan

**Project:** Kiaros / Mission Control / OpenClaw
**Status:** PROPOSAL — awaiting owner approval (Constitution: no build without it)
**Date:** 2026-07-23
**Owner directive:** "Kiaros only answers to my voice" + "call Kiaros from my
phone to communicate and perform tasks"

---

## 0. Honest Framing (read first)

Voice biometrics are **identification, not strong authentication**. A good
speaker-verification model reliably tells Teddie from other people in the
room; it can be defeated by a high-quality recording or a cloned voice. This
plan therefore **layers** defenses and keeps the Approval Engine as the final
authority it already is:

| Layer | Defeats | Doesn't defeat |
|---|---|---|
| Speaker verification (voiceprint) | Other people talking near the mic, guests, TV audio | Replay of a recording, voice cloning |
| Caller-ID allowlist (phone) | Random callers | Caller-ID spoofing |
| Spoken challenge phrase (random, per-session) | Replay attacks | A live cloned voice |
| Approval Engine + owner-approval queue (already built) | Dangerous requests from ANY source | — (this is the backstop) |

Nothing in this plan weakens the existing rule: every dispatch goes through
the Approval Engine, and level 2–3 requests wait in the owner-approval queue.

---

## Track D — Owner-Only Voice (Speaker Identity Service)

### D1. Architecture

New **Speaker Identity Service** on **port 3013** — the port explicitly
reserved by AI_SERVICE_PORT_REGISTRY.md for local voice processing, and
VOICE_ARCHITECTURE.md §2 already names "local STT/TTS models or wake-word
processing" as its approved future use.

- **Fully local.** Speaker embeddings are computed on this Mac
  (`sherpa-onnx` node bindings with an ECAPA-TDNN/CAM++ speaker-embedding
  model, or `onnxruntime-node` directly). Raw audio for *identity* never
  leaves the machine — this extends, not amends, the privacy invariant.
- **Enrollment:** owner records ~5 utterances (guided flow in Desktop
  Voice Settings). Embeddings are averaged into a voiceprint centroid stored
  in `jarvis/.data/voiceprints/` (gitignored, never synced).
- **Verification:** each utterance's embedding is cosine-compared to the
  centroid. Score ≥ threshold → `owner`; below → `unknown`. Threshold tuned
  during enrollment against impostor samples; every decision (score, outcome)
  goes to a JSONL audit trail like the Approval Engine's.

### D2. Pipeline integration

Both mic paths flow through verification **in Core**, which already sees or
can see the audio:

- **Cloud STT path (Deepgram):** Core's DeepgramRelay already receives the
  audio stream — it tees a copy to the Identity Service. Zero Desktop changes.
- **Browser STT path (Web Speech):** the Web Speech API never exposes raw
  audio, so Desktop opens a parallel lightweight `getUserMedia` stream to a
  new Core endpoint (`/ws/voice/verify`) while listening. Local-only traffic.

Transcripts are tagged `speaker: owner | unknown` before they reach the
conversation pipeline.

### D3. Policy matrix (OWNER DECISION #1)

What does Kiaros do when the voice is not yours?

| Mode | Unknown voice gets | Recommended for |
|---|---|---|
| **(a) Strict** | Silence. Kiaros ignores the utterance entirely | Max privacy |
| **(b) Guest** ← recommended | Conversation only — polite answers, **zero dispatch**, no Knowledge Vault access, no MC data | Household ergonomics |
| **(c) Challenge** | Asked to have the owner speak, or for the passphrase | Middle ground |

In every mode, `isActionRequest` dispatch requires `speaker: owner`. For
level-2 approvals spoken aloud, Kiaros additionally issues a **random
challenge phrase** ("repeat: amber falcon nine") — cheap liveness check that
defeats replay.

### D4. Deliverables & order

1. Identity Service (embeddings, enroll/verify API, threshold tuning, tests)
2. Core tee + `/ws/voice/verify` + transcript tagging
3. Desktop enrollment flow in Voice Settings + "who am I hearing" indicator
4. Dispatch gating + challenge phrase + audit trail
5. E2E proof: owner-voice dispatch works; recorded-voice replay of a
   dispatch phrase is refused at the challenge step

---

## Track E — Kiaros on a Phone Number (Telephony Gateway)

### E1. Provider recommendation (OWNER DECISION #2)

**Twilio Programmable Voice + Media Streams** (bidirectional WebSocket
audio). Reasons: mature, cheap to start, and — decisive — its 8 kHz μ-law
stream format is **natively supported on both ends of our existing stack**
(Deepgram accepts `mulaw/8000` streaming input; ElevenLabs emits
`ulaw_8000` directly). No transcoding layer, and Kiaros Core keeps owning
the whole pipeline, per the model-agnostic mandate.

Alternatives, recorded: Twilio ConversationRelay (Twilio does STT/TTS —
simpler but surrenders pipeline control), Telnyx (cheaper minutes, smaller
ecosystem), raw SIP (max control, max pain). Rough cost at expected usage:
~$1.15/mo for the number + ~$0.0085/min Twilio + existing
Deepgram/ElevenLabs streaming rates.

### E2. Architecture

```
Owner's phone → Twilio number
  → webhook (TwiML: <Connect><Stream>)         [signature-validated]
  → Telephony Gateway (new, port 3011)
      ├── Twilio Media Streams WS (μ-law 8k, both directions)
      ├── → Core /ws/voice/stt (Deepgram, mulaw/8000)
      ├── → Identity Service :3013 (phone-specific voiceprint — see E3)
      ├── → Core conversation pipeline (same Approval Engine path)
      └── ← ElevenLabs TTS (ulaw_8000) → caller hears Kiaros
```

Public reachability (the Mac is behind NAT): **Cloudflare Tunnel**
(recommended — free, stable hostname, no open ports) exposing ONLY the
Twilio webhook + media-stream endpoints. ngrok acceptable for the spike;
not for standing service. (OWNER DECISION #3)

### E3. Call security model

1. **Caller-ID allowlist** — only the owner's number(s) get past TwiML;
   everyone else hears a decline message. Necessary, not sufficient
   (spoofable).
2. **Phone voiceprint** — narrowband 8 kHz audio degrades embeddings, so
   Track D's desktop voiceprint won't transfer cleanly; enrollment happens
   once **on a call** ("call Kiaros, read 5 phrases"). Same Identity
   Service, second centroid.
3. **Spoken PIN or challenge phrase** required before any dispatch-class
   request on a call.
4. **Webhook hardening** — X-Twilio-Signature validation on every request,
   rate limiting, full call audit (caller, duration, transcript, decisions)
   in JSONL.

### E4. Capability tiers on a call (OWNER DECISION #4)

| Tier | Capability | Recommendation |
|---|---|---|
| E-1 | Conversation + status readouts (agents, tasks, approvals pending) | Ship first |
| E-2 | Dispatch level-1 (auto-approvable) tasks after voice + PIN | Second |
| E-3 | Approve/deny held level-2 items by voice | Owner's call — recommend **desktop-only** initially |

Level-3 (dangerous) stays desktop-only regardless.

### E5. Deliverables & order

1. Twilio account + number + Cloudflare Tunnel (owner provisions; keys to
   `jarvis/.env` only)
2. Telephony Gateway service: answer call, stream loop, "Kiaros here —
   hello Teddie" round trip (E-1 conversational tier)
3. Phone voiceprint enrollment call flow
4. Dispatch tier E-2 with PIN + challenge; audit trail
5. E2E proof: real phone call → status readout → level-1 task created in MC
   → confirmation spoken back

---

## Sequencing & gates

```
Phase D (owner-only voice)  — desktop first: it hardens the existing surface
Phase E (telephony)         — builds on D's Identity Service
```

Each phase lands behind its own owner approval per CHANGE_CONTROL.md.
Recommended order: **D1–D4 → E1–E2 → (evaluate) → E3+**. D is a
precondition for E's security model, so it goes first even though E is the
flashier feature.

## Owner decisions needed before build starts

1. Unknown-voice policy: strict / **guest (recommended)** / challenge
2. Telephony provider: **Twilio (recommended)** / Telnyx / ConversationRelay
3. Tunnel: **Cloudflare Tunnel (recommended)** / ngrok / VPS relay
4. Phone capability ceiling at launch: **E-1→E-2 (recommended)**, E-3 later
5. Budget sign-off: ~$2/mo fixed + per-minute usage
