import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
import {registry} from '../packages/modules/index.mjs';
import {validatePack} from '../packages/core/engine.mjs';

const pack=()=>({schemaVersion:1,id:'test.scenarios',version:'0.1.0',title:'Scenario Test World',playerId:'player',
 gameProject:{premise:'Testing.',setting:'A test world.',ai:{intent:'i',scene:'s',daypart:'d'}},
 modules:{'character.stats':'0.1.0'},
 locations:[{id:'hub',name:'Hub',description:'The hub.',exits:[{to:'library'}]},{id:'library',name:'Library',description:'Quiet.',exits:[{to:'hub'}]}],
 actors:[{id:'player',name:'You',location:'hub'}],
 storyVariables:[{id:'studied',name:'Studied',initial:false}],
 statDefinitions:[{id:'focus',name:'Focus',min:0,max:5,visibility:'player'}],
 initialStats:[{character:'player',stat:'focus',value:1}],
 activities:[{id:'study',name:'Study',description:'Hit the books.',location:'library',duration:1,effects:[{type:'flag',id:'studied',value:true},{type:'stat',stat:'focus',delta:1}]}],
 startOptions:[{id:'opening',title:'Start',playerLocation:'hub',tick:0}]});
const scenario={name:'Hub to library',fixture:{tick:8,location:'hub'},
 steps:[{type:'core.move',args:{to:'library'},label:'Go to the library'},{type:'core.scene',args:{text:'Study',location:'library',characters:[],activity:'other',activityId:'study'},label:'Study'}],
 assertions:[{kind:'location',after:1,value:'library'},{kind:'flag',flag:'studied',value:true}]};

