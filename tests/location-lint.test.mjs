import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {locationExtras,locationProblems,locationFillMessages,locationFillPatch} from '../packages/ai/location-lint.mjs';
import {normalizeLocations} from '../packages/ai/bulk-authoring.mjs';
import {seedMessages,seedSchema} from '../packages/cards/card-world.mjs';
import {validatePack,createWorld} from '../packages/core/engine.mjs';import {registry} from '../packages/modules/index.mjs';import {intimacyEligibility} from '../packages/modules/intimacy.mjs';
const fantasy=JSON.parse(readFileSync(new URL('../packs/template-fantasy-town.json',import.meta.url),'utf8'));
const map=[{id:'tavern',name:'The Gilded Tankard',description:'x',exits:[]},{id:'loft',name:'Hayloft',description:'x',exits:[]}];

test('location extras keep mood, crowd, exposure enum and tidy art tags',()=>{
 assert.deepEqual(locationExtras({mood:' Lamplit, smells of hay ',crowd:'Empty after dusk',exposure:'risky',artTags:['Hay Bales','hay bales','warm light!']}),{mood:'Lamplit, smells of hay',crowd:'Empty after dusk',exposure:'risky',artTags:['hay_bales','warm_light']});
 assert.deepEqual(locationExtras({exposure:'secret'}),{});
 const [l]=normalizeLocations([{id:'loft',name:'Loft',description:'Hay.',exits:[],exposure:'private',artTags:['hay']}],[],1);assert.equal(l.exposure,'private');assert.deepEqual(l.artTags,['hay']);
 const sys=seedMessages({data:{name:'Ivy',description:'A barmaid.'}},{locationCount:3})[0].content;assert.match(sys,/mood,crowd,exposure,artTags/);assert.match(sys,/romantic spot[^]*private place[^]*risky/);
 const loc=seedSchema({data:{name:'Ivy',description:'A barmaid.'}},{locationCount:3}).properties.locations.items;assert.deepEqual(loc.properties.exposure.enum,['private','risky','public']);});

test('lint: cast named as fixtures and ways to places that do not exist',()=>{
 const bad=locationProblems([{id:'tavern',description:'Mara Quill is always behind the bar. A staircase leads up to the bathhouse, and a door opens onto the hayloft.'}],{cast:['Mara Quill'],locations:map}).join(' | ');
 assert.match(bad,/names Mara Quill/);assert.match(bad,/"bathhouse"/);assert.doesNotMatch(bad,/hayloft/);
 assert.deepEqual(locationProblems([{id:'loft',description:'A ladder leads down to the tankard. Marigolds grow by the window.'}],{cast:['Mari'],locations:map}),[]);});

test('exposure private counts as private for intimacy even when not listed',()=>{
 const p=structuredClone(fantasy),loc=p.locations.find(l=>!p.intimacySettings.privateLocations.includes(l.id));assert.ok(loc);loc.exposure='private';validatePack(p,registry);
 const npc=p.actors.find(a=>a.id!==p.playerId&&p.intimacyProfiles?.some(x=>x.character===a.id)),cat=p.intimacyCategories.find(c=>c.privacy!=='public');assert.ok(npc&&cat);
 const st=createWorld(p,registry,'x');for(const a of p.actors)st.actors[a.id].location=a.id===p.playerId||a.id===npc.id?loc.id:p.locations.find(l=>l.id!==loc.id).id;
 const reasons=e=>JSON.stringify(e);assert.doesNotMatch(reasons(intimacyEligibility(st,p,npc.id,cat.id)),/not private enough/);
 delete loc.exposure;assert.match(reasons(intimacyEligibility(st,p,npc.id,cat.id)),/not private enough/);});


test('location fill: only blanks, authored text kept, bad description throws for retry',()=>{
 const p={title:'Town',playerId:'p',actors:[{id:'p',name:'You'},{id:'m',name:'Mara'}],locations:map},loc={...map[1],description:'',mood:'Dusty and warm',exits:[{to:'tavern'}]};
 const q=locationFillMessages(p,loc);assert.deepEqual(q.blanks,['description','crowd','exposure','artTags']);assert.match(q.messages[1].content,/mood: Dusty and warm/);assert.match(q.messages[0].content,/ways out: The Gilded Tankard/);
 const patch=locationFillPatch(loc,{description:'Hay bales and a ladder down to the tankard.',mood:'ignored',crowd:'Nobody after dark',exposure:'private',artTags:['hay']},p);assert.deepEqual(Object.keys(patch).sort(),['artTags','crowd','description','exposure']);
 assert.throws(()=>locationFillPatch(loc,{description:'Mara sleeps here. A trapdoor opens into the crypt.'},p),/names Mara[^]*crypt/);
 assert.deepEqual(locationFillMessages(p,{...loc,description:'d',crowd:'c',exposure:'public',artTags:['a']}).blanks,[]);});

test('bulk strict mode rejects a place that names the cast or invents an exit',async()=>{
 const {normalizeCandidate}=await import('../packages/ai/bulk-authoring.mjs'),p=structuredClone(fantasy),npc=p.actors.find(a=>a.id!==p.playerId),to=p.locations[0].id;
 const raw=d=>({locations:[{id:'loft',name:'Hayloft',description:d,exits:[to]}],characters:[],scenes:[]});
 assert.throws(()=>normalizeCandidate(raw(`${npc.name} naps here. A ladder leads down to the catacombs.`),p,{locationCount:1},{strict:true}),/names[^]*catacombs/);
 assert.equal(normalizeCandidate(raw('Hay bales under low beams.'),p,{locationCount:1},{strict:true}).locations.length,1);});

test('startup seed re-asks once on place lint, then keeps leftovers as warnings',async()=>{
 const {draftStartup}=await import('../packages/ai/startup-authoring.mjs'),w=d=>({title:'Harbor',premise:'p',setting:'s',writingStyle:'w',playerLocation:'l0',characterLocation:'l0',locations:[{id:'l0',name:'Pier',description:d,exits:[]}]});
 const run=async seeds=>{const calls=[];const r=await draftStartup(async m=>{calls.push(m);if(calls.length<=seeds.length)return w(seeds[calls.length-1]);throw Error('no npc');},{prompt:'A harbor romance.',npcTotal:1,locationTotal:1});return {r,calls};};
 const fixed=await run(['Salt air. A gate leads to the lighthouse.','Salt air and gulls.']);assert.match(fixed.calls[1].at(-1).content+fixed.calls[1][0].content,/lighthouse/);assert.equal(fixed.r.candidates.locations[0]?.description??fixed.r.pack?.locations?.[0]?.description,'Salt air and gulls.');assert.ok(!fixed.r.validation.warnings.some(x=>/^locations:/.test(x)));
 const stuck=await run(['A gate leads to the lighthouse.','A gate leads to the lighthouse.']);assert.ok(stuck.r.validation.warnings.some(x=>/^locations:.*lighthouse/.test(x)));});
