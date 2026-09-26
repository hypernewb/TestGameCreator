# Venus University systems audit and modular port plan

Source inspected: `venus-uni-dev/venus-university`, commit `79301df55bc39a0996229ccc6f12ccce422a80b2`, 396 files under `src/`. Its program is AGPL-3.0-only; its packaged assets and authored fiction are separate. This audit is based on the local source snapshot, source entry points, and a static inventory of every `src/` file. The accompanying `VENUS-SOURCE-INVENTORY.csv` enumerates every file, family, import count, port route, and current local correspondence. A correspondence means selected code or behavior, not feature parity. The inventory is a routing map, not a claim that all 396 files were implemented or reviewed line by line.

The target is a creator where the same modules can run a campus, bar, fantasy town, or other world. Venus's fixed calendar, characters, classes, jobs, romance semantics, and React/Electron stores must be turned into authored pack data and optional modules before they can serve that target.

## Current coverage

| Venus subsystem and source | Status in Story Framework 1.18 | What remains |
| --- | --- | --- |
| Classification and cast planning: `shared/classifier.ts`, `loop/classify.ts`, `loop/casting.ts` | Selected classifier and deterministic attendance rules adapted | Availability windows, social contacts, group encounters, and one shared cast plan for all actions |
| Scene prompt and lifecycle: `prompts/scenePrompt.ts`, `loop/turn.ts`, `loop/cast.ts` | Opening, continuation, summary, closing, cast release and recall | More robust player-action routing, token budgeting, authored/end-of-scene transitions and explicit departures mid-scene |
| Scene sanitation and stage: `stores/sceneSanitizer.ts`, `shared/sceneActions.ts`, `stores/stageDisplay.ts` | Speaker, stage and background allowlists and four display slots adapted | Wardrobe, emotion, layering, pose animation and CG semantics |
| JSON stream parsing: `stores/jsonStream.ts`, `sceneStream.ts`, `textingStream.ts` | Parsers ported and tested in 1.18 | Response streaming transport and immediate playback are **not connected** |
| Request scheduling: `stores/llmQueue.ts` | Per-provider serial request lane ported and used in 1.18 | Separate groups for image/background jobs and granular progress UI |
| Retries and structured responses: `shared/llm/*`, `stores/silentRetry.ts` | OpenAI-compatible response parsing, schema downgrade and bounded retry adapted | Gemini-specific adapter, context-window handling, cancellation UI, editable retry/reword flow |
| Scene ledger, memory, lore: `shared/relationship.ts`, `prompts/lorebook.ts`, `loop/ledgerView.ts` | Bounded facts, lore, scene recaps and one validated per-turn character memory | Scene-level relationship ledger, promise resolution, recency weighting, visibility and contradiction review |
| Schedule and slot boundaries: `stores/timetable.ts`, `slotCrossing.ts`, `loop/promptState.ts` | Configurable 7-day/3-part clock, schedules, daypart introduction and missed schedule catch-up | Overlay generation, schedule exceptions, weather, timed invitations, prefetch and slot saves |
| NPC pair/social life: `shared/npcRelationships.ts`, `loop/npc.ts` | Pure pair rules adapted in 1.18 as optional `social.npc`; reproducible off-screen affinity, friends/rivals | Group overlays, witnessed encounters, gossip, character-specific friendship memories and creator controls for simulation rates |
| Money and shop: `shared/money.ts`, `shared/shop.ts`, `loop/jobs.ts` | Money formatting adapted and optional `world.economy` added in 1.18; finite priced items, buy/sell and authored pay | Multi-stock stores, gifts/preferences, debt, staffing, wages by schedule and business gameplay |
| Authored events: `prompts/occasions.ts`, `loop/statusSteps.ts`, `loop/hooks.ts` | Generic scripted triggers/conditions/choices/effects and debugger exist | Long-running promises, delayed plans, recurring event arbitration and authored priority ordering |
| Save and failure recovery: `loop/saves.ts`, `loop/state.ts`, `loop/turn.ts`, `main/services/saveService.ts` | SQLite turns, revisions, event replay and narrative retries exist | Midstream snapshot/rewind, slot checkpoints, rollback of preview frames, migrations and manual branching saves |
| Texting/phone/feed: `stores/textingLoop.ts`, `bunnyboardStore.ts`, `loop/feed.ts`, `prompts/textingPrompt.ts` | Parser only; daypart invitations are a limited substitute | Modular contacts, message history, requests, unread state, feed posts, interactions, event hooks, creator UI |
| Character builder: `prompts/characterPrompt.ts`, `characterSuggestions.ts`, `stores/characterStore.ts`, `main/services/characterService.ts` | Actor and trait fields, image upload, lore editor | Profile generation, flexible trait effects, gallery, outfit sets, reusable character packages |
| Art and production pipeline: `shared/imagePrompt.ts`, `main/services/comfyService.ts`, `assetStore.ts` | User upload and asset checks | Optional ComfyUI adapter, batch image jobs, transparent sprite variants, gallery and reproducible metadata |
| Audio, animation and accessibility: `stores/audioEngine.ts`, `views/spriteBreath.ts`, `views/SceneChrome.tsx` | Static VN stage with backgrounds and poses | Music and SFX cues, animation, better dialogue queue, accessibility and responsiveness |
| Academics, classes, exams, graduation: `shared/academics.ts`, `loop/academics.ts`, `loop/exams.ts` | Generic activities can express simple classes | Full grade/course system belongs in an optional education pack, not the core runtime |
| Jobs, feed popularity, stats, gifts, jealousy, romance, endings: `shared/jobs.ts`, `playerStats.ts`, `shop.ts`, `rumors.ts`, `dating.ts` | Framework has only generic activities, relationship dimensions and items | Each needs a separate editable rule module plus authored events, UI and replay gates |
| Setup/update/backup and Electron IPC: `main/services/*`, `preload/*`, `stores/setupStore.ts` | Electron and Windows starter exist; local SQLite | Portable packaging, updater/backup workflow, GPU/model management and diagnostics |

