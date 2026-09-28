// Character Card V1/V2/V3 (SillyTavern, RisuAI, chub) ⇄ story-framework actor. Cards are untrusted authoring input:
// macros are resolved, state-mutating syntax is stripped, and card-only fields (greetings, system_prompt, examples…)
// are kept verbatim in actor.card, which never reaches a prompt. SF-only fields ride in data.extensions['story-framework'].
import {crc32} from 'node:zlib';
import {assert,safeKey} from '../core/engine.mjs';
import {stripPlaceholders} from '../ai/memory.mjs';
import {stripStateSyntax} from '../ai/untrusted-output.mjs';

const EXT='story-framework',PROFILE=['pronouns','traits','voice','goal','backstory','likes','dislikes','style','examples'],LORE_EXTRA=['when','sticky','cooldown','delay','knownBy'];
const PNG_SIG=Buffer.from([137,80,78,71,13,10,26,10]);
const CARD_ONLY=['scenario','first_mes','mes_example','alternate_greetings','group_only_greetings','system_prompt','post_history_instructions','creator_notes','tags','creator','character_version','nickname','source','creation_date','modification_date'];

const chunks=buf=>{const out=[];for(let at=8;at+12<=buf.length;){const len=buf.readUInt32BE(at),type=buf.toString('latin1',at+4,at+8);if(at+12+len>buf.length)break;out.push({type,data:buf.subarray(at+8,at+8+len),at,end:at+12+len});at+=12+len;}return out;};
const textChunks=buf=>Object.fromEntries(chunks(buf).filter(c=>c.type==='tEXt').map(c=>{const i=c.data.indexOf(0);return [c.data.toString('latin1',0,i).toLowerCase(),c.data.toString('latin1',i+1)];}));
const fromB64=s=>JSON.parse(Buffer.from(s,'base64').toString('utf8'));
const stripHtml=s=>typeof s==='string'?s.replace(/<br\s*\/?>|<\/p>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/\n{3,}/g,'\n\n').trim():s;
// JanitorAI exports ({name, personality = the definition, description = HTML blurb, scenario, first_message, example_dialogs, tags:[{name}]})
// and Pygmalion/TavernAI ({char_name, char_persona, world_scenario, char_greeting, example_dialogue}) → V2 field names.
function normalizeData(d){
 if(d.character&&typeof d.character==='object'&&!d.name&&!d.char_name)d=d.character;
 if('char_name' in d||'char_persona' in d)return {...d,name:d.name||d.char_name,description:d.description||d.char_persona||'',scenario:d.scenario??d.world_scenario,first_mes:d.first_mes??d.char_greeting,mes_example:d.mes_example??d.example_dialogue};
 if(!('first_message' in d||'example_dialogs' in d))return d;
 const {first_message,example_dialogs,personality,description,tags,...rest}=d,blurb=stripHtml(description);
 return {...rest,description:personality||blurb||'',personality:'',first_mes:d.first_mes??first_message,mes_example:d.mes_example??example_dialogs,...(personality&&blurb?{creator_notes:d.creator_notes??blurb}:{}),tags:Array.isArray(tags)?tags.map(t=>typeof t==='string'?t:t?.name).filter(Boolean):tags};
}

// Accepts a PNG Buffer, a JSON string/Buffer or a parsed object; returns {spec,spec_version,data}. V3 (ccv3) wins over V2 (chara).
export function readCard(input){
 let card=input;
 if(Buffer.isBuffer(input)||input instanceof Uint8Array){const buf=Buffer.from(input);if(buf.subarray(0,8).equals(PNG_SIG)){const t=textChunks(buf),raw=t.ccv3||t.chara;assert(raw,'PNG has no character card (tEXt chara/ccv3)');card=fromB64(raw);}else card=buf.toString('utf8');}
 if(typeof card==='string')card=JSON.parse(card.replace(/^﻿/,''));
 assert(card&&typeof card==='object'&&!Array.isArray(card),'Card: expected an object');
 const data=normalizeData(card.data&&typeof card.data==='object'?card.data:card); // V1, JanitorAI and Pygmalion cards are flat
 assert(typeof data.name==='string'&&data.name.trim(),'Card: name required');
 return {spec:card.spec||'chara_card_v1',spec_version:card.spec_version||'1.0',data};
}

