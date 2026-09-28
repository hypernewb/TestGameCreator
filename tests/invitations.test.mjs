import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {inviteDecision,parseInvite} from '../packages/modules/social.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';

const pack=(extra={})=>{const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));p.gameProject={...JSON.parse(readFileSync(new URL('../packs/crossed-plans.json',import.meta.url))).gameProject,...extra};delete p.schedules;return p;};
const run=(p,id)=>{let state=createWorld(p,registry,id);const act=(type,args={})=>{const r=execute(state,{id:`${id}-${state.revision}`,actorId:p.playerId,type,args,expectedRevision:state.revision},p,registry);state=r.state;return r;};return {act,get state(){return state;}};};
const where=(s,id)=>s.actors[id].location;

test('an accepted invitation moves both characters, opens a scene with the guest, and sends them home when it ends',()=>{
 const c=run(pack(),'inv');c.act('core.scene',{text:'Hi Ada.',location:'hub',characters:['ada'],activity:'talk'});
 const r=c.act('social.invite',{character:'ada',to:'workshop'});
 assert.equal(where(c.state,'player'),'workshop');assert.equal(where(c.state,'ada'),'workshop');
 assert.deepEqual(c.state.scene.characters,['ada']);assert.equal(c.state.scene.location,'workshop');assert.equal(c.state.tick,1,'only the walk costs time');
 assert.match(r.turn.events.find(e=>e.type==='social.inviteAccepted').payload.text,/Ada agrees and goes with you to Workshop/);
 c.act('core.endScene');assert.equal(c.state.scene,null);assert.equal(where(c.state,'ada'),'hub');assert.equal(where(c.state,'player'),'workshop');assert.equal(c.state.tick,4);
});

test('a declined invitation moves nobody and costs no time',()=>{
 const p=pack();p.locations.find(l=>l.id==='workshop').owner='player';const c=run(p,'no');
 const r=c.act('social.invite',{character:'ada',to:'workshop'});const e=r.turn.events.find(e=>e.type==='social.inviteDeclined');
 assert.equal(e.payload.reason,'trust');assert.match(e.payload.text,/private/);assert.equal(where(c.state,'ada'),'hub');assert.equal(where(c.state,'player'),'hub');assert.equal(c.state.tick,0);assert.equal(c.state.scene,null);
 p.initialRelationships=[{character:'ada',trust:45}];assert.equal(inviteDecision(createWorld(p,registry,'yes'),p,'ada','workshop').ok,true,'enough trust for a private place');
});

test('invitations are refused when the NPC is absent, busy, estranged or at a boundary',()=>{
 const p=pack();p.locations.find(l=>l.id==='workshop').private=true;p.initialRelationships=[{character:'ada',trust:60}];const s=createWorld(p,registry,'why');
 assert.equal(inviteDecision(s,p,'brin','meeting').reason,'absent');
 const busy=structuredClone(p);busy.schedules=[{actor:'ada',period:12,stops:[{at:2,location:'meeting'}]}];
 const d=inviteDecision(createWorld(busy,registry,'busy'),busy,'ada','workshop');assert.equal(d.reason,'busy');assert.match(d.text,/Meeting Room/);
 assert.equal(inviteDecision(createWorld(busy,registry,'busy'),busy,'ada','meeting').ok,true,'going where she is due anyway is fine');
 const broken=structuredClone(s);broken.modules['social.dating']={characters:{ada:{phase:'broken'}}};assert.equal(inviteDecision(broken,p,'ada','meeting').reason,'relationship');
 const wary=structuredClone(s);wary.modules['social.intimacy']={characters:{ada:{consent:{kiss:{status:'declined',atTick:0}}}}};
 assert.equal(inviteDecision(wary,p,'ada','workshop').reason,'boundary');assert.equal(inviteDecision(wary,p,'ada','meeting').ok,true,'a public place is still fine');
 assert.throws(()=>inviteDecision(s,p,'ada','hub'),/already/);
});

test('typed invitations are recognised; talk about places is not',()=>{
 const p=pack();p.locations.find(l=>l.id==='workshop').owner='player';const s=createWorld(p,registry,'parse');
 assert.deepEqual(parseInvite(s,p,'Ada, come to my room.'),{character:'ada',to:'workshop'});
 assert.deepEqual(parseInvite(s,p,'Ada, do you want to come over to the meeting room?'),{character:'ada',to:'meeting'});
 assert.deepEqual(parseInvite(s,p,'invite Ada to the Meeting Room'),{character:'ada',to:'meeting'});
 assert.equal(parseInvite(s,p,"Let's go to the workshop"),null,'no one to go with outside a scene');
 const scene={...s,scene:{id:'x',location:'hub',characters:['ada'],activity:'talk',startedTick:0}};
 assert.deepEqual(parseInvite(scene,p,"Let's go to the workshop"),{character:'ada',to:'workshop'});
 assert.equal(parseInvite(s,p,"I'm nervous about the meeting room."),null);assert.equal(parseInvite(s,p,'Ada, come to the moon.'),null);
});

test('the service turns a typed invitation into a committed move before any narration',async()=>{
 const p=pack();const provider={name:'probe',async generateScene(){return {lines:[{speaker:'ada',text:'Lead the way.'}]};}};
 const store=new Store();store.insert(createWorld(p,registry,'svc'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{
  const r=await service.act('svc',{id:'ask',expectedRevision:0,input:'Ada, come with me to the meeting room.'});
  assert.equal(r.turn.command.type,'social.invite');assert.equal(where(r.state,'ada'),'meeting');assert.equal(where(r.state,'player'),'meeting');assert.deepEqual(r.state.scene.characters,['ada']);
 }finally{store.close();}
});

test('a declined invitation mid-scene is reported by the rules, never narrated as a yes, and the scene carries on',async()=>{
 const p=pack();p.locations.find(l=>l.id==='workshop').owner='player';const provider={name:'probe',async generateScene(){return {lines:[{speaker:'ada',text:'Sure, lead on.'}]};}};
 const store=new Store();store.insert(createWorld(p,registry,'dec'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{
  let r=await service.act('dec',{id:'hi',expectedRevision:0,command:{type:'core.scene',args:{text:'Hi Ada.',location:'hub',characters:['ada'],activity:'talk'}}});const scene=r.state.scene.id;
  r=await service.act('dec',{id:'ask',expectedRevision:r.state.revision,input:'Ada, come to my room.'});
  assert.equal(r.turn.narrative,"Ada isn't comfortable going somewhere that private with you yet.");assert.equal(r.state.scene?.id,scene);assert.equal(where(r.state,'player'),'hub');assert.equal(r.state.tick,0);
 }finally{store.close();}
});
