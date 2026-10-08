# GC6.1 creator control audit - 2026-10-08

Read-only audit of declared core creator fields against the plan's GC6 matrix (`docs/GAME-CREATOR-COMPLETION-PLAN.md`, GC6 section). Base: `main` at `02352f1`, worktree `gc6-control-audit`. No product code, tests or browser runs were touched. Line numbers were read from this worktree on 2026-10-08.

## Method and evidence limits

- Each row records the visual control (file:line), the validation that runs on that path, the persisted pack location and export path, and the runtime test evidence. "Evidence" is a test name read from `tests/`, not a run result. The test suites were not executed here.
- Status key:
  - **complete**: a usable control, validation and persistence exist, and a named test covers a round trip or runtime outcome for that field.
  - **partial**: a control exists but a named test, validation, or the control's full scope is missing. A known defect or a JSON escape hatch is listed.
  - **missing**: a field the plan requires has no control for the authored value.
- `tests/studio-coverage.test.mjs` is a source-string lock (`hasControl` checks for `edit(` and `mountSystems(`), so it is not counted as workflow evidence.
- Systems rows marked "system roundtrip" rely on the test named "production Check/Save/Open/export/import handlers roundtrip all systems through isolated storage; runtime outcomes replay" in `tests/creator-systems-controls.test.mjs`. I did not read that test body line by line, so those rows are complete on the test name alone.
- Changes from the earlier draft audit (October 8 draft at commit `e0f2a05`), all after re-reading the current base:
  - social.phone and social.firsts were "missing (JSON only)". Both now have typed controls (advanced `phoneMessages`; system `firsts`), so they are **partial** because a legacy JSON editor still writes the same keys (T4).
  - social.feed (`feedPosts`) was not in the old table; it is partial for the same reason.
  - Endings "requires false" was "missing". The control exists for true flags and preserves false flags, but cannot author a false requirement, so it is **partial** (T5). This is not a field with no control at all.
  - scheduleExceptions was "unverified". The runtime consumer is `public/schedule-resolver.mjs:3`, covered by `tests/schedule-preview.test.mjs`, so it is **complete**. The old T6 is withdrawn.
  - Nested AND/OR conditions were not in the old table. The engine has no such form (see row 24), so it is **missing** and reported under the stop rule.

## Line anchors (current base)

- `public/studio.mjs`: `api` 114; `field` 122 (number stores `Number(input.value)`); `setModule` 176; `rows` 181; `gossipEditor` 446; `timedEventEditor` 447; `endingEditor` 448 (flag note 449-462); `dataEditor` 472; `dailyNeedEditor` 512; `statMilestonesEditor` 547; `dialogueReactionsEditor` 557; `render` 570; world events rows 601; mounts `mountKnowledge` 582, `mountRouteMap` 609, `mountRules` 610, `mountSystems` 611, `mountAdvanced` 612; secrecy 676-686.
- `public/studio-systems.mjs:6` `assertSystemsReady`; `:8` `mountSystems`.
- `public/creator-systems-contract.mjs`: `validateSystemValue` 30-53; `editSystem` 54-58.
- `server.mjs:174` ordinary save; `:244-246` validate/playtest use `validatePack`.
- `packages/modules/conditions.mjs:10-26` `validateConditions`; `packages/modules/endings.mjs:3` `endingReasons`; `packages/modules/social.mjs:116` schedule validation, `:124` quests.
- `packages/core/engine.mjs:171` location exits assertion.

## Field table

Status counts: **complete 28, partial 27, missing 1** (56 rows).

### GC6.2 Characters, relationships and rules

