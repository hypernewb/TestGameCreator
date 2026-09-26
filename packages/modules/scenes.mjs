import {assert,safeKey} from '../core/engine.mjs';
import {parseAction} from '../../vendor/venus/sceneActions.mjs';
import {calendarFor,WEEKDAYS,PERIODS} from '../../public/calendar.mjs';
import {bondKey,changeBond} from './bonds.mjs';
import {changeMoney} from './economy.mjs';

// Authored mechanics live in game packs. The model can describe a scene, but cannot fire it
// or choose its effects. Inspired by Venus University's slot/scene/settlement separation;
// this implementation is original and contains no Venus University source code.
const path=['modules','story.scenes'];
const validText=(value,label)=>assert(typeof value==='string'&&value.length<=4000,`${label}: expected text (up to 4000 characters)`);
const beatOf=(scene,id)=>id?(scene.beats||[]).find(b=>b.id===id):scene;
const choiceOf=(p,id,beat,choice)=>beatOf(p.scriptedScenes.find(s=>s.id===id),beat)?.choices.find(c=>c.id===choice);
function validateExtraConditions(when,p,label){
 const actorIds=new Set(p.actors.filter(a=>a.id!==p.playerId).map(a=>a.id)),items=new Map((p.items||[]).map(i=>[i.id,i])),dimensions=new Set((p.relationshipDimensions||[]).map(d=>d.id));
 assert(Array.isArray(when.equipped||[])&&Array.isArray(when.bonds||[]),`${label}: equipment and bond requirements must be arrays`);
 for(const id of when.equipped||[])assert(p.modules['items.equipment']&&items.get(id)?.slot,`${label}.equipped: invalid equipment`);
 for(const r of when.bonds||[])assert(p.modules['social.bonds']&&actorIds.has(r.character)&&dimensions.has(r.dimension)&&Number.isInteger(r.min)&&r.min>=0&&r.min<=100,`${label}.bonds: invalid requirement`);
}

