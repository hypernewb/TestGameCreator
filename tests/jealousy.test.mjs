import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld, execute, validatePack, mechanicsDigest, replay} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {jealousy, jealousyHint, jealousyContext, JEALOUSY} from '../packages/modules/jealousy.mjs';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';

const probe={
  id:'test.probe',version:'0.1.0',coreApi:'0.1.0',requires:[],
  commands:{
    'test.flirt'(tx,args){tx.emit('social.romanticInteraction',{target:args.target||'brin',witnesses:args.witnesses||[],text:'A romantic moment.'});},
    'test.intimacy'(tx,args){tx.emit('social.intimacyExposed',{character:args.target||'brin',category:'kiss',witnesses:args.witnesses||[],text:'An intimate moment.'});},
    'test.rumor'(tx,args){tx.emit('social.rumorBelieved',{subject:'player',character:args.character,summary:args.summary||'you were seen with someone'});},
    'test.disclose'(tx,args){tx.emit('social.encounterDisclosed',{encounter:'e1',partner:args.partner||'brin',character:args.character||'ada',agreement:'monogamous',delta:-20,text:`You tell Ada about your encounter with Brin.`});}
  }
};
const custom={...registry,[probe.id]:probe};
const campus=()=>JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url),'utf8'));
const trio=()=>JSON.parse(readFileSync(new URL('../packs/campus-trio.json',import.meta.url),'utf8'));

const basePack=()=>{
  const p={
    schemaVersion:1,id:'test.jealousy',version:'0.1.0',title:'Jealousy test',playerId:'player',
    modules:{'social.conversation':'0.1.0','social.relationships':'0.1.0','social.dating':'0.1.0','social.romance-tempo':'0.2.0','social.jealousy':'0.1.0','items.inventory':'0.2.0','test.probe':'0.1.0'},
    daypart:{interval:4,labels:['Morning','Afternoon','Evening']},
    locations:[{id:'cafe',name:'Cafe',exits:[]}],
    actors:[
      {id:'player',name:'You',location:'cafe'},
      {id:'ada',name:'Ada',location:'cafe'},
      {id:'brin',name:'Brin',location:'cafe'}
    ],
    items:[{id:'rose',name:'Rose',owner:'cafe',shop:true,price:5,stock:10}],
    initialRelationships:[{character:'ada',trust:30}],
    datingProfiles:[{character:'ada',initialChemistry:40,initialPhase:'dating',initialAgreement:'monogamous',agreements:['monogamous'],thresholds:{crush:10,date:20,exclusive:30},preferences:[],signals:[]}],
    romanceTempoProfiles:[{character:'ada',advancement:'automatic',ranks:[{id:'close',name:'Close',points:0,ceiling:100}],initialPoints:50,jealousy:{preset:'secure'}}],
    jealousyProfiles:[{character:'ada'}]
  };
  return p;
};

