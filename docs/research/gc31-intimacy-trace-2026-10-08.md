# GC3.1 intimacy path trace (2026-10-08)

Scope: read-only trace of the existing adult/intimate path on `main` 9ead651. Classifications:
- **runtime-complete**: engine command or rule exists and a named test exercises it.
- **creator-only**: authoring, lint, or Studio control with no player-facing runtime of its own.
- **player-only**: play-time UI or wardrobe presentation with no authoring path.
- **unverified-by-reading**: code exists or is missing, but no named test was found and the path was not run.

Evidence limits: anchors are from grep and sed reads, not from running the game. "none" means no test name was found that covers the row. Test names are quoted from `tests/*.test.mjs`. Mechanical state is not prose quality (GC3.6 owns that).

Drift guard: `tests/gc31-intimacy-inventory.test.mjs` asserts the exports, command names and identifiers below.

## Firsts (free-typed first experiences)

| # | Piece | File:line | Class | Evidence |
|---|---|---|---|---|
| F1 | Rungs talk/date/kiss/night and their events | packages/cards/beat-library.mjs:36 | runtime-complete | firsts.test.mjs "firsts validate: the checkpoint shape is fixed by code" |
| F2 | Checkpoints per rung (ids and want-tags) | packages/cards/beat-library.mjs:53 | runtime-complete | firsts.test.mjs "firsts validate: the checkpoint shape is fixed by code" |
| F3 | Auto-resolve after FIRST_INPUTS=2 typed turns | packages/cards/beat-library.mjs:59 | runtime-complete | firsts.test.mjs "talk: offered first starts on the hub action, a best resolves at once, a light after two inputs" |
| F4 | NIGHT per-checkpoint payouts and TONES | packages/cards/beat-library.mjs:42-44 | runtime-complete | firsts.test.mjs "night: NIGHT pays per checkpoint, the lead teaches her interest" |
| F5 | firstTone (completed talk/date/kiss tone) | packages/cards/beat-library.mjs:61 | runtime-complete | firsts.test.mjs "talk: offered first starts on the hub action" (tone reached via complete) |
| F6 | Typed stop floor (typedStop) | packages/modules/firsts.mjs:19 | runtime-complete | firsts.test.mjs "typed-stop floor: stops are stops" |
| F7 | Typed yes floor (typedYes) | packages/modules/firsts.mjs:20 | runtime-complete | firsts.test.mjs "typed-stop floor: stops are stops" |
| F8 | Typed stop routed before the model in the service | packages/ai/service.mjs:194 | runtime-complete | firsts-service.test.mjs "a typed stop withdraws consent without invoking the narrator" |
| F9 | firstBrief narrator digest (hides wanted tags) | packages/modules/firsts.mjs:22 | runtime-complete | firsts-service.test.mjs "a hub first opening has a focused narrator brief" |
| F10 | social.startFirst command | packages/modules/firsts.mjs:65 | runtime-complete | firsts.test.mjs "talk: offered first starts on the hub action" |
| F11 | social.scoreFirst command (typed turn scoring) | packages/modules/firsts.mjs:69 | runtime-complete | firsts.test.mjs "scoreFirst ignores a source it already scored"; firsts-service.test.mjs "a typed kiss goes from opening to completion" |
| F12 | social.stopFirst command and STOP_LABEL action | packages/modules/firsts.mjs:87, :97 | runtime-complete | firsts-service.test.mjs "a typed stop withdraws consent"; firsts-ui.test.mjs "play wires persistent Stop outside dialogue and choices" |
| F13 | Night completion calls completeIntimacy | packages/modules/firsts.mjs (complete(), after line 50) | runtime-complete | firsts.test.mjs "night: NIGHT pays per checkpoint" |
| F14 | Stopped/rejected firsts go back on offer (no closed routes) | packages/modules/firsts.mjs (end(), line 30-35) | runtime-complete | firsts.test.mjs "a scene ending mid-first puts it back on offer"; routes-never-close.test.mjs |
| F15 | Firsts UI: progress dots, offers, turn card, end card | public/firsts-ui.mjs:6, :12, :29, :46 | player-only | firsts-ui.test.mjs "progress is dots only, reflects engine checkpoints" |
| F16 | Play stop button (#first-stop) | public/play.mjs:60-61 | player-only | firsts-ui.test.mjs "play wires persistent Stop outside dialogue and choices" |
| F17 | Scene CG for a completed first | packages/modules/firsts.mjs (validCg, line 9) and complete() | runtime-complete | firsts-ui.test.mjs "a completed free first unlocks its CG" |
| F18 | Creator firsts editor (checkpoint shape, character rows) | public/creator-systems-contract.mjs:14, :49, :57 | creator-only | creator-systems-controls.test.mjs "firsts Apply shows the validation message in its card" |

## Intimacy (scenes, consent, sobriety, aftercare)

| # | Piece | File:line | Class | Evidence |
|---|---|---|---|---|
| I1 | Settings defaults: difficulty, contentLevel, privateLocations, aftercareWindow | packages/modules/intimacy.mjs:17-18 | runtime-complete | framework.test.mjs "intimacy supports authored completion and consent withdrawal during a pending scene" |
| I2 | Category lookup (default first-night and fling) | packages/modules/intimacy.mjs:22; packages/cards/beat-library.mjs:33 | runtime-complete | intimacy-sobriety.test.mjs "tipsy blocks unless the category allows it" |
| I3 | Eligibility gate (boundaries, sobriety, cooldown, attraction, satisfaction, phase, privacy) | packages/modules/intimacy.mjs:36 | runtime-complete | intimacy-sobriety.test.mjs "a drunk partner defers instead of consenting" |
| I4 | Sobriety tiers used by intimacy | packages/modules/intimacy.mjs:31; packages/modules/sobriety.mjs:5-6 | runtime-complete | sobriety.test.mjs "drinks make an NPC tipsy then drunk" |
| I5 | Consent set/grant/decline/withdraw | packages/modules/intimacy.mjs:38 | runtime-complete | framework.test.mjs "intimacy supports authored completion and consent withdrawal during a pending scene" |
| I6 | social.requestIntimacy and social.beginIntimacy commands | packages/modules/intimacy.mjs:47 | runtime-complete | intimacy-skeleton.test.mjs "an applied encounter plays: Stop is offered at every beat" |
| I7 | social.withdrawConsent command | packages/modules/intimacy.mjs:47 | runtime-complete | framework.test.mjs "intimacy supports authored completion and consent withdrawal" |
| I8 | completeIntimacy: encounter record, style XP, cooldown, exposure | packages/modules/intimacy.mjs:40 | runtime-complete | framework.test.mjs "encounter styles, aftercare, and exposure create asymmetric relationship consequences" |
| I9 | Discover interest (social.intimacyInterestDiscovered) | packages/modules/intimacy.mjs:39 | unverified-by-reading | none (firsts.test.mjs "discover pays on best" covers firsts, not this command) |
| I10 | Viewer-scoped intimacy digest (hides unknown prefs) | packages/modules/intimacy.mjs:42 | unverified-by-reading | none direct; firsts-service.test.mjs "the prompt keeps firsts private" is the nearest |
| I11 | Aftercare window, pendingAftercare, missed-aftercare delta | packages/modules/intimacy.mjs:48 (react), :18 (aftercareWindow=0 default) | runtime-complete | framework.test.mjs "encounter styles, aftercare, and exposure create asymmetric relationship consequences" |
| I12 | social.offerAftercare command and its hub action | packages/modules/intimacy.mjs:47, :50 | runtime-complete | framework.test.mjs "cared.act('social.offerAftercare')" |
| I13 | Aftercare presentation in the player UI | none in public/play.mjs or public/vn.mjs (generic action list only) | unverified-by-reading | none |
| I14 | Proactive disclosure (social.discloseEncounter) | packages/modules/intimacy.mjs:47, :50 | runtime-complete | framework.test.mjs "proactive encounter disclosure respects relationship agreements" |
| I15 | Region limits: never / hard / ask_first | packages/modules/intimacy.mjs:10 (regionLimitReason) | runtime-complete | body-limits.test.mjs "every region enforces never/ask_first/ok/null independently" |
| I16 | Region agreements, set and clear per scene | packages/modules/intimacy.mjs:12-13 | runtime-complete | body-limits.test.mjs "hard agreement never bypasses sobriety, privacy or a withdrawn scene agreement" |
| I17 | Hard limit default (trust 70, stage dating) | packages/modules/intimacy.mjs:14 | runtime-complete | body-limits.test.mjs "hard agreement never bypasses sobriety" (default value not asserted) |
| I18 | Sensitivity scale validation | packages/modules/intimacy.mjs:9, :15 | unverified-by-reading | none (used by touch-ladder.mjs attemptTouch scale lookup) |
| I19 | Intimacy-specific scene budget | none; generic only (packages/core/engine.mjs:102, :310 gameProject.sceneBudget; packages/ai/scene-acts.mjs:14) | unverified-by-reading | none |
| I20 | Intimacy cooldown (cooldownUntil) | packages/modules/intimacy.mjs:36 (eligibility), :40 (set on complete) | unverified-by-reading | none direct |
| I21 | Intimacy status panel (panel) | packages/modules/intimacy.mjs:51 | unverified-by-reading | none |

## Touch steps, boundaries and sobriety on touch

| # | Piece | File:line | Class | Evidence |
|---|---|---|---|---|
| T1 | Step to region map (TOUCH_REGIONS) | packages/modules/touch-ladder.mjs:7 | runtime-complete | touch-ladder.test.mjs "an explicit model-tagged step wins over text mapping" |
| T2 | Ladder steps (handhold to sex, minTrust, sober, public) | packages/modules/touch-ladder.mjs:14-24 | runtime-complete | touch-ladder.test.mjs "the same kiss after trust gain is accepted with a lust delta" |
| T3 | Free-text to step (mapTouchText) | packages/modules/touch-ladder.mjs:40 | runtime-complete | touch-ladder.test.mjs "free text maps to the nearest ladder step" |
| T4 | touchEligibility (limit, sobriety, privacy, trust) | packages/modules/touch-ladder.mjs:66 | runtime-complete | touch-ladder.test.mjs "touchEligibility reasons compose and an unknown step is rejected safely" |
| T5 | Public-place block on high steps | packages/modules/touch-ladder.mjs:66-78 (privacy) | runtime-complete | touch-ladder.test.mjs "a public place blocks high steps even with plenty of trust" |
| T6 | Drunk partner refuses touch | packages/modules/touch-ladder.mjs:70 (sober check) | runtime-complete | touch-ladder.test.mjs "a drunk partner refuses per sobriety rules" |
| T7 | Accept/refuse outcome and lust/trust deltas | packages/modules/touch-ladder.mjs:83 (attemptTouch) | runtime-complete | touch-ladder.test.mjs "low-trust kiss is refused in character with a vague hint" |
| T8 | In-character refusal text | packages/modules/touch-ladder.mjs:77-80 (HINTS, refuseRegionTouch) | runtime-complete | touch-ladder.test.mjs "low-trust kiss is refused in character" |
| T9 | social.attemptTouch command | packages/modules/touch-ladder.mjs:105 | runtime-complete | touch-ladder.test.mjs "replays deterministically for the same command sequence" |
| T10 | Region touch from acts (applyRegionAct) | packages/modules/touch-ladder.mjs:81; packages/modules/acts.mjs:40 | runtime-complete | body-limits.test.mjs "every region enforces never/ask_first/ok/null" |
| T11 | Unwelcome flirt reactions and pace | packages/modules/flirt-cap.mjs (reactUnwelcome; line not traced) | runtime-complete | unwelcome-flirt.test.mjs "pace scales thresholds while body limits, privacy and sobriety win" |
| T12 | Body region data (bodyRegionOf, REGIONS) | packages/core/character-sheet.mjs:3 | runtime-complete | body-limits.test.mjs (sheet regions) |
| T13 | Creator sheet editor for body regions | public/sheet-editor.mjs:5, :75 | creator-only | none direct (character-sheet.test.mjs exists; test names not traced) |
| T14 | Creator ladder pace or region-limit editor | none found in public/ | unverified-by-reading | none |

## Scene skeleton, authoring and prose

| # | Piece | File:line | Class | Evidence |
|---|---|---|---|---|
| S1 | Beat and slot identifiers (5 beats, 6 slots) | packages/cards/intimacy-skeleton.mjs:7-8 | creator-only | intimacy-skeleton.test.mjs "encounters: 5 segments, each with the same code-built stop choice" |
| S2 | Adult entry detector (adultEntry) | packages/cards/intimacy-skeleton.mjs:13 | creator-only | intimacy-skeleton.test.mjs "adultEntry and missingStops read content, not a stored flag" |
| S3 | Per-beat stop choice (stopChoice, missingStops lint) | packages/cards/intimacy-skeleton.mjs:15-17 | creator-only | intimacy-skeleton.test.mjs "the lint names the beat without a stop"; runtime stop: after-hours.test.mjs "every beat before the end offers an unchecked stop" |
| S4 | Age gate: generator never sets ages | packages/cards/intimacy-skeleton.mjs:36 (test name) | creator-only | intimacy-skeleton.test.mjs "the generator never sets ages: apply fails until the author marks them 18+" |
| S5 | Prose drafting with one repair (draftIntimacyProse) | packages/cards/intimacy-skeleton.mjs:88 | creator-only | intimacy-skeleton.test.mjs "prose: one repair when too many slots are missing" |
| S6 | Boundaries and content level (fade/suggestive/explicit) | packages/cards/intimacy-skeleton.mjs:38 | creator-only | intimacy-skeleton.test.mjs "boundaries are the author's" |
| S7 | Frame and scenes wiring into the pack (intimacyFrame, intimacyScenes) | packages/cards/intimacy-skeleton.mjs:47, :59 | creator-only | intimacy-skeleton.test.mjs "review marks encounters adult; regenerate redraws both scenes" |
| S8 | Intimacy frame in proposal review | packages/ai/proposal-review.mjs:42 | runtime-complete | scene-intimacy-gate.test.mjs "an active consented encounter opens the gate" |
| S9 | Explicit-word gate and boundary line in scene prompt | packages/ai (gate; file not traced) | runtime-complete | scene-intimacy-gate.test.mjs "an explicit pack without an active encounter gets the boundary line" |
| S10 | Creator intimacy editor (Studio settings, interests, aftercare rows) | public/studio.mjs:430 (intimacyEditor); public/creator-advanced-contract.mjs:23-30 | creator-only | creator-advanced-controls.test.mjs "typed intimacy rows survive isolated save/open/export roundtrip" |

## Wardrobe, media and scene presentation

| # | Piece | File:line | Class | Evidence |
|---|---|---|---|---|
| W1 | Worn outfit choice (wornSetOf) | public/wardrobe.mjs:2 | player-only | wardrobe-play.test.mjs "outfit image comes from the actor pose named set-emotion" |
| W2 | Worn image lookup (wornImageOf) | public/wardrobe.mjs:3 | player-only | wardrobe-play.test.mjs "outfit image comes from the actor pose named set-emotion" |
| W3 | Undressed state (active or pending aftercare) | public/wardrobe.mjs:4 | player-only | wardrobe-play.test.mjs "undressed means an active or pending intimate scene for that character only" |
| W4 | Play stage consults wardrobe | public/vn.mjs:7, :21 | player-only | wardrobe-play.test.mjs "the play-time stage consults wardrobe for every visible character" |
| W5 | Package copy of wornSet (kept in step) | packages/assets/character-sprites.mjs | runtime-complete | wardrobe-play.test.mjs "browser wardrobe picks the same set as the packages copy" |
| W6 | Intimacy CG validation (validCg) and gallery cards | packages/modules/intimacy.mjs:5; public/gallery.mjs:19 | runtime-complete | erotic-scenes-wardrobe.test.mjs "gallery: intimacy scenes list as CG cards, unlock only after an encounter" |
| W7 | Missing-art audit for intimacy CGs | packages/assets/asset-audit.mjs (intimacy refs) | runtime-complete | erotic-scenes-wardrobe.test.mjs "asset audit: scene CG and beat CGs are referenced under intimacy" |
| W8 | Clothing and CG reflect committed scene after reload | none traced | unverified-by-reading | none |

## Summary counts

- runtime-complete: 46 rows
- creator-only: 10 rows
- player-only: 6 rows
- unverified-by-reading: 9 rows

Gaps for later slices: no intimacy-specific scene budget (I19), no player-facing aftercare text (I13), no creator ladder or region-limit editor (T14), no direct test for interest discovery (I9) or cooldown (I20). Total 71 rows. GC3.3 and GC3.5 should start from these.
