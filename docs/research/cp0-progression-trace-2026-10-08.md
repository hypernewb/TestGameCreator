# CP0 progression trace — 2026-10-08

Read-only mechanical diagnosis on committed `main` base `e4816ed`, branch `t-116`. Uncommitted edits in the main checkout are not included. No engine, pack, creator, UI or test changes; no model/provider requests in the trace. This does not establish enjoyment or writing quality.

## Method and evidence key

`node tmp/cp0/trace.mjs` uses `GameService` with separate `Store(':memory:')` databases, campaign seed 42, explicit commands and unchanged packs. No provider methods are configured; `fetch` is disabled in the trace. Campus free scenes therefore take the existing missing-narrator fallback (`packages/ai/service.mjs:330`), including exchange refund (`packages/persistence/store.mjs:27`). Campus fallback turns: `t0`, `t4`, `t8`, `t12`, `t14`, `t16`. Generated route scenes use authored presentation (`packages/ai/service.mjs:288`, `packages/ai/service.mjs:298`) and have no fallback turns. This preserves the shipped failure path, rather than simulating successful model narration.

The generated route uses the existing Huntrix fixture and `routeCandidate` → `createProposal` → `applyProposal`, approving its existing generated scene entries, as in `tests/route-skeleton.test.mjs:10`, `tests/route-skeleton.test.mjs:24`. Route: `rumi`; duration: seven days; existing placeholder prose; no new fixture. Generation is deterministic code, not a model request (`packages/cards/route-skeleton.mjs:88`). This generator does not enable `social.progression`, bonds or tempo; those absent systems are recorded rather than added.

Each table column's evidence key applies to every value in that column:

- **T — trust:** initial relationships applied at `packages/core/engine.mjs:204`; runtime gains/clamp/daily accounting at `packages/modules/romance-stats.mjs:21`, `packages/modules/romance-stats.mjs:23`. Talk gain at `packages/modules/social.mjs:107`; activity gain at `packages/core/engine.mjs:315`; route choice trust at `packages/modules/scenes.mjs:89`. Cap is conditional on a tempo profile (`packages/modules/romance-stats.mjs:19`).
- **B — bonds:** both packs omit `social.bonds`; “disabled” means no runtime bond store, not a measured zero. Enabled initialization and changes are `packages/modules/bonds.mjs:6`, `packages/modules/bonds.mjs:9`; context checks presence at `packages/ai/context.mjs:95`.
- **D — dating:** initialization `packages/modules/dating.mjs:167`; automatic crush evaluation `packages/modules/dating.mjs:78`, `packages/modules/dating.mjs:83`; phase setting `packages/modules/dating.mjs:95`. Score is chemistry plus matched authored preferences (`packages/modules/dating.mjs:75`).
- **S — stage label:** derived through `contextFor` then `relationshipStageOf`, dating/strain precedence `packages/ai/character-context.mjs:3`, trust/memory fallback `packages/ai/character-context.mjs:4`. The service uses this function at `packages/ai/service.mjs:130`. This is the computed context label; no model consumes it in this trace.
- **X — experience cue:** the gap analysis's untracked `packages/ai/relationship-experience.mjs` is absent at this base. No such cue is computed here. Existing ledger-memory context is computed at `packages/ai/context.mjs:89`; the exposed context returns at `packages/ai/context.mjs:135`. “Absent” is not a failed recognition test of that uncommitted module.
- **M — memories:** raw scene-talk record at `packages/modules/social.mjs:54`; classification/capture `packages/ai/memory.mjs:107`, `packages/ai/memory.mjs:114`; selected statement/action memories `packages/ai/memory.mjs:117`, `packages/ai/memory.mjs:128`, exposed via `packages/ai/context.mjs:83`. Authored memory effects would persist at `packages/modules/scenes.mjs:95`. Tables distinguish raw conversation records from selected context memories.
- **R — tempo:** points/cap/ready at `packages/modules/romance-tempo.mjs:46`, `packages/modules/romance-tempo.mjs:51`; rank advancement and unlock text `packages/modules/romance-tempo.mjs:67`, `packages/modules/romance-tempo.mjs:69`. This is separate from the B bond store.

