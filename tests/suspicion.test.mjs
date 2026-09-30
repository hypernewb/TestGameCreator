import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {secrecy,secrecyOf,suspicionOf,evidenceOf} from '../packages/modules/secrecy.mjs';

const base=(extra={})=>{
 const p={schemaVersion:1,id:'test.suspicion',version:'0.1.0',title:'Suspicion test',subtitle:'suspicion module',playerId:'player',calendar:'Shift',
  modules:{'social.conversation':'0.1.0','social.relationships':'0.1.0','social.dating':'0.1.0','social.secrecy':'0.2.0','social.intimacy':'0.1.0'},
  durations:{'social.keepSecret':0,'social.revealRelationship':0,'social.askDate':0,'social.requestIntimacy':0,'social.beginIntimacy':0,'social.confront':0,'social.resolveConfrontation':0},
  locations:[
   {id:'flat',name:'Flat',description:'A private flat.',exits:[{to:'cafe'}]},
   {id:'cafe',name:'Cafe',description:'A busy cafe.',exits:[{to:'flat'}]}],
  actors:[
   {id:'player',name:'You',location:'flat',age:28,description:'An adult student.',style:'Direct',goal:'Get by.'},
   {id:'jana',name:'Jana',location:'flat',age:27,description:'An adult partner.',style:'Warm',goal:'Trust.'},
   {id:'monique',name:'Monique',location:'flat',age:26,description:'An adult classmate.',style:'Dry',goal:'Graduate.'}],
  datingProfiles:[
   {character:'jana',initialPhase:'exclusive',initialAgreement:'monogamous',thresholds:{crush:-100,date:-100,exclusive:-100}},
   {character:'monique',initialPhase:'available',thresholds:{crush:-100,date:-100,exclusive:-100}}],
  intimacySettings:{difficulty:'easy',contentLevel:'suggestive',privateLocations:['flat']},
  intimacyCategories:[{id:'kiss',name:'Kiss',privacy:'semi-private',resolution:'direct',defaultOutcome:'positive'}],
  intimacyProfiles:[{character:'monique',openness:100,casual:false,consentPolicy:'threshold',allowedCategories:['kiss'],blockedCategories:[],interests:[],stylePreferences:[],aftercarePreferences:[]}]};
 return {...p,...extra};
};
const run=(p,seed=7)=>{let s=createWorld(p,registry,'suspicion',seed);const act=(type,args={})=>{const r=execute(s,{id:`c${s.revision}`,type,args,actorId:p.playerId,expectedRevision:s.revision},p,registry);s=r.state;return r;};return {act,get s(){return s;}};};
const events=(s,type)=>s.events.filter(e=>e.type===type);
const startAffair=c=>{c.act('social.askDate',{character:'monique'});c.act('social.requestIntimacy',{character:'monique',category:'kiss'});c.act('social.beginIntimacy',{character:'monique',category:'kiss'});};

test('an affair is auto-secret, witnessed intimacy becomes hard evidence, and she leaves at the deadline',()=>{
 const p=base(),c=run(p);
 c.act('social.askDate',{character:'monique'});
 assert.equal(secrecyOf(c.s,'monique').visibility,'secret');
 assert.equal(events(c.s,'social.affairStarted').length,1);
 startAffair(c);
 let susp=suspicionOf(c.s,'jana','player');assert.equal(susp.score,45);assert.equal(susp.status,'calm');
 assert.equal(evidenceOf(c.s,'jana','player')[0].strength,'hard');
 c.act('social.requestIntimacy',{character:'monique',category:'kiss'});
 c.act('social.beginIntimacy',{character:'monique',category:'kiss'});
 susp=suspicionOf(c.s,'jana','player');assert.equal(susp.score,90);assert.equal(susp.status,'pending');
 assert.equal(events(c.s,'social.suspicionSurfaced').length,1);
 assert.ok(secrecy.actions(c.s,p).some(x=>x.type==='social.confront'&&x.args.character==='jana'));
 c.act('social.confront',{character:'jana'});
 c.act('social.resolveConfrontation',{character:'jana',stance:'deny'});
 assert.equal(events(c.s,'social.confrontationResolved').at(-1).payload.outcome,'caught');
 assert.equal(suspicionOf(c.s,'jana','player').status,'pending');
 for(let i=0;i<25&&!events(c.s,'social.secretCaught').length;i++)c.act('core.wait');
 assert.equal(c.s.modules['social.dating'].characters.jana.phase,'broken');
 assert.equal(events(c.s,'social.secretCaught').length,1);
});

