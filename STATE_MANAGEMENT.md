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
| 4 | Kiaros state (mode/status/context) | Kiaros Core | `JarvisStateManager`, in-memory | **None — `loadState`/`saveState` are TODO stubs** | PARTIAL |
| 5 | Kiaros memory file | Kiaros Core | `MemoryService` → `jarvis/core/memory/jarvis-memory.json` (shared instance via `getMemoryService()`) | Durable | IMPLEMENTED; carries conversation history since Phase 4; still not wired into StateManager |
| 6 | Kiaros conversations | Kiaros Core | Loaded/persisted through MemoryService (key `conversation.history`), cap 100, saved after each exchange | **Durable — survives Core restarts (verified Phase 4)** | IMPLEMENTED |
| 7 | Kiaros "tasks" / "projects" | Kiaros Core | In-memory `Map`s in route modules | Lost on restart | STUB — marked "will integrate with Mission Control" |
| 8 | Kiaros event history | Kiaros Core | EventBus ring buffer (1,000 events) | Lost on restart | IMPLEMENTED (by design) |
| 9 | Desktop chat/connection | Kiaros Desktop | `jarvisStore` (Zustand) | Ephemeral (rehydrates from Core on load) | IMPLEMENTED |
| 10 | Voice settings | Kiaros Desktop | localStorage via `VoiceSettingsManager` | Durable (browser) | IMPLEMENTED |
| 11 | OpenClaw sessions/config | OpenClaw | `~/.openclaw` | Durable | External — never touched |

## 3. The Split-Brain Hazard (Documented, Unresolved)

Kiaros Core exposes `/api/v1/tasks` and `/api/v1/projects` whose shapes mirror
Mission Control's API but whose data lives in in-memory Maps (#7). These two
"task" concepts have **no synchronization**:

- Anything built against Kiaros's task API will silently diverge from the
  real queue in Mission Control.
- Phase 11's completion report marked this integration "✅", which was
  inaccurate; the Honesty Doctrine (Constitution Art. IV) exists because of
  this.

**Standing rules until the integration phase:**
1. Kiaros's in-memory task/project stores are treated as **display stubs**.
   No feature may rely on them as a source of truth.
2. When integration is built, Kiaros routes must **proxy** Mission Control
   (read-through/write-through with MC as system of record), not mirror it.
   Kiaros must never persist its own parallel task state.
3. Writes remain forbidden until the Approval Engine exists (Art. V).

## 4. Persistence Gaps (Known, Not Yet Fixed)

Recorded for future phases; do not fix outside change control:

1. `JarvisStateManager.loadState()/saveState()` are TODOs — mode and
   preferences reset on Core restart (except mode, which Desktop re-syncs).
2. ~~Conversation history lost on Core restart~~ — RESOLVED Phase 4
   (persisted through MemoryService; restart survival verified).
3. Tasks/projects route stores (#7) remain in-memory display stubs by
   design until the Mission Control integration phase.

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
| `jarvis/.env` (from `jarvis/.env.example`) | Kiaros: core/desktop ports, `MISSION_CONTROL_URL` (http://localhost:3002), `MISSION_CONTROL_API_KEY`, log level, memory path |
| `jarvis/shared/constants/index.ts` | Compile-time ports/endpoints/feature flags (note stale `FEATURES.VOICE=false`) |
| `AI_SERVICE_PORT_REGISTRY.md` | Authoritative port assignments (Phase 10) |

Rule: ports live in the registry first, constants second, env third — all
three must agree; the registry wins disputes.

---

## Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-04 | Initial version (Phase 2 deliverable) |
