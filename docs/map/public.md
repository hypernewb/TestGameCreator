# Public

**Purpose**: Browser player views and creator authoring controls.

**Key Files**:
- `public/app.mjs`: Main application UI.
- `public/play.mjs`, `play.html`, `play.css`: Player scene/hub, refusal controls and responsive Messages dialog with unread badge, typed reply and invite actions (T-038/042).
- `public/campus.mjs`: Campus hub/phone views; `messages(state,pack)` mirrors engine threads newest-first (T-042).
- `public/scene-feedback.mjs`: Deduplicated committed Trust chips and persistent mood rows (T-007).
- `public/lust-baseline.mjs`: Vague earned-desire hint (T-031).
- `public/planner.mjs`, `calendar.mjs`: Planner and calendar views.
- `public/vn.mjs`: VN playback.
- `public/studio.mjs`, `sheet-editor.mjs`: Creator settings/sheets including outreach, anniversaries, jealousy, wants, body limits and narrator slips.
- `public/memory.mjs`: Memory UI.

**Rules/Invariants**:
- Player views mirror committed engine state; prose/UI cannot grant consent or rewards.
- Messages reuse `/api/action`; thread reads are model-free, invite acceptance is a normal narrated turn.
- Decline is presentation-only and resets on reload; typed replies return scenes and are not appended to thread state (T-042).
- Hidden meters stay hidden; jealousy uses tone words and earned desire uses hints (T-047).

**Tests**:
- `tests/ui-campus.test.mjs`, `ui-messages.test.mjs`, `scene-feedback.test.mjs`, `day-planner.test.mjs`.
