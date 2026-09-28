import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readCard} from '../packages/cards/character-card.mjs';
import {createWorld,actions,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {cardBrief,cardMembers,seedMessages,seedPack,seedSchema} from '../packages/cards/card-world.mjs';
import {normalizeCandidate,createProposal,applyProposal,messagesFor,normalizeLocations,tidyScenes,candidateSchema,roleName,stagesFor,withCandidate,joinCandidates,retryOnce,playability} from '../packages/ai/bulk-authoring.mjs';

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
 // The lenient repair drops an island (two places linked only to each other and an invented id) and keeps the rest.
 const drops=[],island=[{id:'dock',name:'Dock',description:'x',exits:['hub']},{id:'attic',name:'Attic',description:'y',exits:['loft','living-room']},{id:'loft',name:'Loft',description:'z',exits:['attic']}];
 assert.throws(()=>normalizeLocations(island,have,3),/attic.exits: not connected/);
 assert.deepEqual(normalizeLocations(island,have,3,drops).map(l=>l.id),['dock']);
 assert.deepEqual(drops,['locations attic: not connected to the rest of the map (unknown ids ignored: living-room)','locations loft: not connected to the rest of the map (unknown ids ignored: living-room)']);
});

test('bulk generation adds new places and timed events that land only when approved',()=>{
 const p=workshop(),raw={locations:[{id:'rooftop',name:'Rooftop',description:'Wind and city lights.',exits:['hub']}],characters:[],scenes:[],events:[{id:'meteor-night',name:'Meteor night',day:2,daypart:'Evening',location:'rooftop',character:'ada',attendedText:'Ada counts streaks with you.',missedRecap:'Ada mentions the meteors.'}]};
 const counts={locationCount:1,eventCount:1},c=normalizeCandidate(raw,p,counts);
 assert.deepEqual([c.events[0].startTick,c.events[0].endTick],[(3+2)*4,(3+2)*4+3]);
 assert.throws(()=>normalizeCandidate({...raw,events:[{...raw.events[0],daypart:'Night'}]},p,counts,{strict:true}),/daypart/);
 assert.throws(()=>normalizeCandidate({...raw,events:[{...raw.events[0],location:'moon'}]},p,counts,{strict:true}),/location: unknown/);
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
 assert.match(normalizeCandidate({...raw,scenes:[{...scene,trigger:{event:'player_opens_gift'}}]},p,{locationCount:2,sceneCount:1}).dropped[0],/trigger: use/);
 const sch=candidateSchema(p,{characterCount:1,sceneCount:1});assert.deepEqual(sch.properties.characters.items.properties.location.enum,p.locations.map(l=>l.id));assert.equal(sch.properties.characters.items.properties.backstory.minLength,1);assert.equal(sch.properties.scenes.items.properties.trigger.anyOf.length,2);
 assert.deepEqual(sch.properties.scenes.items.properties.choices.items.required,['id','label','result','effects']);
 const ch={id:'bo',name:'Bo',location:'hub',pronouns:'he/him',description:'An adult.',style:'Calm',goal:'Rest.',traits:['kind'],backstory:'Came here.',likes:['tea','',7,...'abcdefghij'],dislikes:[],voice:'Soft.'};
 assert.equal(normalizeCandidate({characters:[ch],scenes:[]},p,{characterCount:1,sceneCount:0}).characters[0].likes.length,8);
});

