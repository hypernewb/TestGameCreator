import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ARCHETYPES,LIVING,FORMALITY,HUMOUR,DIRECTNESS,TEASING,INITIATION,PACE,UNWELCOME,SPACE,PROFILE_SECTIONS,PROFILE_SECTION_KEYS,emptyProfile,normalizeProfile,validateProfileShape,profileWarnings,mergeProfileSections} from '../public/profile-tags.mjs';
import {characterMessages,normalizeCharacter,characterResponseFormat,profileResponseFormat,profileSectionMessages,PROFILE_SCHEMA} from '../packages/ai/character-authoring.mjs';
import {createSheet,importCharacterSheet,applyCharacterSheet,validateCharacterSheets,SHEET_TABS,mountSheetEditor} from '../public/sheet-editor.mjs';
import {importCard,actorToCard,cardToActor} from '../packages/cards/character-card.mjs';

const ENUMS={archetype:ARCHETYPES,living:LIVING,formality:FORMALITY,humour:HUMOUR,directness:DIRECTNESS,teasing:TEASING,initiation:INITIATION,pace:PACE,unwelcome:UNWELCOME,space:SPACE};
const pack=()=>({gameProject:{premise:'A harbour-town mystery.',setting:'Ferries, fish markets and one very good bakery.'},locations:[{id:'dock'}],actors:[{id:'player',name:'You'},{id:'ana',name:'Ana',personality:'Warm gossip.'}]});
const validProfile={everyday:{living:'with-roommates',circle:['Roommate Nao, med student'],leisure:['sea swimming at dawn'],habits:['same bakery order for years'],concerns:['ferry fare rises in March']},persona:{archetype:'guarded-loner',public:'polished and brisk',private:'watches harbour lights and drafts texts she never sends',strengths:['reads rooms fast'],insecurities:['thinks she is only tolerated'],pride:'her charts are never wrong',contradictions:['lectures about honesty, hides her own setbacks']},voice:{formality:'polished',humour:'deadpan',directness:'plain',teasing:'gentle',vocabulary:'nautical metaphors'},romance:{shows:['saves seats, then denies it'],attractedBy:['people who argue honestly'],discouragedBy:['being teased in public'],initiation:'hints',pace:'slow',compliments:'deflects, replays them later',unwelcome:'guarded',close:'names small rituals and keeps them'},body:{posture:'straight-backed',tells:['straightens cuffs when caught out'],space:'arm-s-length',attention:'stops scanning the room'},scenes:{problems:['a coworker keeps claiming her catches'],shared:['night fishing'],invitations:['needs a second for the regatta'],unfinished:['owes Ana a rematch at cards']}};

test('profile vocabulary is closed, unique and fully described',()=>{
 for(const [name,def] of Object.entries(ENUMS)){
  assert.ok(def.values.length>=4,`${name}: at least 4 options`);
  assert.equal(new Set(def.values).size,def.values.length,`${name}: duplicate values`);
  for(const v of def.values)assert.equal(typeof def.desc[v],'string',`${name}: ${v} lacks a description`);
 }
 assert.deepEqual(PROFILE_SECTION_KEYS,['everyday','persona','voice','romance','body','scenes']);
 for(const s of PROFILE_SECTIONS)for(const [f,[kind]] of Object.entries(s.fields))if(kind==='enum')assert.ok(ENUMS[f],`${s.key}.${f}: enum missing from vocabulary`);
 for(const value of PROFILE_SCHEMA.properties.persona.properties.archetype.enum)assert.ok(ARCHETYPES.values.includes(value));
});

test('empty profiles normalize and invalid values are refused or clamped',()=>{
 assert.deepEqual(Object.keys(emptyProfile()),PROFILE_SECTION_KEYS);
 const p=normalizeProfile(validProfile);
 assert.equal(p.romance.initiation,'hints');assert.equal(p.persona.archetype,'guarded-loner');
 const sparse=normalizeProfile({persona:{archetype:'magnetic-flirt',contradictions:['a, b']}});
 assert.deepEqual(sparse.persona.contradictions,['a','b']);assert.equal(sparse.everyday.living,'');
 assert.throws(()=>normalizeProfile({voice:{formality:'shouty'}}),/formality/);
 assert.throws(()=>validateProfileShape({persona:{archetype:'nope'}},m=>{throw Error(m);}),/archetype/);
 const long={...validProfile,scenes:{problems:[Array(200).fill('x').join('')]}};
 assert.ok(normalizeProfile(long).scenes.problems[0].length<=160);
 assert.equal(normalizeProfile({everyday:{leisure:[1,2,3,4,5,6,7].map(String)}}).everyday.leisure.length,6);
});

