// M2 draft pass: fill a spec's blank text slots with a cloud model (OpenRouter in Studio), batch by batch, then re-assemble.
// The model only ever returns strings for paths we asked for; ids, tones, gates and numbers never pass through it.
import {assemble} from './world-assembly.mjs';
import {TEMPERAMENTS,DEFAULT_CHOICE_TONES} from './beat-library.mjs';
import {directorHint,libraryEntry,DIRECTOR_NOTE} from './director-library.mjs';
import {parseModelObject} from '../ai/json.mjs';

const MAX=1200;
// What each slot is for, matched on the path tail. First match wins.
const HINTS=[
 [/^title$/,'the world\'s title, 1–4 words'],[/^project\.premise$/,'one or two sentences: who the player is and what the run is about'],[/^project\.setting$/,'one or two sentences: the place'],
 [/^fallback\.name$/,'ending title when the run ends with nobody'],[/^fallback\.text$/,'2–3 sentences, bittersweet, no one chosen'],
 [/actor\.description$/,'one sentence a stranger sees: look, age range, what she does'],[/actor\.voice$/,'how she talks, 1 sentence, with one sample line'],
 [/ranks\.(\d)$/,'name of relationship rank $1 of 0–3 (0 stranger … 3 in love), 1–3 words'],[/stages\.(\d)\.name$/,'name of her personal arc stage $1 of 0–2, 1–3 words'],[/stages\.(\d)\.voice$/,'how she acts at arc stage $1, one sentence'],
 [/reasons\.(\w[\w-]*)$/,'hidden reason she reacts to the player act "$1" the way she does; 4–10 words, lower case, starts with "you"'],
 [/interest\.label$/,'a tender intimate thing she likes, 2–5 words'],
 [/endings\.route\.name$/,'title of her best ending (her arc finished and she loves you)'],[/endings\.route\.text$/,'3–4 sentences, her arc resolved, together'],
 [/endings\.together\.name$/,'title of the ending where you are simply together at the end'],[/endings\.together\.text$/,'2–3 sentences'],
 [/rungs\.(\w+)\.title$/,'scene title for the first $1'],[/rungs\.\w+\.(checkIn|peak)\.opening$/,'what she says/does at the $1 beat, 1–2 sentences'],[/rungs\.(\w+)\.opening$/,'first line of the $1 scene, 1–2 sentences, present tense'],
 [/pages\.\d+\.text$/,'one more short paragraph of the scene, 2–3 sentences'],
 [/\.stop$/,'what she says when the player asks to stop: warm, no guilt, 1 sentence'],
 [/\.label$/,'the player\'s choice, first person, under 10 words'],[/\.result$/,'what happens after that choice, 1–2 sentences'],
];
export const hintFor=path=>{const d=directorHint(path);if(d)return d;for(const [re,h] of HINTS){const m=path.match(re);if(m)return h.replace(/\$(\d)/g,(_,i)=>m[i]);}return 'short text';};

// Tone per choice path, so labels match the numbers the template will attach.
const TONE_WORDS={best:'lands perfectly',good:'lands well',fond:'sweet but safe',careful:'careful, earns trust',light:'half-lands',spark:'flirty',flat:'falls flat',miss:'misses: a little wrong for her'};
const NIGHT_WORDS={lead:'let her lead',rush:'rush her: lands badly',honest:'say honestly what you want',yes:'just say yes',close:'stay close and slow',more:'ask for more'};
const toneOf=(spec,path)=>{const m=path.match(/^heroines\.([^.]+)\.rungs\.(\w+)\.(?:choices\.(\d+)|(?:checkIn\.|peak\.)?(\w+))\.(?:label|result)$/);if(!m)return null;
 const h=spec.heroines.find(x=>x.id===m[1]);if(m[3]!=null){const cs=h.rungs?.[m[2]]?.choices;return TONE_WORDS[(cs?.length?cs[m[3]]?.tone:DEFAULT_CHOICE_TONES[m[3]])]||null;}return NIGHT_WORDS[m[4]]||null;};

// Paths address heroines by id and arrays by index; missing containers are created (a rung's choices get the default tones).
export function setPath(spec,path,value){
 const keys=path.split('.');let o=spec;
 for(let i=0;i<keys.length-1;i++){let k=keys[i];
  if(Array.isArray(o)&&o===spec.heroines){o=o.find(h=>h.id===k);if(!o)throw new Error(`draft: unknown heroine ${k}`);continue;}
  if(k==='choices'&&keys[0]==='heroines'&&!o.choices?.length)o.choices=DEFAULT_CHOICE_TONES.map(tone=>({tone}));
  if(o[k]==null)o[k]=/^\d+$/.test(keys[i+1])?[]:{};else if(typeof o[k]==='string'&&/^(reasons)$/.test(keys[i-1]||''))o[k]={reason:o[k]};
  o=o[k];}
 const last=keys.at(-1);if(o[last]&&typeof o[last]==='object'&&!Array.isArray(o[last])&&'reason' in o[last])o[last].reason=value;else o[last]=value;return spec;
}

// Batches: the world first (everything else leans on it), then per heroine her profile, then each rung. Small batches keep JSON reliable.
export function batches(missing){
 const key=p=>{const d=p.match(/^director\.beats\.([\w-]+)\./);if(d)return `director:${libraryEntry(d[1])?.kind||'other'}`;const m=p.match(/^heroines\.([^.]+)\.(?:rungs\.(\w+)|)/);return !m?'world':m[2]?`${m[1]}:${m[2]}`:`${m[1]}:profile`;};
 const out=new Map();for(const p of missing){const k=key(p);if(!out.has(k))out.set(k,[]);out.get(k).push(p);}
 return [...out].sort(([a],[b])=>(a==='world'?-1:b==='world'?1:a.startsWith('director:')-b.startsWith('director:'))).map(([id,paths])=>({id,paths}));
}

