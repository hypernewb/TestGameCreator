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

Signals award points when an authored event fires. A non-repeatable signal pays out once. A `repeatable` signal can take `cooldownTicks` (default 0). Each repeat of it within `windowTicks` (default 7) keeps `repeatDecayPercent` (default 50) of the previous value. Spamming one compliment is therefore worth less than twice its first award, and the value comes back once the window passes. Negative signals never decay.

`jealousy` gives a character a preset reaction to rival moments the character personally saw:

| Preset | Points | Satisfaction | Cooldown (ticks) | Agreements |
|---|---|---|---|---|
| relaxed | 0 | -2 | 12 | monogamous |
| secure (the default) | -2 | -5 | 8 | monogamous |
| guarded | -4 | -8 | 4 | monogamous, open |
| possessive | -8 | -15 | 2 | any agreement |

A preset reacts to `social.romanticInteraction` or `social.intimacyExposed`, but only when all of the following hold:

- the event's `payload.witnesses` includes the character;
- the rival (`target` or `character`) is someone else;
- the character's dating phase is `dating` or `exclusive`;
- the current agreement is in the preset's list.

When a preset fires, it emits `social.jealousyTriggered`, which only the player and the character can see. You can override any preset value, plus `events` and `text` (`{name}`, `{rival}`), for example `{"preset":"guarded","cooldownTicks":6,"text":"{name} watches you with {rival}, jaw tight."}`. Rumors about the player do not trigger jealousy. Author that through gossip or scene effects.

`neglect` is an optional "bomb", borrowed from Tokimeki Memorial. Once a character holds at least `minPoints` (default 20) and hears nothing from the player for `afterTicks` (default 24), the module emits `social.neglectWarning`, which only the player and that character see. Any positive signal or gift within the next `fuseTicks` (default 12) emits `social.neglectDefused`. If the fuse runs out, the module emits `social.neglectDetonated`, applies `points` (default -6) and `satisfaction` (default -5), and lists everyone in the character's room in `witnesses`. A gossip rule on that event with `"seedFrom":"witnesses"` turns the outburst into a rumor. Other characters can then react through a tempo signal on `social.rumorBelieved` with `match:{"rule":"<id>","character":"<them>"}`. Characters below `minPoints` never set off the bomb, so only people who care about the player can feel neglected. Texts take `{name}`.

`birthday` borrows from Stardew Valley. Set either `day` (a campaign day number, optionally with `cycleDays` so it repeats) or `date` (`MM-DD` on a pack with a dated calendar). When the day starts, the module emits `social.birthday`, which only the player and the character see, and the AI context gets `birthdayToday`. The first gift on that day ignores the gift limit for the period and is multiplied by `giftMultiplier` (default 3), after the usual repeat decay. A hated gift gets multiplied too. If an announced birthday passes without a gift and the character holds at least `minPoints` (default 20), the module emits `social.birthdayForgotten` and applies `forgottenPoints` (default -3). A birthday that falls before its announcement, such as on day 1, is never held against the player.

For a short route, use `"advancement":"automatic"`; later ranks do not need `scene` fields or the `story.scenes` module. An intimacy category may additionally use `"resolution":"direct"` to commit a consensual encounter without a bespoke scripted scene. Easy access never overrides adult validation, orientation, boundaries, privacy, cooldowns, or explicit consent.

Run `npm run audit:playtest -- --pack packs/your-pack.json --turns 50 --seed 42` for a reproducible route audit. Never-fired scenes are informational because one route cannot prove content is unreachable; orphaned beats, action failures, and queue evictions are critical findings.
