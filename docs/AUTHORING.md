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

A fact has `id`, `text`, and `knownBy` (either `"public"` or an array of actor IDs). Use `supersedes` to replace an older fact. Filtering happens before retrieval. This is a simple authored fact system; dynamic rumor propagation and a separate belief simulator are not implemented yet.

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

The context builder selects character-visible facts, up to six older promises, recent memories, and recent accepted dialogue. It does not implement embeddings or generative memory summarization. Extremely large authored biographies/facts are not token-budgeted yet; keep packs compact.

Narrative prose can still contradict facts even when game state is protected. Use the live-model evaluation fixtures before claiming narrative consistency.

## Saving and migrations

SQLite writes replace the complete campaign snapshot in an atomic statement with an expected-revision check. The event journal is included in that snapshot, so accepted events and state commit together. This keeps prototype code simple but is not optimized for very long campaigns.

`migrateSave` requires a backup callback, copies input, and applies trusted sequential migrations. There are no historical production migrations registered because this is the first version. Imports accept only version 1; future migration functions need explicit fixtures and a host integration. Pack migration remains manual and intentionally blocks incompatible saves.


## Living World pack fields (0.2)

The new `packs/living-world.json` and `packs/other-world.json` demonstrate setting interchange while preserving the older fixtures and their saves.

`objects` contains `id`, `name`, `location`, `description`, optional `tags`, `reveals` (item IDs), and optional `effectFlag`, `requiresItem`, `useText`. Enable `world.objects` with `items.inventory`. An item can set `hidden: true` and is unavailable until an object reveals it. `world.explore` supports inspect and search plus take in one committed action. `items.place` puts a carried item in the current location. New object behaviors need module code; fields do not execute arbitrary scripts.

`lorebook` entries have `id`, `text`, `tags`, `scope` (`world`, `location`, `character`), `knownBy`, and a scope target. Candidate entries are visibility-filtered first, then ranked by current location, mentioned tags, and character. Selection is capped by a character budget. The context inspector exposes selected entry IDs and reasons. This is an initial retrieval implementation, not a full SillyTavern World Info importer or embedding search.

Characters can add `traits`, `backstory`, `likes`, `dislikes`, `voice`, and `goal`. The character speaking is given its own profile and actor-visible memories. Background-only characters in a daypart job receive shorter context and explicit restrictions.

`daypart` contains `interval`, `labels`, `introLocation`, `event`, `hangouts` (eligible character IDs, meeting place and plan), and `backgroundOnly`. Enable `world.daypart`. `world.nextDaypart` advances to the next boundary and moves the player to the authored private scene location; the AI then writes an intro and invitations. This first version's eligibility supports an optional flag and minimum trust. More advanced calendars and scheduling predicates would require further work.

The accepted event journal is stored in the save and available at `/api/journal` as JSONL. Generated prose and invitations are stored on the corresponding turn. The AI receives a bounded, visibility-filtered recent selection from that journal. A long-running game will need periodic summarization and stronger token budgeting.


## Game projects (0.4)

The home screen's **Build a game** editor authors a whole reusable project, not only one play start. `title`, `subtitle`, `gameProject.premise`, `setting`, `writingStyle`, `calendar.startDate`, and `gameProject.ai.{intent,scene,daypart}` describe the game and its separate AI jobs. The instructions are prepended to the matching task. Structured output validation and deterministic mechanics remain in code.

`startOptions` defines one or more campaign entry points (`id`, `title`, `description`, `playerLocation`, `tick`). Each campaign stores `startId` and is replay-validated against that same pack. `worldEvents` use inclusive `startDay`/`endDay` values relative to the start; active events appear in the scene inspector and daypart prompt. `schedules` are repeating tick periods with authored location stops. `initialRelationships` seeds trust for the registered social relationship module. `daypart.hangouts` can restrict candidates by a world flag or minimum trust; `backgroundOnly` characters are explicitly excluded from appearing during intro narration.

Characters support personality, appearance, traits, voice, backstory, goal, likes/dislikes, year/rank, major/occupation, home, and an optional portrait. Locations support optional backgrounds. The project editor can upload PNG, JPEG, and WebP art up to 3.5 MB per image. Assets are stored in `data/scenarios/media` and safely served by generated IDs. Project JSON export embeds those images; import rewrites IDs on the destination installation.

Keep `data/scenarios` when replacing the application folder. It contains drafts, published projects, and uploaded art. Existing campaign saves bind to the precise published project digest, so republishing changed content creates a new pack version and leaves old campaigns intact.

The project editor does not yet define arbitrary AI task schemas, phone/social-feed interfaces, multi-axis relationship rules, breakup mechanics, or generated memory-ledger jobs. These remain explicit expansion work; new gameplay semantics require a registered module and tests.

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