test('choices keep one unconditional way out; the schema drops when and pins speakers when no new people are asked for',()=>{
 const [s]=tidyScenes([{pages:[{text:'x'}],choices:[{label:'A',when:{flag:'f'}},{label:'B',when:{flag:'g'}}]}],[]);assert.deepEqual(s.choices.map(c=>'when' in c),[true,false]);
 assert.deepEqual(tidyScenes([{choices:[{label:'A',when:{flag:'f'}},{label:'B'}]}],[])[0].choices.map(c=>'when' in c),[true,false]);
 const p=workshop(),sc=candidateSchema(p,{sceneCount:1,eventCount:1}).properties,cast=p.actors.filter(a=>a.id!==p.playerId).map(a=>a.id);
 assert.equal(sc.scenes.items.properties.when,undefined);assert.equal(sc.scenes.items.properties.choices.items.properties.when,undefined);
 assert.deepEqual(sc.scenes.items.properties.pages.items.properties.speaker.enum,cast);assert.deepEqual(sc.events.items.properties.character.enum,cast);
 assert.equal(candidateSchema(p,{characterCount:1,sceneCount:1}).properties.scenes.items.properties.pages.items.properties.speaker.enum,undefined);
 assert.match(seedMessages({name:'Rumi & Mira',description:'x',first_mes:'Merry Christmas!'},{locationCount:3})[0].content,/set at the opening scene/);
});

test('role names are refused and a repair keeps the good entries, listing what it dropped',()=>{
 assert.ok(roleName('Security Guard'));assert.ok(roleName('the mysterious stranger'));assert.ok(roleName('Delivery Guy'));assert.ok(!roleName('Officer Kim'));assert.ok(!roleName('Dana Reyes'));
 const p=workshop(),ch=(id,name)=>({id,name,location:'hub',pronouns:'she/her',description:'An adult.',style:'Calm',goal:'Rest.',traits:['kind'],backstory:'Came here.',likes:[],dislikes:[],voice:'Soft.'});
 const scene=(id,speaker)=>({id,title:'S',opening:'O',trigger:{event:'core.inspected',match:{location:'hub'}},pages:[{speaker,text:'Hi.'}],stage:[],choices:[{id:'c',label:'Go',result:'You go.',effects:[]}]});
 const raw={characters:[ch('dana','Dana Reyes'),ch('guard','Security Guard')],scenes:[scene('ok','dana'),scene('bad','nobody-here')]},counts={characterCount:2,sceneCount:2};
 assert.throws(()=>normalizeCandidate(raw,p,counts,{strict:true}),/"Security Guard" is a role/);
 const c=normalizeCandidate(raw,p,counts);assert.deepEqual(c.characters.map(x=>x.id),['dana']);assert.deepEqual(c.scenes.map(x=>x.id),['ok']);
 assert.equal(c.dropped.length,2);assert.match(c.dropped[0],/^characters guard: .*role/);assert.match(c.dropped[1],/^scenes bad: scenes\[1\].*speaker/);
 assert.deepEqual(createProposal(p,c).dropped,c.dropped);assert.equal(createProposal(p,{...c,dropped:[]}).dropped,undefined);
 assert.throws(()=>normalizeCandidate({characters:[],scenes:[scene('bad','nobody-here')]},p,{sceneCount:1}),/Every entry failed/);
});

test('chatty pronouns keep their first standard set, a missing one is left out after the repair, and only the first scene at a place fires by itself; the rest are hand cards there',()=>{
 const p=workshop();p.scriptedScenes=[];const ch=(id,name,pronouns)=>({id,name,location:'hub',pronouns,description:'An adult.',style:'Calm',goal:'Rest.',traits:['kind'],backstory:'Came here.',likes:[],dislikes:[],voice:'Soft.'}),counts={characterCount:2,sceneCount:0};
 const raw={characters:[ch('dana','Dana Reyes','She/Her, though on stage she mostly goes by her band name'),ch('eli','Eli Park')],scenes:[]};
 assert.throws(()=>normalizeCandidate(raw,p,counts,{strict:true}),/pronouns/);
 const c=normalizeCandidate(raw,p,counts);assert.equal(c.characters[0].pronouns,'she/her');assert.ok(!('pronouns' in c.characters[1]));
 const scene=id=>({id,title:id,opening:'O',trigger:{event:'core.moved',match:{to:'hub'}},pages:[{text:'Hi.'}],stage:[],choices:[{id:'c',label:'Go',result:'You go.',effects:[]}]});
 const s=normalizeCandidate({characters:[],scenes:[scene('a'),scene('b'),scene('c')]},p,{sceneCount:3}).scenes;
 assert.deepEqual(s.map(x=>x.trigger),[{event:'core.moved',match:{to:'hub'}},{event:'story.handOffered',match:{}},{event:'story.handOffered',match:{}}]);
 assert.deepEqual(s.map(x=>[x.offer,x.when]),[[undefined,undefined],['hand',{location:'hub'}],['hand',{location:'hub'}]]);
 assert.equal(normalizeCandidate({characters:[],scenes:[scene('d')]},{...p,scriptedScenes:[s[0]]},{sceneCount:1}).scenes[0].offer,'hand','a place with an intro already gets hand cards');assert.deepEqual(playability({...p,scriptedScenes:s}),[]);validatePack({...p,scriptedScenes:s},registry);
});

