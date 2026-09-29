import {validatePack,safeKey,digest} from '../core/engine.mjs';
import {registry} from '../modules/index.mjs';
import {parseModelObject} from './json.mjs';
import {PERIODS} from '../../public/calendar.mjs';
import {bakeTemplates} from '../cards/role-slots.mjs';
import {routeFrame} from '../cards/route-skeleton.mjs';
import {intimacyFor,missingStops} from '../cards/intimacy-skeleton.mjs';

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
  rules:['Use only listed location and item IDs.','Do not create image paths or poses.','Every scene and beat needs at least one unconditional choice.','Prefer core.inspected with match.location for ordinary location scenes.',`Scene effects: ${sceneEffects(pack).join(', ')}; anything else is dropped.`]
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
export function normalizeLocations(list,existing,n,drops){
 if(!Array.isArray(list??=[]))throw Error('locations: expected an array');if(list.length!==n)throw Error(`Model returned ${list.length} locations; expected ${n}`);
 const have=new Set(existing.map(l=>l.id)),fresh=new Set();
 for(const [i,l] of list.entries()){if(!safeKey(l?.id)||fresh.has(l?.id))throw Error(`locations[${i}].id: invalid or already used`);if(have.has(l.id))throw Error(`locations[${i}].id: "${l.id}" already exists; new locations need new ids`);fresh.add(l.id);}
 // Exits to places nobody defined are dropped (small models invent hallways); a place left with no way in still fails below.
 const dropped=new Set(),out=list.map((l,i)=>{const n=`locations[${i}]`,exits=[...new Set(strings(l.exits,`${n}.exits`,6,80))].filter(x=>x!==l.id&&(have.has(x)||fresh.has(x)||!dropped.add(x)));return {id:l.id,name:text(l.name,`${n}.name`,120),description:text(l.description,`${n}.description`,800),exits:exits.map(to=>({to}))};});
 const reach=new Set(have.size?have:out.slice(0,1).map(l=>l.id));for(let grew=true;grew;){grew=false;for(const l of out){const inside=reach.has(l.id);if(!inside&&l.exits.some(e=>reach.has(e.to))){reach.add(l.id);grew=true;}else if(inside)for(const e of l.exits)if(!reach.has(e.to)){reach.add(e.to);grew=true;}}}
 // With a drops list (the lenient repair), places with no way in are dropped instead; nothing reachable links to them.
 const ignored=dropped.size?` (unknown ids ignored: ${[...dropped].join(', ')})`:'',lost=out.filter(l=>!reach.has(l.id));if(lost.length&&!drops)throw Error(`locations.${lost[0].id}.exits: not connected to the rest of the map; list ids of ${have.size?'existing or ':''}new locations${ignored}`);
 for(const l of lost)drops.push(`locations ${l.id}: not connected to the rest of the map${ignored}`);
 return out.filter(l=>reach.has(l.id));
}
// Adds the reverse of every exit and drops exits to places that are not in the pack (unapproved siblings).
export const linkExits=locations=>{const ids=new Set(locations.map(l=>l.id)),next=locations.map(l=>({...l,exits:(l.exits||[]).filter(e=>ids.has(e.to))}));for(const l of next)for(const e of l.exits){const back=next.find(x=>x.id===e.to);if(!back.exits.some(x=>x.to===l.id))back.exits=[...back.exits,{to:l.id}];}return next;};

// Timed events in calendar terms (day + daypart) → story.timed-events tick windows lasting one daypart.
function normalizeEvents(list,pack,n,keep=(l,f)=>l.map(f)){
 if(!Array.isArray(list??=[]))throw Error('events: expected an array');if(list.length!==n)throw Error(`Model returned ${list.length} events; expected ${n}`);
 if(n&&!pack.modules?.['story.timed-events'])throw Error('The pack must enable story.timed-events before generating events');
 const interval=pack.daypart?.interval||4,days=pack.run?.days||28,locations=new Set(pack.locations.map(x=>x.id)),cast=new Set(pack.actors.filter(a=>a.id!==pack.playerId).map(a=>a.id)),used=new Set((pack.timedEvents||[]).map(x=>x.id));
 return keep(list,(e,i)=>{const n=`events[${i}]`;if(!safeKey(e?.id)||used.has(e.id))throw Error(`${n}.id: invalid or already used`);used.add(e.id);
  if(!Number.isInteger(e.day)||e.day<1||e.day>days)throw Error(`${n}.day: expected 1-${days}`);const slot=PERIODS.indexOf(e.daypart);if(slot<0)throw Error(`${n}.daypart: expected ${PERIODS.join(', ')}`);
  if(!locations.has(e.location))throw Error(`${n}.location: unknown`);if(e.character!=null&&!cast.has(e.character))throw Error(`${n}.character: unknown`);
  const startTick=((e.day-1)*PERIODS.length+slot)*interval;
  return {id:e.id,name:text(e.name,`${n}.name`,120),location:e.location,...(e.character!=null?{character:e.character}:{}),startTick,endTick:startTick+interval-1,attendedText:text(e.attendedText,`${n}.attendedText`,800),missedRecap:text(e.missedRecap,`${n}.missedRecap`,400)};});
}

