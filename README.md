# Story Framework · prototype 1.11

## Multi-step events and event debugger

The **Friday Exhibition — Event Chain** sample demonstrates a scene that pauses and resumes. Start its Friday morning opening, press **Wait** four times, choose **Look at the sketch**, then talk to Brin. You can use **Talk to Brin** or type “I ask Brin about the sketch and promise to help.” Her conversation is recorded, the scene resumes at its next beat, and the support choice becomes available after trust rises. The optional **Event debugger** panel in the play view lists each scripted event's status, missing world conditions, awaited event, and locked choices.

In **Build a game → Scripted scenes**, add next beats and connect a choice to a beat. Choose an optional event to wait for, such as `social.spoke`, and an exact payload match such as `{"target":"brin"}`. The scene pauses while the player can travel, talk, or use other systems; it resumes only after a later committed event satisfies that condition. Each beat has its own opening, pages, stage directions, and choices. Choices can require a flag, carried item, or minimum trust, and every beat needs an unconditional choice so it cannot trap the player. A final choice completes the event. These transitions and their effects are saved and replayed deterministically.

## Structured AI scene pages

When a local AI model is connected, scene narration now requests short JSON visual novel pages with a speaker, text, and optional background and stage directions. The game sanitizes the reply against the committed cast and the project's uploaded backgrounds and character poses. Unknown or absent speakers become narration; invalid stage directions and asset paths are removed; the screen holds at most four characters. Long multi-sentence pages are split before display. The accepted pages are saved with the turn and replayed on load. These directions only change presentation: items, trust, location, flags, and scripted events still come from committed game actions.

If a model returns plain prose instead of scene JSON, the game converts it to narration pages. If generation fails entirely, the existing saved-action fallback and retry remain available. For a hands-on test, connect a local model under **AI settings**, play **Friday at the Workshop**, and type “Go meet Brin in the Workshop” from a fresh campaign. Finished art is optional; the sample includes placeholder poses.

## Weekly routines, conditional scenes, and visual novel pages

The **Friday at the Workshop** sample starts on Friday morning. Use **Wait** four times: Brin arrives for Friday afternoon and starts a scripted scene. Read the pages, see her smile pose, and choose a branch. Copy this sample in **Build a game** to inspect its rules.

In **Character schedules**, choose where a character goes on any weekday during Morning, Afternoon, or Evening. A blank cell keeps the current location. Existing repeating tick stops remain under Advanced. If a weekly and repeating stop coincide, the repeating stop wins.

In **Scripted scenes**, combine an event trigger with weekday, daypart, player location, character location, carried item, flag, and trust conditions. Add authored pages with a speaker, background, and `show:character`, `hide:character`, or `sprite:character,pose` stage actions. Pages play before the branch buttons become available. Backgrounds and sprites must already exist in the game project. The game saves the triggered event and choice effects; page display is derived from the published project and saved scene ID.

Invitations and free-form meetings now both follow reachable exits, spend travel time, and check the character's schedule at arrival. A missed meeting records its outcome without staging the character. The daypart transition still returns the player to the authored introduction location.

## Programmed travel and meetings

Free-form scene travel follows authored exits and consumes one tick per edge. Meeting requests check the character's scheduled location after travel and activity time. If the character is elsewhere, the game records the missed meeting and leaves them off screen. The scenario builder's location exits and character schedules control this behavior. Accepted daypart invitations remain a separate scripted meeting flow.

## Seven-day calendar

Time now runs through **Monday to Sunday**, with **Morning, Afternoon, Evening** each day. The number of ticks per part stays configurable in the Daypart section (four by default). **Start next part of the day** advances to the next boundary, and the clock, world-event windows, and AI prompts share the same calendar. The builder accepts an optional ISO start date (which supplies the actual weekday) or a selected starting weekday. The week starts at the campaign's first day and rolls over after seven days. Existing packs and saves load without changing their files; their old `daypart.labels` text is ignored by the display and prompts in favor of the fixed three-part clock.

## Programmable activities and action settlement

