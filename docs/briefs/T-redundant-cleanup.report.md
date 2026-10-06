Status: done
Files: docs/briefs/BOARD.md; T-069.report.md; T-070.md; T-078.md; T-078.report.md; T-079.md; T-079.report.md; T-080.report.md (all under docs/briefs); six superseded documents removed; ignored local data cleaned; this report.
Tests: npm test once: pass 1783 fail 64 cancelled 0 skipped 10, 1857 tests, 40.35s. SQLite integrity and archive/retained-campaign checks pass. App restarted: HTTP 200, Story Framework.
Acceptance: 52 older campaigns archived, 13 retained; 437 blank drafts, 11 older world versions (22 files), 1358 unused images and six superseded documents removed from active locations. Total 1823 files, 12,434,195 bytes moved into recovery archives. Active data has two nonblank drafts, two worlds and two corresponding publications, and zero uploaded images.
Deviations: Recoverable archival rather than permanent deletion. Latest campaign means highest SQLite rowid (creation order; campaign records have no timestamps). Keep newest campaign per pack family and newest played campaign if different, preserving progress when the latest creation is blank. Latest world plus worlds needed by retained campaigns survive. One pass after testing archived three additional blank drafts and six unused images created during the test run. No gameplay/code/test changes, commits or staging in this cleanup.
Noticed: Concurrent Studio/AI edits produce 64 suite failures, including Studio VM SyntaxError and the wideContext assertion. Tests/concurrent workers generated real data-directory leftovers during verification. Unique historical briefs, decisions, research, art-source files, evaluation artifacts, built-in packs and ongoing worker changes remain; age alone does not establish redundancy.
Questions: none

| Removed document | Why superseded | Current record |
| --- | --- | --- |
| T-028.report.v1.md | First-pass result replaced by director fix-round result | T-028.report.md |
| T-035.report.v1.md | First-pass result replaced by deterministic/atomic fix-round result | T-035.report.md |
| T-078.original-T-069.md | Same brief, corrected ticket identity and allowed paths | T-078.md |
| T-078.original-T-069.report.md | Same report body plus identity clarification | T-078.report.md |
| T-079.original-T-070.md | Same brief, corrected ticket identity and allowed paths | T-079.md |
| T-079.original-T-070.report.md | Same report body plus identity clarification | T-079.report.md |

Removed documents total 7393 bytes. References to duplicated originals now point to the consolidated ticket records; historical results and questions remain. Superseded report copies contained no unique design decisions absent from current records.

Recovery: data/.trash-cleanup-2026-10-06/manifest.json lists original relative paths; campaigns.sqlite is a consistent VACUUM INTO snapshot of all 65 original campaigns and all checkpoints. Removed files retain their original relative layout under that archive. data/.trash-cleanup-2026-10-06-2/manifest.json lists the nine test leftovers; no second database backup was needed. The first archive also retains the one-off execution script and test log. Restoring a database snapshot requires stopping the app and accounting for any newer progress first.

Verification: all 13 retained campaign rows are byte-identical to the database backup, SQLite integrity_check is ok, no checkpoint/backup row references a missing campaign, and every planned moved file exists in its archive and is absent from its original path. Media references were scanned in surviving repository text, local cards/scenarios and both backup tables for retained campaigns. Settings file was excluded from all scans. No settings changes.
