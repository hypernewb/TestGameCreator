# Phone and persistent messages

`social.phone` provides authored contacts and durable message threads. Messages are triggered by committed events, not by narrator invention. Threads retain unread state, player replies, offers, expiry, and acceptance through save replay.

`phoneContacts` lists authorized contacts. Each `phoneMessages` entry defines an ID, sender, text, event trigger, optional replies, and an optional meetup offer. Offers name an authored location and `expiresIn` ticks. Acceptance reuses normal map pathfinding and schedule attendance checks; an absent character cannot be conjured into the meeting by a text message.

This follows the useful asynchronous pressure of Mystic Messenger while keeping time in the game's deterministic tick clock rather than wall-clock notifications. Later `social.feed` work can consume the same events without owning relationship state.

The Creator Studio exposes phone contacts and individual message definitions when the module is enabled. Complex trigger, reply, and offer structures remain JSON-backed within the focused message editor.
