import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {director,briefOf,directorContext,PRESETS} from '../packages/modules/director.mjs';
import {statValue} from '../packages/modules/stats.mjs';
import {contextFor} from '../packages/ai/context.mjs';

const probe={id:'test.probe',version:'0.1.0',coreApi:'0.1.0',requires:[],commands:{'test.beat'(tx){tx.emit('story.choiceResolved',{scene:'elsewhere',beat:'opening',choice:'x',text:'A beat happened.'});},'test.calm'(tx){tx.emit('test.calm',{text:'The day cools down.'});},'test.trust'(tx){tx.set(['modules','social.relationships','edges','ada--player'],80);tx.emit('social.relationshipChanged',{actor:'ada',toward:'player',old:20,value:80,delta:60,text:'Ada: Trust 20 → 80'},['player','ada']);}}};
const custom={...registry,[probe.id]:probe};
const pack=(profile={},complications,opportunities)=>{
 const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));delete p.modules['world.schedule'];
 p.modules['story.scenes']='0.1.0';p.modules['story.director']='0.1.0';p.modules['test.probe']='0.1.0';
 p.modules['world.economy']='0.2.0';p.modules['character.stats']='0.1.0';
 p.items=[...p.items,{id:'coin',name:'Brass token',owner:'workshop'}];
 p.activities=[{id:'shift',name:'Work a shift',description:'Four ticks of honest work.',location:'hub',duration:4}];
 p.statDefinitions=[{id:'wit',name:'Wit',min:0,max:10,visibility:'public'}];
 p.scriptedScenes=[
  {id:'sc-jealous',title:'Jealousy, quietly',opening:'Ada is waiting by the workbench, arms crossed.',repeatable:true,trigger:{event:'story.incident',match:{incident:'jealous'}},choices:[{id:'talk',label:'Talk to her',result:'You talk it out.'}]},
  {id:'sc-rival',title:'The rival moves',opening:'Brin corners you near the lathe.',trigger:{event:'story.incident',match:{incident:'rival'}},choices:[{id:'hear',label:'Hear him out',result:'He explains himself.'}]},
  {id:'sc-big',title:'Everything at once',opening:'Both of them are at your door.',trigger:{event:'story.incident',match:{incident:'big'}},choices:[{id:'face',label:'Face it',result:'You face it.'}]},
  {id:'ev-luck',title:'A lucky stall',offer:'director',opening:'A stall of odd ends has appeared from nowhere in particular.',timeCost:4,trigger:{event:'story.opportunity'},choices:[{id:'cash',label:'Take the cash',result:'You sell your finds.',effects:[{type:'money',delta:15}]},{id:'loot',label:'Take the token',result:'A brass token.',effects:[{type:'item',id:'coin',to:'player'}]}]},
  {id:'ev-break',title:'A break in the shift',offer:'director',opening:'Something happens mid-shift that is not the shift.',timeCost:4,trigger:{event:'story.opportunity'},choices:[{id:'learn',label:'Learn something',result:'You learn it.',effects:[{type:'stat',stat:'wit',delta:1}]}]}];
 p.directorProfile={complications:complications||[{id:'jealous',scene:'sc-jealous',kind:'jealousy',weight:10},{id:'rival',scene:'sc-rival',kind:'rival',weight:10}],...(opportunities?{opportunities}:{}),...profile};
 return p;};