## Shipped campus social pack

Pack `campus.ashford`, focused character Jana. Each row follows encounter closure; waits between encounters are not encounters. Movie starts occur at ticks 12, 24 and 36. Gift preparation travels to Campbells, buys the cinnamon roll, then meets Jana; the gift is given at tick 44 and the meeting closes at tick 48.

| Encounter / tick | Trust T | Bonds B | Dating D (chemistry / score) | Stage S | Experience X | Memories M: raw / selected | Tempo R |
|---|---:|---|---|---|---|---|---|
| Initial / 0 | 30 | disabled | available (10 / 10) | familiar | absent | 0 / 0 | roommate, 0 points |
| 1. Borkum talk / 4 | 31 | disabled | available (10 / 10) | familiar | absent | 1 / 0; raw `t0.2` | roommate, 0 |
| 2. Movie night, non-talk / 16 | 33 | disabled | available (10 / 10) | familiar | absent | 1 / 1; selected `t4` | roommate, 2 |
| 3. Movie night, non-talk / 28 | 35 | disabled | available (10 / 10) | familiar | absent | 1 / 2; `t4`, `t8` | roommate, 2 |
| 4. Movie night, non-talk / 40 | 37 | disabled | available (10 / 10) | familiar | absent | 1 / 3; `t4`, `t8`, `t12` | roommate, 2 |
| 5. Cinnamon-roll gift, non-talk / 48 | 37 | disabled | crush (17 / 17) | crush | absent | 1 / 4; previous three + `t16` | friend, 8; ready cleared |

Raw `t0.2`: “You talk to Jana: Tell me about Borkum. I would like to understand your island.” It is retained in the conversation store but filtered from selected context as a question. Selected `t4`, `t8`, `t12` describe watching each film plus the committed Charm result; `t16` describes meeting Jana with the pastry. All carry `knownBy: [player, jana]`. There are zero authored scene-memory records and zero impression-ledger rows. A gift's tempo “bond deepened” text does not create a B bond-store entry.

Movie-night tempo pays once: `processSignal` returns for an already-applied signal without `repeatable` (`packages/modules/romance-tempo.mjs:103`), even though the pack also specifies a cooldown. Trust continues to rise from the activity's authored effect. The pastry gives six tempo points and two chemistry; automatic rank advancement gives another five chemistry via the pack's dating signal (`packages/modules/dating.mjs:169`). Satisfaction remains 50 throughout.

## Generated route pack

Existing fixture pack with generated Rumi route. The player first moves to Rumi's room. `story.startOfferedScene` and `story.choose` drive each encounter; `core.wait` reaches authored tick gates. All choices are existing authored actions, not inferred consent or newly written character content.

| Encounter / tick | Trust T | Bonds B | Dating D (chemistry / score) | Stage S | Experience X | Memories M: raw / selected | Tempo R |
|---|---:|---|---|---|---|---|---|
| Initial / 0 | 0 | disabled | available (5 / 5) | stranger | absent | 0 / 0 | disabled |
| 1. Hangout, safe: just talk / 2 | 2 | disabled | available (5 / 5) | stranger | absent | 0 / 0 | disabled |
| 2. Flirt, safe: say hello / 3 | 5 | disabled | available (6 / 6) | familiar | absent | 0 / 0 | disabled |
| 3. Charged, safe: listen / 14 | 8 | disabled | available (8 / 8) | familiar | absent | 0 / 0 | disabled |
| 4. Kiss, bold; failed check, cheek-kiss branch (non-talk) / 30 | 8 | disabled | available (12 / 12) | familiar | absent | 0 / 0 | disabled |
| 5. Properly, bold; successful retry (non-talk) / 36 | 8 | disabled | dating (20 / 20) | dating | absent | 0 / 0 | disabled |

Effects and gates are generated at `packages/cards/route-skeleton.mjs:61`, `packages/cards/route-skeleton.mjs:62`, `packages/cards/route-skeleton.mjs:63`, `packages/cards/route-skeleton.mjs:64`, `packages/cards/route-skeleton.mjs:65`. All raw conversation, authored scene-memory and impression-ledger stores remain empty: authored choice prose does not automatically become these memories. Satisfaction stays 50. Authored progression state is absent in both packs. Dating precedence makes the stage `dating` despite trust being only eight.

