# T-083: character-sheet geometry diagnosis

Verdict: the reported desktop 238px containment is confirmed by existing native-browser evidence; clipping/overflow and keyboard failure are not established. T-087 remains conditional, not ready to implement. No appearance choice is proposed.

## Version and evidence
- Inspected isolated candidate C:/Users/ckx19/AppData/Local/Temp/sf-T009b-combined-20261002, integration/T009b-combined-20261002, HEAD ac56ee5e59c3b3e276c69e6b1ff25fb9f7d7804b; tracked status clean during inspection.
- Existing QA: C:/Users/ckx19/AppData/Local/Temp/T009b-browser-qa.report.md and T009b-browser-qa-result.json; screenshots under T009b-browser-qa-shots (same Temp root).
- Visually inspected 01-sheet-open.png, 02-loading.png and 03-review-defaults.png (1440x900). 01/02 show sheet tabs without a review; 03 shows review rows above the tabs. All show the narrow sheet with unused space to its right.
- Raw final observation: boxWidth=238.453125; parent's computed gridTemplateColumns="238.453px 238.453px 238.453px 238.453px". T009b-qa-final.js measures the enclosing sheet card via [role=tablist].parentElement, not a review row or tab-panel track. This measurement was made after review dismissal; source and earlier shots connect the same card to review rendering.
- Raw evidence does not contain parent/client widths, computed grid-column, scrollWidth/clientWidth comparisons, expanded review details, keyboard traces, 390/768 captures or 200% text checks. Do not call these passed.
- Main is 3483d4b7251b8d3392e777625a2ddd9e7f8da54c with pre-existing dirty/untracked work. Allowed UI paths have no tracked working diff. Candidate-versus-main Git comparison: style.css/studio.html identical; studio.mjs and sheet-editor.mjs differ. Diagnose candidate only; main lacks candidate Suggest UI and is not certified equivalent.

## Exact source chain and width accounting
- public/studio.html: .studio > #editor > .studio-layout > .studio-content > #fields.
- public/studio.mjs:41 creates details.studio-section; :45 rows() creates article.studio-card > div.studio-grid; :321 Characters callback mounts mountSheetEditor(g,...) into that grid.
- public/sheet-editor.mjs:44 appends div.studio-card as an ordinary grid item; it has no dedicated class or spanning rule. :48 puts Suggested field review inside that card. :49 creates a separate div.studio-grid[role=tabpanel] inside the same card.
- public/style.css:4 supplies .studio-grid gap:12px and auto-fit minmax(210px,1fr); :27 overrides descendant grids with .studio-card .studio-grid repeat(auto-fit,minmax(190px,1fr)). This applies to the character grid AND nested tab panel.
- The sheet card defaults to one auto-placed parent track. Review rows are normal block elements within its content box, not four-column review cells. Tabs wrap within that same box; the nested tab-panel grid is a second constraint.
- Active :27 .studio max-width:1480px overrides earlier 1100px; .studio-layout uses 220px navigation +24px gap + remaining content; .studio-content has min-width:0. Character section has 1px borders and its direct article has 20px side margins; both article and sheet have 16px padding/1px borders. Global box-sizing:border-box; main has 4vw side padding.
- At viewport 1440 with the visible 15px classic scrollbar, inferred root client width=1425. Source arithmetic: main content=1425-115.2=1309.8; studio-content=1065.8; actor-card outer=1023.8; actor-grid content=989.8; four tracks=(989.8-36)/4=238.45px. Browser subpixel rounding gives the observed 238.453125px. Sheet inner width is consequently about 204.453px.
- These container widths are source-derived, NOT stored getBoundingClientRect measurements. The exact measured track/card values above are native-browser evidence; no viewport-width confusion with a 238px viewport.
- Parent placement is the primary cause, not a fixed sheet/review width. Candidate/base diff retains the same parent mounting and sheet-card class; Suggest lengthens an existing constraint rather than introducing it. No claim about the first historical commit.
- Global input width:100% also applies to review checkboxes (:1), explaining their own line/centered appearance in 03. Native checkbox hitbox/overflow was not measured; scope checkbox geometry separately if a failing check proves it.
- pre already wraps (pre-wrap, break-word, overflow:auto); summary/current paragraph/path label have no dedicated long-token wrapping rule. Potential long-value overflow needs browser measurement; screenshots show ordinary wrapping, not proven clipped text.

