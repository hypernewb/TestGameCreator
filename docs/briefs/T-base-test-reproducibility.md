# Make the committed test baseline reproducible

Owner request (2026-10-08): review and commit existing fixes with their new modules/tests, replace ignored local scenario dependencies with frozen tracked fixtures, include the Venus comparison harness/evidence, and verify the resulting commit in a clean checkout.

May change: the existing modified source/tests under `packages/`, `public/`, `vendor/` and `server.mjs`; their required untracked `.mjs` modules and test fixtures; `artifacts/venus-framework-comparison/`; `.gitattributes`; `tests/current-cast.test.mjs`, `tests/rei-context-cleanup.test.mjs`, `tests/interwoven-checkpoint.test.mjs`, `tests/asset-manifest-76.test.mjs`, `tests/venus-framework-comparison.test.mjs`, `tests/frozen-scenarios.test.mjs`, `tests/fixtures/current-cast/`; this brief and report. Preserve unrelated documentation, screenshots, scratch scripts/archives, saved projects and settings. Stage explicit reviewed paths only.

Acceptance: the committed tree contains every offline test dependency; scenario regression checks read frozen fixtures rather than `data/scenarios`; frozen bytes and pinned source checksums survive Windows Git checkout; `npm test` passes in an independent checkout with no copied local data or untracked dependencies. Run the affected creator/goal/voice browser checks. No live model calls or inference quality claims.
