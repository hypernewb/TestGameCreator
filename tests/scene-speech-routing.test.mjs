import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';
const pack=()=>{const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));p.activities=[{id:'hub-reading',name:'Read in the hub',description:'A book in a corner.',location:'hub',duration:1,phrases:['read','sing']}];p.actors.find(a=>a.id==='brin').location='hub';return p;};
const play=async(cast,inputs)=>{
 const p=pack();let asked=0;const provider={name:'probe',async interpretScene(){asked++;return {characters:cast,location:'hub',activity:'talk'};},async generateScene(){return {lines:[{speaker:cast[0],text:'Mm?'}]};}};
 const store=new Store();store.insert(createWorld(p,registry,'c'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{let r=await service.act('c',{id:'0',expectedRevision:0,input:'Talk to '+cast.map(id=>p.actors.find(a=>a.id===id).name).join(' and ')});const scene=r.state.scene.id,out=[],opened=asked;
  for(const [i,input] of inputs.entries()){r=await service.act('c',{id:String(i+1),expectedRevision:r.state.revision,input});out.push(r);}
  return {scene,asked:asked-opened,out,state:r.state};}finally{store.close();}
};
test('speech that mentions an activity word keeps the conversation instead of starting the activity',async()=>{
 const {scene,asked,out,state}=await play(['ada'],['Ask what she is reading',"Tell her I've never read anything by that author",'Say I miss singing']);
 for(const r of out)assert.ok(!r.clarification&&!r.error,r.clarification||r.error);
 assert.equal(state.scene?.id,scene,'same scene');assert.deepEqual(state.scene.characters,['ada']);assert.equal(asked,0,'no reinterpretation');
});
test('"them" to a group means everyone in the scene, not a clarification',async()=>{
 const {scene,out,state}=await play(['ada','brin'],['Ask them how they know each other','Tell them I will see them around']);
 for(const r of out)assert.ok(!r.clarification,r.clarification);
 assert.equal(state.scene?.id,scene);assert.deepEqual(state.scene.characters,['ada','brin']);
});
test('walking over to people who are already here opens a scene with them when the model names no place',async()=>{
 const p=pack(),provider={name:'probe',async interpretScene(){return {characters:['ada','brin'],location:null,activity:'talk'};},async generateScene(){return {lines:[{speaker:'ada',text:'Hi.'}]};}};
 const store=new Store();store.insert(createWorld(p,registry,'w'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{const r=await service.act('w',{id:'0',expectedRevision:0,input:'Walk over to Ada and Brin and introduce myself'});assert.ok(!r.clarification,r.clarification);assert.deepEqual(r.state.scene?.characters,['ada','brin']);assert.equal(r.state.scene.location,'hub');}finally{store.close();}
});
test('"her" in a group still asks who is meant',async()=>{
 const {out}=await play(['ada','brin'],['Ask her how she is']);assert.match(out[0].clarification||'',/Who do you mean\?/);
});
test('a topic line the classifier tags with a far activity stays a talk here instead of travelling',async()=>{
 const p=pack();p.activities.push({id:'far-karaoke',name:'Karaoke',description:'A mic.',location:'meeting',duration:1,phrases:['karaoke']});
 const provider={name:'probe',async interpretScene(){return {characters:['ada'],location:'meeting',activity:'other',activityId:'far-karaoke'};},async generateScene(){return {lines:[{speaker:'ada',text:'Oh, karaoke.'}]};}};
 const store=new Store();store.insert(createWorld(p,registry,'k'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{const r=await service.act('k',{id:'0',expectedRevision:0,input:'Ask Ada about what karaoke means to her'});assert.ok(!r.clarification,r.clarification);assert.equal(r.state.scene.location,'hub');assert.deepEqual(r.state.scene.characters,['ada']);assert.ok(!r.state.activityDayUses?.['far-karaoke']);}finally{store.close();}
});
test('a goodbye with a placeless move ("head out") mid-conversation stays in the scene instead of asking where to go',async()=>{
 const p=pack(),provider={name:'probe',async interpretScene(){return {characters:['ada'],location:null,activity:'talk'};},async generateScene(){return {lines:[{speaker:'ada',text:'See you.'}]};}};
 const store=new Store();store.insert(createWorld(p,registry,'g'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{let r=await service.act('g',{id:'0',expectedRevision:0,input:'Talk to Ada'});const scene=r.state.scene.id;
  for(const [i,input] of [`"Nine at the boat launch." I start gathering my things. "I'll get out of your hair."`,'"I\'m going to go get some food." I shoulder my bag and head out.'].entries()){r=await service.act('g',{id:String(i+1),expectedRevision:r.state.revision,input});assert.ok(!r.clarification,r.clarification);}
  assert.equal(r.state.scene?.id,scene,'same scene');assert.equal(r.state.actors.player.location,'hub');
 }finally{store.close();}
});
test('words inside quoted dialogue ("a colder read", "draw it yourself", "this walk") never start an activity, a solo scene or a move',async()=>{
 const {scene,asked,out,state}=await play(['ada'],['"Leverage. Okay, that\'s a colder read than I had." I lean back. "So what\'s on the redo list?"','I nod slowly. "What would choosing look like, if you got to draw it yourself?"','I keep pace with her. "If this walk turns into something, you\'re not a consolation prize.']);
 for(const r of out)assert.ok(!r.clarification&&!r.error,r.clarification||r.error);
 assert.equal(state.scene?.id,scene,'same scene');assert.deepEqual(state.scene.characters,['ada']);assert.equal(asked,0,'no reinterpretation');assert.ok(!state.activityDayUses?.['hub-reading']);
});
test('mid-conversation, an activity named for someone who is not here ("the climbing wall") is scenery and never casts them',async()=>{
 const p=pack();p.activities.push({id:'cyra-wall',name:'Climbing wall with Cyra',description:'Ropes.',location:'hub',character:'cyra',duration:1,phrases:['climbing wall']});p.actors.find(a=>a.id==='cyra').location='meeting';
 const provider={name:'probe',async interpretScene(){return {characters:[],location:'hub',activity:'other',activityId:'cyra-wall'};},async generateScene(){return {lines:[{speaker:'ada',text:'Mm.'}]};}};
 const store=new Store();store.insert(createWorld(p,registry,'w'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{let r=await service.act('w',{id:'0',expectedRevision:0,input:'Talk to Ada'});const scene=r.state.scene.id;
  r=await service.act('w',{id:'1',expectedRevision:r.state.revision,input:'I lean on the climbing wall and wait for her answer.'});assert.ok(!r.clarification,r.clarification);
  assert.equal(r.state.scene?.id,scene);assert.deepEqual(r.state.scene.characters,['ada']);assert.ok(!Object.values(r.state.turns).at(-1).events.some(e=>e.type==='world.meetingRedirect'),'nobody is summoned');
 }finally{store.close();}
});
