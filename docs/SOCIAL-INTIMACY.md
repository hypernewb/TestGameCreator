# Adult intimacy module

## Product intent

The first full game targeted by this framework is an **adult eroge / dating simulation** with optional NSFW scenes. Adult romance and sexual encounters are primary gameplay, not an incidental add-on. They remain modular so the runtime can also support non-adult packs, fade-to-black releases, and characters who are not romance options.

Routes do not need equal length or difficulty. A creator can mix slow-burn romances, conventional dating routes, brief consensual hookups, recurring casual partners, and characters who are sexually open or promiscuous. A short route may use automatic romance-tempo advancement or no tempo profile at all. Sexual availability is character-authored and contextual; it never eliminates consent, adult-only validation, orientation, boundaries, or the ability to stop.

`social.intimacy` is an optional, authored-data layer above `social.dating`. It models pacing, boundaries, consent, privacy, cooldowns, and encounter history; prose remains the narrator's job.

All participating actors must declare `age >= 18`. The module will reject the pack otherwise.

## Difficulty and content are separate

- **Easy** permits early, casual routes with low attraction requirements.
- **Normal** expects a crush or relationship plus earned attraction.
- **Realistic** expects an established dating relationship, stronger attraction, and positive satisfaction.

`contentLevel` independently selects `fade`, `suggestive`, or `explicit`. This lets a creator make a mechanically permissive fade-to-black game or a demanding explicit one without conflating prose intensity with consent.

Character `openness` adjusts the attraction prerequisite and `casual` enables casual categories. Neither one grants consent. Categories, relationship agreements, location privacy, bystanders, current consent, and hard limits remain independent checks.

## Consent flow

1. `social.requestIntimacy` checks eligibility.
2. A threshold profile may grant consent immediately; `ask` and `scripted` profiles emit `social.consentRequested` for authored resolution.
3. `social.beginIntimacy` requires unexpired explicit consent.
4. `social.withdrawConsent` remains available during a scripted scene.
5. A `resolution: "scene"` category waits for a scripted `completeIntimacy` effect. A `resolution: "direct"` category records its authored `defaultOutcome` during `social.beginIntimacy`, so a short encounter needs no bespoke scene graph. Both paths start cooldown and encounter history; generated prose cannot declare completion by itself.

Authored scene effects also support `intimacyConsent`, `discoverIntimacyInterest`, and `completeIntimacy`. This keeps consequential outcomes in deterministic game state instead of accepting an AI narrator's claim as authority.

## Encounter styles and aftermath

Categories may declare a reusable `style`, such as `tender`, `playful`, or `spontaneous`. A character's `stylePreferences` can like or dislike that style and apply an authored satisfaction change. Repeated encounters build `styleExperience`, which gives the narrator continuity without reducing future consent requirements.

After completion, an optional aftercare window opens. The creator defines neutral actions such as reassurance, conversation, practical care, or space; each character can react differently through `aftercarePreferences`. Providing or missing aftercare emits committed events and can change relationship satisfaction. These preferences may be public, discoverable, or private.

Categories also declare `open`, `discreet`, or `secret` handling. Exposure is based only on actors actually present at the encounter location. A witnessed discreet or secret encounter emits `social.intimacyExposed` with explicit witnesses, allowing dating-maintenance rules, gossip scenes, or promises to react without omniscient jealousy.

## Planned: encounter beats, ladder and visible progress (F5–F7)

Right now the middle of an encounter is a black box: once `social.beginIntimacy` passes, the narrator writes the scene and a `completeIntimacy` effect or `defaultOutcome` closes it. The player makes no decisions during the scene, and a small model writes much the same scene every time. See [FUN-PASS.md](FUN-PASS.md) and milestones F5–F7 in [NEXT-MILESTONES.md](NEXT-MILESTONES.md).

- **Beat skeleton (F5).** A category may declare `beats` (for example opening → escalation → check-in → peak → aftermath). Each beat offers 2–3 authored choices such as pace, lead or follow, or which interest to explore. Choices are scored against `stylePreferences` and `interests`; a poor match lowers satisfaction and can end the scene early. `packages/ai/beats.mjs` gives the narrator one concrete instruction per beat. `resolution: "direct"` stays available for short encounters.
- **In-character check-in.** The check-in beat is written in the character's voice, but it is backed by the same consent state as today: `social.withdrawConsent` stays available at every beat, and a decline or withdrawal ends the scene through the existing path. Beats never grant or extend consent.
- **Preferences learned through play.** Choosing well or badly at a beat can call `discoverIntimacyInterest`, so players learn preferences from how the character responds rather than from a list.
- **Ladder and escalation (F7).** Routes author rungs of smaller payoffs before and after the first explicit scene. `styleExperience` and romance-tempo ranks unlock new categories, beats or locations, so repeat encounters escalate instead of resetting.
- **Visible progress (F6).** Player-facing text shows hearts or ranks and an in-character hint instead of `intimacyEligibility` reasons such as `attraction 34 needs 50`. Raw reasons stay in the creator view.
- **Character identity.** Each romanceable character should author 2–3 interests, one boundary that matters to the story, who usually leads, and intimate-scene voice examples. Profiles made only of `openness` and `casual` give the narrator nothing specific to voice.

Fade and suggestive `contentLevel`s use the same beats and choices with non-explicit prose, so mechanics stay identical across content levels.

## Honest disclosure

The player may proactively disclose a discreet or secret encounter to another current partner. Each disclosure is written onto that encounter once, including the listener, tick, active relationship agreement, honesty effect, and boundary effect. The listener receives `social.encounterDisclosed`; unrelated characters do not receive the encounter in their AI context.

Creators configure satisfaction changes per agreement. A monogamous partner might appreciate the honesty but still consider the encounter a boundary breach, while an open or polyamorous partner may react positively or neutrally. This deliberately models negotiated boundaries instead of treating every multi-partner relationship as cheating.

## Design references

The separation between character preferences, relationship boundaries, and encounter pacing follows useful patterns from [The Sims 4 romance and attraction settings](https://help.ea.com/en/articles/the-sims/the-sims-4/gender-romance-attraction-guide/) and the daily-life relationship structure described by the [Love & Sex wiki](https://wiki.andrealphusgames.com/wiki/Love_%26_Sex). The stable authored profile versus runtime context split is also compatible with [SillyTavern's character and context model](https://docs.sillytavern.app/). Most importantly, the design treats consent as ongoing and withdrawable, consistent with the discussion of player agency in [Designing Dating Games](https://affinity-games.com/wp-content/uploads/2021/03/DatingGamesprepubproof.pdf).

The planned encounter beats borrow player-led pacing from Koikatsu / Honey Select, authored encounter menus from Trials in Tainted Space and Degrees of Lewdity, the earned payoff of HuniePop, and in-character consent check-ins from Baldur's Gate 3. The escalation ladder follows Being a DIK, Summertime Saga and Persona's confidant ranks.
