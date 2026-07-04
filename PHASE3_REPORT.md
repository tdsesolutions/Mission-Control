# Phase 3 Report — Repository Integrity & Build Stabilization

**Era:** Governance
**Phase:** 3
**Date:** 2026-07-04
**Status:** ✅ COMPLETE
**Authority:** Approved by owner 2026-07-04 ("Proceed with the next implementation phase")
**Scope source:** CURRENT_PHASE.md "Proposed Phase 3" (as approved)

---

## Objective

Put all untracked work under version control and make both Kiaros packages
build cleanly, per CHANGE_CONTROL.md. No behavior changes beyond what the
recorded defects required. No Mission Control source changes, no OpenClaw
contact, no services started or restarted.

## 1. Version Control (IMPLEMENTED)

Three commits on `main` (local only — the `origin` remote is the upstream
open-source repository; **nothing was pushed**):

| Commit | Content |
|---|---|
| `7f1a974` feat(jarvis) | Kiaros system (core, desktop, shared, scripts, QA proofs) — 71 files, ~17k lines |
| `96a9b3e` docs | Build-era phase documentation and audit trail (B2–B11), AUDIT/, SANDBOX/, gateway test script |
| `2505a02` docs | Ten governance documents (Phase 2 deliverable) |

`jarvis/.gitignore` added: excludes runtime artifacts (`logs/`, `.pids/`,
`core/logs/`, `core/memory/`), local `.env`, and any compiled output next to
shared sources; re-includes the npm lockfiles that the pnpm-oriented root
`.gitignore` excludes. Verified: no secrets, logs, PIDs, memory files,
`node_modules`, or `dist` staged in any commit; both `package-lock.json`
files committed.

The upstream root `.gitignore` was **not** modified.

## 2. Defect Fixes (IMPLEMENTED)

### The two recorded defects + stale flag (from CURRENT_PHASE.md)

1. **StatusBar import** — removed the stale
   `import { StatusBar } from './components/StatusBar'` from
   `jarvis/desktop/src/App.tsx` (component was deleted 2026-07-02; the import
   broke `tsc && vite build`).
2. **ESM-invalid `require()`** — `voiceStore.processTranscript()` now uses a
   static `import { useJarvisStore } from './jarvisStore'` (no circular
   dependency: jarvisStore does not import voiceStore).
3. **`FEATURES.VOICE`** — flipped to `true` with an accurate comment.
   Verified declarative-only: no code reads this flag (Core's runtime flags
   come from `FEATURE_*` env vars).

### Additional build blockers surfaced by the first-ever full builds

The Desktop and Core production builds had **never both been run**; running
them surfaced 15 Desktop and 8 Core pre-existing errors. All fixed with
minimal, behavior-preserving diffs:

**Desktop (`tsc && vite build`):**
- Unused imports removed: `Zap` (JarvisHUD), `Volume2/VolumeX/Mic`
  (VoiceSettings), default `React` (useJarvis).
- Write-only dead fields removed: `restartAttempts`/`maxRestartAttempts`
  (SpeechRecognitionService), `currentTranscript` (VoiceManager); unused
  `isFinal` parameter (voiceStore).
- `ServicePanel` status literal widening fixed with `as const`.
- **New file** `src/types/web-speech.d.ts`: ambient declarations for
  `SpeechRecognition` / `SpeechRecognitionEvent` /
  `SpeechRecognitionErrorEvent` (absent from the TypeScript DOM lib).

**Core (`tsc`):**
- `tsconfig.json`: `rootDir` was `./src`, which broke compilation of the
  imported `../shared` sources (TS6059) **and had caused compiled JS to be
  emitted in place next to `shared/*.ts`** — a runtime hazard because stale
  `.js` can shadow `.ts` under tsx. Changed `rootDir` to `..`, added
  `../shared/**/*` to `include`; output now lands entirely under `dist/`
  (`dist/core/src/`, `dist/shared/`). In-place artifacts deleted; ignore
  rules added so they can never be committed.
- `package.json` `main`/`start` updated to the corrected emit path
  (`dist/core/src/index.js`).
- `SystemEventType` union extended with the three event names the code
  actually emits (`service:healthy`, `service:unhealthy`, `mode:changed`) —
  type-only change; wire format unchanged.
- Health-check `response.json()` typed (`{ status?: string }`).

## 3. Verification (per CHANGE_CONTROL.md §5)

| Check | Result |
|---|---|
| Desktop `npm run build` (`tsc && vite build`) | ✅ Clean; production bundle emitted; voice components correctly code-split into lazy chunks |
| Core `npm run build` (`tsc`) from clean `dist/` | ✅ Clean; emit layout verified (`dist/core/src/index.js`, `dist/shared/...`); **no in-place emit** next to shared sources |
| No Mission Control source modification | ✅ `git status` showed zero modified tracked files before staging |
| No OpenClaw modification | ✅ Nothing under `~/.openclaw` or the gateway touched |
| No direct Kiaros→Gateway path added | ✅ No networking code changed |
| No services started/restarted | ✅ Builds only; no process management |
| No secrets committed | ✅ Staged-file audit before each commit |
| Runtime behavior preserved | ✅ All fixes are import/type/dead-code/build-config level; the dev runtime path (`tsx watch src/index.ts`) is unchanged |

## 4. Known Items Recorded, Deliberately Not Fixed (out of scope)

1. **CSS warning** in Desktop build: Google Fonts `@import` appears after
   other statements in `styles/index.css`, so Vite ignores it in the
   production bundle (fonts fall back). Cosmetic; also an external-fetch
   question worth an owner decision. Dev mode unaffected.
2. Everything else on the CURRENT_PHASE.md defect list that was not in Phase
   3 scope: Core persistence TODOs, in-memory conversation/task stores,
   unauthenticated Core API, health-check flapping, canned (non-LLM)
   responses, Jarvis/Kiaros naming drift.

## 5. Constraints Compliance

| Constitution rule | Status |
|---|---|
| Art. II delegation chain untouched | ✅ |
| Art. III OpenClaw / MC source untouched | ✅ |
| Art. IV status labels used throughout | ✅ |
| Art. V no Kiaros→MC write path added | ✅ |
| CHANGE_CONTROL class | C1 (Kiaros-internal) + version-control work; no C2/C3 items |

---

**Phase 3 sign-off:** deliverables complete, builds verified, history
committed locally. See PHASE3_AUDIT.md and AUDIT/QA_PROOF_GOV_PHASE3.json.
