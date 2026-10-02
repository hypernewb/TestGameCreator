# T-085: local restoration of the approved existing 76 files

Owner evidence: the assistant offered "Include only these 76 files in local Git so the project works from a fresh copy. My recommendation." The owner replied at 20:26:05, "76 artwork files sure" (2026-10-02 session). This supersedes the artist no-image-commit rule only for this exact list and local candidate packaging. It grants no general asset-policy change, publication, push, or main merge.

Base: main 3483d4b7251b8d3392e777625a2ddd9e7f8da54c. Branch: candidate/T085-assets-20261002. The isolated worktree uses tracked main, without importing dirty implementation changes or main's unrelated uncommitted log-ignore additions. Main and those additions remain intact.

## Manifest and scope

`docs/research/asset-manifest-76-T-085.csv` is a byte-for-byte copy of the authoritative `C:/Users/ckx19/AppData/Local/Temp/T075-fixtures.csv`.
SHA256: `050746fe9b4c91d91c63174b2f422c31a60b78d09eb5cbe1cd32892228d16023`.
76 unique safe relative paths; 81,378,218 bytes: 39 campus PNGs, 24 trio PNGs, 13 JSON metadata files. The CSV is the complete exact file list. No stubs qualify.

Original tracked ignore rules remain; exact file exceptions reopen necessary parent directories and re-ignore every other child. Rooms, profiles, renders, unused takes, secrets and unrelated assets remain excluded. No global policy document is edited.

## Existing provenance and rights

Files were copied without modification from the existing local main working tree and matched its authoritative audit hashes. No generation, image editing, NovelAI/ComfyUI request, paid call, upload or push occurred.
Existing `_style.json` names `nai-diffusion-5-full`; character metadata retains original seeds (including Haruka 517919, Min-ji 573352, Yuna 557514). Existing art tests describe prior NovelAI generation/request specifications. These records establish existing project provenance, not a verified per-image generation history.
Render histories and unused outputs are outside the allowlist and were not imported. Rights, licensing, model terms, and future publication/redistribution permissions are not verified. No license or redistribution grant is asserted; verify them separately before any future publication.

## Fresh-checkout restoration and verification

Correction: independent combined validation found 13 JSON checkout hash/size mismatches under system core.autocrlf=true (1278 passed, 1 failed, 10 skipped); their Git blobs were correct. Earlier focused verification used core.autocrlf=false and did not prove ordinary Windows checkout integrity.
Repository .gitattributes now sets -text for each exact allowlisted asset/metadata file and the exact manifest path, preserving audited bytes at checkout/add. Existing *.mjs text eol=lf remains intact; unrelated JSON/CSV/assets receive no new attribute. No global or repository Git configuration is changed.
Verification explicitly uses git -c core.autocrlf=true worktree add --detach <NEW_EMPTY_TEMP_PATH> <CANDIDATE_COMMIT> before running the tests below.

After obtaining the reported local candidate commit, run `git worktree add --detach <NEW_EMPTY_TEMP_PATH> <CANDIDATE_COMMIT>` from this repository. Git restores the assets from its objects; do not copy assets from main or use an asset symlink.
Run `node --test tests/asset-manifest-76.test.mjs tests/campus-trio.test.mjs tests/character-sprites.test.mjs tests/ui-campus.test.mjs` in that checkout. This verifies original manifest identity, PNG signatures, JSON parseability, every byte count/hash, ignored-path exclusions, and the three unchanged art test files.
A missing file, changed manifest, wrong size or wrong hash fails verification with the file path. Do not regenerate, replace, or accept placeholder images to fix such failures. Retain the checkout and report the mismatch; restore only the approved Git blob into a separate fresh checkout for comparison.
Full suite and reviewer gates remain with the parent integration workflow. A local candidate does not authorize merging main or publishing it.

## Rollback and retention

Leave main and all existing local assets untouched. To stop using the candidate, switch consumers back to their original working directory and retain the candidate checkout/branch for review. No reset, stash, overwrite of existing assets, or deletion is required. This procedure packages local reproducibility only; it is not an off-device backup.
