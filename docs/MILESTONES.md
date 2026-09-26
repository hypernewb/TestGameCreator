# Milestone evidence — 23 September 2026

Implementation traverses M1 through M8 in order. “Implemented” means prototype functionality exists and the listed tests passed, not that all production acceptance gates from the original design have been met.

| Milestone | Implementation delivered | Verification | Remaining gate |
|---|---|---|---|
| M1: contracts/content | Contracts, namespaced IDs, validation, exact module versions/dependencies, neutral pack | Invalid references, duplicate IDs, dependencies, versions and cycles tested | Full schema tooling and implementation-wide TypeScript checking |
| M2: deterministic loop | Movement, inspect, wait, action buttons, local scene UI | 20-action determinism and event replay; HTTP UI delivery | Visual browser QA; no installed browser could be obtained |
| M3: persistence | SQLite autosave, expected revisions, turn IDs, pending narrative recovery, export/import, migration helper | Disk close/reopen, duplicate retries, replay-validated import, backup and failed migration tests | Real migrations for future versions; long-campaign performance |
| M4: AI | Mock, HTTP chat-completions adapter, intent validation/repair, fallback, timeout/cancel, request cap | Local HTTP stub, malformed output, malicious proposals, outage, timeout and cancellation tests | Real model configuration and quality/latency evaluation |
| M5: continuity | Actor knowledge projection, source-linked memory, promise retention, recent accepted replies, authored fact supersession | 30-turn promise retention and private fact/conversation isolation | 24-case live-model evaluation and human ratings; summarization and token budgets |
| M6: mechanics | Inventory, directional trust, schedule, event-driven objectives | Ownership, location, repeat-reward, alternate solution, missed-meeting recovery tests | Richer relationship dimensions, condition language, balancing |
| M7: modularity | Second fixture, separate ability module, different durations, module removal | Both scenarios complete through core tests; independent module removal works | Creator usability testing |
| M8: tools/delivery | Pack validation CLI, turn inspector, source ZIP, Windows launcher, extension build, documentation | Server API integration, export/import, unsafe pack path and origin checks | Native desktop installer, Windows hands-on test, visual QA, installed ST test |

## Results

- 31/31 Node regression tests passed on Node 24.19.0 in Linux.
- Both fixture packs passed validation.
- The SillyTavern distribution folder built successfully; its adapter passed a mocked host API test.
- HTTP provider transport was exercised against a local compatible stub. No actual model credentials or inference endpoint were supplied.
- Browser automation was attempted. No browser executable was installed; the browser download returned invalid/truncated archives. The browser walkthrough script is included but its completion is **not claimed**.
- The fixture content is short (several minutes), not a 20–30 minute finished slice.

## What is intentionally not present

Full combat, economy, rumor propagation, autonomous NPC planning, embeddings, generated memory summaries, runtime art generation, TTS, visual pack editor, a public mod SDK, native installer, or cloud hosting. These are expansion work, not hidden completed features.

The first implementation uses plain JavaScript ES modules with TypeScript declarations and a local browser UI. React and Electron remain possible presentation/packaging replacements, not dependencies of the core.

## How to finish the external gates

1. Run `Start-Windows.cmd` on the target Windows machine and complete both scenarios.
2. Run the optional `scripts/ui-check.mjs` in an environment with Playwright/Chromium; inspect the saved images.
3. Configure a model and run `node scripts/evaluate-model.mjs`. It can make approximately 50–75 requests including repairs; the adapter caps this run at 100. Review the output manually for continuity, distinct voice, and repetition.
4. Install the generated extension in an actual ST instance and repeat actions, export, reload, and provider-failure checks.
5. Only then choose whether the first public release should remain a local web app or gain an Electron installer.

Windows static-file path fix: cross-platform path containment now uses the runtime path API. Regression test covers Windows backslashes and path traversal.


## Revision 0.2 against the clarified direction

