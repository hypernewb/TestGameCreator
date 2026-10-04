import test from 'node:test';
import assert from 'node:assert/strict';
import {previewWeek,holidayMatch,mountSchedulePreview} from '../public/schedule-preview.mjs';
import {applyWeeklyRoutines} from '../public/weekly-routines.mjs';
import {holidayOf} from '../packages/modules/calendar.mjs';
import {createWorld,execute} from '../packages/core/engine.mjs';
import {calendarFor} from '../public/calendar.mjs';
import {registry} from '../packages/modules/index.mjs';
const cp=x=>structuredClone(x);
const pack=()=>({schemaVersion:1,id:'test.schedule-preview',version:'0.1.0',title:'Preview fixture',playerId:'player',modules:{'social.conversation':'0.1.0','world.schedule':'0.1.0'},actors:[{id:'player',name:'You',location:'a'},{id:'npc',name:'NPC',location:'a'},{id:'idle',name:'Idle',location:'b'}],locations:[{id:'a',name:'A',exits:[{to:'b'}]},{id:'b',name:'B',exits:[{to:'a'}]},{id:'c',name:'C',exits:[{to:'a'}]}],schedules:[],calendar:{holidays:[{name:'Founders Day',date:'10-07',annual:true}]},gameProject:{premise:'x',setting:'x',ai:{intent:'',scene:'',daypart:''},calendar:{startDate:'2026-10-05'}}});
const rule=(id,days,location,extra={})=>({id,days,daypart:'Morning',stop:{location,...(days==='everyday'?{skipHolidays:true}:{})},...extra});
const linked=()=>applyWeeklyRoutines(pack(),{version:1,actors:[{actor:'npc',rules:[rule('every-morning','everyday','b'),rule('weekday-evening','weekdays','a',{daypart:'Evening'}),rule('friday-evening','day','c',{daypart:'Evening',weekday:'Friday'}),rule('weekend-morning','weekends','c')]}]});
const cell=(p,weekday,daypart,week=1)=>p.cells.find(x=>x.weekday===weekday&&x.daypart===daypart&&x.week===week);
// Attendance per boundary tick straight from the engine: the same loop the runtime react handler runs.
function runtimeAttendance(p,actorId,ticks){let world=createWorld(cp(p),registry,'sched-preview');const out=[world.actors[actorId].location];for(let tick=1;tick<=ticks;tick++){world=execute(world,{id:'t'+tick,actorId:p.playerId,type:'core.wait',args:{},expectedRevision:world.revision},p,registry).state;out.push(world.actors[actorId].location);}return out;}
function assertMatchesRuntime(p,actorId,weeks){const interval=p.daypart?.interval||4,run=runtimeAttendance(p,actorId,weeks*21*interval);for(let w=1;w<=weeks;w++)for(const c of previewWeek(p,actorId,w).cells){const tick=c.tick;assert.equal(c.location,run[tick],`${c.weekday} ${c.daypart} week ${w}: preview ${c.location} vs runtime ${run[tick]}`);}}
test('holidayMatch mirrors the runtime holiday resolver across calendar shapes',()=>{for(const p of [pack(),{...pack(),calendar:{holidays:[{name:'Monday Off',weekday:'Monday'}]}},{...pack(),calendar:{holidays:[{name:'Fixed',date:'2026-10-07'}]}},{...pack(),calendar:{holidays:[{name:'Annual',date:'10-07',annual:true}]}},{}])for(let tick=0;tick<400;tick+=4)assert.equal(holidayMatch(p,calendarFor(tick,p)),holidayOf(p,calendarFor(tick,p)),`tick ${tick} pack ${JSON.stringify(p.calendar||null)}`);});
test('linked rules resolve with specific-over-general precedence, holiday skips and exact runtime attendance',()=>{const p=linked(),before=cp(p),w1=previewWeek(p,'npc',1);
 const mon=cell(w1,'Monday','Morning');
 assert.equal(mon.location,'a');assert.equal(mon.fresh,false);assert.equal(mon.source.kind,'start');
 assert.deepEqual(cell(w1,'Tuesday','Morning').source,{kind:'rule',id:'every-morning',label:'Every day'});assert.equal(cell(w1,'Tuesday','Morning').location,'b');
 assert.equal(cell(w1,'Friday','Evening').source.id,'friday-evening');assert.deepEqual(cell(w1,'Friday','Evening').shadowed.map(x=>x.id),['weekday-evening']);
 assert.equal(cell(w1,'Saturday','Morning').source.id,'weekend-morning');assert.deepEqual(cell(w1,'Saturday','Morning').shadowed.map(x=>x.id),['every-morning']);
 assert.equal(cell(w1,'Monday','Evening').source.id,'weekday-evening');
 const wed=cell(w1,'Wednesday','Morning');assert.equal(wed.holiday,'Founders Day');assert.equal(wed.holidaySkipped,true);assert.equal(wed.fresh,false);assert.equal(wed.location,'a');assert.ok(w1.notes.some(n=>n.includes('Founders Day')));
 assert.equal(cell(w1,'Monday','Morning').date,'2026-10-05');assert.equal(cell(w1,'Sunday','Evening').date,'2026-10-11');
 assertMatchesRuntime(p,'npc',2);assert.deepEqual(p,before);});
