import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {assemble,specFromPack} from '../packages/cards/world-assembly.mjs';
import {FIRST_CHECKPOINTS} from '../packages/cards/beat-library.mjs';

// M2 creator: a world is templates (code: ids, gates, numbers) + a spec (AI/owner: text). Campus rebuilt from its own text is the first proof.
const campus=()=>JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url)));
const CAST={jana:{temperament:'torn',pace:'steady'},monique:{temperament:'guarded',pace:'slow'},nova:{temperament:'prickly',pace:'casual'},abigail:{temperament:'practical',pace:'easy'}},HEROINES=Object.keys(CAST),STRICT='monique';
const rebuilt=()=>assemble(specFromPack(campus(),{cast:CAST}));
const run=(p,c)=>{let state=createWorld(p,registry,`asm-${c}`),n=0;const edit=f=>{state=structuredClone(state);f(state);};
 const act=(type,args={})=>{edit(s=>{for(const [id,a] of Object.entries(s.actors))a.location=id===p.playerId||id===c?'apartment':a.location==='apartment'?'langley':a.location;});const r=execute(state,{id:`${c}-${n++}`,actorId:p.playerId,type,args,expectedRevision:state.revision},p,registry);state=r.state;return r;};
 return {act,edit,n:0,get state(){return state;},get firsts(){return state.modules['social.firsts'];}};};
const chemistry=(g,c,v)=>g.edit(s=>{s.modules['social.dating'].characters[c].chemistry=v;});
const live=g=>g.firsts.active?.first||null;
// Campus is free-typed since O1: a first plays through on plain typed turns (each checkpoint half-lands, the check-in takes a yes).
const through=(g,id)=>{assert.equal(live(g),id);for(let i=0;i<12&&live(g);i++)g.act('social.scoreFirst',{source:`t${g.n++}`,text:'Yes.'});assert.equal(live(g),null);};
const bed=(g,c)=>{g.act('social.requestIntimacy',{character:c,category:'first-night'});return g.act('social.beginIntimacy',{character:c,category:'first-night'});};
const finish=(p,f)=>{let state=structuredClone(createWorld(p,registry,'end'));state.flags[p.run.fallbackFlag||'term-over']=true;state.flags['term-over']=true;state.tick=state.run.endTick;f(state);state=execute(state,{id:'end-1',actorId:p.playerId,type:'core.wait',args:{},expectedRevision:state.revision},p,registry).state;return state.modules['story.endings'].selected;};

test('campus rebuilt from its own text validates with no blank slots and keeps its ids, triggers and gates',()=>{
 const {pack,missing}=rebuilt(),c=campus();assert.deepEqual(missing,[]);validatePack(pack,registry);
 assert.deepEqual(pack.scriptedScenes,[]);assert.deepEqual(pack.firsts,c.firsts,'ids, triggers, cues, discovers, interests and CGs round-trip exactly');
 const ranks=p=>p.romanceTempoProfiles.map(x=>`${x.character}:${x.ranks.map(r=>`${r.id}@${r.min}`).join(',')}`).sort();assert.deepEqual(ranks(pack),ranks(c));
 const ends=p=>p.endings.map(e=>`${e.id}:${JSON.stringify(e.requires)}`).sort();assert.deepEqual(ends(pack),ends(c));
 const arcs=p=>p.arcTracks.map(t=>`${t.character}:${t.stages.map(s=>`${s.id}/${JSON.stringify(s.gate)}/${JSON.stringify(s.flags||s.setFlags||null)}`).join('|')}`).sort();assert.deepEqual(arcs(pack),arcs(c));
 for(const x of pack.intimacyProfiles)assert.deepEqual(x.requirements.phases,x.character===STRICT?['exclusive']:['dating','exclusive']);
 assert.ok(pack.firsts.filter(x=>x.rung==='night').every(x=>x.interest),'every night still teaches her interest');
});