| # | Field | Control (file:line) | Validation | Persisted / exported | Runtime evidence | Status |
|---|---|---|---|---|---|---|
| 1 | Character sheets (identity, traits, backstory, goal, agenda) | `public/sheet-editor.mjs` via `studio.mjs:570` | sheet validation in content package and character sheet code | `pack.actors` + sheets; export/import | `character-sheet.test.mjs` "fresh import preserves legacy actor/profile fields"; "studio sheet can close, reopen and retain applied edits" | complete |
| 2 | Relationship dimensions (social.bonds) | `studio.mjs:607` rows | field-level only | `pack.relationshipDimensions` | none named | partial |
| 3 | Initial bonds | `studio.mjs:570` | none named | `pack.initialBonds` | none named | partial |
| 4 | Initial NPC relationships (-6 to 6) | `studio.mjs:603` rows | field-level | `pack.initialNpcRelationships` | none named | partial |
| 5 | NPC groups and NPC simulation | `studio.mjs:604-605` | field-level | `pack.npcGroups`, `pack.npcSimulation` | none named | partial |
| 6 | Romance agents and NPC chemistry | `studio.mjs:584` | field-level | `pack.romanceAgents`, `pack.npcChemistry` | none named | partial |
| 7 | Stat milestones | native `statMilestonesEditor` `studio.mjs:547-556` | bypasses `validateSystemValue` (contract line 51 not reached); blank `min` saves 0 (`studio.mjs:122`) | `pack.statMilestones` | creator-mechanics-controls "statMilestones: authored through forms, unique IDs enforced" | partial (T1, T2) |
| 8 | Daily needs (reward, against-Like, needs) | native `dailyNeedEditor` `studio.mjs:512-546`; enable at 514 | same bypass; blank reward or change saves 0 | `pack.dailyNeeds` | creator-mechanics-controls "dailyNeeds: enable ... validation" and "consumed by the runtime" | partial (T1, T2) |
| 9 | Dialogue reactions (Trust on spoken match) | `studio.mjs:557-568` | rows validation | `pack.dialogueReactions` | "dialogueReactions: form authors a rule; runtime pays Trust on a spoken match" | complete |
| 10 | Gift settings | `studio.mjs:648` | none named | `pack.giftSettings` | none named | partial |
| 11 | Social pacing, unwelcome flirt, gift repeat | `studio.mjs:579-580`, `648` | none named | `pack.socialPacing`, `unwelcomeFlirt`, `giftRepeat` | none named | partial |
| 12 | Lust baseline, scene feedback, day recap, slip guard, anniversary | `studio.mjs:585` calls, `636-646`, `417-419` | field-level | matching `pack.*` keys | none named | partial |
| 13 | Gossip rules | `studio.mjs:446` `gossipEditor` | field-level | `pack.gossipRules` | none named | partial |
| 14 | First experiences (`firsts`) | typed system form (`studio-systems` mount, contract `firsts`) plus legacy JSON `dataEditor` at `studio.mjs:585` | typed checkpoint check; JSON path has no typed validation | `pack.firsts` | system roundtrip | partial (duplicate JSON editor, T4) |
| 15 | Character-change arcs (`arcTracks`) | typed system form | `validateSystemValue` (duplicate trait/stage, drift) | `pack.arcTracks` | system roundtrip | complete |
| 16 | NPC encounter dialogue (`npcDialogue`) | typed system form | exactly one of group, pair (two different NPCs), or fallback | `pack.npcDialogue` | system roundtrip; `packages/modules/npc-social.mjs:13,44-45` | complete |
| 17 | Romance ranks, tempo and intimacy profiles | advanced contract (`romanceTempoProfiles`, `intimacySettings`, `intimacyProfiles`) | `advancedSpecs` validators | advanced pack paths | creator-advanced-controls "nested romance controls author ranks, gift tastes and repeating signals"; "typed intimacy rows survive isolated save/open/export" | complete |
| 18 | Secrets, agreements, witnesses, overrides | `secrecyEditor` `studio.mjs:686`; initial secrets `680-681` | `secrecyValidate` `studio.mjs:676` | `pack.initialSecrets` and secrecy settings | studio-secrecy "authors all module settings, secrets, overrides, evidence and agreements" | complete |

### GC6.3 Scenes, conditions and rules

