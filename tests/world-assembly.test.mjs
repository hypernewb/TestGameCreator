import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {assemble,specFromPack} from '../packages/cards/world-assembly.mjs';

// M2 creator: a world is templates (code: ids, gates, numbers) + a spec (AI/owner: text). Campus rebuilt from its own text is the first proof.
const campus=()=>JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url)));
const CAST={jana:{temperament:'torn',pace:'steady'},monique:{temperament:'guarded',pace:'slow'},nova:{temperament:'prickly',pace:'casual'},abigail:{temperament:'practical',pace:'easy'}},HEROINES=Object.keys(CAST),STRICT='monique';
const rebuilt=()=>assemble(specFromPack(campus(),{cast:CAST}));
const run=(p,c)=>{let state=createWorld(p,registry,`asm-${c}`),n=0;const edit=f=>{state=structuredClone(state);f(state);};
 const act=(type,args={})=>{edit(s=>{for(const [id,a] of Object.entries(s.actors))a.location=id===p.playerId||id===c?'apartment':a.location==='apartment'?'langley':a.location;});const r=execute(state,{id:`${c}-${n++}`,actorId:p.playerId,type,args,expectedRevision:state.revision},p,registry);state=r.state;return r;};
 return {act,edit,get state(){return state;},get scenes(){return state.modules['story.scenes'];}};};
const chemistry=(g,c,v)=>g.edit(s=>{s.modules['social.dating'].characters[c].chemistry=v;});
const choose=(g,c,rung,choice)=>g.act('story.choose',{scene:`${c}-${rung}`,choice});
const bed=(g,c)=>{g.act('social.requestIntimacy',{character:c,category:'first-night'});return g.act('social.beginIntimacy',{character:c,category:'first-night'});};
const firstChoice=(p,id)=>p.scriptedScenes.find(x=>x.id===id).choices[0].id;
const finish=(p,f)=>{let state=structuredClone(createWorld(p,registry,'end'));state.flags[p.run.fallbackFlag||'term-over']=true;state.flags['term-over']=true;state.tick=state.run.endTick;f(state);state=execute(state,{id:'end-1',actorId:p.playerId,type:'core.wait',args:{},expectedRevision:state.revision},p,registry).state;return state.modules['story.endings'].selected;};

test('campus rebuilt from its own text validates with no blank slots and keeps its ids, triggers and gates',()=>{
 const {pack,missing}=rebuilt(),c=campus();assert.deepEqual(missing,[]);validatePack(pack,registry);
 const ids=p=>p.scriptedScenes.map(x=>`${x.id}:${x.trigger?.event}`).sort();assert.deepEqual(ids(pack),ids(c));
 const ranks=p=>p.romanceTempoProfiles.map(x=>`${x.character}:${x.ranks.map(r=>`${r.id}@${r.min}`).join(',')}`).sort();assert.deepEqual(ranks(pack),ranks(c));
 const ends=p=>p.endings.map(e=>`${e.id}:${JSON.stringify(e.requires)}`).sort();assert.deepEqual(ends(pack),ends(c));
 const arcs=p=>p.arcTracks.map(t=>`${t.character}:${t.stages.map(s=>`${s.id}/${JSON.stringify(s.gate)}/${JSON.stringify(s.flags||s.setFlags||null)}`).join('|')}`).sort();assert.deepEqual(arcs(pack),arcs(c));
 for(const x of pack.intimacyProfiles)assert.deepEqual(x.requirements.phases,x.character===STRICT?['exclusive']:['dating','exclusive']);
 assert.ok(pack.scriptedScenes.find(x=>x.id==='monique-kiss').choices.some(ch=>ch.effects.some(e=>e.type==='discoverIntimacyInterest')),'a rung choice can still teach her interest');
});

