import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {readFileSync} from 'node:fs';
import {assemble,specFromPack} from '../packages/cards/world-assembly.mjs';
import {batches,draftMessages,acceptDraft,draftWorld,setPath,hintFor,structureOnly} from '../packages/cards/world-draft.mjs';

// M2 draft pass: a structure-only spec + a model that returns JSON by path = a finished world. The model never touches ids or numbers.
const tiny=()=>({id:'tiny',days:3,player:{name:'You',age:22},heroines:[{id:'ava',temperament:'practical',pace:'casual',actor:{name:'Ava',age:24,location:'home'},topic:'climbing',gifts:{loved:'chalk'}},{id:'bea',temperament:'guarded',pace:'slow',actor:{name:'Bea',age:27,location:'home'},topic:'jazz'}],
 world:{locations:[{id:'home',name:'Home',description:'',exits:[]}],items:[{id:'chalk',name:'Chalk',owner:'home',shop:true,price:3,stock:5}]}});
const asked=m=>[...m.at(-1).content.matchAll(/^"([^"]+)":/gm)].map(x=>x[1]);
const echo=async m=>JSON.stringify(Object.fromEntries(asked(m).map(p=>[p,`text for ${p}`])));

test('batches put the world first, then each heroine profile and rung on its own',()=>{
 const {missing}=assemble(tiny()),b=batches(missing);assert.equal(b[0].id,'world');
 assert.deepEqual(b.map(x=>x.id).filter(x=>x.startsWith('ava')),['ava:profile','ava:talk','ava:date','ava:kiss','ava:night']);
 assert.equal(b.flatMap(x=>x.paths).length,missing.length);assert.ok(b.every(x=>x.paths.length<=40));
});

test('the prompt names every path with a hint and the choice tone, and keeps other heroines out',()=>{
 const s=tiny(),b=batches(assemble(s).missing).find(x=>x.id==='ava:talk'),m=draftMessages(s,b);
 assert.match(m[0].content,/adult/);assert.match(m[0].content,/she can always stop/);assert.deepEqual(asked(m),b.paths);
 assert.match(m[1].content,/choices\.0\.label": .*lands perfectly/);assert.match(m[1].content,/choices\.2\.label": .*misses/);
 assert.match(m[1].content,/Ava/);assert.doesNotMatch(m[1].content,/Bea/);
 assert.match(hintFor('heroines.ava.reasons.topic'),/"topic"/);for(const p of assemble(s).missing)assert.notEqual(hintFor(p),'short text',p);
});

test('a draft reply fills only asked-for paths with strings; junk, extra keys and placeholders are dropped',()=>{
 const s=tiny(),b=batches(assemble(s).missing).find(x=>x.id==='ava:talk');
 const raw='Sure! '+JSON.stringify({[b.paths[0]]:'Hi there',[b.paths[1]]:42,[b.paths[2]]:'[[nope]]','heroines.ava.actor.age':'12','heroines.ava.temperament':'sultry'});
 const {spec,filled}=acceptDraft(s,b,raw);assert.deepEqual(filled,[b.paths[0]]);assert.equal(spec.heroines[0].actor.age,24);assert.equal(spec.heroines[0].temperament,'practical');
 assert.deepEqual(acceptDraft(s,b,'not json at all').filled,[]);assert.equal(s.heroines[0].rungs,undefined,'the input spec is not mutated');
});

test('setPath addresses heroines by id, keeps default tones on new choices and writes into {reason, memory}',()=>{
 const s=tiny();setPath(s,'heroines.bea.rungs.date.choices.1.label','Hum along');assert.deepEqual(s.heroines[1].rungs.date.choices.map(c=>c.tone),['best','light','miss']);
 s.heroines[0].reasons={listen:{reason:'old',memory:true}};setPath(s,'heroines.ava.reasons.listen','you actually listened');assert.deepEqual(s.heroines[0].reasons.listen,{reason:'you actually listened',memory:true});
 assert.throws(()=>setPath(s,'heroines.zed.title','x'),/unknown heroine/);
});

