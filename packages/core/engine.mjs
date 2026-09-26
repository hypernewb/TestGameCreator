import {calendarFor} from '../../public/calendar.mjs';
import {changeMoney} from '../modules/economy.mjs';
export const CORE_API = '0.1.0';
export const clone = x => structuredClone(x);
export function assert(ok, message) { if (!ok) throw new Error(message); }
export function safeKey(s) { return typeof s === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(s) && !['__proto__','constructor','prototype'].includes(s); }
export function routeBetween(pack,from,to,flags={}) { const queue=[[from]],seen=new Set([from]);while(queue.length){const path=queue.shift(),at=path.at(-1);if(at===to)return path;for(const e of pack.locations.find(l=>l.id===at)?.exits||[])if(!seen.has(e.to)&&(!e.flag||flags[e.flag])){seen.add(e.to);queue.push([...path,e.to]);}}return null; }
export function scheduleDestination(pack,schedule,tick) {for(const stop of schedule.stops||[])if(tick%schedule.period===stop.at)return stop.location;const interval=pack.daypart?.interval||4;if(tick%interval===0){const clock=calendarFor(tick,pack);for(const stop of schedule.weekly||[])if(stop.weekday===clock.weekday&&stop.daypart===clock.daypart)return stop.location;}return null;}
export function scheduledLocation(world,pack,id,arrivalTick) {if(!pack.modules['world.schedule'])return world.actors[id].location;let at=world.actors[id].location;for(let tick=world.tick+1;tick<=arrivalTick;tick++)for(const schedule of pack.schedules||[])if(schedule.actor===id)at=scheduleDestination(pack,schedule,tick)||at;return at;}
// A cast member remains present for the scene. Apply the latest missed scheduled stop at its boundary.
export function settleSceneAttendance(world,pack){
 const scene=world.scene;
 if(!scene||!pack.modules['world.schedule']||!Number.isInteger(scene.startedTick))return;
 for(const id of scene.characters){
  for(let tick=scene.startedTick+1;tick<=world.tick;tick++)for(const schedule of pack.schedules||[]){
   if(schedule.actor!==id)continue;
   const location=scheduleDestination(pack,schedule,tick);
   if(location)world.actors[id].location=location;
  }
 }
}
export function releaseScene(tx){
 const before=Object.fromEntries((tx.state.scene?.characters||[]).map(id=>[id,tx.state.actors[id].location]));
 settleSceneAttendance(tx.state,tx.pack);
 for(const [id,location] of Object.entries(before))if(tx.state.actors[id].location!==location){
  const to=tx.state.actors[id].location;
  tx.set(['actors',id,'location'],to);
  tx.emit('world.actorArrived',{actor:id,location:to},[id]);
 }
 tx.set(['scene'],null);
}
export function travel(tx,pack,from,to,player){const route=routeBetween(pack,from,to,tx.state.flags);if(!route){tx.emit('core.travelBlocked',{from,to,text:`You cannot reach ${pack.locations.find(l=>l.id===to).name} from here.`},[player]);return null;}for(let i=1;i<route.length;i++){tx.set(['actors',player,'location'],route[i]);tx.emit('core.moved',{actor:player,from:route[i-1],to:route[i],text:`You go to ${pack.locations.find(l=>l.id===route[i]).name}.`},[player]);}return route;}
export function meetingArrival(tx,world,pack,id,to,arrival){const location=scheduledLocation(world,pack,id,arrival);if(location!==to){tx.emit('world.meetingUnavailable',{character:id,location:to,text:`${tx.state.actors[id].name} is not at ${pack.locations.find(l=>l.id===to).name} when you arrive.`},[pack.playerId]);return false;}if(tx.state.actors[id].location!==to){tx.set(['actors',id,'location'],to);tx.emit('world.actorArrived',{actor:id,location:to,text:`${tx.state.actors[id].name} arrives at ${pack.locations.find(l=>l.id===to).name}.`},[pack.playerId,id]);}return true;}
export function digest(x) { let h=2166136261; for(const c of JSON.stringify(x)) h=Math.imul(h^c.charCodeAt(0),16777619); return (h>>>0).toString(16); }
export function resolveModules(pack, registry) {
  const ordered=[], visiting=new Set(), done=new Set();
  const visit=id=>{ assert(!visiting.has(id),`Module dependency cycle: ${id}`); if(done.has(id))return;
    const mod=registry[id]; assert(mod,`Unknown module: ${id}`); assert(pack.modules[id]===mod.version,`Module version mismatch: ${id}`); assert(mod.coreApi===CORE_API,`Core API mismatch: ${id}`);
    visiting.add(id); for(const dep of mod.requires||[]){assert(pack.modules[dep],`${id} requires ${dep}`);visit(dep);} visiting.delete(id);done.add(id);ordered.push(mod);
  }; Object.keys(pack.modules).sort().forEach(visit); return ordered;
}
export function validatePack(pack, registry) {
  assert(pack && pack.schemaVersion===1,'pack.schemaVersion: expected 1');
  assert(safeKey(pack.id),'pack.id: invalid ID'); assert(typeof pack.title==='string','pack.title: required');
  assert(/^\d+\.\d+\.\d+$/.test(pack.version),'pack.version: expected x.y.z');
  assert(pack.modules && typeof pack.modules==='object' && !Array.isArray(pack.modules),'pack.modules: required');
  assert(Array.isArray(pack.locations)&&pack.locations.length>0,'pack.locations: non-empty array required');
  assert(Array.isArray(pack.actors)&&pack.actors.length>0,'pack.actors: non-empty array required');
  const seen=new Set();
  for(const [kind,entries] of [['locations',pack.locations],['actors',pack.actors],['items',pack.items||[]],['quests',pack.quests||[]],['abilities',pack.abilities||[]],['objects',pack.objects||[]]]) {
    assert(Array.isArray(entries),`${kind}: expected array`); entries.forEach((e,i)=>{assert(safeKey(e.id),`${kind}[${i}].id: invalid`);assert(!seen.has(e.id),`${kind}[${i}].id: duplicate ${e.id}`); seen.add(e.id);assert(typeof e.name==='string',`${kind}[${i}].name: required`);});
  }
  const loc=new Set(pack.locations.map(x=>x.id)), actors=new Set(pack.actors.map(x=>x.id));
  assert(actors.has(pack.playerId),'playerId: missing actor');
  const safeAsset=x=>/^assets\/[a-zA-Z0-9/_-]+\.(svg|png|jpg|webp)$/.test(x)||/^scenario-media\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(x);
  for(const a of pack.actors){assert(loc.has(a.location),`actors.${a.id}.location: unknown`);if(a.portrait)assert(safeAsset(a.portrait),`actors.${a.id}.portrait: unsafe asset path`);if(a.poses){assert(Array.isArray(a.poses),'actor.poses: expected array');const seenPoses=new Set();for(const pose of a.poses){assert(safeKey(pose.id)&&!seenPoses.has(pose.id),'actor.pose.id: invalid or duplicate');seenPoses.add(pose.id);assert(safeAsset(pose.image),'actor.pose.image: unsafe asset path');}}}
  for(const l of pack.locations){ assert(Array.isArray(l.exits),`locations.${l.id}.exits: required`); for(const e of l.exits){assert(loc.has(e.to),`locations.${l.id}.exits: unknown ${e.to}`);if(e.flag)assert(safeKey(e.flag),'exit.flag: invalid');} if(l.background)assert(safeAsset(l.background),'background: unsafe asset path'); }
  for(const [i,f] of (pack.facts||[]).entries()){assert(safeKey(f.id)&&typeof f.text==='string',`facts[${i}]: invalid`);assert(f.knownBy==='public'||Array.isArray(f.knownBy)&&f.knownBy.every(id=>actors.has(id)),`facts[${i}].knownBy: invalid`);}
  for(const [i,e] of (pack.lorebook||[]).entries()){assert(safeKey(e.id)&&typeof e.text==='string',`lorebook[${i}]: invalid`);assert(['world','location','character'].includes(e.scope),`lorebook[${i}].scope: invalid`);assert(e.knownBy==='public'||Array.isArray(e.knownBy)&&e.knownBy.every(id=>actors.has(id)),`lorebook[${i}].knownBy: invalid`);if(e.scope==='location')assert(loc.has(e.location),`lorebook[${i}].location: unknown`);if(e.scope==='character')assert(actors.has(e.character),`lorebook[${i}].character: unknown`);}
  assert(Array.isArray(pack.activities||[]),'activities: expected array');const activityIds=new Set();for(const [i,a] of (pack.activities||[]).entries()){
    assert(safeKey(a.id)&&!activityIds.has(a.id),`activities[${i}].id: invalid or duplicate`);activityIds.add(a.id);
    assert(typeof a.name==='string'&&a.name.trim()&&a.name.length<=120,`activities[${i}].name: required`);
    assert(typeof a.description==='string'&&a.description.length<=1000,`activities[${i}].description: invalid`);
    assert(loc.has(a.location),`activities[${i}].location: unknown`);
    assert(Number.isInteger(a.duration)&&a.duration>=0&&a.duration<=100,`activities[${i}].duration: expected 0–100`);
    assert(a.once===undefined||typeof a.once==='boolean',`activities[${i}].once: invalid`);
    assert(Array.isArray(a.phrases||[])&&(a.phrases||[]).every(s=>typeof s==='string'&&s.length<=120),`activities[${i}].phrases: invalid`);
    assert(!a.requiresFlag||safeKey(a.requiresFlag),`activities[${i}].requiresFlag: invalid`);
    assert(!a.requiresItem||pack.modules['items.inventory']&&(pack.items||[]).some(x=>x.id===a.requiresItem),`activities[${i}].requiresItem: invalid`);
    assert(!a.character||actors.has(a.character)&&a.character!==pack.playerId,`activities[${i}].character: invalid`);
    assert(a.minTrust===undefined||pack.modules['social.relationships']&&a.character&&Number.isInteger(a.minTrust)&&a.minTrust>=0&&a.minTrust<=100,`activities[${i}].minTrust: invalid`);
    for(const effect of a.effects||[]){assert(['flag','trust','item','money'].includes(effect.type),`activities[${i}].effects: invalid type`);if(effect.type==='flag')assert(safeKey(effect.id)&&typeof effect.value==='boolean',`activities[${i}].flag: invalid`);if(effect.type==='trust')assert(pack.modules['social.relationships']&&actors.has(effect.character)&&Number.isInteger(effect.delta)&&Math.abs(effect.delta)<=20,`activities[${i}].trust: invalid`);if(effect.type==='item')assert(pack.modules['items.inventory']&&(pack.items||[]).some(x=>x.id===effect.id)&&effect.to===pack.playerId,`activities[${i}].item: invalid`);if(effect.type==='money')assert(pack.modules['world.economy']&&Number.isInteger(effect.delta)&&Math.abs(effect.delta)<=100000,`activities[${i}].money: invalid`);}
  }
  if(pack.gameProject){const g=pack.gameProject;assert(typeof g.premise==='string'&&typeof g.setting==='string','gameProject.premise and setting: required');assert(g.ai&&typeof g.ai==='object','gameProject.ai: required');for(const key of ['intent','scene','daypart'])assert(typeof g.ai[key]==='string',`gameProject.ai.${key}: required`);if(g.calendar?.startWeekday)assert(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].includes(g.calendar.startWeekday),'gameProject.calendar.startWeekday: invalid');if(g.calendar?.startDate){const date=g.calendar.startDate,parsed=new Date(`${date}T00:00:00Z`);assert(/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===date,'gameProject.calendar.startDate: expected YYYY-MM-DD');}}
  if(pack.startOptions){assert(Array.isArray(pack.startOptions)&&pack.startOptions.length>0,'startOptions: non-empty array required');const starts=new Set();for(const [i,s] of pack.startOptions.entries()){assert(safeKey(s.id)&&!starts.has(s.id),`startOptions[${i}].id: invalid or duplicate`);starts.add(s.id);assert(typeof s.title==='string'&&loc.has(s.playerLocation),`startOptions[${i}]: title and valid playerLocation required`);assert(Number.isInteger(s.tick??0)&&(s.tick??0)>=0,'startOptions.tick: expected non-negative integer');}}
  if(pack.initialRelationships){assert(Array.isArray(pack.initialRelationships),'initialRelationships: expected array');for(const r of pack.initialRelationships){assert(actors.has(r.character)&&r.character!==pack.playerId,'initialRelationships.character: unknown NPC');assert(Number.isInteger(r.trust)&&r.trust>=0&&r.trust<=100,'initialRelationships.trust: expected 0–100');}}
  if((pack.initialRelationships||[]).length)assert(pack.modules['social.relationships'],'initialRelationships requires social.relationships');
  const mods=resolveModules(pack,registry), commands=new Set(['core.move','core.inspect','core.wait','core.scene','core.endScene']);
  for(const m of mods){m.validate?.(pack);for(const name of Object.keys(m.commands||{})){assert(!commands.has(name),`Command conflict: ${name}`);commands.add(name);}}
  return mods;
}
export function createWorld(pack,registry,id='campaign',seed=42,startId) {
  const mods=validatePack(pack,registry); assert(safeKey(id),'Invalid campaign ID');
  const start=(pack.startOptions||[]).find(x=>x.id===(startId||pack.startOptions?.[0]?.id));assert(!startId||start,'Unknown start option');
  const s={schemaVersion:1,campaignId:id,packId:pack.id,packVersion:pack.version,packDigest:digest(pack),moduleVersions:clone(pack.modules),startId:start?.id||null,revision:0,tick:start?.tick??0,initialSeed:seed>>>0,rng:seed>>>0,actors:Object.fromEntries(pack.actors.map(a=>[a.id,{name:a.name,location:a.id===pack.playerId&&start?start.playerLocation:a.location}])),flags:{},modules:{},scene:null,activityUses:{},events:[],turns:{}};
  for(const m of mods)s.modules[m.id]=m.init?.(pack)||{};
  if(s.modules['social.relationships'])for(const r of pack.initialRelationships||[])s.modules['social.relationships'].edges[`${r.character}--${pack.playerId}`]=r.trust;
  return s;
}
function put(state,path,value) {assert(Array.isArray(path)&&path.length>0&&path.every(x=>typeof x==='number'||safeKey(x)),'Invalid patch path');let p=state;for(const k of path.slice(0,-1)){assert(p[k]!==undefined,'Missing patch parent');p=p[k];}p[path.at(-1)]=clone(value);}
export function replay(initial,events) {const s=clone(initial);for(const e of events)if(e.type==='core.patch')put(s,e.payload.path,e.payload.value);return s;}
export function execute(world,command,pack,registry) {
  if(world.turns[command.id])return {state:world,turn:world.turns[command.id],duplicate:true};
  assert(world.packDigest===digest(pack),'Pack changed: migration required');
  assert(safeKey(command.id),'Invalid turn ID');assert(command.expectedRevision===world.revision,'Stale revision; refresh and try again');
  assert(command.actorId===pack.playerId,'Only the player can submit commands');
  assert(command.args&&typeof command.args==='object'&&!Array.isArray(command.args),'args must be an object');
  if(world.modules['story.scenes']?.pending)assert(command.type==='story.choose','Choose an option in the active scene first');
  const mods=resolveModules(pack,registry), state=clone(world), emitted=[];let steps=0;
  const tx={state,pack,world,commandId:command.id,
    emit(type,payload,visibility='public'){assert(++steps<=200,'Event reaction limit exceeded');const event={id:`${command.id}.${emitted.length}`,type,payload:clone(payload),tick:state.tick,visibility:clone(visibility)};emitted.push(event);return event;},
    set(path,value){put(state,path,value);this.emit('core.patch',{path,value},[]);},
    random(){const n=(Math.imul(state.rng,1664525)+1013904223)>>>0;this.set(['rng'],n);return n/4294967296;}
  };
  const base={
    'core.move'(tx,args){const from=tx.state.actors[pack.playerId].location;const exit=pack.locations.find(l=>l.id===from).exits.find(e=>e.to===args.to);assert(exit,'No route to that location');assert(!exit.flag||tx.state.flags[exit.flag],exit.reason||'This route is locked');releaseScene(tx);tx.set(['actors',pack.playerId,'location'],args.to);tx.emit('core.moved',{actor:pack.playerId,from,to:args.to,text:`Travelled to ${pack.locations.find(l=>l.id===args.to).name}.`});},
    'core.inspect'(tx){const l=pack.locations.find(l=>l.id===state.actors[pack.playerId].location);tx.emit('core.inspected',{text:l.description||l.name,location:l.id},[pack.playerId]);},
    'core.wait'(tx){tx.emit('core.waited',{text:'You wait and watch the world move.'},[pack.playerId]);},
    'core.endScene'(tx){assert(tx.state.scene,'There is no active conversation to end');releaseScene(tx);tx.emit('core.sceneEnded',{text:'You end the conversation.'},[pack.playerId]);},
    'core.scene'(tx,args){
      assert(typeof args.text==='string'&&args.text.trim().length>0&&args.text.length<=2000,'Scene request must contain 1–2000 characters');
      assert(['rest','meet','explore','work','talk','other','continue'].includes(args.activity),'Unknown scene activity');
      assert(args.location===null||pack.locations.some(l=>l.id===args.location),'Unknown scene location');
      assert(Array.isArray(args.characters)&&args.characters.length<=pack.actors.length,'Invalid scene cast');
      const cast=[...new Set(args.characters)];assert(cast.length===args.characters.length&&cast.every(id=>id!==pack.playerId&&pack.actors.some(a=>a.id===id)),'Unknown scene character');
      const activity=args.activityId?(pack.activities||[]).find(a=>a.id===args.activityId):null;
      assert(!args.activityId||activity,'Unknown authored activity');
      if(activity){
        assert(args.activity!=='continue','Start an authored activity in a new scene');
        assert(args.location===activity.location,'Activity location does not match its authored place');
        assert(!activity.character||cast.includes(activity.character),'Required character is not in this scene');
        assert(!activity.requiresFlag||tx.state.flags[activity.requiresFlag],'Activity requires a world flag');
        assert(!activity.requiresItem||tx.state.modules['items.inventory']?.owners[activity.requiresItem]===pack.playerId,'Activity requires an item');
        assert(activity.minTrust===undefined||(tx.state.modules['social.relationships']?.edges[`${activity.character}--${pack.playerId}`]||0)>=activity.minTrust,'Character is not ready for this activity');
        assert(!activity.once||!(tx.state.activityUses||{})[activity.id],'Activity has already been completed');
        for(const effect of activity.effects||[])if(effect.type==='item')assert(tx.state.modules['items.inventory'].owners[effect.id]===activity.location,'Activity item is no longer available here');
      }
      if(args.activity==='continue')assert(tx.state.scene&&args.location===tx.state.scene.location&&JSON.stringify(cast)===JSON.stringify(tx.state.scene.characters),'No matching scene to continue');
      if(args.activity!=='continue'&&tx.state.scene)releaseScene(tx);
      const from=tx.state.actors[pack.playerId].location,to=args.location||from;
      const route=travel(tx,pack,from,to,pack.playerId);if(!route)return;
      const duration=activity?activity.duration:args.activity==='rest'?(pack.daypart?.interval||4)-world.tick%(pack.daypart?.interval||4):args.activity==='continue'?0:1;
      const arrival=tx.state.tick+route.length-1+duration,present=cast.filter(id=>meetingArrival(tx,world,pack,id,to,arrival));
      if(activity?.character)assert(present.includes(activity.character),'Required character is unavailable when you arrive');
      if(args.itemAction==='give')assert(present.includes(args.itemTarget),'Recipient is unavailable when you arrive');
      if(cast.length&&!present.length){tx.set(['scene'],null);return;}
      if(args.activity==='rest')tx.set(['scene'],null);
      else if(args.activity!=='continue')tx.set(['scene'],{id:command.id,location:to,characters:present,activity:args.activity,startedTick:world.tick});
      tx.emit(args.activity==='continue'?'core.sceneContinued':'core.sceneStarted',{activity:args.activity,location:to,characters:present,text:args.text},[pack.playerId,...present]);
      if(args.activity==='talk'&&present.length===1&&pack.modules['social.conversation'])tx.emit('social.spoke',{actor:pack.playerId,target:present[0],location:to,utterance:args.text.trim(),promise:/\bpromise\b/i.test(args.text),source:'scene',text:`You talk to ${tx.state.actors[present[0]].name}: ${args.text.trim()}`},[pack.playerId,present[0]]);
      if(activity){
        if(!tx.state.activityUses)tx.set(['activityUses'],{});
        tx.set(['activityUses',activity.id],((tx.state.activityUses||{})[activity.id]||0)+1);
        for(const effect of activity.effects||[]){
          if(effect.type==='flag')tx.set(['flags',effect.id],effect.value);
          if(effect.type==='trust'){const key=`${effect.character}--${pack.playerId}`,old=tx.state.modules['social.relationships'].edges[key]||0;tx.set(['modules','social.relationships','edges',key],Math.max(0,Math.min(100,old+effect.delta)));tx.emit('social.relationshipChanged',{actor:effect.character,toward:pack.playerId,value:tx.state.modules['social.relationships'].edges[key]},[pack.playerId,effect.character]);}
          if(effect.type==='item'){tx.set(['modules','items.inventory','owners',effect.id],pack.playerId);tx.emit('items.transferred',{item:effect.id,from:to,to:pack.playerId,text:`You receive ${pack.items.find(i=>i.id===effect.id).name}.`},[pack.playerId]);}
          if(effect.type==='money')changeMoney(tx,effect.delta);
        }
        tx.emit('world.activityCompleted',{activity:activity.id,location:to,characters:cast,text:activity.description||activity.name},[pack.playerId,...cast]);
      }
      if(args.itemAction){
        assert(pack.modules['items.inventory']&&['take','place','give'].includes(args.itemAction),'Inventory action unavailable');
        const item=(pack.items||[]).find(i=>i.id===args.itemId);assert(item,'Unknown item');
        assert(args.text.toLowerCase().includes(item.name.toLowerCase())||args.text.toLowerCase().includes(item.id.replaceAll('-',' ')),'The player did not name that item');
        const verb=args.itemAction==='take'?/\b(take|pick up|grab|collect|get)\b/i:args.itemAction==='give'?/\b(give|hand|pass)\b/i:/\b(place|drop|leave|put)\b/i;
        assert(verb.test(args.text),'The player did not request that item action');
        const owners=tx.state.modules['items.inventory'].owners,from=owners[item.id];let owner;
        if(args.itemAction==='take'){assert(!item.shop||!pack.modules['world.economy'],'Buy this item at its shop');assert(from===to,'Item is not at this location');assert(!item.hidden||tx.state.modules['world.objects']?.discovered.includes(item.id),'Item has not been discovered');owner=pack.playerId;}
        else {assert(from===pack.playerId,'You do not own that item');if(args.itemAction==='place')owner=to;else{assert(cast.includes(args.itemTarget)&&tx.state.actors[args.itemTarget]?.location===to,'Recipient is not in this scene');owner=args.itemTarget;}}
        tx.set(['modules','items.inventory','owners',item.id],owner);tx.emit('items.transferred',{item:item.id,from,to:owner,text:`${args.itemAction==='take'?'You take':args.itemAction==='give'?'You give':'You place'} ${item.name}.`},[pack.playerId,...cast]);
      }
    }
  };
  const handler=base[command.type]||mods.map(m=>m.commands?.[command.type]).find(Boolean);assert(handler,`Unsupported command: ${command.type}`); handler(tx,command.args);
  const authored=command.type==='core.scene'&&command.args.activityId?(pack.activities||[]).find(a=>a.id===command.args.activityId):null;
  const invitation=command.type==='world.acceptHangout'?pack.daypart.hangouts.find(h=>h.char===command.args.char):null;
  const invitationLocation=invitation&&pack.locations.find(l=>l.name===invitation.where||l.id===invitation.where)?.id;
  const route=command.type==='core.scene'||invitation?routeBetween(pack,world.actors[pack.playerId].location,invitationLocation||command.args.location||world.actors[pack.playerId].location,world.flags):null;
  const travelCost=route?route.length-1:0;
  const cost=command.type==='world.nextDaypart'?pack.daypart.interval-state.tick%pack.daypart.interval:invitation?route?travelCost+1:0:command.type==='core.scene'&&!route?0:authored?travelCost+authored.duration:command.type==='core.scene'&&command.args.activity==='rest'?travelCost+(pack.daypart?.interval||4)-state.tick%(pack.daypart?.interval||4):command.type==='core.scene'?travelCost+(command.args.activity==='continue'?0:1):pack.durations?.[command.type]??(command.type==='core.inspect'?0:1);assert(Number.isInteger(cost)&&cost>=0&&cost<=100,'Invalid action duration');
  if(cost){const before=state.tick;tx.set(['tick'],before+cost);tx.emit('core.timeAdvanced',{from:before,to:state.tick,sceneCast:state.scene?.characters||[]},[]);}
  for(let i=0;i<emitted.length;i++){const e=emitted[i];if(e.type==='core.patch')continue;for(const m of mods)m.react?.(tx,e);}
  tx.set(['revision'],world.revision+1);
  const turn={id:command.id,command:clone(command),events:emitted,narrative:null,status:'pending'};
  state.events.push(...emitted);state.turns[command.id]=turn;return {state,turn,duplicate:false};
}
export function actions(world,pack,registry){
  if(world.modules['story.scenes']?.pending)return resolveModules(pack,registry).flatMap(m=>m.actions?.(world,pack)||[]).filter(a=>a.type==='story.choose').map((a,i)=>{try{execute(world,{...a,id:`preview-choice-${world.revision}-${i}`,actorId:pack.playerId,expectedRevision:world.revision},pack,registry);return {...a,enabled:true};}catch(e){return {...a,enabled:false,reason:e.message};}});
  const loc=pack.locations.find(l=>l.id===world.actors[pack.playerId].location);
  const list=[{label:'Look around',type:'core.inspect',args:{}},{label:'Wait',type:'core.wait',args:{}},...(world.scene?[{label:'End conversation',type:'core.endScene',args:{}}]:[]),...loc.exits.map(e=>({label:`Go to ${pack.locations.find(l=>l.id===e.to).name}`,type:'core.move',args:{to:e.to}})),...resolveModules(pack,registry).flatMap(m=>m.actions?.(world,pack)||[])];
  return list.map((a,i)=>{try{execute(world,{...a,id:`preview-${world.revision}-${i}`,actorId:pack.playerId,expectedRevision:world.revision},pack,registry);return {...a,enabled:true};}catch(e){return {...a,enabled:false,reason:e.message};}});
}
export function fallback(turn){return turn.events.filter(e=>e.visibility==='public'||e.visibility.includes(turn.command.actorId)).map(e=>e.payload.text).filter(Boolean).join('\n')||'Action completed.';}
