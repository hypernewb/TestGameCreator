# What is modular, and how to extend it

## Extension map

| Part | How to change it | Core changes needed? |
|---|---|---|
| Setting, names, locations, cast, facts, goals | Add/edit a pack JSON file | No |
| Calendar labels and action durations | Pack `calendar` and `durations` | No |
| Relationships, inventory, schedules, quests | Enable registered modules in `modules` | No, while respecting dependencies |
| New ability using the current unlock mechanic | Add an `abilities` definition | No |
| A new mechanic such as turn-based combat | Write/register a new module | No if existing transaction/event contracts suffice |
| Different model service | Implement `interpret` and `narrate` | No |
| Different game presentation | Replace the host/UI, consume actions and panels | No |
| Different storage backend | Implement store load/insert/commit/narrative | No |
| A new rule that changes core semantics | Version and migrate the core contract | Possibly; do this deliberately |

Modularity is verified here by loading a second pack with different durations, a resource/ability module, and no relationship/schedule modules. The ability module imports only public core helpers. The core does not import modules, providers, persistence, UI, or scenario files.

## Make a pack

Copy `packs/neutral.json` under a new filename. Change `id`, `title`, and content. IDs are stable keys and must be unique across locations, actors, items, quests, and abilities. The player must refer to a defined actor; all locations and item holders must exist.

Current module versions are **exact matches**, not semantic-version ranges. Start a new campaign after changing content. A simple content digest catches ordinary pack edits; it is not a security signature.

Run:

```sh
node scripts/validate.mjs packs/my-pack.json
```

Restart the server to discover the pack. All fields are JSON data; a pack cannot load code. Only modules registered in `packages/modules/index.mjs` are executable.

### Pack fields

Required: `schemaVersion: 1`, `id`, `version`, `title`, `playerId`, `modules`, `locations`, `actors`.

Recommended UI fields: `subtitle`, `calendar`, `accent` (six-digit hex).

Optional module fields: `items`, `facts`, `schedules`, `quests`, `resource`, `abilities`, `durations`.

A location has `id`, `name`, `description`, `exits`. Each exit has `to` and optionally `flag` and `reason`. An optional background is a relative `assets/name.svg|png|jpg|webp` path. Copy that asset under `public/assets`. Missing images fall back to a plain scene background; no internet image request is made.

An actor has `id`, `name`, starting `location`, and optionally public `description`, private speaking `style`, and `goal`. Age is narrative data rather than a core mechanic; the bundled cast is described as adult.

A fact has `id`, `text`, and `knownBy` (either `"public"` or an array of actor IDs). Use `supersedes` to replace an older fact. Filtering happens before retrieval. Facts remain authoritative authored knowledge. The optional `social.gossip` module separately models source-linked, expiring rumors and per-character belief; a believed rumor does not silently become a fact.

A quest has `id`, `name`, `hint`, and `any`: an array of `{event,match}` alternatives. A matching committed event completes it once. `unlock` sets a named flag. Arbitrary expressions and scripts are not evaluated. This first release supports event matching rather than the design's full all/any/not/query condition language.

A schedule has `actor`, positive integer `period`, and `stops` (`at`, `location`). It repeats forever. Arrival changes current position. The listed schedule is public information; this prototype does not model secret schedules.

## Add a module

A module exports a record matching `packages/contracts/index.d.ts`:

```js
export const example = {
  id: 'example.mechanic', version: '0.1.0', coreApi: '0.1.0',
  requires: [],
  validate(pack) { /* fail with field-specific errors */ },
  init(pack) { return { value: 0 }; },
  commands: {
    'example.act'(tx, args) {
      // Validate before writing. Use tx.set and tx.emit.
      tx.set(['modules', 'example.mechanic', 'value'], 1);
      tx.emit('example.changed', { text: 'Something changed.' }, [tx.pack.playerId]);
    }
  },
  actions(state, pack) { return [{label:'Act', type:'example.act', args:{}}]; },
  panel(state, pack) { return {title:'Example', lines:['A status line']}; }
};
```

