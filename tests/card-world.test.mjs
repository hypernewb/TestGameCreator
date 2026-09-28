import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readCard} from '../packages/cards/character-card.mjs';
import {cardBrief,cardMembers,seedMessages,seedPack,seedSchema} from '../packages/cards/card-world.mjs';
import {normalizeCandidate,createProposal,applyProposal,messagesFor,normalizeLocations,tidyScenes,candidateSchema} from '../packages/ai/bulk-authoring.mjs';

const janitor={name:'Mara',personality:'{{char}} runs the lighthouse and distrusts {{user}}.',description:'<p>A moody <b>keeper</b>&nbsp;&amp; storm-watcher.</p>',scenario:'Storm season on Gull Island.',first_message:'*{{char}} bars the door.* Who sent you?',example_dialogs:'{{char}}: Go away.',tags:[{name:'Mystery'},'Slow burn']};
const pyg={char_name:'Otto',char_persona:'{{char}} fixes boats.',world_scenario:'A cold harbor.',char_greeting:'Hand me that wrench.',example_dialogue:'Otto: Hm.'};
const map={title:'Gull Island',premise:'You arrive as the new relief keeper.',setting:'A storm-lashed island in autumn.',writingStyle:'Moody, terse.',locations:[{id:'lighthouse',name:'Lighthouse',description:'A cold tower.',exits:['harbor']},{id:'harbor',name:'Harbor',description:'Boats knock together.',exits:[]},{id:'chapel',name:'Chapel',description:'Salt-stained pews.',exits:['harbor']}],characterLocation:'lighthouse',playerLocation:'harbor'};
const workshop=()=>{const p=JSON.parse(readFileSync(new URL('../packs/activity-workshop.json',import.meta.url),'utf8'));p.modules['story.timed-events']='0.1.0';return p;};

test('JanitorAI and Pygmalion exports normalize to V2 fields',()=>{
 const j=readCard(JSON.stringify(janitor)).data;assert.equal(j.description,janitor.personality);assert.equal(j.first_mes,janitor.first_message);assert.equal(j.mes_example,janitor.example_dialogs);assert.equal(j.creator_notes,'A moody keeper & storm-watcher.');assert.deepEqual(j.tags,['Mystery','Slow burn']);
 assert.equal(readCard({character:janitor}).data.name,'Mara');
 const o=readCard(pyg).data;assert.equal(o.name,'Otto');assert.equal(o.description,'{{char}} fixes boats.');assert.equal(o.scenario,'A cold harbor.');assert.equal(o.first_mes,'Hand me that wrench.');
});

