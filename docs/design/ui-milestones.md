# UI milestones

Source: [owner research, 2026-10-01](../research/UI%20research%202026%2010%2001.txt). Order follows [NEXT-MILESTONES](../NEXT-MILESTONES.md#order); feedback follows the decided [scene-feedback card](scene-feedback.md). Browser files below were inspected; server contracts were not audited in this docs-only ticket. Research code snippets are proposals, not verified contracts.

## Look and feel

The research wants a readable, polished visual novel wrapped in a living campus: expressive characters on a stage, effortless reading and saving, visible consequences, and clear ways to find people, messages, activities and upcoming commitments. Keep the copper/brass/ivory-on-walnut identity and free typing, but make controls discoverable, accessible and usable on narrow screens. Richer relationship, map, phone and calendar views should expose what the player has learned and what the engine allows. Authoring should eventually offer connected scene views, a cast bible, previews and asset tools without abandoning the local-first, no-build browser architecture or making Campus assumptions mandatory for other worlds.

## Verified gaps

Paths are relative to the repository root. “Missing” below means absent from the inspected browser surfaces, not proof that the engine lacks the underlying feature.

| Research idea | What exists today (file) | Gap / milestone |
|---|---|---|
| Shortcut help, activity tooltips, tone badges, choice previews | `public/play.mjs`: Space continues; activities already show descriptions/yields and locked reasons. `public/creator.mjs`: tone badges in review. | Help and consistent keyboard/focus/touch hints; player badges require supported metadata. Exact outcome previews need an owner decision (UI1). |
| Always-visible goals / event hints | `public/campus.mjs`: `goals()` gives next-first hints in words; `public/play.mjs`: goals at bottom of hub. | Pin a known goal while reading; no need to replace this with numeric hidden gates (UI2, UI6). |
| Live consequences / visible progression | `public/scene-feedback.mjs`, `public/play.mjs`, `public/app.mjs`: chips and mood rows already render; `public/studio.mjs`: independent `pack.sceneFeedback.chips/mood` toggles. | Verify presentation against the decided card and reuse it, rather than commission another judge (UI2). |
| Text speed, auto delay, ADV/NVL, per-line click skip | `public/play.mjs`: whole line via `textContent`, fixed 3-second Auto. `public/vn.mjs`: configurable auto delay, text size, click advance and read-page skipping. | Play preferences parity; neither inspected renderer has typewriter or NVL. Instant-reveal applies only if typewriter is added (UI3, UI11). |
| Accessibility suite | `public/play.html`: font choice/upload and live regions. `public/vn.mjs`: contrast, reduced-motion preference, text size. `public/ui-showcase.css`: disables transitions for system reduced motion. | Bring existing controls to play; spacing, complete animation suppression, focus/announcements and optional self-voicing (UI3, UI10). |
| Thumbnail save/load | `public/play.mjs`: server checkpoint create/list/restore, turn/date labels; `public/play.html`: menu and Load dialog. | Direct buttons and richer metadata; no thumbnail slot bar. Images can be a browser cache, while checkpoints remain authoritative (UI4, UI9). |
| Sprite expressions and transitions | `public/campus.mjs`: `poseFor()` uses reaction poses. `public/play.mjs`: rebuilds up to three portraits each page. `public/ui-showcase.css`: entrance animation and speaking brightness. `public/vn.mjs`/`public/vn-stage.mjs`: authored stage actions/cast filtering. | Stable sprites, cross-fades and play-stage parity, rather than a new expression system from scratch; layered faces/Live2D are later (UI5, UI20). |
| Visual relationships / stat growth | `public/app.mjs`: portrait cards, stage, availability, hearts/teaser and stats. `public/play.mjs`: Status text panels and heart strings; `public/campus.mjs`: Journal has discovered preferences and arc stage. | Bring cards to play and combine learned clues with visible progression; show thresholds only where already public (UI6, UI12). |
| Map / fast travel | `public/campus.mjs`: place view models with people/activities/closed reasons; `public/play.mjs`: place cards and movement buttons. | Optional spatial view and filters reusing legal travel actions, not unrestricted fast travel (UI8). |
| Dedicated phone | `public/campus.mjs`: threads, replies, offers and unread counts; `public/play.mjs`: Phone tab with unread badge and engine action buttons. | Dedicated view, contacts and navigation; unread notifications already exist (UI7). |
| Calendar / weekly scheduling | `public/calendar.mjs`: date/week/day calculation, **three** periods (Morning/Afternoon/Evening). `public/planner.mjs`: today's slots and activities. `public/studio.mjs`: clock/planner choice and calendar configuration. | Month/agenda visualization; weekly commitments and conflicts are new mechanics, not a fourth-period UI tweak (UI12, UI13). |
| Cast bible | `public/creator.mjs`: editable proposal/profile cards. `public/sheet-editor.mjs`: ten tabs covering voice, tastes, routine, relationships, arcs and lore. | Consolidated navigation/cross-references/export; several sheet fields explicitly say pending integration or stored only (UI14). |
| Variables / reference inspector | `public/studio.mjs`: variables, reference select controls, conditions/effects forms, some advanced JSON; playtest reports include prerequisite and path diagnostics. | Creator review lacks a unified read/write index; safe refactoring and remaining JSON replacement (UI15). |
| Scene graph / scene canvas | `public/creator.mjs`: grouped review cards. `public/studio.mjs`: scene/beat/page forms and text graph diagnostics. | Read-only connected overview first; bidirectional editing later. Dragging layout must not regenerate stable IDs (UI16, UI20). |
| Integrated playtesting | `public/studio.mjs`: runs deterministic routes inline and shows coverage/findings; `public/studio-preview.mjs`: composition previews already embedded in scene cards. | Link findings to editable scenes, graph overlays and validated launch state; no need to build the existing report again (UI17). |
| Asset workflow | `public/studio.mjs`: uploads, portrait preparation, automatic 16:9 background cropping/resizing and pose editor. | Usage index, selectable crop/safe zones, sprite slicing and later audio editing (UI18, UI19). |
| Audio / timeline / advanced motion | `public/studio.mjs`: text stage-action arrays; `public/vn.mjs`: optional synthesized advance cue. | Authored media playback/mixer, sequence editing, easing, particles and optional rigged sprites (UI19, UI20). |
| Tokens / reusable components / state store | `public/ui-showcase.css`: existing root palette/font/timing variables. `public/play.css`: additional styles. `public/play.mjs`: dense functions and module-local state (117 lines here, not research's 1100+). | Incremental shared tokens/components where needed; no evidence requiring framework migration (UI10, UI21). |
| Publishing / localization / user packs | `public/studio.mjs`: publish plus project JSON import/export including uploaded portrait/background/pose media. | Translation workflow, complete dependency packaging and standalone/offline release; existing JSON export is more than campaign save (UI22, UI23). |
| NG+, expanded campus and peer-game mechanics | `public/play.html`: saved-campaign picker and Gallery; `public/planner.mjs`: daily planning; `public/sheet-editor.mjs`: authoring slots for routine/arcs. | Carryover, new rewards, difficulty, clubs/exams/home systems and narrative variants require separately approved mechanics/content (UI24). |

## Ordered milestones

S = bounded presentation change; M = several linked surfaces; L = new authoring workflow or engine contract. These are relative sizes, not week estimates. Each thin slice is the first ticket; the remainder can be briefed separately. Proposed new browser files are marked “new”; engine work needs a follow-up brief that explicitly lists its files.

UI1–UI5 are cheap support for O2/C1, not a replacement for those priorities or extra prerequisites for v1. Run the campus fun gate after C1; UI8 onward follows a passed gate. Creator polish stays later except a field needed by an active C1 ticket. All future behavioral changes need tests; this ticket changes only documentation.

### UI1 — Find controls and understand options
- **Player goal:** I can find History, save/load and the next action without trial and error.
- **Scope:** `public/play.html`, `public/play.mjs`, `public/play.css`, `public/campus.mjs`.
- **Thin slice:** Visible shortcut-help button and overlay documenting only working bindings; add History/Menu bindings outside editable controls. Make current activity hints available on focus/touch as well as hover.
- **Acceptance:** Keyboard and touch users reach help and History, return focus to the trigger, and still type/send unchanged. Hints match existing yields/lock reasons. Unsupported time costs or tone labels are omitted. Reserve shortcut names consistently; do not capture browser reload or Tab focus navigation.
- **Size / fit:** S / before fun gate. Tone badges can follow once actual choice metadata is verified; outcome previews await Q2.

### UI2 — Keep consequences and a known objective in view
- **Player goal:** I see what my action changed and remember what I am working toward.
- **Scope:** `public/play.mjs`, `public/play.css`, `public/campus.mjs`, `public/scene-feedback.mjs`.
- **Thin slice:** Pin one existing `goals()` hint in a collapsible row; verify the already-shipped feedback stays readable beside the reply on narrow screens.
- **Acceptance:** Chips survive paging/polling/retry until the next committed turn; named mood rows update in place. Hidden stats remain hidden, zero changes produce no chips, group scenes remain readable and both creator toggles work. Pinning creates no world state or model request. Follow the decided applied-delta math, five labels and hysteresis; positive mood does not grant consent.
- **Size / fit:** S / before fun gate. Fix only reproduced feedback gaps; do not rewrite its scoring.

### UI3 — Reading comfort in the main play screen
- **Player goal:** I can comfortably read a long session at my own pace.
- **Scope:** `public/play.html`, `public/play.mjs`, `public/play.css`, `public/ui-showcase.css`, `public/vn.mjs` (preference reuse/parity).
- **Thin slice:** Text-size and Auto-delay preferences, using existing classic VN behavior as reference; retain font upload.
- **Acceptance:** Preferences persist and apply immediately; Auto stops before choices/check-ins, when a modal opens or an action is busy. Add spacing/contrast and a reduced-motion override incrementally; CSS animations and the explicit dialogue animation both obey it. No automatic control commits an action.
- **Size / fit:** S / before fun gate. ADV/NVL and typewriter are UI11, not required here.

### UI4 — Save and recover without menu hunting
- **Player goal:** I can safely checkpoint before trying something and recognize the restore point.
- **Scope:** `public/play.html`, `public/play.mjs`, `public/play.css`.
- **Thin slice:** Direct Save/Load controls that call existing backup operations and announce success/failure clearly.
- **Acceptance:** Save, act, restore returns the same campaign revision/state; controls cannot double-submit while busy. Empty and failed backup lists are understandable; no unconfirmed overwrite of a named slot. Keep current server backups; use only metadata returned by the existing contract.
- **Size / fit:** S / before fun gate. Visual slots and IndexedDB thumbnails are UI9.

### UI5 — Make expressions feel continuous
- **Player goal:** She reacts visibly without appearing to re-enter on every line.
- **Scope:** `public/play.mjs`, `public/play.css`, `public/ui-showcase.css`, `public/vn-stage.mjs`, `public/vn.mjs`, `public/campus.mjs`.
- **Thin slice:** Preserve sprite nodes for unchanged characters; cross-fade existing pose images, with missing-image fallback.
- **Acceptance:** Paging unchanged cast does not replay entrances; authored hide/show and committed cast are respected, pose changes display once, speaking emphasis follows the speaker and reduced motion is immediate. Visual cues cannot add characters or alter replay/state.
- **Size / fit:** S / inside C1. Full layered expressions/rigging remain UI20.

### UI6 — A relationship view built from what I know
- **Player goal:** Day five feels different from day one, and I can name a next step for each heroine.
- **Scope:** `public/play.html`, `public/play.mjs`, `public/play.css`, `public/app.mjs` (reuse character-card presentation), `public/campus.mjs`.
- **Thin slice:** Portrait/stage/heart/teaser cards in Status using the existing `characters` response, with links to discovered Journal clues.
- **Acceptance:** Cards reflect committed progress, known likes/dislikes and allowed availability; private schedules, chemistry and undiscovered triggers never appear in bars/tooltips. The owner can describe a goal without consulting hidden numbers. Gift history/unlocked-scene links follow only where player-visible data exists; approval required for exact prerequisite or paid-hint mechanics (Q2).
- **Size / fit:** M / inside C1.

### UI7 — Messages feel like NPC initiative
- **Player goal:** I notice when someone reaches out and can answer without losing my place.
- **Scope:** `public/play.html`, `public/play.mjs`, `public/play.css`, `public/campus.mjs`.
- **Thin slice:** Dedicated Phone dialog reusing existing threads, unread badge and read/reply/accept actions; retain the hub entry.
- **Acceptance:** Opening a thread marks it read only through the existing action; replies/offers commit once; disabled offers keep their reason. Closing returns focus and the current dialogue page. Contacts expose only known relationship data. Gallery/map/journal links come after those views exist.
- **Size / fit:** M / inside C1. UI presents initiative; C1 supplies NPC behavior, with no invented messages.

### UI8 — See reachable places
- **Player goal:** I can find an open activity or someone nearby quickly.
- **Scope:** `public/play.html`, `public/play.mjs`, `public/play.css`, `public/campus.mjs`; `public/map-ui.mjs` (new, if extraction helps).
- **Thin slice:** Filters on current place cards: open, people, activities. Follow with an optional accessible node map (Q4).
- **Acceptance:** Map and list agree on allowed travel and closure reasons; one selection sends one existing command. Keyboard users get equivalent list navigation. No invented adjacency, bypassed time cost or private NPC tracking; packs without map layout keep a list.
- **Size / fit:** M / before F1, after fun gate.

### UI9 — Recognizable visual checkpoints
- **Player goal:** I recognize the moment I am about to restore.
- **Scope:** `public/play.mjs`, `public/play.html`, `public/play.css`; `public/save-thumbnails.mjs` (new).
- **Thin slice:** Add background/portrait composition preview for one checkpoint, cached in IndexedDB and keyed by campaign/backup ID.
- **Acceptance:** Two campaigns never share previews; missing media/quota/cache eviction leaves functional text restore; stale images cannot identify another backup. Later named slots depend on existing backup retention being verified and Q3, rather than storing mechanical state in browser thumbnails.
- **Size / fit:** M / before F1.

### UI10 — Accessibility and narrow-screen completion
- **Player goal:** I can finish a play session with keyboard, assistive technology or a small screen.
- **Scope:** `public/play.html`, `public/play.mjs`, `public/play.css`, `public/ui-showcase.css`, `public/vn.mjs`.
- **Thin slice:** Keyboard/focus/contrast QA across play, Phone, Status, saves and pinned goals; ensure choices and scene changes are announced once.
- **Acceptance:** At 200% zoom and a 360px viewport, reading/actions/Stop remain reachable; dialog focus returns correctly; reduced motion covers every added effect. Optional self-voicing can be stopped, uses available browser voices, never repeats on retries, and fails gracefully. A dyslexia-friendly bundled font requires license/asset verification; custom upload remains available.
- **Size / fit:** M / before F1. Studio accessibility is included when its later surfaces ship.

### UI11 — Optional VN reading modes
- **Player goal:** I can choose a reading layout that suits the story.
- **Scope:** `public/play.html`, `public/play.mjs`, `public/play.css`, `public/vn.mjs`.
- **Thin slice:** ADV/NVL preference showing the same committed pages in either layout.
- **Acceptance:** Switching modes loses no text, cursor, choices or typed draft. If Q1 approves typewriter, click first reveals the current line and only a subsequent click advances; Auto/skip stop at sensitive boundaries. Screenshot mode uses a dedicated control and restores UI with Escape; it never hides a required decision or Stop.
- **Size / fit:** M / later. Stronger backdrop blur/location fades are optional polish here, gated by readability and reduced motion.

### UI12 — Known commitments and visible growth
- **Player goal:** I see upcoming plans and understand why an activity matters.
- **Scope:** `public/calendar.mjs`, `public/planner.mjs`, `public/campus.mjs`, `public/play.html`, `public/play.mjs`, `public/play.css`.
- **Thin slice:** Read-only upcoming-plan agenda with current weekday/daypart; visible stat bars reuse existing public stats.
- **Acceptance:** Calendar navigation is read-only; due/kept/broken commitments use engine records and known events. Unknown birthdays, NPC schedules and future director scenes remain hidden. Month dots/details follow once their player-visible data is verified. Thresholds/diminishing returns display only authored public values, not guessed reward rules.
- **Size / fit:** M / later, with O3 when needed. If C1 supplies a new visible plan, a small agenda row can be briefed inside C1 without pulling in the full calendar.

### UI13 — Weekly planning, after the clock contract
- **Player goal:** I can make a week of commitments and understand conflicts before committing.
- **Scope:** `public/calendar.mjs`, `public/planner.mjs`, `public/play.mjs`, `public/studio.mjs`; engine/schema/test files require a separate listed brief.
- **Thin slice:** Read-only week built from existing three-period planner and confirmed plans. Editing starts only after O3/unit and scheduling decisions are settled (Q5).
- **Acceptance:** Approved edits are engine-validated for time/availability/resources; rejection gives a reason and leaves plans unchanged. Reload/replay preserves accepted plans. Do not add a Night column, drag-created dates, debug day jumps or stat gains as presentation shortcuts.
- **Size / fit:** L / later, dependent on O3 and approved plan mechanics.

### UI14 — Reuse the sheet as a cast bible
- **Player/author goal:** Characters stay distinct because I can find and review their established voice and history.
- **Scope:** `public/creator.mjs`, `public/creator.html`, `public/studio.mjs`, `public/sheet-editor.mjs`, `public/style.css`.
- **Thin slice:** Cast index linking existing profile/sheet sections and scenes containing that character; clearly label stored-only fields.
- **Acceptance:** Editing a supported voice field survives save/reopen; unsupported fields do not claim runtime influence. Add Markdown bible export and proposal-to-sheet reconciliation later with no duplicate character IDs or silent overwrites. AI drafting remains a reviewed proposal, not an automatic character rewrite.
- **Size / fit:** M / later; only a supported field needed for C1 may be pulled forward.

### UI15 — Find references before breaking them
- **Player/author goal:** My story's choices and conditions work as intended when published.
- **Scope:** `public/studio.mjs`, `public/creator.mjs`, `public/sheet-editor.mjs`, `public/style.css`.
- **Thin slice:** Read-only variables/flags/plans read/write index with links to existing scene fields; reuse current pickers/validation.
- **Acceptance:** A bad reference leads to its exact card/field. Rename comes in a separate slice with preview of every affected supported reference and atomic apply/cancel; ambiguous advanced JSON is flagged, never silently rewritten. Complete remaining typed forms and publish checklist incrementally.
- **Size / fit:** M / later (P1–P4 creator validation).

### UI16 — One scene graph across creator and Studio
- **Player/author goal:** I can understand the route I am building before playing it.
- **Scope:** `public/creator.mjs`, `public/studio.mjs`, `public/studio-preview.mjs`, `public/style.css`; `public/scene-graph.mjs` (new).
- **Thin slice:** Read-only beat/choice graph in Studio using current project references; clicking a node opens its form/preview.
- **Acceptance:** Edges distinguish immediate choice flow, waits and completed-scene prerequisites; authored/free/director types use text as well as color. An accessible list conveys the same links. Creator adapter follows without inventing cross-card paths. Layout dragging changes only layout, never IDs or story order.
- **Size / fit:** M / later. Editable canvas remains UI20.

### UI17 — Follow a playtest finding to its cause
- **Player/author goal:** I can fix a broken route without reconstructing the tester's path by hand.
- **Scope:** `public/studio.mjs`, `public/studio-preview.mjs`, `public/scene-graph.mjs` (from UI16), `public/play.mjs`, `public/style.css`.
- **Thin slice:** Link the existing inline coverage/findings report to scene forms; overlay counts on UI16's graph next.
- **Acceptance:** Findings select the correct scene and keep unsaved edits. Report-only work makes no model calls. “Play from here” waits for a separately verified engine launch/snapshot contract: the current play URL accepts a campaign, not a scene start. Generated test state never alters the player's campaign.
- **Size / fit:** M / later, after UI16 for graph overlays.

### UI18 — See where art is used
- **Player/author goal:** I can replace art confidently and frame it for the scene.
- **Scope:** `public/studio.mjs`, `public/studio-preview.mjs`, `public/sheet-editor.mjs`, `public/style.css`.
- **Thin slice:** Used/unused/missing image index across locations, portraits, poses and scene/page backgrounds/CGs.
- **Acceptance:** Every supported reference is counted; replacing an image updates only selected references and survives export/import. Add interactive crop safe zones over existing automatic 16:9 processing, then sprite-grid slicing with explicit pose names. Missing media previews safely and is reported before publish.
- **Size / fit:** M / later. Audio tools depend on UI19.

### UI19 — Authored audio with player control
- **Player goal:** Music and voice enrich the scene while I control what plays.
- **Scope:** `public/play.html`, `public/play.mjs`, `public/vn.mjs`, `public/studio.mjs`, `public/studio-preview.mjs`; media/schema/module/test files need a separate brief.
- **Thin slice:** After an approved audio contract, one authored BGM cue with mute/volume and Studio preview.
- **Acceptance:** Browser autoplay denial/missing files leave text playable; scene transitions stop/fade audio predictably; replay changes no mechanical outcomes. Add voice/SFX channel mixing and loop-point editing after the first cue works; no runtime speech generation by default.
- **Size / fit:** M / later (audio/animation roadmap row).

### UI20 — Editable canvas and stage timeline
- **Player/author goal:** I can compose and preview a scene without memorizing stage syntax.
- **Scope:** `public/scene-graph.mjs`, `public/studio.mjs`, `public/studio-preview.mjs`, `public/vn-stage.mjs`, `public/vn.mjs`, `public/play.mjs`, `public/style.css`; new stage formats need a separate engine brief.
- **Thin slice:** Graph selection edits the existing form; add an inspector for existing show/hide/sprite actions before keyframes.
- **Acceptance:** Supported canvas edits round-trip through forms/JSON without changing IDs or effects. Timeline scrubbing is preview-only and exports validated actions; reduced motion/fallbacks work. Layered expressions, camera cuts, particles and optional Live2D/Spine/Rive are separate later slices, not dependencies for basic PNG play.
- **Size / fit:** L / later, after UI16/UI18 and UI19 for audio tracks.

### UI21 — Shared visual foundations as needed
- **Player goal:** Controls feel consistent across play and authoring.
- **Scope:** `public/ui-showcase.css`, `public/play.css`, `public/style.css`, `public/play.mjs`, `public/creator.mjs`, `public/studio.mjs`; `public/tokens.css`, `public/ui-components.mjs` (new only if justified).
- **Thin slice:** Share one repeatedly changed token/component during real feature work; keep the existing palette and dense ES modules.
- **Acceptance:** The migrated component retains keyboard behavior, contrast and narrow-screen layout on each consuming page. No broad reformat, required build step or framework rewrite. A store/component extraction needs a demonstrated state-sync/testing problem; theme variants follow an owner preference, not an assumed redesign.
- **Size / fit:** S / later, incremental alongside the affected feature.

### UI22 — Translation workflow
- **Player goal:** I can play a translated world without broken layout or missing story text.
- **Scope:** `public/studio.mjs`, `public/creator.mjs`, `public/play.html`, `public/play.mjs`, `public/style.css`; translation/export/runtime files require a separate brief.
- **Thin slice:** Stable-key export/import for one authored scene, plus pseudolocalized preview; CSV first before optional PO/XLIFF.
- **Acceptance:** Import does not change mechanical IDs/references; missing strings fall back; long text/non-Latin fonts preserve choices and Stop. Separate authored strings from runtime-generated narration and provider-language behavior before adding a language switcher.
- **Size / fit:** M / later.

### UI23 — Share a complete playable project
- **Player goal:** A friend can open a shared game and recover their saves reliably.
- **Scope:** `public/studio.mjs`, `public/play.html`, `public/play.mjs`; packaging/service-worker/manifest/server files need a separately scoped release brief.
- **Thin slice:** Audit existing JSON export/import against all supported scene/CG/media references, then show compatibility/missing-media results in Studio.
- **Acceptance:** A supported project round-trips on a fresh test install with its referenced media, validation and save recovery. Keep F1's easy install/BYOK/first-run work separate. PWA/desktop/itch distribution follows Q6; offline mode explicitly distinguishes authored replay from scenes requiring a remote model. Minification/source maps are optional after fun, not a new mandatory build system.
- **Size / fit:** L / later; F1 uses the simplest existing delivery path first.

### UI24 — Sandbox and replay expansions, individually approved
- **Player goal:** A campus week or a second run offers meaningful new situations.
- **Scope:** Candidate presentation surfaces are `public/planner.mjs`, `public/calendar.mjs`, `public/campus.mjs`, `public/play.mjs`, `public/minigames-ui.mjs`, `public/sheet-editor.mjs`; each mechanic/content proposal needs its own owner-approved brief and engine files.
- **Thin slice:** Present one already-authored festival/event or job commitment through UI12; no new character content or reward formula implied.
- **Acceptance:** The chosen feature improves a named campus fun-gate measure, commits engine outcomes and replays identically. NG+ requires an approved carryover matrix, fresh-run consent and explicit handling of NPC memories; no automatic relationship carryover.
- **Size / fit:** L / later; never one omnibus implementation ticket. Park clubs/exams/stress/dorm/home systems, new social activities/outfit rewards, decay, collections, sanctuary saves, thought/skill voices, fail-forward checks, negotiation/drink minigames, rival-stat displays, encounter decks, difficulty/achievements and expanded modding until a specific play need justifies them. “Ask Venus,” writing previews/style rewrites and voice consistency checks are separate reviewed creator-assistant proposals, not permission to add per-turn model calls.

## Owner questions

Recommendations below are proposals; existing scene-feedback decisions remain settled. Mechanical actions, consent and character content require their own explicit decisions and are not inferred from these UI choices.

1. **Q: What should the default reading behavior be?** A) **Recommended:** instant ADV text; optional NVL, with typewriter deferred. B) ADV typewriter by default with reveal/advance clicks. C) NVL by default. (UI3/UI11.)
2. **Q: How much should goals and choice previews reveal?** A) **Recommended:** learned qualitative hints and already-public costs; no exact hidden gates or result spoilers. B) Optional spoiler previews of authored results and prerequisites. C) Exact gates plus paid hints; requires separate mechanics decisions. (UI1/UI2/UI6/UI12; preserve hidden chemistry and consent rules in every option.)
3. **Q: What visual save model should follow current checkpoints?** A) **Recommended:** checkpoint list with cached thumbnails and direct Save/Load. B) Five named overwrite slots. C) Ten slots with a persistent quick-save bar. (UI9; verify retention and overwrite contracts first.)
4. **Q: How prominent should map and phone navigation be?** A) **Recommended:** retain hub entries, add dialogs and optional node map; use pack labels and list fallback. B) Persistent phone shell with app navigation. C) Full-screen spatial map as the primary hub. (UI7/UI8; geometry is authored, never invented.)
5. **Q: Should weekly planning change the game's time model?** A) **Recommended:** known-plan agenda first; keep current three periods until O3 is designed. B) Editable weekly plan with current periods and separately approved conflict rules. C) Four-period/minute-based planner after a new clock brief. (UI12/UI13; none authorizes invented plans or rewards.)
6. **Q: Which delivery target follows F1's simplest working install?** A) **Recommended:** local web release and complete project export first. B) Windows desktop package first. C) PWA/offline package first with model-dependent limits shown. (UI23; framework migration and other desktop platforms remain later.)

## Owner decisions
- 2026-10-01: Q1–Q5 delegated to the director, who took the recommended option (A) for each. Q6 (delivery target) stays with the owner and is still open.
