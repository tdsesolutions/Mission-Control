# Phase 4 Report — Complete & Formalize the Voice/Conversation Phase (B12)

**Era:** Governance
**Phase:** 4
**Date:** 2026-07-04
**Status:** ✅ COMPLETE (one manual owner check outstanding — §6)
**Authority:** Approved by owner 2026-07-04 ("Proceed with Phase 4 as proposed")
**Change class:** C1 (Kiaros-internal; no new external connections)

---

## 1. What Was Implemented

### Conversation persistence (scope item 2)
- `MemoryService` gained a shared-instance accessor (`getMemoryService()`);
  `index.ts` and route modules now use the same instance, so route data is
  loaded at startup and saved through the service lifecycle.
- The conversation route persists history through the memory file
  (`jarvis/core/memory/jarvis-memory.json`, key `conversation.history`),
  loaded lazily, capped at 100 entries, written to disk after each exchange.
  **History now survives Core restarts.**

### Boundary-violation fix found by the E2E sweep (scope item 3)
- `ServicePanel` was fetching `http://localhost:18789/health` (OpenClaw
  Gateway) and `http://localhost:3002/api/health` (Mission Control)
  **directly from the browser** — forbidden paths per MESSAGE_ROUTING.md §7
  and COMPONENT_OWNERSHIP.md §1, and a source of permanent CORS console
  errors that mis-rendered the gateway as offline.
- Fix: new Core endpoint `GET /api/v1/status/services` relays
  `MonitorService`'s statuses (shared-instance accessor added, mirroring the
  memory pattern); `ServicePanel` now makes exactly one call, to Kiaros Core.
- While wiring this, a pre-existing misclassification was found and fixed:
  the gateway reports status `"live"`, which MonitorService treated as
  unhealthy (the recurring "openclaw-gateway is live" *warning* in the logs).
  Statuses are now normalized (`ok`/`live`/`healthy` → healthy).

### B12 loose ends (scope item 3)
- CSS `@import` moved above all other statements — the Google Fonts import
  is no longer dropped from production builds (warning gone from Vite
  output). Whether to bundle fonts locally instead remains an owner option.
- `.env` resolution in Core made cwd-based so it works in both dev
  (`src/`) and the compiled layout (`dist/core/src/`); previously the
  compiled binary looked in the wrong directory.
- Stale `jarvis/.pids/core.pid` corrected as a side effect of the managed
  restart (§2).

### Durable verification tooling
- `jarvis/scripts/verify-desktop-e2e.mjs` — repeatable 7-check browser E2E
  (uses the repo-root Playwright; run from repo root with Core + Desktop up).

## 2. Runtime Events (full disclosure)

The stack was already running when Phase 4 began (owner-started). Findings:
- **Two stale Core instances** were sharing port 3010 (IPv4/IPv6 split), one
  predating the session — explains contradictory uptime readings. Both were
  stopped gracefully (SIGTERM), the port was verified released, and exactly
  one instance was started via the standard dev command with its PID
  recorded. This restart was required by the phase's own acceptance test
  (persistence across restart) and touched only the Kiaros-owned Core.
- Mission Control and the Desktop dev server were **not** touched.
- Playwright's Chromium (v1208) was downloaded to the user browser cache to
  run the E2E — test tooling only, standard for this repo's e2e setup.

## 3. What Was Verified

| Check | Result |
|---|---|
| Core `tsc` build (clean dist) | ✅ 0 errors |
| Desktop `tsc && vite build` | ✅ 0 errors; CSS `@import` warning gone |
| Conversation POST → canned reply + intent metadata | ✅ |
| History written to `jarvis-memory.json` after each exchange | ✅ (inspected file) |
| **History survives Core restart** | ✅ entries from 15:35Z served by a process started 16:28Z, and again after a second (tsx-watch) restart |
| `GET /api/v1/status/services` | ✅ gateway → healthy, core → healthy, MC → unhealthy (accurate: its /api/health is timing out) |
| Browser E2E (`verify-desktop-e2e.mjs`) | ✅ **7/7**: page loads; input enabled (Core connected); persisted history hydrates into UI; message sent via UI receives Kiaros reply; voice button renders; voice support probe OK; zero console/page errors |
| Screenshot evidence | ✅ `AUDIT/PHASE4_desktop_e2e.png` (header Connected, ServicePanel accurate, orb mode, Voice Ready indicator) |

## 4. Acceptance Criteria → Evidence

| Criterion (from the approved proposal) | Evidence |
|---|---|
| Voice/conversation loop verified end-to-end on a running system | E2E 7/7 against live services; UI message → Core pipeline → reply rendered; voice components load and probe cleanly (see §6 for the physical mic step) |
| Conversation history survives Core restarts | Restart-survival test above; `AUDIT/QA_PROOF_GOV_PHASE4.json` |
| Uses only existing components, no new external connections | Only MemoryService + MonitorService wiring; ServicePanel now makes *fewer* external calls (three forbidden → one sanctioned) |
| B12 loose ends retired | CSS import fixed; env-path fixed; boundary violation fixed; stale PID corrected |
| Missing B12/voice documentation produced | This report + PHASE4_AUDIT.md + QA proof; VOICE_ARCHITECTURE.md, STATE_MANAGEMENT.md, MESSAGE_ROUTING.md updated to match reality |

## 5. What Remains (out of Phase 4 scope, tracked in CURRENT_PHASE.md)

- LLM-backed conversation (ResponseGenerator is still canned templates)
- Kiaros ↔ Mission Control integration (blocked on Approval Engine)
- StateManager persistence TODOs; tasks/projects in-memory stubs
- Kiaros Core API authentication
- Health-check timeout calibration (MC flapping; its /api/health is
  currently slow — worth the owner's attention independently)
- Jarvis/Kiaros naming reconciliation

## 6. Owner Manual Check (the one thing automation cannot do)

Headless browsers have no microphone or speakers. To close the loop with
your own voice, with the stack running:

1. Open http://localhost:3011 in Chrome.
2. Click the microphone button; allow microphone access.
3. Say: "hello". Expect the transcript to appear, then a Kiaros reply, then
   spoken audio (auto-speak is on by default; settings gear adjusts voice).
4. Restart Core (`./jarvis/scripts/stop-jarvis.sh` + start, or just save any
   Core source file) and reload the page — the conversation should still be
   there.

Everything up to the sound card is verified; this confirms the last inch.
