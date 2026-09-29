# Handoff: lane B, engine modules (acts, arc, sobriety)

You are one of three AI agents working **in the same checkout at the same time**. Read these first, in order:
1. `CLAUDE.md`: commands, code style and safety rules.
2. [M0-CONTRACT.md](M0-CONTRACT.md): the shapes you must implement, and the file-ownership table. **It is binding.**
3. `docs/GAME-DESIGN.md`, the "What the model writes" and "Relationships and the change arc" sections, for the why.

## Goal
Build three deterministic engine modules. The model tags what the player did in a free-typing scene; your modules turn those tags into affection, money, calendar plans, character change and sobriety. Nothing here calls a model.

## Files you own (edit nothing else)
- New: `packages/modules/acts.mjs`, `packages/modules/arc.mjs`, `packages/modules/sobriety.mjs`
- New: `tests/acts.test.mjs`, `tests/arc.test.mjs`, `tests/sobriety.test.mjs` (split further if you like, keeping those prefixes)
- New: `docs/SOCIAL-ACTS.md`: a short creator-facing reference for the three pack blocks
- `packages/modules/index.mjs`: **only** add imports, registry entries and `descriptions` lines for your three modules
- `packages/contracts/index.d.ts`: **only** append types for your pack blocks and events
- `packages/modules/romance-tempo.mjs`: **only** change line 43 `function addPoints(` to `export function addPoints(`

If you need anything else changed (engine, service, packs, another module), add a line under "Requests" in M0-CONTRACT.md and tell the owner. Don't edit it yourself: another agent owns it and may be editing it right now.

## Work, in order
1. **`social.acts`** (M0-CONTRACT §1). Start here, because lane A is blocked on it.
   - Command `social.priceActs`: filter acts (closed kind list, at most 4, target ≤40 chars lowercased, size default `small`), match against `actProfiles`, apply `sizeMultiplier`, `repeatDecayPercent` (same entry, same calendar day) and `sceneCap`, then call `addPoints` from romance-tempo.
   - Emit `social.actPriced` for every act, and `social.actDiscovered` the first time an entry matches.
   - An entry's optional `memory` string: emit it in the event payload as `memory`. Lane A decides whether to store it. Don't write memory yourself.
   - Exports: `actProfileOf`, `knownActs`, `narratorBrief`, `sceneVerdicts`.
   - `validate(pack)` must reject a profile for an unknown character, unknown kinds, duplicate entry ids, and a missing `reason`.
2. **`buy:` and `invite:`** (still §1). For `buy`, look at `economy.mjs` for how money is charged and `inventory.mjs` for transfers. The gift reaction then flows through romance-tempo's existing gift handler, so check that you don't double-count: a bought gift should be priced by the gift preference **or** the act entry, not both. Pick one, test it, and document it. For `invite`, `social.mjs` already has `parseInvite` / `inviteDecision` (see `tests/invitations.test.mjs`) and `phone.mjs` has invites. Reuse them rather than building new calendar state.
3. **`character.sobriety`** (§3). It's small. `sobrietyOf` must be a pure function of state. Decay hooks into the daypart advance: find the event the daypart and calendar modules emit and use `react`.
4. **`character.arc`** (§2). Drift reacts to `social.actPriced` (the `act` rule) and to any named event (the `event` rule). Stages use the existing condition language in `packages/modules/conditions.mjs` if it fits; otherwise use a plain threshold map. Flags go wherever `when.flags` already reads them (grep `flags` in `conditions.mjs`).

## Style
- Match the existing modules: dense one-liners, short names, few comments. `moments.mjs` (11 KB) and `romance-tempo.mjs` are good templates for runtime state, `react()` and events.
- Module shape: `{id, version, coreApi:'0.1.0', requires, init(pack), validate(pack), commands:{...}, react(tx,event), actions(...)}`. Copy it from a neighbour, don't invent one.
- State changes only happen inside commands and `react` via `tx.set` and `tx.emit`. Exports are pure readers.
- No new dependencies. Don't touch `package.json`.

## Tests (required)
Build a tiny inline pack in each test file, following `tests/romance-tempo.test.mjs` and `tests/moments.test.mjs`. Don't depend on `packs/campus.json`, since lane C is still building it. Cover at least:
- a liked act adds points with the entry's reason; a limit subtracts; an unmatched act falls back to the clamped `landed`/`missed` value;
- specific target beats `'*'`; `when.private:false` only fires when the scene isn't private;
- the rank ceiling caps points, so a big flirt can't jump a rank; the scene cap holds; repeat decay applies on the same day and resets on a new day;
- garbage input (unknown kind, 10 acts, a 500-character target, a missing character) does not throw and does not change points;
- `buy:coffee` with money bills once and prices once; without money it gives `verdict:'unpaid'` and no points;
- an invite creates a plan; missing it costs points;
- sobriety goes sober → tipsy → drunk with drinks and decays per daypart;
- arc: traits drift, a stage is reached once and only forward, and its flag is set;
- **replay:** run the same commands twice from a fresh world and assert that `state` is deep-equal.

Run `npm test 2>&1 | tail -15` and `npm run validate`. A failure in a file you don't own is another lane's in-progress work: report it, don't fix it.

## Rules
- Don't commit unless the owner asks. When asked, `git add` only your own paths.
- Never open `data/ai-settings.json`. Use `:memory:` DBs in tests.
- Characters are adults. The intimacy consent gate belongs to lane A. Your sobriety export only reports state, and a stage never grants consent.

## When you're done
Reply with: the files changed, the test count before and after, any contract deviations (and add them to M0-CONTRACT.md "Requests"), and open questions.
