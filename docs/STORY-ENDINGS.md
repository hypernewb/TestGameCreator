# Authored route endings

`story.endings` separates ending eligibility from generated prose. An ending may require flags, dating phases, romance ranks, intimacy encounter counts, and completed scripted scenes. Requirements are re-evaluated after committed events. The module emits `story.endingUnlocked` once and exposes a `story.chooseEnding` action; selection emits `story.endingChosen` and is permanent for that campaign branch.

This supports long romantic endings, casual arrangements, breakup outcomes, ensemble endings, and adult-route conclusions without assuming that every route ends in monogamy. The narrator receives only unlocked endings and cannot unlock or select one through prose.

The Creator Studio exposes individual ending definitions and their requirement objects when `story.endings` is enabled.
