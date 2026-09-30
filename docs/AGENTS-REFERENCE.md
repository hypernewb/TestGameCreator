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
- Current: `docs/GAME-DESIGN.md` (product design, read first), `docs/NEXT-MILESTONES.md` (roadmap; M5, then the Open-play tier (O1 first); shipped work is in `docs/COMPLETED-MILESTONES.md`), `docs/research/venus-university/design-patterns.md` (free-typing scene rules), `docs/CONTEXT-BUDGET.md`, `docs/AUTHORING.md`, `docs/SOCIAL-DATING.md`, `docs/ROMANCE-NETWORK.md`, `docs/SOCIAL-INTIMACY.md`, `docs/MILESTONES.md`
- `docs/DESIGN.md` is large (65 KB). Grep it for the section you need.
- Historical, only if asked: `docs/FUN-PASS.md` (superseded F1–F12 rationale), `docs/VENUS-*`, `docs/SCENE-LOGIC-1.15/1.16`, `docs/SCENE-LIFECYCLE-1.17`, `docs/SILLYTAVERN.md`

## Large files: grep or read with offset/limit, never whole
`tests/framework.test.mjs` (~100 KB), `public/studio.mjs` (~75 KB), `docs/DESIGN.md` (65 KB), `docs/VENUS-SOURCE-INVENTORY.csv` (48 KB)