export const clean=(v,name)=>typeof v==='string'?stripStateSyntax(stripPlaceholders(v,'the player',name)).trim():v;
export const slug=s=>String(s).normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);
const unique=(base,taken)=>{let id=base,n=2;while(taken.has(id))id=`${base}-${n++}`;return id;};
const list=v=>Array.isArray(v)?v.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()):typeof v==='string'&&v.trim()?v.split(',').map(x=>x.trim()).filter(Boolean):undefined;

// Pure: card → {actor,lorebook}. `pack` supplies id/location defaults and collision checks; nothing is added to it.
export function cardToActor(input,pack,{id,location}={}){
 const {data}=readCard(input),sf=data.extensions?.[EXT]||{},name=data.name.trim().slice(0,120);
 const taken=new Set(pack.actors.map(a=>a.id)),want=id||sf.id||slug(name)||'character';
 assert(safeKey(want),`Card: invalid actor id ${want}`);const actorId=id?(assert(!taken.has(id),`Card: actor ${id} already exists`),id):unique(want,taken);
 const locs=new Set(pack.locations.map(l=>l.id)),player=pack.actors.find(a=>a.id===pack.playerId);
 const at=[location,sf.location,player?.location,pack.locations[0]?.id].find(l=>locs.has(l));assert(at,'Card: no valid location');
 // Exported cards carry their SF-composed description; if it is unchanged the SF fields are authoritative, else the edit wins.
 const edited=k=>sf.exported?.[k]!==undefined&&sf.exported[k]!==data[k];
 const actor={id:actorId,name,location:at,description:clean(sf.description!==undefined&&!edited('description')?sf.description:data.description||'',name)};
 const personality=sf.personality!==undefined&&!edited('personality')?sf.personality:data.personality;if(personality)actor.personality=clean(personality,name);
 for(const k of PROFILE)if(sf[k]!==undefined)actor[k]=Array.isArray(sf[k])?sf[k].map(x=>clean(x,name)):clean(sf[k],name);
 if(actor.traits)actor.traits=list(actor.traits);
 if(typeof actor.pronouns==='string')actor.pronouns=actor.pronouns.slice(0,40);
 const card={};for(const k of CARD_ONLY)if(data[k]!==undefined&&data[k]!==''&&!(Array.isArray(data[k])&&!data[k].length))card[k]=data[k];
 const ext=Object.fromEntries(Object.entries(data.extensions||{}).filter(([k])=>k!==EXT));if(Object.keys(ext).length)card.extensions=ext;
 if(Object.keys(card).length)actor.card=card;
 const loreIds=new Set((pack.lorebook||[]).map(e=>e.id)),lorebook=[];
 for(const [i,e] of (data.character_book?.entries||[]).entries()){
  if(!e||e.enabled===false||typeof e.content!=='string'||!e.content.trim())continue;const x=e.extensions?.[EXT]||{};
  const lid=unique(x.id&&safeKey(x.id)?x.id:`${actorId}-${i+1}`,loreIds);loreIds.add(lid);
  const entry={id:lid,text:clean(e.content,name),tags:list(e.keys)||[],scope:'character',character:actorId,knownBy:[actorId]};
  for(const k of LORE_EXTRA)if(x[k]!==undefined)entry[k]=x[k];if(Array.isArray(entry.knownBy))entry.knownBy=entry.knownBy.map(k=>k===x.character?actorId:k).filter(k=>k===actorId||taken.has(k));
  lorebook.push(entry);
 }
 return {actor,lorebook};
}

// Pure: returns a new pack with the card's actor and lore appended.
export function importCard(pack,input,opts){const {actor,lorebook}=cardToActor(input,pack,opts);return {pack:{...pack,actors:[...pack.actors,actor],lorebook:[...(pack.lorebook||[]),...lorebook]},actorId:actor.id};}

