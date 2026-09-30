import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createWorld,execute} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';

// Venus rebase (2026-09-30): every typed turn is a model scene with the people present; systems feed the prompt instead of replacing it.
const load=n=>JSON.parse(readFileSync(new URL(`../packs/${n}.json`,import.meta.url)));
const serve=(p,id,provider)=>{const store=new Store();store.insert(createWorld(p,registry,id));return {store,service:new GameService(store,{[p.id]:p},registry,provider)};};
const probe=(cast=[])=>({name:'probe',contexts:[],async interpretScene(){return {characters:cast,location:null,activity:'explore'};},async generateScene(c){this.contexts.push(c);return {lines:[{speaker:c.stagedCast[0]||'',text:'Hi.'}]};},async generateLedger(){return [];}});

test('an activity with company costs part of its stat gain, and says so',()=>{
 const p=load('campus'),run=company=>{const w=structuredClone(createWorld(p,registry,'gym'));for(const [id,a] of Object.entries(w.actors))a.location=id===p.playerId||id===company?'hewett':a.location==='hewett'?'langley':a.location;
  const before=w.modules['character.stats'].values['player--fitness'],r=execute(w,{id:'w',actorId:p.playerId,type:'core.scene',args:{text:'Work out.',location:'hewett',characters:company?[company]:[],activity:'other',activityId:'workout'},expectedRevision:w.revision},p,registry);
  return {gain:r.state.modules['character.stats'].values['player--fitness']-before,done:r.turn.events.find(e=>e.type==='world.activityCompleted')};};
 const alone=run(null),social=run('nova');assert.equal(alone.gain,2);assert.equal(social.gain,1);
 assert.deepEqual(social.done.payload.company,['nova']);assert.match(social.done.payload.text,/counts for less/);assert.ok(!alone.done.payload.company);
});

test('with no scene open, "her" and "them" mean the one person standing here',async()=>{
 for(const input of ['Flirt with her','Go introduce yourself to them']){const provider=probe(),{store,service}=serve(load('neutral'),'here',provider);
  try{const r=await service.act('here',{id:'t',expectedRevision:0,input});assert.ok(!r.clarification,input);assert.equal(r.state.actors.player.location,'hub');assert.deepEqual(r.state.scene.characters,['ada'],input);assert.equal(provider.contexts.length,1);}finally{store.close();}}
});

test('"them" with nobody here still asks who you mean',async()=>{
 const p=load('neutral');p.actors.find(a=>a.id==='ada').location='meeting';const provider=probe(),{store,service}=serve(p,'empty',provider);
 try{const r=await service.act('empty',{id:'t',expectedRevision:0,input:'Talk to them'});assert.match(r.clarification,/Nobody else is here/);assert.equal(provider.contexts.length,0);}finally{store.close();}
});

test('"go find Brin" walks to where she is and opens the scene with her',async()=>{
 const provider=probe(['brin']),{store,service}=serve(load('neutral'),'find',provider);
 try{const r=await service.act('find',{id:'t',expectedRevision:0,input:'Go find Brin'});assert.equal(r.state.actors.player.location,'workshop');assert.deepEqual(r.state.scene.characters,['brin']);assert.equal(provider.contexts.length,1);}finally{store.close();}
});

test('a solo scene tells the model who else is around, as bystanders',()=>{
 const p=load('neutral'),context={stagedCast:[],scenePhase:'opening',sceneHistory:[],playerAction:'I stretch.',location:p.locations[0],present:[{id:'player',name:'You'},{id:'ada',name:'Ada'}]};
 const all=scenePromptMessages(context,p).map(m=>m.content).join('\n');assert.match(all,/"bystanders":\["Ada"\]/);assert.match(all,/Bystanders may be glimpsed[^.]*do not speak/);
});

test('no passive drift: getting fit alone does not move Jana until she spends time with you',()=>{
 const p=load('campus');let w=structuredClone(createWorld(p,registry,'drift'));for(const [id,a] of Object.entries(w.actors))a.location=id===p.playerId?'hewett':a.location==='hewett'?'langley':a.location;w.modules['character.stats'].values['player--fitness']=5;
 const act=(type,args)=>{w=execute(w,{id:`d${w.revision}`,actorId:p.playerId,type,args,expectedRevision:w.revision},p,registry).state;},score=()=>w.modules['social.dating'].characters.jana.score;
 const before=score();act('core.scene',{text:'Work out.',location:'hewett',characters:[],activity:'other',activityId:'workout'});assert.ok(w.modules['character.stats'].values['player--fitness']>=6);assert.equal(score(),before,'she was not there to see it');
 if(w.scene)act('core.endScene');w=structuredClone(w);w.actors.jana.location='hewett';act('core.scene',{text:'Hey Jana.',location:'hewett',characters:['jana'],activity:'talk'});assert.ok(score()>=before+10,'now she notices');
});

