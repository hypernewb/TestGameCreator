# AI

**Purpose**: AI-related modules for prompt building, context budgeting, memory retrieval, and model providers.

**Key Files**:
- `packages/ai/context.mjs`: Builds the prompt for AI models.
- `packages/ai/context-budget.mjs`: Handles token budgeting with LODs and size presets.
- `packages/ai/memory.mjs`: Manages and retrieves third-person memories.
- `packages/ai/providers.mjs`: Defines AI model providers (e.g., OpenAI-compatible, Mock).
- `packages/ai/service.mjs`: GameService for AI interactions.

**Main Exported Functions**:
- `buildPrompt`: (from `context.mjs`)
- `budgetContext`: (from `context-budget.mjs`)
- `retrieveMemories`: (from `memory.mjs`)
- `createOpenAIProvider`: (from `providers.mjs`)
- `GameService`: (from `service.mjs`)

**Rules/Invariants**:
- Context building should adhere to token budgets.
- Memory retrieval prioritizes relevant memories.

**Tests**:
- `tests/ai/*.test.mjs`
