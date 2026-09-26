# Experimental SillyTavern host

## What it reuses

The adapter calls the configured SillyTavern model through `SillyTavern.getContext().generateRaw`. We supply isolated prompts; the current ST conversation and lorebook are not automatically included. The extension uses the same independent simulation modules and both fixture packs.

The extension maintains a separate campaign, so deleting, swiping, or regenerating an ST chat message does not replay a game action. It is a minimal game panel, not the standalone application's full illustrated UI.

## Install for local testing

1. In this project's folder run `npm run build:st` (the generated folder is already included).
2. Close SillyTavern.
3. Copy `dist/story-framework-st` into your SillyTavern user extension directory, typically `data/<user-handle>/extensions/story-framework-st`. Alternatively use the extension location appropriate to your installation.
4. Start SillyTavern and enable Story Framework.
5. Select a working text model in SillyTavern.
6. Click **Story Framework** at the bottom right.
7. Start a fixture and use its game actions or text field.

The exact installation location can vary with ST configuration; follow its official extension documentation: https://docs.sillytavern.app/for-contributors/writing-extensions/

## Save and model limits

One extension campaign is held in browser localStorage, separate from chat. Starting another overwrites it after confirmation. Export first to retain it. Exports can be imported into the standalone host when packs match. There is no extension import button yet. Browser data clearing deletes this extension save.

Web Locks serialize turns across tabs when available. Avoid using the same campaign in multiple tabs when Web Locks are unavailable. LocalStorage capacity limits long campaigns; the standalone SQLite host is preferred for extended play.

The adapter has a 30-second timeout but cannot guarantee that timing out cancels the underlying ST generation request or billing. It does not currently implement intent repair retries. The standalone compatible provider does. If generation fails after commitment, the game shows deterministic result text.

## Verification status

The adapter has a mocked `generateRaw` contract test and the build script has been run. An installed SillyTavern instance was not available for end-to-end testing. Host lifecycle timing, third-party-extension interaction, model behavior, and update compatibility remain unverified. This integration is experimental, not a certified working ST release.

No ST source code is copied. This does not by itself settle licensing of every future combined distribution. Choose the project's public license and review the final integration before distributing it. Official extension repository submission has additional licensing and compatibility requirements.
