# Phase 5 Audit — LLM-Backed Conversation (Model-Agnostic)

**Era:** Governance
**Phase:** 5
**Audit Date:** 2026-07-05
**Auditor:** Claude (lead software architect session), per CHANGE_CONTROL.md §5
**Result:** ✅ APPROVED

---

## Standing Assertions (CHANGE_CONTROL.md §5)

| # | Assertion | Evidence | Result |
|---|-----------|----------|--------|
| 1 | No OpenClaw modification | Nothing under `~/.openclaw`/gateway touched; MonitorService health probe unchanged | ✅ PASS |
| 2 | No Mission Control source modification | All diffs under `jarvis/` + governance/phase docs | ✅ PASS |
| 3 | No direct Kiaros→Gateway path added | New outbound connections are LLM-provider only (Anthropic API / localhost Ollama); conversation path still terminates in Core | ✅ PASS |

## Owner-Decision Compliance

| Decision (2026-07-05) | Compliance |
|---|---|
| Kiaros NEVER hardcoded to a single model/provider | ✅ `grep -r "anthropic\|claude\|ollama\|granite" src/ --exclude-dir=llm` over conversation/route/config code shows provider names only in `services/llm/` modules and env plumbing. Selection = configuration. Verified by running the identical build against three configurations (none / local / anthropic) |
| Anthropic = first provider implementation only | ✅ One module behind the shared interface; the live system currently runs a different (local) provider |
| Future providers without changing Kiaros | ✅ Two independent implementations already flow through the identical pipeline; registry (`services/llm/index.ts`) is the sole extension point |
| MC integration deferred | ✅ No MC calls added; MissionControlClient untouched |
| Approval Engine deferred | ✅ Unbuilt; persona prompt enforces the no-execution boundary at the model level as defense-in-depth |

## C2 Requirements (new external connection)

- SYSTEM_ARCHITECTURE.md, MESSAGE_ROUTING.md, COMPONENT_OWNERSHIP.md,
  VOICE_ARCHITECTURE.md updated in-phase ✅
- Port registry: **no new listening ports** (outbound-only connections);
  registry unchanged by design ✅
- Privacy documented: `anthropic` = conversation text egresses;
  `openai-compatible`@localhost = fully local (current state); audio never
  egresses ✅

## Verification Evidence

```
Builds:      core tsc 0 errors (clean dist, emit layout intact)
             desktop tsc + vite 0 errors
Live LLM:    POST /api/v1/conversation/message →
             source=llm provider=openai-compatible model=granite4.1:3b
             persona reply, honest about no-execution, TTS-length
Context:     multi-turn recall of earlier message verified
Fallbacks:   provider=none → template
             provider unreachable (127.0.0.1:9) → warn + template
             anthropic w/ invalid key → 401 from api.anthropic.com
             (request_id captured) → template  [proves wire-correct call]
E2E:         verify-desktop-e2e.mjs 7/7, console clean; genuine LLM reply
             rendered through the real UI path
Evidence:    AUDIT/PHASE5_desktop_e2e.png
             (Phase 4 screenshot restored from git after accidental
             overwrite; script now parameterized — process improvement)
Regression:  Phase 4 persistence intact (history hydrates across restarts)
```

## Notable Engineering Findings (logged for the record)

1. **Latent config bug fixed:** `.env` values never reached the config module
   (ESM import hoisting vs `dotenv.config()` in index.ts) — present since
   B11; every prior run used defaults only. Fixed by loading dotenv inside
   `config/index.ts`. Candidate regression rule: *module-level `process.env`
   reads require the env file loaded in that module or earlier in the import
   graph.*
2. `@anthropic-ai/sdk` added to jarvis/core (npm). Anthropic API usage
   follows the current API reference (no sampling params; refusal-aware
   response handling; SDK timeout in ms).
3. Live local inference via the machine's existing Ollama runtime — chosen
   for verification because no Anthropic key exists on this machine; also
   the maximal-privacy default until the owner opts into cloud.

## Runtime Disclosure

- tsx watch auto-restarted the running Core on source changes (owner's dev
  mode); no services were manually stopped or started this phase.
- In-process fallback tests ran as one-off tsx scripts, not against the live
  service.

## Scope Compliance

In scope and delivered: provider abstraction, two providers, pipeline
integration, config, fallbacks, verification, docs. Explicitly NOT done
(deferred per owner): MC read-only context, Approval Engine, streaming,
prompt caching, history cleanup.

---

**Audit sign-off:** ✅ Phase 5 APPROVED.
QA proof: `AUDIT/QA_PROOF_GOV_PHASE5.json`.