test('contradiction flags are advisory and cite the exact clash',()=>{
 assert.deepEqual(profileWarnings(validProfile),[]);
 const flagged=normalizeProfile({persona:{archetype:'playful-tease'},voice:{teasing:'none',formality:'stiff',humour:'goofy'},romance:{initiation:'makes-moves',pace:'slow',unwelcome:'flustered'},body:{space:'untouchable'}});
 const keys=profileWarnings(flagged).map(w=>w.key);
 assert.ok(keys.includes('voice.teasing'));assert.ok(keys.includes('body.space'));assert.ok(keys.includes('voice.humour'));assert.ok(keys.includes('romance'));
});

test('section regeneration merges only the chosen sections and validates them',()=>{
 const base=normalizeProfile(validProfile);
 const patch=JSON.parse(JSON.stringify(base));patch.voice.formality='slangy';patch.voice.humour='goofy';patch.persona.archetype='broken-value';
 const merged=mergeProfileSections(base,patch,['voice']);
 assert.equal(merged.voice.formality,'slangy');assert.deepEqual(merged.voice,patch.voice);
 assert.equal(merged.persona.archetype,'guarded-loner');assert.deepEqual(merged.romance,base.romance);
 assert.throws(()=>mergeProfileSections(base,{voice:{formality:'nope'}},['voice']),/formality/);
 assert.deepEqual(mergeProfileSections(base,{},['voice']),base);
});

test('character generation leaves the deep profile to section regeneration and supports Japanese names',()=>{
 const r=characterMessages(pack(),'A guarded harbour pilot.'),u=r.messages[1].content;
 assert.match(r.messages[0].content,/academics, tech specialists, therapists/);assert.match(r.messages[0].content,/Aihara Yuki/);
 assert.doesNotMatch(u,/PROFILE VOCABULARY|EVERYDAY LIFE/);assert.ok(!r.schema.required.includes('profile'));
 const fmt=characterResponseFormat();assert.equal(fmt.json_schema.schema.properties.profile,undefined);
 const part=profileResponseFormat(['voice','romance']).json_schema.schema;
 assert.deepEqual(part.properties.profile.required,['voice','romance']);assert.ok(!part.properties.profile.properties.everyday);
 assert.equal(profileResponseFormat([]).json_schema.schema.properties.profile.required.length,6);
});

test('generated actors carry a normalized profile; legacy replies fall back to an empty one',()=>{
 const reply={name:'Serizawa Haruka',pronouns:'she/her',age:24,description:'Compact, salt-weathered jacket.',personality:'Polished, privately earnest.',behavior:{withStrangers:'a',withFriends:'b',withCrush:'c',withLover:'d',withEnemy:'e'},backstory:'b',goal:'g',traits:[],likes:['coffee'],dislikes:['pity'],voice:'v',style:'s',examples:['x'],conversationStarters:['y'],flaws:['f'],routine:['r'],year:'3',major:'Navigation',dorm:'dock',profile:validProfile};
 const actor=normalizeCharacter(reply,pack(),{location:'dock'});
 assert.equal(actor.profile.persona.archetype,'guarded-loner');assert.deepEqual(actor.profile.scenes.problems,['a coworker keeps claiming her catches']);
 const legacy=normalizeCharacter({...reply,profile:undefined},pack(),{location:'dock'});
 assert.deepEqual(legacy.profile,emptyProfile());
});

test('section regeneration prompt fixes identity and asks only for the selected sections',()=>{
 const actor={id:'haruka',name:'Haruka',pronouns:'she/her',age:24,goal:'Buy the bakery',behavior:{withStrangers:'a'},profile:normalizeProfile(validProfile)};
 const r=profileSectionMessages(pack(),actor,['romance','scenes'],'lean into the bakery debt');
 assert.match(r.messages[0].content,/ONLY these sections: romance, scenes/);
 assert.match(r.messages[1].content,/CURRENT PROFILE/);assert.match(r.messages[1].content,/AUTHOR NOTE/);assert.match(r.messages[1].content,/Buy the bakery/);
 assert.deepEqual(r.schema.properties.profile.required,['romance','scenes']);
 assert.throws(()=>profileSectionMessages(pack(),actor,['powers']),/No valid profile sections/);
});

