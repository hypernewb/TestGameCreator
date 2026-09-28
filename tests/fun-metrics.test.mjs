import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registry} from '../packages/modules/index.mjs';
import {funMetrics,funGate,funLine,gateLine,playerTurns,narrativeDupes} from '../packages/testing/fun-metrics.mjs';
import {runPersonaPlaytest} from '../packages/testing/persona-playtest.mjs';

const pack={playerId:'p',datingProfiles:[{character:'j'}],scriptedScenes:[{id:'s1'},{id:'s2',cg:'cg.png'}]};
const ev=(type,payload={})=>({type,payload,visibility:['p']}),prose='the rain taps the window while juno counts the till slowly and hums a song you almost recognise from somewhere older than this bar and older than the city itself tonight';
const turn=(id,type,events,extra={})=>[id,{id,command:{type,args:{}},events,status:'complete',...extra}];
const world=turns=>({actors:{p:{location:'home'}},modules:{'story.endings':{selected:'good'}},turns:Object.fromEntries(turns)});
const sample=()=>world([
 turn('t1','core.wait',[ev('core.timeAdvanced')]),
 turn('t2','core.inspect',[ev('core.patch')]),
 turn('t3','core.move',[ev('core.moved',{to:'bar'})]),
 ['t3-end',{id:'t3-end',command:{type:'core.endScene',args:{reason:'natural'}},events:[ev('social.chemistryChanged',{character:'j',delta:3})]}],
 turn('t4','story.startOfferedScene',[ev('story.sceneSelected',{scene:'s2'})],{narrative:prose}),
 turn('t5','story.choose',[ev('story.choiceResolved',{scene:'s2',beat:'b1'}),ev('social.crushStarted',{character:'j'})],{narrative:prose}),
 turn('t6','core.wait',[ev('core.timeAdvanced')],{input:'hmm'})]);

test('fun metrics: the automatic scene close belongs to the player turn that caused it',()=>{
 const turns=playerTurns(sample());assert.deepEqual(turns.map(t=>t.id),['t1','t2','t3','t4','t5','t6']);assert.equal(turns[2].events.length,2);
});

test('fun metrics: firsts, dead turns, streaks, storylets and gallery unlocks',()=>{
 const m=funMetrics(sample(),pack,{seconds:{t1:30,t2:30,t3:30,t4:30,t5:30,t6:30}});
 assert.equal(m.timing,'measured');assert.equal(m.minutes,3);
 assert.deepEqual([m.firstChoice.turn,m.firstChoice.minutes],[4,2]);assert.equal(m.firstSpark.turn,3);assert.deepEqual([m.firstPayoff.turn,m.firstPayoff.via],[5,'social.crushStarted']);
 assert.equal(m.firstCg.via,'s2');assert.equal(m.firstDrama,null);
 assert.deepEqual([m.deadTurns,m.longestDeadStreak,m.deadByCommand],[3,2,{'core.wait':2,'core.inspect':1}]);
 assert.deepEqual([m.choices,m.typed,m.storylets],[2,1,{seen:1,total:2}]);assert.equal(m.repeatedProse,0.5);assert.equal(m.ending,'good');
 const gate=Object.fromEntries(funGate(m).map(g=>[g.id,g.pass]));
 assert.deepEqual(gate,{'first-choice':true,'first-payoff':true,'dead-turns':false,'run-length':false,drama:false,'repeated-prose':false});
 assert.match(funLine(m),/1st payoff 2\.5m\/t5/);assert.match(gateLine(funGate(m)),/^gate: first-choice ok/);
});

test('fun metrics: timing falls back from measured to playedAt stamps to a reading estimate',()=>{
 const stamped=sample();let t=Date.parse('2026-09-01T20:00:00Z');for(const x of Object.values(stamped.turns))x.playedAt=new Date(t+=60000).toISOString();
 const s=funMetrics(stamped,pack);assert.equal(s.timing,'stamped');assert.equal(s.minutes,7); // six 1-min gaps, one spans the merged -end turn, the unknown first gap gets the median
 const e=funMetrics(sample(),pack);assert.equal(e.timing,'estimated');assert.ok(e.minutes>0&&e.minutes<3);
});

test('fun metrics: gates without evidence stay unknown, not failed',()=>{
 const m=funMetrics(world([turn('t1','core.wait',[ev('core.timeAdvanced')])]),{...pack,datingProfiles:[]});m.ending=null;
 const gate=Object.fromEntries(funGate(m).map(g=>[g.id,g.pass]));assert.equal(gate['first-choice'],null);assert.equal(gate['first-payoff'],null);assert.equal(gate['run-length'],null);
 assert.deepEqual(narrativeDupes(['short line','short line']),[]);
});

test('persona playtest: seeded, player-like, and reaches authored content',()=>{
 const after=JSON.parse(readFileSync(new URL('../packs/after-hours.json',import.meta.url),'utf8'));
 const a=runPersonaPlaytest(after,registry,{turns:25,seed:7}),b=runPersonaPlaytest(after,registry,{turns:25,seed:7});
 assert.deepEqual(a.errors,[]);assert.deepEqual(Object.values(a.state.turns).map(t=>t.command.type),Object.values(b.state.turns).map(t=>t.command.type));
 const m=funMetrics(a.state,after);assert.ok(m.firstChoice,'a romancer takes an offered scene early');assert.ok(m.storylets.seen>=1);assert.ok(!m.deadByCommand['items.place']);
});
