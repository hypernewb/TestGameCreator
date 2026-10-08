# GC2.2 compatibility contract (2026-10-08)

Status: contract written from the code as of `c3be181`. It describes what the current bridge does and asserts it in `tests/gc22-compat-contract.test.mjs`. It adds no engine behaviour. Owner decisions it relies on: the progression section of [NEXT-MILESTONES](../NEXT-MILESTONES.md#character-progression-milestones-2026-10-08) and the "Decisions (2026-10-08)" list in [progression-gap-2026-10-08](progression-gap-2026-10-08.md). `docs/research/owner-decisions-2026-10-08.md` does not exist in the repo, so it was not used.

Sources: [core/progression.mjs](../../packages/core/progression.mjs) (the bridge), [modules/romance-stats.mjs](../../packages/modules/romance-stats.mjs), [core/engine.mjs](../../packages/core/engine.mjs), [persistence/store.mjs](../../packages/persistence/store.mjs), [cards/world-assembly.mjs](../../packages/cards/world-assembly.mjs).

## 1. Flag

- Name and place: `pack.progression.version`, a top-level pack key next to `romanceStats`. Value `1` (`PROGRESSION_VERSION`). Integer, 1 or higher. `validateProgression` runs from `validatePack` (engine.mjs).
- Absent means version-0 behaviour: no stamp, no marker. Shipped social packs already carry `{version: 1}`. Packs without the field (for example `other-world.json`, `threshold.json`) are the only real "flag off" packs.
- Set by `withProgression` for generated and published packs that use `social.relationships`. Packs that already have the key are untouched.
- Schema: `schemaVersion` stays `1`. Do not bump it.
- Digest: the flag is **not** part of `mechanicsShape`, so it is not part of `mechanicsDigest`. See Unverified U1.

## 2. Per-turn marker and stamp

Two records, both written only by flagged turns:

| Name | Where it lives | Written by | Meaning |
|---|---|---|---|
| Cutover stamp `state.progression = {version, cutover:{turn, revision, tick}}` | save state, written as a `core.patch` on path `['progression']` | `execute`, first turn run under a flagged pack and only if the save has no stamp (engine.mjs, `cutoverStamp`) | This save switched to progression version 1 at that turn. Set once. |
| Rules marker, event type `social.progressionRules`, payload `{version:1, dailyGain:n}` | a turn's `events` | `markRules` (romance-stats.mjs), called from `changeTrust` and `addPoints`. Only when the turn is stamped, the pack has a `romanceTempoProfiles` entry for that character, and the gain is positive. At most one per turn. | The cap this turn used. Replay reads it back so a later edit to `romanceStats.dailyGain` cannot rewrite history. |

Read paths:

- `store.mjs` `rulesFor` decides per turn whether it is flagged: flagged if the rebuilt save already has `progression`, or the turn is the stamp turn. Stamp turn must match `cutover.turn`.
- Flagged turns go through `assertMarkers` (version 1, integer `dailyGain` 1–100, at most one marker) and then `replayPack`, which swaps the marker's `dailyGain` into the pack for that turn.
- Unflagged turns replay through `legacyPack`, which drops `pack.progression` only. Explicit `romanceStats` still applies to them, as it always did.
- Default cap: `dailyGainOf` = `romanceStats.dailyGain`, else `6` if the save is stamped, else none. The cap only bites for characters with a `romanceTempoProfiles` entry (`cappedGain`).

## 3. Rule for old saves (no stamp, no marker)

- R2: an old save imports to the same state with the flag off or on. It stays unstamped and has no markers. Nothing is awarded retroactively.
- Old turns are never re-executed under new rules. Their recorded events are the history.

## 4. Rule for mixed saves

- R5: a save that was unflagged and becomes flagged keeps every earlier turn's events byte-identical. Its first turn under the flag writes the stamp. Only turns from the stamp onward carry markers.
- R4/R6: after the stamp, each capped-gain turn has exactly one marker, and an edited `romanceStats` does not change a saved turn.
- Mixed history (unmarked turns, then stamped and marked turns) is therefore valid by construction. A save never needs a migration to get the flag.

## 5. Missing and tampered records

- R7: a stamped turn with a positive profiled gain and no marker is rejected as `Event history is inconsistent`. Replay re-emits the marker, so the event comparison catches the gap. `assertMarkers` alone would not.
- R8: a removed or moved stamp is rejected (`Progression stamp does not match the save`). A marker with `version` other than 1 is rejected (`Unsupported progression rules`).
- R1: `progression.version` values `0`, `1.5`, and non-integers are refused at validation.
- R9: an unknown version (for example `2`) passes validation but `execute` refuses it (`Progression version 2 is not supported by this build; the save is read-only`). Import of a version-1 save under a version-2 pack is refused the same way.

## 6. Rules asserted

R1 flag shape and digest independence. R2 old save, flag off and on. R3 flag off writes nothing and explicit cap still applies. R4 flag on stamps once and one marker per capped turn. R5 mixed save keeps history. R6 marker pins cap. R7 missing marker rejected. R8 stamp and marker tampering rejected. R9 unknown version refused.

**Nine rules asserted.** All pass with `node --test tests/gc22-compat-contract.test.mjs`.

## 7. Not changed by this contract

- `schemaVersion` (still 1), `mechanicsShape` and `mechanicsDigest`, and the pre-change digest fixture.
- The bridge itself: one flag, one stamp, one marker name. No second store, event bus, rule engine or importer.
- Shipped packs' `progression` values. Existing saves' events. Retroactive awards.
- Product behaviour of any new effect. The CP1/CP3/CP6 items (reactions on `core.sceneStarted`, ordinary scene talk earning trust, routing `director.mjs:59` through `changeTrust`, a default cap for packs without tempo profiles) are not implemented here. When one is, it goes behind `progression.version`, and its replay inputs are recorded in the same marker family. This contract does not agree a new marker name.
- The `'continuation'` value in `packages/ai/beats.mjs` is a conversation phase, not a replay marker. It is out of scope.

## 8. Unverified

- U1 **Conflict with CP2 wording.** The plan says the flag belongs "in mechanicsDigest". The code keeps it out, and `progression.mjs` says so on purpose. Putting it in would make every existing save fail `execute`'s `packDigest` check (`Pack changed: migration required`) when the flag is first added. The contract keeps it out. The owner needs to confirm this reading. Not asserted as a choice, only as current behaviour (R1).
- U2 A flagged turn with no profiled positive gain writes no marker. Expected by reading `markRules`, not asserted directly.
- U3 A marker's `dailyGain` rewritten to another value from 1 to 100 is accepted on import, because replay adopts the marker's value and re-emits the same marker. Reasoned from `rulesFor` and `replayPack`. Not run. This may be a real gap for hand-edited saves.
- U4 Default cap at cutover: an old unstamped save under a flagged pack with `romanceTempoProfiles` but no `romanceStats` gets the default 6 cap from its first post-stamp turn. R5 uses campus, which sets `dailyGain: 6` explicitly, so this path is not covered.
- U5 Flag on for a pack without `social.relationships`: `validateProgression` accepts it and `withProgression` skips it. The effect on stamping was not traced.
- U6 The owner's "daily cap default for social packs" decision: `cappedGain` only caps characters with a tempo profile, so packs without profiles are still uncapped. Not implemented. Not asserted.
- U7 Studio or Game UI display of the flag or stamp state. Not checked.
- U8 Browser suites were not run. This contract is non-browser only.
