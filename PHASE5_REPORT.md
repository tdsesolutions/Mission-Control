# Phase 5 Report — LLM-Backed Conversation (Model-Agnostic)

**Era:** Governance
**Phase:** 5
**Date:** 2026-07-05
**Status:** ✅ COMPLETE
**Authority:** Owner approval 2026-07-05 with three decisions:
(1) scope = LLM-backed conversation; (2) **Kiaros must never be hardcoded to
any single model or provider** — Anthropic is the first provider
implementation only; (3) Mission Control read-only context deferred.
**Change class:** C2 (new outbound external connection capability; no new ports)

---

## 1. What Was Implemented

### The provider abstraction (`jarvis/core/src/services/llm/`)

| File | Role |
|---|---|
| `types.ts` | `LLMProvider` interface + `ChatMessage`/`LLMRequest`/`LLMReply`. The only contract Kiaros knows. |
| `AnthropicProvider.ts` | First provider implementation (official `@anthropic-ai/sdk`; default model `claude-opus-4-8`; no sampling params — removed on current Claude models; refusal-safe empty-text handling). All Anthropic-specific code confined here. |
| `OpenAICompatibleProvider.ts` | Second implementation: standard `/v1/chat/completions` — covers Ollama, LM Studio, llama.cpp, vLLM, OpenAI, and most hosted providers. The fully-local path. |
| `index.ts` | Registry. Selection by `KIAROS_LLM_PROVIDER` env (`anthropic` \| `openai-compatible` \| `none` \| `auto`). **Adding a future provider (local, OpenAI, OpenClaw, Hermes, …) = one module + one registry entry; zero Kiaros changes.** |

### Pipeline integration
- `ConversationManager.processMessage` is now async: intent → mode → context
  (all retained) → **LLM provider** → on failure/unconfigured → **template
  fallback** (Kiaros never goes mute; the LLM is an enhancement, not a
  dependency).
- Kiaros persona system prompt: chief-of-staff voice; hard honesty
  constraints (cannot execute, never claims actions — Constitution Art. V
  encoded in the prompt); TTS-friendly brevity (1–3 sentences by default).
  Static persona first (cache-friendly), dynamic context hints appended.
- Persisted conversation history (last 20 turns) flows to the provider —
  multi-turn recall verified.
- Response metadata now carries `responseSource` (`llm`/`template`),
  `provider`, and `model` for observability.

### Configuration (`jarvis/.env`, documented in `.env.example`)
- `KIAROS_LLM_PROVIDER`, `KIAROS_LLM_MODEL`, `KIAROS_LLM_MAX_TOKENS`,
  `KIAROS_LLM_TIMEOUT_MS`, `ANTHROPIC_API_KEY`, `OPENAI_COMPAT_BASE_URL/_API_KEY/_MODEL`.
- **Runtime config on this machine:** local Ollama (`granite4.1:3b`) via the
  openai-compatible provider — fully on-machine, no conversation data leaves
  the computer. Switching to Anthropic = set `ANTHROPIC_API_KEY` + change one
  env var. No code changes.

### Fixes landed with the phase
- **Latent env-loading bug:** ES module imports hoist, so `config/index.ts`
  read `process.env` before `index.ts` ran `dotenv.config()` — `.env` values
  were silently ignored since B11. The dotenv load now lives at the top of
  the config module itself.
- Desktop chat timeout 10s → 60s (LLM latency); Core enforces its own
  provider timeout and falls back.
- E2E script: reply check now waits past the "Processing…" indicator (was
  tuned for instant template replies); screenshot path parameterized so phase
  evidence files can't be clobbered (Phase 4's screenshot was restored from
  git after an accidental overwrite).

## 2. What Was Verified

| Check | Result |
|---|---|
| Core build (`tsc`, clean dist) + Desktop build (`tsc && vite build`) | ✅ 0 errors |
| **Live LLM conversation** (local Ollama granite4.1:3b) | ✅ In-character, honest-about-limits, TTS-length reply; metadata `source=llm, provider=openai-compatible` |
| Multi-turn context | ✅ "What was the first thing I said?" answered correctly from history |
| Fallback A: `KIAROS_LLM_PROVIDER=none` | ✅ template reply, no provider |
| Fallback B: provider configured but unreachable | ✅ clean warn + template reply |
| **Anthropic provider to the wire** (invalid test key) | ✅ selects `claude-opus-4-8`, request reaches Anthropic (401 + request_id proves well-formed call), clean fallback. Live replies await the owner's key — the only untested inch |
| Provider switching is config-only | ✅ same binary served template/ollama/anthropic paths purely via env in tests |
| Browser E2E (`verify-desktop-e2e.mjs`) | ✅ 7/7, zero console errors; UI-typed message received a genuine LLM reply; screenshot `AUDIT/PHASE5_desktop_e2e.png` |
| Conversation persistence (Phase 4 regression check) | ✅ 26+ messages hydrate into UI across restarts |
| No forbidden paths | ✅ conversation still terminates in Core; no MC/gateway/task calls added |

## 3. Acceptance Criteria → Evidence

| Owner requirement | Evidence |
|---|---|
| Replace rule-based engine with production conversation architecture | LLM-first pipeline live; templates demoted to fallback |
| Model-provider abstraction; Kiaros model-agnostic | `LLMProvider` interface; zero provider imports outside `services/llm/`; grep-verifiable |
| Anthropic = first provider implementation, not permanent architecture | `AnthropicProvider` is one module behind the interface; system currently runs a *different* provider (local) with no code differences |
| Future providers without changing Kiaros | Proven concretely: two providers already run through the identical pipeline; registry is the single extension point |
| MC integration / Approval Engine deferred | Untouched; persona prompt explicitly enforces the no-execution boundary |
| Constitution & boundaries | Delegation chain untouched; no MC/OpenClaw modification; no new ports (outbound only); voice audio never leaves the machine |

## 4. Known Limitations (recorded, not fixed)

1. **Local model quality ceiling:** granite4.1:3b is a 3B-parameter model —
   serviceable, but it occasionally mimics old template phrasings from
   persisted history and reasons shallowly. The architecture is verified; the
   *experience* scales with the model you configure.
2. Old template-era exchanges remain in persisted history and mildly pollute
   LLM context (clearing history is an owner call — it's your data).
3. No streaming responses yet (replies arrive whole; acceptable at current
   lengths, worth revisiting for long answers/voice barge-in).
4. Prompt caching not yet enabled on the Anthropic provider (worthwhile once
   a real key is in use).

## 5. Owner Actions Available

- **To put Kiaros on Claude:** add `ANTHROPIC_API_KEY=<your key>` to
  `jarvis/.env` and set `KIAROS_LLM_PROVIDER=anthropic` (or `auto`), then
  restart Core. Default model `claude-opus-4-8`; override with
  `KIAROS_LLM_MODEL`. Note: conversation text (never audio) then goes to the
  Anthropic API.
- **To stay fully local:** do nothing — Kiaros is running on your Ollama
  granite model now.
- Voice loop with real intelligence: speak to it at http://localhost:3011.
