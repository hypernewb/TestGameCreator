# Tests

**Purpose**: Contains unit and integration tests for the project's codebase.

**Key Files**:
- `tests/framework.test.mjs`: Core framework tests.
- `tests/framework.test.mjs`: core engine/framework tests.
- `tests/modules/*.test.mjs`: Tests for individual gameplay modules.
- `tests/ai/*.test.mjs`: Tests for AI-related functionalities.
- `tests/persistence/*.test.mjs`: Tests for data persistence.
- `tests/server/*.test.mjs`: Tests for the HTTP API server.
- `tests/campus.test.mjs`: campus pack tests (schema: `npm run validate`).

**Main Exported Functions**:
- N/A (Test files primarily contain assertions and test cases, not exported functions).

**Rules/Invariants**:
- Every new feature or bug fix should be accompanied by relevant tests.
- Tests should be isolated and deterministic.
- `npm test` should run all tests successfully.

**Tests**:
- All files in `tests/`
