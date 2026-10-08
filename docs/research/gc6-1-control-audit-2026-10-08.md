# GC6.1 creator control audit - 2026-10-08

Base: `main` at `b9dcf7f`, worktree `gc61-control-audit`. Read-only audit of core creator fields against the GC6 matrix in `docs/GAME-CREATOR-COMPLETION-PLAN.md` (untracked in the main checkout; read there). Supersedes the 2026-10-08 draft committed at `87b4dcb` (branch `gc6-control-audit`), which was written against `02352f1`. Several of its open defects are now fixed on this base (see Changes).

## Method and evidence limits

- **Control (C)**: a visual control in `public/studio*.mjs` or a typed contract form writes the field. Y is given even when the control is partial; the row note says how.
- **Persisted (P)**: the value reaches `pack.*` (or the advanced/specialist path) through the Studio save and survives export/import. Read from code, not run.
- **Test (T)**: a named test in `tests/` checks a round trip or runtime outcome for that field. Test names were read from `tests/`; they were not run in this task. Source-string locks (e.g. `studio-coverage.test.mjs`) do not count.
- Anchors marked (r) were re-grepped on `b9dcf7f`. Others are carried from `87b4dcb` and may be off by a few lines.
- Systems rows marked "system roundtrip" rely on `creator-systems-controls.test.mjs:61` by name; its body was not read line by line.
- Counts below are computed from the table rows (see Totals).

## Changes since the 87b4dcb draft

- Blank number fields no longer save as 0: `studio.mjs:122` `field()` deletes the key on blank input (r), and `creator-systems-contract.mjs:37` says "blank is not zero". Test: `creator-systems-controls.test.mjs:62`, plus `gc6-1-control-audit.test.mjs`. Old T1 closed.
- dailyNeeds and statMilestones are typed contract systems now; the native editors are gone (no `dailyNeedEditor`/`statMilestonesEditor` in `studio.mjs`). Typed validation rejects bad values (`creator-systems-controls.test.mjs:56`). Old T2 closed.
- The legacy `dataEditor` is gone from `studio.mjs` (0 matches, r). Phone, feed and firsts have typed forms only. Old T4 closed.
- Still open: ordinary Save does not validate (T3), false flags (T5), nested AND/OR (T6), exit and quest pickers (T7).

## Field table

Columns: C = control present, P = persisted, T = has test. Status text notes gaps.