// Small models write speakers as display names ("Zoey") or put stage directions there. Names become ids; prose moves into the
// page text as narration. Pages spoken by the player are dropped (choices are the player's voice). Stage entries become
// show:/hide: actions ({characterId:"rumi",action:"…"} → "show:rumi"); prose cues are dropped. Anything else is left for validation.
const LEVEL={easy:0.15,medium:0.25,hard:0.4};
// With the pack: chemistry effects are kept for dating characters when they carry a reason (it is shown to the player), and a
// check becomes {stat,target,fail} from a stat name, a difficulty (the target is code's, never the model's) and a fail text;
// a check without a fail text or known stat is dropped and the choice stays. Every dropped effect or check is listed in notes.
export function tidyScenes(scenes,cast,player={},pack,notes=[]){
 const me=new Set(['you','player','me',player.id,player.name].filter(Boolean).map(x=>x.toLowerCase())),mine=p=>typeof p?.speaker==='string'&&me.has(p.speaker.trim().toLowerCase()),pages=list=>{const kept=list.filter(p=>!mine(p));return (kept.length?kept:list).map(page);};
 const find=v=>{if(typeof v!=='string')return;const k=v.trim().toLowerCase();return cast.find(a=>a.id===k||a.name?.toLowerCase()===k||a.name?.split(/\s+/)[0].toLowerCase()===k)?.id;};
 const cue=x=>{if(typeof x==='string'){if(/^sprite:/.test(x))return x;const m=x.match(/^(show|hide):(.+)$/),id=m&&find(m[2]);return id?`${m[1]}:${id}`:null;}const id=x&&typeof x==='object'&&find(x.characterId??x.character??x.charKey??x.id);return id?`show:${id}`:null;};
 const stage=v=>Array.isArray(v)?{stage:[...new Set(v.map(cue).filter(Boolean))]}:{};
 const dating=new Set(pack?.modules?.['social.dating']?(pack.datingProfiles||[]).map(d=>d.character):[]),stats=pack?.modules?.['character.stats']?pack.statDefinitions||[]:[];
 const chem=e=>{const who=e?.type==='chemistry'&&find(e.character);return who&&dating.has(who)&&Number.isInteger(e.delta)&&e.delta&&typeof e.reason==='string'&&e.reason.trim()?{type:'chemistry',character:who,delta:Math.max(-5,Math.min(5,e.delta)),reason:e.reason.trim().slice(0,80)}:null;};
 const statOf=v=>{const k=typeof v==='string'&&v.trim().toLowerCase();return k&&stats.find(s=>s.id===k||s.name?.toLowerCase()===k);},clamp=(n,m)=>Math.max(-m,Math.min(m,n));
 const checkOf=c=>{const d=statOf(c?.stat),fail=typeof c?.fail==='string'?c.fail:c?.fail?.result;if(!d||typeof fail!=='string'||!fail.trim())return null;const lo=d.min??0,hi=d.max??20;return {stat:d.id,target:Math.min(hi,lo+Math.max(1,Math.round((hi-lo)*(LEVEL[c.difficulty]??LEVEL.medium)))),fail:{result:fail.trim().slice(0,800)}};};
 // Effects this pack can run are kept (names resolved to ids, deltas clamped): memory, trust, flag, chemistry, and item/money/stat
 // when their modules are on. Anything else is dropped and noted, so the author sees what a choice lost.
 const items=new Set(pack?.modules?.['items.inventory']?(pack.items||[]).map(x=>x.id):[]),vars=new Set((pack?.storyVariables||[]).map(x=>x.id)),to=player.id||pack?.playerId;
 const effect=(e,at)=>{const t=e?.type,who=find(e?.character),no=why=>{notes.push(`${at}: dropped ${typeof t==='string'?t:'an'} effect (${why})`);return null;};
  if(t==='memory')return who&&typeof e.text==='string'&&e.text.trim()?{...e,character:who}:no('needs a known character and text');
  if(t==='trust')return !who?no('unknown character'):pack&&!pack.modules?.['social.relationships']?no('needs social.relationships'):{...e,character:who};
  if(t==='flag'){const id=typeof e.id==='string'&&e.id.trim().toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^[^a-z0-9]+|-+$/g,'').slice(0,100);return !id?no('needs an id'):vars.size&&!vars.has(id)?no(`not a story variable: ${[...vars].join(', ')}`):{...e,id,value:typeof e.value==='boolean'?e.value:true};}
  if(t==='chemistry')return chem(e)||no('needs a dating character, a delta and a reason');
  if(t==='item')return items.has(e.id)&&to?{type:'item',id:e.id,to}:no(items.size?'unknown item':'needs items.inventory and a known item');
  if(t==='money')return pack?.modules?.['world.economy']&&Number.isInteger(e.delta)&&e.delta?{type:'money',delta:clamp(e.delta,50)}:no('needs world.economy and a whole-number delta');
  if(t==='stat'){const d=statOf(e.stat);return d&&Number.isInteger(e.delta)&&e.delta?{type:'stat',stat:d.id,delta:clamp(e.delta,2)}:no('needs character.stats, a known stat and a whole-number delta');}
  return no('not offered to generated scenes');};
 // Missing choice ids come from the label; repeats get -2, -3…
 // When every choice has a condition the scene can stick, so the last one loses its condition.
 const choices=(v,at)=>{if(!Array.isArray(v))return {};const used=new Set(),open=v.some(c=>!c||typeof c!=='object'||c.when==null);return {choices:v.map((c,i)=>{if(!c||typeof c!=='object')return c;const base=typeof c.id==='string'&&c.id.trim()?c.id.trim():(typeof c.label==='string'?c.label.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40):'')||`choice-${i+1}`;let id=base,n=2;while(used.has(id))id=`${base}-${n++}`;used.add(id);const fx=Array.isArray(c.effects)?{effects:c.effects.map(e=>effect(e,`scene ${at}.${id}`)).filter(Boolean)}:{};if(pack&&'check' in c){const {check,...rest}=c,k=checkOf(check);if(!k)notes.push(`scene ${at}.${id}: dropped check (needs a known stat and a fail text)`);c=k?{...rest,check:k}:rest;}if(!open&&i===v.length-1){const {when,...rest}=c;return {...rest,...fx,id};}return {...c,...fx,id};})};};
 const page=p=>{if(!p||typeof p!=='object')return p;p={...p,...stage(p.stage)};if(p.speaker==null||typeof p.speaker==='string'&&!p.speaker.trim()){const {speaker,...rest}=p;return rest;}if(typeof p.speaker!=='string')return p;
  const id=find(p.speaker);if(id)return {...p,speaker:id};if(/[*()]/.test(p.speaker)||p.speaker.trim().split(/\s+/).length>4||p.speaker.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean).every(find)){const {speaker,...rest}=p;return {...rest,text:[speaker.trim(),typeof p.text==='string'?p.text.trim():''].filter(Boolean).join('\n')};}return p;};
 return (Array.isArray(scenes)?scenes:[]).map((s,i)=>{if(!s||typeof s!=='object')return s;const at=typeof s.id==='string'&&s.id||`${i+1}`;return {...s,...stage(s.stage),...choices(s.choices,at),...(Array.isArray(s.pages)?{pages:pages(s.pages)}:{}),...(Array.isArray(s.beats)?{beats:s.beats.map(b=>b&&Array.isArray(b.pages)?{...b,...choices(b.choices,`${at}.${b.id}`),pages:pages(b.pages)}:b)}:{})};});
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
const TRIGGERS={'core.inspected':'location','core.moved':'to'},PRONOUNS=/\b(?:she\/her|he\/him|they\/them|it\/its|xe\/xem|ze\/zir)\b/i;
// Role-slot templates (F11, role-slots.mjs) drafted by the model: 1-2 lowercase roles, written "@rival" (speaker, effect character) and
// "{rival}"/"{rival.they}" in text. The engine owns the rest: roles draw from the whole cast, every casting is a hand card, a template plays once.
const FIELDS=new Set(['name','they','them','their','theirs']);
function template(t,i,cast,player){const n=`templates[${i}]`;if(!t||typeof t!=='object')throw Error(`${n}: expected an object`);if(!safeKey(t.id))throw Error(`${n}.id: invalid`);
 const roles=[...new Set((Array.isArray(t.roles)?t.roles:[t.roles]).filter(r=>typeof r==='string').map(r=>r.toLowerCase().replace(/[^a-z]/g,'')).filter(Boolean))];if(!roles.length||roles.length>2)throw Error(`${n}.roles: name 1-2 roles, like ["rival"]`);
 // A one-role template written with the literal word ({role}, "@role") can only mean that role.
 const [r]=roles,cap=r[0].toUpperCase()+r.slice(1);if(roles.length===1&&r!=='role')t={...t,...JSON.parse(JSON.stringify({title:t.title,opening:t.opening,pages:t.pages,choices:t.choices}).replace(/"@role"/gi,`"@${r}"`).replace(/{(r)ole(?=[.}])/gi,(m,c)=>`{${c==='R'?cap:r}`))};
 const as=roles.map(r=>({id:`@${r}`,name:r})),[x]=tidyScenes([{...t,stage:[]}],[...as,...cast.filter(a=>a.id!==player?.id)],player),at=v=>typeof v==='string'&&roles.includes(v.replace(/^@/,'').toLowerCase())?`@${v.replace(/^@/,'').toLowerCase()}`:v;
 const v={id:t.id,title:text(x.title,`${n}.title`,120),roles:Object.fromEntries(roles.map(r=>[r,{pool:'cast'}])),offer:'hand',trigger:{event:'story.handOffered',match:{}},opening:text(x.opening,`${n}.opening`,1500),pages:Array.isArray(x.pages)?x.pages.map(p=>{if(!p||typeof p!=='object')return p;const {stage,...rest}=p;return rest.speaker?{...rest,speaker:at(rest.speaker)}:rest;}):x.pages,choices:Array.isArray(x.choices)?x.choices.map(c=>c&&typeof c==='object'&&Array.isArray(c.effects)?{...c,effects:c.effects.map(e=>e&&'character' in e?{...e,character:at(e.character)}:e)}:c):x.choices};
 for(const m of JSON.stringify([v.title,v.opening,v.pages,v.choices]).matchAll(/"@([a-z]+)"|\{([A-Za-z]\w*)(?:\.(\w+))?\}/g)){const r=(m[1]||m[2]).toLowerCase();if(!roles.includes(r)||m[3]&&!FIELDS.has(m[3]))throw Error(`${n}: "${m[0].replace(/"/g,'')}" is not a role placeholder; use "@${roles[0]}", "{${roles[0]}}" or "{${roles[0]}.they|them|their}"`);}
 return v;}
