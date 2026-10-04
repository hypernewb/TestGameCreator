# Original HUD expansion kit

Twelve original SVG component concepts for the VN Studio prototype. These are visual specifications, not engine features. Transparent backgrounds, 512×300 view boxes, editable shapes and text. hud-expansion-board.svg is a contact sheet.

## Suggested first additions

1. Speaker nameplate and portrait socket: identity and expression.
2. Reading controls: history, auto, skip, save, load, settings.
3. Pinned objectives: pick up the story after returning.
4. Time planner and action-cost preview: understand a choice before committing.
5. Outcome feedback: explain committed changes.
6. Save postcards: recognizable scene, chapter and time.

## Optional additions

- Location/chapter reveals.
- Relationship milestone constellation, with authored milestones and reveal rules.
- Requirement/result panel, showing engine thresholds and resolved outcomes.
- Inventory item cards and equipment sockets.
- Message/event notification tray.
- Journal entries with recorded sources and confidence labels.

## Other ideas to consider next

- Dialogue backlog with search and per-line voice replay when recordings exist.
- Expression indicators and portrait transitions when character art is available.
- Tooltips and keyboard/controller prompts with input-aware labels.
- Scene glossary links and an unobtrusive new-information marker.
- Optional map availability indicators driven by known engine state.
- A loading/cancel/retry treatment for interpreted typed actions.
- Audio now-playing strip and separate voice/music controls.
- A gallery of discovered CGs and replayable chapters, where supported by authored content.
- Choice focus, hover, unavailable, and selected states; compact requirement chips.

## Reference patterns

- Ren’Py reading controls and save UI: https://www.renpy.org/doc/html/screen_actions.html and https://www.renpy.org/doc/html/screen_special.html
- Persona 5 Royal relationship progression: https://persona.atlus.com/p5r/
- Baldur’s Gate 3 active-roll interface and visible bonuses: https://baldursgate3.game/news/patch-3-mac-support-magic-mirror-more_93

These references inform interaction patterns. The assets do not copy their artwork, typography, or exact interfaces.

## Integration

Dark ink and warm gold unify the collection; green, rose, blue and violet differentiate states. Components use different silhouettes instead of a shared rounded-card shape. Prefer a few relevant components at a time, with drawers for detail.

Use engine-provided values for costs, thresholds, availability and outcomes. Never invent success probabilities. Relationship progression is not consent. The sample notebook, messages, objectives, stats and milestones are illustrative, not new authored gameplay content.

SVG text uses local Arial, Georgia and monospace fallbacks. Text stays editable; distribute font outlines separately if exact cross-device lettering is required. To regenerate the assets, run `node vn_ui_studio/generate-assets.mjs`.
