# GC0.4 core capability matrix and GC0.5 shared contracts - 2026-10-08

Base: `main` at `4dabfd7`, worktree `gc0-matrix`. Read-only. No product code changed. Plan text read from the untracked `docs/GAME-CREATOR-COMPLETION-PLAN.md` in the main checkout (it is not in git on `main`).

## Method and evidence limits

- Cells reuse the existing audits and cite them: `GC6.1#n` = row n of `gc6-1-control-audit-2026-10-08.md`; `GC6.2#n` = `gc62-rel-audit-2026-10-08.md`; `GC3.1 F/I/T/S/W n` = `gc31-intimacy-trace-2026-10-08.md`; `GC7.1#n` = `gc71-sources-2026-10-08.md`. Nothing was re-derived where an audit already has the row.
- Labels: **present** (evidence cited), **absent** (no control, field, consumer or test found), **unverified** (not checked, or only a file-level grep).
- Test names are as the audits quote them. No test was run for this matrix.
- Runtime consumer = the function that reads the field. Verified by reading the file, not by running.

## Matrix

Columns: C = creator control, P = persisted field, R = runtime consumer, E = player effect, D = diagnostic, I = import/export, F = fixture or acceptance test.

| # | Capability | C | P | R | E | D | I | F |
|---|---|---|---|---|---|---|---|---|
| 1 | Stage, transition, escape rules | present GC6.1#27 | present GC6.1#27 | present packages/modules/dating.mjs:setDatingPhase | present GC6.2#5-6 | present GC6.1#56 (Check) | unverified | present GC6.2#5-6, studio-rules-controls |
| 2 | Plans and promises | present GC6.1#28 | present GC7.1#7 | present packages/modules/scenes.mjs:setPlanStatus | unverified (GC7.1#7: no visibility rule) | present GC6.1#56 | unverified | present GC6.1#28 rules tests |
| 3 | Ending gates: phases, ranks, intimacy, scenes | present GC6.1#25 | present GC6.1#25 | present packages/modules/endings.mjs | present GC6.1#25 | present GC6.1#56 | unverified | present creator-mechanics-controls (GC6.1#25) |
| 4 | Required-false flags (endings, choice gates) | absent GC6.1#26 | present JSON only, GC6.1#26 | present packages/modules/conditions.mjs:conditionReasons | unverified | present validateConditions flags check | present (preserved as JSON) | absent |
| 5 | Story flags and variables | present, true only GC6.1#23,#32 | present | present packages/modules/conditions.mjs:conditionReasons | present | present GC6.1#56 | unverified | absent for false values |
| 6 | Starting trust and relationship dimensions | present GC6.2#1-2 | present | present packages/modules/bonds.mjs | present GC6.2#2 | unverified | unverified (GC6.2 G7: key-level only) | present flirt-cap, dialogue-reactions |
| 7 | Initial bonds | absent GC6.2 G1 (row 3) | present `initialBonds` | present packages/modules/bonds.mjs:6 | unverified | unverified | unverified | absent (framework.test.mjs:47 is the gate, not initial values) |
| 8 | NPC relationships, groups, simulation | present GC6.1#4-5, GC6.2#4 | present | present packages/modules/npc-social.mjs | unverified (npc-life is file-level only) | present npc-social.mjs:45 | unverified | unverified (npc-life.test.mjs file-level) |
| 9 | Dating eligibility and romance ranks | present, two editors GC6.2#7-8 (G2) | present | present packages/modules/dating.mjs | present stat-gates | unverified | present creator-advanced-controls | present stat-gates, creator-advanced-controls |
| 10 | Daily gain cap, cooldowns, tempo | present advanced contract only GC6.2#11-12 (G4) | present `dailyGain`, `cooldownTicks` | present packages/core/progression.mjs, packages/modules/romance-stats.mjs | present romance-tempo | unverified | unverified | present romance-stats, romance-tempo on main; GC2.2 contract on `gc22-doc` only |
| 11 | Gifts, dialogue reactions, unwelcome flirt | present GC6.2#9-10 | present | present packages/modules/flirt-cap.mjs | present dialogue-reactions | unverified | unverified | present gift-repeats, dialogue-reactions, unwelcome-flirt |
| 12 | Hard limits, region limits, sensitivity | present, hard limit as JSON GC6.2#14 (G3) | present | present packages/modules/intimacy.mjs:regionLimitReason | present GC3.1 I15-I17 | unverified | unverified | present body-limits |
| 13 | Secrets, agreements, witnesses | present GC6.1#18 | present `social.secrecy` | present packages/modules/secrecy.mjs | present GC7.1#8 | unverified | unverified | present studio-secrecy (GC6.1#18) |
| 14 | Firsts (free-typed first experiences) | present GC3.1 F18 | present | present packages/modules/firsts.mjs | present GC3.1 F15-F17 | unverified | present creator-systems-controls:61,63 | present firsts, firsts-service, firsts-ui |
| 15 | Intimacy scene skeleton and prose | present GC3.1 S6-S10 (creator-only) | present `intimacyScenes` | present packages/cards/intimacy-skeleton.mjs | present GC3.1 S3 beats | present missingStops lint, GC3.1 S3 | unverified | present intimacy-skeleton.test.mjs |
| 16 | Scripted scenes: triggers and effects | present GC6.1#19 | present | present packages/modules/scenes.mjs | present | present GC6.1#56 | present creator-advanced-controls | present creator-advanced-controls |
| 17 | Scene choices and choice gates | present, one flag and one trust per gate, GC6.1#20,#23 | present | present packages/modules/conditions.mjs:conditionReasons | present | unverified | unverified | unverified (gate row has no test, GC6.1#20) |
| 18 | Nested conditions (AND/OR/NOT, depth) | absent GC6.1#24 | absent | absent (flat AND only, section 3) | absent | absent | absent | absent |
| 19 | Objectives (quest any-of events) | present, extras via advanced JSON GC6.1#29 | present `quests.any` | present packages/modules/social.mjs:react | present story.questCompleted text | unverified | unverified | unverified |
| 20 | Locations and map exits | present GC6.1#33-34 | present | present packages/core/engine.mjs (exit shape only, line 171) | present | present validatePack | present GC6.1#33 rename test | present GC6.1#33 |
| 21 | Calendar, dayparts, weekly routines, exceptions | present GC6.1#35-38 | present | present public/schedule-resolver.mjs | present | present schedule-preview (GC6.1#37-38) | unverified (GC6.1#35-36) | present schedule-preview, calendar-world |
| 22 | Economy, activities, jobs, courses, services, wages | present GC6.1#39-42, #48-49 | present | present packages/modules/economy.mjs, jobs.mjs, academics.mjs | present seeded-roll tests | present typed validation | present system roundtrips | present creator-specialist, studio-activity-controls |
| 23 | World events (date windows) | present GC6.1#47 | present | present packages/modules/world-events.mjs | unverified | unverified | absent (no form round trip, GC6.1#47) | present generation test only |
| 24 | Phone messages and feed posts | present typed GC6.1#51-52 | present | present packages/modules/phone.mjs, packages/modules/feed.mjs | unverified | unverified | present creator-advanced-controls | present creator-advanced-controls |
| 25 | Authored facts, lore, reveals | present GC7.1#1, GC6.1#31 | present `pack.facts` | present packages/ai/bulk-authoring.mjs:applyDepth, packages/modules/facts.mjs | present narration context | unverified (GC7.2 pending) | unverified | unverified (sharedAuthoredFact has no test, GC7.1 todo) |
| 26 | Generated facts and corrections | unverified (overlay in store, no control cited) | present `turns[].generatedFacts` | present packages/modules/facts.mjs:validateGeneratedFacts, persistence/store.mjs:editFact | present GC7.1#2 | unverified | unverified | unverified (selectGeneratedFacts has no test) |
| 27 | Statements, scene memories, impressions, promises | unverified (memory-controls shape not read) | present GC7.1#3-6 | present packages/ai/memory.mjs:capturedStatements, vendor/venus/ledger.mjs:ledgerMemories | present prompt context | unverified (GC7.2 pending) | unverified | unverified (effectiveImpressions has no test) |
| 28 | Character sheets, portraits, wardrobe | present GC6.2#18 | present `characterSheets` | present packages/core/character-sheet.mjs, public/wardrobe.mjs | present GC3.1 W1-W4 | unverified | unverified | present wardrobe-play |
| 29 | Intimacy CGs and gallery | present GC3.1 S7 | present | present packages/modules/intimacy.mjs:validCg | present GC3.1 W6 | present asset audit GC3.1 W7 | unverified | present erotic-scenes-wardrobe |
| 30 | Game UI bindings (project UI, Wizard) | present public/creator.mjs:136 mountUiProject | present `gameProject.ui` | present public/vn-skin.mjs, public/ui-screen.mjs | present ui-screen-mode | present validateProjectUi at save (server.mjs:174) | unverified | present ui-screen-mode |
| 31 | Campaign saves and recovery backups | present public/studio-recovery.mjs | present `recovery_backups` | present packages/persistence/store.mjs:backup, restore | present creator-recovery | present previewRestore | present migrateCampaignExport | present creator-recovery; gc5-5 case 1 only (cases 2-5 todo) |
| 32 | Content packages (characters, locations, scenes, events) | present public/content-package-ui.mjs | present manifest | present packages/cards/content-package.mjs | unverified | present review gate: missing media blocks | present round trip | present content-package, -review, -browser |
| 33 | Progression flag and per-turn markers | unverified (no control found in studio*.mjs; not fully searched) | present `pack.progression.version` | present packages/core/progression.mjs (on main); `rulesFor`, markers per gc22 contract | unverified | present refusal messages (gc22 R8, R9) | present gc22 R2, R5 | absent on main; present on `gc22-doc` only |

