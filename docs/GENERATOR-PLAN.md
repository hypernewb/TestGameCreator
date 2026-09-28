# Game creator and bulk generator plan

Status: approved 2026-09-29. Work in order 1 → 7. Done: 1, 2, 3, 4 (director slots deferred), 5, 6.

After step 1, a live HUNTR/X rerun (same settings as below) dropped from 13 warnings to 3; all three are timed events overlapping in different places. Step 3 baseline (the three step-1 proposals, 120 turns, both bots): dead 55–70%, hand 0–0.3 per daypart, 6/6 new scenes played, no payoff, no ending; the pack alone is 79% dead. More loose scenes will not reach the 2–4 target, which is why step 4 matters. Steps 1–3 make the generator measurable; step 4 is where a card starts turning into a game.

Step 4 result (`route --route rumi,mira`, same bots): dead 18% / 27% / 35% for 3 / 7 / 14 days, hand 3.05 / 1.97 / 1.74 per daypart, 14/14 route scenes played, an ending reached in every finished run, 0 errors. Two love interests on 14 days sit just under the hand target. A live qwen 9b run fills both routes' prose in one request each (~30 s) with no placeholder slots, but the RP-tuned 9b runs ahead of the ladder (touching on the flirt rung); the prompt states the pacing rule, repeated lines count as missing, and the author reviews prose before approving. Details in `docs/AI-BULK-AUTHORING.md` (Romance routes).

## Diagnosis

The engine plays like a dating sim since F1–F12: a hand of storylets per daypart, stat checks that fail forward, a director deck, romance ladders, run length and endings. The generator still writes what the engine did before F1: loose trigger scenes and people. A card becomes a world with things in it, not a game with a loop, a goal and endings.

What a live HUNTR/X run shows (3 runs, qwen 9b, 2 locations, 3 characters, 6 scenes, 3 events):

- every run lands a proposal, but it has 13 warnings;
- scenes pile onto the one or two interesting places, so triggers collide;
- speakers are placed where they don't live, so their scenes never fire. The engine requires every page speaker to be at the player's location, and a `show:` cue is only visual;
- nothing is a hand card, a check, a director offer, a ladder rung or an ending.

## Rule of thumb

The engine owns structure; the model owns prose. Anything with ids, gates, numbers or pacing is built by code and validated. The model fills text slots and picks from pinned enums. (Borrowed from Ink/Inkle's "structure first", Failbetter's storylet authoring, and Hades' deterministic gating around authored lines.)

## Steps

1. **Quick normalizer wins.**
   - (a) A scene whose speakers all live at one other place (no schedule) moves there, keeping its trigger kind. Speakers split across places cannot meet: strict fails, the repair drops the scene. `check` stops suggesting `show:`, which does not bring anyone.
   - (b) *(superseded by step 2)* When both triggers at a place are taken, an extra scene becomes a hand card at that place (`offer:"hand"`, `story.handOffered`, `when.location`), instead of a back-to-back pile.
2. **Hand cards by default.** Generated scenes default to hand cards (Persona's social links, Stardew's heart events, Fallen London's storylets); an auto-trigger is kept only for one engine-assigned intro per place (the first new scene at a place where nothing fires by itself yet). The hand shows one casting per template at a time. `--templates N` drafts role-slot templates (`packages/cards/role-slots.mjs`).
3. **Measure fun, not just validity.** The robustness script applies each proposal and runs the persona bots: dead turns, hand offers per daypart (target 2–4), time to first payoff, reachable endings.
4. **Route skeleton** (`packages/cards/route-skeleton.mjs`, authoring time). Per love interest a ladder (flirt → charged → kiss → night → repeat) as gated hand cards, one check, a `run` block, endings and director slots. The model only fills prose. `--route rumi,mira --days 14`. (Tokimeki's calendar and endings, Monster Prom's short run, Hades' gifts ladder.)
5. **Checks and tastes.** Checks against the pack's `statDefinitions` with a required fail branch (the normalizer drops a check without one); chemistry effects carry a `reason`; tastes come from the card's likes and dislikes (Stardew's loved/hated gifts).
6. **Studio review panel.** Per-entry regenerate, inline warning fixes, a route grid and a calendar heatmap, card import/export buttons (Twine's story map, Ren'Py's lint). `packages/ai/proposal-review.mjs`, `/api/studio/proposal/{review,regenerate,apply}`, and the **Review AI drafts** and **Character cards** sections.
7. **Intimacy drafts.** Intimacy profile and 5-beat encounters; the engine inserts a stop choice at every beat; the adult flag and boundaries are set by the author and never auto-approved.

## Not doing

- Letting the model write ids, gates, numbers or schedules freehand.
- One giant prompt for a whole game; each step stays small enough for a 9b model on the `minimal` preset.
- Runtime generation: the AI runs at authoring time; campaigns stay deterministic.
