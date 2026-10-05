# T-wizard-player-layout — UI Wizard layout rendered in the playable game

Date: 2026-10-05. Status: **works for bound Game UI widgets**; deferred items listed below. Nothing committed.

## Trace: Wizard → Studio → publish → player

| Step | Code | Layout fields | Finding |
|---|---|---|---|
| Wizard export | `vn_ui_studio/model.mjs` `exportPackage` | full `config` (theme, accent, textSize, opacity, radius, widgets, layouts, constraints, appearance, buttons, utilities, liveBindings) + generated `css` | complete |
| Studio import/Apply | `public/ui-project.mjs` `reviewWizardExport` → `applyUiReview` | stores `validateSkinExport(...).skin` (full normalized config) in `gameProject.ui.options[].skin.export` | complete; raw CSS discarded by design |
| Save / reopen / project export-import / publish / campaign load | `server.mjs` studio + `/api/new` + `/api/load` | `gameProject.ui` stored verbatim | complete (tested: deep-equal of widgets, layouts, appearance, buttons, constraints, theme tokens, bindings) |
| Contract | `public/vn-skin.mjs` `resolveSkinLayout` (unchanged) | per-widget `rect`, `z`, `appearance`, `button`, `utility`; `styles` tokens | complete. Note: the active device reads `config.widgets`; other devices read `config.layouts[device]` (Wizard semantics) |
| **Player** | `public/ui-live.mjs` `draw` | **only `rect`, `z`, `padding`, `border`, `background`, `ink` were read, painted as unthemed Canvas boxes over the whole scene (no aspect), with no font, shape, theme or button skin/state** | **the gap: fixed here** |

Content packages (`packages/cards/content-package.mjs`) do not carry `gameProject.ui`. That is unchanged and out of scope. The whole-project `story-framework-game-project` envelope is what transfers the layout.

## Changed files

- `public/ui-layout-style.mjs` (**new**): a pure inline-style port of the Wizard canvas tokens from `vn_ui_studio/campus.css` and `button-views.mjs`. It contains `stageFrame` (letterbox), `surfaceStyle` (widget surface) and `buttonStyle` (button skin and state). Its output is plain style values only: no markup, URLs or stylesheet injection.
- `public/ui-live.mjs` (shared; 8 lines changed vs. the pre-edit copy). It imports the style module, lays out in the letterboxed stage, adds a `paint()` helper, sets `data-layout` and `data-shape` diagnostics, and shows a `role=status` "Game UI layout unavailable: …" message on an invalid layout. Action click, busy, epoch and stale-campaign logic is untouched. The other agent's calendar/feedback edits in this file are preserved.
- `tests/ui-live-layout.test.mjs` (**new**): 8 unit/integration tests.
- `tests/ui-live-layout-fixture.mjs` (**new**): the authored design fixture, exported through the Wizard's own `exportPackage`.
- `tests/ui-live-layout-browser.test.mjs` (**new**): the browser walkthrough.
- `artifacts/ui-live-layout/*.png`: browser evidence.

No other shared file was edited, and `vn-skin.mjs`, Wizard, Studio and server code are unchanged.

## Scaling strategy

- The stage is the largest box with the authored canvas aspect (desktop 16:9, tablet 4:3, phone 9:16) that fits inside the player scene, centred (letterbox). Widget percent rects resolve against that box via `resolveSkinLayout`, so proportions match the Wizard canvas at any window size.
- A portrait scene (height > 1.2 × width) on a non-phone project uses the Wizard's authored **phone** layout.
- Font sizes follow the Wizard formulas against the stage width:
  - widgets: `clamp(10px, 1.35% stage width, 17px) × fontSize%`, or 11px × fontSize% on phone;
  - dialogue/feedback text: `clamp(12, 1.8%, 23) × textSize/18`.
- Small viewports: bound action buttons are at least 34 × 34 px and are clamped inside the stage, so they stay reachable. Non-interactive widgets keep the authored size.

## Supported layout properties (honoured in the player)

| Property | Source | Rendered as |
|---|---|---|
| Position, size | `widgets` / `layouts[device]` + `constraints` (via `resolveSkinLayout`) | absolute px inside the letterboxed stage |
| Stacking order | `z` | `z-index` |
| Visibility | `visible` | hidden widgets are not drawn |
| Font family | `appearance.font` (auto/serif/sans/mono) | Georgia / Segoe UI / Consolas stacks |
| Font size | `appearance.fontSize`, `config.textSize` | Wizard clamp formulas (see above) |
| Text colour | `appearance.ink` (auto → theme/shape ink) | `color` |
| Background | `appearance.background` (auto → theme/shape surface), `config.opacity` | `background` with alpha = opacity |
| Border | `appearance.border` | `Npx solid #aa956c80`, plus shape/theme edge colours |
| Padding | `appearance.padding` | `padding` (+8px left on notebook) |
| Corner radius | `config.radius` | `min(radius, 5px)` like the Wizard; shapes override |
| Shape | `appearance.shape` (auto, calendar, receipt, record, dossier, notebook, tab, ticket, glass, frameless, pennant, shield) | clip-path, edge, rotate and shadow from campus.css |
| Texture | `appearance.texture` (auto/ruled/linen/plain) | CSS gradients |
| Theme | `config.theme` (parchment/kinetic/minimal/glass) | surface/ink/edge overrides, blur |
| Button skin | `buttons[id].skin` (bare/paper/glass/outline/tab/dock_tab) | fill, border, shadow, bottom/right edge, radius |
| Button layout | `orientation`, `padding`, `radius` | flex direction, padding, radius |
| Button states | `states.normal/hover/pressed/disabled` fill/ink/border/opacity | follow the `buttonVariables` rule (state → normal override → skin default); hover/focus, pressed and disabled (busy, ended, unresolved) applied live |
| Utility tint | `utilities.tint` | button ink |
| Accent | `config.accent` | `accent-color` |