The builder has an **Activities** section. Each activity names its place, duration, alternative phrases, optional flag/item/character/trust requirements, once-only rule, and authored flag/trust/item effects. A model can select an authored activity from the current game's catalog. The engine validates it, commits its effects and time, and emits `world.activityCompleted` for scripted scene and quest triggers. Natural-language take/place/give proposals also pass through engine ownership, visibility, cast and location checks before an item moves. Rejected proposals leave the save unchanged and show the reason in the status area; accepted events appear in the turn inspector.

Try **The Workshop — Activities**: type `Set up the exhibition` to prepare the display, then choose **Tell Ada it is ready** in the scripted scene. You can also type `Work a shift` for a repeatable activity. Existing sample packs remain untouched for save compatibility. Offline mode recognizes the activity name and its alternative phrases; a configured model can classify less literal wording. The model does not invent new gameplay effects: define them in the builder.

## Continuing scenes and consequences

After a free-form meeting or exploration request, ordinary follow-up text continues that scene at the same place with the same cast. A new travel, meeting, or rest request opens another scene. Rest closes the active scene. A generated character ledger records up to three short, validated memories from a successful narrated turn; future prompts retrieve the relevant memories. This ledger is advisory context, not an automatic relationship score. Authored scripted scene triggers and choices remain the way to create flags, item changes, and trust changes. The builder now exposes activity-specific triggers, structured character schedule stops, and a character memory instruction. A model that does not support the ledger call simply leaves the ledger empty.

## Free-form scene requests

Typed requests such as `Go to sleep`, `Go meet Ada`, and `Go to Workshop` now stage a scene. The classifier extracts an authored destination, people actually in the scene, and an activity; the engine commits travel and time before asking the model to narrate. A rest scene advances to the next daypart boundary. Existing explicit action labels still work for inventory, choices, and scripted mechanics. Unknown place names remain at the current location rather than creating a new map location. Free-form scene narration cannot mint items, flags, or relationship points; those need authored game rules. The offline demo uses simple name matching and template prose. A configured AI model produces scene prose and classifies freer requests.

## Desktop window (Electron)

On Windows, extract the ZIP into a writable folder and double-click **Start-Desktop-Windows.cmd**. Install Node.js 24 or later first. The launcher runs `npm install` once to fetch Electron, then starts the game in a desktop window. It needs internet access on the first launch; later launches use the installed dependency. Close the window to stop its local server. Your saves and authored projects remain in `data/`; copy that folder into a new extracted release when updating. You can still use `Start-Windows.cmd` to play in a normal browser without installing Electron.

Electron is a window around the same local game server and builder. It does not supply an AI model: start Bionic's OpenAI-compatible server and choose its endpoint and loaded model in **AI settings**. Use **Test connection** and **Test story scene** before playing.

A modular, single-player AI narrative-game framework. Its primary product target is an adult eroge/dating sim with optional NSFW scenes, character-specific romance difficulty, consent-aware intimacy, casual and long-form routes, and persistent social consequences. Adult systems remain optional so the same engine can run non-adult and non-romance packs. The repository also includes playable fixtures, an offline demo writer, a configurable chat-completions adapter, and an experimental SillyTavern extension build.

## Playtest with a local LLM (1.0)

1. In **LM Studio Bionic**, download a local **chat/instruct** model, then enable **Settings → Local Model API → Local API server**. The default local port is 1234. In the separate LM Studio app, use **Developer → Start server** instead. Ollama on port 11434 also works. Bionic cloud sessions are not served by this local connection.
2. Run `Start-Windows.cmd`, then click **AI settings** in the game's header.
3. Select **Bionic / LM Studio · 1234** or **Ollama · 11434**, click **Find models**, choose your loaded model, and click **Test connection**. Then click **Use local AI**. The game stores the local endpoint and model ID in `data/ai-settings.json` and restores them on restart. It does not store or require a local API key.
4. Start **The Workshop — Scripted Scene**. Go to Hub → Workshop. Choose a branch, talk to characters, then advance the daypart. Open **Context and turn inspector** to see committed actions and selected lore. The local model interprets free text and writes narration; the game engine owns items, scene triggers, flags, and relationships.

The model runs in Bionic, LM Studio, or Ollama, outside the game server. Keep its local API server running while playing. If **Find models** cannot connect, confirm the server is started. **Test connection** checks connectivity only; a successful READY does not prove that the model can follow the game's structured scene format. When scene generation fails, the turn now shows the actual error and saves temporary prose without losing the action. A small or non-instruct model may need replacement or a larger context window. Calls can take up to 120 seconds. **Use offline demo** switches back without deleting saves.

