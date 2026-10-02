# Tests

**Purpose**: Deterministic unit/integration coverage for engine, modules, AI service and UI.

**Key Files**:
- `tests/framework.test.mjs`: Core framework.
- `tests/touch-ladder.test.mjs`, `body-limits.test.mjs`, `unwelcome-flirt.test.mjs`, `flirt-cap.test.mjs`: Touch gates and pacing.
- `tests/scene-feedback.test.mjs`, `day-planner.test.mjs`, `relationship-stages.test.mjs`, `mechanics-digest.test.mjs`: Feedback, planner/stages and save compatibility.
- `tests/outreach.test.mjs`, `lust-baseline.test.mjs`, `anniversary.test.mjs`, `jealousy.test.mjs`, `wants.test.mjs`: Character initiative and progression.
- `tests/voice.test.mjs`, `dialogue-voice.test.mjs`, `lore-window.test.mjs`, `prompt-slips.test.mjs`, `prompt-slips-2.test.mjs`: Voice/lore and prompt guards (one slips-2 test is `skip`ped pending the owner's `scenePrompt.mjs` work).
- `tests/mixed-actions.test.mjs`, `input-lands.test.mjs`: Atomic mixed commands, replay/import and refusal/input coverage.
- `tests/ui-messages.test.mjs`, `ui-messages-2.test.mjs`: Thread order, unread/read behavior, replies, invite controls, newest-50 and "Show older".
- `tests/day-recap.test.mjs`, `routes-never-close.test.mjs`, `endings-reachable.test.mjs`: Day recap card/window, route repair and every ending reachable by the run deadline.
- `tests/studio-secrecy.test.mjs`, `studio-tick-minutes.test.mjs`: Creator secrecy/agreement forms and minutes-per-tick round trip.
- `tests/fun-model-usage.test.mjs`: Per-UTC-hour model usage in the fun report.
- `tests/campus.test.mjs`, `campus-trio.test.mjs`, `character-sheet.test.mjs`, `ui-campus.test.mjs`: Showcase and generated content.
- `tests/owner-picks-1002.test.mjs`: Later owner choices that supersede integration defaults (T-047).

**Rules/Invariants**:
- New behavior needs tests; never weaken existing assertions to pass.
- Use in-memory or temporary databases; replay never calls a model.
- Iterate with `node --test tests/<file>.test.mjs`; run `npm.cmd test` once at the end on Windows.
- Reports distinguish known missing-art failures from new regressions; a human fun gate is separate from automated checks.
