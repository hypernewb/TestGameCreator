# Social feed

`social.feed` is an optional event view, not a second relationship system. Authored `feedPosts` listen for committed events and publish once with their source event recorded. Runtime state stores unread status and one optional player reaction.

Each post defines `id`, `author`, `text`, `trigger`, optional `visibility`, and available reaction IDs. Reading emits `social.feedRead`; reacting emits `social.feedReacted` with the post, author, and reaction. A dating signal, progression transition, gossip rule, or scripted scene may listen to that event when the reaction should have consequences.

This arrangement makes public flirting, supportive reactions, jealousy hooks, and event announcements possible without letting generated prose award chemistry or invent posts. The player receives recent posts in AI context; unrelated character narrators do not receive the player's private feed view.
