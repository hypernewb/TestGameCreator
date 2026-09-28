import {validatePack,safeKey,digest} from '../core/engine.mjs';
import {registry} from '../modules/index.mjs';
import {parseModelObject} from './json.mjs';
import {PERIODS} from '../../public/calendar.mjs';

const clone=value=>structuredClone(value);
const text=(value,name,max=4000)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(`${name}: required text (maximum ${max} characters)`);return value.trim();};
const few=(v,n)=>Array.isArray(v)?v.filter(x=>typeof x==='string'&&x.trim()).slice(0,n):v;
const strings=(value,name,maxItems=12,maxLength=500)=>{if(!Array.isArray(value)||value.length>maxItems||value.some(x=>typeof x!=='string'||!x.trim()||x.length>maxLength))throw Error(`${name}: invalid list`);return value.map(x=>x.trim());};

export function authoringContext(pack){
 return {
  project:{premise:pack.gameProject?.premise||'',setting:pack.gameProject?.setting||'',writingStyle:pack.gameProject?.writingStyle||''},
  playerId:pack.playerId,
  modules:Object.keys(pack.modules||{}),
  locations:pack.locations.map(({id,name,description,background,exits})=>({id,name,description,background:background||'',exits:(exits||[]).map(e=>e.to)})),
  existingCharacters:pack.actors.map(({id,name,location,pronouns,description,style,goal,traits,backstory,likes,dislikes,voice,poses})=>({id,name,location,pronouns:pronouns||'',description:description||'',style:style||'',goal:goal||'',traits:traits||[],backstory:backstory||'',likes:likes||[],dislikes:dislikes||[],voice:voice||'',poseIds:(poses||[]).map(x=>x.id)})),
  lore:(pack.lorebook||[]).map(({id,text,scope,location,character,knownBy,tags})=>({id,text,scope,location,character,knownBy,tags:tags||[]})),
  facts:(pack.facts||[]).map(({id,text,knownBy})=>({id,text,knownBy})),
  existingScenes:(pack.scriptedScenes||[]).map(({id,title,opening,trigger,when})=>({id,title,opening,trigger,when})),
  items:(pack.items||[]).map(({id,name})=>({id,name})),
  objects:(pack.objects||[]).map(({id,name,location,effectFlag})=>({id,name,location,effectFlag})),
  stats:(pack.statDefinitions||[]).map(({id,name})=>({id,name})),
  activities:(pack.activities||[]).map(({id,name,location,description})=>({id,name,location,description})),
  ...(pack.timedEvents?.length?{events:pack.timedEvents.map(({id,name,location,character,startTick})=>({id,name,location,character,startTick}))}:{}),
  allowedStageActions:['show:character-id','hide:character-id','sprite:character-id,existing-pose-id'],
  rules:['Use only listed location and item IDs.','Do not create image paths or poses.','Every scene and beat needs at least one unconditional choice.','Prefer core.inspected with match.location for ordinary location scenes.','Use only flag, memory, trust, or existing-item effects; trust requires social.relationships and items require items.inventory.']
 };
}

