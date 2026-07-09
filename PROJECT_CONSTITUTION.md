# Project Constitution

**Project:** Kiaros / Mission Control / OpenClaw
**Version:** 1.3
**Date:** 2026-07-09
**Status:** BINDING — supersedes memory, chat history, and assumptions
**Source:** Phase 1 Architecture Audit (2026-07-04)

This document is the supreme governing document for the project. If any other
document, conversation, or piece of code conflicts with this Constitution, the
Constitution wins until it is formally amended (see CHANGE_CONTROL.md).

---

## Article I — Identity

1. **Kiaros is the local Jarvis.** "Jarvis" (in code, types, constants, docs)
   and "Kiaros" (in UI copy and the OpenClaw main-agent persona) refer to the
   same system. The official product name is **Kiaros**. The code-level naming
   drift is a known, documented condition (see COMPONENT_OWNERSHIP.md §Naming)
   and may only be reconciled in a dedicated, approved phase.
2. Kiaros is a **premium local AI executive**: an ambient, voice-capable
   interface that the owner speaks to naturally and that speaks back.
3. Kiaros is **not** a chat clone, **not** a replacement for Mission Control,
   and **not** an execution engine.

## Article II — The Delegation Chain (Inviolable)

All intent flows through exactly one chain:

```
Owner (voice or text)
  → Kiaros Desktop (port 3011)
    → Kiaros Core (port 3010)
      → Approval Engine          [IMPLEMENTED — every dispatch decided here]
        → Mission Control (port 3002)   [task creation IMPLEMENTED 2026-07-09]
          → OpenClaw Gateway (port 18789, loopback only)
            → OpenClaw Main agent ("main", persona Kiaros)
              → Department agents / skills / tools
```

(The Approval Engine was originally specified inside Mission Control; the
owner-approved implementation places it in Kiaros Core, ahead of the MC
hop, so the decision happens before anything leaves Kiaros.)

Hard rules:

1. Kiaros never calls the OpenClaw Gateway directly. All execution goes
   through Mission Control.
2. Mission Control submits work **only to the OpenClaw `main` agent**.
   Specialist routing is OpenClaw's job, never ours.
3. No layer may be skipped, even "temporarily", even for testing.
4. **Telegram is a backup communication path to Claw (OpenClaw) only.**
   Telegram is NOT a Kiaros control path, NOT a Kiaros interface, and must
   never be wired into the Kiaros → Mission Control chain.

## Article III — Untouchable Systems

1. **OpenClaw is never modified.** Not its config (`~/.openclaw`), not its
   agents, not its routing, not its gateway. We are a consumer.
2. **Mission Control upstream source is never modified.** Local behavior is
   configured exclusively through `.env` and its own settings UI/DB. (Verified
   unmodified in every phase audit to date.)
3. Protected dev ports (3000, 3001, 5173, 8000, 8080) are never used by AI
   services and never killed by AI tooling (LOCALHOST_CONFLICT_POLICY.md).

## Article IV — Specified vs Implemented (Honesty Doctrine)

The project's history shows documentation drifting ahead of code (Phase 11
report claimed Mission Control task integration that was never wired). To
prevent this permanently:

1. Every feature claim in project documentation MUST carry one of these
   statuses: **IMPLEMENTED** (code exists and was verified running),
   **PARTIAL** (code exists, incomplete or unverified), **SPECIFIED** (design
   docs only, zero code), **PLANNED** (roadmap only).
