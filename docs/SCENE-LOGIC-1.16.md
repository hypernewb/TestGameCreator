# 1.16 — Attendance and conversation consistency

The reported behavior exposed three distinct issues: direct social.speak commands did not establish a persistent scene, allowing schedules to move the speaker during the turn; the classifier could choose a new destination or a different character for a conversational request; and failed meetings still invoked the narrator, which could invent a successful encounter.

## Implemented

- Direct conversations establish a scene cast before time advances. Schedule processing holds those participants in place while the scene is active. Movement and next-daypart transitions end the existing scene.
- Ordinary conversation uses the current location and explicitly named characters, or the existing scene cast. A classifier cannot relocate the player for a conversational request. Recognized travel/rest/activity requests retain their mechanics.
- Pronouns without a single conversation target ask for clarification instead of guessing a character. Clarification does not commit a turn.
- If all requested characters are absent, the engine ends that attempted scene and returns the committed failure without requesting narration, ledger memories, or generated facts. Blocked travel follows the same rule.
- Scene requests list absent characters explicitly, place current state above past prose, forbid uncommitted entrances and departures, and prohibit invented player speech or physical actions beyond the submitted input.
- The compatible provider repairs common explicit off-stage entrances hidden inside narrator text, as well as invalid speaker IDs. This is a conservative check, not complete semantic validation of prose.

## Venus comparison

Reviewed src/renderer/stores/gameLoop.ts castPeopleTurn and applyCastToScene. Venus resolves attendance and rejects an entirely unavailable named cast before scene generation. This release applies that ordering to this framework's deterministic location and schedule rules. Its setting-specific contact gates, random encounters, and job attendance logic are not copied. Existing adapted Venus prompt and sanitization modules remain in use with their attribution.

## Upgrade

Stop the old server/desktop application. Extract this release to a new folder. Back up and copy the entire previous data folder into the new story-framework folder, then run Start-Windows.cmd or Start-Desktop-Windows.cmd. Preserve all of data, including campaign databases and AI settings.

Old saved generated prose is not rewritten. For a clean comparison start a new example campaign; existing campaigns can continue, but their prior transcript may contain contradictions from earlier releases. Moving to another location starts a fresh encounter context.

## Test

Talk to Ada, then enter “Flirt with her and ask how she is doing.” Confirm Ada remains in the same location. Ask for Brin while she is elsewhere: the game should report her absence rather than narrate her arrival. Use an explicit “Go meet Brin” request to travel. If several characters are in a scene and no single direct conversation target is established, “her” asks you to name the target.

96 automated tests pass; all 10 example packs validate. Tests cover schedule-boundary conversations, incorrect classifier destinations and cast, unavailable conversations, ambiguous pronouns, and an invented entrance in narration. The user's model and Windows GUI have not been exercised here. Freeform intent uses bounded language heuristics and model classification, so complex compound instructions and subtle prose contradictions remain limitations.
