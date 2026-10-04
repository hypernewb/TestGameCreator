# Connect VN Studio to the Ashford playtest

The editor at `http://127.0.0.1:4176/` is a design preview. The game server serves `public/play.html` (default port 4317). These are separate pages today. This ticket adds responsive design tools and maps the integration; it does not modify the game or a campaign.

## Recommended connection

Add a small presentation adapter to the existing playtest rather than running the editor's sample game against the engine. Import a validated VN Studio export, apply its theme, widget styling, button states, visibility and device layout to the existing playtest elements, and reuse the playtest's action handlers. Keep a switch to return to the current presentation if the skin fails to load.

Proposed files for a follow-up ticket: `public/vn-skin.mjs`, `public/vn-skin.css`, `public/ui/ashford-layout.json`, `public/ui/ashford-assets/*`, plus narrow changes to `public/play.html` and `public/play.mjs`. These files have not been created in this ticket.

1. Export the current design using **Export layout**. Validate `format`, `version` and `config` with the editor's validation rules. Keep desktop/tablet/phone layouts and `constraints[device]` together. Percentages describe canvas geometry; anchor gaps and fixed sizes use pixels.
2. Unpack embedded frame, icon and state artwork into validated same-origin files under `public/ui/ashford-assets/`. The playtest's current `img-src 'self'` policy excludes data URIs. Keep that policy and reject external or scripted SVGs. Validate before unpacking; generate filenames rather than trusting imported paths.
3. Load the skin in `public/play.mjs` and apply it after the existing `render(data)` and `showLine()` update the DOM. A resize observer picks the appropriate device layout and resolves anchors against the actual game stage. Apply only validated numeric geometry and allowlisted style values. Do not insert exported labels, narration or JSON as HTML.
4. Resume the existing campaign through the playtest's existing `?campaign=<id>` entry point. It already calls `/api/load`. Use the campaign ID already selected by the player; never create or reset a campaign to apply a skin.
5. Bind each rendered widget to current game data and existing controls. Unsupported widgets remain hidden until a real data source and action are supplied.

## Binding map

| Editor component | Current playtest source or control | Integration behavior |
| --- | --- | --- |
| Date, daypart, location | `calendarFor(state, pack)`, `.scene-header`, `#weekday`, `#day`, `#daypart`, `#place`, `#tick-clock` | Restyle the actual game clock and location; omit preview semester/date values. |
| Dialogue and speaker | `linesFor(data)`, `showLine()`, `.dialogue`, `#line`, speaker elements | Keep reading progression, narration formatting and real actor identities. |
| Choices | `data.actions`, existing `#choices` and `#hub` renderers | Keep enabled/refusal reasons and existing action callbacks. |
| Typed response | `#prompt-composer`, `#player-prompt`, existing submit handler | Preserve scene input gating, busy states, retry and cancellation. |
| History | Existing history overlay/control | Style and open the current reading history. |
| Save/load | Existing game menu, checkpoints and `/api/backups/*` handlers | Use real checkpoint controls; never use the editor's preview slot. |
| Settings | Existing settings overlay | Keep real reading preferences and accessibility behavior. |
| Planner/calendar | `renderPlanner`, `plannerReady`, `calendarFor` | Render the current campaign schedule and costs. |
| Location/map | `renderHub` and helpers in `campus.mjs` | Reuse currently allowed location/travel actions and their costs. |
| Messages/updates | Existing messages control and campus phone helpers | Open actual conversations and expose only real notifications. |
| Balance, stats, relationships, dossier, inventory, shop, board | Current `state`, `panels`, `characters`, `known`, pack definitions and supported actions | Write explicit per-pack bindings. Hide any unbound widget; do not show the editor's sample money, stats, character or project names. |

`server.mjs` already returns `{state, pack, actions, panels, characters, diagnostics, rollbackPoints, eventDebug, known, contextTrace}` through its view layer. The UI should display the player-facing fields used by existing components, without exposing diagnostics or hidden character knowledge just because they appear in the response.

`act(request)` in `public/play.mjs` already submits `/api/action` with campaign ID, a unique request ID and `expectedRevision`. Keep this path. The skin must not bypass action validation, time costs, revision handling or deterministic engine rules, and must not call the language model directly.

## First deliverable and acceptance

Start with **dialogue + choices + clock/location + history/save/load/settings**, using the current Ashford campaign. Then wire planner/map and add pack-specific panels. This gives a playable visual improvement before every optional widget is supported.

Test with isolated campaigns or temporary/in-memory data: skin on/off gives the same available actions; clicking a skinned action uses the existing handler; disabled actions stay disabled; reading progression and typed-input gating are preserved; saving/restoring uses real checkpoints; layouts remain usable on desktop/tablet/phone; broken imports fall back to the existing UI. Validate response-failed/loading/empty/long-text states and keyboard focus. Do not experiment against the user's live campaign or `data/ai-settings.json`.
