# Character sheet: design card
Status: decided · Tickets: T-013, T-018

## Goal (what the player feels)
She is a whole person with a past, voice, tastes, limits, relationships and a life outside the conversation. Learning about her informs real choices.

## What we have (self-audit, cite docs/map)
[Modules](../map/modules.md) locates social, dating, stats, progression, scenes, intimacy and romance-network; the [map index](../map/README.md) separates contracts, packs, AI and presentation.
Both drafts describe actor prose and linked mechanical profiles without a unified character authoring contract. Preserve the richer inventory rather than the sparse draft's blanket “absent” claims:
- Actor identity/adult eligibility, description, style, traits, voice, tastes, goals and backstory; portrait/poses, conversation starters and activity reactions are presentation metadata.
- Linked schedules/exceptions, attraction preferences/signals/agreements, gift tastes/pacing, act tastes and intimacy eligibility/interests/aftercare/style preferences.
- Linked arc traits/drift/stages, firsts, endings, phone contacts/messages, suspicion, NPC affinities/romances, stats, bonds and authored progression graphs.
Runtime consent, scores, memories, discoveries and relationship history are state, not reusable authored personality.
Shared gaps: unified sheet, dedicated voice fingerprint, structured behavior rules and named social roster. The detailed draft distinguishes shared touch-ladder steps from the requested per-character body-region map.
The permitted map lacks field-level contracts; existing consumers, including dialogue examples and intimacy agreement checks, need implementation verification. Do not advertise unverified fields as wired.

## Reference games (one line each)
- rp-master: deep identity/life, voice, tastes, region sensitivity/limits, behavior, social links, routine, lore and gallery authoring; prompt rules and deterministic vetoes remain distinct.
- Venus: prose/personality, appearance, staged behavior, history, gift/attraction controls and seed-word generation; some schedule/social data lives in playthrough setup rather than its character card.

## Owner decisions (dated; every number lives here)
- 2026-10-01 Character sheet: full rp-master depth (schedule, gift tastes, touch preferences, behaviour rules, social links, etc.).
- 2026-10-01 Personality: closed trait list (2–4, engine-readable) + free notes for the AI.
- 2026-10-01 Gifts: liked/disliked categories per heroine.
- 2026-10-01 Touch prefs: full rp-master body-region map (sensitivity + limits per region).
- 2026-10-01 Sheet rollout: all fields now (creator tabs) + AI "Suggest" auto-fill from seed words; wire mechanics system by system.
- 2026-10-01 Sheet extras: adult history = free text + structured experience field (usable for firsts); behaviour rules = engine event→condition→effect rows + prose notes; Suggest = full draft from 3 seed words, per-field review, owner always picks consent/limits/intimate choices.
- 2026-10-01 Unwelcome flirting: the reaction depends on her personality (deflect / tease back / shut down), with matching stat changes.
- 2026-10-01 Rude exit: per-heroine rules on her sheet (what she finds rude + her reaction); no universal penalty.
- 2026-10-01 Judging (aftercare, rapport): no extra AI calls; the engine judges from state plus the turn's interpreted action. One call per turn stays.
- 2026-10-01 Fixed lists (traits, gift categories, experience levels, body regions/sensitivity): worker drafts from rp-master + Venus, owner approves before build.
Every mechanic choice is a per-world creator option; ship the simplest mode first ([owner answers](../research/owner-answers.md)).

## Creator option (field, modes, campus default; creator UI screen)
Characters → Sheet tabs: Identity & life; Personality & voice; Appearance; Tastes & gifts; Dating & intimacy; Routine; Behavior; Social links; Arc & payoffs; Lore & author notes.
Expose all fields immediately in campus, importing existing actor/profile data without loss. Basic/advanced views edit the same record; mechanics show inherited world policy and character overrides.
Identity/life includes occupation, workplace/home/haunts and birthday; voice includes examples/fingerprint; adult history includes prose and structured experience. Links accept actor references or external names with relation/notes.
Use trait/category pickers, a weekly grid with exceptions, the full touch-region sensitivity/limits editor, typed event→condition→effect rows and arc/stage cards. Label mechanics, narration and art separately.
Suggest creates a full reviewable draft from the decided seed input. Review changes per field; owner explicitly chooses consent, limits and intimate content before acceptance.
Prose never silently becomes a veto or reward. Validate references, duplicate IDs, schedule conflicts and contradictory enabled limits; preserve current module requirements.
Trait vocabulary, gift categories, experience choices and region/sensitivity schema need owner-approved definitions; do not invent character content.

## Thin slice → full version
Thin: expose and persist the complete sheet now, with structured mechanics and prose notes; join existing actor/profile tables by actor ID and preserve round trips. Mark new unconnected fields pending integration.
Keep current mechanics active; optional prose enriches narration, while unconnected rule fields do not pretend to affect outcomes. Provide full Suggest with per-field review and explicit owner intimate choices.
Full: wire gift categories, full region touch/limit profiles, event rules, routines/outreach, social initialization, structured experience/firsts and arc-aware voice/art system by system, with migrations and tests.
Preview narration notes alongside deterministic rules. Verify prose-only edits change voice without changing engine outcomes; validate tastes, availability and refusal reasons as each integration ships.

## Fun rubric notes (agency, surprise, payoff, repetition)
Agency: learned tastes and limits guide choices. Surprise: routines and links explain unexpected meetings. Payoff: goals and stage voice personalize progress. Repetition: examples, discoveries and stage behavior vary narration while the engine owns cadence.