At tick 36 a transient crush event precedes dating. The phase-change event reports `from: dating, to: dating`, even though the previous encounter ended available: with no stage settings, `setDatingPhase` reads the already-mutated runtime for its emitted `from` (`packages/modules/dating.mjs:102`, `packages/modules/dating.mjs:111`). This is an observed event-payload issue, not corrected here.

## Milestone and path reachability

- **Campus tempo:** reached `social.romanceRankReady` and automatic `roommate → friend` at tick 44 (`t17.10`, `t17.13`). The rank text unlocks Darts at Murphy's. Higher ranks (`something-more`, `hers`) were not reached: eight points is below their 20/32 thresholds. No manual scene-gated rank path is configured for Jana.
- **Campus dating:** crush reached at tick 44, score 17 (`t17.27`). Date/exclusive were not reached: score remains below 35/65; the trace ends after the gift. No rejected phase or date refusal was driven.
- **Generated dating:** crush and dating reached at tick 36 (`t40.5`, `t40.9`); `rumi-flirt`, `rumi-charged`, `rumi-cheek`, `rumi-kissed` flags are reached. Dating comes from the existing retry's explicit phase effect, despite a score of 20 below the generated date-request threshold 35. This is allowed because the frame has no `relationshipStageSettings` (`packages/modules/dating.mjs:97`). Exclusive was not reached (score below 70); night/again/endings were not driven (trace ends at 36, night's earliest tick is 42).
- **Generated tempo:** unreachable in this pack configuration; no tempo module/profile. No mechanical authored progression state is configured by this generator.
- **Breakup from sustained low trust:** traced in source, not reached. With stage settings, dating/exclusive plus trust below the floor starts strain; duration triggers broken (`packages/modules/dating.mjs:44`, `packages/modules/dating.mjs:49`). Campus has floor 20, two-day strain, scar −10 trust/chemistry; Jana never enters dating or falls below the floor. The generated frame omits stage settings. Breakup scars/remembered history and agreement clearing live at `packages/modules/dating.mjs:105`, `packages/modules/dating.mjs:107`; none occurred.
- **Satisfaction breakup/decay:** traced in source, not reached. The legacy no-stage-settings branch breaks at the maintenance threshold, default −60 (`packages/modules/dating.mjs:113`, `packages/modules/dating.mjs:116`); exclusive time-apart decay requires authored maintenance (`packages/modules/dating.mjs:169`). Both focused characters stay at satisfaction 50, with no relevant decay path exercised.
- **Reconciliation/route repair:** not reached; no broken/rejected relationship. Reconciliation is gated and restores dating (`packages/modules/dating.mjs:42`); repair gates were not exercised.
- **Neglect warning/detonation/defusal and birthday:** source traced at `packages/modules/romance-tempo.mjs:18`, `packages/modules/romance-tempo.mjs:27`, `packages/modules/romance-tempo.mjs:34`. Not reached: Jana has no neglect/birthday configuration; generated route has no tempo module. Do not infer neglect-driven breakup from ordinary waiting.
- **Scene attendance settlement:** reached on each campus `core.endScene` (`packages/core/engine.mjs:246` → `packages/core/engine.mjs:52` → `packages/core/engine.mjs:39`). Example: Jana leaves the movie at tick 16 for Hewett (`t5.6`); the final meeting settles her back to the apartment at 48 (`t18.15`). Scene closure restores missed schedules; it does not itself break the player relationship. Generated scenes are authored pending scenes, not open `core.scene` attendance encounters, so that settlement path was not exercised there.
- **NPC pair settlement:** campus emits `social.npcSettled` at ticks 4, 8, …, 48; e.g. Kaylee/Monique friendship at 24. Framework entry/emit are `packages/modules/npc-social.mjs:63`, `packages/modules/npc-social.mjs:78`; these events are separate from Jana's player relationship. Generated pack has no `social.npc`. The imported NPC pair algorithm was not independently audited for automatic breakup.
- **Rival settlement/breakup:** not reached. Explicit rivalry outcome `leave` sets the player's phase broken and the NPC pair dating (`packages/modules/romance-network.mjs:17`); no rivalry pressure was driven in either run. No claim that ordinary NPC settlement automatically breaks a player relationship.

