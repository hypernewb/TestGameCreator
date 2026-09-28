import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeCandidate,createProposal,applyProposal} from '../packages/ai/bulk-authoring.mjs';

const pack=()=>JSON.parse(readFileSync(new URL('../packs/activity-workshop.json',import.meta.url),'utf8'));
const character={id:'mira',name:'Mira',location:'hub',pronouns:'she/her',description:'An adult curator.',style:'Careful',goal:'Prepare the show.',traits:['patient'],backstory:'She came to organize the collection.',likes:['clarity'],dislikes:['waste'],voice:'Quiet, exact sentences.'};
const scene={id:'mira-arrives',title:'Mira arrives',opening:'Mira examines the room.',trigger:{event:'core.inspected',match:{location:'hub'}},when:{location:'hub'},pages:[{speaker:'mira',text:'This will need a careful hand.',stage:['show:mira']}],choices:[{id:'offer-help',label:'Offer to help',result:'Mira accepts the offer.',effects:[{type:'memory',character:'mira',text:'The player offered to help with the collection.'}]},{id:'step-back',label:'Give her room',result:'You give Mira room to work.',effects:[]}]};

test('normalizes and validates a generated batch',()=>{const p=pack(),candidate=normalizeCandidate({characters:[character],scenes:[scene]},p,{characterCount:1,sceneCount:1});assert.equal(candidate.characters[0].id,'mira');assert.equal(candidate.scenes[0].id,'mira-arrives');});
test('applies only approved entries and validates the result',()=>{const p=pack(),candidate=normalizeCandidate({characters:[character],scenes:[scene]},p,{characterCount:1,sceneCount:1}),proposal=createProposal(p,candidate);proposal.scenes[0].status='approved';assert.throws(()=>applyProposal(p,proposal),/speaker: unknown/);proposal.characters[0].status='approved';const result=applyProposal(p,proposal);assert(result.actors.some(x=>x.id==='mira'));assert(result.scriptedScenes.some(x=>x.id==='mira-arrives'));});
test('rejects a stale proposal',()=>{const p=pack(),candidate=normalizeCandidate({characters:[character],scenes:[]},p,{characterCount:1,sceneCount:0}),proposal=createProposal(p,candidate);p.subtitle='Edited after generation';assert.throws(()=>applyProposal(p,proposal),/source pack changed/);});
test('skips copies of existing characters and rejects duplicate generated IDs',()=>{const c=normalizeCandidate({characters:[{...character,id:'ada'}],scenes:[]},pack(),{characterCount:1,sceneCount:0});assert.deepEqual([c.characters.length,c.skipped],[0,['characters: ada']]);assert.throws(()=>normalizeCandidate({characters:[character,character],scenes:[]},pack(),{characterCount:2,sceneCount:0}),/"mira" already exists/);});

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
