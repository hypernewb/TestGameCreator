# Modules

**Purpose**: Provide gameplay modules that extend the core engine functionality.

**Key Files**:
- `packages/modules/index.mjs`: Registers all available gameplay modules.
- `packages/modules/social.mjs`: Social interaction mechanics.
- `packages/modules/dating.mjs`: Dating mechanics.
- `packages/modules/romance-network.mjs`: Romance network management.
- `packages/modules/stats.mjs`: Character statistics.
- `packages/modules/progression.mjs`: Player progression systems.
- `packages/modules/scenes.mjs`: Scene management and execution.
- `packages/modules/intimacy.mjs`: Intimacy mechanics.
- `packages/modules/economy.mjs`: Economic systems.

**Main Exported Functions**:
- `registerModule`: (from `index.mjs`)
- `socialActions`, `socialTriggers`: (from `social.mjs`)
- `datingActions`, `datingTriggers`: (from `dating.mjs`)

**Rules/Invariants**:
- Modules are registered in `packages/modules/index.mjs`.
- Each module should define its own actions and triggers.

**Tests**:
- `tests/modules/*.test.mjs`
