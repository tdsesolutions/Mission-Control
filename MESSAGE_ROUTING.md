# Message Routing

**Project:** Kiaros / Mission Control / OpenClaw
**Version:** 1.0
**Date:** 2026-07-04
**Status:** Reference + BINDING routing rules
**Source:** Phase 1 Architecture Audit (2026-07-04)

This document traces every message path in the system, end to end, and marks
each hop IMPLEMENTED / PARTIAL / SPECIFIED / PLANNED.

---

## 1. Routing Rules (BINDING)

1. **Single conversation entry point:** all owner input — typed or spoken —
   enters through `jarvisStore.sendMessage()` → Kiaros Core
   `POST /api/v1/conversation/message`. No parallel pipelines.
2. **Single execution gateway:** only Mission Control's server-side code
   talks to the OpenClaw Gateway for dispatch. Kiaros never does.
3. **Main-agent-only dispatch:** Mission Control submits to OpenClaw `main`;
   specialist routing belongs to OpenClaw.
4. **No Kiaros→MC writes** until the Approval Engine is implemented.
5. **Telegram routes to Claw only** (backup channel); it is never part of any
   Kiaros or Mission Control message path.

## 2. Conversation Path (typed or spoken) — IMPLEMENTED

```
Owner input
│  typed: ConversationPanel form
│  spoken: VoiceButton → voiceStore → SpeechRecognitionService → final transcript
│          → ConversationPanel.handleVoiceTranscript
▼
jarvisStore.sendMessage(content)
│  1. checkConnection() → GET 3010/health (abort 3s)
│  2. optimistic user message added to store
▼
POST http://localhost:3010/api/v1/conversation/message  { content, type:'text' }  (abort 10s)
▼
Kiaros Core conversation route
│  stores user message (persisted via MemoryService, cap 100)
▼
ConversationManager pipeline (async since Phase 5):
│  IntentDetector   — regex+keyword scoring → one of 9 intents
│  ModeSelector     — conversation mode from intent + previous mode
│  ContextManager   — message count, topic/project extraction
│  LLM provider     — model-agnostic (services/llm; config-selected:
│                     anthropic | openai-compatible | none); receives the
│                     Kiaros persona system prompt + last 20 history turns
│  └─ on failure/unconfigured → ResponseGenerator templates (never mute)
▼
response JSON (metadata: responseSource ['llm'|'degraded'], provider, model)
▼
Desktop renders as 'jarvis' role; voice loop SPEAKS the reply (chunked TTS,
exactly once), then auto-relistens in conversation mode (Phase 7 loop —
see VOICE_ARCHITECTURE.md for the invariants)
```

**Critical truth (unchanged by Phase 5):** this path still terminates inside
Kiaros Core. The LLM only *converses* — its system prompt explicitly forbids
claiming to act, and **nothing reaches Mission Control.** Task execution
remains gated on the Approval Engine (Constitution Art. IV/V).

**Data egress:** with the `anthropic` provider, conversation text (never
audio) is sent to the Anthropic API — the only sanctioned outbound external
connection in Kiaros. With `openai-compatible` pointed at localhost (the
current runtime config: Ollama), everything stays on-machine.

## 3. Task Dispatch Path (Mission Control → OpenClaw) — IMPLEMENTED

```
Task created in MC (UI / REST / MCP / CLI / cron / GitHub sync)
▼
SQLite insert (status flow starts at 'inbox'/'queued')
▼
task-dispatch.ts
│  builds ticket prompt: "[PREFIX-NNN] title / priority / tags / description
│                         (+ prior review feedback if re-dispatch)"
│  resolves gateway agent id: agent_config.openclawId → else agent_name
│  model override ONLY if agent_config.dispatchModel set
▼
callOpenClawGateway('agent', { message, agentId, idempotencyKey, deliver:false })
│  fresh WS per call → protocol-v3 connect handshake (token, operator role,
│  handles connect.challenge) → request → response → close
│  expectFinal handling for async 'accepted' → deferred completion
│  isUnknownMethodError() fallback for removed gateway methods (#645)
▼
OpenClaw main agent session → existing OpenClaw routing → specialists
▼
transcript parsed back (JSONL session transcripts) → task status updated
▼
eventBus.broadcast('task.updated' / 'task.escalated' …) → SSE to UI
▼
outbound GitHub/GNAP sync if configured
```