## Code actually brought into the 1.18 build

- `vendor/venus/jsonStream.mjs`, `sceneStream.mjs`, `textingStream.mjs`: TypeScript-free adaptations of the upstream incremental array extractor and scene/text readers. These utilities are tested; live line playback is future work.
- `vendor/venus/requestQueue.mjs`: adapts the upstream serial LLM lane, scoped to each compatible provider, with cancellation before execution. The provider now uses it for all of its calls.
- `vendor/venus/npcRelationships.mjs`: adapts the pure NPC pair model, zone thresholds, first-time friendship crossing, and encounter settlement. The optional `social.npc` module supplies authored starting affinity and deterministic rolls. It simulates at most three off-screen residents per location at a time, for up to eight locations per boundary. It does not force encounters into the player's active cast.
- `vendor/venus/money.mjs`: adapts formatting and number helpers. The economy/shop mechanics are original modular framework code using finite inventory ownership and event patches. They do not copy Venus's fixed shop catalog.

All adaptations retain the upstream AGPL license and attribution in `vendor/venus/NOTICE.md`. The upstream's full React app and authored content have not been copied into the build.

## Complete implementation sequence

| Phase | Deliverable and source families | Acceptance gate |
| --- | --- | --- |
| 1. Foundation | Shared cast planner and explicit scene/slot state; `loop/casting`, `loop/turn`, `loop/saves` | One authoritative location and cast across prompts, UI, save, schedule and rollback; no off-screen dialogue |
| 2. Live presentation | Streaming transport and authoritative final JSON validation; `jsonStream`, `sceneStream`, `loop/stream` | Pages appear in order; failed/aborted stream removes previews; replay exactly matches final sanitized response |
| 3. Social simulation | NPC overlay groups, encounters, rumors and romance rules as separate opt-in modules; `npcOverlay`, `npcRunIns`, `shared/npcRelationships`, `rumors`, `dating` | Deterministic seed, no unseen knowledge leakage, repeatable import and event-debug explanations |
| 4. Phone and world media | Messages, hangout offers, feed, read status and event-triggered posts; `textingLoop`, `loop/hangouts`, `loop/feed` | All texts/posts persist, use allowed contacts, and resolve invitations through attendance checks |
| 5. Economy and progression | Shops, gifts, jobs, money, stats and optional education module; `shared/shop`, `jobs`, `playerStats`, `academics` | Cannot duplicate items or money; author can change rewards, prices and thresholds without code edits |
| 6. Asset, sound and character production | ComfyUI job adapter, variant editor, gallery, audio cues, animations; `main/services/comfyService`, `assetStore`, `audioEngine` | Assets validate/transparency and retain provenance; failure leaves previous art and save intact |
| 7. Reliability and creator polish | Midscene rewind, slot checkpointing, backup/update, advanced rules UI and diagnostics; `loop/state`, `loop/saves`, `main/services/*` | Cancel/retry/reload preserves one committed outcome; creator displays validation reasons and save migration path |

The 1.18 release implements reusable pieces of phases 2, 3, and 5, not all of those phases. The next highest-impact integration is phase 1's unified cast planner and phase 2's transport/playback boundary. Copying the remaining files en masse would create a second, incompatible game store instead of completing the creator.

## Try the new modules

Enable **NPC social life** in Gameplay modules, add initial character pairs under NPC relationships, and advance a daypart. Its deterministic off-screen friendships and rivalries appear in the play panels. The sample *The Workshop — NPC Social Life* starts Brin and Cyra near a friendship threshold. Enable **Money and shop**, set Starting balance, mark an item For sale at a location, and author a money effect on a scene choice or activity. The sample *The Workshop — Shop and Shifts* lets the player earn a wage, buy a toolkit, and sell it back.

Back up and copy the **entire** previous `data` folder into the new release, then start the app. Existing packs and saves remain supported by the optional module design. Once an existing published pack has an active campaign, adding a new module changes its pack digest; copy the pack as a new project or begin a new campaign before enabling it. 110 automated tests pass and all 12 bundled examples validate. Real model and Windows visual QA remain necessary; automated tests use deterministic stubs.
