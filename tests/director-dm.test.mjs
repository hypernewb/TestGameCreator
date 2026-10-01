import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {director,directorContext} from '../packages/modules/director.mjs';
import {funMetrics,funLine} from '../packages/testing/fun-metrics.mjs';
import {beatDirection} from '../packages/ai/beats.mjs';

const probe={id:'test.probe',version:'0.1.0',coreApi:'0.1.0',requires:[],commands:{
 'test.say'(tx,a){tx.emit('core.sceneContinued',{activity:'continue',location:'hub',characters:['ada'],text:a.text||'hello'},[tx.pack.playerId,'ada']);},
 'test.change'(tx){tx.emit('story.choiceResolved',{scene:'elsewhere',beat:'opening',choice:'x',text:'A beat happened.'});}}};
const custom={...registry,[probe.id]:probe};
const pack=(profile={},complications,opportunities)=>{
 const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));delete p.modules['world.schedule'];
 p.modules['story.scenes']='0.1.0';p.modules['story.director']='0.1.0';p.modules['test.probe']='0.1.0';p.modules['world.economy']='0.2.0';
 p.scriptedScenes=[
  {id:'sc-jealous',title:'Jealousy, quietly',opening:'Ada is waiting by the workbench, arms crossed.',repeatable:true,trigger:{event:'story.incident',match:{incident:'jealous'}},choices:[{id:'talk',label:'Talk to her',result:'You talk it out.'}]},
  {id:'sc-rival',title:'The rival moves',opening:'Brin corners you near the lathe.',trigger:{event:'story.incident',match:{incident:'rival'}},choices:[{id:'hear',label:'Hear him out',result:'He explains himself.'}]},
  {id:'sc-big',title:'Everything at once',opening:'Both of them are at your door.',trigger:{event:'story.incident',match:{incident:'big'}},choices:[{id:'face',label:'Face it',result:'You face it.'}]},
  {id:'ev-luck',title:'A lucky stall',offer:'director',opening:'A stall of odd ends has appeared from nowhere in particular.',timeCost:4,trigger:{event:'story.opportunity'},choices:[{id:'cash',label:'Take the cash',result:'You sell your finds.',effects:[{type:'money',delta:15}]}]}];
 p.directorProfile={complications:complications||[],...(opportunities?{opportunities}:{}),...profile};
 return p;};
