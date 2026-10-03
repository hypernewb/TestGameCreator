# Offline visual fixtures (T-095.visual-fixtures)

This finite harness exercises the real `play.html` and `studio.html` on a disposable `createApp`, with `:memory:` SQLite, a temporary scenario directory, an original workshop pack, seed 42, fixed campaign/turn IDs and fixed recorded timestamps. It never loads the user's settings, saves, browser profile or project drafts. It uses `MockProvider` plus an original canned workplace reply; there is no compatible/cloud provider and no model endpoint. No production UI or character-authoring files are changed. Portrait paths refer to three already shipped campus assets as visual placeholders; no artwork or Venus code/assets is copied.

Prerequisites: Node 24+ and installed Edge or Chromium. No npm install or browser dependency is required. On restricted Windows execution hosts the browser process may require normal sandbox escalation. `STORY_VISUAL_BROWSER` or `--browser=C:/path/to/browser.exe` overrides discovery. The fresh browser profile is closed and removed after a successful run. The application uses a random loopback port; external HTTPS is blocked in the browser.

```powershell
node --test tests/visual-fixtures.test.mjs
node scripts/visual-fixtures.mjs
# Finite subset, alternate output, exact PNG comparison:
node scripts/visual-fixtures.mjs --screens=landing,conversation,groupcast,phone,error --widths=390 --text=100,200 --out=artifacts/visual-fixtures/repeat-check --compare=artifacts/visual-fixtures/main-b9d5d27
# CI geometry gate (existing main has findings and will fail this):
node scripts/visual-fixtures.mjs --strict
```

The default matrix is 9 states × 3 widths × 2 text sizes = 54 viewport PNGs. Phone viewport height is 844; tablet/desktop height is 900; DPR is 1. Use the same browser version, OS and installed fonts for byte comparisons. The browser fixes timezone UTC and requested locale en-US, clears storage/cache between states, disables CSS and Web Animations, hides carets, waits for images/fonts and allows two paint frames to settle and requires two consecutive byte-identical compositor captures (maximum four attempts). Text-only enlargement doubles each element's computed font size; it is a deterministic stress fixture, not browser page zoom or a claim about all OS accessibility configurations. The output directory defaults to `artifacts/visual-fixtures/main-b9d5d27`; use an explicitly distinct `--out` for other revisions. `results.json` records the actual Git base, browser version, full rectangles, hit-test blockers and findings. `index.html` is an offline screenshot gallery. `--compare` records missing/different PNGs and exits nonzero; without it, `--strict` exits nonzero for layout findings. Normal capture reports known defects without failing screenshot generation.

| State | Real route and preparation | What it proves |
| --- | --- | --- |
| landing | `/play.html`; bootstrap of original fixture packs and three seeded campaigns | Pack/start and saved-campaign controls |
| creator | `/studio.html`; Open a fixed original project draft | Existing creator toolbar, initial project form and section navigation; no character sheet editing |
| conversation | Load the single-present-colleague campaign | Long original mock reply, input, clock and navigation |
| groupcast | Load the three-present-colleague campaign | Actual three-sprite staging and dialogue |
| phone | Load phone campaign; click Messages | Seeded engine-delivered message, thread list, close and reply controls |
| calendar | Load planner campaign; Continue to its real hub | Existing calendar/slot planner and action controls |
| refusal | Submit unsupported `Teleport to a missing room` through the actual composer | Mock clarification/refusal and existing alternatives; no consent/content policy invented |
| loading | Submit `Look around`; hold the next `/api/action` before the real handler | Real busy/input gate and loading overlay, released after capture; not a model-stream preview |
| error | Submit `Look around`; fail the next `/api/action` with HTTP 503 | Real retained input, error panel and Retry control; no committed action |

Three initial campaigns are validated with the existing `exportCampaign`/`validateImport` replay contract before capture. Tests also confirm two independently created fixture apps produce identical snapshots, the correct cast/message/refusal, the held request does not mutate state, release reaches the real action handler, and 503 preserves revision.

Geometry checks report viewport/hidden-ancestor clipping, center-point control obstruction, overlaps between independent header/navigation/dialogue/composer/status/refusal regions, and clipped dialogue/status/refusal text ranges. An open modal limits checks to its interactive surface; expected background modal blocking is excluded. Ordinary below-fold controls in vertical scrollers and offscreen controls in horizontal scrollers are excluded because they can be reached by scrolling. Sprite overlap is an intentional presentation choice and is not treated as control overlap. Center hit tests and rectangular intersections are diagnostics, not a complete accessibility or screenshot-diff oracle; review PNGs before treating a finding as a defect. Scroll reachability, keyboard navigation, touch hardware and every creator section are outside this first slice.

Main findings are recorded in `T-095.visual-fixtures.report.md`. The cloud `creator.html` draft wizard requires a connected provider; it is not given fabricated success responses. Phone offer/calendar booking flows not supplied by this original fixture are not manufactured. The unmerged T-084 live skin candidate is explicitly excluded: these captures show the current main renderer, even where main stores a selected UI. No binding/merge approval is implied.