// World population (authoring time): objects to examine/use, items hidden among candidate spots (one is picked per campaign seed), and stat-raising activities.
function normalizeWorld(out,pack,{objectCount=0,itemCount=0,activityCount=0}){
 if((objectCount||itemCount)&&!pack.modules?.['world.objects'])throw Error('The pack must enable world.objects before generating objects or hidden items');
 for(const [key,n] of [['objects',objectCount],['items',itemCount],['activities',activityCount]]){const list=out[key]||[];if(!Array.isArray(list))throw Error(`${key}: expected an array`);if(list.length!==n)throw Error(`Model returned ${list.length} ${key}; expected ${n}`);}
 const locations=new Set(pack.locations.map(x=>x.id)),stats=new Set((pack.statDefinitions||[]).map(x=>x.id)),used=new Set([...(pack.objects||[]),...(pack.items||[]),...(pack.activities||[])].map(x=>x.id)),id=(v,name)=>{if(!safeKey(v)||used.has(v))throw Error(`${name}.id: invalid or already used`);used.add(v);return v;};
 const itemIds=new Set([...(pack.items||[]),...(out.items||[])].map(x=>x?.id)),objectIds=new Set([...(pack.objects||[]),...(out.objects||[])].map(x=>x?.id)),flags=new Set([...(pack.objects||[]),...(out.objects||[])].map(x=>x?.effectFlag).filter(Boolean));
 const objects=(out.objects||[]).map((o,i)=>{const n=`objects[${i}]`,v={id:id(o.id,n),name:text(o.name,`${n}.name`,120),location:o.location,description:text(o.description,`${n}.description`,800)};if(!locations.has(o.location))throw Error(`${n}.location: unknown`);
  if(o.effectFlag!=null){if(!safeKey(o.effectFlag))throw Error(`${n}.effectFlag: invalid`);v.effectFlag=o.effectFlag;v.useText=text(o.useText,`${n}.useText`,800);}
  if(o.requiresItem!=null){if(!itemIds.has(o.requiresItem)||!v.effectFlag)throw Error(`${n}.requiresItem: needs a known item and an effectFlag`);v.requiresItem=o.requiresItem;}return v;});
 const items=(out.items||[]).map((it,i)=>{const n=`items[${i}]`,v={id:id(it.id,n),name:text(it.name,`${n}.name`,120),description:text(it.description,`${n}.description`,500),hidden:true,hideIn:strings(it.hideIn,`${n}.hideIn`,4,80)};
  if(!v.hideIn.length||v.hideIn.some(x=>!objectIds.has(x)))throw Error(`${n}.hideIn: list 1-4 known object ids`);
  if([...(pack.objects||[]),...objects].some(o=>o.requiresItem===v.id&&v.hideIn.includes(o.id)))throw Error(`${n}.hideIn: an item cannot hide inside the object it unlocks`);
  if(it.statBonus!=null){if(!pack.modules?.['items.equipment']||typeof it.statBonus!=='object'||!Object.keys(it.statBonus).length||Object.entries(it.statBonus).some(([k,d])=>!stats.has(k)||!Number.isInteger(d)||d<1||d>2))throw Error(`${n}.statBonus: 1-2 points in known stats (needs items.equipment)`);v.slot='accessory';v.statBonus=clone(it.statBonus);}return v;});
 const activities=(out.activities||[]).map((a,i)=>{const n=`activities[${i}]`,v={id:id(a.id,n),name:text(a.name,`${n}.name`,120),description:text(a.description,`${n}.description`,800),location:a.location,duration:a.duration,phrases:strings(a.phrases,`${n}.phrases`,6,60),effects:[]};
  if(!locations.has(a.location))throw Error(`${n}.location: unknown`);if(!Number.isInteger(a.duration)||a.duration<1||a.duration>4)throw Error(`${n}.duration: expected 1-4`);
  if(!Array.isArray(a.effects)||!a.effects.length||a.effects.length>3)throw Error(`${n}.effects: 1-3 effects`);
  for(const e of a.effects){if(e?.type==='stat'&&stats.has(e.stat)&&Number.isInteger(e.delta)&&e.delta>=1&&e.delta<=2)v.effects.push({type:'stat',stat:e.stat,delta:e.delta});else if(e?.type==='money'&&pack.modules?.['world.economy']&&Number.isInteger(e.delta)&&Math.abs(e.delta)<=20)v.effects.push({type:'money',delta:e.delta});else throw Error(`${n}.effects: use stat (+1/+2 in a known stat) or money (±20)`);}
  if(a.requiresFlag!=null){if(!flags.has(a.requiresFlag))throw Error(`${n}.requiresFlag: must be an object's effectFlag`);v.requiresFlag=a.requiresFlag;}return v;});
 return {objects,items,activities};
}

