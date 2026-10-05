# T-schedule-preview — Weekly schedule preview

Status: done
Files: public/schedule-preview.mjs (new), tests/schedule-preview.test.mjs (new), public/studio.mjs (import + mount call in scheduleEditor), public/style.css (preview grid + highlight styles)
Tests: pass 1707 fail 0 (skipped 10); new file: 9 pass / 0 fail
Acceptance:
- Preview matches runtime attendance: `assertMatchesRuntime` runs the real engine (`createWorld` + `execute` core.wait) and compares every one of the 21 cells per week for 2 weeks, for a linked-rules pack and a legacy stops+weekly+exception pack — exact match.
- Conditional rules show assumptions: the preview states the assumed quiet week (number, anchor date, start tick), lists holidays that make `skipHolidays` rules not fire, names exception windows (including ones outside the previewed week), and flags carried-over slots.
- Read-only: preview functions are pure (`previewWeek` never mutates the pack, asserted by deep-equal) and the panel only re-renders; NPC/week changes never touch the project or saves (unit test + browser check). No server routes were added.
- Overlapping rules: compatible overlaps show the winning rule with "Overrides: <shadowed labels>" from `compileWeeklyRoutines` provenance (specific over general); incompatible overlaps never throw — the overlap diagnostic is named and raw weekly cells decide by array order.
- Unavailable NPCs / missing references: an NPC without any schedule shows "No schedule — stays at start" in every cell (never a invented location); a rule pointing at an unknown location renders "Unknown location 'x'" plus a fix-before-play note; a disabled schedules module pins every cell to the starting location with a note.
- Rule navigation: each cell resolved by a linked weekly rule shows a "<rule label> — edit rule" button; clicking it expands the Character schedules section, scrolls to and outlines the exact rule row (`data-rule`) for 2.5s and reports it in the status line. Browser-verified on the Friday-evening override.
- Project switching: remounting with a different draft drops stale selections and never leaks the previous project's NPCs (unit test + browser check against a schedule-less draft).
Browser-verified (isolated STORY_DATA_PATH, port 4401, cleaned up): week-1 and week-2 grids for a linked NPC (holiday skip Wednesday, Friday override, weekend override, carried markers), no-schedule NPC, week switching, rule navigation highlight, cross-draft switch.
Deviations:
- The resolver precedence (exception > tick stops > weekly cells > carry-over, and the tick-0 rule that time never processes tick 0) is mirrored in browser-safe code instead of importing `scheduleDestination`: the static server only serves `public/`, so the browser cannot fetch `packages/core/engine.mjs`, and pulling the whole engine into studio.html for one function is not justified. Drift risk is pinned by the tick-for-tick runtime-match tests; `holidayMatch` is likewise a tested mirror of `holidayOf`.
- The preview assumes a quiet week (no held scenes, invitations, moment detours or periodic catch-up). This is stated in the panel notes; modeling live state deviations is out of scope for this slice.
- "Open rule for editing" covers linked weekly rules (the primary authoring path). Legacy weekly cells, tick stops and exceptions render their source as plain text; they are edited via the existing Legacy/Advanced controls.
Noticed:
- scheduleEditor has no editor UI for `scheduleExceptions`; they can only appear via packs/API. The preview reports them but a creator cannot fix them from Studio.
- The mount is guarded by `typeof mountSchedulePreview==='function'` because the studio VM test harness strips imports; if that harness is ever replaced the guard can be dropped.
Questions: none
