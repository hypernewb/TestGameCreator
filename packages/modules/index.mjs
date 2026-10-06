import {academics} from './academics.mjs';
import {jobs} from './jobs.mjs';
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
import {acts} from './acts.mjs';
import {arc} from './arc.mjs';
import {sobriety} from './sobriety.mjs';
import {secrecy} from './secrecy.mjs';
import {minigames} from './minigames.mjs';
import {firsts} from './firsts.mjs';
import {touchLadder} from './touch-ladder.mjs';
import {dailyNeed} from './daily-need.mjs';
import {outreach} from './outreach.mjs';
import {anniversary} from './anniversary.mjs';
import {jealousy} from './jealousy.mjs';
import {wants} from './wants.mjs';
import {goals} from './goals.mjs';
import {recap} from './recap.mjs';
export const registry=Object.fromEntries([academics,jobs,conversation,relationships,schedule,quests,inventory,abilities,objects,daypart,worldEvents,scenes,facts,equipment,bonds,npcSocial,economy,stats,progression,dating,romanceNetwork,intimacy,gossip,romanceTempo,phone,feed,endings,timedEvents,director,moments,calendarWorld,acts,arc,sobriety,secrecy,minigames,firsts,touchLadder,dailyNeed,outreach,anniversary,jealousy,wants,recap,goals].map(m=>[m.id,m]));
const descriptions={
 goals:['Character goals','Creator-authored personal goals with gradual reveal, ordered steps and typed rewards.'],
 'world.academics':['Courses and grades','Configurable course timetables, attendance, authored exam questions, projects, grades and GPA.'],
 'world.jobs':['Jobs and shifts','Configurable openings, requirements, weekly rosters, wages, raises, sick notes and missed-shift settlement.'],
  'story.recap':['Day recap','When a day closes the engine writes a few plain lines about what changed - rungs reached, who warmed or cooled, promises kept or broken, what she let slip - with no numbers and no model call, shown as a morning card and kept in the journal.'],
  'social.wants':['Her own wants','Each heroine carries one or two wants of her own this week, brings them up herself, and is pleased when the player helps: a matching act or a kept plan retires the want for Like, inside the normal daily cap.'],
  'social.daily-need':['Hidden daily need','Picks a quiet daily want per character and rewards reading it from interpreted acts.'],
  'social.jealousy':['Jealousy','Per-heroine meter that reacts to witnessed flirtation or intimacy with rivals, scaled by relationship stage and personality.'],
  'social.conversation':['Character conversation','Enables conversations with characters who share the player\'s location.'],
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
  'social.outreach':['Heroine outreach','Heroines text first: an evening check-in, a plan, a tease, or a "you ignored me" when neglected, on a small daily reply budget.'],
  'story.endings':['Route endings','Unlocks and commits authored endings from deterministic romance, intimacy, scene, and flag requirements.'],
  'social.feed':['Social feed','Adds persistent event-triggered posts, unread state, and authored reactions.'],
  'story.timed-events':['Timed events','Adds missable tick-window events, attendance checks, and deterministic missed-event recaps.'],
  'world.moments':['Ambient moments','Small things between scenes: found cash, stat nudges, characters dropping in, and chance hooks for authored scenes on moves, waits and exploring.'],
  'world.minigames':['Activity minigames','Real-time widgets report a result tier on activities: good and great runs add to the base yield, and a great run can push its luck with a rising mishap chance that the director picks up.'],
  'story.director':['Drama director','Watches story tension and fires authored complication scenes when play goes quiet: Left 4 Dead pacing, RimWorld storyteller presets, deck-style cooldowns.'],
  'world.calendar':['Holidays, closures, weather','Adds authored holidays, location closures, and daily weather with conditions for scenes, shops, activities, and schedules.'],
  'social.acts':['Likes and limits','Prices scene acts against a character\'s likes and limits.'],
  'character.arc':['Character change arc','Drifts hidden traits and reaches named character stages.'],
  'character.sobriety':['Sobriety','Tracks drinks and recovery as dayparts advance.'],
  'social.secrecy':['Secrets and suspicion','Tracks secret relationships, who knows, suspicion with evidence, confrontations, and public reveals.'],
  'social.firsts':['Free-typed firsts','Talk, date, kiss and first night play as typed scenes with engine-held checkpoints scored from act tags; the first-night check-in is required and Stop is always there.'],
  'social.touch-ladder':['Intimate action ladder','Maps a typed physical action to the nearest ladder step and has the engine, not the model, accept, hesitate or refuse it from trust, sobriety and privacy — refusals stay in character with a vague hint.'],
  'social.anniversary':['Anniversaries and shared history','Records key shared moments, marks every 28 days from the dating start, and offers up to two of them to the narrator when the day or the place fits.']
};
export const moduleCatalog=Object.fromEntries(Object.values(registry).map(m=>[m.id,{id:m.id,version:m.version,requires:m.requires||[],title:descriptions[m.id][0],description:descriptions[m.id][1],group:m.id.split('.')[0]}]));