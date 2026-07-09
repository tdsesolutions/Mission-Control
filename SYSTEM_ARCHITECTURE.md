# System Architecture

**Project:** Kiaros / Mission Control / OpenClaw
**Version:** 1.0
**Date:** 2026-07-04
**Status:** Reference (describes the system as it exists; intended-state items are marked)
**Source:** Phase 1 Architecture Audit (2026-07-04)

---

## 1. One-Paragraph Summary

The repository at `~/Desktop/AI-Lab/Mission-Control` contains two systems:
the upstream open-source **Mission Control** dashboard (Next.js, committed to
git, intentionally unmodified) and the custom **Kiaros** layer (`jarvis/`
directory — Core service + Desktop UI). Mission Control orchestrates tasks and
agents and talks to the external **OpenClaw** execution engine over a
loopback WebSocket gateway. Kiaros sits above Mission Control as the owner's
natural-language (eventually voice-first) interface.

## 2. Intended Architecture (Target State)

```
┌────────────────────────────────────────────────────────────┐
│ OWNER — natural speech in, natural speech out              │
└──────────────────────────┬─────────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────────┐
│ KIAROS DESKTOP (3011) — ambient UI, 5 visual modes, voice  │
└──────────────────────────┬─────────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────────┐
│ KIAROS CORE (3010) — intent, context, priorities, memory   │
└──────────────────────────┬─────────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────────┐
│ MISSION CONTROL (3002) — task queue, agents, monitoring    │
│   └─ APPROVAL ENGINE — decision gate [IMPLEMENTED Phase 6] │
└──────────────────────────┬─────────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────────┐
│ OPENCLAW GATEWAY (18789, loopback) — protocol v3 WebSocket │
└──────────────────────────┬─────────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────────┐
│ OPENCLAW MAIN ("main", persona Kiaros)                     │
│   └─ 11 department agents + project agents, 71 skills     │
└────────────────────────────────────────────────────────────┘

Backup path (independent of Kiaros): Telegram ↔ Claw only.
Telegram is never a Kiaros control path.
```

## 3. Current Implementation State vs Target

| Link in chain | Target | Current reality (2026-07-04) |
|---|---|---|
| Owner → Desktop (voice) | Natural two-way speech | **COMPLETE (Phases 7–8)** — full hands-free conversational loop: listen → understand → reply → speak → relisten; exactly-once semantics, echo protection, bounded silence, barge-in; proven by automated 10-turn soak (`verify-voice-loop-e2e.mjs`) |
| Desktop → Core | REST + WebSocket | IMPLEMENTED — REST polling remains the connection authority; Desktop `coreSocket` consumes `/ws` (reconnect + heartbeat) for mode sync and task/approval push refresh (2026-07-09) |
| Core conversation | LLM-backed executive reasoning | IMPLEMENTED Phase 5 — model-agnostic `LLMProvider` abstraction (`jarvis/core/src/services/llm/`); providers: `anthropic` (SDK, default model `claude-opus-4-8`) and `openai-compatible` (Ollama/LM Studio/OpenAI/vLLM); selection by config only; rule-based intent detection retained; template responses remain the always-available fallback |
| Core → Mission Control | Read status + create tasks | COMPLETE (PSE mission, 2026-07-09): reads are read-through PROXIES of MC (MC = system of record; honest degraded envelope when MC is down); task CREATION implemented via TaskDispatcher — every create decided by the Approval Engine, verified live end-to-end. Update/delete: 501 by design (MC UI owns lifecycle edits) |
| Approval Engine | Classify every request | IMPLEMENTED Phase 6, **WIRED 2026-07-09** — deterministic decision authority in Kiaros Core (`services/approval/`): approved / requires_owner_approval / requires_clarification / rejected; test suite + audit trail; sole authority over dispatch (TaskDispatcher consults it on every action request; bypass = FORBIDDEN) |
| Mission Control → Gateway → OpenClaw | Dispatch to `main` agent | IMPLEMENTED and mature (upstream code, tested) |
| Telegram ↔ Claw | Backup channel only | External to this repo; policy documented here |

## 4. Service & Port Map

Authoritative registry: `AI_SERVICE_PORT_REGISTRY.md` (Phase 10).

