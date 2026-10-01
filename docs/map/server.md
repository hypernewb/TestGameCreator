# Server

**Purpose**: Provides the HTTP API for the game and integrates with external services.

**Key Files**:
- `server.mjs`: Main server application, defines API endpoints.
- `vendor/venus/`: Ported scene-prompt code.
- `integrations/`: Integrations with third-party services (e.g., SillyTavern).

**Main Exported Functions**:
- `createApp`: Initializes and configures the Express application.

**Rules/Invariants**:
- Handles all incoming HTTP requests.
- Only interacts with the core engine and persistence layers.

**Tests**:
- `tests/server/*.test.mjs`
