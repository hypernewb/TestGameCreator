import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,execute,validatePack,replay} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {secrecyOf,suspicionOf} from '../packages/modules/secrecy.mjs';

const base=(extra={})=>{
 const p={schemaVersion:1,id:'test.agreements',version:'0.1.0',title:'Agreements test',subtitle:'agreement ladder',playerId:'player',calendar:'Shift',
  modules:{'social.conversation':'0.1.0','social.relationships':'0.1.0','social.dating':'0.1.0','social.secrecy':'0.2.0'},
  durations:{'social.askDate':0,'social.defineRelationship':0,'social.negotiateAgreement':0},
  locations:[{id:'flat',name:'Flat',description:'A private flat.',exits:[]}],
  actors:[
   {id:'player',name:'You',location:'flat',age:28,description:'An adult.',style:'Direct',goal:'Get by.'},
   {id:'jana',name:'Jana',location:'flat',age:27,description:'An adult.',style:'Warm',goal:'Trust.'},
   {id:'monique',name:'Monique',location:'flat',age:26,description:'An adult.',style:'Dry',goal:'Graduate.'}],
  datingProfiles:[
   {character:'jana',initialPhase:'exclusive',initialAgreement:'monogamous',agreements:['monogamous','open'],agreementGates:[{agreement:'open',minSatisfaction:60,satisfactionCost:-10}],thresholds:{crush:-100,date:-100,exclusive:-100}},
   {character:'monique',initialPhase:'available',thresholds:{crush:-100,date:-100,exclusive:-100}}]};
 return {...p,...extra};
};
const run=(p,seed=7)=>{let s=createWorld(p,registry,'agreements',seed);const act=(type,args={})=>{const r=execute(s,{id:`c${s.revision}`,type,args,actorId:p.playerId,expectedRevision:s.revision},p,registry);s=r.state;return r;};return {act,get s(){return s;}};};
const events=(s,type)=>s.events.filter(e=>e.type===type);

test('agreement changes cannot be toggled for free; cooldown and cost replay deterministically',()=>{
 const p=base({datingProfiles:[{character:'jana',initialPhase:'exclusive',initialAgreement:'monogamous',agreements:['monogamous','open'],agreementCooldownTicks:3,thresholds:{crush:-100,date:-100,exclusive:-100}}]}),c=run(p);
 c.act('social.negotiateAgreement',{character:'jana',agreement:'open'});
 const d=()=>c.s.modules['social.dating'].characters.jana;
 assert.equal(d().satisfaction,45);assert.equal(d().agreementCooldownUntil,3);
 const before=structuredClone(c.s);assert.throws(()=>c.act('social.negotiateAgreement',{character:'jana',agreement:'monogamous'}),/Give the current agreement time/);assert.deepEqual(c.s,before);
 for(let i=0;i<3;i++)c.act('core.wait');
 c.act('social.negotiateAgreement',{character:'jana',agreement:'monogamous'});
 assert.equal(d().agreement,'monogamous');assert.equal(d().satisfaction,40);
 assert.deepEqual(replay(createWorld(p,registry,'agreements',7),c.s.events).modules,c.s.modules);
});

test('agreement cooldown and costs are validated',()=>{
 for(const extra of [{agreementCooldownTicks:-1},{agreementCooldownTicks:1.5},{agreementSatisfactionCost:5}]){
  const p=base();Object.assign(p.datingProfiles[0],extra);assert.throws(()=>validatePack(p,registry),/agreement (?:cooldown|cost) invalid/);
 }
});

test('an agreement gate blocks negotiation until the relationship earns it, then costs satisfaction',()=>{
 const p=base(),c=run(p);
 assert.throws(()=>c.act('social.negotiateAgreement',{character:'jana',agreement:'open'}),/firmer ground/);
 const before=c.s.modules['social.dating'].characters.jana.satisfaction;
 // satisfy the gate by authoring it lower in a second world
 const p2=base({datingProfiles:[{character:'jana',initialPhase:'exclusive',initialAgreement:'monogamous',agreements:['monogamous','open'],agreementGates:[{agreement:'open',minSatisfaction:40,satisfactionCost:-10}],thresholds:{crush:-100,date:-100,exclusive:-100}},{character:'monique',initialPhase:'available',thresholds:{crush:-100,date:-100,exclusive:-100}}]});
 const c2=run(p2);
 c2.act('social.negotiateAgreement',{character:'jana',agreement:'open'});
 assert.equal(c2.s.modules['social.dating'].characters.jana.agreement,'open');
 assert.equal(c2.s.modules['social.dating'].characters.jana.satisfaction,before-10);
 assert.equal(events(c2.s,'social.agreementNegotiated').length,1);
});

test('defining a relationship is monogamy-only; other agreements negotiate in person',()=>{
 const p=base(),c=run(p);
 assert.throws(()=>c.act('social.defineRelationship',{character:'monique',agreement:'open'}),/negotiated in person/);
 c.act('social.askDate',{character:'monique'});
 c.act('social.defineRelationship',{character:'monique',agreement:'monogamous'});
 assert.equal(c.s.modules['social.dating'].characters.monique.phase,'exclusive');
 // committing to a second monogamous partner while exclusive elsewhere auto-secrets
 assert.equal(secrecyOf(c.s,'monique').visibility,'secret');
});

test('negotiating with the affair partner does not unsecret the edge',()=>{
 const p=base({datingProfiles:[
  {character:'jana',initialPhase:'exclusive',initialAgreement:'monogamous',thresholds:{crush:-100,date:-100,exclusive:-100}},
  {character:'monique',initialPhase:'available',agreements:['monogamous','open'],agreementGates:[{agreement:'open',minSatisfaction:40}],thresholds:{crush:-100,date:-100,exclusive:-100}}]});
 const c=run(p);
 c.act('social.askDate',{character:'monique'});
 assert.equal(secrecyOf(c.s,'monique').visibility,'secret');
 c.act('social.negotiateAgreement',{character:'monique',agreement:'open'});
 assert.equal(secrecyOf(c.s,'monique').visibility,'secret');
 assert.equal(c.s.modules['social.dating'].characters.monique.agreement,'open');
});

test('agreement gates are validated',()=>{
 const bad=[
  {datingProfiles:[{character:'jana',agreements:['monogamous'],agreementGates:[{agreement:'open'}],thresholds:{crush:-100,date:-100,exclusive:-100}}]},
  {datingProfiles:[{character:'jana',agreements:['monogamous','open'],agreementGates:[{agreement:'open',minSatisfaction:500}],thresholds:{crush:-100,date:-100,exclusive:-100}}]},
  {datingProfiles:[{character:'jana',agreements:['monogamous','open'],agreementGates:[{agreement:'open',satisfactionCost:10}],thresholds:{crush:-100,date:-100,exclusive:-100}}]},
  {datingProfiles:[{character:'jana',agreements:['monogamous','open'],agreementGates:[{agreement:'open',minStage:'BAD KEY'}],thresholds:{crush:-100,date:-100,exclusive:-100}}]},
  {datingProfiles:[{character:'jana',agreements:['monogamous','open'],agreementGates:[{agreement:'open'},{agreement:'open'}],thresholds:{crush:-100,date:-100,exclusive:-100}}]}];
 for(const extra of bad)assert.throws(()=>validatePack(base(extra),registry),/agreement gate/i);
 assert.doesNotThrow(()=>validatePack(base(),registry));
});
