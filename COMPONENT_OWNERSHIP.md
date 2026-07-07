# Component Ownership

**Project:** Kiaros / Mission Control / OpenClaw
**Version:** 1.0
**Date:** 2026-07-04
**Status:** BINDING boundaries — violating a "Must Never Touch" row requires a Constitution amendment
**Source:** Phase 1 Architecture Audit (2026-07-04)

Each subsystem is defined by three columns: what it **owns** (its exclusive
responsibility), what it **must never touch**, and its **current state**.

---

## 1. Kiaros Desktop (`jarvis/desktop/`, port 3011)

**Owns**
- All owner-facing presentation: 5 visual modes (Orb, Sphere, Wave, HUD,
  Ambient), Header, ServicePanel, TaskPanel, ConversationPanel, ModeSelector.
- Voice capture and playback (microphone permission, Web Speech recognition,
  speech synthesis) — see VOICE_ARCHITECTURE.md.
- Client state: `jarvisStore` (chat, connection, mode), `voiceStore`.

**Must never touch**
- Mission Control directly (no fetches to port 3002 from the Desktop).
- The OpenClaw Gateway (port 18789) in any form.
- Business logic: intent detection, prioritization, and task decisions belong
  to Kiaros Core.
- Any persistence beyond browser localStorage (voice settings only).

**Current state:** COMPLETE. Full conversational voice loop (Phases 7–8);
layout corrections 2026-07-06 (communication interface is the primary
workspace). Historical defects (StatusBar import, `require()` in
voiceStore) fixed Phase 3. UI branding says "Kiaros"; code identifiers say
"jarvis" (reconciliation owner-gated).

## 2. Kiaros Core (`jarvis/core/`, port 3010)

**Owns**
- The conversation pipeline: IntentDetector → ModeSelector → ContextManager →
  LLM provider (model-agnostic, Phase 5) with ResponseGenerator templates as
  the always-available fallback.
- The **LLM provider abstraction** (`src/services/llm/`): the only place
  provider-specific code may live. Kiaros is never hardcoded to a provider or
  model (owner mandate, 2026-07-05); selection is configuration
  (`KIAROS_LLM_PROVIDER` in `jarvis/.env`). Adding a provider = one new
  module + one registry entry, zero Kiaros changes.
- Kiaros state (mode, status, context) and Kiaros memory
  (`core/memory/jarvis-memory.json` via MemoryService).
- Health monitoring of the ecosystem (MonitorService polls gateway, Mission
  Control, self every 30s).
- The Kiaros event plane: EventBus + `/ws` broadcast.
- The **only** authorized client of Mission Control's API on behalf of Kiaros
  (`MissionControlClient`, Bearer API key).

**Must never touch**
- The OpenClaw Gateway or any OpenClaw file (`~/.openclaw`). All execution
  requests must go through Mission Control's API.
- Mission Control's database, filesystem, or source code.
- Mission Control **writes** (task/project creation) — permitted only in a
  future owner-approved phase routed through the (implemented) Approval
  Engine; until then Kiaros write endpoints answer 501 — Constitution Art. V.
- Protected dev ports.

**Current state:** COMPLETE (project completion, 2026-07-07). Conversation
is LLM-backed via the provider abstraction (local Ollama live; Anthropic
wire-verified, awaiting owner key) with honest degraded mode. Conversation
history and StateManager mode/preferences persist via MemoryService.
Task/project routes are read-through PROXIES of Mission Control (writes
501-gated per Art. V); MissionControlClient does typed, timeboxed reads
only. Auth: optional shared-secret (`KIAROS_CORE_TOKEN`) on HTTP + WS, off
by default on localhost. Deliberately crash-proof init and LLM-failure
honest degradation — preserve both.

## 3. Kiaros Shared (`jarvis/shared/`)

**Owns**
- TypeScript types and constants (ports, endpoints, timeouts, UI modes,
  colors, error codes, event types, feature flags) used by both Core and
  Desktop.

**Must never touch**
- Anything at runtime — it is types/constants only, no side effects.

**Current state:** IMPLEMENTED (`FEATURES.VOICE` reconciled Phase 3). Known history: Core cannot use `@shared/*` path
aliases (tsx does not resolve them — caused the Phase 11 silent crash);
Core uses relative imports, Desktop's Vite alias may use `@shared`.

## 4. Mission Control (`src/`, port 3002)

