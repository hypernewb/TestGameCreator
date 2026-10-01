# Relationship stages + repairable breakups: design card
Status: draft · Tickets: T-017, T-012

## Goal (what the player feels)
Commitment feels earned, conflict matters, and an ex remains a possible future relationship with remembered hurt.
Owner direction: a commitment ladder, repairable breakups with a lasting stat scar, and routes that never permanently close, including affairs (brief; docs/research/owner-answers.md).

## What we have (self-audit, cite docs/map)
Scope checked against docs/map/README.md, docs/map/modules.md and docs/map/packs.md; the digest's missing-stage claim is outdated.
- packages/modules/dating.mjs already owns available/crush/dating/exclusive/rejected/broken phases, attraction gates, agreements, satisfaction, strain, breakup thresholds and cooldowns.
- Its askDate can move broken back to dating after eligibility/cooldown checks; satisfaction recovery clears strain but does not itself reconcile the phase. No breakup count or dedicated scar is stored there.
- setDatingPhase is also an authored setter; it does not enforce ladder adjacency or reset an old agreement. A new design must handle every breakup entry path, not just satisfaction-triggered breaks.
- packages/modules/progression.mjs owns a separate authored relationship-state graph with event/stat/bond/flag gates; packages/modules/scenes.mjs can set either graph state or dating phase and apply memory/stat effects.
- packages/modules/romance-network.mjs owns NPC pairs and rivalry stay/leave/open outcomes; its leave outcome directly breaks the player relationship. Player and NPC phase storage overlap but are distinct.
- packages/modules/intimacy.mjs already owns current consent, phase/score eligibility, aftercare windows and satisfaction consequences; reuse its events rather than adding another aftercare judge.
- packages/modules/social.mjs refuses invitations in broken/rejected phases. Reconciliation therefore needs a reachable public interaction path rather than depending on an accepted invitation.
- packs/campus.json enables dating, intimacy, scenes, secrecy, romance tempo and character arcs, but not social.progression or romance-network; its dating profiles have no authored maintenance settings.
- Campus already has attraction thresholds and character-specific allowed agreements. Preserve these; commitment stage and exclusivity agreement must remain separate concepts.
Gaps in the inspected system: durable breakup history/scar, coordinated stage changes, and an explicit repair path; further rank/arc/secrecy integration needs a mapped follow-up audit.

## Reference games (2–3, one line each)
- rp-master: .rp-master/src/lib/dating/stage.ts separates warmth stages from requested commitment tiers, warns before breakup and applies a stat scar; .rp-master/src/lib/world/triggers.ts runs deterministic gated events; .rp-master/src/lib/dating/aftercare.ts supplies aftermath deltas through its existing judge, which we replace with engine rules under the owner's single-call decision.
- Venus: .venus/shared/relationship.ts applies milestone flags, breakup counts/memories and renewed lover status; .venus/prompts/relationship.ts narrates current danger and past breakups independently, retaining history after reunion rather than implementing a commitment ladder.

## Owner decisions (dated; every number lives here)

## Creator option (field, modes, campus default; creator UI screen)
Proposed pack field: relationshipStageSettings with mode, ladder, scar, warning and repair policy; actor exceptions remain in datingProfiles.
Modes: basic uses existing dating phases plus scar/history and repair; authored adds custom named commitment rungs and scene/event gates. Both retain repairability and affair possibilities.
Proposed campus default: basic, presenting acquaintance → dating → exclusive; available/crush remain readiness states, and broken/strained remain conditions rather than extra ladder rungs. Final rung choice is in the report.
Creator UI: public/studio.mjs, add a Relationship stages control beside Attraction and dating and above datingMaintenanceEditor()'s Relationship maintenance section; show advanced rung editing only in authored mode.
Reuse existing Relationship states / Relationship progression controls for authored story graphs; explain their distinction from commitment, with dating as the commitment authority.
Keep the current pack's thresholds on import; no silent retuning, phase migration or changes to character agreement support. Missing settings preserve legacy behavior until opted in.
Affairs remain possible without rewriting a monogamous agreement into an open one; secrecy/exposure consequences stay with the existing systems, with their integration audited before implementation.

## Thin slice → full version
Thin: extend dating state with breakup history and scar bookkeeping; apply the chosen stat hit once per genuine breakup, including rivalry/authored paths, and retain the record after reunion.
Reuse current available/crush → dating → exclusive asks and deterministic gates; crossing a score threshold only makes commitment askable, and does not imply consent to intimacy.
Broken relationships stay socially reachable; an engine-validated repair outcome reopens dating without restoring exclusive status or erasing the scar/history. Repair action/gates await the report's owner answer.
Separate strain recovery from reconciliation; clear the obsolete commitment agreement on breakup and require fresh agreement on reunion. Warning timing and scar tuning await owner answers.
Use state plus the existing interpreted action or authored event for judgment; keep the single model call per turn. Do not import rp-master's real-time timeout or physical milestone requirements.
Full: custom commitment rungs, authored repair scenes and warning cues, coordinated graph/rank/arc gates, NPC pair parity and secrecy/exposure integration; stage UI and narration show current status alongside breakup history.
Implementation acceptance: test ladder gates, every breakup path, exactly-once scar application, save/reload, repeat breaks, reachable repair, retained history, renewed agreements and affair eligibility with existing boundaries intact.

## Fun rubric notes (agency, surprise, payoff, repetition)
Agency: expose the next ask and why it is unavailable; rejection today is not a permanently closed route.
Surprise: use witnessed consequences and character-authored reactions; stages alone never invent character choices.
Payoff: a reunion acknowledges the hurt and renewed commitment rather than resetting the relationship.
Repetition: scar application must not repeat on bookkeeping events; repair must not become an apology-spam shortcut.
