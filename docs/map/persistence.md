# Persistence

**Purpose**: Manages data storage and database migrations.

**Key Files**:
- `packages/persistence/store.mjs`: Handles SQLite database interactions.
- `packages/persistence/migrations.mjs`: Manages database schema migrations.

**Main Exported Functions**:
- `createStore`: Initializes the data store.
- `runMigrations`: Executes database migrations.

**Rules/Invariants**:
- Data access should always go through `store.mjs`.
- Database schema changes require new migrations.

**Tests**:
- `tests/persistence/*.test.mjs`
