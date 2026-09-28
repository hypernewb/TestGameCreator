# Human playtest checklist (F12)

The bots and `npm run fun` measure the automatable half of the fun gate (`docs/NEXT-MILESTONES.md#fun-gate`). This sheet covers the half only a person can answer. Budget: one 45-minute session per tester, three testers per gate check.

## Before
- Fresh campaign in the desktop app, `minimal` preset, the pack under test (F1: `after-hours`).
- Tester has not seen the pack. Tell them only the premise line and "play however you like; think out loud."
- Observer has this sheet, a clock, and nothing to say. **Silent observer** (Valve-style): no hints, no explaining the UI. If they are stuck for 60 s, note it; only step in after 3 minutes.

## During: timestamp these, one line each
| Mark | Write down |
|---|---|
| **B** boredom | sighs, skimming, "ok…", clicking Wait twice in a row, checking phone |
| **D** delight | laughs, leans in, reads a line aloud, "oh!" |
| **C** confusion | "what do I do", re-reading the action list, typing something the game refuses |
| **G** goal said aloud | any "I want to…", "I'm trying to get…". Who and what |
| **R** repetition noticed | "didn't she just say that?" |

Healthy target (after L4D's intensity pacing): no stretch longer than ~3 minutes without a D or a G, and no two B marks in a row without a D in between.

## After: five questions, in this order, answers verbatim
1. **What were you working toward, with each character?** (Persona-style: can they name a goal per route? This is the "players can say what they're working toward" gate.)
2. Name one thing you found out about someone that you didn't know at the start. (Tests whether discovery/preferences land.)
3. What was the moment you remember most? Was it one you chose, or one that happened to you?
4. Was there a point you wanted to stop? When?
5. **Would you start a second run? What would you do differently?** (The "2 of 3 would replay" gate. "Differently" tests whether they saw roads not taken.)

## Then run the numbers
```
npm run fun -- --campaign latest
```
This opens `data/campaigns.sqlite` read-only. Narrated turns carry `playedAt` stamps, so the timing is real (`fun[stamped]`). Paste the `fun:` and `gate:` lines under the tester's answers.

## Recording
Append one block per tester to `docs/TEST-RESULTS.txt`: date, pack version, the two metric lines, B/D/C/G counts, the five answers, and one line on "what to fix first". The gate passes when 3 testers are recorded, at least 2 answer yes to Q5, and all 3 can answer Q1.
