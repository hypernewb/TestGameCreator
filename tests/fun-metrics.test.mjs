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

test('fun metrics: a typed line whose acts were priced in a follow-up turn landed, and is not dead',()=>{
 const w=world([turn('t1','core.scene',[ev('core.sceneContinued')],{input:'how was your summer?'}),['t1-acts',{id:'t1-acts',command:{type:'social.priceActs',args:{}},events:[ev('social.romancePointsChanged',{character:'j',delta:2})]}],['t1-end',{id:'t1-end',command:{type:'core.endScene',args:{reason:'topic'}},events:[ev('core.sceneEnded')]}],turn('t2','core.scene',[ev('core.sceneContinued')],{input:'ok'})]);
 assert.deepEqual(playerTurns(w).map(t=>t.id),['t1','t2']);const m=funMetrics(w,pack);assert.equal(m.typedEffective,0.5);assert.deepEqual(m.deadByCommand,{'core.scene':1});
});

test('fun metrics: firsts, dead turns, streaks, storylets and gallery unlocks',()=>{
 const m=funMetrics(sample(),pack,{seconds:{t1:30,t2:30,t3:30,t4:30,t5:30,t6:30}});
 assert.equal(m.timing,'measured');assert.equal(m.minutes,3);
 assert.deepEqual([m.firstChoice.turn,m.firstChoice.minutes],[4,2]);assert.equal(m.firstSpark.turn,3);assert.deepEqual([m.firstPayoff.turn,m.firstPayoff.via],[5,'social.crushStarted']);
 assert.equal(m.firstCg.via,'s2');assert.equal(m.firstDrama,null);
 assert.deepEqual([m.deadTurns,m.longestDeadStreak,m.deadByCommand],[3,2,{'core.wait':2,'core.inspect':1}]);
 assert.deepEqual([m.choices,m.typed,m.storylets],[2,1,{seen:1,total:2}]);assert.equal(m.repeatedProse,0.5);assert.equal(m.ending,'good');
 const gate=Object.fromEntries(funGate(m).map(g=>[g.id,g.pass]));
 assert.deepEqual(gate,{'first-choice':true,'first-discovery':false,'first-payoff':true,'dead-turns':false,'typed-effective':false,'run-length':false,drama:false,'world-quiet':null,'repeated-prose':false,'input-lost':false});
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
 assert.equal(gate['typed-effective'],null);assert.equal(gate['first-discovery'],null);assert.equal(gate['world-quiet'],null); // no typed turns, no discovery, no director profile
 assert.deepEqual(narrativeDupes(['short line','short line']),[]);
});

test('fun metrics: quiet dayparts accumulate without dealt beats; a teaser and starvation do not count',()=>{
 const withDirector={...pack,directorProfile:{}},day=(id,events)=>turn(id,'core.waitUntil',events);
 const m=funMetrics(world([
  day('d1',[ev('world.daypartStarted',{daypart:'morning'})]),
  day('d2',[ev('world.daypartStarted',{daypart:'afternoon'}),ev('story.teaser',{incident:'x'})]), // a promise is not a beat
  day('d3',[ev('world.daypartStarted',{daypart:'evening'}),ev('story.starved',{quiet:2})]), // neither is a confession
  day('d4',[ev('world.daypartStarted',{daypart:'night'}),ev('story.incident',{incident:'x',scene:'s'})]), // the dealt beat resets
  day('d5',[ev('world.daypartStarted',{daypart:'morning'})])]),withDirector);
 assert.equal(m.maxQuietDayparts,3); // d1–d3 ran quiet; d4 dealt a beat; d5 starts fresh
 assert.equal(Object.fromEntries(funGate(m).map(g=>[g.id,g.pass]))['world-quiet'],false);
});

