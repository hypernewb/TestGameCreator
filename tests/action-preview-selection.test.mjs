import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,actions,execute} from '../packages/core/engine.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {MockProvider} from '../packages/ai/providers.mjs';
const pack={schemaVersion:1,id:'preview',title:'Preview',version:'0.1.0',modules:{'test.preview':'0.1.0'},playerId:'you',locations:[{id:'home',name:'Home',exits:[]}],actors:[{id:'you',name:'You',location:'home'}]};
function fixture(){const seen=[],ids=[],mod={id:'test.preview',version:'0.1.0',coreApi:'0.1.0',requires:[],init:()=>({}),actions:()=>[{label:'Read history',type:'test.read',args:{}},{label:'Blocked',type:'test.blocked',args:{}},{label:'Choose',type:'story.choose',args:{}},{label:'Leave',type:'story.leave',args:{}}],commands:{'test.read'(tx){seen.push(tx.commandId);assert.ok(Object.values(tx.state.turns).some(t=>t.command.type==='core.wait'));assert.ok(tx.state.events.some(e=>e.type==='core.waited'));tx.emit('test.read',{text:'History is available.'});},'test.blocked'(){seen.push('blocked');throw new Error('Still blocked');},'story.choose'(tx){seen.push('choose');tx.emit('test.chosen',{});},'story.leave'(){seen.push('leave');throw new Error('Cannot leave');}}};for(const [type,run] of Object.entries(mod.commands))mod.commands[type]=(tx,...args)=>{ids.push({type,id:tx.commandId});return run(tx,...args);};const registry={'test.preview':mod};let state=createWorld(pack,registry);state=execute(state,{id:'past',actorId:'you',expectedRevision:0,type:'core.wait',args:{}},pack,registry).state;return {seen,ids,registry,state};}
test('selected previews retain history, availability and costs without executing unrelated handlers',()=>{
 const {seen,ids,registry,state}=fixture(),before=structuredClone(state),all=actions(state,pack,registry),expected=ids.filter(x=>['test.read','test.blocked'].includes(x.type));seen.length=0;ids.length=0;
 assert.deepEqual(actions(state,pack,registry,['test.read','test.blocked']),all.filter(a=>['test.read','test.blocked'].includes(a.type)));assert.deepEqual(ids,expected);assert.equal(seen.length,2);assert.equal(seen.includes('choose'),false);assert.equal(seen.includes('leave'),false);assert.deepEqual(state,before);assert.deepEqual(actions(state,pack,registry,[]),[]);
});
test('selected pending-scene previews retain disabled choices and costs',()=>{
 const {seen,ids,registry,state}=fixture();state.modules['story.scenes']={pending:'active'};const before=structuredClone(state),all=actions(state,pack,registry),expected=ids.filter(x=>x.type==='story.leave');seen.length=0;ids.length=0;
 assert.deepEqual(actions(state,pack,registry,['story.leave']),all.filter(a=>a.type==='story.leave'));assert.deepEqual(ids,expected);assert.deepEqual(seen,['leave']);assert.deepEqual(state,before);
});
test('explicit service commands preview only their own type and keep disabled actions rejected',async()=>{
 const {seen,registry,state}=fixture(),store=new Store(':memory:');store.insert(state);const service=new GameService(store,{preview:pack},registry,new MockProvider());
 try{const result=await service.act(state.campaignId,{id:'chosen',expectedRevision:state.revision,command:{type:'core.wait',args:{}}});assert.equal(result.state.tick,state.tick+1);assert.deepEqual(seen,[]);await assert.rejects(service.act(state.campaignId,{id:'blocked',expectedRevision:result.state.revision,command:{type:'test.blocked',args:{}}}),/unavailable action/);assert.deepEqual(seen,['blocked']);assert.equal(store.load(state.campaignId).revision,result.state.revision);}finally{store.close();}
});
test('typed service input still previews the full action list',async()=>{
 const {seen,registry,state}=fixture(),store=new Store(':memory:');store.insert(state);const service=new GameService(store,{preview:pack},registry,new MockProvider());
 try{await service.act(state.campaignId,{id:'typed',expectedRevision:state.revision,input:'Wait'});assert.ok(seen.includes('blocked'));assert.ok(seen.includes('choose'));assert.ok(seen.includes('leave'));}finally{store.close();}
});