Invitations generated for a new daypart appear as **Meet [character]** actions. Choosing one takes the player and invited character to the authored meeting location; it consumes an action and expires when another action is chosen. An invitation location must match a location name or ID in the game project.

Visual novel view is now the default for all examples. Use **View: Visual novel** in the header to switch to the compact layout. Each committed response is presented as individual narration or speaker pages. Click the dialogue box, **Continue**, or press Space/Enter to advance. Choices and free text appear after the last page; daypart invitations appear as phone messages with meeting buttons. An AI failure shows its specific reason and a **Retry writing** button for the latest turn. Retrying updates only that turn's prose; it never repeats the player's mechanical action or changes the clock. Use **Test story scene** in AI settings to check whether your model can follow the daypart JSON format. The request asks for JSON mode; replies with surrounding explanation or code fences are parsed when possible. If the test still fails, its message now includes the start of the model reply to help diagnose the model. **The Workshop — Visual Novel Demo** has placeholder background and character art; replace those in a project draft to make your own setting.

You can still configure an OpenAI-compatible endpoint through `STORY_ENDPOINT` and `STORY_MODEL` as described below. The in-app AI settings are for loopback servers only.

## Venus University source integration (0.9)

This personal build includes adapted **AGPL-3.0-only** source from Venus University's public snapshot: lore key matching and stage instruction parsing. Lore now recognizes complete aliases (including multiword aliases) on word boundaries; named off-screen characters are supplied as background context with an explicit absence rule. Scripted scenes can author `show:actor`, `hide:actor`, and `sprite:actor,pose` stage actions. The builder supports additional transparent pose images for each character and includes them in project exports. **The Workshop — Scripted Scene** demonstrates a pose change using original placeholder art.

The copied source and its license are in `vendor/venus`. See `vendor/venus/NOTICE.md` for exact upstream files and changes. No Venus University assets or world content are included. If you ever distribute this combined program, review and meet its AGPL terms first.

## Scripted scenes (0.8)

**Build a game → Scripted scenes** now supports authored event triggers, conditions, player choices, and deterministic effects. A scene can trigger when the player moves, inspects, speaks, takes an item, or when another module emits an event. It can check the location, time, flags, owned items, and trust. Choices can set flags, change trust, or move items. The game saves the exact chosen branch and its effects; the AI writes prose around the committed result. Start **The Workshop — Scripted Scene**, go to Hub, then Workshop to try it. Existing sample packs and saves remain compatible.

The comparison against Venus University's public source and what remains to build are in `docs/VENUS-COMPARISON.md`. No Venus University source or assets are included.

## Build a game project (0.7)

Open **Build a game** from the home screen. A game project contains the setting, premise, writing style, AI instructions for player intent, scene narration and daypart scenes, cast, places, lore, schedules, world events, starting relationships, uploaded art, and one or more playable openings. An opening makes a new campaign at its own location and clock state, while campaigns continue to use the exact published project version they started with.

Copy a built-in project or start blank. A blank project begins with the small conversation core; enable only the gameplay modules that fit the game. The editor shows each module's dependencies, enables prerequisites automatically, and hides authoring panels when their module is off. Turning a module off keeps its data in the project so it can be re-enabled later. The editor validates IDs and references, saves drafts locally, and can publish a playable version. **Export project JSON** includes uploaded portraits and backgrounds; **Import project** brings the project and art to another installation. Prepared images are limited to 3.5 MB each. Keep `data/scenarios` when updating the app to preserve project drafts, published versions, and uploaded images.

Images use type-specific preparation. Location backgrounds are center-cropped to 16:9 and resized to 1920×1080 JPEG. Character art must be a PNG with transparent pixels; it is fitted without cropping into a 1024×1536 transparent canvas. Prepared images are capped at 3.5 MB. New projects default to the **Visual novel scene** presentation: it layers character cutouts over the background and places narration, choices, and free-text input in a dialogue stage. Select **Classic harness** for the simpler scene-and-panels layout. Presentation changes only the UI; both layouts use the same game rules and campaign data. The game clock activates date-windowed events, moves scheduled characters as time advances, seeds initial trust, and generates a daypart introduction with eligible invitations when those modules are enabled. The project’s AI instructions are included in the relevant AI task prompt; engine validation still decides actions and state changes. Current modules cover conversation, relationships, schedules, objectives, collectibles, abilities, inspectable objects, daypart scenes, and world events. New gameplay behavior still needs a registered code module; projects compose existing mechanics without changing the core.

