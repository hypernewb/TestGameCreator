import {routeConditionReasons,validateRouteConditions} from './route-conditions.mjs';
import {assert,safeKey} from '../core/engine.mjs';
import {calendarFor,WEEKDAYS,PERIODS} from '../../public/calendar.mjs';
import {bondKey} from './bonds.mjs';
import {statValue} from './stats.mjs';
import {heldBy} from './inventory.mjs';

// One deterministic condition language (`when`) shared by scripted scenes, scene choices and lorebook entries.
// Every check reads committed world state only, so a gate can never be satisfied by model prose.
export function validateConditions(when,p,label){
 const locations=new Set(p.locations.map(l=>l.id)),actors=new Set(p.actors.map(a=>a.id)),items=new Set((p.items||[]).map(i=>i.id));
 assert(when&&typeof when==='object'&&!Array.isArray(when),`${label}: expected an object`);
 if(when.location)assert(locations.has(when.location),`${label}.location: unknown`);
 if(when.weekdays)assert(Array.isArray(when.weekdays)&&when.weekdays.every(day=>WEEKDAYS.includes(day)),`${label}.weekdays: invalid`);
 if(when.dayparts)assert(Array.isArray(when.dayparts)&&when.dayparts.every(part=>PERIODS.includes(part)),`${label}.dayparts: invalid`);
 for(const [id,place] of Object.entries(when.charactersAt||{}))assert(actors.has(id)&&id!==p.playerId&&locations.has(place),`${label}.charactersAt: invalid`);
 for(const id of when.present||[])assert(actors.has(id)&&id!==p.playerId,`${label}.present: invalid`);
 for(const [id,min] of Object.entries(when.attention||{}))assert(actors.has(id)&&id!==p.playerId&&p.modules['story.director']&&Number.isInteger(min)&&min>=1&&min<=10,`${label}.attention: expected 1–10 with story.director present`);
 for(const k of ['minTick','maxTick'])if(when[k]!==undefined)assert(Number.isInteger(when[k])&&when[k]>=0,`${label}.${k}: invalid`);
 if(when.maxTick!==undefined&&when.minTick!==undefined)assert(when.maxTick>=when.minTick,`${label}: invalid time range`);
 const variables=new Set((p.storyVariables||[]).map(x=>x.id));for(const [id,value] of Object.entries(when.flags||{}))assert(safeKey(id)&&(!variables.size||variables.has(id))&&typeof value==='boolean',`${label}.flags: invalid or undefined variable ${id}`);
 for(const id of when.items||[])assert(items.has(id)&&p.modules['items.inventory'],`${label}.items: inventory item required`);
 for(const [id,value] of Object.entries(when.trust||{}))assert(actors.has(id)&&id!==p.playerId&&p.modules['social.relationships']&&Number.isInteger(value)&&value>=0&&value<=100,`${label}.trust: invalid`);
 for(const id of when.completedScenes||[])assert((p.scriptedScenes||[]).some(s=>s.id===id),`${label}.completedScenes: unknown scene ${id}`);
 for(const [id,status] of Object.entries(when.plans||{}))assert(safeKey(id)&&['pending','kept','broken','none'].includes(status),`${label}.plans: expected pending, kept, broken or none`);
 validateExtraConditions(when,p,label);
 validateRouteConditions(when,p);
}
export function validateExtraConditions(when,p,label){
 if(when.goalStep!==undefined){assert(when.goalStep&&typeof when.goalStep==='object'&&!Array.isArray(when.goalStep),`${label}.goalStep: expected character/step map`);for(const [id,step] of Object.entries(when.goalStep))assert(p.modules.goals&&(p.characterSheets||[]).some(s=>s.actorId===id&&s.goal?.steps?.some(x=>x.id===step)),`${label}.goalStep: unknown goal step`);}
 const actorIds=new Set(p.actors.filter(a=>a.id!==p.playerId).map(a=>a.id)),items=new Map((p.items||[]).map(i=>[i.id,i])),dimensions=new Set((p.relationshipDimensions||[]).map(d=>d.id));
 const stats=new Set((p.statDefinitions||[]).map(x=>x.id)),states=new Set((p.relationshipStates||[]).map(x=>x.id));
 assert(Array.isArray(when.equipped||[])&&Array.isArray(when.bonds||[])&&Array.isArray(when.stats||[]),`${label}: equipment, bond, and stat requirements must be arrays`);
 for(const id of when.equipped||[])assert(p.modules['items.equipment']&&items.get(id)?.slot,`${label}.equipped: invalid equipment`);
 for(const r of when.bonds||[])assert(p.modules['social.bonds']&&actorIds.has(r.character)&&dimensions.has(r.dimension)&&Number.isInteger(r.min)&&r.min>=0&&r.min<=100,`${label}.bonds: invalid requirement`);
 for(const r of when.stats||[])assert(p.modules['character.stats']&&[p.playerId,...actorIds].includes(r.character)&&stats.has(r.stat)&&[r.min,r.max].filter(x=>x!==undefined).length>0&&[r.min,r.max].filter(x=>x!==undefined).every(Number.isInteger),`${label}.stats: invalid requirement`);
 for(const [character,state] of Object.entries(when.relationshipStates||{}))assert(p.modules['social.progression']&&actorIds.has(character)&&states.has(state),`${label}.relationshipStates: invalid requirement`);
 for(const [id,phase] of Object.entries(when.datingPhases||{}))assert(p.modules['social.dating']&&(p.datingProfiles||[]).some(x=>x.character===id)&&['available','crush','dating','exclusive','rejected','broken'].includes(phase),`${label}.datingPhases: invalid requirement`);
 if(when.weather!==undefined)assert(p.modules['world.calendar']&&(p.calendar?.weather||[]).some(k=>k.id===when.weather),`${label}.weather: unknown weather kind (needs world.calendar)`);
 if(when.holiday!==undefined)assert(p.modules['world.calendar']&&typeof when.holiday==='boolean',`${label}.holiday: expected a boolean (needs world.calendar)`);
}