test('a drop-in encounter during a solo explore joins the scene cast instead of being told it cannot arrive',async()=>{
 const p=load('campus');p.schedules=[];p.momentsProfile={...p.momentsProfile,chancePercent:100,perDay:9,generate:false};p.moments=p.actors.filter(a=>a.id!==p.playerId).map(a=>({id:`drop-${a.id}`,kind:'encounter',character:a.id,text:'{name} spots you at {place} and comes over.'}));
 const provider=probe(),{store,service}=serve(p,'drop',provider);
 try{const r=await service.act('drop',{id:'t',expectedRevision:0,input:'I look around.'}),turn=Object.values(r.state.turns).at(-1),met=turn.events.find(e=>e.type==='world.moment')?.payload.character;
  assert.ok(met,'an encounter fired');const c=provider.contexts[0];assert.ok(c.stagedCast.includes(met));assert.ok(!c.absentCharacters.some(a=>a.id===met));assert.equal(c.scenePhase,'opening');}finally{store.close();}
});

test('campus finds are present-tense discoveries, not invented history',()=>{
 for(const m of load('campus').moments.filter(m=>m.kind==='find'))assert.doesNotMatch(m.text,/\b(last week|yesterday|you handed|you fixed|for fixing)\b/i,m.id);
});

test('the late-night text comes from the rival, and only lands in the Evening',async()=>{
 const {readPack}=await import('../packages/cards/director-library.mjs'),{conditionReasons}=await import('../packages/modules/conditions.mjs');
 const p=readPack(fileURLToPath(new URL('../packs/campus.json',import.meta.url))),w=createWorld(p,registry,'late');
 for(const c of p.directorProfile.complications.filter(c=>c.template==='late-text')){const m=p.phoneMessages.find(m=>m.id===`${c.id}.message`);assert.equal(m.character,c.roles.rival,c.id);
  for(const edge of Object.keys(w.modules['social.relationships'].edges))w.modules['social.relationships'].edges[edge]=50;
  const at=tick=>conditionReasons(c.when,{...w,tick},p);assert.ok(at(0).some(r=>/Daypart/.test(r)),'not in the morning');assert.deepEqual(at(8),[],'evening is fine');}
 for(const m of p.phoneMessages.filter(m=>m.directorTemplate&&m.directorTemplate!=='late-text'))assert.ok(p.directorProfile.complications.concat(p.directorProfile.opportunities||[]).some(c=>`${c.id}.message`===m.id&&c.roles.lead===m.character),m.id);
});

test('"Skip to Evening" waits to the start of the next evening and still counts as a wait',()=>{
 const p=load('campus'),w=createWorld(p,registry,'skip'),n=p.daypart?.interval||4;
 const r=execute(w,{id:'s',actorId:p.playerId,type:'core.wait',args:{until:'Evening'},expectedRevision:w.revision},p,registry);
 assert.equal(r.state.tick,2*n);assert.equal(r.state.actors[p.playerId].location,w.actors[p.playerId].location,'no teleport');
 assert.match(r.turn.events.find(e=>e.type==='core.waited').payload.text,/until evening/);
 const again=execute(r.state,{id:'s2',actorId:p.playerId,type:'core.wait',args:{until:'Evening'},expectedRevision:r.state.revision},p,registry);assert.equal(again.state.tick,5*n,'already evening: the next one');
 assert.throws(()=>execute(w,{id:'s3',actorId:p.playerId,type:'core.wait',args:{until:'Midnight'},expectedRevision:w.revision},p,registry),/Unknown part of the day/);
});

test('the hub\'s Skip button reaches the engine through the service with its daypart intact',async()=>{
 const p=load('campus'),provider=probe(),{store,service}=serve(p,'skipsvc',provider);
 try{const r=await service.act('skipsvc',{id:'k',expectedRevision:0,command:{type:'core.wait',args:{until:'Evening'}}});assert.equal(r.state.tick,2*(p.daypart?.interval||4));assert.equal(provider.contexts.length,0,'a button wait needs no model call');}finally{store.close();}
});
