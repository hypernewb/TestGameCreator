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

## Honest disclosure

The player may proactively disclose a discreet or secret encounter to another current partner. Each disclosure is written onto that encounter once, including the listener, tick, active relationship agreement, honesty effect, and boundary effect. The listener receives `social.encounterDisclosed`; unrelated characters do not receive the encounter in their AI context.

Creators configure satisfaction changes per agreement. A monogamous partner might appreciate the honesty but still consider the encounter a boundary breach, while an open or polyamorous partner may react positively or neutrally. This deliberately models negotiated boundaries instead of treating every multi-partner relationship as cheating.

## Design references

The separation between character preferences, relationship boundaries, and encounter pacing follows useful patterns from [The Sims 4 romance and attraction settings](https://help.ea.com/en/articles/the-sims/the-sims-4/gender-romance-attraction-guide/) and the daily-life relationship structure described by the [Love & Sex wiki](https://wiki.andrealphusgames.com/wiki/Love_%26_Sex). The stable authored profile versus runtime context split is also compatible with [SillyTavern's character and context model](https://docs.sillytavern.app/). Most importantly, the design treats consent as ongoing and withdrawable, consistent with the discussion of player agency in [Designing Dating Games](https://affinity-games.com/wp-content/uploads/2021/03/DatingGamesprepubproof.pdf).
