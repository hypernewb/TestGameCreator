import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,replay,validatePack,resolveModules} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {setLust,raiseBaseline,touchLadderContext} from '../packages/modules/touch-ladder.mjs';
import {easeLust,lustBaselineOf} from '../packages/modules/romance-stats.mjs';
import {lustBaselineHint} from '../public/lust-baseline.mjs';
import {sceneFeedback} from '../public/scene-feedback.mjs';

const CAMPUS=JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url))).lustBaseline;
const pack=(extra={})=>{const p={schemaVersion:1,id:'test.lust-baseline',version:'0.1.0',title:'Baseline',playerId:'player',modules:{'social.conversation':'0.1.0','social.relationships':'0.1.0','social.touch-ladder':'0.1.0','social.dating':'0.1.0','social.romance-tempo':'0.2.0','items.inventory':'0.2.0','social.acts':'0.1.0'},locations:[{id:'cafe',name:'Cafe',exits:[]}],actors:[{id:'player',name:'You',location:'cafe'},{id:'mia',name:'Mia',location:'cafe'},{id:'sam',name:'Sam',location:'cafe'}],touchLadder:{privateLocations:['cafe']},datingProfiles:[{character:'mia',initialChemistry:20,agreements:['monogamous'],thresholds:{crush:10,date:20,exclusive:30},preferences:[],signals:[]}],romanceTempoProfiles:[{character:'mia',ranks:[{id:'start',name:'Start',points:0,ceiling:50}]}],actProfiles:[{character:'mia',entries:[],fallback:{landed:0,missed:0}}],romanceStats:{dailyGain:6},sceneFeedback:{mood:true,chips:true},lustBaseline:structuredClone(CAMPUS),...extra};validatePack(p,registry);return p;};
// Every command runs through execute, so the module react hooks fire exactly as in play.
const run=p=>{let s=createWorld(p,registry,'baseline',7);const drive=(type,args={})=>{const r=execute(s,{id:`t${s.revision}`,actorId:'player',type,args,expectedRevision:s.revision},p,registry);s=r.state;return r;};const probe=()=>({state:s,pack:p,commandId:'probe',set(path,value){let at=this.state;for(const k of path.slice(0,-1))at=at[k];at[path.at(-1)]=value;},emit(type,payload){(s.events||=[]).push({id:`e${s.events.length}`,type,payload,tick:s.tick,visibility:[]});}});return {drive,get s(){return s;},advance(ticks=1){for(let i=0;i<ticks;i++)drive('core.wait');return this;},ladder(id='mia'){return s.modules['social.touch-ladder'].characters[id];},earned(id='mia'){return this.ladder(id).lustBaseline||0;},bump(id,value){return setLust(probe(),id,value);},raise(id,key,detail={}){return raiseBaseline(probe(),id,key,detail);},react(event){for(const m of resolveModules(p,registry))m.react?.(probe(),event);return this;}};};

test('campus tuning is the brief: 25% per daypart, +5 intimate first, dating and exclusive, +2 per acted preference',()=>{
  assert.equal(CAMPUS.perDaypart,0.25);
  assert.deepEqual(CAMPUS.milestones,{intimateFirst:5,dating:5,exclusive:5,preference:2});
  assert.equal(lustBaselineOf({}),undefined,'a pack without the field has no baseline at all');
  assert.equal(lustBaselineOf({lustBaseline:{}}).perDaypart,0.25,'missing keys fall back to the campus default');
  assert.equal(lustBaselineOf({lustBaseline:{perDaypart:0.5}}).perDaypart,0.5);
  assert.equal(lustBaselineOf({lustBaseline:{milestones:{preference:9}}}).milestones.preference,9);
  assert.equal(lustBaselineOf({lustBaseline:{milestones:{preference:9}}}).milestones.dating,5,'unspecified milestones keep their default');
  assert.equal(run(pack()).earned(),0,'a heroine starts with no earned floor');
});

