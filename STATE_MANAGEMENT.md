# State Management

**Project:** Kiaros / Mission Control / OpenClaw
**Version:** 1.0
**Date:** 2026-07-04
**Status:** Reference + BINDING single-write-path rule
**Source:** Phase 1 Architecture Audit (2026-07-04)

---

## 1. The One Rule That Matters

**Mission Control's SQLite database is the only durable store of tasks,
agents, and orchestration state.** Every other store in the system is either
ephemeral by design or scoped to its own subsystem. Nothing may create a
second durable task store. Violating this creates split-brain state — the
project's #1 documented architectural risk.

## 2. State Inventory (as of 2026-07-04)

| # | Store | Owner | Mechanism | Durability | Status |
|---|-------|-------|-----------|------------|--------|
| 1 | `.data/mission-control.db` | Mission Control | SQLite (better-sqlite3); schema.sql + migrations | **Durable — system of record** | IMPLEMENTED |
| 2 | MC settings | Mission Control | `settings` table (overrides env, e.g. API key) | Durable | IMPLEMENTED |
| 3 | MC client state | MC UI | Single Zustand store, refreshed via SSE/WS | Ephemeral | IMPLEMENTED |
| 4 | Kiaros state (mode/preferences) | Kiaros Core | `JarvisStateManager` → MemoryService snapshot (`state.snapshot`), saved on change | **Durable — mode survives restarts (verified 2026-07-07)** | IMPLEMENTED |
| 5 | Kiaros memory file | Kiaros Core | `MemoryService` → `jarvis/core/memory/jarvis-memory.json` (shared instance via `getMemoryService()`) | Durable | IMPLEMENTED; carries conversation history (Phase 4) and the StateManager snapshot (2026-07-07) |
| 6 | Kiaros conversations | Kiaros Core | Loaded/persisted through MemoryService (key `conversation.history`), cap 100, saved after each exchange | **Durable — survives Core restarts (verified Phase 4)** | IMPLEMENTED |
| 7 | Kiaros tasks/projects views | Kiaros Core | READ-THROUGH PROXY of Mission Control — no local store exists at all | N/A — MC is the only store | IMPLEMENTED 2026-07-07; task CREATE via TaskDispatcher/Approval Engine (2026-07-09); update/delete 501 by design |
| 7b | Pending owner-approval dispatch queue | Kiaros Core (TaskDispatcher) | MemoryService key `dispatch.pending`; resolved entries retained for audit, capped 200 (pending never dropped) | **Durable — survives Core restarts** | IMPLEMENTED 2026-07-09 |
| 8 | Kiaros event history | Kiaros Core | EventBus ring buffer (1,000 events) | Lost on restart | IMPLEMENTED (by design) |
| 9 | Desktop chat/connection | Kiaros Desktop | `jarvisStore` (Zustand) | Ephemeral (rehydrates from Core on load) | IMPLEMENTED |
| 10 | Voice settings | Kiaros Desktop | localStorage via `VoiceSettingsManager` | Durable (browser) | IMPLEMENTED |
| 11 | OpenClaw sessions/config | OpenClaw | `~/.openclaw` | Durable | External — never touched |

## 3. The Split-Brain Hazard (RESOLVED 2026-07-07)

Historically, Kiaros exposed `/api/v1/tasks`/`/api/v1/projects` backed by
in-memory stub Maps — a second "task" concept with no synchronization to
Mission Control (B11's report even claimed the integration existed; the
Honesty Doctrine, Art. IV, was born from that).

**Resolution:** the stub stores are deleted. Kiaros routes are read-through
proxies with Mission Control as the sole system of record, exactly as this
document's standing rule required. When MC is unreachable, the proxy returns
an honest degraded envelope (`MISSION_CONTROL_UNAVAILABLE`) — it never
fabricates an empty queue.

**Standing rules (still binding):**
1. Kiaros must never persist its own parallel task state.
2. Writes remain forbidden until an owner-approved phase routes them through
   the Approval Engine (Art. V); Kiaros write endpoints answer 501 honestly.

## 4. Persistence Gaps (Known, Not Yet Fixed)

Recorded for future phases; do not fix outside change control:

1. ~~StateManager persistence TODOs~~ — RESOLVED 2026-07-07 (MemoryService
   snapshot; mode verified across restart).
2. ~~Conversation history lost on Core restart~~ — RESOLVED Phase 4
   (persisted through MemoryService; restart survival verified).
3. ~~Tasks/projects in-memory stubs~~ — RESOLVED 2026-07-07: the stub
   stores are deleted; routes proxy Mission Control (the split-brain
   hazard in §3 is structurally closed — there is no second task store).

## 5. Real-Time State Propagation

| Path | Mechanism | Status |
|---|---|---|
| MC DB mutation → MC UI | `eventBus` singleton → SSE `/api/events` (workspace-filtered) | IMPLEMENTED |
| MC UI ↔ Gateway | Direct browser WebSocket (heartbeat, reconnect) | IMPLEMENTED |
| Kiaros Core → Desktop | Core `/ws` broadcast of all EventBus events | IMPLEMENTED server-side; **Desktop does not use it** — it polls `/health` every 5s and fetches on demand |
| MC events → Kiaros Core | SSE subscription (`task.completed`, `task.failed`, …) | SPECIFIED (Phase 9), NOT IMPLEMENTED |

Consequence to remember: today there are **three uncoordinated real-time
planes** (MC SSE, MC↔gateway WS, Kiaros WS). Any future feature that bridges
them must define event ownership first or risk loops/double-processing.

## 6. Environment & Configuration State

| File | Governs |
|---|---|
| `.env` (root) | Mission Control: port 3002, gateway host/port/token, coordinator agent, data dir, security flags |
| `jarvis/.env` (from `jarvis/.env.example`) | Kiaros: core/desktop ports, `MISSION_CONTROL_URL`/`MISSION_CONTROL_API_KEY` (reads), LLM provider selection, optional `KIAROS_CORE_TOKEN`, log level, memory path |
| `jarvis/shared/constants/index.ts` | Compile-time ports/endpoints/feature flags |
| `AI_SERVICE_PORT_REGISTRY.md` | Authoritative port assignments (Phase 10) |

Rule: ports live in the registry first, constants second, env third — all
three must agree; the registry wins disputes.

---

## Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-04 | Initial version (Phase 2 deliverable) |
