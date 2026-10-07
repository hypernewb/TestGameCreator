// Erotic-VN place fields and description lint. A place says how it feels and how exposed it is; it never pins people in place
// or promises doors to rooms the map does not have.
export const EXPOSURES=['private','risky','public'];
const str=(v,n)=>typeof v==='string'&&v.trim()?v.trim().slice(0,n):'',tag=v=>str(v,40).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
export const LOCATION_FIELDS=Object.freeze({mood:'one line: how the place feels (lighting, sound, smell)',crowd:'who is usually around and when it empties out',exposure:'private (nobody walks in), risky (could be caught) or public',artTags:'3-6 short background-art tags'});
export function locationExtras(l){const o={},mood=str(l?.mood,160),crowd=str(l?.crowd,160),tags=[...new Set((Array.isArray(l?.artTags)?l.artTags:[]).map(tag).filter(Boolean))].slice(0,8);
 if(mood)o.mood=mood;if(crowd)o.crowd=crowd;if(EXPOSURES.includes(l?.exposure))o.exposure=l.exposure;if(tags.length)o.artTags=tags;return o;}
export const locationGuidance=()=>`Each location also has mood (${LOCATION_FIELDS.mood}), crowd (${LOCATION_FIELDS.crowd}), exposure ("private", "risky" or "public") and artTags (${LOCATION_FIELDS.artTags}). This is an erotic dating sim: across the map include at least one romantic spot, one private place where two people can be truly alone, and one risky half-hidden spot where they could be caught. Descriptions describe only the place: never name characters or say who is always there (people move), and only mention ways out that lead to other locations on this map.`;
const STOP=new Set(['the','a','an','of','and','old','small','little','back','front','main','other','upper','lower','narrow','wide','room','area','place','side','door']);
const WAY=/\b(?:leads?|leading|opens?|opening|doors?|doorway|stairs?|staircase|steps|path|passage|corridor|hallway|gate|archway|exits?|tunnel|ladder|trapdoor)\s+(?:up\s+|down\s+|out\s+|back\s+|off\s+)?(?:to|into|onto|toward|towards)\s+(?:the\s+|a\s+|an\s+)?([a-z][a-z' -]{2,40}?)(?=[.,;:!?)]|\s+(?:and|where|which|that|beyond|below|above)\b|$)/gi;
// Problems as sentences for a model retry. cast: names of people in the game; locations: every place on the map (old and new).
export function locationProblems(list,{cast=[],locations=list}={}){
 const out=[],names=[...new Set(cast.flatMap(n=>{const full=str(n,80);return full?[full,full.split(/\s+/)[0]]:[];}).filter(n=>n.length>=3))],words=new Set(locations.flatMap(l=>`${l.name||''} ${String(l.id||'').replace(/[-_.]/g,' ')}`.toLowerCase().match(/[a-z']+/g)||[]).filter(w=>!STOP.has(w)));
 for(const l of list){const d=String(l?.description||''),id=l?.id||l?.name||'?';
  const who=names.filter(n=>new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(d));if(who.length)out.push(`${id}.description names ${[...new Set(who)].join(', ')}; describe only the place, people move around`);
  for(const m of d.matchAll(WAY)){const phrase=m[1].trim().toLowerCase(),keys=(phrase.match(/[a-z']+/g)||[]).filter(w=>!STOP.has(w));if(keys.length&&!keys.some(w=>words.has(w)||words.has(w.replace(/s$/,''))))out.push(`${id}.description mentions a way to "${phrase}", which is not a location on this map; only mention exits to listed locations`);}}
 return out;}
// Fill only a place's empty fields; authored text is context, never rewritten.
const blank=(l,k)=>k==='artTags'?!(Array.isArray(l?.artTags)&&l.artTags.length):!str(l?.[k],2000);
export function locationFillMessages(pack,loc){
 const blanks=['description',...Object.keys(LOCATION_FIELDS)].filter(k=>blank(loc,k)),s={type:'string'},props={description:s,mood:s,crowd:s,exposure:{type:'string',enum:EXPOSURES},artTags:{type:'array',items:s,maxItems:8}},others=(pack?.locations||[]).filter(l=>l?.id!==loc?.id),exits=(loc?.exits||[]).map(e=>others.find(l=>l.id===e.to)?.name||e.to);
 const known=['name','description',...Object.keys(LOCATION_FIELDS)].filter(k=>!blank(loc,k)).map(k=>`${k}: ${Array.isArray(loc[k])?loc[k].join(', '):loc[k]}`);
 const messages=[{role:'system',content:`You fill blank fields on one location of an erotic dating sim / visual novel. Return JSON only with exactly these keys: ${blanks.join(', ')}. ${locationGuidance()} description is 2-4 sentences of what the player sees there.${blanks.includes('description')?` It may mention only these ways out: ${exits.join(', ')||'none'}.`:''}`},{role:'user',content:[`WORLD: ${str(pack?.title,120)}${pack?.setting?` — ${str(pack.setting,400)}`:''}`,`THIS LOCATION (authored, keep it)\n${known.join('\n')}`,others.length&&`OTHER LOCATIONS\n${others.slice(0,12).map(l=>`- ${l.name||l.id}${l.exposure?` (${l.exposure})`:''}`).join('\n')}`,`Fill: ${blanks.join(', ')}`].filter(Boolean).join('\n\n')}];
 return {messages,blanks,schema:{type:'object',properties:Object.fromEntries(blanks.map(k=>[k,props[k]])),required:blanks,additionalProperties:false}};}
export function locationFillPatch(loc,raw,pack){if(!raw||typeof raw!=='object')throw Error('expected a JSON object');const extra=locationExtras(raw),out={};
 for(const k of Object.keys(LOCATION_FIELDS))if(blank(loc,k)&&extra[k]!==undefined)out[k]=extra[k];const d=str(raw.description,800);if(d&&blank(loc,'description'))out.description=d;
 if(out.description){const bad=locationProblems([{...loc,description:out.description}],{cast:(pack?.actors||[]).filter(a=>a.id!==pack.playerId).map(a=>a.name),locations:pack?.locations||[loc]});if(bad.length)throw Error(bad.join('; '));}
 return out;}