// New places: exits name existing or sibling ids; every new place must reach the existing map. Exits become two-way on merge.
export function normalizeLocations(list,existing,n){
 if(!Array.isArray(list??=[]))throw Error('locations: expected an array');if(list.length!==n)throw Error(`Model returned ${list.length} locations; expected ${n}`);
 const have=new Set(existing.map(l=>l.id)),fresh=new Set();
 for(const [i,l] of list.entries()){if(!safeKey(l?.id)||fresh.has(l?.id))throw Error(`locations[${i}].id: invalid or already used`);if(have.has(l.id))throw Error(`locations[${i}].id: "${l.id}" already exists; new locations need new ids`);fresh.add(l.id);}
 // Exits to places nobody defined are dropped (small models invent hallways); a place left with no way in still fails below.
 const dropped=new Set(),out=list.map((l,i)=>{const n=`locations[${i}]`,exits=[...new Set(strings(l.exits,`${n}.exits`,6,80))].filter(x=>x!==l.id&&(have.has(x)||fresh.has(x)||!dropped.add(x)));return {id:l.id,name:text(l.name,`${n}.name`,120),description:text(l.description,`${n}.description`,800),exits:exits.map(to=>({to}))};});
 const reach=new Set(have.size?have:out.slice(0,1).map(l=>l.id));for(let grew=true;grew;){grew=false;for(const l of out){const inside=reach.has(l.id);if(!inside&&l.exits.some(e=>reach.has(e.to))){reach.add(l.id);grew=true;}else if(inside)for(const e of l.exits)if(!reach.has(e.to)){reach.add(e.to);grew=true;}}}
 const lost=out.find(l=>!reach.has(l.id));if(lost)throw Error(`locations.${lost.id}.exits: not connected to the rest of the map; list ids of ${have.size?'existing or ':''}new locations${dropped.size?` (unknown ids ignored: ${[...dropped].join(', ')})`:''}`);
 return out;
}
// Adds the reverse of every exit and drops exits to places that are not in the pack (unapproved siblings).
export const linkExits=locations=>{const ids=new Set(locations.map(l=>l.id)),next=locations.map(l=>({...l,exits:(l.exits||[]).filter(e=>ids.has(e.to))}));for(const l of next)for(const e of l.exits){const back=next.find(x=>x.id===e.to);if(!back.exits.some(x=>x.to===l.id))back.exits=[...back.exits,{to:l.id}];}return next;};

// Timed events in calendar terms (day + daypart) → story.timed-events tick windows lasting one daypart.
function normalizeEvents(list,pack,n){
 if(!Array.isArray(list??=[]))throw Error('events: expected an array');if(list.length!==n)throw Error(`Model returned ${list.length} events; expected ${n}`);
 if(n&&!pack.modules?.['story.timed-events'])throw Error('The pack must enable story.timed-events before generating events');
 const interval=pack.daypart?.interval||4,days=pack.run?.days||28,locations=new Set(pack.locations.map(x=>x.id)),cast=new Set(pack.actors.filter(a=>a.id!==pack.playerId).map(a=>a.id)),used=new Set((pack.timedEvents||[]).map(x=>x.id));
 return list.map((e,i)=>{const n=`events[${i}]`;if(!safeKey(e?.id)||used.has(e.id))throw Error(`${n}.id: invalid or already used`);used.add(e.id);
  if(!Number.isInteger(e.day)||e.day<1||e.day>days)throw Error(`${n}.day: expected 1-${days}`);const slot=PERIODS.indexOf(e.daypart);if(slot<0)throw Error(`${n}.daypart: expected ${PERIODS.join(', ')}`);
  if(!locations.has(e.location))throw Error(`${n}.location: unknown`);if(e.character!=null&&!cast.has(e.character))throw Error(`${n}.character: unknown`);
  const startTick=((e.day-1)*PERIODS.length+slot)*interval;
  return {id:e.id,name:text(e.name,`${n}.name`,120),location:e.location,...(e.character!=null?{character:e.character}:{}),startTick,endTick:startTick+interval-1,attendedText:text(e.attendedText,`${n}.attendedText`,800),missedRecap:text(e.missedRecap,`${n}.missedRecap`,400)};});
}