const brief=(spec,hid)=>{const w=[`World: ${spec.title||'(untitled)'}. ${spec.project?.premise||''} ${spec.project?.setting||''}`.trim()];
 const hs=hid?spec.heroines.filter(h=>h.id===hid):spec.heroines;
 for(const h of hs){const T=TEMPERAMENTS[h.temperament];w.push(`${h.actor?.name||h.id} (id ${h.id}, age ${h.actor?.age}): ${T.about} Pace: ${h.pace}. Loves talking about ${h.topic}.${h.looks?` Compliments on ${h.looks} miss.`:''}${h.quirk?` Noticing her ${h.quirk} lands.`:''}${h.actor?.description&&!h.actor.description.startsWith('[[')?` ${h.actor.description}`:''}`);}
 const card=spec.source?.card;if(card&&(!hid||hid===card.heroine))w.push(`${card.name}'s character card (keep her voice and looks):\n${hid?card.text:card.text.slice(0,600)}`);
 return w.join('\n');};
export function draftMessages(spec,batch,{style}={}){
 const hid=batch.id==='world'||batch.id.startsWith('director:')?null:batch.id.split(':')[0];
 const lines=batch.paths.map(p=>{const t=toneOf(spec,p);return `"${p}": ${hintFor(p)}${t?` (this choice ${t})`:''}`;});
 return [{role:'system',content:`You write text for an adult dating-sim world. Every character is an adult. Intimacy is always consensual and she can always stop. Intimate scenes may be explicit. Write in English, present tense, second person for the player.${style?` Style: ${style}`:''} Reply with one JSON object whose keys are exactly the paths listed and whose values are strings. No other keys, no commentary.`},
  {role:'user',content:`${brief(spec,hid)}${batch.id.startsWith('director:')?`\n${DIRECTOR_NOTE}`:''}\n\nFill these:\n${lines.join('\n')}`}];
}

// Accept only asked-for paths with non-empty strings; drop anything else the model sends.
export function acceptDraft(spec,batch,raw){
 let out;try{out=parseModelObject(raw);}catch{return {spec,filled:[]};}
 const next=structuredClone(spec),filled=[];
 for(const p of batch.paths){const v=out?.[p];if(typeof v==='string'&&v.trim()&&!v.includes('[['))setPath(next,p,v.trim().slice(0,MAX)),filled.push(p);}
 return {spec:next,filled};
}

// complete(messages) -> Promise<string>. Retries only what is still missing, up to `rounds` passes; a batch that throws just stays missing.
export async function draftWorld(spec,{complete,rounds=2,style,onBatch}={}){
 let s=structuredClone(spec),{missing}=assemble(s),calls=0;
 for(let r=0;r<rounds&&missing.length;r++){
  for(const b of batches(missing)){let raw,error;try{raw=await complete(draftMessages(s,b,{style}));}catch(e){error=e.message;}calls++;const x=error?{spec:s,filled:[]}:acceptDraft(s,b,raw);s=x.spec;onBatch?.({batch:b.id,asked:b.paths.length,filled:x.filled.length,...(error?{error}:{})});}
  missing=assemble(s).missing;}
 const {pack}=assemble(s);return {spec:s,pack,missing,calls};
}

// What the wizard hands the drafter: the owner's picks (templates, targets, ids, world data) with every prose slot empty.
const pick=(o,ks)=>Object.fromEntries(ks.filter(k=>o?.[k]!==undefined).map(k=>[k,o[k]]));
const tones=cs=>cs?.length?{choices:cs.map(c=>pick(c,['id','tone','discover','learn']))}:{},skel=ps=>ps?.length?{pages:ps.map(p=>pick(p,['speaker']))}:{};
const ids=(x,ks)=>Object.fromEntries(ks.filter(k=>x?.[k]?.id).map(k=>[k,{id:x[k].id}])),beat=(x,ks)=>({...skel(x.pages),...ids(x,ks)});
const rung=x=>({...pick(x,['cg']),...beat(x,['lead','rush']),...tones(x.choices),...(x.checkIn?{checkIn:beat(x.checkIn,['honest','yes'])}:{}),...(x.peak?{peak:beat(x.peak,['close','more'])}:{})});
export function structureOnly(spec){
 const heroines=spec.heroines.map(h=>({...pick(h,['id','temperament','pace','trust','topic','looks','quirk','invite','gifts','buy','activities','wants','rankIds','arcFlag','harp','aftercare']),
  actor:pick(h.actor,['id','name','age','pronouns','location','identityTags','appearance','portrait','poses','cg']),...(h.stages?{stages:h.stages.map(s=>pick(s,['id']))}:{}),...(h.interest?{interest:pick(h.interest,['id'])}:{}),
  ...(h.endings?{endings:{route:pick(h.endings.route,['id'])}}:{}),
  rungs:Object.fromEntries(Object.entries(h.rungs||{}).map(([r,x])=>[r,rung(x)]))}));
 return {...pick(spec,['id','version','days','friends','world','source']),player:pick(spec.player,['id','name','age','pronouns','location','identityTags']),project:pick(spec.project,['premise','presentation','conversationStyle','sceneBudget','calendar','ai','writingStyle']),
  ...(spec.fallback?{fallback:pick(spec.fallback,['id','flag'])}:{}),...(spec.director?{director:pick(spec.director,['tone'])}:{}),heroines};
}