const run=p=>{validatePack(p,custom);let s=createWorld(p,custom,'director-dm');const act=(type,args={})=>{const r=execute(s,{id:`t${s.revision}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,custom);s=r.state;return r;};return {act,get pack(){return p;},get s(){return s;},get director(){return s.modules['story.director'];},get pending(){return s.modules['story.scenes'].pending;},get incidents(){return s.events.filter(x=>x.type==='story.incident');}};};
const waits=(c,n)=>{for(let i=0;i<n&&!c.pending;i++)c.act('core.wait');};

test('the director never teases an offer: the due draw deals it as a choosable event instead',()=>{
 const c=run(pack({quietDayparts:2,firstTick:0,decayPerTick:0,adaptive:true,opportunitiesPerDay:5},[{id:'jealous',scene:'sc-jealous',template:'jealous',when:{trust:{ada:50}}}],[{id:'luck',scene:'ev-luck',template:'luck'}]));
 waits(c,4);
 assert.equal(c.s.events.filter(e=>e.type==='story.teaser').length,0,'an offer is never pre-committed as a tease');
 assert.equal(c.director.armed,null);
 waits(c,4);
 assert.equal(c.s.events.filter(e=>e.type==='story.teaser').length,0);
 assert.equal(c.incidents.length,0);
 assert.deepEqual(c.director.offers.map(o=>o.id),['luck'],'the due draw deals the offer openly');
});

test('walking out of a director beat is owed once: tone+1 at the next quiet boundary, then done',()=>{
 const c=run(pack({quietDayparts:1,firstTick:0,decayPerTick:0,adaptive:true},[{id:'jealous',scene:'sc-jealous',template:'jealous',focus:'ada'}]));
 waits(c,4);
 assert.equal(c.incidents.length,1);
 c.act('story.leave',{scene:'sc-jealous'});
 assert.equal(c.director.owed.id,'jealous');
 assert.ok(c.s.events.some(e=>e.type==='story.beatIgnored'),'the walk-away is announced, not silent');
 waits(c,4); // same day: maxPerDay holds the escalation back
 assert.equal(c.incidents.length,1);
 waits(c,4); // next day: it comes back harder
 assert.equal(c.incidents.length,2);
 const esc=c.incidents[1].payload;
 assert.equal(esc.mode,'escalation');assert.equal(esc.tone,2);assert.equal(esc.escalated,true);
 assert.equal(c.director.owed,null);assert.equal(c.director.escalated.jealous,true);
 assert.equal(c.pending,'sc-jealous','the repair path is playing it through');
 c.act('story.leave',{scene:'sc-jealous'});
 assert.ok(c.s.events.some(e=>e.type==='story.beatDropped'),'ignoring it a second time resolves it for good');
 assert.equal(c.director.owed,null);
 waits(c,4);
 assert.equal(c.incidents.length,2,'never a second escalation');
});

test('a stalled scene is interrupted: N free turns with nothing committed bring the cast in',()=>{
 const c=run(pack({quietDayparts:9,firstTick:0,decayPerTick:0,adaptive:true,stallTurns:3},[{id:'jealous',scene:'sc-jealous',template:'jealous'}]));
 c.act('core.scene',{text:'Hang out',location:'hub',characters:['ada'],activity:'talk'});
 c.act('test.say',{text:'hello'});
 assert.equal(c.director.stall,1);
 c.act('test.say',{text:'hello'});
 c.act('test.change');
 assert.equal(c.director.stall,0,'a committed change resets the stall');
 c.act('test.say',{text:'hello'});
 c.act('test.say',{text:'hello'});
 assert.equal(c.director.armed,null,'no interruption before the threshold');
 assert.equal(c.incidents.length,0);
 c.act('test.say',{text:'hello'});
 assert.equal(c.incidents.length,1,'the stalled scene is interrupted mid-conversation');
 assert.equal(c.pending,'sc-jealous','the cast arrives: the incident scene takes over');
 assert.equal(c.director.stall,0);
 c.act('story.choose',{scene:'sc-jealous',choice:'talk'});
 assert.equal(c.director.stall,0,'the count resets when the scene ends');
});

test('a non-adaptive pack never counts stalls, so the legacy fixture stays frozen',()=>{
 const c=run(pack({quietDayparts:9,firstTick:0,decayPerTick:0},[{id:'jealous',scene:'sc-jealous'}]));
 c.act('core.scene',{text:'Hang out',location:'hub',characters:['ada'],activity:'talk'});
 for(let i=0;i<8;i++)c.act('test.say',{text:'hello'});
 assert.equal(c.director.stall,0);
 assert.equal(c.incidents.length,0);
});

test('a non-adaptive pack never escalates, so the legacy fixture stays frozen',()=>{
 const c=run(pack({quietDayparts:1,firstTick:0,decayPerTick:0},[{id:'jealous',scene:'sc-jealous'}]));
 waits(c,4);
 c.act('story.leave',{scene:'sc-jealous'});
 assert.equal(c.director.owed,null);
 waits(c,8);
 assert.equal(c.incidents.length,1);
});

test('the callback line quotes the last beat: how it played out, or that you walked away',()=>{
 const p=pack({quietDayparts:1,firstTick:0,decayPerTick:0},[{id:'jealous',scene:'sc-jealous'}]);
 const c=run(p);
 assert.equal(directorContext(c.s,p).lastBeat,undefined);
 waits(c,4);
 c.act('story.choose',{scene:'sc-jealous',choice:'talk'});
 assert.match(directorContext(c.s,p).lastBeat,/played out/);
 const d=run(pack({quietDayparts:1,firstTick:0,decayPerTick:0},[{id:'rival',scene:'sc-rival'}]));
 waits(d,4);
 d.act('story.leave',{scene:'sc-rival'});
 assert.match(directorContext(d.s,p).lastBeat,/walked away/);
});

test('after the heaviest tone the next draw is a breather: an offered event, then the curve resets',()=>{
 const c=run(pack({quietDayparts:1,firstTick:0,decayPerTick:0,adaptive:true,opportunitiesPerDay:5},[{id:'big',scene:'sc-big',template:'big',tone:3,weight:100}],[{id:'luck',scene:'ev-luck',template:'luck'}]));
 waits(c,4);
 assert.equal(c.incidents.length,1);
 assert.equal(c.incidents[0].payload.tone,3);
 assert.equal(c.director.breatherNext,true);
 c.act('story.choose',{scene:'sc-big',choice:'face'});
 waits(c,4);
 assert.equal(c.incidents.length,1,'no complication lands right after the peak');
 assert.deepEqual(c.director.offers.map(o=>o.id),['luck']);
 assert.equal(c.director.breatherNext,false);
});

test('the spotlight remembers who the last beat starred, so the draw can rotate off them',()=>{
 const c=run(pack({quietDayparts:1,firstTick:0,decayPerTick:0},[{id:'jealous',scene:'sc-jealous',focus:'ada'},{id:'rival',scene:'sc-rival',focus:'ada'}]));
 waits(c,4);
 assert.equal(c.incidents.length,1);
 assert.equal(c.director.lastFocus,'ada');
});

test('spotlight equity counts who the dealt beats starred',()=>{
 const state={turns:{t1:{id:'t1',command:'say',input:true,events:[{type:'story.incident',payload:{roles:{lead:'ada',rival:'brin'}}}]},t2:{id:'t2',command:'say',input:true,events:[{type:'story.incident',payload:{roles:{lead:'ada'}}}]}}};
 const m=funMetrics(state,{scriptedScenes:[],datingProfiles:[]});
 assert.deepEqual(m.spotlight.counts,[{id:'ada',n:2},{id:'brin',n:1}]);
 assert.equal(m.spotlight.spread,2);
 assert.match(funLine(m),/spotlight ada:2 brin:1/);
 assert.equal(funMetrics({turns:{}},{scriptedScenes:[]}).spotlight,null);
});

test('the narrator can glance back at the director callback line on an opening',()=>{
 const bp={actors:[{id:'ada',name:'Ada',personality:'warm and curious'}]};
 const ctx=director=>({stagedCast:['ada'],scenePhase:'opening',playerAction:'hey',day:1,actor:{relationshipToPlayer:50},director});
 const withLine=i=>beatDirection(ctx({lastBeat:'you walked away from "Jealousy, quietly"'}),bp,i);
 const without=i=>beatDirection(ctx({}),bp,i);
 assert.ok([...Array(40).keys()].some(i=>withLine(i).includes('walked away')),'some openings quote the last beat');
 assert.ok([...Array(40).keys()].every(i=>!without(i).includes('walked away')),'an empty director context never does');
});

test('authored beat text can quote the previous beat with {last}',()=>{
 const c=run(pack({quietDayparts:1,firstTick:0,decayPerTick:0},[{id:'jealous',scene:'sc-jealous'},{id:'rival',scene:'sc-rival',minTick:8,text:'Remember {last}?'}]));
 waits(c,4);
 assert.equal(c.incidents[0].payload.incident,'jealous');
 c.act('story.choose',{scene:'sc-jealous',choice:'talk'});
 waits(c,8); // tick 12 is day 2: the daily cap holds one beat per day
 assert.equal(c.incidents[1].payload.incident,'rival');
 assert.equal(c.incidents[1].payload.text,'Remember the "Jealousy, quietly" moment played out?');
});

test('spotlight rotation flips a near-tie off the last beat\'s focus, only when another focus exists',()=>{
 const p=pack({quietDayparts:1,firstTick:0,decayPerTick:0,jitter:0,maxPerDay:5,adaptive:true},[
  {id:'jealous',scene:'sc-jealous',template:'a',roles:{lead:'ada'},focus:'ada',weight:15,maxUses:5},
  {id:'big',scene:'sc-big',template:'b',roles:{lead:'ada'},focus:'ada',weight:10,maxUses:5},
  {id:'rival',scene:'sc-rival',template:'c',roles:{lead:'brin'},focus:'brin',weight:10,maxUses:5}]);
 p.scriptedScenes.find(x=>x.id==='sc-rival').repeatable=true;
 p.scriptedScenes.find(x=>x.id==='sc-big').repeatable=true;
 const c=run(p);
 waits(c,4);
 assert.equal(c.incidents[0].payload.incident,'jealous');
 c.act('story.choose',{scene:'sc-jealous',choice:'talk'});
 waits(c,4);
 assert.equal(c.incidents[1].payload.incident,'rival','rotation picked the other focus over the equal-weight same-focus beat');
 assert.equal(c.director.lastFocus,'brin');
 c.act('story.choose',{scene:'sc-rival',choice:'hear'});
 waits(c,4);
 assert.equal(c.incidents[2].payload.incident,'big','the deck is never suppressed: same-focus beats still fire');
});