test('a scene moves to where its unscheduled speakers stay, speakers who never meet fail it, and later scenes at a place are hand cards that play there',()=>{
 const p=JSON.parse(readFileSync(new URL('./fixtures/bulk-replies/huntrix.pack.json',import.meta.url),'utf8'));
 const scene=(id,to,...who)=>({id,title:id,opening:'O',trigger:{event:'core.moved',match:{to}},stage:[],pages:who.length?who.map(speaker=>({speaker,text:'Hi.'})):[{text:'Quiet.'}],choices:[{id:'c',label:'Go',result:'You go.',effects:[]}]});
 const raw={characters:[],scenes:[scene('a','backyard-porch','zoey'),scene('b','kitchen-bar','rumi','mira'),scene('c','main-party-room','zoey','rumi'),scene('d','kitchen-bar'),scene('e','kitchen-bar')]},counts={sceneCount:5};
 assert.throws(()=>normalizeCandidate(raw,p,counts,{strict:true}),/scenes\[2\]: its speakers stay in different places/);
 const c=normalizeCandidate(raw,p,counts);assert.deepEqual(c.scenes.map(x=>x.id),['a','b','d','e']);assert.match(c.dropped.join(),/scenes c: .*never meet/);
 assert.deepEqual(c.scenes.map(x=>x.trigger.match.to??x.trigger.match.location??x.when.location),['kitchen-bar','main-party-room','kitchen-bar','kitchen-bar']);
 assert.deepEqual(c.scenes.map(x=>x.offer),[undefined,undefined,'hand','hand']);
 const q=applyProposal(p,{...createProposal(p,c),scenes:c.scenes.map(value=>({status:'approved',value}))});assert.deepEqual(playability(q),[]);
 const at=(s,where)=>{const w=structuredClone(s);w.actors[q.playerId].location=where;return w;};
 let s=createWorld(q,registry,'hand');assert.ok(!actions(s,q,registry).some(a=>['d','e'].includes(a.args?.scene)),'not offered away from the kitchen bar');
 s=at(s,'kitchen-bar');assert.deepEqual(actions(s,q,registry).filter(a=>a.type==='story.startOfferedScene').map(a=>a.args.scene),['d','e'],'offered at the kitchen bar');
 p.schedules=[{actor:'zoey',period:12,stops:[{at:4,location:'backyard-porch'},{at:8,location:'kitchen-bar'}]}];assert.equal(normalizeCandidate({characters:[],scenes:[scene('a','backyard-porch','zoey')]},p,{sceneCount:1}).scenes[0].trigger.match.to,'backyard-porch');
});