test('fun metrics: gate statuses separate not-exercised, incomplete and real fails',()=>{
 const statusesOf=m=>Object.fromEntries(funGate(m).map(g=>[g.id,g.status])),passesOf=m=>Object.fromEntries(funGate(m).map(g=>[g.id,g.pass]));
 const bare=turns=>({actors:{p:{location:'home'}},modules:{},turns:Object.fromEntries(turns)}); // no ending: completion comes from the clock
 const short=funMetrics(bare([turn('t1','core.wait',[ev('core.timeAdvanced')])]),{...pack,directorProfile:{}});
 assert.equal(statusesOf(short)['first-payoff'],'incomplete');assert.equal(passesOf(short)['first-payoff'],null);assert.equal(statusesOf(short)['run-length'],'incomplete');
 const long=funMetrics(bare([turn('t1','core.wait',[ev('core.timeAdvanced')])]),pack,{seconds:{t1:2700}}); // 45 min, no ending, no milestones
 assert.equal(statusesOf(long)['first-payoff'],'fail');assert.equal(passesOf(long)['first-payoff'],false);assert.equal(statusesOf(long)['run-length'],'fail');
 const bot=funMetrics(bare([turn('t1','core.wait',[ev('core.timeAdvanced')])]),pack);
 assert.equal(statusesOf(bot)['repeated-prose'],'not-exercised');assert.equal(passesOf(bot)['repeated-prose'],null); // a bot without narration no longer passes vacuously
 assert.equal(statusesOf(bot)['typed-effective'],'not-exercised');assert.equal(statusesOf(bot)['world-quiet'],'not-exercised');assert.equal(statusesOf(bot)['input-lost'],'not-exercised');
});

test('fun metrics: a typed turn lands when the game answers the intent, not when background events fire',()=>{
 const w=world([
  turn('t1','core.scene',[ev('core.sceneContinued'),ev('story.incident',{scene:'s1'})],{input:'how was your summer?'}), // background only: the input did nothing
  turn('t2','core.scene',[ev('core.sceneContinued'),ev('social.romancePointsChanged',{character:'j',delta:2})],{input:'and mine was quiet too'}), // priced: landed
  turn('t3','core.move',[ev('core.moved',{to:'bar'})],{input:'go to the bar'})]); // the movement answers the movement
 const m=funMetrics(w,pack);
 assert.deepEqual([m.typed,m.typedLive,m.inputLost],[3,2,1]);assert.equal(m.deadTurns,0);
});

test('fun metrics: drought metrics expose long stretches without a beat',()=>{
 const w=world([
  turn('t1','core.wait',[ev('core.timeAdvanced'),ev('social.romancePointsChanged',{character:'j',from:1,to:2})]), // spark at ~1 min
  turn('t2','core.wait',[ev('core.timeAdvanced')]),turn('t3','core.wait',[ev('core.timeAdvanced')]),
  turn('t4','core.wait',[ev('core.timeAdvanced'),ev('social.crushStarted',{character:'j'})])]); // payoff at ~4 min
 const m=funMetrics(w,pack,{seconds:{t1:60,t2:60,t3:60,t4:60}});
 assert.equal(m.longestBeatGap,3);assert.equal(m.trailingDrought,0);assert.equal(m.zeroBeatWindows,0);
 const dry=funMetrics(world([turn('t1','core.wait',[ev('core.timeAdvanced')])]),pack,{seconds:{t1:1500}}); // 25 min, no beat at all
 assert.equal(dry.longestBeatGap,0);assert.equal(dry.trailingDrought,25);assert.equal(dry.zeroBeatWindows,3);
});

test('persona playtest: seeded, player-like, and reaches authored content',()=>{
 const after=JSON.parse(readFileSync(new URL('../packs/after-hours.json',import.meta.url),'utf8'));
 const a=runPersonaPlaytest(after,registry,{turns:25,seed:7}),b=runPersonaPlaytest(after,registry,{turns:25,seed:7});
 assert.deepEqual(a.errors,[]);assert.deepEqual(Object.values(a.state.turns).map(t=>t.command.type),Object.values(b.state.turns).map(t=>t.command.type));
 const m=funMetrics(a.state,after);assert.ok(m.firstChoice,'a romancer takes an offered scene early');assert.ok(m.storylets.seen>=1);assert.ok(!m.deadByCommand['items.place']);
});
