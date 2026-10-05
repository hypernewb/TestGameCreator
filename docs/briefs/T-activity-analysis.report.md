# T-activity-analysis report — Activity balance comparison (first slice)

Status: implemented, uncommitted. Browser-verified on an isolated temp-dir server.

## What shipped
- `packages/testing/activity-analysis.mjs` — `validateComparison`, `snapshot`, `changesBetween`, `unavailableReasons`, `simulateSequence`, `compareSequences`. Reuses the T-103 `fixtureWorld`/`validateScenario`, then runs each step through `execute` exactly as play does (offered `core.scene` args when listed, `core.wait` for wait steps, `core.endScene {reason:'player'}` when an activity opens a conversation). Unavailable steps are reported with the engine's own error plus plain-language reasons (daily limit, money, once, route, closed, flag, item, character absent, trust, rank) and skipped; later steps continue.
- `POST /api/studio/activity-compare` in `server.mjs` — validates the pack and comparison, returns the report. No store, AI provider or file access.
- `public/studio-activity-analysis.mjs` + Studio section "Activity balance": starting fixture (location, tick, seed, money, stats, variables, or copy from a saved test scenario), two sequence lists of existing activities/wait steps, per-step changes, and a final side-by-side table.

## Acceptance
- Matches ordinary execution: test replays the recorded commands through `execute` and gets a deep-equal world.
- No side effects: test checks pack/request objects unchanged, zero campaigns created and no files written in the scenario dir.
- Invalid requests: unknown activity/location, bad wait period, non-integer money, money without economy → 400 with a named step.
- Reproducible: two runs deep-equal; same seed and fixture for both sequences; seed reported.

## Not in scope
No balance suggestions, AI advice, new economy mechanics or scenario authoring. Max 2 sequences × 40 steps.