// Small models write speakers as display names ("Zoey") or put stage directions there. Names become ids; prose moves into the
// page text as narration. Pages spoken by the player are dropped (choices are the player's voice). Stage entries become
// show:/hide: actions ({characterId:"rumi",action:"…"} → "show:rumi"); prose cues are dropped. Anything else is left for validation.
export function tidyScenes(scenes,cast,player={}){
 const me=new Set(['you','player','me',player.id,player.name].filter(Boolean).map(x=>x.toLowerCase())),mine=p=>typeof p?.speaker==='string'&&me.has(p.speaker.trim().toLowerCase()),pages=list=>{const kept=list.filter(p=>!mine(p));return (kept.length?kept:list).map(page);};
 const find=v=>{if(typeof v!=='string')return;const k=v.trim().toLowerCase();return cast.find(a=>a.id===k||a.name?.toLowerCase()===k||a.name?.split(/\s+/)[0].toLowerCase()===k)?.id;};
 const cue=x=>{if(typeof x==='string'){if(/^sprite:/.test(x))return x;const m=x.match(/^(show|hide):(.+)$/),id=m&&find(m[2]);return id?`${m[1]}:${id}`:null;}const id=x&&typeof x==='object'&&find(x.characterId??x.character??x.charKey??x.id);return id?`show:${id}`:null;};
 const stage=v=>Array.isArray(v)?{stage:[...new Set(v.map(cue).filter(Boolean))]}:{};
 // Missing choice ids come from the label; repeats get -2, -3…
 const choices=v=>{if(!Array.isArray(v))return {};const used=new Set();return {choices:v.map((c,i)=>{if(!c||typeof c!=='object')return c;const base=typeof c.id==='string'&&c.id.trim()?c.id.trim():(typeof c.label==='string'?c.label.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40):'')||`choice-${i+1}`;let id=base,n=2;while(used.has(id))id=`${base}-${n++}`;used.add(id);return {...c,id};})};};
 const page=p=>{if(!p||typeof p!=='object')return p;p={...p,...stage(p.stage)};if(p.speaker==null||typeof p.speaker==='string'&&!p.speaker.trim()){const {speaker,...rest}=p;return rest;}if(typeof p.speaker!=='string')return p;
  const id=find(p.speaker);if(id)return {...p,speaker:id};if(/[*()]/.test(p.speaker)||p.speaker.trim().split(/\s+/).length>4||p.speaker.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean).every(find)){const {speaker,...rest}=p;return {...rest,text:[speaker.trim(),typeof p.text==='string'?p.text.trim():''].filter(Boolean).join('\n')};}return p;};
 return (Array.isArray(scenes)?scenes:[]).map(s=>s&&typeof s==='object'?{...s,...stage(s.stage),...choices(s.choices),...(Array.isArray(s.pages)?{pages:pages(s.pages)}:{}),...(Array.isArray(s.beats)?{beats:s.beats.map(b=>b&&Array.isArray(b.pages)?{...b,...choices(b.choices),pages:pages(b.pages)}:b)}:{})}:s);
}

// "main_party_room" or "Main Party Room" → "main-party-room" when exactly one known place (or person) matches loosely.
const canon=v=>v.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const loose=known=>v=>{if(typeof v!=='string'||known.some(k=>k.id===v))return v;const m=new Set(known.filter(k=>canon(k.id)===canon(v)||k.name&&canon(k.name)===canon(v)).map(k=>k.id));return m.size===1?[...m][0]:v;};
function resolveRefs(out,pack){
 const place=loose([...pack.locations,...(Array.isArray(out.locations)?out.locations.filter(l=>typeof l?.id==='string'):[])]),who=loose([...pack.actors,...(Array.isArray(out.characters)?out.characters.filter(a=>typeof a?.id==='string'):[])].filter(a=>a.id!==pack.playerId));
 for(const l of Array.isArray(out.locations)?out.locations:[])if(Array.isArray(l?.exits))l.exits=l.exits.map(place);
 for(const k of ['characters','objects','activities','events'])for(const x of Array.isArray(out[k])?out[k]:[])if(x&&typeof x==='object'){if('location' in x)x.location=place(x.location);if(k==='events'&&'character' in x)x.character=who(x.character);}
 for(const x of Array.isArray(out.scenes)?out.scenes:[]){const m=x?.trigger?.match;if(m&&typeof m==='object')for(const k of ['location','to'])if(k in m)m[k]=place(m[k]);}
 return out;
}

