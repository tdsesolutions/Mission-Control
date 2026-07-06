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
| **Current official phase** | **Phase 5 — LLM-Backed Conversation (Model-Agnostic)** |
| **Phase 5 status** | ✅ COMPLETE (2026-07-05) — see PHASE5_REPORT.md / PHASE5_AUDIT.md. Kiaros converses via a real LLM (local Ollama today; Anthropic on owner key) |
| **Next phase** | Phase 6 — awaiting owner approval (proposal below) |
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
| **5 — LLM-Backed Conversation (Model-Agnostic)** | `LLMProvider` abstraction (Kiaros never hardcoded to a provider/model — owner mandate); AnthropicProvider (first implementation, `claude-opus-4-8` default) + OpenAICompatibleProvider (Ollama/local, currently live with granite4.1:3b); config-only switching; template fallback (never mute); persona prompt with no-execution honesty constraints; latent dotenv bug fixed; 7/7 E2E with genuine LLM reply | ✅ COMPLETE 2026-07-05 |
| **6+** | Not yet defined | ⏳ AWAITING OWNER APPROVAL |

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

- ~~Formalize/complete B12 voice work~~ ✅ Phase 4
- ~~Repository integrity: commit all untracked work~~ ✅ Phase 3
- ~~LLM-backed conversation in Kiaros Core~~ ✅ Phase 5 (model-agnostic)
- ~~Conversation memory persistence~~ ✅ Phase 4 (StateManager persistence still TODO)
- Approval Engine implementation (prerequisite for any Kiaros→MC writes)
- Kiaros ↔ Mission Control integration (read first, then gated writes)
- Core API authentication; streaming replies; Anthropic prompt caching
- Later eras (from B-roadmap): mobile, computer control, browser automation
- Explicitly out of scope forever without Constitution amendment:
  Telegram↔Kiaros bridging (Telegram is a Claw backup path only)

## Proposed Phase 6 (for owner decision — not started)

**Phase 6 — Approval Engine Implementation (unlock the path to action)**
Implement the Phase B8 specification (levels 0–4, AUTOMATIC /
APPROVAL_REQUIRED / BLOCKED states) as real code — the constitutional
prerequisite for ever letting Kiaros create Mission Control tasks. With the
conversation brain now live, this is the last gate between "Kiaros can talk"
and "Kiaros can act (safely)".

Alternative Phase 6 candidates: MC read-only context (Kiaros answers "what's
in my queue?" from real data — reads only, no Approval Engine needed), Core
API authentication, or streaming/voice-latency polish.

Owner decisions outstanding:
1. **Anthropic API key** — to put Kiaros on Claude (`claude-opus-4-8`), add
   `ANTHROPIC_API_KEY` to `jarvis/.env`; until then it runs fully local on
   Ollama granite4.1:3b.
2. Clear template-era conversation history? (mildly pollutes LLM context;
   it's your data.)
3. Carried over: mic/speaker manual check; MC `/api/health` slowness;
   private backup remote.

---

## Update Log

| Date | Update |
|---|---|
| 2026-07-04 | File created; Phase 2 declared complete; Phase 3 proposal recorded |
| 2026-07-04 | Phase 3 approved, executed, and completed; defects 1/2/3/7 closed; item 8 added; Phase 4 proposal recorded |
| 2026-07-04 | Phase 4 approved, executed, and completed; B12 formally closed; conversation persistence + boundary fix landed; Phase 5 proposal (LLM conversation) recorded with owner decisions |
| 2026-07-05 | Phase 5 approved (owner: model-agnostic mandate, Anthropic first-provider-only, MC context deferred), executed, and completed; Kiaros now LLM-backed (local Ollama live; Anthropic wired, awaiting key); Phase 6 proposal (Approval Engine) recorded |
