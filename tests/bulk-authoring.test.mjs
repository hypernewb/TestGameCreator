import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeCandidate,createProposal,applyProposal,withCandidate} from '../packages/ai/bulk-authoring.mjs';

const pack=()=>JSON.parse(readFileSync(new URL('../packs/activity-workshop.json',import.meta.url),'utf8'));
const character={id:'mira',name:'Mira',location:'hub',pronouns:'she/her',description:'An adult curator.',style:'Careful',goal:'Prepare the show.',traits:['patient'],backstory:'She came to organize the collection.',likes:['clarity'],dislikes:['waste'],voice:'Quiet, exact sentences.'};
const scene={id:'mira-arrives',title:'Mira arrives',opening:'Mira examines the room.',trigger:{event:'core.inspected',match:{location:'hub'}},when:{location:'hub'},pages:[{speaker:'mira',text:'This will need a careful hand.',stage:['show:mira']}],choices:[{id:'offer-help',label:'Offer to help',result:'Mira accepts the offer.',effects:[{type:'memory',character:'mira',text:'The player offered to help with the collection.'}]},{id:'step-back',label:'Give her room',result:'You give Mira room to work.',effects:[]}]};

test('normalizes and validates a generated batch',()=>{const p=pack(),candidate=normalizeCandidate({characters:[character],scenes:[scene]},p,{characterCount:1,sceneCount:1});assert.equal(candidate.characters[0].id,'mira');assert.equal(candidate.scenes[0].id,'mira-arrives');});
test('applies only approved entries and validates the result',()=>{const p=pack(),candidate=normalizeCandidate({characters:[character],scenes:[scene]},p,{characterCount:1,sceneCount:1}),proposal=createProposal(p,candidate);proposal.scenes[0].status='approved';assert.throws(()=>applyProposal(p,proposal),/speaker: unknown/);proposal.characters[0].status='approved';const result=applyProposal(p,proposal);assert(result.actors.some(x=>x.id==='mira'));assert(result.scriptedScenes.some(x=>x.id==='mira-arrives'));});
test('rejects a stale proposal',()=>{const p=pack(),candidate=normalizeCandidate({characters:[character],scenes:[]},p,{characterCount:1,sceneCount:0}),proposal=createProposal(p,candidate);p.subtitle='Edited after generation';assert.throws(()=>applyProposal(p,proposal),/source pack changed/);});
test('skips copies of existing characters and rejects duplicate generated IDs',()=>{const c=normalizeCandidate({characters:[{...character,id:'ada'}],scenes:[]},pack(),{characterCount:1,sceneCount:0});assert.deepEqual([c.characters.length,c.skipped],[0,['characters: ada']]);assert.throws(()=>normalizeCandidate({characters:[character,character],scenes:[]},pack(),{characterCount:2,sceneCount:0},{strict:true}),/"mira" already exists/);const d=normalizeCandidate({characters:[character,character],scenes:[]},pack(),{characterCount:2,sceneCount:0});assert.equal(d.characters.length,1);assert.match(d.dropped[0],/"mira" already exists/);});

