# Contracts

**Purpose**: Defines shared TypeScript type definitions for the project.

**Key Files**:
- `packages/contracts/index.d.ts`: Main declarations file for shared types.

**Main Exported Definitions**:
- `EngineState`, `Pack`, `Actor`, `Location`, etc.

**Rules/Invariants**:
- All shared data structures between modules should have their types defined here.
- Type definitions must be kept up-to-date with changes in data structures.

**Tests**:
- N/A (Type definitions, tested by type checking during development).