test('sheets default, import, apply and validate the profile; legacy sheets stay valid',()=>{
 const p=pack();p.actors[1].traits=['warm','curious'];p.actors[1].profile=normalizeProfile(validProfile);
 const s=importCharacterSheet(p,'ana');
 assert.equal(s.profile.persona.archetype,'guarded-loner');
 assert.deepEqual(createSheet('a').profile,emptyProfile());
 const draft=importCharacterSheet({...p,actors:p.actors.map(a=>({...a,profile:undefined}))},'ana');
 assert.deepEqual(draft.profile,emptyProfile());
 assert.throws(()=>validateCharacterSheets({...p,characterSheets:[{...s,profile:{...s.profile,voice:{...s.profile.voice,formality:'shouty'}}}]}),/formality/);
 const before=JSON.stringify(p.actors);applyCharacterSheet(p,importCharacterSheet(p,'ana'));
 assert.equal(JSON.stringify(p.actors),before,'unchanged apply stays byte stable');
 draft.profile.voice.formality='casual';draft.profile.voice.humour='deadpan';applyCharacterSheet(p,draft);
 assert.equal(p.actors.find(a=>a.id==='ana').profile.voice.formality,'casual');
 const legacy=importCharacterSheet(p,'ana');delete legacy.profile;validateCharacterSheets({...p,characterSheets:[legacy]});
 assert.equal(SHEET_TABS.at(-1),'Deep profile');
});

test('card export and import round-trips the profile losslessly',()=>{
 const p=pack();p.actors[1].traits=['warm','curious'];p.actors[1].profile=normalizeProfile(validProfile);
 const card=actorToCard(p,'ana'),sf=card.data.extensions['story-framework'];
 assert.deepEqual(sf.profile,p.actors[1].profile);
 const {actor}=cardToActor(card,{...p,actors:p.actors.filter(a=>a.id!=='ana')},{id:'ana'});
 assert.deepEqual(actor.profile,normalizeProfile(validProfile));
});

class Element{constructor(tag,text=''){this.tag=tag;this.textContent=text;this.children=[];this.attrs={};this.value='';this.validation='';}
 append(...children){for(const c of children)c.parent=this;this.children.push(...children);}
 remove(){this.parent.children=this.parent.children.filter(c=>c!==this);}
 replaceChildren(...children){this.children=children;}
 setAttribute(k,v){this.attrs[k]=v;}
 setCustomValidity(v){this.validation=v;}
 checkValidity(){return !this.validation;}
 querySelectorAll(selector){return this.children.flatMap(c=>[...(selector.split(',').includes(c.tag)?[c]:[]),...c.querySelectorAll(selector)]);}}
test('the Deep profile tab edits tags, flags contradictions and regenerates single sections',async()=>{
 const previous=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
 try{
  const p={schemaVersion:1,id:'t',version:'0.1.0',title:'T',modules:{},playerId:'player',locations:[{id:'dock',name:'Dock',exits:[]}],actors:[{id:'player',name:'Player',location:'dock'},{id:'a',name:'Ari',location:'dock',traits:['warm','curious'],profile:normalizeProfile(validProfile)}]};
  let regenerated=null;
  const box=mountSheetEditor(new Element('div'),p,'a',()=>{},()=>{},{regenerate:async(sections,draft)=>{regenerated=sections;const patch=JSON.parse(JSON.stringify(draft.profile));patch.voice.humour='wordplay';return {profile:patch};}});
  const button=name=>box.querySelectorAll('button').find(b=>b.textContent===name),input=label=>box.querySelectorAll('label').find(l=>l.children[0]?.textContent===label)?.children[1];
  button('Deep profile').onclick();
  const text=box.querySelectorAll('small').map(e=>e.textContent).join(' ');
  for(const section of PROFILE_SECTIONS)assert.ok(text.includes(section.blurb),`${section.key}: blurb shown`);
  // Enum select: switch teasing to relentless
  const teasing=input('Teasing style');teasing.value='relentless';teasing.oninput();
  // Chip add on a line list
  const leisure=box.querySelectorAll('fieldset').find(f=>f.children[0]?.textContent.startsWith('Leisure interests'));
  const add=leisure.querySelectorAll('button').find(b=>b.textContent==='Add'),field=leisure.children[2];
  field.value='night markets';add.onclick();
  button('Apply sheet to draft').onclick();
  assert.equal(p.actors.find(a=>a.id==='a').profile.voice.teasing,'relentless');
  assert.ok(p.actors.find(a=>a.id==='a').profile.everyday.leisure.includes('night markets'));
  // Contradiction flag appears when the profile clashes
  const archetype=input('Broad archetype');archetype.value='playful-tease';archetype.oninput();
  const t2=input('Teasing style');t2.value='none';t2.oninput();
  assert.ok(box.querySelectorAll('p').some(e=>/keep only if the distance is the point/.test(e.textContent)));
  // Selective regeneration rewrites one section only
  button('Regenerate Voice').onclick();await new Promise(r=>setTimeout(r));
  assert.deepEqual(regenerated,['voice']);
  button('Apply sheet to draft').onclick();
  assert.equal(p.actors.find(a=>a.id==='a').profile.voice.humour,'wordplay');
  assert.equal(p.actors.find(a=>a.id==='a').profile.persona.archetype,'playful-tease','other sections preserved');
 }finally{globalThis.document=previous;}
});
