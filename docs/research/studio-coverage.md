# Studio coverage: pack options vs creator controls
T-072 · analyzer · 2026-10-02

Method: every top-level pack key read by `packages/modules/*.mjs` (`validate`/`init`/`react`/`actions`/`panel`) was scraped mechanically (event-payload locals excluded), then each was matched against `public/studio.mjs` controls and `packs/*.json`.
Status: **control** = a Studio editor binds it · **json-only (intended)** = deliberate pack-JSON tuning with safe defaults · **GAP** = no control today.

## Module-read pack options

| Option | Read by (module:line) | Studio control (studio.mjs:line) | Template | Default | Status |
|---|---|---|---|---|---|
| abilities | abilities.mjs:4 | :338 | campus.json | — | control |
| actProfiles | acts.mjs:31 | — | campus.json | fallback +2/−2, sceneCap 12 | GAP |
| activities | minigames.mjs:32 | :194 | campus.json | duration 1 | control |
| actors | conditions.mjs:10 | :321 | template | — | control |
| anniversarySettings | anniversary.mjs:70 | :232 | campus.json | off; interval 7–365, maxMoments 1–20 | control |
| arcTracks | arc.mjs:11 | — | campus.json | — | GAP |
| calendar | calendar.mjs:25 | :307 | template | Term | control |
| characterSheets | dating.mjs:26, romance-tempo.mjs:81 | :321 (sheet button) | campus.json | — | control |
| currency | moments.mjs:33 | — | — | $ | json-only (intended) |
| dailyNeeds | daily-need.mjs:13 | :313 (edit-only) | campus.json | off | GAP (no enable/add) |
| datingProfiles | dating.mjs:154 | :336 | template | crush 25 · date 40 · exclusive 70 | control |
| dayRecap | recap.mjs:78 | :357 | campus.json | off; max 6, keep 7 | control |
| daypart | daypart.mjs:3 | :339 | — | interval 4, M/A/E | control |
| dialogueReactions | social.mjs:98 | :317 (dataEditor) | — | cooldownTicks 3 | control |
| directorProfile | director.mjs:264 | :6 | — | preset cassandra | control |
| economySettings | economy.mjs:20 (read :10) | — | template | debtLimit 0 | json-only (intended) |
| endings | endings.mjs:5 | :263 | template | — | control |
| equipmentSlots | equipment.mjs:5 | :325 | setModule default | outfit/accessory/tool | control |
| feedPosts | feed.mjs:8 | :317 (dataEditor) | template | reactions like | control |
| firsts | firsts.mjs:45 | — | campus.json | up to 60 | GAP |
| gameProject | social.mjs:55 | :307 | campus.json | presentation visual-novel | control |
| giftRepeatScale | romance-tempo.mjs:113 | :365 | campus.json | legacy | control |
| giftSettings | romance-tempo.mjs:114 | :365 | campus.json | liked ×1.5, disliked −2, keepsake 3/5 | control |
| gossipProfiles | gossip.mjs:26 | :261 | — | skepticism 0 · dismiss 20 · believe 60 | control |
| gossipRules | gossip.mjs:26 | :261 | campus.json | ttl 12, maxHops 2, credibility 50 | control |
| initialBonds | bonds.mjs:5 | :333 | — | 0–100 | control |
| initialMoney | economy.mjs:18 | :324 | template | 100 | control |
| initialNpcRelationships | npc-social.mjs:33 | :329 | — | affinity 0 | control |
| initialNpcRomances | romance-network.mjs:27 | :244 | — | phase dating · satisfaction 50 | control |
| initialSecrets | secrecy.mjs:53 | :413 | — | knownBy [] | control |
| initialStats | stats.mjs:31 | :334 | campus.json | 0 in range | control |
| intimacyCategories | intimacy.mjs:36 | :245 | template | privacy private · discretion discreet | control |
| intimacyProfiles | intimacy.mjs:36 | :245 | template | openness 50 · consentPolicy ask | control |
| intimacySettings | intimacy.mjs:36 | :245 | template | normal / suggestive, aftercareWindow 2 | control |
| invitations | social.mjs:24 | — | — | privateTrust 40 · publicTrust 0 | json-only (intended) |
| items | inventory.mjs:40 | :323 | template | owner · price 20 when sold | control |
| jealousyProfiles | jealousy.mjs:75 | :228 | campus.json | blank = no trait | control |
| jealousySettings | jealousy.mjs:75 | :226 | campus.json | max 10 · cool 3 · confront 6 · trust −2 | control |
| likesOpen | dating.mjs:155 (read :145, gossip.mjs:20) | — | — | undefined (off) | GAP |
| locations | world-events.mjs:7 | :319 | template | — | control |
| lustBaseline | romance-stats.mjs:13 | :363 | campus.json | off; 0.25/part, +5 milestones | control |
| moments | moments.mjs:55 | — | campus.json | up to 200 | GAP |
| momentsProfile | moments.mjs:53 | — | campus.json | generation off | GAP |
| npcChemistry | romance-network.mjs:27 | :244 | — | value 0 | control |
| npcDialogue | npc-social.mjs:44 | — | — | — | GAP |
| npcGroups | npc-social.mjs:39 | :330 | — | ≤20 groups | control |
| npcSimulation | npc-social.mjs:41 | :331 | — | every slot · 8×≤3 · 1 run-in @50% | control |
| objects | objects.mjs:7 | :326 | — | — | control |
| outreachMessages | outreach.mjs:18 | :270 | campus.json | — | control |
| outreachSettings | outreach.mjs:56 | :265 | campus.json | off; stage 0.1/0.35/0.55 · maxPerDay 2 | control |
| phoneContacts | phone.mjs:11 | :317 (csv) | template | — | control |
| phoneMessages | phone.mjs:11 | :317 (dataEditor) | template | offer expiresIn >0 | control |
| quests | social.mjs:119 | :337 | — | any [event, match] | control |
| recipes | inventory.mjs:45 | — | — | — | GAP |
| relationshipDimensions | bonds.mjs:5 | :333 | setModule default | affection/rivalry/familiarity | control |
| relationshipProgressions | progression.mjs:18 | :335 | — | initial stranger | control |
| relationshipStageSettings | dating.mjs:157 | :241 | campus.json | off; strain 20/2d, repair 2d | control |
| relationshipStates | progression.mjs:18 | :335 | setModule default | stranger | control |
| reputation | secrecy.mjs:53 | :420 | campus.json | off; +2 public / −10 caught | control |
| resource | abilities.mjs:4 | :338 | setModule default | Energy · max 5 | control |
| romanceAgents | romance-network.mjs:27 | :244 | — | turning-point · 40/75/65 | control |
| romanceStats | romance-stats.mjs:6 | — | campus.json | dailyGain unset | json-only (intended) |
| romanceTempoProfiles | romance-tempo.mjs:112 | :249 | campus.json | automatic · spark 0/10 | control |
| routeRepair | dating.mjs:156 | :238 | campus.json | off; cooldown 24 · trust 35 | control |
| run | endings.mjs:5 (react) | :307 | campus.json | off; days 14 | control |
| scheduleExceptions | social.mjs:111 | — | — | — | GAP |
| schedules | social.mjs:111 | :177 | template | period 4 (template) | control |
| scriptedScenes | scenes.mjs:127 | :82 | campus.json | trigger core.inspected | control |
| services | economy.mjs:20 | — | template | — | GAP |
| sobriety | sobriety.mjs:7 | — | campus.json | tipsy 2 · drunk 3 · sober 1 | GAP |
| socialPacing | acts.mjs:31 | :311 | campus.json | off; dailyLimit 3 · grace 2 | control |
| statDefinitions | stats.mjs:28 | :334 | campus.json | 0–100 · public | control |
| statMilestones | stats.mjs:34 | — | — | — | GAP |
| storyVariables | conditions.mjs:20 | :317 | — | initial false | control |
| suspicionProfiles | secrecy.mjs:53 | :414 | campus.json | world defaults | control |
| suspicionRules | secrecy.mjs:53 | :415 | campus.json | weight 15 · soft · witnesses | control |
| suspicionSettings | secrecy.mjs:53 | :410 | campus.json | curious 30 · confront 70 · decay 2 | control |
| timedEvents | timed-events.mjs:3 | :262 | template | — | control |
| touchLadder | touch-ladder.mjs:101 | — | — | privateLocations [] | GAP |
| unwelcomeFlirt | acts.mjs:31 | :312 | campus.json | off; deflect −1/0/0, shut_down −2/−2/0 | control |
| wageRules | economy.mjs:20 | — | template | amount >0 · cooldown 0 | GAP |
| wantSettings | wants.mjs:58 | :375 | campus.json | off; reward 3 · active 2 | control |
| worldEvents | world-events.mjs:7 | :327 | — | — | control |