Register it in `packages/modules/index.mjs`, enable its exact version in the pack, and add regression tests. Optional `react(tx,event)` handles events from other modules. Dependency order is deterministic. Cycles and conflicting command names are rejected. Event chains are bounded at 200 emitted events per transaction.

**Contract discipline:** built-in modules use `tx.set` and `tx.emit`; arbitrary developer-written module code is trusted, not sandboxed. The engine does not prevent a malicious module from directly mutating its draft state. Module code should own only its own module state; use events for cross-module communication. The prototype does not yet enforce ownership at runtime.

`tx.random()` advances a seeded generator. Preserve its state for deterministic replay. Never use wall-clock time or `Math.random()` in gameplay rules.

## AI boundaries

`Provider.interpret(input, context, actions, signal)` proposes an available command or a clarification. `Provider.narrate(context, signal)` produces text after commitment. Model output never supplies a patch or direct numeric stat delta.

Model-maintained state is a non-goal. Variable macros borrowed from other front-ends (RisuAI/SillyTavern CBS `{{setvar}}`/`{{addvar}}`/`{{getvar}}` and their `global` forms), MVU `<UpdateVariable>` blocks and `_.set(...)` patch lines are stripped from every scene line, preview, plain narration and daypart text (`packages/ai/untrusted-output.mjs`), never interpreted. The engine stays the only writer of world state, so saves remain replayable and unforgeable. Author state changes as commands, effects or scripted scenes.

Group scenes use the scene plan's `speakers` slate (the committed cast for the beat). Lines voiced by anyone off it are dropped, including narration written as `Name: words` for an absent character. `Name: words` narration from a character on the slate is reattributed to that character.

The context builder selects character-visible facts, up to six older promises, recent memories, and recent accepted dialogue. It does not implement embeddings or generative memory summarization. Extremely large authored biographies/facts are not token-budgeted yet; keep packs compact.

Narrative prose can still contradict facts even when game state is protected. Use the live-model evaluation fixtures before claiming narrative consistency.

## Adult eroge and route authoring

The primary game target is an adult eroge/dating sim with optional NSFW narration. Enable `social.dating` for attraction and relationship agreements, `social.intimacy` for adult consent and encounter state, and `social.romance-tempo` only for characters who benefit from ranked pacing or gift rules. Adult packs must give every intimacy participant an explicit age of at least 18.

Route structure is per character:

- **Long route:** add a romance-tempo profile with `advancement: "scene"`; every advanced rank names an authored scripted scene.
- **Short route:** use `advancement: "automatic"`; thresholds advance without rank-up scenes.
- **Casual encounter:** omit romance tempo entirely, author a dating profile with appropriate eligibility, and use an intimacy profile with `casual: true`. Set the category to `resolution: "direct"` for a committed encounter without a scripted scene, or `resolution: "scene"` for a bespoke choice sequence.
- **Not available:** omit dating/intimacy profiles or author a hard eligibility boundary.

Gate the lead-up with stat checks rather than hidden numbers: a scene choice can carry a `check` (stat, target on a rank boundary, situational modifiers, required `fail` branch), gear can add `statBonus`, and activities train stats by spending dayparts. Checks decide how the player comes across, never consent. See [STATS-AND-CHECKS.md](STATS-AND-CHECKS.md); `packs/after-hours.json` is the worked example.

The global intimacy difficulty (`easy`, `normal`, or `realistic`) establishes a baseline, while character openness, categories, agreements, eligibility, and route tempo create individual variation. Easy or promiscuous characters can require less courtship, but no score, gift, difficulty, or narration bypasses adult validation, explicit consent, withdrawal, hard boundaries, or privacy rules. Use `fade`, `suggestive`, or `explicit` content level independently of mechanical difficulty.

Phone messages and feed posts should react to committed events. A feed reaction emits `social.feedReacted`; make it affect chemistry only by adding an explicit dating signal. Phone meetup offers reuse physical travel and schedule attendance. Ending definitions likewise inspect committed state rather than generated prose. Focused Studio panels are available for romance tempo, phone, feed, and endings; their nested rule objects currently use local JSON fields.

## Saving and migrations

