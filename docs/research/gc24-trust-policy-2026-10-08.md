# GC2.4 trust policy check (2026-10-08)

Scope: GC2.4 in `docs/GAME-CREATOR-COMPLETION-PLAN.md` on top of the [GC2.2 contract](gc22-compat-contract-2026-10-08.md). Flag = `pack.progression.version`; per-turn marker = `social.progressionRules`. Product code unchanged. Behaviour is pinned in `tests/gc24-trust-policy.test.mjs`. Verified-by-test rules drive the real `changeTrust` or the real `core.scene` / `test` commands through `execute`. Both flagged (version 1) and unflagged packs are used where the rule can differ.

## Writers

`changeTrust` (`packages/modules/romance-stats.mjs`) is the one gain writer. Callers found by grep: `social.mjs` (talk, promise, authored reactions), `daily-need.mjs`, `touch-ladder.mjs`, `flirt-cap.mjs`, `minigames.mjs`, `outreach.mjs`, `moments.mjs`, `scenes.mjs`, `arc.mjs`, `dating.mjs` (breakup scar), `jealousy.mjs`, `engine.mjs` (activity effects), `director.mjs` (flagged branch).

Direct writes to `['modules','social.relationships','edges',…]` exist in two places only: `romance-stats.mjs` (inside `changeTrust`) and the unflagged director branch in `director.mjs`. `engine.mjs` line 209 seeds `initialRelationships` at creation and is not a trust change.

## Rules

Verified (pinned by `tests/gc24-trust-policy.test.mjs`):

- V1 Flagged campus: gains cap at `romanceStats.dailyGain` (6) per heroine per day; the first capped turn writes one marker with `dailyGain: 6`.
- V2 Flagged campus: a same-day gain after the cap pays 0.
- V3 Flagged campus: losses are never capped (-10 lands in full).
- V4 Flagged, no `romanceStats`: the default cap of 6 applies from the stamp turn.
- V5 Unflagged campus: the explicit cap still applies; no stamp, no marker.
- V6 Unflagged, no `romanceStats`: gains are uncapped.
- V7 Disabled module (no `social.relationships`): `changeTrust` returns 0 and emits nothing.
- V8 Talk: fresh substantive speech pays +1; the same line again pays 0 (flagged and unflagged).
- V9 Promise: pays +2 once per edge; a second promise pays 0 (flagged and unflagged).
- V10 Authored reaction repeat: full, then half, then 0 inside the cooldown window (flagged and unflagged).
- V11 Authored reaction cooldown expiry: after the window the full effect returns.
- V12 Negative reaction: -4, then -2 on repeat; a turn without the phrase fires no reaction.
- V13 Grep pin: only `romance-stats.mjs` and `director.mjs` write relationship edges by `tx.set`.

Todo-gap (`test.todo` in the test file):

- G1 Default daily cap for flagged packs with no `romanceTempoProfiles` (CP6 / U6 in the GC2.2 contract). Neutral gains are uncapped.
- G2 Director missed-goal unflagged branch writes edges directly, not through `changeTrust`. Kept on purpose for GC2.2 replay; the GC2.4 bullet asks for `changeTrust` everywhere, so an owner call is needed.

Unverified-by-reading:

- U1 Daily-need reward through `changeTrust` under the cap. Existing `tests/daily-need.test.mjs` covers the reward cap; not re-driven here.
- U2 Other `changeTrust` callers (activities, scenes, moments, minigames, outreach, touch ladder, flirt cap, jealousy, dating scar, arc): confirmed by grep only.
- U3 Cap reset on the next day. Existing `tests/romance-stats.test.mjs` names it; not re-driven here.
- U4 Flirt-spent zeroing of positive talk and reaction gains (`flirtSpent` in `social.mjs`): read, not tested.
- U5 Promise +2 under the daily cap: goes through `changeTrust`, so capped when `romanceStats` is set; not driven.

## Notes

- Scene speech needs quotes to count as speech (`sceneUtterance`); unquoted or action text fires no `social.spoke`.
- Ticks advance on `core.wait` and on scene open, not on scene continue. Cooldown tests use `core.endScene` plus waits.
- Browser suites were not run.
