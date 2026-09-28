import {conversation,relationships,schedule,quests} from './social.mjs';
import {inventory} from './inventory.mjs';
import {abilities} from './abilities.mjs';
import {objects} from './objects.mjs';
import {daypart} from './daypart.mjs';
import {worldEvents} from './world-events.mjs';
import {scenes} from './scenes.mjs';
import {facts} from './facts.mjs';
import {equipment} from './equipment.mjs';
import {bonds} from './bonds.mjs';
import {npcSocial} from './npc-social.mjs';
import {economy} from './economy.mjs';
import {stats} from './stats.mjs';
import {progression} from './progression.mjs';
import {dating} from './dating.mjs';
import {romanceNetwork} from './romance-network.mjs';
import {intimacy} from './intimacy.mjs';
import {gossip} from './gossip.mjs';
import {romanceTempo} from './romance-tempo.mjs';
import {phone} from './phone.mjs';
import {endings} from './endings.mjs';
import {feed} from './feed.mjs';
import {timedEvents} from './timed-events.mjs';
import {director} from './director.mjs';
import {moments} from './moments.mjs';
import {calendarWorld} from './calendar.mjs';
export const registry=Object.fromEntries([conversation,relationships,schedule,quests,inventory,abilities,objects,daypart,worldEvents,scenes,facts,equipment,bonds,npcSocial,economy,stats,progression,dating,romanceNetwork,intimacy,gossip,romanceTempo,phone,feed,endings,timedEvents,director,moments,calendarWorld].map(m=>[m.id,m]));
const descriptions={
 'social.conversation':['Character conversation','Enables conversations with characters who share the player’s location.'],
 'social.relationships':['Relationships','Tracks trust changes from recorded conversations.'],
 'world.schedule':['Character schedules','Moves characters between locations as time advances.'],
 'story.quests':['Objectives','Tracks objectives completed by world events.'],
 'items.inventory':['Collectibles and inventory','Tracks item ownership and transfers.'],
 'powers.abilities':['Resources and abilities','Adds a renewable resource and location-based abilities.'],
 'world.objects':['Inspectable objects','Enables searching, inspecting, and using authored objects.'],
 'world.daypart':['Daypart scenes','Adds a daypart transition scene and eligible invitations.'],
 'world.events':['World events','Makes date-windowed events available to the player and AI context.'],
 'story.scenes':['Scripted scenes','Trigger authored scenes from committed actions, test conditions, and apply choice effects.'],
 'story.facts':['Narrative fact ledger','Record sourced scene facts and retrieve them when the subject or topic matters.'],
 'items.equipment':['Equipment','Adds named slots and equip or remove actions for carried items.'],
 'social.bonds':['Relationship dimensions','Adds authored relationship values such as affection, rivalry, or familiarity.'],
 'social.npc':['NPC social life','Characters sharing off-screen locations develop friendships and rivalries at time boundaries.'],
 'world.economy':['Money and shop','Set starting funds and sell priced items at their home location. Activities and scenes can award money.'],
 'character.stats':['Character stats','Adds pack-defined numeric qualities with authored ranges, progression, and visibility.'],
 'social.progression':['Relationship states','Adds authored event-driven relationship stages for each character.'],
 'social.dating':['Attraction and dating','Adds character-specific eligibility, preferences, chemistry, crushes, dates, and explainable romance state.'],
 'social.romance-network':['NPC romance network','Adds directional NPC attraction, existing couples, autonomous courtship, and rival turning points.'],
 'social.intimacy':['Adult intimacy','Adds optional 18+ consent, boundaries, privacy, readiness modes, preference discovery, and intensity presentation.'],
 'social.gossip':['Rumors and gossip','Spreads source-linked, expiring rumors through real NPC contact without global knowledge.'],
 'social.romance-tempo':['Romance pacing and gifts','Adds relationship point banks, scene-gated ranks, gift tastes, cadence limits, and diminishing returns.'],
 'social.phone':['Phone and messages','Adds persistent contacts, unread threads, authored replies, and expiring meetup offers.'],
 'story.endings':['Route endings','Unlocks and commits authored endings from deterministic romance, intimacy, scene, and flag requirements.'],
 'social.feed':['Social feed','Adds persistent event-triggered posts, unread state, and authored reactions.'],
 'story.timed-events':['Timed events','Adds missable tick-window events, attendance checks, and deterministic missed-event recaps.'],
 'world.moments':['Ambient moments','Small things between scenes: found cash, stat nudges, characters dropping in, and chance hooks for authored scenes on moves, waits and exploring.'],
 'story.director':['Drama director','Watches story tension and fires authored complication scenes when play goes quiet: Left 4 Dead pacing, RimWorld storyteller presets, deck-style cooldowns.'],
 'world.calendar':['Holidays, closures, weather','Adds authored holidays, location closures, and daily weather with conditions for scenes, shops, activities, and schedules.']
};
export const moduleCatalog=Object.fromEntries(Object.values(registry).map(m=>[m.id,{id:m.id,version:m.version,requires:m.requires||[],title:descriptions[m.id][0],description:descriptions[m.id][1],group:m.id.split('.')[0]}]));
