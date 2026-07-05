# Current Phase

**Project:** Kiaros / Mission Control / OpenClaw
**Last Updated:** 2026-07-04
**Authority:** This file is the single source of truth for project status
(PROJECT_CONSTITUTION.md Art. VI). If any other document or conversation
disagrees with this file, this file wins.

---

## Official Status

| Field | Value |
|---|---|
| **Current official phase** | **Phase 4 — Complete & Formalize the Voice/Conversation Phase (B12)** |
| **Phase 4 status** | ✅ COMPLETE (2026-07-04) — see PHASE4_REPORT.md / PHASE4_AUDIT.md; one owner manual check outstanding (mic/speaker loop, PHASE4_REPORT.md §6) |
| **Next phase** | Phase 5 — awaiting owner approval (proposal below) |
| **System state** | Frozen for implementation changes between phases; documentation-only work permitted (C0) |

## Phase Numbering — Two Eras

To avoid confusion, phases are recorded in two eras:

- **Build Era (B-phases):** the original Phase 1–11 milestones (Jun 26 –
  Jul 1, 2026) that installed Mission Control, discovered OpenClaw, and built
  Kiaros V1.0.
- **Governance Era (current numbering):** restarted 2026-07-04 with the
  Architecture Audit. All future references to "Phase N" without a "B" prefix
  mean this era.

## Governance Era

