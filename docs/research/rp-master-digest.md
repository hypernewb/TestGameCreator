# rp-master Digest

## Core Loop
rp-master's core loop centers on a "Plan your day" screen where players spend a limited daily energy budget on activities like meeting or texting a character. These activities initiate scenes. Relationship progression is driven by a detailed system of seven stats, a warmth score, and a commitment ladder. Instead of letting the main LLM score replies, the engine uses small, focused "judge" calls to assess moments (e.g., a date's rapport, aftercare) and apply deterministic stat changes. World-scoped rules can trigger narrative events ("heart events") based on relationship state or the world clock.

## Steal List
1.  **"Plan Your Day" Loop:** A daily menu of energy-spending actions (meet, text, rest). It provides a clear game loop beyond just talking. (Cite: `.rp-master/src/lib/world/dayPlanner.ts`). Ours: none, we are purely conversational. Sketch: Add a similar day/energy system to drive scene selection.
2.  **Trigger System for Heart Events:** Rules engine for `when <condition> then <action>`, like `when warmth > 50, start_scene 'Confession'`. This allows for authored, emergent narrative beats. (Cite: `.rp-master/src/lib/world/triggers.ts`). Ours: `datingTriggers` in `packages/modules/dating.mjs` is a basic version of this. Sketch: Expand our trigger system with more conditions (stats, clock) and actions (start scenes, add memories).
3.  **Rapport-based Live Scene Feedback:** During dates, a qualitative "rapport" reading (e.g., "warming to you") is shown instead of numeric stat changes, keeping the player immersed. (Cite: `.rp-master/src/lib/dating/rapport.ts`). Ours: none. Sketch: Implement a similar small judge call to provide in-scene qualitative feedback.
4.  **Deep Character Definition:** The character card includes fields for schedules, gift tastes, touch preferences, behavioral rules, and social connections, allowing for highly specific and nuanced character authoring. (Cite: `.rp-master/src/lib/characters/cardSpec.ts`). Ours: Our character definition is much simpler. Sketch: Add more specific fields to our character contracts.
5.  **Aftercare Mechanic:** A post-intimacy window is judged as tender, awkward, or cold, with lasting stat and "need" effects. This adds consequence and depth to intimacy. (Cite: `.rp-master/src/lib/dating/aftercare.ts`). Ours: `packages/modules/intimacy.mjs` is more basic. Sketch: Add a similar post-scene judgment mechanic. Would break our "one model call per turn" rule.
6.  **Gift Cadence & Progressive Taste:** Gifting has diminishing returns if spammed (`giftCadenceMultiplier`) and character tastes are revealed progressively. (Cite: `.rp-master/src/lib/dating/gifts.ts`). Ours: `packages/modules/economy.mjs` is simpler. Sketch: Add cadence and taste-reveal mechanics to our gift system.
7.  **Commitment Ladder & Breakups:** A formal commitment ladder (dating, exclusive, etc.) that must be climbed, with the real possibility of breakups that leave a stat "scar." (Cite: `.rp-master/src/lib/dating/stage.ts`). Ours: `packages/modules/romance-network.mjs` implies stages but they aren't as explicit. Sketch: Formalize our relationship stages into a ladder with explicit gates and consequences.
8.  **AI-assisted Objectives:** The model can suggest objectives, break them into concrete tasks, and detect when those tasks are completed from the conversation. (Cite: `.rp-master/src/lib/objectives/objectiveAssist.ts`). Ours: none. Sketch: Add an AI service for objective generation and tracking. Would break our "one model call per turn" rule.

## Anti-List
1.  **Overly-complex Character Card:** The sheer number of fields in `cardSpec.ts` could be a barrier to content creation. We should be selective about which fields we adopt.
2.  **Separate Image/Voice Backends:** The handling of separate backends for different modalities adds a lot of complexity (`OPENMAYHEM.md`). We should stick to a single, unified provider if possible.
3.  **Multiple Currencies/Inventories:** The game has gift coins and a gift inventory. We should stick to a simpler economy.
4.  **Regex-based Text Cleaning:** The use of regex scripts for cleaning model output (`builder.ts`) feels brittle. We should rely on prompt engineering to get clean output.
5.  **Manual World-Info Management:** The lorebook system with its manual tuning of `scan_depth`, `token_budget`, etc. feels cumbersome. Our automated memory system (`packages/ai/memory.mjs`) is a better approach.

## Questions
1.  Which of these mechanics should we prioritize for the next milestone?
    -   "Plan Your Day" Loop (Recommended)
    -   Trigger System for Heart Events
    -   Rapport-based Live Scene Feedback
2.  Should we adopt the "one model call per turn" rule-breaking mechanics like Aftercare and AI-assisted Objectives?
    -   Yes, for key moments (Recommended)
    -   No, let's stick to our rule
3.  How deep should we make our character card?
    -   Adopt most of the `rp-master` spec (Recommended)
    -   Adopt only a few key fields
    -   Keep our current simple spec
4.  Should we formalize our relationship progression with a commitment ladder and breakups?
    -   Yes, it adds stakes (Recommended)
    -   No, keep it more fluid
5.  Is the "Plan Your Day" loop a good fit for our game?
    -   Yes, it provides needed structure (Recommended)
    -   No, it's too restrictive
6.  Are you open to more complex, multi-call AI mechanics for specific scenes?
    -   Yes, if it improves the experience (Recommended)
    -   No, let's keep it simple