const clampMeter=v=>Math.max(0,Math.min(JEALOUSY.max,v));
const run=(p,seed=7)=>{
  validatePack(p,custom);
  let s=createWorld(p,custom,'jealousy',seed);
  const act=(type,args={})=>{const r=execute(s,{id:`t${s.revision}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,custom);s=r.state;return r;};
  return {act,load(v){s=structuredClone(v);},get s(){return s;},get ada(){return s.modules['social.jealousy'].characters.ada;},get trust(){return s.modules['social.relationships'].edges['ada--player'];},day(){for(let i=0;i<12;i++)act('core.wait');}};
};

test('witnessed flirt raises the meter by the world amount scaled by stage',()=>{
  const c=run(basePack());
  c.act('test.flirt',{target:'brin',witnesses:['ada']});
  assert.equal(c.ada.meter,JEALOUSY.flirtAmount,'dating stage is x1');
  const events=c.s.events.filter(e=>e.type==='social.jealousyMeterChanged');
  assert.equal(events.length,1);
  assert.equal(events[0].payload.rival,'brin');
  assert.equal(events[0].payload.meter,JEALOUSY.flirtAmount);
});

test('witnessed intimacy outweighs a witnessed flirt',()=>{
  const c=run(basePack());
  c.act('test.intimacy',{target:'brin',witnesses:['ada']});
  assert.equal(c.ada.meter,JEALOUSY.intimacyAmount);
});

test('she must be present: an unwitnessed moment changes nothing',()=>{
  const c=run(basePack());
  c.act('test.flirt',{target:'brin',witnesses:[]});
  c.act('test.intimacy',{target:'brin',witnesses:['brin']});
  assert.equal(c.ada.meter,0);
  assert.equal(c.s.events.some(e=>e.type==='social.jealousyMeterChanged'),false);
});

test('her own moment and an affair between other characters are ignored',()=>{
  const c=run(basePack());
  c.act('test.flirt',{target:'ada',witnesses:['ada']});
  assert.equal(c.ada.meter,0,'the rival is never the jealous character herself');
  c.act('test.flirt',{target:'player',witnesses:['ada']});
  assert.equal(c.ada.meter,0,'the rival is never the player');
});

test('a crush is still the acquaintance stage, so only Like decides',()=>{
  const p=basePack();
  p.datingProfiles[0].initialPhase='crush';
  p.romanceTempoProfiles[0].initialPoints=20;
  const c=run(p);
  c.act('test.flirt',{target:'brin',witnesses:['ada']});
  assert.equal(c.ada.meter,0,'a crush below the Like floor stays calm');
  p.romanceTempoProfiles[0].initialPoints=80;
  const d=run(p);
  d.act('test.flirt',{target:'brin',witnesses:['ada']});
  assert.equal(d.ada.meter,Math.trunc(JEALOUSY.flirtAmount*JEALOUSY.acquaintanceScale),'a crush at Like 80 reacts at half weight');
});

test('an uncommitted agreement never triggers jealousy',()=>{
  const p=basePack();
  p.datingProfiles[0].initialAgreement='uncommitted';
  const c=run(p);
  c.act('test.flirt',{target:'brin',witnesses:['ada']});
  assert.equal(c.ada.meter,0);
});

test('acquaintance needs Like 50 and lands at half weight',()=>{
  const low=basePack();
  low.datingProfiles[0].initialPhase='available';
  low.romanceTempoProfiles[0].initialPoints=49;
  const a=run(low);
  a.act('test.flirt',{target:'brin',witnesses:['ada']});
  assert.equal(a.ada.meter,0,'Like 49 is not yet enough to be jealous');

  const high=basePack();
  high.datingProfiles[0].initialPhase='available';
  high.romanceTempoProfiles[0].initialPoints=50;
  const b=run(high);
  b.act('test.flirt',{target:'brin',witnesses:['ada']});
  assert.equal(b.ada.meter,Math.trunc(JEALOUSY.flirtAmount*JEALOUSY.acquaintanceScale),'Like 50 at half weight');
});

test('exclusive doubles the meter',()=>{
  const p=basePack();
  p.datingProfiles[0].initialPhase='exclusive';
  const c=run(p);
  c.act('test.flirt',{target:'brin',witnesses:['ada']});
  assert.equal(c.ada.meter,JEALOUSY.flirtAmount*2);
});

test('the meter is capped at the configured maximum',()=>{
  const p=basePack();
  p.datingProfiles[0].initialPhase='exclusive';
  const c=run(p);
  for(let i=0;i<10;i++)c.act('test.flirt',{target:'brin',witnesses:['ada']});
  assert.equal(c.ada.meter,JEALOUSY.max);
});

test('the meter decays one point per in-game day',()=>{
  const c=run(basePack());
  c.act('test.flirt',{target:'brin',witnesses:['ada']});
  c.act('test.flirt',{target:'brin',witnesses:['ada']});
  assert.equal(c.ada.meter,JEALOUSY.flirtAmount*2);
  c.day();
  assert.equal(c.ada.meter,JEALOUSY.flirtAmount*2-JEALOUSY.decayPerDay);
  c.day();
  assert.equal(c.ada.meter,JEALOUSY.flirtAmount*2-JEALOUSY.decayPerDay*2);
});

test('crossing the confrontation line costs Trust once and emits the hook',()=>{
  const p=basePack();
  p.datingProfiles[0].initialPhase='exclusive';
  const c=run(p);
  c.act('test.flirt',{target:'brin',witnesses:['ada']});
  assert.equal(c.trust,30,'no cost below the line');
  c.act('test.flirt',{target:'brin',witnesses:['ada']});
  assert.equal(c.trust,30+JEALOUSY.trustDelta);
  const hook=c.s.events.find(e=>e.type==='social.jealousyConfrontation');
  assert.ok(hook,'confrontation hook is available to authored scenes');
  assert.equal(hook.payload.character,'ada');
  assert.equal(hook.payload.rival,'brin');
  c.act('test.flirt',{target:'brin',witnesses:['ada']});
  assert.equal(c.trust,30+JEALOUSY.trustDelta,'the hit does not repeat while she stays above the line');
});

test('Trust can bite again only after the meter falls back under the line',()=>{
  const p=basePack();
  p.datingProfiles[0].initialPhase='exclusive';
  const c=run(p);
  c.act('test.flirt',{target:'brin',witnesses:['ada']});
  c.act('test.flirt',{target:'brin',witnesses:['ada']});
  assert.equal(c.trust,30+JEALOUSY.trustDelta);
  for(let day=0;day<3;day++)c.day();
  assert.ok(c.ada.meter<JEALOUSY.confrontAt);
  c.act('test.flirt',{target:'brin',witnesses:['ada']});
  c.act('test.flirt',{target:'brin',witnesses:['ada']});
  assert.equal(c.trust,30+JEALOUSY.trustDelta*2,'a fresh crossing costs Trust again');
});

test('jealousy never breaks up the relationship',()=>{
  const p=basePack();
  p.datingProfiles[0].initialPhase='exclusive';
  const c=run(p);
  for(let i=0;i<8;i++)c.act('test.flirt',{target:'brin',witnesses:['ada']});
  assert.equal(c.s.modules['social.dating'].characters.ada.phase,'exclusive','the meter alone never ends anything');
  assert.equal(c.s.events.some(e=>e.type==='social.relationshipBroken'),false);
});

test('a rumor she believes counts less than seeing it',()=>{
  const c=run(basePack());
  c.act('test.rumor',{character:'ada'});
  assert.equal(c.ada.meter,JEALOUSY.rumorAmount);
  const other=run(basePack());
  other.act('test.rumor',{character:'brin'});
  assert.equal(other.ada.meter,0,'a rumor about someone else is not her business');
});

test('a told encounter names the rival and lands like a witnessed one',()=>{
  const c=run(basePack());
  c.act('test.disclose',{character:'ada',partner:'brin'});
  assert.equal(c.ada.meter,JEALOUSY.intimacyAmount);
  const other=run(basePack());
  other.act('test.disclose',{character:'brin',partner:'ada'});
  assert.equal(other.ada.meter,0);
});

test('trait multipliers change the weight, never the trigger',()=>{
  for(const [trait,key] of [['insecure','insecureMultiplier'],['guarded','guardedMultiplier'],['competitive','competitiveMultiplier']]){
    const p=basePack();
    p.actors.find(a=>a.id==='ada').traits=[trait];
    p.jealousyProfiles[0][key]=2;
    const c=run(p);
    c.act('test.flirt',{target:'brin',witnesses:['ada']});
    assert.equal(c.ada.meter,JEALOUSY.flirtAmount*2,`${trait} lands harder`);

    const absent=basePack();
    absent.actors.find(a=>a.id==='ada').traits=['warm'];
    absent.jealousyProfiles[0][key]=2;
    const d=run(absent);
    d.act('test.flirt',{target:'brin',witnesses:['ada']});
    assert.equal(d.ada.meter,JEALOUSY.flirtAmount,`${key} does nothing without the trait`);
  }
});

test('the trait sets the flavour, and only the tone reaches the prompt',()=>{
  const tone=(trait,meter)=>{
    const p=basePack();
    p.actors.find(a=>a.id==='ada').traits=[trait];
    p.datingProfiles[0].initialPhase='exclusive';
    const c=run(p);
    const turns=Math.ceil(meter/(JEALOUSY.flirtAmount*2));
    for(let i=0;i<turns;i++)c.act('test.flirt',{target:'brin',witnesses:['ada']});
    return jealousyHint(c.s,p,'ada');
  };
  assert.match(tone('insecure',8),/louder/);
  assert.match(tone('guarded',8),/colder/);
  assert.match(tone('competitive',8),/challeng|measuring/);
  assert.match(tone('warm',4),/cooler/);
  assert.equal(jealousyHint(run(basePack()).s,basePack(),'ada'),'','a cold meter gives the model nothing');

  const p=basePack();
  p.datingProfiles[0].initialPhase='exclusive';
  p.actors.find(a=>a.id==='ada').traits=['insecure'];
  const c=run(p);
  c.act('test.flirt',{target:'brin',witnesses:['ada']});
  c.act('test.flirt',{target:'brin',witnesses:['ada']});
  const hint=jealousyHint(c.s,p,'ada');
  const text=scenePromptMessages({stagedCast:['ada'],jealousyHints:[`Ada: ${hint}`],playerAction:'Hello'},p).map(m=>m.content).join(' ');
  assert.ok(text.includes(hint),'the hint reaches the scene prompt');
  assert.ok(!text.includes('jealousyProfiles')&&!text.includes('jealousySettings'),'pack tuning never reaches the model');
  assert.ok(!new RegExp(`\\b${c.ada.meter}\\b`).test(text.replace(hint,'')),'the meter value is never sent as a number');
});

test('the meter stays out of a calm prompt entirely',()=>{
  const p=basePack();
  const text=scenePromptMessages({stagedCast:['ada'],playerAction:'Hello'},p).map(m=>m.content).join(' ');
  assert.ok(!/jealous/i.test(text));
});

test('the context gives the player a tone word and keeps the meter private to her',()=>{
  const p=basePack();
  p.datingProfiles[0].initialPhase='exclusive';
  const c=run(p);
  c.act('test.flirt',{target:'brin',witnesses:['ada']});
  c.act('test.flirt',{target:'brin',witnesses:['ada']});
  const player=jealousyContext(c.s,p,'player')[0],her=jealousyContext(c.s,p,'ada')[0],other=jealousyContext(c.s,p,'brin');
  assert.equal(player.meter,undefined,'the player never sees the meter');
  assert.equal(her.meter,JEALOUSY.flirtAmount*4,'two exclusive flirts remain engine-held');
  assert.deepEqual(other,[],'an unrelated character never sees it');
  assert.equal(her.stage,'exclusive');
  assert.equal(player.tension,'confronting');
});

test('the panel reports only characters who are actually jealous',()=>{
  const p=basePack();
  assert.deepEqual(jealousy.panel(run(p).s,p).lines,[],'nothing to report while cold');
  p.datingProfiles[0].initialPhase='exclusive';
  const c=run(p);
  c.act('test.flirt',{target:'brin',witnesses:['ada']});
  c.act('test.flirt',{target:'brin',witnesses:['ada']});
  const lines=jealousy.panel(c.s,p).lines;
  assert.equal(lines.length,1);
  assert.equal(lines[0],'Ada: confronting');
  assert.doesNotMatch(lines[0],/\d/);
});

test('a missing pack field preserves legacy behaviour',()=>{
  const p=basePack();
  delete p.jealousyProfiles;
  delete p.jealousySettings;
  const c=run(p);
  c.act('test.flirt',{target:'brin',witnesses:['ada']});
  assert.deepEqual(c.s.modules['social.jealousy'].characters,{});
  assert.equal(c.s.events.some(e=>e.type==='social.jealousyMeterChanged'),false);
  assert.equal(jealousyHint(c.s,p,'ada'),'');
  const off=basePack();
  delete off.modules['social.jealousy'];
  const d=run(off);
  d.act('test.flirt',{target:'brin',witnesses:['ada']});
  assert.equal(jealousyHint(d.s,off,'ada'),'');
});

test('invalid tuning and profiles are rejected',()=>{
  const bad=[
    p=>p.jealousySettings={max:0},
    p=>p.jealousySettings={coolAt:9,confrontAt:3},
    p=>p.jealousySettings={trustDelta:5},
    p=>p.jealousySettings={flirtAmount:2.5},
    p=>p.jealousySettings={acquaintanceScale:-1},
    p=>p.jealousySettings={decayPerDay:99},
    p=>p.jealousyProfiles=[{character:'unknown'}],
    p=>p.jealousyProfiles=[{character:'brin'}],
    p=>p.jealousyProfiles=[{character:'ada'},{character:'ada'}],
    p=>p.jealousyProfiles=[{character:'ada',insecureMultiplier:4}],
    p=>p.jealousyProfiles=[{character:'ada',guardedMultiplier:0}],
    p=>p.jealousyProfiles=[{character:'ada',competitiveMultiplier:'loud'}]
  ];
  for(const change of bad){
    const p=basePack();
    change(p);
    assert.throws(()=>validatePack(p,custom),/jealousy/i,`rejected: ${change}`);
  }
  const p=basePack();
  p.jealousySettings={coolAt:4,confrontAt:7,max:12};
  assert.doesNotThrow(()=>validatePack(p,custom));
});

test('tuning the pack changes the mechanics digest',()=>{
  const p=basePack(),q=basePack();
  q.jealousySettings={confrontAt:8};
  assert.notEqual(mechanicsDigest(p),mechanicsDigest(q));
});

test('a save, reload and replay reproduce the meter exactly',()=>{
  const p=basePack();
  p.datingProfiles[0].initialPhase='exclusive';
  const c=run(p),initial=structuredClone(c.s);
  c.act('test.flirt',{target:'brin',witnesses:['ada']});
  c.act('test.flirt',{target:'brin',witnesses:['ada']});
  c.day();
  const saved=JSON.parse(JSON.stringify(c.s));
  assert.deepEqual(JSON.parse(JSON.stringify(c.s)).modules['social.jealousy'],c.s.modules['social.jealousy'],'a save round trip is lossless');
  assert.deepEqual(saved.modules['social.jealousy'],c.s.modules['social.jealousy']);
  const restored=replay(initial,c.s.events);
  assert.deepEqual(restored.modules['social.jealousy'],c.s.modules['social.jealousy'],'replay rebuilds the meter from patches alone');
  assert.deepEqual(restored.modules['social.relationships'],c.s.modules['social.relationships'],'the Trust hit replays too');
  assert.equal(restored.tick,c.s.tick);
  const h=run(p);
  h.load(saved);
  const before=clampMeter(c.ada.meter+JEALOUSY.flirtAmount*2);
  h.act('test.flirt',{target:'brin',witnesses:['ada']});
  assert.equal(h.ada.meter,before,`a reloaded campaign continues from the saved meter (${c.ada.meter} + one exclusive flirt)`);
});

test('the campus and trio packs ship a valid jealousy setup',()=>{
  for(const p of [campus(),trio()]){
    validatePack(p,registry);
    const settings=p.jealousySettings;
    assert.equal(settings.max,10);
    assert.equal(settings.coolAt,3);
    assert.equal(settings.confrontAt,6);
    assert.equal(settings.trustDelta,-2);
    assert.equal(settings.decayPerDay,1);
    assert.equal(settings.acquaintanceScale,0.5);
    assert.equal(settings.likeFloor,50);
    assert.deepEqual(p.jealousyProfiles.map(x=>x.character),p.datingProfiles.map(x=>x.character),'every heroine carries a meter');
    for(const profile of p.jealousyProfiles){
      const traits=p.actors.find(a=>a.id===profile.character)?.traits||[];
      for(const trait of ['insecure','guarded','competitive']){
        if(profile[`${trait}Multiplier`]!==undefined)assert.ok(traits.includes(trait),`${profile.character} is not ${trait}`);
      }
    }
  }
  const s=createWorld(campus(),registry,'campus-jealousy');
  const hint=jealousyHint(s,campus(),'monique');
  assert.equal(hint,'','a fresh campaign is cold');
});
