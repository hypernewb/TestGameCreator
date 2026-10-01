# Daily flirt cap and departure cue: design card
Status: draft · Tickets: T-015 (for T-010)

## Goal (what the player feels)
Flirting feels worthwhile without becoming an endless route shortcut. She has a life: she signals a departure, allows a last exchange, then goes; leaving itself carries no penalty.
Owner direction comes from `docs/research/owner-answers.md`: cap first, boredom later; personality shapes unwelcome-flirt reactions; engine scoring uses the existing interpreted turn, with no extra judge call.

## What we have (self-audit, cite docs/map)
- Map basis: `docs/map/README.md`, `docs/map/modules.md`, `docs/map/packs.md`; modules supply mechanics, packs supply schedules and character content.
- `packages/modules/social.mjs`: `isRepeat` compares substantial speech with remembered topics; generic/repeated speech earns no ordinary trust reward, and fresh talk rewards are keyed by character and calendar day.
- Same file: `dialogueReactions` reduce repeated phrase effects inside a cooldown. This is phrase-specific damping, not a shared daily flirt allowance across differently worded moves.
- Same file: `world.schedule` moves off-scene actors on time advances, but skips the active scene cast; `laterStop` provides future-location hints and invitations check upcoming obligations. No departure countdown is stored in this module.
- `packages/modules/dating.mjs`: authored signals change chemistry; nonrepeatable signals are remembered, repeatable signals can fire again. It stores relationship cooldowns, not a daily flirt counter.
- `packages/modules/scenes.mjs`: player exits and incident cleanup already handle `core.sceneEnded`; reuse this lifecycle rather than strand a scripted scene when she goes.
- `packages/modules/index.mjs` also registers `social.romance-tempo` for gift cadence/repeat damping. Its implementation and the imported `romance-stats.mjs` are absent from the permitted map list, so the existing Like/Trust daily ceiling is not independently verified here.
- Gap within audited files: no common flirt-budget field or cue/grace/departure state. Overlap: fresh-talk rewards, phrase damping, chemistry signals, gift pacing, and scene cleanup; apply one shared gate without duplicate rewards or penalties.
- `public/studio.mjs`: Game project exposes conversation and schedule visibility; Dialogue reactions and Romance pacing expose existing damping. None of these controls is the proposed cap/departure option.

## Reference games (2–3, one line each)
- rp-master: `.rp-master/src/lib/dating/intent.ts` tracks same-intent runs and nudges repetition; `relationshipAssist.ts` dampens positive relationship deltas; `gifts.ts` combines cadence and same-gift decay; `rapport.ts` uses a separate qualitative judge, which our owner ruled out.
- Venus: `.venus/shared/relationship.ts` scores recency-weighted memories, folds exact repeats for readers, and tracks milestones; affection uses raw memories, so deduplication is not a daily flirt cap. This file supplies no departure grace mechanism.
- `docs/research/rp-master-digest.md` is background only: its missing-feature claims and extra-call suggestions are superseded by this audit and the newer owner answers.

## Owner decisions (dated; every number lives here)

## Creator option (field, modes, campus default; creator UI screen)
Proposed pack object: `socialPacing`; fields `flirt.mode` (`cap | boredom`), `flirt.dailyLimit`, `departure.mode` (`cue | immediate`), and `departure.graceTurns`.
Campus defaults: `flirt.mode=cap`, `departure.mode=cue`; numerical defaults and action-counting/exhaustion semantics await the report questions. `immediate` is a proposed alternative for other worlds, not a campus change.
Creator placement: a new Social pacing section in `public/studio.mjs` after Game project conversation settings; expose Daily flirt limit only for cap and Farewell turns only for cue. In the thin slice, show boredom as unavailable until implemented; preserve existing packs through documented defaults.
Full boredom mode adds authored accumulation/recovery settings later; it must not silently run both cap and boredom. Departure pacing remains independent of flirt mode.

## Thin slice → full version
Thin slice: an engine-owned per-player/character/calendar-day counter gates interpreted flirting across typed input and suggested actions; rephrasing, scene restart, or moving rooms cannot reset it. Use the existing calendar day and existing Like/Trust ceiling rather than introduce another day clock.
Apply the selected cap policy before downstream flirt rewards, while preserving ordinary conversation and authored unwelcome-flirt consequences. Count a committed turn once, persist the counter, and reset eligibility at the next day; exact counted actions and exhausted-cap behavior remain pending.
On a scheduled departure that would move her out of the current scene, commit a pending departure with its destination and remaining farewell turns, then narrate a cue grounded in that obligation. A schedule advance can no longer hold her indefinitely in conversation.
The cue opens the grace window; later committed player turns spend it. On expiry, the engine releases her to the scheduled destination and updates the scene cast/cleanup. Early player exit clears the pending departure; restarting a scene cannot extend the same obligation. Define save/load and multi-character handling in the implementation ticket.
Departure and a polite farewell apply no relationship loss. Rudeness uses the existing interpreted turn plus authored reactions; its exact classification is an owner question. Flirting and farewell timing grant no new permission for physical actions.
Full version: implement boredom accumulation/recovery and personality-specific responses through the same gate; add authored obligations beyond schedules and expose their pacing in the creator.
Acceptance experiments for T-010: replay varied flirting until exhaustion and next-day reset; cue a schedule departure and try scene restart/save-load during grace; compare polite versus authored rude farewells. Verify deterministic counters, actual relocation, no automatic departure penalty, and no added model calls.

## Fun rubric notes (agency, surprise, payoff, repetition)
Agency: a last exchange and clear feedback make the exit playable. Surprise: personality supplies the response without inventing obligations. Payoff: show the owner's stat chips and mood line, honoring their visibility settings. Repetition: one shared budget closes wording loopholes while leaving other conversation available.