export function conditionReasons(when,state,pack,pages=[]){
  when||={};const reasons=[],location=state.actors[pack.playerId].location;
  const clock=calendarFor(state.tick,pack);
  if(when.location&&when.location!==location)reasons.push(`Player location: ${location}; needs ${when.location}`);
  for(const page of pages)if(page.speaker&&state.actors[page.speaker]?.location!==location)reasons.push(`${page.speaker} is at ${state.actors[page.speaker]?.location}; needs to be here to speak`);
  if(when.weekdays?.length&&!when.weekdays.includes(clock.weekday))reasons.push(`Weekday: ${clock.weekday}; needs ${when.weekdays.join(' or ')}`);
  if(when.dayparts?.length&&!when.dayparts.includes(clock.daypart))reasons.push(`Daypart: ${clock.daypart}; needs ${when.dayparts.join(' or ')}`);
  for(const [id,place] of Object.entries(when.charactersAt||{}))if(state.actors[id]?.location!==place)reasons.push(`${id} is at ${state.actors[id]?.location}; needs ${place}`);
  if(when.minTick!==undefined&&state.tick<when.minTick)reasons.push(`Tick ${state.tick}; starts at ${when.minTick}`);
  if(when.maxTick!==undefined&&state.tick>when.maxTick)reasons.push(`Tick ${state.tick}; ended at ${when.maxTick}`);
  for(const [id,value] of Object.entries(when.flags||{}))if(Boolean(state.flags[id])!==value)reasons.push(`Flag ${id}: ${Boolean(state.flags[id])}; needs ${value}`);
  for(const id of when.items||[])if(state.modules['items.inventory']?.owners[id]!==pack.playerId)reasons.push(`Item ${id} is not carried`);
  for(const id of when.equipped||[])if(!Object.values(state.modules['items.equipment']?.slots||{}).includes(id))reasons.push(`Item ${id} is not equipped`);
  for(const requirement of when.bonds||[]){const actual=state.modules['social.bonds']?.values[bondKey(requirement.character,requirement.dimension,pack.playerId)]||0;if(actual<requirement.min)reasons.push(`${requirement.character} ${requirement.dimension}: ${actual}; needs ${requirement.min}`);}
  for(const [id,min] of Object.entries(when.trust||{})){const actual=state.modules['social.relationships']?.edges[`${id}--${pack.playerId}`]||0;if(actual<min)reasons.push(`Trust with ${id}: ${actual}; needs ${min}`);}
  return reasons;
}
export function diagnoseScenes(state,pack){const status=state.modules['story.scenes'];if(!status)return [];const recent=Object.values(state.turns).at(-1)?.events.filter(e=>e.type!=='core.patch')||[];return (pack.scriptedScenes||[]).map(scene=>{const reasons=conditionReasons(scene.when,state,pack,scene.pages),event=recent.findLast(e=>e.type===scene.trigger.event),matched=event&&Object.entries(scene.trigger.match||{}).every(([k,v])=>event.payload[k]===v);let stateLabel='waiting';if(status.completed.includes(scene.id))stateLabel='completed';else if(status.pending===scene.id)stateLabel='active';else if(status.waiting?.scene===scene.id)stateLabel='paused';else if(matched&&!reasons.length)stateLabel='ready';if(stateLabel==='waiting'||stateLabel==='ready'){if(!event)reasons.unshift(`Waiting for event ${scene.trigger.event}`);else if(!matched)reasons.unshift(`Latest ${scene.trigger.event} did not match ${JSON.stringify(scene.trigger.match||{})}`);else reasons.unshift(`Last ${scene.trigger.event} matched; waiting for a new event`);}if(stateLabel==='paused'){reasons.length=0;reasons.push(`Waiting for ${status.waiting.event}${Object.keys(status.waiting.match||{}).length?` ${JSON.stringify(status.waiting.match)}`:''}`);if(state.tick<status.waiting.afterTick)reasons.push(`Resumes at tick ${status.waiting.afterTick}`);reasons.push(...conditionReasons(null,state,pack,beatOf(scene,status.waiting.beat)?.pages||[]));}if(stateLabel==='completed'||stateLabel==='active')reasons.length=0;const active=stateLabel==='active'?beatOf(scene,status.pendingBeat):null,choices=active?.choices.map(c=>({id:c.id,label:c.label,reasons:conditionReasons(c.when,state,pack)}))||[];return {id:scene.id,title:scene.title,status:stateLabel,beat:status.pending===scene.id?status.pendingBeat||'opening':status.waiting?.scene===scene.id?status.waiting.beat:null,reasons,choices};});}

function effects(tx,effects){const {state,pack}=tx;
  for(const effect of effects||[]){
    if(effect.type==='flag')tx.set(['flags',effect.id],effect.value);
    if(effect.type==='trust'){
      const edge=`${effect.character}--${pack.playerId}`;
      const current=state.modules['social.relationships'].edges[edge]||0;
      tx.set(['modules','social.relationships','edges',edge],Math.max(0,Math.min(100,current+effect.delta)));
      tx.emit('social.relationshipChanged',{actor:effect.character,toward:pack.playerId,value:state.modules['social.relationships'].edges[edge]},[pack.playerId,effect.character]);
    }
    if(effect.type==='item'){
      const from=state.modules['items.inventory'].owners[effect.id];
      tx.set(['modules','items.inventory','owners',effect.id],effect.to);
      tx.emit('items.transferred',{item:effect.id,from,to:effect.to},[pack.playerId]);
    }
    if(effect.type==='memory'){
      const memory={character:effect.character,text:effect.text,tick:state.tick,scene:state.modules['story.scenes'].pending,knownBy:[pack.playerId,effect.character]};
      tx.set([...path,'memories'],[...state.modules['story.scenes'].memories,memory]);
      tx.emit('story.memoryRecorded',{character:effect.character,text:effect.text},memory.knownBy);
    }
    if(effect.type==='bond')changeBond(tx,effect.character,effect.dimension,effect.delta);
    if(effect.type==='money')changeMoney(tx,effect.delta);
  }
}

