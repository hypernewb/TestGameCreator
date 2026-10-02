# Packs

**Purpose**: Authored actors, locations, scenes, schedules, preferences and module tuning.

**Key Files**:
- `packs/campus.json`: Showcase; planner mode, feedback toggles, touch pacing/body maps, outreach, earned desire, jealousy and wants.
- `packs/campus-trio.json`: Regenerated trio with approved sheets, distinct voices and bounded heroine lore (T-009/028/036).
- `scripts/reskin-campus.mjs`: Source of trio generation; regenerate after source edits.
- `packs/*.json`: Other worlds and test fixtures; `after-hours` remains a fixture.

**Settings introduced in integration reports**:
- `sceneFeedback`, `socialPacing`, `relationshipStageSettings`: Feedback/pacing/stages and mechanics compatibility.
- `unwelcomeFlirt`, `lustBaseline`: Reaction tuning and earned-desire floor/easing.
- `outreachSettings`, `outreachMessages`: Send/reply budgets and authored initiative texts.
- `anniversarySettings`, `jealousySettings`, `jealousyProfiles`: Shared-history and evidence-based jealousy tuning.
- `wantSettings`: Weekly wants/reward defaults; individual want rows can override reward.
- `slipGuard.echoWords`: Echo warning threshold; absent defaults to 8, 0 disables it (T-047).

**Rules/Invariants**:
- No hand edits to regenerated trio; its tests compare reskin output.
- Optional systems preserve legacy behavior as documented by their tests.
- Campus/trio disable anniversaries after T-047; creator support remains.
- Character limits and consent are engine gates, never model awards.

**Tests**:
- `tests/campus.test.mjs`, `campus-trio.test.mjs`, `character-sheet.test.mjs`, `body-limits.test.mjs`.
- `npm run validate` checks pack schema.