test('staged generation splits places and people from scenes and events, then joins the parts',async()=>{
 assert.deepEqual(stagesFor({locationCount:1,characterCount:2,sceneCount:3,eventCount:0}),[{locationCount:1,characterCount:2},{sceneCount:3,eventCount:0}]);
 assert.deepEqual(stagesFor({sceneCount:3}),[{sceneCount:3}]);assert.deepEqual(stagesFor({characterCount:2}),[{characterCount:2}]);
 const p=workshop(),bo={id:'bo',name:'Bo',location:'hub'},next=withCandidate(p,{characters:[bo]});assert.ok(next.actors.some(a=>a.id==='bo'));
 assert.ok(candidateSchema(next,{sceneCount:1}).properties.scenes.items.properties.pages.items.properties.speaker.enum.includes('bo'));
 const j=joinCandidates({characters:[bo],skipped:['x']},{scenes:[{id:'s'}],dropped:['y']});assert.deepEqual([j.characters.length,j.scenes.length,j.events.length,j.skipped,j.dropped],[1,1,0,['x'],['y']]);
 let n=0,logged=0;assert.equal(await retryOnce(async()=>{if(!n++)throw TypeError('terminated');return 'ok';},()=>logged++,1),'ok');assert.equal(logged,1);
 n=0;await assert.rejects(retryOnce(async()=>{n++;throw Error('AI request failed (400): bad');},()=>{},1),/400/);assert.equal(n,1);
 n=0;await assert.rejects(retryOnce(async()=>{n++;throw Error('AI request failed (503): busy');},()=>{},1),/503/);assert.equal(n,2);
});

test('playability flags unreachable places, back-to-back and sticky scenes, absent speakers and unattendable or clashing events',()=>{
 const p=JSON.parse(readFileSync(new URL('./fixtures/bulk-replies/huntrix.pack.json',import.meta.url),'utf8'));assert.deepEqual(playability(p),[]);
 p.locations.push({id:'roof',name:'Roof',description:'Cold.',exits:[]});
 const at=(id,where,extra={})=>({id,title:id,trigger:{event:'core.moved',match:{to:where}},pages:[{text:'Hi.',speaker:'zoey'}],choices:[{id:'ok',label:'Ok',result:'Ok.'}],...extra});
 p.scriptedScenes=[at('a','roof'),at('b','kitchen-bar'),at('c','kitchen-bar',{choices:[{id:'x',label:'X',result:'X.',when:{flag:'f'}}]}),at('d','main-party-room'),at('e','backyard-porch',{stage:['show:zoey']})];
 p.timedEvents=[{id:'show',character:'rumi',location:'main-party-room',startTick:10,endTick:12},{id:'toast',character:'mira',location:'kitchen-bar',startTick:11,endTick:13}];
 const w=playability(p).join('\n');
 assert.match(w,/scene a: Roof cannot be reached/);assert.match(w,/scene c: same trigger as b/);assert.match(w,/scene c: every choice has a condition/);
 assert.match(w,/scene d: zoey speaks but stays at .*never plays \(move the scene there or give zoey a schedule\)/);assert.match(w,/scene e: zoey speaks/,'show: only draws her');assert.doesNotMatch(w,/scene b: zoey speaks/);
 assert.match(w,/event toast: mira stays at .* never comes to/);assert.match(w,/event toast: overlaps show in another place/);assert.doesNotMatch(w,/event show: rumi stays/);
 p.schedules=[{actor:'mira'}];assert.doesNotMatch(playability(p).join('\n'),/mira stays/);
});

test('scene choices keep only memory, trust and flag effects; the schema offers trust only with relationships',()=>{
 const p=JSON.parse(readFileSync(new URL('./fixtures/bulk-replies/huntrix.pack.json',import.meta.url),'utf8'));
 const [s]=tidyScenes([{id:'s',pages:[{text:'Hi.'}],choices:[{id:'a',label:'A',result:'A.',effects:[{type:'memory',character:'rumi',text:'Met.'},{type:'money',delta:5},{type:'trust',character:'rumi',delta:2},{type:'flag',id:'Met Rumi!',value:true}]}]}],p.actors.filter(a=>a.id!=='player'));
 assert.deepEqual(s.choices[0].effects.map(e=>e.id||e.type),['memory','trust','met-rumi']);
 const types=q=>candidateSchema(q,{sceneCount:1}).properties.scenes.items.properties.choices.items.properties.effects.items.anyOf.map(x=>x.properties.type.enum[0]);
 assert.ok(types(p).includes('trust'));const {['social.relationships']:_,...rest}=p.modules;assert.ok(!types({...p,modules:rest}).includes('trust'));
});