SQLite writes replace the complete campaign snapshot in an atomic statement with an expected-revision check. The event journal is included in that snapshot, so accepted events and state commit together. This keeps prototype code simple but is not optimized for very long campaigns.

`migrateSave` requires a backup callback, copies input, and applies trusted sequential migrations. There are no historical production migrations registered because this is the first version. Imports accept only version 1; future migration functions need explicit fixtures and a host integration. Pack migration remains manual and intentionally blocks incompatible saves.


## Living World pack fields (0.2)

The new `packs/living-world.json` and `packs/other-world.json` demonstrate setting interchange while preserving the older fixtures and their saves.

`objects` contains `id`, `name`, `location`, `description`, optional `tags`, `reveals` (item IDs), and optional `effectFlag`, `requiresItem`, `useText`. Enable `world.objects` with `items.inventory`. An item can set `hidden: true` and is unavailable until an object reveals it. `world.explore` supports inspect and search plus take in one committed action. `items.place` puts a carried item in the current location. New object behaviors need module code; fields do not execute arbitrary scripts.

`lorebook` entries have `id`, `text`, `tags`, `scope` (`world`, `location`, `character`), `knownBy`, and a scope target. Candidate entries are visibility-filtered first, then ranked by current location, mentioned tags, and character. Selection is capped by a character budget. The context inspector exposes selected entry IDs and reasons. This is an initial retrieval implementation, not a full SillyTavern World Info importer or embedding search.

Entries can be gated and timed by world state:

- `when` uses the same condition object as scripted scenes (`flags`, `location`, `weekdays`, `dayparts`, `charactersAt`, `minTick`/`maxTick`, `items`, `equipped`, `trust`, `bonds`, `stats`, `relationshipStates`, `datingPhases`, `completedScenes`, `plans` — `{"<plan id>":"pending"|"kept"|"broken"|"none"}`, read from the latest plan with that ID). A failed gate hides the entry whatever the player types.
- `delay: N` hides the entry until tick N.
- `sticky: N` keeps an entry in context for N ticks after a tag or text match fires it, even if later input stops mentioning it.
- `cooldown: N` then blocks tag/text re-activation for N ticks. Scope-matched entries (the current location or character) still appear.

Timers count game ticks, not chat messages. They are computed from the `loreActivations` recorded on committed turns, so they replay identically. The inspector shows `when:`, `delay:` and `cooldown:` omission reasons.

Characters can add `traits`, `backstory`, `likes`, `dislikes`, `voice`, and `goal`. The character speaking is given its own profile and actor-visible memories. Background-only characters in a daypart job receive shorter context and explicit restrictions.

On the `minimal` preset the cast profile drops `backstory` and `goal`. The goal reaches the model only as the opening direction, so it must name the concrete thing on its own. Write "Tell the player about the fellowship abroad that starts next month", not "Talk about the departure". Set `pronouns` (for example `"she/her"`). An actor without them is presented as they/them, which stops a small model from switching between he and she.

Optional `moods` (short phrases such as "humming under her breath") replace the default daily moods. About one day in three a character is in one mood for the whole day, never during a scripted scene. Keep moods mild and self-contained: "tired today" works, while "worried about her sister" makes the model invent the sister.

`daypart` contains `interval`, `labels`, `introLocation`, `event`, `hangouts` (eligible character IDs, meeting place and plan), and `backgroundOnly`. Enable `world.daypart`. `world.nextDaypart` advances to the next boundary and moves the player to the authored private scene location; the AI then writes an intro and invitations. This first version's eligibility supports an optional flag and minimum trust. More advanced calendars and scheduling predicates would require further work.

The accepted event journal is stored in the save and available at `/api/journal` as JSONL. Generated prose and invitations are stored on the corresponding turn. The AI receives a bounded, visibility-filtered recent selection from that journal. A long-running game will need periodic summarization and stronger token budgeting.


### Character cards

