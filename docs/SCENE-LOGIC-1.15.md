# Scene logic fixes — 1.15.0

## What was wrong

- Scene requests mixed a plain-text instruction with a structured JSON contract.
- Freeform scene continuations lacked a dependable transcript of earlier player inputs and responses.
- Multi-character context emphasized one character instead of giving every staged character a full profile.
- Authored scenes generated hidden model prose and could derive memories from text the player never saw.
- Some mechanical requests during conversations were treated as dialogue continuations.
- Malformed JSON could be displayed directly as story text. Off-stage dialogue could be relabeled as narration.

## Changes

The scene request now distinguishes opening, continuation, and solo narration, includes the player's exact action, supplies bounded recent scene history, and includes all staged character profiles. The final instruction establishes the JSON response contract. Committed game outcomes remain authoritative; generated prose cannot grant items or change time or relationships.

The transcript formatting function is adapted from Venus University's scenePrompt.ts. The surrounding prompt builder follows its opening/continuation/solo approach while using this framework's world state and module rules. Attribution is in vendor/venus/NOTICE.md.

Scripted scenes and their choices use authored text without AI narration or generated fact extraction. Conversation routing recognizes additional mechanical action words and gives the classifier recent dialogue context. Invalid scene JSON receives one format repair attempt, then follows the existing fallback path. It is never displayed as raw story text. Dialogue explicitly attributed to an unavailable character is discarded.

## Upgrade and test

1. Stop the previous running server or desktop application.
2. Extract this release into a new folder.
3. Back up and copy the entire old data folder into the new project folder. This preserves campaigns, creator projects and AI settings. Do not copy only data/scenarios.
4. Run Start-Windows.cmd or Start-Desktop-Windows.cmd as before.
5. Open an existing campaign or start an example. Meet a character, ask a question, then refer to the answer in your next message. Try an item or movement command during that conversation. Open a scripted scene and check that its authored text appears.

For the standard compatible provider, the turn's sceneRequest field records the scene phase, exact player action, cast, history and initial model messages. Inspect it in the turn/context debugging view when a response seems wrong. It contains story and player text; review it before sharing. Repair requests are not included in this initial-request trace.

## Verification and limits

92 automated tests pass, including scene continuity, multiple character profiles, authored-scene bypass, malformed JSON repair, and off-stage speaker filtering. All 10 example packs validate. These checks use deterministic provider stubs; the user's local model and Windows UI have not been tested in this environment.

History is bounded to six recent turns and a 9,000-character narrative budget, with scene/daypart boundaries. This is not a replacement for long-term memory. The runtime still uses classification for freeform actions; arbitrary requests require an existing supported mechanic. Model prose can still contradict facts, so the saved request trace is useful for diagnosing model-specific behavior.
