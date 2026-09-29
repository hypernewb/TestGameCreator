# Fun pass — critique and borrowed designs

> **Superseded 2026-09-29** by [GAME-DESIGN.md](GAME-DESIGN.md) and the Game tier in [NEXT-MILESTONES.md](NEXT-MILESTONES.md). Kept for history and for its list of borrowed designs.

Rationale for the Fun tier (F1–F12) in [NEXT-MILESTONES.md](NEXT-MILESTONES.md). The engine is correct, replayable and well tested; the problem is that there is no game on top of it yet. This file records what is wrong from a player's point of view and which existing games each fix borrows from. We borrow designs and patterns, not source code.

## What is wrong

1. **Engine without content.** 25 modules, about 590 KB of code, and 13 scripted scenes / 28 choices across all 17 packs. `living-world.json` has no scripted scenes. No module has been shown to be fun, because no pack plays long enough to show it.
2. **No goal, no stakes.** Nothing to work toward, no deadline, nothing to lose. The calendar exists but nothing ends, so waiting costs nothing. Rewind shipped before mistakes carried any weight.
3. **Free text has no mechanical weight.** Narration is descriptive by design, so a clever line and "hi" have the same effect on state. Players learn this quickly and stop trying. The hidden "Need ideas?" button shows the blank-page problem.
4. **Spreadsheet feedback.** Relationship change is shown as `Mina: Trust 52 → 55`. Eligibility is expressed as `attraction 34 needs 50`.
5. **Developer tools on the player's screen.** AI settings, memory manager, backups, export, action journal and a live token-budget readout sit in the main bar.
6. **The intimate scene has no gameplay.** `intimacyEligibility` gates it, the model writes it unstructured, `completeIntimacy` closes it. A 9B roleplay model left alone writes roughly the same scene every time in the same voice.
7. **Binary routes instead of a ladder.** Presets either unlock intimacy almost at once (`easy`) or after a long invisible grind (`realistic`). No smaller payoffs in between; repeat encounters don't escalate. `styleExperience` only feeds narrator continuity.
8. **Characters without a sexual personality.** Intimacy profiles are mostly numbers (`openness`, `casual`); the template packs have one category and empty interests and aftercare. Players remember adult VN characters for a specific dynamic that the model cannot invent reliably.
9. **Drama systems no pack uses.** Secret and discreet encounters, witnesses, exposure, disclosure, agreements, rivals and gossip all exist. No shipped pack has two partners and a witness, so the main source of tension in the genre never happens.
10. **Missing genre staples.** No scene gallery, almost no art (one background, one test portrait), no teased next event.

## Borrowed designs

| Source | Idea borrowed | Where it lands |
|---|---|---|
| Fallen London (Failbetter, quality-based narrative) | Storylets: content gated by qualities, offered to the player as a hand of options | F2. Our `scriptedScenes` + `conditions.mjs` are already storylets; only the offering surface is missing. |
| Reigns | Card-per-decision presentation with visible cost | F2 card layout |
| Monster Prom, Persona | Fixed-length run, dayparts as the currency, ending on a date | F1, F3 |
| Persona, Monster Prom | Social stats with named ranks, trained on the calendar; options gated by a visible stat requirement | F4 |
| Disco Elysium | Check requirement shown up front; failure is its own branch and moves the story forward | F4 |
| Stardew Valley | Hearts, visible progress to the next heart event, discoverable likes and dislikes | F6 (`discoverPreference` already exists) |
| Persona confidants | Ranks that grant usable perks; a full-screen rank-up moment | F7, F9 |
| Being a DIK, Summertime Saga, Eternum | An escalation ladder of smaller payoffs; relationship drama around secrets and multiple partners; early hook | F1, F7 |
| Koikatsu / Honey Select | Player-led pacing and intensity inside the intimate scene, a response meter | F5 |
| Trials in Tainted Space, Degrees of Lewdity | Encounter menus of authored beats that depend on character interests and history | F5 |
| HuniePop | The lead-up is a game with a skill ceiling, so the payoff is earned | F4, F5 |
| Baldur's Gate 3 | Consent check-ins spoken in character, which read as intimacy rather than a form | F5 |
| Left 4 Dead AI Director, RimWorld storytellers | Pacing director that adds complications when things get quiet | F8 |
| Façade, Versu | Drama manager chooses the beat; the model only voices it (already in `packages/ai/beats.mjs`) | F5, F8 |
| Wildermyth | Authored templates with role slots filled from the current cast | F11 |
| Ren'Py VNs | Scene/CG gallery, skip stops at unseen text | F10 |

## Principles that carry over

- **The engine decides, the model voices.** Every borrowed mechanic resolves in the engine with seeded, replayable results. Checks are deterministic stat thresholds, not dice (F4). The model voices one instruction per beat (F5); it never picks an outcome.
- **Consent is never a difficulty setting.** Encounter beats, ladders and hints change how scenes feel, not whether the consent gate applies. Declining or withdrawing is available at every beat.
- **One pack proves everything.** Every Fun milestone must work in the F1 pack; if a feature can't be shown there, it waits.
- **Measure fun, not just tokens.** Playtests report time to first choice and first payoff, dead turns, and repeated prose (F12), next to the existing context-budget numbers.
