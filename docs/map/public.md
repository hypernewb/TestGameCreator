# Public

**Purpose**: Contains the browser-based user interface components and client-side logic.

**Key Files**:
- `public/app.mjs`: Main application entry point for the UI.
- `public/vn.mjs`: Visual novel specific UI components.
- `public/studio.mjs`: UI for the content authoring studio.
- `public/calendar.mjs`: Calendar UI component.
- `public/memory.mjs`: Memory-related UI components.

**Main Exported Functions**:
- `initializeUI`: (from `app.mjs`)
- `renderScene`: (from `vn.mjs`)
- `createStudio`: (from `studio.mjs`)

**Rules/Invariants**:
- All files in `public/` are client-side code.
- No direct access to server-side logic from these files.

**Tests**:
- `tests/ui/*.test.mjs`
