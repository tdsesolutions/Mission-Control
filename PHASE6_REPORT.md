# Phase 6 Report — Approval Engine Implementation

**Era:** Governance
**Phase:** 6
**Date:** 2026-07-05
**Status:** ✅ COMPLETE
**Authority:** Owner approval 2026-07-05 with decisions: (1) scope = Approval
Engine; (2) no Anthropic dependency anywhere; (3) archive template-era
history first; (4) other deferred items stay deferred.
**Change class:** C1 (Kiaros-internal) + Constitution amendment v1.1
(owner-authorized by the phase approval itself)

---

## 1. What Was Implemented

### Task 0 — History archive (owner decision 3)
54 template-era entries backed up to
`jarvis/core/memory/archive/jarvis-memory-pre-phase6-20260705-203624.json`
(gitignored runtime data, preserved on disk), then `conversation.history`
cleared via graceful Core stop → file edit → restart. Verified: 0 entries
after restart; backup intact. Kiaros's LLM context is no longer polluted by
canned-era exchanges.

### The Approval Engine (`jarvis/core/src/services/approval/`)

| File | Role |
|---|---|
| `types.ts` | Owner's four states (`approved` / `requires_owner_approval` / `requires_clarification` / `rejected`), B8 levels 0–4 as metadata, decision/audit shapes |
| `rules.ts` | ALL safety behavior in one reviewable file: dangerous patterns (B8 auto-block), sandbox-escape signals, protected/sandbox path prefixes, operation vocabulary → level table, write-class set |
| `ApprovalEngine.ts` | The classifier. **Deterministic** — no LLM, no provider, no network (owner decision 2 + sound safety design: same request, same answer, works with everything else down). Side effects limited to JSONL audit append + event-bus notification |
| `ApprovalEngine.test.ts` | 40-case vitest suite from the B8 classification matrix + invariant tests (determinism, safe defaults, audit) — **the first tests in the Kiaros codebase** |

Decision logic (B8 spec under the owner's taxonomy):
1. Vague/short intent → `requires_clarification` (safe default — never approve the unrecognized)
2. Dangerous pattern → `rejected` (wins over everything)
3. Sandbox-escape signal (traversal, system credential files) → `rejected`
4. Operation recognition (vocabulary + explicit list); unknown explicit ops → `requires_clarification`
5. Level = MAX of matched operations (B8)
6. Path validation: write-class op on protected path (e.g. `~/.openclaw`) → `rejected` (Constitution Art. III violation, not approvable); read on protected path → escalate to level 3; creation outside sandbox → level 2
7. Levels 0–1 → `approved`; 2–3 → `requires_owner_approval`; 4 → `rejected`

### Surfaces
- **API:** `POST /api/v1/approval/classify` (pure decision),
  `GET /api/v1/approval/audit` (read-only trail). Registered in Core.
- **Audit trail:** `core/logs/approval-audit.jsonl` — every decision with
  matched rules; plus `approval_granted/required/denied` events on the bus.
- **Conversation integration (information only):** command-intent messages
  are classified; the decision rides in response metadata and as a context
  hint, so Kiaros tells the truth about what would need approval. Nothing
  in the pipeline executes.

### Tooling fixes en route
- vitest 1.1.0 hung on Node 25 (never collected tests) → upgraded to
  vitest 4 (devDependency only).
- Added `jarvis/core/vitest.config.ts` — without it, vitest walked up and
  loaded Mission Control's root config (wrong plugins/pool).
- The new test suite immediately caught two rule bugs before they shipped:
  a `\b\.env\b` regex that could never match, and the bare noun "settings"
  wrongly marking protected-path *reads* as write-class (→ false
  rejections). Both fixed; suite green.

## 2. What Was Verified

| Check | Result |
|---|---|
| Test suite | ✅ 40/40 (classification matrix + determinism + safe-default + audit invariants) |
| Core + Desktop builds | ✅ 0 errors |
| Live API — all four states | ✅ status→approved L0; modify+commit→requires_owner_approval L2; deploy→requires_owner_approval L3; delete repo→rejected L4; "do it"→requires_clarification; traversal targetPath→rejected |
| Audit trail | ✅ JSONL entries with states + truncated intents via `GET /audit` |
| Conversation integration | ✅ "Create a task to deploy…" → metadata `approval: requires_owner_approval L3`; Kiaros (local LLM) honestly declined execution and offered planning |
| History archive | ✅ backup file present (54 entries); live history 0 after restart |
| E2E regression | ✅ 7/7 (`AUDIT/PHASE6_desktop_e2e.png`) |
| No-Anthropic-dependency | ✅ engine has zero provider imports; entire verification ran on local Ollama + deterministic rules; Kiaros fully functional without Anthropic |

## 3. Acceptance Criteria → Evidence

| Owner requirement | Evidence |
|---|---|
| Decision authority only — never executes | Engine's only side effects: audit append + event emit (code-verifiable); API is classify/read-audit only |
| Never modifies Mission Control | Zero MC calls in `services/approval/`; `git status` clean of MC source |
| Never invokes OpenClaw | Zero gateway references; protected-path rules treat `~/.openclaw` as untouchable |
| Exactly the four owner states | `ApprovalState` type + all four exercised live and in tests |
| Execution remains outside | No execution path exists; Constitution v1.1 makes bypassing the engine a FORBIDDEN change |
| No Anthropic assumptions/dependencies (decision 2) | Deterministic core, no LLM in the decision path; conversation LLM remains provider-agnostic and optional |
| History archived safely (decision 3) | Timestamped backup in `memory/archive/`, then cleared |

## 4. Remaining Work

- **Wiring** (future phases, owner-gated): an execution path that (a) asks
  the engine, (b) surfaces `requires_owner_approval` decisions to you for
  explicit approval (UI/voice), (c) only then creates MC tasks. The engine
  is the gate; the road through it doesn't exist yet — by design.
- Rule vocabulary will grow with real usage; `rules.ts` + the test suite is
  the change surface.
- Owner-approval *workflow* (queue of pending decisions awaiting your
  yes/no) is not built — currently every `requires_owner_approval` simply
  stops at the decision.
- Deferred per decision 4: mic/speaker test, backup remote, MC health.

## 5. Owner Decisions Before Phase 7

Proposed Phase 7: **Mission Control read-only context** — Kiaros answers
"what's in my queue / what are the agents doing?" from real MC data (reads
only; no Approval Engine consultation needed because nothing is written).
Alternatives: owner-approval workflow UI (make `requires_owner_approval`
actionable), Core API authentication, or streaming/voice polish.