test('Lust eases a quarter of the gap toward the earned floor each daypart and never below it',()=>{
  const g=run(pack());
  g.bump('mia',40);g.raise('mia','dating');
  assert.equal(g.earned(),5);
  g.advance(4);assert.equal(g.ladder().lust,31.25,'40 -> 31.25 is a quarter of the 35-point gap, one daypart');
  g.advance(4);assert.equal(g.ladder().lust,24.69);
  g.advance(8);assert.equal(g.ladder().lust,16.08,'dayparts compound: 24.69 -> 19.77 -> 16.08');
  g.bump('mia',1);g.advance(4);assert.equal(g.ladder().lust,2,'a shortfall eases back up, it is not held down');
  g.advance(60);assert.equal(g.ladder().lust,5,'the floor is where she rests');
  assert.equal(g.ladder().lust,5,'she never falls below what she earned');
  assert.equal(easeLust(5,5,3,0.25),5,'sitting on the floor changes nothing');
  assert.equal(easeLust(100,5,1,0.25),76.25,'100 -> 76.25 closes a quarter of the 95-point gap, one daypart');
  assert.equal(easeLust(100,0,4,0.25),31.64,'four dayparts of fading');
  assert.equal(easeLust(0,20,1,0.25),5,'cold starts warm up a quarter of the floor in one daypart');
  assert.equal(easeLust(10,20,0,0.25),10,'no elapsed daypart, no easing');
});

test('milestones raise the floor once each and no path lowers it',()=>{
  const g=run(pack());
  assert.equal(g.raise('mia','dating'),5);assert.equal(g.raise('mia','dating'),0,'entering dating pays once');
  assert.equal(g.raise('mia','exclusive'),5);assert.equal(g.raise('mia','exclusive'),0);
  assert.equal(g.raise('mia','intimateFirst'),5);assert.equal(g.raise('mia','intimateFirst'),0);
  assert.equal(g.earned(),15);
  assert.deepEqual(g.ladder().lustMilestones,['dating','exclusive','intimateFirst']);
  assert.equal(g.raise('mia','preference',{credit:'preference:coffee',preference:'coffee'}),2);
  assert.equal(g.raise('mia','preference',{credit:'preference:coffee',preference:'coffee'}),0,'the same preference pays once');
  assert.equal(g.raise('mia','preference',{credit:'preference:tea',preference:'tea'}),2,'each preference is its own milestone');
  assert.equal(g.earned(),19);
  assert.equal(g.raise('mia','dating'),0,'reconciliation back to dating does not farm the same milestone');
  assert.equal(g.earned(),19,'only gains move the floor, so a breakup or a loss can never lower it');
  const raised=g.s.events.filter(e=>e.type==='social.lustBaselineRaised');
  assert.equal(raised.length,5);
  assert.deepEqual(raised.at(-1).payload.preference,'tea');
  assert.match(raised[0].payload.text,/Mia is easier to want around you than she was/);
  assert.equal(raised[0].payload.delta,5);
});

test('committed events raise the floor: an acted preference, entering dating, becoming exclusive',()=>{
  const p=pack({datingProfiles:[{character:'mia',initialChemistry:40,agreements:['monogamous'],thresholds:{crush:10,date:20,exclusive:30},preferences:[{id:'coffee',type:'flag',flag:'mia-coffee',value:true,weight:10,visibility:'public'}],signals:[]}]});
  p.storyVariables=[{id:'mia-coffee',name:'Mia likes coffee',initial:true}];
  const g=run(p);
  g.drive('social.priceActs',{character:'mia',sceneId:'probe',source:'a',acts:[{kind:'listen',target:'work'}]});
  assert.equal(g.earned(),2,'she noticed the discovered preference and the floor rose');
  g.drive('social.priceActs',{character:'mia',sceneId:'probe',source:'b',acts:[{kind:'listen',target:'work'}]});
  assert.equal(g.earned(),2,'the same preference does not pay twice');
  g.drive('social.askDate',{character:'mia'});
  assert.equal(g.s.modules['social.dating'].characters.mia.phase,'dating');
  assert.equal(g.earned(),7,'entering dating raised the floor by five');
  g.drive('social.defineRelationship',{character:'mia',agreement:'monogamous'});
  assert.equal(g.s.modules['social.dating'].characters.mia.phase,'exclusive');
  assert.equal(g.earned(),12,'becoming exclusive raised it by five more');
  assert.deepEqual(g.ladder().lustMilestones,['preference:coffee','dating','exclusive']);
  assert.ok(g.s.events.some(e=>e.type==='social.lustBaselineRaised'&&e.payload.preference==='coffee'));
});