export const scenes={id:'story.scenes',version:'0.1.0',coreApi:'0.1.0',requires:[],
  validate(p){
    assert(Array.isArray(p.scriptedScenes||[]),'scriptedScenes: expected array');
    const seen=new Set(),actors=new Set(p.actors.map(a=>a.id)),locations=new Set(p.locations.map(l=>l.id)),items=new Set((p.items||[]).map(i=>i.id));
    for(const scene of p.scriptedScenes||[]){
      assert(safeKey(scene.id)&&!seen.has(scene.id),`scripted scene ID invalid or duplicate: ${scene.id}`);seen.add(scene.id);
      validText(scene.title,`${scene.id}.title`);validText(scene.opening,`${scene.id}.opening`);
      if(scene.background)assert(p.locations.some(l=>l.background===scene.background),`${scene.id}.background: choose a location background`);
      assert(Array.isArray(scene.pages||[])&&(scene.pages||[]).length<=30,`${scene.id}.pages: expected up to 30 pages`);
      for(const page of scene.pages||[]){validText(page.text,`${scene.id}.page.text`);assert(page.text.trim(),`${scene.id}.page.text: required`);assert(!page.speaker||actors.has(page.speaker)&&page.speaker!==p.playerId,`${scene.id}.page.speaker: unknown`);if(page.background)assert(p.locations.some(l=>l.background===page.background),`${scene.id}.page.background: choose a location background`);for(const raw of page.stage||[]){const action=parseAction(raw,(id,ref)=>Boolean(p.actors.find(a=>a.id===id)?.poses?.some(pose=>pose.id===ref)));assert(action&&actors.has(action.charKey)&&action.charKey!==p.playerId,`${scene.id}.page.stage: invalid action`);}}
      assert(Array.isArray(scene.stage||[]),`${scene.id}.stage: expected array`);
      for(const raw of scene.stage||[]){assert(typeof raw==='string'&&raw.length<=120,`${scene.id}.stage: invalid instruction`);const action=parseAction(raw,(charKey,ref)=>Boolean(p.actors.find(a=>a.id===charKey)?.poses?.some(pose=>pose.id===ref)));
        assert(action&&actors.has(action.charKey)&&action.charKey!==p.playerId,`${scene.id}.stage: unknown character, pose or action`);
      }
      assert(scene.trigger&&typeof scene.trigger.event==='string'&&scene.trigger.event.length>0&&scene.trigger.event.length<100,`${scene.id}.trigger.event: required`);
      assert(scene.trigger.match===undefined||scene.trigger.match&&typeof scene.trigger.match==='object'&&!Array.isArray(scene.trigger.match),`${scene.id}.trigger.match: invalid`);
      for(const [key,value] of Object.entries(scene.trigger.match||{}))assert(safeKey(key)&&['string','number','boolean'].includes(typeof value),`${scene.id}.trigger.match: invalid field`);
      const when=scene.when||{};
      if(when.location)assert(locations.has(when.location),`${scene.id}.when.location: unknown`);
      if(when.weekdays)assert(Array.isArray(when.weekdays)&&when.weekdays.every(day=>WEEKDAYS.includes(day)),`${scene.id}.when.weekdays: invalid`);
      if(when.dayparts)assert(Array.isArray(when.dayparts)&&when.dayparts.every(part=>PERIODS.includes(part)),`${scene.id}.when.dayparts: invalid`);
      for(const [id,place] of Object.entries(when.charactersAt||{}))assert(actors.has(id)&&id!==p.playerId&&locations.has(place),`${scene.id}.when.charactersAt: invalid`);
      for(const k of ['minTick','maxTick'])if(when[k]!==undefined)assert(Number.isInteger(when[k])&&when[k]>=0,`${scene.id}.when.${k}: invalid`);
      if(when.maxTick!==undefined&&when.minTick!==undefined)assert(when.maxTick>=when.minTick,`${scene.id}.when: invalid time range`);
      for(const [id,value] of Object.entries(when.flags||{}))assert(safeKey(id)&&typeof value==='boolean',`${scene.id}.when.flags: invalid`);
      for(const id of when.items||[])assert(items.has(id)&&p.modules['items.inventory'],`${scene.id}.when.items: inventory item required`);
      for(const [id,value] of Object.entries(when.trust||{}))assert(actors.has(id)&&id!==p.playerId&&p.modules['social.relationships']&&Number.isInteger(value)&&value>=0&&value<=100,`${scene.id}.when.trust: invalid`);
      validateExtraConditions(when,p,`${scene.id}.when`);
      const beats=scene.beats||[],beatIds=new Set();assert(Array.isArray(beats)&&beats.length<=20,`${scene.id}.beats: expected up to 20 beats`);
      for(const beat of beats){assert(safeKey(beat.id)&&!beatIds.has(beat.id),`${scene.id}.beats: invalid or duplicate ID`);beatIds.add(beat.id);validText(beat.opening,`${scene.id}.${beat.id}.opening`);assert(beat.opening.trim(),`${scene.id}.${beat.id}.opening: required`);if(beat.background)assert(p.locations.some(l=>l.background===beat.background),`${scene.id}.${beat.id}.background: unknown`);assert(Array.isArray(beat.pages||[])&&(beat.pages||[]).length<=30,`${scene.id}.${beat.id}.pages: invalid`);for(const page of beat.pages||[]){validText(page.text,`${scene.id}.${beat.id}.page`);assert(page.text.trim()&&(!page.speaker||actors.has(page.speaker)&&page.speaker!==p.playerId),`${scene.id}.${beat.id}.page: invalid speaker or text`);if(page.background)assert(p.locations.some(l=>l.background===page.background),`${scene.id}.${beat.id}.page.background: unknown`);for(const raw of page.stage||[]){const action=parseAction(raw,(id,ref)=>Boolean(p.actors.find(a=>a.id===id)?.poses?.some(pose=>pose.id===ref)));assert(action&&actors.has(action.charKey)&&action.charKey!==p.playerId,`${scene.id}.${beat.id}.page.stage: invalid`);}}for(const raw of beat.stage||[]){const action=parseAction(raw,(id,ref)=>Boolean(p.actors.find(a=>a.id===id)?.poses?.some(pose=>pose.id===ref)));assert(action&&actors.has(action.charKey)&&action.charKey!==p.playerId,`${scene.id}.${beat.id}.stage: invalid`);}}
      for(const segment of [scene,...beats]){const label=`${scene.id}.${segment.id}`;assert(Array.isArray(segment.choices)&&segment.choices.length>0&&segment.choices.length<=12,`${label}.choices: 1–12 required`);assert(segment.choices.some(c=>!c.when||!Object.keys(c.when).length),`${label}.choices: add an unconditional choice so the scene cannot get stuck`);const choices=new Set();for(const choice of segment.choices){assert(safeKey(choice.id)&&!choices.has(choice.id),`${label}.choices: invalid or duplicate ID`);choices.add(choice.id);validText(choice.label,`${label}.${choice.id}.label`);assert(choice.label.trim(),`${label}.${choice.id}.label: required`);validText(choice.result||'',`${label}.${choice.id}.result`);
        if(choice.next)assert(beatIds.has(choice.next),`${label}.${choice.id}.next: unknown beat`);if(choice.waitFor){assert(choice.next,`${label}.${choice.id}.waitFor: next beat required`);assert(typeof choice.waitFor.event==='string'&&choice.waitFor.event.length>0&&choice.waitFor.event.length<100&&!['core.patch','story.choiceResolved','story.sceneStarted','story.sceneResumed'].includes(choice.waitFor.event),`${label}.${choice.id}.waitFor.event: invalid`);assert(choice.waitFor.delay===undefined||Number.isInteger(choice.waitFor.delay)&&choice.waitFor.delay>=0&&choice.waitFor.delay<=1000,`${label}.${choice.id}.waitFor.delay: invalid`);assert(choice.waitFor.match===undefined||choice.waitFor.match&&typeof choice.waitFor.match==='object'&&!Array.isArray(choice.waitFor.match),`${label}.${choice.id}.waitFor.match: invalid`);for(const [key,value] of Object.entries(choice.waitFor.match||{}))assert(safeKey(key)&&['string','number','boolean'].includes(typeof value),`${label}.${choice.id}.waitFor.match: invalid`);}
        if(choice.when){assert(typeof choice.when==='object'&&!Array.isArray(choice.when),`${label}.${choice.id}.when: invalid`);const w=choice.when;if(w.location)assert(locations.has(w.location),`${label}.${choice.id}.when.location: unknown`);if(w.weekdays)assert(Array.isArray(w.weekdays)&&w.weekdays.every(day=>WEEKDAYS.includes(day)),`${label}.${choice.id}.when.weekdays: invalid`);if(w.dayparts)assert(Array.isArray(w.dayparts)&&w.dayparts.every(part=>PERIODS.includes(part)),`${label}.${choice.id}.when.dayparts: invalid`);for(const [id,place] of Object.entries(w.charactersAt||{}))assert(actors.has(id)&&id!==p.playerId&&locations.has(place),`${label}.${choice.id}.when.charactersAt: invalid`);for(const k of ['minTick','maxTick'])if(w[k]!==undefined)assert(Number.isInteger(w[k])&&w[k]>=0,`${label}.${choice.id}.when.${k}: invalid`);if(w.minTick!==undefined&&w.maxTick!==undefined)assert(w.maxTick>=w.minTick,`${label}.${choice.id}.when: invalid time range`);for(const [id,value] of Object.entries(w.flags||{}))assert(safeKey(id)&&typeof value==='boolean',`${label}.${choice.id}.when.flags: invalid`);for(const id of w.items||[])assert(items.has(id)&&p.modules['items.inventory'],`${label}.${choice.id}.when.items: invalid`);for(const [id,value] of Object.entries(w.trust||{}))assert(actors.has(id)&&id!==p.playerId&&p.modules['social.relationships']&&Number.isInteger(value)&&value>=0&&value<=100,`${label}.${choice.id}.when.trust: invalid`);validateExtraConditions(w,p,`${label}.${choice.id}.when`);}
        for(const effect of choice.effects||[]){assert(['flag','trust','item','memory','bond','money'].includes(effect.type),`${label}: unknown effect`);if(effect.type==='flag')assert(safeKey(effect.id)&&typeof effect.value==='boolean',`${label}: flag effect invalid`);if(effect.type==='trust')assert(actors.has(effect.character)&&effect.character!==p.playerId&&p.modules['social.relationships']&&Number.isInteger(effect.delta)&&Math.abs(effect.delta)<=100,`${label}: trust effect invalid`);if(effect.type==='item')assert(items.has(effect.id)&&p.modules['items.inventory']&&[...actors,...locations].includes(effect.to),`${label}: item effect invalid`);if(effect.type==='bond')assert(p.modules['social.bonds']&&actors.has(effect.character)&&effect.character!==p.playerId&&(p.relationshipDimensions||[]).some(d=>d.id===effect.dimension)&&Number.isInteger(effect.delta)&&Math.abs(effect.delta)<=100,`${label}: bond effect invalid`);if(effect.type==='money')assert(p.modules['world.economy']&&Number.isInteger(effect.delta)&&Math.abs(effect.delta)<=100000,`${label}: money effect invalid`);if(effect.type==='memory')assert(actors.has(effect.character)&&effect.character!==p.playerId&&typeof effect.text==='string'&&effect.text.trim().length>0&&effect.text.length<=500,`${label}: memory effect invalid`);}
      }}
    }
  },
  init:()=>({pending:null,completed:[],history:[],memories:[]}),
  commands:{'story.choose'(tx,args){const current=tx.state.modules['story.scenes'],scene=tx.pack.scriptedScenes.find(x=>x.id===current.pending);assert(scene,'No scripted scene is waiting');assert(args.scene===scene.id,'Wrong scripted scene');const beat=current.pendingBeat||null,choice=choiceOf(tx.pack,args.scene,beat,args.choice);assert(choice,'Unknown scene choice');assert(!conditionReasons(choice.when,tx.state,tx.pack).length,'Choice conditions are not met');effects(tx,choice.effects);tx.set([...path,'pending'],null);tx.set([...path,'history'],[...current.history,{scene:scene.id,beat:beat||'opening',choice:choice.id,tick:tx.state.tick}]);tx.emit('story.choiceResolved',{scene:scene.id,beat:beat||'opening',choice:choice.id,text:choice.result||choice.label});if(choice.next){if(choice.waitFor){tx.set([...path,'waiting'],{scene:scene.id,beat:choice.next,event:choice.waitFor.event,match:choice.waitFor.match||{},afterTick:tx.state.tick+(choice.waitFor.delay||0),origin:tx.commandId});tx.emit('story.scenePaused',{scene:scene.id,beat:choice.next,text:`${scene.title} will continue after ${choice.waitFor.event}.`});}else{tx.set([...path,'pendingBeat'],choice.next);tx.set([...path,'pending'],scene.id);const next=beatOf(scene,choice.next);tx.emit('story.sceneResumed',{scene:scene.id,beat:choice.next,text:next.opening});}}else{if(current.pendingBeat!==undefined)tx.set([...path,'pendingBeat'],null);tx.set([...path,'completed'],[...current.completed,scene.id]);}}},
  react(tx,event){const current=tx.state.modules['story.scenes'];if(current.pending||event.type==='core.patch')return;if(current.waiting){const waiting=current.waiting,scene=tx.pack.scriptedScenes.find(x=>x.id===waiting.scene),beat=beatOf(scene,waiting.beat);if(waiting.origin!==tx.commandId&&event.type===waiting.event&&tx.state.tick>=waiting.afterTick&&Object.entries(waiting.match).every(([k,v])=>event.payload[k]===v)&&!conditionReasons(null,tx.state,tx.pack,beat.pages).length){tx.set([...path,'waiting'],null);tx.set([...path,'pendingBeat'],beat.id);tx.set([...path,'pending'],scene.id);tx.emit('story.sceneResumed',{scene:scene.id,beat:beat.id,text:beat.opening});}return;}for(const scene of tx.pack.scriptedScenes||[]){if(current.completed.includes(scene.id)||scene.trigger.event!==event.type)continue;if(Object.entries(scene.trigger.match||{}).some(([k,v])=>event.payload[k]!==v))continue;if(conditionReasons(scene.when,tx.state,tx.pack,scene.pages).length)continue;tx.set([...path,'pending'],scene.id);tx.emit('story.sceneStarted',{scene:scene.id,title:scene.title,text:scene.opening});break;}},
  actions(s,p){const id=s.modules['story.scenes'].pending;if(!id)return [];const scene=p.scriptedScenes.find(x=>x.id===id),beat=beatOf(scene,s.modules['story.scenes'].pendingBeat);return beat.choices.map(c=>({label:c.label,type:'story.choose',args:{scene:id,choice:c.id},...(!conditionReasons(c.when,s,p).length?{}:{disabledReason:conditionReasons(c.when,s,p).join('; ')})}));},
  panel(s,p){const status=s.modules['story.scenes'],active=p.scriptedScenes.find(x=>x.id===status.pending),beat=active&&beatOf(active,status.pendingBeat);return {title:'Scripted scene',lines:active?[`${active.title} · ${status.pendingBeat||'opening'}: ${beat.opening}`,...beat.choices.map(c=>`Choice: ${c.label}${c.when&&conditionReasons(c.when,s,p).length?' (locked)':''}`)]:status.waiting?[`Paused: ${status.waiting.scene} → ${status.waiting.beat}; waiting for ${status.waiting.event}`]:status.history.length?[`Last: ${status.history.at(-1).scene} → ${status.history.at(-1).choice}`]:['No scene is active.']};}
};