// Generated scenes fire on the two triggers every pack has: looking around a place, or arriving there (event → its match field).
const TRIGGERS={'core.inspected':'location','core.moved':'to'};
export function normalizeCandidate(raw,pack,{characterCount=0,sceneCount=0,locationCount=0,eventCount=0,...world},{strict=false}={}){
 const out=resolveRefs(structuredClone(parseModelObject(raw)),pack);if(!characterCount)out.characters??=[];if(!sceneCount)out.scenes??=[];
 if(!Array.isArray(out.characters)||!Array.isArray(out.scenes))throw Error('Model output needs characters and scenes arrays');
 if(out.characters.length!==characterCount)throw Error(`Model returned ${out.characters.length} characters; expected ${characterCount}`);
 if(out.scenes.length!==sceneCount)throw Error(`Model returned ${out.scenes.length} scenes; expected ${sceneCount}`);
 // Small models re-list the card's people and places. strict (a first attempt) fails so a repair can ask again; otherwise copies are skipped.
 const skipped=[],old=(list,k)=>{const known=new Set(list.flatMap(x=>[x.id,x.name&&canon(x.name)]).filter(Boolean));return x=>{const dup=x&&typeof x==='object'&&(known.has(x.id)||typeof x.name==='string'&&known.has(canon(x.name))&&k==='characters');if(dup)skipped.push(`${k}: ${x.id||x.name}`);return !dup;};};
 out.characters=out.characters.filter(old(pack.actors,'characters'));if(Array.isArray(out.locations)){if(out.locations.length!==locationCount)throw Error(`Model returned ${out.locations.length} locations; expected ${locationCount}`);out.locations=out.locations.filter(old(pack.locations.map(({id})=>({id})),'locations'));}
 if(strict&&skipped.length)throw Error(`${skipped.join(', ')} already exist${skipped.length>1?'':'s'}; characters[] and locations[] hold only NEW people and places with new ids`);
 const newLocations=normalizeLocations(out.locations,pack.locations,out.locations?.length??locationCount),mapped={...pack,locations:[...pack.locations,...newLocations]};
 const locations=new Set(mapped.locations.map(x=>x.id)),ids=new Set(pack.actors.map(x=>x.id));
 const characters=out.characters.map((a,i)=>{
  if(!safeKey(a.id))throw Error(`characters[${i}].id: invalid`);if(ids.has(a.id))throw Error(`characters[${i}].id: "${a.id}" already exists; create new people, not existing characters`);ids.add(a.id);
  if(!locations.has(a.location))throw Error(`characters[${i}].location: unknown`);
  return {id:a.id,name:text(a.name,`characters[${i}].name`,120),location:a.location,pronouns:text(a.pronouns,`characters[${i}].pronouns`,40),description:text(a.description,`characters[${i}].description`,1000),style:text(a.style,`characters[${i}].style`,500),goal:text(a.goal,`characters[${i}].goal`,500),traits:strings(few(a.traits,8),`characters[${i}].traits`,8,120),backstory:text(a.backstory,`characters[${i}].backstory`,1500),likes:strings(few(a.likes,8),`characters[${i}].likes`,8,120),dislikes:strings(few(a.dislikes,8),`characters[${i}].dislikes`,8,120),voice:text(a.voice,`characters[${i}].voice`,500)};
 });
 const scenes=tidyScenes(clone(out.scenes),[...pack.actors,...characters].filter(a=>a.id!==pack.playerId),pack.actors.find(a=>a.id===pack.playerId)),{objects,items,activities}=normalizeWorld(out,mapped,world),events=normalizeEvents(out.events,{...mapped,actors:[...pack.actors,...characters]},eventCount),all=list=>list.map(value=>({status:'approved',value}));
 scenes.forEach((x,i)=>{const t=x?.trigger,k=TRIGGERS[t?.event];if(!k||!Object.keys(t.match||{}).every(f=>f===k)||!locations.has(t.match?.[k]))throw Error(`scenes[${i}].trigger: use {"event":"core.inspected","match":{"location":id}} or {"event":"core.moved","match":{"to":id}} with a known location id`);});
 const merged=mergeApproved(pack,{locations:all(newLocations),characters:all(characters),scenes:all(scenes),objects:all(objects),items:all(items),activities:all(activities),events:all(events)});
 try{validatePack(merged,registry);}catch(e){if(/speaker: unknown/.test(e.message))e.message+=`; a speaker is one of ${[...ids].filter(x=>x!==pack.playerId).join(', ')}, or empty for narration (the player never speaks in a page)`;throw e;}
 return {locations:newLocations,characters,scenes,objects,items,activities,events,skipped};
}

