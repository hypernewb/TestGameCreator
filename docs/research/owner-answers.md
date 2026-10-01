# Owner answers (newest first, one line each)
Big picture: every mechanic choice should become a per-world option in the game creator; ship the simplest mode first.
- 2026-10-01 Scene feedback: show both stat-delta chips and a short mood line; creator option to hide either.
- 2026-10-01 Unwelcome flirting: the reaction depends on her personality (deflect / tease back / shut down), with matching stat changes.
- 2026-10-01 Character sheet: full rp-master depth (schedule, gift tastes, touch preferences, behaviour rules, social links, etc.).
- 2026-10-01 Leaving: she cues ("I should get to class"), you get 1–2 turns for a last move, then she leaves; no penalty unless you were rude.
- 2026-10-01 Day loop: clock-only is the ideal; a day-planner screen is fine for this iteration if it's simpler to playtest. Make it a creator option (clock | planner).
- 2026-10-01 Repeat flirting: boredom stat is the ideal; ship a daily cap first (fits the +6/day Like/Trust cap). Creator option (cap | boredom).
- 2026-10-01 Breakups: stages exist; a breakup leaves a lasting stat scar but is repairable, so routes never fully close.
- 2026-10-01 Judging (aftercare, rapport): no extra AI calls; the engine judges from state plus the turn's interpreted action. One call per turn stays.
- 2026-10-01 Personality: closed trait list (2–4, engine-readable) + free notes for the AI.
- 2026-10-01 Gifts: liked/disliked categories per heroine.
- 2026-10-01 Touch prefs: full rp-master body-region map (sensitivity + limits per region).
- 2026-10-01 Sheet rollout: all fields now (creator tabs) + AI "Suggest" auto-fill from seed words; wire mechanics system by system.
- 2026-10-01 Chips: romance (Like/Trust/Lust) + player stats + money; hidden stats never shown; chips last until the next turn.
- 2026-10-01 Mood line: 5 tiers with rp-master wording, one line per heroine present, updated in place.
- 2026-10-01 Flirt cap: 3 attempts/heroine/day; every attempt counts; after the cap, talk continues with 0 positive gains (negative reactions still apply).
- 2026-10-01 Leaving cue: 2 player turns after her cue, then she leaves.
- 2026-10-01 Rude exit: per-heroine rules on her sheet (what she finds rude + her reaction); no universal penalty.
- 2026-10-01 Stages (campus): acquaintance → dating → exclusive.
- 2026-10-01 Breakup scar: one-time −10 Trust, −10 Chemistry, recoverable; breakup always remembered.
- 2026-10-01 Strain: 2 in-game days of visible strain before an engine breakup; authored breakups separate.
- 2026-10-01 Repair: after 2 in-game days, rapport back to a set level, plus a reconciliation scene she accepts; restarts at dating.
- 2026-10-01 Planner: campus default = planner; 3 slots/day (morning/afternoon/evening), one activity each; ending a chat doesn't end the day in planner (still does in clock).
- 2026-10-01 Mood math: by size of change, score bands ≥8 / 3..7 / −2..2 / −7..−3 / ≤−8, privacy/sobriety refusals push down, hysteresis so it doesn't flicker.
- 2026-10-01 Sheet extras: adult history = free text + structured experience field (usable for firsts); behaviour rules = engine event→condition→effect rows + prose notes; Suggest = full draft from 3 seed words, per-field review, owner always picks consent/limits/intimate choices.
- 2026-10-01 Mood score: Trust change + 3×Lust change; privacy/sobriety refusal −3; hysteresis 2 (must pass a band edge by 2); every heroine starts at the middle tier.
- 2026-10-01 Repair gate: per heroine (each sheet sets her own rapport bar for reconciliation).
- 2026-10-01 Planner slots: 1 activity = 1 slot, including travel and the conversation.
- 2026-10-01 Sheet lists (traits, gift categories, experience levels, body regions/sensitivity): a worker drafts from rp-master + Venus, owner approves before the T-009 build.

## Batch 8 (2026-10-01, Heartmorrow + RisuAI digests)
- 2026-10-01 Hidden daily need: rerolls once per day per heroine.
- 2026-10-01 Same-day gift repeats: 1 / 0.5 / 0 (replaces current damping, no stacking).
- 2026-10-01 Heroine texts: authored triggers only (neglect, stage change), max 1/day.
- 2026-10-01 Anniversaries: every 28 game days, with a callback memory.
- 2026-10-01 Lore scan window: last 4 messages.
- 2026-10-01 Lore chaining: only creator-declared links (explicit IDs), no automatic recursion.
- 2026-10-01 Memory split: 50% recent / 50% important.
- 2026-10-01 Player persona: set at creation only, locked after.