| # | Field | Control (file:line) | Validation | Persisted / exported | Runtime evidence | Status |
|---|---|---|---|---|---|---|
| 19 | Scripted scenes (triggers, effects) | advanced contract `scriptedScenes` (25-value effect enum) | `validateAdvancedFields` | `pack.scriptedScenes` | creator-advanced-controls "event wait/match forms retain false, zero, extension fields" | complete |
| 20 | Scene choices and choice gates | choice editors `studio.mjs:252-293` | `validateConditions` (`conditions.mjs:10-26`) | scene choice `when` | none named for the gate | partial (gate is true-only, T5) |
| 21 | Event payload matches and waits | advanced contract | advanced validators | scripted scene triggers | creator-advanced-controls "event wait/match forms ..." | complete |
| 22 | Presence and location conditions (`when.present`, `charactersAt`, `location`) | system conditions in `creator-systems-contract.mjs`; scene `when` editor | `conditions.mjs:10-17` | `when.*` | creator-mechanics-controls "scripted scenes: presence condition editable and validated" | complete |
| 23 | Story-flag conditions with false values (`when.flags`) | choice gate `studio.mjs:262`, `293` (true only) | `conditions.mjs:21` accepts booleans | `when.flags` | false preserved only, not authored | partial (T5) |
| 24 | Nested AND/OR conditions | none | none | none | none | **missing (stop-and-report, see below)** |
| 25 | Ending gates: dating phases, romance ranks, intimacy counts, completed scenes | `endingEditor` `studio.mjs:448-462` | `endings.mjs` validate | `pack.endings[].requires` | creator-mechanics-controls "endings: dating, rank and intimacy gates editable" | complete |
| 26 | Ending gates: flags required false | `studio.mjs:448-449` note "edit in advanced JSON" | `endings.mjs:3` accepts false | `requires.flags` false | preserved only | partial (T5) |
| 27 | Stage, transition, escape and condition-gate rules | `studio-rules.mjs` via `mountRules` `studio.mjs:610` | `creator-rules-contract.mjs` `editRule`; invalid references fail | pack rules | "transition edits preserve advanced match and requirements"; "invalid references/escape fail validation" | complete |
| 28 | Plans and promises (status, deadlines, kept or broken unlocks) | plan forms in `studio-rules.mjs` | rules contract | pack plans and relationship states | "legal kept plan transitions once, unlocks event and replay/transfer agree"; "deadline equality stays pending" | complete |
| 29 | Objectives and quest conditions (`quests`) | `studio.mjs:614` rows; text says extra conditions need advanced JSON | `social.mjs:124` requires `any` | `pack.quests` | none named | partial (T7) |
| 30 | Timed events | `timedEventEditor` `studio.mjs:447` | field-level | `pack.timedEvents` | "bulk generation adds new places and timed events" (generation only) | partial |
| 31 | Facts, fact reveals, knowers | `studio-knowledge.mjs` via `mountKnowledge` `studio.mjs:582` | `validateKnowledge` | `pack.facts`, `pack.factReveals` | "both record types expose subject, source, knowers, status, time and an editable contract"; "choice-triggered knowledge reveals must survive or export must fail explicitly" | complete |
| 32 | Story variables | rows `studio.mjs:252-262` | field-level | `pack.storyVariables` | none named | partial |

### GC6.4 World, schedules and economy

| # | Field | Control (file:line) | Validation | Persisted / exported | Runtime evidence | Status |
|---|---|---|---|---|---|---|
| 33 | Locations (names, aliases, descriptions, moods) | rows `studio.mjs:587` | `idField`; rename rewrites references | `pack.locations` | "renaming a location ID rewrites references but not prose or the Game UI" | complete |
| 34 | Map exits (connections) | `studio.mjs:587` comma-separated ID text | `engine.mjs:171` checks array shape; form does not check targets | `locations[].exits` | none named | partial (T7) |
| 35 | Calendar start date and starting weekday | `studio.mjs:570` | `public/calendar.mjs`; "calendar packs validate; malformed holidays ..." | `pack.gameProject.calendar` | `calendar-world.test.mjs` (runtime and validation); no form round trip | partial |
| 36 | Dayparts (interval, intro location, event) | `studio.mjs:616` | field-level | `pack.daypart` | daypart runtime tests; no form round trip | partial |
| 37 | Weekly routines and schedule stops | `studio.mjs:351-372` | `validateWeeklyRoutines` (`server.mjs:174`) | `pack.schedules` | schedule-preview "legacy tick stops, weekly cells and schedule exceptions match runtime attendance" | complete |
| 38 | Schedule exceptions | typed system form | contract end >= start | `pack.scheduleExceptions` | `public/schedule-resolver.mjs:3`; schedule-preview "exception windows without a runtime schedule never move an NPC" | complete |
| 39 | Activities and daily limits | activity controls | bounds validated | `pack.activities` | "activity controls expose shipped bounds"; "actual activity form edits save/reopen/export/import" | complete |
| 40 | Paid services | typed system form | contract | `pack.services` | system roundtrip; `packages/modules/economy.mjs:56-59` | complete |
| 41 | Wage rules | typed system form | contract | `pack.wageRules` | "wage edits retain existing advanced matches and expose payment narration" | complete |
| 42 | Economy settings, currency, invitations | advanced contract (`economySettings`, `currency`, `invitations`) | advanced validators | advanced paths | "advanced settings and typed intimacy rows survive isolated save/open/export"; "a phone buzz moment delivers an invitation that can be accepted" | complete |
| 43 | Item-combination recipes | typed system form | contract | `pack.recipes` | system roundtrip; `packages/core/engine.mjs:107` | complete |
| 44 | Ambient moments and moment tuning | typed system forms | contract (generation kinds) | `pack.moments`, `pack.momentsProfile` | system roundtrip | complete |
| 45 | Sobriety | typed singleton | contract (drunk above tipsy) | `pack.sobriety` | system roundtrip; `packages/modules/sobriety.mjs:7` | complete |
| 46 | Touch ladder and private locations | typed singleton | contract | `pack.touchLadder` | system roundtrip; `packages/modules/touch-ladder.mjs:101` | complete |
| 47 | World events (date windows) | rows `studio.mjs:601` | `world-events.mjs` validate | `pack.worldEvents` | generation only; display at `public/app.mjs:42` | partial |
| 48 | Jobs and shifts | specialist form `jobSettings` | specialist validators | `world.jobs` | "jobs pay old wage before each raise, reject duplicate slots ..."; "specialist settings save/reopen" | complete |
| 49 | Courses and grades | specialist form `academicSettings` | specialist validators | `world.academics` | "authored exam answers, skipped/missed assessments ... are deterministic" | complete |
| 50 | Feed friends and popularity | specialist form `feedSettings` | specialist validators | `social.feed` settings | "feed requests and likes use seeded rolls ..." | complete |