export function createProposal(pack,candidate,meta={}){
 return {format:'story-framework-ai-authoring-proposal',version:1,createdAt:new Date().toISOString(),source:{packId:pack.id,packVersion:pack.version,digest:digest(pack)},request:meta,...Object.fromEntries(KINDS.map(k=>[k,(candidate[k]||[]).map(value=>({status:'pending',value}))]))};
}

export const KINDS=['locations','characters','scenes','objects','items','activities','events'];
export function mergeApproved(pack,proposal){
 const next=clone(pack),approved=list=>(list||[]).filter(x=>x?.status==='approved').map(x=>clone(x.value));
 const places=approved(proposal.locations);if(places.length)next.locations=linkExits([...next.locations,...places]);
 next.actors=[...next.actors,...approved(proposal.characters)];
 next.scriptedScenes=[...(next.scriptedScenes||[]),...approved(proposal.scenes)];
 for(const [key,to=key] of [['objects'],['items'],['activities'],['events','timedEvents']]){const add=approved(proposal[key]);if(add.length)next[to]=[...(next[to]||[]),...add];}
 return next;
}

export function applyProposal(pack,proposal){
 if(proposal?.format!=='story-framework-ai-authoring-proposal'||proposal.version!==1)throw Error('Unsupported proposal file');
 if(proposal.source?.packId!==pack.id)throw Error(`Proposal was made for ${proposal.source?.packId||'an unknown pack'}, not ${pack.id}`);
 if(proposal.source?.digest!==digest(pack))throw Error('The source pack changed after this proposal was generated; generate a fresh proposal');
 const next=mergeApproved(pack,proposal);validatePack(next,registry);return next;
}

// JSON schema matching messagesFor, for servers that enforce structured output: exact counts and required fields, so small
// models cannot stop early or drop fields. Location ids are pinned when no new places are requested. Stage cues are strings (show:id, tidied after).
export function candidateSchema(pack,{characterCount=0,sceneCount=0,locationCount=0,eventCount=0,objectCount=0,itemCount=0,activityCount=0}={}){
 const s={type:'string'},strs={type:'array',items:s},int=(minimum,maximum)=>({type:'integer',minimum,maximum}),obj=(p,opt={})=>({type:'object',properties:{...p,...opt},required:Object.keys(p)}),list=(items,n)=>({type:'array',items,minItems:n,maxItems:n}),t={type:'string',minLength:1},cues={type:'array',items:s,maxItems:4};
 const place=locationCount?s:{type:'string',enum:pack.locations.map(l=>l.id)},world=objectCount||itemCount||activityCount;
 return obj({...(locationCount?{locations:list(obj({id:s,name:s,description:s,exits:strs}),locationCount)}:{}),
  characters:list(obj({id:s,name:s,location:place,pronouns:s,description:t,style:t,goal:t,traits:strs,backstory:t,likes:strs,dislikes:strs,voice:t}),characterCount),
  scenes:list(obj({id:s,title:s,opening:s,trigger:{anyOf:[obj({event:{type:'string',enum:['core.inspected']},match:obj({location:place})}),obj({event:{type:'string',enum:['core.moved']},match:obj({to:place})})]},pages:{type:'array',items:obj({text:t},{speaker:s,stage:cues}),minItems:1},stage:cues,choices:{type:'array',items:obj({id:t,label:t,result:t,effects:{type:'array',items:{type:'object'}}},{when:{type:'object'}}),minItems:2,maxItems:3}},{when:{type:'object'}}),sceneCount),
  ...(world?{objects:list(obj({id:s,name:s,location:place,description:t},{effectFlag:s,useText:s,requiresItem:s}),objectCount),items:list(obj({id:s,name:s,description:s,hideIn:strs},{statBonus:{type:'object'}}),itemCount),activities:list(obj({id:s,name:s,description:s,location:place,duration:int(1,4),phrases:strs,effects:{type:'array',items:{type:'object'},minItems:1,maxItems:3}},{requiresFlag:s}),activityCount)}:{}),
  ...(eventCount?{events:list(obj({id:s,name:s,day:int(1,pack.run?.days||28),daypart:{type:'string',enum:PERIODS},location:place,attendedText:t,missedRecap:t},{character:s}),eventCount)}:{})});
}