export function conditionReasons(when,state,pack,pages=[]){
  when||={};const reasons=[],location=state.actors[pack.playerId].location;
  for(const [id,step] of Object.entries(when.goalStep||{}))if(!pack.modules.goals||!state.modules.goals?.[id]?.completed?.includes(step))reasons.push(`${id} goal step ${step}: not completed`);
  const clock=calendarFor(state.tick,pack);
  if(when.location&&when.location!==location)reasons.push(`Player location: ${location}; needs ${when.location}`);
  for(const page of pages)if(page.speaker&&state.actors[page.speaker]?.location!==location)reasons.push(`${page.speaker} is at ${state.actors[page.speaker]?.location}; needs to be here to speak`);
  if(when.weekdays?.length&&!when.weekdays.includes(clock.weekday))reasons.push(`Weekday: ${clock.weekday}; needs ${when.weekdays.join(' or ')}`);
  if(when.dayparts?.length&&!when.dayparts.includes(clock.daypart))reasons.push(`Daypart: ${clock.daypart}; needs ${when.dayparts.join(' or ')}`);
  for(const [id,place] of Object.entries(when.charactersAt||{}))if(state.actors[id]?.location!==place)reasons.push(`${id} is at ${state.actors[id]?.location}; needs ${place}`);
  for(const id of when.present||[])if(state.actors[id]?.location!==location)reasons.push(`${id} is at ${state.actors[id]?.location}; needs to be here`);
  for(const [id,min] of Object.entries(when.attention||{})){const actual=state.modules['story.director']?.attention?.[id]||0;if(actual<min)reasons.push(`Recent time with ${id}: ${actual}; needs ${min}`);}
  if(when.minTick!==undefined&&state.tick<when.minTick)reasons.push(`Tick ${state.tick}; starts at ${when.minTick}`);
  if(when.maxTick!==undefined&&state.tick>when.maxTick)reasons.push(`Tick ${state.tick}; ended at ${when.maxTick}`);
  for(const [id,value] of Object.entries(when.flags||{}))if(Boolean(state.flags[id])!==value)reasons.push(`Flag ${id}: ${Boolean(state.flags[id])}; needs ${value}`);
  for(const id of when.items||[])if(heldBy(state,id,pack.playerId)<1)reasons.push(`Item ${id} is not carried`);
  for(const id of when.equipped||[])if(!Object.values(state.modules['items.equipment']?.slots||{}).includes(id))reasons.push(`Item ${id} is not equipped`);
  for(const requirement of when.bonds||[]){const actual=state.modules['social.bonds']?.values[bondKey(requirement.character,requirement.dimension,pack.playerId)]||0;if(actual<requirement.min)reasons.push(`${requirement.character} ${requirement.dimension}: ${actual}; needs ${requirement.min}`);}
  for(const requirement of when.stats||[]){const actual=statValue(state,requirement.character,requirement.stat);if(requirement.min!==undefined&&actual<requirement.min)reasons.push(`${requirement.character} ${requirement.stat}: ${actual}; needs ${requirement.min}`);if(requirement.max!==undefined&&actual>requirement.max)reasons.push(`${requirement.character} ${requirement.stat}: ${actual}; maximum ${requirement.max}`);}
  for(const [character,required] of Object.entries(when.relationshipStates||{})){const actual=state.modules['social.progression']?.states[character];if(actual!==required)reasons.push(`${character} relationship: ${actual||'none'}; needs ${required}`);}
  for(const [character,required] of Object.entries(when.datingPhases||{})){const actual=state.modules['social.dating']?.characters[character]?.phase;if(actual!==required)reasons.push(`${character} dating phase: ${actual||'none'}; needs ${required}`);}
  if(when.weather!==undefined&&state.modules['world.calendar']?.weather!==when.weather)reasons.push(`Weather: ${state.modules['world.calendar']?.weather||'none'}; needs ${when.weather}`);
  if(when.holiday!==undefined&&Boolean(state.modules['world.calendar']?.holiday)!==when.holiday)reasons.push(when.holiday?'Today is not a holiday; needs one':'Today is a holiday; needs none');
  for(const [id,min] of Object.entries(when.trust||{})){const actual=state.modules['social.relationships']?.edges[`${id}--${pack.playerId}`]||0;if(actual<min)reasons.push(`Trust with ${id}: ${actual}; needs ${min}`);}
  for(const id of when.completedScenes||[])if(!(state.modules['story.scenes']?.completed||[]).includes(id))reasons.push(`Scene ${id} not completed yet`);
  for(const [id,required] of Object.entries(when.plans||{})){const actual=(state.modules['story.scenes']?.plans||[]).filter(x=>x.id===id).at(-1)?.status||'none';if(actual!==required)reasons.push(`Plan ${id}: ${actual}; needs ${required}`);}
  return [...reasons,...routeConditionReasons(when,state,pack)];
}

// Stat checks are deterministic: base stat + equipped gear + situational modifiers against a visible target. No dice, so the
// player can plan (train, dress, pick the moment) and replay stays exact.
export function statCheck(state,pack,check){
  const parts=[],slots=Object.values(state.modules['items.equipment']?.slots||{});
  for(const id of slots){const item=(pack.items||[]).find(i=>i.id===id),bonus=item?.statBonus?.[check.stat];if(bonus)parts.push({label:item.name||id,value:bonus});}
  for(const m of check.modifiers||[])if(!conditionReasons(m.when,state,pack).length)parts.push({label:m.label,value:m.value});
  const base=statValue(state,pack.playerId,check.stat),value=base+parts.reduce((n,x)=>n+x.value,0);
  return {stat:check.stat,target:check.target,base,value,passed:value>=check.target,modifiers:parts};
}
