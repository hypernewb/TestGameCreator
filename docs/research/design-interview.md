# Design interview (2026-09-29)

Working notes from the design interview with the project owner. They get folded into the game design doc once the interview is finished. The order is: 1 fantasy and structure, 2 day loop and cards, 3 director, 4 erotic and relationship systems, 5 minigames, 6 what the model writes, 7 world creator.

## Context carried in
- Goal: a creator that outputs Venus University-like gameplay across many worlds, with modules on top.
- Authored scenes stay, and should need little player typing. Some scenes are free-typing, some are authored with no AI call.
- Venus's biggest gap is the lack of a game director. Ours should generate new events, scenes, challenges and roadblocks, and give the player things to do.
- Roguelike card UI: 3 cards on screen, for example "Go to work +1–2 Charm +40–60 Gold", "Gym +2 Strength", "Study +1–3 Int".
- Minigames can push stat gains toward the top of the range: clue challenges, how well you answered, recalling a fact.
- The model may write memories and random events ("you slap her, she remembers").
- This is an erotic dating sim, and there are no fun systems built around that yet.

## Step 1: fantasy and structure
- **Fantasy:** a sandbox with a corruption/change arc, which is the owner's preferred style. One deep romance is possible. Cheating while you have a partner without getting caught is a challenge they want. They like that Venus has open relationships but find its version shallow.
- **Run shape:** modular per game.
  - Romance dating sims: fixed calendar plus endings (the default for most games).
  - Future isekai: roguelite.
  - Chill forever-sandbox in the style of The Sims or Stardew Valley.
- **Fun sources:** all four.
  - Seduction as deduction.
  - Juggling time, stats and money.
  - Director surprises.
  - Erotic payoff plus collection.
- **Audience:** a creator for others from day one.
- **First playable must nail:** seduction as deduction, and erotic payoff plus collection. Juggling and director surprises come after.

## Step 2: day loop and cards
- **Core hub:** a map plus a phone.
  - The map shows locations with this slot's activities and who might be there.
  - The phone gets texts, invites, rumors and director events.
- **Roguelike cards are a later layer, not the core loop.** When they arrive: deal 3 plus a basics row. Deckbuilding comes later still.
- **Cards and activities show** stat and gold ranges plus who might be there.
- **Default scene types** (creators can override per activity):
  - Activities (work/gym/study) → quick minigame with no AI, then a result card.
  - People/dates → a free-typing scene with one focus NPC, 3–5 inputs, and a liked/disliked end card.
  - Director events → an authored opener with no AI, then choices or a short free-typing middle.
  - Intimate scenes → **authored the first time**, **free-typed on repeats** (for replayability).
- **Activities can turn into encounters:** a chance roll or a met condition triggers a free-typing scene where a character drops by. The owner likes being handsy in work, gym and study scenes, so touch in any scene must have consequences: witnesses, coworkers, the boss.
- **Social-link ranks (Persona-style) unlock new activities or cards.**

## Step 3: director
- **Generates** all four kinds:
  - events and invitations;
  - obstacles and rivals;
  - goals with deadlines;
  - temptations.
- **Source:** a template library generated at creation time, validated and reviewable. The engine picks and fills templates at runtime; the AI only narrates. Runtime AI invention is a future supplement.
- **Pacing:** fully adaptive, with no player-facing presets. The director reads play:
  - lots of cheating → more suspicion events;
  - nothing happening → drama;
  - losing → an opportunity.
  Assumed and not objected to: the creator sets a world tone ceiling (a chill world never spawns heavy crises).

## Step 4: erotic and relationship systems
- **Change arc:** hidden traits (shyness, openness, boldness…) drift from what you do together. Crossing a threshold reaches a named stage that visibly changes:
  - her voice;
  - her outfits;
  - what she'll say yes to;
  - which scenes are unlocked.
  The creator authors each character's track.
