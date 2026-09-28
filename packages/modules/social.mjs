import {calendarFor} from '../../public/calendar.mjs';
import {assert, safeKey, scheduleDestination, nextArrivalTick, releaseScene, routeBetween, scheduledLocation, travel} from '../core/engine.mjs';
import {spokenLine} from '../../vendor/venus/sceneText.mjs';
// Content words of a line, shared by repeat detection and the trust gate: five-plus letters, lowercased.
export const speechWords=line=>new Set(String(line||'').toLocaleLowerCase().match(/\p{L}{5,}/gu)||[]);
// A question is "the same" as one the target already heard when most content words overlap (Venus voices the
// deflection; the engine only decides the fact).
export function isRepeat(utterance,priorTopics){
 const said=speechWords(utterance);if(said.size<3)return false;
 return (priorTopics||[]).some(topic=>{const was=speechWords(topic);if(was.size<3)return false;let shared=0;for(const word of said)if(was.has(word))shared++;return shared/(said.size+was.size-shared)>=0.6;});
}
// Whether an NPC in the room agrees to go somewhere with the player. Pure: the same world always gives the same answer.
// Private places (a location with `private` or an `owner`) need more trust unless it is the NPC's own place or they are dating.
export function inviteDecision(s,p,id,to){
 const npc=s.actors[id],player=s.actors[p.playerId],place=p.locations.find(l=>l.id===to),interval=p.daypart?.interval||4;
 assert(npc&&id!==p.playerId,'Select another character');assert(place,'Unknown location');assert(to!==player.location,`You are already at ${place.name}`);
 const no=(reason,text)=>({ok:false,reason,to,text:`${npc.name} ${text}`});
 if(npc.location!==player.location)return no('absent',"isn't here to ask.");
 const route=routeBetween(p,player.location,to,s.flags);if(!route)return no('unreachable',`can't get to ${place.name} from here.`);
 const arrive=s.tick+route.length-1,end=Math.max(arrive,(Math.floor(s.tick/interval)+1)*interval-1);
 if(p.modules['world.schedule']&&(p.schedules||[]).some(r=>r.actor===id))for(const t of [arrive,end]){const at=scheduledLocation(s,p,id,t);if(at!==npc.location&&at!==to)return no('busy',`has to be at ${p.locations.find(l=>l.id===at)?.name||at} soon.`);}
 const phase=s.modules['social.dating']?.characters[id]?.phase;if(['rejected','broken'].includes(phase))return no('relationship','turns you down flatly.');
 const priv=place.private??Boolean(place.owner),guest=priv&&place.owner!==id,need=['dating','exclusive'].includes(phase)?0:guest?p.invitations?.privateTrust??40:p.invitations?.publicTrust??0,edges=s.modules['social.relationships']?.edges;
 if(edges&&(edges[`${id}--${p.playerId}`]??0)<need)return no('trust',guest?"isn't comfortable going somewhere that private with you yet.":'would rather not go anywhere with you right now.');
 const intimacy=s.modules['social.intimacy']?.characters[id];
 if(guest&&intimacy&&(intimacy.cooldownUntil>s.tick||Object.values(intimacy.consent||{}).some(c=>['declined','withdrawn'].includes(c.status)&&s.tick-c.atTick<interval*2)))return no('boundary','wants to keep some distance for now.');
 return {ok:true,reason:'accepted',to,route,text:`${npc.name} agrees and goes with you to ${place.name}.`};
}
// Typed invitations ("Mina, come to my room", "invite Ada to the workshop", "come with me to the park" mid-scene) become
// social.invite; anything that doesn't name a present character and a known place stays ordinary speech.
export function parseInvite(s,p,text){
 const t=String(text).trim().replace(/\s+/g,' '),here=s.actors[p.playerId].location,present=Object.keys(s.actors).filter(id=>id!==p.playerId&&s.actors[id].location===here);if(!present.length)return null;
 const names=present.map(id=>s.actors[id].name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),ask='(?:(?:do you |would you |will you |can you |could you )?(?:want to |wanna |like to )?)?';
 let who,place;const m=t.match(new RegExp(`^(?:hey |ok |okay )?(${names})[,!]? ${ask}(?:come|follow me|walk with me|join me)(?: over| along| back| with me)* to (.+)$`,'i'))||t.match(new RegExp(`^(?:i )?invite (${names})(?: over| along| back)* to (.+)$`,'i'));
 if(m)[,who,place]=m;
 else{const n=t.match(new RegExp(`^${ask}(?:come|walk|go) (?:over |along |back )?with me to (.+)$|^let'?s (?:go|head) to (.+)$`,'i')),cast=(s.scene?.location===here?s.scene.characters:[]).filter(id=>present.includes(id));if(n&&cast.length===1){who=s.actors[cast[0]].name;place=n[1]||n[2];}}
 if(!who)return null;const character=present.find(id=>s.actors[id].name.toLowerCase()===who.toLowerCase());
 place=place.toLowerCase().replace(/[.!?]+$/,'').replace(/,? ?please$/,'').replace(/^the /,'').trim();
 const own=place.match(/^(my|your|her|his|their) (?:room|place|home|house|apartment|flat|bedroom|dorm(?: room)?)\b/);
 const loc=own?p.locations.find(l=>l.owner===(own[1]==='my'?p.playerId:character)):p.locations.find(l=>[l.name.toLowerCase().replace(/^the /,''),l.id.replaceAll('-',' ')].some(n=>place===n||place.startsWith(n+' ')));
 return loc&&loc.id!==here?{character,to:loc.id}:null;
}
const definition=(id,extra)=>({id,version:'0.1.0',coreApi:'0.1.0',requires:[],...extra});
const LATER=/\bwhat are you up to later\b|\bwhere will you be\b|\bwhat are your plans\b/;
// The next place this character's schedule takes them away from where they are now, with a daypart for the player.
export function laterStop(s,p,id){if(!p.modules['world.schedule'])return null;const schedule=(p.schedules||[]).find(r=>r.actor===id);if(!schedule)return null;const now=calendarFor(s.tick,p),from=s.actors[id].location;
 for(let tick=s.tick+1;tick<=s.tick+(p.daypart?.interval||4)*3*7;tick++){const to=scheduleDestination(p,schedule,tick);if(to&&to!==from){const c=calendarFor(tick,p),name=p.locations.find(l=>l.id===to)?.name||to;return {location:to,tick,name,when:c.day===now.day?(c.daypart===now.daypart?'soon':`this ${c.daypart.toLowerCase()}`):c.day===now.day+1?`tomorrow ${c.daypart.toLowerCase()}`:`on ${c.weekday}`};}}return null;}
