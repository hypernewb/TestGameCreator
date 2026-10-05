# Venus adaptation candidates for remaining creator controls

Owner follow-up, 2026-10-05. Framework HEAD 34682b6 plus selected workspace source; Venus local source at `C:/Users/ckx19/Venus University/venus-university-main/src`, revision unverified. Static analysis only. No code imported. All thirteen listed framework features already have engine/schema support; missing visual controls are the primary gap.

| Creator gap | Venus evidence | Useful adaptation |
| --- | --- | --- |
| Character-change arcs | shared/relationship.ts behaviorLevelOf; renderer/prompts/characterPrompt.ts stage behavior | Relationship-conditioned voice pattern already partly adapted. No equivalent configurable trait-drift arc engine established; expose our arcTracks. |
| Daily-needs enable/add | renderer/prompts/moods.ts fixed mood cycle | Optional mood-cycle pattern, not the framework's weighted daily need/reward mechanism. Build enable/add controls locally. |
| First-experience checkpoints | shared/relationship.ts applyEvent/foldRelationshipEvents | First kiss/sex flags, dated memories and feedback can inform milestones. Not equivalent to authored multi-checkpoint scenes; retain our firsts contract. |
| Ambient moments | renderer/stores/npcRunIns.ts; npcOverlay.ts; loop/npc.ts | Adapt dorm/common-area and loose run-in patterns to generic locations/groups. Does not cover the complete find/encounter/scene moment library. |
| Moment-generation tuning | npcRunIns.ts encounter probabilities and group limits | Expose probabilities/group limits as pack settings; use our existing momentsProfile for chance, cooldown, cap, dry streak and generated kinds. |
| NPC encounter dialogue | renderer/prompts/npcRelationship.ts pair/encounter context | Adapt standing/recent-encounter prompt context. No ready authored dialogue-pool editor established; our npcDialogueFor already selects group/pair/fallback pools. |
| Item-combination recipes | Targeted source search found no crafting/recipe mechanism | Expose existing framework recipes; shop catalogs are not recipes. |
| Schedule exceptions | hiddenScheduler.ts; timetable.ts; prompts/occasions.ts | Adapt class/job/closure/away precedence patterns; map slots to framework ticks/dayparts. No ready generic exception editor established. |
| Paid services | shared/shop.ts item purchase catalog | Item purchases are not generic service consumption. Expose our services; use shop patterns only as supporting presentation/reference. |
| Sobriety settings | No structured equivalent found in targeted source search | Expose our drinkItems/tipsyAt/drunkAt/soberPerDaypart. Incidental drunk prose is not state tracking. |
| Stat milestones | shared/playerStats.ts thresholds, tierOf, labels; loop/statusSteps.ts | Strong candidate for configurable tier tables and rank feedback. Our stats already supports ranks and milestone flags. |
| Touch-ladder settings | No structured equivalent found | Expose our existing trust/sobriety/privacy/boundary rules. Relationship kiss/sex flags are not an action ladder. |
| Wage rules | shared/jobs.ts payOf, requirements, settleShifts; loop/jobs.ts | Strong candidate for a later configurable jobs module: pay, raises, roster, excuses, strikes and firing. Basic event wages already exist; full jobs need additional state/contracts. |

Recommended adaptation order: stat-tier presets/feedback; generic NPC run-ins/encounter context; job/pay settlement; closure/availability patterns; milestone feedback. Every adaptation still needs creator forms, pack references, deterministic RNG/state mapping, persistence and replay checks. Do not copy Venus's global stores or fixed two-slot calendar into the framework. This is recommendation authority only.

## T-104 implementation, 2026-10-05

All thirteen requested existing systems now have visual authoring paths. The new Social and world systems panel covers arcs, first experiences, moments and generation tuning, NPC dialogue, recipes, schedule exceptions, services, sobriety, touch privacy and wages. Concurrent native daily-needs and stat-milestone controls are retained and integrated instead of duplicated. Reference pickers, nested rows/maps, explicit Apply/Cancel, engine validation and pending/stale edit guards support Check/Save/Open/export/import. Advanced fields are retained and disclosed.

This adapts the framework's existing deterministic contracts; it does not import new Venus stores or implement complete Venus parity. First-experience checkpoint identities and touch action/consent steps remain engine-owned; authored cues, privacy, pace and existing boundaries remain editable. Schedule exceptions use existing tick ranges. Wages cover event matching, amount, cooldown and payment feedback; raises, rosters, strikes and firing remain outside this slice.

Verification: 31 targeted tests pass, including actual control handlers, isolated persistence/transfer and representative runtime/replay outcomes. Isolated real-browser service authoring, pending-save refusal and save/reopen passed. Full npm run: 1,773 pass, 15 fail, 10 skipped; all failures were browser CDP/setup timeouts. See T-104.report.md for the bounded acceptance and regression limitation.
