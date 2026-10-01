# Romance stats

Owner design, 2026-10-01. Five stats per heroine, each playing differently. Code: `packages/modules/romance-stats.mjs`. Pack switch: `romanceStats: {dailyGain: 6}` (campus and every creator-assembled world). Absent = old uncapped behaviour.

| Stat | Visible | Where it lives | Moves | Gates |
|---|---|---|---|---|
| **Like** | rank bar | `social.romance-tempo` points | priced acts, gifts, activities; gains ≤ +6/day/heroine, losses uncapped | rank (stranger → friend → something more → hers) |
| **Trust** | vague | `social.relationships` edge `her--player` | talks, promises, scenes, activities, minigames, arc drift; same daily cap | arc stages, special scenes |
| **Chemistry** | hidden | `social.dating` | liked/disliked acts, rank changes; unbounded | dating phases (weakened in stage 3) |
| **Lust** | mood words + popups | stage 2 | rises and falls fast | consent verdict (stage 3) |
| **Inhibition** | hidden | stage 2 | temperament baseline; tipsy/drunk lower it; public/others present raise it | consent verdict (stage 3) |

## Stage 1 (shipped)

- **Daily cap.** Like and Trust gains are capped at `dailyGain` per heroine (a character with a `romanceTempoProfile`) per in-game day. Losses are never capped, and a loss does not refund the day's cap. Friends such as Kaylee are uncapped.
- **One Trust.** Every Trust writer goes through `changeTrust` (social talk/promise/reactions, moments, scenes, minigames, activity effects in `core/engine.mjs`, arc drift). With `romanceStats` on, the arc trait `trust` *is* the edge, so arc stages read the same number the player builds everywhere else.
- **Rescale** so the cap matters (old → new):
  - Rank points/ceilings `[0,30][20,55][45,80][70,100]` → `[0,10][6,24][20,36][32,50]` (owner call: friend 6, something more 20, hers 32). With 6/day plus gifts and steady play: friend Day 1, something more ≈ Day 3–4, hers is a stretch goal for a 4-day run unless the heroine is bold.
  - Positive act points ÷3 (min 1). **Losses cap at −3** (acts, bad gifts, arc drift).
  - Gifts are big: loved 6 (a full day of Like in one go), liked 4, disliked −3; a bought round 2; activity signals 2. **Neglect is removed** (the module still supports it; no pack uses it).
  - Arc trust drift uses the act rule; arc trust gates are her starting Trust +6 / +15 (presets store the offsets).
- The cap slows the *commitment* ladder on purpose. The fast erotic loop is Lust (stage 2), and sex never requires dating.

## Next

- **Stage 2:** Lust (visible, fast decay, mood words) and Inhibition (hidden; temperament baseline; tipsy/drunk lower, public/others raise).
- **Stage 3:** steps kiss → making out → foreplay → sex plus Trust/interest special scenes, with a high-stat bypass; in-scene consent verdict (Lust vs Inhibition → yes / hesitant / not yet) handed to the narrator; "not yet" costs a little; tipsy consents, drunk waits for sex; places are her call (remove private-place and nobody-else rules, Inhibition modifiers instead); soft-gated heroines get lower Inhibition when dating; commitment needs her storyline resolved; **undated sex unlocks exactly one basic sex scene; every other sex scene (and specials) needs the dating gate** (owner call 2026-10-01); weaker chemistry; varied pace (one bold heroine Day 1–2, two medium, Jana Day 3–4).
