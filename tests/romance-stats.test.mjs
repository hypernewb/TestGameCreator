import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {addPoints} from '../packages/modules/romance-tempo.mjs';
import {changeTrust,cappedGain,validateRomanceStats} from '../packages/modules/romance-stats.mjs';
import {traitsOf} from '../packages/modules/arc.mjs';

// A probe module writes Like/Trust through the real helpers so the cap is tested exactly as the modules use it.
const probe={id:'test.romance-probe',version:'0.1.0',coreApi:'0.1.0',requires:[],commands:{'test.like'(tx,a){addPoints(tx,a.character,a.amount,'test');},'test.trust'(tx,a){changeTrust(tx,a.character,a.amount);}}};
const mods={...registry,[probe.id]:probe};
const pack=()=>{const p=JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url)));p.modules[probe.id]='0.1.0';return p;};
const run=p=>{validatePack(p,mods);let state=createWorld(p,mods,'stats');const act=(type,args)=>{state=execute(state,{id:`s${state.revision}`,actorId:p.playerId,type,args,expectedRevision:state.revision},p,mods).state;};
 return {act,nextDay(){state={...state,tick:state.tick+12};},get state(){return state;},like:c=>state.modules['social.romance-tempo'].characters?.[c]?.points??0,trust:c=>state.modules['social.relationships'].edges[`${c}--${p.playerId}`]};};

test('campus turns romance stats on with a 6-per-day gain cap',()=>{assert.deepEqual(pack().romanceStats,{dailyGain:6});});

test('Like gains cap at 6 per heroine per day; losses are never capped; the cap resets next day',()=>{
 const g=run(pack());for(let i=0;i<4;i++)g.act('test.like',{character:'jana',amount:3});assert.equal(g.like('jana'),6);
 g.act('test.like',{character:'monique',amount:3});assert.equal(g.like('monique'),3,'the cap is per heroine');
 g.act('test.like',{character:'jana',amount:-4});assert.equal(g.like('jana'),2);g.act('test.like',{character:'jana',amount:3});assert.equal(g.like('jana'),2,'a loss does not refund today\'s cap');
 g.nextDay();g.act('test.like',{character:'jana',amount:5});assert.equal(g.like('jana'),7);
});

test('Trust gains cap at 6 per heroine per day, losses do not, and non-heroines are uncapped',()=>{
 const g=run(pack()),t0=g.trust('jana'),k0=g.trust('kaylee');
 g.act('test.trust',{character:'jana',amount:4});g.act('test.trust',{character:'jana',amount:4});assert.equal(g.trust('jana'),t0+6);
 g.act('test.trust',{character:'jana',amount:-10});assert.equal(g.trust('jana'),t0-4);
 g.act('test.trust',{character:'kaylee',amount:10});assert.equal(g.trust('kaylee'),k0+10);
 g.nextDay();g.act('test.trust',{character:'jana',amount:8});assert.equal(g.trust('jana'),t0+2);
 const ev=g.state.events.filter(e=>e.type==='social.relationshipChanged'&&e.payload.actor==='jana').at(-1);assert.equal(ev.payload.capped,true);assert.equal(ev.payload.delta,6);
});

test('arc trust is the shared relationship Trust when romance stats are on',()=>{
 const g=run(pack()),t0=g.trust('nova');assert.equal(traitsOf(g.state,pack(),'nova').trust,t0);
 g.act('test.trust',{character:'nova',amount:5});assert.equal(traitsOf(g.state,pack(),'nova').trust,t0+5);
});

test('without romanceStats nothing is capped',()=>{
 const p=pack();delete p.romanceStats;delete p.progression;const g=run(p),t0=g.trust('jana');
 g.act('test.trust',{character:'jana',amount:20});g.act('test.like',{character:'jana',amount:9});assert.equal(g.trust('jana'),t0+20);assert.equal(g.like('jana'),9);
 assert.equal(cappedGain(p,'jana',20,0),20);
});

test('romanceStats.dailyGain must be a positive integer',()=>{
 for(const bad of [{dailyGain:0},{dailyGain:2.5},{dailyGain:'6'},null])assert.throws(()=>validateRomanceStats({romanceStats:bad}),/dailyGain/);
 assert.doesNotThrow(()=>validateRomanceStats({}));assert.doesNotThrow(()=>validateRomanceStats({romanceStats:{dailyGain:6}}));
});

test('campus scale: ranks at 6/20/32 Like, no loss bigger than -3, no neglect, gifts worth a full day',()=>{
 const p=pack();for(const t of p.romanceTempoProfiles){assert.deepEqual(t.ranks.map(r=>r.points),[0,6,20,32]);assert.equal(t.neglect,undefined);
  for(const g of t.gifts.preferences)assert.equal(g.points,{loved:6,liked:4,disliked:-3}[g.reaction]);}
 for(const a of p.actProfiles)for(const e of a.entries){assert.ok(e.points>=-3,e.id);if(e.kind==='gift'&&e.points>0)assert.equal(e.points,6,e.id);}
 for(const a of p.arcTracks)for(const d of a.drift||[])assert.ok(d.delta>=-3,a.id);
});
