# Visual-novel reader experience

The presentation layer now follows the mature visual-novel convention of separating reading preferences from game state. These settings live in browser storage, so text size, contrast, motion and pacing never alter a campaign save or its deterministic replay.

## Controls

- `AUTO` advances after the selected reading delay.
- `SKIP` advances only pages that were already read in an earlier visit. It stops at the first unseen page.
- Auto and skip stop before choices, free-form player input, authored `pause`, `consent`, or `adultBoundary` pages, and enabled intimacy/consent actions.
- `LOG` opens the complete searchable campaign backlog rather than an arbitrary recent-turn slice.
- `PREF` controls text scale, auto delay, high contrast, reduced motion and optional low-volume interface cues.
- Keyboard shortcuts are Space/Enter to advance, A for auto, S for skip-read, L for backlog, Escape to stop playback, and +/- for text size. Shortcuts do not capture keys while the player is typing or using a dialog.

The auto/skip split is inspired by Ren'Py's seen-text skip and auto-forward preferences. The safety pause is stricter than a generic VN because this project is an adult eroge: convenience must never race past a consent, boundary, privacy or relationship decision. Adult scenes can explicitly mark a page with `consent`, `adultBoundary`, or `pause` in authored data even when its visible wording is deliberately subtle.

Motion is limited to a short page/dialogue entrance and active-speaker emphasis. The OS reduced-motion preference becomes the initial default, while the in-game setting can disable all animation and transitions. The smallest breakpoint keeps the dialogue and interaction row usable on phone-sized screens.

Audio cues are synthesized locally and opt-in. They do not load or transmit an external asset. Full authored music, voice and sound-channel asset management remains a later creator-tool milestone.

Creator route testing lives in Studio rather than the reader. It runs every playable opening with three deterministic seeds and reports scene completion coverage, stalled scenes, orphaned beats, rejected actions, and queue eviction risks. Adult-route content is tested by the same system: easy or direct routes should complete without bespoke scene graphs, while gated romance and intimacy routes should explain why they remain unavailable rather than silently disappearing.