## Evidence matrix
| Case | Established | Remaining |
|---|---|---|
| 1440x900, normal text | Sheet border-box 238.453125px, parent 4 tracks; tabs/review visually stacked | Expanded long values, scroll geometry, focus/keyboard, sticky-toolbar occlusion |
| 768px | Source breakpoint <=900 collapses navigation; auto-fit still constrains sheet to one track | All native measurements and access checks |
| 390px | Same navigation breakpoint; source predicts one parent track with small mock | All native measurements and access checks; unrelated builder overflow must be distinguished |
| 200% text, all widths | No stored evidence | Define text-only scaling including explicit px font sizes; do not substitute deviceScaleFactor or report CSS prediction as QA |

## Reproducible isolated inputs (reuse; not executed anew)
- Harness: Temp/T009b-browser-qa-server.mjs imports the exact candidate createApp and createSheet, dataPath:':memory:', scenarioDir:mkdtemp; intercepts only POST /api/studio/suggest-sheet. No compatible/paid provider. Stored project is disposable, never a user save.
- Fixture: create-project default pack, player actor/sheet name "Existing QA adult", age 29, traits warm/curious, personality.notes "Original QA note", tastes.likes ["coffee"], other sheet fields from createSheet('player'); starting location start.
- Seeds: "quiet, student, evenings". Mock values: identity.name="Proposed QA adult", identity.age=31, personality.notes="QA proposed note", tastes.likes=["tea"]; weekly Monday/Tuesday Morning at start; social links qa-mentor/qa-team with external names QA mentor/QA teammate, relations mentor/colleague, empty notes; experience="none", face.limit="ask_first", face.sensitivity=1, limitsNotes="Discuss boundaries", policyOverrides={reviewRequired:true}.
- Response: {values:<above>,dropped:["QA stub: ignored unsupported field"],provider:"QA stub"}. Produces 13 independently reviewed rows. Existing identity/intimate defaults unchecked; normal rows checked. Open Game Builder fixture > Characters > Open full character sheet > enter seeds > Suggest; expand Suggested details before measuring.
- Failure variant: values:{'personality.traits':['warm']} for rollback; empty/error variants already documented in QA. Future geometry-only long-value variant can repeat neutral notes and a single long token within the shipped 4000-character bound, retaining the same mechanical fixture.
- Existing harness used a disposable Save to seed its project, not the UI's real-user projectSave quality gate. Do not count fixture setup or prior QA as production persistence validation.

## Conditional T-087 plan and exact allowlist
- Yes: public/style.css + public/sheet-editor.mjs can contain a narrowly scoped correction; no studio.mjs/studio.html/server changes are needed for the identified parent-placement constraint.
- Proposed source changes ONLY public/sheet-editor.mjs (dedicated sheet/review geometry classes) and public/style.css (rules scoped to those classes). Add grid-column:1/-1 to the sheet card to use its existing parent width, retaining current colors/fonts/labels/defaults. Do not hard-code a new target width or change the global studio-grid/card rules.
- If proven necessary, limit child grid minimum to available width and wrap long tokens in review labels/current/summary; keep proposal pre wrapping. Correct scoped checkbox width only with measured evidence. These are hypotheses for a failing regression, not implemented or browser-certified fixes.
- Exact writable allowlist: public/style.css; public/sheet-editor.mjs; tests/sheet-review-layout.test.mjs (new); docs/briefs/T-087.report.md. Read-only studio.html and existing tests stay unchanged. Stop/rebrief if another source path is required.
- First gate: reserve browser after T082, reuse mock isolation, record viewport + root clientWidth, studio-content/actor-grid/sheet/review/tab-panel rects, computed tracks/grid-column/padding, overflowing elements and visible focus. Establish the precise failing assertion before implementing. No duplicate behavioral QA run needed solely to re-prove 238px.
- New character-review-column-fit must use native layout/focus assertions, not mock Element widths or literal CSS matching: sheet uses available actor-grid width, current/proposed expanded values/checkboxes remain reachable; review contributes no page horizontal overflow; Tab/Shift+Tab/Space/Enter reach veto/details/Apply/Discard and tabs at 390/768/1440 and 200% text. Account for sticky toolbar; source slicing current/summary to 180 characters is intentional, full proposal is in details.
- Preserve and rerun sheet-suggest and character-sheet behavior assertions: unchecked intimate/identity defaults, independent weekly/link veto, live edit protection, rollback, two-step Apply. Then full npm test once, free code-reviewer gate, director review and separate owner merge approval per T087.
- T082 writes play.css and play-navigation-layout.test.mjs, so no source/test overlap. Browser access is serialized; both workers write separate reports. Isolated base must be selected; Suggest card conflict disposition recorded before T087. No theme/Studio architecture decision is required for filling existing available width.

Readiness: diagnostic evidence is sufficient to explain 238px and prepare a bounded fix. Responsive overflow/focus reproduction is incomplete; T087 must stay blocked until its browser gate and candidate/conflict disposition are satisfied. No additional browser was launched or requested during T082's exclusive session.
