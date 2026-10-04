import test from 'node:test';
import assert from 'node:assert/strict';
import {registry} from '../packages/modules/index.mjs';
import {validatePack} from '../packages/core/engine.mjs';
import {runScenario,scenarioActions,validateScenario,validateReferences} from '../packages/testing/scenarios.mjs';

const pack=()=>({schemaVersion:1,id:'test.scenarios',version:'0.1.0',title:'Scenario Test World',playerId:'player',
 gameProject:{premise:'Testing.',setting:'A test world.',ai:{intent:'i',scene:'s',daypart:'d'}},
 modules:{'character.stats':'0.1.0'},
 locations:[{id:'hub',name:'Hub',description:'The hub.',exits:[{to:'library'}]},{id:'library',name:'Library',description:'Quiet.',exits:[{to:'hub'},{to:'vault',flag:'has_key'}]},{id:'vault',name:'Vault',description:'Locked.',exits:[]}],
 actors:[{id:'player',name:'You',location:'hub'}],
 storyVariables:[{id:'studied',name:'Studied',initial:false},{id:'has_key',name:'Has key',initial:false}],
 statDefinitions:[{id:'focus',name:'Focus',min:0,max:5,visibility:'player'}],
 initialStats:[{character:'player',stat:'focus',value:1}],
 activities:[{id:'study',name:'Study',description:'Hit the books.',location:'library',duration:1,effects:[{type:'flag',id:'studied',value:true},{type:'stat',stat:'focus',delta:1}]}],
 startOptions:[{id:'opening',title:'Start',playerLocation:'hub',tick:0}]});
const moveLibrary={type:'core.move',args:{to:'library'},label:'Go to the library'};
const study={type:'core.scene',args:{text:'Study',location:'library',characters:[],activity:'other',activityId:'study',itemAction:'',itemId:'',itemTarget:''},label:'Study'};
const scenario=()=>({name:'Hub to library',fixture:{tick:8,location:'hub'},
 steps:[moveLibrary,study],
 assertions:[{kind:'location',after:1,value:'library'},{kind:'daypart',value:'Evening'},{kind:'flag',flag:'studied',value:true},{kind:'stat',stat:'focus',value:2}]});
const ok=report=>{assert.equal(report.ok,true,JSON.stringify(report.firstFailure));return report;};

test('an identical fixture and action list repeats exactly; pack and scenario stay untouched',()=>{
 const p=pack();validatePack(p,registry),validateScenario(scenario(),{pack:p,registry:registry});
 const pBefore=structuredClone(p),sBefore=structuredClone(scenario());
 const a=ok(runScenario(p,registry,scenario())),b=ok(runScenario(p,registry,scenario()));
 assert.deepEqual({...a,ranAt:0},{...b,ranAt:0});
 assert.equal(a.seed,42);assert.equal(a.final.location,'library');assert.equal(a.final.daypart,'Evening');
 assert.deepEqual(p,pBefore,'the project pack is never mutated');assert.deepEqual(scenario(),sBefore,'the scenario is never mutated');
});

test('a wrong assertion fails with expected versus actual, and earlier steps are shown',()=>{
 const s=scenario();s.assertions.push({kind:'flag',flag:'studied',value:false});
 const r=runScenario(pack(),registry,s);
 assert.equal(r.ok,false);assert.equal(r.firstFailure.kind,'assertion');
 assert.match(r.firstFailure.message,/variable studied is false/);assert.match(r.firstFailure.message,/but it is true/);
 assert.equal(r.assertions.at(-1).ok,false);assert.equal(r.assertions.at(-1).expected,false);assert.equal(r.assertions.at(-1).actual,true);
 assert.equal(r.steps.length,2);assert.equal(r.steps[0].ok,true);
 const t=scenario();t.assertions.push({kind:'tick',value:999});
 const wrongTick=runScenario(pack(),registry,t);
 assert.match(wrongTick.firstFailure.message,/tick is 999.*it is/i);
});

test('a failing step stops the run and names the step and the engine reason',()=>{
 const s=scenario();s.steps.push({type:'core.move',args:{to:'vault'},label:'Enter the vault'},{type:'core.inspect',args:{}});
 const r=runScenario(pack(),registry,s);
 assert.equal(r.ok,false);assert.equal(r.firstFailure.kind,'error');assert.equal(r.firstFailure.step,3);
 assert.match(r.firstFailure.message,/Step 3.*vault route is locked|Step 3.*locked/i);
 assert.equal(r.steps.length,3);assert.equal(r.steps[2].ok,false);assert.equal(r.steps[3],undefined,'later steps never ran');assert.equal(r.final.location,'library');assert.equal(r.final.tick,r.steps[1].tick);
});

test('a refused step is a failure with the refusal reason',()=>{
 const s=scenario();s.steps=[{type:'core.move',args:{to:'library'},label:'Walk'},{type:'core.refuse',args:{code:'unavailable'},label:'Try something impossible'}];
 const r=runScenario(pack(),registry,s);
 assert.equal(r.ok,false);assert.equal(r.firstFailure.kind,'refusal');assert.match(r.firstFailure.message,/Step 2.*refused/i);
});

