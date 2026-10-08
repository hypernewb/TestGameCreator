import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack,clone,actions,routeBetween,travel,meetingArrival,nextArrivalTick,scheduledLocation,settleSceneAttendance,scheduleDestination} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {closedReason} from '../packages/modules/calendar.mjs';
import {resolveSchedule} from '../public/schedule-resolver.mjs';
import {calendarFor,timeCost,optionCost} from '../public/calendar.mjs';
// GC4.1 time and presence. Pins current behaviour where it matches the bullet; test.todo where it does not.
const neutral=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));
// 2026-01-04 is a Sunday. Tick 0 = Sunday Morning; interval 4 ticks per daypart; Monday starts at tick 12.
function pack(){
 const p=clone(neutral);
 p.modules['world.calendar']='0.1.0';p.modules['world.daypart']='0.1.0';delete p.modules['story.quests'];delete p.quests;
 p.gameProject={premise:'Time fixture.',setting:'A small town.',ai:{intent:'x',scene:'x',daypart:'x'},calendar:{startDate:'2026-01-04',startWeekday:'Sunday'}};
 p.locations.push({id:'island',name:'Island',exits:[]});
 p.daypart={interval:4,labels:['Morning','Afternoon','Evening'],introLocation:'hub'};
 p.calendar={closures:[{location:'hub',weekdays:['Monday'],reason:'Market day'}]};
 p.schedules=[{actor:'ada',period:12,stops:[{at:4,location:'meeting'},{at:8,location:'hub'}],weekly:[{weekday:'Monday',daypart:'Morning',location:'workshop'},{weekday:'Tuesday',daypart:'Morning',location:'workshop'}]}];
 p.scheduleExceptions=[{id:'ada-monday-hub',actor:'ada',startTick:12,endTick:15,location:'hub'}];
 return p;
}
const ada=p=>p.schedules[0];
// Minimal transaction stand-in for the pure helpers that take tx (set/emit only).
const fakeTx=(s,p)=>({state:s,world:s,pack:p,events:[],set(path,v){let o=s;for(const k of path.slice(0,-1))o=o[k];o[path.at(-1)]=v;},emit(type,payload){this.events.push({type,payload});}});

test('cost display uses pack minutes, custom tick lengths and plural ticks consistently',()=>{
 const campus={id:'campus'},custom={id:'x',tickMinutes:15},odd={id:'x',tickMinutes:90};
 assert.equal(timeCost(1,campus).display,'1h');
 assert.equal(timeCost(3,custom).display,'45m');
 assert.equal(timeCost(4,odd).display,'6h');
 assert.equal(timeCost(1,odd).display,'1h 30m');
 assert.equal(timeCost(2,{id:'x'}).display,'2 ticks');
 assert.equal(timeCost(1,{id:'x'}).display,'1 tick');
 assert.equal(timeCost(0,campus).display,'0m');
});

test('wait-until cost counts ticks to the next authored daypart boundary',()=>{
 const p=pack(),s=createWorld(p,registry,'t');
 assert.equal(optionCost(s,{type:'core.wait',args:{until:'Afternoon'}},p).ticks,4);
 assert.equal(optionCost(s,{type:'core.wait',args:{until:'Morning'}},p).ticks,12);
});

test('a one-hop move and the wait option show the cost the engine advances',()=>{
 const p=pack(),s=createWorld(p,registry,'t');
 const list=actions(s,p,registry);
 const wait=list.find(a=>a.type==='core.wait'),move=list.find(a=>a.type==='core.move'&&a.args.to==='workshop');
 assert.equal(wait.cost.ticks,1,'plain Wait is one tick; wait-until is the daypart-boundary option');
 assert.equal(move.cost.ticks,1);
 const after=execute(s,{id:'m1',actorId:p.playerId,type:'core.move',args:{to:'workshop'},expectedRevision:s.revision},p,registry).state;
 assert.equal(after.tick-s.tick,1);
});

test('travel routes follow exits and gated flags, and blocked travel emits and stays put',()=>{
 const p=pack();
 assert.deepEqual(routeBetween(p,'workshop','meeting',{}),['workshop','hub','meeting']);
 assert.deepEqual(routeBetween(p,'workshop','meeting',{access:true}),['workshop','meeting']);
 assert.equal(routeBetween(p,'workshop','island',{}),null);
 const s=createWorld(p,registry,'t'),tx=fakeTx(s,p);
 assert.deepEqual(travel(tx,p,'hub','meeting',p.playerId),['hub','meeting']);
 assert.equal(s.actors[p.playerId].location,'meeting');
 assert.equal(tx.events.at(-1).type,'core.moved');
 const blocked=fakeTx(createWorld(p,registry,'t'),p);
 assert.equal(travel(blocked,p,'hub','island',p.playerId),null);
 assert.equal(blocked.events[0].type,'core.travelBlocked');
});

