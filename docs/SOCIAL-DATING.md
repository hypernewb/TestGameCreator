# Social dating module

`social.dating` is an optional, authored-data-driven romance layer. It does not let generated prose decide attraction, consent, or relationship status.

## Design influences

- Classic visual novels and Ren'Py projects commonly accumulate choice variables and gate later branches. This module keeps the useful deterministic gate, but replaces one universal affection counter with per-character rules: <https://www.renpy.org/doc/html/conditional.html>
- The Sims 4 Lovestruck separates Turn-Ons/Turn-Offs, Romance Style, and asymmetric Romantic Satisfaction. This module similarly gives every character an independent preference profile and avoids assuming that attraction is mutual: <https://help.ea.com/en/articles/the-sims/the-sims-4/gender-romance-attraction-guide/>
- SillyTavern separates stable character-card/persona data from runtime chat metadata and selectively activated World Info. Dating profiles are stable pack data; chemistry, discoveries, phase, cooldown, and explanation traces are replayable runtime state; only public or discovered preferences enter player-facing AI context: <https://docs.sillytavern.app/>, <https://docs.sillytavern.app/usage/core-concepts/macros/>

The implementation is original and engine-authoritative.

## Model

Each `datingProfiles` entry belongs to one non-player character and has four independent layers:

1. **Eligibility** is a hard gate. Identity tags, required/forbidden flags, blocked relationship states, exclusivity, and cooldowns cannot be overcome with points.
2. **Preferences** score authored player stats, bonds, traits, flags, and kept/broken plans. Rules can be public, discoverable, or private.
3. **Chemistry signals** listen to committed events and add bounded, replayable chemistry. Signals are once-only unless explicitly repeatable.
4. **Phase** records `available`, `crush`, `dating`, `exclusive`, `rejected`, or `broken`. Passing the crush threshold can open a crush; dating still requires a player action or scripted effect.

The current score is `clamp(chemistry + matched preference weights, -100, 100)`. The creator panel and saved trace explain every contribution. Hidden numbers and private preferences are withheld from player narrator context, while the involved character receives their own complete state.

## Relationship maintenance

Attraction answers “would this character pursue the player?” Satisfaction separately answers “how is the relationship working for this character?” Each profile can author:

- supported agreements: monogamous, open, polyamorous, or casual;
- an independently visible or private satisfaction value;
- strained and breakup thresholds;
- optional time-apart decay;
- committed-event signals for support, conflict, repair, promises, dates, or boundaries;
- agreement-specific signals; and
- witness-required signals, which only apply when the event payload explicitly identifies that character as a witness.

This makes jealousy a configured boundary response instead of a universal rule. An unwitnessed interaction cannot create omniscient jealousy. Open or polyamorous agreements can use different reactions—or none—while monogamous profiles can treat the same witnessed event as a turning point. Crossing the strained threshold emits a repairable state; recovering emits a repair event; crossing the breakup threshold commits a breakup and optional cooldown.

## Events and authored integration

- `social.attractionChanged`
- `social.chemistryChanged`
- `social.crushStarted`
- `social.dateAccepted`
- `social.datingPhaseChanged`
- `social.preferenceDiscovered`
- `social.relationshipAgreementChanged`
- `social.satisfactionChanged`
- `social.relationshipStrained`
- `social.relationshipRepaired`
- `social.relationshipBroken`

Scripted scenes can require `when.datingPhases`, change `chemistry`, set a `datingPhase`, or `discoverPreference`. A successful `social.askDate` requires co-location, eligibility, and the character's authored date threshold. Rejection, breakup, reconciliation, jealousy, and exclusivity conversations should be scripted consequences that commit phase changes rather than prose-only claims.

## Deliberate limits

This module does not implement consent or explicit scenes; those belong in the separately switchable `social.intimacy` module. Gifts, richer witness provenance, autonomous partner conversations, and ending gates remain future work.