test('legacy tick stops, weekly cells and schedule exceptions match runtime attendance across weeks',()=>{const p=pack();p.schedules=[{actor:'npc',period:12,stops:[{at:4,location:'b'},{at:8,location:'c'}],weekly:[{weekday:'Monday',daypart:'Evening',location:'a'}]}];p.scheduleExceptions=[{id:'ex1',actor:'npc',location:'a',startTick:9,endTick:13}];
 const w1=previewWeek(p,'npc',1),tuesday=cell(w1,'Tuesday','Morning');assert.equal(tuesday.location,'a');assert.equal(tuesday.source.kind,'exception');assert.equal(tuesday.fresh,true);
 assert.equal(cell(w1,'Monday','Evening').location,'c');assert.equal(cell(w1,'Monday','Evening').source.kind,'stop');
 assert.ok(w1.notes.some(n=>n.includes('exception')));assert.equal(cell(previewWeek(p,'npc',2),'Tuesday','Morning',2).location,'c');
 assertMatchesRuntime(p,'npc',2);});
test('weekly-only schedules match runtime and carry attendance into unscheduled slots',()=>{const p=applyWeeklyRoutines(pack(),{version:1,actors:[{actor:'npc',rules:[rule('weekend-morning','weekends','c',{daypart:'Afternoon'})]}]});const w1=previewWeek(p,'npc',1);
 assert.equal(cell(w1,'Saturday','Afternoon').location,'c');assert.equal(cell(w1,'Saturday','Evening').location,'c');assert.equal(cell(w1,'Saturday','Evening').fresh,false);
 assert.equal(cell(w1,'Monday','Morning').location,'a');assert.equal(cell(w1,'Monday','Morning').source.kind,'start');
 assertMatchesRuntime(p,'npc',1);});
test('unknown locations, missing schedules and a disabled module are reported without inventing a fallback',()=>{const p=pack();p.schedules=[{actor:'npc',weekly:[{weekday:'Tuesday',daypart:'Morning',location:'zz'}]}];p.gameProject.weeklyRoutines={version:1,actors:[{actor:'npc',rules:[{id:'broken',days:'everyday',daypart:'Morning',stop:{location:'zz'}}]}]};const w1=previewWeek(p,'npc',1),mon=cell(w1,'Tuesday','Morning');
 assert.equal(mon.location,'zz');assert.equal(mon.locationName,null);assert.equal(mon.unknownLocation,true);
 const idle=previewWeek(p,'idle',1);assert.equal(cell(idle,'Friday','Evening').location,'b');assert.equal(cell(idle,'Friday','Evening').source.kind,'start');assert.ok(idle.notes.some(n=>n.includes('no schedule')));
 const off=pack();off.modules={};const offw=previewWeek(off,'npc',1);assert.ok(offw.notes.some(n=>n.includes('disabled')));assert.ok(offw.cells.every(c=>c.location==='a'&&c.fresh===false));});
test('incompatible overlapping linked rules never throw the preview; the overlap is named and raw cells win by array order',()=>{const p=pack();p.schedules=[{actor:'npc',weekly:[{weekday:'Tuesday',daypart:'Morning',location:'b'},{weekday:'Tuesday',daypart:'Morning',location:'c'}]}];p.gameProject.weeklyRoutines={version:1,actors:[{actor:'npc',rules:[rule('x','everyday','b'),rule('y','everyday','c')]}]};
 const w1=previewWeek(p,'npc',1);assert.ok(w1.notes.some(n=>n.includes('overlap')));assert.equal(cell(w1,'Tuesday','Morning').location,'b');assert.equal(cell(w1,'Monday','Morning').source.kind,'start');});
