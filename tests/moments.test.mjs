import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack,mechanicsDigest} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {generatedMoments} from '../packages/modules/moments.mjs';
import {statValue} from '../packages/modules/stats.mjs';

const base=(moments,profile={chancePercent:100},extra=p=>p)=>{
 const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));
 Object.assign(p.modules,{'world.moments':'0.1.0','world.economy':'0.2.0','character.stats':'0.1.0','story.scenes':'0.1.0'});
 p.scriptedScenes=[];p.statDefinitions=[{id:'nerve',name:'Nerve',min:0,max:10,visibility:'public'}];
 if(moments)p.moments=moments;p.momentsProfile=profile;return extra(p);};
const run=(p,seed='moments')=>{validatePack(p,registry);let s=createWorld(p,registry,seed);const act=(type,args={})=>{const r=execute(s,{id:`t${s.revision}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,registry);s=r.state;return r.turn.events;};return {act,get s(){return s;}};};
const moment=events=>events.find(e=>e.type==='world.moment');
const money=s=>s.modules['world.economy'].balance;

test('a found-cash moment pays a rolled amount and says how much',()=>{
 const g=run(base([{id:'twenty',kind:'find',text:'You find {amount} by the {place} door.',effects:[{type:'money',delta:20,max:30}]}],{chancePercent:100,generate:false})),before=money(g.s);
 const m=moment(g.act('core.move',{to:'workshop'})),gained=money(g.s)-before;
 assert.ok(gained>=20&&gained<=30);assert.equal(m.payload.kind,'find');assert.match(m.payload.text,new RegExp(`\\$${gained} by the Workshop door`,'i'));
});

test('a stat-bump moment raises the stat and respects maxUses and cooldown',()=>{
 const g=run(base([{id:'nerve',kind:'find',text:'You stare down a pigeon.',effects:[{type:'stat',stat:'nerve',delta:1}],maxUses:1}],{chancePercent:100,generate:false}));
 assert.ok(moment(g.act('core.move',{to:'workshop'})));assert.equal(statValue(g.s,'player','nerve'),1);
 assert.equal(moment(g.act('core.move',{to:'hub'})),undefined);assert.equal(statValue(g.s,'player','nerve'),1);
});

test('a dry streak raises the odds until something happens',()=>{
 const g=run(base([{id:'coin',kind:'find',text:'A coin.',effects:[{type:'money',delta:1}]}],{chancePercent:0,dryStepPercent:100,generate:false}));
 assert.equal(moment(g.act('core.move',{to:'workshop'})),undefined);assert.equal(g.s.modules['world.moments'].dry,1);
 assert.ok(moment(g.act('core.move',{to:'hub'})));assert.equal(g.s.modules['world.moments'].dry,0);
});

test('an NPC drops in where you are, then heads back after the visit',()=>{
 const g=run(base([{id:'cyra-hi',kind:'encounter',character:'cyra',text:'{name} spots you at {place} and waves.',line:'Fancy seeing you here.',stay:2}],{chancePercent:100,generate:false}));
 const m=moment(g.act('core.move',{to:'workshop'}));
 assert.equal(m.payload.character,'cyra');assert.equal(m.payload.line,'Fancy seeing you here.');assert.match(m.payload.text,/Cyra spots you at Workshop/);assert.equal(g.s.actors.cyra.location,'workshop');
 g.act('core.wait');g.act('core.wait');assert.equal(g.s.actors.cyra.location,'meeting');assert.deepEqual(g.s.modules['world.moments'].away,{});
});

test('a scheduled NPC about to be somewhere else does not drop in',()=>{
 const g=run(base([{id:'ada-hi',kind:'encounter',character:'ada',text:'{name} waves.'}],{chancePercent:100,generate:false}));
 assert.equal(moment(g.act('core.move',{to:'workshop'})),undefined);
});

test('generated moments cover cash, stats, drop-ins and authored world.moment scene hooks',()=>{
 const p=base(null,{chancePercent:100},p=>({...p,scriptedScenes:[{id:'busker',title:'The busker',opening:'A busker plays your song.',trigger:{event:'world.moment',match:{moment:'busker-hook'}},when:{location:'workshop'},choices:[{id:'tip',label:'Tip',result:'You tip.'}]}]}));
 const ids=generatedMoments(p).map(m=>m.id);
 for(const id of ['gen-cash','gen-stat-nerve','gen-meet-cyra','busker-hook'])assert.ok(ids.includes(id),id);
 const hook=generatedMoments(p).find(m=>m.id==='busker-hook');assert.equal(hook.kind,'scene');assert.equal(hook.location,'workshop');
 const only=base(null,{chancePercent:100,generate:['scene']},x=>({...x,scriptedScenes:p.scriptedScenes})),g=run(only),events=g.act('core.move',{to:'workshop'});
 assert.equal(moment(events).payload.moment,'busker-hook');assert.equal(g.s.modules['story.scenes'].pending,'busker');
});

test('no moment while a scripted scene is open, and the daily cap holds',()=>{
 const g=run(base([{id:'coin',kind:'find',text:'A coin.',effects:[{type:'money',delta:1}],cooldown:0,maxUses:99}],{chancePercent:100,perDay:2,generate:false}));
 assert.ok(moment(g.act('core.move',{to:'workshop'})));assert.ok(moment(g.act('core.move',{to:'hub'})));assert.equal(moment(g.act('core.move',{to:'workshop'})),undefined);
});

test('moments are deterministic per seed and part of the mechanics digest',()=>{
 const p=base(null,{chancePercent:40}),walk=seed=>{const g=run(p,seed);for(const to of ['workshop','hub','workshop','hub','workshop','hub','workshop'])g.act('core.move',{to});return JSON.stringify(g.s.modules['world.moments']);};
 assert.equal(walk('a'),walk('a'));
 const plain=base(null,{chancePercent:40});delete plain.momentsProfile;assert.notEqual(mechanicsDigest(p),mechanicsDigest(plain));
});

test('validation rejects malformed moments',()=>{
 assert.throws(()=>validatePack(base([{id:'x',kind:'nope',text:'?'}]),registry),/kind/);
 assert.throws(()=>validatePack(base([{id:'x',kind:'encounter',character:'player',text:'?'}]),registry),/character/);
 assert.throws(()=>validatePack(base([{id:'x',kind:'find',text:'?',effects:[{type:'stat',stat:'luck',delta:1}]}]),registry),/stat effect/);
 assert.throws(()=>validatePack(base([],{chancePercent:300}),registry),/chancePercent/);
});
