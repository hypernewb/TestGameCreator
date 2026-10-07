import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createWorld} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {wordDiff,lineDiff,turnComparisons} from '../packages/ai/turn-compare.mjs';
import {createApp} from '../server.mjs';
const pack=()=>{const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));delete p.modules['world.schedule'];p.actors.find(a=>a.id==='brin').location='hub';return p;};
const rawReply=JSON.stringify({lines:[{speaker:'ada',text:'Welcome.{{setvar::ada_love::100}}'},{speaker:'cyra',text:'I snuck in!'},{speaker:'',text:'Brin: "Glad you came."'}]});
const provider={name:'probe',async interpretScene(){throw Error('unused');},async generateScene(){const v=JSON.parse(rawReply);v.rawAttempts=[{attempt:1,raw:'not json',rejected:'Expected JSON'},{attempt:2,raw:rawReply}];return v;}};
const played=async()=>{const p=pack(),store=new Store();store.insert(createWorld(p,registry,'tc'));const service=new GameService(store,{[p.id]:p},registry,provider);await service.act('tc',{id:'open',expectedRevision:0,command:{type:'core.scene',args:{text:'Chat.',location:'hub',characters:['ada','brin'],activity:'talk'}}});return {p,store};};

test('word and line diffs pair same-speaker rewrites as edits and keep drops and additions apart',()=>{
 assert.deepEqual(wordDiff('she smiles warmly at you','she smiles at you'),[{op:'same',text:'she smiles'},{op:'del',text:' warmly'},{op:'same',text:' at you'}]);
 const d=lineDiff([{speaker:'ada',text:'Hi there, friend.'},{speaker:'cyra',text:'Me too!'},{speaker:'',text:'Rain.'}],[{speaker:'ada',text:'Hi friend.'},{speaker:'',text:'Rain.'},{speaker:'',text:'Ada waits.'}]);
 assert.deepEqual(d.map(x=>x.op),['edit','removed','same','added']);
 assert.equal(d[0].words.find(w=>w.op==='del').text,' there,');assert.equal(d[1].from.speaker,'cyra');
 assert.deepEqual(lineDiff([{speaker:'a',text:'x'}],[{speaker:'a',text:'x'}]).map(x=>x.op),['same']);
 const moved=lineDiff([{speaker:'',text:'Brin: "Glad you came."'}],[{speaker:'brin',text:'Glad you came.'}]);assert.deepEqual(moved.map(x=>[x.op,x.speakerChanged]),[['edit',true]]);
 assert.deepEqual(lineDiff([{speaker:'',text:'Ok.'}],[{speaker:'ada',text:'Something else.'}]).map(x=>x.op),['removed','added']);
});

test('a played turn stores raw attempts and each code stage, and the comparison shows what code changed',async()=>{
 const {p,store}=await played();
 try{const s=store.load('tc'),t=s.turns.open;
  assert.deepEqual(t.sceneTrace.raw.map(a=>a.attempt),[1,2]);assert.equal(t.sceneTrace.raw[0].rejected,'Expected JSON');assert.equal(t.sceneTrace.stages[0].stage,'model');
  const [row]=turnComparisons(s,p);
  assert.equal(row.source,'model');assert.equal(row.raw[1].raw,rawReply);
  assert.deepEqual(row.model.map(l=>l.speaker),['ada','cyra','']);assert.equal(row.model[0].name,p.actors.find(a=>a.id==='ada').name);
  assert.ok(row.steps.length>=1&&row.steps.every(x=>x.label&&x.diff.some(d=>d.op!=='same')));
  const ops=row.finalDiff.map(x=>x.op);assert.ok(ops.includes('removed')&&row.finalDiff.find(x=>x.op==='removed').from.speaker==='cyra','cast guard drop shows as a removed model line');
  assert.ok(row.finalDiff.some(x=>x.op==='edit'&&x.from.speaker==='ada'&&x.words.some(w=>w.op==='del'&&/setvar/.test(w.text))),'state syntax strip shows as a word-level edit');
  assert.deepEqual(row.final.map(l=>[l.speaker,l.text]),t.sceneLines.map(l=>[l.speaker,l.text]));
 }finally{store.close();}
});

test('relationship changes come from the turn and its follow-ups; turns without a trace stay labelled',()=>{
 const p=pack(),s={turns:{
  a:{id:'a',input:'hi',sceneRequest:{playerAction:'You say hi'},provider:'Gemini',sceneLines:[{speaker:'ada',text:'Hey.'}],events:[{type:'social.spoke',payload:{actor:'ada'}},{type:'social.relationshipChanged',payload:{actor:'ada',toward:'player',old:2,value:3,delta:1,dimension:'affection',text:'Ada warms.'}}]},
  'a-end':{id:'a-end',events:[{type:'social.chemistryChanged',payload:{character:'ada',from:1,to:4}}]},
  b:{id:'b',command:{type:'core.wait'},provider:'Game rules',sceneLines:[{speaker:'',text:'Time passes.'}],events:[]}}};
 const rows=turnComparisons(s,p);
 assert.deepEqual(rows.map(r=>[r.id,r.source]),[['a','untraced'],['b','rules']]);
 assert.equal(rows[0].modelSaw,'You say hi');assert.equal(rows[0].model,null);
 assert.deepEqual(rows[0].changes.map(c=>[c.type,c.delta,c.before,c.after]),[['social.relationshipChanged',1,2,3],['social.chemistryChanged',3,1,4]]);
 assert.equal(rows[0].changes[0].toward,p.actors.find(a=>a.id==='player')?.name||'player');
});

test('turn compare API is creator-debug gated',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'sf-turn-compare-')),app=createApp({dataPath:':memory:',scenarioDir:dir}),p=pack();app.packs[p.id]=p;
 const service=new GameService(app.store,{[p.id]:p},registry,provider);app.store.insert(createWorld(p,registry,'tc'));await service.act('tc',{id:'open',expectedRevision:0,command:{type:'core.scene',args:{text:'Chat.',location:'hub',characters:['ada','brin'],activity:'talk'}}});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`,get=token=>fetch(base+'/api/creator/turns/compare?id=tc',{headers:token?{'x-story-memory':token}:{}});
 try{assert.equal((await get()).status,400);assert.equal((await get('invalid')).status,400);
  const {token}=await (await fetch(base+'/api/creator/memory/access',{method:'POST',body:JSON.stringify({scope:'creator-debug'}),headers:{'Content-Type':'application/json'}})).json();
  const d=await (await get(token)).json();assert.equal(d.campaignId,'tc');assert.equal(d.turns[0].raw.length,2);assert.equal(d.turns[0].source,'model');
 }finally{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});}
});
