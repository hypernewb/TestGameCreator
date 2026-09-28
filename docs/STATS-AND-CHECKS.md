# Stats and checks

Milestone F4 in [NEXT-MILESTONES.md](NEXT-MILESTONES.md). Stat checks replace dice: the player sees the requirement up front, can plan for it, and failure moves the story forward. Nothing is random, so replay is exact and a check can't be save-scummed.

## Why no dice

A small cast over a short calendar suits a planning game better than a luck game. Persona and Monster Prom work because you can see a door is locked, spend days opening it, and walk through on the date you planned. Dice add re-roll pressure (reload the save) and make a failed romance feel arbitrary. The tension comes from time instead: every daypart spent training is a daypart not spent with someone (F3).

## Stats

Recommended player stats for adult dating packs (4 is enough; more dilutes training):

| Stat | Opens | Trained by |
|---|---|---|
| Charm | Flirting, teasing, talking your way into places | Working the bar, dressing up, social events |
| Nerve | Asking directly, escalating, bold moves, public risk | Open mic, taking risks, confrontations |
| Wit | Banter, lies, reading a situation, covering for someone | Reading, games, puzzles |
| Empathy | Comfort, noticing what someone wants, repairing damage | Listening scenes, volunteering, aftercare |

A pack can use any stats; `statDefinitions` just needs `ranks` so players see words rather than numbers.

```json
{"id":"nerve","name":"Nerve","min":0,"max":20,"visibility":"public","learnFromFailure":1,
 "ranks":[{"min":0,"name":"Shy"},{"min":4,"name":"Steady"},{"min":8,"name":"Bold"},{"min":13,"name":"Fearless"}]}
```

- `ranks`: up to 10, ascending `min`. Reaching a new rank emits `character.statChanged` with `rankUp: true` and "Your Nerve rose to Bold." Rank-ups are the moment to celebrate (F9).
- `learnFromFailure` (0–5): stat gained when a check on this stat fails. Keep it at 1: failing should help a little, never be the best way to train.

## Checks

A scene choice may carry a `check`:

```json
{"id":"ask","label":"Ask her to come home with you","result":"She finishes her drink and takes your hand.","next":"walk-home",
 "check":{"stat":"nerve","target":8,
   "modifiers":[{"when":{"flags":{"danced-with-mina":true}},"value":2,"label":"You already danced"}],
   "fail":{"result":"It comes out as a joke. She laughs, and the moment passes, but she's still looking at you.","next":"still-looking",
           "effects":[{"type":"chemistry","character":"mina","delta":2}]}}}
```

- **Value** = base stat + `statBonus` from equipped items + modifiers whose `when` holds now. Passing means value ≥ `target`.
- **Visible up front.** The action label becomes `[Nerve · Bold ✓] Ask her…`. The rank name appears when `target` is exactly a rank's `min`, so **put targets on rank boundaries**; otherwise the raw number shows. The action also carries a `check` object (value, target, modifiers) for UI and creator views.
- **A failing check stays choosable.** Choosing it is allowed; that's the point.
- **`fail` is required** and needs its own `result`. Optional `fail.effects` and `fail.next`; without `fail.next` a failed check ends the scene. `waitFor` only applies to a pass.
- Events: `story.checkResolved` (stat, target, base, value, modifiers, passed), then `story.choiceResolved` with `passed`.

## Gear

Equippable items (`slot`, with `items.equipment` on) may declare `statBonus`, e.g. `{"charm":2}`, at most ±5 per stat. Bonuses only apply to checks, not to `when.stats` gates. Outfits become a choice ("the dress or the jacket?") rather than a cosmetic.

## Training

Authored activities may raise a player stat with `{"type":"stat","stat":"wit","delta":1}` (±1–3). An activity costs its `duration` in ticks, so training spends the calendar. Good training activities come with a person: working a shift next to the witness, reading at the café where one love interest works. That way training also builds relationships and produces gossip.

## Writing good checks

- **Two ways past each important check.** A stat path and a relationship or item path (a modifier from a flag, a completed scene, gear). The player should never think "I didn't grind enough".
- **Fail forward, and make the failure a scene.** A failed kiss attempt that turns into laughter and a second chance later is content. "Nothing happens" is not.
- **Mix difficulty per character.** A confident character responds to Nerve; a guarded one needs Empathy. Stat affinities are character personality.
- **Checks never touch consent.** A check decides how *you* come across (nervous or smooth, clumsy or sure). It never decides whether someone agrees to intimacy: consent stays with `social.intimacy`, and declining or withdrawing is never behind a check.
- **Don't check the player's own feelings.** Check Nerve to *say* something, not to *want* something.

## Checks in intimate scenes

The scene triggered by `social.intimacyStarted` starts only after consent has been asked for and granted. The checks inside it shape the encounter; they never gate it. `packs/after-hours.json` (`juno-night`, `theo-night`) is the reference:

