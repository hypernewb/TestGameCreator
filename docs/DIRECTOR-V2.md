# Director v2

The director schedules authored drama from a creator's template library. A template has a kind (`event`, `obstacle`, `goal`, or `temptation`), role slots, a scripted scene, and optional eligibility rules. `bakeDirectorTemplates` expands the roles into concrete scene instances before play. Each instance and dealt event records the source template and casting. The model never chooses the template or changes its mechanical effects.

## Creator controls

In Studio, enable **Scripted scenes** and **Drama director**, then use **Drama director** to add templates. Edit a template's JSON, check and preview its castings, and approve it. Publication checks every template's review status, bakes the approved instances, and validates the resulting world. Changing template text in Studio returns it to pending review.

`directorProfile.toneCeiling` is optional: `grounded`, `soap`, or `melodrama`. With no ceiling, all three tone levels may play. `directorProfile.textMode` defaults to `authored`. A creator may choose `draft`; then a connected model may rewrite an approved scene opening during play. The approved opening remains the fallback, and choices, deadlines, effects, and state changes stay authored and deterministic.

The director weighs events and obstacles against opportunities. Quiet periods draw from both decks. Setbacks favor opportunities; sustained attention to one character favors that character's obstacle or temptation. The seeded game RNG decides ties. When normal uses are exhausted, the director may reuse an approved scene marked `"repeatable": true`; tone, conditions, cooldowns, and daily limits still apply. If nothing eligible remains, it emits `story.starved` instead of inventing a new mechanical beat.

## Deadline goals

A goal template adds a plan to its acceptance choice. `goal.deadlineTicks` defaults to 12. The default missed consequence is a relationship cost of 3 if a relationship system is present; otherwise it blocks new opportunities for 3 ticks. A creator may set `goal.missed` to `{ "kind": "relationship", "cost": 5 }` or `{ "kind": "opportunity", "cost": 5 }`. When the plan expires, the director emits `story.goalMissed` with the template ID, plan ID, character, and cost.

The templates are world independent. A creator may provide any valid cast and setting; no campus names, locations, or tone settings are baked into the module.
