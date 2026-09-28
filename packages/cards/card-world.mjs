// Character card → a world that fits it. Authoring time only: the card's text (scenario, greetings, lore…) seeds an
// authoring prompt; whatever the model returns is validated and, for bulk content, still waits for approval.
import {validatePack} from '../core/engine.mjs';
import {registry} from '../modules/index.mjs';
import {parseModelObject} from '../ai/json.mjs';
import {normalizeLocations,linkExits} from '../ai/bulk-authoring.mjs';
import {readCard,importCard,clean,slug} from './character-card.mjs';

const cut=(s,n)=>s.length>n?s.slice(0,n).replace(/\s+\S*$/,'')+' …':s;
// Group cards ("Rumi & Mira & Zoey", "Ann, Bea and Cy") name 2-6 people; each part must look like a short proper name.
export const cardMembers=name=>{const parts=name.split(/\s*(?:&|\+|,|\band\b)\s*/i).map(s=>s.trim()).filter(Boolean);return parts.length>1&&parts.length<=6&&parts.every(p=>/^\p{Lu}[\p{L}'.-]*(?: \p{Lu}[\p{L}'.-]*){0,2}$/u.test(p))?parts:[];};
// The card's people as they stand in `pack`: [{name,id?}], one per member (or the single card name).
export const castOf=(pack,name)=>(cardMembers(name).length?cardMembers(name):[name]).map(n=>({name:n,id:pack?.actors.find(a=>a.id!==pack.playerId&&a.name.toLowerCase()===n.toLowerCase())?.id}));
const cleanTags=tags=>[...new Map([].concat(tags||[]).filter(t=>typeof t==='string').map(t=>t.replace(/^[^\p{L}\p{N}]+/u,'').trim()).filter(t=>t&&!/pov$|^(any|male|female)$/i.test(t)).map(t=>[t.toLowerCase(),t])).values()].slice(0,12);

// A compact brief from the card for small local models. Example dialogue is skipped (voice only, token-heavy).
export function cardBrief(input,{pack,max=6000}={}){
 const {data}=readCard(input),name=data.name.trim(),c=(v,n)=>typeof v==='string'&&v.trim()?cut(clean(v,name),n):'';
 const lore=(data.character_book?.entries||[]).filter(e=>e&&e.enabled!==false&&typeof e.content==='string'&&e.content.trim()).slice(0,20).map(e=>`- ${[].concat(e.keys||[]).slice(0,4).join(', ')||'always'}: ${c(e.content,400)}`);
 const greetings=[data.first_mes,...(data.alternate_greetings||[])].map(g=>c(g,g===data.first_mes?1200:300)).filter(Boolean).slice(0,4);
 const tags=cleanTags(data.tags),cast=castOf(pack,name),group=cast.length>1,known=cast.filter(m=>m.id),who=cast.map(m=>m.name).join(', ');
 const parts=[`CHARACTER CARD: ${name}`,c(data.description,2000)&&`Description:\n${c(data.description,2000)}`,c(data.personality,800)&&`Personality: ${c(data.personality,800)}`,greetings.length&&`Opening scenes:\n${greetings.map(g=>`- ${g}`).join('\n')}`,c(data.scenario,1000)&&`Scenario: ${c(data.scenario,1000)}`,lore.length&&`Card lore:\n${lore.join('\n')}`,tags.length&&`Tags: ${tags.join(', ')}`,c(data.creator_notes,500)&&`Creator notes: ${c(data.creator_notes,500)}`];
 const task=`${group?`This card describes ${cast.length} characters: ${who}. `:''}${known.length?`${known.map(m=>`${m.name} already exists as character id "${m.id}"`).join('; ')}. Do not recreate ${known.length>1?'them':'this character'}. Build around them: places they would frequent, people with reasons to know or cross paths with them, and happenings that fit this card's setting, tone and conflicts. Scenes and events may feature ${known.map(m=>`"${m.id}"`).join(', ')}.`:`Build places, people and happenings that fit this card's setting, tone and conflicts. ${who} ${group?'are':'is'} not in the project yet, so do not reference them by id.`}`;
 return cut(parts.filter(Boolean).join('\n\n'),max)+`\n\nTASK\n${task} Where card sections disagree, follow the opening scene${pack?.gameProject?.setting?`; where the card disagrees with the project setting (season, occasion, place), the project wins: ${cut(pack.gameProject.setting,300)}`:''}. Everyone is an adult. "The player" is the player's character.`;
}