test('card brief resolves macros, strips HTML and skips example dialogue',()=>{
 const b=cardBrief(janitor);assert.match(b,/Mara runs the lighthouse and distrusts the player/);assert.match(b,/Mara bars the door/);assert.doesNotMatch(b,/\{\{|<p>|Go away/);assert.match(b,/not in the project yet/);
 const {pack}=seedPack(map,janitor,{locationCount:3});assert.match(cardBrief(janitor,{pack}),/already exists as character id "mara"/);
 assert.match(seedMessages(janitor,{locationCount:3},'bad exits')[0].content,/exactly 3[\s\S]*bad exits/);
});

test('seeding builds a valid pack with a two-way map and the card placed',()=>{
 const {pack,actorId}=seedPack(JSON.stringify(map),janitor,{locationCount:3});
 assert.equal(pack.id,'card.mara');assert.equal(actorId,'mara');assert.equal(pack.actors.find(a=>a.id==='mara').location,'lighthouse');assert.equal(pack.actors.find(a=>a.id==='player').location,'harbor');assert.equal(pack.startOptions[0].playerLocation,'harbor');
 assert.deepEqual(pack.locations.find(l=>l.id==='harbor').exits.map(e=>e.to).sort(),['chapel','lighthouse']);assert.ok(pack.modules['story.timed-events']);
 assert.throws(()=>seedPack({...map,characterLocation:'moon'},janitor,{locationCount:3}),/characterLocation/);
 assert.throws(()=>seedPack(map,janitor,{locationCount:4}),/expected 4/);
 assert.throws(()=>seedPack({...map,locations:[...map.locations.slice(0,2),{...map.locations[2],exits:[]}]},janitor,{locationCount:3}),/chapel.exits: not connected/);
});

test('generated locations must connect to the existing map and use known ids',()=>{
 const have=[{id:'hub'}];
 assert.throws(()=>normalizeLocations([{id:'dock',name:'Dock',description:'x',exits:['nowhere']}],have,1),/exits/);
 assert.throws(()=>normalizeLocations([{id:'dock',name:'Dock',description:'x',exits:[]}],have,1),/not connected/);
 assert.throws(()=>normalizeLocations([{id:'hub',name:'Hub',description:'x',exits:[]}],have,1),/"hub" already exists/);
 assert.equal(normalizeLocations([{id:'dock',name:'Dock',description:'x',exits:['pier']},{id:'pier',name:'Pier',description:'y',exits:['hub']}],have,2).length,2);
});

test('bulk generation adds new places and timed events that land only when approved',()=>{
 const p=workshop(),raw={locations:[{id:'rooftop',name:'Rooftop',description:'Wind and city lights.',exits:['hub']}],characters:[],scenes:[],events:[{id:'meteor-night',name:'Meteor night',day:2,daypart:'Evening',location:'rooftop',character:'ada',attendedText:'Ada counts streaks with you.',missedRecap:'Ada mentions the meteors.'}]};
 const counts={locationCount:1,eventCount:1},c=normalizeCandidate(raw,p,counts);
 assert.deepEqual([c.events[0].startTick,c.events[0].endTick],[(3+2)*4,(3+2)*4+3]);
 assert.throws(()=>normalizeCandidate({...raw,events:[{...raw.events[0],daypart:'Night'}]},p,counts),/daypart/);
 assert.throws(()=>normalizeCandidate({...raw,events:[{...raw.events[0],location:'moon'}]},p,counts),/location: unknown/);
 assert.match(messagesFor(p,'brief',counts)[0].content,/"locations":\[\][\s\S]*"events":\[\]|"events":\[\][\s\S]*"locations":\[\]/);
 const proposal=createProposal(p,c);assert.equal(applyProposal(p,proposal).locations.length,p.locations.length);
 proposal.events[0].status='approved';assert.throws(()=>applyProposal(p,proposal),/location invalid/);
 proposal.locations[0].status='approved';const next=applyProposal(p,proposal);
 assert.ok(next.locations.find(l=>l.id==='hub').exits.some(e=>e.to==='rooftop'));assert.equal(next.timedEvents[0].id,'meteor-night');
});

test('group cards become one actor per member sharing the lore; missing prose falls back to card text',()=>{
 assert.deepEqual(cardMembers('Rumi & Mira & Zoey'),['Rumi','Mira','Zoey']);assert.deepEqual(cardMembers('Ann, Bea and Cy'),['Ann','Bea','Cy']);assert.deepEqual(cardMembers('Mara'),[]);assert.deepEqual(cardMembers('the night & the rain'),[]);
 const trio={name:'Rumi & Mira',description:'Two singers.',scenario:'A Halloween party.\n\nMore.',first_mes:'*Snow falls.* Merry Christmas!',tags:['🎄 Christmas','Female','Any POV','christmas'],character_book:{entries:[{keys:['stage'],content:'They sing.'}]}};
 assert.match(cardBrief(trio),/Tags: christmas\n/i);assert.ok(cardBrief(trio).indexOf('Opening scenes')<cardBrief(trio).indexOf('Scenario'));assert.match(seedMessages(trio,{locationCount:3})[1].content,/THE GAME STARTS HERE[\s\S]*Merry Christmas/);
 const {title,premise,setting,...rest}=map,{pack,actorIds}=seedPack({...rest,members:[{name:'mira',description:'Sharp.',location:'harbor'},{name:'Rumi',description:'Warm.'}]},trio,{locationCount:3});
 assert.deepEqual(actorIds,['rumi','mira']);assert.equal(pack.actors.find(a=>a.id==='rumi').location,'lighthouse');assert.equal(pack.actors.find(a=>a.id==='mira').location,'harbor');
 assert.equal(pack.title,'Rumi & Mira');assert.equal(pack.gameProject.premise,'A Halloween party.');assert.deepEqual(pack.lorebook[0].knownBy.sort(),['mira','rumi']);
 assert.throws(()=>seedPack({...map,members:[{name:'Rumi',description:'x',location:'harbor'}]},trio,{locationCount:3}),/exactly 2/);
 const sch=seedSchema(trio,{locationCount:3});assert.deepEqual([sch.properties.locations.minItems,sch.properties.members.maxItems],[3,2]);assert.deepEqual(sch.properties.members.items.properties.name.enum,['Rumi','Mira']);
});

test('generated scenes are tidied: names become ids, prose and player lines leave the speaker slot, stage cues become actions',()=>{
 const cast=[{id:'rumi',name:'Rumi Kim'},{id:'mira',name:'Mira'}],[s]=tidyScenes([{id:'x',stage:[{characterId:'Rumi',action:'waves'},'show:mira','Rumi steps closer.','hide:nobody'],pages:[{speaker:'You',text:'Hi!'},{speaker:'Rumi',text:'Hey.',stage:['show:Mira']},{speaker:'*She laughs softly*',text:'Welcome.'},{speaker:'',text:'Snow.'}]}],cast,{id:'player',name:'You'});
 assert.deepEqual(s.stage,['show:rumi','show:mira']);assert.deepEqual(s.pages,[{speaker:'rumi',text:'Hey.',stage:['show:mira']},{text:'*She laughs softly*\nWelcome.'},{text:'Snow.'}]);
 assert.equal(tidyScenes([{pages:[{speaker:'you',text:'Only me.'}]}],cast)[0].pages.length,1);
 const [j]=tidyScenes([{pages:[{speaker:'Rumi & Mira',text:'Hi!'}],choices:[{label:'Wave back!'},{id:'',label:'Wave back!'},{label:''}]}],cast);
 assert.deepEqual(j.pages,[{text:'Rumi & Mira\nHi!'}]);assert.deepEqual(j.choices.map(c=>c.id),['wave-back','wave-back-2','choice-3']);
});

test('generated batches resolve loose ids, drop invented exits, skip copies and need real scene triggers',()=>{
 const p=workshop(),hub=p.locations.find(l=>l.id==='hub'),scene={id:'s',title:'S',opening:'O',trigger:{event:'core.moved',match:{to:'Roof Top'}},pages:[{text:'Wind.'}],stage:[],choices:[{id:'c',label:'Go',result:'You go.',effects:[]}]};
 const raw={locations:[{id:'rooftop',name:'Roof Top',description:'Wind.',exits:[hub.name.toUpperCase(),'secret-tunnel']},{id:'hub',name:'Hub',description:'Again.',exits:[]}],characters:[],scenes:[scene]};
 const c=normalizeCandidate(raw,p,{locationCount:2,sceneCount:1});assert.deepEqual(c.locations[0].exits,[{to:'hub'}]);assert.deepEqual(c.skipped,['locations: hub']);assert.equal(c.scenes[0].trigger.match.to,'rooftop');
 assert.throws(()=>normalizeCandidate({...raw,scenes:[{...scene,trigger:{event:'player_opens_gift'}}]},p,{locationCount:2,sceneCount:1}),/trigger: use/);
 const sch=candidateSchema(p,{characterCount:1,sceneCount:1});assert.deepEqual(sch.properties.characters.items.properties.location.enum,p.locations.map(l=>l.id));assert.equal(sch.properties.characters.items.properties.backstory.minLength,1);assert.equal(sch.properties.scenes.items.properties.trigger.anyOf.length,2);
 assert.deepEqual(sch.properties.scenes.items.properties.choices.items.required,['id','label','result','effects']);
 const ch={id:'bo',name:'Bo',location:'hub',pronouns:'he/him',description:'An adult.',style:'Calm',goal:'Rest.',traits:['kind'],backstory:'Came here.',likes:['tea','',7,...'abcdefghij'],dislikes:[],voice:'Soft.'};
 assert.equal(normalizeCandidate({characters:[ch],scenes:[]},p,{characterCount:1,sceneCount:0}).characters[0].likes.length,8);
});
