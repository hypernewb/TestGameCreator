# Game design

Status: agreed 2026-09-29 in a design interview with the project owner. Notes and reasoning: [research/design-interview.md](research/design-interview.md). Venus evidence: [research/venus-university/](research/venus-university/). Roadmap: [NEXT-MILESTONES.md](NEXT-MILESTONES.md#game-tier--the-venus-style-loop-do-first).

This replaces [FUN-PASS.md](FUN-PASS.md) as the product direction. The engine and modules stay. What changes is the core loop. It is no longer a hand of authored storylets with a narrator on top. It is Venus-style free play where typed text changes state, with authored scenes where authoring pays off.

## What we're building
- **A creator** that outputs Venus University-style dating sims across many worlds and settings, with modules on top. It is for other creators from day one.
- **The first product** is an erotic dating sim. Judge every change by the loop below, not by engine completeness.
- **Player fantasy:**
  - a sandbox with a corruption/change arc (the owner's preferred style);
  - one deep romance is possible;
  - later, juggling partners without getting caught.
- **Run shapes** are per world:
  - default: a fixed calendar plus endings;
  - later: roguelite (an isekai world) and a forever sandbox (Sims/Stardew style).
- **Fun sources.** The first playable must nail the first two:
  1. seduction as deduction;
  2. erotic payoff plus collection;
  3. juggling time, stats and money;
  4. director surprises.

## Day loop
- **Time is slots** (dayparts). Every morning shows a **day card**: date, days left, weather, a callback to yesterday, and one rumor that names a place and a lead.
- **Hub: map plus phone.**
  - The map shows places with this slot's activities. Each activity shows its stat and gold ranges, and who might be there.
  - The phone gets texts, invites, rumors and director events.
- **A free-text option** is always available next to the activities.
- **Social-link ranks** (Persona-style) unlock new activities.

## Scene types
Creators can override the type per activity.

| Scene | AI | Player input | Ends with |
|---|---|---|---|
| Activity (work, gym, study) | none | a quick minigame (skippable) | a result card; may proc an encounter |
| Encounter / hangout / date | narrates | free typing, 3–5 inputs | an end card with liked/disliked reasons |
| Director event | none for the opener | choices, or a short free-typing middle | effects plus a follow-up hook |
| Intimate, first time | none, or voicing authored beats | authored choices that read her cues | a milestone and a gallery unlock |
| Intimate, repeat | narrates | free typing, gated by consent | an end card and memories |

**Encounters from activities.** A chance roll or a met condition can turn an activity into a free-typing scene where a character drops by. Touch is allowed in any scene (work, gym, study), and it has consequences: witnesses, coworkers, the boss.

### Free-typing scene contract
Full rules are in [design-patterns.md](research/venus-university/design-patterns.md). The core rules:
- **Input:** the input box is always the primary control and input is never discarded.
- **Echo:** echo the player's action first, in one line, in 2nd person, adding no intent.
- **Voices:** one focus NPC answers; others react in narration. There is always one warm character.
- **Beats:** replies are 1–3 sentences each. The narrator takes the scene's voice. Every reply ends on a hook.
- **Completing actions:** the model completes the player's action. Refusals come only from state: money, gates, consent.
- **Empty or vague input advances:** empty input continues the scene, and vague input becomes a concrete beat.
- **Budget:** a scene has a budget of 3–5 inputs, then closes itself. The closing reply answers the last input.
- **Never** write the player's dialogue or decisions beyond the echo.

## What the model writes
- **NPC memories: freely, straight into state.** You slap her, she remembers it. You do something nice, she remembers it.
- **Numbers: the model tags, the engine prices.**
  - The model tags what happened and to what: flirt, compliment:looks, gift:item, touch:where, insult, buy:item, invite:when/where, each sized small, medium or large.
  - The engine checks the tags against her hidden likes, limits, prices and caps. It decides liked or disliked, the affection change and the reason line.
  - The narrator's brief carries her likes and limits privately, so her reaction in the prose matches the verdict.
  - A tag that matches no table entry falls back to the model's "landed / didn't land", clamped small.
  - Sweet talk can't buy +50.
- **Purchases** are billed from the world's prices. **Invites** become calendar events the player chooses to attend, and missing one displeases her.
- **Minor events, new facts and walk-on NPCs** go through engine checks. They are not banned, just not written freely.
- **Prose ahead of state:** the prose stands, state doesn't follow, and she remembers it. If you overstep (rude, too fast, an unwanted kiss), she rebuffs you, remembers it, and treats you differently afterwards. Arc progress still has to be earned.
- **Hard rule for intimacy: state wins.**
  - Intimate content needs consent in state: the right stage, the category allowed, and sober enough.
  - The engine checks this before the model writes a word, and the prose can't run past it.
  - "Drunk and willing" becomes an "ask me again when I'm sober" date hook.
  - A pushy advance lands as a remembered rejection, never as an erotic scene.
  - Withdrawal is honored at every beat.
  - The model can never grant consent or change gates. This uses the existing `social.intimacy` gates. See [ADULT-GAME-DESIGN.md](ADULT-GAME-DESIGN.md).
- **Player view:** a journal of discoveries (likes, limits, facts learned). It never shows the NPC's raw memory, and the player can't edit it.

## Relationships and the change arc
- **Visible hearts, hidden reasons.** Affection shows as hearts (F6: rank names, teasers, the Leads panel), and the end card animates heart changes. We deliberately use hearts, not Venus's hidden score with a star flash, so the game doesn't read as a copy. What stays hidden is why she liked or disliked something: that is the deduction game.
- **Hidden likes and limits are the deduction game.**
  - End cards say "X liked that… / disliked that…".
  - Reasons can surprise, but stay consistent with her table across scenes.
  - What you learn goes in the journal.
- **Hidden traits plus named stages.**
  - Each character has traits (shyness, openness, boldness…) that drift from what you do together.
  - Crossing a threshold reaches a named stage. A stage visibly changes her voice, her outfits, what she'll say yes to, and which scenes unlock.
  - The creator authors each character's track.
  - A stage makes options eligible. It never forces consent.
- **What changes over a run:**
  - NPCs (M0);
  - the player: reputation, confidence, what they're known for (later);
  - relationship agreements: monogamous → open → poly, secret → public, negotiated in play (later, M4);
  - NPC-to-NPC relationships (later, M4).
- **Getting caught** (later, M4) can lead to:
  - a free-typing confrontation you can talk down, with her evidence weighed against your claims;
  - a breakup or bad ending;
  - negotiating an opening, depending on her stage and traits;
  - ripple drama: friends take sides, gossip spreads, a rival exploits it.

## Erotic loop
- **Discovery:** turn-ons and limits are found by deduction and recorded in the journal.
- **Ladder of firsts.** Each rung is an authored milestone with a gallery unlock.
  - The first time is authored, with choices where knowing her mood and traits picks the best option.
  - Repeats are free-typed, for replayability.
- **Mood and moment:** privacy, her mood, sobriety, time of day. The director creates moments. The player recognizes them and takes them.
- **Mastery and variety:** preferred styles, locations, public vs private risk.

## Director
- **Generates four kinds of content:**
  - events and invitations;
  - obstacles and rivals;
  - goals with deadlines;
  - temptations.
- **Source:** a template library generated when the world is created, then validated and reviewed.
  - At runtime the engine picks a template and fills its role slots. The AI only narrates.
  - Runtime AI invention is a later supplement.
  - Every director beat is a template instance with provenance.
- **Pacing is fully adaptive**, with no player-facing presets. The director reads play:
  - nothing happening → drama;
  - losing or stalled → an opportunity;
  - focused on one character → a rival or a temptation;
  - later: lots of cheating → suspicion.
- **Tone ceiling:** set by the creator per world, so a chill world never spawns heavy crises.
- **Base:** `story.director` (tension score, decks, cooldowns, honest teasers, the narrator brief). The storyteller presets become internal defaults.

## Activities and minigames
- **Every activity offers its minigame.**
  - Types: clue/deduction (which gift fits her, spot the lie, who left the note) and timing/reflex (the gym bar, the work rush).
  - Skipping gives the middle of the range.
- **Push your luck.** Pushing past the range gives bigger gains, with a chance of a mishap (injury, embarrassment, being seen). Mishaps feed the director.
- **No arcade minigames in social or intimate scenes.** The skill there is reading her cues.

## Roguelike cards (later layer, not the core loop)
- Activities are dealt as cards: 3 drawn plus a basics row. Example card: "Go to work · +1–2 Charm · +40–60 Gold".
- Deckbuilding comes later still.
- The F2 storylet hand is the base for this layer.

## World creator
- **Entry points:** one or more SillyTavern cards, a one-paragraph premise, or a structured form.
- **Guided wizard:** premise → cast → places and activities → arcs and firsts → director events. The AI drafts each step, and the creator edits and approves it before the next.
- **First times and arc stages** come from a shared library of beat templates with role slots. The AI drafts world-specific text at creation time, and the creator reviews it.
- **Proof worlds:**
  1. a Venus-like campus, built as structured data in M0 and rebuilt through the wizard in M2;
  2. a very different setting, made from one of the owner's SillyTavern cards.
- **Base:** [GENERATOR-PLAN.md](GENERATOR-PLAN.md) steps 1–6 (`card-world.mjs`, `route-skeleton.mjs`, `intimacy-skeleton.mjs`, `role-slots.mjs`).

## Non-negotiables
- Every character is an explicit adult. Consent is specific, current, withdrawable, and held in state.
- Model output is untrusted text. Only engine-priced tags, engine checks and authored effects change numbers or gates. Memories are the one exception.
- The `minimal` preset (4k window, local 9b model) is the target. Every prompt token has to earn its place.
- Replay stays deterministic. Model tags are recorded as events, so replay never calls the model.