test('the first-night completion event raises the floor once, and only for a romance heroine',()=>{
  const g=run(pack()),night={id:'m1',type:'social.firstCompleted',payload:{first:'mia-night',character:'mia',rung:'night',verdicts:[]},tick:0,visibility:[]};
  g.react(night);
  assert.equal(g.earned(),5);
  assert.deepEqual(g.ladder().lustMilestones,['intimateFirst']);
  g.react({...night,id:'m2'});
  assert.equal(g.earned(),5,'a second completion of the same milestone pays nothing');
  g.react({...night,id:'m3',payload:{...night.payload,rung:'kiss'}});
  assert.equal(g.earned(),5,'only the night rung is the intimate first');
  g.react({...night,id:'m4',payload:{...night.payload,character:'sam'}});
  assert.equal(g.ladder('sam').lustBaseline,0,'a character with no romance profile never earns a floor');
});

test('a missing pack field preserves legacy behaviour and a friend has no floor',()=>{
  const p=pack();delete p.lustBaseline;
  const g=run(p);g.bump('mia',30);g.advance(16);
  assert.equal(g.ladder().lust,30,'nothing eases without tuning');
  assert.equal(g.earned(),0);
  assert.equal(g.raise('mia','dating'),0);
  g.drive('social.askDate',{character:'mia'});
  assert.equal(g.earned(),0,'stages still happen, the floor stays at zero');
  assert.equal(g.ladder('sam').lustBaseline,0);
  g.bump('sam',40);g.advance(8);
  assert.equal(g.ladder('sam').lust,40,'a character with no romance profile is never eased');
  assert.equal(g.ladder('mia').lust,30);
  assert.equal(lustBaselineHint(g.s,p,'mia'),'');
});

test('save, load and event replay keep the earned floor and the eased Lust',()=>{
  const p=pack(),g=run(p),initial=structuredClone(g.s);
  g.bump('mia',40);g.raise('mia','dating');g.advance(12);
  const saved=JSON.parse(JSON.stringify(g.s));
  const resumed=execute(saved,{id:'resume',actorId:'player',type:'core.wait',args:{},expectedRevision:saved.revision},p,registry).state;
  assert.equal(resumed.modules['social.touch-ladder'].characters.mia.lustBaseline,5,'a resumed world keeps the floor');
  assert.deepEqual(resumed.modules['social.touch-ladder'].characters.mia.lustMilestones,['dating']);
  assert.deepEqual(resumed.modules['social.touch-ladder'],g.s.modules['social.touch-ladder'],'and it agrees with the world that was never reloaded');
  assert.deepEqual(run(p).ladder('mia'),{lust:0,lustBaseline:0,lustMilestones:[]},'a fresh world starts clean');
  const replayed=replay(initial,g.s.events.slice(initial.events.length));
  assert.deepEqual(replayed.modules['social.touch-ladder'].characters.mia.lust,g.s.modules['social.touch-ladder'].characters.mia.lust,'replay reproduces the eased value');
});

test('scene and mood expose only a vague hint, and the prompt gets the floor without a new model call',()=>{
  const p=pack(),g=run(p);
  assert.equal(lustBaselineHint(g.s,p,'mia'),'','no earned floor, no hint');
  g.raise('mia','intimateFirst');
  const hint=lustBaselineHint(g.s,p,'mia');
  assert.ok(hint,'a vague hint once she has earned something');
  assert.doesNotMatch(hint,/\d|baseline|milestone|first night|dating|exclusive|preference/i,'no numbers, no mechanic names');
  assert.ok(sceneFeedback(g.s,p).moods[0].label.includes(hint),'the mood line carries the same hint');
  assert.deepEqual(touchLadderContext(g.s,p,'player'),[{character:'mia',baseline:5,lust:0,trust:0},{character:'sam',lust:0,trust:0}]);
  assert.equal(sceneFeedback(g.s,p).moods[0].label.includes('Lust'),false,'the hint never states the stat');
});

test('invalid tuning is rejected',()=>{
  for(const change of [p=>p.lustBaseline=4,p=>p.lustBaseline.perDaypart=0,p=>p.lustBaseline.perDaypart=1.5,p=>p.lustBaseline.perDaypart='quarter',p=>p.lustBaseline.milestones.dating=-1,p=>p.lustBaseline.milestones.dating=2.5,p=>p.lustBaseline.milestones.dating='5',p=>p.lustBaseline.hint='']){
    const p=pack();change(p);assert.throws(()=>validatePack(p,registry));}
  const p=pack();p.lustBaseline.perDaypart=1;p.lustBaseline.milestones.preference=0;p.lustBaseline.hint='warmer than she was';
  assert.doesNotThrow(()=>validatePack(p,registry));
});