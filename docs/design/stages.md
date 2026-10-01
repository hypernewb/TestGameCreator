# Relationship stages + repairable breakups: design card
Status: decided · Tickets: T-017, T-012, T-018

## Goal (what the player feels)
Commitment feels earned, conflict matters, and reunion remembers the hurt. Routes never permanently close, including affairs.

## What we have (self-audit, cite docs/map)
[Modules](../map/modules.md) identifies dating, authored progression, scenes, romance-network, intimacy and social; the [map index](../map/README.md) separates pack policy and runtime state.
The draft identifies existing dating phases, attraction/agreement gates, satisfaction/strain, breakup thresholds/cooldowns and a broken-to-dating ask path. Satisfaction recovery alone does not reconcile.
Authored setters/scenes and rivalry can also break relationships; all paths need coordinated history/scar bookkeeping. Existing setters do not necessarily enforce ladder adjacency or clear old agreements.
Progression owns a separate authored state graph; intimacy owns eligibility, consent and aftercare. Reuse those systems rather than add an aftercare judge.
Social invitations reject broken phases, so repair needs a reachable public interaction path. Campus already has attraction thresholds/allowed agreements; commitment and exclusivity policy remain separate.
Gaps: durable breakup history/scar, coordinated stage changes and explicit repair. Further rank/arc/secrecy integration needs implementation audit.

## Reference games (one line each)
- rp-master: warmth and commitment tiers, warnings/scars and gated events; use deterministic engine rules in place of its aftercare judge.
- Venus: breakup memories/counts and renewed lover status retain history after reunion without supplying our commitment ladder.

## Owner decisions (dated; every number lives here)
- 2026-10-01 Breakups: stages exist; a breakup leaves a lasting stat scar but is repairable, so routes never fully close.
- 2026-10-01 Stages (campus): acquaintance → dating → exclusive.
- 2026-10-01 Breakup scar: one-time −10 Trust, −10 Chemistry, recoverable; breakup always remembered.
- 2026-10-01 Strain: 2 in-game days of visible strain before an engine breakup; authored breakups separate.
- 2026-10-01 Repair: after 2 in-game days, rapport back to a set level, plus a reconciliation scene she accepts; restarts at dating.
- 2026-10-01 Judging (aftercare, rapport): no extra AI calls; the engine judges from state plus the turn's interpreted action. One call per turn stays.
- 2026-10-01 Repair gate: per heroine — each sheet sets her own rapport bar for reconciliation.
Every mechanic choice is a per-world creator option; ship the simplest mode first ([owner answers](../research/owner-answers.md)).

## Creator option (field, modes, campus default; creator UI screen)
Proposed relationshipStageSettings holds mode, ladder, scar, visible-strain policy and repair policy; character exceptions stay with dating profiles.
Basic ships the decided campus ladder, scar/history and repair; authored permits named commitment rungs and scene/event gates. Both retain repairability and affair possibilities.
Available/crush remain readiness states, broken/strained remain conditions. Keep existing thresholds and character agreement support on import; missing settings preserve legacy behavior.
Place Relationship stages beside Attraction and dating, above Relationship maintenance in public/studio.mjs. Keep authored progression graph editing separate from dating's commitment authority.
Show scar recovery, remembered history and the next ask/repair requirements. The repair rapport metric/level remains an owner question.
Affairs remain possible without silently rewriting a monogamous agreement as open; preserve existing boundaries and secrecy/exposure consequences.

## Thin slice → full version
Thin: dating owns coordinated commitment, breakup history and scar bookkeeping. Apply the decided hit once per genuine breakup across engine, authored and rivalry paths; repeat notifications cannot reapply it.
The stat loss can recover, but breakup history persists after recovery/reunion. Visible strain lasts the decided duration before engine-triggered breakup; authored breakups follow their separate authored conditions.
Clear obsolete commitment agreements on breakup. Thresholds only make asks eligible; they do not grant commitment or intimacy consent.
Keep broken relationships socially reachable. After the decided delay and rapport recovery, require an engine-validated reconciliation scene she accepts; restart at dating with fresh agreement rather than restoring exclusivity.
Separate strain recovery from reconciliation. Preserve existing consent/eligibility and use state plus the interpreted turn; no real-time timeout, invented physical milestones or extra model call.
Full: custom rungs, authored repair scenes, coordinated graph/rank/arc gates, NPC-pair parity and secrecy/exposure integration; UI/narration show current status with remembered breakup history.
Implementation checks: ladder gates, visible strain timing, every breakup path, exactly-once scar, repeat breaks, save/load, reachable repair/delay/acceptance, retained history, renewed agreements and affair eligibility.

## Fun rubric notes (agency, surprise, payoff, repetition)
Agency: explain the next ask and repair requirements; rejection is not permanent closure. Surprise: witnessed consequences use authored reactions. Payoff: reunion acknowledges hurt. Repetition: bookkeeping never reapplies scars and apology spam cannot bypass accepted reconciliation.