- **What changes over a run** (all four):
  - NPCs;
  - the player (reputation, confidence, what they're known for);
  - relationship agreements (monogamous → open → poly, secret → public), negotiated in play;
  - NPC-to-NPC relationships.
- **Getting caught** can lead to any of four outcomes:
  - a free-typing confrontation you can talk down, where her evidence is weighed against your claims;
  - a breakup or bad ending;
  - negotiating an opening, depending on her stage and traits;
  - ripple drama: friends take sides, gossip spreads, a rival exploits it.
- **The erotic loop** (all four):
  - discovering turn-ons and limits through deduction;
  - a ladder of firsts, each an authored milestone and a gallery unlock;
  - mood and moment, created by the director;
  - mastery and variety (preferred styles, location, public vs private risk).

## Step 5: minigames
- **Types:** clue/deduction (which gift fits her, spot the lie, who left the note) and timing/reflex (gym bar, work rush). Not recall quizzes or typed pitches.
- **Frequency:** every activity offers its minigame. Skipping gives the middle of the range.
- **Risk:** push your luck. Normal play scales within the range. Pushing past it gives bigger gains with a chance of a mishap (injury, embarrassment, being seen), and mishaps feed the director.
- **Social and intimate scenes:** no arcade minigames. The skill is reading her cues. Authored first times offer choices where knowing her mood and traits picks the best one. Free-typing scenes score your intent against her likes and limits.

## Step 6: what the model writes
- **The model writes NPC memories only, straight into state.** Minor events, new facts and walk-on NPCs go through engine checks. (They aren't banned, just not written freely.)
- **Numbers:** the model tags what happened and how it landed. The engine turns the tags into numbers using the character's hidden likes, prices and caps. The model can't be sweet-talked into +50.
- **Prose ahead of state:** the prose stands, state doesn't follow, and she remembers it. If you overstep (rude, too fast, an unwanted kiss), she rebuffs you, remembers it, and treats you differently afterwards. Arc progress still has to be earned.
- **Exception, a hard rule for intimacy: state wins.** Intimate content needs consent in state: the right stage, and sober enough. The engine blocks it before the model writes anything, and the prose can't run past consent. "Drunk and willing" becomes a "ask me again when I'm sober" date hook. An overly pushy advance lands as a remembered rejection, never as an erotic scene. (Existing `intimacy.mjs` consent gates.)
- **Player view (journal):** a journal of discoveries only. The player's notebook fills with what they've learned (likes, limits, facts), never the NPC's raw memory, and it can't be edited.

## Step 7: world creator
- **Entry points** (all three):
  - one or more SillyTavern cards;
  - a one-paragraph premise;
  - a structured form.
- **Review:** a guided wizard in the order premise → cast → places and activities → arcs and firsts → director events. The AI drafts each step, and the creator edits and approves before the next.
- **First times and arc stages:** a shared library of beat templates with role slots. The AI drafts world-specific text at creation time, and the creator reviews it.
- **Proof worlds:** first a Venus-like campus made through the creator, then a very different setting from one of the owner's SillyTavern cards.
- Existing base: `GENERATOR-PLAN.md` steps 1–6 already turn a card into route scenes and endings (`card-world.mjs`, `route-skeleton.mjs`, `role-slots.mjs`).

## Final path (agreed at the end of the interview)
- **Docs:** a new `docs/GAME-DESIGN.md` holds the design. `docs/NEXT-MILESTONES.md` gets a new Game tier in place of the Fun tier. The F1–F12 table moves to `COMPLETED-MILESTONES.md` for history, and `FUN-PASS.md` is marked superseded.
- **Order:** M0 → M3 → M2 → M5.
  - M0: scene feel plus the first playable on a campus world. The owner merged the old M1 (first playable) into M0.
  - M3: director v2.
  - M2: creator wizard.
  - M5: activity depth.
- **Later:** M4 (secrecy and agreements), roguelike cards, deckbuilding, runtime AI director events, and other run shapes.
- **after-hours:** retired, because the owner hated playing it. It stays as a test fixture until the campus world replaces it in tests, then gets deleted in a reviewed change. Optional later check: regenerate an after-hours-like premise through the creator, to see whether the premise or our systems were the problem.
- **F1–F12 verdict:** the owner deferred to my analysis. Most of the engine work is kept and re-aimed. The per-milestone table is in `NEXT-MILESTONES.md`.
- **Follow-up (same day):** hearts stay visible (F6) instead of a Venus-style star flash, so the game doesn't read as a copy. The M0.1 typing bug couldn't be reproduced, so it's dropped; the scene contract stays.