Totals: 33 capabilities, 231 status cells (33 x 7). 163 present, 14 absent, 54 unverified. Absent or unverified: 68 cells.

## Optional and unresolved scope

- Adventure combat and turn-based systems: later, not in this matrix.
- Weather and holiday conditions: typed in `creator-systems-contract.mjs`, no Studio control (`studio.mjs` has no `weather`).
- The `after-hours` pack is retired; its tests run on copies in `tests/fixtures/`. Do not add fixtures that point at it.
- Installer, full migration and calendar-picked dates: deferred.

## 3. Nested grammar check

Engine grammar (search of `packages/` for and/or/all/any/not):

- **`when` (conditions.mjs:validateConditions, conditionReasons; route-conditions.mjs)**: one flat object. Every key is ANDed. Array values inside one key are OR (`weekdays`, `dayparts`: "needs X or Y"). Shapes: `location`, `weekdays[]`, `dayparts[]`, `charactersAt{id:place}`, `present[]`, `attention{id:min}`, `minTick`, `maxTick`, `flags{var:bool}`, `items[]`, `trust{id:min}`, `completedScenes[]`, `plans{id:status}`, `goalStep{npc:step}`, `equipped[]`, `bonds[{character,dimension,min}]`, `stats[{character,stat,min?,max?}]`, `relationshipStates{npc:state}`, `datingPhases{npc:phase}`, `weather`, `holiday`, plus route keys `goalSteps`, `firstCompleted[]`, `elapsedDays[{first,min}]`.
- **Quest `any` (social.mjs:127)**: array of `{event, match{}}`. This is the only OR across conditions. `match` is flat equality.
- **`npcDialogue` (npc-social.mjs:45)**: exactly one of `group`, `pair`, `any`. A selector rule, not a grammar.
- **`statCheck.modifiers[].when` (conditions.mjs)**: reuses the flat `when`.
- **`bulk-authoring.mjs:258`**: `anyOf` appears in a JSON schema for LLM output only. It is not an engine condition grammar.
- **Not accepted**: nested and/or groups, `not`, negated flags, depth beyond one level.

