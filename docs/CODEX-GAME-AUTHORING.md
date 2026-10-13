# Authoring an adult game with Codex

Codex writes a game as one pack JSON file. `npm run validate` checks it, and the game runs when the local server loads it. Gemini narrates during play but never edits the pack or world state. Everything Codex writes is plain data: no code, no scripts, no expressions.

## Before you prompt

1. Copy `packs/template-bar.json` (the adult romance template) or `packs/neutral.json` to a new file under `packs/`, for example `packs/my-game.json`.
2. Give Codex this document, the copied file, and your game idea.
3. Ask Codex to edit only that file, then run:

```sh
node scripts/validate.mjs packs/my-game.json
```

Fix every error it prints and run it again until it prints `PASS`. Restart the server (`npm start`) so the pack is discovered.

## Rules that the validator enforces

- The player (`playerId`) must be an actor with `age` 18 or older. Every intimacy profile needs a different character who is also 18 or older.
- IDs must be unique within their kind (locations, actors, items, facts, quests, timed events, endings). Use short lowercase IDs with hyphens.
- Every location an actor, item, exit, or timed event refers to must exist. Every character in a profile, fact, or phone or feed entry must be an actor.
- Module versions must match exactly what the engine registers. Copy the `modules` block from the template and do not change the version numbers.
- `intimacySettings.contentLevel` is `fade`, `suggestive` or `explicit`. `difficulty` is `easy`, `normal` or `realistic`.

## What Codex may write

Codex should write only fields listed here. Anything else is a validation error or is ignored.

| Field | Shape |
|---|---|
| `id`, `version`, `title`, `subtitle` | Strings. `version` like `0.1.0`. |
| `playerId` | Actor ID of the player. |
| `calendar` | Name of the time unit, e.g. `Night`. |
| `locations` | `{id, name, description, exits:[{to, flag?, reason?}]}`. |
| `actors` | `{id, name, age, location, identityTags?, description?, style?, goal?}`. `style` is a short speaking-voice note. |
| `facts` | `{id, text, knownBy:"public" or [actor IDs], supersedes?}`. Use facts for authored truths the characters know. |
| `schedules` | `{actor, period, stops:[{at, location}]}`. Repeats forever. |
| `items`, `initialMoney`, `services`, `wageRules`, `economySettings` | Only if the economy modules are enabled. Copy the template's shape. |
| `datingProfiles` | `{character, initialChemistry, initialPhase:"crush", agreements, thresholds:{crush, date, exclusive}}`. Thresholds are increasing numbers from 0 to 100. |
| `intimacySettings` | `{difficulty, contentLevel, privateLocations:[location IDs], aftercareOptions:[]}`. |
| `intimacyCategories` | `{id, name, privacy:"public"/"semi-private"/"private", casual, resolution:"scene"/"direct", discretion:"open"/"discreet"/"secret", requiresAgreement:[]}`. Keep the list short (1–30). |
| `intimacyProfiles` | `{character, openness 0–100, casual, consentPolicy:"ask"/"threshold"/"scripted", allowedCategories:[...], blockedCategories:[...], interests:[], stylePreferences:[], scenes:[{category, notes, beats:[{text, checkIn?}], aftermath}]}`. Scene notes are at most 2000 characters, beats at most 600 each, up to 12 beats. |
| `phoneContacts`, `phoneMessages`, `feedPosts` | Short texts from characters. Feed triggers are `{event, match}`. |
| `timedEvents` | `{id, name, startTick, endTick, location, character, missedRecap}`. Ticks are whole numbers. |
| `endings` | `{id, name, character, requires:{intimacyCounts:{character:n}}}`. Add at least one ending so a run can finish. |

Quests use `{id, name, hint, any:[{event, match}]}`. They complete once when a matching event happens.

## Writing rules for Codex

- Keep the pack compact. Long biographies and many facts are not token-budgeted yet, so 3–6 facts per character is enough.
- Describe what happens in `beats`, `notes` and `aftermath`. Do not write numbers, stat changes or unlock conditions into prose, since the engine owns them.
- Every character needs a `goal` and a `style`, so Gemini has something to play.
- Do not invent new field names. If an idea needs a field that is not listed here, say so in your reply instead of adding it.
- Do not write `<UpdateVariable>`, `{{setvar}}` or any script syntax in text. They are stripped.

## Minimal valid example

This pack passes validation as written. Use it to check the shape before your own content.

```json
{
  "schemaVersion": 1,
  "progression": {"version": 1},
  "id": "example.two-people",
  "version": "0.1.0",
  "title": "Two People",
  "subtitle": "A small adult romance",
  "playerId": "player",
  "calendar": "Night",
  "modules": {
    "social.conversation": "0.1.0",
    "social.relationships": "0.1.0",
    "social.dating": "0.1.0",
    "social.intimacy": "0.1.0",
    "story.endings": "0.1.0"
  },
  "locations": [
    {"id": "bar", "name": "Bar", "description": "A quiet bar.", "exits": []}
  ],
  "actors": [
    {"id": "player", "name": "You", "age": 25, "location": "bar", "identityTags": ["adult"]},
    {"id": "morgan", "name": "Morgan", "age": 27, "location": "bar", "description": "Dry humour, late shifts.", "style": "Short sentences, teasing.", "goal": "Find someone who stays."}
  ],
  "facts": [
    {"id": "morgan-shift", "text": "Morgan closes the bar most nights.", "knownBy": "public"}
  ],
  "datingProfiles": [
    {"character": "morgan", "initialChemistry": 25, "initialPhase": "crush", "agreements": ["casual", "open"], "thresholds": {"crush": 10, "date": 25, "exclusive": 65}, "preferences": [], "signals": []}
  ],
  "intimacySettings": {"difficulty": "easy", "contentLevel": "fade", "privateLocations": ["bar"], "aftercareOptions": []},
  "intimacyCategories": [
    {"id": "hookup", "name": "After-hours hookup", "privacy": "private", "casual": true, "resolution": "direct", "requiresAgreement": []}
  ],
  "intimacyProfiles": [
    {"character": "morgan", "openness": 90, "casual": true, "consentPolicy": "threshold", "allowedCategories": ["hookup"], "blockedCategories": [], "interests": []}
  ],
  "endings": [
    {"id": "after-hours", "name": "An ongoing arrangement", "character": "morgan", "requires": {"intimacyCounts": {"morgan": 1}}}
  ]
}
```

Note: `items`, `schedules`, `timedEvents`, `feedPosts` and the phone fields are optional and omitted here. If you add them, copy their shape from `packs/template-bar.json`.
