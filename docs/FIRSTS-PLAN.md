# O1 free-typed firsts plan

Goal: the firsts on each heroine's ladder (talk, date, kiss, first night) stop being a menu of three choices. The player types, as in any other scene. The engine holds 2–3 checkpoints. At each checkpoint she gives a cue, and the player's typed acts are scored against it. The milestone, gallery unlock and consent rules stay exactly as they are today. Code owns the numbers, and the model only tags acts and narrates. Roadmap: [NEXT-MILESTONES.md § Open-play tier](NEXT-MILESTONES.md#open-play-tier-2026-09-30).

## Owner calls (2026-09-30)

- **Free-typed with checkpoints** is the default for firsts. This was the owner's first pick in the freedom interview.
- **Authored stays as a creator option.** Some worlds want more structure. `firsts: 'free' | 'authored'` is set per world, and a heroine's rung can override it (`rungs.kiss.mode`). `authored` builds today's choice scenes unchanged (`first()` / `night()` in `world-assembly.mjs`).
- **Reading her right is scored from act tags**, on the same best/light/miss scale the authored choices use (`TONES`, `NIGHT` in `beat-library.mjs`), so both modes pay the same.
- **Consent doesn't move:** the scene opens only when the gates pass (the same trigger events), the first-night check-in is required and held by the engine, and Stop is always there.
- **Routes never close:** a failed or stopped first can be tried again later. It never locks the rung.

## How a free first plays

1. The trigger fires (the same `RUNGS[rung].event`/`match` as today). If the player is in a scene with her, the first goes live at once. If not, it's offered on the hub or phone ("Jana — the moment's right"), and taking it opens a focused scene with her.
2. The scene opens with her drafted opening line, and the first checkpoint's cue goes into the narrator brief.
3. Each typed turn is priced as usual (`social.priceActs`). The first module then reads that turn's priced acts and scores the current checkpoint:
   - **best:** an act of a kind the checkpoint wants, priced `liked`;
   - **light:** anything else that landed or was neutral;
   - **miss:** any act priced `disliked`, or any `pushy`.
   - A best or miss resolves the checkpoint at once. Otherwise it resolves as light after 2 inputs, so the player can't stall or fish.
4. When the last checkpoint resolves, the rung flag is set (as today, in every outcome), the CG unlocks, and the end card shows one line per checkpoint ("She noticed you remembered the record", "You rushed it").
5. Scene budget: 2 inputs per checkpoint at most (4–6). Extending the scene comes in O3 (the clock).

## Checkpoints per rung

Shapes live in code in `beat-library.mjs`, next to `RUNGS`. The creator only writes her cue for each one.

| Rung | Checkpoints (wanted act kinds) | Pays like |
|---|---|---|
| talk | **opening up**: she brings up something of hers (listen, compliment) → **your turn**: she asks you something back (tease, flirt, listen) | `TONES` |
| date | **arrival** (compliment, gift) → **noticing her**: one of her likes comes up (listen, compliment) → **the moment** (invite, touch, flirt) | `TONES` |
| kiss | **reading the moment** (listen, compliment) → **leaning in** (touch, flirt; a miss earlier in the scene makes this one harder: only best counts as best) → **after** (tease, listen) | `TONES` |
| first night | **lead** (touch, flirt; pushy = the `rush` values) → **check-in** (*required*: `ask`, or a yes to her own check-in question; the scene can't move on without it) → **peak** (touch, flirt, listen; completes the intimacy) | `NIGHT` |

A best that hits one of her preferences also gives `discoverPreference`, as today's authored `discover` choices do. Shown as a hint once O6 lands.

## Consent and safety (unchanged rules, new plumbing)

- The trigger is still `social.intimacyStarted` for the night, so consent is already in state before any prose.
- **Check-in:** the peak brief isn't sent until the check-in resolves. A new act kind, `ask` ("asking her what she wants, checking in"), is added to `ACT_KINDS`. It's useful beyond firsts.
- **Stop:** a Stop button stays visible for the whole scene. It applies the same effects as today's authored stop (`intimacyConsent` withdrawn, `STOP_TRUST`). Typed stops ("stop", "wait", "slow down", "not tonight") trigger it through a deterministic keyword floor, as `typedListen` does, so they don't depend on the model.
- **Pushy at night** is scored as a miss, and it ends the first as a remembered rejection (the existing hard rule), without completing it. The rung can be tried again later.
- The intimacy lint and `intimacyGate` are untouched.

## Pack shape

- **A new module, `social.firsts`.** It mirrors the confrontation pattern from M4 (module state plus a brief when live, with the engine pricing the model's tags).
  - `pack.firsts[]`: `{id, character, rung, trigger:{event, match}, title, opening, checkpoints:[{id, cue, discover?}], cg?, interest?}`. Checkpoint ids must match `FIRST_CHECKPOINTS[rung]` in order; `discover` is one of her dating preference ids (paid on a best); `interest` (night only) is an intimacy interest id learned at the lead; `cg` is an `assets/…` image. One first per heroine per rung.
  - State (`modules['social.firsts']`): `{active:{first, checkpoint, inputs, verdicts:[{checkpoint, verdict, reason}], sources[], startedTick}|null, offers:[{first, after}], completed:[], history:[{first, outcome, verdicts, tick}]}`.
  - Commands: `social.startFirst({first})` (from the hub offer; she must be here, and for the night the intimacy must be active), `social.scoreFirst({source, text?})` (recorded after `social.priceActs` with the same `source` turn id; reads that turn's `social.actPriced` events, so replay never calls the model; idempotent per source), and `social.stopFirst()`.
  - Events: `social.firstStarted {first, character, rung, title, cue, text:opening}`, `social.firstCheckpoint {first, character, checkpoint, verdict, reason, cue?:next cue}`, `social.firstCompleted {first, character, rung, title, verdicts, tone?, cg}`, `social.firstStopped {outcome:'stopped'|'abandoned', why:'button'|'typed'|'consent'|'the scene ended'}`, `social.firstRejected`.
  - Exports: `firstBrief(state, pack)` → `{first, character, rung, title, checkpoint, step, of, cue, waitingFor, required}` for the narrator brief; `typedStop(text)` and `typedYes(text)` floors.
  - Scoring reads her profile entry's sign when an act matched one, not the priced verdict, so the scene point cap can't turn a late liked act into a light.
  - A trigger firing while she is here (and, for the night, intimacy is active) starts the first at once; otherwise it's offered. Any stop, rejection or scene end puts it back on offer (`after: tick+1`).
- **The assembler** (`world-assembly.mjs`): `free` mode emits a `pack.firsts` entry. `authored` mode emits today's `scriptedScenes` entry. A pack can mix the two across heroines and rungs.
- **Validation:** `free` needs the opening plus one cue per checkpoint. `authored` needs today's choices. The night must keep its check-in checkpoint (the creator can't remove it).
- **Narrator brief** (`service.mjs`, next to the confrontation brief): `context.first = {rung, cue, waitingFor}`, where `waitingFor` is private, like the likes brief. It adds one rule: "stay in this moment, don't skip past it". The acts rule gets `ask`.

## Build order

1. **Check the entry path.** *(Done 2026-09-30.)* Confirm how the hub's talk opens a focused scene, and reuse it for `social.startFirst`. Confirm that `social.priceActs` events are readable in the same turn's `on` handler.
2. **Engine** *(done 2026-09-30, `packages/modules/firsts.mjs`)*: `social.firsts` module, checkpoint shapes in `beat-library.mjs`, scoring, Stop, the typed-stop keyword floor, the `ask` act kind. Tests in `tests/firsts.test.mjs`:
   - each verdict maps to the right `TONES`/`NIGHT` effects;
   - a checkpoint resolves as light after 2 inputs;
   - the night can't reach the peak without a check-in, including typed attempts to skip it;
   - Stop and typed stop withdraw consent at every checkpoint;
   - pushy ends the first without completing it, and it can be retried;
   - the flag and CG are set on completion;
   - replay is identical.
3. **Assembler plus the mode setting** *(done 2026-09-30, `world-assembly.mjs`)*: `firsts` per world and `rungs.<rung>.mode` per rung. `authored` output stays byte-identical to today (the existing `world-structure` tests prove it).
4. **Prompt** *(done 2026-09-30, `firstBrief` in `service.mjs`, `tests/firsts-service.test.mjs`)*: `context.first` brief and the acts rule update. A mock-provider test: a typed kiss scene goes from start to completion.
5. **Play UI** *(done 2026-09-30, `public/firsts-ui.mjs` and `public/play.mjs`)*: the hub/phone offer, a checkpoint progress hint (dots, no numbers), the always-visible Stop, and per-checkpoint end-card lines. The play view keeps the typed narration across internal scoring turns and shows the next authored cue. Completed free firsts unlock their CG in the gallery and replay stored text without model calls.
6. **Creator** *(done 2026-09-30, `public/creator.mjs`, `world-draft.mjs`)*: the wizard's firsts step asks for the mode, then drafts cues (`free`) or choices (`authored`). `world-draft.mjs` plus `specFromPack` round-trip.
7. **Campus** *(done 2026-09-30 except the owner's cloud play; 16 firsts, 44 cues, `scriptedScenes` empty, `story.scenes` kept)*: switch campus to `free`, rebuild through the assembler, and run `npm run validate` and a playtest. The owner plays a typed kiss and first night on a cloud model.

## Done when

- The owner plays a kiss and a first night typed, and they don't feel on-rails.
- No test path reaches the peak without the check-in, or keeps going after a stop.
- An `authored` world builds and plays exactly as before.
- The first romantic payoff still lands within 15 minutes (fun gate).
