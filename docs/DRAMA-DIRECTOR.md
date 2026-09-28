# Drama director (F8) — `story.director`

The engine, not the model, decides when drama lands. The director keeps a deterministic **tension** score: eventful play raises it (a scripted beat resolved, romance moved, jealousy, a broken plan), the clock decays it. A daypart whose tension sits below `activeThreshold` at the boundary counts as **quiet**. After `quietDayparts` quiet dayparts in a row, the director draws one **complication** and emits `story.incident` — an authored scripted scene triggers on that event and plays through the existing scene queue exactly like any world-triggered scene. Waiting is quiet, so long rests and grind loops reliably produce drama instead of dead turns.

## Borrowed designs

| Source | Idea borrowed | Where |
|---|---|---|
| Left 4 Dead AI Director | Build-up → peak → release: tension fed by play, decayed by time, quiet streaks spawn complications | the tension loop |
| RimWorld storytellers | Pacing personalities as authored presets, not hardcoded behavior | `preset: cassandra / randy / phoebe` |
| Façade / Versu | The engine picks the beat, the model only voices it; content is always authored | complications are `scriptedScenes`, never generated |
| Slay the Spire | Deck discipline: weighted draw with seeded jitter, "recently played" penalty, cooldowns, limited uses | selection scoring |
| Wildermyth | Escalation: heavier drama unlocks as campaign days pass | `intensity` 1–3 gated by `escalationDays` |
| Persona / Monster Prom | The daypart calendar is the drama currency | `maxPerDay`, boundaries counted in dayparts |

## Pack schema

```json
"directorProfile": {
  "preset": "cassandra",
  "quietDayparts": 2, "earlyChancePercent": 0, "jitter": 10, "escalationDays": 3,
  "decayPerTick": 3, "activeThreshold": 25, "maxPerDay": 1, "firstTick": 8,
  "opportunityChancePercent": 45, "interruptionChancePercent": 40, "opportunitiesPerDay": 3,
  "tensionEvents": [{"event": "social.spoke", "weight": -3, "match": {"location": "hub"}}],
  "complications": [
    {"id": "jealous", "scene": "jealous-scene", "kind": "jealousy", "intensity": 2,
     "weight": 10, "minTick": 0, "cooldownTicks": 12, "maxUses": 1,
     "when": {"datingPhases": {"ada": "dating"}},
     "text": "Ada saw something she did not like.",
     "tease": "Ada keeps glancing at her phone."}
  ],
  "opportunities": [
    {"id": "crate-digging", "scene": "crate-digging", "weight": 12},
    {"id": "after-work-drinks", "scene": "after-work-drinks", "weight": 12,
     "match": {"activity": "bar-shift"}}
  ]
}
```

A complication's scene must `trigger` on `story.incident` with `match.incident` equal to the complication ID; it cannot be a hand-offered storylet, and `maxUses > 1` requires a `repeatable` scene. Everything else about the scene (cast, pages, choices, checks, effects) is authored as usual. A scripted scene may also carry `tension` (-50–50), which replaces the flat default beat weight when that scene resolves — big moments can weigh more, reconciliations can weigh negative and cool the story down.

## Opportunities — the reward side of the mirror (`offer: "director"`)

Drama is only half a director. The mirror side deals **event actions**: authored scenes with `offer: "director"` that surface as separate choosable actions (with a storylet card: title, cast, place, time cost, `offerHint`) the player can take or ignore. Taking one spends its `timeCost` — author it as a whole daypart — and plays a scene full of meaningful choices whose effects pay out **stats, money, loot (`item` effects), affection (`trust`/`chemistry`)** or all four. Nothing is forced and no model call is made; the director only decides *which* event is on offer and *when*.

Two deal paths, one deck:

- **Quiet dayparts** — after at least one quiet boundary while tension sits below the threshold (drama not due, or due and dry), each boundary rolls `opportunityChancePercent`; on a hit the director deals one event from entries *without* `match`. The complication path still wins any boundary it fires on, so drama and windfalls never share a beat.
- **After work** — finishing an authored activity rolls `interruptionChancePercent`; on a hit the director deals one event whose `match.activity` equals the finished activity ("the shift ends and Juno is heading to the canal with one bottle and two glasses"). Work events therefore land *with* the work they belong to.

`opportunitiesPerDay` caps deals per campaign day. Offers live until taken or dawn (they expire when the calendar day rolls over and the deck may deal them again); a taken event counts its `maxUses`/`cooldownTicks`/recent-penalty in the same deck discipline as complications, and scenes must set `offer: "director"` so they can never auto-start from a trigger. Location- and cast-gated events (`when.location`, `when.charactersAt`) are only dealt while the world supports them, the same way complications are.

