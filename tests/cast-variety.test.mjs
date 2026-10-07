import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {eroticAngle,angleText,varietyOf,castClashes,tagContradictions,anachronisms,repairCharacter} from '../packages/ai/cast-variety.mjs';
import {characterMessages,authorCharacter} from '../packages/ai/character-authoring.mjs';
const fantasy=JSON.parse(readFileSync(new URL('../packs/template-fantasy-town.json',import.meta.url),'utf8'));
const npc=(name,o={})=>({name,pronouns:'she/her',age:23,description:'A woman in a green cloak.',appearance:'A woman in a green cloak.',appearanceTags:['red_hair','green_eyes','long_hair'],outfitTags:['cloak','long_skirt'],bodyTags:['slim','medium_breasts'],personality:`${name} is a gruff blacksmith who hides a soft heart behind loud jokes.`,behavior:{withStrangers:'Curt.',withFriends:'Loud.',withCrush:'Flustered.',withLover:'Clingy.',withEnemy:'Cold.'},backstory:'Lost her forge.',goal:'Rebuild it.',traits:[],likes:['ale'],dislikes:['rain'],role:'blacksmith',major:'blacksmith',rank:'',home:'the forge',sexStyle:{leads:80,loud:80,rough:20,drive:80,experience:80,adventurous:20},...o});
const pack=(actors=[],extra={})=>({id:'t',title:'Town',playerId:'p',locations:[{id:'sq',name:'Square',description:'Cobbles.',exits:[]}],actors:[{id:'p',name:'You'},...actors],...extra});

test('erotic angle: seeded, avoids cast ages and leanings, sliders off the middle',()=>{
 const c=[{id:'a',name:'A',age:19,sexStyle:{leads:90}},{id:'b',name:'B',age:20,sexStyle:{leads:85}}],p=pack(c,{authoringVariety:{ages:[19,22]}}),x=eroticAngle(p,7),y=eroticAngle(p,7);
 assert.deepEqual(x,y);assert.ok([21,22].includes(x.age));assert.doesNotMatch(x.leads,/dominant/);
 for(const [k,[lo,hi]] of Object.entries(x.sliders))if(k!=='leads')assert.ok(hi<30||lo>70,k);
 assert.ok(x.kinks.length>=1&&x.kinks.every(k=>!/^(dominating|submitting|switch)$/.test(k)));assert.match(angleText(x),/EROTIC ANGLE[^]*unless the brief/);
 const m=characterMessages(p,'a smith',{seed:7});assert.match(m.messages[1].content,/EROTIC ANGLE/);assert.match(m.messages[1].content,/Use age 2[12]/);assert.match(m.messages[1].content,/Never use these overused names: [^.]*elara/);
 assert.match(characterMessages(p,'x',{age:40,seed:7}).messages[1].content,/Use age 40/);assert.doesNotMatch(characterMessages(p,'x',{name:'Mina'}).messages[1].content,/overused names/);});

test('clashes: slop names, shared names, hair, role, phrasing, bland or twin sex style',()=>{
 const p=pack([{id:'r',...npc('Ryn Ashdown')}]),twin=npc('Elara Ashdown',{id:'n'});const c=castClashes(twin,p).join(' | ');
 for(const re of [/slop name \(elara\)/,/surname ashdown/,/hair colour red_hair/,/role "blacksmith"/,/personality repeats/,/sexStyle is nearly identical/])assert.match(c,re);
 assert.doesNotMatch(castClashes(twin,p,{fixedName:true}).join(' '),/slop|surname/);
 const fresh=npc('Mara Quill',{id:'m',appearanceTags:['black_hair','grey_eyes'],role:'ferrywoman',major:'ferrywoman',personality:'Mara reads tarot for sailors and lies about every card she draws.',sexStyle:{leads:10,loud:15,rough:85,drive:20,experience:10,adventurous:90}});assert.deepEqual(castClashes(fresh,p),[]);
 assert.match(castClashes({...fresh,sexStyle:{leads:50,loud:50,rough:50,drive:50,experience:50,adventurous:50}},p).join(' '),/bland 30-70/);
 const custom=pack([],{authoringVariety:{bannedNames:['Mara']}});assert.match(castClashes(fresh,custom).join(' '),/slop name \(mara\)/);});

test('tag contradictions and pack anachronisms; repair drops them and keeps the rest',()=>{
 const bad=npc('Mara',{appearanceTags:['red_hair','black_hair','blue_eyes','green_eyes','long_hair','short_hair','slim'],bodyTags:['slim','curvy','small_breasts','large_breasts'],outfitTags:['skirt','jeans','smartphone']});
 const t=tagContradictions(bad).join(' | ');for(const re of [/build/,/breasts/,/hair length/,/hair colour/,/eye colour/,/pick one bottom/,/repeated in both/])assert.match(t,re);
 assert.deepEqual(tagContradictions(npc('Ok',{appearanceTags:['heterochromia','blue_eyes','green_eyes']})),[]);
 assert.ok(fantasy.authoringVariety?.anachronisms?.includes('smartphone'));assert.match(anachronisms(bad,fantasy).join(' '),/smartphone/);assert.deepEqual(anachronisms(bad,pack()),[]);
 assert.match(anachronisms(npc('Mo',{description:'She checks her phone constantly.'}),fantasy).join(' '),/phone/);
 const {actor,warnings}=repairCharacter(bad,fantasy);assert.deepEqual(tagContradictions(actor),[]);assert.ok(!actor.outfitTags.includes('smartphone')&&!actor.outfitTags.includes('jeans')&&actor.outfitTags.includes('skirt'));assert.equal(actor.appearanceTags.filter(t=>/_hair$/.test(t)&&!/long|short/.test(t)).length,1);assert.ok(Array.isArray(warnings));
 assert.deepEqual(varietyOf({authoringVariety:{ages:[40,25]}}).ages,[25,40]);});

test('authorCharacter retries with the exact clashes, then repairs and warns',async()=>{
 const p=pack([{id:'r',...npc('Ryn Ashdown')}]),calls=[],answers=[npc('Elara Ashdown'),npc('Mara Quill',{appearanceTags:['black_hair'],major:'ferrywoman',role:'ferrywoman',personality:'Mara reads tarot for sailors.',sexStyle:{leads:10,loud:15,rough:85,drive:20,experience:10,adventurous:90}})];
 const r=await authorCharacter(async m=>{calls.push(structuredClone(m));return answers[calls.length-1];},p,'a local');assert.equal(r.attempts,2);assert.equal(r.actor.name,'Mara Quill');assert.deepEqual(r.warnings,[]);assert.match(calls[1].at(-1).content,/slop name[^]*surname ashdown[^]*hair colour/);
 const stuck=await authorCharacter(async()=>npc('Ryn Ashdown',{bodyTags:['slim','curvy']}),p,'x',{},{tries:2});assert.equal(stuck.attempts,2);assert.ok(stuck.warnings.length);assert.deepEqual(tagContradictions(stuck.actor),[]);
 await assert.rejects(authorCharacter(async()=>'{nope',p,'x',{},{tries:2}));});