`npm run card -- import <pack.json> <card.png|card.json> [--id x] [--location y] [--out file]` adds a SillyTavern/RisuAI/chub Character Card (V1, V2 or V3; JSON or PNG) as an actor. JanitorAI (`personality`, `first_message`, `example_dialogs`) and Pygmalion (`char_name`, `char_persona`, `char_greeting`) exports work too; they are normalized to V2 fields. To build a whole world around a card, see `docs/AI-BULK-AUTHORING.md` → "Start from a character card". `npm run card -- export <pack.json> <actorId> [--v2] [--png base.png] --out file` writes one back. The Studio server has the same operations: `POST /api/studio/import-card {id, card}` and `GET /api/studio/export-card?id=&actor=&version=2|3`. On import, `name`, `description` and `personality` become the actor's fields, `{{char}}`/`{{user}}` are resolved, and state-mutating macros are stripped. Enabled `character_book` entries become `scope: 'character'` lore known only to that actor; SillyTavern's message-count timers are not mapped, so use tick-based `sticky`/`cooldown`/`delay` instead. Everything else (`first_mes`, `alternate_greetings`, `scenario`, `mes_example`, `system_prompt`, `post_history_instructions`, tags, creator info, other extensions) is kept verbatim in `actor.card`, only for re-export; it is never sent to the model. Exports put readable backstory, goal, likes, traits and voice into the card text for other front-ends, and the exact story-framework fields into `extensions['story-framework']`. That makes re-import lossless, unless `description` or `personality` was edited elsewhere, in which case the edit wins.

### NPC life and gossip (`social.npc` 0.2)

NPCs who share a location outside the scene meet off-screen once per time slot. `initialNpcRelationships` seeds pair affinity (-6 to 6). `npcGroups` (up to 20) names cliques: `{id, name?, members (2-6 NPC IDs), locations?, runInText?}`. Authored groups form first; leftover NPCs rotate into one ad-hoc hangout.

`npcSimulation` sets the frequency and the caps. Every field is optional:

| Field | Range | Default | Meaning |
|---|---|---|---|
| `everySlots` | 1–12 | 1 | Run the simulation every N slots. |
| `maxGroups` | 0–8 | 8 | Off-screen groups per slot. |
| `maxGroupSize` | 2–6 | 3 | Members per group. |
| `runInsPerDay` | 0–6 | 1 | Run-ins per day. |
| `runInChance` | 0–1 | 0.5 | Chance of a run-in when one is possible. |

Off-screen meetings emit `social.npcEncounter`. Only the NPCs physically in that room can see it; its `payload.witnesses` lists them. A run-in is the one overlay the player sees: an idle group in the player's room emits `social.npcRunIn`. Its text is `runInText`, which fills in `{names}` and `{location}`. A new friendship emits `social.npcFriendship`, which only the pair can see. Each member of the pair privately recalls its last two friendships as `npcFriendshipMemories`.

Gossip rules can turn encounters into rumors, for example `{"event":"social.npcEncounter","seedFrom":"witnesses","summary":"{names} were seen together at {place}."}`. A rumor summary fills `{field}` from string fields in the event payload. Rumors keep their `sourceEvent` and spread only between NPCs in the same location. All rolls use the seeded world RNG, so a seeded run replays exactly.

## Game projects (0.4)

The home screen's **Build a game** editor authors a whole reusable project, not only one play start. `title`, `subtitle`, `gameProject.premise`, `setting`, `writingStyle`, `calendar.startDate`, and `gameProject.ai.{intent,scene,daypart}` describe the game and its separate AI jobs. The instructions are prepended to the matching task. Structured output validation and deterministic mechanics remain in code.

`startOptions` defines one or more campaign entry points (`id`, `title`, `description`, `playerLocation`, `tick`). Each campaign stores `startId` and is replay-validated against that same pack. `worldEvents` use inclusive `startDay`/`endDay` values relative to the start; active events appear in the scene inspector and daypart prompt. `schedules` are repeating tick periods with authored location stops. `initialRelationships` seeds trust for the registered social relationship module; it also sets how the lead NPC talks: under 5 (with no shared history) they read as a guarded stranger, 40+ as a friend who teases and confides, 75+ as close. Give anyone who already knows the player 40 or more. A `social.dating` phase (crush, dating, strained, rejected, broken) outranks trust. `daypart.hangouts` can restrict candidates by a world flag or minimum trust; `backgroundOnly` characters are explicitly excluded from appearing during intro narration.