test('admitting during the confrontation resolves it without a breakup',()=>{
 const p=base(),c=run(p);
 startAffair(c);c.act('social.requestIntimacy',{character:'monique',category:'kiss'});c.act('social.beginIntimacy',{character:'monique',category:'kiss'});
 const before=c.s.modules['social.dating'].characters.jana.satisfaction;
 c.act('social.confront',{character:'jana'});
 c.act('social.resolveConfrontation',{character:'jana',stance:'admit'});
 assert.equal(events(c.s,'social.confrontationResolved').at(-1).payload.outcome,'admitted');
 assert.equal(suspicionOf(c.s,'jana','player').status,'admitted');assert.equal(suspicionOf(c.s,'jana','player').score,0);
 assert.equal(c.s.modules['social.dating'].characters.jana.satisfaction,before-25);
 for(let i=0;i<25;i++)c.act('core.wait');
 assert.equal(c.s.modules['social.dating'].characters.jana.phase,'exclusive');
 assert.equal(events(c.s,'social.secretCaught').length,0);
});

test('authored rules and believed rumors add soft evidence through the same gates',()=>{
 const p=base({suspicionRules:[{id:'flaunt',event:'social.spoke',match:{target:'monique'},weight:40,summary:'too cozy with Monique in public',seedFrom:'visibility'}]});
 const c=run(p,7);const s=c.s;
 let emitted=[];const set=(keys,value)=>{let node=s;for(const key of keys.slice(0,-1))node=node[key];node[keys.at(-1)]=value;};
 const tx={state:s,pack:p,set,emit:(type,payload,visibility)=>emitted.push({type,payload,visibility})};
 secrecy.react(tx,{id:'e1',type:'social.spoke',payload:{target:'monique'},visibility:['player','jana']});
 let susp=suspicionOf(s,'jana','player');assert.equal(susp.score,40);assert.equal(susp.status,'calm');
 assert.equal(evidenceOf(s,'jana','player')[0].strength,'soft');
 secrecy.react(tx,{id:'e2',type:'social.rumorBelieved',payload:{subject:'player',character:'jana',summary:'you and Monique were seen kissing'}});
 susp=suspicionOf(s,'jana','player');assert.equal(susp.score,55);
 secrecy.react(tx,{id:'e3',type:'social.spoke',payload:{target:'monique'},visibility:['player','jana']});
 susp=suspicionOf(s,'jana','player');assert.equal(susp.score,95);assert.equal(susp.status,'pending');
 // an open partner is exempt from suspicion entirely
 tx.state.modules['social.dating'].characters.jana.agreement='open';
 secrecy.react(tx,{id:'e4',type:'social.spoke',payload:{target:'monique'},visibility:['player','jana']});
 assert.equal(suspicionOf(s,'jana','player').score,95); // unchanged by e4
});