## Export/import and replay

For each pack, export the final state, validate/import into a fresh in-memory DB; separately export/import the initial state into another fresh DB and replay the same scripted requests through `GameService`. Export and validated command rebuild are `packages/persistence/store.mjs:35`, `packages/persistence/store.mjs:44`, `packages/persistence/store.mjs:46`; import mechanical checks are `packages/persistence/store.mjs:54`.

Compared exactly: actors, modules, flags, tick, RNG, revision, events, active scene, activity uses/day uses; also recomputed trust, bonds, dating context, stage, experience-cue absence and selected memories. Both import and replay have zero differing fields. Narrative presentation/diagnostic metadata, wall-clock `playedAt` and SQLite backup timestamps are outside this comparison; this is mechanical and progression-signal identity, not byte-identical save envelopes.

Verbatim script output:

```text
campus: replay: identical
generated-route: replay: identical
```

## Not verified

- Successful generated conversations, impression extraction, exact-quote experience recognition, model/provider quality, enjoyment, UI rendering or owner acceptance.
- The uncommitted experience layer and any other dirty main-checkout work.
- Actual breakup, reconciliation, rejection, exclusive commitment, jealousy, neglect, birthday, night or ending outcomes; the source paths above are reachability diagnosis, not branch test coverage.
- Bonds changing or authored `social.progression` transitions; neither selected pack enables them.
- Cap saturation and uncapped social-pack alternatives; stage override behavior on a successful narration request.
- Automatic NPC-pair breakup behavior inside the imported vendor settlement algorithm.

## Required full suite

Run once: `npm.cmd test 2>&1 | Tee-Object -FilePath tmp/cp0/npm-test.log | Select-Object -Last 8` (PowerShell equivalent of the requested tail pipeline). Result: 2119 tests, 2025 pass, 84 fail, 10 skipped, zero cancelled. Literal last line: `  }`. The expected green baseline was not observed; no failing assertion or code was changed. Initial `npm.cmd install --package-lock=false` failed with registry `EACCES`; the trace itself imports and runs successfully without that installation.

Failing names verbatim follow (duration suffixes omitted):