async function boot(){
 const dir=mkdtempSync(join(tmpdir(),'scenario-routes-')),app=createApp({dataPath:':memory:',scenarioDir:dir});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${app.server.address().port}`;
 const call=async(path,body)=>{const r=await fetch(base+path,body!==undefined?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});return {status:r.status,data:await r.json()};};
 const cleanup=async()=>{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});};
 return {app,call,cleanup};
}

test('scenario CRUD saves and reopens fixtures, action order and assertions',async()=>{
 const {app,call,cleanup}=await boot();
 try{
  validatePack(pack(),registry);
  const draft=await call('/api/studio/create',{});assert.equal(draft.status,200);
  const savedDraft=await call('/api/studio/save',{id:draft.data.id,pack:pack(),revision:draft.data.updated});assert.equal(savedDraft.status,200);
  const s=await call('/api/studio/scenario/save',{...scenario,target:{draftId:draft.data.id,title:'T'}});
  assert.equal(s.status,200);assert.equal(s.data.rev,1);
  assert.equal((await call('/api/studio/scenario/save',{...scenario,id:s.data.id,rev:0})).status,400,'a stale save is refused');
  const bad=await call('/api/studio/scenario/save',{name:'',fixture:{},steps:[],assertions:[]});
  assert.equal(bad.status,400);assert.match(bad.data.error,/name/i);
  const list=(await call('/api/studio/scenarios')).data.scenarios;assert.equal(list.length,1);assert.equal(list[0].name,'Hub to library');assert.equal(list[0].lastRun,null);
  const open=await call(`/api/studio/scenario?id=${s.data.id}`);
  assert.equal(open.data.fixture.tick,8);assert.equal(open.data.fixture.location,'hub');
  assert.deepEqual(open.data.steps.map(x=>x.type),['core.move','core.scene']);
  assert.deepEqual(open.data.assertions,scenario.assertions,'assertions survive save/reopen verbatim');
  assert.ok(typeof open.data.currentDigest==='string');
  const copy=await call('/api/studio/scenario/duplicate',{id:s.data.id});
  assert.equal(copy.data.name,'Hub to library (copy)');assert.equal(copy.data.rev,1);assert.equal(copy.data.lastRun,undefined);
  assert.equal((await call('/api/studio/scenarios')).data.scenarios.length,2);
  assert.equal((await call('/api/studio/scenario/delete',{id:copy.data.id})).status,200);
  const gone=await call(`/api/studio/scenario?id=${copy.data.id}`);assert.match(gone.data.error,/not found/i);
 }finally{await cleanup();}
});

test('a run is deterministic, persists its project identity, and never touches saves or the pack',async()=>{
 const {app,call,cleanup}=await boot();
 try{
  const draft=await call('/api/studio/create',{}),p=pack(),pBefore=structuredClone(p);
  await call('/api/studio/save',{id:draft.data.id,pack:p,revision:draft.data.updated});
  const s=await call('/api/studio/scenario/save',{...scenario,target:{draftId:draft.data.id,title:'T'}});
  const run=await call('/api/studio/scenario/run',{...scenario,id:s.data.id,rev:s.data.rev,pack:p});
  assert.equal(run.status,200);assert.equal(run.data.result.ok,true,JSON.stringify(run.data.result.firstFailure));
  assert.equal(run.data.persisted,true);assert.equal(run.data.currentDigest,run.data.result.snapshotDigest);
  assert.equal(run.data.result.packVersion,'0.1.0');assert.equal(run.data.result.final.location,'library');
  const replay=await call('/api/studio/scenario/run',{...scenario,id:s.data.id,rev:s.data.rev,pack:p});
  assert.deepEqual({...run.data.result,ranAt:0},{...replay.data.result,ranAt:0},'identical inputs repeat exactly');
  const open=await call(`/api/studio/scenario?id=${s.data.id}`);
  assert.equal(open.data.lastRun.ok,true);assert.equal(open.data.lastRun.packDigest,run.data.result.packDigest);assert.equal(open.data.currentDigest,run.data.result.snapshotDigest);
  assert.deepEqual(p,pBefore,'the sent pack is never mutated');
  assert.equal(app.store.list().length,0,'no campaign is created in the real store');
 }finally{await cleanup();}
});

test('a stale run cannot overwrite a newer scenario revision; a wrong assertion fails usefully',async()=>{
 const {app,call,cleanup}=await boot();
 try{
  const draft=await call('/api/studio/create',{});await call('/api/studio/save',{id:draft.data.id,pack:pack(),revision:draft.data.updated});
  const s=await call('/api/studio/scenario/save',{...scenario,target:{draftId:draft.data.id,title:'T'}});
  const failing={...scenario,assertions:[{kind:'flag',flag:'studied',value:false}]};
  const bad=await call('/api/studio/scenario/run',{...failing,id:s.data.id,rev:s.data.rev,pack:pack()});
  assert.equal(bad.data.result.ok,false);assert.equal(bad.data.result.firstFailure.kind,'assertion');
  assert.match(bad.data.result.firstFailure.message,/studied/);assert.equal(bad.data.result.assertions.at(-1).actual,true);
  const stale=await call('/api/studio/scenario/run',{...failing,id:s.data.id,rev:99,pack:pack()});
  assert.equal(stale.status,400);assert.match(stale.data.error,/Stale scenario revision/);
  const open=await call(`/api/studio/scenario?id=${s.data.id}`);
  assert.equal(open.data.lastRun.firstFailure.kind,'assertion','the stale run left the recorded result untouched');
  assert.equal(open.data.lastRun.rev,undefined);
  const anon=await call('/api/studio/scenario/run',{...scenario,pack:pack()});
  assert.equal(anon.data.persisted,false,'an unsaved scenario runs but records nothing');
  const resave=await call('/api/studio/scenario/save',{...scenario,id:s.data.id,rev:s.data.rev,target:{draftId:draft.data.id,title:'T'}});
  assert.equal(resave.status,200);
  const kept=await call(`/api/studio/scenario?id=${s.data.id}`);
  assert.ok(kept.data.lastRun,'an unchanged save keeps the recorded last run');
  const edited=await call('/api/studio/scenario/save',{...scenario,steps:[...scenario.steps,{type:'core.inspect',args:{}}],id:s.data.id,rev:resave.data.rev,target:{draftId:draft.data.id,title:'T'}});
  assert.equal(edited.status,200);
  const dropped=await call(`/api/studio/scenario?id=${s.data.id}`);
  assert.equal(dropped.data.lastRun,null,'an edited definition drops the stale recorded run');
 }finally{await cleanup();}
});

test('the action registry endpoint validates the pack and offers concrete actions',async()=>{
 const {app,call,cleanup}=await boot();
 try{
  const ok=await call('/api/studio/scenario/actions',{pack:pack(),fixture:{tick:8,location:'hub'}});
  assert.equal(ok.status,200);assert.ok(ok.data.actions.some(a=>a.type==='core.move'&&a.args.to==='library'));
  assert.ok(ok.data.actions.some(a=>a.type==='core.inspect'));
  const bad=await call('/api/studio/scenario/actions',{pack:{...pack(),locations:[]},fixture:{}});
  assert.equal(bad.status,400);
  const unknownStep=await call('/api/studio/scenario/run',{name:'x',fixture:{},steps:[{type:'freetext.wish',args:{}}],assertions:[],pack:pack()});
  assert.equal(unknownStep.status,400);assert.match(unknownStep.data.error,/not a registered action/);
 }finally{await cleanup();}
});


test('success and failure isolate existing saves and project bytes; retargeting clears snapshot results',async()=>{const {app,call,cleanup}=await boot();try{const draft=await call('/api/studio/create',{});await call('/api/studio/save',{id:draft.data.id,pack:pack(),revision:draft.data.updated});const save=await call('/api/new',{packId:Object.keys(app.packs)[0]}),before=structuredClone(app.store.load(save.data.state.campaignId)),project=(await call('/api/studio/get?id='+draft.data.id)).data;const saved=await call('/api/studio/scenario/save',{...scenario,target:{draftId:draft.data.id}});for(const assertions of [scenario.assertions,[{kind:'tick',value:999}]]){const r=await call('/api/studio/scenario/run',{...scenario,assertions,id:saved.data.id,rev:saved.data.rev,pack:pack()});assert.equal(r.status,200);assert.deepEqual(app.store.load(save.data.state.campaignId),before);assert.deepEqual((await call('/api/studio/get?id='+draft.data.id)).data,project);}const p=pack();p.statDefinitions[0].max=4;await call('/api/studio/save',{id:draft.data.id,pack:p,revision:(await call('/api/studio/get?id='+draft.data.id)).data.updated});const stale=(await call('/api/studio/scenario?id='+saved.data.id)).data;assert.notEqual(stale.currentDigest,stale.lastRun.snapshotDigest);await call('/api/studio/scenario/save',{...scenario,id:saved.data.id,rev:saved.data.rev,target:{draftId:'another'}});assert.equal((await call('/api/studio/scenario?id='+saved.data.id)).data.lastRun,null);}finally{await cleanup();}});
