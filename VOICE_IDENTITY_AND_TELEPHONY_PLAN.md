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

1. ~~Identity Service (embeddings, enroll/verify API, threshold tuning,
   tests)~~ ✅ BUILT 2026-07-23 — `jarvis/identity` on port 3013
   (sherpa-onnx CAM++ VoxCeleb, dim 512, fully local); 23/23 tests incl.
   real-model discrimination proof; live HTTP enroll→verify verified.
   Note recorded honestly: auto-calibration alone is permissive for
   acoustically-close voices — final threshold review happens at desktop
   enrollment (deliverable 3) against the owner's real voice.
2. Core tee + `/ws/voice/verify` + transcript tagging
3. Desktop enrollment flow in Voice Settings + "who am I hearing" indicator
4. Dispatch gating + challenge phrase + audit trail
5. E2E proof: owner-voice dispatch works; recorded-voice replay of a
   dispatch phrase is refused at the challenge step

---

## Track E — Call Kiaros From Your Phone (Kiaros Pocket)

> **Revision 2026-07-23 (owner directive: "do this for free").** A real
> PSTN phone number with programmatic control **cannot be had for free** —
> recorded honestly: Twilio/Telnyx numbers cost ~$1–2/mo + per-minute;
> Twilio's trial credit is temporary and stamps a trial message on every
> call; Google Voice and consumer free-number apps expose no call API.
> The free design below delivers the same experience — pull out the phone,
> tap "Call Kiaros", talk, work gets done — over your own private network
> instead of the phone network. The original PSTN design is preserved in
> §E6 as the paid upgrade path, unlocked later by a single gateway service
> with zero rework of Tracks D or E.

### E1. Free architecture — a call over your own network

```
Owner's phone (any browser; "Add to Home Screen" → feels like an app)
  → Tailscale (free personal plan; phone and Mac on a private WireGuard net)
  → Kiaros Desktop mobile view (existing voice loop, mobile layout)
      ├── STT: browser Web Speech API (free, already the default engine)
      ├── Identity: Core tees audio → Identity Service :3013 (Track D, free)
      ├── Core conversation pipeline (same Approval Engine path)
      └── TTS: browser speechSynthesis (free, already the fallback engine)
```

Why this shape:

- **$0 forever.** No number rental, no per-minute charges, no cloud STT/TTS
  required — the two-engine abstraction from VOICE_ARCHITECTURE.md §2 was
  built for exactly this: browser engines are the free default, cloud
  engines remain an optional opt-in (Deepgram's one-time $200 signup credit
  and ElevenLabs' 10k-credit/mo free tier can be layered on later without
  touching the design).
- **Nothing public.** Tailscale means no open ports, no public hostname, no
  webhook surface — strictly safer than the PSTN design. `tailscale serve`
  provides the valid HTTPS certificate that mobile browsers require for
  microphone access (`getUserMedia`).
- **Reuses the existing loop.** The Desktop voice stack (push-to-talk,
  hands-free conversation mode, echo protection, barge-in) already works in
  a browser; the build here is a phone-sized surface plus network plumbing,
  not a new pipeline.
- **Wideband audio.** Phone-over-internet carries full-quality audio, so
  Track D's desktop voiceprint transfers as-is — no second narrowband
  enrollment needed (that requirement existed only for 8 kHz PSTN audio).

### E2. What "calling" looks like

Home-screen icon "Kiaros" → opens the mobile view → auto-connects →
"Kiaros here." From there it is the same owner-verified loop as the desk:
speak requests, hear replies, level-1 work dispatches to Mission Control,
challenge phrase guards anything higher.

### E3. Call security model (free edition)

1. **Network identity** — only devices on your Tailscale tailnet can reach
   Kiaros at all. This replaces (and beats) the caller-ID allowlist.
2. **Voiceprint** — Track D verification runs identically on the phone
   stream; dispatch still requires `speaker: owner`.