This is now a game-project builder and playable harness foundation, not a completed Venus University-sized game. It still lacks a full phone/social-feed UI, rich multi-axis relationships and breakup rules, AI memory-ledger job, authored scene/route graph editor, layered character poses, and long-term memory summarization. A configured model is required for generative prose; offline mode uses templates.

## Windows loading fix (0.1.1)

Fixed a Windows path separator issue that caused the browser to show `{"error":"File not found"}` at the local address. SillyTavern is optional and is not needed to launch this app. Replace the entire extracted folder with this updated ZIP, then run `Start-Windows.cmd` again.

## Start on Windows

1. Install **Node.js 24 or later** if you do not already have it.
2. Close any older Story Framework server window first (Ctrl+C), then extract this entire folder somewhere writable. If an old server is still using port 4317, the browser may display the old version.
3. Double-click **Start-Windows.cmd**.
4. The browser opens http://127.0.0.1:4317. Keep the server window open.
5. Choose a scenario. Use buttons first; no AI key is required.

If the browser opened before the server was ready, refresh it. To stop, press Ctrl+C in the server window. This is a local browser application with a Windows launcher, **not an Electron installer or an EXE**. It has no npm runtime dependencies and needs no `npm install` for normal use.

macOS/Linux or terminal:

```sh
npm start
```

## Earlier prototype features

The 0.2 iteration added two **Living World** projects to the project picker. They use the same core with different lorebooks, objects, character traits, schedules, and optional abilities. The previous two scenarios remain available, so saves made with them still load.

The main input is now a conversational text box. Suggested actions are tucked underneath. The offline writer interprets common phrases and uses templates; a configured model can interpret the bounded action proposals and write narrative text. The game still checks object state, item ownership, and invitations before committing results. The context inspector shows selected lore and recent action records. **Action journal** downloads accepted events as JSONL. The AI receives a filtered recent slice, not the entire file.

**Try the new loop:** start *The Workshop — Living World*. Type `Go to Hub`, then `Go to Workshop`, then `Search the workbench drawer and take whatever is inside.` The brass token was hidden before the search. Open **Known facts and lore** to see location lore; open **Context and turn inspector** for the selected sources. Type `Go to Hub` and talk to Ada about the exhibition. Use the suggested **Start next part of the day** action to advance to a private room and receive two invitations. In *Across the Threshold — Living World*, the same scene job produces one invitation from the Warden.

The daypart writer validates 3–5 narration lines, exactly one invitation per eligible character, and empty unused fields. It saves those messages separately from the committed time change; provider failure produces a deterministic fallback without advancing time twice.

## What to try

**The Workshop Errand (legacy fixture):** Go to Workshop → Take Notebook → Go to Hub → Give Notebook to Ada. Alternatively, go to Meeting Room and wait until Ada arrives at shift 4; speak to her there. The schedule repeats every 12 shifts. You can miss the meeting and recover later.

**Across the Threshold (legacy fixture):** Go to Threshold → Attune → Go to Observatory → Take Star compass → Go to Threshold → Go to Sanctuary → Give Star compass to Warden. Attune costs 3 resonance and 2 pulses. Rest restores resonance and costs 3 pulses.

These fixtures demonstrate systems in a few minutes; they are not the planned 20–30 minute content slice and do not select the eventual game's setting.

For conversation in offline mode, type `talk to Ada: I promise to return your notebook.` When only one other character is present, ordinary text is addressed to them. The offline writer is intentionally a template-based demo, not an LLM. Natural-language commands in this mode are limited to action labels and this conversation syntax.

## Connect a model

The adapter accepts an endpoint implementing a chat-completions request/response shape. The in-app AI settings above are the easier path for local models. For command-line configuration, use the **complete URL**, including `/v1/chat/completions` where your server requires it. It supports local HTTP and remote HTTPS.

