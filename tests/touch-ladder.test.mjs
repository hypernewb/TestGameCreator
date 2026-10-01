import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {mapTouchText,touchEligibility,LADDER} from '../packages/modules/touch-ladder.mjs';

const pack=()=>({schemaVersion:1,id:'test.touch',version:'0.1.0',title:'Touch',playerId:'player',modules:{'social.conversation':'0.1.0','social.relationships':'0.1.0','social.touch-ladder':'0.1.0'},locations:[{id:'room',name:'Her room',exits:[]},{id:'plaza',name:'Plaza',exits:[]}],actors:[{id:'player',name:'You',location:'room'},{id:'mia',name:'Mia',location:'room'}],touchLadder:{privateLocations:['room']}});
const run=p=>{validatePack(p,registry);let state=createWorld(p,registry,'touch');return {get state(){return state;},act(type,args={}){const r=execute(state,{id:`t${state.revision}`,actorId:p.playerId,type,args,expectedRevision:state.revision},p,registry);state=r.state;return r.turn.events;},touch(text,step){return this.act('social.attemptTouch',{character:'mia',text,step});},setTrust(v){state={...state,modules:{...state.modules,'social.relationships':{...state.modules['social.relationships'],edges:{...state.modules['social.relationships'].edges,'mia--player':v}}}};},setDrunk(n){state={...state,modules:{...state.modules,'character.sobriety':{characters:{mia:{drinks:n}}}}};},get lust(){return state.modules['social.touch-ladder'].characters.mia.lust;},get trust(){return state.modules['social.relationships'].edges['mia--player']||0;}};};

test('free text maps to the nearest ladder step',()=>{
 assert.equal(mapTouchText('I take her hand'),'handhold');
 assert.equal(mapTouchText('I kiss her neck'),'kiss');
 assert.equal(mapTouchText('I kiss her'),'kiss');
 assert.equal(mapTouchText('we make out'),'makeout');
 assert.equal(mapTouchText('I undress her'),'undress');
 assert.equal(mapTouchText('mumble incoherently'),null);
});

test('low-trust kiss is refused in character with a vague hint, never a system error',()=>{
 const g=run(pack());
 const events=g.touch('I kiss her');
 const refused=events.find(e=>e.type==='social.touchRefused');
 assert.ok(refused,'expected a refusal');
 assert.equal(refused.payload.reason,'trust');
 assert.match(refused.payload.text,/ready/);
 assert.ok(!/error|Error|undefined/.test(refused.payload.text));
 assert.equal(g.lust,0,'refusal never raises lust');
});

test('the same kiss after trust gain is accepted with a lust delta',()=>{
 const g=run(pack());
 g.setTrust(25);
 const events=g.touch('I kiss her');
 const accepted=events.find(e=>e.type==='social.touchAccepted');
 assert.ok(accepted,'expected acceptance once trust clears the gate');
 assert.equal(accepted.payload.lustDelta,6);
 assert.equal(g.lust,6);
 assert.ok(g.trust>25,'accepting a step also nudges trust up');
});

test('a public place blocks high steps even with plenty of trust',()=>{
 const p=pack();p.actors.find(a=>a.id==='player').location='plaza';p.actors.find(a=>a.id==='mia').location='plaza';
 const g=run(p);g.setTrust(80);
 const events=g.touch('we make out');
 const refused=events.find(e=>e.type==='social.touchRefused');
 assert.ok(refused);
 assert.equal(refused.payload.reason,'privacy');
 assert.match(refused.payload.text,/see/);
});

test('a drunk partner refuses per sobriety rules even with enough trust and privacy',()=>{
 const g=run(pack());g.setTrust(25);g.setDrunk(3);
 const events=g.touch('I kiss her');
 const refused=events.find(e=>e.type==='social.touchRefused');
 assert.ok(refused);
 assert.equal(refused.payload.reason,'sobriety');
 assert.match(refused.payload.text,/drink/);
});

test('touchEligibility reasons compose and an unknown step is rejected safely',()=>{
 assert.equal(touchEligibility({actors:{},modules:{}},{playerId:'p',actors:[]},'mia','not-a-step').eligible,false);
 assert.equal(LADDER.length,10);
});

test('an explicit model-tagged step wins over text mapping when both are present',()=>{
 const g=run(pack());g.setTrust(50);
 const events=g.touch('something vague the model could not parse','handhold');
 assert.ok(events.some(e=>e.type==='social.touchAccepted'&&e.payload.step==='handhold'));
});

test('replays deterministically for the same command sequence',()=>{
 const walk=()=>{const g=run(pack());g.setTrust(25);g.touch('I kiss her');g.touch('I take her hand');return g.state;};
 assert.deepEqual(walk(),walk());
});