test('later weeks carry attendance forward from earlier ones and pure functions never mutate the pack',()=>{const p=linked(),before=cp(p);const w2=previewWeek(p,'npc',2);
 assert.equal(cell(w2,'Monday','Morning',2).location,'b');assert.equal(cell(w2,'Monday','Morning',2).date,'2026-10-12');assert.ok(w2.notes.some(n=>n.includes('week 2')));
 assert.deepEqual(p,before);previewWeek(p,'idle',3);assert.deepEqual(p,before);});
const el=tag=>({tag,children:[],dataset:{},value:'',hidden:false,textContent:'',className:'',append(...x){this.children.push(...x);},replaceChildren(...x){this.children=x;},addEventListener(){},classList:{add(){},remove(){}}});
globalThis.document={createElement:el};
function mountView(p,onOpenRule=()=>{}){const parent=el('div'),opened=[];const box=mountSchedulePreview(parent,{getPack:()=>p,onOpenRule:info=>opened.push(info),message:()=>{}});const all=(x=parent)=>[x,...x.children.flatMap(y=>all(y))];const selects=all().filter(x=>x.tag==='select'),buttons=all().filter(x=>x.tag==='button');return {parent,all,opened,selects,buttons,grid:()=>all().find(x=>x.className==='schedule-preview-grid'),
 pickNPC(id){const s=selects[0];s.value=id;s.onchange();},
 pickWeek(w){const s=selects[1];s.value=String(w);s.onchange();},
 cells:()=>all().filter(x=>x.className==='schedule-cell')};}
test('the creator preview renders 21 cells, opens the winning rule for editing and never touches the project',()=>{const p=linked(),before=cp(p),v=mountView(p);
 assert.ok(v.selects.length>=2);assert.deepEqual(v.selects[0].children.map(o=>o.value),['npc','idle']);
 assert.equal(v.cells().length,21);
 const friday=v.cells().find(x=>x.dataset.cell==='Friday/Evening');assert.ok(friday);
 const open=v.all(friday).find(x=>x.tag==='button');assert.ok(open,'rule button');open.onclick();assert.deepEqual(v.opened.pop(),{kind:'rule',id:'friday-evening'});
 v.pickNPC('idle');assert.equal(v.cells().length,21);assert.ok(v.all().some(x=>x.textContent?.includes('no schedule')));
 assert.deepEqual(p,before,'preview never mutates the project');
 v.pickNPC('npc');v.pickWeek(2);assert.equal(v.cells().length,21);assert.deepEqual(p,before);});
test('project switching keeps the preview read-only and drops selections that no longer exist',()=>{const a=linked(),b=pack(),beforeA=cp(a),beforeB=cp(b),v=mountView(a);
 v.pickNPC('npc');v.parent.replaceChildren();
 mountSchedulePreview(v.parent,{getPack:()=>b,onOpenRule:()=>{},message:()=>{}});
 assert.deepEqual(v.all().filter(x=>x.className==='schedule-cell').length,21);
 assert.deepEqual(a,beforeA);assert.deepEqual(b,beforeB);
 mountSchedulePreview(v.parent,{getPack:()=>a,onOpenRule:()=>{},message:()=>{}});
 assert.deepEqual(a,beforeA);assert.deepEqual(v.all().some(x=>x.textContent?.includes('NPC')),true);});

