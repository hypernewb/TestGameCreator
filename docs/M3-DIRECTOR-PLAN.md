# M3 director plan

Goal: the director keeps a run moving. It deals events, obstacles, goals and temptations that react to how the player plays, and it never goes quiet for long. Code owns the beat shapes. The cloud drafter only writes their text.

## Owner calls (2026-09-30)

- A code library plus drafted text. The world creator never designs beats.
- Roles are love interests only (`{lead}`, `{rival}`). There are no invented rivals.
- At most 1 quiet daypart. After that the director steps in.
- Invites and goals arrive by phone. Trouble (obstacles, temptations) lands in-scene.
- The tone ceiling is set in the creator: grounded, soap (default) or melodrama.

## Layers

| Layer | File | Owner | What it holds |
|---|---|---|---|
| Library | `packages/cards/director-library.mjs` | code | 12 beats: invite, hand, crowd, bad-day, saw-you, rumor, showdown, promise, big-night, spark, late-text, close-call. Each has a kind, tone 1–3, roles, trust gates per role, choice tones per role, phone or in-scene delivery, and goal deadline and cost. Also `DIRECTOR_PROFILE` (quiet dayparts, jitter, caps). |
| Text | `spec.director.beats.<id>` | drafter + owner | Title, opening, phone text, choice label and result, and the kept scene for goals. `{lead}` and `{rival}` stay literal. |
| Bake | `withDirector(pack,{beats,tone})` → `bakeDirectorTemplates` | code | Casts every beat over every heroine pairing. Every scene carries `template` provenance. Phone messages trigger on `story.directorDealt`. Beats with more roles than the cast has are left out. |
| Runtime | `story.director` (F8 timing core) | code | Adaptive dealing: quiet → drama, one-heroine focus → rival and temptation beats, capped by `toneCeiling`. |

## Drafting

- Creator worlds: `draftWorld` batches the director slots as `director:<kind>`, after the heroines. Each batch prompt carries `DIRECTOR_NOTE` (write the roles literally, never name one).
- The creator wizard shows them as "Director · <kind>" cards and a review group.
- Hand-built packs: `node scripts/draft-world.mjs --director [grounded|soap|melodrama]` drafts only the beats and writes `packs/director/<pack>.json`. `readPack(file)` bakes that file in at load (server and `ai-game-tester`), so the pack file itself stays untouched.

**Campus draft (2026-09-30):**
- Soap tone: valid, 0 blank slots, 4 calls, 7.7k in / 8.4k out tokens ≈ $0.012, 52 s.
- No names leaked. Choice wording matches its tones.
- Some phone texts came back with a `{lead}:` sender prefix. The bake strips it, and the hint now asks for no prefix.

## Acceptance (done)

- Seeded campus runs never leave more than 1 quiet daypart without a director beat (`tests/director-library.test.mjs`).
- Every director scene has template provenance. Campus loads with 48+ drafted director scenes and no unfilled roles.
- Play style changes what the director deals. Courting one heroine draws rivals and temptations around her.

## Early game

Campus starting trust: Jana 30, the others 10–15. On day 1, invite, hand, bad-day, promise, big-night and spark (Jana leads) are all eligible, so the gates stay as they are.

## Open

- A live local-model playtest of director beats: they are authored scenes, so this checks feel, not prompt size.
- Whether the `after-hours` fixture ever gets the library. Not planned, since that pack is retired.