test('suspicion authoring is validated',()=>{
 const bad=[
  {suspicionSettings:{curiousAt:80,confrontAt:30}},
  {suspicionSettings:{decayPerTick:0}},
  {suspicionProfiles:[{character:'abigail'}]},
  {suspicionProfiles:[{character:'monique',confrontAt:10,curiousAt:50}]},
  {suspicionRules:[{id:'x',event:'core.timeAdvanced',weight:10,summary:'x'}]},
  {suspicionRules:[{id:'x',event:'social.spoke',weight:0,summary:'x'}]},
  {suspicionRules:[{id:'x',event:'social.spoke',weight:10,summary:''}]},
  {suspicionRules:[{id:'x',event:'social.spoke',weight:10,summary:'ok',strength:'brutal'}]}];
 for(const extra of bad)assert.throws(()=>validatePack(base(extra),registry),/suspicion/i);
 assert.doesNotThrow(()=>validatePack(base({suspicionSettings:{curiousAt:20,confrontAt:60,decayPerTick:1,deadlineTicks:6},suspicionProfiles:[{character:'jana',confrontAt:50}],suspicionRules:[{id:'flaunt',event:'social.spoke',match:{target:'monique'},weight:40,summary:'too cozy with {target}',seedFrom:'visibility',subjectKey:'target'}]}),registry));
});

test('a believed rumor about the player becomes soft evidence on the committed partner',()=>{
 const p={schemaVersion:1,id:'test.rumor',version:'0.1.0',title:'Rumor test',subtitle:'gossip to suspicion',playerId:'player',calendar:'Shift',
  modules:{'social.conversation':'0.1.0','social.relationships':'0.1.0','social.dating':'0.1.0','social.secrecy':'0.2.0','world.schedule':'0.1.0','social.npc':'0.2.0','social.gossip':'0.1.0','items.inventory':'0.2.0'},
  locations:[{id:'home',name:'Home',description:'Quiet.',exits:[{to:'market'}]},{id:'market',name:'Market',description:'Busy.',exits:[{to:'home'}]}],
  actors:[
   {id:'player',name:'You',location:'market',description:'An adult.',style:'Direct',goal:'Get by.'},
   {id:'jana',name:'Jana',location:'home',description:'An adult partner.',style:'Warm',goal:'Trust.'},
   {id:'brin',name:'Brin',location:'market',description:'An adult regular.',style:'Chatty',goal:'Gossip.'}],
  items:[{id:'note',name:'Note',owner:'market'}],
  schedules:[{actor:'jana',period:8,stops:[{at:2,location:'market'}]}],
  gossipRules:[{id:'sneak',event:'items.transferred',subjectKey:'from',summary:'{from} was seen sneaking around with {to}',seedFrom:'visibility',credibility:80,ttl:60}],
  datingProfiles:[{character:'jana',initialPhase:'exclusive',initialAgreement:'monogamous',thresholds:{crush:-100,date:-100,exclusive:-100}}]};
 const c=run(p);
 c.act('items.take',{item:'note'});
 c.act('items.give',{item:'note',target:'brin'});
 const rumor=c.s.modules['social.gossip'].rumors.find(r=>r.subject==='player');
 assert.ok(rumor&&rumor.holders.brin);
 for(let i=0;i<40&&!events(c.s,'social.rumorBelieved').some(e=>e.payload.character==='jana'&&e.payload.subject==='player');i++)c.act('core.wait');
 const believed=events(c.s,'social.rumorBelieved').find(e=>e.payload.character==='jana'&&e.payload.subject==='player');
 assert.ok(believed&&believed.payload.subject==='player');
 const susp=suspicionOf(c.s,'jana','player');assert.ok(susp&&susp.score>=15);
 assert.equal(evidenceOf(c.s,'jana','player')[0].strength,'soft');
});

test('suspicion state replays deterministically',()=>{
 const p=base();const play=seed=>{const c=run(p,seed);startAffair(c);c.act('social.requestIntimacy',{character:'monique',category:'kiss'});c.act('social.beginIntimacy',{character:'monique',category:'kiss'});for(let i=0;i<20;i++)c.act('core.wait');return c.s;};
 const a=play(11),b=play(11);
 assert.deepEqual(a.modules['social.secrecy'],b.modules['social.secrecy']);
 assert.deepEqual(a.events.map(e=>[e.type,e.payload,e.visibility]),b.events.map(e=>[e.type,e.payload,e.visibility]));
});
