import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {JEALOUSY_PRESETS} from '../packages/modules/romance-tempo.mjs';

const probe={id:'test.probe',version:'0.1.0',coreApi:'0.1.0',requires:[],commands:{'test.compliment'(tx){tx.emit('social.compliment',{character:'ada',text:'You compliment Ada.'});},'test.gift'(tx){tx.emit('items.transferred',{from:'player',to:'ada',item:'rose',text:'You give Ada a rose.'});},'test.flirt'(tx,args){tx.emit('social.romanticInteraction',{target:args.target||'brin',witnesses:args.witnesses||[],text:'A romantic moment.'});}}};
const custom={...registry,[probe.id]:probe};
const pack=(tempo={},dating={})=>{const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));p.modules['social.dating']='0.1.0';p.modules['social.romance-tempo']='0.2.0';p.modules['test.probe']='0.1.0';delete p.modules['world.schedule'];
 p.datingProfiles=[{character:'ada',initialChemistry:40,initialPhase:'dating',initialAgreement:'monogamous',agreements:['monogamous','open'],thresholds:{crush:10,date:20,exclusive:30},preferences:[],signals:[],...dating}];
 p.romanceTempoProfiles=[{character:'ada',advancement:'automatic',ranks:[{id:'close',name:'Close',points:0,ceiling:100}],initialPoints:50,...tempo}];return p;};
