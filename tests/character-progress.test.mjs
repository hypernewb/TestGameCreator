import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';

const pack=(extra={})=>{const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));p.gameProject={...JSON.parse(readFileSync(new URL('../packs/crossed-plans.json',import.meta.url))).gameProject,...extra};delete p.schedules;return p;};
const run=(p,id)=>{let state=createWorld(p,registry,id);const act=(type,args={})=>{const r=execute(state,{id:`${id}-${state.revision}`,actorId:p.playerId,type,args,expectedRevision:state.revision},p,registry);state=r.state;return r;};return {act,get state(){return state;}};};
const where=(s,id)=>s.actors[id].location;
import {characterProgress,statChanges} from '../packages/core/character-progress.mjs';

test('the overview shows location, availability, stage and memories; raw stats only in test mode',()=>{
 const p=pack();p.dialogueReactions=[{id:'thank-ada',character:'ada',phrases:['thank you'],trustDelta:5}];p.initialRelationships=[{character:'ada',trust:30}];const c=run(p,'prog');
 c.act('core.scene',{text:'Hi Ada.',location:'hub',characters:['ada'],activity:'talk'});
 const r=c.act('core.scene',{text:'Thank you, really.',location:'hub',characters:['ada'],activity:'continue'});
 const [change]=statChanges(r.turn);assert.equal(change.text,'Ada warms considerably toward you. ♥');assert.match(change.rawText,/^Ada: Trust \d+ → \d+$/);assert.equal(change.delta,5);
 const ada=characterProgress(c.state,p).find(x=>x.id==='ada');
 assert.equal(ada.availability,'With you now');assert.equal(ada.location.id,'hub');assert.equal(ada.stage,'Friendly');assert.equal(ada.stats,null);
 assert.equal(ada.description,p.actors.find(x=>x.id==='ada').description||'');assert.equal(ada.pronouns,p.actors.find(x=>x.id==='ada').pronouns||'');
 assert.equal(ada.recent[0],change.text);assert.deepEqual(ada.progress,{hearts:1,max:5,teaser:'Keep interacting to see where this relationship goes.'});
 assert.equal(characterProgress(c.state,p,{test:true}).find(x=>x.id==='ada').stats.Trust,c.state.modules['social.relationships'].edges['ada--player']);
 const brin=characterProgress(c.state,p).find(x=>x.id==='brin');assert.equal(brin.availability,'Away');assert.equal(brin.location,null);assert.deepEqual(brin.recent,[]);
 p.gameProject.characterLocationVisibility='always';assert.match(characterProgress(c.state,p).find(x=>x.id==='brin').availability,/^At /);
});

test('promises, preferences from the turn ledger, and creator-visible schedules appear in the overview',()=>{
 const p=pack();p.gameProject.characterScheduleVisibility='always';p.modules['world.schedule']??='1.0.0';p.schedules=[{actor:'ada',period:12,stops:[{at:4,location:'workshop'}]}];const c=run(p,'prog2');
 const s=structuredClone(c.state);s.modules['social.conversation'].memories.push({id:'m1',tick:0,knownBy:['player','ada'],text:'You promised Ada a coffee.',promise:true},{id:'m2',tick:0,knownBy:['player','ada'],text:'Ada talked about her sister.'});
 s.turns.fake={ledger:[{charKey:'ada',type:'liked',desc:'strong coffee'},{charKey:'brin',type:'disliked',desc:'noise'}],events:[]};
 const ada=characterProgress(s,p).find(x=>x.id==='ada');
 assert.deepEqual(ada.promises,[{text:'You promised Ada a coffee.',status:'made'}]);assert.deepEqual(ada.memories,['Ada talked about her sister.']);
 assert.deepEqual(ada.preferences,['Likes strong coffee']);assert.equal(ada.next.location.id,'workshop');assert.equal(ada.next.tick,4);
});

test('player progress uses hearts, named ranks, and an authored next-scene teaser without thresholds',()=>{const p=pack();p.modules['social.dating']='0.1.0';p.modules['social.romance-tempo']='0.2.0';p.modules['story.scenes']='0.1.0';p.datingProfiles=[{character:'ada',initialChemistry:20,initialPhase:'crush',agreements:['monogamous'],thresholds:{crush:10,date:30,exclusive:60},preferences:[],signals:[]}];p.romanceTempoProfiles=[{character:'ada',ranks:[{id:'spark',name:'First spark',points:0,ceiling:5},{id:'trusted',name:'Trusted',points:5,ceiling:20,scene:'ada-trust'}],gifts:{preferences:[]}}];p.scriptedScenes=[{id:'ada-trust',title:'A quiet confession',opening:'Ada waits.',trigger:{event:'social.romanceRankReady',match:{character:'ada',rank:'trusted'}},choices:[{id:'listen',label:'Listen',effects:[]}]}];validatePack(p,registry);const ada=characterProgress(createWorld(p,registry,'hearts'),p).find(x=>x.id==='ada');assert.equal(ada.stage,'First spark');assert.deepEqual(ada.progress,{hearts:1,max:2,teaser:'Next: Trusted — A quiet confession'});assert.doesNotMatch(JSON.stringify(ada.progress),/5|20/);});

test('character overview visibility settings reject unsupported values',()=>{
 const p=pack();p.gameProject.characterLocationVisibility='clairvoyant';assert.throws(()=>validatePack(p,registry),/characterLocationVisibility/);
 p.gameProject.characterLocationVisibility='present';p.gameProject.characterScheduleVisibility='sometimes';assert.throws(()=>validatePack(p,registry),/characterScheduleVisibility/);
});

test('location aliases are short and unambiguous',()=>{
 const p=pack();p.locations[0].aliases=['common room'];p.locations[1].aliases=['COMMON ROOM'];assert.throws(()=>validatePack(p,registry),/ambiguous/);
 p.locations[1].aliases=['work bay'];assert.doesNotThrow(()=>validatePack(p,registry));
});