| Port | Service | Status |
|---|---|---|
| 18789 | OpenClaw Gateway (loopback only) | RUNNING (external, LaunchAgent) |
| 3002 | Mission Control (`.env PORT=3002`) | OPERATIONAL |
| 3010 | Kiaros Core (Express + ws) | BUILT (manual start) |
| 3011 | Kiaros Desktop (Vite/React) | OPERATIONAL (build fixed Phase 3) |
| 3012 | Memory Service | RESERVED, NOT BUILT |
| 3013 | Voice Service | RESERVED, NOT BUILT (voice was implemented in-browser instead) |
| 3014 | Computer Control | RESERVED, NOT BUILT |
| 3015 | Service Monitor | RESERVED, NOT BUILT |
| 3016 | Notification Service | RESERVED, NOT BUILT |
| 3000, 3001, 5173, 8000, 8080 | Protected web-dev ports | NEVER used by AI services |

## 5. Repository Layout

```
Mission-Control/
├── src/                  Mission Control app (upstream, unmodified, in git)
├── jarvis/               Kiaros system (custom; UNTRACKED in git as of audit)
│   ├── core/             Express service, port 3010
│   ├── desktop/          React/Vite UI, port 3011
│   ├── shared/           types + constants shared by both
│   └── scripts/          start/stop/status/verify shell scripts
├── scripts/              MC CLI, MCP server, TUI, deploy/doctor scripts
├── ops/                  MC provisioner daemon
├── tests/                ~70 vitest/playwright specs (Mission Control)
├── docs/, wiki/          upstream documentation
├── AUDIT/, SANDBOX/      QA proof artifacts (phases 3–7, 11)
├── PHASE*.md etc. (root) phase reports/audits/specs (build phases 2–11)
└── .data/                Mission Control SQLite DB (gitignored)
```

Full subsystem detail: COMPONENT_OWNERSHIP.md, MISSION_CONTROL_ARCHITECTURE.md,
VOICE_ARCHITECTURE.md, OPENCLAW_INTEGRATION.md.

## 6. Technology Stack

| Layer | Stack |
|---|---|
| Mission Control | Next.js 16, React 19, TypeScript 5, SQLite (better-sqlite3), Tailwind 3, Zustand, pnpm |
| Kiaros Core | Node/Express 4, ws, Winston, tsx (dev runner), npm, `@anthropic-ai/sdk` (Anthropic provider module only) |
| LLM layer | Provider abstraction (`KIAROS_LLM_PROVIDER`): `anthropic` (cloud — conversation **text** leaves the machine), `openai-compatible` (localhost runtime = fully local), or `none` (templates). Voice audio never leaves the machine regardless. Outbound connections only; no new ports |
| Kiaros Desktop | React 18, Vite 5, TypeScript 5, Zustand 4, framer-motion, lucide-react, npm |
| Voice | Browser Web Speech API (recognition + synthesis) — no server component |
| OpenClaw | External install 2026.6.8, `/opt/homebrew/bin/openclaw`, gateway protocol v3 |

Note the deliberate package-manager split: Mission Control mandates **pnpm**;
the `jarvis/` subprojects currently use **npm** (own lockfiles). Do not mix.

## 7. Known Cross-Cutting Risks (Summary)

Full list with rationale in the Phase 1 Architecture Audit; the load-bearing ones:

1. **Split-brain task state** — Kiaros in-memory "tasks" vs Mission Control
   SQLite tasks; identical shapes, zero sync. (STATE_MANAGEMENT.md)
2. **Safety chain partly notional** — approval gate is paper until built.
   (PROJECT_CONSTITUTION.md Art. IV–V)
3. Kiaros Core auth: optional shared-secret (`KIAROS_CORE_TOKEN`) on /api/v1/* and /ws — off by default (open on localhost), owner-enableable.
4. **Untracked work** — `jarvis/` and all phase docs are not in version control.
5. **Gateway protocol churn** — OpenClaw has removed RPC methods before
   (issue #645); both MC and future Kiaros code must tolerate this.
6. Health-check flapping — mitigated: monitor timeout calibrated to 12s
   (rule R10); an actually-down MC still reports honestly as unhealthy.

---

## Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-04 | Initial version (Phase 2 deliverable) |