const composed=a=>[a.description,a.backstory&&`Backstory: ${a.backstory}`,a.goal&&`Goal: ${a.goal}`,a.likes&&`Likes: ${[].concat(a.likes).join(', ')}`,a.dislikes&&`Dislikes: ${[].concat(a.dislikes).join(', ')}`].filter(Boolean).join('\n\n');
const composedPersonality=a=>[a.personality,a.traits?.length&&`Traits: ${a.traits.join(', ')}`,a.voice&&`Voice: ${a.voice}`,a.style&&`Manner: ${a.style}`].filter(Boolean).join('\n');

// Actor → V2 or V3 card object. Front-ends without SF get readable composed text; SF re-import is lossless via the extension.
export function actorToCard(pack,actorId,{version=3}={}){
 const a=pack.actors.find(x=>x.id===actorId);assert(a,`Unknown actor ${actorId}`);assert(actorId!==pack.playerId,'Cannot export the player as a card');
 const c=a.card||{},description=composed(a),personality=composedPersonality(a);
 const sf={id:a.id,location:a.location,description:a.description||'',...(a.personality!==undefined?{personality:a.personality}:{}),exported:{description,personality}};for(const k of PROFILE)if(a[k]!==undefined)sf[k]=a[k];
 const lore=(pack.lorebook||[]).filter(e=>e.scope==='character'&&e.character===actorId);
 const data={name:a.name,description,personality,scenario:c.scenario||'',first_mes:c.first_mes||'',mes_example:c.mes_example||'',creator_notes:c.creator_notes||'',system_prompt:c.system_prompt||'',post_history_instructions:c.post_history_instructions||'',alternate_greetings:c.alternate_greetings||[],tags:c.tags||[],creator:c.creator||'',character_version:c.character_version||'',extensions:{...(c.extensions||{}),[EXT]:sf}};
 if(lore.length)data.character_book={name:`${a.name} lore`,entries:lore.map((e,i)=>({keys:e.tags||[],content:e.text,extensions:{[EXT]:{id:e.id,character:actorId,...Object.fromEntries(LORE_EXTRA.filter(k=>e[k]!==undefined).map(k=>[k,e[k]]))}},enabled:true,insertion_order:i,use_regex:false,constant:!(e.tags||[]).length,id:i})),extensions:{}};
 if(version===3){for(const k of ['nickname','source','creation_date','modification_date'])if(c[k]!==undefined)data[k]=c[k];data.group_only_greetings=c.group_only_greetings||[];if(data.character_book)data.character_book.entries.forEach(e=>{e.name=e.extensions[EXT].id;});return {spec:'chara_card_v3',spec_version:'3.0',data};}
 return {spec:'chara_card_v2',spec_version:'2.0',data};
}

// Embeds a card into a PNG as tEXt chunks (chara = V2 for older readers, ccv3 = V3), replacing any existing ones.
export function embedCard(png,card){
 const buf=Buffer.from(png);assert(buf.subarray(0,8).equals(PNG_SIG),'Not a PNG');
 const cs=chunks(buf),iend=cs.find(c=>c.type==='IEND');assert(iend,'PNG: missing IEND');
 const keep=cs.filter(c=>c.type!=='IEND'&&!(c.type==='tEXt'&&/^(chara|ccv3)\0/i.test(c.data.toString('latin1',0,6))));
 const text=(key,obj)=>{const body=Buffer.concat([Buffer.from(`${key}\0`,'latin1'),Buffer.from(Buffer.from(JSON.stringify(obj),'utf8').toString('base64'),'latin1')]),type=Buffer.from('tEXt','latin1'),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(body.length);crc.writeUInt32BE(crc32(Buffer.concat([type,body])));return Buffer.concat([len,type,body,crc]);};
 const v2={...card,spec:'chara_card_v2',spec_version:'2.0'};
 return Buffer.concat([PNG_SIG,...keep.map(c=>buf.subarray(c.at,c.end)),text('chara',v2),...(card.spec==='chara_card_v3'?[text('ccv3',card)]:[]),buf.subarray(iend.at,iend.end)]);
}
