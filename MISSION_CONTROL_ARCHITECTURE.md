# Mission Control Architecture

**Project:** Kiaros / Mission Control / OpenClaw
**Version:** 1.0
**Date:** 2026-07-04
**Status:** Reference (upstream system — we document, we do not modify)
**Source:** Phase 1 Architecture Audit (2026-07-04)

---

## 1. Role in the System

Mission Control is the **orchestration layer**: the durable task queue, agent
registry, monitoring surface, and the only component authorized to talk to
the OpenClaw Gateway server-side. Kiaros sits above it; OpenClaw sits below
it.

**Governing rule (Constitution Art. III):** Mission Control is upstream
open-source software and its source (`src/`, `scripts/`, `ops/`, tests) is
never modified by this project. All local behavior comes from `.env` and its
settings UI/DB. Every phase audit re-verifies "no Mission Control source
changes."

## 2. Runtime Facts (This Installation)

| Fact | Value |
|---|---|
| Port | **3002** (`.env PORT=3002`) — upstream docs say 3000; ours does not |
| Data | SQLite via better-sqlite3 at `.data/mission-control.db` (`MISSION_CONTROL_DATA_DIR=.data`) |
| Gateway target | `ws://127.0.0.1:18789`, token in `.env` (`OPENCLAW_GATEWAY_TOKEN`) |
| Coordinator agent | `MC_COORDINATOR_AGENT=main` (dispatch goes to OpenClaw `main` only) |
| Gateway-optional mode | `NEXT_PUBLIC_GATEWAY_OPTIONAL=true` |
| Allowed hosts | localhost, 127.0.0.1, ::1; HSTS + strict cookies enabled |
| Health endpoint | `GET /api/health` (used by Kiaros MonitorService and launcher plan) |

## 3. Internal Structure

### Frontend
- Next.js 16 App Router with a **single catch-all route**
  (`src/app/[[...panel]]/page.tsx`); panels are client-side views.
- 35 panels in `src/components/panels/` (task board, agent squad, chat, cost
  tracker, memory browser/graph, cron, gateway config/control, exec
  approvals, security audit, office, standup, system monitor, …).
- One global Zustand store (`src/store/index.ts`).
- i18n: 10 locales under `messages/`.

### Backend
- ~60 REST route groups under `src/app/api/` (tasks, agents, chat, sessions,
  events, cron, webhooks, github, gateways, exec-approvals, security-scan, …).
- OpenAPI spec at `openapi.json`; interactive docs at `/docs`.
- Auth (`src/lib/auth.ts`): session cookies + roles (viewer and up), API keys
  (DB `settings.security.api_key` override, else `API_KEY` env), agent-scoped
  keys. API key accepted via `x-api-key` **or** `Authorization: Bearer|ApiKey|
  Token` — this is why Kiaros Core's Bearer header works.

### Persistence
- Base schema (`src/lib/schema.sql`): `tasks`, `agents`, `comments`,
  `activities`, `notifications`, `task_subscriptions`, `standup_reports`,
  `quality_reviews`, `gateway_health_logs`; extended by `src/lib/
  migrations.ts` (workspaces, settings, sessions, runs, and more).
- better-sqlite3 is a native addon: **rebuild required when Node versions
  change** (`pnpm rebuild better-sqlite3`) — a documented recurring pitfall.

### Real-time planes (there are two — do not conflate)
1. **Server events → UI:** singleton `eventBus` (`src/lib/event-bus.ts`,
   HMR-safe via `globalThis`) broadcasts 25+ typed events (`task.*`,
   `agent.*`, `chat.*`, `run.*`, `security.*`, `task.escalated`, …) to the
   SSE endpoint `GET /api/events` (auth-gated, workspace-filtered).
2. **Browser ↔ Gateway:** the MC UI opens its own WebSocket directly to the
   OpenClaw Gateway (`src/lib/websocket.ts`) with protocol negotiation,
   device-identity signing, heartbeat (30s ping, 3 missed pongs), reconnect.

### Task engine
- `src/lib/task-dispatch.ts` (~1,700 lines): builds ticket-formatted prompts,
  resolves the gateway agent id from agent config (`openclawId`, else display
  name), dispatches via the gateway `agent` RPC with idempotency keys, parses
  session transcripts, reconciles deferred/async completions, retries, and
  emits `task.escalated` on failure; outbound GitHub/GNAP sync.
- `src/lib/scheduler.ts` + recurring tasks for cron-style work.
- Model overrides only when an agent config sets `dispatchModel`; otherwise
  the OpenClaw agent's own default model is used.

### Agent/automation surfaces
- **MCP server** `scripts/mc-mcp-server.cjs` — 35 tools (agents, tasks,
  sessions, memory, soul, comments, tokens, skills, cron, status).
- **CLI** `pnpm mc …` (`scripts/mc-cli.cjs`), TUI, heartbeat/notification
  daemons, provisioner (`ops/`).
- Webhooks, GitHub sync engine/poller, PTY terminal over WebSocket.

## 4. What Mission Control Owns vs Must Never Touch

See COMPONENT_OWNERSHIP.md §4. Summary: owns the durable queue, all gateway
dispatch, and operator UX; never touches OpenClaw's installation, and its own
source is never touched by us.

## 5. Integration Contract for Kiaros

The only sanctioned Kiaros → Mission Control interface:

| Operation | Endpoint | Status |
|---|---|---|
| Health | `GET /api/health` | IMPLEMENTED (used by MonitorService) |
| Read tasks/agents/projects | `GET /api/tasks`, `/api/agents`, `/api/projects` | IMPLEMENTED (2026-07-07): typed, timeboxed (10s) reads with x-api-key; Kiaros task/project routes proxy these (degraded envelope when MC is down) |
| Create task | `POST /api/tasks` | IMPLEMENTED (2026-07-09, owner directive): `MissionControlClient.createTask`, callable ONLY by the TaskDispatcher, which obtains an Approval Engine decision for every request (Constitution v1.3 Art. V — engine bypass is FORBIDDEN). Tasks carry `created_by: kiaros`, the decision id in metadata, and `assigned_to` from `KIAROS_MC_ASSIGNEE` (default `main`) |
| Update/delete tasks | `PATCH/PUT/DELETE /api/tasks…` | OUT OF SCOPE by design — no client methods; Kiaros endpoints answer 501 (MC's own UI owns task lifecycle edits) |
| Live events | `GET /api/events` (SSE) | PLANNED — Phase 9 spec calls for it; not implemented in Kiaros |

Auth: Kiaros Core must use a Mission Control API key
(`MISSION_CONTROL_API_KEY` in `jarvis/.env`) via Bearer header.

## 6. Known Distinctions That Have Caused Confusion

- **"Exec approvals" ≠ "Approval Engine."** Mission Control ships an upstream
  exec-approval feature for gateway exec commands
  (`src/lib/exec-approval-utils.ts`, exec-approval panel). The project's
  Approval Engine (B8 spec, implemented Governance Phase 6 in Kiaros Core)
  is a separate system; the two share vocabulary only.
- **Port 3002 vs 3000.** Upstream README/CLAUDE.md say 3000; this install
  runs 3002 per the Phase 10 port registry. 3000 is a protected web-dev port
  here.
- **Standalone mode** uses `node .next/standalone/server.js`, not
  `pnpm start` (upstream pitfall, reconfirmed in Phase 3).

---

## Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-04 | Initial version (Phase 2 deliverable) |
| 2.0 | 2026-07-09 | PSE mission: §5 contract updated — task creation implemented via TaskDispatcher/Approval Engine; update/delete recorded as by-design out of scope |
