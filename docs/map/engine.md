# Engine

**Purpose**: Core game engine logic for world creation, execution, and state mutation.

**Key Files**:
- `packages/core/engine.mjs`: Contains `createWorld`, `execute`, and action-related functions.
- `packages/core/scene-plan.mjs`: Handles scene planning logic.

**Main Exported Functions**:
- `createWorld`: Initializes a new game world.
- `execute`: Runs game logic for a given turn/tick.
- `addAction`, `resolveAction` (from `engine.mjs`)

**Rules/Invariants**:
- `engine.mjs` is the only file allowed to directly mutate game state.
- Game state mutations must be deterministic.

**Tests**:
- `tests/framework.test.mjs`