test('a scene away from the player costs travel hops plus one tick of conversation',()=>{
 const p=pack(),s=createWorld(p,registry,'t');
 const c={type:'core.scene',args:{location:'meeting',characters:['cyra'],activity:'talk'}};
 assert.equal(optionCost(s,c,p).ticks,2);
});

test('closures refuse a location on its closed weekday and reopen the next day',()=>{
 const p=pack(),s=createWorld(p,registry,'t');
 assert.equal(calendarFor(12,p).weekday,'Monday');
 assert.equal(closedReason(p,s,12,'hub'),'Market day');
 assert.equal(closedReason(p,s,0,'hub'),null);
 assert.equal(closedReason(p,s,24,'hub'),null);
});

test.todo('opening hours: a closure limited to one daypart (e.g. hub closed only in the Evening) is not expressible; closures are whole-day (packages/modules/calendar.mjs closedReason ignores daypart)');

test('weekly routine stops fire only on their weekday and daypart and only at interval boundaries',()=>{
 const p=pack(),sc=ada(p);
 assert.equal(resolveSchedule(p,sc,25),null,'off-boundary tick never fires a weekly stop');
 assert.equal(resolveSchedule(p,sc,24)?.location,'workshop');
 assert.equal(resolveSchedule(p,sc,24)?.kind,'weekly');
 assert.equal(resolveSchedule(p,sc,16)?.kind,'stop','a periodic stop at tick 16 beats the Monday afternoon routine');
});

test('an exception overrides stops and weekly rules inside its inclusive tick window only',()=>{
 const p=pack(),sc=ada(p);
 assert.deepEqual([12,15].map(t=>resolveSchedule(p,sc,t)?.kind),['exception','exception']);
 assert.equal(resolveSchedule(p,sc,12).location,'hub');

});

test('arrival at a location is found from the schedule and reports the next time the character is there',()=>{
 const p=pack(),s=createWorld(p,registry,'t');
 assert.equal(nextArrivalTick(p,'ada','workshop',0),24,'Monday morning workshop routine is overridden by the exception');
 assert.equal(nextArrivalTick(p,'ada','meeting',5),16);
 assert.equal(scheduledLocation(s,p,'ada',12),'hub','exception beats the Monday routine');
 assert.equal(scheduledLocation(s,p,'ada',24),'workshop');
});

test('a meeting succeeds only when the character is there at arrival; otherwise the player is told when they return',()=>{
 const p=pack(),s=createWorld(p,registry,'t');
 const tx=fakeTx(s,p);
 assert.equal(meetingArrival(tx,s,p,'ada','hub',2),true,'already at hub');
 assert.equal(meetingArrival(tx,s,p,'ada','workshop',24),true,'routine places Ada at the workshop on arrival');
 assert.equal(s.actors.ada.location,'workshop');
 const far=fakeTx(createWorld(p,registry,'t'),p);
 assert.equal(meetingArrival(far,far.state,p,'ada','workshop',3),false);
 const ev=far.events.at(-1);
 assert.equal(ev.type,'world.meetingUnavailable');
 assert.equal(ev.payload.nextArrival,24);
 assert.match(ev.payload.text,/Ada isn't at workshop|isn't at Workshop/i);
});

test('an invited character who had a scene moves to a missed scheduled stop when the scene ends',()=>{
 const p=pack(),s=createWorld(p,registry,'t');
 s.scene={id:'x',location:'hub',characters:['ada'],startedTick:0,returns:{}};s.tick=4;
 settleSceneAttendance(s,p);
 assert.equal(s.actors.ada.location,'meeting');
});

test.todo('invitation travel time: world.acceptHangout arrives after route.length ticks (hops+1) while its cost is the generic one tick, so a distant hangout is not priced by distance (daypart.mjs acceptHangout vs optionCost)');

test.todo('a missed meeting changes the world beyond its text (world.meetingUnavailable does not record a flag, relationship or miss state)');

test('daypart and week rollover advance the calendar at the expected ticks',()=>{
 const p=pack();
 const e=calendarFor(11,p),m=calendarFor(12,p),w=calendarFor(84,p);
 assert.deepEqual([e.weekday,e.daypart,e.day],['Sunday','Evening',1]);
 assert.deepEqual([m.weekday,m.daypart,m.day],['Monday','Morning',2]);
 assert.deepEqual([w.weekday,w.week,w.day],['Sunday',2,8]);
});

test('starting the next daypart returns the player to the introduction location',()=>{
 const p=pack(),s=createWorld(p,registry,'t');
 const moved=execute(s,{id:'n1',actorId:p.playerId,type:'core.move',args:{to:'workshop'},expectedRevision:s.revision},p,registry).state;
 const next=execute(moved,{id:'n2',actorId:p.playerId,type:'world.nextDaypart',args:{},expectedRevision:moved.revision},p,registry).state;
 assert.equal(next.actors[p.playerId].location,'hub');
});
