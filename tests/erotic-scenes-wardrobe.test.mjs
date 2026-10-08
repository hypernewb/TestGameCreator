import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {validatePack,createWorld} from '../packages/core/engine.mjs';import {registry} from '../packages/modules/index.mjs';
import {wornSetOf} from '../packages/assets/character-sprites.mjs';import {assetReferences} from '../packages/assets/asset-audit.mjs';
import {galleryOf,replayLines,intimacyId} from '../public/gallery.mjs';
const fantasy=JSON.parse(readFileSync(new URL('../packs/template-fantasy-town.json',import.meta.url),'utf8'));
const withScene=(beats,extra={})=>{const p=structuredClone(fantasy),prof=p.intimacyProfiles.find(q=>q.character!==p.playerId),cat=p.intimacyCategories[0].id;prof.scenes=[{category:cat,notes:'Slow, by the hearth.',beats:beats,aftermath:'She stays for breakfast.',...extra}];return {p,prof,cat};};

test('wornSetOf: first matching rule wins, empty conditions match anything, unknown sets fall back',()=>{
 const char={outfitSets:{casual:{},evening:{}},outfitRules:[{set:'evening',daypart:'Evening'},{set:'casual',location:'loft'},{set:'default',undressed:'yes'}]};
 assert.equal(wornSetOf(char,{daypart:'Evening',location:'loft'}),'evening');
 assert.equal(wornSetOf(char,{daypart:'Morning',location:'loft'}),'casual');
 assert.equal(wornSetOf(char,{daypart:'Morning',location:'tavern',undressed:true}),'default');
 assert.equal(wornSetOf(char,{daypart:'Morning',location:'tavern'}),'default');
 assert.equal(wornSetOf({outfitSets:{},outfitRules:[{set:'gone',daypart:'Morning'}]},{daypart:'Morning'}),'default');
 assert.equal(wornSetOf(null,{}),'default');});

test('validate: sex scene beats and aftermath are checked; a valid scene passes',()=>{
 const {p}=withScene([{text:'She leans in.',checkIn:'Still good?'},{text:'Slower now.'}]);validatePack(p,registry);
 const bad=withScene(Array.from({length:13},(_,i)=>({text:'x'+i})));assert.throws(()=>validatePack(bad.p,registry),/beats invalid/);
 const longAft=withScene([{text:'ok'}],{aftermath:'a'.repeat(601)});assert.throws(()=>validatePack(longAft.p,registry),/aftermath invalid/);});

test('gallery: intimacy scenes list as CG cards, unlock only after an encounter, replay beats then aftermath',()=>{
 const {p,prof,cat}=withScene([{text:'She leans in.',cg:'assets/a.png'},{text:'Slower now.'}]);validatePack(p,registry);
 const st=createWorld(p,registry,'x'),id=intimacyId(prof.character,cat);
 const card=()=>galleryOf(st,p).flatMap(r=>r.scenes).find(x=>x.id===id);
 assert.equal(card()?.unlocked,false);assert.deepEqual(replayLines(st,p,id),[]);
 st.modules['social.intimacy'].characters[prof.character].encounters=[{category:cat}];
 assert.equal(card().unlocked,true);assert.equal(card().plays,1);
 const lines=replayLines(st,p,id);assert.deepEqual(lines.map(l=>l.text),['She leans in.','Slower now.','She stays for breakfast.']);
 assert.equal(lines[0].cg,'assets/a.png');assert.equal(lines[1].cg,undefined);});

test('asset audit: scene CG and beat CGs are referenced under intimacy, so missing art shows up',()=>{
 const {p,prof,cat}=withScene([{text:'a',cg:'assets/beat0.png'},{text:'b'}],{cg:'assets/scene.png'});
 const refs=assetReferences(p).filter(r=>r.owner.type==='intimacy');
 const paths=refs.map(r=>r.ref);
 assert.ok(paths.includes(`intimacy.${prof.character}.${cat}.cg`),JSON.stringify([prof.character,cat,paths]));
 assert.ok(paths.includes(`intimacy.${prof.character}.${cat}.beats.0.cg`),paths.join(' '));
 assert.ok(refs.every(r=>r.section==='Intimate scenes'));});