Studio control per shape (`public/studio.mjs`, `public/creator-systems-contract.mjs`):

| Shape | Control | Note |
|---|---|---|
| scene `when`: location, minTick, maxTick, items, completedScenes, trust | present studio.mjs:249-255 | trust is a list |
| scene `when.flags` | present, one variable, true only (studio.mjs:252) | false not authorable (GC6.1#23, #26) |
| choice gate flags and trust | present, one each (studio.mjs:262-264, 293-295) | single selection |
| equipped, bonds, stats, relationshipStates, present | present studio.mjs:208-226 | extraConditionFields |
| weekdays, dayparts, charactersAt, attention, minTick, maxTick, weather, holiday, datingPhases | present creator-systems-contract.mjs (typed) | weather not in studio.mjs |
| plans | present studio-rules.mjs, creator-rules-contract.mjs | |
| goalStep, goalSteps, firstCompleted, elapsedDays | absent for `when` | goalStep only in sheet-editor.mjs; the rest are read-only in route-map.mjs |
| quest `any` extras | absent (advanced JSON, GC6.1#29) | |
| OR across keys, nested groups, not | absent | no grammar exists (GC6.1#24) |

Answer: the engine accepts one flat AND object plus OR inside a few array keys and inside quest `any`. It has no nested AND/OR, no NOT and no false flags. Studio edits about 60 percent of the shapes above, and four shapes have no `when` control at all.

## GC0.5 shared contracts

### Progression versioning
- Where: `pack.progression.version` (value 1), per-turn stamp `state.progression.cutover`, marker event `social.progressionRules`. Decision: the flag stays out of `mechanicsDigest` (owner-approved option 1, gc22 section 9).
- Owner file: `packages/core/progression.mjs` on main (header states the contract). Writers: `packages/modules/romance-stats.mjs:markRules`, `packages/core/engine.mjs` (cutover stamp).
- Pinned by a test: on `gc22-doc` only, `tests/gc22-compat-contract.test.mjs` (rules R1-R9). Not pinned on main.
- Open gap: U3 (a hand-edited marker `dailyGain` is accepted), U4 (default cap at cutover, untested), CP1/CP3/CP6 effects not implemented. The contract is unmerged.

### Stage-cue precedence
- Rule (from plan line 64): authored progression sets the stage cue when available; trust thresholds are the fallback. Dating phase outranks trust; strain never overrides broken or rejected.
- Owner file: `packages/ai/character-context.mjs:relationshipStageOf`. Dating writer: `packages/modules/dating.mjs:setDatingPhase` (`stageOf`).
- Pinned by: `tests/gc25-stage-guidance.test.mjs` (4 tests: trust fallback, dating over trust, strain, breakup label).
- Open gap: the authored-progression branch of the rule is not among those 4 test names. Treat it as unverified until read.

### Recovery guarantee
- Where: `packages/persistence/store.mjs` (`backup`, `restore`, `previewRestore`, `branch`; auto backups capped at 20, named checkpoints at 50). Browser copies in `public/creator.mjs` and `public/studio-recovery.mjs`.
- Pinned by: `tests/creator-recovery.test.mjs` (4 tests), `tests/gc5-5-recovery-guarantees.test.mjs` (case 1 active).
- Open gap: GC5.5 cases 2-5 are `todo` (corrupt wizard draft, unsaved-world replacement, second tab, startup text before first generate). The guarantee is not written as one statement; GC5.5 needs it.

### Content-package references
- Where: `packages/cards/content-package.mjs` (one walker: review with empty maps, apply with rewrite maps; `TYPES` list). UI: `public/content-package-ui.mjs`.
- Pinned by: `tests/content-package.test.mjs` (round trip, dependency closure, collisions, missing media, malformed manifests, extension fields), `content-package-review`, `-browser`, `-independent`.
- Open gap: the walker rewrites only the kinds in `TYPES`. Whether every `when` key (section 3) is rewritten is unverified. Validation after apply is the safety net.

### UI bindings
- Where: `public/ui-selection.mjs:validateProjectUi`, called by `packages/core/engine.mjs:154` and `server.mjs:174`. Runtime: `public/vn-skin.mjs`, `public/ui-screen.mjs`. Wizard: `public/ui-designer.mjs`.
- Pinned by: `tests/ui-screen-mode.test.mjs`; `vn-skin-contract` per T-106.
- Open gap: T-106 lists owner-reported clipped text and missing panels. Its status is not reconciled here (GC0.2).

### Schema ownership
- Owner: `packages/core/engine.mjs:validatePack` (line 151) is the pack validator. `packages/contracts/index.d.ts` is types only (Command, Event, World). Condition grammar: `packages/modules/conditions.mjs`, `route-conditions.mjs`.
- Pinned by: about 443 `validatePack` calls across `tests/`, but not a schema-ownership test.
- Open gap: ordinary Save skips `validatePack` (GC6.1#55, `server.mjs:174`). `validateProjectUi` lives in `public/` and is imported by the engine. Two validators run on two paths.

## Top gaps for GC0

1. Ordinary Save does not run `validatePack` (GC6.1#55). Drafts can be saved with blockers.
2. Nested conditions: no OR/NOT/nested grammar (row 18) and no false flags (rows 4, 5). Blocks GC6.3.
3. Recovery and progression are not closed on `main`: GC5.5 cases 2-5 are todo, and the progression contract (`gc22-doc`) is unmerged with open U3/U4.
