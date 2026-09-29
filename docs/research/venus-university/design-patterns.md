# Scene design rules from the Venus playtest (for level-design agents)

Read `findings.md` for the evidence behind each rule. The raw play log is in `playtest-transcript.md`. Rules are written for packs on the `minimal` preset (4k window, 9b local model). Rules marked (user) come from the project owner's own play and preferences.

## Scene shape
- **Budget every scene.** 3–5 player inputs, then the engine closes it. Author an exit beat for each scene (NPC leaves, bell rings, phone buzzes) so the closing reply has somewhere to go. Vary exits; don't always leave the player standing alone.
- **Closing never eats input.** The input that hits the budget gets answered inside the closing reply.
- **One focus NPC per conversation.** The NPC the player addressed answers. Others react in narration or get one short line. Classes can have one or two NPCs; two-NPC scenes should seed a friction between them so the scene has energy before the player acts.
- **Always include one warm character.** (user) If every NPC is cold, the player has nobody to like. Hostile NPCs are fine next to a warm one.
- **End every reply on a hook**: a question, a place, an object, an arrival.
- **Empty or vague input advances.** Empty input means continue. A vague input ("flirt with her") becomes a concrete, in-character physical beat.
- **Complete the player's action.** (user) "Ask for a gin and tonic" gets a gin and tonic, not a refusal. Refusals come from state (gates, money, consent), never from the model's mood.

## Prose and voice
- **Replies are beats, not blocks.** 1–3 sentences per box, grouped by subject. Mix narration and speaker lines.
- **The narrator can take the scene's voice.** (user) Narration in the tone of the focus character reads like a visual novel. Prefer that over neutral reporting.
- **Give each NPC a distinct speech mark** in 1 line: a dialect word, sentence length, what they never say.
- **Echo the player's action first.** One line, 2nd person, from the parsed intent, no added intent.
- **Never write the player's dialogue or decisions** beyond the echo.

## Consequences
- **Free text becomes state.** "Buy her a drink" charges money and moves likeability. "Hang out Sunday" creates a calendar event the player chooses to attend; missing it displeases the character.
- **Hidden likeability, visible juice.** (user) Don't show numbers. Show a small flourish (stars, a heart pulse) when affection moves.
- **End-of-scene card with liked/disliked reasons.** Each character has hidden preferences, and the reasons are clues for the player to deduce them. Reasons can surprise but must be consistent with that character's preferences across scenes.
- **No player-editable memory.** (user) The player shouldn't write what NPCs remember. Memory comes from state and the bookkeeping pass.

## Prompt facts that must win
Put these at the top of the scene brief, short:
- time slot;
- whether the player and NPC have met;
- the calendar position (week 1 = no shared history);
- the player's pronouns, if set.

## Hub and days
- Offer 3 suggestions, each naming a place + an activity + what it changes. Keep a free-text option.
- Classes and jobs are a guaranteed-reward loop: attend → +1 stat, plus a chance to meet someone.
- Morning day card: date, day count, weather, a callback to yesterday's scenes, one rumor that names a place and a lead.
- Rephrase free-text activities into provider-safe wording before sending. Never show raw provider errors.