## Remaining limitations (deferred, not done)

- **Only bound widgets are drawn by the Wizard layout.** Unbound core widgets (dialogue, choices, date, tool dock, etc.) still render as the classic player UI. Replacing the whole player chrome with Wizard widgets is the paused Game UI redesign.
- Icons/glyphs (`appearance.icon`, `buttons.display`, `iconSize`): the label text is shown and the icon is not drawn.
- The `selected` button state has no meaning for one-shot actions and is not applied.
- Artwork, frames, 9-slice and `fit` modes are unsupported because the validator rejects artwork. Exports carrying art fall back to the legacy UI with a diagnostic (existing behaviour).
- Notebook/record pseudo-element decorations (`::before`/`::after` binding rings, record grooves) cannot be expressed as inline styles and are omitted. The surface, edge and texture are kept.
- Wizard "fit/stack" content minimums are not ported (only the 34px action minimum). Long text scrolls inside the widget.
- Kinetic theme animations and `reducedMotion` are not applied (there are no animations to suppress).
- Raw CSS from the export is always discarded (by design, for safety).
- Overlap with classic UI is the creator's responsibility. Authored widgets render at z ≥ the live layer (35) over the scene, as placed in the Wizard.

## Safety

- Values reach the DOM only through `textContent`, attributes and `style` properties. There is no `innerHTML`, `url()` or stylesheet (the mock DOM throws on `innerHTML`, and a unit test checks that style values contain no `url(`, `<` or `javascript:`).
- Invalid layouts are refused three times: on Studio review, on world creation, and in the player. If a tampered payload reaches the player anyway, it shows a `role=status` diagnostic and draws no widgets (tested).
- Projects without a custom layout draw nothing extra (tested in unit and browser).

## Checks run (exact)

```
node --test tests/ui-live-layout.test.mjs                       # 8/8 pass
node --test tests/ui-live-layout-browser.test.mjs               # 1/1 pass (~9s, Edge headless)
node --test tests/ui-live-bindings-browser.test.mjs tests/ui-live-bindings.test.mjs tests/ui-live-layout.test.mjs tests/vn-skin-contract.test.mjs   # 28/28 pass
node --test tests/player-session-browser.test.mjs               # 1/1 pass
```

The full suite was not run (per instructions). No real AI settings were touched, and there were no model calls. Servers used `createApp({dataPath:':memory:'})` with a temp scenario dir. The browser blocked `https://*`, `/api/bootstrap` was mocked to skip AI setup, and the action is the deterministic `core.scene` practice activity.

## Browser evidence (`artifacts/ui-live-layout/`)

The walkthrough is `tests/ui-live-layout-browser.test.mjs`, at 1440×900:

1. `1-wizard.png`: the Wizard loads the authored design (balance moved to 5%/50%, 30×20%, z 42, mono 150%, `#ffcc00` on `#102030`, ticket shape, 3px border; shop at 60%/10%, paper skin, `#336699`/`#fefefe`/`#ff00aa`, radius 9). The real **Export** button produces the file, and the test asserts that widgets, appearance, buttons and bindings survive the export.
2. `2-studio.png`: Studio imports the file, then Apply, Save and reopen. The selected option persists, and widgets, layouts, appearance, buttons, constraints and bindings are deep-equal to the export.
3. `3-player.png`: after publish, `/api/new` and `play.html`, `data-layout=wizard:desktop`. Measured rects match the letterboxed authored percentages within 1.5px. Computed styles match: z 42/7, Consolas 25.5px, `rgb(255,204,0)`, `rgba(16,32,48,0.8)`, 3px border, polygon clip-path, Georgia button font, `rgb(51,102,153)` fill, 9px radius.
4. `4-player-busy.png`: while the action is in flight the button is disabled with the authored disabled state (`rgb(68,68,68)`, opacity 0.4). Repeat clicks are ignored.
5. `5-player-updated.png`: after the action commits, the balance reads "Pilot · Nerve: 3". Its rect, z, font, size, colour and background are unchanged, and the button returns to its normal/hover state. Campaign revision is 1.
6. `6-player-phone.png`: at a 390×844 mobile viewport, `data-layout=wizard:phone` uses the authored phone layout. The action is ≥34×34 px and inside the stage.
7. `7-player-default.png`: a project without a custom layout plays with the default interface and has an empty live layer.

No page errors were recorded during the walkthrough (`b.errors` is empty).