export function messagesFor(pack,brief,counts,validationError=''){
 const world=counts.objectCount||counts.itemCount||counts.activityCount,map=counts.locationCount,events=counts.eventCount,repair=validationError?`\nThe previous candidate failed validation: ${validationError}\nReturn a complete corrected candidate.`:'';
 return [{role:'system',content:`You create authored content for Story Framework. Return JSON only. Produce exactly ${map?`${map} new locations, `:''}${counts.characterCount||0} characters and ${counts.sceneCount||0} scripted scenes${world?`, plus ${counts.objectCount||0} objects, ${counts.itemCount||0} hidden items and ${counts.activityCount||0} activities`:''}${events?`, plus ${events} timed events`:''}.${map?' A location is {id,name,description,exits:[ids of existing or new locations it connects to]}; every new location must connect to the existing map. New characters, objects, activities and events may use new location ids.':''}${events?` A timed event is a one-off happening the player can attend or miss: {id,name,day:1-${pack.run?.days||28},daypart:"Morning"|"Afternoon"|"Evening",location,character?:an existing or new character id,attendedText:what happens if the player is there,missedRecap:what they hear afterwards if not}.`:''} ${pack.actors.length>1&&counts.characterCount?`Existing characters (${pack.actors.filter(a=>a.id!==pack.playerId).map(a=>a.name).join(', ')}) are already made: characters[] holds only ${counts.characterCount} NEW people. `:''}Character fields: id, name, location, pronouns, description, style, goal, traits, backstory, likes, dislikes, voice. A scene has {id,title,opening,trigger,when,pages,stage,choices}; trigger is {"event":"core.inspected","match":{"location":id}} (the player looks around there) or {"event":"core.moved","match":{"to":id}} (the player arrives); each page has {speaker,text,stage}; each choice has {id,label,result,effects} and may have when. Keep scenes compact: an opening, 2-6 pages, and 2-3 choices. stage lists who is on screen as "show:<character id>" or "hide:<character id>" (may be empty); effects may be empty. At least one choice must have no when condition. Use no beats unless the brief explicitly needs continuation. Never write player dialogue as a page and never claim an effect in prose unless the matching authored effect exists. ${world?' An object is {id,name,location,description} and may add {effectFlag,useText} if it can be used, plus requiresItem to lock that use behind an item. A hidden item is {id,name,description,hideIn:[2-3 object ids; one is picked per new game],statBonus?:{stat:1}}; never hide an item inside the object it unlocks, and never say in an object description that an item is there. An activity is {id,name,description,location,duration:1-4,phrases:[short player phrasings],effects:[{type:"stat",stat,delta:1 or 2} or {type:"money",delta}],requiresFlag?:an object effectFlag}.':''} JSON root: {${map?'"locations":[],':''}"characters":[],"scenes":[]${world?',"objects":[],"items":[],"activities":[]':''}${events?',"events":[]':''}}.${repair}`},{role:'user',content:`AUTHOR BRIEF\n${brief}\n\nPROJECT CONTEXT\n${JSON.stringify(authoringContext(pack),null,2)}`}];
}