const run=p=>{validatePack(p,custom);let s=createWorld(p,custom,'director');const act=(type,args={})=>{const r=execute(s,{id:`t${s.revision}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,custom);s=r.state;return r;};return {act,get pack(){return p;},get s(){return s;},get director(){return s.modules['story.director'];},get pending(){return s.modules['story.scenes'].pending;},get incidents(){return s.events.filter(x=>x.type==='story.incident');}};};
const waits=(c,n)=>{for(let i=0;i<n&&!c.pending;i++)c.act('core.wait');}; // play stops when a complication opens

test('a quiet streak draws an authored complication through the scene queue, and the spent one is not redrawn',()=>{
 const c=run(pack({quietDayparts:1,firstTick:0}));
 waits(c,4);
 assert.equal(c.incidents.length,1);
 const first=c.incidents[0];
 assert.ok(['sc-jealous','sc-rival'].includes(first.payload.scene));
 assert.equal(first.payload.mode,'quiet');assert.equal(first.payload.intensity,1);assert.equal(first.payload.tension,0);
 assert.equal(c.pending,first.payload.scene,'the complication scene starts like any triggered scene');
 assert.equal(c.director.quiet,0);assert.equal(c.director.uses[first.payload.incident],1);
 c.act('story.choose',{scene:first.payload.scene,choice:first.payload.scene==='sc-jealous'?'talk':'hear'});
 waits(c,8); // tick 8 is still day 1 (maxPerDay holds), tick 12 is day 2
 assert.equal(c.incidents.length,2);
 assert.notEqual(c.incidents[1].payload.incident,first.payload.incident);
});

test('eventful play suppresses the director; quiet play invites it',()=>{
 const c=run(pack({quietDayparts:1,firstTick:0,decayPerTick:0,activeThreshold:5,tensionEvents:[{event:'test.calm',weight:-10}]}));
 for(let i=0;i<3;i++){c.act('test.beat');waits(c,4);}
 assert.equal(c.incidents.length,0,'a live daypart does not count as quiet');
 c.act('test.calm');c.act('test.calm'); // the story cools below the threshold
 waits(c,4);
 assert.equal(c.incidents.length,1,'once play goes quiet the director draws');
 assert.equal(c.pending,c.incidents[0].payload.scene);
});

test('cooldowns hold and maxUses retires a complication',()=>{
 const c=run(pack({quietDayparts:1,firstTick:0,decayPerTick:0},[{id:'jealous',scene:'sc-jealous',cooldownTicks:8,maxUses:3}]));
 waits(c,4);assert.equal(c.incidents.length,1);
 c.act('story.choose',{scene:'sc-jealous',choice:'talk'});
 waits(c,4);assert.equal(c.incidents.length,1,'still cooling down');
 assert.equal(c.director.uses.jealous,1);
 waits(c,4);assert.equal(c.incidents.length,2,'cooldown elapsed');
 const spent=run(pack({quietDayparts:1,firstTick:0,decayPerTick:0},[{id:'jealous',scene:'sc-jealous',maxUses:2}]));
 waits(spent,4);spent.act('story.choose',{scene:'sc-jealous',choice:'talk'});waits(spent,8);
 spent.act('story.choose',{scene:'sc-jealous',choice:'talk'});waits(spent,8);
 assert.equal(spent.incidents.length,2);assert.equal(spent.director.uses.jealous,2,'a spent complication never draws again');
});

test('authored when-gates keep a complication in the deck until the world supports it',()=>{
 const c=run(pack({quietDayparts:1,firstTick:0,decayPerTick:0},[{id:'jealous',scene:'sc-jealous',when:{trust:{ada:50}}}]));
 waits(c,4);assert.equal(c.incidents.length,0,'trust is too low');
 c.act('test.trust');waits(c,4);
 assert.equal(c.incidents.length,1);
});

test('intensity unlocks as the campaign days pass',()=>{
 const c=run(pack({quietDayparts:1,firstTick:0,decayPerTick:0,escalationDays:1},[{id:'big',scene:'sc-big',intensity:2}]));
 waits(c,8);assert.equal(c.incidents.length,0,'day 1 is tier 1');
 waits(c,4);assert.equal(c.incidents.length,1,'day 2 unlocks intensity 2');
});

test('maxPerDay allows one drama beat per campaign day',()=>{
 const c=run(pack({quietDayparts:1,firstTick:0,decayPerTick:0},[{id:'jealous',scene:'sc-jealous',maxUses:3}]));
 waits(c,4);c.act('story.choose',{scene:'sc-jealous',choice:'talk'});
 waits(c,4);assert.equal(c.incidents.length,1,'same day: maxPerDay holds');
 waits(c,4);assert.equal(c.incidents.length,2,'next day: fires again');
});

test('randy rolls early whims during eventful play',()=>{
 const c=run(pack({preset:'randy',earlyChancePercent:100,quietDayparts:3,decayPerTick:0,activeThreshold:0,firstTick:0}));
 c.act('test.beat');waits(c,4);
 assert.equal(c.incidents.length,1);
 assert.equal(c.incidents[0].payload.mode,'whim');
 assert.equal(c.pending,c.incidents[0].payload.scene);
});

test('seeded runs draw the same complications in the same order',()=>{
 const plays=()=>{const c=run(pack({quietDayparts:1,firstTick:0,decayPerTick:0}));waits(c,4);c.act('story.choose',{scene:c.pending,choice:c.pending==='sc-jealous'?'talk':'hear'});waits(c,8);return c.incidents.map(x=>`${x.payload.incident}@${x.payload.scene}`);};
 assert.deepEqual(plays(),plays());
});

test('the incident payload carries provenance for metrics',()=>{
 const c=run(pack({quietDayparts:1,firstTick:0}));
 waits(c,4);
 const e=c.incidents[0].payload;
 assert.ok(e.incident&&e.scene);assert.ok(e.kind==='jealousy'||e.kind==='rival');assert.equal(e.intensity,1);assert.equal(e.mode,'quiet');assert.equal(e.quiet,1);assert.equal(typeof e.tension,'number');assert.ok(e.text.length>0);
});

test('the module idles without a profile and the panel renders either way',()=>{
 const p=pack();delete p.directorProfile;
 const c=run(p);waits(c,8);
 assert.equal(c.incidents.length,0);
 assert.equal(director.panel(c.s,p).lines.length,1);
 assert.equal(director.panel(run(pack()).s,pack()).lines.length,3,'profile panel lists tension and each complication');
});

test('director profiles are validated',()=>{
 const sceneSwap={id:'jealous',scene:'sc-rival'}; // scene matches a different incident ID
 const bad=[
  {preset:'luna'},{quietDayparts:0},{earlyChancePercent:150},{jitter:-1},{escalationDays:0},{decayPerTick:99},{activeThreshold:-1},{maxPerDay:9},{firstTick:-1},
  {tensionEvents:[{event:'core.timeAdvanced',weight:4}]},{tensionEvents:[{event:'social.spoke',weight:0}]},{tensionEvents:[{event:'social.spoke',weight:99}]},
  {complications:[{id:'x',scene:'nope'}]},{complications:[sceneSwap]},{complications:[{id:'x',scene:'sc-big',intensity:4}]},{complications:[{id:'x',scene:'sc-big',weight:101}]},{complications:[{id:'x',scene:'sc-big',maxUses:0}]},{complications:[{id:'x',scene:'sc-big',minTick:-1}]},{complications:[{id:'x',scene:'sc-big',when:{trust:{ada:200}}}]},{complications:[{id:'x',scene:'sc-big',tease:'a'.repeat(201)}]}
 ];
 for(const extra of bad)assert.throws(()=>validatePack(pack(extra),custom),/director/i);
 const storylet=pack({complications:[{id:'rival',scene:'sc-rival'}]});storylet.scriptedScenes.find(x=>x.id==='sc-rival').storylet=true;
 assert.throws(()=>validatePack(storylet,custom),/director-fired/);
 const hand=pack({complications:[{id:'rival',scene:'sc-rival'}]});hand.scriptedScenes.find(x=>x.id==='sc-rival').offer='hand';
 assert.throws(()=>validatePack(hand,custom),/director-fired/);
 const multi=pack({complications:[{id:'rival',scene:'sc-rival',maxUses:2}]});
 assert.throws(()=>validatePack(multi,custom),/repeatable/);
 assert.doesNotThrow(()=>validatePack(pack({preset:'phoebe',quietDayparts:2,tensionEvents:[{event:'social.spoke',weight:-3,match:{location:'hub'}}],complications:[{id:'jealous',scene:'sc-jealous',cooldownTicks:12,intensity:2,minTick:4,when:{flags:{}},text:'Trouble finds you.'}]},[{id:'jealous',scene:'sc-jealous',cooldownTicks:12,intensity:2,minTick:4,when:{flags:{}},text:'Trouble finds you.'}]),custom));
});

test('storyteller presets differ and stay overridable',()=>{
 assert.ok(PRESETS.randy.earlyChancePercent>PRESETS.cassandra.earlyChancePercent);
 assert.ok(PRESETS.phoebe.quietDayparts>PRESETS.randy.quietDayparts);
});

test('the director pre-commits and teases one daypart ahead; the teased beat is the beat that fires',()=>{
 const c=run(pack({quietDayparts:2,firstTick:0,decayPerTick:0},[{id:'jealous',scene:'sc-jealous',kind:'jealousy',tease:'Ada keeps glancing at her phone.'}]));
 waits(c,4);
 assert.equal(c.incidents.length,0);
 const teasers=c.s.events.filter(x=>x.type==='story.teaser');
 assert.equal(teasers.length,1);
 assert.equal(teasers[0].payload.text,'Ada keeps glancing at her phone.');
 assert.deepEqual(teasers[0].visibility,['player']);
 assert.equal(c.director.armed.id,'jealous');
 waits(c,4);
 assert.equal(c.incidents.length,1);
 assert.equal(c.incidents[0].payload.incident,teasers[0].payload.incident,'the tease was honest');
 assert.equal(c.incidents[0].payload.armed,true);
 assert.equal(c.director.armed,null);
});

test('an eventful daypart forgets the tease',()=>{
 const c=run(pack({quietDayparts:2,firstTick:0,decayPerTick:0,activeThreshold:5,tensionEvents:[{event:'test.beat',weight:8}]},[{id:'jealous',scene:'sc-jealous'}]));
 waits(c,4);
 assert.ok(c.director.armed,'teased after one quiet daypart');
 c.act('test.beat');waits(c,4);
 assert.equal(c.director.armed,null,'the pressure released elsewhere');
 waits(c,4);
 assert.equal(c.incidents.length,0,'a single quiet daypart is not enough again');
});

test('an empty deck starves out loud, once per streak',()=>{
 const c=run(pack({quietDayparts:1,firstTick:0,decayPerTick:0},[]));
 waits(c,8);
 assert.equal(c.s.events.filter(x=>x.type==='story.starved').length,1);
 assert.equal(c.incidents.length,0);
});

test('authored scene tension replaces the flat beat weight',()=>{
 const p=pack({quietDayparts:1,firstTick:0,decayPerTick:0},[{id:'jealous',scene:'sc-jealous',maxUses:2}]);
 p.scriptedScenes.find(x=>x.id==='sc-jealous').tension=30;
 const c=run(p);
 waits(c,4);assert.equal(c.incidents.length,1);assert.equal(c.director.tension,0,'firing itself does not raise tension');
 c.act('story.choose',{scene:'sc-jealous',choice:'talk'});
 assert.equal(c.director.tension,30,'the scene authored its own weight instead of the default 8');
 const q=pack({quietDayparts:1,firstTick:0,decayPerTick:0},[{id:'jealous',scene:'sc-jealous',maxUses:2}]);
 q.scriptedScenes.find(x=>x.id==='sc-jealous').tension=-4;
 const d=run(q);d.act('test.beat');
 assert.equal(d.director.tension,8);
 waits(d,4);assert.equal(d.incidents.length,1);assert.equal(d.director.tension,8,'decay is off, so the beat survives the boundary');
 d.act('story.choose',{scene:'sc-jealous',choice:'talk'});
 assert.equal(d.director.tension,4,'a calming scene lowers tension');
});

test('the director briefs the narrator from committed state',()=>{
 const p=pack({quietDayparts:1,firstTick:0,decayPerTick:0},[{id:'jealous',scene:'sc-jealous',kind:'jealousy'}]);
 const c=run(p);
 assert.equal(briefOf(directorContext(c.s,p)),'');
 waits(c,4);
 const after=directorContext(c.s,p);
 assert.equal(after.freshKind,'jealousy');
 assert.match(briefOf(after),/jealousy/);
 assert.equal(contextFor(c.s,p,'player').director.tension,0);
});

test('scene tension weights are validated',()=>{
 const p=pack();p.scriptedScenes.find(x=>x.id==='sc-big').tension=99;
 assert.throws(()=>validatePack(p,custom),/tension/);
});

test('quiet dayparts deal authored event actions; taking one costs the daypart and pays out',()=>{
 const p=pack({quietDayparts:5,firstTick:0,opportunityChancePercent:100,opportunitiesPerDay:5},[],[{id:'luck',scene:'ev-luck',weight:10}]);
 const c=run(p);
 waits(c,4);
 assert.deepEqual(c.director.offers.map(o=>o.id),['luck']);
 const list=director.actions(c.s,p);
 assert.equal(list.length,1);assert.equal(list[0].type,'story.startOfferedScene');assert.equal(list[0].storylet.timeCost,4);
 c.act('story.startOfferedScene',{scene:'ev-luck'});
 assert.equal(c.s.tick,8,'the event costs its authored timeCost — a full daypart');
 assert.equal(c.pending,'ev-luck');
 c.act('story.choose',{scene:'ev-luck',choice:'cash'});
 assert.equal(c.s.modules['world.economy'].balance,115,'the money reward applied');
 assert.equal(c.director.offers[0].accepted,true);assert.equal(c.director.oUses.luck,1);
 waits(c,4); // dawn: the taken offer expires and, the scene not being repeatable, stays gone
 assert.equal(c.director.offers.length,0);
});

test('event rewards land: loot in inventory, stats on the player',()=>{
 const c=run(pack({quietDayparts:5,firstTick:0,opportunityChancePercent:100,opportunitiesPerDay:5},[],[{id:'luck',scene:'ev-luck',weight:10}]));
 waits(c,4);c.act('story.startOfferedScene',{scene:'ev-luck'});c.act('story.choose',{scene:'ev-luck',choice:'loot'});
 assert.equal(c.s.modules['items.inventory'].owners.coin,'player');
 const d=run(pack({quietDayparts:5,firstTick:0,opportunityChancePercent:100,opportunitiesPerDay:5},[],[{id:'break',scene:'ev-break',weight:10}]));
 waits(d,4);d.act('story.startOfferedScene',{scene:'ev-break'});d.act('story.choose',{scene:'ev-break',choice:'learn'});
 assert.equal(statValue(d.s,d.pack.playerId,'wit'),1);
});

test('dealt offers expire at dawn and the deck deals them again',()=>{
 const c=run(pack({quietDayparts:5,firstTick:0,opportunityChancePercent:100,opportunitiesPerDay:5},[],[{id:'luck',scene:'ev-luck',weight:10}]));
 waits(c,4);assert.equal(c.director.offers.length,1);
 waits(c,4);assert.equal(c.director.offers.length,1,'same day: the entry is already in hand, no duplicate deal');
 waits(c,4);assert.equal(c.director.offers.length,1,'dawn passed: the old offer expired and a fresh one was dealt');
 assert.equal(c.director.offers[0].id,'luck');
});

test('opportunitiesPerDay caps how many events the director deals per day',()=>{
 const c=run(pack({quietDayparts:5,firstTick:0,opportunityChancePercent:100,opportunitiesPerDay:1},[],[{id:'a',scene:'ev-luck'},{id:'b',scene:'ev-break'}]));
 waits(c,4);assert.equal(c.director.offers.length,1);
 waits(c,4);assert.equal(c.director.oToday,1);assert.equal(c.director.offers.length,1,'the day budget holds');
});

test('finishing an authored activity can deal its tied event; open events only arrive on quiet dayparts',()=>{
 const work=run(pack({firstTick:0,interruptionChancePercent:100,opportunitiesPerDay:5},[],[{id:'break',scene:'ev-break',weight:10,match:{activity:'shift'}},{id:'open',scene:'ev-luck',weight:10}]));
 work.act('core.scene',{text:'Work a shift',location:'hub',characters:[],activity:'other',activityId:'shift'});
 assert.deepEqual(work.director.offers.map(o=>o.id),['break'],'the activity deals only its tied event, never the open deck');
 waits(work,4);
 assert.deepEqual(work.director.offers.map(o=>o.id),['break'],'open events do not arrive with the work roll off');
 const quiet=run(pack({quietDayparts:5,firstTick:0,opportunityChancePercent:100,opportunitiesPerDay:5},[],[{id:'break',scene:'ev-break',weight:10,match:{activity:'shift'}},{id:'open',scene:'ev-luck',weight:10}]));
 waits(quiet,4);
 assert.deepEqual(quiet.director.offers.map(o=>o.id),['open'],'quiet dayparts deal only open events, never activity-tied ones');
});

test('a due complication spends the boundary before events do',()=>{
 const c=run(pack({quietDayparts:1,firstTick:0,opportunityChancePercent:100,opportunitiesPerDay:5},[{id:'jealous',scene:'sc-jealous'}],[{id:'luck',scene:'ev-luck'}]));
 waits(c,4);
 assert.equal(c.incidents.length,1);
 assert.equal(c.director.offers.length,0,'drama took the daypart boundary; events did not also deal');
});

test('director opportunities are validated',()=>{
 assert.throws(()=>validatePack(pack({},[],[{id:'luck',scene:'sc-jealous'}]),custom),/offer:"director"/,'a complication scene cannot double as an opportunity');
 const incident=pack({},[],[{id:'luck',scene:'ev-luck'}]);incident.scriptedScenes.find(x=>x.id==='ev-luck').trigger={event:'story.incident',match:{incident:'luck'}};
 assert.throws(()=>validatePack(incident,custom),/story\.incident/);
 assert.throws(()=>validatePack(pack({},[],[{id:'luck',scene:'ev-luck',match:{activity:'nope'}}]),custom),/match/);
 assert.throws(()=>validatePack(pack({},[],[{id:'luck',scene:'ev-luck',maxUses:2}]),custom),/repeatable/);
 assert.throws(()=>validatePack(pack({},[],[{id:'luck',scene:'ev-luck',weight:-1}]),custom),/weight/);
 assert.throws(()=>validatePack(pack({opportunitiesPerDay:0}),custom),/opportunitiesPerDay/);
 assert.throws(()=>validatePack(pack({interruptionChancePercent:-5}),custom),/interruptionChancePercent/);
 assert.doesNotThrow(()=>validatePack(pack({opportunityChancePercent:50,interruptionChancePercent:25,opportunitiesPerDay:3},[],[{id:'luck',scene:'ev-luck',kind:'windfall',cooldownTicks:12,when:{flags:{}},text:'A stall appears.'},{id:'break',scene:'ev-break',match:{activity:'shift'}}]),custom));
});
