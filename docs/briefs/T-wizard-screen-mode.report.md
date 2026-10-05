# T-wizard-screen-mode — complete Wizard screen (slices A + B)

Date: 2026-10-05. Status: **slices A and B work**. Slice C and content-package UI portability are out of scope, and the deferred items are listed below. Nothing was committed. Builds on `T-wizard-player-layout.report.md` (used as evidence, not re-run in full).

## What the creator gets

In Studio → Interface layout, a new **Game screen** select (`#ui-screen-select`) offers:

- **Classic screen** (default): the existing player chrome, plus any bound Wizard widgets drawn as before.
- **Complete Wizard screen**: the player's dialogue, choices, free-text input, date/location header and tool dock sit at the Wizard's authored rects, and the classic chrome is hidden.

The choice is stored as `gameProject.ui.screen` (`'wizard'`, or absent for classic). It travels with save, reopen, publish and world creation.

## How it works

- **Slice A (chrome and non-interactive widgets):**
  - `.scene-header` is placed at the Wizard `date` rect with the date surface look, or hidden if the layout has no date.
  - The classic `.scene-nav` side menu is hidden. Its replacement is the Wizard dock (`tool_history/save/load/settings/updates`), rendered as `data-action` buttons (`history/save/load/menu/messages`) that `play.mjs` already handles, so there is exactly one menu control.
  - Planner, location, map and calendar tools have no player action yet and are **not drawn**, which avoids dead buttons.
- **Slice B (interactive pieces):**
  - The existing nodes are **moved, not recreated**: `.dialogue`, and `#scene-status`, `#first-controls`, `#refusal-options`, `#choices`, `#hub`, `#scene-feedback` and `#prompt-composer` inside a `#game-ui-controls` host at the `choices` rect. Their handlers, focus, the `act()` busy flag and the campaign-id stale guard are therefore unchanged.
  - The Wizard draws dialogue and choices as overlapping alternate screens. To keep both usable:
    - The host is pointer-transparent and its children are not, so the dialogue's Continue button stays clickable.
    - The host's z-index sits above both.
    - Controls are bottom-aligned.
    - A dialogue that would cover the input band is shortened (minimum 48px), and its text scrolls.
  - Choices/hub scroll inside their rect.
  - Dock buttons keep the 34px minimum and are clamped inside the stage, using the authored button skin and hover/pressed states.
- **Classic and restore:** switching back (or reset, unmount, or an invalid layout) restores the original node order and inline styles and removes `data-screen`.

## Validation and diagnostics

- `validateProjectUi` refuses `screen:'wizard'` in two cases:
  - when the selected option is the legacy UI ("needs a Wizard layout");
  - when any device layout (desktop, tablet, phone) lacks a visible `dialogue`, `choices` or `tool_settings`. The message is "Wizard screen is missing required controls: desktop Settings (menu) button…".
- That refusal runs inside engine `validatePack`, so Studio select, save, publish and `/api/new` all refuse. The Studio select reverts and shows the message.
- In the player, a tampered pack shows a `role=status` diagnostic and keeps the classic chrome. A runtime gap check backs this up with "Wizard screen unavailable: missing … Classic screen shown."

## Changed files

| File | Owner | Change |
|---|---|---|
| `public/ui-screen.mjs` | **new**, mine | `createWizardScreen(stage)` → `{apply,clear}`, plus `navActions` |
| `public/ui-selection.mjs` | shared | `screen` key validation, plus `screenControls`, `screenGaps` and `screenMode` exports |
| `public/ui-project.mjs` | shared | `selectScreenMode(pack,mode)` and the Studio "Game screen" select |
| `public/ui-live.mjs` | shared, surgical | imports; `screen`/`wizard` state; one Wizard-screen branch in `draw`; `screen.clear()` in the no-data/no-skin/invalid paths and `unmount`; `wizard` is set in `update`. The bindings, busy and epoch logic and the other agent's calendar/feedback edits are untouched. |
| `tests/ui-screen-mode.test.mjs` | **new** | 8 unit/integration tests |
| `tests/ui-screen-mode-browser.test.mjs` | **new** | browser walkthrough |
| `tests/ui-live-layout-browser.test.mjs` | mine (previous task) | test-only fix: move the pointer off the redrawn button before measuring its normal colour. This was an intermittent hover race: the redrawn button sat under a stationary cursor, so the authored hover fill `#a65f3f` was measured. The test passed 4 of 4 runs after the fix. |
| `artifacts/ui-screen-mode/*.png` | new | evidence |

