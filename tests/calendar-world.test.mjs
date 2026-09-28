import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack,scheduleDestination,clone,actions} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {conditionReasons,validateConditions} from '../packages/modules/conditions.mjs';
import {closedReason,holidayOf} from '../packages/modules/calendar.mjs';
import {calendarFor} from '../public/calendar.mjs';
const neutral=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));
// 2026-01-04 is a Sunday. Day 2 (2026-01-05, Monday) is the festival; day 3 (2026-01-06) is pinned rainy.
function pack(){
 const p=clone(neutral);
 p.modules['world.calendar']='0.1.0';p.modules['world.economy']='0.2.0';delete p.modules['story.quests'];delete p.quests;
 p.gameProject={premise:'Festival week in a small town.',setting:'A small town.',ai:{intent:'x',scene:'x',daypart:'x'},calendar:{startDate:'2026-01-04',startWeekday:'Sunday'}};
 p.calendar={
  holidays:[{name:'Founders Festival',date:'2026-01-05',text:'The Founders Festival fills the streets.'}],
  closures:[{location:'workshop',holiday:true,reason:'Closed for the festival'},{location:'hub',weekdays:['Monday'],reason:'Market day'}],
  weather:[{id:'sunny',name:'Sunny',weight:3},{id:'rain',name:'Rain',weight:1}],
  weatherByDate:{'2026-01-06':'rain'}
 };
 delete p.schedules;p.modules['world.schedule']='0.1.0';
 p.schedules=[{actor:'ada',weekly:[{weekday:'Monday',daypart:'Morning',location:'workshop',skipHolidays:true},{weekday:'Tuesday',daypart:'Morning',location:'workshop'}]}];
 p.items=[...p.items,{id:'bean',name:'Coffee beans',owner:'hub',shop:true,price:10}];
 return p;
}
function harness(p){let s=createWorld(p,registry,'test');return {get state(){return s;},act(type,args={}){const r=execute(s,{id:`t${s.revision}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,registry);s=r.state;return r;}};}

test('calendar packs validate; malformed holidays, closures, and weather are refused',()=>{
 validatePack(pack(),registry);
 const bad=pack();bad.calendar.holidays=[{name:'Both',date:'2026-01-05',weekday:'Monday'}];
 assert.throws(()=>validatePack(bad,registry),/exactly one/);
 const noTrigger=pack();noTrigger.calendar.closures=[{location:'workshop'}];
 assert.throws(()=>validatePack(noTrigger,registry),/at least one trigger/);
 const weight=pack();weight.calendar.weather=[{id:'fog',name:'Fog',weight:0}];
 assert.throws(()=>validatePack(weight,registry),/weight/);
 const unknown=pack();unknown.calendar.weatherByDate={'2026-01-06':'fog'};
 assert.throws(()=>validatePack(unknown,registry),/unknown weather kind/);
});

test('weather rolls once per day, replays exactly, and honors weatherByDate pins',()=>{
 const h=harness(pack()),h2=harness(pack());
 assert.equal(h.state.modules['world.calendar'].weather,null,'no weather before the first dawn');
 for(let i=0;i<13;i++){h.act('core.wait');h2.act('core.wait');}
 const w1=h.state.modules['world.calendar'].weather;
 assert.ok(['sunny','rain'].includes(w1));
 assert.equal(h2.state.modules['world.calendar'].weather,w1,'same seed, same weather');
 assert.ok(h.state.events.some(e=>e.type==='world.weatherChanged'));
 assert.notEqual(calendarFor(h.state.tick,pack()).date,'2026-01-06');
 for(let i=0;i<12;i++)h.act('core.wait');
 assert.equal(calendarFor(h.state.tick,pack()).date,'2026-01-06');
 assert.equal(h.state.modules['world.calendar'].weather,'rain','weatherByDate pins day 3');
});

test('holidays fire for their date, and conditions can gate on weather and holiday',()=>{
 const h=harness(pack());
 for(let i=0;i<13;i++)h.act('core.wait');
 assert.equal(calendarFor(h.state.tick,pack()).date,'2026-01-05');
 assert.ok(h.state.events.some(e=>e.type==='world.holidayStarted'&&e.payload.name==='Founders Festival'));
 assert.equal(h.state.modules['world.calendar'].holiday,'Founders Festival');
 assert.equal(conditionReasons({holiday:true},h.state,pack()).length,0);
 assert.ok(conditionReasons({holiday:false},h.state,pack()).length>0);
 assert.ok(conditionReasons({weather:'rain'},h.state,pack()).length>0,'day 2 is not pinned rainy');
 validateConditions({weather:'rain',holiday:true},pack(),'x');
 assert.throws(()=>validateConditions({weather:'fog'},pack(),'x'),/unknown weather kind/);
});

test('closures refuse new scenes at the door and hide activities; the shop will not trade',()=>{
 const h=harness(pack());
 for(let i=0;i<13;i++)h.act('core.wait');
 assert.equal(closedReason(pack(),h.state,h.state.tick,'workshop'),'Closed for the festival');
 assert.equal(closedReason(pack(),h.state,h.state.tick,'hub'),'Market day');
 assert.throws(()=>h.act('core.scene',{text:'Go to the workshop',location:'workshop',characters:[],activity:'explore'}),/closed today: Closed for the festival/);
 assert.throws(()=>h.act('world.buy',{item:'bean'}),/closed today/);
 assert.ok(!actions(h.state,pack(),registry).some(a=>a.type==='core.scene'&&a.args.activityId),'closed-hub activities are not offered');
});

test('weekly schedule stops with skipHolidays stay home on a holiday',()=>{
 const p=pack();
 const cal=calendarFor(12,p);
 assert.equal(cal.date,'2026-01-05');
 assert.equal(holidayOf(p,cal)?.name,'Founders Festival');
 assert.equal(scheduleDestination(p,p.schedules[0],12),null,'Monday Morning stop skipped on the holiday');
 assert.equal(scheduleDestination(p,p.schedules[0],24),'workshop','Tuesday Morning stop unaffected by the holiday');
});