test('disabled schedules retain start attendance despite weekly rules and exception windows',()=>{const p=linked();delete p.modules['world.schedule'];p.scheduleExceptions=[{id:'off',actor:'npc',location:'c',startTick:1,endTick:20}];assert.ok(previewWeek(p,'npc').cells.every(c=>c.location==='a'));assertMatchesRuntime(p,'npc',2);});
test('exception windows without a runtime schedule never move an NPC',()=>{const p=pack();p.scheduleExceptions=[{id:'orphan',actor:'idle',location:'c',startTick:1,endTick:30}];assertMatchesRuntime(p,'idle',2);});
test('periodic catch-up at the first tick includes the tick-zero stop',()=>{const p=pack();p.schedules=[{actor:'npc',period:30,stops:[{at:0,location:'b'},{at:29,location:'a'}]}];assertMatchesRuntime(p,'npc',2);});
test('drifted raw weekly cells cannot claim linked rule provenance',()=>{const p=linked();p.schedules[0].weekly.find(x=>x.weekday==='Tuesday'&&x.daypart==='Morning').location='c';const w=previewWeek(p,'npc');assert.equal(cell(w,'Tuesday','Morning').source.kind,'weekly');assert.ok(w.notes.some(n=>n.includes('drift')));assert.equal(cell(w,'Tuesday','Morning').location,'c');});
test('date and configured weekday plus nondefault daypart intervals match runtime',()=>{for(const calendar of [{startDate:'2026-10-08'},{startWeekday:'Sunday'}]){const p=linked();p.gameProject.calendar=calendar;p.daypart={interval:2};assert.equal(previewWeek(p,'npc').cells.length,21);assertMatchesRuntime(p,'npc',2);}assert.equal(previewWeek(pack(),'missing').cells.length,0);});
test('multiple legacy schedule records resolve in runtime order',()=>{const p=pack();p.schedules=[{actor:'npc',weekly:[{weekday:'Tuesday',daypart:'Morning',location:'b'}]},{actor:'npc',weekly:[{weekday:'Tuesday',daypart:'Morning',location:'c'}]}];assertMatchesRuntime(p,'npc',2);});
import {scheduleDestination as sharedDestination} from '../public/schedule-resolver.mjs';
test('shared resolver preserves the original runtime algorithm at every tick',()=>{const originalHoliday=(p,c)=>(p.calendar?.holidays||[]).find(h=>h.weekday&&h.weekday===c.weekday||h.date&&c.date&&(h.annual?c.date.slice(5)===h.date:c.date===h.date))||null,original=(p,r,t)=>{const ex=(p.scheduleExceptions||[]).find(x=>x.actor===r.actor&&t>=x.startTick&&t<=x.endTick);if(ex)return ex.location;for(const st of r.stops||[])if(t%r.period===st.at)return st.location;if(t%(p.daypart?.interval||4)===0){const c=calendarFor(t,p);for(const st of r.weekly||[])if(st.weekday===c.weekday&&st.daypart===c.daypart&&!(st.skipHolidays&&originalHoliday(p,c)))return st.location;}return null;};for(const interval of [1,2,4,7]){const p=linked();p.daypart={interval};p.schedules[0].period=11;p.schedules[0].stops=[{at:0,location:'c'},{at:3,location:'b'}];p.scheduleExceptions=[{actor:'npc',startTick:13,endTick:22,location:'a'},{actor:'npc',startTick:18,endTick:27,location:'b'}];for(let t=0;t<420;t++){assert.equal(sharedDestination(p,p.schedules[0],t),original(p,p.schedules[0],t));assert.deepEqual(holidayMatch(p,calendarFor(t,p)),originalHoliday(p,calendarFor(t,p)));}}});
test('nonzero playable starts disclose tick-zero authored-location simulation instead of actual start availability',()=>{const p=pack();p.gameProject.calendar.startDate='2026-10-08';p.schedules=[{actor:'npc',weekly:[{weekday:'Thursday',daypart:'Afternoon',location:'b'}]}];p.startOptions=[{id:'later',title:'Later arrival',description:'Nonzero playable start',playerLocation:'a',tick:12}];const before=cp(p),actual=createWorld(p,registry,'nonzero-preview'),view=previewWeek(p,'npc'),atStart=view.cells.find(c=>c.tick===actual.tick);assert.equal(actual.tick,12);assert.equal(actual.actors.npc.location,'a');assert.equal(atStart.location,'b');assert.notEqual(atStart.location,actual.actors.npc.location);assert.ok(view.notes.some(n=>/always starts at tick 0.*authored starting location.*Playable start selections and live campaign state are ignored/.test(n)));assert.ok(view.notes.some(n=>n.includes('Nonzero playable starts are not simulated: Later arrival (later, tick 12)')));const next=previewWeek(p,'npc',2);assert.ok(next.notes.some(n=>n.includes('displayed ticks 84-167; carried attendance follows the tick-zero simulation')));assert.ok(!next.notes.some(n=>n.includes('from tick 84')));assert.deepEqual(p,before);const mounted=mountView(p);assert.equal(mounted.all().filter(e=>e.className==='preview-assumption').length,1);mounted.pickWeek(2);mounted.pickNPC('idle');assert.ok(mounted.all().some(e=>e.className==='preview-assumption'&&e.textContent.includes('live campaign state are ignored')));assert.deepEqual(p,before);});
