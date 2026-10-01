# Wave 5 plan (draft, not dispatched: owner paused new work)
Goal: after C1 lands (Wave 4), check the fun gate and make campus playable by friends on a free cloud model (F1).

| Ticket | What | Why | Worker |
|---|---|---|---|
| T-043 Fun-gate measurement | 3 seeded 5-day runs on local qwen; pass/fail per fun-gate proxy; verdict on starting owner cloud play | Decides whether the owner's 1-2h cloud session is worth it | Director (local LM Studio), after int-3 |
| T-044 First-run setup | 3-step setup: provider preset, paste key, test connection, plain results | F1: friends connect a free model without docs | Codex |
| T-045 Free-tier guard | 429/timeout retry with backoff, input never lost, calls/tokens per hour recorded | Free tiers rate-limit; fun gate "input never lost" + "cost recorded" | Codex |
| T-047 Owner picks | Mood-driven voice, jealousy as a word, lust hints only, anniversaries off on campus | Owner answers 2026-10-02 | Codex |
| T-046 Install check | `npm run doctor`, friendlier Windows start scripts, README "Play it" | F1: double-click to play | Space Bunny |

Order: T-044 and T-045 both touch `providers.mjs`, so integrate them together (int-4). T-046 is independent. T-043 runs once int-3 (Wave 4) is merged.
Open owner question: T-040 asks whether a fulfilled want can come back in later weeks (worker default: yes).