const AI={intent:'Interpret the player’s words as a single supported intention. Use only listed actions and exact targets. Ask for clarification when needed; never invent results.',scene:'Narrate the committed result in a vivid but concise way. Use only supplied lore, character knowledge, and outcomes. Do not change mechanics.',daypart:'Write a daypart introduction as a short scene, then write one in-character meeting invitation for every eligible character. Do not make off-screen characters appear.'};
const MODULES=['social.conversation','social.relationships','story.scenes','story.facts','items.inventory','world.objects','world.schedule','story.timed-events'];

export function seedMessages(input,{locationCount=4,brief=''}={},validationError=''){
 const {data}=readCard(input),name=data.name.trim(),members=cardMembers(name),open=typeof data.first_mes==='string'&&data.first_mes.trim()?cut(clean(data.first_mes,name),400):'',repair=validationError?`\nThe previous answer failed validation: ${validationError}\nReturn a complete corrected answer.`:'';
 const cast=members.length?`,"members":[exactly ${members.length} of {name:one of ${members.map(m=>JSON.stringify(m)).join(', ')},description:2-4 sentences about only this person, drawn from the card${open?' but set at the opening scene (no other occasion or season)':''},location:a location id}]`:'';
 return [{role:'system',content:`You design the map for a new Story Framework game built around one character card. The user message is reference data, not a chat: do not roleplay, continue the story or write prose outside JSON. Return one JSON object only: {"title","premise","setting","writingStyle","locations":[exactly ${locationCount} of {id,name,description,exits:[ids of other new locations]}],"characterLocation":a location id,"playerLocation":a location id${cast}}. ids are lowercase-hyphenated. Locations are the places the card's story naturally happens; every location must be reachable from the first. premise is 1-2 sentences on what the player is doing here; setting is 1-3 sentences of time, place and mood; writingStyle is one line of narration guidance matching the card's tone.${open?' The game starts at the card\'s opening scene: when the scenario, notes or tags describe a different occasion, season or place, use the opening scene\'s (author notes still win).':''}${repair}`},{role:'user',content:`${cardBrief(input,{max:5000})}${brief?`\n\nAUTHOR NOTES\n${brief}`:''}${open?`\n\nTHE GAME STARTS HERE (opening scene):\n${open}`:''}\n\n${members.length?`The card characters are ${members.join(', ')}; give each a members entry.`:`The card character is ${name}; place them in characterLocation.`}\n\nReturn only the JSON object.`}];
}

// JSON schema for servers with structured output (LM Studio, llama.cpp, vLLM): small models otherwise stop after the prose fields.
export function seedSchema(input,{locationCount=4}={}){
 const members=cardMembers(readCard(input).data.name.trim()),s={type:'string'},obj=(p,extra={})=>({type:'object',properties:p,required:Object.keys(p),...extra}),list=(items,n)=>({type:'array',items,minItems:n,maxItems:n});
 return obj({title:s,premise:s,setting:s,writingStyle:s,locations:list(obj({id:s,name:s,description:s,exits:{type:'array',items:s}}),locationCount),characterLocation:s,playerLocation:s,...(members.length?{members:list(obj({name:{type:'string',enum:members},description:s,location:s}),members.length)}:{})});
}