const run=p=>{validatePack(p,custom);let s=createWorld(p,custom,'tempo');const act=(type,args={})=>{const r=execute(s,{id:`t${s.revision}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,custom);s=r.state;return r;};return {act,get s(){return s;},get ada(){return s.modules['social.romance-tempo'].characters.ada;}};};

test('spamming one repeatable action gives diminishing, bounded returns',()=>{
 const c=run(pack({initialPoints:0,signals:[{id:'compliment',event:'social.compliment',points:8,repeatable:true}]}));
 const gains=[];for(let i=0;i<10;i++){const before=c.ada.points;c.act('test.compliment');gains.push(c.ada.points-before);}
 assert.deepEqual(gains.slice(0,4),[8,4,2,1]);assert.ok(c.ada.points<16,'ten repeats are worth less than two fresh compliments');
 for(let i=0;i<8;i++)c.act('core.wait');const before=c.ada.points;c.act('test.compliment');assert.equal(c.ada.points-before,8,'the window resets after time passes');
});

test('signal cooldowns block repeats until enough time passes',()=>{
 const c=run(pack({initialPoints:0,signals:[{id:'compliment',event:'social.compliment',points:5,repeatable:true,cooldownTicks:3,repeatDecayPercent:100}]}));
 c.act('test.compliment');c.act('test.compliment');assert.equal(c.ada.points,5);
 for(let i=0;i<3;i++)c.act('core.wait');c.act('test.compliment');assert.equal(c.ada.points,10);
});

test('jealousy presets only fire for witnessed rival moments inside a committed agreement',()=>{
 const c=run(pack({jealousy:{preset:'guarded'}}));const g=JEALOUSY_PRESETS.guarded;
 c.act('test.flirt',{witnesses:['brin']});assert.equal(c.ada.points,50,'unseen flirting stays unseen');
 const r=c.act('test.flirt',{witnesses:['ada','brin']});const e=r.turn.events.find(x=>x.type==='social.jealousyTriggered');
 assert.ok(e);assert.deepEqual(e.visibility,['player','ada']);assert.equal(e.payload.rival,'brin');assert.equal(e.payload.preset,'guarded');assert.match(e.payload.text,/Ada saw you with Brin/);
 assert.equal(c.ada.points,50+g.points);assert.equal(c.s.modules['social.dating'].characters.ada.satisfaction,50+g.satisfaction);
 c.act('test.flirt',{witnesses:['ada']});assert.equal(c.ada.points,50+g.points,'cooldown holds');
 for(let i=0;i<g.cooldownTicks;i++)c.act('core.wait');c.act('test.flirt',{witnesses:['ada']});assert.equal(c.ada.points,50+2*g.points);
 c.act('test.flirt',{target:'ada',witnesses:['ada']});assert.equal(c.s.events.filter(x=>x.type==='social.jealousyTriggered').length,2,'flirting with her is not a rival moment');
});

test('agreements and phase gate jealousy; authored overrides replace preset values',()=>{
 const open=run(pack({jealousy:{preset:'secure'}},{initialAgreement:'open'}));open.act('test.flirt',{witnesses:['ada']});assert.equal(open.ada.points,50,'secure partners in open relationships are not jealous');
 const loose=run(pack({jealousy:{preset:'possessive'}},{initialPhase:'crush',initialAgreement:'uncommitted'}));loose.act('test.flirt',{witnesses:['ada']});assert.equal(loose.ada.points,50,'no jealousy before dating');
 const custom=run(pack({jealousy:{preset:'relaxed',points:-3,text:'{name} glances at {rival}.'}}));const r=custom.act('test.flirt',{witnesses:['ada']});assert.equal(custom.ada.points,47);assert.equal(r.turn.events.find(x=>x.type==='social.jealousyTriggered').payload.text,'Ada glances at Brin.');
});

test('tempo signal and jealousy settings are validated',()=>{
 const bad=[{jealousy:{preset:'furious'}},{jealousy:{points:5}},{jealousy:{agreements:['married']}},{jealousy:{events:[]}},{signals:[{id:'x',event:'social.compliment',points:1,repeatable:true,repeatDecayPercent:150}]},{signals:[{id:'x',event:'social.compliment',points:1,windowTicks:0}]}];
 for(const extra of bad)assert.throws(()=>validatePack(pack(extra),custom),/romance/);
 assert.doesNotThrow(()=>validatePack(pack({jealousy:{preset:'possessive',cooldownTicks:6}}),custom));
});

test('neglect bomb: silence warns, attention defuses, a spent fuse vents to the room',()=>{
 const neglect={afterTicks:4,fuseTicks:3,minPoints:20},sig=[{id:'compliment',event:'social.compliment',points:4,repeatable:true}];
 const c=run(pack({neglect,signals:sig}));const ev=t=>c.s.events.filter(x=>x.type===t);
 for(let i=0;i<4;i++)c.act('core.wait');const [w]=ev('social.neglectWarning');assert.ok(w);assert.deepEqual(w.visibility,['player','ada']);assert.match(w.payload.text,/Ada hasn't heard/);assert.equal(c.ada.neglect,'warned');
 const r=c.act('test.compliment');assert.ok(r.turn.events.some(x=>x.type==='social.neglectDefused'));assert.equal(c.ada.neglect,null);
 for(let i=0;i<6;i++)c.act('core.wait');assert.equal(ev('social.neglectWarning').length,2);assert.equal(ev('social.neglectDetonated').length,0);
 const before=c.ada.points;c.act('core.wait');const [d]=ev('social.neglectDetonated');assert.ok(d);
 assert.ok(d.payload.witnesses.includes('ada')&&d.visibility.includes('player'));assert.equal(c.ada.points,before-6);assert.equal(c.ada.neglect,null);
 assert.equal(c.s.modules['social.dating'].characters.ada.satisfaction,45);
 const cold=run(pack({neglect,initialPoints:10}));for(let i=0;i<20;i++)cold.act('core.wait');assert.equal(cold.s.events.filter(x=>x.type.startsWith('social.neglect')).length,0,'nobody bombs you if they do not care');
 for(const bad of [{neglect:{afterTicks:0}},{neglect:{points:3}},{neglect:[]}])assert.throws(()=>validatePack(pack(bad),custom),/romance neglect/);
});

test('birthdays: announced, first gift multiplied past the weekly cap, forgetting costs only with people who care',()=>{
 const gifts={defaultPoints:4,limitPerPeriod:1,periodTicks:100},ev=(c,t)=>c.s.events.filter(x=>x.type===t);
 const c=run(pack({initialPoints:30,gifts,birthday:{day:2}}));c.act('test.gift');assert.equal(c.ada.points,34);
 for(let i=0;i<12;i++)c.act('core.wait');const [b]=ev(c,'social.birthday');assert.equal(b.payload.day,2);assert.deepEqual(b.visibility,['player','ada']);assert.equal(b.payload.text,"Today is Ada's birthday.");
 const r=c.act('test.gift');assert.equal(r.turn.events.find(x=>x.type==='social.giftReceived').payload.birthday,true);assert.equal(c.ada.points,40,'x3 (of the repeat-decayed 2) despite the spent weekly cap');
 c.act('test.gift');assert.equal(c.ada.points,40,'only the first birthday gift is special');
 for(let i=0;i<12;i++)c.act('core.wait');assert.equal(ev(c,'social.birthdayForgotten').length,0);
 const f=run(pack({initialPoints:30,birthday:{day:2}}));for(let i=0;i<24;i++)f.act('core.wait');const [x]=ev(f,'social.birthdayForgotten');assert.equal(x.payload.day,2);assert.equal(f.ada.points,27);
 const cold=run(pack({initialPoints:5,birthday:{day:2}}));for(let i=0;i<24;i++)cold.act('core.wait');assert.equal(ev(cold,'social.birthdayForgotten').length,0);
 const y=run(pack({initialPoints:30,birthday:{day:1,cycleDays:2,forgottenPoints:0}}));for(let i=0;i<48;i++)y.act('core.wait');assert.deepEqual(ev(y,'social.birthday').map(e=>e.payload.day),[3,5]);assert.deepEqual(ev(y,'social.birthdayForgotten').map(e=>e.payload.day),[3],'day 1 was never announced');
 for(const bad of [{birthday:{}},{birthday:{day:2,date:'03-14'}},{birthday:{date:'13-01'}},{birthday:{date:'03-14',cycleDays:7}},{birthday:{day:2,giftMultiplier:0}}])assert.throws(()=>validatePack(pack(bad),custom),/romance birthday/);
 assert.doesNotThrow(()=>validatePack(pack({birthday:{date:'03-14'}}),custom));
});
