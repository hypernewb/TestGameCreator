# Venus University loop compared with this harness

## Prototype 1.11 update

Scripted scenes may now move through authored beats, pause for a later committed event, and resume with choices gated by recorded state. The play view includes a read-only event debugger that explains unmet conditions and paused transitions. This event graph and debugger are original framework code; they do not copy Venus University's university-specific event scripts. The structured scene sanitizer and stage utilities under `vendor/venus` remain the adapted upstream portions.

Reviewed the public source snapshot at commit `79301df55bc39a0996229ccc6f12ccce422a80b2`:
https://github.com/venus-uni-dev/venus-university

Venus University's code is AGPL-3.0-only. Its assets are all rights reserved. The scripted scene rules are original. This personal build now includes adapted lore matching and stage instruction source, with the original license and attribution under `vendor/venus`. It contains no Venus University world content or assets. Distribution of the combined program would need to meet the AGPL terms.

| Loop stage | Venus University snapshot | Story Framework 0.8 |
| --- | --- | --- |
| Start a time slot | `gameLoop.ts` resolves timetable, NPC overlay, feeds, texts, intro, then folds a slot save | Optional daypart module advances a configurable clock, supplies an intro and invitations; schedule/event modules react to time |
| Classify a new action | `submitAction` classifies intent and casts scene participants, then keeps cast on continuation | Intent provider selects an enabled command; modules and state validate it; present characters come from locations and schedules |
| Scene generation | `scenePrompt.ts` assembles cast, lore, recent history and constraints; `sceneSanitizer.ts` validates output | `context.mjs` selects lore, memories and committed outcomes; provider writes narration; a failure falls back to committed text |
| Scene settlement | Relationship ledger, stat changes, memories, classes, money, jobs, time boundary, slot save | Deterministic event reactions, inventory, trust, objectives, scripted choice effects, action journal and SQLite save |
| Authored event | Specific orientation/occasion/farewell rules and time windows wired into the game | `story.scenes` is pack data: event trigger + conditions + opening + choice effects, editable per game |
| Presentation | React/Electron visual-novel stage, sprites, background, phone/feed overlays | Local web game with VN and classic layouts, transparent portraits/backgrounds; no Electron packaging yet |

## New scripted scene contract

A pack opts in with `"story.scenes": "0.1.0"` and `scriptedScenes`. Each scene has a unique ID, a `trigger` matching one committed event type and selected payload fields, optional `when` conditions (`location`, `minTick`, `maxTick`, flag booleans, owned items, minimum trust), opening text, and 1–12 choices. Each choice has a committed result and optional effects (`flag`, `trust`, `item`, `memory`). A trigger starts the scene once. The player must resolve its choice before another command. The state, scene history, character memories and effects are saved as core patches for replay and import verification.

The editor offers scene triggers, payload matching, location/clock/flag gates, branches, effect controls and stage instructions. The adapted stage parser accepts `show`, `hide`, and `sprite` with only valid actor and pose IDs. Character pose images use the same transparent image preparation as portraits. More complex `when` fields can be authored with Advanced JSON. The bundled **The Workshop — Scripted Scene** demonstrates entry into a location triggering two distinct outcomes. Existing packs remain compatible because the module is opt-in.

## Remaining gap to a complete game creator

The current module is a single-level choice event. Venus University's source also has scene continuations, cast planning, NPC social simulation, message/feed systems, relationship ledgers, and image/pose staging. These systems are tied to its university setting and should become independent optional modules in this harness. A future event graph should support multi-step scenes, prerequisites between scenes, timers, reusable variables, and a debugger showing why a trigger did or did not fire. Its AI text does not get authority to mutate world state.