Failure handling: retries with attempt tracking; terminal failures broadcast
`task.escalated` with reason classification (max retries / stale / Aegis
rejections).

## 3b. Approval Decision Path (Phase 6) — IMPLEMENTED, decision-only

```
Any caller
  → POST 3010/api/v1/approval/classify  { intent, operations?, targetPaths? }
  → ApprovalEngine (DETERMINISTIC: rule tables in services/approval/rules.ts;
    no LLM, no provider, no network)
  → decision: approved | requires_owner_approval | requires_clarification | rejected
    (+ B8 level 0–4, reason, matched rules)
  → side effects: audit append (core/logs/approval-audit.jsonl) + event-bus
    notification. NOTHING IS EXECUTED.

Conversation pipeline: command-intent messages are classified automatically;
the decision rides in response metadata and as an LLM context hint so Kiaros
speaks accurately about what would need approval. Information only.
```

**Rule:** any future execution path MUST obtain its decision here first;
bypassing the engine is a FORBIDDEN change class (Constitution Art. V v1.1).

## 4. Kiaros → Mission Control Path — PARTIAL / SPECIFIED

| Message | Mechanism | Status |
|---|---|---|
| Health probe | `GET 3002/api/health` every 30s (MonitorService, 5s timeout) | IMPLEMENTED |
| Read tasks/agents/projects | `MissionControlClient.listTasks()/getTask()/listProjects()/listAgents()` (x-api-key, 10s timebox) | IMPLEMENTED (2026-07-07) — consumed by the Kiaros task/project proxy routes |
| Create/update task | (no client methods — deliberately absent) | FORBIDDEN until an owner-approved phase routes writes through the Approval Engine; Kiaros write endpoints answer 501 honestly |
| Subscribe to MC events | SSE `/api/events` | SPECIFIED (Phase 9), NOT IMPLEMENTED |

## 5. Event Broadcast Paths

### Mission Control (IMPLEMENTED)
```
DB mutation → eventBus.broadcast(type, data)
  → GET /api/events (SSE, role-gated, workspace-filtered) → MC UI store
```
25+ event types: `task.*`, `agent.*`, `chat.*`, `notification.*`, `run.*`,
`security.*`, `connection.*`, `github.synced`, `session.updated`,
`task.escalated`.

### Kiaros Core (IMPLEMENTED but unconsumed)
```
any service → EventBus.emitEvent(type, severity, source, message, data)
  → ring buffer (GET /api/v1/events)
  → WebSocketManager broadcast on ws://3010/ws
      (client protocol: subscribe / unsubscribe / ping; empty subscription = all)
```
**No consumer exists today** — the Desktop polls HTTP instead of using `/ws`.

### MC Browser ↔ Gateway (IMPLEMENTED)
Long-lived authenticated WS from the MC UI to 18789 for live session/agent
control (device identity, heartbeat, reconnect). Independent of both planes
above.

**Rule:** these three planes are uncoordinated by design today. Bridging any
two of them requires a phase that defines event ownership and de-duplication
first.

## 6. Health/Monitoring Paths — IMPLEMENTED

```
Kiaros MonitorService (every 30s, 5s timeout):
  GET 18789/health          (OpenClaw Gateway; reports status "live")
  GET 3002/api/health       (Mission Control)
  GET 3010/health           (self)
  → statuses normalized (ok/live/healthy → healthy), transitions emit
    service:healthy / service:unhealthy events

Kiaros Desktop (Core is its ONLY health source — Phase 4):
  GET 3010/health                  every 5s (connection indicator)
  GET 3010/api/v1/status/services  every 5s (ServicePanel; relays
                                    MonitorService's view of all services)
```

Known artifact: the 5s timeout marks Mission Control "unhealthy" during slow
responses (e.g. Next.js compilation) — flapping visible in
`jarvis/logs/core.log`. Documented; not yet addressed.

## 7. Paths That Must Never Exist

- Kiaros Desktop → Mission Control (any direct call)
- Kiaros (Core or Desktop) → OpenClaw Gateway for anything beyond the
  read-only health probe
- Telegram → Kiaros (any direction)
- Voice audio → any non-localhost destination
- Any dispatch path that names a specialist agent instead of `main`

---

## Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-04 | Initial version (Phase 2 deliverable) |
