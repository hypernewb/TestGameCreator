import test from 'node:test';
import assert from 'node:assert/strict';
import {registry} from '../packages/modules/index.mjs';
import {createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {compareSequences,simulateSequence,validateComparison} from '../packages/testing/activity-analysis.mjs';
import {fixtureWorld} from '../packages/testing/scenarios.mjs';
import {createApp} from '../server.mjs';
import {mkdtempSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// A non-campus pack: a harbour town with a paid lesson, a free daily drill and a stat-gated job.
const pack=()=>({schemaVersion:1,id:'test.balance',version:'0.1.0',title:'Harbour Balance',playerId:'player',
 gameProject:{premise:'Testing.',setting:'A harbour.',ai:{intent:'i',scene:'s',daypart:'d'}},
 modules:{'character.stats':'0.1.0','items.inventory':'0.2.0','world.economy':'0.2.0'},initialMoney:50,
 locations:[{id:'dock',name:'Dock',description:'Ropes.',exits:[{to:'school'}]},{id:'school',name:'Sailing School',description:'Boats.',exits:[{to:'dock'}]}],
 actors:[{id:'player',name:'You',location:'dock'}],items:[],
 storyVariables:[{id:'licensed',name:'Licensed',initial:false}],
 statDefinitions:[{id:'skill',name:'Seamanship',min:0,max:10,visibility:'player'}],
 initialStats:[{character:'player',stat:'skill',value:1}],
 activities:[
  {id:'lesson',name:'Paid lesson',description:'A lesson.',location:'school',duration:1,effects:[{type:'money',delta:-30},{type:'stat',stat:'skill',delta:2}]},
  {id:'drill',name:'Knot drill',description:'Practice.',location:'dock',duration:1,perDay:1,effects:[{type:'stat',stat:'skill',delta:1}]},
  {id:'haul',name:'Haul nets',description:'Work.',location:'dock',duration:1,effects:[{type:'money',delta:20}]},
  {id:'exam',name:'Licence exam',description:'Exam.',location:'school',duration:1,once:true,effects:[{type:'flag',id:'licensed',value:true}]}],
 startOptions:[{id:'opening',title:'Start',playerLocation:'dock',tick:0}]});
const cmp=(a,b,fixture={})=>({fixture,sequences:[{name:'Lessons',steps:a.map(x=>typeof x==='string'?{activity:x}:x)},{name:'Drills',steps:b.map(x=>typeof x==='string'?{activity:x}:x)}]});

test('comparison is reproducible and leaves pack and request untouched',()=>{
 const p=pack();validatePack(p,registry);const c=cmp(['lesson','lesson'],['drill',{wait:true,until:'Morning'},'drill']),pBefore=structuredClone(p),cBefore=structuredClone(c);
 const a=compareSequences(p,registry,c),b=compareSequences(p,registry,c);
 assert.deepEqual(a,b);assert.deepEqual(p,pBefore);assert.deepEqual(c,cBefore);
 assert.equal(a.seed,42);assert.deepEqual(a.sequences[0].start,a.sequences[1].start,'both sequences start from the identical fixture');
 const [lessons,drills]=a.sequences;
 assert.equal(lessons.steps[0].ok,true);assert.equal(lessons.steps[0].changes.find(x=>x.kind==='money').delta,-30);
 assert.equal(lessons.steps[0].changes.find(x=>x.kind==='stat').delta,2);assert.ok(lessons.steps[0].changes.find(x=>x.kind==='time').delta>0);
 assert.equal(drills.unavailable,0);assert.equal(drills.final.stats.skill,3);assert.equal(drills.final.money,50);
});

test('results match running the same commands through the ordinary engine',()=>{
 const p=pack(),steps=[{activity:'haul'},{activity:'lesson'},{wait:true},{activity:'drill'}];
 const r=simulateSequence(p,registry,{},steps,42);
 let w=fixtureWorld(p,registry,{fixture:{}},42);
 for(const [i,c] of r.commands.entries())w=execute(w,{...c,id:`sim${i}`,actorId:'player',expectedRevision:w.revision},p,registry).state;
 assert.deepEqual(r.world,w);
 const plain=createWorld(p,registry,'scenario-test',42);assert.equal(plain.tick,r.start.tick,'the empty fixture is the pack start');
});

test('daily limits explain why an activity is unavailable, and the next day it is back',()=>{
 const r=compareSequences(pack(),registry,cmp(['drill','drill',{wait:true,until:'Morning'},'drill'],[]));
 const s=r.sequences[0].steps;
 assert.equal(s[1].ok,false);assert.equal(s[1].status,'unavailable');
 assert.match(s[1].error,/enough of that for today: Knot drill/);assert.match(s[1].reasons.join(' '),/Daily limit reached: used 1 of 1 today/);
 assert.deepEqual(s[1].changes,[],'an unavailable step changes nothing');
 assert.equal(s[3].ok,true);assert.equal(r.sequences[0].unavailable,1);
});

test('insufficient money and one-time activities are explained and later steps still run',()=>{
 const r=compareSequences(pack(),registry,cmp(['lesson','lesson','haul','exam','exam'],[],{money:40}));
 const s=r.sequences[0].steps;
 assert.equal(s[0].ok,true);assert.equal(s[1].ok,false);
 assert.match(s[1].error,/Insufficient funds/);assert.match(s[1].reasons[0],/Not enough money: costs 30, balance is 10/);
 assert.equal(s[2].ok,true);assert.equal(s[2].after.money,30);
 assert.equal(s[3].ok,true);assert.equal(s[4].ok,false);assert.match(s[4].reasons[0],/One-time activity/);
 assert.equal(r.start.money,40);
});

test('invalid requests are rejected with clear messages before anything runs',()=>{
 const p=pack();
 assert.throws(()=>compareSequences(p,registry,cmp(['drill','teleport'],[])),/Sequence A step 2: unknown activity teleport/);
 assert.throws(()=>compareSequences(p,registry,{fixture:{},sequences:[]}),/expected 1–2 sequences/);
 assert.throws(()=>compareSequences(p,registry,{fixture:{location:'moon'},sequences:[{steps:[]}]}),/unknown location moon/);
 assert.throws(()=>compareSequences(p,registry,cmp([],[{wait:true,until:'Night'}])),/Sequence B step 1: wait "until"/);
 assert.throws(()=>compareSequences(p,registry,cmp([],[],{money:1.5})),/fixture.money/);
 const noEconomy=pack();noEconomy.modules={'character.stats':'0.1.0'};noEconomy.activities=noEconomy.activities.filter(a=>a.id==='drill');
 assert.throws(()=>validateComparison({fixture:{money:5},sequences:[{steps:[]}]},{pack:noEconomy,registry}),/enable the economy module/);
});

test('a different seed is honoured and reported',()=>{
 const r=compareSequences(pack(),registry,cmp(['drill'],['haul']),{seed:7});
 assert.equal(r.seed,7);assert.equal(r.sequences.length,2);
});

test('character activities report trust, absence and close the conversation they open',()=>{
 const p=pack();p.modules['social.conversation']=registry['social.conversation'].version;p.modules['social.relationships']='0.1.0';p.actors.push({id:'mira',name:'Mira',location:'dock'});
 p.activities.push({id:'mend',name:'Mend sails with Mira',description:'Together.',location:'dock',character:'mira',duration:1,effects:[{type:'trust',character:'mira',delta:2}]},
  {id:'race',name:'Race Mira',description:'Fast.',location:'dock',character:'mira',minTrust:5,duration:1,effects:[]});
 validatePack(p,registry);
 const r=compareSequences(p,registry,cmp(['mend','race'],['race']));
 const [a,b]=r.sequences;
 assert.equal(a.steps[0].ok,true);assert.equal(a.steps[0].closedConversation,true);assert.equal(a.steps[0].after.trust.mira,2);
 assert.ok(a.steps[0].changes.some(x=>x.kind==='trust'&&x.label==='Trust with Mira'&&x.delta===2));
 assert.equal(a.steps[1].ok,false);assert.match(a.steps[1].reasons.join(' '),/Trust with Mira is 2; needs 5/);
 assert.equal(b.steps[0].ok,false);assert.match(b.steps[0].reasons.join(' '),/Trust with Mira is 0; needs 5/);
 const away=compareSequences(p,registry,{fixture:{},sequences:[{steps:[{activity:'lesson'},{activity:'mend'}]}]}).sequences[0].steps[1];
 assert.equal(away.ok,true,'the engine walks back to the dock for an activity there');
});

test('the Studio route compares without creating campaigns or writing project files',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'activity-compare-')),app=createApp({dataPath:':memory:',scenarioDir:dir});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const post=async body=>{const r=await fetch(`http://127.0.0.1:${app.server.address().port}/api/studio/activity-compare`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 try{
  const files=d=>readdirSync(d,{recursive:true}).sort(),before=files(dir);
  const ok=await post({pack:pack(),...cmp(['lesson'],['drill'])});
  assert.equal(ok.status,200);assert.deepEqual(ok.data,compareSequences(pack(),registry,cmp(['lesson'],['drill'])));
  const bad=await post({pack:pack(),...cmp(['nope'],[])});
  assert.equal(bad.status,400);assert.match(bad.data.error,/Sequence A step 1: unknown activity nope/);
  assert.equal(app.store.list().length,0);assert.deepEqual(files(dir),before);
 }finally{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});}
});


