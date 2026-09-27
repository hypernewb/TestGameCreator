# Romance tempo and gifts

`social.romance-tempo` is an optional pacing layer over dating and inventory. It uses the useful shape of Persona-style relationship ranks and Stardew-style gift tastes without forcing every character into a long courtship route.

Each `romanceTempoProfiles` entry owns a point bank and ordered ranks. A rank has a required point total and a ceiling. Profiles choose `advancement: "scene"` or `advancement: "automatic"`.

- `scene` is the default for major routes. Reaching a threshold emits `social.romanceRankReady`; an authored scene resolves a `romanceRank` effect and lifts the ceiling.
- `automatic` advances immediately when the threshold is reached. It supports short, low-friction romances and casual sexual routes without mandatory rank-up scenes.
- Omitting a character from `romanceTempoProfiles` removes rank grinding entirely. Dating and intimacy can still provide attraction, consent, encounters, and consequences.

These choices are per character. One game may contain a long slow-burn partner, a short friends-with-benefits route, a promiscuous character open to consensual casual encounters, and non-romance NPCs at the same time.

Gift preferences assign an authored reaction and optional point, chemistry, and satisfaction changes. `limitPerPeriod` stops gift spam, while `repeatDecayPercent` reduces repeated gestures. Gifts beyond the limit still transfer and produce `social.giftLimitReached`; they do not secretly fail or award points. The AI receives rank, ceiling, readiness, and a short recent-gift history, but narration cannot alter them.

```json
{
  "character": "ada",
  "advancement": "scene",
  "ranks": [
    {"id":"acquainted","name":"Acquainted","points":0,"ceiling":10},
    {"id":"trusted","name":"Trusted","points":10,"ceiling":30,"scene":"ada-trust-scene"}
  ],
  "gifts": {
    "periodTicks": 7,
    "limitPerPeriod": 2,
    "repeatDecayPercent": 50,
    "preferences": [{"item":"rose","reaction":"loved","points":10,"chemistry":3}]
  }
}
```

For a short route, use `"advancement":"automatic"`; later ranks do not need `scene` fields or the `story.scenes` module. An intimacy category may additionally use `"resolution":"direct"` to commit a consensual encounter without a bespoke scripted scene. Easy access never overrides adult validation, orientation, boundaries, privacy, cooldowns, or explicit consent.

Run `npm run audit:playtest -- --pack packs/your-pack.json --turns 50 --seed 42` for a reproducible route audit. Never-fired scenes are informational because one route cannot prove content is unreachable; orphaned beats, action failures, and queue evictions are critical findings.
