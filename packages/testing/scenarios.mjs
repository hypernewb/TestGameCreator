// Creator-authored deterministic test scenarios: a starting fixture, ordered registered engine actions,
// and assertions on the resulting state. Runs compose the existing engine (createWorld + execute) and never
// call an AI provider, the campaign store, or the creator's project data.
import {actions,assert,createWorld,execute,mechanicsDigest,resolveModules} from '../core/engine.mjs';
import {createHash} from 'node:crypto';
export const scenarioSnapshotDigest=pack=>createHash('sha256').update(JSON.stringify(pack)).digest('hex');
import {statKey,statValue} from '../modules/stats.mjs';
import {calendarFor,PERIODS} from '../../public/calendar.mjs';
export const MAX_STEPS=40,MAX_ASSERTIONS=40,ASSERTION_KINDS=['location','tick','daypart','stat','flag','event'];
const BASE_COMMANDS=new Set(['core.refuse','core.move','core.inspect','core.wait','core.waitUntil','core.scene','core.endScene']);
const commandTypes=(pack,registry)=>new Set([...BASE_COMMANDS,...resolveModules(pack,registry).flatMap(m=>Object.keys(m.commands||{}))]);
const plainObject=v=>v&&typeof v==='object'&&!Array.isArray(v);
const describe=a=>a.kind==='location'?`player is at ${a.value}`:a.kind==='tick'?`tick is ${a.value}`:a.kind==='daypart'?`daypart is ${a.value}`:a.kind==='stat'?`stat ${a.stat} is ${a.value}`:a.kind==='flag'?`variable ${a.flag} is ${a.value}`:`step ${a.after??'end'} emits ${a.event}`;
// Shape validation, independent of any project. An assertion's `after` is a 1-based step index or 'end' (default).
export function validateScenario(s,{pack,registry}={}){
 assert(plainObject(s),'Scenario must be an object');
 assert(typeof s.name==='string'&&s.name.trim()&&s.name.length<=120,'Scenario name: 1–120 characters required');
 const f=s.fixture||{};
 assert(plainObject(f),'fixture: expected an object');
 assert(f.tick===undefined||(Number.isInteger(f.tick)&&f.tick>=0),'fixture.tick: expected a non-negative whole number');
 assert(f.location===undefined||f.location===null||typeof f.location==='string','fixture.location: expected a location ID');
 assert(f.stats===undefined||plainObject(f.stats)&&Object.values(f.stats).every(v=>Number.isInteger(v)),'fixture.stats: expected stat ID → whole-number values');
 assert(f.flags===undefined||plainObject(f.flags)&&Object.values(f.flags).every(v=>typeof v==='boolean'),'fixture.flags: expected variable ID → true/false values');
 assert(f.seed===undefined||Number.isInteger(f.seed)&&f.seed>=0&&f.seed<=0xffffffff,'fixture.seed: expected a whole number between 0 and 4294967295');
 assert(Array.isArray(s.steps),'steps: expected an array of engine actions');assert(s.steps.length<=MAX_STEPS,`steps: at most ${MAX_STEPS} actions`);
 s.steps.forEach((step,i)=>{assert(plainObject(step),`Step ${i+1}: expected an action object`);assert(typeof step.type==='string'&&step.type,`Step ${i+1}: action type required`);assert(plainObject(step.args),`Step ${i+1}: args must be an object`);assert(step.label===undefined||typeof step.label==='string',`Step ${i+1}: label must be text`);});
 assert(s.assertions===undefined||Array.isArray(s.assertions),'assertions: expected an array');
 const asserts=s.assertions||[];
 assert(asserts.length<=MAX_ASSERTIONS,`assertions: at most ${MAX_ASSERTIONS}`);
 asserts.forEach((a,i)=>{assert(plainObject(a),`Assertion ${i+1}: expected an object`);assert(ASSERTION_KINDS.includes(a.kind),`Assertion ${i+1}: unknown kind (use ${ASSERTION_KINDS.join(', ')})`);
  assert(a.after===undefined||a.after==='end'||Number.isInteger(a.after)&&a.after>=1&&a.after<=s.steps.length,`Assertion ${i+1}: "after" must be 'end' or a step number between 1 and ${s.steps.length}`);
  if(a.kind==='location')assert(typeof a.value==='string'&&a.value,`Assertion ${i+1}: location ID required`);
  if(a.kind==='tick')assert(Number.isInteger(a.value)&&a.value>=0,`Assertion ${i+1}: expected a non-negative whole tick`);
  if(a.kind==='daypart')assert(PERIODS.includes(a.value),`Assertion ${i+1}: daypart must be one of ${PERIODS.join(', ')}`);
  if(a.kind==='stat')assert(typeof a.stat==='string'&&a.stat&&Number.isInteger(a.value),`Assertion ${i+1}: stat ID and whole-number value required`);
  if(a.kind==='flag')assert(typeof a.flag==='string'&&a.flag&&typeof a.value==='boolean',`Assertion ${i+1}: variable ID and true/false required`);
  if(a.kind==='event')assert(typeof a.event==='string'&&a.event,`Assertion ${i+1}: event type required`);});
 if(pack)validateReferences(s,pack,registry);
 return {fixture:f,steps:s.steps,assertions:asserts};
}
// Project-aware validation: unknown command types or references are rejected before anything runs.
export function validateReferences(s,pack,registry){
 const f=s.fixture||{},locations=new Set(pack.locations.map(l=>l.id)),actors=new Set(pack.actors.map(a=>a.id)),
  variables=new Set((pack.storyVariables||[]).map(v=>v.id)),activities=new Set((pack.activities||[]).map(a=>a.id)),scenes=new Set((pack.scriptedScenes||[]).map(x=>x.id));
 if(f.location)assert(locations.has(f.location),`fixture.location: unknown location ${f.location}`);
 for(const k of Object.keys(f.flags||{}))assert(variables.has(k),`fixture.flags: unknown story variable ${k}`);
 if(Object.keys(f.stats||{}).length){assert(pack.modules['character.stats'],'fixture.stats: enable the character.stats module to set starting stats');
  const defs=new Set((pack.statDefinitions||[]).map(d=>d.id));for(const k of Object.keys(f.stats))assert(defs.has(k),`fixture.stats: unknown stat ${k}`);}
 for(const [i,a] of (s.assertions||[]).entries()){if(a.kind==='location')assert(locations.has(a.value),`Assertion ${i+1}: unknown location ${a.value}`);if(a.kind==='flag')assert(variables.has(a.flag),`Assertion ${i+1}: unknown story variable ${a.flag}`);if(a.kind==='stat')assert(pack.modules['character.stats']&&(pack.statDefinitions||[]).some(d=>d.id===a.stat),`Assertion ${i+1}: unknown or disabled stat ${a.stat}`);if(a.kind==='event')assert(s.steps.length>0,`Assertion ${i+1}: event needs an action step`);}
 const known=commandTypes(pack,registry);
 s.steps.forEach((step,i)=>{
  assert(known.has(step.type),`Step ${i+1}: ${step.type} is not a registered action in this project. Pick an action from the registry instead of typing free text.`);
  const a=step.args||{};
  if(step.type==='core.move')assert(locations.has(a.to),`Step ${i+1}: unknown destination location ${a.to}`);
  if(step.type==='core.waitUntil')assert(actors.has(a.actor)&&a.actor!==pack.playerId,`Step ${i+1}: unknown character to wait for`);
  if(step.type==='core.scene'){
   assert(a.location===undefined||a.location===null||locations.has(a.location),`Step ${i+1}: unknown scene location ${a.location}`);
   (a.characters||[]).forEach(id=>assert(actors.has(id)&&id!==pack.playerId,`Step ${i+1}: unknown scene character ${id}`));
   assert(a.activityId===undefined||a.activityId===null||activities.has(a.activityId),`Step ${i+1}: unknown activity ${a.activityId}`);
  }
  if(step.type==='story.startOfferedScene')assert(scenes.has(a.scene),`Step ${i+1}: unknown scripted scene ${a.scene}`);
 });
}
export function fixtureWorld(pack,registry,s,seed){
 const f=s.fixture||{},world=createWorld(pack,registry,'scenario-test',seed>>>0);
 if(f.tick!==undefined)world.tick=f.tick;
 if(f.location)world.actors[pack.playerId].location=f.location;
 for(const [k,v] of Object.entries(f.flags||{})){assert(k in world.flags,`fixture.flags: unknown story variable ${k}`);world.flags[k]=v;}
 if(Object.keys(f.stats||{}).length){assert(world.modules['character.stats'],'fixture.stats: enable the character.stats module to set starting stats');
  for(const [k,v] of Object.entries(f.stats||{})){const d=(pack.statDefinitions||[]).find(x=>x.id===k);assert(d,`fixture.stats: unknown stat ${k}`);world.modules['character.stats'].values[statKey(pack.playerId,k)]=Math.max(d.min,Math.min(d.max,v));}}
 return world;
}
const actualOf=(a,world,pack,steps)=>a.kind==='location'?world.actors[pack.playerId].location:a.kind==='tick'?world.tick:a.kind==='daypart'?calendarFor(world.tick,pack).daypart:a.kind==='stat'?statValue(world,pack.playerId,a.stat):a.kind==='flag'?world.flags[a.flag]:(a.after===undefined||a.after==='end'?steps.at(-1):steps[a.after-1]).events.includes(a.event);
function checkAssertions(s,world,pack,stepIndex,steps,results,allowEnd=false){
 for(const [i,a] of (s.assertions||[]).entries()){
  if(results.some(r=>r.index===i))continue;
  const due=a.after??'end';
  if(due!==stepIndex&&!(allowEnd&&due==='end'&&stepIndex===steps.length))continue;
  const got=actualOf(a,world,pack,steps),ok=a.kind==='event'?got:got===a.value,expected=a.kind==='event'?a.event:a.value;
  if(ok)results.push({index:i,kind:a.kind,after:due,ok:true,expected,actual:got});
  else return {index:i,kind:'assertion',assertionKind:a.kind,ok:false,after:due,expected,actual:got,message:`Expected that ${describe(a)} — but it is ${a.kind==='event'?`false (step emitted: ${(a.after===undefined||a.after==='end'?steps.at(-1):steps[a.after-1]).events.join(', ')||'no events'})`:JSON.stringify(got)}.`};
 }
 return null;
}
// Runs one scenario against an isolated world. Throws on invalid scenario/references; a refused or failing
// step, or a wrong assertion, stops the run and is reported as firstFailure. Pack and scenario stay untouched.
export function runScenario(pack,registry,s,{seed}={}){
 validateScenario(s,{pack,registry});
 assert(seed===undefined||Number.isInteger(seed)&&seed>=0&&seed<=0xffffffff,'seed: expected a whole number between 0 and 4294967295');
 const used=(seed??s.fixture?.seed??42)>>>0,world=fixtureWorld(pack,registry,s,used),steps=[],results=[],ranAt=new Date().toISOString();
 const start={tick:world.tick,location:world.actors[pack.playerId].location,daypart:calendarFor(world.tick,pack).daypart};
 let firstFailure=s.steps.length?null:{kind:'empty',ok:false,message:'Add at least one action to run.'};
 for(const [i,step] of s.steps.entries()){
  if(firstFailure)break;
  const entry={index:i+1,type:step.type,label:step.label||step.type,ok:false,events:[],tick:world.tick,location:world.actors[pack.playerId].location};
  try{
   const r=execute(world,{type:step.type,args:step.args,id:`s${i}`,actorId:pack.playerId,expectedRevision:world.revision},pack,registry);
   Object.assign(world,r.state);
   const turn=r.turn;
   entry.events=turn.events.map(e=>e.type).filter(t=>t!=='core.patch');
   entry.text=turn.events.map(e=>e.payload?.text).filter(Boolean).join(' ')||'Action completed.';
   entry.tick=world.tick;entry.location=world.actors[pack.playerId].location;
   if(turn.refusal){entry.error=turn.refusal.reason;entry.refusal=turn.refusal.code;firstFailure={kind:'refusal',step:entry.index,ok:false,message:`Step ${entry.index} (${entry.label}) was refused: ${turn.refusal.reason}`};}
   else entry.ok=true;
  }catch(e){entry.error=e.message;firstFailure={kind:'error',step:entry.index,ok:false,message:`Step ${entry.index} (${entry.label}) failed: ${e.message}`};}
  steps.push(entry);
  if(!firstFailure)firstFailure=checkAssertions(s,world,pack,i+1,steps,results,i===s.steps.length-1);
 }
 if(!firstFailure&&s.steps.length)firstFailure=checkAssertions(s,world,pack,steps.length,steps,results,true);
 return {ok:!firstFailure,seed:used,ranAt,scenarioDefinition:structuredClone({name:s.name,fixture:s.fixture||{},steps:s.steps,assertions:s.assertions||[]}),packId:pack.id,packVersion:pack.version,packDigest:mechanicsDigest(pack),snapshotDigest:scenarioSnapshotDigest(pack),start,steps,
  assertions:results.concat(firstFailure?.kind==='assertion'?[firstFailure]:[]),firstFailure,
  final:steps.length?{tick:steps.at(-1).tick,location:steps.at(-1).location,daypart:calendarFor(steps.at(-1).tick,pack).daypart}:null};
}
// The registered actions a creator can pick for the NEXT step: the fixture world with the steps already
// added replayed on top, so an action that only appears after travel (an activity elsewhere) is offered.
export function scenarioActions(pack,registry,s,{seed}={}){
 validateScenario(s,{pack,registry});
 assert(seed===undefined||Number.isInteger(seed)&&seed>=0&&seed<=0xffffffff,'seed: expected a whole number between 0 and 4294967295');
 const used=(seed??s.fixture?.seed??42)>>>0,world=fixtureWorld(pack,registry,s,used);
 for(const [i,step] of s.steps.entries()){
  try{const r=execute(world,{type:step.type,args:step.args,id:`a${i}`,actorId:pack.playerId,expectedRevision:world.revision},pack,registry);if(r.turn.refusal)throw Error(r.turn.refusal.reason);Object.assign(world,r.state);}
  catch(e){return {seed:used,start:{tick:world.tick,location:world.actors[pack.playerId].location,daypart:calendarFor(world.tick,pack).daypart},actions:[],afterStep:i,error:`Step ${i+1} (${step.label||step.type}) fails before anything further can be offered: ${e.message}`};}
 }
 return {seed:used,start:{tick:world.tick,location:world.actors[pack.playerId].location,daypart:calendarFor(world.tick,pack).daypart},
  actions:actions(world,pack,registry).map(({label,type,args,enabled,reason})=>({label,type,args,enabled,reason:enabled?undefined:String(reason||'Unavailable under the current rules.').slice(0,200)}))};
}
