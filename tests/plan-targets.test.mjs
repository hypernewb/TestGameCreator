import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {calendarFor} from '../public/calendar.mjs';

// Invite targets come from the model in loose shapes; each one that names a day and a known place becomes a dated plan.
const pack=()=>({schemaVersion:1,id:'test.plans',version:'0.1.0',title:'Plans',playerId:'player',
 modules:{'social.conversation':'0.1.0','social.relationships':'0.1.0','items.inventory':'0.2.0','social.dating':'0.1.0','social.romance-tempo':'0.2.0','social.acts':'0.1.0'},
 gameProject:{premise:'Test',setting:'Test',conversationStyle:'authored',ai:{intent:'',scene:'',daypart:''}},
 locations:[{id:'dock',name:'Harbor Dock',exits:[{to:'shore'}]},{id:'shore',name:'Glass Shore Beach',exits:[{to:'dock'}]}],
 actors:[{id:'player',name:'You',location:'dock'},{id:'ilse',name:'Ilse',location:'dock'}],
 datingProfiles:[{character:'ilse',thresholds:{crush:0,date:10,exclusive:20},preferences:[],signals:[]}],romanceTempoProfiles:[{character:'ilse',initialPoints:10,ranks:[{id:'start',name:'Start',points:0,ceiling:100}]}],
 actProfiles:[{character:'ilse',entries:[],fallback:{landed:0,missed:0}}]});
const invite=target=>{const p=pack();validatePack(p,registry);const s=createWorld(p,registry,'plans',0),r=execute(s,{id:'t1',actorId:'player',type:'social.priceActs',args:{character:'ilse',sceneId:'scene',acts:[{kind:'invite',target}]},expectedRevision:s.revision},p,registry);return {p,s:r.state,made:r.turn.events.find(e=>e.type==='social.planMade')?.payload};};

test('loose invite targets become dated plans at the named place',()=>{
 for(const [target,weekday,part] of [['sunday@beach','Sunday','Afternoon'],['sunday-evening@shore','Sunday','Evening'],['shore@sunday-morning','Sunday','Morning'],['glass-shore-beach@sunday','Sunday','Afternoon'],['sunday-night@beach','Sunday','Evening']]){
  const {p,made}=invite(target);assert.ok(made,target);assert.equal(made.location,'shore',target);
  const at=calendarFor(made.due,p);assert.equal(at.weekday,weekday,target);assert.equal(at.daypart,part,target);
  assert.match(made.text,new RegExp(`Glass Shore Beach on ${weekday} ${part.toLowerCase()}`),target);}
 const {p,s,made}=invite('tonight@dock');assert.equal(calendarFor(made.due,p).daypart,'Evening');assert.ok(made.due>s.tick,'tonight is still ahead');
});
test('an invite with no day or no known place makes no plan',()=>{
 for(const target of ['beach','sunday','sunday@moon','fun'])assert.equal(invite(target).made,undefined,target);
});
test('the calendar lists pending plans soonest first with their day',async()=>{
 const {upcomingPlans}=await import('../public/planner.mjs'),{p,s}=invite('sunday-evening@beach');
 s.modules['story.scenes']={plans:[{id:'x',character:'ilse',plan:'Return the book',deadlineTick:2,status:'pending'},{id:'y',character:'ilse',plan:'Old',deadlineTick:1,status:'kept'}]};
 const list=upcomingPlans(s,p);assert.deepEqual(list.map(x=>x.text),['Return the book','Meet Ilse at Glass Shore Beach']);
 assert.match(list[0].when,/^by \w+day /);assert.match(list[1].when,/^Sunday evening$/);
});
test('the character turns up for an agreed plan and waiting there keeps it',()=>{
 let {p,s}=invite('sunday-evening@beach');const run=(type,args={})=>{s=execute(s,{id:'c'+s.revision,actorId:'player',type,args,expectedRevision:s.revision},p,registry).state;};
 const due=s.modules['social.acts'].characters.ilse.plans[0].due;run('core.move',{to:'shore'});
 for(let i=0;i<40&&s.tick<due;i++)run('core.wait',{until:calendarFor(s.tick+1,p).daypart==='Evening'?'Morning':'Evening'});
 assert.ok(s.tick>=due);assert.equal(s.actors.ilse.location,'shore');assert.equal(s.modules['social.acts'].characters.ilse.plans[0].status,'kept');
});
