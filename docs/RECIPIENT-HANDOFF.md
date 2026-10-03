# Recipient handoff: current contracts and verification limits

Base source: main `7bb8f437b66babeb075bfdb3a38e0038c6ed6813`, 2026-10-03, plus the isolated RF02 import-preflight candidate pending independent review/integration. RF02 proves the bounded disk/API procedure below with fresh Temp storage and fake providers. It does not certify a release, clean-machine installation, browser import workflow or update procedure.

## Required application and storage

A project JSON or campaign save is not a runnable application. The recipient needs a compatible full Story Framework application, including its packages, packs, public asset tree and vendor code; Node.js 24 or later; a browser; and writable local storage. The source launch command is `node server.mjs` (`npm start`). Clean-machine launch and update/restore acceptance remain pending.

Generative prose requires the recipient's own compatible provider configuration. Exports do not include provider configuration or credentials. Template/mock checks do not establish real-model quality. Startup3 is included in this source revision; RF02 makes no new browser or onboarding-quality claim.

## Project import creates a new playable publication

Game Builder's project export contains a `story-framework-game-project` version-1 envelope, the project pack, and uploaded media referenced by location backgrounds, actor portraits and actor pose images. Only references beginning with `scenario-media/` in those fields are embedded. Referenced static application assets are not embedded by that handler; preserve the compatible application asset tree.

Project import uploads the embedded media, remaps those fields and saves a new draft. Publishing creates a new `created.UUID` pack identity at version `0.1.0`. This is the existing route to a new campaign; it does not retain the identity required by a campaign made from the original publication.

T097's accepted historical browser evidence covers one minimal generic project's export/import and subsequent play. Current RF02 reproduces the project envelope/upload/remap/save/publish/new/action path through APIs: it creates a different playable pack identity and does not make the original campaign save compatible. A save from the newly published identity imports successfully with its valid remapped art. It does not execute the browser Blob/file-input handlers. RF01 is included in the base revision: Studio media preflight and publication check referenced uploads and image structure. RF02 adds that existing media preflight to campaign import.

## Campaign restore requires the original matching publication

Campaign export uses `story-framework` version 2 and contains state, not the content pack or its assets. Import requires an already installed pack matching the saved pack ID, version, mechanics digest and module set. The importer replays recorded commands and checks resulting mechanics; successful import creates a separate campaign ID.

Preserve the original exported save, exact original published pack JSON and all referenced art. Importing that pack as a project and publishing again creates a different pack ID, so it does not satisfy the original save's identity requirement. Do not rewrite IDs/digests or weaken replay checks to force compatibility.

The server reads published JSON from the scenario directory's `published` subdirectory at startup. RF02 physically installed the original published JSON and referenced PNG, restarted a fresh recipient server/store, retrieved the exact PNG through its media route, imported the original campaign under a new campaign ID, and performed a deterministic wait. Existing recipient draft/campaign content was preserved. No pack was injected into the in-memory map.

The following is a verified developer-level disk/API procedure, not an installer or a new user-facing transfer feature:

1. Keep the sender's campaign export, original published pack JSON and referenced uploaded media together. For `created.<uuid>`, the existing published file is `<scenarioDir>/published/<uuid>.json`; an uploaded `scenario-media/<uuid>.png` lives at `<scenarioDir>/media/<uuid>.png`. Preserve original bytes, pack ID, version and media reference names. Include compatible static application assets separately where referenced.
2. Stop the recipient server before installing files. Use writable recipient scenario storage (default `<app>/data/scenarios`). Install the original published file and referenced media at those exact relative names without overwriting existing files. Resolve any collision before transfer; do not rewrite IDs/digests. RF02 used exclusive-create/copy flags against disposable storage.
3. Restart the recipient. Existing startup reads and validates the installed pack. Duplicate pack identities refuse startup; changed valid mechanics/modules can load but their original save import refuses with `Save requires its exact pack version`.
4. Preflight the installed original pack through `/api/studio/validate` before importing the save. RF02 verifies that present art passes and missing uploaded art returns HTTP400 with its reference. The RF02 candidate also enforces this check in `/api/import` before validation/insertion. Startup still performs pack schema validation; it does not certify media completeness. On unpatched base7bb8f437, campaign import bypasses media preflight, so the manual check remains necessary there.
5. Only after successful preflight, submit the exported campaign to `/api/import` (the existing Import save path). Success creates a separate campaign ID and replays mechanics. RF02 compares mechanics/events/stored prose and verifies a subsequent deterministic action. Import normalizes empty fact/migration lists and omits transport-only turn fields such as provider, promptVersion and playedAt; it does not promise byte-identical state envelopes.
6. Retain the originals and receiving storage. A missing original pack, changed mechanics/modules, or a project republished under a new ID refuses save import without changing existing scenario files/campaign/backup rows in RF02. Do not retry by editing saved state.

The original negative regression reproduced missing uploaded art returning200 from `/api/import` and adding a campaign. With the approved single-route preflight call, the unchanged missing-art assertion passes: import returns400 with the actor/media reference, campaign count is unchanged, and preexisting campaign/checkpoint rows and scenario file hashes are unchanged. Media path traversal also refuses without writes. No ID/digest rewriting or replay weakening is used. Independent candidate review/integration remains pending; clean-recipient browser/install/update acceptance is still separate.

## Compatibility and migration decision

Existing focused tests verify content-only compatibility, rejection of mechanics changes without deliberate migration, tamper rejection, and save-envelope migration from version 1 to 2. Envelope migration is distinct from a mechanics migration and from database schema updates.

A demonstrated mechanics migration changes Ada's initial location in the neutral fixture: the migrated campaign continues locally, but exporting and importing it against the new pack fails `Save state mismatch: actors`. The current importer rebuilds from the new pack; the recorded mechanics migration is not replayed by that path. This is one verified failure case, not a claim that every migration fails.

The owner selected A now: explicitly refuse unsupported portable mechanics-migration exports while preserving the local campaign and original compatible pack/save or pre-migration backups. Full migration support (B) is deferred to later work requiring an exact design and scope review; C was not selected.

RF03's interim export/import boundary is included in the audited source revision. It recognizes existing recorded mechanics changes, leaves local continuation intact, and retains ordinary/content-only exports and envelope v1-to-v2 support. It does not make migrated saves portable or restore historical packs. Keep original compatible saves and packs; do not claim full portable migration support.

## Evidence and preservation

CB03 verifies graceful server/store restart and a subsequent action; T097 adds historical UI-created project/campaign reopening and export/import evidence. Neither proves crash durability of unsaved drafts or a clean-machine update. Existing recovery, checkpoints, branching, validation and replay are already implemented; release work should reuse them.

Keep `data/scenarios` and campaign storage when planning local updates, including associated SQLite WAL files if copying a running database. This is preservation guidance, not a tested backup recipe. A coordinated release must establish a safe backup/update/restore procedure before claiming it works.

The exact 76 T085 asset files are restored in the audited tracked snapshot and match the recorded 81,378,218 bytes and hashes. Restoration does not establish publication/redistribution rights or complete provenance. The release owner must resolve asset and vendor distribution requirements before sharing a release.

Source evidence: `public/studio.mjs` project export/import handlers; `server.mjs:49-55,162,164-167,182,184` startup/media/publish/export/import routes; `packages/assets/project-media.mjs`; `packages/persistence/store.mjs` export/validateImport; `packages/persistence/migrations.mjs`; `packages/core/engine.mjs:122-130`; `tests/recipient-handoff.test.mjs`; existing compatibility, CB03/T097 and T085 reports/tests.