test('a skipped variant copy ("Rumi (Christmas Edition)") aliases to the original and an unknown speaker is narrated when lenient',()=>{
 const p=JSON.parse(readFileSync(new URL('./fixtures/bulk-replies/huntrix.pack.json',import.meta.url),'utf8')),counts={characterCount:1,sceneCount:1};
 const raw=JSON.stringify({characters:[{id:'rumi-xmas',name:'Rumi (Christmas Edition)'}],scenes:[{id:'s',title:'S',opening:'Music.',trigger:{event:'core.moved',match:{to:'main-party-room'}},stage:['show:Rumi-Xmas'],pages:[{text:'We sing!',speaker:'HUNTR/X'},{text:'Hi.',speaker:'Rumi-xmas'}],choices:[{id:'a',label:'A',result:'A.'}]}]});
 assert.throws(()=>normalizeCandidate(raw,p,counts,{strict:true}),/already exist/);
 const got=normalizeCandidate(raw,p,counts);assert.deepEqual(got.skipped,['characters: rumi-xmas']);assert.equal(got.characters.length,0);
 assert.deepEqual(got.scenes[0].stage,['show:rumi']);assert.deepEqual(got.scenes[0].pages.map(x=>[x.speaker,x.text]),[[undefined,'HUNTR/X: We sing!'],['rumi','Hi.']]);
 const prop=createProposal(p,{...got,warnings:['w']});assert.deepEqual(prop.warnings,['w']);assert.equal(createProposal(p,got).warnings,undefined);
});

test('generated role templates bake into hand cards per casting at the cast\'s home, castings that never meet are left out, and the hand shows one card per template',()=>{
 const p=JSON.parse(readFileSync(new URL('./fixtures/bulk-replies/huntrix.pack.json',import.meta.url),'utf8')),go=[{id:'go',label:'Go',result:'You go.',effects:[{type:'trust',character:'rival',delta:1}]}];
 const tpl=(id,roles,pages,extra={})=>({id,title:'T',roles,opening:'{Rival.they} waves.',pages,choices:go,...extra});
 const raw={characters:[],scenes:[],templates:[tpl('rivalry',['Rival'],[{speaker:'Rival',text:'Keep up.'},{speaker:'@rival',text:'{rival} grins.'}]),tpl('duet',['rival','foil'],[{speaker:'@foil',text:'{foil.they} hums along with {rival}.'}]),tpl('crowd',['rival','foil'],[{speaker:'zoey',text:'Hi.'}]),tpl('boss',['rival'],[{text:'{boss} arrives.'}])]},counts={templateCount:4};
 assert.throws(()=>normalizeCandidate(raw,p,counts,{strict:true}),/templates\[2\]: no two people in the cast can play it/);
 const c=normalizeCandidate(raw,p,counts);assert.deepEqual(c.templates.map(t=>t.id),['rivalry','duet']);assert.match(c.dropped.join(),/"\{boss\}" is not a role placeholder/);
 assert.deepEqual(c.templates[0].pages.map(x=>x.speaker),['@rival','@rival']);assert.equal(c.templates[0].choices[0].effects[0].character,'@rival');assert.deepEqual(c.templates[0].roles,{rival:{pool:'cast'}});
 const q=applyProposal(p,{...createProposal(p,c),templates:c.templates.map(value=>({status:'approved',value}))}),hand=q.scriptedScenes.filter(x=>x.template);
 assert.deepEqual(hand.map(x=>[x.id,x.when.location]),[['rivalry.rumi','main-party-room'],['rivalry.mira','main-party-room'],['rivalry.zoey','kitchen-bar'],['duet.rumi.mira','main-party-room'],['duet.mira.rumi','main-party-room']]);
 assert.equal(hand[3].pages[0].text,'they hums along with Rumi.');assert.deepEqual(hand[3].stage,['show:rumi','show:mira']);assert.deepEqual(playability(q),[]);
 const s=createWorld(q,registry,'tpl');s.actors[q.playerId].location='main-party-room';
 assert.deepEqual(actions(s,q,registry).filter(a=>a.type==='story.startOfferedScene').map(a=>a.args.scene),['rivalry.rumi','duet.rumi.mira'],'one card per template');
 s.actors[q.playerId].location='kitchen-bar';assert.deepEqual(actions(s,q,registry).filter(a=>a.type==='story.startOfferedScene').map(a=>a.args.scene),['rivalry.zoey']);
 assert.equal(candidateSchema(p,counts).properties.templates.minItems,4);assert.equal(candidateSchema(p,{sceneCount:1}).properties.templates,undefined);
 assert.deepEqual(stagesFor({characterCount:1,templateCount:2}),[{characterCount:1},{sceneCount:0,eventCount:0,templateCount:2}]);
 assert.match(messagesFor(p,'b',counts)[0].content,/"templates":\[\]/);assert.doesNotMatch(messagesFor(p,'b',{sceneCount:1})[0].content,/templates/);
});