test('invalid references and unregistered actions are rejected before anything runs',()=>{
 const p=pack();
 assert.throws(()=>runScenario(p,registry,{name:'x',fixture:{location:'nowhere'},steps:[],assertions:[]}),/fixture.location: unknown location nowhere/);
 assert.throws(()=>runScenario(p,registry,{name:'x',fixture:{flags:{nope:true}},steps:[],assertions:[]}),/unknown story variable nope/);
 assert.throws(()=>runScenario(p,registry,{name:'x',fixture:{stats:{charm:2}},steps:[],assertions:[]}),/unknown stat charm/);
 assert.throws(()=>runScenario(p,registry,{name:'x',fixture:{},steps:[{type:'freetext.wish',args:{text:'make it nice'}}],assertions:[]}),/not a registered action/);
 assert.throws(()=>runScenario(p,registry,{name:'x',fixture:{},steps:[{type:'core.move',args:{to:'nowhere'}}],assertions:[]}),/unknown destination location nowhere/);
 assert.throws(()=>runScenario(p,registry,{name:'x',fixture:{},steps:[{type:'core.scene',args:{text:'x',activity:'talk',location:null,characters:['ghost']}}],assertions:[]}),/unknown scene character ghost/);
 assert.throws(()=>runScenario(p,registry,{name:'x',fixture:{},steps:[{type:'core.scene',args:{text:'x',activity:'other',location:null,characters:[],activityId:'nope'}}],assertions:[]}),/unknown activity nope/);
 assert.throws(()=>runScenario(p,registry,{name:'x',fixture:{},steps:[{type:'core.inspect',args:{}}],assertions:[{kind:'event',after:9,event:'core.moved'}]}),/after.*between 1 and 1/);
 assert.throws(()=>runScenario(p,registry,{name:'x',fixture:{},steps:[],assertions:[{kind:'daypart',value:'Night'}]}),/daypart must be one of/);
});

test('an event assertion checks what a step emitted',()=>{
 const s=scenario();s.assertions=[{kind:'event',after:1,event:'core.moved'},{kind:'event',after:2,event:'world.activityCompleted'}];
 ok(runScenario(pack(),registry,s));
 const bad=scenario();bad.assertions=[{kind:'event',after:2,event:'story.endingUnlocked'}];
 const r=runScenario(pack(),registry,bad);
 assert.equal(r.ok,false);assert.match(r.firstFailure.message,/step emitted: .*world\.activityCompleted/);
});

test('seeds make randomness reproducible and the fixture can move the clock',()=>{
 const s=scenario();s.fixture={tick:4,seed:7};s.assertions=s.assertions.filter(a=>a.kind!=='daypart');
 const r=ok(runScenario(pack(),registry,{...s,fixture:{...s.fixture}}));
 assert.equal(r.seed,7);assert.equal(r.start.tick,4);assert.equal(r.start.daypart,'Afternoon');
});

test('scenarioActions lists registered actions with concrete args from the fixture world',()=>{
 const s=scenario();s.fixture.location='library';s.steps=[];s.assertions=s.assertions.filter(a=>a.after===undefined);
 const r=scenarioActions(pack(),registry,s);
 const act=r.actions.find(a=>a.type==='core.scene'&&a.args.activityId==='study');
 assert.ok(act&&act.enabled&&act.label&&Array.isArray(act.args.characters),'the library activity is offered with concrete args');
 const move=r.actions.find(a=>a.type==='core.move'&&a.args.to==='hub');
 assert.ok(move&&move.enabled);
 assert.equal(r.start.location,'library');assert.equal(r.start.daypart,'Evening');
});

test('scenarioActions reflects the world after the steps already added, so post-travel actions are offered',()=>{
 const s=scenario();s.fixture.location='hub';
 const r=scenarioActions(pack(),registry,s);
 const act=r.actions.find(a=>a.type==='core.scene'&&a.args.activityId==='study');
 assert.ok(act&&act.enabled,'the library activity is offered after the travel step');
 const broken=scenario();broken.steps=[{type:'core.move',args:{to:'vault'},label:'Enter the vault'}];
 const failed=scenarioActions(pack(),registry,broken);
 assert.equal(failed.actions.length,0);assert.match(failed.error,/Step 1.*No route to that location/);
});


test('event assertions at end use the final emitted events and missing assertion references are rejected',()=>{const s=scenario();s.assertions=[{kind:'event',event:'world.activityCompleted'}];ok(runScenario(pack(),registry,s));s.assertions=[{kind:'event',after:'end',event:'missing'}];assert.equal(runScenario(pack(),registry,s).firstFailure.actual,false);for(const a of [{kind:'location',value:'ghost'},{kind:'flag',flag:'ghost',value:false},{kind:'stat',stat:'ghost',value:0}])assert.throws(()=>runScenario(pack(),registry,{...scenario(),assertions:[a]}),/Assertion 1: unknown/);assert.throws(()=>scenarioActions(pack(),registry,scenario(),{seed:'bad'}),/seed: expected/);assert.throws(()=>runScenario(pack(),registry,scenario(),{seed:-1}),/seed: expected/);assert.throws(()=>validateScenario({...scenario(),assertions:{}}),/expected an array/);assert.throws(()=>runScenario(pack(),registry,{...scenario(),fixture:{seed:4294967296}}),/fixture.seed/);});
test('snapshot identity covers stat definitions and refusal stops action replay without input mutation',()=>{const p=pack(),s=scenario(),before=structuredClone([p,s]),r=runScenario(p,registry,s);p.statDefinitions[0].max=4;const changed=runScenario(p,registry,s);assert.equal(r.packDigest,changed.packDigest);assert.notEqual(r.snapshotDigest,changed.snapshotDigest);const refuse={...s,steps:[{type:'core.refuse',args:{code:'unavailable'}}]};assert.equal(scenarioActions(p,registry,refuse).actions.length,0);p.statDefinitions[0].max=5;assert.deepEqual([p,s],before);s.assertions=[{kind:'tick',value:999}];runScenario(p,registry,s);assert.deepEqual(p,before[0]);});
