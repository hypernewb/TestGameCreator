import test from 'node:test';
import assert from 'node:assert/strict';
import {createFixtureApp,SCREENS,SIZES,layoutIssues} from '../scripts/visual-fixtures/fixtures.mjs';

test('visual fixtures rebuild identical original campaigns through engine replay without a provider call',async()=>{
 const a=await createFixtureApp(),b=await createFixtureApp();try{assert.deepEqual(a.snapshots,b.snapshots);assert.equal(a.replayChecks,3);assert.ok(a.provider instanceof (await import('../packages/ai/providers.mjs')).MockProvider);assert.equal(a.app.packs['fixture.visual'].actors.length,4);assert.equal(a.snapshots.groupcast.state.scene.characters.length,3);assert.ok(a.snapshots.refusal.refusal);assert.equal(a.snapshots.phone.state.modules['social.phone'].threads.rowan.length,1);}finally{await a.close();await b.close();}
});
test('visual matrix names supported states and covers every width with enlarged text',()=>{
 for(const id of ['landing','creator','conversation','groupcast','phone','calendar','refusal','loading','error'])assert.ok(SCREENS.includes(id));assert.deepEqual(SIZES,[390,768,1440]);
});
test('fixture transport gate holds and releases a real action; injected 503 leaves engine revision unchanged',async()=>{
 const f=await createFixtureApp();try{const id=f.snapshots.conversation.state.campaignId,before=f.app.store.load(id).revision,body={campaignId:id,id:'transport-test',expectedRevision:before,input:'Look around'},post=()=>fetch(f.url+'/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});f.arm('loading');const pending=post();for(let i=0;i<100&&!f.hasPending();i++)await new Promise(r=>setTimeout(r,10));assert.ok(f.hasPending());assert.equal(f.app.store.load(id).revision,before);f.release();assert.equal((await pending).status,200);f.reset('conversation');f.arm('error');assert.equal((await post()).status,503);assert.equal(f.app.store.load(id).revision,before);}finally{await f.close();}
});
test('layout findings distinguish clipped/obscured controls and sibling overlap from containment',()=>{
 const r=(x,y,w,h)=>({x,y,w,h});const data={width:390,height:844,controls:[{id:'send',rect:r(370,800,40,40),hit:false},{id:'close',rect:r(20,20,30,30),hit:true}],regions:[{id:'dialogue',rect:r(0,600,390,140)},{id:'composer',rect:r(0,720,390,60)},{id:'input',rect:r(10,730,200,30)}],textClips:['line']};const out=layoutIssues(data);assert.ok(out.some(x=>x.kind==='clipped-control'&&x.id==='send'));assert.ok(out.some(x=>x.kind==='obscured-control'&&x.id==='send'));assert.ok(out.some(x=>x.kind==='overlap'&&x.id==='dialogue/composer'));assert.ok(!out.some(x=>x.id==='composer/input'));assert.ok(out.some(x=>x.kind==='clipped-text'));assert.deepEqual(layoutIssues({width:390,height:844,controls:[{id:'ok',rect:r(10,10,50,30),hit:true}],regions:[],textClips:[]}),[]);
});
