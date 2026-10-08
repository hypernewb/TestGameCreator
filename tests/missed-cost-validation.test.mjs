import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {bakeDirectorTemplates} from '../packages/cards/director-templates.mjs';

// Director goal penalties: a configured penalty needs an integer cost of 1 or more; "no consequence" is kind "none".
const probe={id:'test.missed-cost-signals',version:'0.1.0',coreApi:'0.1.0',requires:[],commands:{'test.miss'(tx,args){tx.emit('story.planBroken',{id:args.id,character:'ada',plan:'Meet Ada',status:'broken'});}}};
const mods={...registry,[probe.id]:probe};
const template=(missed)=>({id:'deadline',kind:'goal',delivery:'offer',tone:1,roles:{lead:{pool:['ada']}},focusRole:'lead',goal:{deadlineTicks:12,...(missed===undefined?{}:{missed})},scene:{title:'goal for {lead}',opening:'{lead} asks you to come.',choices:[{id:'answer',label:'Promise',result:'You promise.'}]}});
const base=()=>{const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url),'utf8'));delete p.modules['world.schedule'];p.modules['story.scenes']='0.1.0';p.modules['story.director']='0.1.0';p.modules[probe.id]='0.1.0';p.scriptedScenes=[];p.directorProfile={firstTick:0,quietDayparts:1,jitter:0,decayPerTick:20,maxPerDay:3,opportunityChancePercent:0,interruptionChancePercent:0};p.initialRelationships=[{character:'ada',trust:10}];p.romanceTempoProfiles=[{character:'ada'}];return p;};
const bake=(missed)=>bakeDirectorTemplates(base(),[template(missed)]);
const withCost=(cost)=>{const p=bake({kind:'relationship',cost:3});p.directorProfile.opportunities[0].goal.missed.cost=cost;return p;};
const run=(p)=>{validatePack(p,mods);const s=createWorld(p,mods,'missed-cost',42);return execute(s,{id:'m1',actorId:p.playerId,type:'test.miss',args:{id:p.directorProfile.opportunities[0].goal.planId},expectedRevision:s.revision},p,mods);};
const edgeOf=s=>s.modules['social.relationships'].edges['ada--player'];

test('a positive integer missed cost passes and applies its penalty',()=>{
 const r=run(bake({kind:'relationship',cost:3}));
 assert.equal(edgeOf(r.state),7);
});

test('zero, negative, fractional and non-numeric missed costs are rejected by the pack validator',()=>{
 for(const cost of [0,-2,1.5,'3',NaN]){
  assert.throws(()=>validatePack(withCost(cost),mods),/goal\.missed\.cost: expected an integer of 1 or more/,`cost ${String(cost)}`);
 }
});

test('zero and negative missed costs are rejected when baking a template',()=>{
 for(const cost of [0,-1]) assert.throws(()=>bake({kind:'opportunity',cost}),/Director goal missed cost invalid/,`cost ${cost}`);
});

test('the explicit no-consequence form passes and applies no penalty',()=>{
 const p=bake({kind:'none'});
 const r=run(p);
 assert.equal(edgeOf(r.state),10,'Trust is untouched');
 assert.equal(r.state.modules['story.director'].offerBlockedUntilTick,undefined,'no offer block');
 const ev=r.turn.events.filter(e=>e.type==='story.goalMissed');
 assert.equal(ev.length,1);
 assert.equal(ev[0].payload.consequence,'none');
 assert.equal(r.turn.events.some(e=>e.type==='social.relationshipChanged'),false,'no Trust change event');
});

test('a no-consequence goal still validates without a cost field',()=>{
 assert.doesNotThrow(()=>validatePack(bake({kind:'none'}),mods));
});

test('a shipped pack with a goal penalty still validates',()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/threshold.json',import.meta.url),'utf8'));
 assert.doesNotThrow(()=>validatePack(p,registry));
});
