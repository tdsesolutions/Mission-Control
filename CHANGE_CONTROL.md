# Change Control

**Project:** Kiaros / Mission Control / OpenClaw
**Version:** 1.0
**Date:** 2026-07-04
**Status:** BINDING process — all future work follows this document
**Source:** Phase 1 Architecture Audit; regression history from build phases 7–11

---

## 1. Why This Document Exists

This project's regression history is not random; the same failure shape
repeats: **an assumption that was never verified.** tsx was assumed to
resolve tsconfig path aliases (Phase 11 — three fix cycles). `localhost` was
assumed to equal `127.0.0.1` (CORS failures). The configured gateway token
was assumed to be the one the gateway wanted (Phase 7 — silent delivery
failure). Docs were assumed to reflect code (Phase 11 report claimed
integration that didn't exist). A component was assumed safe to delete
because nothing rendered it (the StatusBar import currently breaking the
Desktop build). Change control here is mostly assumption control.

## 2. The Phase System

1. **All behavior changes happen inside a named, owner-approved phase.**
   No hotfixes, no drive-by refactors, no "while I'm in here."
2. A phase has, at minimum: a stated objective, an in-scope/out-of-scope
   list, deliverables, and a completion report + audit (the existing
   `PHASE*_REPORT/AUDIT` convention continues).
3. CURRENT_PHASE.md is updated at phase start and phase end. It is the only
   authoritative status document (Constitution Art. VI).
4. Between phases, the working tree is read-only for implementation code.
   Documentation may be corrected at any time (docs must chase reality, never
   lead it — Art. IV).

## 3. Change Classification

| Class | Definition | Requirements |
|---|---|---|
| **C0 — Documentation** | Governance/reference docs only | Allowed anytime; keep Specified/Implemented labels accurate |
| **C1 — Kiaros-internal** | Code within `jarvis/` that doesn't add new external connections | Approved phase; pre-flight + verification checklists |
| **C2 — Integration** | Any new connection between subsystems (Kiaros↔MC, new event bridges, new ports) | Approved phase; update SYSTEM_ARCHITECTURE, MESSAGE_ROUTING, COMPONENT_OWNERSHIP, port registry in the same phase |
| **C3 — Constitutional** | Anything touching an Article of the Constitution (delegation chain, untouchable systems, Telegram policy, safety posture, naming) | Constitution amendment + explicit owner approval, in writing |
| **FORBIDDEN** | Modifying OpenClaw; modifying Mission Control upstream source; wiring Kiaros→MC writes before the Approval Engine exists; any Telegram↔Kiaros path; using/killing protected ports (3000/3001/5173/8000/8080) | Not available at any class |

## 4. Pre-Flight Checklist (before writing any code in a phase)

- [ ] Phase approved by owner and recorded in CURRENT_PHASE.md
- [ ] Ports involved checked against AI_SERVICE_PORT_REGISTRY.md
- [ ] For anything touching module imports in `jarvis/core`: remember **tsx
      does not resolve tsconfig path aliases** — relative imports only
- [ ] For anything touching origins/URLs: pick `localhost` OR `127.0.0.1`
      consistently within a connection pair; never assume they're equal
- [ ] For anything touching the gateway: verify the token and protocol
      version against the live gateway before debugging anything else
- [ ] For anything touching better-sqlite3 or Node versions: plan for
      `pnpm rebuild better-sqlite3`
- [ ] Package manager confirmed: **pnpm** in the MC repo root, **npm** inside
      `jarvis/*` subprojects — never mixed

## 5. Verification Checklist (before declaring a phase complete)

- [ ] **Full production build passes**, not just the dev server:
      - Desktop: `tsc && vite build` (the StatusBar break was invisible to dev-only testing)
      - Core: `tsc` (`npm run build`)
      - MC is untouched, so no MC build is run (if it were touched, that's FORBIDDEN)
- [ ] Services actually started and endpoints actually curled — "files
      exist" is not "feature works" (Phase 11 lesson)
- [ ] Every feature claim in the completion report carries IMPLEMENTED /
      PARTIAL / SPECIFIED / PLANNED
- [ ] Governance docs updated in the same phase for anything they describe
- [ ] The three standing audit assertions re-verified and stated explicitly:
      1. No OpenClaw modification
      2. No Mission Control source modification
      3. No direct Kiaros→Gateway path added
- [ ] QA proof artifact written (continue the `AUDIT/QA_PROOF_*.json`
      convention)
- [ ] CURRENT_PHASE.md updated

## 6. Regression Prevention Rules (distilled from history)

| # | Rule | Origin |
|---|------|--------|
| R1 | Never use tsconfig path aliases in code run by tsx; relative imports in `jarvis/core` | Phase 11 root cause (silent MODULE_NOT_FOUND before logging init) |
| R2 | One hostname convention per connection pair; CORS lists must cover what the browser actually sends | Phase 11 final fix (localhost ≠ 127.0.0.1 origins) |
| R3 | When a connection "mysteriously" fails, check auth token and port binding **first** | Phase 7 (token mismatch), Phase 11 (port never opened) |
| R4 | Deleting/renaming a component requires a repo-wide import search, then a full build | Live defect: `App.tsx` → missing `StatusBar` |
| R5 | Status documents are written from verification output, not intention | Phase 11 report overstated MC integration; PROJECT_RETURN_STATUS went stale same-day |
| R6 | Assume OpenClaw gateway methods can disappear between versions; code fallbacks, never hard dependencies on legacy methods | Upstream issue #645 |
| R7 | Keep failure isolation: non-fatal Core init, lazy-loaded voice components with fallbacks, voice through the text-chat path | Phase 11/12 hard-won patterns — do not "clean up" |
| R8 | New real-time consumers must not create event loops across the three planes (MC SSE / MC↔gateway WS / Kiaros WS); define event ownership first | Phase 1 audit risk #8 |
| R9 | Quote or base64 secrets containing `#` in env files | Upstream pitfall (AUTH_PASS) |
| R10 | Health checks that gate behavior need timeouts calibrated to the slowest healthy response, or they flap | Observed mission-control flapping in `jarvis/logs/core.log` |

## 7. Version Control Requirements

Current condition (Phase 1 audit): the entire `jarvis/` tree, all phase
documentation, and these governance docs are **untracked in git** — the
highest-value custom work is one filesystem event from loss, and the repo
history contains a prior "pre-wipe backup" pattern.

Rules going forward:
1. Committing this work to version control is a standing priority and should
   be its own approved step (it is an action on the repo, so it awaits owner
   approval — see CURRENT_PHASE.md "Next Phase").
2. Once tracked: every phase ends with a commit; Conventional Commits per
   repo convention; runtime artifacts (`jarvis/logs/`, `jarvis/.pids/`,
   `jarvis/core/memory/*.json`) belong in `.gitignore`, not history.
3. No force-pushes, no history rewrites, no "pre-wipe" events without an
   explicit backup verified restorable.

## 8. Emergency Procedure

If something is on fire (service down, data at risk):
1. Stop — do not "quick fix" implementation code outside a phase.
2. Capture evidence (logs, `lsof`, curl output) into an `AUDIT/` artifact.
3. Report to owner with findings and a proposed micro-phase (objective, files,
   verification plan).
4. Proceed only on approval. The Phase 11 history shows that urgent fixes
   made under assumption pressure created two wrong fixes before the root
   cause; the procedure exists to prevent the third occurrence.

---

## Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-04 | Initial version (Phase 2 deliverable) |