- **One checked choice, one safe choice, one stop.** The checked choice reads the partner (Nerve for Juno, who wants to be out-played; Empathy for Theo, who goes quiet). Passing it gives a `positive` `completeIntimacy` and the larger satisfaction gain. Failing it is still `neutral` and warm, a funny or clumsy scene, never humiliating. The safe choice needs no check and gives a smaller gain.
- **Both check outcomes reveal the partner's interest** (`discoverIntimacyInterest`), so failing still teaches the player something for next time.
- **Stopping is unchecked and costs nothing.** Its effects are `intimacyConsent` → `withdrawn`, then a small trust gain. Withdrawing consent, either from the choice or from the `Stop:` action, clears the active encounter and dismisses the scene.
- **Put satisfaction in the scene's effects.** `completeIntimacy` doesn't change satisfaction by outcome, only by style preference and aftercare.
- **Aftercare is where the characters differ.** Give each partner a liked and a disliked option and a different `missedAftercareDelta`. Juno wants space and shrugs off a missed goodbye; Theo wants you to stay and is hurt when you skip it.
- **Later nights are their own scene.** A scripted scene plays once unless it has `"repeatable": true`. Give each partner an "again" scene (`juno-again`, `theo-again`) gated on `completedScenes: ["<first night>"]`, so the first night never replays and every later night has a scene. Raise the checked choice to the next rank (Fearless, Intuitive), add a modifier from a flag set by passing the first night's read ("She knows you mean it", +3), and give the safe choice a smaller gain than it had the first time. Familiar is good, but it isn't new. A stopped night is dismissed and doesn't count as completed, so a first night that stopped still plays in full next time.

## Routines and storylets

Checks need somewhere to happen. After Hours fills days 2–14 with short storylets (one page, two or three choices, usually one check) tied to **where people are**, so choosing a place and a time is the game.

- **Routines.** `world.schedule` moves NPCs on a period: Juno does the market 0–5 and the bar from 6, Theo busks at the canal until 8. Stops fire on the exact tick; a stop missed while an NPC was held in a scene catches up when the scene ends. `scheduleExceptions` pin the day-one trial shift.
- **Activity windows must fit arrival.** An activity with a character checks that character's location at *arrival + duration*. The market run is 3 ticks so a player who spends a tick on the market storylet still fits before Juno leaves at 6.
- **Storylets gate on place + flag + prior scene**, never only on the tick, and every one has `when.flags: {"last-call": false}`. Give some of them a modifier hook later (`juno-dream` → +2 on say-it, `stepped-in` → +1 on the rematch, `theo-song-heard` → +1 reading Theo) so side content feeds the main checks.
- **Dates are plans.** An ask creates a plan with an `id` and `deadlineTicks`; the date scene has `when.plans: {"juno-flea": "pending"}` and keeps it with `planStatus`. Missing it emits `story.planBroken`, which triggers a no-show scene (a check to recover, or a chemistry and trust cost). Guard the ask with `plans: {"juno-flea": "none"}` so it isn't offered twice.
- **Mark side content `"storylet": true`.** At most one storylet starts per daypart; the others stay unplayed and come back on a later visit. Without this, arriving somewhere can queue three or four scenes, and dismissing each one used to cost a tick, so the calendar drifted past windows the player was aiming for. Plot scenes (dates, no-shows, the finale) are not storylets and always play.
- **Make dismissing free.** `"durations": {"story.leave": 0}` stops "not now" from costing time. Only continuous-conversation packs (`gameProject.conversationStyle: "continuous"`) jump to the next daypart when a scene closes; After Hours isn't one, so choices cost 1 tick and activities cost their `duration`.
- **Activity scenes hold their cast.** An NPC in an open activity scene doesn't follow their schedule until the scene ends (`core.endScene`); the missed stop then catches up.

## Deadlines and the finale

A `minTick` scene on a place the player keeps visiting (After Hours: `last-call`, tick ≥ 164 at the bar) sets a flag that every ending requires. Don't also gate it on a daypart: a player busy elsewhere can let the evening pass and soft-lock the ending. Give every other scene `when.flags: {"<finale-flag>": false}`. A queued scene whose `when` no longer holds when it reaches the front of the queue is skipped, so nothing queued plays after the finale. Leaving the finale without choosing doesn't complete it, so it fires again on the next visit. Choosing an ending is a hard stop: the engine rejects every later command and returns no actions, and the play view swaps the action list for an ending card.

## What the player sees

- **Check results show the numbers.** The turn feedback box lists each resolved check with ✓ or ✗ and `(value vs target)`, then rank-ups (▲), unlocked endings and kept or broken plans, before the relationship changes.
- **Disabled actions say why.** A greyed-out button shows its `disabledReason` (for example "Juno is unavailable when you arrive") so the player can plan around it.

## Later

Free text mapping to the current check choices ("I lean in and kiss her" → the Nerve choice) waits until the slice is fun with buttons. The model will only pick among the listed choices; the engine still resolves the check.
