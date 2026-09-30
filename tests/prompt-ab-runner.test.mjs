import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {MockProvider} from '../packages/ai/providers.mjs';
import {registry} from '../packages/modules/index.mjs';
import {runPromptAB} from '../packages/testing/prompt-ab-runner.mjs';
import {CRITERIA,shownTurn,tally} from '../packages/testing/prompt-ab.mjs';
import {linesFor} from '../public/turn-presentation.mjs';

test('every arm settles its own ending before the judge reads final presentation, including engine-only turns',async()=>{
 const pack=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));
 pack.gameProject={...JSON.parse(readFileSync(new URL('../packs/crossed-plans.json',import.meta.url))).gameProject,conversationStyle:'continuous'};delete pack.schedules;
 class Writer extends MockProvider{
  constructor(ends){super();this.ends=ends;this.calls=0;}
  async generateScene(){this.calls++;return {lines:[{speaker:'brin',text:'UNSEEN DRAFT'},{speaker:'ada',text:this.calls===1?'Welcome to the workshop.':'I can stay a little longer.'}],end_scene:this.ends&&this.calls===2};}
 }
 const store=new Store(),variants={stay:new Writer(false),leave:new Writer(true)},service=new GameService(store,{[pack.id]:pack},registry,variants.stay),judged=[];
 const score=Object.fromEntries(Object.keys(CRITERIA).map(c=>[c,7])),judgeProvider={async complete(messages){judged.push(messages);assert.doesNotMatch(messages[1].content,/UNSEEN DRAFT/);return JSON.stringify({A:score,B:score,winner:'A',why:'First reads better.'});}};
 try{
  const rows=await runPromptAB({service,store,pack,registry,view:state=>({state,pack}),variants,scenarios:{s:['Go find Ada','Tell her you will bring coffee','Bye']},seed:17,judgeProvider,mode:'trajectory'});
  assert.equal(rows[0].stay.dropped,1);assert.equal(rows.length,3);assert.equal(judged.length,6);
  assert.ok(rows[1].stay.after.scene);assert.equal(rows[1].leave.after.scene,null);assert.equal(rows[1].stay.after.tick,0);assert.equal(rows[1].leave.after.tick,4);
  assert.equal(rows[2].stay.sceneCalls,0,'explicit goodbye is an engine-only turn');assert.match(rows[2].stay.text,/\[SCENE END\]/);
  assert.equal(rows[0].stay.before.tick,rows[0].leave.before.tick);assert.deepEqual(rows[0].stay.before.locations,rows[0].leave.before.locations);
  assert.ok(rows.every(r=>r.verdicts[0].orderDisagreement));assert.ok(rows.every(r=>r.verdicts[0].winner==='tie'),'a position-biased judge does not award wins');
 }finally{store.close();}
});

test('the shared display includes director and ending beats without mutating stored pages',()=>{
 const pack={playerId:'player',actors:[{id:'player',name:'You'}],scriptedScenes:[{id:'d',template:'owned',opening:'A quiet interruption.',pages:[{speaker:'',text:'She waits.'}]}]};
 const state={modules:{'story.scenes':{pending:'d'}},turns:{a:{id:'a',command:{type:'core.inspect',args:{}},narrative:'draft content',events:[]}}};
 const before=structuredClone(state),original=structuredClone(pack),diagnostics={ended:{name:'Together',text:'Summer begins.'}};
 const shown=shownTurn({turns:{}},state,pack,[],diagnostics);
 assert.match(shown.text,/\[DIRECTOR\] A quiet interruption\./);assert.match(shown.text,/\[THE END\] Together\. Summer begins\./);assert.doesNotMatch(shown.text,/draft content/);
 assert.deepEqual([...shown.lines,...shown.engine],linesFor({state,pack,diagnostics}));assert.deepEqual(state,before);assert.deepEqual(pack,original);
});
test('paired mode restores the same reference state and invalid judging produces no tie or zero scores',async()=>{
 const pack=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));
 pack.gameProject={...JSON.parse(readFileSync(new URL('../packs/crossed-plans.json',import.meta.url))).gameProject,conversationStyle:'continuous'};delete pack.schedules;
 class Writer extends MockProvider{constructor(end){super();this.end=end;this.calls=0;}async generateScene(){this.calls++;return {lines:[{speaker:'ada',text:'We have time to talk.'}],end_scene:this.end&&this.calls===2};}}
 const store=new Store(),variants={stay:new Writer(false),leave:new Writer(true)},service=new GameService(store,{[pack.id]:pack},registry,variants.stay);
 try{
  const rows=await runPromptAB({service,store,pack,registry,view:state=>({state,pack}),variants,scenarios:{s:['Go find Ada','Hello again','Tell her your favorite color is teal']},judgeProvider:{async complete(){return '{"winner":"A","A":{"fun":8}}';}},reference:'stay'});
  assert.equal(rows[1].leave.after.scene,null);assert.ok(rows[2].leave.before.scene);
  assert.deepEqual(rows[2].leave.before,rows[2].stay.before,'both arms start the next action from the same reference save');
  assert.ok(rows.every(r=>r.verdicts.length===0&&r.judgeErrors.length===1));assert.ok(rows.every(r=>r.judgeAttempts.length===1));
  const totals=tally(rows,['stay','leave']);assert.equal(totals.mean.stay.fun,null);assert.equal(totals.versus['stay vs leave'].tie,0);
 }finally{store.close();}
});
