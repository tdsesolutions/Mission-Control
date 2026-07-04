# OpenClaw Integration

**Project:** Kiaros / Mission Control / OpenClaw
**Version:** 1.0
**Date:** 2026-07-04
**Status:** Reference + BINDING boundaries
**Source:** Phase 1 Architecture Audit; Phase 4 (OPENCLAW_DISCOVERY_REPORT.md), Phase 6 (TASK_ROUTING_REPORT.md), Phase 7 (GATEWAY_DELIVERY_REPORT.md)

---

## 1. Role in the System

OpenClaw is the **execution engine** — the only layer that actually runs
agents, skills, and tools. Everything above it (Kiaros, Mission Control)
plans, routes, and monitors; OpenClaw executes.

## 2. The Prime Directive

**OpenClaw is never modified.** Not `~/.openclaw`, not agent configs, not
routing, not the gateway service. We connect as an operator client and
nothing more. This has been re-verified in every phase audit since Phase 4
and is constitutional law (Art. III).

Corollaries:
- No tooling in this repo may restart, kill, or reconfigure the OpenClaw
  gateway or its LaunchAgent.
- No new agents, skills, or workspace changes are made through file edits;
  anything OpenClaw-side happens through OpenClaw's own supported interfaces,
  by the owner.

## 3. Environment Facts (Phase 4 discovery, spot-checked in Phase 1 audit)

| Property | Value |
|---|---|
| Version | OpenClaw 2026.6.8 (844f405) at discovery time |
| CLI | `/opt/homebrew/bin/openclaw` |
| Gateway | Port **18789**, **loopback-only** (127.0.0.1), macOS LaunchAgent |
| Protocol | Gateway WebSocket protocol **v3** |
| Auth | Token (`OPENCLAW_GATEWAY_TOKEN` in MC `.env`) |
| Agents | `main` (persona **Kiaros**) + 11 department agents (architect, designer, frontend, backend, mobile, devops, qa, research, marketing, docs, data) + project agents |
| Skills | 71 at discovery |
| Department model | kimi-k2.7-code (at discovery) |

## 4. Routing Contract (Phase 6 — BINDING)

```
Mission Control ──dispatch──▶ OpenClaw `main` agent ──existing routing──▶ specialists
```

1. Mission Control submits tasks **only to `main`**
   (`MC_COORDINATOR_AGENT=main`). Never directly to a specialist.
2. Specialist selection is OpenClaw's existing routing — we never replicate,
   override, or bypass it.
3. Kiaros never talks to the gateway at all; its execution requests go
   through Mission Control (which is itself gated by the future Approval
   Engine).

## 5. Wire Protocol (as implemented in Mission Control)

Two gateway clients exist in Mission Control — both upstream code:

### Server-side RPC (`src/lib/openclaw-gateway.ts`)
- One fresh WebSocket per call: open → `connect` handshake (protocol v3
  min/max, client identity, `role: operator`, scopes `operator.admin/write/
  read`, token; handles the `connect.challenge` event from newer gateways) →
  single request frame → response → close.
- Task dispatch uses the `agent` method:
  `{ method: 'agent', params: { message, agentId: 'main', idempotencyKey, deliver:false } }`
  with `expectFinal` handling for async acceptance.

### Browser client (`src/lib/websocket.ts`)
- Long-lived authenticated socket from the MC UI to the gateway: protocol
  negotiation, device-identity signing, 30s heartbeat, reconnect and
  non-retryable error classification.

## 6. Known Instabilities to Design Around

1. **Method churn:** newer OpenClaw builds removed legacy RPC methods (e.g.
   `sessions_spawn`); MC carries `isUnknownMethodError()` fallbacks
   (upstream issue #645). Any future integration must tolerate missing
   methods rather than assume them.
2. **Token drift:** Phase 7's key finding was a silent auth-token mismatch
   that blocked all MC→Gateway delivery. Symptom pattern: connects fail or
   hang with no obvious error. Always verify the token before deeper
   debugging.
3. **Protocol version pinning:** everything assumes protocol v3. An OpenClaw
   upgrade that bumps the protocol is a breaking event and must be treated as
   a phase, not a hotfix.

## 7. Telegram — Backup Path Only (BINDING)

- Telegram exists solely as a **backup human ↔ Claw communication channel**,
  external to this repository.
- Telegram is **not** a Kiaros interface, **not** a Kiaros control path, and
  is never wired into Kiaros Desktop, Kiaros Core, or the Kiaros → Mission
  Control chain.
- No future phase may add Telegram-to-Kiaros bridging without a Constitution
  amendment. (Owner directive, 2026-07-04.)

## 8. How Kiaros Sees OpenClaw Today

Indirectly only:
- `MonitorService` polls `http://localhost:18789/health` every 30s for the
  ServicePanel display. This is read-only observation, not control, and is
  the **only** Kiaros→gateway contact permitted.
- Everything else (sessions, agents, activity) is intended to be read through
  Mission Control's API — SPECIFIED in Phase 9, not yet implemented.

---

## Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-04 | Initial version (Phase 2 deliverable) |
