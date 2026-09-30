# Headless character authoring

The character creator can run without opening the game or Game Builder. It supports direct batch generation through an OpenAI-compatible API and a portable job format for Claude Code, Codex, or another agent.

Create `cast-prompts.json`:

```json
[
  "A guarded archivist who notices every lie but avoids asking direct questions.",
  {
    "id": "night-baker",
    "name": "Mara Voss",
    "pronouns": "she/her",
    "age": 27,
    "location": "market",
    "brief": "A relentlessly cheerful night baker whose optimism is partly an act."
  }
]
```

## Direct model generation

Start an OpenAI-compatible model server, then run:

```powershell
node scripts/character-author.mjs generate `
  --pack packs/my-game.json `
  --prompts cast-prompts.json `
  --model qwen/qwen3.8-27b `
  --out cast.batch.json
```

The endpoint defaults to `http://127.0.0.1:1234/v1`. Override it with `--endpoint` or `STORY_ENDPOINT`; use `--key` or `STORY_API_KEY` for an OpenAI-compatible HTTPS service.

## Claude, Codex, or another external agent

Prepare self-contained jobs:

```powershell
node scripts/character-author.mjs prepare --pack packs/my-game.json --prompts cast-prompts.json --out cast.jobs.json
```

Ask the agent to process `cast.jobs.json`. Each job contains its own system/user messages and JSON schema. The agent writes `cast.responses.json`:

```json
[
  { "id": "character-1", "response": { "name": "...", "pronouns": "..." } },
  { "id": "night-baker", "response": { "name": "Mara Voss", "pronouns": "she/her" } }
]
```

Ingest and validate the answers:

```powershell
node scripts/character-author.mjs ingest --pack packs/my-game.json --jobs cast.jobs.json --responses cast.responses.json --out cast.batch.json
```

The batch records failures beside their original answers instead of silently accepting malformed profiles.

## Review and apply

Change wanted entries in `cast.batch.json` from `"status": "pending"` to `"status": "approved"`, then create a new pack:

```powershell
node scripts/character-author.mjs apply --pack packs/my-game.json --batch cast.batch.json --out packs/my-game-with-cast.json
```

Pass `--all` to apply every valid pending entry. The source pack is never overwritten, output files must not already exist, the batch must match the original cast, and the completed pack passes normal framework validation before it is written.
