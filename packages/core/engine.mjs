import {calendarFor} from '../../public/calendar.mjs';
import {spokenLine} from '../../vendor/venus/sceneText.mjs';
import {changeMoney} from '../modules/economy.mjs';
import {changeStat} from '../modules/stats.mjs';
import {validateConditions} from '../modules/conditions.mjs';
export const CORE_API = '0.1.0';
export const clone = x => structuredClone(x);
export function assert(ok, message) { if (!ok) throw new Error(message); }
export function safeKey(s) { return typeof s === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(s) && !['__proto__','constructor','prototype'].includes(s); }
export function routeBetween(pack,from,to,flags={}) { const queue=[[from]],seen=new Set([from]);while(queue.length){const path=queue.shift(),at=path.at(-1);if(at===to)return path;for(const e of pack.locations.find(l=>l.id===at)?.exits||[])if(!seen.has(e.to)&&(!e.flag||flags[e.flag])){seen.add(e.to);queue.push([...path,e.to]);}}return null; }
export function scheduleDestination(pack,schedule,tick) {const exception=(pack.scheduleExceptions||[]).find(x=>x.actor===schedule.actor&&tick>=x.startTick&&tick<=x.endTick);if(exception)return exception.location;for(const stop of schedule.stops||[])if(tick%schedule.period===stop.at)return stop.location;const interval=pack.daypart?.interval||4;if(tick%interval===0){const clock=calendarFor(tick,pack);for(const stop of schedule.weekly||[])if(stop.weekday===clock.weekday&&stop.daypart===clock.daypart)return stop.location;}return null;}
export function scheduledLocation(world,pack,id,arrivalTick) {if(!pack.modules['world.schedule'])return world.actors[id].location;let at=world.actors[id].location;for(let tick=world.tick+1;tick<=arrivalTick;tick++)for(const schedule of pack.schedules||[])if(schedule.actor===id)at=scheduleDestination(pack,schedule,tick)||at;return at;}
// First tick after fromTick on which this actor's schedule places them at `location`
// (or null if none within the horizon). Deterministic: depends only on pack and ticks.
export function nextArrivalTick(pack,actor,location,fromTick,maxTicks=null){
 if(!pack.modules['world.schedule'])return null;
 const schedule=(pack.schedules||[]).find(r=>r.actor===actor);if(!schedule)return null;
 const horizon=maxTicks??(pack.daypart?.interval||4)*3*7;
 for(let tick=fromTick+1;tick<=fromTick+horizon;tick++)if(scheduleDestination(pack,schedule,tick)===location)return tick;
 return null;
}
// A cast member remains present for the scene. Apply the latest missed scheduled stop at its boundary.
export function settleSceneAttendance(world,pack){
 const scene=world.scene;if(!scene)return;
 // An invited guest heads back where they came from once the scene is over; a missed scheduled stop still wins below.
 for(const [id,home] of Object.entries(scene.returns||{}))if(world.actors[id]?.location===scene.location)world.actors[id].location=home;
 if(!pack.modules['world.schedule']||!Number.isInteger(scene.startedTick))return;
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
// A continuous scene also ends from the NPC's side: they run out of time after the pack's exchange budget, or leave when a
// boundary is crossed (a declined advance, a sharp loss of trust). Scripted scenes hold the scene open until they resolve.
export function sceneLifecycle(tx,world,emitted,exchange){
 const s=tx.state,pack=tx.pack,scene=s.scene;if(!scene||scene.id!==world.scene.id||s.modules['story.scenes']?.pending||!scene.characters.length)return;
 const cast=scene.characters,hurt=emitted.find(e=>cast.includes(e.payload?.actor??e.payload?.character)&&(e.type==='social.consentDeclined'||e.type==='social.relationshipChanged'&&e.payload.toward===pack.playerId&&Number.isInteger(e.payload.old)&&e.payload.value-e.payload.old<=-5));
 const count=(scene.exchanges||0)+(exchange?1:0),cap=pack.gameProject?.sceneTurns??12;
 if(!hurt&&count<cap){if(exchange)tx.set(['scene','exchanges'],count);return;}
 const who=hurt?(hurt.payload.actor??hurt.payload.character):cast[0],name=s.actors[who].name,reason=hurt?'boundary':'schedule';
 releaseScene(tx);tx.emit('core.sceneEnded',{reason,character:who,characters:cast,text:hurt?`${name} has had enough for now and leaves.`:`${name} has somewhere to be and says goodbye.`},[pack.playerId,...cast]);
}
export function travel(tx,pack,from,to,player){const route=routeBetween(pack,from,to,tx.state.flags);if(!route){tx.emit('core.travelBlocked',{from,to,text:`You cannot reach ${pack.locations.find(l=>l.id===to).name} from here.`},[player]);return null;}for(let i=1;i<route.length;i++){tx.set(['actors',player,'location'],route[i]);tx.emit('core.moved',{actor:player,from:route[i-1],to:route[i],text:`You go to ${pack.locations.find(l=>l.id===route[i]).name}.`},[player]);}return route;}
export function meetingArrival(tx,world,pack,id,to,arrival){if(tx.state.actors[id].location===to)return true;const location=scheduledLocation(world,pack,id,arrival);if(location!==to){const at=nextArrivalTick(pack,id,to,arrival);const when=at===null?'':` They are scheduled back at ${pack.locations.find(l=>l.id===to).name} from ${calendarFor(at,pack).weekday} ${calendarFor(at,pack).daypart}.`;tx.emit('world.meetingUnavailable',{character:id,location:to,nextArrival:at,text:`${tx.state.actors[id].name} is not at ${pack.locations.find(l=>l.id===to).name} when you arrive.${when}`},[pack.playerId]);return false;}tx.set(['actors',id,'location'],to);tx.emit('world.actorArrived',{actor:id,location:to,text:`${tx.state.actors[id].name} arrives at ${pack.locations.find(l=>l.id===to).name}.`},[pack.playerId,id]);return true;}
export function digest(x) { let h=2166136261; for(const c of JSON.stringify(x)) h=Math.imul(h^c.charCodeAt(0),16777619); return (h>>>0).toString(16); }
// Only the fields execute()/createWorld() actually depend on: state-affecting rules, IDs, schemas. Prose and
// presentation (names, descriptions, portraits, phrases, prompts) are deliberately left out so editing them
// never invalidates a save.
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
export function mechanicsShape(pack) {
 return {
  schemaVersion:pack.schemaVersion,id:pack.id,version:pack.version,modules:pack.modules,playerId:pack.playerId,
  locations:pack.locations.map(l=>({id:l.id,exits:(l.exits||[]).map(e=>pick(e,['to','flag']))})),
  actors:pack.actors.map(a=>({id:a.id,location:a.location})),
  items:(pack.items||[]).map(i=>pick(i,['id','shop','hidden'])),
  activities:(pack.activities||[]).map(a=>pick(a,['id','location','duration','once','perDay','requiresFlag','requiresItem','character','minTrust','effects'])),
  schedules:pack.schedules||[],daypart:pack.daypart||null,run:pack.run||null,
  scriptedScenes:(pack.scriptedScenes||[]).map(scene=>({id:scene.id,offer:scene.offer,timeCost:scene.timeCost,repeatable:scene.repeatable,priority:scene.priority,tension:scene.tension,trigger:scene.trigger,when:scene.when,allowInput:scene.allowInput,pages:(scene.pages||[]).map(page=>pick(page,['speaker','stage','background'])),choices:(scene.choices||[]).map(choice=>pick(choice,['id','next','waitFor','when','check','effects'])),beats:(scene.beats||[]).map(beat=>({id:beat.id,allowInput:beat.allowInput,pages:(beat.pages||[]).map(page=>pick(page,['speaker','stage','background'])),choices:(beat.choices||[]).map(choice=>pick(choice,['id','next','waitFor','when','check','effects']))}))})),
  endings:(pack.endings||[]).map(ending=>pick(ending,['id','character','priority','requires'])),storyVariables:(pack.storyVariables||[]).map(variable=>pick(variable,['id','initial'])),
  ...(pack.directorProfile?{directorProfile:pack.directorProfile}:{}),
  initialRelationships:pack.initialRelationships||[],
  startOptions:(pack.startOptions||[]).map(s=>pick(s,['id','playerLocation','tick'])),
 };
}
export function mechanicsDigest(pack) { return digest(mechanicsShape(pack)); }
// A human-readable preview of what a mechanics change would do, for migration UIs.
export function describeMechanicsChange(oldPack,newPack) {
 const a=mechanicsShape(oldPack),b=mechanicsShape(newPack),changes=[];
 if(a.schemaVersion!==b.schemaVersion)changes.push(`schemaVersion: ${a.schemaVersion} -> ${b.schemaVersion}`);
 if(JSON.stringify(a.modules)!==JSON.stringify(b.modules))changes.push('modules changed');
 if(a.playerId!==b.playerId)changes.push(`playerId: ${a.playerId} -> ${b.playerId}`);
 for(const [kind,before,after] of [['locations',a.locations,b.locations],['actors',a.actors,b.actors],['items',a.items,b.items],['activities',a.activities,b.activities]]) {
  for(const id of new Set([...before,...after].map(x=>x.id))) {
   const bx=before.find(x=>x.id===id),ax=after.find(x=>x.id===id);
   if(!bx)changes.push(`${kind}.${id}: added`);
   else if(!ax)changes.push(`${kind}.${id}: removed`);
   else if(JSON.stringify(bx)!==JSON.stringify(ax))changes.push(`${kind}.${id}: changed`);
  }
 }
 for(const key of ['schedules','daypart','initialRelationships','startOptions','directorProfile'])if(JSON.stringify(a[key])!==JSON.stringify(b[key]))changes.push(`${key}: changed`);
 return changes;
}
// Applies a mechanics change to an existing world: re-validates the new pack, then records the change so
// the switch is auditable instead of a silent digest bump.
export function migratePack(world,oldPack,newPack,registry) {
 const from=mechanicsDigest(oldPack),to=mechanicsDigest(newPack);
 assert(world.packDigest===from,'World does not match the pack being migrated from');
 assert(from!==to,'No mechanics change to migrate');
 validatePack(newPack,registry);
 const changes=describeMechanicsChange(oldPack,newPack);
 return {...clone(world),packId:newPack.id,packVersion:newPack.version,packDigest:to,moduleVersions:clone(newPack.modules),revision:world.revision+1,migrations:[...(world.migrations||[]),{tick:world.tick,from,to,changes}]};
}
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
  assert(Array.isArray(pack.storyVariables||[]),'storyVariables: expected array');const storyVariableIds=new Set();for(const [i,variable] of (pack.storyVariables||[]).entries()){assert(safeKey(variable.id)&&!storyVariableIds.has(variable.id),`storyVariables[${i}].id: invalid or duplicate`);storyVariableIds.add(variable.id);assert(typeof variable.name==='string'&&variable.name.trim()&&variable.name.length<=120,`storyVariables[${i}].name: required`);assert(typeof variable.initial==='boolean',`storyVariables[${i}].initial: expected true or false`);}const knownStoryVariable=id=>!storyVariableIds.size||storyVariableIds.has(id);
  const seen=new Set();
  for(const [kind,entries] of [['locations',pack.locations],['actors',pack.actors],['items',pack.items||[]],['quests',pack.quests||[]],['abilities',pack.abilities||[]],['objects',pack.objects||[]]]) {
    assert(Array.isArray(entries),`${kind}: expected array`); entries.forEach((e,i)=>{assert(safeKey(e.id),`${kind}[${i}].id: invalid`);assert(!seen.has(e.id),`${kind}[${i}].id: duplicate ${e.id}`); seen.add(e.id);assert(typeof e.name==='string',`${kind}[${i}].name: required`);});
  }
  const loc=new Set(pack.locations.map(x=>x.id)), actors=new Set(pack.actors.map(x=>x.id));
  const locationNames=new Map();for(const location of pack.locations){if(location.aliases!==undefined)assert(Array.isArray(location.aliases)&&location.aliases.length<=20&&location.aliases.every(alias=>typeof alias==='string'&&alias.trim()&&alias.length<=80),'location.aliases: expected up to 20 short names');for(const name of [location.id,location.name,...location.aliases||[]]){const key=name.trim().toLocaleLowerCase();assert(!locationNames.has(key)||locationNames.get(key)===location.id,`location name or alias is ambiguous: ${name}`);locationNames.set(key,location.id);}}
  assert(actors.has(pack.playerId),'playerId: missing actor');
  const safeAsset=x=>/^assets\/[a-zA-Z0-9/_-]+\.(svg|png|jpg|webp)$/.test(x)||/^scenario-media\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(x);
  for(const a of pack.actors){assert(loc.has(a.location),`actors.${a.id}.location: unknown`);if(a.pronouns!==undefined)assert(typeof a.pronouns==='string'&&a.pronouns.trim()&&a.pronouns.length<=40,`actors.${a.id}.pronouns: expected a short string such as she/her`);if(a.conversationStarters!==undefined)assert(Array.isArray(a.conversationStarters)&&a.conversationStarters.length<=8&&a.conversationStarters.every(text=>typeof text==='string'&&text.trim()&&text.length<=240),`actors.${a.id}.conversationStarters: expected up to 8 short suggestions`);if(a.portrait)assert(safeAsset(a.portrait),`actors.${a.id}.portrait: unsafe asset path`);if(a.poses){assert(Array.isArray(a.poses),'actor.poses: expected array');const seenPoses=new Set();for(const pose of a.poses){assert(safeKey(pose.id)&&!seenPoses.has(pose.id),'actor.pose.id: invalid or duplicate');seenPoses.add(pose.id);assert(safeAsset(pose.image),'actor.pose.image: unsafe asset path');}}}
  for(const l of pack.locations){ assert(Array.isArray(l.exits),`locations.${l.id}.exits: required`); for(const e of l.exits){assert(loc.has(e.to),`locations.${l.id}.exits: unknown ${e.to}`);if(e.flag)assert(safeKey(e.flag)&&knownStoryVariable(e.flag),'exit.flag: invalid or undefined');} if(l.background)assert(safeAsset(l.background),'background: unsafe asset path'); }
  for(const [i,f] of (pack.facts||[]).entries()){assert(safeKey(f.id)&&typeof f.text==='string',`facts[${i}]: invalid`);assert(f.knownBy==='public'||Array.isArray(f.knownBy)&&f.knownBy.every(id=>actors.has(id)),`facts[${i}].knownBy: invalid`);}
  for(const [i,e] of (pack.lorebook||[]).entries()){assert(safeKey(e.id)&&typeof e.text==='string',`lorebook[${i}]: invalid`);assert(['world','location','character'].includes(e.scope),`lorebook[${i}].scope: invalid`);assert(e.knownBy==='public'||Array.isArray(e.knownBy)&&e.knownBy.every(id=>actors.has(id)),`lorebook[${i}].knownBy: invalid`);if(e.scope==='location')assert(loc.has(e.location),`lorebook[${i}].location: unknown`);if(e.scope==='character')assert(actors.has(e.character),`lorebook[${i}].character: unknown`);if(e.when!==undefined)validateConditions(e.when,pack,`lorebook[${i}].when`);for(const k of ['sticky','cooldown','delay'])if(e[k]!==undefined)assert(Number.isInteger(e[k])&&e[k]>=0&&e[k]<=10000,`lorebook[${i}].${k}: expected whole ticks (0–10000)`);}
  assert(Array.isArray(pack.activities||[]),'activities: expected array');const activityIds=new Set();for(const [i,a] of (pack.activities||[]).entries()){
    assert(safeKey(a.id)&&!activityIds.has(a.id),`activities[${i}].id: invalid or duplicate`);activityIds.add(a.id);
    assert(typeof a.name==='string'&&a.name.trim()&&a.name.length<=120,`activities[${i}].name: required`);
    assert(typeof a.description==='string'&&a.description.length<=1000,`activities[${i}].description: invalid`);
    assert(loc.has(a.location),`activities[${i}].location: unknown`);
    assert(Number.isInteger(a.duration)&&a.duration>=0&&a.duration<=100,`activities[${i}].duration: expected 0–100`);
    assert(a.once===undefined||typeof a.once==='boolean',`activities[${i}].once: invalid`);
    assert(a.perDay===undefined||Number.isInteger(a.perDay)&&a.perDay>=1&&a.perDay<=10,`activities[${i}].perDay: expected 1–10`);
    assert(Array.isArray(a.phrases||[])&&(a.phrases||[]).every(s=>typeof s==='string'&&s.length<=120),`activities[${i}].phrases: invalid`);
    assert(!a.requiresFlag||safeKey(a.requiresFlag)&&knownStoryVariable(a.requiresFlag),`activities[${i}].requiresFlag: invalid or undefined`);
    assert(!a.requiresItem||pack.modules['items.inventory']&&(pack.items||[]).some(x=>x.id===a.requiresItem),`activities[${i}].requiresItem: invalid`);
    assert(!a.character||actors.has(a.character)&&a.character!==pack.playerId,`activities[${i}].character: invalid`);
    assert(a.minTrust===undefined||pack.modules['social.relationships']&&a.character&&Number.isInteger(a.minTrust)&&a.minTrust>=0&&a.minTrust<=100,`activities[${i}].minTrust: invalid`);
    for(const effect of a.effects||[]){assert(['flag','trust','item','money','stat'].includes(effect.type),`activities[${i}].effects: invalid type`);if(effect.type==='stat')assert(pack.modules['character.stats']&&(pack.statDefinitions||[]).some(d=>d.id===effect.stat)&&Number.isInteger(effect.delta)&&effect.delta!==0&&Math.abs(effect.delta)<=3,`activities[${i}].stat: training moves a player stat by ±1–3`);if(effect.type==='flag')assert(safeKey(effect.id)&&knownStoryVariable(effect.id)&&typeof effect.value==='boolean',`activities[${i}].flag: invalid or undefined`);if(effect.type==='trust')assert(pack.modules['social.relationships']&&actors.has(effect.character)&&Number.isInteger(effect.delta)&&Math.abs(effect.delta)<=20,`activities[${i}].trust: invalid`);if(effect.type==='item')assert(pack.modules['items.inventory']&&(pack.items||[]).some(x=>x.id===effect.id)&&effect.to===pack.playerId,`activities[${i}].item: invalid`);if(effect.type==='money')assert(pack.modules['world.economy']&&Number.isInteger(effect.delta)&&Math.abs(effect.delta)<=100000,`activities[${i}].money: invalid`);}
  }
  if(pack.gameProject){const g=pack.gameProject;assert(typeof g.premise==='string'&&typeof g.setting==='string','gameProject.premise and setting: required');assert(['authored','continuous'].includes(g.conversationStyle||'authored'),'gameProject.conversationStyle: expected authored or continuous');assert(['present','always'].includes(g.characterLocationVisibility||'present'),'gameProject.characterLocationVisibility: expected present or always');assert(['hidden','always'].includes(g.characterScheduleVisibility||'hidden'),'gameProject.characterScheduleVisibility: expected hidden or always');assert(g.ai&&typeof g.ai==='object','gameProject.ai: required');for(const key of ['intent','scene','daypart'])assert(typeof g.ai[key]==='string',`gameProject.ai.${key}: required`);if(g.calendar?.startWeekday)assert(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].includes(g.calendar.startWeekday),'gameProject.calendar.startWeekday: invalid');if(g.calendar?.startDate){const date=g.calendar.startDate,parsed=new Date(`${date}T00:00:00Z`);assert(/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===date,'gameProject.calendar.startDate: expected YYYY-MM-DD');}}
  if(pack.startOptions){assert(Array.isArray(pack.startOptions)&&pack.startOptions.length>0,'startOptions: non-empty array required');const starts=new Set();for(const [i,s] of pack.startOptions.entries()){assert(safeKey(s.id)&&!starts.has(s.id),`startOptions[${i}].id: invalid or duplicate`);starts.add(s.id);assert(typeof s.title==='string'&&loc.has(s.playerLocation),`startOptions[${i}]: title and valid playerLocation required`);assert(Number.isInteger(s.tick??0)&&(s.tick??0)>=0,'startOptions.tick: expected non-negative integer');}}
  assert(pack.relationships===undefined,'relationships is not supported; use initialRelationships with {character, trust} entries');
  if(pack.initialRelationships){assert(Array.isArray(pack.initialRelationships),'initialRelationships: expected array');for(const r of pack.initialRelationships){assert(actors.has(r.character)&&r.character!==pack.playerId,'initialRelationships.character: unknown NPC');assert(Number.isInteger(r.trust)&&r.trust>=0&&r.trust<=100,'initialRelationships.trust: expected 0–100');}}
  if((pack.initialRelationships||[]).length)assert(pack.modules['social.relationships'],'initialRelationships requires social.relationships');
  if(pack.run){assert(Number.isInteger(pack.run.days)&&pack.run.days>=1&&pack.run.days<=365,'run.days: expected 1–365');assert(pack.modules['story.endings'],'run requires story.endings');assert(typeof pack.run.defaultEnding==='string'&&(pack.endings||[]).some(ending=>ending.id===pack.run.defaultEnding),'run.defaultEnding: choose an existing ending');}
  const mods=resolveModules(pack,registry), commands=new Set(['core.move','core.inspect','core.wait','core.scene','core.endScene']);
  for(const m of mods){m.validate?.(pack);for(const name of Object.keys(m.commands||{})){assert(!commands.has(name),`Command conflict: ${name}`);commands.add(name);}}
  return mods;
}
export function createWorld(pack,registry,id='campaign',seed=42,startId) {
  const mods=validatePack(pack,registry); assert(safeKey(id),'Invalid campaign ID');
  const start=(pack.startOptions||[]).find(x=>x.id===(startId||pack.startOptions?.[0]?.id));assert(!startId||start,'Unknown start option');
  const s={schemaVersion:1,campaignId:id,packId:pack.id,packVersion:pack.version,packDigest:mechanicsDigest(pack),moduleVersions:clone(pack.modules),startId:start?.id||null,revision:0,tick:start?.tick??0,initialSeed:seed>>>0,rng:seed>>>0,actors:Object.fromEntries(pack.actors.map(a=>[a.id,{name:a.name,location:a.id===pack.playerId&&start?start.playerLocation:a.location}])),flags:Object.fromEntries((pack.storyVariables||[]).map(variable=>[variable.id,variable.initial])),modules:{},scene:null,activityUses:{},events:[],turns:{}};
  if(pack.run){const interval=pack.daypart?.interval||4;s.run={startTick:s.tick,endTick:s.tick+pack.run.days*interval*3,days:pack.run.days};}
  for(const m of mods)s.modules[m.id]=m.init?.(pack,{seed:s.initialSeed})||{};
  if(s.modules['social.relationships'])for(const r of pack.initialRelationships||[])s.modules['social.relationships'].edges[`${r.character}--${pack.playerId}`]=r.trust;
  return s;
}
function put(state,path,value) {assert(Array.isArray(path)&&path.length>0&&path.every(x=>typeof x==='number'||safeKey(x)),'Invalid patch path');let p=state;for(const k of path.slice(0,-1)){assert(p[k]!==undefined,'Missing patch parent');p=p[k];}p[path.at(-1)]=clone(value);}
export function replay(initial,events) {const s=clone(initial);for(const e of events)if(e.type==='core.patch')put(s,e.payload.path,e.payload.value);return s;}
export function execute(world,command,pack,registry) {
  if(world.turns[command.id])return {state:world,turn:world.turns[command.id],duplicate:true};
  assert(world.packDigest===mechanicsDigest(pack),'Pack changed: migration required');
  assert(safeKey(command.id),'Invalid turn ID');assert(command.expectedRevision===world.revision,'Stale revision; refresh and try again');
  assert(command.actorId===pack.playerId,'Only the player can submit commands');
  assert(command.args&&typeof command.args==='object'&&!Array.isArray(command.args),'args must be an object');
  assert(!world.modules['story.endings']?.selected,'The story has ended. Start a new campaign to play again.');
  if(world.modules['story.scenes']?.pending)assert(['story.choose','story.respond','story.leave','social.withdrawConsent'].includes(command.type)||FREE_ACTIONS.has(command.type),'Choose an option, reply in your own words, withdraw consent, or leave the active scene first');
  const mods=resolveModules(pack,registry), state=clone(world), emitted=[];let steps=0,waitTicks=0,meetingBlocked=false;
  // Continuous style (Venus University): an activity opens one scene, talk inside it is free, and the period is spent when the scene ends.
  const continuous=pack.gameProject?.conversationStyle==='continuous',interval=pack.daypart?.interval||4;
  const tx={state,pack,world,commandId:command.id,
    emit(type,payload,visibility='public'){assert(++steps<=200,'Event reaction limit exceeded');const event={id:`${command.id}.${emitted.length}`,type,payload:clone(payload),tick:state.tick,visibility:clone(visibility)};emitted.push(event);return event;},
    set(path,value){put(state,path,value);this.emit('core.patch',{path,value},[]);},
    random(){const n=(Math.imul(state.rng,1664525)+1013904223)>>>0;this.set(['rng'],n);return n/4294967296;}
  };
  const base={
    'core.move'(tx,args){const from=tx.state.actors[pack.playerId].location;const exit=pack.locations.find(l=>l.id===from).exits.find(e=>e.to===args.to);assert(exit,'No route to that location');assert(!exit.flag||tx.state.flags[exit.flag],exit.reason||'This route is locked');releaseScene(tx);tx.set(['actors',pack.playerId,'location'],args.to);tx.emit('core.moved',{actor:pack.playerId,from,to:args.to,text:`Travelled to ${pack.locations.find(l=>l.id===args.to).name}.`});},
    'core.inspect'(tx){const l=pack.locations.find(l=>l.id===state.actors[pack.playerId].location);tx.emit('core.inspected',{text:l.description||l.name,location:l.id},[pack.playerId]);},
    'core.wait'(tx){tx.emit('core.waited',{text:'You wait and watch the world move.'},[pack.playerId]);},
    'core.waitUntil'(tx,args){const to=args.location||state.actors[pack.playerId].location;assert(pack.actors.some(a=>a.id===args.actor&&a.id!==pack.playerId),'Unknown character to wait for');assert(pack.locations.some(l=>l.id===to),'Unknown wait location');assert(state.actors[pack.playerId].location===to,'Wait where you are');assert(state.actors[args.actor].location!==to,'That character is already here');const at=nextArrivalTick(pack,args.actor,to,world.tick);assert(at&&at>world.tick,'That character has no upcoming stop here soon');waitTicks=at-world.tick;const name=state.actors[args.actor].name;tx.emit('core.waited',{actor:args.actor,location:to,tick:at,text:`You wait until ${name} arrives here.`},[pack.playerId]);},
    'core.endScene'(tx,args){assert(tx.state.scene,'There is no active conversation to end');const reason=args.reason||'player';assert(['player','natural'].includes(reason),'Unknown scene end reason');const cast=tx.state.scene.characters,activity=tx.state.scene.activity;releaseScene(tx);tx.emit('core.sceneEnded',{reason,characters:cast,text:reason==='natural'?'The conversation comes to a natural close.':['talk','meet','continue'].includes(activity)?'You end the conversation.':'You wrap up what you were doing.'},[pack.playerId,...cast]);},
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
        assert(!activity.perDay||activityDayCount(tx.state,pack,activity.id)<activity.perDay,`You have had enough of that for today: ${activity.name}.`);
        for(const effect of activity.effects||[])if(effect.type==='item')assert(tx.state.modules['items.inventory'].owners[effect.id]===activity.location,'Activity item is no longer available here');
      }
      if(args.activity==='continue')assert(tx.state.scene&&args.location===tx.state.scene.location&&JSON.stringify(cast)===JSON.stringify(tx.state.scene.characters),'No matching scene to continue');
      const from=tx.state.actors[pack.playerId].location,to=args.location||from;
      // Naming a character who will not be there is answered for free, before any travel: spending the trip
      // only to report an empty room taught testers (and players) nothing but the tick price.
      if(!['continue','rest'].includes(args.activity)&&cast.length){
        const ahead=routeBetween(pack,from,to,tx.state.flags);
        if(ahead){
          const duration=continuous?0:activity?activity.duration:1,arrival=tx.state.tick+ahead.length-1+duration;
          // Someone standing in the room is present no matter what their schedule says next; only a character
          // who is elsewhere now and not scheduled to arrive in time is worth a redirect.
          const away=cast.filter(id=>tx.state.actors[id].location!==to&&scheduledLocation(world,pack,id,arrival)!==to);
          if(away.length===cast.length){
            const place=pack.locations.find(l=>l.id===to)?.name||to,whereNow=id=>{const at=scheduledLocation(world,pack,id,tx.state.tick);return pack.locations.find(l=>l.id===at)?.name||at;};
            const lines=away.map(id=>{const name=tx.state.actors[id].name,at=nextArrivalTick(pack,id,to,arrival),when=at===null?'':` They are scheduled to be at ${place} from ${calendarFor(at,pack).weekday} ${calendarFor(at,pack).daypart}.`;return {character:id,nextArrival:at,text:`${name} is not at ${place}: they are at ${whereNow(id)} right now.${when}`};});
            tx.emit('world.meetingRedirect',{characters:away,location:to,nextArrival:lines.find(x=>x.nextArrival!==null)?.nextArrival??null,text:lines.map(x=>x.text).join(' ')},[pack.playerId]);meetingBlocked=true;return;
          }
        }
      }
      if(args.activity!=='continue'&&tx.state.scene)releaseScene(tx);
      const route=travel(tx,pack,from,to,pack.playerId);if(!route)return;
      const periodRemaining=interval-world.tick%interval,routeTicks=route.length-1;
      const duration=continuous&&args.activity!=='rest'?0:activity?activity.duration:args.activity==='rest'?(continuous?Math.max(0,periodRemaining-routeTicks):periodRemaining):args.activity==='continue'?0:1;
      const arrival=tx.state.tick+route.length-1+duration,present=cast.filter(id=>meetingArrival(tx,world,pack,id,to,arrival));
      if(activity?.character)assert(present.includes(activity.character),`${pack.actors.find(c=>c.id===activity.character)?.name||activity.character} isn't there right now, so you can't ${activity.name.toLowerCase()}.`);
      if(args.itemAction==='give')assert(present.includes(args.itemTarget),'Recipient is unavailable when you arrive');
      if(cast.length&&!present.length){tx.set(['scene'],null);return;}
      if(args.activity==='rest')tx.set(['scene'],null);
      else if(args.activity!=='continue')tx.set(['scene'],{id:command.id,location:to,characters:present,activity:args.activity,startedTick:world.tick});
      tx.emit(args.activity==='continue'?'core.sceneContinued':'core.sceneStarted',{activity:args.activity,location:to,characters:present,text:args.text},[pack.playerId,...present]);
      if(args.activity==='talk'&&present.length===1&&pack.modules['social.conversation']){const utterance=spokenLine(args.text);tx.emit('social.spoke',{actor:pack.playerId,target:present[0],location:to,utterance,promise:/\bpromise\b/i.test(args.text),source:'scene',text:`You talk to ${tx.state.actors[present[0]].name}: ${utterance}`},[pack.playerId,present[0]]);}
      if(activity){
        if(!tx.state.activityUses)tx.set(['activityUses'],{});
        tx.set(['activityUses',activity.id],((tx.state.activityUses||{})[activity.id]||0)+1);
        const day=calendarFor(tx.state.tick,pack).day,dayUses=tx.state.activityDayUses||{};
        if(!tx.state.activityDayUses)tx.set(['activityDayUses'],{});
        tx.set(['activityDayUses',activity.id],dayUses[activity.id]&&dayUses[activity.id].day===day?{day,count:dayUses[activity.id].count+1}:{day,count:1});
        for(const effect of activity.effects||[]){
          if(effect.type==='flag')tx.set(['flags',effect.id],effect.value);
          if(effect.type==='trust'){const key=`${effect.character}--${pack.playerId}`,old=tx.state.modules['social.relationships'].edges[key]||0;tx.set(['modules','social.relationships','edges',key],Math.max(0,Math.min(100,old+effect.delta)));const value=tx.state.modules['social.relationships'].edges[key];tx.emit('social.relationshipChanged',{actor:effect.character,toward:pack.playerId,old,value,delta:value-old,text:`${tx.state.actors[effect.character].name}: Trust ${old} → ${value}`},[pack.playerId,effect.character]);}
          if(effect.type==='item'){tx.set(['modules','items.inventory','owners',effect.id],pack.playerId);tx.emit('items.transferred',{item:effect.id,from:to,to:pack.playerId,text:`You receive ${pack.items.find(i=>i.id===effect.id).name}.`},[pack.playerId]);}
          if(effect.type==='money')changeMoney(tx,effect.delta);
          if(effect.type==='stat')changeStat(tx,pack.playerId,effect.stat,effect.delta,`activity ${activity.id}`);
        }
        tx.emit('world.activityCompleted',{activity:activity.id,location:to,characters:cast,text:activity.description||activity.name},[pack.playerId,...cast]);
      }
      if(args.itemAction){
        assert(pack.modules['items.inventory']&&['take','place','give'].includes(args.itemAction),'Inventory action unavailable');
        const item=(pack.items||[]).find(i=>i.id===args.itemId);assert(item,'Unknown item');
        const owners=tx.state.modules['items.inventory'].owners;const inScope=args.itemAction==='take'?pack.items.filter(i=>owners[i.id]===to&&(!i.shop||!pack.modules['world.economy'])&&(!i.hidden||tx.state.modules['world.objects']?.discovered.includes(i.id))):pack.items.filter(i=>owners[i.id]===pack.playerId);const named=args.text.toLowerCase().includes(item.name.toLowerCase())||args.text.toLowerCase().includes(item.id.replaceAll('-',' '));assert(named||(inScope.length===1&&inScope[0].id===item.id),'Please name the item you intend to use.');const from=owners[item.id];let owner;
        if(args.itemAction==='take'){assert(!item.shop||!pack.modules['world.economy'],'Buy this item at its shop');assert(from===to,'Item is not at this location');assert(!item.hidden||tx.state.modules['world.objects']?.discovered.includes(item.id),'Item has not been discovered');owner=pack.playerId;}
        else {assert(from===pack.playerId,'You do not own that item');if(args.itemAction==='place')owner=to;else{assert(cast.includes(args.itemTarget)&&tx.state.actors[args.itemTarget]?.location===to,'Recipient is not in this scene');owner=args.itemTarget;}}
        tx.set(['modules','items.inventory','owners',item.id],owner);tx.emit('items.transferred',{item:item.id,from,to:owner,text:`${args.itemAction==='take'?'You take':args.itemAction==='give'?'You give':'You place'} ${item.name}.`},[pack.playerId,...cast]);
      }
      // A solo activity is the period's complete action: with no conversation partner to keep the scene
      // open, close it in this same deterministic turn while preserving its sceneStarted event for narration.
      if(args.activity!=='rest'&&args.activity!=='continue'&&!present.length&&tx.state.scene){releaseScene(tx);tx.emit('core.sceneEnded',{reason:'natural',characters:[],text:'The activity comes to a close.'},[pack.playerId]);}
    }
  };
  const handler=base[command.type]||mods.map(m=>m.commands?.[command.type]).find(Boolean);assert(handler,`Unsupported command: ${command.type}`); handler(tx,command.args);
  const authored=command.type==='core.scene'&&command.args.activityId?(pack.activities||[]).find(a=>a.id===command.args.activityId):null;
  const invitation=command.type==='world.acceptHangout'?pack.daypart.hangouts.find(h=>h.char===command.args.char):null;
  const phoneOffer=command.type==='social.acceptPhoneOffer'?(pack.phoneMessages||[]).find(m=>m.id===command.args.message)?.offer:null;
  const offeredScene=command.type==='story.startOfferedScene'?(pack.scriptedScenes||[]).find(scene=>scene.id===command.args.scene):null;
  const invitationLocation=invitation&&pack.locations.find(l=>l.name===invitation.where||l.id===invitation.where)?.id;
  const invited=command.type==='social.invite'&&state.scene?.id===command.id;
  const route=command.type==='core.scene'||invitation||phoneOffer||invited?routeBetween(pack,world.actors[pack.playerId].location,invitationLocation||phoneOffer?.location||(invited?command.args.to:null)||command.args.location||world.actors[pack.playerId].location,world.flags):null;
  const travelCost=route?route.length-1:0;
  const cost=meetingBlocked?0:offeredScene?(offeredScene.timeCost??pack.daypart?.interval??1):command.type==='core.waitUntil'?waitTicks:command.type==='world.nextDaypart'?pack.daypart.interval-state.tick%pack.daypart.interval:invitation||phoneOffer||invited?route?travelCost+1:0:command.type==='social.invite'?0:continuous&&['story.choose','story.respond','story.leave','social.withdrawConsent'].includes(command.type)?0:command.type==='core.scene'&&!route?0:authored?travelCost+authored.duration:command.type==='core.scene'&&command.args.activity==='rest'?(continuous?Math.max(travelCost,(pack.daypart?.interval||4)-state.tick%(pack.daypart?.interval||4)):travelCost+(pack.daypart?.interval||4)-state.tick%(pack.daypart?.interval||4)):command.type==='core.scene'?travelCost+(command.args.activity==='continue'?0:1):pack.durations?.[command.type]??(FREE_ACTIONS.has(command.type)?0:1);assert(Number.isInteger(cost)&&cost>=0&&cost<=100,'Invalid action duration');
  const kept=continuous&&state.scene&&world.scene?.id===state.scene.id,opened=continuous&&state.scene&&!kept,soloClosed=continuous&&command.type==='core.scene'&&emitted.some(e=>e.type==='core.sceneStarted'&&!(e.payload.characters||[]).length)&&emitted.some(e=>e.type==='core.sceneEnded');
  const advance=n=>{if(n>0){const before=state.tick,to=state.run?Math.min(before+n,state.run.endTick):before+n;if(to===before)return;tx.set(['tick'],to);tx.emit('core.timeAdvanced',{from:before,to:state.tick,sceneCast:state.scene?.characters||[]},[]);}};
  let reacted=0;const react=()=>{for(;reacted<emitted.length;reacted++){const e=emitted[reacted];if(e.type==='core.patch')continue;for(const m of mods)m.react?.(tx,e);}};
  const closes=continuous&&world.scene&&!state.scene&&!['world.nextDaypart','core.waitUntil'].includes(command.type)&&!(command.type==='core.scene'&&command.args.activity==='rest'),boundary=(Math.floor(world.tick/interval)+1)*interval;
  advance(kept&&!['core.wait','core.waitUntil'].includes(command.type)?0:opened?travelCost:soloClosed?Math.max(travelCost,boundary-state.tick):closes?Math.max(cost,boundary-state.tick):cost);react();
  if(continuous&&world.scene)sceneLifecycle(tx,world,emitted,kept&&!['core.wait','core.waitUntil'].includes(command.type));
  // The period is spent once, when its scene closes: whoever ended it, the clock moves to the next morning, afternoon or evening.
  if(continuous&&world.scene&&!state.scene&&!['world.nextDaypart','core.waitUntil'].includes(command.type)&&!(command.type==='core.scene'&&command.args.activity==='rest')){advance(boundary-state.tick);react();}
  tx.set(['revision'],world.revision+1);
  const turn={id:command.id,command:clone(command),events:emitted,narrative:null,status:'pending'};
  state.events.push(...emitted);state.turns[command.id]=turn;return {state,turn,duplicate:false};
}
// Each place lists what can be done there and what it pays, so raising a stat is a visible choice, not a guessed phrase.
export const effectSummary=(pack,effects=[])=>effects.flatMap(e=>e.type==='stat'?[`${e.delta>0?'+':''}${e.delta} ${pack.statDefinitions?.find(d=>d.id===e.stat)?.name||e.stat}`]:e.type==='trust'?[`${pack.actors.find(a=>a.id===e.character)?.name||e.character} trust ${e.delta>0?'+':''}${e.delta}`]:e.type==='money'?[`${e.delta<0?'-':'+'}${Math.abs(e.delta)}`]:e.type==='item'?[pack.items?.find(i=>i.id===e.id)?.name||e.id]:[]).join(' · ');
// A training activity's daily uses: repeated practice on the same day would otherwise be free stat income.
const activityDayCount=(world,pack,id)=>{const uses=(world.activityDayUses||{})[id];return uses&&uses.day===calendarFor(world.tick,pack).day?uses.count:0;};
function activityActions(world,pack,loc){return (pack.activities||[]).filter(a=>a.location===loc.id&&(!a.requiresFlag||world.flags[a.requiresFlag])&&!(a.once&&(world.activityUses||{})[a.id])&&(!a.perDay||activityDayCount(world,pack,a.id)<a.perDay)).map(a=>({label:a.name,type:'core.scene',args:{text:a.name,location:a.location,characters:a.character?[a.character]:[],activity:'other',activityId:a.id,itemAction:'',itemId:'',itemTarget:''},storylet:{title:a.name,who:a.character?[pack.actors.find(c=>c.id===a.character)?.name||a.character]:[],where:loc.name,timeCost:a.duration,hint:effectSummary(pack,a.effects)||a.description||''}}));}
export function actions(world,pack,registry){
  if(world.modules['story.endings']?.selected)return [];
  if(world.modules['story.scenes']?.pending)return resolveModules(pack,registry).flatMap(m=>m.actions?.(world,pack)||[]).filter(a=>['story.choose','story.leave','social.withdrawConsent'].includes(a.type)).map((a,i)=>{try{execute(world,{...a,id:`preview-choice-${world.revision}-${i}`,actorId:pack.playerId,expectedRevision:world.revision},pack,registry);return {...a,enabled:true};}catch(e){return {...a,enabled:false,reason:e.message};}});
  const loc=pack.locations.find(l=>l.id===world.actors[pack.playerId].location);
  const extra=resolveModules(pack,registry).flatMap(m=>m.actions?.(world,pack)||[]),look=extra.filter(a=>a.type==='core.inspect'),list=[...(look.length?look:[{label:'Look around',type:'core.inspect',args:{}}]),{label:'Wait',type:'core.wait',args:{}},...(world.scene?[{label:world.scene.characters.length?'End conversation':'Finish activity',type:'core.endScene',args:{}}]:[]),...loc.exits.map(e=>({label:`Go to ${pack.locations.find(l=>l.id===e.to).name}`,type:'core.move',args:{to:e.to}})),...activityActions(world,pack,loc),...extra.filter(a=>a.type!=='core.inspect')];
  return list.map((a,i)=>{try{execute(world,{...a,id:`preview-${world.revision}-${i}`,actorId:pack.playerId,expectedRevision:world.revision},pack,registry);return {...a,enabled:true};}catch(e){return {...a,enabled:false,reason:e.message};}});
}
// Bookkeeping that takes no story time: looking, dressing, reading the phone.
export const FREE_ACTIONS=new Set(['core.inspect','items.equip','items.unequip','social.readFeed','social.readThread','social.reactToPost','social.setRumorStance']);
export function fallback(turn){return turn.events.filter(e=>e.visibility==='public'||e.visibility.includes(turn.command.actorId)).map(e=>e.payload.text).filter(Boolean).join('\n')||'Action completed.';}