for(const c of HEROINES)test(`assembled ${c} climbs talk, date, kiss and night in her order, and a stop replays the night`,()=>{
 const {pack:p}=rebuilt(),g=run(p,c),rank=p.romanceTempoProfiles.find(x=>x.character===c).ranks[1].id;
 const es=p.actProfiles.find(x=>x.character===c).entries.filter(x=>x.points>0);
 for(let i=0;i<6&&!live(g);i++){const e=es[i%es.length];g.act('core.scene',{text:'Hey',location:'apartment',characters:[c],activity:'talk'});g.act('social.priceActs',{character:c,sceneId:g.state.scene.id,private:true,acts:[{kind:e.kind,target:e.target,size:'medium'}]});if(!live(g))g.act('core.endScene');}
 assert.equal(live(g),`${c}-talk`,`reaching ${rank} opens the talk`);through(g,`${c}-talk`);if(g.state.scene)g.act('core.endScene');
 chemistry(g,c,60);g.act('social.askDate',{character:c});through(g,`${c}-date`);
 const kiss=()=>{chemistry(g,c,90);g.act('social.defineRelationship',{character:c,agreement:'monogamous'});through(g,`${c}-kiss`);};
 if(c===STRICT){assert.throws(()=>bed(g,c));kiss();}
 bed(g,c);assert.equal(live(g),`${c}-night`);g.act('social.scoreFirst',{source:`t${g.n++}`,text:'Yes.'});g.act('social.stopFirst');assert.equal(live(g),null);assert.ok(!g.state.flags[`${c}-first-night`]);
 g.edit(s=>{s.modules['social.intimacy'].characters[c].cooldownUntil=0;});g.act('core.wait');bed(g,c);through(g,`${c}-night`);
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

// O1 free firsts: the world opts in with world.firsts (or a rung overrides with rungs.<rung>.mode); the assembler emits
// pack.firsts entries whose checkpoints come from code (FIRST_CHECKPOINTS), leaving only cues as draftable prose slots.
const freeTiny=over=>{const t=tiny(over);t.world={...t.world,firsts:'free'};return t;};
test('a free world emits one first per rung with code-owned checkpoints and no authored scene',()=>{
 const {pack,missing}=assemble(freeTiny());validatePack(pack,registry);
 assert.deepEqual(pack.firsts.map(f=>`${f.character}:${f.rung}`),['ava:talk','ava:date','ava:kiss','ava:night']);
 assert.equal(pack.scriptedScenes.length,0,'free rungs build no choice scenes');
 const kiss=pack.firsts.find(f=>f.rung==='kiss');
 assert.deepEqual(kiss.checkpoints.map(cp=>cp.id),['reading','leaning-in','after']);
 assert.ok(kiss.checkpoints.every(cp=>cp.cue.startsWith('[[')),'cues are blank slots until drafted');
 assert.ok(missing.includes('heroines.ava.rungs.kiss.checkpoints.leaning-in'));
 const night=pack.firsts.find(f=>f.rung==='night');
 assert.ok(night.checkpoints.some(cp=>cp.id==='check-in'),'the night keeps its check-in checkpoint');
 assert.ok(missing.includes('heroines.ava.rungs.night.checkpoints.check-in'));
 assert.equal(night.trigger.event,'social.intimacyStarted');
 const talk=pack.firsts.find(f=>f.rung==='talk');
 assert.equal(talk.trigger.match.to,pack.romanceTempoProfiles.find(x=>x.character==='ava').ranks[1].id,'the talk trigger opens at the friend rank, like the authored one');
 assert.ok(!('firsts' in assemble(tiny()).pack),'an authored world (the default) emits no firsts key');
});
test('firsts mode: a rung can override the world, cues can be pre-written, and a bad mode is refused',()=>{
 const t=freeTiny({rungs:{talk:{mode:'authored'},kiss:{checkpoints:{reading:'She glances at the record shelf.'}}}});
 const {pack,missing}=assemble(t);validatePack(pack,registry);
 assert.ok(pack.scriptedScenes.some(s=>s.id==='ava-talk'),'an authored rung in a free world keeps its choice scene');
 assert.deepEqual(pack.firsts.map(f=>f.rung),['date','kiss','night']);
 const kiss=pack.firsts.find(f=>f.rung==='kiss');
 assert.equal(kiss.checkpoints.find(cp=>cp.id==='reading').cue,'She glances at the record shelf.');
 assert.ok(!missing.includes('heroines.ava.rungs.kiss.checkpoints.reading'));
 assert.throws(()=>assemble(tiny({rungs:{kiss:{mode:'improvised'}}})),/mode/);
 assert.throws(()=>{const b=tiny();b.world={...b.world,firsts:'open'};return assemble(b);},/firsts/);
});
test('a free world reads back from its pack: cues, modes and the world flag round-trip',()=>{
 const cues=r=>Object.fromEntries(FIRST_CHECKPOINTS[r].map(cp=>[cp.id,`${r} ${cp.id} cue`]));
 const t=freeTiny({rungs:Object.fromEntries(['talk','date','kiss','night'].map(r=>[r,{title:`${r} title`,opening:`${r} opening`,checkpoints:cues(r)}]))});
 const {pack}=assemble(t);
 const back=specFromPack(pack,{cast:{ava:{temperament:'practical',pace:'easy'}}});
 assert.equal(back.world.firsts,'free');
 assert.deepEqual(back.heroines[0].rungs.kiss,{mode:'free',title:'kiss title',opening:'kiss opening',checkpoints:cues('kiss')});
 assert.deepEqual(assemble(back).pack.firsts,pack.firsts);
});
test('free firsts are live in the pack: the module is registered, a cue can discover a preference, and the night learns her interest',()=>{
 const t=freeTiny({wants:[{id:'steady',stat:'charm',min:1}],rungs:{kiss:{checkpoints:{reading:{cue:'She reads you.',discover:'steady'}}}}});t.world.statDefinitions=[{id:'charm',name:'Charm',min:0,max:20,visibility:'public'}];
 const {pack}=assemble(t);validatePack(pack,registry);assert.equal(pack.modules['social.firsts'],'0.1.0');assert.ok(!('social.firsts' in assemble(tiny()).pack.modules));
 const kiss=pack.firsts.find(f=>f.rung==='kiss');assert.deepEqual(kiss.checkpoints[0],{id:'reading',cue:'She reads you.',discover:'ava-steady'});
 assert.equal(pack.firsts.find(f=>f.rung==='night').interest,pack.intimacyProfiles[0].interests[0].id);
 assert.deepEqual(specFromPack(pack,{cast:{ava:{temperament:'practical',pace:'easy'}}}).heroines[0].rungs.kiss.checkpoints.reading,{cue:'She reads you.',discover:'steady'});
 assert.throws(()=>assemble(freeTiny({rungs:{kiss:{checkpoints:{reading:{cue:'x',discover:'nope'}}}}})),/unknown preference/);
});
test('a mixed world reads back with the mode on every rung, and rebuilds the same pack',()=>{
 const t=freeTiny({rungs:{talk:{mode:'authored',choices:[{tone:'best',label:'Lean in',result:'You do.'}]}}});
 const {pack}=assemble(t);
 const back=specFromPack(pack,{cast:{ava:{temperament:'practical',pace:'easy'}}});
 assert.equal(back.heroines[0].rungs.talk.mode,'authored');
 assert.deepEqual(['date','kiss','night'].map(r=>back.heroines[0].rungs[r].mode),['free','free','free']);
 const again=assemble(back).pack;
 assert.deepEqual(again.firsts,pack.firsts);
 assert.deepEqual(again.scriptedScenes,pack.scriptedScenes);
});
test('assembled worlds cap romance gains and set arc trust gates over her starting Trust',()=>{
 const spec=specFromPack(campus(),{cast:CAST}),p=assemble(spec).pack;assert.deepEqual(p.romanceStats,{dailyGain:6});
 for(const c of HEROINES){const t=p.initialRelationships.find(r=>r.character===c).trust,arc=p.arcTracks.find(a=>a.character===c);
  assert.equal(arc.traits.find(x=>x.id==='trust').initial,t);assert.deepEqual(arc.stages.slice(1).map(s=>s.when.trust),[t+6,t+15]);}
 const fresh=structuredClone(spec);delete fresh.world.romanceStats;fresh.heroines[0].trust=undefined;const q=assemble(fresh).pack,j=q.arcTracks[0];
 assert.deepEqual(q.romanceStats,{dailyGain:6});assert.equal(j.traits.find(x=>x.id==='trust').initial,25,'torn preset start');assert.equal(j.stages[1].when.trust,31);
});

test('assembled worlds use the 6/20/32 rank scale, -3 loss cap, big gifts and no neglect',async()=>{
 const {TEMPERAMENTS,SHARED_ACTS,RANK_POINTS}=await import('../packages/cards/beat-library.mjs');
 assert.deepEqual(RANK_POINTS.map(r=>r[0]),[0,6,20,32]);assert.deepEqual(SHARED_ACTS.map(a=>a[3]),[6,2,-3]);
 for(const t of rebuilt().pack.romanceTempoProfiles){assert.equal(t.neglect,undefined);assert.deepEqual(t.ranks.map(r=>r.points),[0,6,20,32]);}
 for(const [k,T] of Object.entries(TEMPERAMENTS)){for(const a of T.acts)assert.ok(a[3]>=-3,`${k} ${a[0]}`);for(const d of T.drift)assert.ok(d[3]>=-3,`${k} drift`);}
});