The diff touched no other shared files, nothing in `packages/assets/project-media.mjs` (slice C / animated media), and no rename, connection-test or publish-provenance code. No ownership conflicts came up.

A real-browser bug was found and fixed during the walkthrough: setting `inset:'auto'` after `left/top` reset the header position. `inset` is now applied first. The mock DOM could not catch this.

## Checks run (exact)

```
node --test tests/ui-screen-mode-browser.test.mjs                 # 1/1 pass, 3 consecutive reruns pass (~8s, Edge headless)
node --test tests/ui-screen-mode.test.mjs tests/ui-live-layout.test.mjs tests/ui-live-bindings.test.mjs tests/vn-skin-contract.test.mjs   # 35/35 pass
node --test tests/studio-ui-selection.test.mjs tests/studio-ui-storage.test.mjs tests/ui-live-bindings.test.mjs tests/ui-live-layout.test.mjs tests/ui-screen-mode.test.mjs   # 39/39 pass
node --test tests/ui-live-layout-browser.test.mjs                 # 4/4 runs pass after the hover-race fix
node --test tests/ui-live-bindings-browser.test.mjs tests/player-session-browser.test.mjs   # 2/2 pass
```

The full suite was not run (per instructions).

Test conditions:

- No real AI settings were touched and no model was called.
- Servers used `createApp({dataPath:':memory:'})` with a temp scenario dir.
- The browser blocked `https://*`, and `/api/bootstrap` was mocked to skip AI setup.
- The action is the deterministic `core.scene` practice activity.

## Browser evidence (`artifacts/ui-screen-mode/`)

1. `1-studio-screen-choice.png`: Studio opens a draft with an applied Wizard layout. The select starts on Classic, and the creator picks "Complete Wizard screen" and saves. The test asserts `ui.screen==='wizard'` server-side.
2. `2-player-desktop.png`: after publish → `/api/new` → `play.html`, the page shows `data-screen=wizard` and `data-layout=wizard:desktop`.
   - The header, dialogue, controls host and menu button match the letterboxed authored rects within 1.5px.
   - The classic nav is `display:none`, and there is exactly one menu control. The dock reads `history, save, load, menu, messages`.
   - The composer lives in the host, below the dialogue.
   - The Continue button is hit-testable through the host, and Space advances lines.
3. Focus: the free-text input keeps focus and its typed value across a resize relayout.
4. `3-player-busy.png`: during a held action, `#player-prompt` and the bound action are disabled and the controls stay in the Wizard host. After release, the campaign revision is 1.
5. `4-player-menu.png`: the Wizard Settings button opens `#game-menu`.
6. `5-player-phone.png`: at 390×844 mobile, the page shows `data-layout=wizard:phone`. The menu button is ≥34×34 and inside the stage, and the input is hit-testable.
7. `6-player-classic.png`: the creator switches back to Classic in Studio, then saves, publishes and plays. There is no `data-screen` and no `#game-ui-controls`, the classic nav is visible, the composer is back in the stage, and there is no Wizard dock.

No page errors were recorded during the walkthrough.

## Deferred (not done)

- **Slice C**: icons/glyphs, artwork, frames and 9-slice. Dock buttons show their label text, and artwork is still refused by the validator.
- **Content-package UI portability**: `gameProject.ui` still travels only in the whole-project envelope.
- **Wizard tools with no player action**: planner, location, map and calendar are not drawn in Wizard mode. Auto mode has no Wizard tool either, so in Wizard mode Auto is reachable only through the game menu, if at all.
- **Messages badge**: the unread count shown on the classic nav is not mirrored on the Wizard Updates button.
- **Tablet**: the 4:3 tablet layout is validated and unit-covered through the shared code path, but it was not walked through in the browser.
- **Overlap**: placement overlap is the creator's responsibility. In the fixture, the authored Nerve stat card (5%/50%, z 42) sits over the choices on desktop (see `2-player-desktop.png`). The player draws exactly what was authored, and nothing warns about overlap yet.
- **Wizard content minimums**: "fit/stack" content minimums are still not ported. Only the 34px dock minimum and the dialogue/input-band rule apply.
- **Stale-campaign protection**: this relies on the unchanged `act()` campaign-id guard. Wizard mode adds no new stale path because the nodes are the same ones, and there is no Wizard-specific stale test.
