# Director thin-slice audit (O5) — what already ships

Ticket: T-052 (analyzer, no code) · Audited at `5c48b34` against `packages/modules/director.mjs`
Scope: the five thin-slice steps 1–5 of `docs/design/director-dm.md:52-58`. One line per item, then the instruments, then drafts for what is still open.

## Findings

| # | thin-slice item | verdict | evidence |
|---|---|---|---|
| 1 | never arm/tease an ignorable offer | **shipped** | `director.mjs:225` filters the tease pool with `.filter(x=>x.delivery!=='offer')`; the armed id carries its delivery (`:225`) and `adaptivePick` binds to it (`:94`); `dealNow` arms `'incident'` explicitly (`:78`); the legacy tease draws from complications only (`:241`). Test `tests/director-dm.test.mjs:27`. |
| 2 | capped ignored-beat escalation from `story.scenes.history` | **shipped, one gap** | handler `:129-141`; escalation queued at `tone+1`/`intensity+1` with the dismissing `commandId` (`:135-137`); cap via `escalated[entry.id]` → `story.beatDropped` + `'passed for good'` note (`:134`); fires once at the next quiet/early boundary, no deck cost (`:215-220`); same-command guard `:215`; notes capped at 10 (`:134`,`:137`,`:218`), shown in the panel (`:324`). Tests `:38`, `:88`. Gap: notes live in `story.director.notes`, not a `story.scenes`-adjacent path, and `directorContext` (`:107-111`) does not expose them. |
| 3 | history-fed callback line | **shipped** | `lastBeatOf` `:98-102` reads `story.scenes.history.at(-1)`, resolves the title, names up to two cast for `director.*` scenes and distinguishes played/resolved from dismissed; `withLast` `:105` substitutes `{last}` at deal time (incident `:79`/`:95`, deal `:88`, tease `:225`, escalation `:217`); `directorContext` spreads it (`:110`). Tests `:97`, `:148`, `:139`. |
| 4 | spotlight weight | **shipped** | `scoreBonus` `:40` last term penalises `c.focus===current.lastFocus` by −12 when `rotate`; `bestOf` `:49` arms `rotate` per draw only when the deck is mixed (a candidate whose `focus` differs and whose cast includes a non-`datingProfiles` id) and mode is `quiet`/`none`; never points away from `topAttentionOf` (`:34`); `lastFocus` written on every adaptive deal path (`:80`, `:95`, `:218`, `:233`). Tests `:123`, `:158`; equity metric `fun-metrics.mjs:78`. Caveat: the forced `dealNow` draws (`:160`, `:169`, `:180`) and the legacy path (`:230`, `:241`) call `bestOf` without `current`, so rotation applies to boundary draws only. Dormant on an all-romance deck by design (`:41-45`). |
| 5 | forced tone-1 breather | **shipped, one gap** | `breatherNext` armed whenever a fired beat is tone 3 (`:80`, `:95`, `:218`, `:233`); offer-first reset at `:224`, gated so a live focus/recovery arc outranks the curve; otherwise `adaptiveBeat(..., breather)` (`:225` → `:95`) sets `mode='breather'` and `scoreBonus` `:40` scores tone>1 at −25 against tone-1 at +8. Test `:110`. Gap: the lean is a score term, not a filter — if `budgetLeft` fails, breather mode still draws from complications, so "no complication" is a strong preference only. |

**Net:** nothing is missing from steps 1–5; the design card's build note (`director-dm.md:60`) is accurate. Three residuals are below ticket size on their own and are drafted as follow-ups rather than re-planned work.

## Instruments: do they exist, and how do I run them?

All three exist in `packages/testing/fun-metrics.mjs` and all three print in `funLine` (`:95`).

| instrument | computed | gate | notes |
|---|---|---|---|
| `maxQuietDayparts` | `:44` init (`null` unless `pack.directorProfile`), counted at `:60`/`:72` as consecutive `world.daypartStarted` with no beat | `world-quiet` ≤ 1 (`:91`), reports `not-exercised` on a pack with no director profile | reported as `quiet max` |
| `trailingDrought` | `:77` — `(clock-lastBeat)/60`, minutes, 1 dp | none | tripwire only, matching `director-dm.md:96` |
| `zeroBeatWindows` | `:77` — `Math.ceil(clock/600)-beatWindows.size`, i.e. 10-minute clock windows with no beat | none | tripwire only |

