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
export const registry=Object.fromEntries([conversation,relationships,schedule,quests,inventory,abilities,objects,daypart,worldEvents,scenes,facts,equipment,bonds,npcSocial,economy].map(m=>[m.id,m]));
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
 'world.economy':['Money and shop','Set starting funds and sell priced items at their home location. Activities and scenes can award money.']
};
export const moduleCatalog=Object.fromEntries(Object.values(registry).map(m=>[m.id,{id:m.id,version:m.version,requires:m.requires||[],title:descriptions[m.id][0],description:descriptions[m.id][1],group:m.id.split('.')[0]}]));
