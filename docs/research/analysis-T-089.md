# T-089: Creator UI assignment contract readiness
Source inspection only, 2026-10-02. No projectSave/browser/API calls or suite runs.

## Current storage and ownership
- server.mjs:60/63-65: draft JSON lives at <scenarioDir>/drafts/<UUID>.json, envelope {id,updated,pack}; freshPack constructs gameProject.
- server.mjs:121-123: create clones a source pack or freshPack; get returns draft; save replaces d.pack with submitted body.pack after object check, not full validatePack. Invalid/incomplete drafts currently can be saved.
- server.mjs:151/155: Check calls validatePack; Publish clones saved draft, bakes reviewed director templates, assigns new created.<UUID>, validates and writes published pack. No UI selection field found in listed creator/player/server source.
- public/studio.mjs:307: Game project section has presentation (visual-novel/classic), conversation style and world settings. render supplies defaults in memory; do NOT conflate presentation with skin selection or insert UI default while rendering old drafts.
- public/studio.mjs:344/347/349-350: Save/publish use whole draft.pack; export format is story-framework-game-project v1 {pack,media}; import reassigns pack and remaps uploaded world art. UI metadata can round-trip inside pack; no separate projectSave route exists here.
- packages/core/engine.mjs:137-176: validatePack handles gameProject fields but no UI skin/version field; unknown gameProject properties not stripped. mechanicsDigest excludes presentation: skin selection must also stay outside mechanics digest/replay.
- server.mjs:74/156-157: runtime view includes current pack for new/load campaigns; publishing creates a new pack ID. No reason to rewrite existing campaign state to apply a project skin.
- public/play.mjs:132-147: reading font/custom font persisted independently in showcase-font/showcase-custom-font keys. Keep these preferences selectable; skin metadata must not delete them or override an explicit player reading-font choice silently.
- vn_ui_studio/app.mjs:11-14/30/147/212: wizard key vn-ui-studio:v1 stores validated editor config; exportPackage downloads export; import replaces wizard state explicitly. This is browser-local editor state, not project metadata.
- server.mjs:179 serves only root/public plus explicit vendor/media routes. Root vn_game_ui_wizard.html and vn_ui_studio are not currently served by game server. Existing standalone wizard must remain available and its key/custom layouts must not be reset.
- server POST body maximum currently 5,000,000 characters; wizard import permits files under 20 MB. First integration must report existing transport limit clearly, not enlarge it or unpack artwork implicitly.

## Proposed additive storage contract (implementation, not existing fact)
- gameProject.ui = {version:1, selected:'legacy'|'default'|<custom ID>, options:[{id,label,skin:<T-088 selection envelope>}]}.
- legacy and default are reserved built-in choices; preserve all custom option IDs/configs when selecting/importing another. UUID option IDs are implementation identity, not new gameplay/character design.
- default refers to versioned bundled public/ui/default-layout.json via T-088 loader; custom options store validated inline export, no remote URLs or imported labels as HTML. Renderer never executes exported css.
- A new blank creator project gets explicit default. Clone/import/open preserve existing metadata exactly; absent ui remains absent until creator chooses. Future selectable UI additions do not remove prior options/assets.
- Frontend owns unsaved import/selection/review; server owns UI-specific validation before saving and pack validation before publish; wizard owns editing/export. Player consumes selected option via T-084, retaining existing action/history/input paths.
- Reuse existing pack save/export/publish; no new database table, paid provider, pack-specific identity or campaign mutation. Narrow schema helper plus engine hook; no blanket validatePack on draft save because it would block today's incomplete drafts.

## Detection and compatibility
| Case | Detect | Behavior |
|---|---|---|
| New blank project | create without packId | Persist explicit new default; legacy still selectable |
| Existing/clone/import without skin | ui === undefined | Legacy fallback pending owner migration decision; no render-time rewrite |
| Explicit legacy | selected === legacy | Preserve legacy and custom options |
| Explicit default | selected === default | Load versioned default, legacy fallback on failure |
| Explicit custom | selected matches options ID | Validate/load its export; preserve every other layout |
| Wizard saved custom | vn-ui-studio:v1 | Leave untouched until user explicitly edits/imports/applies |
| Unknown version/missing option/failed load | contract mismatch | Runtime fallback plus diagnostic; never rewrite/delete stored data; reject invalid new saves with existing draft untouched |
| Classic presentation | presentation === classic | Preserve Classic choice; wizard skin applies only to supported VN surface, graceful fallback/compatibility notice, no conversion |

## Ready slices and file ownership
- T-090 server/schema persistence: server.mjs; packages/core/engine.mjs; new public/ui-selection.mjs; new tests/studio-ui-storage.test.mjs. Browser-served shared validator avoids imports of unserved packages in creator; depends T-088 review. No public/studio code edits.
- T-091 creator file-import/select/apply: public/studio.html; public/studio.mjs; new public/ui-project.mjs; new tests/studio-ui-selection.test.mjs. Depends T-090. Avoid public/style.css (T-087), sheet editor and loader writes. Apply affects unsaved project, normal Save persists; validated preview is not real gameplay until T-084.
- T-092 same-origin wizard entry: server.mjs; new tests/ui-wizard-serving.test.mjs. After T-090 to avoid server overlap; serve existing wizard with exact reviewed dependency allowlist, keep CSP. T-091 links only after this entry passes. No wizard source rewrite/postMessage protocol required for first export-file workflow.
- T-084 runtime binding follows T-088 plus storage contract; selected pack.ui metadata consumed without default migration. Full non-campus temporary fixtures, legacy/custom preservation and all existing input/history handlers.
- Creator acceptance creator-ui-selection-roundtrip: import existing export -> review -> Apply as option -> Save -> reopen -> export/import -> publish -> new/load view retains selected/version/options; test in temp scenarioDir and :memory:, no owner project.

## Owner decision and limits
Q: Existing games without an explicit skin currently use legacy styling; should they switch? A) Recommended: keep legacy until creator explicitly selects new default B) adopt new default on next creator save with notice C) apply new default whenever loaded. New blank projects default to new UI and existing explicit/custom choices are preserved in all options. Existing-game migration is the only unresolved UI choice.
Local ComfyUI replaces NovelAI for future art work per owner; subscription ended. Separate inspection already running; this analysis makes no service/model/workflow availability claim and commissions no generation.
76-file local Git packaging and T-088 already dispatched by parent; do not duplicate them. Suggest conflict remains parent-owned. No parked second-world product work revived; non-campus fixtures are tests only.