Implemented: two new data-driven world packs, discoverable objects and hidden inventory items, examine/search/take/place/use commands, location and character lore selection, character trait context, bounded recent action retrieval, daypart intro job, exact invitation schema validation, artifact persistence, action-journal JSONL export, and a conversation-first UI. The original packs and their saves remain available.

Verified: 39/39 Node tests, including a complete HTTP exploration/journal/daypart flow, model-output repair against a stub, import preserving an invitation artifact, private lore filtering, and the same job under two settings. No real-model quality evaluation or visual browser verification was available in this environment. Natural language in offline mode uses simple phrase matching; a configured model is needed for broader phrasing. The UI is a playable harness prototype, not a Venus University feature-complete game.

## Revision 0.4 — game project builder

Implemented: reworked the authoring UI from “scenario studio” into a reusable game project builder; project premise, setting, calendar start, writing style, and separate player-intent/scene/daypart prompt instructions; multiple named starts per game with selectable player location and tick; scheduled character stops, day-windowed world events, starting relationship trust; richer character profiles; PNG/JPEG/WebP location backgrounds and character portraits; project JSON import/export with embedded uploaded media; generated-ID media storage and safe serving; active event and calendar context in play; job-specific project instructions added to model prompts.

Verification: 42/42 Node tests pass. New tests cover project-specific prompt use, alternate-start save replay, and uploaded art storage/serving/path rejection. All four bundled packs validate. Browser visual QA and Windows hands-on QA remain unperformed.

Still needed to approach a complete Venus University-scale game: phone/social-feed interface, flexible character eligibility and breakup mechanics, relationship dimensions beyond trust, structured AI scene ledger for per-character memories and consequences, story/activity authoring beyond starting points and events, richer portrait staging/poses, and long-run summary/token management. Project prompts are instruction text for supported jobs; adding a new kind of job or mechanic still requires a code module.

## Revision 0.5 — modular game composition

Implemented: a visible module catalog in the Game Builder; minimal blank projects; prerequisite-aware module selection; conditional authoring panels for module-owned data; retained dormant data when a module is switched off; and date-windowed world events moved behind the optional `world.events` module. Modules currently cover conversations, relationships, schedules, objectives, inventory, abilities, inspectable objects, daypart scenes, and world events.

Verification: 43/43 Node tests pass. New coverage checks module prerequisites and catalog bootstrap, that disabled world events do not enter AI context, that enabled events are validated and selected, and that blank projects begin with the conversation core only. All four bundled packs validate. Browser visual QA and Windows hands-on QA remain unperformed.

The builder composes registered systems; it does not load arbitrary user-written modules. Adding new mechanics still requires code and tests. Future work can make the module contract and creator experience more extensible, then add optional phone, social feed, richer relationship, and memory-ledger modules independently.

## Revision 0.6 — type-aware image authoring

Implemented: dedicated scene-background and character-sprite image slots. Backgrounds are center-cropped and resized to 1920×1080 (16:9) JPEG; character art requires transparent PNG and is fitted into a 1024×1536 canvas without cropping. Processing rejects excessively large sources and outputs over 3.5 MB. The upload API validates typed output dimensions and transparency-capable PNG encoding while legacy generic project assets remain supported.

Verification: 44/44 Node tests pass, including API checks that reject incorrectly sized backgrounds, opaque character PNGs, and nonconforming character dimensions. All four bundled packs validate. Visual browser QA and Windows hands-on QA remain unperformed.

## Revision 0.7 — visual-novel presentation preset

Implemented: a per-project `visual-novel` or `classic` presentation choice; the new-game default layers location art with large left/right character cutouts, a speaker tag and translucent dialogue panel, visible action buttons, and free-text input. Journal, character, and background controls are wired. Campaign mechanics and saves remain presentation-independent.

Verification: 44/44 Node tests pass and all four bundled packs validate. New projects default to the Visual Novel preset. Visual browser review and Windows hands-on QA remain unperformed.