test('a one-role template written with the literal {role} means its role; a short or missing array only fails the strict attempt',()=>{
 const p=JSON.parse(readFileSync(new URL('./fixtures/bulk-replies/huntrix.pack.json',import.meta.url),'utf8')),go=[{id:'go',label:'Go',result:'{Role.they} laughs.',effects:[{type:'trust',character:'@role',delta:1}]}];
 const one={id:'dare',title:'Dare',roles:['friend'],opening:'{role} leans in.',pages:[{speaker:'@role',text:'{Role.they} dares you.'}],choices:go},two={...one,id:'pair',roles:['friend','foil']};
 const c=normalizeCandidate({characters:[],scenes:[],templates:[one,two]},p,{templateCount:2});assert.deepEqual(c.templates.map(t=>t.id),['dare']);assert.match(c.dropped.join(),/"\{role\}" is not a role placeholder/);
 const t=c.templates[0];assert.deepEqual([t.opening,t.pages[0].speaker,t.pages[0].text,t.choices[0].result,t.choices[0].effects[0].character],['{friend} leans in.','@friend','{Friend.they} dares you.','{Friend.they} laughs.','@friend']);
 const scene={id:'hi',title:'Hi',opening:'Rumi waves.',trigger:{event:'core.moved',match:{to:'main-party-room'}},pages:[{speaker:'rumi',text:'Hi.'}],choices:[{id:'ok',label:'Wave',result:'You wave.',effects:[]}]};
 assert.throws(()=>normalizeCandidate({characters:[],scenes:[scene]},p,{sceneCount:1,templateCount:2},{strict:true}),/needs characters, scenes and templates arrays/);
 assert.throws(()=>normalizeCandidate({scenes:[scene],templates:[]},p,{sceneCount:2,templateCount:1},{strict:true}),/returned 1 scenes; expected 2/);
 const d=normalizeCandidate({scenes:[scene]},p,{sceneCount:2,templateCount:1});assert.deepEqual(d.scenes.map(x=>x.id),['hi']);assert.deepEqual(d.dropped.slice(0,2),['scenes: wrote 1 of 2','templates: wrote 0 of 1']);
 assert.throws(()=>normalizeCandidate({scenes:[scene,scene,scene]},p,{sceneCount:2}),/returned 3 scenes; expected 2/);
});