test('sequence order and another run cannot consume the other sequence random stream',()=>{
 const p=pack();p.modules['world.calendar']='0.1.0';p.calendar={weather:[{id:'sun',name:'Sun',weight:1},{id:'rain',name:'Rain',weight:1}]};validatePack(p,registry);
 const a=[{wait:true,until:'Morning'},{activity:'drill'}],b=[{wait:true,until:'Morning'},{wait:true,until:'Morning'},{activity:'lesson'}];
 const x=compareSequences(p,registry,{fixture:{seed:7},sequences:[{name:'A',steps:a},{name:'B',steps:b}]});
 simulateSequence(p,registry,{},b,999);
 const y=compareSequences(p,registry,{fixture:{seed:7},sequences:[{name:'B',steps:b},{name:'A',steps:a}]});
 assert.deepEqual(x.sequences[0],y.sequences[1]);assert.deepEqual(x.sequences[1],y.sequences[0]);
 const w=simulateSequence(p,registry,{},a,7).world;assert.notEqual(w.rng,7,'the real engine consumed seeded randomness');
 assert.deepEqual(w,simulateSequence(p,registry,{},a,7).world);
});

test('bounded comparison validates both sequence limits and records clamped stat/item deltas',()=>{
 const p=pack();p.items=[{id:'rope',name:'Rope',owner:'dock'}];p.activities.push({id:'take',name:'Take rope',description:'Take the rope.',location:'dock',duration:1,effects:[{type:'item',id:'rope',to:'player'}]});validatePack(p,registry);
 assert.throws(()=>compareSequences(p,registry,{sequences:[{steps:Array.from({length:41},()=>({wait:true}))}]}),/at most 40/);
 assert.throws(()=>compareSequences(p,registry,{sequences:Array.from({length:3},()=>({steps:[]}))}),/expected 1.2/);
 const r=compareSequences(p,registry,cmp(['drill','take','take'],[],{stats:{skill:10},flags:{licensed:false},money:0}));
 assert.equal(r.start.stats.skill,10);assert.equal(r.start.money,0);assert.deepEqual(r.sequences[0].steps[0].changes.filter(c=>c.kind==='stat'),[]);
 assert.equal(r.sequences[0].steps[1].after.items.rope,1);assert.equal(r.sequences[0].steps[2].ok,false);assert.deepEqual(r.sequences[0].steps[2].changes,[]);
 assert.match(r.sequences[0].steps[2].reasons.join(' '),/no longer available/);
});


