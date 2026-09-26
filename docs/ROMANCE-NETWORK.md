# NPC romance network

`social.romance-network` extends romance beyond player routes. It stores directional NPC attraction, existing NPC couples, autonomous courtship settings, and rival-pressure turning points.

## Design influences

- The Sims 4 Neighborhood Stories lets creators choose which autonomous life changes can affect a household, and considers character traits rather than giving every NPC identical behavior: <https://www.ea.com/games/the-sims/the-sims-4/news/introducing-neighborhood-stories>
- The Sims 4 Romantic Boundaries make jealousy configurable and negotiable instead of universal: <https://help.ea.com/en/articles/the-sims/the-sims-4/gender-romance-attraction-guide/>
- Crusader Kings III treats seduction and romance as character-directed pursuits with consequential secrets and relationships, rather than a global matchmaking roll: <https://www.paradoxinteractive.com/games/crusader-kings-iii/about>
- Palia explicitly prioritizes consent and comfort and permits multiple love interests rather than assuming one mandatory romantic structure: <https://support.palia.com/hc/en-us/articles/7474617601428-NPCs-Relationships>
- SillyTavern group chats and character cards keep each character's identity distinct while sharing selected context. The network likewise exposes only relationships and pressures a viewer is allowed to know: <https://docs.sillytavern.app/>

The implementation is original and deterministic.

## Pressure, not reassignment

NPCs can begin with existing crushes, dating relationships, agreements, and asymmetric satisfaction. Directional chemistry means A may want B more than B wants A.

When two off-screen NPCs meet, authored autonomy determines whether mutual attraction may create a crush or relationship. A rival interested in the player's monogamous partner must also satisfy authored mutual-attraction thresholds and encounter a sufficiently unhappy partner. Even then, the engine creates a pending `social.rivalPursuitStarted` pressure—not an automatic partner transfer.

The pressure can remain private to its participants, be revealed through a scene, and resolve as:

- `stay`: the partner stays with the player;
- `leave`: the player relationship breaks and the NPC relationship begins; or
- `open`: the player agreement is renegotiated and the NPC relationship begins under an open structure.

These outcomes are committed scripted effects. Generated prose cannot choose one.

## Authored controls

- Per-character autonomy: `off`, `turning-point`, or `full`.
- Directional attraction values.
- Pursuit, autonomous commitment, and rival thresholds.
- Satisfaction threshold for considering another relationship.
- Immediate or participant-only rivalry visibility.
- Existing NPC couples and agreements.
- Scripted changes to NPC attraction and relationship state.
- Reveal and resolution effects for rival pressures.

The simulation runs only for configured characters sharing an off-screen location and skips the active scene cast. This keeps outcomes physically grounded and computationally bounded.
