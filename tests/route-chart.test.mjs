import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {routeChart,setGate,addEnding,addTimedEvent,addPhoneMessage,addFirst,canAddFirst,createDatingProfile,castMeters,FIRST_RUNGS} from '../public/route-chart.mjs';
import {registry} from '../packages/modules/index.mjs';import {validatePack,clone} from '../packages/core/engine.mjs';
const read=f=>JSON.parse(readFileSync(new URL('../packs/'+f,import.meta.url),'utf8')),fantasy=read('template-fantasy-town.json'),campus=read('campus.json'),items=col=>col.items.map(i=>i.title);

test('fantasy route: stages left to right with sex scene, anytime phone/timed and failure branches',()=>{const r=routeChart(fantasy,'ryn'),phases=r.ladders.find(l=>l.kind==='phases');
 assert.deepEqual(phases.columns.map(c=>c.id),['available','crush','dating','exclusive']);assert.ok(items(phases.columns[0]).includes('Moonlit tryst'));assert.ok(phases.columns.slice(1).every(c=>c.gate?.edit));
 assert.ok(r.anytime.some(i=>i.kind==='phone')&&r.anytime.some(i=>i.kind==='timed'));assert.deepEqual(r.branches.map(b=>b.title).sort(),['Breakup','Rejected']);assert.equal(r.endings.length,1);assert.ok(r.warnings.some(w=>/no CG/.test(w)));
 assert.doesNotMatch(JSON.stringify(r),/\b(jana|campus|she|her)\b/i);});

test('campus route: rank ladder, firsts and kiss under the right stages',()=>{const r=routeChart(campus,'jana'),ranks=r.ladders.find(l=>l.kind==='ranks'),phases=r.ladders.find(l=>l.kind==='phases');
 assert.ok(ranks.columns.length>=3);assert.ok(ranks.columns.slice(1).every(c=>c.gate.edit.kind==='rank'));
 assert.ok(phases.columns.find(c=>c.id==='dating').items.filter(i=>i.kind==='first').length>=2);assert.ok(phases.columns.find(c=>c.id==='exclusive').items.some(i=>i.kind==='first'));assert.ok(r.endings.length>=2);});

test('gate edits write the pack; add helpers stay valid on a non-campus pack',()=>{const p=clone(fantasy);
 assert.ok(setGate(p,'ryn',{kind:'threshold',key:'crush'},12));assert.equal(p.datingProfiles.find(d=>d.character==='ryn').thresholds.crush,12);assert.equal(setGate(p,'ryn',{kind:'threshold',key:'crush'},'x'),false);
 addEnding(p,'ryn');addTimedEvent(p,'ryn');addPhoneMessage(p,'ryn');assert.ok(p.phoneContacts.includes('ryn'));
 const on=id=>{for(const d of registry[id].requires||[])on(d);p.modules[id]=registry[id].version;};on('social.firsts');for(const rung of Object.keys(FIRST_RUNGS))if(canAddFirst(p,'ryn',rung))assert.ok(addFirst(p,'ryn',rung));assert.ok(p.firsts.length>=3);assert.equal(addFirst(p,'ryn','date'),false);
 assert.doesNotThrow(()=>validatePack(p,registry));const r=routeChart(p,'ryn');assert.ok(r.endings.length===2&&r.anytime.filter(i=>i.kind==='phone').length>=2);
 const q=clone(fantasy);q.datingProfiles=[];assert.ok(createDatingProfile(q,'ryn'));assert.equal(createDatingProfile(q,'ryn'),false);});

test('cast meters: player gets card/looks/images, NPCs add route and sex CGs',()=>{const pl=castMeters(fantasy,fantasy.actors.find(a=>a.id===fantasy.playerId)),ryn=castMeters(fantasy,fantasy.actors.find(a=>a.id==='ryn'));
 assert.deepEqual(pl.map(m=>m[0]),['Card','Looks','Images']);assert.deepEqual(ryn.map(m=>m[0]),['Card','Looks','Images','Route','Sex CGs']);assert.ok(ryn.every(([,v])=>v>=0&&v<=1));assert.equal(Object.fromEntries(castMeters(campus,campus.actors.find(a=>a.id==='jana'))).Route,1);});

test('studio tabs: every section title maps to a tab and the Romance route mounts guarded',()=>{const s=readFileSync(new URL('../public/studio.mjs',import.meta.url),'utf8'),line=s.split('\n').find(l=>l.includes('const studioTabs=')),tabs=JSON.parse(line.match(/const studioTabs=(\[.*?\]\]\]),tabOf/)[1].replace(/'/g,'"'));
 const ids=tabs.map(t=>t[0]),titles=tabs.flatMap(t=>t[2]);assert.deepEqual(ids,['world','cast','romance','systems','look','test','advanced']);assert.equal(new Set(titles).size,titles.length);
 for(const t of ['Romance route','Cast gallery','Firsts','Characters','Route map','Game UI','Review / Save','Game project'])assert.ok(titles.includes(t),t);
 assert.match(s,/typeof mountRouteChart==='function'/);assert.match(s,/c\.dataset\.rowId=/);assert.doesNotMatch(s,/button\.dataset\.title=/);});
