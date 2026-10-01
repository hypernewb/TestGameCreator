# Packs

**Purpose**: Content packs for the game, defining actors, locations, items, scenes, and other game data.

**Key Files**:
- `packs/*.json`: JSON files containing game content.
- `packs/living-world.json`: Sample content pack.

**Main Contents**:
- `actors`: Definitions of characters in the game.
- `locations`: Definitions of places in the game world.
- `items`: Definitions of usable items.
- `scenes`: Definitions of scripted game scenes.
- `schedules`: Character schedules.
- `dialogue`: Dialogue trees and lines.

**Rules/Invariants**:
- Content packs are JSON files.
- Each pack should be self-contained.
- `living-world.json` serves as a reference example.

**Tests**:
- `tests/campus.test.mjs`, `npm run validate`