**Owns**
- The durable task queue and agent registry (SQLite, `.data/`).
- All dispatch to OpenClaw (`src/lib/task-dispatch.ts`,
  `src/lib/openclaw-gateway.ts`) — the only server-side gateway client.
- The operator dashboard (35 panels), REST API (~60 groups), MCP server, CLI,
  SSE event stream, scheduler, GitHub sync, PTY terminal.
- Authentication and authorization for everything above.

**Must never touch**
- OpenClaw's installation, config, agents, or routing (consumer only).
- Its own upstream source is never modified by us — configuration happens via
  `.env` and the settings UI/DB only (Constitution Art. III).

**Current state:** OPERATIONAL, upstream, unmodified. Runs on port 3002 (not
the 3000 in upstream docs). Detail: MISSION_CONTROL_ARCHITECTURE.md.

## 5. Approval Engine (`jarvis/core/src/services/approval/`)

**Owns**
- Classification of requests into the owner's four states — **approved /
  requires_owner_approval / requires_clarification / rejected** — with B8
  levels 0–4 as supporting metadata. Rule tables live in `rules.ts` (the
  only file that defines safety behavior; 40-case vitest suite guards it).
- The approval audit trail (`core/logs/approval-audit.jsonl`) and
  approval events on the Kiaros event bus.
- API: `POST /api/v1/approval/classify`, `GET /api/v1/approval/audit`.

**Must never**
- Execute work — its only side effects are the audit append and an event.
- Modify Mission Control or invoke OpenClaw.
- Consult an LLM or any provider: decisions are **fully deterministic**
  (same request → same decision; works with zero network, zero providers —
  owner mandate 2026-07-05).
- Default to approval: unrecognizable input is `requires_clarification`.

**Current state:** IMPLEMENTED (Phase 6) as a decision authority.
**Implemented ≠ wired:** no execution path exists yet; the conversation
pipeline consults it for action-class requests as information only. Do not
confuse it with Mission Control's unrelated upstream "exec approvals"
feature (`src/lib/exec-approval-utils.ts`), which gates gateway exec
commands and shares vocabulary only.

## 6. OpenClaw (external: `/opt/homebrew/bin/openclaw`, `~/.openclaw`, port 18789)

**Owns**
- All execution: the `main` agent (persona "Kiaros"), 11 department agents,
  project agents, 71 skills, model routing, sessions.
- Its gateway (protocol v3, loopback-only, token auth).

**Must never be touched by us — at all.** No config edits, no agent edits, no
routing changes, no gateway restarts from our tooling. Every phase audit
re-verifies this.

**Current state:** RUNNING (external LaunchAgent). Version 2026.6.8 at audit
time.

## 7. Telegram (external)

**Owns**
- A backup human↔Claw communication path only.

**Must never touch / be touched**
- Telegram is **not** a Kiaros interface and **not** a Kiaros control path.
  It must never be wired to Kiaros Desktop, Kiaros Core, or the Kiaros →
  Mission Control chain. (Owner directive, 2026-07-04; Constitution Art. II.)

## 8. Scripts & Ops

**Owns**
- `jarvis/scripts/`: start/stop/status/verify for Kiaros only.
- `scripts/` (root): Mission Control CLI/MCP/TUI/deploy/doctor — upstream.
- `ops/`: MC provisioner daemon — upstream.

**Must never touch**
- Kiaros scripts must never kill processes on protected or non-Kiaros ports.
- `launch-ai-services.sh` / `stop-ai-services.sh` / `check-ai-services.sh`
  are IMPLEMENTED (2026-07-07) at `jarvis/scripts/` (not repo-root scripts/,
  which is upstream-owned — documented deviation from the B10 plan). They
  manage ONLY Kiaros ports (3010/3011); the OpenClaw Gateway and Mission
  Control are health-VERIFIED, never started/stopped/killed; unbuilt
  extension services are skipped gracefully.

## 9. Naming (Cross-Cutting)

| Context | Name used today |
|---|---|
| Product / UI copy / OpenClaw main persona | **Kiaros** |
| Directory, packages, stores, types, constants, docs | **jarvis** |
| Message role in conversation schema | `'jarvis'` |

Ruling: Kiaros is the official name (Constitution Art. I). The code-level
"jarvis" identifiers stay as-is until a dedicated rename phase is approved —
a rename touches the message schema, stored JSON, and both packages, and is
exactly the kind of change that has caused regressions here before.

---

## Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-04 | Initial version (Phase 2 deliverable) |
