import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,replay} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';

const pack=(extra={})=>{const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));p.gameProject={...JSON.parse(readFileSync(new URL('../packs/crossed-plans.json',import.meta.url))).gameProject,...extra};delete p.schedules;return p;};
const run=(p,id)=>{let state=createWorld(p,registry,id);const act=(type,args={})=>{const r=execute(state,{id:`${id}-${state.revision}`,actorId:p.playerId,type,args,expectedRevision:state.revision},p,registry);state=r.state;return r;};return {act,get state(){return state;}};};
const talk=(text,activity='talk')=>({text,location:'hub',characters:['ada'],activity});

test('a continuous scene costs no time to open or continue, and its end advances to the next period once',()=>{
 const c=run(pack(),'life');
 c.act('core.scene',talk('Hi Ada.'));assert.equal(c.state.tick,0);assert.deepEqual(c.state.scene.characters,['ada']);
 for(const line of ['How was your day?','Tell me more.','Really?'])c.act('core.scene',talk(line,'continue'));
 assert.equal(c.state.tick,0);assert.equal(c.state.scene.exchanges,3);
 const end=c.act('core.endScene');assert.equal(c.state.scene,null);assert.equal(c.state.tick,4);
 assert.equal(end.turn.events.filter(e=>e.type==='core.timeAdvanced').length,1);
});

test('a solo activity completes in one turn and advances exactly one period',()=>{
 const c=run(pack(),'solo');const result=c.act('core.scene',{text:'Look around the workshop.',location:'workshop',characters:[],activity:'explore'});
 assert.equal(c.state.scene,null);assert.equal(c.state.tick,4);assert.equal(c.state.actors.player.location,'workshop');
 assert.equal(result.turn.events.filter(e=>e.type==='core.sceneStarted').length,1);assert.equal(result.turn.events.filter(e=>e.type==='core.sceneEnded').length,1);assert.equal(result.turn.events.filter(e=>e.type==='core.timeAdvanced').length,1);
 const restored=replay(createWorld(pack(),registry,'solo'),c.state.events);assert.equal(restored.scene,null);assert.equal(restored.tick,4);assert.equal(restored.actors.player.location,'workshop');
});

test('travel is included inside a continuous rest period instead of added after it',()=>{
 const c=run(pack(),'travel-rest'),result=c.act('core.scene',{text:'Go to the workshop and rest.',location:'workshop',characters:[],activity:'rest'});
 assert.equal(c.state.tick,4);assert.equal(c.state.actors.player.location,'workshop');assert.equal(result.turn.events.filter(event=>event.type==='core.timeAdvanced').length,1);
});

test('a required authored choice does not consume part of the next period',()=>{
 const p=pack();p.modules['story.scenes']='0.1.0';p.scriptedScenes=[{id:'message',title:'A message',opening:'Your phone lights up.',allowInput:false,trigger:{event:'core.inspected',match:{}},pages:[{speaker:'',text:'A reply waits.'}],choices:[{id:'answer',label:'Answer',result:'You answer.',effects:[]}]}];const c=run(p,'free-choice');
 c.act('core.inspect');assert.equal(c.state.tick,0);c.act('story.choose',{scene:'message',choice:'answer'});assert.equal(c.state.tick,0);
});

test('nine typed solo activities complete three days with one period per action',async()=>{
 const p=pack(),provider={name:'typed-route',async interpretScene(input,world){return {location:world.actors[p.playerId].location,characters:[],activity:'explore',itemAction:'',itemId:'',itemTarget:''};},async generateScene(){return {lines:[{speaker:'',text:'You spend some time on the activity.'}]};}};
 const store=new Store();store.insert(createWorld(p,registry,'three-days'));const service=new GameService(store,{[p.id]:p},registry,provider),ticks=[];
 try{
  for(let i=0;i<9;i++){
   const result=await service.act('three-days',{id:`period-${i}`,expectedRevision:i,input:`Spend this period sketching detail ${i+1}.`});
   ticks.push(result.state.tick);assert.equal(result.state.scene,null);assert.equal(result.turn.command.type,'core.scene');assert.equal(result.turn.input,`Spend this period sketching detail ${i+1}.`);assert.equal(result.turn.events.filter(event=>event.type==='core.timeAdvanced').length,1);
  }
  assert.deepEqual(ticks,[4,8,12,16,20,24,28,32,36]);
 }finally{store.close();}
});

test('talking to a present NPC joins them to the running scene instead of replacing it',()=>{
 const p=pack();p.actors.find(a=>a.id==='brin').location='hub';const c=run(p,'join');
 c.act('core.scene',talk('Hi Ada.'));const id=c.state.scene.id;
 c.act('social.speak',{target:'brin',text:'Brin, join us.'});
 assert.equal(c.state.scene.id,id);assert.deepEqual(c.state.scene.characters,['ada','brin']);assert.equal(c.state.tick,0);
});

test('a scene that runs past its exchange cap closes itself and the clock moves on',()=>{
 const c=run(pack({sceneTurns:2}),'cap');
 c.act('core.scene',talk('Hi Ada.'));c.act('core.scene',talk('One.','continue'));assert.ok(c.state.scene);
 const r=c.act('core.scene',talk('Two.','continue'));
 assert.equal(c.state.scene,null);assert.equal(c.state.tick,4);assert.equal(r.turn.events.find(e=>e.type==='core.sceneEnded').payload.reason,'schedule');
});

test('a sharp trust drop makes the NPC leave the scene',()=>{
 const p=pack();p.dialogueReactions=[{id:'insult-ada',character:'ada',phrases:['you idiot'],trustDelta:-6}];p.initialRelationships=[{character:'ada',trust:30}];const c=run(p,'hurt');
 c.act('core.scene',talk('Hi Ada.'));const r=c.act('core.scene',talk('You idiot.','continue'));
 assert.ok(r.turn.events.some(e=>e.type==='social.relationshipChanged'&&e.payload.delta<=-5),'reaction applied');
 assert.equal(r.turn.events.find(e=>e.type==='core.sceneEnded')?.payload.reason,'boundary');assert.equal(c.state.scene,null);assert.equal(c.state.tick,4);
});

test('a model-proposed ending in a continuous pack runs core.endScene and advances time',async()=>{
 const p=pack();let calls=0;
 // The model's own farewell closes the scene; the automatic end turn costs no extra model call.
 const provider={name:'probe',async generateScene(){calls++;return calls===1?{lines:[{speaker:'ada',text:'Hello there.'}]}:{lines:[{speaker:'ada',text:'I should get going.'}],end_scene:true};}};
 const store=new Store();store.insert(createWorld(p,registry,'natural'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{
  await service.act('natural',{id:'open',expectedRevision:0,command:{type:'core.scene',args:talk('Hi Ada.')}});
  const r=await service.act('natural',{id:'bye',expectedRevision:1,command:{type:'core.scene',args:talk('Nice talking.','continue')}});
  assert.equal(r.state.scene,null);assert.equal(r.state.tick,4);assert.equal(r.turn.id,'bye');assert.match(r.turn.narrative,/I should get going/);assert.equal(calls,2);
  const end=r.state.turns['bye-end'];assert.equal(end.status,'complete');assert.equal(end.events.find(e=>e.type==='core.sceneEnded').payload.reason,'natural');
 }finally{store.close();}
});
