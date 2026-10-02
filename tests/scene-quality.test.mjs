import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack,actions} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {normalizeCandidate,tidyScenes,candidateSchema,messagesFor,playability,withCandidate,joinCandidates} from '../packages/ai/bulk-authoring.mjs';
import {reviewProposal} from '../packages/ai/proposal-review.mjs';
import {createProposal} from '../packages/ai/bulk-authoring.mjs';

const huntrix=()=>JSON.parse(readFileSync(new URL('./fixtures/bulk-replies/huntrix.pack.json',import.meta.url),'utf8'));
const words=['Rumi tunes her guitar by the speakers','Mira counts the empty cups on the table','Zoey hums a chorus nobody else knows','the lights flicker over the dance floor','somebody spills punch across the carpet'];
const scene=(id,at='main-party-room',speaker='rumi',n=0,extra={})=>({id,title:`${id} title`,opening:words[n%words.length],trigger:{event:'core.inspected',match:{location:at}},pages:[{speaker,text:`${words[(n+1)%words.length]} while ${words[(n+2)%words.length]}.`}],
 choices:[{id:'stay',label:'Stay',result:'You stay.',effects:[{type:'memory',character:speaker,text:`stayed in ${id}`}]},{id:'go',label:'Go',result:'You go.',effects:[]}],...extra});

test('effects the pack cannot carry are dropped with a note naming scene and choice; known ones are normalized and clamped',()=>{
 const p={...huntrix(),modules:{...huntrix().modules,'world.economy':'0.1.0','character.stats':'0.1.0'},statDefinitions:[{id:'nerve',name:'Nerve'}],items:[{id:'pick',name:'Pick'}]},notes=[];
 const [s]=tidyScenes([{...scene('a'),choices:[{id:'x',label:'X',result:'r',effects:[{type:'money',delta:500},{type:'stat',stat:'Nerve',delta:9},{type:'item',id:'pick'},{type:'item',id:'ghost'},{type:'teleport'},{type:'chemistry',character:'rumi',delta:2,reason:'r'}]},{id:'y',label:'Y',result:'r'}]}],p.actors.filter(a=>a.id!=='player'),p.actors[0],p,notes);
 assert.deepEqual(s.choices[0].effects,[{type:'money',delta:50},{type:'stat',stat:'nerve',delta:2},{type:'item',id:'pick',to:'player'}]);
 assert.deepEqual(notes,['scene a.x: dropped item effect (unknown item)','scene a.x: dropped teleport effect (not offered to generated scenes)','scene a.x: dropped chemistry effect (needs a dating character, a delta and a reason)']);
 const schema=JSON.stringify(candidateSchema(p,{sceneCount:1})),prompt=messagesFor(p,'b',{sceneCount:1})[0].content;
 for(const k of ['"money"','"stat"','"item"'])assert.ok(schema.includes(k),k);for(const k of ['"type":"money"','"type":"stat"','"type":"item"','after:'])assert.ok(prompt.includes(k),k);
 assert.ok(!JSON.stringify(candidateSchema(huntrix(),{sceneCount:1})).includes('"money"'),'no economy, no money effect');
});

test('a near copy of an earlier scene is skipped in lenient mode and fails the strict attempt',()=>{
 const p=huntrix(),copy={...scene('b'),id:'b2',title:'b title'};
 assert.throws(()=>normalizeCandidate({characters:[],scenes:[scene('b'),copy]},p,{sceneCount:2},{strict:true}),/"b2" is a near copy of b/);
 const c=normalizeCandidate({characters:[],scenes:[scene('b'),copy,scene('c','main-party-room','mira',2)]},p,{sceneCount:3});
 assert.deepEqual(c.scenes.map(s=>s.id),['b','c']);assert.deepEqual(c.skipped,['scenes: b2 (a near copy of b)']);
 const again=normalizeCandidate({characters:[],scenes:[copy]},{...p,scriptedScenes:[c.scenes[0]]},{sceneCount:1});assert.deepEqual(again.skipped,['scenes: b2 (a near copy of b)'],'against the pack too');
});