test('an activity committed before a scripted interruption is reported as done even when conversation close fails',()=>{
 const p=pack();p.modules['story.scenes']='0.1.0';p.modules['social.conversation']='0.1.0';p.actors.push({id:'mira',name:'Mira',location:'dock'});
 p.activities.push({id:'mend',name:'Mend',description:'Together',location:'dock',character:'mira',duration:1,effects:[{type:'money',delta:20}]});
 p.scriptedScenes=[{id:'interrupt',title:'Interrupt',opening:'Hello',trigger:{event:'core.sceneStarted'},pages:[{text:'Choose'}],choices:[{id:'leave',label:'Leave'}]}];validatePack(p,registry);
 const r=simulateSequence(p,registry,{},[{activity:'mend'},{activity:'haul'}],42);assert.equal(r.steps[0].ok,true);assert.equal(r.steps[0].after.money,70);assert.match(r.steps[0].note,/Activity completed.*could not be ended/);assert.equal(r.steps[1].ok,false);assert.deepEqual(r.steps[1].changes,[]);assert.equal(r.unavailable,1);
 let w=fixtureWorld(p,registry,{fixture:{}},42);for(const c of r.commands)w=execute(w,{...c,id:'sim0',actorId:'player',expectedRevision:w.revision},p,registry).state;assert.deepEqual(r.world,w);
});


