import {assert, safeKey, scheduleDestination, nextArrivalTick, releaseScene} from '../core/engine.mjs';
const definition=(id,extra)=>({id,version:'0.1.0',coreApi:'0.1.0',requires:[],...extra});
export const conversation=definition('social.conversation',{
  init:()=>({memories:[]}),
  react(tx,e){if(e.type!=='social.spoke'||e.payload.source!=='scene')return;const participants=[tx.pack.playerId,e.payload.target];tx.set(['modules','social.conversation','memories'],[...tx.state.modules['social.conversation'].memories,{id:e.id,source:e.id,tick:tx.state.tick,knownBy:participants,text:e.payload.text,promise:e.payload.promise,topic:e.payload.utterance.toLowerCase()}]);},
  commands:{'social.speak'(tx,a){const {state:s,pack:p}=tx;const target=s.actors[a.target];assert(target&&a.target!==p.playerId,'Select another character');assert(target.location===s.actors[p.playerId].location,'That character is not here');assert(typeof a.text==='string'&&a.text.trim().length>0&&a.text.length<=2000,'Dialogue must be 1–2000 characters');
    if(!s.scene||s.scene.location!==target.location||!s.scene.characters.includes(a.target)){
      if(s.scene)releaseScene(tx);
      assert(target.location===s.actors[p.playerId].location,'That character is no longer here');
      tx.set(['scene'],{id:tx.commandId,location:target.location,characters:[a.target],activity:'talk',startedTick:tx.world.tick});
    }
    const visibility=[p.playerId,a.target], promise=/\bpromise\b/i.test(a.text);const text=`You tell ${target.name}: “${a.text.trim()}”`;
    const e=tx.emit('social.spoke',{actor:p.playerId,target:a.target,location:target.location,utterance:a.text.trim(),promise,text},visibility);
    tx.set(['modules','social.conversation','memories'],[...s.modules['social.conversation'].memories,{id:e.id,source:e.id,tick:s.tick,knownBy:visibility,text,promise,topic:a.text.trim().toLowerCase()}]);
  }},
  actions(s,p){return Object.keys(s.actors).filter(id=>id!==p.playerId&&s.actors[id].location===s.actors[p.playerId].location).map(id=>({label:`Talk to ${s.actors[id].name}`,type:'social.speak',args:{target:id,text:'How are things going?'}}));},
  panel(s){return {title:'Shared memories',lines:s.modules['social.conversation'].memories.slice(-5).map(m=>m.text)};}
});
export const relationships=definition('social.relationships',{
  requires:['social.conversation'],
  init:()=>({edges:{},rewarded:{}}),
  react(tx,e){if(e.type!=='social.spoke')return;const {state:s,pack:p}=tx;const m=s.modules['social.relationships'];const edge=`${e.payload.target}--${p.playerId}`;const key=`${edge}--${e.payload.promise?'promise':'greeting'}`;if(m.rewarded[key])return;
    tx.set(['modules','social.relationships','rewarded',key],true);const n=Math.min(100,(m.edges[edge]||0)+(e.payload.promise?2:1));tx.set(['modules','social.relationships','edges',edge],n);tx.emit('social.relationshipChanged',{actor:e.payload.target,toward:p.playerId,value:n,text:`${s.actors[e.payload.target].name} seems a little more receptive.`},[p.playerId,e.payload.target]);
  },
  panel(s){return {title:'Relationships',lines:Object.entries(s.modules['social.relationships'].edges).map(([id,n])=>`${s.actors[id.split('--')[0]].name}: ${n} trust`)};}
});
export const schedule=definition('world.schedule',{
  validate(p){for(const [i,r] of (p.schedules||[]).entries()){assert(p.actors.some(a=>a.id===r.actor)&&r.actor!==p.playerId,`schedules[${i}].actor: unknown NPC`);assert(Array.isArray(r.stops||[])&&Array.isArray(r.weekly||[])&&(r.stops?.length||r.weekly?.length),'schedule: at least one stop required');if(r.stops?.length)assert(Number.isInteger(r.period)&&r.period>0&&r.period<=10000,`schedules[${i}].period: invalid`);for(const st of r.stops||[]){assert(Number.isInteger(st.at)&&st.at>=0&&st.at<r.period,'schedule.stop.at: invalid');assert(p.locations.some(l=>l.id===st.location),'schedule.stop.location: unknown');}const seen=new Set();for(const st of r.weekly||[]){const key=`${st.weekday}/${st.daypart}`;assert(!seen.has(key),'schedule.weekly: duplicate day and part');seen.add(key);assert(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].includes(st.weekday)&&['Morning','Afternoon','Evening'].includes(st.daypart),'schedule.weekly: invalid weekday or daypart');assert(p.locations.some(l=>l.id===st.location),'schedule.weekly: unknown location');}}},
  react(tx,e){if(e.type!=='core.timeAdvanced')return;for(let tick=e.payload.from+1;tick<=e.payload.to;tick++)for(const r of tx.pack.schedules||[]){const location=scheduleDestination(tx.pack,r,tick);if(!location||e.payload.sceneCast?.includes(r.actor)||tx.state.actors[r.actor].location===location)continue;tx.set(['actors',r.actor,'location'],location);tx.emit('world.actorArrived',{actor:r.actor,location},[r.actor]);}},
  actions(s,p){const here=s.actors[p.playerId].location;const out=[];for(const r of p.schedules||[]){if(s.actors[r.actor].location===here)continue;if(nextArrivalTick(p,r.actor,here,s.tick)===null)continue;const name=s.actors[r.actor].name;out.push({label:`Wait until ${name} arrives`,type:'core.waitUntil',args:{actor:r.actor}});}return out;},
  panel(s,p){return {title:'Schedule',lines:(p.schedules||[]).map(r=>`${s.actors[r.actor].name}: ${[...(r.stops||[]).map(st=>`${p.locations.find(l=>l.id===st.location).name} at tick ${st.at} / ${r.period}`),...(r.weekly||[]).map(st=>`${st.weekday} ${st.daypart}: ${p.locations.find(l=>l.id===st.location).name}`)].join(' · ')}`)};}
});
export const quests=definition('story.quests',{
  validate(p){for(const q of p.quests||[]){assert(Array.isArray(q.any)&&q.any.length>0,`quests.${q.id}.any: required`);if(q.unlock)assert(safeKey(q.unlock),'quest.unlock invalid');for(const c of q.any)assert(typeof c.event==='string'&&c.match&&typeof c.match==='object','quest condition invalid');}},
  init:p=>({completed:[],rewardCount:0}),
  react(tx,e){for(const q of tx.pack.quests||[]){const s=tx.state.modules['story.quests'];if(s.completed.includes(q.id))continue;if(q.any.some(c=>c.event===e.type&&Object.entries(c.match).every(([k,v])=>e.payload[k]===v))){tx.set(['modules','story.quests','completed'],[...s.completed,q.id]);tx.set(['modules','story.quests','rewardCount'],s.rewardCount+1);if(q.unlock)tx.set(['flags',q.unlock],true);tx.emit('story.questCompleted',{quest:q.id,text:`Objective completed: ${q.name}. ${q.rewardText||''}`},[tx.pack.playerId]);}}},
  panel(s,p){return {title:'Objectives',lines:(p.quests||[]).map(q=>`${s.modules['story.quests'].completed.includes(q.id)?'✓':'○'} ${q.name} — ${q.hint}`)};}
});