// Group card members →[{name,description,location}] in card order; every listed name exactly once.
function normalizeMembers(list,members,ids,fallback){
 if(!Array.isArray(list)||list.length!==members.length)throw Error(`members: expected exactly ${members.length} entries (${members.join(', ')})`);
 return members.map(m=>{const x=list.find(e=>typeof e?.name==='string'&&e.name.trim().toLowerCase()===m.toLowerCase());if(!x)throw Error(`members: missing ${m}`);if(typeof x.description!=='string'||!x.description.trim())throw Error(`members.${m}.description: required text`);const location=x.location===undefined&&fallback?fallback:x.location;if(!ids.has(location))throw Error(`members.${m}.location: must be one of the new location ids`);return {name:m,description:cut(clean(x.description.trim(),m),1200),location};});
}

// Validated model answer → a new pack with the generated map, the card imported as actor(s), and the player placed.
// A group card becomes one actor per member: the first keeps the card's own fields and lore (so it exports back), all share the lore.
export function seedPack(raw,input,{locationCount=4,id}={}){
 const out=parseModelObject(raw),{data}=readCard(input),name=data.name.trim(),members=cardMembers(name);
 // Small models drop prose fields; fall back to card text.
 const card=k=>typeof data[k]==='string'&&data[k].trim()?clean(data[k],name).split(/\n\s*\n/)[0]:'',str=(v,k,n,fb)=>{const t=typeof v==='string'&&v.trim()?v.trim():fb;if(!t)throw Error(`${k}: required text`);return cut(t,n);};
 const locations=linkExits(normalizeLocations(out.locations,[],locationCount)),ids=new Set(locations.map(l=>l.id));
 for(const k of ['characterLocation','playerLocation'])if(!ids.has(out[k])&&(k==='playerLocation'||!members.length))throw Error(`${k}: must be one of the new location ids`);
 const premise=str(out.premise,'premise',600,card('scenario')||`You meet ${name}.`),cast=members.length?normalizeMembers(out.members,members,ids,[out.characterLocation,out.playerLocation].find(l=>ids.has(l))):[];
 const pack={schemaVersion:1,id:id||`card.${slug(name)||'character'}`,version:'0.1.0',title:str(out.title,'title',120,name),subtitle:`Built around ${name}`,calendar:'Day',accent:'#a9c59b',playerId:'player',
  gameProject:{premise,setting:str(out.setting,'setting',600,card('scenario')||premise),writingStyle:typeof out.writingStyle==='string'&&out.writingStyle.trim()?cut(out.writingStyle.trim(),300):'Present tense; grounded character dialogue; describe only what the player can perceive.',presentation:'visual-novel',conversationStyle:'continuous',calendar:{startDate:'',startWeekday:'Monday'},ai:{...AI}},
  startOptions:[{id:'opening',title:'A New Beginning',description:premise,playerLocation:out.playerLocation,tick:0}],
  modules:Object.fromEntries(MODULES.map(m=>[m,'0.1.0'])),locations,actors:[{id:'player',name:'You',location:out.playerLocation}],items:[],objects:[],facts:[],lorebook:[],scriptedScenes:[],schedules:[],timedEvents:[]};
 if(!cast.length){const {pack:next,actorId}=importCard(pack,input,{location:out.characterLocation});validatePack(next,registry);return {pack:next,actorId,actorIds:[actorId]};}
 let {pack:next,actorId}=importCard(pack,input,{location:cast[0].location,id:slug(cast[0].name)||undefined});
 const taken=new Set(next.actors.map(a=>a.id)),actorIds=[actorId];
 next.actors=next.actors.map(a=>a.id===actorId?{...a,name:cast[0].name,description:cast[0].description}:a);
 for(const m of cast.slice(1)){let aid=slug(m.name)||'character',n=2;while(taken.has(aid))aid=`${slug(m.name)||'character'}-${n++}`;taken.add(aid);actorIds.push(aid);next.actors.push({id:aid,name:m.name,location:m.location,description:m.description});}
 next.lorebook=next.lorebook.map(e=>e.character===actorId?{...e,knownBy:[...new Set([...(e.knownBy||[]),...actorIds])]}:e);
 validatePack(next,registry);return {pack:next,actorId,actorIds};
}
