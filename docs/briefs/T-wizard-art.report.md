# T-wizard-art: Wizard artwork in the player (slice C)

Date: 2026-10-05. Status: **slice C works** for icons/glyphs, button state art and 9-slice frames in the dock, bound widgets, header, dialogue and choices. Portable export of UI art is **blocked by file ownership** (see below). Nothing was committed. This builds on `T-wizard-screen-mode.report.md` (slices A and B), which this task used as evidence and did not re-run in full.

## What the creator gets

- **Import:** in Studio → Interface layout → *Load Wizard layout*, a Wizard export whose art is embedded as data URIs (PNG, JPEG, WebP or SVG) is converted on import.
  - Each distinct image is checked with the Wizard's own `validateFrame`.
  - SVG is rasterised to PNG.
  - Each image is uploaded once as project media (`scenario-media/<uuid>.png`).
  - The status reads, for example, "Layout validated and 4 artwork files uploaded as project media."
  - The review/apply flow is unchanged, and the saved project holds only media paths, never data URIs.
- **Player** (classic screen with bound widgets, and the complete Wizard screen):
  - `appearance.<id>.frame` + `slice`: drawn as a CSS 9-slice `border-image` (`<slice>% fill`, stretched; the width follows the widget border, minimum 4px). Applies to bound widgets, dock tools, `.scene-header` (date), `.dialogue` and `#choices`.
  - `buttons.<id>.states[mode].art`: drawn as a stretched background for normal, hover, pressed and disabled. A state without art falls back to the normal art.
  - `appearance.icon` (shop/map/board/calendar): `none` hides the icon, `auto` uses the widget's own glyph, and a named value uses that glyph from the shared sprite `/vn_ui_studio/icons.svg`.
  - `utilities.<tool>.glyph` / `asset`: dock tools show the uploaded asset `<img>`, otherwise the sprite glyph.
  - `buttons.<id>.display` (`both`/`icon`/`label`) and `iconSize` are honoured. An icon-only button keeps an `aria-label`.
  - Glyph strokes follow the button's ink colour (`currentColor`).
  - When the dialogue is framed on the Wizard screen, the classic tan plate and edge decoration are hidden so the frame's centre shows.

## Contract and security

- `public/ui-art.mjs` is the single player contract. Art must be `''` or match `^scenario-media/<uuid>.(png|jpg|webp)$`; it becomes a same-origin `/scenario-media/...` URL.
  - Embedded, external, `javascript:` and path-traversal values are refused.
  - `vn-skin.mjs` `validateFrame` uses the same regex, so a tampered pack fails validation and nothing is drawn.
- Icons are built with `createElement`/`createElementNS` (`<svg><use href>`, or `<img>`), never `innerHTML`.
- **CSP decision:** the player keeps `img-src 'self'`. Only `studio.html` gains `blob:` in `img-src`, so the browser can decode SVG for rasterisation.
  - `data:` stays disallowed.
  - `fetch(data:)` is blocked by `connect-src`, so the data URI is decoded manually.
  - The Wizard validator has already refused scripts and external references in the SVG before it is decoded.

## Changed files

Mine (new or exclusive to this task):
- `public/ui-art.mjs`: art contract, art-carrier walk, `uiMediaReferences`, `remapUiMedia`, `iconNode`, `buttonIcon`, `fillButton`.
- `public/ui-art-import.mjs`: `embedWizardArt`, `rasterizeSvg`.
- `public/ui-layout-style.mjs`: `frameStyle`; state art and gap in `buttonStyle`.
- `public/ui-screen.mjs`: frames on the dock, header, dialogue and choices; dock icons; the `data-framed` marker on the framed dialogue element, removed on clear.
- `public/ui-project.mjs`: injectable `uploadArt`/`rasterize`; import calls `embedWizardArt`.
- `tests/ui-art.test.mjs` (8 tests), `tests/ui-art-fixture.mjs`, `tests/ui-art-browser.test.mjs`.