### GC6.5 Social, phone, feed and director

| # | Field | Control (file:line) | Validation | Persisted / exported | Runtime evidence | Status |
|---|---|---|---|---|---|---|
| 51 | Phone messages (`phoneMessages`) | typed advanced control, plus legacy JSON `dataEditor` at `studio.mjs:585` | advanced validators; JSON path `Object.assign` (`studio.mjs:472`) keeps deleted keys | `pack.phoneMessages` | creator-advanced-controls "typed feed and phone definitions author triggers, replies and offers without JSON" | partial (T4) |
| 52 | Feed posts (`feedPosts`) | typed advanced control, plus legacy JSON `dataEditor` at `studio.mjs:585` | same as 51 | `pack.feedPosts` | same test as 51 | partial (T4) |
| 53 | Director profile (tone ceiling, complications, opportunities) | `studio.mjs:83-86`; `creator-rules-contract.mjs:19` | field-level | `pack.directorProfile` | director-library and director-v2 tests (engine); no Studio round trip named | partial |
| 54 | Director templates | advanced contract `directorTemplates` | advanced validators | advanced path | director-library tests; no Studio round trip named | partial |

### GC6.6 Save and validation

| # | Field | Control (file:line) | Validation | Persisted / exported | Runtime evidence | Status |
|---|---|---|---|---|---|---|
| 55 | Ordinary Save | `studio.mjs:117` (saveDraft), `623` (Save button) | `server.mjs:174` runs weekly and UI checks only, not `validatePack` | draft file | "Studio ordinary saves ... a refusal keeps the local draft" (refusal path only) | partial (T3) |
| 56 | Check, validate and playtest | `studio.mjs:624` (Check); `server.mjs:244-246` | `validatePack` and media checks | none (read-only) | "production Check/Save/Open/export/import handlers ..." | complete |

## Defects found while reading

- `public/studio.mjs:122-124`: `field()` with `kind==='number'` stores `Number(input.value)`; a blank input becomes 0. This hits dailyNeeds reward and against-Like, and statMilestones `min`.
- `public/studio.mjs:512-556`: native daily-needs and stat-milestone editors write `draft.pack` directly after the enable toggle. They do not call `validateSystemValue`, so the threshold check in `creator-systems-contract.mjs:51` is not reached on those paths.
- `server.mjs:174`: ordinary Save writes the pack after `validateWeeklyRoutines` and `validateProjectUi` only. `validatePack` runs on Check, validate, playtest and publish.
- `public/studio.mjs:472`: `dataEditor` uses `Object.assign`, so keys deleted in the JSON textarea persist in the saved pack.

## Stop-and-report finding

**Nested AND/OR conditions (row 24) have no control and no engine form.** GC6.3 requires "core nested AND/OR and other existing condition forms". The engine's `when` is a flat set of keys that must all hold (`packages/modules/conditions.mjs:10-26`). There is no `any`, `all`, `or` or `not` key anywhere in `packages/` or `public/` for conditions. Because the plan asks for something the engine does not model, I did not design the grammar. Owner decision needed: see T6.

## Tickets

Not implemented. Each ticket lists the fields, the gap, the smallest fix, the test to add, and whether a design decision is needed.