// Approved templates bake into hand cards, one per casting. A casting whose unscheduled people live apart never meets, so it is left
// out; one whose fixed people share a home is offered there, and everyone in it is on screen.
export function bakeHand(pack,templates){const b=bakeTemplates(pack,templates),ids=new Set(templates.map(t=>t.id)),home=new Map(b.actors.map(a=>[a.id,a.location])),moves=new Set((b.schedules||[]).map(r=>r.actor));
 return {...b,scriptedScenes:b.scriptedScenes.flatMap(x=>{if(!ids.has(x.template?.id))return [x];const people=[...new Set([...Object.values(x.template.roles),...(x.pages||[]).map(p=>p.speaker).filter(id=>home.has(id))])],homes=[...new Set(people.filter(id=>!moves.has(id)).map(id=>home.get(id)))];
  return homes.length>1?[]:[{...x,stage:people.map(id=>`show:${id}`),...(homes.length?{when:{...x.when,location:homes[0]}}:{})}];})};}
// Near copies (a 9b model writes one scene twice under new ids): word overlap of title, opening and first page against earlier scenes.
const words=x=>new Set(`${x?.title||''} ${x?.opening||''} ${x?.pages?.[0]?.text||''}`.toLowerCase().match(/\p{L}{3,}/gu)||[]),overlap=(a,b)=>{let n=0;for(const w of a)if(b.has(w))n++;return n/(a.size+b.size-n||1);};
function nearCopies(list,pack,strict,skipped){const seen=(pack.scriptedScenes||[]).map(x=>[x.id,words(x)]);
 return list.filter((x,i)=>{if(!x||typeof x!=='object')return true;const w=words(x),hit=w.size>=6&&seen.find(([,v])=>overlap(w,v)>=0.6);if(!hit){seen.push([x.id,w]);return true;}if(strict)throw Error(`scenes[${i}] "${x.id}" is a near copy of ${hit[0]}; write a different scene`);skipped.push(`scenes: ${x.id||i} (a near copy of ${hit[0]})`);return false;});}
