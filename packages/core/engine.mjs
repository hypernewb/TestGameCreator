import {scheduleDestination} from '../../public/schedule-resolver.mjs';
import {validateKnowledge} from '../../public/creator-knowledge-contract.mjs';
import {calendarFor,PERIODS} from '../../public/calendar.mjs';
import {timeCost} from '../../public/calendar.mjs';
import {validateWeeklyRoutines} from '../../public/weekly-routines.mjs';
import {validateCharacterSheets} from './character-sheet.mjs';
import {spokenLine} from '../../vendor/venus/sceneText.mjs';
import {changeMoney} from '../modules/economy.mjs';
import {changeStat} from '../modules/stats.mjs';
import {changeTrust} from '../modules/romance-stats.mjs';
import {validateConditions} from '../modules/conditions.mjs';
import {heldBy,transfer} from '../modules/inventory.mjs';
import {closedReason,holidayOf} from '../modules/calendar.mjs';
import {validateProjectUi} from '../../public/ui-selection.mjs';
export const CORE_API = '0.1.0';
export const clone = x => structuredClone(x);
export const plannerMode = pack => pack.gameProject?.timeMode==='planner';
export const committedChange=(before,after)=>[...new Set([...Object.keys(before),...Object.keys(after)])].some(k=>!['revision','rng','events','turns','refusalHistory'].includes(k)&&JSON.stringify(before[k])!==JSON.stringify(after[k]));
export function assert(ok, message) { if (!ok) throw new Error(message); }
const untilTicks=(tick,part,n)=>{const slot=Math.floor(tick/n),d=((PERIODS.indexOf(part)-slot%3+3)%3)||3;return (slot+d)*n-tick;};
export const refusalCode=e=>e?.code||e?.refusal?.code||(/consent|intima|boundary/i.test(e?.message||'')?'boundary':/route|location|destination/i.test(e?.message||'')?'place':/revision/i.test(e?.message||'')?'changed':/insufficient|debt limit/i.test(e?.message||'')?'item':'unavailable');
const refusalWords={unavailable:'That cannot happen just now. There is still something else to try.',boundary:'That goes beyond what has been agreed. Give the moment some space.',place:'That way is out of reach just now. Take in your surroundings before choosing another way.',changed:'The moment has moved on. Take a fresh look before deciding.',choice:'This moment needs a choice before it can continue.',item:'That purchase cannot happen here just now.',activity:'That will have to wait. Try something else for now.',target:'Take a moment to see who is here before choosing whom to approach.',repeat:'There is nothing more to add on that subject. Let another topic have its turn.',model_reply:'The moment falls quiet. Take a breath and choose what to do next.'};
export function refusalFor(world,pack,registry,code='unavailable',retry=1){const pool=[{label:'Look around',type:'core.inspect',args:{}},{label:'Wait',type:'core.wait',args:{}}],alternatives=pool.filter((a,i)=>{try{execute(world,{...a,id:'refusal-preview-'+world.revision+'-'+i,actorId:pack.playerId,expectedRevision:world.revision},pack,registry);return true;}catch{return false;}}).map(a=>({label:a.label,input:a.label}));return {code,reason:retry>=3?'The moment turns toward something else. Take in your surroundings and choose a new direction.':(code==='unchanged'?'Nothing changes from that attempt. The moment leaves room to try another approach.':refusalWords[code])||'That does not feel possible right now. Give the moment some space and try another direction.',alternatives,retry,redirect:retry>=3};}
function recordRefusal(tx,registry,code,target=''){const s=tx.state,scene=s.scene?.id||s.modules['story.scenes']?.pending||s.actors[tx.pack.playerId].location+':outside',prior=s.refusalHistory?.scene===scene?s.refusalHistory.counts:{},key=JSON.stringify([code,target]),retry=(prior[key]||0)+1;tx.set(['refusalHistory'],{scene,counts:{...prior,[key]:retry}});return refusalFor(s,tx.pack,registry,code,retry);}
export function safeKey(s) { return typeof s === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(s) && !['__proto__','constructor','prototype'].includes(s); }
export function routeBetween(pack,from,to,flags={}) { const queue=[[from]],seen=new Set([from]);while(queue.length){const path=queue.shift(),at=path.at(-1);if(at===to)return path;for(const e of pack.locations.find(l=>l.id===at)?.exits||[])if(!seen.has(e.to)&&(!e.flag||flags[e.flag])){seen.add(e.to);queue.push([...path,e.to]);}}return null; }
export {scheduleDestination} from '../../public/schedule-resolver.mjs';
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
// A continuous scene ends only from a real ending: the model writes a farewell, the player walks away, an NPC leaves
// when a boundary is crossed (a declined advance, a sharp loss of trust), or the run reaches its last tick. The
// sceneTurns cap (default 12) is a safety net, not a schedule: only typed conversation turns count toward it.
export function sceneLifecycle(tx,world,emitted,exchange,continuous=true,deferCap=false){
 const s=tx.state,pack=tx.pack,scene=s.scene;if(!scene||scene.id!==world.scene.id||s.modules['story.scenes']?.pending||s.modules['social.firsts']?.active||!scene.characters.length)return;
 const closing=s.run&&s.tick>=s.run.endTick;if(!continuous&&!closing)return;
 const cast=scene.characters,hurt=continuous&&emitted.find(e=>cast.includes(e.payload?.actor??e.payload?.character)&&(e.type==='social.consentDeclined'||e.type==='social.relationshipChanged'&&e.payload.toward===pack.playerId&&Number.isInteger(e.payload.old)&&e.payload.value-e.payload.old<=-5));
 const count=(scene.exchanges||0)+(exchange?1:0),cap=pack.gameProject?.sceneTurns??12;
 if(!hurt&&!closing&&(deferCap||count<cap)){if(exchange)tx.set(['scene','exchanges'],count);return;}
 const who=hurt?(hurt.payload.actor??hurt.payload.character):cast[0],name=s.actors[who].name,reason=hurt?'boundary':'schedule';
 releaseScene(tx);tx.emit('core.sceneEnded',{reason,character:who,characters:cast,text:hurt?`${name} has had enough for now and leaves.`:closing?`Time is up. ${name} says goodbye.`:`${name} has somewhere to be and says goodbye.`},[pack.playerId,...cast]);
}
export function travel(tx,pack,from,to,player){const route=routeBetween(pack,from,to,tx.state.flags);if(!route){tx.emit('core.travelBlocked',{from,to,text:`You cannot reach ${pack.locations.find(l=>l.id===to).name} from here.`},[player]);return null;}for(let i=1;i<route.length;i++){tx.set(['actors',player,'location'],route[i]);tx.emit('core.moved',{actor:player,from:route[i-1],to:route[i],text:`You go to ${pack.locations.find(l=>l.id===route[i]).name}.`},[player]);}return route;}
export function meetingArrival(tx,world,pack,id,to,arrival){if(tx.state.actors[id].location===to)return true;const location=scheduledLocation(world,pack,id,arrival);if(location!==to){const at=nextArrivalTick(pack,id,to,arrival);const when=at===null?'':` They are scheduled back at ${pack.locations.find(l=>l.id===to).name} from ${calendarFor(at,pack).weekday} ${calendarFor(at,pack).daypart}.`;tx.emit('world.meetingUnavailable',{character:id,location:to,nextArrival:at,text:`${tx.state.actors[id].name} is not at ${pack.locations.find(l=>l.id===to).name} when you arrive.${when}`},[pack.playerId]);return false;}tx.set(['actors',id,'location'],to);tx.emit('world.actorArrived',{actor:id,location:to,text:`${tx.state.actors[id].name} arrives at ${pack.locations.find(l=>l.id===to).name}.`},[pack.playerId,id]);return true;}
// Index loop, not for…of (hot: every execute hashes the pack). Skipping a pair's low surrogate keeps the old code-point hash, so saves still match.
const hash=s=>{ let h=2166136261; for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h=Math.imul(h^c,16777619);if(c>=0xD800&&c<0xDC00&&(s.charCodeAt(i+1)&0xFC00)===0xDC00)i++;} return (h>>>0).toString(16); };
export function digest(x) { return hash(JSON.stringify(x)); }
// Only the fields execute()/createWorld() actually depend on: state-affecting rules, IDs, schemas. Prose and
// presentation (names, descriptions, portraits, phrases, prompts) are deliberately left out so editing them
// never invalidates a save.
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
export function mechanicsShape(pack) {
 return {
  schemaVersion:pack.schemaVersion,id:pack.id,version:pack.version,modules:pack.modules,playerId:pack.playerId,...pick(pack.gameProject||{},['timeMode']),...pick(pack,['socialPacing','sceneFeedback','lustBaseline']),
  ...(pack.dailyNeeds?{dailyNeeds:pack.dailyNeeds,dailyNeedTraits:pack.actors.filter(a=>a.id!==pack.playerId).map(a=>({id:a.id,traits:pack.characterSheets?.find(x=>x.actorId===a.id)?.personality?.traits||a.traits||[]}))}:{}),
  ...(pack.wantSettings||pack.characterSheets?.some(s=>s.wants?.length)?{wantSettings:pack.wantSettings||null,wants:pack.characterSheets.filter(s=>s.wants?.length).map(s=>({actorId:s.actorId,wants:s.wants}))}:{}),
  ...(pack.jealousyProfiles?{jealousySettings:pack.jealousySettings||null,jealousyProfiles:pack.jealousyProfiles,jealousyTraits:pack.actors.filter(a=>a.id!==pack.playerId).map(a=>({id:a.id,traits:pack.characterSheets?.find(x=>x.actorId===a.id)?.personality?.traits||a.traits||[]}))}:{}),
  locations:pack.locations.map(l=>({id:l.id,exits:(l.exits||[]).map(e=>pick(e,['to','flag']))})),
  actors:pack.actors.map(a=>({id:a.id,location:a.location})),
  items:(pack.items||[]).map(i=>pick(i,['id','shop','hidden','stack','stock','restock','use'])),
  activities:(pack.activities||[]).map(a=>pick(a,['id','location','duration','once','perDay','requiresFlag','requiresItem','character','minTrust','minRank','effects','inputBudget'])),
  schedules:pack.schedules||[],daypart:pack.daypart||null,run:pack.run||null,...(pack.gameProject?.sceneBudget?{sceneBudget:pack.gameProject.sceneBudget}:{}),
  scriptedScenes:(pack.scriptedScenes||[]).map(scene=>({id:scene.id,offer:scene.offer,timeCost:scene.timeCost,repeatable:scene.repeatable,priority:scene.priority,tension:scene.tension,trigger:scene.trigger,when:scene.when,allowInput:scene.allowInput,pages:(scene.pages||[]).map(page=>pick(page,['speaker','stage','background'])),choices:(scene.choices||[]).map(choice=>pick(choice,['id','next','waitFor','when','check','effects'])),beats:(scene.beats||[]).map(beat=>({id:beat.id,allowInput:beat.allowInput,pages:(beat.pages||[]).map(page=>pick(page,['speaker','stage','background'])),choices:(beat.choices||[]).map(choice=>pick(choice,['id','next','waitFor','when','check','effects']))}))})),
  endings:(pack.endings||[]).map(ending=>pick(ending,['id','character','priority','requires'])),storyVariables:(pack.storyVariables||[]).map(variable=>pick(variable,['id','initial'])),
  ...(pack.directorProfile?{directorProfile:pack.directorProfile}:{}),
  ...(pack.moments?{moments:pack.moments.map(m=>pick(m,['id','kind','location','on','character','when','effects','maxUses','cooldown','stay','weight']))}:{}),...(pack.momentsProfile?{momentsProfile:pack.momentsProfile}:{}),
  initialRelationships:pack.initialRelationships||[],
  ...(pack.factReveals?.length?{factReveals:pack.factReveals,factKnowledge:(pack.facts||[]).map(f=>pick(f,['id','knownBy','supersedes']))}:{}),
  ...(pack.recipes?{recipes:pack.recipes}:{}),...(pack.calendar?{calendar:pack.calendar}:{}),
  ...pick(pack,['relationshipStageSettings','anniversarySettings','dayRecap']),
  startOptions:(pack.startOptions||[]).map(s=>pick(s,['id','playerLocation','tick'])),
 };
}
// Memoised per pack; the cached JSON is compared in full, so a pack edited in place still re-hashes.
const digests=new WeakMap();
export function mechanicsDigest(pack) { const s=JSON.stringify(mechanicsShape(pack)),hit=digests.get(pack); if(hit?.s===s)return hit.h; const h=hash(s); digests.set(pack,{s,h}); return h; }
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
 for(const key of ['schedules','daypart','initialRelationships','startOptions','directorProfile','recipes','calendar','timeMode'])if(JSON.stringify(a[key])!==JSON.stringify(b[key]))changes.push(`${key}: changed`);
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
  validateWeeklyRoutines(pack);
  validateProjectUi(pack.gameProject?.ui);
  assert(pack.gameProject?.timeMode===undefined||['clock','planner'].includes(pack.gameProject.timeMode),'gameProject.timeMode: expected clock or planner');
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
  validateCharacterSheets(pack);
  const locationNames=new Map();for(const location of pack.locations){if(location.aliases!==undefined)assert(Array.isArray(location.aliases)&&location.aliases.length<=20&&location.aliases.every(alias=>typeof alias==='string'&&alias.trim()&&alias.length<=80),'location.aliases: expected up to 20 short names');for(const name of [location.id,location.name,...location.aliases||[]]){const key=name.trim().toLocaleLowerCase();assert(!locationNames.has(key)||locationNames.get(key)===location.id,`location name or alias is ambiguous: ${name}`);locationNames.set(key,location.id);}}
  assert(actors.has(pack.playerId),'playerId: missing actor');
  const safeAsset=x=>/^assets\/[a-zA-Z0-9/_-]+\.(svg|png|jpg|webp)$/.test(x)||/^scenario-media\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(x);
  for(const a of pack.actors){assert(loc.has(a.location),`actors.${a.id}.location: unknown`);if(a.pronouns!==undefined)assert(typeof a.pronouns==='string'&&a.pronouns.trim()&&a.pronouns.length<=40,`actors.${a.id}.pronouns: expected a short string such as she/her`);if(a.conversationStarters!==undefined)assert(Array.isArray(a.conversationStarters)&&a.conversationStarters.length<=8&&a.conversationStarters.every(text=>typeof text==='string'&&text.trim()&&text.length<=240),`actors.${a.id}.conversationStarters: expected up to 8 short suggestions`);if(a.portrait)assert(safeAsset(a.portrait),`actors.${a.id}.portrait: unsafe asset path`);if(a.poses){assert(Array.isArray(a.poses),'actor.poses: expected array');const seenPoses=new Set();for(const pose of a.poses){assert(safeKey(pose.id)&&!seenPoses.has(pose.id),'actor.pose.id: invalid or duplicate');seenPoses.add(pose.id);assert(safeAsset(pose.image),'actor.pose.image: unsafe asset path');}}}
  for(const l of pack.locations){ assert(Array.isArray(l.exits),`locations.${l.id}.exits: required`); for(const e of l.exits){assert(loc.has(e.to),`locations.${l.id}.exits: unknown ${e.to}`);if(e.flag)assert(safeKey(e.flag)&&knownStoryVariable(e.flag),'exit.flag: invalid or undefined');} if(l.background)assert(safeAsset(l.background),'background: unsafe asset path'); }
  validateKnowledge(pack);for(const [i,f] of (pack.facts||[]).entries()){assert(safeKey(f.id)&&typeof f.text==='string',`facts[${i}]: invalid`);assert(f.knownBy==='public'||Array.isArray(f.knownBy)&&f.knownBy.every(id=>actors.has(id)),`facts[${i}].knownBy: invalid`);}
  for(const [i,e] of (pack.lorebook||[]).entries()){assert(safeKey(e.id)&&typeof e.text==='string',`lorebook[${i}]: invalid`);assert(['world','location','character'].includes(e.scope),`lorebook[${i}].scope: invalid`);assert(e.knownBy==='public'||Array.isArray(e.knownBy)&&e.knownBy.every(id=>actors.has(id)),`lorebook[${i}].knownBy: invalid`);if(e.scope==='location')assert(loc.has(e.location),`lorebook[${i}].location: unknown`);if(e.scope==='character')assert(actors.has(e.character),`lorebook[${i}].character: unknown`);if(e.when!==undefined)validateConditions(e.when,pack,`lorebook[${i}].when`);for(const k of ['sticky','cooldown','delay'])if(e[k]!==undefined)assert(Number.isInteger(e[k])&&e[k]>=0&&e[k]<=10000,`lorebook[${i}].${k}: expected whole ticks (0–10000)`);}
  assert(Array.isArray(pack.activities||[]),'activities: expected array');const activityIds=new Set();for(const [i,a] of (pack.activities||[]).entries()){
    assert(safeKey(a.id)&&!activityIds.has(a.id),`activities[${i}].id: invalid or duplicate`);activityIds.add(a.id);
    assert(typeof a.name==='string'&&a.name.trim()&&a.name.length<=120,`activities[${i}].name: required`);
    assert(typeof a.description==='string'&&a.description.length<=1000,`activities[${i}].description: invalid`);
    assert(loc.has(a.location),`activities[${i}].location: unknown`);
    assert(Number.isInteger(a.duration)&&a.duration>=0&&a.duration<=100,`activities[${i}].duration: expected 0–100`);
    assert(a.once===undefined||typeof a.once==='boolean',`activities[${i}].once: invalid`);
    assert(a.inputBudget===undefined||Number.isInteger(a.inputBudget)&&a.inputBudget>=1&&a.inputBudget<=10,`activities[${i}].inputBudget: expected 1–10`);
    assert(a.perDay===undefined||Number.isInteger(a.perDay)&&a.perDay>=1&&a.perDay<=10,`activities[${i}].perDay: expected 1–10`);
    assert(Array.isArray(a.phrases||[])&&(a.phrases||[]).every(s=>typeof s==='string'&&s.length<=120),`activities[${i}].phrases: invalid`);
    assert(!a.requiresFlag||safeKey(a.requiresFlag)&&knownStoryVariable(a.requiresFlag),`activities[${i}].requiresFlag: invalid or undefined`);
    assert(!a.requiresItem||pack.modules['items.inventory']&&(pack.items||[]).some(x=>x.id===a.requiresItem),`activities[${i}].requiresItem: invalid`);
    assert(!a.character||actors.has(a.character)&&a.character!==pack.playerId,`activities[${i}].character: invalid`);
    assert(a.minTrust===undefined||pack.modules['social.relationships']&&a.character&&Number.isInteger(a.minTrust)&&a.minTrust>=0&&a.minTrust<=100,`activities[${i}].minTrust: invalid`);
    assert(a.minRank===undefined||pack.modules['social.romance-tempo']&&a.character&&(pack.romanceTempoProfiles||[]).find(p=>p.character===a.character)?.ranks?.some((r,j)=>j>0&&r.id===a.minRank),`activities[${i}].minRank: invalid`);
    for(const effect of a.effects||[]){assert(['flag','trust','item','money','stat'].includes(effect.type),`activities[${i}].effects: invalid type`);if(effect.type==='stat')assert(pack.modules['character.stats']&&(pack.statDefinitions||[]).some(d=>d.id===effect.stat)&&Number.isInteger(effect.delta)&&effect.delta!==0&&Math.abs(effect.delta)<=3,`activities[${i}].stat: training moves a player stat by ±1–3`);if(effect.type==='flag')assert(safeKey(effect.id)&&knownStoryVariable(effect.id)&&typeof effect.value==='boolean',`activities[${i}].flag: invalid or undefined`);if(effect.type==='trust')assert(pack.modules['social.relationships']&&actors.has(effect.character)&&Number.isInteger(effect.delta)&&Math.abs(effect.delta)<=20,`activities[${i}].trust: invalid`);if(effect.type==='item')assert(pack.modules['items.inventory']&&(pack.items||[]).some(x=>x.id===effect.id)&&effect.to===pack.playerId,`activities[${i}].item: invalid`);if(effect.type==='money')assert(pack.modules['world.economy']&&Number.isInteger(effect.delta)&&Math.abs(effect.delta)<=100000,`activities[${i}].money: invalid`);}
  }
  if(pack.gameProject){const g=pack.gameProject;assert(typeof g.premise==='string'&&typeof g.setting==='string','gameProject.premise and setting: required');assert(['authored','continuous'].includes(g.conversationStyle||'authored'),'gameProject.conversationStyle: expected authored or continuous');assert(['present','always'].includes(g.characterLocationVisibility||'present'),'gameProject.characterLocationVisibility: expected present or always');assert(['hidden','always'].includes(g.characterScheduleVisibility||'hidden'),'gameProject.characterScheduleVisibility: expected hidden or always');assert(g.sceneBudget===undefined||Number.isInteger(g.sceneBudget)&&g.sceneBudget>=1&&g.sceneBudget<=10,'gameProject.sceneBudget: expected 1–10');assert(g.ai&&typeof g.ai==='object','gameProject.ai: required');for(const key of ['intent','scene','daypart'])assert(typeof g.ai[key]==='string',`gameProject.ai.${key}: required`);if(g.calendar?.startWeekday)assert(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].includes(g.calendar.startWeekday),'gameProject.calendar.startWeekday: invalid');if(g.calendar?.startDate){const date=g.calendar.startDate,parsed=new Date(`${date}T00:00:00Z`);assert(/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===date,'gameProject.calendar.startDate: expected YYYY-MM-DD');}}
  if(pack.startOptions){assert(Array.isArray(pack.startOptions)&&pack.startOptions.length>0,'startOptions: non-empty array required');const starts=new Set();for(const [i,s] of pack.startOptions.entries()){assert(safeKey(s.id)&&!starts.has(s.id),`startOptions[${i}].id: invalid or duplicate`);starts.add(s.id);assert(typeof s.title==='string'&&loc.has(s.playerLocation),`startOptions[${i}]: title and valid playerLocation required`);assert(Number.isInteger(s.tick??0)&&(s.tick??0)>=0,'startOptions.tick: expected non-negative integer');}}
  assert(pack.relationships===undefined,'relationships is not supported; use initialRelationships with {character, trust} entries');
  if(pack.initialRelationships){assert(Array.isArray(pack.initialRelationships),'initialRelationships: expected array');for(const r of pack.initialRelationships){assert(actors.has(r.character)&&r.character!==pack.playerId,'initialRelationships.character: unknown NPC');assert(Number.isInteger(r.trust)&&r.trust>=0&&r.trust<=100,'initialRelationships.trust: expected 0–100');}}
  if((pack.initialRelationships||[]).length)assert(pack.modules['social.relationships'],'initialRelationships requires social.relationships');
  if(pack.run){assert(Number.isInteger(pack.run.days)&&pack.run.days>=1&&pack.run.days<=365,'run.days: expected 1–365');assert(pack.modules['story.endings'],'run requires story.endings');assert(typeof pack.run.defaultEnding==='string'&&(pack.endings||[]).some(ending=>ending.id===pack.run.defaultEnding),'run.defaultEnding: choose an existing ending');}
  const mods=resolveModules(pack,registry), commands=new Set(['core.refuse','core.move','core.inspect','core.wait','core.scene','core.endScene']);
  for(const m of mods){m.validate?.(pack);for(const name of Object.keys(m.commands||{})){assert(!commands.has(name),`Command conflict: ${name}`);commands.add(name);}}
  return mods;
}
export function createWorld(pack,registry,id='campaign',seed=42,startId,options={}) {
  const mods=validatePack(pack,registry); assert(safeKey(id),'Invalid campaign ID');
  const sceneWriter=options.sceneWriter??'framework';assert(['framework','venus'].includes(sceneWriter),'Unknown scene writer');
  const start=(pack.startOptions||[]).find(x=>x.id===(startId||pack.startOptions?.[0]?.id));assert(!startId||start,'Unknown start option');
  const s={schemaVersion:1,campaignId:id,packId:pack.id,packVersion:pack.version,packDigest:mechanicsDigest(pack),moduleVersions:clone(pack.modules),startId:start?.id||null,sceneWriter,revision:0,tick:start?.tick??0,initialSeed:seed>>>0,rng:seed>>>0,actors:Object.fromEntries(pack.actors.map(a=>[a.id,{name:a.name,location:a.id===pack.playerId&&start?start.playerLocation:a.location}])),flags:Object.fromEntries((pack.storyVariables||[]).map(variable=>[variable.id,variable.initial])),modules:{},scene:null,activityUses:{},events:[],turns:{}};
  if(pack.run){const interval=pack.daypart?.interval||4;s.run={startTick:s.tick,endTick:s.tick+pack.run.days*interval*3,days:pack.run.days};}
  for(const m of mods)s.modules[m.id]=m.init?.(pack,{seed:s.initialSeed,tick:s.tick})||{};
  if(s.modules['social.relationships'])for(const r of pack.initialRelationships||[])s.modules['social.relationships'].edges[`${r.character}--${pack.playerId}`]=r.trust;
  return s;
}
function put(state,path,value) {assert(Array.isArray(path)&&path.length>0&&path.every(x=>typeof x==='number'||safeKey(x)),'Invalid patch path');let p=state;for(const k of path.slice(0,-1)){assert(p[k]!==undefined,'Missing patch parent');p=p[k];}p[path.at(-1)]=clone(value);}
export function replay(initial,events) {const s=clone(initial);for(const e of events)if(e.type==='core.patch')put(s,e.payload.path,e.payload.value);return s;}
// Generation failed after commit. Record the refund as an engine patch so event replay agrees with the save.
// Retrying prose does not refund a second time. Import reconstructs this patch from the recorded settlement.
export function refundSceneExchange(state,turn,sceneId){
 assert(EXCHANGE_COMMANDS.has(turn.command.type),'Only a conversation turn can refund an exchange');
 assert(state.scene?.id===sceneId,'Exchange refund refers to an inactive scene');
 const spent=turn.events.find(e=>e.type==='core.patch'&&JSON.stringify(e.payload.path)==='["scene","exchanges"]');
 if(!spent)return;
 const id=`${turn.id}.refund`;if(turn.events.some(e=>e.id===id))return;
 const value=Math.max(0,(state.scene.exchanges||0)-1),event={id,type:'core.patch',payload:{path:['scene','exchanges'],value},tick:state.tick,visibility:[]};
 state.scene.exchanges=value;turn.events.push(event);state.events.push(event);
}
export function execute(world,command,pack,registry,packChecked=false) {
  if(world.turns[command.id])return {state:world,turn:world.turns[command.id],duplicate:true};
  assert(packChecked||world.packDigest===mechanicsDigest(pack),'Pack changed: migration required');
  assert(safeKey(command.id),'Invalid turn ID');assert(command.expectedRevision===world.revision,'Stale revision; refresh and try again');
  assert(command.actorId===pack.playerId,'Only the player can submit commands');
  assert(command.args&&typeof command.args==='object'&&!Array.isArray(command.args),'args must be an object');assert(command.components===undefined||Array.isArray(command.components)&&command.components.length<=3&&command.components.every(c=>c&&safeKey(c.type)&&c.args&&typeof c.args==='object'&&!Array.isArray(c.args)),'Invalid turn components');
  assert(!world.modules['story.endings']?.selected||['core.refuse','core.inspect'].includes(command.type),'The story has ended. Start a new campaign to play again.');
  // A director incident is a model-played moment, so its conversation can end like any other (the scenes module then dismisses it).
  if(world.modules['story.scenes']?.pending)assert(['story.choose','story.respond','story.leave','social.withdrawConsent'].includes(command.type)||FREE_ACTIONS.has(command.type)||command.type==='core.endScene'&&pack.scriptedScenes?.find(x=>x.id===world.modules['story.scenes'].pending)?.template?.delivery==='incident','Choose an option, reply in your own words, withdraw consent, or leave the active scene first');
  const mods=resolveModules(pack,registry), state=clone(world), emitted=[];let steps=0,waitTicks=0,meetingBlocked=false;
  // Continuous style (Venus University): an activity opens one scene, talk inside it is free, and the period is spent when the scene ends.
  const planner=plannerMode(pack),continuous=planner||pack.gameProject?.conversationStyle==='continuous',interval=pack.daypart?.interval||4;
  if(planner&&world.planner)assert(command.type!=='core.scene'||!command.args.activityId||['continue','rest'].includes(command.args.activity),'Finish the current planner activity first');
  const tx={state,pack,world,commandId:command.id,
    emit(type,payload,visibility='public'){assert(++steps<=200,'Event reaction limit exceeded');const event={id:`${command.id}.${emitted.length}`,type,payload:clone(payload),tick:state.tick,visibility:clone(visibility)};emitted.push(event);return event;},
    set(path,value){put(state,path,value);this.emit('core.patch',{path,value},[]);},
    random(){const n=(Math.imul(state.rng,1664525)+1013904223)>>>0;this.set(['rng'],n);return n/4294967296;}
  };
  if(command.type==='core.refuse'){const refusal=recordRefusal(tx,registry,typeof command.args.code==='string'?command.args.code:'unavailable',command.args.target);tx.emit('core.refused',{refusal,text:refusal.reason},[pack.playerId]);tx.set(['revision'],world.revision+1);const turn={id:command.id,command:clone(command),events:emitted,narrative:null,status:'pending',refusal};state.events.push(...emitted);state.turns[command.id]=turn;return {state,turn,duplicate:false};}
  const base={
    'core.refuse'(tx,args){const refusal=recordRefusal(tx,registry,typeof args.code==='string'?args.code:'unavailable',args.target);tx.emit('core.refused',{refusal,text:refusal.reason},[pack.playerId]);},
    'core.move'(tx,args){const from=tx.state.actors[pack.playerId].location;const exit=pack.locations.find(l=>l.id===from).exits.find(e=>e.to===args.to);assert(exit,'No route to that location');assert(!exit.flag||tx.state.flags[exit.flag],exit.reason||'This route is locked');releaseScene(tx);tx.set(['actors',pack.playerId,'location'],args.to);tx.emit('core.moved',{actor:pack.playerId,from,to:args.to,text:`Travelled to ${pack.locations.find(l=>l.id===args.to).name}.`});},
    'core.inspect'(tx){const l=pack.locations.find(l=>l.id===state.actors[pack.playerId].location);tx.emit('core.inspected',{text:l.description||l.name,location:l.id},[pack.playerId]);},
    // until: skip ahead to the start of the next Morning, Afternoon or Evening (the hub's "Skip to Evening").
    'core.wait'(tx,args={}){if(args.until){assert(PERIODS.includes(args.until),'Unknown part of the day');assert(!tx.state.scene?.characters?.length,'Finish the conversation first');}tx.emit('core.waited',{...(args.until?{until:args.until}:{}),text:args.until?`You let the time slide by until ${args.until.toLowerCase()}.`:'You wait and watch the world move.'},[pack.playerId]);},
    'core.waitUntil'(tx,args){if(planner&&args.until)return base['core.wait'](tx,args);const to=args.location||state.actors[pack.playerId].location;assert(pack.actors.some(a=>a.id===args.actor&&a.id!==pack.playerId),'Unknown character to wait for');assert(pack.locations.some(l=>l.id===to),'Unknown wait location');assert(state.actors[pack.playerId].location===to,'Wait where you are');assert(state.actors[args.actor].location!==to,'That character is already here');const at=nextArrivalTick(pack,args.actor,to,world.tick);assert(at&&at>world.tick,'That character has no upcoming stop here soon');waitTicks=at-world.tick;const name=state.actors[args.actor].name;tx.emit('core.waited',{actor:args.actor,location:to,tick:at,text:`You wait until ${name} arrives here.`},[pack.playerId]);},
    'core.endScene'(tx,args){assert(tx.state.scene,'There is no active conversation to end');const reason=args.reason||'player';assert(['player','natural','safety','topic'].includes(reason),'Unknown scene end reason');if(reason==='safety')assert((tx.state.scene.exchanges||0)>=(pack.gameProject?.sceneTurns??12),'Scene safety cap has not been reached');const cast=tx.state.scene.characters,activity=tx.state.scene.activity;releaseScene(tx);tx.emit('core.sceneEnded',{reason,characters:cast,text:reason==='topic'?'You let the conversation rest for now.':reason==='safety'?'The conversation pauses as the period moves on.':reason==='natural'?'The conversation comes to a natural close.':['talk','meet','continue'].includes(activity)?'You end the conversation.':'You wrap up what you were doing.'},[pack.playerId,...cast]);},
    'core.scene'(tx,args){
      assert(typeof args.text==='string'&&args.text.trim().length>0&&args.text.length<=2000,'Scene request must contain 1–2000 characters');
      assert(['rest','meet','explore','work','talk','other','continue'].includes(args.activity),'Unknown scene activity');
      assert(args.location===null||pack.locations.some(l=>l.id===args.location),'Unknown scene location');
      assert(Array.isArray(args.characters)&&args.characters.length<=pack.actors.length,'Invalid scene cast');
      const cast=[...new Set(args.characters)];assert(cast.length===args.characters.length&&cast.every(id=>id!==pack.playerId&&pack.actors.some(a=>a.id===id)),'Unknown scene character');
      const activity=args.activityId?(pack.activities||[]).find(a=>a.id===args.activityId):null;
      assert(!args.activityId||activity,'Unknown authored activity');assert(args.result===undefined||activity&&['skip','ok','good','great'].includes(args.result),'Unknown activity result');
      if(activity){
        assert(args.activity!=='continue','Start an authored activity in a new scene');
        assert(args.location===activity.location,'Activity location does not match its authored place');
        assert(!activity.character||cast.includes(activity.character),'Required character is not in this scene');
        assert(!activity.requiresFlag||tx.state.flags[activity.requiresFlag],'Activity requires a world flag');
        assert(!activity.requiresItem||heldBy(tx.state,activity.requiresItem,pack.playerId)>0,'Activity requires an item');
        assert(activity.minTrust===undefined||(tx.state.modules['social.relationships']?.edges[`${activity.character}--${pack.playerId}`]||0)>=activity.minTrust,'Character is not ready for this activity');
        assert(!rankLock(tx.state,pack,activity),'Character is not ready for this activity');
        assert(!activity.once||!(tx.state.activityUses||{})[activity.id],'Activity has already been completed');
        assert(!activity.perDay||activityDayCount(tx.state,pack,activity.id)<activity.perDay,`You have had enough of that for today: ${activity.name}.`);
        for(const effect of activity.effects||[])if(effect.type==='item')assert(heldBy(tx.state,effect.id,activity.location)>0,'Activity item is no longer available here');
      }
      if(args.activity==='continue')assert(tx.state.scene&&args.location===tx.state.scene.location&&JSON.stringify(cast)===JSON.stringify(tx.state.scene.characters),'No matching scene to continue');
      const from=tx.state.actors[pack.playerId].location,to=args.location||from;
      // Naming a character who will not be there is answered for free, before any travel: spending the trip
      // only to report an empty room taught testers (and players) nothing but the tick price.
      if(!planner&&!['continue','rest'].includes(args.activity)&&cast.length){
        const ahead=routeBetween(pack,from,to,tx.state.flags);
        if(ahead){
          const duration=continuous?0:activity?activity.duration:1,arrival=tx.state.tick+ahead.length-1+duration;
          // Someone standing in the room is present no matter what their schedule says next; only a character
          // who is elsewhere now and not scheduled to arrive in time is worth a redirect.
          const away=cast.filter(id=>tx.state.actors[id].location!==to&&scheduledLocation(world,pack,id,arrival)!==to);
          if(away.length===cast.length){
            const place=pack.locations.find(l=>l.id===to)?.name||to,whereNow=id=>{const at=tx.state.actors[id].location;return pack.locations.find(l=>l.id===at)?.name||at;};
            const lines=away.map(id=>{const name=tx.state.actors[id].name,at=nextArrivalTick(pack,id,to,arrival),when=at===null?'':` They are scheduled to be at ${place} from ${calendarFor(at,pack).weekday} ${calendarFor(at,pack).daypart}.`;return {character:id,nextArrival:at,text:`${name} is not at ${place}: they are at ${whereNow(id)} right now.${when}`};});
            tx.emit('world.meetingRedirect',{characters:away,location:to,nextArrival:lines.find(x=>x.nextArrival!==null)?.nextArrival??null,text:lines.map(x=>x.text).join(' ')},[pack.playerId]);meetingBlocked=true;return;
          }
        }
      }
      if(args.activity!=='continue'&&tx.state.scene)releaseScene(tx);
      // A closed place refuses new scenes (the player may finish whatever is already open inside); the
      // check answers before any travel, so being turned away costs nothing.
      if(!planner&&pack.modules['world.calendar']&&args.activity!=='continue'&&args.activity!=='rest'&&from!==to){const path=routeBetween(pack,from,to,tx.state.flags);if(path){const closed=closedReason(pack,tx.state,tx.state.tick+path.length-1,to);assert(!closed,`${pack.locations.find(l=>l.id===to)?.name||to} is closed today${closed&&closed!=='closed'?`: ${closed}`:''}.`);}}
      const route=travel(tx,pack,from,to,pack.playerId);if(!route)return;
      const periodRemaining=interval-world.tick%interval,routeTicks=route.length-1;
      if(planner&&!['continue','rest'].includes(args.activity)&&closedReason(pack,tx.state,tx.state.tick+Math.min(routeTicks,Math.max(0,periodRemaining-1)),to)){tx.set(['scene'],null);tx.emit('world.meetingUnavailable',{location:to,text:'The destination is closed when you arrive.'},[pack.playerId]);meetingBlocked=true;return;}
      const duration=continuous&&args.activity!=='rest'?0:activity?activity.duration:args.activity==='rest'?(continuous?Math.max(0,periodRemaining-routeTicks):periodRemaining):args.activity==='continue'?0:1;
      const arrival=tx.state.tick+(planner?Math.min(routeTicks,Math.max(0,periodRemaining-1)):routeTicks+duration),present=cast.filter(id=>{if(planner&&scheduledLocation(world,pack,id,arrival)!==to){tx.emit('world.meetingUnavailable',{character:id,location:to,text:`${tx.state.actors[id].name} is unavailable when you arrive.`},[pack.playerId]);return false;}return meetingArrival(tx,world,pack,id,to,arrival);});
      if(planner&&activity?.character&&!present.includes(activity.character)){tx.set(['scene'],null);meetingBlocked=true;return;}
      if(activity?.character)assert(present.includes(activity.character),`${pack.actors.find(c=>c.id===activity.character)?.name||activity.character} isn't there right now, so you can't ${activity.name.toLowerCase()}.`);
      if(args.itemAction==='give')assert(present.includes(args.itemTarget),'Recipient is unavailable when you arrive');
      if(cast.length&&!present.length){tx.set(['scene'],null);return;}
      if(args.activity==='rest')tx.set(['scene'],null);
      // A budgeted scene (authored game-tier packs) closes itself on the input that reaches the budget; the service writes that closing reply.
      // Continuous scenes never take the budget: they end only when the model or the player ends them (sceneLifecycle holds the safety cap).
      else if(args.activity!=='continue'){const budget=activity?.inputBudget??pack.gameProject?.sceneBudget;tx.set(['scene'],{id:command.id,location:to,characters:present,activity:args.activity,startedTick:world.tick,...(present.length?{focus:activity?.character||present[0]}:{}),...(!continuous&&budget&&present.length?{budget,inputs:1}:{})});}
      else if(tx.state.scene.budget)tx.set(['scene','inputs'],tx.state.scene.inputs+1);
      tx.emit(args.activity==='continue'?'core.sceneContinued':'core.sceneStarted',{activity:args.activity,location:to,characters:present,text:args.text},[pack.playerId,...present]);
      if(args.activity==='talk'&&present.length===1&&pack.modules['social.conversation']){const utterance=spokenLine(args.text);tx.emit('social.spoke',{actor:pack.playerId,target:present[0],location:to,utterance,promise:/\bpromise\b/i.test(args.text),source:'scene',text:`You talk to ${tx.state.actors[present[0]].name}: ${utterance}`},[pack.playerId,present[0]]);}
      if(activity){
        if(!tx.state.activityUses)tx.set(['activityUses'],{});
        tx.set(['activityUses',activity.id],((tx.state.activityUses||{})[activity.id]||0)+1);
        const day=calendarFor(tx.state.tick,pack).day,dayUses=tx.state.activityDayUses||{};
        if(!tx.state.activityDayUses)tx.set(['activityDayUses'],{});
        tx.set(['activityDayUses',activity.id],dayUses[activity.id]&&dayUses[activity.id].day===day?{day,count:dayUses[activity.id].count+1}:{day,count:1});
        // Opportunity cost: spending the activity with company (anyone it does not require) halves its stat gain; the time went to them.
        const company=present.filter(id=>id!==activity.character),cut=d=>company.length&&d>0?Math.floor(d/2):d;
        for(const effect of activity.effects||[]){
          if(effect.type==='flag')tx.set(['flags',effect.id],effect.value);
          if(effect.type==='trust')changeTrust(tx,effect.character,effect.delta);
          if(effect.type==='item')transfer(tx,pack.items.find(i=>i.id===effect.id),to,pack.playerId,1,`You receive ${pack.items.find(i=>i.id===effect.id).name}.`);
          if(effect.type==='money')changeMoney(tx,effect.delta);
          if(effect.type==='stat'&&cut(effect.delta))changeStat(tx,pack.playerId,effect.stat,cut(effect.delta),`activity ${activity.id}`);
        }
        tx.emit('world.activityCompleted',{activity:activity.id,location:to,characters:cast,...(args.result?{result:args.result}:{}),...(company.length?{company}:{}),text:(activity.description||activity.name)+(company.length?` You spend part of it with ${company.map(id=>tx.state.actors[id].name).join(' and ')}, so it counts for less.`:'')},[pack.playerId,...cast]);
      }
      if(args.itemAction){
        assert(pack.modules['items.inventory']&&['take','place','give'].includes(args.itemAction),'Inventory action unavailable');
        const item=(pack.items||[]).find(i=>i.id===args.itemId);assert(item,'Unknown item');
        const inScope=args.itemAction==='take'?pack.items.filter(i=>heldBy(tx.state,i.id,to)>0&&(!i.shop||!pack.modules['world.economy'])&&(!i.hidden||tx.state.modules['world.objects']?.discovered.includes(i.id))):pack.items.filter(i=>heldBy(tx.state,i.id,pack.playerId)>0);const named=args.text.toLowerCase().includes(item.name.toLowerCase())||args.text.toLowerCase().includes(item.id.replaceAll('-',' '));assert(named||(inScope.length===1&&inScope[0].id===item.id),'Please name the item you intend to use.');
        if(args.itemAction==='take'){assert(!item.shop||!pack.modules['world.economy'],'Buy this item at its shop');assert(heldBy(tx.state,item.id,to)>0,'Item is not at this location');assert(!item.hidden||tx.state.modules['world.objects']?.discovered.includes(item.id),'Item has not been discovered');transfer(tx,item,to,pack.playerId,1,`You take ${item.name}.`);}
        else {assert(heldBy(tx.state,item.id,pack.playerId)>0,'You do not own that item');if(args.itemAction==='place')transfer(tx,item,pack.playerId,to,1,`You place ${item.name}.`);else{assert(cast.includes(args.itemTarget)&&tx.state.actors[args.itemTarget]?.location===to,'Recipient is not in this scene');transfer(tx,item,pack.playerId,args.itemTarget,1,`You give ${item.name}.`);}}
      }
      // A solo activity is the period's complete action: with no conversation partner to keep the scene
      // open, close it in this same deterministic turn while preserving its sceneStarted event for narration.
      if(args.activity!=='rest'&&args.activity!=='continue'&&!present.length&&tx.state.scene&&!(planner&&args.activity==='explore')){releaseScene(tx);tx.emit('core.sceneEnded',{reason:'natural',characters:[],text:'The activity comes to a close.'},[pack.playerId]);}
    }
  };
  const handler=base[command.type]||mods.map(m=>m.commands?.[command.type]).find(Boolean);assert(handler,`Unsupported command: ${command.type}`); handler(tx,command.args);
  // One turn can carry world operations beside its main act ("I tease her about her coffee and buy us two coffees").
  // Each settles through the same handler in order on this same transaction, so the turn stays atomic and replayable:
  // a part that throws rolls its own state and events back and leaves a refusal entry (the T-025 shape) instead.
  // Three operations is the cap, the spoken act included; the service narrates whatever it had to drop.
  for(const part of (command.components||[]).slice(0,2)){
    const mark=emitted.length,before=clone(state),was=steps;
    try{
      const run=base[part.type]||mods.map(m=>m.commands?.[part.type]).find(Boolean);assert(run,`Unsupported command: ${part.type}`);
      // A director incident owns the turn while it is open; a stray part waits instead of cutting into it.
      if(world.modules['story.scenes']?.pending)assert(['story.choose','story.respond','story.leave','social.withdrawConsent'].includes(part.type)||FREE_ACTIONS.has(part.type)||part.type==='core.endScene'&&pack.scriptedScenes?.find(x=>x.id===world.modules['story.scenes'].pending)?.template?.delivery==='incident','Finish the active scene first');
      run(tx,part.args);
    }catch(e){
      // Roll the part back whole: keys it invented go, keys it touched return to the snapshot, its events go.
      for(const key of Object.keys(state))if(!(key in before))delete state[key];
      Object.assign(state,before);emitted.length=mark;steps=was;
      const refusal=recordRefusal(tx,registry,refusalCode(e),part.args?.target||part.args?.to||part.args?.item||part.args?.service||'');
      tx.emit('core.refused',{refusal,text:refusal.reason},[pack.playerId]);
    }
  }
  const authored=command.type==='core.scene'&&command.args.activityId?(pack.activities||[]).find(a=>a.id===command.args.activityId):null;
  const invitation=command.type==='world.acceptHangout'?pack.daypart.hangouts.find(h=>h.char===command.args.char):null;
  const phoneOffer=command.type==='social.acceptPhoneOffer'?(pack.phoneMessages||[]).find(m=>m.id===command.args.message)?.offer:null;
  const offeredScene=command.type==='story.startOfferedScene'?(pack.scriptedScenes||[]).find(scene=>scene.id===command.args.scene):null;
  const invitationLocation=invitation&&pack.locations.find(l=>l.name===invitation.where||l.id===invitation.where)?.id;
  const invited=command.type==='social.invite'&&state.scene?.id===command.id;
  const route=command.type==='core.scene'||invitation||phoneOffer||invited?routeBetween(pack,world.actors[pack.playerId].location,invitationLocation||phoneOffer?.location||(invited?command.args.to:null)||command.args.location||world.actors[pack.playerId].location,world.flags):null;
  const travelCost=route?route.length-1:0;
  const cost=planner||meetingBlocked?0:offeredScene?(offeredScene.timeCost??pack.daypart?.interval??1):command.type==='core.waitUntil'?waitTicks:command.type==='world.nextDaypart'?pack.daypart.interval-state.tick%pack.daypart.interval:invitation||phoneOffer||invited?route?travelCost+1:0:command.type==='social.invite'?0:continuous&&['story.choose','story.respond','story.leave','social.withdrawConsent'].includes(command.type)?0:command.type==='core.scene'&&!route?0:authored?travelCost+authored.duration:command.type==='core.scene'&&command.args.activity==='rest'?(continuous?Math.max(travelCost,(pack.daypart?.interval||4)-state.tick%(pack.daypart?.interval||4)):travelCost+(pack.daypart?.interval||4)-state.tick%(pack.daypart?.interval||4)):command.type==='core.scene'?travelCost+(command.args.activity==='continue'?0:1):command.type==='core.wait'&&command.args?.until?untilTicks(state.tick,command.args.until,pack.daypart?.interval||4):pack.durations?.[command.type]??(FREE_ACTIONS.has(command.type)?0:1);assert(Number.isInteger(cost)&&cost>=0&&cost<=100,'Invalid action duration');
  const kept=continuous&&state.scene&&world.scene?.id===state.scene.id,opened=continuous&&state.scene&&!kept,soloClosed=continuous&&command.type==='core.scene'&&emitted.some(e=>e.type==='core.sceneStarted'&&!(e.payload.characters||[]).length)&&emitted.some(e=>e.type==='core.sceneEnded');
  const advance=n=>{if(n>0){const before=state.tick,to=state.run?Math.min(before+n,state.run.endTick):before+n;if(to===before)return;tx.set(['tick'],to);tx.emit('core.timeAdvanced',{from:before,to:state.tick,sceneCast:state.scene?.characters||[]},[]);}};
  let reacted=0;const react=()=>{for(;reacted<emitted.length;reacted++){const e=emitted[reacted];if(e.type==='core.patch')continue;for(const m of mods)m.react?.(tx,e);}};
  const closes=continuous&&world.scene&&!state.scene&&!['world.nextDaypart','core.waitUntil'].includes(command.type)&&!(command.type==='core.scene'&&command.args.activity==='rest'),boundary=(Math.floor(world.tick/interval)+1)*interval,waitTarget=planner&&['core.wait','core.waitUntil'].includes(command.type)&&command.args.until&&!world.scene&&!world.modules['story.scenes']?.pending&&!world.modules['social.firsts']?.active?world.tick+untilTicks(world.tick,command.args.until,interval):boundary;
  // Venus-style pacing (gameProject.goodbyeEndsDay): when the other person ends the conversation, the day is over, not just the period.
  const until=()=>!planner&&pack.gameProject?.goodbyeEndsDay&&emitted.some(e=>e.type==='core.sceneEnded'&&e.payload.reason!=='player'&&e.payload.characters?.length)?(Math.floor(world.tick/(interval*PERIODS.length))+1)*interval*PERIODS.length:boundary;
  // A kept conversation spends the day too: every gameProject.turnsPerTick exchanges (default 3) costs one tick, so a long talk visibly turns the clock without cutting the scene.
  if(planner){if(!state.planner&&!FREE_ACTIONS.has(command.type)&&(['core.scene','core.move','core.wait','core.waitUntil','world.nextDaypart','story.startOfferedScene','world.acceptHangout','social.acceptPhoneOffer'].includes(command.type)||state.scene||state.modules['story.scenes']?.pending||state.modules['social.firsts']?.active))tx.set(['planner'],{id:command.id,endTick:waitTarget});react();}
  else{advance(kept?(!['core.wait','core.waitUntil'].includes(command.type)&&EXCHANGE_COMMANDS.has(command.type)&&((state.scene.exchanges||0)+1)%(pack.gameProject?.turnsPerTick??3)===0?1:0):opened?travelCost:soloClosed?Math.max(travelCost,boundary-state.tick):closes?Math.max(cost,until()-state.tick):cost);react();}
  if(planner&&state.scene?.id===command.id&&state.scene.activity==='explore'&&!state.scene.characters.length){const cast=[...new Set(emitted.filter(e=>e.type==='world.moment'&&e.payload.kind==='encounter'&&state.actors[e.payload.character]?.location===state.scene.location).map(e=>e.payload.character))];if(cast.length){tx.set(['scene','characters'],cast);tx.set(['scene','focus'],cast[0]);}else if(!state.modules['story.scenes']?.pending){releaseScene(tx);tx.emit('core.sceneEnded',{reason:'natural',characters:[],text:'The activity comes to a close.'},[pack.playerId]);}react();}
  if(continuous&&world.scene)sceneLifecycle(tx,world,emitted,kept&&EXCHANGE_COMMANDS.has(command.type),true,command.deferExchangeCap===true);else if(world.scene){sceneLifecycle(tx,world,emitted,false,false);react();}
  for(const m of mods)m.afterTurn?.(tx,command);react();
  // The period is spent once, when its scene closes: whoever ended it, the clock moves to the next morning, afternoon or evening.
  if(planner&&state.planner&&!state.scene&&!state.modules['story.scenes']?.pending&&!state.modules['social.firsts']?.active){advance(state.planner.endTick-state.tick);tx.set(['planner'],null);react();}
  else if(!planner&&continuous&&world.scene&&!state.scene&&!['world.nextDaypart','core.waitUntil'].includes(command.type)&&!(command.type==='core.scene'&&command.args.activity==='rest')){advance(until()-state.tick);react();}
  tx.set(['revision'],world.revision+1);
  if(!command.id.startsWith('refusal-preview-'))for(const e of emitted.slice()){if(e.type==='core.patch'||e.type==='core.refused')continue;const code=e.payload.refusal?.code||(/Blocked|Unavailable|Redirect|Declined|Refused|Denied$/.test(e.type)?e.payload.code||e.type:null);if(code){const refusal=recordRefusal(tx,registry,code,e.payload.character||e.payload.target||e.payload.to||e.payload.location||'');e.payload={...e.payload,refusal};}}
  if(command.input!==undefined&&command.type!=='core.inspect'&&!emitted.some(e=>e.payload.refusal)&&!committedChange(world,state)){const refusal=recordRefusal(tx,registry,'unchanged');tx.emit('core.refused',{refusal,text:refusal.reason},[pack.playerId]);}
  const refusal=emitted.find(e=>e.payload.refusal)?.payload.refusal;
  const turn={...(refusal?{refusal}:{}),id:command.id,command:clone(command),events:emitted,narrative:null,status:'pending'};
  state.events.push(...emitted);state.turns[command.id]=turn;return {state,turn,duplicate:false};
}
// Each place lists what can be done there and what it pays, so raising a stat is a visible choice, not a guessed phrase.
export const effectSummary=(pack,effects=[])=>effects.flatMap(e=>e.type==='stat'?[`${e.delta>0?'+':''}${e.delta} ${pack.statDefinitions?.find(d=>d.id===e.stat)?.name||e.stat}`]:e.type==='trust'?[`${pack.actors.find(a=>a.id===e.character)?.name||e.character} trust ${e.delta>0?'+':''}${e.delta}`]:e.type==='money'?[`${e.delta<0?'-':'+'}${Math.abs(e.delta)}`]:e.type==='item'?[pack.items?.find(i=>i.id===e.id)?.name||e.id]:[]).join(' · ');
// A training activity's daily uses: repeated practice on the same day would otherwise be free stat income.
// Social-link unlock: the rank an activity still waits on with its character, or null once reached.
export const rankLock=(world,pack,a)=>{if(!a.minRank)return null;const ranks=(pack.romanceTempoProfiles||[]).find(p=>p.character===a.character)?.ranks||[],i=ranks.findIndex(r=>r.id===a.minRank);return i>(world.modules['social.romance-tempo']?.characters?.[a.character]?.rank||0)?ranks[i]:null;};
const activityDayCount=(world,pack,id)=>{const uses=(world.activityDayUses||{})[id];return uses&&uses.day===calendarFor(world.tick,pack).day?uses.count:0;};
function activityActions(world,pack,loc){return (pack.activities||[]).filter(a=>a.location===loc.id&&(!a.character||world.actors[a.character]?.location===loc.id)&&(!a.requiresFlag||world.flags[a.requiresFlag])&&!rankLock(world,pack,a)&&!(a.once&&(world.activityUses||{})[a.id])&&(!a.perDay||activityDayCount(world,pack,a.id)<a.perDay)&&!closedReason(pack,world,world.tick,a.location)).map(a=>({label:a.name,type:'core.scene',args:{text:a.name,location:a.location,characters:a.character?[a.character]:[],activity:'other',activityId:a.id,itemAction:'',itemId:'',itemTarget:''},storylet:{title:a.name,who:a.character?[pack.actors.find(c=>c.id===a.character)?.name||a.character]:[],where:loc.name,timeCost:a.duration,hint:effectSummary(pack,a.effects)||a.description||''}}));}
function plannerChoices(world,pack,extra){
 const here=world.actors[pack.playerId].location,known=id=>pack.gameProject?.characterLocationVisibility==='always'||world.actors[id]?.location===here;
 return [...pack.locations.flatMap(loc=>routeBetween(pack,here,loc.id,world.flags)?activityActions(world,pack,loc).filter(a=>a.args.characters.every(known)):[]),...pack.actors.filter(a=>a.id!==pack.playerId&&known(a.id)&&!closedReason(pack,world,world.tick,world.actors[a.id].location)).map(a=>({label:`Talk to ${a.name}`,type:'core.scene',args:{text:`Talk to ${a.name}`,location:world.actors[a.id].location,characters:[a.id],activity:'talk'}})),...extra.filter(a=>a.type==='story.startOfferedScene'&&!a.disabledReason).filter(a=>{const scene=pack.scriptedScenes.find(s=>s.id===a.args.scene);return [...Object.keys(scene?.when?.charactersAt||{}),...(scene?.pages||[]).map(p=>p.speaker).filter(id=>id&&id!==pack.playerId)].every(known);}),{label:'Wait this slot',type:'core.wait',args:{}}].map(a=>({...a,planner:true,storylet:{...a.storylet,timeCost:1}}));
}
export function actions(world,pack,registry){
  if(world.modules['story.endings']?.selected)return [];
  // One pack check per call; each preview below would otherwise re-hash the pack.
  const ok=world.packDigest===mechanicsDigest(pack);
  if(world.modules['story.scenes']?.pending)return resolveModules(pack,registry).flatMap(m=>m.actions?.(world,pack)||[]).filter(a=>['story.choose','story.leave','social.withdrawConsent'].includes(a.type)).map((a,i)=>{try{const next=execute(world,{...a,id:`preview-choice-${world.revision}-${i}`,actorId:pack.playerId,expectedRevision:world.revision},pack,registry,ok).state;return {...a,enabled:true,cost:actionCost(world,a,pack,registry,next)};}catch(e){return {...a,enabled:false,reason:e.message,cost:timeCost(0,pack)};}});
  const loc=pack.locations.find(l=>l.id===world.actors[pack.playerId].location);
  const extra=resolveModules(pack,registry).flatMap(m=>m.actions?.(world,pack)||[]),look=extra.filter(a=>a.type==='core.inspect'),cueTo=new Map(extra.filter(a=>a.type==='core.move').map(a=>[a.args.to,a])),list=[...(look.length?look:[{label:'Look around',type:'core.inspect',args:{}}]),{label:'Wait',type:'core.wait',args:{}},...(world.scene?[{label:world.scene.characters.length?'End conversation':'Finish activity',type:'core.endScene',args:{}}]:[]),...loc.exits.map(e=>cueTo.get(e.to)||{label:`Go to ${pack.locations.find(l=>l.id===e.to).name}`,type:'core.move',args:{to:e.to}}),...activityActions(world,pack,loc),...extra.filter(a=>!['core.inspect','core.move'].includes(a.type))];
  if(plannerMode(pack)&&!world.scene){const choices=plannerChoices(world,pack,extra);list.splice(0,list.length,...choices,...list.filter(a=>!['core.scene','core.wait','core.waitUntil','story.startOfferedScene','world.nextDaypart','social.speak'].includes(a.type)));}
  return list.map((a,i)=>{try{const next=execute(world,{...a,id:`preview-${world.revision}-${i}`,actorId:pack.playerId,expectedRevision:world.revision},pack,registry,ok).state;return {...a,enabled:true,cost:actionCost(world,a,pack,registry,next)};}catch(e){return {...a,enabled:false,reason:e.message,cost:timeCost(0,pack)};}});
}
export function actionCost(state,action,pack,registry={},next){
 if(!next){let id=`cost-${state.revision}`;while(state.turns[id])id+='-next';next=execute(state,{...action,id,actorId:pack.playerId,expectedRevision:state.revision},pack,registry).state;}
 const end=next.planner?.endTick??next.tick,to=state.run?Math.min(end,state.run.endTick):end;
 return timeCost(Math.max(0,to-state.tick),pack);
}
// Bookkeeping that takes no story time: looking, dressing, reading the phone.
export const FREE_ACTIONS=new Set(['core.refuse','core.inspect','items.equip','items.unequip','social.readFeed','social.readThread','social.acceptPhoneOffer','social.declinePhoneOffer','social.reactToPost','social.setRumorStance','social.resolveConfrontation','social.scoreFirst','social.stopFirst','world.pushLuck']);
// The typed turns a model scene answers inside an open continuous scene: the only ones that count toward the
// sceneTurns safety cap. Score sub-turns (priceActs, scoreFirst, resolveConfrontation), waits and rules-only
// commands are not conversation, and failed generations are refunded by the service, so none of them spend the scene.
export const EXCHANGE_COMMANDS=new Set(['core.scene','social.speak','story.respond']);
export function fallback(turn){return turn.events.filter(e=>e.visibility==='public'||e.visibility.includes(turn.command.actorId)).map(e=>e.payload.text).filter(Boolean).join('\n')||'Action completed.';}