export const conversation=definition('social.conversation',{
  init:()=>({memories:[]}),
  react(tx,e){if(e.type!=='social.spoke'||e.payload.source!=='scene')return;const participants=[tx.pack.playerId,e.payload.target];tx.set(['modules','social.conversation','memories'],[...tx.state.modules['social.conversation'].memories,{id:e.id,source:e.id,tick:tx.state.tick,knownBy:participants,text:e.payload.text,promise:e.payload.promise,topic:e.payload.utterance.toLowerCase()}]);},
  commands:{'social.speak'(tx,a){const {state:s,pack:p}=tx;const target=s.actors[a.target];assert(target&&a.target!==p.playerId,'Select another character');assert(target.location===s.actors[p.playerId].location,'That character is not here');assert(typeof a.text==='string'&&a.text.trim().length>0&&a.text.length<=2000,'Dialogue must be 1–2000 characters');
    // In a continuous scene, turning to someone else in the room brings them into it rather than starting over.
    if(p.gameProject?.conversationStyle==='continuous'&&s.scene&&s.scene.location===target.location&&!s.scene.characters.includes(a.target))tx.set(['scene','characters'],[...s.scene.characters,a.target]);
    else if(!s.scene||s.scene.location!==target.location||!s.scene.characters.includes(a.target)){
      if(s.scene)releaseScene(tx);
      assert(target.location===s.actors[p.playerId].location,'That character is no longer here');
      tx.set(['scene'],{id:tx.commandId,location:target.location,characters:[a.target],activity:'talk',startedTick:tx.world.tick});
    }
    const utterance=spokenLine(a.text),visibility=[p.playerId,a.target],promise=/\bpromise\b/i.test(a.text);
    const heard=(s.modules['social.conversation'].memories||[]).filter(m=>m.knownBy.includes(a.target)).map(m=>m.topic),repeat=isRepeat(utterance,heard);
    const text=`You tell ${target.name}: “${utterance}”`;
    const e=tx.emit('social.spoke',{actor:p.playerId,target:a.target,location:target.location,utterance,promise,repeat,text},visibility);
    tx.set(['modules','social.conversation','memories'],[...s.modules['social.conversation'].memories,{id:e.id,source:e.id,tick:s.tick,knownBy:visibility,text,promise,topic:utterance.toLocaleLowerCase()}]);
    // Asking about something the author wrote down about them is how the player learns it: a fact, not flavour.
    const said=utterance.toLocaleLowerCase(),known=s.modules['social.conversation'].learned?.[a.target]||[],actor=p.actors.find(x=>x.id===a.target);
    const learn=[...[].concat(actor?.likes||[]).map(x=>({topic:String(x),kind:'like'})),...[].concat(actor?.dislikes||[]).map(x=>({topic:String(x),kind:'dislike'}))].find(x=>!known.includes(x.topic)&&said.includes(x.topic.toLocaleLowerCase()));
    if(learn){tx.set(['modules','social.conversation','learned'],{...s.modules['social.conversation'].learned,[a.target]:[...known,learn.topic]});tx.emit('social.topicLearned',{character:a.target,...learn,text:`You learn ${target.name} ${learn.kind==='like'?'loves':"can't stand"} ${learn.topic}.`},visibility);}
    // "What are you up to later?" once a day: they tell you where their day takes them next, so there is somewhere to be.
    const day=calendarFor(s.tick,p).day;
    if(LATER.test(said)&&s.modules['social.conversation'].hinted?.[a.target]!==day){const next=laterStop(s,p,a.target);if(next){tx.set(['modules','social.conversation','hinted'],{...s.modules['social.conversation'].hinted,[a.target]:day});tx.emit('social.hintGiven',{character:a.target,...next,text:`${target.name} will be at ${next.name} ${next.when}.`},visibility);}}
  },
  // Invitations are committed here, not by dialogue: an accepted one moves both characters and opens a scene at the destination.
  'social.invite'(tx,a){const {state:s,pack:p}=tx;assert(safeKey(a.character)&&safeKey(a.to),'Invalid invitation');const d=inviteDecision(s,p,a.character,a.to),npc=s.actors[a.character],seen=[p.playerId,a.character];
    if(!d.ok){tx.emit('social.inviteDeclined',{character:a.character,to:a.to,reason:d.reason,text:d.text},seen);return;}
    const from=npc.location,home=s.scene?.returns?.[a.character]??from;if(s.scene)releaseScene(tx);
    travel(tx,p,s.actors[p.playerId].location,a.to,p.playerId);tx.set(['actors',a.character,'location'],a.to);tx.emit('world.actorArrived',{actor:a.character,location:a.to},seen);
    tx.emit('social.inviteAccepted',{character:a.character,from,to:a.to,text:d.text},seen);
    tx.set(['scene'],{id:tx.commandId,location:a.to,characters:[a.character],activity:'meet',startedTick:tx.world.tick,returns:{[a.character]:home}});
    tx.emit('core.sceneStarted',{activity:'meet',location:a.to,characters:[a.character],text:d.text},seen);
  }},
  actions(s,p){const me=s.actors[p.playerId].location,here=Object.keys(s.actors).filter(id=>id!==p.playerId&&s.actors[id].location===me),homes=p.locations.filter(l=>l.owner===p.playerId&&l.id!==me);
    // Once a conversation is open, the canned "How are things going?" button becomes a suggested topic drawn from
    // what the author wrote about them, minus what has already been said: re-asking the same generic question is
    // how a route stalls on "Things are fine."
    const inConversation=s.scene&&s.scene.location===me?s.scene.characters:[],topic=id=>{const actor=p.actors.find(a=>a.id===id);if(!actor)return null;const said=new Set((s.modules['social.conversation'].memories||[]).filter(m=>m.knownBy.includes(id)).flatMap(m=>String(m.topic||'').match(/\p{L}{5,}/gu)||[])),fresh=sentence=>{const words=sentence.toLowerCase().match(/\p{L}{5,}/gu)||[];return words.length&&words.filter(w=>!said.has(w)).length/words.length>=0.5;};
      return [...[].concat(actor.likes||[]).map(x=>({label:`what ${x} means to them`,text:`What is it you love about ${x}?`,key:String(x)})),...[].concat(actor.dislikes||[]).map(x=>({label:`why they can't stand ${x}`,text:`Why can't you stand ${x}?`,key:String(x)})),...String(actor.backstory||'').split(/(?<=[.!?])\s+/u).filter(fresh).map(()=>({label:'something from their past',text:'How did that come about?',key:''}))].find(seed=>String(seed.key).toLowerCase().match(/\p{L}{5,}/gu)?.every(w=>!said.has(w))??true)||null;};
    const speak=id=>{if(!inConversation.includes(id))return {label:`Talk to ${s.actors[id].name}`,type:'social.speak',args:{target:id,text:'How are things going?'}};const seed=topic(id);if(seed)return {label:`Ask ${s.actors[id].name} about ${seed.label}`,type:'social.speak',args:{target:id,text:seed.text}};
      // Out of authored topics: one "later" question a day, then no canned button (typing still works).
      return s.modules['social.conversation'].hinted?.[id]!==calendarFor(s.tick,p).day&&laterStop(s,p,id)?{label:`Ask ${s.actors[id].name} what they're up to later`,type:'social.speak',args:{target:id,text:'What are you up to later?'}}:null;};
    return [...here.map(speak).filter(Boolean),...here.flatMap(id=>homes.filter(l=>inviteDecision(s,p,id,l.id).ok).map(l=>({label:`Invite ${s.actors[id].name} back to ${l.name}`,type:'social.invite',args:{character:id,to:l.id}})))];},
  panel(s){return {title:'Shared memories',lines:s.modules['social.conversation'].memories.slice(-5).map(m=>m.text)};}
});
export const relationships=definition('social.relationships',{
  requires:['social.conversation'],
  validate(p){const actors=new Set(p.actors.filter(a=>a.id!==p.playerId).map(a=>a.id)),dimensions=new Set((p.relationshipDimensions||[]).map(d=>d.id)),seen=new Set();for(const [i,r] of (p.dialogueReactions||[]).entries()){assert(safeKey(r.id)&&!seen.has(r.id),`dialogueReactions[${i}].id: invalid or duplicate`);seen.add(r.id);assert(!r.character||actors.has(r.character),`dialogueReactions[${i}].character: unknown NPC`);assert(Array.isArray(r.phrases)&&r.phrases.length&&r.phrases.length<=30&&r.phrases.every(x=>typeof x==='string'&&x.trim()&&x.length<=100),`dialogueReactions[${i}].phrases: expected 1–30 short phrases`);assert(Number.isInteger(r.trustDelta||0)&&Math.abs(r.trustDelta||0)<=10,`dialogueReactions[${i}].trustDelta: expected -10–10`);assert(Number.isInteger(r.cooldownTicks??3)&&(r.cooldownTicks??3)>=0&&(r.cooldownTicks??3)<=100,`dialogueReactions[${i}].cooldownTicks: expected 0–100`);for(const [dimension,delta] of Object.entries(r.bonds||{}))assert(p.modules['social.bonds']&&dimensions.has(dimension)&&Number.isInteger(delta)&&Math.abs(delta)<=10,`dialogueReactions[${i}].bonds: invalid dimension or delta`);}},
  init:()=>({edges:{},rewarded:{},reactions:{}}),
  react(tx,e){const {state:s,pack:p}=tx,m=s.modules['social.relationships'];if(e.type==='social.spoke'){
    // Generic or already-heard talk earns nothing: the per-day trust bump is paid only for substantive, new content
    // (three-plus content words, mostly never said to this person before). Promises always count.
    const priorTopics=(s.modules['social.conversation'].memories||[]).filter(x=>x.knownBy.includes(e.payload.target)&&x.id!==e.id).map(x=>x.topic),fresh=!e.payload.repeat&&!isRepeat(e.payload.utterance,priorTopics);
    if(e.payload.promise||fresh){const edge=`${e.payload.target}--${p.playerId}`,key=e.payload.promise?`${edge}--promise`:`${edge}--talk--d${calendarFor(s.tick,p).day}`;if(!m.rewarded[key]){tx.set(['modules','social.relationships','rewarded',key],true);const old=m.edges[edge]||0,n=Math.min(100,old+(e.payload.promise?2:1));tx.set(['modules','social.relationships','edges',edge],n);tx.emit('social.relationshipChanged',{actor:e.payload.target,toward:p.playerId,old,value:n,delta:n-old,text:`${s.actors[e.payload.target].name}: Trust ${old} → ${n}`},[p.playerId,e.payload.target]);}}}
    if(!['social.spoke','core.sceneContinued'].includes(e.type))return;const utterance=String(e.payload.utterance||e.payload.text||'').toLocaleLowerCase(),targets=e.type==='social.spoke'?[e.payload.target]:e.payload.characters||[];for(const actor of targets)for(const rule of p.dialogueReactions||[]){if(rule.character&&rule.character!==actor||!rule.phrases.some(phrase=>utterance.includes(phrase.toLocaleLowerCase())))continue;const key=`${actor}--${rule.id}`,prior=m.reactions?.[key],cooldown=rule.cooldownTicks??3,count=prior&&s.tick-prior.tick<=cooldown?prior.count+1:1,scale=count===1?1:count===2?0.5:0;tx.set(['modules','social.relationships','reactions',key],{tick:s.tick,count});if(!scale)continue;const edge=`${actor}--${p.playerId}`,old=m.edges[edge]||0,delta=Math.trunc((rule.trustDelta||0)*scale),value=Math.max(0,Math.min(100,old+delta));if(value!==old){tx.set(['modules','social.relationships','edges',edge],value);tx.emit('social.relationshipChanged',{actor,toward:p.playerId,old,value,delta:value-old,reaction:rule.id,text:`${s.actors[actor].name}: Trust ${old} → ${value}${count>1?' (repeated; reduced effect)':''}`},[p.playerId,actor]);}for(const [dimension,raw] of Object.entries(rule.bonds||{})){const bond=`${actor}--${dimension}--${p.playerId}`,before=s.modules['social.bonds'].values[bond]||0,change=Math.trunc(raw*scale),after=Math.max(0,Math.min(100,before+change));if(after===before)continue;tx.set(['modules','social.bonds','values',bond],after);tx.emit('social.bondChanged',{actor,dimension,old:before,value:after,delta:after-before,reaction:rule.id,text:`${s.actors[actor].name}: ${p.relationshipDimensions.find(d=>d.id===dimension)?.name||dimension} ${before} → ${after}${count>1?' (repeated; reduced effect)':''}`},[p.playerId,actor]);}}
  },
  panel(s){return {title:'Relationships',lines:Object.entries(s.modules['social.relationships'].edges).map(([id,n])=>`${s.actors[id.split('--')[0]].name}: ${n} trust`)};}
});
export const schedule=definition('world.schedule',{
  validate(p){const exceptionIds=new Set();for(const x of p.scheduleExceptions||[]){assert(safeKey(x.id)&&!exceptionIds.has(x.id),'schedule exception ID invalid or duplicate');exceptionIds.add(x.id);assert(p.actors.some(a=>a.id===x.actor&&a.id!==p.playerId)&&p.locations.some(l=>l.id===x.location),'schedule exception actor or location invalid');assert(Number.isInteger(x.startTick)&&Number.isInteger(x.endTick)&&x.startTick>=0&&x.endTick>=x.startTick,'schedule exception window invalid');}for(const [i,r] of (p.schedules||[]).entries()){assert(p.actors.some(a=>a.id===r.actor)&&r.actor!==p.playerId,`schedules[${i}].actor: unknown NPC`);assert(Array.isArray(r.stops||[])&&Array.isArray(r.weekly||[])&&(r.stops?.length||r.weekly?.length),'schedule: at least one stop required');if(r.stops?.length)assert(Number.isInteger(r.period)&&r.period>0&&r.period<=10000,`schedules[${i}].period: invalid`);for(const st of r.stops||[]){assert(Number.isInteger(st.at)&&st.at>=0&&st.at<r.period,'schedule.stop.at: invalid');assert(p.locations.some(l=>l.id===st.location),'schedule.stop.location: unknown');}const seen=new Set();for(const st of r.weekly||[]){const key=`${st.weekday}/${st.daypart}`;assert(!seen.has(key),'schedule.weekly: duplicate day and part');seen.add(key);assert(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].includes(st.weekday)&&['Morning','Afternoon','Evening'].includes(st.daypart),'schedule.weekly: invalid weekday or daypart');assert(p.locations.some(l=>l.id===st.location),'schedule.weekly: unknown location');assert(st.skipHolidays===undefined||typeof st.skipHolidays==='boolean','schedule.weekly.skipHolidays: expected boolean');}}},
  react(tx,e){if(e.type!=='core.timeAdvanced')return;for(let tick=e.payload.from+1;tick<=e.payload.to;tick++)for(const r of tx.pack.schedules||[]){const location=scheduleDestination(tx.pack,r,tick);if(!location||e.payload.sceneCast?.includes(r.actor)||tx.state.actors[r.actor].location===location)continue;tx.set(['actors',r.actor,'location'],location);tx.emit('world.actorArrived',{actor:r.actor,location},[r.actor]);}
   // A stop missed while held in a scene catches up once released, unless the NPC was taken off-routine (e.g. invited home).
   for(const r of tx.pack.schedules||[]){if(!r.stops?.length||e.payload.sceneCast?.includes(r.actor)||!r.stops.some(st=>st.location===tx.state.actors[r.actor].location))continue;let location=null;for(let t=e.payload.to;t>e.payload.to-r.period&&t>=0&&!location;t--)location=scheduleDestination(tx.pack,r,t);if(!location||tx.state.actors[r.actor].location===location)continue;tx.set(['actors',r.actor,'location'],location);tx.emit('world.actorArrived',{actor:r.actor,location},[r.actor]);}},
  actions(s,p){const here=s.actors[p.playerId].location;const out=[];for(const r of p.schedules||[]){if(s.actors[r.actor].location===here)continue;if(nextArrivalTick(p,r.actor,here,s.tick)===null)continue;const name=s.actors[r.actor].name;out.push({label:`Wait until ${name} arrives`,type:'core.waitUntil',args:{actor:r.actor}});}return out;},
  panel(s,p){return {title:'Schedule',lines:(p.schedules||[]).map(r=>`${s.actors[r.actor].name}: ${[...(r.stops||[]).map(st=>`${p.locations.find(l=>l.id===st.location).name} at tick ${st.at} / ${r.period}`),...(r.weekly||[]).map(st=>`${st.weekday} ${st.daypart}: ${p.locations.find(l=>l.id===st.location).name}`)].join(' · ')}`)};}
});
export const quests=definition('story.quests',{
  validate(p){for(const q of p.quests||[]){assert(Array.isArray(q.any)&&q.any.length>0,`quests.${q.id}.any: required`);if(q.unlock)assert(safeKey(q.unlock),'quest.unlock invalid');for(const c of q.any)assert(typeof c.event==='string'&&c.match&&typeof c.match==='object','quest condition invalid');}},
  init:p=>({completed:[],rewardCount:0}),
  react(tx,e){for(const q of tx.pack.quests||[]){const s=tx.state.modules['story.quests'];if(s.completed.includes(q.id))continue;if(q.any.some(c=>c.event===e.type&&Object.entries(c.match).every(([k,v])=>e.payload[k]===v))){tx.set(['modules','story.quests','completed'],[...s.completed,q.id]);tx.set(['modules','story.quests','rewardCount'],s.rewardCount+1);if(q.unlock)tx.set(['flags',q.unlock],true);tx.emit('story.questCompleted',{quest:q.id,text:`Objective completed: ${q.name}. ${q.rewardText||''}`},[tx.pack.playerId]);}}},
  panel(s,p){return {title:'Objectives',lines:(p.quests||[]).map(q=>`${s.modules['story.quests'].completed.includes(q.id)?'✓':'○'} ${q.name} — ${q.hint}`)};}
});