test('world population drafts objects, seed-placed hidden finds and stat activities for review before publish',async()=>{
 const {createWorld}=await import('../packages/core/engine.mjs'),{registry}=await import('../packages/modules/index.mjs'),{messagesFor}=await import('../packages/ai/bulk-authoring.mjs');
 const p=JSON.parse(readFileSync(new URL('../packs/after-hours.json',import.meta.url),'utf8')),counts={objectCount:2,itemCount:1,activityCount:1};
 const world={objects:[{id:'cellar-door',name:'the cellar door',location:'bar',description:'Padlocked, cold, humming faintly.',effectFlag:'cellar-open',useText:'The padlock gives. Stairs, dark, a smell of old beer and older secrets.',requiresItem:'cellar-key'},{id:'bike-rack',name:'the bike rack',location:'canal',description:'Six bikes, four wheels between them.'}],
  items:[{id:'cellar-key',name:'Cellar key',description:'Iron, heavy, labelled CELLAR in biro.',hideIn:['bike-rack','photo-wall']}],
  activities:[{id:'cellar-tasting',name:'Taste the cellar stock',description:'Juno teaches you what each barrel is for.',location:'bar',duration:2,phrases:['cellar','tasting'],effects:[{type:'stat',stat:'wit',delta:1}],requiresFlag:'cellar-open'}]};
 const c=normalizeCandidate(JSON.stringify(world),p,counts);assert.equal(c.items[0].hidden,true);assert.deepEqual(c.characters,[]);
 const proposal=createProposal(p,c,{counts});assert.ok(proposal.objects.every(x=>x.status==='pending'));
 assert.equal(applyProposal(p,proposal).objects.length,p.objects.length,'nothing lands until approved');
 for(const k of ['objects','items','activities'])for(const x of proposal[k])x.status='approved';
 const next=applyProposal(p,proposal),spots=new Set(Array.from({length:12},(_,n)=>createWorld(next,registry,'s'+n,n*2654435761).modules['world.objects'].stash['cellar-key']));
 assert.deepEqual([...spots].sort(),['bike-rack','photo-wall'],'the key moves between its candidate spots across new games');
 const bad=(patch,re)=>assert.throws(()=>normalizeCandidate(JSON.stringify({...world,...patch}),p,counts),re);
 bad({items:[{...world.items[0],hideIn:['cellar-door']}]},/cannot hide inside the object it unlocks/);
 bad({items:[{...world.items[0],hideIn:['nowhere']}]},/hideIn/);
 bad({activities:[{...world.activities[0],effects:[{type:'stat',stat:'wit',delta:9}]}]},/effects/);
 bad({activities:[{...world.activities[0],effects:[{type:'stat',stat:'strength',delta:1}]}]},/effects/);
 bad({objects:[{...world.objects[0],location:'moon'},world.objects[1]]},/location/);
 bad({objects:[{...world.objects[0],id:'jukebox'},world.objects[1]]},/already used/);
 assert.match(messagesFor(p,'brief',counts)[0].content,/hideIn/);assert.doesNotMatch(messagesFor(p,'brief',{characterCount:1,sceneCount:0})[0].content,/hideIn/,'the extra schema costs no tokens unless asked for');
});
test('a strict first attempt rejects copies of existing characters so the repair can ask for new ones',()=>{assert.throws(()=>normalizeCandidate({characters:[{...character,id:'ada'}],scenes:[]},pack(),{characterCount:1,sceneCount:0},{strict:true}),/ada already exists; characters\[\] and locations\[\] hold only NEW/);});

test('generated scenes keep reasoned chemistry for dating characters and turn checks into code-owned targets',async()=>{
 const {routeFrame}=await import('../packages/cards/route-skeleton.mjs'),{tidyScenes,candidateSchema,messagesFor}=await import('../packages/ai/bulk-authoring.mjs'),{validatePack}=await import('../packages/core/engine.mjs'),{registry}=await import('../packages/modules/index.mjs');
 const card=JSON.parse(readFileSync(new URL('./fixtures/bulk-replies/huntrix.pack.json',import.meta.url),'utf8')),f=routeFrame(card,{route:'rumi'});
 const dare={id:'rumi-dare',title:'A dare',opening:'Rumi hands you the mic.',trigger:{event:'core.inspected',match:{location:'main-party-room'}},pages:[{speaker:'rumi',text:'Your turn.'}],choices:[
  {label:'Sing',check:{stat:'Nerve',difficulty:'hard',fail:'Your voice cracks; she grins anyway.'},effects:[{type:'chemistry',character:'Rumi',delta:9,reason:'you sang for her'},{type:'chemistry',character:'rumi',delta:2},{type:'chemistry',character:'zoey',delta:2,reason:'you sang'}]},
  {label:'Joke',check:{stat:'luck',fail:'Nothing.'}},{label:'Pass',check:{stat:'wit'}}]};
 const [x]=tidyScenes([structuredClone(dare)],f.actors,f.actors.find(a=>a.id===f.playerId),f);
 assert.deepEqual(x.choices[0].check,{stat:'nerve',target:8,fail:{result:'Your voice cracks; she grins anyway.'}});
 assert.deepEqual(x.choices[0].effects,[{type:'chemistry',character:'rumi',delta:5,reason:'you sang for her'}]);
 assert.deepEqual(x.choices.slice(1).map(c=>'check' in c),[false,false],'unknown stat or no fail text: the check goes, the choice stays');
 const [plain]=tidyScenes([structuredClone(dare)],card.actors,{},undefined);assert.deepEqual([plain.choices[0].check.stat,plain.choices[0].effects.length],['Nerve',0],'no pack: checks untouched, chemistry dropped');
 const c=normalizeCandidate({characters:[],scenes:[dare]},f,{sceneCount:1});assert.equal(c.scenes.length,1,JSON.stringify(c.skipped));validatePack(withCandidate(f,c),registry);
 const has=(p,re)=>re.test(JSON.stringify(candidateSchema(p,{sceneCount:1})))&&re.test(messagesFor(p,'brief',{sceneCount:1}).map(m=>m.content).join());
 assert.ok(has(f,/chemistry/)&&has(f,/difficulty/));assert.ok(!has(card,/chemistry/)&&!has(card,/difficulty/),'offered only when the modules exist');
});
