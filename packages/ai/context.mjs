import {matchedLoreKeys, keyPattern, absentNote} from '../../vendor/venus/lorebook.mjs';
import {calendarFor} from '../../public/calendar.mjs';
import {selectGeneratedFacts} from '../modules/facts.mjs';
import {loreIndex,bm25Score} from './retrieval.mjs';
import {conditionReasons} from '../modules/conditions.mjs';
import {estimateTokens} from './budget.mjs';
import {statValue} from '../modules/stats.mjs';
import {datingContext} from '../modules/dating.mjs';
import {playerStatements,stripPlaceholders,mentionsPlayer} from './memory.mjs';
import {romanceNetworkContext} from '../modules/romance-network.mjs';
import {intimacyContext} from '../modules/intimacy.mjs';
import {gossipContext} from '../modules/gossip.mjs';
import {npcMemoriesFor} from '../modules/npc-social.mjs';
import {romanceTempoContext} from '../modules/romance-tempo.mjs';
import {jealousyContext} from '../modules/jealousy.mjs';
import {phoneContext} from '../modules/phone.mjs';
import {endingsContext} from '../modules/endings.mjs';
import {feedContext} from '../modules/feed.mjs';
import {directorContext} from '../modules/director.mjs';
import {touchLadderContext} from '../modules/touch-ladder.mjs';
import {anniversaryBrief} from '../modules/anniversary.mjs';
import {heldBy} from '../modules/inventory.mjs';
// Authored act memories (social.acts entry.memory) ride on the recorded social.actPriced event, so they read like scene ledger rows.
const actMemories=t=>(t.events||[]).filter(e=>e.type==='social.actPriced'&&typeof e.payload.memory==='string'&&e.payload.memory).map(e=>({charKey:e.payload.character,type:['liked','disliked'].includes(e.payload.verdict)?e.payload.verdict:'neutral',desc:e.payload.memory}));
function visibleTo(v,actor){return v==='public'||Array.isArray(v)&&v.includes(actor);}
// Tick of each timed entry's latest fresh keyed activation, read from committed turn traces newest-first and only as far
// back as the longest sticky+cooldown window, so timers are a pure function of saved state and replay identically.
function lastActivations(s,ids,floor){const last={};if(!ids.size)return last;const turns=Object.values(s.turns);for(let i=turns.length-1;i>=0;i--){const t=turns[i],a=t.loreActivations,tick=a?.tick??t.events?.[0]?.tick??0;if(tick<floor)break;for(const id of a?.ids||[])if(ids.has(id)&&last[id]===undefined)last[id]=a.tick;}return last;}
// Lore is gated by world state first (`when`, `delay`); tags/text only choose among entries the state supports.
// `sticky` keeps a keyed entry for N ticks after it fires; `cooldown` then blocks keyed re-activation for N ticks
// (SillyTavern World Info timers, counted in game ticks instead of chat messages).
// `keys` are topic triggers: comma-separated phrases that match recent input or current location.
export function selectLore(s,p,actorId,query='',budget=1200){
 const location=s.actors[actorId].location,results=[],omitted=[],index=query?loreIndex(p):null,now=s.tick,book=p.lorebook||[];
 const timed=book.filter(e=>e.sticky||e.cooldown),last=lastActivations(s,new Set(timed.map(e=>e.id)),now-Math.max(0,...timed.map(e=>(e.sticky||0)+(e.cooldown||0))));
 const placeText=p.locations.find(l=>l.id===location)?.name||'';
 const matchText=`${query} ${placeText}`.toLowerCase();
 for(const entry of book){if(!visibleTo(entry.knownBy,actorId))continue;
  if(entry.delay&&now<entry.delay){omitted.push({id:entry.id,reason:`delay: until tick ${entry.delay}`});continue;}
  const blocked=entry.when?conditionReasons(entry.when,s,p):[];if(blocked.length){omitted.push({id:entry.id,reason:`when: ${blocked[0]}`});continue;}
  const tagMatched=matchedLoreKeys(entry.tags||[],query);
  const keyMatched=(entry.keys||[]).filter(k=>matchText.includes(k.toLowerCase()));
  const matched=[...tagMatched,...keyMatched];
  const scopeMatch=entry.scope==='world'||entry.scope==='location'&&entry.location===location||entry.scope==='character'&&entry.character===actorId;
  const text=index?bm25Score(index,entry.id,query):{score:0,matched:[]},textMatch=text.score>=1;
  const since=last[entry.id]===undefined?Infinity:now-last[entry.id],stuck=since<(entry.sticky||0),cooling=!stuck&&since<(entry.sticky||0)+(entry.cooldown||0),fresh=(matched.length||textMatch)&&!stuck&&!cooling;
  if(!scopeMatch&&!fresh&&!stuck){if(cooling&&(matched.length||textMatch))omitted.push({id:entry.id,reason:`cooldown: until tick ${last[entry.id]+(entry.sticky||0)+entry.cooldown}`});continue;}
  const score=(fresh?matched.length*10+Math.min(9,Math.round(text.score*2)):stuck?10:0)+(entry.location===location?5:0)+(entry.character===actorId?5:0);
  const reason=fresh&&matched.length?`key: ${matched.join(', ')}`:fresh?`text: ${text.matched.slice(0,3).join(', ')}`:stuck?`sticky: ${entry.sticky-since} tick(s) left`:entry.scope==='location'?'current location':entry.scope==='character'?'character':'world';
  results.push({...entry,score,fresh,reason,matched,keyMatched:keyMatched.length>0});
 }
 results.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 let used=0;const selected=[],activated=[];
 const MAX_ENTRIES=4,MAX_TOKENS=50;
 for(const e of results){
  if(selected.length>=MAX_ENTRIES)break;
  const tokens=estimateTokens(e.text);
  const text=tokens<=MAX_TOKENS?e.text:e.text.slice(0,MAX_TOKENS*4)+'…';
  if(used+estimateTokens(text)<=budget){
   selected.push({id:e.id,text,reason:e.reason,score:e.score,keyMatched:e.keyMatched});
   if(e.fresh)activated.push(e.id);
   used+=estimateTokens(text);
  }else omitted.push({id:e.id,reason:'budget'});
 }
 selected.sort((a,b)=>(b.keyMatched?1:0)-(a.keyMatched?1:0)||b.score-a.score);
 return {selected,omitted,budget,used,activated,tick:now};
}
// opts.wide gathers every candidate so a caller-side allocator (context-budget.mjs) can decide what fits.
export function contextFor(s,p,actorId=p.playerId,turn=null,query='',opts={}){
 const location=s.actors[actorId].location,canSee=v=>visibleTo(v,actorId),own=p.actors.find(a=>a.id===actorId);
 const player=p.actors.find(a=>a.id===p.playerId);
 const playerDesc=player?.description||'',playerTokens=estimateTokens(playerDesc);
 const playerBlock=player?{name:player.name,pronouns:player.pronouns,description:playerTokens<=60?playerDesc:playerDesc.slice(0,240)+'…'}:null;
 // Everything the player told this character: promises and self-disclosures are kept long-term, questions dropped.
 const selected=playerStatements(s,p,actorId,opts.wide?{keep:40,statements:4}:{keep:8,statements:8});
 // Impressions that never mention the player ("Brin likes sharing details about his habits") are the model talking about
 // the character itself; they cost tokens and teach the next reply nothing about the relationship.
 const playerName=p.actors.find(a=>a.id===p.playerId)?.name,aboutPlayer=d=>mentionsPlayer(d,playerName);
 // Walk newest-first and stop early: this runs every turn and must not scan the whole campaign.
 const ledger=[],turnList=Object.values(s.turns);for(let i=turnList.length-1;i>=0&&ledger.length<8;i--){const t=turnList[i];if(t.status!=='complete')continue;const own=[...(t.ledger||[]).filter(m=>aboutPlayer(m.desc)),...actMemories(t)].filter(m=>m.charKey===actorId||actorId===p.playerId).map(m=>{const name=p.actors.find(a=>a.id===m.charKey)?.name||m.charKey;return {source:`ledger:${t.id}`,text:`${name} ${m.type}: ${stripPlaceholders(m.desc,'the player',name)}`,knownBy:[p.playerId,m.charKey],tick:t.events[0]?.tick||0};});ledger.unshift(...own);}ledger.splice(0,Math.max(0,ledger.length-8));
 const lore=selectLore(s,p,actorId,query,opts.wide?Infinity:1200);
 const generatedFactTrace=selectGeneratedFacts(s,p,actorId,query,opts.wide?Infinity:650);
 const items=(p.items||[]).filter(i=>heldBy(s,i.id,location)>0&&(!i.hidden||s.modules['world.objects']?.discovered.includes(i.id))).map(i=>({id:i.id,name:i.name}));
 const carried=(p.items||[]).filter(i=>heldBy(s,i.id,p.playerId)>0).map(i=>({id:i.id,name:i.name,...(query.toLowerCase().includes(i.name.toLowerCase())?{description:i.description||''}:{})}));
 const equipped=p.equipmentSlots&&s.modules['items.equipment']?Object.entries(s.modules['items.equipment'].slots).filter(([,id])=>id).map(([slot,id])=>{const item=p.items.find(i=>i.id===id);return {slot,id,name:item?.name||id,description:item?.description||''};}):[];
 const nearbyBonds=p.relationshipDimensions&&s.modules['social.bonds']?p.actors.filter(a=>a.id!==p.playerId&&s.actors[a.id].location===location||a.id===actorId&&a.id!==p.playerId).map(a=>({character:a.id,values:Object.fromEntries(p.relationshipDimensions.map(d=>[d.id,s.modules['social.bonds'].values[`${a.id}--${d.id}--${p.playerId}`]||0]))})):[];
 const characterStats=s.modules['character.stats']?p.actors.filter(a=>a.id===actorId||a.id===p.playerId||s.actors[a.id].location===location).map(a=>({character:a.id,values:Object.fromEntries((p.statDefinitions||[]).filter(d=>d.visibility==='public'||a.id===actorId||actorId===p.playerId&&d.visibility==='player').map(d=>[d.id,statValue(s,a.id,d.id)]))})).filter(a=>Object.keys(a.values).length):[];
 const relationshipProgression=s.modules['social.progression']?Object.entries(s.modules['social.progression'].states).filter(([character])=>actorId===p.playerId||character===actorId).map(([character,state])=>({character,state})):[];
 const dating=s.modules['social.dating']?datingContext(s,p,actorId):[];
  // One short block, only when there is something to remember: today's N-month mark with up to two shared moments,
  // or a single moment whose place or topic fits an ordinary day. Story data for the narrator; it grants nothing.
  const anniversary=s.modules['social.anniversary']?anniversaryBrief(s,p,actorId,query):null;
 const romanceNetwork=s.modules['social.romance-network']?romanceNetworkContext(s,p,actorId):null;
 const intimacy=s.modules['social.intimacy']?intimacyContext(s,p,actorId):[];
 const touchLadder=s.modules['social.touch-ladder']?touchLadderContext(s,p,actorId):[];
 const rumors=s.modules['social.gossip']?gossipContext(s,actorId):[];
 const romanceTempo=s.modules['social.romance-tempo']?romanceTempoContext(s,p,actorId):[];
  const jealousy=s.modules['social.jealousy']?jealousyContext(s,p,actorId):[];
 const phone=s.modules['social.phone']?phoneContext(s,p,actorId):null;
 const unlockedEndings=s.modules['story.endings']?endingsContext(s,p):[];
 const socialFeed=s.modules['social.feed']?feedContext(s,p,actorId):[];
 const objects=(p.objects||[]).filter(o=>o.location===location).map(({id,name,description,tags})=>({id,name,description,tags}));
 // Score events are UI feedback ("Ada: Trust 45 → 50", "Balance: $30."), not conversation: the model reads trust
 // and money from their context panels, so the raw score lines never reach it as recent actions.
 const scoreEvent=new Set(['social.relationshipChanged','social.bondChanged','social.chemistryChanged','social.satisfactionChanged','world.moneyChanged','character.statChanged']);
 const recentActions=s.events.filter(e=>e.type!=='core.patch'&&!scoreEvent.has(e.type)&&canSee(e.visibility)&&e.payload.text).slice(-10).map(e=>({source:e.id,tick:e.tick,type:e.type,text:e.payload.text}));
 const clock=calendarFor(s.tick,p),{day,weekday,week}=clock,part=clock.daypart;
 // One line, only when the open scene has crossed a daypart boundary: the model can wrap the talk up naturally instead of a hard cut.
 const timeNote=s.scene&&Number.isInteger(s.scene.startedTick)&&calendarFor(s.scene.startedTick,p).daypart!==part?`It is now ${part}; the conversation has run long.`:null;
 const activeEvents=p.modules['world.events']?(p.worldEvents||[]).filter(e=>day>=e.startDay&&day<=e.endDay).map(({id,name,description,location:where})=>({id,name,description,location:where||null})):[];
 const sceneId=s.modules['story.scenes']?.pending,scriptedScene=(p.scriptedScenes||[]).find(x=>x.id===sceneId),sceneBeat=scriptedScene?.beats?.find(b=>b.id===s.modules['story.scenes']?.pendingBeat)||scriptedScene;
 const backgroundCharacters=p.actors.filter(a=>a.id!==actorId&&s.actors[a.id].location!==location&&new RegExp(keyPattern(a.name,false),'iu').test(query)).map(a=>({id:a.id,name:a.name,pronouns:a.pronouns,description:a.description||'',traits:a.traits||[],voice:a.voice||'',rule:absentNote(a.name)}));
 const npcRelationships=Object.entries(s.modules['social.npc']?.pairs||{}).filter(([key])=>key.split('|').every(id=>s.actors[id]?.location===location)).map(([key,value])=>({characters:key.split('|'),...value}));
 const npcFriendshipMemories=actorId!==p.playerId?npcMemoriesFor(s,actorId):[];
 return {money:s.modules['world.economy']?.balance??null,npcRelationships,...(npcFriendshipMemories.length?{npcFriendshipMemories}:{}),promptVersion:'0.8',gameProject:p.gameProject||null,scriptedScene:scriptedScene?{id:sceneId,beat:s.modules['story.scenes']?.pendingBeat||'opening',title:scriptedScene.title,opening:sceneBeat.opening,stage:sceneBeat.stage||[],choices:sceneBeat.choices.map(c=>({id:c.id,label:c.label}))}:null,sceneWaiting:s.modules['story.scenes']?.waiting||null,sceneHistory:s.modules['story.scenes']?.history.slice(-5)||[],plans:(s.modules['story.scenes']?.plans||[]).filter(x=>x.status==='pending').sort((a,b)=>a.deadlineTick-b.deadlineTick),characterStats,relationshipProgression,actor:{id:actorId,name:own.name,pronouns:own.pronouns,style:own.style||'Natural and concise',goal:own.goal||'',traits:own.traits||[],backstory:own.backstory||'',likes:own.likes||[],dislikes:own.dislikes||[],voice:own.voice||'',year:own.year||null,major:own.major||null,dorm:own.dorm||null,appearance:own.appearance||'',relationshipToPlayer:s.modules['social.relationships']?.edges[`${actorId}--${p.playerId}`]??null},player:playerBlock,location:p.locations.find(l=>l.id===location),present:p.actors.filter(a=>s.actors[a.id].location===location).map(a=>({id:a.id,name:a.name,pronouns:a.pronouns,description:a.description||'',traits:a.traits||[],voice:a.voice||''})),backgroundCharacters,objects,items,carried,equipped,nearbyBonds,tick:s.tick,calendar:p.calendar,date:clock.date,day,week,weekday,daypart:part,activeEvents,...(timeNote?{timeNote}:{}),
  dating,romanceTempo,romanceNetwork,jealousy,phone,socialFeed,unlockedEndings,intimacy,touchLadder,rumors,director:directorContext(s,p),...(anniversary||{}),facts:(p.facts||[]).filter(f=>canSee(f.knownBy)&&!(p.facts||[]).some(n=>n.supersedes===f.id&&canSee(n.knownBy))).map(f=>({id:f.id,text:f.text})),generatedFacts:generatedFactTrace.selected.map(({id,subject,text,source,reason})=>({id,subject,text,source,reason})),generatedFactTrace,lorebook:lore.selected,loreTrace:lore,
  memories:[...selected.map(m=>({source:m.source,text:m.text,promise:m.promise,kind:m.kind})),...ledger.map(m=>({source:m.source,text:m.text})),...(s.modules['story.scenes']?.memories||[]).filter(m=>canSee(m.knownBy)).slice(-8).map(m=>({source:`scene:${m.scene}`,text:m.text,character:m.character}))],dialogue:Object.values(s.turns).filter(t=>t.status==='complete'&&t.events.some(e=>e.type==='social.spoke'&&canSee(e.visibility))).slice(-6).map(t=>({source:t.id,text:t.narrative})),recentActions,outcomes:(turn?.events||[]).filter(e=>canSee(e.visibility)).map(e=>({type:e.type,...e.payload}))};
}