## Nested fields the editors leave out (GAP)
- `datingProfiles[].eligibility.allTags` (dating.mjs:65), `.blockedStates` (:69), `.allowWhileExclusive` (:70) — editor only exposes anyTags/excludedTags/requiredFlags/forbiddenFlags (studio.mjs:336).
- `datingProfiles[].initialPhase / initialAgreement / agreementCooldownTicks / agreementSatisfactionCost / agreementGates` (dating.mjs:123–136, 159–160).
- `daypart.labels` (daypart.mjs:3) — UI hard-codes Morning/Afternoon/Evening with a note (studio.mjs:339).
- `endings[].requires.{datingPhases,romanceRanks,intimacyCounts,priority…}` (endings.mjs:5) — editor covers flags + completedScenes only (studio.mjs:263).
- `romanceTempoProfiles[].ranks[].scene` and per-rank gating (romance-tempo.mjs:112) — ranks are edited as JSON (studio.mjs:251).

## Engine-consumed, Studio-controlled (not module-read, informational)
`refusalStyle` :308 · `sceneFeedback` :354 · `slipGuard` :361 · `tickMinutes` :367 · `gameProject.timeMode` :309 · `run` :307 · content containers `startOptions` :318, `lorebook` :322, `initialRelationships` :328.

## Verdict
67 of 85 module-read options have a control. 4 are intentional JSON tuning (currency, economySettings, invitations, romanceStats); **15 are real creator-facing gaps** (see report list, ordered by impact). Every packed-in value has a working control except the GAP rows, so new mechanics shipping without a control are now caught by `tests/studio-coverage.test.mjs`.