Characters support personality, appearance, traits, voice, backstory, goal, likes/dislikes, year/rank, major/occupation, home, and an optional portrait. Locations support optional backgrounds. The project editor can upload PNG, JPEG, and WebP art up to 3.5 MB per image. Assets are stored in `data/scenarios/media` and safely served by generated IDs. Project JSON export embeds those images; import rewrites IDs on the destination installation.

Keep `data/scenarios` when replacing the application folder. It contains drafts, published projects, and uploaded art. Existing campaign saves bind to the precise published project digest, so republishing changed content creates a new pack version and leaves old campaigns intact.

The project editor does not yet define arbitrary AI task schemas, phone/social-feed interfaces, multi-axis relationship rules, breakup mechanics, or generated memory-ledger jobs. These remain explicit expansion work; new gameplay semantics require a registered module and tests.

### Scenes, invitations and character progress

Use **Requires completed scene** in Studio to build a storyline across several scenes. Route testing displays these unlock links and reports circular prerequisites that would keep every scene in the cycle locked. It also checks that every stable plan ID resolved or awaited later is created by an authored choice.

Define reusable true/false state under **Story variables**. Each variable has a stable ID, a creator-facing name, and a starting value. Studio uses these definitions in scene condition and effect selectors. When a project defines variables, validation rejects misspelled references in scene conditions, scene effects, activities, and locked exits; older projects without definitions retain their existing free-form flags.

With `gameProject.conversationStyle: "continuous"`, opening a Morning, Afternoon or Evening activity starts a persistent scene. Free-text replies inside it cost no time. The scene ends when its purpose is complete (model-proposed or authored ending), the player or NPC leaves, a sharp trust drop makes the NPC walk out (`boundary`), or `gameProject.sceneTurns` exchanges (default 12) run out. Only then does the clock advance to the next period, exactly once.

`social.invite {character,to}` is the deterministic invitation operation. Typed phrasings such as "Mina, come to my room", "invite Ada to the workshop", or, with exactly one person in the scene, "come with me to the park" / "let's go to the park" are routed to it before the model sees the turn. The rules decline when the character is not with the player (`absent`), there is no route (`unreachable`), their schedule needs them elsewhere during the period (`busy`), the dating phase is `rejected` or `broken` (`relationship`), trust is too low (`trust`), or a private place conflicts with a recent intimacy decline or cooldown (`boundary`). Trust thresholds come from `invitations.{publicTrust,privateTrust}` (defaults 0 and 40) and are waived while dating or exclusive. A location is private when `private: true` or when it has an `owner` (an actor ID); "my room" resolves to the location owned by the player, and "her/his/their room" to the one owned by the invited character. An accepted invitation moves both characters, restarts the scene there with the guest, costs travel time plus one tick, and sends the guest home when the scene ends. A declined invitation costs no time and is narrated with the rule text, never by the model.

For continuous conversations, `actor.conversationStarters` is an optional list of player lines shown under **Need ideas?**. Selecting one copies it into the normal free-text composer so the player can edit it before sending. These prompts never commit an action by themselves. During a group conversation, prompts follow the character who spoke most recently. Studio exposes them as one suggestion per line and keeps movement or ending commands in a separate **Scene controls** group.

The **Characters** dialog shows, for each character, their location, availability ("With you now", "Here", "At X", plus their next scheduled move), relationship stage (the dating phase, or a trust band), recent stat changes, shared memories, promises, and known preferences (discovered dating preferences, known intimacy interests, and liked/disliked items from the turn ledger). Set `showRawCharacterStats: true` to show raw Trust, relationship dimensions (for example Love/Lust), Chemistry and Satisfaction. Every stat event carries a `text` of the form `Mina: Trust 52 → 55`, and it appears as immediate feedback after the turn.

## Modular game composition (0.5)

Every new blank project starts with only `social.conversation`. In **Gameplay modules**, creators can enable the registered systems the game needs: relationships, schedules, objectives, inventory, abilities, inspectable objects, daypart scenes, and world events. The catalog supplies a title, description, version, and prerequisites for each module.