// Follow-ups (Persona rank-ups, storylets): after:"scene" unlocks once that scene is played; after:"scene.choice" once that choice is
// taken (code puts a flag on the choice). dayparts limits when a scene is offered. Both make it a hand card, never a place's intro.
// Parents are ordered before their follow-ups; a loop or an unknown parent leaves the scene unchained, with a note.
function chain(list,pack,notes){
 const own=new Map(list.filter(x=>x&&typeof x==='object'&&typeof x.id==='string').map(x=>[x.id,x])),old=new Set((pack.scriptedScenes||[]).map(x=>x.id)),parent=new Map(),gated=new Set();
 for(const x of own.values()){const {after,dayparts}=x;delete x.after;delete x.dayparts;
  const d=[...new Set([dayparts].flat().map(v=>typeof v==='string'&&PERIODS.find(p=>p.toLowerCase()===v.trim().toLowerCase())).filter(Boolean))];if(d.length&&d.length<PERIODS.length){x.when={...x.when,dayparts:d};gated.add(x.id);}
  if(typeof after!=='string'||!after.trim())continue;const [sid,cid]=after.trim().split('.');let up=sid;while(up&&up!==x.id)up=parent.get(up)?.sid;
  if(up===x.id||!own.has(sid)&&!old.has(sid)){notes.push(`scene ${x.id}: after "${after}" ${up===x.id?'makes a loop':'names no earlier scene'}, so it is not a follow-up`);continue;}parent.set(x.id,{sid,cid});gated.add(x.id);}
 for(const [id,{sid,cid}] of parent){const x=own.get(id),c=cid&&own.get(sid)?.choices?.find?.(c=>c?.id===cid),f=`${sid}.${cid}`.slice(0,100);
  if(c&&!(pack.storyVariables||[]).length){c.effects=[...(Array.isArray(c.effects)?c.effects:[]).filter(e=>e?.id!==f),{type:'flag',id:f,value:true}];x.when={...x.when,flags:{...x.when?.flags,[f]:true}};continue;}
  if(cid)notes.push(`scene ${id}: after "${sid}.${cid}": ${!own.has(sid)?`${sid} is already in the pack`:c?'the pack names its flags (story variables)':`${sid} has no choice ${cid}`}, so it follows the whole scene`);x.when={...x.when,completedScenes:[...new Set([...(x.when?.completedScenes||[]),sid])]};}
 const depth=id=>{let n=0;for(let p=parent.get(id);p&&n<50;p=parent.get(p.sid))n++;return n;};
 return {list:parent.size?list.map((x,i)=>[x,i]).sort(([a,i],[b,j])=>depth(a?.id)-depth(b?.id)||i-j).map(([x])=>x):list,parent,gated};}
