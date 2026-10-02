# Packs

**Purpose**: Authored actors, locations, scenes, schedules, preferences and module tuning.

**Key Files**:
- `packs/campus.json`: Showcase; planner mode, feedback toggles, touch pacing/body maps, outreach, earned desire, jealousy and wants, `tickMinutes: 60`, `dayRecap {max:6,keep:7}`, `routeRepair {cooldownTicks:24,trustBar:35}`.
- `packs/campus-trio.json`: Regenerated trio with approved sheets, distinct voices and bounded heroine lore (T-009/028/036); regenerate after any campus edit.
- `scripts/reskin-campus.mjs`: Source of trio generation; regenerate after source edits.
- `packs/*.json`: Other worlds. `after-hours` is retired and on a delete list (T-058); its tests use `tests/fixtures/route-mechanics.json` and `role-template.json` instead.

**Settings introduced in integration reports**:
- `sceneFeedback`, `socialPacing`, `relationshipStageSettings`: Feedback/pacing/stages and mechanics compatibility.
- `unwelcomeFlirt`, `lustBaseline`: Reaction tuning and earned-desire floor/easing.
- `outreachSettings`, `outreachMessages`: Send/reply budgets and authored initiative texts.
- `anniversarySettings`, `jealousySettings`, `jealousyProfiles`: Shared-history and evidence-based jealousy tuning.
- `wantSettings`: Weekly wants/reward defaults; individual want rows can override reward.
- `dayRecap {max,keep}`: Lines per day and days kept in the journal; absent uses the module defaults (T-051).
- `routeRepair {cooldownTicks,trustBar}`: Opt-in repair of rejection/dealbreakers/blocked states; absent keeps legacy behavior (T-053).
- `suspicionSettings`, `initialSecrets`, `suspicionProfiles`, `suspicionRules`, `reputation`, `datingProfiles[].agreements`: Secrecy and agreements; all optional, authored in Studio (T-055).
- `tickMinutes`: Minutes per tick for option cost labels; absent keeps legacy labels (T-063).
- `slipGuard.echoWords`: Echo warning threshold; absent defaults to 8, 0 disables it (T-047).

**Rules/Invariants**:
- No hand edits to regenerated trio; its tests compare reskin output.
- Optional systems preserve legacy behavior as documented by their tests.
- Campus/trio disable anniversaries after T-047; creator support remains.
- Campus endings require the engine-set `run-over` flag, not the pack-only `term-over` (T-054).
- Character limits and consent are engine gates, never model awards.

**Tests**:
- `tests/campus.test.mjs`, `campus-trio.test.mjs`, `character-sheet.test.mjs`, `body-limits.test.mjs`, `studio-secrecy.test.mjs`, `studio-tick-minutes.test.mjs`.
- `npm run validate` checks pack schema.