```text
validation: pack lists, tropes and slider values; saved tropes always validate
a continuation lists the beats this scene already used and says passed offers evolve
art prompts come from the card tags, world-neutral, with a project style override
request labels match exact mock transport for known, owner-only and unknown facts and selected NPC persona
runtime reveal, supersession and generated correction are reflected in the exact mock request
budget and downstream relevance exclusions cannot be labeled included
scene memory records sharing a source keep distinct rendered and omitted reasons
a free conversation displays one connected reply without requiring per-entry clicks
the existing display preserves meaningful action interwoven between speech in exact order
malformed: safe evidence is presented, summary preserved and retry keeps mechanics
invalid: safe evidence is presented, summary preserved and retry keeps mechanics
timeout: safe evidence is presented, summary preserved and retry keeps mechanics
cancelled: safe evidence is presented, summary preserved and retry keeps mechanics
partial: safe evidence is presented, summary preserved and retry keeps mechanics
unknown: safe evidence is presented, summary preserved and retry keeps mechanics
busy staging rollback and successful scene behavior stay unchanged
actual compatible-provider format repair exposes only safe evidence through HTTP and saved-action retry
actual Studio raw input survives rerender/refresh; recovery refuses late replacement and forks on saved conflict
production pending buffers gate save/check/export/import/open and module changes; late validation preserves newer input
module enable resolves dependencies and disable retains authored configuration; pending changes invalidate a saved snapshot
production Check/Save/Open/export/import handlers roundtrip all systems through isolated storage; runtime outcomes replay
tests\current-cast.test.mjs
the narrator can glance back at the director callback line on an opening
per-character sex scenes: notes steer the narrator while active, the image shows on completion
play wires persistent Stop outside dialogue and choices, dots, hub/phone offers and first replies
structured model pages survive save replay and block forged stage assets
actual automatically reached checkpoint keeps contribution rule, player agency and authored boundary
recorded checkpoint reply and bounded repair no longer trigger an unrelated question-quota rewrite
both writers render the initiative note as private direction
voice examples follow each actor daily mood, including compact profiles and scripted suppression
both writers recast the current speech on openings and continuations with slight ranked delivery
the late beat direction limits its no-echo instruction to NPC speech
missing stats keep neutral delivery and solo or authored scenes get no typed delivery instruction
provider sends ranked delivery instructions and preserves indirect narration followed by the NPC reply
ordinary semantic repetition preserves negation, reciprocal quotation and connected answer clauses
long player contribution and faithful opening use the existing entry bound, not an arbitrary 260-character cutoff
venus-style prompt uses persona, prose blocks and the reader action last
venus-style opening has no scene transcript; a solo action has no cast
a provider scenePrompt override replaces the scene prompt builder
the hybrid style is the default: a persona, staging and hooks, ending on a character move instead of a question
hybrid scenes ask for initiative with hooked departures and forbid invented history between characters
a typed goodbye gets a send-off with a hook instead of another question
player stats render with rank names and the opening contract colors actions by them
the STAGING paragraph asks for a prop without naming one, and the prompt gets smaller
the venus variant carries the same five slip lines, and invents none without engine state
the venus slip lines fit the budget, and a rule moved into a paragraph is still charged
the prompt gains one short style line each against echo and prop fixation
a reply that repeats the player word for word is logged, never blocked
tests\rei-context-cleanup.test.mjs
the input that reaches the budget gets a closing reply that answers it, then the scene ends
an unbudgeted scene also targets a full typed exchange
a compatible scene call also records memory and facts without follow-up model calls
scene JSON is repaired once and malformed structured data is never returned as prose
continuous conversation mode keeps a live connected reply open; bounded mode keeps initiative and natural endings
persona is pack-owned, social defaults lush, blank preserves the supplied pack
question cadence counts reply endings, warns on cloud, and repairs once locally; check-ins remain possible
every writer and mode supplies hooks instead of interviewing and preserves first conversation modes
runtime allows reactions and requested action while unchosen decisions stay guarded
an active first retains calm service direction and connected conversation
validation: one source, known stat or bond, enabled module, whole numbers, no player gate
dating: a gated character is not eligible and says why until the stat is reached
journal: gated cast get entries with what still blocks them and discovered turn-ons/offs
actual creator controls author truth and initial owners; event grants only chosen actor once, with no rewards
actionable invalid IDs, scenes, beats, choices and disabled module are rejected; UI save stops before a request
advanced reveal conditions, extensions, authored lore and generated memory edits keep their existing scope
real isolated Studio Check/Save/Open/full-project export/import retain truth, ownership and schema; saves replay knowledge
reveal mechanics and initial ownership affect exact-pack saves without changing legacy digests
visual choice selection, public knowledge and referenced deletion preserve advanced rows
actual rule controls author native stage/plan/unlock; invalid buffers survive render and prevent Check/Save/export/replacement
actual controls + Studio Check/Save/Open/export/import handlers retain rules/extensions through real isolated storage; restored mechanics replay
complete production render preserves unconditional escapes across stage rename, invalid rerender and module disable
retained Apply/Cancel/input callbacks retire after success, cancel and rerender; invalid form can still be corrected
production visual deletion controls remove transition/path and retain unrelated advanced data; referenced path refuses
accepted weekly snapshot guard detects newer pending rule buffers without replacing ownership
production stage deletion refuses a native-valid lorebook gate and preserves the complete project
production stage deletion refuses a native-valid stat-check modifier gate and preserves the complete project
blank/edit validation remains visible, explicit reset and selected regeneration keep imports
calm changes continuation policy while preserving length, openings and closing while firsts retain calm
the scene prompt never asks the model to restate the player action (the UI already shows it)
a first talk opens with a greeting and one thread, not her life goal or a topic from her sheet
compatible provider emits complete sanitized-preview candidates from an SSE scene stream
a legacy actor with no voice/fingerprint keeps the old tag text
a voice/fingerprint replaces the legacy tag and clothing never reaches it
one heroine, one line: the want reaches the scene prompt only while she is in it
```
