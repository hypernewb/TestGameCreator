# Public

**Purpose**: Browser player views and creator authoring controls.

**Key Files**:
- `public/app.mjs`: Main application UI.
- `public/play.mjs`, `play.html`, `play.css`: Player scene/hub, refusal controls and responsive Messages dialog with unread badge, typed reply, invite actions, newest-50 rendering with "Show older", and the `#recap-card` (T-038/042/051/059).
- `public/campus.mjs`: Campus hub/phone views; `messages(state,pack)` and `phone(...)` share `threadOrder` (unread first, recency within) (T-042/059).
- `public/scene-feedback.mjs`: Deduplicated committed Trust chips and persistent mood rows (T-007).
- `public/lust-baseline.mjs`: Vague earned-desire hint (T-031).
- `public/planner.mjs`, `calendar.mjs`: Planner and calendar views.
- `public/vn.mjs`: VN playback.
- `public/studio.mjs`, `sheet-editor.mjs`: Creator settings/sheets including outreach, anniversaries, jealousy, wants, body limits and narrator slips, plus route repair, day recap, minutes per tick and a secrecy/agreements section validated in plain words before save (T-053/055/051/063).
- `public/memory.mjs`: Memory UI.
- `assets/showcase/ui-icons.svg`: Shared currentColor sprite (phone glyph) (T-059).

**Rules/Invariants**:
- Player views mirror committed engine state; prose/UI cannot grant consent or rewards.
- Messages reuse `/api/action`; thread reads are model-free, invite acceptance is a normal narrated turn.
- Decline is presentation-only and resets on reload; typed replies return scenes and are not appended to thread state (T-042).
- The Messages list cap is presentation-only (newest 50 plus a local "Show older" step), not a pack setting (T-059).
- Hidden meters stay hidden; jealousy uses tone words and earned desire uses hints (T-047).

**Tests**:
- `tests/ui-campus.test.mjs`, `ui-messages.test.mjs`, `ui-messages-2.test.mjs`, `scene-feedback.test.mjs`, `day-planner.test.mjs`, `day-recap.test.mjs`.
