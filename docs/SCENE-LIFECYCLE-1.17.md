# Scene lifecycle — 1.17.0

A scene now has a saved summary during continuation. For compatible providers, `end_scene: true` requests a short closing response. The closing text is joined to the same player turn. Its final summary is saved, the scene is removed, and missed NPC schedule stops take effect at the boundary. Related recaps of the latest four completed scenes are available to later prompts for matching characters. The command “Goodbye” or the End conversation action ends the scene deterministically without another model call.

Movement, starting a new scene, changing conversation target, and advancing the daypart also release the old scene cast and apply missed schedule stops. Replay and import reconstruct AI scene settlements and deterministic attendance from saved turns. Memory and fact extraction still run once for the combined turn, including the closing text. Previous per-turn ledger behavior remains for compatibility.

The transcript-shortening helper in `vendor/venus/scenePrompt.mjs` is adapted from the Venus University snapshot named in `vendor/venus/NOTICE.md`. The closing request and state transition were implemented for this framework. Its university-specific timetables, jobs, relationship scoring and feed remain outside this release.

## Upgrade and use

Stop the previous app; extract this ZIP to a new folder. Back up and copy the entire `data` folder from the previous install into the new `story-framework` folder. Run `Start-Windows.cmd` or `Start-Desktop-Windows.cmd`. A new campaign is best for comparing scene continuity; old saves can continue and do not rewrite their earlier AI prose. In a new test, talk to Ada, say “Goodbye”, then confirm she follows her schedule. When the model chooses to end a scene, it may make one extra AI request for the closing beat.

## Verification and limitations

101 tests pass and all 10 example packs validate, including scene close, summaries, replay, and schedule catch-up. Real local-model quality and Windows visual behavior were not tested. There is no JSON streaming playback yet, no general NPC social simulation, and no phone/feed module. A local model may omit summaries or choose `end_scene` poorly; the explicit End conversation action remains available. The summary is at most 500 characters and the previous-scene recap list is bounded to four relevant scenes.