test('malformed wait steps and explicit invalid seeds cannot silently select different actions or randomness',()=>{
 const p=pack();for(const seed of [-1,1.5,'7'])assert.throws(()=>compareSequences(p,registry,cmp(['drill'],[]),{seed}),/seed: expected/);
 assert.throws(()=>compareSequences(p,registry,cmp([{wait:'yes'}],[])),/Sequence A step 1: wait must/);
 assert.throws(()=>compareSequences(p,registry,cmp([{wait:true,activity:'drill'}],[])),/choose either activity or wait/);
});


test('off-list accepted activity retains committed effects and conversation-close warning together',()=>{
 const p=pack();p.modules['story.scenes']='0.1.0';p.modules['social.conversation']='0.1.0';p.actors.push({id:'mira',name:'Mira',location:'school'});
 p.activities.push({id:'mend',name:'Mend',description:'Together',location:'school',character:'mira',duration:1,effects:[{type:'money',delta:20}]});p.scriptedScenes=[{id:'interrupt',title:'Interrupt',opening:'Hello',trigger:{event:'core.sceneStarted'},pages:[{text:'Choose'}],choices:[{id:'leave',label:'Leave'}]}];validatePack(p,registry);
 const r=simulateSequence(p,registry,{},[{activity:'mend'},{activity:'lesson'}],42),s=r.steps[0];assert.equal(s.offered,false);assert.equal(s.ok,true);assert.equal(s.status,'done');assert.equal(s.after.money,70);assert.equal(s.after.location,'school');assert.match(s.note,/Activity completed.*could not be ended/);assert.match(s.note,/action list.*engine accepted/);assert.equal(s.closedConversation,undefined);assert.equal(r.steps[1].ok,false);assert.deepEqual(r.steps[1].changes,[]);
 const w=fixtureWorld(p,registry,{fixture:{}},42),actual=execute(w,{...r.commands[0],id:'sim0',actorId:'player',expectedRevision:w.revision},p,registry).state;assert.deepEqual(r.world,actual);assert.equal(s.after.tick,actual.tick);assert.equal(s.changes.find(x=>x.kind==='money').delta,20);assert.equal(s.changes.find(x=>x.kind==='time').delta,actual.tick-w.tick);
});
