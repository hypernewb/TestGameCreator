# Venus University: play findings (2026-09-29)

Source: one live session of the itch.io web build (v0.2.0, Gemini 3.5 Flash Lite, minimal thinking), plus the user's own play of later scenes and the user's corrections from earlier sessions. Scenes covered: two scenes played by me, then two classes and the day card played by the user. The raw record is in `playtest-transcript.md`. The source-level audits are in `docs/VENUS-*.md`. This file covers only what showed up in play.

## Why it feels smooth

Mostly because the engine, not the model, decides when things happen, and because free text gets turned into real state.

1. **Scenes have a budget and end themselves.** Scene 1 closed after 4 player inputs and 1 auto-continue. The player never has to find an exit, and a scene never sags. The engine even blocks late input ("Interrupt the ending? Bookkeeping prompts have already been sent").
2. **Nothing waits on the player to be creative.**
   - Clicking past the last beat with no input makes the narrator continue and move the scene along.
   - A vague input ("Flirt with them") is expanded into a concrete physical beat.
   - Every reply ends on a hook (a question, a place to go, an object to look at).
   - The hub offers three concrete, stat-labelled activities.
3. **Replies are split into beats.** One reply becomes 6–10 click-to-advance boxes (narration / speaker line / narration). The player reads at their own pace, streaming latency hides behind the first box, and a long reply never shows up as a wall of text.
4. **Echo lines confirm what the player did.** The player's input is restated in 2nd person, with the physical action split from indirect speech. The player sees that the action landed before the NPC reacts.
5. **The narrator speaks in the scene's voice** (user preference). Narration picks up the dominant character tone ("You just, um. Drag your tired legs into the gym"). It reads like a visual novel with a point of view, not a neutral report. The user prefers this to our neutral narrator.
6. **Presentation is automatic.** Background swaps (garden → library, café → street), sprite expressions and nameplates (??? → Ingrid once she says her name) happen without the player asking. That makes a lot of visible change per turn.
7. **Free text becomes state.** (User-verified.)
   - "Go to a bar and get a drink" bills the drink ($12).
   - An invitation to hang out goes into the schedule as an event you choose to attend, is marked on the calendar, and the character is displeased if you miss it.
   - The game infers what the player wants and wires it into money, calendar and relationships without a menu.
8. **Hidden likeability with juice.** Flirting raises likeability behind the scenes, and a small flash of stars shows it went up without a number or explanation. The player feels progress without seeing the math.
9. **Social deduction through reasons.** End cards say "X liked that…" / "Y disliked that…". The reasons are sometimes surprising (Gwen disliked a compliment; Winter liked being touched while visibly flustered). The user reads this as intended: each character has hidden preferences, and the player learns them to approach her better next time.
10. **Narration and bookkeeping run as separate calls.** The narrator only writes the scene. A separate end-of-scene pass writes stat deltas and liked/disliked reasons. The narrator's prompt stays small.
11. **Time is slots, and every morning has a day card.** DAY → EVENING, one scene per slot. The morning card gives date and day count, weather, a callback to yesterday, and a rumor that names a place ("Lowrise 2 common kitchen… matcha treats… trading for favors"). It hands over a lead as a story hook.
12. **Classes are a safe, guaranteed loop.** Attend class → +1 stat, plus a chance to meet NPCs. Some classes have one NPC, some two. Two-NPC classes seed friction between them (Celest vs Isabelle), so something is happening before the player acts.
13. **Gates are deterministic and stated.** "Your Heart needs to be at least Good to catch Celest's interest." The player gets a concrete goal that points back to the hub's activities.
14. **Distinct speech marks.** Celest ("Boje moj", "da?") and Isabelle (clipped, no fillers) sound different. A single dialect marker does more than a costume.
15. **Scene compression.** "Professor Johnson's monotonous drone fills the remaining minutes" skips dead time in one line.

## What it does wrong

Ordered by how much it hurt play. Items the user disputed have been removed or corrected.

1. **The fiction and the gates disagree.** Ingrid held hands, squeezed back and thanked me warmly. Then the system said she isn't interested (Brain gate). Likeability does still rise, as the star flash shows, so flirting isn't wasted. But the prose never hints that a gate exists, so the gate message lands as a surprise.
2. **The engine throws away player input.**
   - When the scene budget ran out mid-flirt, my action was discarded (the Interrupt dialog).
   - In scene 2, the action box was hidden while beats played ("hover to show"), so typing went nowhere and Return advanced the beat instead.
3. **The narrator puppets the player.**
   - It wrote "you shake your head, offering a quiet, lopsided smile" when I hadn't acted.
   - The echo added intent I didn't type ("before she can object").
4. **Continuity drifts in the first lines of a scene.**
   - The clock said NIGHT and the prose said "afternoon".
   - Strangers greeted me as an old friend.
   - On day 1, an NPC referenced "a three-hour lecture".
5. **Random encounter rolls override the player's plan.** The encounter roll turned a planned 1-on-1 into a group scene.
6. **No content layer of its own.** The provider blocked one request and the game showed the raw PROHIBITED_CONTENT error.
7. **The "Edit memories?" dialog gives the player too much power** (user view). The player can write anything into what an NPC remembers ("like playing god"), which undercuts the social-deduction loop. The auto-filled lines are also thin: "flirted with them" copies the player's pronoun, and one row was for an unnamed "???" NPC.
8. **Every scene ends with the player alone plus a lingering sensory detail** ("faint taste of jasmine", "faint scent of old paper"). It's a formula.
9. **Small bugs.**
   - The reason line doubles its subject ("Ingrid liked that Ingrid liked that…").
   - "Mr. Smooth" assumes the player's gender.
   - An NPC reacted to a line the player never said ("say that again for the livestream").
   - Lili smiled at "your phone camera" while she was the one streaming.

Not flaws, per the user: the Friends panel showing full names (it's a social-media analogue), and the narrator adopting NPC voice (preferred).

## What this means for story-framework

The user's human-playtest complaints about our game map directly onto Venus strengths:

| Our complaint (human playtest) | Venus mechanism |
| --- | --- |
| Can't click the text box | Input box is always the primary control (though Venus hides it during beats; don't copy that) |
| Replies all one sentence | Beats: 1–3 sentences per box, grouped by subject, 6–10 boxes per reply |
| Speaker randomly jumps between people | One focus NPC per scene; others react in narration |
| No end-of-scene like summary | End card: "X liked that…", stat lines, star flash |
| Scenes too short; "gin and tonic" → "really? no." | Scene budget of 3–5 inputs; the model completes the player's action |
| Buying a drink changes nothing | Free text → money/likeability through the bookkeeping pass |
| Vague actions get nothing | Vague input expanded into a concrete beat |
| All characters are unlikeable | Mix of warm and cold NPCs; the warm one is always present |
| Can't just buy a snack at the market | Purchases inferred from intent, priced and billed |
| No confirmation of what I did | Echo line |

Things to not copy: flaws 2–9 above.
