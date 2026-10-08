# GC5.5 recovery guarantees (read-only audit, 2026-10-08)

Scope: what the creator's recovery actually guarantees. Read-only. No production or test edits, no model/provider/network calls, no browser tests, no `data/ai-settings.json` access.

Baseline: `main` at `9535347`, read from a `git archive` snapshot because the worktree is detached at `e0f2a05` and lacks the creator files. Uncommitted changes in the shared checkout were not analysed; findings may differ if they change these paths.

Legend: **Survives** = data is still there after the scenario and is reachable from the UI. **Lost** = gone with no way back. **Lost (status only)** = gone, but the only signal is a message in a status element. **Unknown** = the code does not let the client tell. **Protected** = a guard blocks the unsafe action. **N/A** = the data kind does not exist there.

## Evidence keys

- **E1** `public/studio.mjs:105` `captureRecovery` writes raw JSON, system and rule buffers, and weekly pending state into the record. `public/studio-recovery.mjs:10` stores a `structuredClone` of the draft plus buffers.
- **E2** `public/studio.mjs:111` `initRecovery` captures on `document` `input` and `change` (`setTimeout` 0) and on `pagehide`. `public/studio.mjs:114` `message()` also captures.
- **E3** `public/studio-recovery.mjs:3,5` `decode` and `read` throw on malformed or unsupported data.
- **E4** `server.mjs:172` `/api/studio/save`: only the `startupId` branch checks `revision`. The normal branch writes the draft file with no revision check (last write wins). `tests/creator-recovery-controls.test.mjs:32-33` asserts that a stale save is accepted.
- **E5** `public/studio.mjs:54` `backupStartup` returns early when `flow.current` is unset. `startup-prompt`, `startup-notes`, `startup-npcs` and `startup-locations` are only stored once a startup session exists.
- **E6** `public/studio.mjs:105` catch sets `#recovery-status` only. `public/studio-recovery.mjs:14` `assertAvailable` is defined but never called. `public/studio-recovery.mjs:19` shows list errors only in the list panel.
- **E7** `server.mjs:75` startup sessions live in an in-memory `Map`. `server.mjs:159-162` covers generate (256 cap), restore and cancel.
- **E8** `public/studio.mjs` raw JSON `apply-json` refuses when `raw.base` differs from the current pack. `studioSnapshot` blocks Save and Check while raw JSON is pending.
- **E9** `server.mjs:172` startup branch: `assert(body.revision===s.state.revision)` before save.
- **E10** `server.mjs:160` generate stores its session after the `await`. Cancel deletes by id. A generate that finishes after cancel leaves an orphan session that counts toward the 256 cap.
- **C1** `public/creator.mjs:5,12` `KEY='creator-draft'`; `keep()` writes the whole wizard state to `localStorage` on each field edit. Its `catch` is silent.
- **C2** `public/creator.mjs:10` initial load is `try{...JSON.parse...}catch{}`. A corrupt value silently becomes defaults, and the next `keep()` overwrites the corrupt record.
- **C3** `public/creator.mjs` has no `storage` event listener (count 0). Two tabs share one key with last write wins.
- **C4** `packages/cards/creator-routes.mjs:41-45` save mints a new pack id (`randomUUID`) on every call and writes the published pack and world file before responding. Retry after a lost response creates a second campaign.
- **C5** `public/creator.mjs:29,126` `openWorld` replaces `S` with no confirm. `:35` Propose sets `S.spec=null`. `:108` Redraft overwrites `S.spec`. `:114` Start new world. None asks first.

## Table 1: Studio (recovery store, key `sf.creator.recovery.v1`)

| Scenario | Applied project data | Raw JSON and system/rule/weekly buffers | Native inputs not in draft (startup fields, UI-only fields) | Unfinished server requests |
|---|---|---|---|---|
| Refresh | Survives: recovery copy (E1, E2) | Survives: buffers in copy (E1); restore path not traced | Lost before first startup generate (E5); UI-only fields lost | Unknown: result lost, server may have written |
| Tab close | Survives: `pagehide` and per-input capture (E2) | Survives (E1, E2) | Same as refresh | Unknown |
| Browser restart | Survives in same profile (`localStorage`); lost in private window or after cleared site data | Same as applied | Same as refresh | Unknown |
| Server restart | Survives in browser copy; saved drafts are files | Survives in browser copy | Startup copy only if captured (E5) | Lost: request errors; in-memory startups gone (E7) |
| Corrupt recovery record | Lost for new edits (E3, E6): recovery cannot capture; discard also fails | Lost (status only) | Lost (status only) | Not affected |
| Conflicting saves (two tabs) | Lost silently for the older tab's save: server last write wins (E4) | Protected: Apply refuses after base change (E8) | Not protected | Stale normal save accepted (E4); startup save checks revision (E9) |
| Abandoned startup generation | Survives: project untouched | N/A | Startup inputs kept only after capture (E5) | Orphan session stays until cap (E10) |

## Table 2: M2 world wizard (`localStorage` key `creator-draft`)

| Scenario | Applied wizard state (`S`, incl. spec and proposal) | Raw buffers | Native inputs (text fields, selects) | Unfinished server requests |
|---|---|---|---|---|
| Refresh | Survives on each edit (C1) | N/A | Survives (C1) | Unknown: client loses result; server may have saved (C4) |
| Tab close | Survives (C1) | N/A | Survives (C1) | Unknown (C4) |
| Browser restart | Survives in same profile | N/A | Survives | Unknown (C4) |
| Server restart | Survives (client state) | N/A | Survives | Lost error; world file may exist (C4) |
| Corrupt `creator-draft` | Lost silently: defaults load, next edit overwrites (C2) | N/A | Lost silently (C2) | Not affected |
| Conflicting (two tabs, or Open/Propose/Redraft/New) | Lost silently: last write wins (C3) and overwrite with no confirm (C5) | N/A | Lost silently | Retry creates duplicate campaign, not loss (C4) |
| Abandoned startup generation | N/A: wizard has no startup session | N/A | N/A | N/A |

## Silent-loss cases

A silent loss is one where the data disappears with no error or confirm at the point of loss.

1. **Stale Studio save overwrites a newer saved draft (worst).** Two Studio tabs on one draft; the older tab saves. `server.mjs:172` has no revision check on the normal path, and the file is replaced with no history (E4).
2. **Corrupt wizard record wiped on next edit.** `creator.mjs:10` silently loads defaults, then `keep()` overwrites the corrupt value (C2).
3. **Wizard Open, Propose, Redraft or New discards the current draft.** No confirm at `creator.mjs:29,35,108,114,126` (C5).
4. **Two wizard tabs.** `localStorage` last write wins with no `storage` listener (C3).
5. **Startup text typed before the first generate is lost on refresh.** `backupStartup` needs `flow.current` (E5).

Not counted as silent (status-only or visible): corrupt Studio recovery (E3, E6); `assertAvailable` unused, so the guard only fires at capture time (E6); server restart errors (E7); the 256-session cap (E10).

Not user data loss, noted for follow-up: orphan startup sessions after cancel (E10) and duplicate campaigns on save retry (C4).

## Evidence limits

- Static reading only. Nothing was run in a browser, so `pagehide` write completion and the restore paths are unverified.
- `studio.mjs` restore for buffers was not traced line by line; those cells say so.
- Shared-checkout uncommitted changes were not analysed.