PowerShell, in the project folder:

```powershell
$env:STORY_ENDPOINT = 'http://127.0.0.1:1234/v1/chat/completions'
$env:STORY_MODEL = 'your-loaded-model-id'
# Set STORY_API_KEY if your endpoint requires it.
$env:STORY_MAX_REQUESTS = '100'
node server.mjs
```

Credentials are read from the server environment and are not saved into campaigns or sent to the browser. Restart the server to change provider settings. Model requests have a 30-second timeout, a request-count cap, one intent-repair attempt, and deterministic narrative fallback. Cancellation before commitment spends nothing; cancellation after commitment keeps the accepted action and uses fallback narration.

The adapter's HTTP protocol was tested with a local stub. No paid/cloud model or real local inference model was available for quality evaluation. Support is not guaranteed for every endpoint or model. Token usage is collected by the adapter when returned; there is no dollar-denominated billing cap or usage dashboard yet.

## Commands

```sh
npm test                  # regression tests
npm run validate          # validate both bundled packs
node scripts/validate.mjs packs/my-pack.json
npm run build:st          # regenerate the experimental ST extension
```

See `docs/SILLYTAVERN.md` for that integration, `docs/AUTHORING.md` for project content and modules, and `docs/MILESTONES.md` for completion and verification status.

## Saves and portability

Campaigns autosave in `data/campaigns.sqlite` after every accepted action, before the model writes the response. Completed responses are then saved separately. A pending response is recovered on load; the game action is not repeated.

Use **Export save** and **Import save** to move campaigns. Imports verify the mechanical state against the recorded commands and the exact content pack. Import creates a separate campaign. Edited packs require a deliberate migration; the prototype will refuse an incompatible save rather than guess. Keep the original pack alongside long-lived campaigns.

The local owner can inspect all campaign state, including NPC facts. Character secrecy is enforced in AI context assembly, not through encryption from the owner. Imported narration renders as text, not executable HTML.

## Architecture

- `packages/core`: deterministic actions, event patches, transaction drafts, module resolution.
- `packages/contracts`: TypeScript declarations documenting boundaries.
- `packages/modules`: independent social, inventory, schedule, objective, object, daypart, and ability mechanics.
- `packages/ai`: context projection, providers, and turn orchestration.
- `packages/persistence`: SQLite store, portable saves, migration utility.
- `packs`: JSON scenario content.
- `public`: presentation, styles, and original geometric SVG placeholder backgrounds.
- `integrations/sillytavern`: original adapter and extension shell.
- `tests`: regression and model-evaluation fixtures.

Implementation uses dependency-free JavaScript ES modules plus TypeScript contract declarations. It does not yet use the design's proposed React/Electron stack, nor a fully type-checked TypeScript implementation. These choices keep the first runnable prototype easy to launch and the core importable by multiple hosts.

## Scope

This is a developer prototype spanning all eight roadmap areas, not a production-certified framework. The UI could not be visually verified in the build environment because no browser binary was available and its download failed. Browser checks are supplied in `scripts/ui-check.mjs` for an environment with Playwright installed. Windows execution itself and an installed SillyTavern instance were not available for testing.

No SillyTavern source or Venus University assets are included. This personal build does include the adapted Venus University code identified in `vendor/venus/NOTICE.md`, alongside original implementation code and original placeholder illustrations. Its AGPL terms matter if the combined program is distributed.

## Scene logic update (1.15)

See [the scene logic notes](docs/SCENE-LOGIC-1.15.md) for fixes, upgrade steps, request traces and testing limits.

## Attendance update (1.16)

See [attendance and conversation fixes](docs/SCENE-LOGIC-1.16.md) for the latest changes and upgrade instructions.

## Scene lifecycle (1.17)

See [scene lifecycle notes](docs/SCENE-LIFECYCLE-1.17.md) for closing, summaries, attendance, and upgrade instructions.

## Venus system inventory (1.18)

See [the full source audit](docs/VENUS-FULL-SYSTEM-AUDIT.md) and [per-file inventory](docs/VENUS-SOURCE-INVENTORY.csv) for coverage, missing systems, and modular port sequence.
