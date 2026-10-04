# Agent reference (read on demand, not loaded every session)

## Layout
- `packages/core/` — `engine.mjs` (createWorld/execute/actions, the only state mutator), `scene-plan.mjs`
- `packages/modules/` — gameplay modules registered in `index.mjs` (social, dating, romance-network, stats, progression, scenes, intimacy, economy, …)
- `packages/ai/` — prompt building and the model side:
  - `context.mjs` builds the prompt; `context-budget.mjs`/`budget.mjs` do token budgeting with LODs (full/compact/name/digest) and size presets (minimal/default/max)
  - `memory.mjs`/`retrieval.mjs` recall third-person memories (RELEVANT MEMORY block goes after PLAYER ACTION)
  - `providers.mjs` (OpenAI-compatible + Mock, calibration), `service.mjs` (GameService)
- `packages/persistence/` — `store.mjs` (SQLite), `migrations.mjs`
- `packages/contracts/index.d.ts` — shared types
- `packs/*.json` — content packs; `living-world.json` is the sample
- `public/` — browser UI (app, vn, studio, calendar, memory)
- `server.mjs` — `createApp({dataPath,provider})` HTTP API; `vendor/venus/` — ported scene-prompt code; `integrations/` — SillyTavern

## Docs
- Current: `docs/GAME-DESIGN.md` (confirmed creator requirements), `docs/NEXT-MILESTONES.md` ([current direction/holds](NEXT-MILESTONES.md#current-direction-owner-clarification-2026-10-04) and dependency gates supersede campus-first order; shipped history in `docs/COMPLETED-MILESTONES.md`), `docs/briefs/BOARD.md` ([active guidance](briefs/BOARD.md#current-priority-2026-10-04)), `docs/research/creator-gap-assessment-2026-10-04.md` (T-098: 26-capability engine/control/workflow matrix, local Venus provenance, rationale, unknowns and four proposals; assessment done, implementation not authorized), `docs/research/venus-university/design-patterns.md` (historical observed scene recommendations), `docs/CONTEXT-BUDGET.md`, `docs/AUTHORING.md`, `docs/SOCIAL-DATING.md`, `docs/ROMANCE-NETWORK.md`, `docs/SOCIAL-INTIMACY.md`, `docs/MILESTONES.md`
- Creator goal: functional social/romance authoring including player screens, all core controls visual; template default/blank and editable 1–8 NPC/place startup. Memory capture/inspect/correct and authored knowledge/promises required. Game UI/editor chrome redesign paused; weekly Stage2 frozen/unaccepted. Adventure, installer, full migration and date-picker scheduling deferred. Keep accepted main, dirty work, candidate reports and observed play evidence distinct.
- `docs/DESIGN.md` is large (65 KB). Grep it for the section you need.
- Historical, only if asked: `docs/FUN-PASS.md` (superseded F1–F12 rationale), `docs/VENUS-*`, `docs/SCENE-LOGIC-1.15/1.16`, `docs/SCENE-LIFECYCLE-1.17`, `docs/SILLYTAVERN.md`

## Large files: grep or read with offset/limit, never whole
`tests/framework.test.mjs` (~100 KB), `public/studio.mjs` (~75 KB), `docs/DESIGN.md` (65 KB), `docs/VENUS-SOURCE-INVENTORY.csv` (48 KB)