| # | Field | Control file:line | C | P | T | Note |
|---|---|---|---|---|---|---|
| **GC6.2 Characters, relationships, rules** |||||||
| 1 | Character sheets | `public/sheet-editor.mjs`; `studio.mjs:570` | Y | Y | Y | `character-sheet.test.mjs` |
| 2 | Relationship dimensions (bonds) | `studio.mjs:607` | Y | Y | N | field-level only |
| 3 | Initial bonds | `studio.mjs:570` | Y | Y | N | |
| 4 | Initial NPC relationships (-6..6) | `studio.mjs:603` | Y | Y | N | |
| 5 | NPC groups and simulation | `studio.mjs:604-605` | Y | Y | N | |
| 6 | Romance agents, NPC chemistry | `studio.mjs:584` | Y | Y | N | |
| 7 | Stat milestones | typed system `creator-systems-contract.mjs:13` (r) | Y | Y | Y | `creator-systems-controls.test.mjs:56`; blank rejected |
| 8 | Daily needs (reward, against-Like, needs) | typed system `creator-systems-contract.mjs:13` (r) | Y | Y | Y | `creator-systems-controls.test.mjs:56`, `gc6-1-control-audit.test.mjs` |
| 9 | Dialogue reactions | `studio.mjs:511` `dialogueReactionsEditor` (r) | Y | Y | Y | `creator-mechanics-controls` |
| 10 | Gift settings | `studio.mjs:648` | Y | Y | N | |
| 11 | Social pacing, unwelcome flirt, gift repeat | `studio.mjs:579-580` | Y | Y | N | |
| 12 | Lust baseline, scene feedback, recap, slip guard, anniversary | `studio.mjs:585`, `636-646` | Y | Y | N | |
| 13 | Gossip rules | `studio.mjs:446` `gossipEditor` (r) | Y | Y | N | |
| 14 | First experiences (`firsts`) | typed system; legacy JSON removed (r) | Y | Y | Y | `creator-systems-controls.test.mjs:61,63` |
| 15 | Character-change arcs | typed system | Y | Y | Y | system roundtrip (`:61`) |
| 16 | NPC encounter dialogue | typed system | Y | Y | Y | system roundtrip; `creator-systems.test.mjs` |
| 17 | Romance ranks, tempo, intimacy profiles | advanced contract | Y | Y | Y | `creator-advanced-controls` |
| 18 | Secrets, agreements, witnesses, overrides | `studio.mjs:639` `secrecyEditor` (r) | Y | Y | Y | `studio-secrecy` |
| **GC6.3 Scenes, conditions, rules** |||||||
| 19 | Scripted scenes (triggers, effects) | advanced `scriptedScenes` | Y | Y | Y | `creator-advanced-controls` |
| 20 | Scene choices | `studio.mjs:252-293` (r) | Y | Y | N | choice list editable; gate row has no test |
| 21 | Event payload match and waits | `studio.mjs:248` JSON textarea (r) | Y | Y | Y | typed via advanced JSON textarea, not a form |
| 22 | Presence and location conditions | `creator-systems-contract.mjs`; scene `when` | Y | Y | Y | `creator-mechanics-controls` |
| 23 | Story-flag conditions (`when.flags`) | `studio.mjs:262`, `293` (r) | Y | Y | N | true only; false not authorable (T5) |
| 24 | Nested AND/OR conditions | none; `conditions.mjs:10-26` is flat AND (r) | N | N | N | no grammar in engine (T6) |
| 25 | Ending gates: phases, ranks, intimacy, scenes | `studio.mjs:448` `endingEditor` (r) | Y | Y | Y | `creator-mechanics-controls` |
| 26 | Ending gates: flags required false | `studio.mjs:448-449` note: "edit in advanced JSON" (r) | N | N | N | preserved, not authored (T5) |
| 27 | Stage, transition, escape rules | `studio-rules.mjs` via `studio.mjs:610` | Y | Y | Y | `studio-rules-controls` |
| 28 | Plans and promises | `studio-rules.mjs` | Y | Y | Y | rules contract tests |
| 29 | Objectives (`quests`) | `studio.mjs:567` (r) | Y | Y | N | extra conditions only via advanced JSON (T7) |
| 30 | Timed events | `studio.mjs:447` `timedEventEditor` (r) | Y | Y | N | runtime tested; form round trip not named |
| 31 | Facts, fact reveals, knowers | `studio-knowledge.mjs` via `studio.mjs:582` | Y | Y | Y | `studio-knowledge` |
| 32 | Story variables | `studio.mjs:252-262` | Y | Y | N | |
| **GC6.4 World, schedules, economy** |||||||
| 33 | Locations | `studio.mjs:540` (r) | Y | Y | Y | rename test rewrites references |
| 34 | Map exits | `studio.mjs:540` typed IDs (r) | Y | Y | N | no target picker; unknown targets not flagged (T7) |
| 35 | Calendar start and weekday | `studio.mjs:570` | Y | Y | N | `calendar-world.test.mjs` is runtime only |
| 36 | Dayparts | `studio.mjs:616` | Y | Y | N | runtime only |
| 37 | Weekly routines and stops | `studio.mjs:351-372` (r) | Y | Y | Y | `schedule-preview` |
| 38 | Schedule exceptions | typed system; `public/schedule-resolver.mjs:3` (r) | Y | Y | Y | `schedule-preview` |
| 39 | Activities and daily limits | activity controls | Y | Y | Y | `studio-activity-controls` |
| 40 | Paid services | typed system | Y | Y | Y | system roundtrip |
| 41 | Wage rules | typed system | Y | Y | Y | system roundtrip |
| 42 | Economy, currency, invitations | advanced contract | Y | Y | Y | advanced settings round trip |
| 43 | Item-combination recipes | typed system | Y | Y | Y | system roundtrip |
| 44 | Ambient moments and tuning | typed systems | Y | Y | Y | system roundtrip |
| 45 | Sobriety | typed singleton | Y | Y | Y | system roundtrip |
| 46 | Touch ladder, private locations | typed singleton | Y | Y | Y | system roundtrip |
| 47 | World events (date windows) | `studio.mjs:601` (r) | Y | Y | N | generation tested; form not |
| 48 | Jobs and shifts | specialist `jobSettings` | Y | Y | Y | `creator-specialist` |
| 49 | Courses and grades | specialist `academicSettings` | Y | Y | Y | `creator-specialist` |
| 50 | Feed friends and popularity | specialist `feedSettings` | Y | Y | Y | seeded-roll tests |
| **GC6.5 Social, phone, feed, director** |||||||
| 51 | Phone messages | advanced typed control; legacy JSON removed (r) | Y | Y | Y | `creator-advanced-controls` |
| 52 | Feed posts | advanced typed control; legacy JSON removed (r) | Y | Y | Y | `creator-advanced-controls` |
| 53 | Director profile | `studio.mjs:83-86` | Y | Y | N | engine tests only |
| 54 | Director templates | advanced `directorTemplates` | Y | Y | N | `director-library` engine only |
| **GC6.6 Save and validation** |||||||
| 55 | Ordinary Save | `studio.mjs:117`, `623`; `server.mjs:174` (r) | Y | Y | N | save skips `validatePack` (T3) |
| 56 | Check, validate, playtest | `studio.mjs:624`; `server.mjs:210,220` (r) | Y | N | Y | read-only by design |

