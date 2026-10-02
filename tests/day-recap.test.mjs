import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,replay,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {createSheet} from '../packages/core/character-sheet.mjs';
import {recap,dayRecap,dayRecaps,RECAP} from '../packages/modules/recap.mjs';

// A probe fires committed events the real modules already emit, so a day can be staged with no model call.
const probe={id:'test.recap-probe',version:'0.1.0',coreApi:'0.1.0',requires:[],commands:{'test.recapEvent'(tx,args){tx.emit(args.type,args.payload,[tx.pack.playerId]);}}};
const mods={...registry,[probe.id]:probe};
const campus=()=>JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url),'utf8'));
const trio=()=>JSON.parse(readFileSync(new URL('../packs/campus-trio.json',import.meta.url),'utf8'));
const noDigits=lines=>assert.ok(lines.every(l=>!/\d/.test(l)),`a number leaked: ${JSON.stringify(lines)}`);

// Bare pack: the clock and nothing else, so a day can close empty.
const bare=(extra={})=>{const p={schemaVersion:1,id:'test.recap',version:'0.1.0',title:'Recap',playerId:'player',modules:{'social.conversation':'0.1.0','story.scenes':'0.1.0','story.director':'0.1.0','story.recap':'0.1.0','test.recap-probe':'0.1.0'},scriptedScenes:[],locations:[{id:'room',name:'Room',exits:[]}],actors:[{id:'player',name:'You',location:'room'},{id:'mia',name:'Mia',location:'room'}]};return Object.assign(p,extra);};
const sheet=(id,wants)=>{const s=createSheet(id);s.personality.traits=['warm','curious'];s.wants=wants;return s;};
// Full pack: acts price warmth, clues and her own wants; ranks can move; plans and the director are readable.
const pack=(o={})=>{
 const p={schemaVersion:1,id:'test.recap-full',version:'0.1.0',title:'Recap',playerId:'player',
  modules:{'social.conversation':'0.1.0','social.relationships':'0.1.0','items.inventory':'0.2.0','social.dating':'0.1.0','social.romance-tempo':'0.2.0','social.acts':'0.1.0','social.wants':'0.1.0','story.scenes':'0.1.0','story.director':'0.1.0','story.recap':'0.1.0','test.recap-probe':'0.1.0'},
  gameProject:{premise:'Test',setting:'Test',conversationStyle:'authored',ai:{intent:'',scene:'',daypart:''}},
  locations:[{id:'room',name:'Room',exits:[{to:'stacks'}]},{id:'stacks',name:'Stacks',exits:[{to:'room'}]}],
  actors:[{id:'player',name:'You',location:'room'},{id:'mia',name:'Mia',location:'room',traits:['warm']}],
  datingProfiles:[{character:'mia',thresholds:{crush:0,date:10,exclusive:20},preferences:[],signals:[]}],
  romanceTempoProfiles:[{character:'mia',advancement:'automatic',ranks:[{id:'start',name:'Strangers',points:0,ceiling:30},{id:'friend',name:'Friends',points:25,ceiling:60}]}],
  actProfiles:[{character:'mia',repeatDecayPercent:100,entries:[{id:'mia-sea',kind:'listen',target:'sea',points:3,reason:'you asked about the sea and listened'},{id:'mia-sea-no',kind:'listen',target:'boards',points:-3,reason:'you let her talk and changed the subject'}],fallback:{landed:1,missed:0}}],
  characterSheets:[sheet('mia',[{id:'sea',text:'someone to talk to about the sea',keys:['listen']},{id:'boards',text:'the weather on the boards',keys:['listen']}])],
  wantSettings:{reward:3,active:2},romanceStats:{dailyGain:40},scriptedScenes:[],...(o.tune||{})};
 validatePack(p,mods);return p;};