Shared files, with surgical edits only (other agents' hunks preserved):
- `server.mjs`: one token on the public static-file CSP line, `img-src 'self'` plus ` blob:` for `studio.html` only.
- `public/ui-showcase.css`: a 2-line append hiding `.dialogue::before/::after/.dialogue__edge` for `main.stage[data-screen=wizard] .dialogue[data-framed]`.
- `public/ui-live.mjs`: bound buttons use `fillButton` and `frameStyle`.
- `public/vn-skin.mjs`: `validateFrame` accepts project media paths.
- `tests/ui-live-bindings.test.mjs`, `tests/ui-live-layout.test.mjs`, `tests/ui-screen-mode.test.mjs`: their DOM mocks gained `createElementNS`.

## Checks run (exact)

```
node --test tests/ui-art.test.mjs tests/vn-skin-contract.test.mjs tests/ui-live-layout.test.mjs tests/ui-screen-mode.test.mjs tests/ui-live-bindings.test.mjs tests/studio-ui-selection.test.mjs
  → 51 pass, 0 fail
node --test tests/ui-art-browser.test.mjs tests/ui-screen-mode-browser.test.mjs tests/ui-live-layout-browser.test.mjs
  → 3 pass, 0 fail
node --test tests/ui-live-bindings-browser.test.mjs
  → 1 pass, 0 fail
```

The full suite was not run, as instructed. No provider was used: the tests use an `:memory:` DB and a temp scenario dir, block `https://*`, and mock `setupRequired=false`.

One regression was found and fixed during these checks. `clear()` called `find('.dialogue')` on mocks without `querySelector`, which failed 3 `ui-live-layout` tests. The screen now tracks the framed element itself and unmarks only that element.

## Browser evidence (`artifacts/ui-art/`)

`tests/ui-art-browser.test.mjs` drives Edge through the real Studio and player:

1. **`1-studio-art-import.png`:** the real file input receives the artful Wizard export (3 PNGs plus 1 SVG). The status says 4 artwork files were uploaded.
   - After Apply, Game screen = Wizard, and Save: the saved `gameProject.ui` contains no `data:`/`http`.
   - It holds exactly 4 distinct `scenario-media/*.png` paths, each served `200 image/png`.
2. **`2-player-desktop-dialogue.png`:** the published world, played.
   - Dialogue, header, choices and settings have `/scenario-media/` border images, and the dialogue slice is `20% fill`.
   - Shop: media background, `#i-heart` icon at 22px, plus a label.
   - Save: the uploaded asset `<img>` decodes at 26px, with no label. Load: label only. History: a sprite glyph with `fill:none` and stroke equal to the button ink.
   - The classic plate is `display:none`.
   - Every URL on the stage is same-origin, and `icons.svg` is served as `image/svg+xml`.
3. **`3-player-shop-hover.png`:** hover swaps the shop to its hover state art, which differs from the normal art and is still media.
4. **`4-player-desktop-choices.png`:** choices inside the framed `#choices`.
5. **`5-player-phone.png`:** 390×844, layout `wizard:phone`. The dialogue frame is media and the save icon decodes.

No browser console errors other than a favicon error.

## Deferred (not done)

- **UI art portability (ownership conflict, not resolved):** project export/content packages don't yet carry Wizard art. The hooks belong in:
  - `packages/assets/project-media.mjs` `mediaReferences`;
  - `public/studio.mjs` lines ~538–539.

  Both currently carry another agent's uncommitted animated-media edits, so I left them untouched. `uiMediaReferences(pack)` and `remapUiMedia(pack, remap)` in `public/ui-art.mjs` are ready to be called from those hooks once that work lands. Until then, a project exported with Wizard art and re-imported elsewhere would reference media that wasn't copied.
- **`auto` ink ignores frame art:** text colour is chosen from the surface colour, not the image. Dark frame art with `auto` ink can make dialogue text unreadable. The fixture sets a light `ink` explicitly; a creator must do the same, or a future contrast check could warn.
- **Decorative icons** for dialogue/choices/date (`appearance.icon` on non-button widgets) are not drawn.
- **Presets:** `presets[].appearance.frame` and button art are found for upload, remapping and validation, but presets themselves are not rendered by the player.
- **Orphan uploads:** if a creator cancels the review after import, the media already uploaded stays in the project's media store.
- **Fixture layout overlap:** the fixture's bound "Pilot · Nerve" widget overlaps the dialogue in screenshot 2. This is the authored layout of the existing fixture, not an art bug.
- Game UI visual redesign remains paused, per the current priority.
