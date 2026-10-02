# Modules

**Purpose**: Deterministic gameplay modules; the model proposes and narrates, the engine prices and records.

**Key Files**:
- `packages/modules/index.mjs`: Module registry and catalog.
- `packages/modules/social.mjs`, `dating.mjs`, `romance-network.mjs`: Social actions, preferences, dating phases and rival relationships. `dating.mjs` owns opt-in route repair (`routeRepairGate`, `social.repairRoute`) for rejected phases, dealbreakers and blocked states (T-053).
- `packages/modules/recap.mjs`: `story.recap`; pure per-day reader over committed events (`dayRecap`, `dayRecaps`) emitting `story.dayClosed`; no model call, digit-bearing lines dropped (T-051).
- `packages/modules/romance-stats.mjs`, `romance-tempo.mjs`: Shared Trust pricing, romance ranks/caps and earned-Lust milestone hooks.
- `packages/modules/touch-ladder.mjs`: `social.touch-ladder`; typed touch steps, readiness/privacy/sobriety refusals, Lust and its earned floor/easing (T-003/008/031/037).
- `packages/modules/flirt-cap.mjs`: Unwelcome-flirt reactions and departure pacing (T-008/010).
- `packages/modules/outreach.mjs`: `social.outreach`; deterministic authored texts, contact clock and daily send/reply budgets (T-030).
- `packages/modules/phone.mjs`: Threads, delivery, read/reply actions and generated outreach offers; exports `deliver` (T-030/042).
- `packages/modules/jealousy.mjs`: `social.jealousy`; witnessed/disclosed evidence, stage scaling, decay and confrontation hooks; player sees tone words (T-034/047).
- `packages/modules/anniversary.mjs`: `social.anniversary`; committed shared-moment ledger, callbacks and anniversary marks; `anniversaryBrief` supplies context. Available to creators, disabled in Campus/trio (T-032/047).
- `packages/modules/wants.mjs`: `social.wants`; weekly heroine wants, prompt cue and fulfillment rewards (T-040).
- `packages/modules/acts.mjs`, `intimacy.mjs`: Priced act tags and consent/body-limit gates.
- `packages/modules/scenes.mjs`, `director.mjs`: Scripted scenes and deterministic director pacing/dealing (T-052).
- `packages/modules/endings.mjs`: Unlocking/selection and the run-over flag at the deadline; the default ending must be able to fire (T-054).
- `packages/modules/stats.mjs`, `progression.mjs`, `economy.mjs`: Stats, progression and economy.

**Rules/Invariants**:
- Register modules in `index.mjs`; module mutations run inside engine `execute`.
- Replay uses recorded commands/events and never calls a model.
- Trust uses the shared writer; touch-ladder owns Lust. Prose never overrides consent or eligibility.
- Jealousy does not set dating phases. Anniversary callbacks do not invent shared history.
- Refusals/mixed-part rollback are recorded by the core engine, not a separate refusal module.
- Route repair waives a remembered cause, not consent; `routeRepair` absent keeps legacy behavior (T-053).
- Recap lines come only from committed events and never carry a digit (T-051).

**Tests**:
- `tests/touch-ladder.test.mjs`, `unwelcome-flirt.test.mjs`, `flirt-cap.test.mjs`, `body-limits.test.mjs`.
- `tests/outreach.test.mjs`, `lust-baseline.test.mjs`, `anniversary.test.mjs`, `jealousy.test.mjs`, `wants.test.mjs`.
- `tests/routes-never-close.test.mjs`, `day-recap.test.mjs`, `endings-reachable.test.mjs`.