**T1. Blank number fields must not save as 0.**
- Fields: statMilestones `min`; dailyNeeds `reward.like`, `reward.trust`, `againstLike`; any other `field(..., 'number')` user.
- Gap: `public/studio.mjs:122-124` stores `Number(input.value)`.
- Smallest fix: when a number input is blank, leave the key unset or invalid and show the message; the contract already rejects non-numbers (`creator-systems-contract.mjs:37`).
- Test: in `tests/creator-systems-controls.test.mjs`, clearing a reward input keeps the pack value unchanged and shows the error.
- Design decision: no.

**T2. Native dailyNeeds and statMilestones editors must run the typed contract.**
- Fields: dailyNeeds (all keys), statMilestones (all keys).
- Gap: `public/studio.mjs:512-556` write the pack without `validateSystemValue`. Out-of-range thresholds and empty need hints are accepted into the draft.
- Smallest fix: route both sections through `mountSystems` (typed specs already exist) or call `validateSystemValue` on each edit and block Save while invalid.
- Test: an out-of-range milestone `min` and an empty need hint are rejected before the pack changes.
- Design decision: no. Specs already exist; migrating the layout is the smallest path.

**T3. Ordinary Save must validate the pack.**
- Fields: all keys, through the draft file.
- Gap: `server.mjs:174` skips `validatePack` on ordinary save; invalid packs can be saved and only fail later at Check.
- Smallest fix: call `validatePack` in the non-startup save branch and reject, or save and surface the errors in the Check panel.
- Test: a save with a pack that fails `validatePack` returns an error and leaves the draft file byte-identical.
- Design decision: yes. Decide whether Save refuses invalid in-progress drafts (blocks partial work) or saves and shows blockers. The owner chooses.

**T4. Remove the duplicate JSON editors for phone, feed and firsts, and stop key retention.**
- Fields: `phoneMessages` (social.phone), `feedPosts` (social.feed), `firsts` (social.firsts).
- Gap: typed controls exist, but `public/studio.mjs:585` still mounts `dataEditor` for the same keys; `studio.mjs:472` merges with `Object.assign`, so deleted entries reappear.
- Smallest fix: drop the three `dataEditor` calls at `studio.mjs:585`; if any `dataEditor` remains, replace the object instead of merging.
- Test: delete a phone message in the typed form, save, reopen, and confirm it is gone from `pack.phoneMessages`.
- Design decision: no. The typed forms already cover these keys.

**T5. Author false flag requirements and gate by unset flags.**
- Fields: `endings[].requires.flags` (false values); choice `when.flags` (false values).
- Gap: `public/studio.mjs:448-449` note says "edit in advanced JSON"; `studio.mjs:262` and `293` gate on true only.
- Smallest fix: a three-state control per flag (must be set, must be unset, ignore) for endings and choice gates, using the existing `when.flags` boolean shape.
- Test: an ending that requires a flag to be false is authored in the form, saved, reopened, and unlocks only when the flag is false.
- Design decision: yes. Decide the control shape (tri-state per flag, or a separate "must not be set" list) and whether choice gates get the same control.

**T6. Nested AND/OR condition forms (blocked on owner decision).**
- Fields: `when` in scenes, choices, endings, lorebook entries, and objectives.
- Gap: `packages/modules/conditions.mjs:10-26` has only a flat AND. No control or engine form exists.
- Smallest fix: none until the grammar is chosen.
- Test: after the decision.
- Design decision: yes. Owner decides the grammar (`any`, `all`, `not` keys, nesting depth limit), validation rules, which surfaces share it, and migration of existing flat `when` objects.

**T7. Reference pickers and advanced-JSON escapes for map exits and quest conditions.**
- Fields: `locations[].exits` (targets); `quests[].any` extra conditions.
- Gap: `public/studio.mjs:587` takes exit targets as typed IDs with no picker; `engine.mjs:171` only checks the array shape, so an unknown target is not flagged in the form. `studio.mjs:614` sends quest extra conditions to advanced JSON.
- Smallest fix: a multi-select location picker for exits that flags unknown targets as field errors; for quests, reuse the shared `when` form for extra conditions.
- Test: an exit to an unknown location shows a field error and blocks Save; a valid exit round-trips through save and reopen.
- Design decision: yes for quest conditions only. Decide whether quests accept the full `when` shape or event matches only. Exit pickers need no decision.

## Files changed

- `docs/research/gc6-1-control-audit-2026-10-08.md` (new).
- No product code, tests, `public/`, `packages/`, `server.mjs` or `packs/` files were touched. The npm test baseline was not run because no code or test file changed.
