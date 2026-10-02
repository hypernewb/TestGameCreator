# Engine

**Purpose**: Deterministic world creation, command execution and committed state changes.

**Key Files**:
- `packages/core/engine.mjs`: `createWorld`, `execute`, mechanics digest (incl. `dayRecap`), planner slots/waits, shared turn hooks and refusal recording (T-051).
- `packages/core/scene-plan.mjs`: Authoritative scene plan.
- `packages/core/character-sheet.mjs`: Character-sheet data and unwelcome-flirt tuning (T-008).

**Rules/Invariants**:
- Modules mutate state inside `execute`; changes are committed through the normal store path.
- Mixed turns settle up to three operations including the primary in one recorded command; failed parts roll back state/events and leave `core.refused` (T-035).
- Overflow gets a narration cue; replay/import reproduce the same command history.
- Campus planner has three slots; travel/activity/chat share planner accounting and arrival rechecks do not pay rewards (T-011).
- Targeted waits reach the requested daypart; plain waits spend one slot. Clock mode remains compatible (T-022).
- Mechanics tuning affects save digests; absent optional settings preserve legacy digests (T-012/023/031/032/034/051).

**Tests**:
- `tests/framework.test.mjs`, `day-planner.test.mjs`, `relationship-stages.test.mjs`, `mechanics-digest.test.mjs`.
- `tests/mixed-actions.test.mjs`, `input-lands.test.mjs`, `flirt-cap.test.mjs`, `endings-reachable.test.mjs`.
