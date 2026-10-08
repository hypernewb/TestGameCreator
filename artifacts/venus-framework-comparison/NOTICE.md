The unchanged files under `upstream/` come from Venus University, https://github.com/venus-uni-dev/venus-university, revision ec8f7cee4fd9236e3dbcdc2e4683afba3acab748 (2026-10-03).

Upstream code is AGPL-3.0-only. Its complete license is retained in [upstream/LICENSE](upstream/LICENSE); source URLs and SHA-256 checksums are recorded in `source-provenance.json`. No upstream art, audio or other assets were copied. Upstream assets have separate rights and are not included in this comparison.

`venus-loader.mjs` strips TypeScript syntax at runtime and supplies four explicitly bounded UI/store interfaces. It does not rewrite the upstream prompt or sanitizer. The local preparation, replay and scoring files are comparison harness additions, not upstream Venus files.
