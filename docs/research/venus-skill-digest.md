
# Venus University Skill Digest

## How Heroine Voice/Personality is Defined

Venus defines a heroine's voice and personality through a combination of a `personality` string and a `seedWord`. These are used by the `buildCharacterPrompt` function to generate prompts for the LLM. New characters can be created with a `CharacterBrief` or `CharacterDraft`, which contains this personality information.

*Campus should steal this.* It's a simple and effective way to give characters a distinct voice.

**Reference files:** `characterPrompt.md`, `characterRules.md`

## How NPCs Act Unprompted

NPCs in Venus have their own lives, driven by a hidden scheduling system. The `buildHiddenSchedules` function suggests that NPCs have their own schedules, leading to unprompted actions. Random encounters are rolled using `rollDormRunIns` and `rollLooseRunIns`, and relationship-based events can also trigger NPC actions.

*Campus should steal this.* It makes the world feel more alive and less player-centric.

**Reference files:** `hiddenScheduler.md`, `npcRunIns.md`, `npc.md`

## Relationship Progression Stages and Gates

Relationships are progressed through an affection system. Affection is gained through shared memories and events, and is tracked with `affectionFor`. Reaching certain affection thresholds unlocks new relationship stages like "crush" and "dating". These stages are gated by a combination of random rolls (`rollsCrush`) and meeting specific criteria (`meetsCrushStandards`).

*Campus should steal this.* The combination of gradual affection gain and distinct relationship stages with gates provides a clear and rewarding progression system.

**Reference files:** `relationship.md`, `dating.md`

## How Physical/Intimate Player Actions are Parsed and Change Stats

Player actions, including physical and intimate ones, are parsed from raw text using the `parseAction` function. These actions are linked to "stat deltas" which are then applied to the player's stats using `applyStatDeltas`. Stats are tiered, so accumulating points unlocks new tiers. Intimate actions are likely gated by relationship status and a `noNsfwImages` setting.

*Campus should steal this.* This system allows for a wide range of player expression and provides clear feedback on how actions affect character development.

**Reference files:** `sceneActions.md`, `playerStats.md`, `sfw.md`

## Top 5 Concrete Ideas to Steal (Ranked by Fun-per-Effort)

1.  **Hidden NPC Schedules:** Simple to implement (a basic scheduler and location data), but adds a huge amount of life to the world.
2.  **Affection-gated Relationship Stages:** A clear and motivating progression system for players.
3.  **Personality/Seed-word Prompts:** An easy way to give characters a unique voice.
4.  **Action Parsing and Stat Deltas:** A flexible system for handling player input and character growth.
5.  **Crush Mechanic:** Adds a fun and relatable step in the relationship progression.
