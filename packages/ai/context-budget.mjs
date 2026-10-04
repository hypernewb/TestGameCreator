import {narrationContext,authoredAudience,intersectKnown,visibleToAudience} from './knowledge.mjs';
import {relationshipStageOf,behaviorCueOf} from './character-context.mjs';
import {allocate,lods,messageTokens,DEFAULT_TIERS} from './budget.mjs';
import {calendarFor} from '../../public/calendar.mjs';
import {promptView} from '../../vendor/venus/scenePrompt.mjs';
import {relevance} from './memory.mjs';

// Engine-authored digests come from committed events, so older history can shrink without the drift of a
// model-written summary: the model's prose is flavor, the digest is the record.
const QUIET=new Set(['core.patch','core.timeAdvanced','core.sceneStarted','core.sceneContinued','social.spoke','story.sceneQueued','core.waited']);
const clip=(text,n)=>{const s=String(text||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s;};
export function eventChanges(turn,audience=null){
 const out=[];
 for(const e of turn.events||[]){
  if(audience&&!visibleToAudience(e.visibility,audience))continue;
  if(e.type==='core.patch'){if(audience)continue;if(e.payload.path?.[0]==='flags')out.push(`flag ${e.payload.path[1]}=${JSON.stringify(e.payload.value)}`);continue;}
  if(QUIET.has(e.type)||!Array.isArray(e.visibility)&&e.visibility!=='public')continue;
  out.push(e.payload.text?clip(e.payload.text,90):`${e.type} ${clip(JSON.stringify(e.payload),70)}`);
 }
 return [...new Set(out)];
}
export function turnDigest(turn,audience=null){
 const said=clip(turn.input||turn.command?.args?.text||'',100),changes=eventChanges(turn,audience);
 return [said&&`Player: ${said}`,changes.length&&`→ ${changes.join('; ')}`].filter(Boolean).join(' ')||turn.command?.type||'';
}
export function sceneDigest(turns,audience=null){return [...new Set(turns.flatMap(t=>eventChanges(t,audience)))].join('; ');}
export const digestOwners=(turns,audience=null)=>intersectKnown(turns.flatMap(t=>(t.events||[]).filter(e=>!QUIET.has(e.type)&&e.type!=='core.patch'&&(e.visibility==='public'||Array.isArray(e.visibility))&&(!audience||visibleToAudience(e.visibility,audience))).map(e=>e.visibility)));
const sceneDigestOf=scenes=>[...new Set(scenes.flatMap(x=>(x.digest||'').split('; ')).filter(Boolean))].join('; ');

// Sub-turns the service appends to one player action: they carry score and close state, never scene prose, so
// neither the model's scene history nor the showcase dialogue may show them as conversation.
import {SUB_TURNS} from '../../public/turn-presentation.mjs';
export {SUB_TURNS};

/** Every narrated turn of the current scene, oldest first; the allocator decides how much stays verbatim. */
export function sceneTranscript(world,turn,cast,limit=120,audience=null){
 if(turn.events.some(e=>['core.sceneStarted','core.moved','world.daypartStarted','world.hangoutStarted'].includes(e.type)))return [];
 const history=[];
 for(const prior of Object.values(world.turns).filter(t=>t.id!==turn.id&&t.status==='complete').reverse()){
  if(prior.command.type==='world.nextDaypart'||prior.command.type==='core.endScene'||prior.sceneEnded||(prior.sceneId&&world.scene&&prior.sceneId!==world.scene.id))break;
  if(SUB_TURNS.has(prior.command.type))continue;
  const people=[...(prior.command.type==='social.speak'?[prior.command.args.target]:prior.events.find(e=>e.type==='core.sceneStarted'||e.type==='core.sceneContinued')?.payload.characters||[]),...(prior.sceneLines||[]).map(line=>line.speaker).filter(Boolean)];
  if(people.some(id=>!cast.includes(id)))break;
  if(prior.narrative&&!prior.fallback)history.unshift({source:prior.id,input:prior.input||prior.command.args.text||'',text:prior.narrative,digest:turnDigest(prior,audience),digestKnownBy:digestOwners([prior],audience)});
  if(history.length>=limit||prior.events.some(e=>['core.moved','core.sceneStarted','world.hangoutStarted'].includes(e.type)))break;
 }
 return history;
}

const castOf=t=>t.command.type==='social.speak'?[t.command.args.target]:t.command.type==='world.acceptHangout'?[t.command.args.char]:t.events.find(e=>e.type==='core.sceneStarted'||e.type==='core.sceneContinued')?.payload.characters||[];
/** Closed scenes that involved anyone in the cast, oldest first, each with its model summary and event digest.
 *  A scene whose last NPC line is a question the player never answered carries `unansweredQuestion`, so the next
 *  conversation with that character can acknowledge the interruption instead of answering as if no time passed. */
export function closedScenes(world,cast,pack=null,audience=null){
 const turns=Object.values(world.turns),bySceneId=new Map();
 for(const t of turns)if(t.sceneId){if(!bySceneId.has(t.sceneId))bySceneId.set(t.sceneId,[]);bySceneId.get(t.sceneId).push(t);}
 const hangingOf=sceneId=>{
  const sceneTurns=bySceneId.get(sceneId)||[],last=sceneTurns.map(t=>Boolean(t.input)).lastIndexOf(true),
   lines=(last<0?sceneTurns:sceneTurns.slice(last)).flatMap(t=>t.sceneLines||[]),
   asked=[...lines].reverse().find(line=>line.speaker&&line.speaker!==pack?.playerId&&/\?\s*["'\u201d»]*\s*$/u.test(line.text)),
   name=asked?pack?.actors.find(a=>a.id===asked.speaker)?.name:null;
  return asked&&name?{by:name,text:String(asked.text).replace(/\s+/gu,' ').trim().slice(0,160)}:null;};
 return turns.filter(t=>t.sceneEnded&&t.sceneSummary&&castOf(t).some(id=>cast.includes(id))).map(t=>{
  const entry={source:t.id,text:t.sceneSummary,digest:sceneDigest(bySceneId.get(t.sceneId)||[t],audience),digestKnownBy:digestOwners(bySceneId.get(t.sceneId)||[t],audience),tick:t.events[0]?.tick??null,...(pack&&t.events[0]?(({day,week})=>({day,week}))(calendarFor(t.events[0].tick,pack)):{})},
   unansweredQuestion=hangingOf(t.sceneId);
  return unansweredQuestion?{...entry,unansweredQuestion}:entry;});
}
/**
 * Calendar roll-up of closed scenes: today's stay individual, earlier days this week merge per day, and earlier weeks
 * merge per week, so a semester of recaps costs a handful of entries instead of one per scene. Oldest first.
 */
export function recapGroups(scenes,today=null,thisWeek=null){
 const groups=new Map();
 for(const scene of scenes){
  const key=today===null||scene.day===undefined||scene.day===today?`past:${scene.source}`:scene.week===thisWeek?`day:${scene.day}`:`week:${scene.week}`;
  if(!groups.has(key))groups.set(key,{key,source:key.startsWith('past:')?scene.source:key,period:key.startsWith('day:')?`Day ${scene.day}`:key.startsWith('week:')?`Week ${scene.week}`:null,scenes:[]});
  groups.get(key).scenes.push(scene);
 }
 return [...groups.values()];
}

/** Keys that recent turns surfaced, newest first — drives stickiness (relevant items keep their slot) and freshness. */
export function recentlySurfaced(world,turnId,window=8){
 const seen=new Map();let age=0;
 for(const t of Object.values(world.turns).filter(t=>t.id!==turnId&&t.contextReport).reverse().slice(0,window)){age++;for(const [key] of t.contextReport.included)if(!seen.has(key))seen.set(key,age);}
 return seen;
}

const MOODS=['in a good mood today','a little tired today','quieter than usual today','restless today','chattier than usual today'];
const moodHash=s=>[...String(s)].reduce((h,c)=>Math.imul(h^c.charCodeAt(0),16777619)>>>0,2166136261);
const dailyMood=(a,c)=>{if(c.day==null)return c.mood||'';const moods=[].concat(a.moods||MOODS),h=moodHash(`${a.id}:day${c.day}`);return !c.scriptedScene&&h%3===0?moods[(h>>>2)%moods.length]||'':'';};

// Pick 2 voice examples by relationship stage and mood tier
function voiceExamplesByState(a,stage,mood,strained){
  const ex=a.voiceExamples||{};
  const moodTier=mood?mood.includes('good')||mood.includes('chattier')?'welcoming':mood.includes('tired')||mood.includes('quieter')?'dodging':'declining':'welcoming';
  const pick=(cat)=>[].concat(ex[cat]||[]).slice(0,2);
  // Stage priority: dating/exclusive -> welcoming, strained/rejected/broken -> declining, else mood-based
  if(['dating','exclusive','crush'].includes(stage))return pick('welcoming');
  if(strained||['rejected','broken'].includes(stage))return pick('declining');
  return pick(moodTier);
}

const profileOf=(a,stage='',mood='',strained=false)=>({id:a.id,name:a.name,pronouns:a.pronouns||'they/them',description:a.description||'',personality:a.personality||'',behavior:a.behavior||{},behaviorCue:a.behaviorCue||'',traits:a.traits||[],voice:a.voice||'',fingerprint:a.fingerprint||'',style:a.style||'',examples:a.examples||[],goal:a.goal||'',backstory:a.backstory||'',likes:a.likes||[],dislikes:a.dislikes||[],voiceBlock:{fingerprint:a.fingerprint||'',examples:voiceExamplesByState(a,stage,mood,strained)}});
const compactProfile=(a,stage='',mood='',strained=false)=>({id:a.id,name:a.name,pronouns:a.pronouns||'they/them',personality:clip(a.personality||a.description||'',240),behaviorCue:a.behaviorCue||'',traits:a.traits||[],voice:a.voice||'',fingerprint:a.fingerprint||'',voiceBlock:{fingerprint:a.fingerprint||'',examples:voiceExamplesByState(a,stage,mood,strained)},examples:(a.examples||[]).slice(0,2)});

/**
 * Fits a scene context into the model's window. `render(context)` must return the prompt messages so the fixed
 * part (rules, current state, committed outcomes, player action — tier 0) is measured, never trimmed.
 * Returns the budgeted context plus a report of what went in, at which detail level, and what was cut.
 */
export function budgetSceneContext(context,pack,world,turnId,{window=8192,reply=1800,ratio=1,margin=0.06,render,tiers=DEFAULT_TIERS,verbatim=Infinity,wideContext=false}={}){
 context=narrationContext(context,pack);const audience=authoredAudience(context,pack);
 const cast=context.stagedCast||[],surfaced=recentlySurfaced(world,turnId);
 const sticky=key=>surfaced.get(key)===1?4:0,stale=key=>surfaced.has(key)?-6/surfaced.get(key):0;
 const pools={castProfiles:[],sceneHistory:[],generatedFacts:[],facts:[],memories:[],lorebook:[],pastScenes:[],npcRelationships:[]};
 const base=messageTokens(render({...context,...pools,sceneSummary:context.sceneSummary}),ratio);
 const budget=Math.max(0,Math.floor(window*(1-margin))-reply),poolBudget=Math.max(0,budget-base);
 const items=[],add=(pool,tier,key,rank,pairs,extra={})=>{const levels=lods(pairs,ratio,promptView[pool]);if(levels.length)items.push({pool,tier,key,rank,lods:levels,...extra});};
 const actors=pack.actors.filter(a=>cast.includes(a.id));
 // Determine stage and mood for voice example selection
  const datingInfo=a=>(context.dating||[]).find(d=>d.character===a.id)||{};
  const currentMood=a=>dailyMood(a,context);
  actors.forEach((a,i)=>{const d=datingInfo(a);const phase=d.phase||'';a={...a,behaviorCue:behaviorCueOf(a,relationshipStageOf(context,a,world.modules?.['social.relationships']?.edges?.[`${a.id}--${pack.playerId}`]??null))};const strained=d.strained||false;add('castProfiles',1,`cast:${a.id}`,100-i,[['full',profileOf(a,phase,currentMood(a),strained)],['compact',compactProfile(a,phase,currentMood(a),strained)],['name',{id:a.id,name:a.name,pronouns:a.pronouns||'they/them'}]]);});
 const history=context.sceneHistory||[];
 // `verbatim` caps how many recent turns may stay word for word even when they fit: a small model given 25 full turns
  // loses track of which question it is answering, and does better with a short transcript plus one-line digests.
 // wideContext grows the tail window (700 -> 1500 chars) and keeps full/tail LODs for any turn naming a cast member, so
 // a character's continuity and recurring dialogue beats survive a tight budget instead of shrinking to a digest.
 const focusNames=wideContext?cast.map(id=>pack.actors.find(a=>a.id===id)?.name).filter(Boolean):[];
 const tailWindow=wideContext?1500:700;
 const isCharLine=h=>wideContext&&focusNames.some(n=>n&&String(h.text+' '+(h.input||'')).includes(n));
 history.forEach((h,i)=>{const verbatimEligible=i>=history.length-verbatim;const charLine=isCharLine(h);add('sceneHistory',2,`history:${h.source}`,i,[...(verbatimEligible||charLine?[['full',{source:h.source,knownBy:h.knownBy,input:h.input,text:h.text}],['tail',{source:h.source,knownBy:h.knownBy,input:clip(h.input,200),text:h.text.length>tailWindow?'…'+h.text.slice(-tailWindow):h.text}]]:[]),['digest',{source:h.source,knownBy:intersectKnown([h.knownBy,h.digestKnownBy]),compact:true,text:h.digest||turnDigest({input:h.input,events:[]},audience)}]],{monotone:true});});
 (context.generatedFacts||[]).forEach(f=>add('generatedFacts',3,`fact:${f.id}`,(f.score??(f.reason==='current scene'?10:8))+sticky(`fact:${f.id}`),[['full',f]]));
 (context.facts||[]).forEach((f,i)=>add('facts',3,`authored:${f.id}`,5-i/1000,[['full',f]]));
 // What the player disclosed or promised outranks model-written impressions; words shared with the current action
 // lift the memory being asked about ("where did I grow up?") above the rest, so it survives a tight window.
 const KIND={promise:9,disclosure:9,statement:4};
 // A memory sharing words with the action is flagged `relevant`; the prompt shows it beside PLAYER ACTION, where a
 // small model actually looks, instead of deep inside CURRENT STATE. Same tokens, moved.
 const names=pack.actors.map(a=>a.name);
 // The current turn's own statement is already PLAYER ACTION; recalled beside it, it reads as an echo the model repeats.
 const current=m=>turnId&&String(m.source).split('.')[0]===turnId;
 (context.memories||[]).forEach((m,i)=>{if(current(m))return;const r=relevance(m.text,context.playerAction||'',names),v=r?{...m,relevant:true}:m;add('memories',3,`memory:${m.source}:${i}`,(KIND[m.kind]??(m.character?6:5))+r+i/1000,[['full',v],['short',{...v,text:clip(m.text,140)}]]);});
 (context.lorebook||[]).forEach(e=>{const matched=/^(tag|text|sticky):/.test(e.reason||'')||e.reason==='current location'||e.reason==='character',rank=(e.score??0)+(matched?sticky(`lore:${e.id}`):stale(`lore:${e.id}`));add('lorebook',4,`lore:${e.id}`,rank,[['full',e],['short',{...e,text:clip(e.text,220)}]]);});
 const recaps=recapGroups(context.pastScenes||[],context.day??null,context.week??null);
 recaps.forEach((g,i)=>{const head={source:g.source,changesKnownBy:intersectKnown(g.scenes.map(x=>x.digestKnownBy)),knownBy:g.scenes.every(x=>Array.isArray(x.knownBy))?g.scenes[0].knownBy.filter(id=>g.scenes.every(x=>x.knownBy.includes(id))):undefined,...(g.period?{period:g.period}:{})},digest=sceneDigestOf(g.scenes),text=g.scenes.map(x=>x.text).join(' ');
  add('pastScenes',5,g.key,i,[['full',{...head,text,...(digest?{changes:digest}:{})}],['summary',{...head,text:g.period?g.scenes.map(x=>clip(x.text,160)).join(' '):text}],['digest',digest?{...head,changes:clip(digest,g.period?320:200)}:null]]);});
 (context.npcRelationships||[]).forEach(r=>{const key=`npc:${r.characters.join('|')}`;add('npcRelationships',6,key,stale(key),[['full',r]]);});
 const result=allocate(items,{budget:poolBudget,tiers});
 // A cast member can lose detail but never vanish from the prompt: the attendance list must stay whole.
 let overBudget=base>budget;
 for(const item of items.filter(i=>i.pool==='castProfiles'&&!result.chosen.has(i.key))){const lod=item.lods.at(-1);result.chosen.set(item.key,lod);result.included.push({key:item.key,pool:item.pool,tier:1,level:lod.level,cost:lod.cost});result.cut=result.cut.filter(c=>c.key!==item.key);result.used+=lod.cost;overBudget=true;}
 const keep=(list,keyOf)=>list.map((x,i)=>result.chosen.get(keyOf(x,i))?.value).filter(Boolean);
 const out={...context,
  castProfiles:keep(actors,a=>`cast:${a.id}`),
  sceneHistory:keep(history,h=>`history:${h.source}`),
  generatedFacts:keep(context.generatedFacts||[],f=>`fact:${f.id}`).map(({score,...f})=>f),
  facts:keep(context.facts||[],f=>`authored:${f.id}`),
  memories:keep(context.memories||[],(m,i)=>`memory:${m.source}:${i}`),
  // Stable authored order, not score order, so the prompt prefix stays cacheable between turns.
  lorebook:keep([...(context.lorebook||[])].sort((a,b)=>a.id.localeCompare(b.id)),e=>`lore:${e.id}`).map(({score,...e})=>e),
  pastScenes:keep(recaps,g=>g.key),
  npcRelationships:keep(context.npcRelationships||[],r=>`npc:${r.characters.join('|')}`)};
 const report={v:1,window,reply,ratio,budget,base,poolBudget,used:base+result.used,overBudget:overBudget||base+result.used>budget,
  included:result.included.map(x=>[x.key,x.level,x.cost]),cut:result.cut.map(x=>[x.key,x.reason])};
 return {context:out,report};
}
