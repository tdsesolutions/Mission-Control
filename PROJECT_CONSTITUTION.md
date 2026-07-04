# Project Constitution

**Project:** Kiaros / Mission Control / OpenClaw
**Version:** 1.0
**Date:** 2026-07-04
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
      → Mission Control (port 3002)
        → Approval Engine        [SPECIFIED, NOT YET IMPLEMENTED]
          → OpenClaw Gateway (port 18789, loopback only)
            → OpenClaw Main agent ("main", persona Kiaros)
              → Department agents / skills / tools
```

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
2. As of 2026-07-04, the following are **SPECIFIED, NOT IMPLEMENTED**, and no
   document may imply otherwise:
   - The Approval Engine and workflow levels 0–4 (APPROVAL_ENGINE.md,
     WORKFLOW_RULES.md, TASK_CLASSIFICATION.md)
   - Kiaros Core → Mission Control task/project write integration
   - Memory Service (3012), Voice Service (3013), Computer Control (3014),
     Service Monitor (3015), Notification Service (3016)
   - Launcher scripts `launch-ai-services.sh` / `stop-ai-services.sh` /
     `check-ai-services.sh`
3. A phase may only be declared COMPLETE when its validation report shows the
   deliverable actually running (build passing, endpoint responding), not
   merely files existing.

## Article V — Safety Posture

1. The Approval Engine is the intended safety gate. Until it is implemented,
   **no autonomous execution path may be wired from Kiaros into Mission
   Control task creation.** Kiaros may read; Kiaros may not yet write tasks.
2. Voice audio never leaves the local machine. Recognition and synthesis use
   the browser Web Speech API; only recognized text travels, and only to
   localhost services.
3. Kiaros Core (3010) currently has no authentication. It must remain bound
   to localhost and must not gain any write powers over Mission Control until
   authentication is added in an approved phase.

## Article VI — Documentation as Law

1. The ten governance documents created in Phase 2 (this Constitution plus
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