## Semantics

- **Tension** starts at 0, clamps at 100. Built-in weights cover the common drama events (`story.choiceResolved` +8 unless the resolving scene has its own `tension`, `social.jealousyTriggered` +15, `story.planBroken` +10, `social.neglectDefused` −8, …); `tensionEvents` add pack-specific weights with optional payload match. Decays `decayPerTick` per elapsed tick.
- **Quiet counting** happens only on `core.timeAdvanced`, once per crossed daypart boundary: below threshold adds the crossed boundaries to the streak, at-or-above resets it. A long `core.waitUntil` jump crosses many boundaries at once.
- **Teaser and armed draw.** One boundary before the streak would fire (`quietDayparts ≥ 2`), the director pre-commits its pick and emits `story.teaser` to the player (authored `tease` text or a generic line). At the next boundary the *armed* complication fires — the tease is honest by construction. An eventful boundary (tension at or above the threshold) forgets the tease and returns the beat to the deck; the player was warned softly, so authors should keep tease text suggestive rather than promissory.
- **Firing gates**: past `firstTick`, no scripted scene pending, not already fired `maxPerDay` times today, and the drawn complication must be fully playable right now — its own `when`, its scene's `when` and page speakers, cooldown, uses, intensity tier, not completed (unless repeatable), not already queued.
- **Starvation is loud.** If the streak reaches the threshold and no complication is eligible, the director emits `story.starved` (trace visibility, once per streak) so playtests can measure dry spells instead of failing the F8 gate silently.
- **Draw**: highest `weight + jitter·rand() − (8 if played recently)` wins, seeded via the campaign RNG so replays are exact. Ties keep authored order. The armed complication, when still eligible, fires instead of redrawing.
- **Whim** (randy): with `earlyChancePercent`, a boundary can fire during eventful play too — the storyteller interrupting a good streak. Whims are unarmed and unteased; keep randy packs' tease texts compatible with surprises.
- **Provenance**: the `story.incident` payload records `incident`, `scene`, `kind`, `intensity`, `mode` (`quiet`/`whim`), `armed`, `tension`, `quiet`, `text` — countable in playtests (F12) and visible in the turn inspector.

## Narrator brief

`directorContext(state, pack)` (also projected into AI context as `director`) exposes tension, quiet streak, drama tier, the armed tease, and the kind of the most recent incident. `briefOf` turns that into at most one sentence — charged days lean into subtext, a teased beat leans toward giving, fresh fallout colors the aftermath — and `beats.mjs` appends it to the per-turn direction. Most turns it is empty, so the prompt pays no tokens for a quiet story. Authored scenes carry their own drama; the brief only shapes improvised, free-form scenes.

## Authoring notes

- Pair complications with the systems that already exist: a jealousy beat gated on `datingPhases`, a secret going public gated on gossip stances via scene conditions, a broken-plan confrontation gated on `plans`, a rival-move scene gated on `trust`. The director supplies *when*, the scene supplies *what*.
- Give early scenes intensity 1 and save 2–3 for later days so escalation has somewhere to go.
- One complication per kind of trouble reads better than three variants of the same one; `cooldownTicks` covers pacing, `maxUses: 1` covers once-per-run twists.
- The F8 gate: a seeded run that only waits never goes more than `quietDayparts + 1` dayparts without an incident, as long as the pack keeps an eligible complication in its deck.
- Give opportunities *distinct rewards* (one pays money, one pays a stat, one pays loot, one pays affection) rather than four reskins of "small money"; a check makes the bigger payout feel earned and failure keeps a consolation branch.
- Give every opportunity a `when` worth the player's time: `location` bounds where the action makes sense, `dayparts` bounds when, `charactersAt` ties it to a person being there. An event that could happen anywhere, anytime, reads as noise; one offered at the right place and hour reads as the world noticing you.
- Tie at least one event to each major activity (`match.activity`) so routine loops (a bar shift, studying, market runs) occasionally branch into stories instead of always paying the same wage.
- The `after-hours` showcase pack ships a worked example: four complications across intensity tiers and locations (short till, an ex at the bar, a market shakedown, a landlord inspection) and six opportunities (crate digging with vinyl loot, a pub quiz, a market hustle, a quiet evening that trains stats, and work-tied after-shift drinks and stock-room windfalls).