for(const c of HEROINES)test(`assembled ${c} climbs talk, date, kiss and night in her order, and a stop replays the night`,()=>{
 const {pack:p}=rebuilt(),g=run(p,c),rank=p.romanceTempoProfiles.find(x=>x.character===c).ranks[1].id;
 const es=p.actProfiles.find(x=>x.character===c).entries.filter(x=>x.points>0);
 for(let i=0;i<6&&!g.scenes.pending;i++){const e=es[i%es.length];g.act('core.scene',{text:'Hey',location:'apartment',characters:[c],activity:'talk'});g.act('social.priceActs',{character:c,sceneId:g.state.scene.id,private:true,acts:[{kind:e.kind,target:e.target,size:'medium'}]});if(!g.scenes.pending)g.act('core.endScene');}
 assert.equal(g.scenes.pending,`${c}-talk`,`reaching ${rank} opens the talk`);choose(g,c,'talk',firstChoice(p,`${c}-talk`));if(g.state.scene)g.act('core.endScene');
 chemistry(g,c,60);g.act('social.askDate',{character:c});assert.equal(g.scenes.pending,`${c}-date`);choose(g,c,'date',firstChoice(p,`${c}-date`));
 const kiss=()=>{chemistry(g,c,90);g.act('social.defineRelationship',{character:c,agreement:'monogamous'});assert.equal(g.scenes.pending,`${c}-kiss`);choose(g,c,'kiss',firstChoice(p,`${c}-kiss`));};
 if(c===STRICT){assert.throws(()=>bed(g,c));kiss();}
 bed(g,c);assert.equal(g.scenes.pending,`${c}-night`);choose(g,c,'night',firstChoice(p,`${c}-night`));choose(g,c,'night','stop');assert.equal(g.scenes.pending,null);assert.ok(!g.state.flags[`${c}-first-night`]);
 g.edit(s=>{s.modules['social.intimacy'].characters[c].cooldownUntil=0;});g.act('core.wait');bed(g,c);assert.equal(g.scenes.pending,`${c}-night`);
 const night=p.scriptedScenes.find(x=>x.id===`${c}-night`);for(const ch of [night.choices[0].id,'yes',night.beats.find(b=>b.id==='peak').choices[0].id])choose(g,c,'night',ch);
 assert.ok(g.state.flags[`${c}-first-night`]);if(c!==STRICT)kiss();
 for(const r of ['talked','dated','kissed','first-night'])assert.ok(g.state.flags[`${c}-${r}`],`${c}-${r}`);
});

test('assembled endings: fallback, together and the arc route are each reachable',()=>{
 const {pack:p}=rebuilt(),fallback=p.endings.find(e=>e.priority<0);assert.equal(finish(p,()=>{}),fallback.id);
 for(const c of HEROINES){const ex=s=>{s.modules['social.dating'].characters[c].phase='exclusive';},together=p.endings.find(e=>e.requires?.datingPhases?.[c]==='exclusive'&&!e.requires.flags),route=p.endings.find(e=>e.requires?.romanceRanks?.[c]);
  assert.equal(finish(p,ex),together.id);
  assert.equal(finish(p,s=>{ex(s);Object.assign(s.flags,route.requires.flags);const prof=p.romanceTempoProfiles.find(x=>x.character===c);s.modules['social.romance-tempo'].characters[c].rank=prof.ranks.findIndex(r=>r.id===route.requires.romanceRanks[c]);}),route.id);}
});

// A spec with only structure picked (no prose yet) is still a valid, playable world: every blank is a named slot for the drafter.
const tiny=over=>({id:'tiny',title:'',days:3,player:{name:'You',age:22},heroines:[{id:'ava',temperament:'practical',pace:'easy',actor:{name:'Ava',age:24,location:'home'},topic:'climbing',gifts:{loved:'chalk'},...over}],world:{locations:[{id:'home',name:'Home',description:'',exits:[]}],items:[{id:'chalk',name:'Chalk',owner:'home',shop:true,price:3,stock:5}]}});
test('a structure-only spec validates and lists every blank text slot',()=>{
 const {pack,missing}=assemble(tiny());validatePack(pack,registry);assert.ok(missing.length>10);
 assert.ok(missing.includes('title')||missing.some(m=>/title/.test(m)));assert.ok(missing.some(m=>m.startsWith('heroines.ava.rungs.talk')));
 assert.ok(JSON.stringify(pack).includes('[['),'blank slots stay visible as [[path]]');
 const g=createWorld(pack,registry,'tiny');assert.ok(g.actors.ava);
});

test('the assembler refuses unknown templates, unknown tones and anyone under 18',()=>{
 assert.throws(()=>assemble(tiny({temperament:'sultry'})),/temperament/);
 assert.throws(()=>assemble(tiny({pace:'instant'})),/pace/);
 assert.throws(()=>assemble(tiny({rungs:{talk:{choices:[{label:'x',tone:'perfect'}]}}})),/tone/);
 assert.throws(()=>assemble(tiny({rungs:{talk:{choices:[{label:'x',tone:'miss'}]}}})),/best or good/);
 assert.throws(()=>assemble(tiny({actor:{name:'Ava',age:17,location:'home'}})),/adult/);
 assert.throws(()=>assemble(tiny({actor:{name:'Ava',location:'home'}})),/adult/);
});
test('the player must be an adult with an age too',()=>{assert.throws(()=>assemble({...tiny(),player:{name:'You'}}),/player: every character is an adult/);});