| Phase | Deliverable | Status |
|---|---|---|
| **1 — Architecture Audit** | Full read-only audit of repository, subsystems, phases, debt, risks, regression history | ✅ COMPLETE 2026-07-04 (delivered in-session; findings encoded into the Phase 2 docs) |
| **2 — Permanent Engineering Documentation** | PROJECT_CONSTITUTION, SYSTEM_ARCHITECTURE, COMPONENT_OWNERSHIP, VOICE_ARCHITECTURE, MISSION_CONTROL_ARCHITECTURE, OPENCLAW_INTEGRATION, STATE_MANAGEMENT, MESSAGE_ROUTING, CHANGE_CONTROL, CURRENT_PHASE | ✅ COMPLETE 2026-07-04 |
| **3 — Repository Integrity & Build Stabilization** | All work committed to git (3 commits, local only); StatusBar + require() defects fixed; FEATURES.VOICE reconciled; 23 additional pre-existing build errors fixed; both packages build clean; in-place shared emit hazard eliminated | ✅ COMPLETE 2026-07-04 |
| **4 — Complete & Formalize Voice/Conversation (B12)** | Conversation persistence via MemoryService (restart-survival proven); ServicePanel boundary violation removed (Desktop now reads all health from Core's new `/api/v1/status/services`); gateway "live" status normalization; CSS font import + compiled-mode .env path fixed; 7/7 browser E2E + screenshot evidence; B12 formally closed and documented | ✅ COMPLETE 2026-07-04 |
| **5+** | Not yet defined | ⏳ AWAITING OWNER APPROVAL |

## Build Era (historical record)

| B-Phase | Deliverable | Status |
|---|---|---|
| B1/B1A | Constitution & MC recommendation | Docs missing from repo (noted in PROJECT_RETURN_STATUS.md) |
| B2 | Mission Control installation | ✅ Jun 26 |
| B3 | Standalone validation | ✅ Jun 26 |
| B4 | OpenClaw read-only discovery | ✅ Jun 26 |
| B5 | Read-only MC↔OpenClaw connection | ✅ Jun 26 |
| B6 | Task routing via `main` agent only | ✅ Jun 26 |
| B7 | Gateway delivery validation (token mismatch found/fixed) | ✅ Jun 27 |
| B8 | Workflow rules / Approval Engine / task classification | ✅ Jun 27 — **SPECIFICATION ONLY, no code** |
| B9 | Kiaros (Jarvis) Core architecture/spec/API | ✅ Jun 28 — **SPECIFICATION ONLY, no code** |
| B10 | Port registry, launcher plan, localhost conflict policy | ✅ Jun 30 |
| B11 | Kiaros V1.0 build (Core + Desktop) + 3 fix rounds | ✅ Jul 1 — with documented overstatements (MC integration claimed but stubbed) |
| B12 (informal) | Voice + conversation engine | ✅ **CLOSED via Governance Phase 4** (2026-07-04) — verified, persisted, documented (PHASE4_REPORT.md) |

## Known Open Defects (recorded, deliberately NOT fixed — Constitution/change control)

1. ~~Desktop build broken (StatusBar import)~~ ✅ FIXED Phase 3
2. ~~`voiceStore.processTranscript()` ESM-invalid `require()`~~ ✅ FIXED Phase 3
3. ~~`FEATURES.VOICE = false` stale flag~~ ✅ FIXED Phase 3 (B11 docs still say "deferred" — historical record, left as-is)
4. Kiaros Core StateManager persistence is TODO stubs; tasks/projects remain
   in-memory display stubs. (~~Conversation history in-memory~~ ✅ FIXED
   Phase 4 — persists via MemoryService, restart-survival proven.)
5. Kiaros Core API unauthenticated (localhost-bound mitigation only).
6. Health-check flapping (5s timeout vs slow MC responses). Partially
   improved Phase 4 (gateway "live" false-negative fixed); MC's
   `/api/health` is itself slow/timing out — worth owner attention.
7. ~~Entire `jarvis/` tree + all phase/governance docs untracked in git~~
   ✅ FIXED Phase 3 (committed locally; `origin` is the upstream OSS repo —
   never push; a private remote/backup is an open owner decision)
8. ~~Desktop CSS: Google Fonts `@import` dropped from production builds~~
   ✅ FIXED Phase 4 (import moved first; warning gone). Open owner option:
   bundle fonts locally to remove the runtime Google Fonts fetch.

## Remaining Roadmap (PLANNED — all require owner approval, order undecided)

- Formalize/complete B12 voice work (fix build, close the loop, document it)
- Repository integrity: commit all untracked work to version control
- LLM-backed conversation in Kiaros Core (replace canned ResponseGenerator)
- Approval Engine implementation (prerequisite for any Kiaros→MC writes)
- Kiaros ↔ Mission Control integration (read first, then gated writes)
- Persistent Kiaros memory wired into the conversation pipeline
- Later eras (from B-roadmap): mobile, computer control, browser automation
- Explicitly out of scope forever without Constitution amendment:
  Telegram↔Kiaros bridging (Telegram is a Claw backup path only)

## Proposed Phase 5 (for owner decision — not started)

**Phase 5 — LLM-Backed Conversation (make Kiaros actually intelligent)**
Replace the canned `ResponseGenerator` with a real language model behind the
existing `ConversationManager` pipeline, preserving intent detection,
context, persistence, and the single conversation entry point.

Owner decisions required before this phase can start:
1. **Model/provider choice:** Anthropic API (best quality; sends conversation
   text to Anthropic; needs API key + budget) vs. a local model (fully
   private, weaker, needs a runtime like Ollama installed) vs. routing
   through an existing local resource. This is a C2/privacy decision the
   Constitution reserves to the owner.
2. Whether Kiaros gains read-only Mission Control context in the same phase
   (e.g. "what's in my queue?" answered from real MC data — reads only,
   still no writes without the Approval Engine).

Alternative Phase 5 candidates if preferred: Approval Engine implementation
(unlocks the MC write path later), or Core API authentication.

Also outstanding (any phase): owner mic/speaker manual check
(PHASE4_REPORT.md §6); MC `/api/health` slowness; private backup remote
decision (from Phase 3).

---

## Update Log

| Date | Update |
|---|---|
| 2026-07-04 | File created; Phase 2 declared complete; Phase 3 proposal recorded |
| 2026-07-04 | Phase 3 approved, executed, and completed; defects 1/2/3/7 closed; item 8 added; Phase 4 proposal recorded |
| 2026-07-04 | Phase 4 approved, executed, and completed; B12 formally closed; conversation persistence + boundary fix landed; Phase 5 proposal (LLM conversation) recorded with owner decisions |