3. **Challenge phrase / PIN** — unchanged for dispatch-class requests.
4. **Audit** — same JSONL trail, sessions tagged `source: pocket`.

### E4. Capability tiers (OWNER DECISION #4 — RESOLVED 2026-07-23)

Owner directive: approvals from the phone are in scope, PIN-protected.

| Tier | Capability | Gate |
|---|---|---|
| E-1 | Conversation + status readouts (agents, tasks, approvals pending) | tailnet + voiceprint |
| E-2 | Dispatch level-1 (auto-approvable) tasks | tailnet + voiceprint |
| E-3 | **Approve/deny held level-2 items** | tailnet + voiceprint + **PIN** |

Level-3 (dangerous) stays desktop-only regardless — unchanged.

**PIN specification:**

- **Entered on the keypad, not spoken** (default). Kiaros says "Task 14 is
  waiting for approval — enter your PIN to approve"; a keypad sheet slides
  up in the Pocket view. A spoken PIN can be overheard once and is burned
  forever; a typed one leaks nothing to the room. (Spoken entry can be
  added later as an accessibility option, owner-opt-in.)
- **Stored as a salted scrypt hash** in `jarvis/.data/` — never plaintext,
  never in git, never in transcripts or audit logs (redacted at the
  pipeline edge before anything is persisted).
- **Set and rotated on the Desktop only** (Voice Settings), never over a
  Pocket session.
- **Lockout:** 5 wrong attempts → PIN entry disabled for 15 minutes and
  the failure is pushed to the Desktop approvals panel; the held task
  simply stays queued (fail-safe: a lockout can never approve anything).
- **Per-approval entry.** No PIN session tokens — each approve/deny of a
  level-2 item requires a fresh entry. Deny requires voiceprint only (
  declining work is always safe).

### E5. Deliverables & order

1. Tailscale on Mac + phone (owner installs; free personal plan);
   `tailscale serve` fronting Desktop + Core with HTTPS
2. Mobile-first Kiaros view: full-screen conversation surface, big
   push-to-talk, hands-free toggle, PWA manifest for the home-screen icon
3. Wire mobile stream into Track D verification (`source: pocket` tagging)
4. Tier E-2 dispatch + challenge phrase + audit
5. E2E proof: phone on cellular (Tailscale up) → "Call Kiaros" → status
   readout → level-1 task created in MC → confirmation spoken back

### E6. Paid upgrade path (deferred, unbuilt)

If a real dialable number is ever wanted (calling from someone else's
phone, no app/tailnet available): the original Twilio Media Streams design
— gateway on port 3011, TwiML `<Connect><Stream>`, μ-law 8 kHz natively
accepted by Deepgram and emitted by ElevenLabs, Cloudflare Tunnel ingress,
X-Twilio-Signature validation, narrowband second voiceprint. ~$1.15/mo +
usage. Slots in beside Kiaros Pocket without changing it.

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

1. ~~Unknown-voice policy~~ RESOLVED 2026-07-23 by owner directive:
   **guest mode** — unknown voices get polite conversation only; zero
   dispatch, no Knowledge Vault access, no MC data readouts
2. ~~Telephony provider~~ RESOLVED 2026-07-23 by the free mandate: no PSTN
   provider; Kiaros Pocket over Tailscale (§E1). Twilio preserved as the
   deferred paid path (§E6)
3. ~~Tunnel~~ RESOLVED 2026-07-23: Tailscale free personal plan (private
   tailnet; nothing public). Requires installing Tailscale on the Mac and
   phone — the one piece of owner-side setup
4. ~~Phone capability ceiling~~ RESOLVED 2026-07-23 by owner directive:
   E-3 included — level-2 approvals from the phone, gated by voiceprint +
   typed PIN (spec in §E4). Level-3 remains desktop-only
5. ~~Budget~~ RESOLVED 2026-07-23 by owner directive: **$0** — local
   speaker model, browser speech engines, Tailscale free tier. Optional
   later add-ons at no cost: Deepgram signup credit, ElevenLabs free tier
