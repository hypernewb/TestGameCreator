import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
 import {secrecy,knowsAbout,secrecyOf,secrecyContext} from '../packages/modules/secrecy.mjs';

const base=(extra={})=>{
 const p={schemaVersion:1,id:'test.secrecy',version:'0.1.0',title:'Secrets test',subtitle:'secrecy module',playerId:'player',calendar:'Shift',
  modules:{'social.conversation':'0.1.0','social.relationships':'0.1.0','social.dating':'0.1.0','social.secrecy':'0.2.0'},
  durations:{'social.keepSecret':0,'social.revealRelationship':0},
  locations:[
   {id:'dorm',name:'Dorm',description:'A small shared room.',exits:[{to:'library'}]},
   {id:'library',name:'Library',description:'Quiet stacks.',exits:[{to:'dorm'}]}],
  actors:[
   {id:'player',name:'You',location:'dorm',description:'An adult student.',style:'Direct',goal:'Graduate.'},
   {id:'jana',name:'Jana',location:'dorm',description:'An adult classmate.',style:'Warm',goal:'Pass her exams.'},
   {id:'abigail',name:'Abigail',location:'dorm',description:'An adult classmate.',style:'Dry',goal:'Finish her thesis.'},
   {id:'monique',name:'Monique',location:'library',description:'An adult classmate.',style:'Careful',goal:'Keep to herself.'}],
  datingProfiles:[
   {character:'jana',initialPhase:'dating',thresholds:{crush:-100,date:-100,exclusive:-100}},
   {character:'monique',initialPhase:'dating',thresholds:{crush:-100,date:-100,exclusive:-100}}]};
 return {...p,...extra};
};
const run=(p,seed=7)=>{let s=createWorld(p,registry,'secrecy',seed);const act=(type,args={})=>{const r=execute(s,{id:`c${s.revision}`,type,args,actorId:p.playerId,expectedRevision:s.revision},p,registry);s=r.state;return r;};return {act,get s(){return s;}};};
const events=(s,type)=>s.events.filter(e=>e.type===type);

test('a relationship can be kept secret, and only witnesses of the reveal learn of it',()=>{
 const p=base();const c=run(p);
 c.act('social.keepSecret',{character:'jana'});
 let edge=secrecyOf(c.s,'jana');assert.equal(edge.visibility,'secret');assert.deepEqual(edge.knownBy,[]);
 const [hidden]=events(c.s,'social.relationshipHidden');assert.equal(hidden.payload.character,'jana');assert.deepEqual(hidden.visibility,['player','jana']);
 assert.ok(secrecy.panel(c.s,p).lines.some(x=>x==='Jana: secret · known by nobody'));
 assert.throws(()=>c.act('social.keepSecret',{character:'jana'}),/already a secret/);
 assert.ok(secrecy.actions(c.s,p).some(x=>x.type==='social.revealRelationship'&&x.args.character==='jana'));
 c.act('core.move',{to:'library'});
 assert.throws(()=>c.act('social.revealRelationship',{character:'jana'}),/together/);
 c.act('core.move',{to:'dorm'});
 c.act('social.revealRelationship',{character:'jana'});
 assert.ok(secrecy.actions(c.s,p).some(x=>x.type==='social.keepSecret'&&x.args.character==='jana'));
 edge=secrecyOf(c.s,'jana');assert.equal(edge.visibility,'public');assert.deepEqual(edge.knownBy,['abigail']);
 const [revealed]=events(c.s,'social.relationshipRevealed');assert.deepEqual(revealed.payload.witnesses,['abigail']);
 assert.ok(revealed.visibility.includes('abigail')&&!revealed.visibility.includes('monique'));
 assert.ok(knowsAbout(c.s,'jana','abigail'));assert.ok(!knowsAbout(c.s,'jana','monique'));
 assert.ok(!secrecy.panel(c.s,p).lines.some(x=>x.startsWith('Jana:')));
 assert.deepEqual(secrecyContext(c.s,p,'abigail').secrets.map(x=>x.character),['jana']);
 assert.deepEqual(secrecyContext(c.s,p,'monique').secrets,[]);
 assert.deepEqual(secrecyContext(c.s,p,'player').secrets,[]);
});

test('initial secrets come authored with known-by lists that persist through a reveal',()=>{
 const p=base({initialSecrets:[{character:'jana',knownBy:['abigail']}]});const c=run(p);
 assert.equal(secrecyOf(c.s,'jana').visibility,'secret');assert.deepEqual(secrecyOf(c.s,'jana').knownBy,['abigail']);
 assert.ok(c.s.modules['social.secrecy'].edges.jana);
 c.act('social.revealRelationship',{character:'jana'});
 assert.deepEqual(secrecyOf(c.s,'jana').knownBy,['abigail']);
});

test('initial secret authoring is validated',()=>{
 for(const bad of [{initialSecrets:[{character:'abigail'}]},{initialSecrets:[{character:'jana',knownBy:['player']}]},{initialSecrets:[{character:'jana',knownBy:['moon']}]},{initialSecrets:[{character:'jana',knownBy:['jana']}]},{initialSecrets:[{character:'jana'},{character:'jana'}]}])
  assert.throws(()=>validatePack(base(bad),registry),/initial secret/i);
 assert.doesNotThrow(()=>validatePack(base({initialSecrets:[{character:'jana',knownBy:['abigail']}]}),registry));
});

test('secrecy state replays deterministically',()=>{
 const p=base();const play=seed=>{const c=run(p,seed);c.act('social.keepSecret',{character:'jana'});c.act('core.move',{to:'library'});c.act('core.move',{to:'dorm'});c.act('social.revealRelationship',{character:'jana'});return c.s;};
 const a=play(11),b=play(11);
 assert.deepEqual(a.modules['social.secrecy'],b.modules['social.secrecy']);
 assert.deepEqual(a.events.map(e=>[e.type,e.payload,e.visibility]),b.events.map(e=>[e.type,e.payload,e.visibility]));
});