## Totals

Computed from the table rows above (56 rows).

- Control present: 54 of 56 (N: rows 24, 26).
- Persisted: 53 of 56 (N: rows 24, 26 and 56, which is read-only by design).
- Has test: 33 of 56.

These are inventory counts, not coverage. A "Y" in C means some visual control writes the field, not that every nested option is authorable. Partial rows: 20, 21, 23, 29, 30, 34, 47, 53, 54, 55.

## Defects still open

- `studio.mjs:448-449`: flag requirements that must be false are not authorable; the note sends users to advanced JSON.
- `studio.mjs:262`, `293`: choice gates read `Object.keys(when.flags)` and only set true.
- `server.mjs:174`: ordinary Save runs `validateWeeklyRoutines` and `validateProjectUi`, not `validatePack`. `validatePack` runs on Check, validate and playtest (`server.mjs:210,220`).
- `studio.mjs:540`: exit targets are typed IDs with no picker, and `packages/core/engine.mjs:171` checks only array shape.
- `studio.mjs:567`: objective extra conditions are sent to advanced JSON.

## Missing controls (top five)

1. Nested AND/OR `when` grammar (row 24). Owner decision on grammar, depth limit, and migration of flat `when` objects. Blocks GC6.3.
2. Tri-state false flags for endings and choice gates (rows 23, 26). Decide control shape.
3. Ordinary Save validation policy (row 55). Owner decides between refusing invalid drafts and saving with blockers.
4. Exit target picker with unknown-target field errors (row 34).
5. Quest extra-condition form reusing the shared `when` editor (row 29).

Lower priority, no controls missing but no round-trip test: calendar and dayparts (35, 36), director profile and templates (53, 54), timed events and world events form (30, 47).

## Changes

- Added `tests/gc6-1-control-audit.test.mjs` (3 tests): typed dailyNeeds and statMilestones reject blank or out-of-range values; `studio.mjs` has no `dataEditor(` call and no native dailyNeeds or statMilestones editor. These check the claims that were otherwise unverified in this table.
- Rewrote this doc. No product code, `public/`, `packages/`, `server.mjs` or `packs/` changed.