`spotlight` (`:78`, `spread = top/bottom counts`) is the fourth instrument the card leans on, and the only one that is neither saturated nor ungated.

**How to run, no model, deterministic per seed:**

```
node scripts/falsify-director.mjs [--pack campus] [--days 15] [--seeds 3,11,29] [--player-only|--ignore-only] [--json]
```

Flags per `scripts/falsify-director.mjs:13-16`; usage line `:6`; instruments printed `:43`, machine-readable `:46`. `player` resolves every incident; `ignorer` walks out of every incident, which is what exercises item 2's escalation.

**With a model (typed play — the only way `deadRatio` and `repeatedProse` are exercised):**

```
node scripts/ai-game-tester.mjs --pack campus.ashford --days 5
```

Per `director-dm.md:98`. Unit coverage of all three instruments: `tests/fun-metrics.test.mjs:63`, `:94`, `:96`.

## Recommended tickets (drafts, not files)

No missing items. Three residuals:

### D1 — Recap-readable consequence notes (closes item 2's gap)

Goal: make the ignored-beat notes reachable from the derived context the day recap will read, so step 11 does not have to reach into `story.director` internals.
Read only: `packages/modules/director.mjs`, `packages/testing/fun-metrics.mjs`, `docs/design/director-dm.md`.
May change: `packages/modules/director.mjs`, `tests/director-dm.test.mjs`.
Do: add `notes` (or the newest entry only, `lastNote`) to `directorContext` (`:107-111`); keep `story.director.notes` as the store, capped at 10 as now; one line, oldest-dropping, never displacing `tension`/`armed`/`freshKind`/`lastBeat`.
Acceptance: a dismissed beat's note appears in `directorContext`; a 10-note streak still yields one line; no existing `directorContext` key changes shape.
Question for the director: does the recap want the newest note or the whole capped list as an array? A) newest only (recommended, one line) B) full array, recap picks.

### D2 — Breather is a filter, not a nudge (closes item 5's gap)

Goal: honour "draws no complication" literally when the offer-first reset cannot run.
Read only: `packages/modules/director.mjs`, `tests/director-dm.test.mjs`.
May change: `packages/modules/director.mjs`, `tests/director-dm.test.mjs`.
Do: in `adaptiveBeat` (`:95`), when `mode==='breather'`, filter the pool to `tone<=1` first and keep the existing −25/+8 scoring as the tiebreak; if the tone-1 pool is empty, fall back to today's behaviour and say so in the `story.incident` payload (`mode` already says `breather`).
Acceptance: a tone-1 breather never deals a tone-2/3 complication when a tone-1 candidate exists; behaviour unchanged when it does not; legacy (non-adaptive) fixtures untouched.

### D3 — Spotlight on the forced draws

Goal: apply the `lastFocus` penalty to `dealNow` picks (mishap `:160`, witnessed `:169`, stall `:180`) as well as boundary draws.
Read only: `packages/modules/director.mjs`, `tests/director-dm.test.mjs`, `packages/testing/fun-metrics.mjs`.
May change: `packages/modules/director.mjs`, `tests/director-dm.test.mjs`.
Do: pass `current` (and the mode) into the three `bestOf` calls; keep the `near`-cast filter and the trust gates untouched — the cast filter is what makes a witnessed beat truthful, the penalty only reorders within what survives.
Acceptance: a mishap can rotate off `lastFocus` when another eligible focus exists; witnessed beats never cast someone outside `event.payload.characters`; spotlight spread does not rise in `falsify-director.mjs` runs.

## Noticed (out of scope)

- `docs/map/modules.md` has no `director.mjs` entry at all (`docs/map/modules.md:6-14`); the map is stale for every module past `scenes.mjs`.
- `trailingDrought` and `zeroBeatWindows` are computed and printed but are not in `funChecks` (`fun-metrics.mjs:91`), so they can only ever be tripwires — consistent with `director-dm.md:96`, but the card should say so where the gate list is.
- `story.director.notes` (`:137`) is never read by anything but the debug panel; no consumer yet.