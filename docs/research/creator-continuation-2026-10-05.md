# Creator continuation — 2026-10-05

Owner choice: adapt inspected Venus jobs, academics and feed rules as configurable engine modules. Baseline is the local source checkout, not a verified upstream revision or complete runtime parity claim.

Implemented creator paths:
- Thirteen original system gaps: T-104 typed nested forms, dependency enable/disable, validation and preservation of extensions.
- Detailed social rules: romance ranks/gift tastes/repeating signals; intimacy interests/styles/aftercare/disclosure; event scalar matches, conditions, branch beats/waits/effects; objective matches; director casting; debt/invitation/daily gain settings.
- Default reusable social template and explicit blank start; prompt/card startup retained. One placeholder character demonstrates authoring without defining a full campus game.
- Explicit browser-local recovery for applied project data, raw project/profile JSON, system/rule buffers, weekly buffers and startup snapshots. Restore revalidates startup readiness without provider calls. Saved-data conflicts fork a draft; stale async replacement is rejected. This does not promise preservation of every uncommitted native DOM input, a browser-independent backup, or recovery of a server request that had not completed before closing.
- `world.jobs`: configurable openings, workplaces, stat-tier requirements and gains, weekly rosters, deferred roster changes, pay, raises, strikes, sick notes, employment closure. Defaults: raise every 3 clean shifts, maximum 5, increment 20%, firing after 3 strikes, one sick note per employment. Three engine dayparts replace Venus's two slots; raised pay is rounded to integer currency units. Existing venue closures cancel shifts. Engine consumes the remaining daypart for work. Character/boss prose and the original job catalog are not imported.
- `world.academics`: configurable courses, weekly meetings, attendance, tick-authored assessment dates, authored answer choices, skipped questions, project sessions, grading and GPA. Thresholds 0/15/35/60/100, difficulty-required tiers, Brain/Heart/work caps, perfect-score rewards and GPA grade bands remain editable. Timetable conflicts reject enrollment/hiring. Missed assessments receive zero; closed meetings are excluded. This is an authored course engine; AI-generated professors/question sessions, calendar-picked dates and a full semester/graduation workflow are not implemented.
- Existing `social.feed` extended opt-in: feed profiles, contact-only visibility, pending daily friend-request rolls, blocking, seeded like counts and one recorded like per post. Default request factor .8 against Heart 100, online multiplier 2; likes friend count plus 0–3; fresh-like bonus considers the newest 3/5 posts and a one-day freshness allowance. The bonus is exposed by a helper and the committed `social.feedLiked` event; the owner can connect the event through editable romance signals. It does not automatically rewrite relationship points. Existing feed behavior is retained when feedSettings is absent.

Remaining gaps, in order:
1. Custom first-experience/touch step identities and prerequisites await the requested owner choice. Required engine consent/stop/sobriety behavior is retained.
2. Complete jobs/academics/feed experience: boss conversations, semester assignment/handback/graduation orchestration, authored recurring post generation/suggestions/teasers/epilogues and richer player-facing specialist screens. Current specialist forms and deterministic actions are foundations, not all Venus screens or narrative generation.
3. Portable content-package integration remains an independently reviewed candidate per T-101; frozen weekly Stage2 remains unmerged. No integration/merge is claimed here.
4. Full migration, adventure, installer and calendar-picked dates remain deferred by the owner.

Existing memory inspection/correction controls and authored fact/knowledge controls are present in the creator. They are reused; recovery does not copy runtime campaign memory into a new authored project.

Verification: focused authoring/engine tests, isolated real API save/reopen, replay and production-browser template -> enable jobs -> author workplace/pay/weekly slot -> Apply -> Save -> pending edit -> Save rejected -> reload -> Restore retained pending value. Final aggregate outcome is recorded in T-105.report.md.