test('draftWorld with a cooperative model finishes the world: no blanks, valid, playable, same structure',async()=>{
 const before=assemble(tiny()).pack,seen=[];const {pack,missing,calls}=await draftWorld(tiny(),{complete:echo,onBatch:x=>seen.push(x)});
 assert.deepEqual(missing,[]);assert.equal(calls,seen.length);assert.ok(seen.every(x=>x.filled===x.asked));validatePack(pack,registry);assert.ok(createWorld(pack,registry,'d').actors.bea);
 assert.doesNotMatch(JSON.stringify(pack),/\[\[/);
 const shape=p=>JSON.stringify(p,(k,v)=>typeof v==='string'&&!/^(id|type|event|character|tone|category|trait|kind|target|preference|flag)$/.test(k)&&!/^[a-z0-9@:_-]+$/.test(v)?'':v);
 assert.equal(shape(pack.romanceTempoProfiles.map(x=>x.ranks.map(r=>r.min))),shape(before.romanceTempoProfiles.map(x=>x.ranks.map(r=>r.min))));
 assert.deepEqual(pack.scriptedScenes.map(x=>x.trigger.event),before.scriptedScenes.map(x=>x.trigger.event));
 assert.deepEqual(pack.scriptedScenes.map(x=>x.choices.map(c=>c.effects.map(e=>e.type))),before.scriptedScenes.map(x=>x.choices.map(c=>c.effects.map(e=>e.type))),'text never changes effects');
});

test('a model that skips slots gets a second pass for only what is left, then the leftovers stay visible',async()=>{
 let n=0;const lazy=async m=>{n++;const ps=asked(m);return JSON.stringify(Object.fromEntries(ps.filter((_,i)=>n>batches(assemble(tiny()).missing).length||i%2===0).map(p=>[p,'ok'])));};
 const r=await draftWorld(tiny(),{complete:lazy,rounds:2});assert.deepEqual(r.missing,[]);
 const dead=await draftWorld(tiny(),{complete:async()=>'{}',rounds:2});assert.ok(dead.missing.length>50);validatePack(dead.pack,registry);
});

test('structureOnly strips campus to picks: every prose slot is blank but ids, gates, checkpoints and numbers are unchanged',async()=>{
 const c=JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url))),cast={jana:{temperament:'torn',pace:'steady'},monique:{temperament:'guarded',pace:'slow'},nova:{temperament:'prickly',pace:'casual'},abigail:{temperament:'practical',pace:'easy'}};
 const full=assemble(specFromPack(c,{cast})).pack,s=structureOnly(specFromPack(c,{cast})),{pack,missing}=assemble(s);validatePack(pack,registry);
 assert.ok(missing.length>150,missing.length);assert.ok(missing.includes('heroines.jana.rungs.night.checkpoints.peak'));assert.ok(!missing.includes('project.premise'),'the owner premise is kept');
 const mask=p=>JSON.stringify(p,(k,v)=>typeof v==='string'&&(v.startsWith('[[')||/[ A-Z]/.test(v))?'':v);
 for(const k of ['firsts','scriptedScenes','romanceTempoProfiles','arcTracks','endings','intimacyProfiles','items','locations'])assert.equal(mask(pack[k]),mask(full[k]),k);
 const {pack:drafted,missing:left}=await draftWorld(s,{complete:echo});assert.deepEqual(left,[]);assert.equal(mask(drafted.firsts),mask(full.firsts));
});
test('O1: a free rung keeps its mode through structureOnly, its cues come back as blanks, and the drafter fills them',async()=>{
 const free=()=>{const t=tiny();t.world.firsts='free';return t;};
 const {missing}=assemble(structureOnly(free()));
 assert.ok(missing.includes('heroines.ava.rungs.kiss.checkpoints.reading'),'cue slots survive the picks pass');
 assert.ok(missing.includes('heroines.ava.rungs.night.checkpoints.check-in'),'the night keeps its check-in cue');
 assert.ok(!missing.some(m=>/rungs\.\w+\.choices/.test(m)),'no choice slots are drafted for free rungs');
 const {pack,missing:left}=await draftWorld(free(),{complete:echo});
 assert.deepEqual(left,[]);assert.equal(pack.firsts.find(f=>f.rung==='kiss').checkpoints.find(cp=>cp.id==='reading').cue,'text for heroines.ava.rungs.kiss.checkpoints.reading');
 assert.equal(pack.scriptedScenes.length,0);validatePack(pack,registry);
});
test('a batch whose call throws stays missing and the next round retries it; the run never dies',async()=>{
 let n=0;const seen=[];const r=await draftWorld(tiny(),{rounds:2,onBatch:x=>seen.push(x),complete:async m=>{if(n++===1)throw new Error('timeout');return echo(m);}});
 assert.deepEqual(r.missing,[]);assert.equal(seen.filter(x=>x.error).length,1);assert.equal(seen[1].error,'timeout');
});