Dependencies are enabled recursively. For example, relationships needs conversation, and inspectable objects needs inventory. Turning a prerequisite off also turns off active dependants. The builder retains their authored data, but hides the corresponding gameplay and authoring UI until re-enabled. This keeps settings and game content portable while a project experiments with its mechanics.

Gameplay modules are registered code, while each game's configuration and content are project data. The module catalog is not a plug-in loader: introducing a new kind of behavior still requires implementing and testing a module. The core stays focused on shared actions, state, validation, persistence, and AI context assembly.

## Image slots and preparation (0.6)

Use the location **Scene background** slot for environment art. The browser center-crops it to 16:9, resizes to 1920×1080, and exports a quality-adjusted JPEG under 3.5 MB. Compose important subjects away from the edges because ultra-wide and portrait sources are center-cropped.

Use the character **Sprite art** slot for a cutout PNG with transparent pixels. The builder fits the full image inside a 1024×1536 transparent canvas without cropping or stretching. It checks that the source PNG contains transparency and keeps the exported result under 3.5 MB. Transparent padding around the character is preserved.

Only the prepared images are stored in project media and embedded by project export/import. The server checks the output type and dimensions for typed image slots. Older projects with existing generic PNG, JPEG, or WebP assets remain loadable; new typed uploads receive the stricter preparation.

## Presentation styles (0.7)

`gameProject.presentation` selects `visual-novel` or `classic`. New projects default to `visual-novel`: it uses the current location background as a full scene stage, places present characters' sprite art at the left/right positions, and overlays speaker/narration text, available action buttons, and the free-text input. The side controls toggle the journal, character cutouts, and background. Choose `classic` for the earlier scene and information-panel layout. The preset changes presentation only; game state, mechanics, and campaign saves are shared.

The Visual Novel preset looks best with a 16:9 location background and transparent character cutouts. Characters without art remain represented in the text and character list; the preset does not generate missing sprites.
## Narrative fact ledger

Enable **Narrative fact ledger** in Gameplay modules. New blank projects enable it by default. When a configured model writes a substantive scene or conversation, it may propose up to three facts. Each fact names an authored character, place, item, or object and quotes an exact excerpt of the scene. The engine checks the subject and source before saving it. This extraction can add one model request for a substantive scene. Offline demo play does not generate facts.

Open **Memory manager** during a campaign to review sourced facts. Correct a fact, retire it, or merge it into another fact about the same subject. Corrections remain in the save and affect later prompts; the original scene and generated fact remain available for inspection. Search for a topic in the manager to preview facts selected for the player. Retrieval also considers characters and places in the current scene, respects who knows the fact, removes duplicate wording, and limits the prompt budget. The Context and turn inspector shows the current selection and omissions.

The fact ledger stores narrative knowledge. Item ownership, equipment, relationship scores, and flags require their respective authored rule modules. Published projects keep their module versions; enable the ledger in a draft and publish a new project version if you want it for future campaigns.
# Storylet hands and fixed runs

Set a scripted scene to `"offer": "hand"` when the player should choose it from the current daypart's cards. `timeCost` is the number of world ticks spent when the card starts. Its ordinary `when` block controls availability; add `offerHint` to keep an unavailable card visible with an authored clue. Omit the hint to hide the card until it becomes available. The scene still uses the same pages, choices, effects, replay, and validation as an automatically triggered scene. Set `"offer": "director"` instead to let the drama director deal the scene as a random event action the player can choose (see [DRAMA-DIRECTOR.md](DRAMA-DIRECTOR.md)): such scenes are never auto-triggered and form the director's reward deck — stats, money, loot and affection behind meaningful choices.

The older boolean `storylet` field still means “allow at most one automatically triggered side scene per daypart.” It is separate from the hand.

An optional fixed campaign calendar uses:

```json
"run": {
  "days": 14,
  "defaultEnding": "closing-time"
}
```

This requires the `story.endings` module. At the deadline, the engine finishes an active scene, chooses the eligible ending with the highest numeric `priority` (pack order breaks ties), and uses `defaultEnding` if none qualify. The default ending is therefore a required safety net and may have conditions that are not met.