test('after: a choice follow-up gets a code-made flag, a scene follow-up waits on completion; both are hand cards and play in order',()=>{
 const p=huntrix(),c=normalizeCandidate({characters:[],scenes:[scene('late','main-party-room','mira',3,{after:'first.stay',dayparts:['evening']}),scene('first'),scene('whole','main-party-room','rumi',1,{after:'first'}),scene('loop','kitchen-bar','zoey',4,{after:'loop'})]},p,{sceneCount:4});
 assert.deepEqual(c.scenes.map(s=>s.id),['first','loop','late','whole'],'parents first');
 const [first,,late,whole]=c.scenes;assert.deepEqual(first.choices[0].effects.at(-1),{type:'flag',id:'first.stay',value:true});
 assert.deepEqual(late.when.flags,{'first.stay':true});assert.deepEqual(late.when.dayparts,['Evening']);assert.deepEqual(whole.when.completedScenes,['first']);
 assert.ok([late,whole].every(s=>s.offer==='hand'&&!('after' in s)&&!('dayparts' in s)));assert.notEqual(first.offer,'hand');
 assert.ok(c.warnings.includes('scene loop: after "loop" makes a loop, so it is not a follow-up'));
 const next=withCandidate(p,c);validatePack(next,registry);
 let s=createWorld(next,registry,'q');const act=(type,args={})=>{s=execute(s,{id:'q'+s.revision,actorId:'player',type,args,expectedRevision:s.revision},next,registry).state;};
 act('core.move',{to:'main-party-room'});act('core.inspect',{location:'main-party-room'});assert.equal(s.modules['story.scenes'].pending,'first');act('story.choose',{scene:'first',choice:'stay'});assert.equal(s.flags['first.stay'],true);
});

test('after naming something unknown or a missing choice falls back with a note; a dropped parent drops its follow-up',()=>{
 const p=huntrix(),c=normalizeCandidate({characters:[],scenes:[scene('p1'),scene('k1','main-party-room','mira',2,{after:'p1.nope'}),scene('k2','kitchen-bar','zoey',4,{after:'ghost'})]},p,{sceneCount:3});
 assert.deepEqual(c.scenes.find(s=>s.id==='k1').when.completedScenes,['p1']);assert.equal(c.scenes.find(s=>s.id==='k2').when?.completedScenes,undefined);
 assert.ok(c.warnings.includes('scene k1: after "p1.nope": p1 has no choice nope, so it follows the whole scene'));assert.ok(c.warnings.includes('scene k2: after "ghost" names no earlier scene, so it is not a follow-up'));
 const d=normalizeCandidate({characters:[],scenes:[scene('p2','the-moon'),scene('k3','main-party-room','mira',2,{after:'p2'}),scene('k4','kitchen-bar','zoey',4)]},p,{sceneCount:3});
 assert.deepEqual(d.scenes.map(s=>s.id),['k4']);assert.ok(d.dropped.some(x=>/follows p2, which was dropped/.test(x)));
});

test('a moved scene says where from, and whether its text still names the old place; review attaches the note to the scene',()=>{
 const p=huntrix(),c=normalizeCandidate({characters:[],scenes:[{...scene('porch','backyard-porch','zoey',0),opening:'Out on the Backyard Porch the air is cold.'}]},p,{sceneCount:1});
 assert.equal(c.scenes[0].trigger.match.location,'kitchen-bar');assert.deepEqual(c.warnings,['scene porch: moved from backyard-porch to kitchen-bar, where its speakers are; its text still names Backyard Porch']);
 const r=reviewProposal(p,createProposal(p,c),{play:false});assert.ok(r.entries[0].warnings.some(w=>/moved from backyard-porch/.test(w)));
 assert.deepEqual(joinCandidates(c,{warnings:['x']}).warnings.length,2);
});

test('playability: a scene where no choice does anything is flagged; shipped packs have none',()=>{
 const p=huntrix(),bare={...scene('bare'),choices:[{id:'a',label:'A',result:'r'},{id:'b',label:'B',result:'r'}]};
 assert.ok(playability({...p,scriptedScenes:[bare]}).includes('scene bare: no choice has an effect, so nothing the player picks matters'));assert.deepEqual(playability({...p,scriptedScenes:[scene('ok')]}),[]);
 for(const f of ['campus','activity-workshop','crossed-plans'])assert.ok(!playability(JSON.parse(readFileSync(new URL(`../packs/${f}.json`,import.meta.url),'utf8'))).some(w=>/no choice has an effect/.test(w)),f);
});
