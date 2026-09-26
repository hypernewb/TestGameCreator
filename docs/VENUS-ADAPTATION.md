# Venus University source review and next adaptations

Reviewed local source snapshot `79301df55bc39a0996229ccc6f12ccce422a80b2` from `venus-uni-dev/venus-university`. The upstream application is AGPL-3.0-only. The original art, characters, setting, and game scripts are separate content and are not included here.

| Source area | What it does | Use in this framework |
| --- | --- | --- |
| `src/shared/sentences.ts`, `stores/sceneSanitizer.ts` | Splits prose into readable sentences and removes only an outer pair of quotes | **Adapted now** in `vendor/venus/sceneText.mjs`, then used for persistent VN pages. |
| `src/shared/sceneActions.ts` | Parses show/hide/sprite directions | **Adapted earlier** in `vendor/venus/sceneActions.mjs` for authored poses. |
| `prompts/lorebook.ts` | Matches names and prevents absent NPCs appearing | **Adapted earlier** in `vendor/venus/lorebook.mjs`. |
| `stores/sceneSanitizer.ts` | Guards illegal assets and repairs speaker entrances | **Adapted in prototype 1.10** in `vendor/venus/sceneSanitizer.mjs`. It uses the committed per-turn cast and project asset allowlist. Outfit, CG, and dating code remain specific to the upstream game. |
| `stores/stageDisplay.ts` slot override | Hides or shows actors in available stage cells | **Adapted in prototype 1.9** as `vendor/venus/stageDisplay.mjs`. The renderer applies it only to actors whose saved location is the player's current location. |
| `stores/sceneStream.ts`, `stores/jsonStream.ts` | Streams complete structured lines to the dialogue box | **Next candidate.** First define a native scene `{speaker,text,pose,bg}` contract, then sanitize it before any preview is shown. Keep committed game state authoritative. |
| `stores/gameLoop.ts` and `stores/loop/*` | Coordinates classifications, NPC simulation, scene turns, hangouts, clock and save boundaries | **Adapt by modular behavior.** The code is deeply tied to university classes, feeds, dating, weather and jobs. Port each desired rule as an optional module with explicit event inputs and saved outputs. |
| `views/GameView.tsx`, `views/Dialogue.tsx` | VN stage, speaker labels, input lock while reading, line advance, cast and map | **Behavior adapted now** in `public/vn.mjs` and CSS; wholesale copying would introduce React, motion, asset pipelines and setting-specific UI. |

## What changed in this build

- A visual novel layout is the default, with a compact mode switch that does not alter saves.
- Each turn stores short narrator or speaker pages and reads them one at a time before choices appear.
- Daypart invitations are shown as phone messages and can start a meeting.
- A failed writing call names the actual error and can be retried for the latest turn without repeating mechanics. The editor's AI settings can test a *structured story scene* against the chosen local model.
- An illustrated Workshop example exercises the stage with placeholder portraits. Old example pack files and their save digests were not changed.

## Still missing for a full visual novel game

The current model writes plain scene prose and the framework divides it into pages afterward. It does not yet request validated per-line sprite changes, CGs, multi-step scene continuation, background transitions, a persistent phone history, or NPC-led event chains. Those need a native line contract, a scene queue and a stage reducer. The current SVG art is placeholder quality. A better model and finished artwork have a greater effect on the feel than copying UI source alone.

The combined package includes adapted AGPL source under `vendor/venus`. If this is ever distributed or made available as a network service, review the upstream AGPL obligations and provide required source/attribution.