2. Status register (updated 2026-07-09):
   - Kiaros Core → Mission Control task **creation** is **IMPLEMENTED**
     (owner directive 2026-07-09): the TaskDispatcher
     (`jarvis/core/src/services/dispatch/`) obtains an Approval Engine
     decision for EVERY request, auto-creates MC tasks only for `approved`
     (levels 0–1), holds `requires_owner_approval` (levels 2–3) in a
     persisted queue until the owner resolves it, and never dispatches
     rejected/unclear requests. Task **update/delete** from Kiaros remains
     out of scope by design (MC's own UI owns task lifecycle edits); those
     endpoints answer 501 honestly. Reads remain read-through proxies with
     MC as the sole system of record.
   - Memory Service (3012), Voice Service (3013), Computer Control (3014),
     Service Monitor (3015), Notification Service (3016) — **SPECIFIED
     only**: reserved ports, not requirements.

   The launcher scripts (`launch-ai-services.sh` / `stop-ai-services.sh` /
   `check-ai-services.sh`) are **IMPLEMENTED** (2026-07-07) at
   `jarvis/scripts/`, constrained by this Constitution: they manage only
   Kiaros ports and never start, stop, or touch the OpenClaw Gateway or
   Mission Control.

   The **Approval Engine is IMPLEMENTED** (Governance Phase 6, 2026-07-05)
   as a deterministic decision authority in Kiaros Core
   (`jarvis/core/src/services/approval/`), classifying requests as
   approved / rejected / requires_clarification / requires_owner_approval.
   It never executes work itself. **As of 2026-07-09 it is WIRED:** the
   TaskDispatcher and the conversation pipeline consult it on every
   action-class request, and its decision is the sole authority over
   whether a Mission Control task is created.
3. A phase may only be declared COMPLETE when its validation report shows the
   deliverable actually running (build passing, endpoint responding), not
   merely files existing.

## Article V — Safety Posture

1. The Approval Engine is the safety gate, and as of 2026-07-09 the
   owner-approved execution path exists: **Kiaros may create Mission
   Control tasks solely through the TaskDispatcher, which obtains an
   Approval Engine decision for every request.** Auto-dispatch applies only
   to `approved` decisions (levels 0–1); levels 2–3 require explicit owner
   approval (Desktop "Awaiting Your Approval" panel or
   `/api/v1/approval/pending` API); level 4 / dangerous requests are
   rejected outright. **Any execution path that bypasses the engine — any
   call to `MissionControlClient.createTask` from outside the
   TaskDispatcher — is FORBIDDEN** (CHANGE_CONTROL.md class). Kiaros never
   updates or deletes MC tasks, and never contacts the OpenClaw Gateway
   for execution (MC owns dispatch to the `main` agent).
2. Voice privacy follows VOICE_ARCHITECTURE.md v2.0 (owner-amended
   2026-07-09): the default voice pipeline is the browser Web Speech API
   (audio never leaves the machine). Cloud voice (Deepgram STT relay,
   ElevenLabs TTS proxy) is **owner-opt-in**: keys live in `jarvis/.env`
   only, audio/text is proxied through Kiaros Core, keys never reach the
   Desktop, and unset keys mean the cloud engines simply do not exist at
   runtime (automatic browser fallback).
3. Kiaros Core (3010) supports optional shared-secret authentication
   (`KIAROS_CORE_TOKEN`, implemented 2026-07-07) covering `/api/v1/*` and
   both WebSocket paths; unset (the default) means open on localhost only.
   The service must remain bound to localhost. If it is ever exposed
   beyond localhost, setting the token becomes MANDATORY because the API
   now carries write powers (task creation, owner approvals).

## Article VI — Documentation as Law

1. The governance documents created in Phase 2 (this Constitution plus
   SYSTEM_ARCHITECTURE, COMPONENT_OWNERSHIP, VOICE_ARCHITECTURE,
   MISSION_CONTROL_ARCHITECTURE, OPENCLAW_INTEGRATION, STATE_MANAGEMENT,
   MESSAGE_ROUTING, CHANGE_CONTROL, CURRENT_PHASE) are the permanent record.
2. CURRENT_PHASE.md is the single source of truth for project status. Status
   claims anywhere else (chat, reports, memory) are advisory only.
3. Any change to system behavior requires the CHANGE_CONTROL.md process, and
   the relevant governance doc must be updated in the same phase.

## Article VII — Amendments

Amendments to this Constitution require:
1. Explicit owner (Teddie) approval.
2. A version bump and changelog entry below.
3. Propagation of the change to any governance doc it affects.

---

## Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-04 | Initial constitution (Phase 2 deliverable) |
| 1.1 | 2026-07-05 | Art. IV/V updated for the implemented Approval Engine (owner-approved Phase 6): engine is a deterministic decision authority in Kiaros Core; execution wiring remains forbidden outside a future owner-approved phase that routes through it |
| 1.2 | 2026-07-07 | Art. IV status updates under the project-completion directive: MC READS implemented (writes remain owner-gated); launcher scripts implemented at jarvis/scripts under constitutional constraints; ports 3012–3016 clarified as reservations, not requirements |
| 1.3 | 2026-07-09 | Owner production directive ("standalone Professional Software Engineer from a single request"): Art. II diagram corrected (Approval Engine implemented, sits in Kiaros Core ahead of MC); Art. IV — MC task CREATION implemented via TaskDispatcher (engine consulted on every request; update/delete stays out of scope); Art. V.1 — sanctioned write path defined, engine bypass remains FORBIDDEN; Art. V.2 — voice privacy aligned with VOICE_ARCHITECTURE v2.0 (owner-opt-in cloud voice, proxied, keys server-side); Art. V.3 — optional Core auth acknowledged, token mandatory if ever non-localhost; Art. VI "ten documents" count fixed |
