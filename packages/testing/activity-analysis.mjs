// Creator balance analysis: run short sequences of existing activities from one isolated fixture through the
// real engine (createWorld + execute, exactly as play does) and compare time, resources and stats step by step.
// Read-only by construction: no campaign store, no AI provider, no writes to the pack; it never changes balance.
import {actions,assert,execute,mechanicsDigest,rankLock,routeBetween} from '../core/engine.mjs';
import {statValue} from '../modules/stats.mjs';
import {heldBy} from '../modules/inventory.mjs';
import {closedReason} from '../modules/calendar.mjs';
import {calendarFor,PERIODS} from '../../public/calendar.mjs';
import {fixtureWorld,validateScenario} from './scenarios.mjs';
export const MAX_SEQUENCES=2,MAX_SEQUENCE_STEPS=40;
const plainObject=v=>v&&typeof v==='object'&&!Array.isArray(v);
const nameOf=(list,id)=>(list||[]).find(x=>x.id===id)?.name||id;
// Validation: shape, then project references. Steps are {activity:id} or {wait:true,until?:Morning|Afternoon|Evening}.
export function validateComparison(c,{pack,registry}={}){
 assert(plainObject(c),'Comparison must be an object');
 const f=c.fixture||{};validateScenario({name:'comparison',fixture:f,steps:[],assertions:[]},pack?{pack,registry}:{});
 assert(f.money===undefined||Number.isInteger(f.money)&&Math.abs(f.money)<=100000000,'fixture.money: expected a whole number');
 if(pack&&f.money!==undefined)assert(pack.modules['world.economy'],'fixture.money: enable the economy module to set starting money');
 assert(Array.isArray(c.sequences)&&c.sequences.length>=1&&c.sequences.length<=MAX_SEQUENCES,`sequences: expected 1–${MAX_SEQUENCES} sequences`);
 const ids=new Set((pack?.activities||[]).map(a=>a.id));
 c.sequences.forEach((s,i)=>{const at=`Sequence ${String.fromCharCode(65+i)}`;
  assert(plainObject(s)&&Array.isArray(s.steps),`${at}: expected {name, steps}`);
  assert(s.name===undefined||typeof s.name==='string'&&s.name.length<=80,`${at}: name must be up to 80 characters`);
  assert(s.steps.length<=MAX_SEQUENCE_STEPS,`${at}: at most ${MAX_SEQUENCE_STEPS} steps`);
  s.steps.forEach((step,j)=>{const where=`${at} step ${j+1}`;assert(plainObject(step),`${where}: expected an activity or wait step`);
   assert(step.wait===undefined||typeof step.wait==='boolean',`${where}: wait must be true or false`);assert(!(step.wait&&step.activity!==undefined),`${where}: choose either activity or wait`);
   if(step.wait){assert(step.until===undefined||PERIODS.includes(step.until),`${where}: wait "until" must be one of ${PERIODS.join(', ')}`);return;}
   assert(typeof step.activity==='string'&&step.activity,`${where}: choose an existing activity`);
   if(pack)assert(ids.has(step.activity),`${where}: unknown activity ${step.activity}. Only the project’s existing activities can be compared.`);});});
 return c;
}
// Everything the balance view reports: time, place, money, held items, player stats, trust with each character, variables.
export function snapshot(world,pack){
 const p=pack.playerId,c=calendarFor(world.tick,pack),rel=world.modules['social.relationships'];
 return {tick:world.tick,day:c.day,weekday:c.weekday,daypart:c.daypart,location:world.actors[p].location,
  money:world.modules['world.economy']?world.modules['world.economy'].balance:null,
  items:world.modules['items.inventory']?Object.fromEntries((pack.items||[]).map(i=>[i.id,heldBy(world,i.id,p)]).filter(([,n])=>n>0)):{},
  stats:world.modules['character.stats']?Object.fromEntries((pack.statDefinitions||[]).map(d=>[d.id,statValue(world,p,d.id)])):{},
  trust:rel?Object.fromEntries(pack.actors.filter(a=>a.id!==p).map(a=>[a.id,rel.edges[`${a.id}--${p}`]||0])):{},
  flags:{...world.flags}};
}
const when=s=>`Day ${s.day} ${s.daypart}`;
// Changes between two snapshots as creator-readable rows; numbers keep their delta for side-by-side totals.
export function changesBetween(a,b,pack){
 const out=[],num=(kind,id,label,x=0,y=0)=>{if(x!==y)out.push({kind,id,label,from:x,to:y,delta:y-x});};
 if(a.tick!==b.tick)out.push({kind:'time',id:'tick',label:'Time',from:when(a),to:when(b),delta:b.tick-a.tick});
 if(a.location!==b.location)out.push({kind:'location',id:'location',label:'Location',from:nameOf(pack.locations,a.location),to:nameOf(pack.locations,b.location)});
 if(a.money!==null||b.money!==null)num('money','money','Money',a.money??0,b.money??0);
 for(const id of new Set([...Object.keys(a.items),...Object.keys(b.items)]))num('item',id,nameOf(pack.items,id),a.items[id],b.items[id]);
 for(const id of Object.keys(b.stats))num('stat',id,nameOf(pack.statDefinitions,id),a.stats[id],b.stats[id]);
 for(const id of Object.keys(b.trust))num('trust',id,`Trust with ${nameOf(pack.actors,id)}`,a.trust[id],b.trust[id]);
 for(const id of Object.keys(b.flags))if(a.flags[id]!==b.flags[id])out.push({kind:'flag',id,label:nameOf(pack.storyVariables,id),from:a.flags[id],to:b.flags[id]});
 return out;
}
const dayUses=(world,pack,id)=>{const u=(world.activityDayUses||{})[id];return u&&u.day===calendarFor(world.tick,pack).day?u.count:0;};
// Plain-language reasons an activity cannot run right now, mirroring the engine's own gates. The engine still decides:
// these only explain a refusal (or warn when the player's action list would hide the activity).
export function unavailableReasons(world,pack,a){
 const p=pack.playerId,here=world.actors[p].location,place=nameOf(pack.locations,a.location),out=[];
 if(!routeBetween(pack,here,a.location,world.flags))out.push(`No open route from ${nameOf(pack.locations,here)} to ${place}.`);
 const closed=closedReason(pack,world,world.tick,a.location);if(closed)out.push(`${place} is closed now${closed!=='closed'?`: ${closed}`:''}.`);
 if(a.once&&(world.activityUses||{})[a.id])out.push('One-time activity: already completed.');
 if(a.perDay){const used=dayUses(world,pack,a.id);if(used>=a.perDay)out.push(`Daily limit reached: used ${used} of ${a.perDay} today (Day ${calendarFor(world.tick,pack).day}).`);}
 if(a.requiresFlag&&!world.flags[a.requiresFlag])out.push(`Requires “${nameOf(pack.storyVariables,a.requiresFlag)}” to be true.`);
 if(a.requiresItem&&!(heldBy(world,a.requiresItem,p)>0))out.push(`Requires holding ${nameOf(pack.items,a.requiresItem)}.`);
 if(a.character){const at=world.actors[a.character]?.location;if(at!==a.location)out.push(`${nameOf(pack.actors,a.character)} is at ${nameOf(pack.locations,at)}, not ${place}.`);
  const trust=world.modules['social.relationships']?.edges[`${a.character}--${p}`]||0;if(a.minTrust!==undefined&&trust<a.minTrust)out.push(`Trust with ${nameOf(pack.actors,a.character)} is ${trust}; needs ${a.minTrust}.`);
  const rank=rankLock(world,pack,a);if(rank)out.push(`${nameOf(pack.actors,a.character)} must reach the ${rank.name||rank.id} rank first.`);}
 const cost=(a.effects||[]).filter(e=>e.type==='money'&&e.delta<0).reduce((s,e)=>s+e.delta,0),money=world.modules['world.economy'];
 if(cost&&money){const floor=-(pack.economySettings?.debtLimit||0);if(money.balance+cost<floor)out.push(`Not enough money: costs ${-cost}, balance is ${money.balance}${floor?` (debt limit ${-floor})`:''}.`);}
 for(const e of a.effects||[])if(e.type==='item'&&!(heldBy(world,e.id,a.location)>0))out.push(`${nameOf(pack.items,e.id)} is no longer available at ${place}.`);
 return out;
}
const activityArgs=a=>({text:a.name,location:a.location,characters:a.character?[a.character]:[],activity:'other',activityId:a.id,itemAction:'',itemId:'',itemTarget:''});
// The exact command play would send: the engine's offered action when listed, else the same shape so the engine refuses it itself.
function commandFor(world,pack,registry,step){
 if(step.wait)return {offered:true,type:'core.wait',args:step.until?{until:step.until}:{},label:step.until?`Wait until ${step.until}`:'Wait'};
 const a=pack.activities.find(x=>x.id===step.activity),offer=actions(world,pack,registry).find(x=>x.type==='core.scene'&&x.args?.activityId===a.id);
 return {offered:!!offer,type:'core.scene',args:offer?structuredClone(offer.args):activityArgs(a),label:a.name,activity:a};
}
const run=(world,pack,registry,type,args,id)=>{const r=execute(world,{type,args,id,actorId:pack.playerId,expectedRevision:world.revision},pack,registry);return r;};
// One sequence from a fresh fixture world. Unavailable steps are reported and skipped; later steps still run.
export function simulateSequence(pack,registry,fixture,steps,seed){
 const world=fixtureWorld(pack,registry,{fixture},seed);
 if(fixture.money!==undefined){assert(world.modules['world.economy'],'fixture.money: enable the economy module to set starting money');world.modules['world.economy'].balance=fixture.money;}
 const start=snapshot(world,pack),out=[],commands=[];let n=0;
 for(const [i,step] of steps.entries()){
  const before=snapshot(world,pack),cmd=commandFor(world,pack,registry,step),entry={index:i+1,kind:step.wait?'wait':'activity',activity:step.activity||null,label:cmd.label,offered:cmd.offered,ok:false,before};
  const reasons=cmd.activity?unavailableReasons(world,pack,cmd.activity):[];
  try{
   const r=run(world,pack,registry,cmd.type,cmd.args,`sim${n++}`);
   if(r.turn.refusal)throw Object.assign(Error(r.turn.refusal.reason),{refusal:r.turn.refusal.code});
   Object.assign(world,r.state);commands.push({type:cmd.type,args:cmd.args});
   entry.events=r.turn.events.map(e=>e.type).filter(t=>t!=='core.patch');
   // A conversation the activity opened is closed the way a player would end it, so its period cost is counted.
   if(world.scene){try{const e=run(world,pack,registry,'core.endScene',{reason:'player'},`sim${n++}`);if(e.turn.refusal)throw Error(e.turn.refusal.reason);Object.assign(world,e.state);commands.push({type:'core.endScene',args:{reason:'player'}});entry.closedConversation=true;entry.events.push(...e.turn.events.map(x=>x.type).filter(t=>t!=='core.patch'));}catch(e){entry.note=`Activity completed; its conversation could not be ended: ${e.message}. Later steps use the committed state.`;}}
   entry.ok=true;entry.status='done';
   if(!cmd.offered)entry.note=[entry.note,'Not in the player’s action list right now, but the engine accepted it.'].filter(Boolean).join(' ');
  }catch(e){entry.status='unavailable';entry.error=e.message;entry.reasons=reasons.length?reasons:[e.message];}
  entry.after=snapshot(world,pack);entry.changes=changesBetween(before,entry.after,pack);out.push(entry);
 }
 const final=snapshot(world,pack);
 return {start,steps:out,final,totals:changesBetween(start,final,pack),unavailable:out.filter(s=>!s.ok).length,commands,world};
}
// Compares up to two sequences from the identical fixture and seed. Reports never include the internal world.
export function compareSequences(pack,registry,c,{seed}={}){
 validateComparison(c,{pack,registry});assert(seed===undefined||Number.isInteger(seed)&&seed>=0,'seed: expected a non-negative whole number');
 const used=(seed??c.fixture?.seed??42)>>>0,fixture=structuredClone(c.fixture||{});
 const sequences=c.sequences.map((s,i)=>{const {world,commands,...r}=simulateSequence(pack,registry,fixture,s.steps,used);return {name:s.name||`Sequence ${String.fromCharCode(65+i)}`,...r};});
 return {seed:used,packId:pack.id,packVersion:pack.version,packDigest:mechanicsDigest(pack),start:sequences[0].start,sequences};
}