export function normalizeCandidate(raw,pack,{characterCount=0,sceneCount=0,locationCount=0,eventCount=0,templateCount=0,...world},{strict=false}={}){
 // The repair may come back short (a 9b model forgets the templates array): keep what is there and list the gap under dropped.
 const out=resolveRefs(structuredClone(parseModelObject(raw)),pack),short=[];
 for(const [k,n] of [['characters',characterCount],['scenes',sceneCount],['templates',templateCount]]){if(!n||!strict)out[k]??=[];if(!Array.isArray(out[k]))throw Error(`Model output needs characters, scenes${templateCount?' and templates':''} arrays`);if(out[k].length>n||strict&&out[k].length<n)throw Error(`Model returned ${out[k].length} ${k}; expected ${n}`);if(out[k].length<n)short.push(`${k}: wrote ${out[k].length} of ${n}`);}
 // Small models re-list the card's people and places, or variants ("Rumi (Christmas Edition)"). strict (a first attempt) fails so a repair can ask again; otherwise copies are skipped.
 // A skipped copy's id becomes an alias of the original, so scenes and events written for "rumi-festive" still land on "rumi".
 const skipped=[],alias=new Map(),old=(list,k)=>{const known=new Map(list.flatMap(x=>[[x.id,x.id],[x.name&&canon(x.name),x.id]]).filter(([n])=>n));return x=>{const dup=x&&typeof x==='object'&&(known.get(x.id)||typeof x.name==='string'&&k==='characters'&&known.get(canon(x.name.replace(/\s*[([].*$/,''))));if(dup){skipped.push(`${k}: ${x.id||x.name}`);if(k==='characters'&&typeof x.id==='string'&&x.id!==dup)alias.set(canon(x.id),dup);}return !dup;};};
 out.characters=out.characters.filter(old(pack.actors,'characters'));if(alias.size)for(const k of ['scenes','events'])if(Array.isArray(out[k]))out[k]=JSON.parse(JSON.stringify(out[k]),(_,v)=>typeof v!=="string"?v:alias.get(canon(v))??v.replace(/^(show|hide|sprite):([^,]+)/,(m,a,id)=>alias.has(canon(id))?`${a}:${alias.get(canon(id))}`:m));if(Array.isArray(out.locations)){if(out.locations.length!==locationCount)throw Error(`Model returned ${out.locations.length} locations; expected ${locationCount}`);out.locations=out.locations.filter(old(pack.locations.map(({id})=>({id})),'locations'));}
 if(strict&&skipped.length)throw Error(`${skipped.join(', ')} already exist${skipped.length>1?'':'s'}; characters[] and locations[] hold only NEW people and places with new ids`);
 const lostPlaces=[],newLocations=normalizeLocations(out.locations,pack.locations,out.locations?.length??locationCount,strict?undefined:lostPlaces),mapped={...pack,locations:[...pack.locations,...newLocations]};
 const locations=new Set(mapped.locations.map(x=>x.id)),ids=new Set(pack.actors.map(x=>x.id));
 // Characters, events and scenes are checked one entry at a time. strict throws on the first bad one; otherwise it is dropped
 // (with its reason, for the proposal) and the rest are kept — a repair that fixes 5 of 6 scenes should not lose all 6.
 const dropped=[...short,...lostPlaces],keep=kind=>(list,fn)=>list.flatMap((x,i)=>{try{return [fn(x,i)];}catch(e){if(strict)throw e;dropped.push(`${kind} ${x?.id||i}: ${e.message}`);return [];}});
 // Pronouns: a chatty or long value keeps its first standard set ("she/her"); after the repair a missing one is left out (the engine allows that).
 const pronouns=(v,i)=>typeof v==='string'&&v.trim()&&v.length<=40?v.trim():PRONOUNS.test(v)?v.match(PRONOUNS)[0].toLowerCase():strict?text(v,`characters[${i}].pronouns`,40):undefined;
 const characters=keep('characters')(out.characters,(a,i)=>{
  if(!safeKey(a.id))throw Error(`characters[${i}].id: invalid`);if(ids.has(a.id))throw Error(`characters[${i}].id: "${a.id}" already exists; create new people, not existing characters`);
  if(!locations.has(a.location))throw Error(`characters[${i}].location: unknown`);if(roleName(a.name))throw Error(`characters[${i}].name: "${a.name}" is a role, not a name; give each person a proper name`);
  const v={id:a.id,name:text(a.name,`characters[${i}].name`,120),location:a.location,pronouns:pronouns(a.pronouns,i),description:text(a.description,`characters[${i}].description`,1000),style:text(a.style,`characters[${i}].style`,500),goal:text(a.goal,`characters[${i}].goal`,500),traits:strings(few(a.traits,8),`characters[${i}].traits`,8,120),backstory:text(a.backstory,`characters[${i}].backstory`,1500),likes:strings(few(a.likes,8),`characters[${i}].likes`,8,120),dislikes:strings(few(a.dislikes,8),`characters[${i}].dislikes`,8,120),voice:text(a.voice,`characters[${i}].voice`,500)};if(v.pronouns===undefined)delete v.pronouns;ids.add(a.id);return v;
 });
 const {objects,items,activities}=normalizeWorld(out,mapped,world),all=list=>list.map(value=>({status:'approved',value}));
 let base=mergeApproved(pack,{locations:all(newLocations),objects:all(objects),items:all(items),activities:all(activities)});validatePack(base,registry);
 const grow=kind=>(v,i)=>{const next=mergeApproved(base,{[kind]:all([v])});try{validatePack(next,registry);}catch(e){e.message=`${kind}[${i}]: ${e.message}`;if(/speaker: unknown/.test(e.message))e.message+=`; a speaker is one of ${pack.actors.concat(characters).map(x=>x.id).filter(x=>x!==pack.playerId).join(', ')}, or empty for narration (the player never speaks in a page)`;throw e;}base=next;return v;};
 const people=keep('characters')(characters,grow('characters')),cast=[...pack.actors,...people];
 const events=normalizeEvents(out.events,{...mapped,actors:cast},eventCount,(l,f)=>keep('events')(l,(e,i)=>grow('events')(f(e,i),i)));
 // Lenient only: a speaker who is nobody at all ("HUNTR/X", a band) becomes a narrated line instead of costing the whole scene.
 // An id-shaped speaker or a character from this reply that was dropped still fails, so its scene goes with it.
 const notes=[],refs=new Set((Array.isArray(out.characters)?out.characters:[]).flatMap(a=>[a?.id,a?.name]).filter(x=>typeof x==='string').map(canon)),speakers=new Set(cast.map(a=>a.id)),nobody=v=>!speakers.has(v)&&!/^[a-z0-9_-]+$/.test(v)&&!refs.has(canon(v)),tidied=tidyScenes(clone(out.scenes),cast.filter(a=>a.id!==pack.playerId),pack.actors.find(a=>a.id===pack.playerId),mapped,notes),narrate=v=>strict||!Array.isArray(v)?v:JSON.parse(JSON.stringify(v),(_,p)=>p&&typeof p==='object'&&typeof p.speaker==='string'&&nobody(p.speaker)?(({speaker,...rest})=>({...rest,text:[`${speaker.trim()}:`,typeof rest.text==='string'?rest.text.trim():''].join(' ').trim()}))(p):p);
 // A scene plays only where all its speakers are (the engine checks; show: is only a picture), and unscheduled people stay put:
 // a scene whose fixed speakers live at one other place moves there. Speakers from two places never meet, so that scene fails.
 const home=new Map(cast.map(a=>[a.id,a.location])),moves=new Set((pack.schedules||[]).map(r=>r.actor));
 const settle=(x,i)=>{const k=TRIGGERS[x.trigger.event],homes=[...new Set((x.pages||[]).map(p=>p.speaker).filter(id=>id&&!moves.has(id)&&home.has(id)).map(id=>home.get(id)))];if(homes.length>1)throw Error(`scenes[${i}]: its speakers stay in different places (${homes.join(', ')}) and never meet; use speakers from one place`);if(homes.length&&homes[0]!==x.trigger.match[k]){const was=x.trigger.match[k],nm=mapped.locations.find(l=>l.id===was)?.name,said=nm&&JSON.stringify([x.title,x.opening,x.pages]).toLowerCase().includes(nm.toLowerCase());notes.push(`scene ${x.id}: moved from ${was} to ${homes[0]}, where its speakers are${said?`; its text still names ${nm}`:''}`);x.trigger={...x.trigger,match:{[k]:homes[0]}};}return x;};
 const {list:listed,parent,gated}=chain(nearCopies(narrate(tidied),pack,strict,skipped),pack,notes);
 const scenes=keep('scenes')(listed,(x,i)=>{const t=x?.trigger,k=TRIGGERS[t?.event];if(!k||!Object.keys(t.match||{}).every(f=>f===k)||!locations.has(t.match?.[k]))throw Error(`scenes[${i}].trigger: use {"event":"core.inspected","match":{"location":id}} or {"event":"core.moved","match":{"to":id}} with a known location id`);
  const up=parent.get(x.id);if(up&&!(base.scriptedScenes||[]).some(s=>s.id===up.sid))throw Error(`scenes[${i}]: follows ${up.sid}, which was dropped`);const n=notes.length;try{return grow('scenes')(settle(x,i),i);}catch(e){notes.length=n;throw e;}});
 // Scenes are hand cards (Persona/Stardew/Fallen London): offered while the player is at the place, one daypart each, played when chosen.
 // A place where nothing fires by itself yet keeps its first scene on its trigger as the place's intro.
 const auto=new Set((pack.scriptedScenes||[]).filter(x=>!['hand','director'].includes(x.offer)).map(x=>x.trigger?.match?.location??x.trigger?.match?.to));
 for(const x of scenes){if(['hand','director'].includes(x.offer))continue;const at=x.trigger.match[TRIGGERS[x.trigger.event]];if(!gated.has(x.id)&&!auto.has(at))auto.add(at);else Object.assign(x,{offer:'hand',trigger:{event:'story.handOffered',match:{}},when:{...x.when,location:at}});}
 const templates=keep('templates')(out.templates,(t,i)=>{const v=template(t,i,cast,pack.actors.find(a=>a.id===pack.playerId));if((pack.scriptedScenes||[]).some(x=>x.id===v.id||x.template?.id===v.id))throw Error(`templates[${i}].id: "${v.id}" already used`);if(!bakeHand(base,[v]).scriptedScenes.some(x=>x.template?.id===v.id))throw Error(`templates[${i}]: no ${Object.keys(v.roles).length>1?'two people':'one'} in the cast can play it (people without a schedule stay put, so its roles must be people from one place)`);return grow('templates')(v,i);});
 const kept={locations:newLocations,characters:people,scenes,objects,items,activities,events,templates};
 if(dropped.length&&!KINDS.some(k=>kept[k].length))throw Error(`Every entry failed validation: ${dropped.join('; ')}`);
 return {...kept,skipped,dropped,warnings:notes};
}
// "Security Guard", "The Bartender", "Mysterious Stranger": a role, not a person the player can get to know.
const ROLES=new Set('the a an security guard bouncer bartender barista waiter waitress server host hostess dj officer cop police manager clerk cashier stranger man woman girl boy guy lady gentleman neighbor neighbour friend fan staff member worker attendant driver doctor nurse teacher chef cook owner customer guest visitor kid child old young mysterious tall masked party goer partygoer delivery courier mailman pizza maid butler janitor assistant photographer bodyguard receptionist mysterious'.split(' '));
export const roleName=n=>typeof n==='string'&&n.trim()!==''&&n.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean).every(w=>ROLES.has(w));

export function createProposal(pack,candidate,meta={}){
 return {format:'story-framework-ai-authoring-proposal',version:1,createdAt:new Date().toISOString(),source:{packId:pack.id,packVersion:pack.version,digest:digest(pack)},request:meta,...(candidate.route?{route:candidate.route}:{}),...(candidate.intimacy?{intimacy:candidate.intimacy}:{}),...(candidate.dropped?.length?{dropped:candidate.dropped}:{}),...(candidate.warnings?.length?{warnings:candidate.warnings}:{}),...Object.fromEntries(KINDS.map(k=>[k,(candidate[k]||[]).map(value=>({status:'pending',value}))]))};
}

export const KINDS=['locations','characters','scenes','objects','items','activities','events','templates'];
export function mergeApproved(pack,proposal){
 // A route proposal (packages/cards/route-skeleton.mjs) carries its frame — modules, stats, profiles, run, endings — as proposal.route.
 const next=proposal.route?routeFrame(pack,proposal.route):clone(pack),approved=list=>(list||[]).filter(x=>x?.status==='approved').map(x=>clone(x.value));
 const places=approved(proposal.locations);if(places.length)next.locations=linkExits([...next.locations,...places]);
 next.actors=[...next.actors,...approved(proposal.characters)];
 next.scriptedScenes=[...(next.scriptedScenes||[]),...approved(proposal.scenes)];
 // An intimacy proposal (packages/cards/intimacy-skeleton.mjs) frames only the love interests whose first encounter is approved.
 if(proposal.intimacy)Object.assign(next,intimacyFor(next,proposal.intimacy,new Set(next.scriptedScenes.map(s=>s.id))));
 for(const [key,to=key] of [['objects'],['items'],['activities'],['events','timedEvents']]){const add=approved(proposal[key]);if(add.length)next[to]=[...(next[to]||[]),...add];}
 const templates=approved(proposal.templates);return templates.length?bakeHand(next,templates):next;
}

export function applyProposal(pack,proposal){
 if(proposal?.format!=='story-framework-ai-authoring-proposal'||proposal.version!==1)throw Error('Unsupported proposal file');
 if(proposal.source?.packId!==pack.id)throw Error(`Proposal was made for ${proposal.source?.packId||'an unknown pack'}, not ${pack.id}`);
 if(proposal.source?.digest!==digest(pack))throw Error('The source pack changed after this proposal was generated; generate a fresh proposal');
 const next=mergeApproved(pack,proposal);validatePack(next,registry);return next;
}

// Dating characters (chemistry effects) and stat ids (choice checks) a generated scene may use; both empty without their modules.
const sceneExtras=pack=>({dating:pack.modules?.['social.dating']?(pack.datingProfiles||[]).map(d=>d.character):[],stats:pack.modules?.['character.stats']?(pack.statDefinitions||[]).map(s=>s.id):[],items:pack.modules?.['items.inventory']?(pack.items||[]).map(x=>x.id):[],money:!!pack.modules?.['world.economy']}),
 sceneEffects=pack=>{const x=sceneExtras(pack);return ['memory',...(pack.storyVariables?.length?[]:['flag']),...(pack.modules?.['social.relationships']?['trust']:[]),...(x.dating.length?['chemistry']:[]),...(x.items.length?['item (gives the player a listed item)']:[]),...(x.money?['money']:[]),...(x.stats.length?['stat']:[])];};
// JSON schema matching messagesFor, for servers that enforce structured output: exact counts and required fields, so small
// models cannot stop early or drop fields. Location ids are pinned when no new places are requested, speaker ids when no new people are. Stage cues are strings (show:id, tidied after).
export function candidateSchema(pack,{characterCount=0,sceneCount=0,locationCount=0,eventCount=0,objectCount=0,itemCount=0,activityCount=0,templateCount=0}={}){
 const s={type:'string'},strs={type:'array',items:s},int=(minimum,maximum)=>({type:'integer',minimum,maximum}),obj=(p,opt={})=>({type:'object',properties:{...p,...opt},required:Object.keys(p)}),list=(items,n)=>({type:'array',items,minItems:n,maxItems:n}),t={type:'string',minLength:1},cues={type:'array',items:s,maxItems:4};
 const place=locationCount?s:{type:'string',enum:pack.locations.map(l=>l.id)},cast=pack.actors.filter(a=>a.id!==pack.playerId).map(a=>a.id),who=characterCount||!cast.length?s:{type:'string',enum:cast},world=objectCount||itemCount||activityCount;
 const {dating,stats,items,money}=sceneExtras(pack),kind=k=>({type:'string',enum:[k]}),effects=who=>({type:'array',items:{anyOf:[obj({type:kind('memory'),character:who,text:t}),...(pack.modules?.['social.relationships']?[obj({type:kind('trust'),character:who,delta:int(-10,10)})]:[]),...(pack.storyVariables?.length?[]:[obj({type:kind('flag'),id:{type:'string',pattern:'^[a-z0-9][a-z0-9._-]{0,60}$'},value:{type:'boolean'}})]),...(dating.length?[obj({type:kind('chemistry'),character:{type:'string',enum:dating},delta:int(-5,5),reason:t})]:[]),...(items.length?[obj({type:kind('item'),id:{type:'string',enum:items}})]:[]),...(money?[obj({type:kind('money'),delta:int(-50,50)})]:[]),...(stats.length?[obj({type:kind('stat'),stat:{type:'string',enum:stats},delta:int(-2,2)})]:[])]},maxItems:3}),choices=who=>({type:'array',items:obj({id:t,label:t,result:t,effects:effects(who)},stats.length?{check:obj({stat:{type:'string',enum:stats},difficulty:{type:'string',enum:Object.keys(LEVEL)},fail:t})}:{}),minItems:2,maxItems:3});
 return obj({...(locationCount?{locations:list(obj({id:s,name:s,description:s,exits:strs}),locationCount)}:{}),
  characters:list(obj({id:s,name:s,location:place,pronouns:s,description:t,style:t,goal:t,traits:strs,backstory:t,likes:strs,dislikes:strs,voice:t}),characterCount),
  scenes:list(obj({id:s,title:s,opening:s,trigger:{anyOf:[obj({event:{type:'string',enum:['core.inspected']},match:obj({location:place})}),obj({event:{type:'string',enum:['core.moved']},match:obj({to:place})})]},pages:{type:'array',items:obj({text:t},{speaker:who,stage:cues}),minItems:1},stage:cues,choices:choices(who)},{after:s,dayparts:{type:'array',items:{type:'string',enum:PERIODS},maxItems:2}}),sceneCount),
  ...(templateCount?{templates:list(obj({id:s,title:s,roles:{type:'array',items:{type:'string',pattern:'^[a-z]{2,20}$'},minItems:1,maxItems:2},opening:t,pages:{type:'array',items:obj({text:t},{speaker:s}),minItems:1},choices:choices(s)}),templateCount)}:{}),
  ...(world?{objects:list(obj({id:s,name:s,location:place,description:t},{effectFlag:s,useText:s,requiresItem:s}),objectCount),items:list(obj({id:s,name:s,description:s,hideIn:strs},{statBonus:{type:'object'}}),itemCount),activities:list(obj({id:s,name:s,description:s,location:place,duration:int(1,4),phrases:strs,effects:{type:'array',items:{type:'object'},minItems:1,maxItems:3}},{requiresFlag:s}),activityCount)}:{}),
  ...(eventCount?{events:list(obj({id:s,name:s,day:int(1,pack.run?.days||28),daypart:{type:'string',enum:PERIODS},location:place,attendedText:t,missedRecap:t},{character:who}),eventCount)}:{})});
}

// Staged generation: places, people and world things first; scenes and events second, against a pack that already holds the
// first stage (withCandidate), so the second schema pins every location and speaker id instead of hoping the model reuses them.
export function stagesFor(counts){const {sceneCount=0,eventCount=0,templateCount=0,...first}=counts;return (sceneCount||eventCount||templateCount)&&Object.values(first).some(Boolean)?[first,{sceneCount,eventCount,...(templateCount?{templateCount}:{})}]:[counts];}
// The pack with every entry of a proposal that is not rejected (check, and the robustness playtest).
export const withProposal=(pack,proposal)=>mergeApproved(pack,Object.fromEntries([['route',proposal.route],['intimacy',proposal.intimacy],...KINDS.map(k=>[k,(proposal[k]||[]).filter(x=>x.status!=='rejected').map(x=>({...x,status:'approved'}))])]));
export const withCandidate=(pack,c)=>mergeApproved(pack,Object.fromEntries(KINDS.map(k=>[k,(c[k]||[]).map(value=>({status:'approved',value}))])));
export const joinCandidates=(a,b)=>({...Object.fromEntries(KINDS.map(k=>[k,[...(a[k]||[]),...(b[k]||[])]])),skipped:[...(a.skipped||[]),...(b.skipped||[])],dropped:[...(a.dropped||[]),...(b.dropped||[])],warnings:[...(a.warnings||[]),...(b.warnings||[])]});
// Local servers drop long generations now and then (5xx, "terminated" mid-body); one retry after a pause.
export async function retryOnce(fn,log=()=>{},ms=3000){try{return await fn();}catch(e){if(!/terminated|fetch failed|ECONNRESET|socket|\(5\d\d\)/i.test(e.message))throw e;log(e);await new Promise(r=>setTimeout(r,ms));return fn();}}

// Dry run over a (merged) pack for things that validate but will not play: places the player cannot reach, scenes that can stick
// or that share a trigger, speakers who are somewhere else (so the scene never starts), and timed events that clash or whose character never shows up
// (only scheduled characters move). Warnings, not errors: an author may add exits or schedules later.
export function playability(pack){
 const w=[],loc=id=>pack.locations.find(l=>l.id===id),name=id=>loc(id)?.name||id,where=new Map(pack.actors.map(a=>[a.id,a.location])),moves=new Set((pack.schedules||[]).map(r=>r.actor));
 const seen=new Set([...(pack.startOptions||[]).map(o=>o.playerLocation),where.get(pack.playerId)].filter(Boolean)),queue=[...seen];while(queue.length)for(const e of loc(queue.shift())?.exits||[])if(!seen.has(e.to)){seen.add(e.to);queue.push(e.to);}
 const away=(id,at)=>id&&id!==pack.playerId&&!moves.has(id)&&where.has(id)&&where.get(id)!==at,triggers=new Map();
 for(const s of pack.scriptedScenes||[]){const n=`scene ${s.id}`,at=s.trigger?.match?.location??s.trigger?.match?.to??s.when?.location,parts=[s,...(s.beats||[])];
  if(at&&!seen.has(at))w.push(`${n}: ${name(at)} cannot be reached from the start`);
  if(at&&!['hand','director'].includes(s.offer)){const k=`${s.trigger.event} ${at}`;if(triggers.has(k))w.push(`${n}: same trigger as ${triggers.get(k)}, so the two play back to back`);else triggers.set(k,s.id);}
  // An encounter must offer a way out at every beat (packages/cards/intimacy-skeleton.mjs); the engine also lists Stop: … while it runs.
  if(!parts.some(b=>(b.choices||[]).some(c=>c.effects?.length||c.check||c.next)))w.push(`${n}: no choice has an effect, so nothing the player picks matters`);
  for(const id of missingStops(s))w.push(`${n}${id?`.${id}`:''}: no stop choice (an unconditional choice that withdraws consent)`);
  for(const b of parts)if(b.choices?.length&&b.choices.every(c=>c.when))w.push(`${n}${b===s?'':`.${b.id}`}: every choice has a condition, so the scene can stick`);
  // Every speaker must be where the scene plays or it never starts; show: only draws them.
  for(const id of new Set(parts.flatMap(b=>(b.pages||[]).map(p=>p.speaker))))if(at&&away(id,at))w.push(`${n}: ${id} speaks but stays at ${name(where.get(id))}, not ${name(at)}, so it never plays (move the scene there or give ${id} a schedule)`);
 }
 const events=pack.timedEvents||[];
 for(const [i,e] of events.entries()){const n=`event ${e.id}`;
  if(e.location&&!seen.has(e.location))w.push(`${n}: ${name(e.location)} cannot be reached from the start`);
  if(e.location&&away(e.character,e.location)&&!(pack.scheduleExceptions||[]).some(x=>x.actor===e.character&&x.location===e.location&&x.startTick<=e.endTick&&x.endTick>=e.startTick))w.push(`${n}: ${e.character} stays at ${name(where.get(e.character))} and never comes to ${name(e.location)}, so it cannot be attended`);
  for(const o of events.slice(0,i))if(o.startTick<=e.endTick&&e.startTick<=o.endTick&&(o.location!==e.location||e.character&&o.character===e.character))w.push(`${n}: overlaps ${o.id}${o.location!==e.location?' in another place':` with ${e.character} in both`}, so the player can attend only one`);
 }
 return w;
}

export function messagesFor(pack,brief,counts,validationError=''){
 const x=sceneExtras(pack),world=counts.objectCount||counts.itemCount||counts.activityCount,map=counts.locationCount,events=counts.eventCount,repair=validationError?`\nThe previous candidate failed validation: ${validationError}\nReturn a complete corrected candidate.`:'';
 return [{role:'system',content:`You create authored content for Story Framework. Return JSON only. Produce exactly ${map?`${map} new locations, `:''}${counts.characterCount||0} characters and ${counts.sceneCount||0} scripted scenes${world?`, plus ${counts.objectCount||0} objects, ${counts.itemCount||0} hidden items and ${counts.activityCount||0} activities`:''}${events?`, plus ${events} timed events`:''}.${map?' A location is {id,name,description,exits:[ids of existing or new locations it connects to]}; every new location must connect to the existing map. New characters, objects, activities and events may use new location ids.':''}${events?` A timed event is a one-off happening the player can attend or miss: {id,name,day:1-${pack.run?.days||28},daypart:"Morning"|"Afternoon"|"Evening",location,character?:an existing or new character id whose location is the event location (characters stay where they are),attendedText:what happens if the player is there,missedRecap:what they hear afterwards if not}; no two events share a day and daypart.`:''} ${pack.actors.length>1&&counts.characterCount?`Existing characters (${pack.actors.filter(a=>a.id!==pack.playerId).map(a=>a.name).join(', ')}) are already made: characters[] holds only ${counts.characterCount} NEW people. `:''}Character fields: id, name (a proper personal name, not a role), location, pronouns, description, style, goal, traits, backstory, likes, dislikes, voice. A scene has {id,title,opening,trigger,pages,stage,choices}; trigger is {"event":"core.inspected","match":{"location":id}} (the player looks around there) or {"event":"core.moved","match":{"to":id}} (the player arrives); people stay at their location, so a scene plays where its speakers are; each page has {speaker,text,stage}; each choice has {id,label,result,effects}. Keep scenes compact: an opening, 2-6 pages, and 2-3 choices. stage lists who is on screen as "show:<character id>" or "hide:<character id>" (may be empty); effects (may be empty) are {"type":"memory",character,text}${pack.modules?.['social.relationships']?' or {"type":"trust",character,delta:-10..10}':''}${x.dating.length?` or {"type":"chemistry",character:${x.dating.join('|')},delta:-5..5,reason:"a few words the player sees"}`:''}${x.items.length?' or {"type":"item",id} (the player gets a listed item)':''}${x.money?' or {"type":"money",delta:-50..50}':''}${x.stats.length?` or {"type":"stat",stat,delta:-2..2}`:''}. A follow-up scene adds after:"<scene id>" (or "<scene id>.<choice id>" for one choice); dayparts:["Evening"] limits when a scene is offered.${x.stats.length?` A risky choice may add check:{stat:${x.stats.join('|')},difficulty:"easy"|"medium"|"hard",fail:"what happens instead; the story still moves"}; its effects apply only when it succeeds.`:''} Use no beats unless the brief explicitly needs continuation. Never write player dialogue as a page and never claim an effect in prose unless the matching authored effect exists.${counts.templateCount?` Also write ${counts.templateCount} templates: a template is a scene for roles instead of named people, {id,title,roles:[1-2 lowercase role names like "rival"],opening,pages,choices}; write "@rival" as a speaker or effect character and {rival}, {rival.they}, {rival.them}, {rival.their} in text; it is cast later with every fitting character, so describe the role, not a person.`:''} ${world?' An object is {id,name,location,description} and may add {effectFlag,useText} if it can be used, plus requiresItem to lock that use behind an item. A hidden item is {id,name,description,hideIn:[2-3 object ids; one is picked per new game],statBonus?:{stat:1}}; never hide an item inside the object it unlocks, and never say in an object description that an item is there. An activity is {id,name,description,location,duration:1-4,phrases:[short player phrasings],effects:[{type:"stat",stat,delta:1 or 2} or {type:"money",delta}],requiresFlag?:an object effectFlag}.':''} JSON root: {${map?'"locations":[],':''}"characters":[],"scenes":[]${counts.templateCount?',"templates":[]':''}${world?',"objects":[],"items":[],"activities":[]':''}${events?',"events":[]':''}}.${repair}`},{role:'user',content:`AUTHOR BRIEF\n${brief}\n\nPROJECT CONTEXT\n${JSON.stringify(authoringContext(pack),null,2)}`}];
}
