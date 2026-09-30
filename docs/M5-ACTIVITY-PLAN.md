# M5 activity plan

Goal: activities stop being a button press that gives a fixed yield. Each one is a short real-time game. Playing it well is worth more than skipping it, pushing your luck can go wrong in ways the director turns into story, and the heroine you did it with notices how it went. Code owns the numbers. The play UI only reports a result tier.

## Owner calls (2026-09-30)

- **Widgets:** real-time mini UIs, 4 games, one per stat.
  - Fitness: a timing bar.
  - Focus: memory flip.
  - Wit: a quick-pick quiz or word game.
  - Charm: rhythm taps.
- **Which game runs:** each activity plays the game of its stat. Money jobs use the game of the stat they also train (dining shift → charm, tutoring → wit). Creator worlds get a widget per activity from its `gives` stat, so no extra authoring is needed.
- **Stakes, only upside:** skipping gives the midpoint result (today's yield), and that is the floor. Playing can only add to it.
- **Push your luck:** offered only after a great result. You get one more round for a bigger bonus, with a mishap chance that rises each round.
- **Mishaps feed the director:** a mishap costs no stats. It emits an event, and the director answers with a beat.
- **Co-op:** when a heroine is in the activity, she reacts with one line per result tier and small trust by tier. A great run can trigger an encounter moment. Touch in front of witnesses at work, the gym or study has a consequence.

## Result tiers

The engine never sees the minigame, only `args.result` on the activity command.

| Tier | Source | Yield |
|---|---|---|
| `skip` / missing | skip button, old clients, free text | base effects (the midpoint) |
| `ok` | played, weak run | base effects |
| `good` | played, solid run | base, then +1 on each stat effect and +20% money |
| `great` | played, top run | base, then +1 stat, +50% money, and the push-your-luck option |
| `push` | each extra round after `great` | the great bonus again per round; mishap chance 25% / 45% / 65% (seeded `tx.random`) |

A mishap ends the run and keeps what was already banked, so it never goes below the floor. It emits `world.activityMishap` `{activity,location,characters,round}`.

## Build order

1. **(done)** **Engine result tier.** In `packages/modules/minigames.mjs` (`world.minigames`); the engine only checks and passes `args.result`. `args.result` on the `core.scene` activity command; tier bonuses applied on top of the base effects; push rounds with seeded mishap rolls; `world.activityCompleted` carries `result`. Deterministic, with tests.
2. **(done)** **Mishap → director.** `story.director` reacts to `world.activityMishap` by dealing an in-scene trouble beat right away, ignoring the interruption chance but still respecting the open-scene rule. Test: a seeded mishap always produces a director beat.
3. **(done)** **Co-op reaction.** Per-tier lines and trust for a heroine present in the activity: `great` +2, `good` +1, `ok` 0, `skip` 0. Lines come from the drafted text (`actor.reactions`, 4 tiers; campus has all four heroines drafted), with a code fallback. A `great` run with her procs an encounter moment 40% of the time (`world.moment`).
4. **(done, per the round-2 call)** **Witnessed touch.** At a watched place, a touch act with a third party present emits `social.touchWitnessed` `{character,witnesses,rivals}`. A place is watched if `location.watched` says so, else if it hosts a job or fitness/focus training and is not the player's home (campus: Langley, Hewett, Prescott, Campbell's). Gossip seeds a rumor from the witnesses (`handsy-in-public`), and the director deals a `saw-you` beat when a rival heroine saw it, else a `rumor` beat, within its trust gates. No numbers are taken directly; the "costs the shift bonus" idea was dropped.
5. **(done)** **Widgets.** `public/minigames-ui.mjs`: timing bar (5 presses, shrinking zone), memory flip (6 pairs, 30 s), quick sums (6 questions, 4 s each) and rhythm taps (8 beats), each ~15–30 s. Score fraction → tier: under 50% `ok`, under 80% `good`, else `great`. Skip (before or during) sends `skip`. `activityCommand(p,id,result)` carries the tier, a Push-your-luck button tops the hub while `world.pushLuck` is offered, and the scored/reaction/push/mishap/witnessed texts show as RESULT lines.
6. **(done)** **Creator mapping.** Creator activities get the widget of the stat they train. A paid job that trains no stat gets a `game` from its place kind (`JOB_GAMES`: bar → rhythm, shop → quiz, outdoors → timing, else memory). Each heroine's four `actor.reactions` slots are drafted with her profile.

## Acceptance (from the M5 row)

- Every campus activity has a minigame (a widget is resolved for all 14).
- A mishap reliably produces a director beat (seeded test).
- Getting handsy in front of a coworker has a consequence (test).
- Skipping never yields less than before M5 (test: `skip` equals the old base effects).

## Open

- Social-link ranks unlocking activities (part of the M5 row). Deferred until the four widgets land, then an interview.
- Widget difficulty scaling with the stat (a higher stat gives an easier game). Not decided.

## Owner calls, round 2 (2026-09-30)

- **Witnessed touch:** gossip plus the director. The witness starts a rumor through `gossip`, the director can deal a rumor or saw-you beat from it, and a rival heroine who is there reacts. No direct numbers are lost.
- **Reaction lines:** drafted per heroine. Each heroine gets a `reactions` slot with 4 lines (skip, ok, good, great) in her voice, drafted with the heroines. Campus gets a small draft pass.