const run=(p,id='recap')=>{validatePack(p,mods);let s=createWorld(p,mods,id,7);return {get state(){return s;},load(v){s=structuredClone(v);},cmd(type,args={}){const r=execute(s,{id:`t${s.revision}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,mods);s=r.state;return r.turn.events;},acts(list,sceneId='scene'){return this.cmd('social.priceActs',{character:'mia',sceneId,acts:list});},event(type,payload){return this.cmd('test.recapEvent',{type,payload});},days(n=12){for(let i=0;i<n;i++)this.cmd('core.wait');return this;},lines(){return dayRecaps(this.state,p).at(-1)?.lines||[];}};};

test('a day closes with three to six lines, in words, from committed state alone',()=>{
 const p=pack(),g=run(p);
 for(let i=0;i<9;i++)g.acts([{kind:'listen',target:'sea'}],`scene-${i}`);
 g.event('story.incident',{incident:'stacks',kind:'obstacle',text:'Something goes wrong in the stacks.'});
 g.state.modules['story.director'].owed={id:'stacks',scene:'stacks',kind:'obstacle',tone:2,intensity:2,roles:{lead:'mia'},text:'You walked away from this once.'};
 g.days();
 const days=dayRecaps(g.state,p),lines=g.lines();
 assert.equal(days.length,1,'the day closed once');assert.equal(days[0].day,1);assert.equal(days[0].weekday,'Monday');
 assert.ok(lines.length>=3&&lines.length<=RECAP.max,`three to six lines: ${lines.length}`);
 noDigits(lines);
 assert.ok(lines.includes('You and Mia reached Friends.'),lines.join(' | '));
 assert.match(lines.find(l=>/warmer|warm/.test(l)),/Mia looks much warmer toward you\./);
 assert.ok(lines.some(l=>l.startsWith('Mia likes it when you asked about the sea and listened.')),'the new clue');
 assert.ok(lines.includes('Mia gets what she wanted.'),'a want of her own, met');
 assert.ok(lines.includes('You spent the day with Mia.'),'who she was with');
 assert.ok(lines.includes('What you brushed off comes back harder tomorrow.'),'what tomorrow holds');
 assert.deepEqual(g.state.events.filter(e=>e.type==='story.dayClosed').map(e=>e.payload.lines),[lines],'the event carries the same lines');
 assert.deepEqual(recap.panel(g.state,p).lines,['Monday: '+lines.join(' ')],'the panel reads the same day');
});

test('a quiet day says so once, and an empty day never invents a line',()=>{
 const p=bare(),g=run(p,'quiet'),other=run(bare(),'quiet-two');
 g.days(12);other.days(12);
 assert.equal(g.state.tick,12);
 assert.deepEqual(g.lines(),['A quiet day; nothing changed.']);
 assert.deepEqual(other.lines(),g.lines(),'the same save reads the same');
 const first=[...new Set(g.state.events.filter(e=>e.type==='story.dayClosed').map(e=>e.payload.lines.flat().length))];
 assert.deepEqual(first,[1],'one honest line, not a filled list');
 noDigits(g.lines());
 assert.deepEqual(g.lines(),dayRecap(g.state,p,1).lines,'the card view and the stored day agree');
});

test('nothing in the recap needs a model call, and a replay rebuilds it from patches',()=>{
 const p=pack(),g=run(p),initial=structuredClone(g.state);
 for(let i=0;i<4;i++)g.acts([{kind:'listen',target:'sea'}],`scene-${i}`);
 g.days();
 const rebuilt=replay(initial,g.state.events);
 assert.deepEqual(rebuilt.modules['story.recap'],g.state.modules['story.recap'],'replay rebuilds the recap from patches alone');
 const h=run(p);h.load(JSON.parse(JSON.stringify(g.state)));
 assert.deepEqual(h.lines(),g.lines(),'a save and reload reads the same');
});

test('the kept window holds the last seven days, newest last, and the pack decides',()=>{
 const p=bare(),g=run(p,'keep');
 g.days(12*8);
 const days=dayRecaps(g.state,p);
 assert.equal(days.length,7,'seven days kept');
 assert.deepEqual(days.map(d=>d.day),[2,3,4,5,6,7,8],'the oldest kept day falls off the front');
 assert.equal(days.at(-1).day,8,'the morning card reads the newest day');
 assert.ok(days.every(d=>d.lines.length===1&&!/\d/.test(d.lines[0])));
 const short=bare({dayRecap:{keep:2}}),h=run(short,'keep-two');
 h.days(12*4);
 assert.deepEqual(dayRecaps(h.state,short).map(d=>d.day),[3,4],'the pack number decides the window');
});

test('what is at stake survives a busy day, and the pack caps the rest',()=>{
 const p=bare({dayRecap:{max:3}}),g=run(p,'stake');
 for(const text of ['One thing happened.','Another thing happened.','And a third.'])g.event('story.beatIgnored',{incident:'x',text});
 g.state.modules['story.director'].armed={id:'x',delivery:'incident'};
 g.days();
 assert.equal(g.lines().length,3,'the pack caps the lines');
 assert.ok(g.lines().includes('Something you have been warned about is waiting to happen.'),g.lines().join(' | '));
 const noRoom=bare({dayRecap:{max:1}}),h=run(noRoom,'stake-tight');
 h.state.modules['story.director'].owed={id:'x',scene:'x',kind:'obstacle',tone:2,intensity:2,roles:{},text:''};
 h.days();
 assert.deepEqual(h.lines(),['What you brushed off comes back harder tomorrow.'],'the stake line is never crowded out');
});

test('promises made, kept and broken all read as lines',()=>{
 const p=pack(),g=run(p,'plans');
 g.event('story.planCreated',{id:'plan-1',character:'mia',plan:'Meet at the stacks',deadlineTick:20,status:'pending'});
 g.event('social.planKept',{character:'mia',location:'stacks',text:'You kept your plan with Mia.'});
 g.state.modules['story.scenes'].plans=[{id:'plan-1',character:'mia',plan:'Meet at the stacks',deadlineTick:20,status:'pending',visibility:['player','mia']}];
 g.days(12);
 assert.deepEqual(g.lines(),['You kept your word to Mia.','You spent the day with Mia.','Your plan with Mia is still open.'],'kept, who she was with, and the plan still open');
 const missed=run(p,'plans-broken');
 missed.event('social.planMade',{character:'mia',location:'stacks',text:'You plan to meet Mia at the stacks.'});
 missed.event('social.planMissed',{character:'mia',location:'stacks',text:'You missed your plan with Mia.'});
 missed.days(12);
 assert.ok(missed.lines().includes('You let Mia down.'),missed.lines().join(' | '));
 noDigits(missed.lines());
});

test('missing pack fields are legacy, and invalid numbers are rejected',()=>{
 const p=bare(),g=run(p,'legacy');
 g.days();
 assert.equal(dayRecaps(g.state,bare()).length,1,'no dayRecap field reads the default window');
 assert.equal(RECAP.keep,7,'and the default is seven days');
 const off=bare({modules:{'social.conversation':'0.1.0'}}),h=run(off,'no-module');
 h.days();
 assert.deepEqual(dayRecaps(h.state,off),[],'a pack without the module has no recap');
 assert.equal(h.state.events.some(e=>e.type==='story.dayClosed'),false,'and closes no day with one');
 assert.doesNotThrow(()=>validatePack(bare({dayRecap:{}}),mods));
 for(const change of [p=>p.dayRecap=[],p=>p.dayRecap={max:0},p=>p.dayRecap={keep:0},p=>p.dayRecap={max:2.5},p=>p.dayRecap={keep:31},p=>p.dayRecap='six']){const q=bare();change(q);assert.throws(()=>validatePack(q,mods),/dayRecap/);}
});

test('the campus showcase ships the recap and the UI shows, dismisses and keeps it',()=>{
 for(const p of [campus(),trio()]){
  validatePack(p,registry);
  assert.equal(p.modules['story.recap'],'0.1.0');
  assert.deepEqual(p.dayRecap,{max:6,keep:7});
  assert.deepEqual(createWorld(p,registry,'recap-campus').modules['story.recap'],{days:[]});
 }
 const html=readFileSync(new URL('../public/play.html',import.meta.url),'utf8'),
  js=readFileSync(new URL('../public/play.mjs',import.meta.url),'utf8'),
  css=readFileSync(new URL('../public/play.css',import.meta.url),'utf8'),
  studio=readFileSync(new URL('../public/studio.mjs',import.meta.url),'utf8');
 assert.match(html,/id="recap-card"/,'a card of its own to dismiss');
 assert.match(html,/id="recap-card-entries"/);
 assert.match(js,/function showRecapCard/);
 assert.match(js,/story\.recap/,'the screen reads the closed days');
 assert.match(js,/recap-card'\)\.showModal\(\)/);
 assert.match(js,/for\(const id of \['recap-card','day-card','end-card','messages'\]\)/,'dismissing it queues the next card');
 assert.match(js,/journal-recaps/,'the journal keeps them');
 assert.match(js,/s\.modules\['story\.recap'\]\?\.days\|\|\[\]/,'the window comes from committed state');
 assert.match(css,/\.recap-line/);
 assert.match(studio,/function dayRecapEditor/);
 assert.match(studio,/section\('Day recap'/);
 assert.match(studio,/dayRecap=\{max:6,keep:7\}/,'the control offers the campus default');
});
