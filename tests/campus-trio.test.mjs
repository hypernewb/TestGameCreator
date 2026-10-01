import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {reskin,EXPRESSIONS} from '../scripts/reskin-campus.mjs';

// Owner call 2026-10-01: the campus plays with the three generated heroines only (Yuna torn/slow, Haruka prickly, Min-ji bold), all 20.
const file=()=>JSON.parse(readFileSync(new URL('../packs/campus-trio.json',import.meta.url)));
const campus=()=>JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url)));
const HEROINES=['yuna','haruka','minji'];
const REGIONS=['face','lips','neck','arms_hands','chest','back','belly_waist','hips_butt','thighs_legs','intimate'];

test('trio body maps are complete, distinct and bounded, without changing eligibility or source data',()=>{
 const original=campus(),before=structuredClone(original),generated=reskin(original),saved=file();assert.deepEqual(original,before);assert.deepEqual(saved,generated);
 for(const p of [saved,generated]){const maps=[];for(const c of HEROINES){const s=p.characterSheets.find(s=>s.actorId===c),body=s.dating.body,values=Object.values(body);assert.deepEqual(Object.keys(body).sort(),[...REGIONS].sort());
   for(const r of REGIONS){assert.deepEqual(Object.keys(body[r]).sort(),['limit','sensitivity']);assert.ok(Number.isInteger(body[r].sensitivity)&&body[r].sensitivity>=0&&body[r].sensitivity<=3,`${c}.${r} sensitivity`);assert.ok(['ok','ask_first','never'].includes(body[r].limit),`${c}.${r} limit`);}
   assert.ok(values.some(v=>v.limit==='never'));assert.ok(values.filter(v=>v.limit==='ask_first').length>=3);assert.equal(s.dating.limitsNotes.split(/(?<=[.!?])\s+/).length,2);maps.push(JSON.stringify(body));
   const old={yuna:'jana',haruka:'nova',minji:'abigail'}[c],base=original.characterSheets.find(s=>s.actorId===old);for(const k of Object.keys(base.dating).filter(k=>!['body','limitsNotes'].includes(k)))assert.deepEqual(s.dating[k],base.dating[k]);
   for(const key of ['datingProfiles','intimacyProfiles']){const profile=p[key].find(x=>x.character===c),expected=JSON.parse(JSON.stringify(original[key].find(x=>x.character===old)).replaceAll(old,c));assert.deepEqual(profile,expected);}}
  assert.equal(new Set(maps).size,3);const counts=HEROINES.map(c=>Object.values(p.characterSheets.find(s=>s.actorId===c).dating.body).filter(v=>v.limit==='ok').length);assert.ok(counts[0]<counts[1]&&counts[1]<counts[2]);}
});

test('the trio pack validates, has only Yuna, Haruka and Min-ji (all 20), and no old cast survives',()=>{
 for(const p of [file(),reskin(campus())]){validatePack(p,registry);
  assert.deepEqual(p.actors.map(a=>a.id).sort(),['haruka','minji','player','yuna']);assert.deepEqual(p.datingProfiles.map(d=>d.character).sort(),[...HEROINES].sort());
  for(const c of HEROINES)assert.equal(p.actors.find(a=>a.id===c).age,20);
  assert.doesNotMatch(JSON.stringify(p),/monique|kaylee|dominik|glasses|freckle|german|borkum|\bjana\b|\bnova\b|\babigail\b/i);}
});

test('every heroine has the 7 generated expressions and every image the trio pack names exists',()=>{
 const p=file();for(const c of HEROINES){const a=p.actors.find(x=>x.id===c);assert.deepEqual(a.poses.map(x=>x.id),EXPRESSIONS);assert.equal(a.portrait,`assets/characters/${c}/expressions/neutral.png`);}
 for(const f of new Set(JSON.stringify(p).match(/assets\/[^"]+\.(?:png|jpg|webp)/g)))assert.ok(existsSync(new URL(`../public/${f}`,import.meta.url)),f);
 assert.ok(p.firsts.filter(f=>f.rung==='night').every(f=>f.cg.startsWith(`assets/characters/${f.character}/scenes/`)));
});

test('the trio keeps the campus romance scale and Yuna\'s storyline is about home',()=>{
 const p=file();for(const t of p.romanceTempoProfiles)assert.deepEqual(t.ranks.map(r=>r.points),[0,6,20,32]);assert.deepEqual(p.romanceStats,{dailyGain:6});
 const y=p.actors.find(a=>a.id==='yuna');assert.match(y.backstory,/Jeju/);assert.match(y.goal,/parents/);assert.ok(p.actProfiles.find(a=>a.character==='minji').entries.some(e=>e.id==='minji-earrings'));
});

const run=(p,c)=>{let state=createWorld(p,registry,`trio-${c}`),n=0;const edit=f=>{state=structuredClone(state);f(state);};
 const act=(type,args={})=>{edit(s=>{for(const [id,a] of Object.entries(s.actors))a.location=id===p.playerId||id===c?'apartment':a.location==='apartment'?'langley':a.location;});state=execute(state,{id:`${c}-${n++}`,actorId:p.playerId,type,args,expectedRevision:state.revision},p,registry).state;};
 return {act,edit,get state(){return state;}};};
const live=g=>g.state.modules['social.firsts'].active?.first||null;
for(const c of HEROINES)test(`${c}: priced acts open her talk first and a few typed yeses play it through`,()=>{
 const p=file(),g=run(p,c),es=p.actProfiles.find(x=>x.character===c).entries.filter(x=>x.points>0);
 for(let i=0;i<12&&!live(g);i++){const e=es[i%es.length];g.act('core.scene',{text:'Hey',location:'apartment',characters:[c],activity:'talk'});g.act('social.priceActs',{character:c,sceneId:g.state.scene.id,private:true,acts:[{kind:e.kind,target:e.target,size:'medium'}]});if(!live(g)){g.act('core.endScene');g.edit(s=>{s.tick+=12;});}}
 assert.equal(live(g),`${c}-talk`);for(let i=0;i<12&&live(g);i++)g.act('social.scoreFirst',{source:`t${i}`,text:'Yes.'});
 assert.equal(live(g),null);assert.ok(g.state.flags[`${c}-talked`]);
});
