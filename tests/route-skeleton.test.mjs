import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {routeFrame,routeCandidate,tastesOf,routeScenes,fillProse,tidyProse,missingProse,placeholderProse,proseMessages,proseSchema,parseProse,RUNGS,PROSE} from '../packages/cards/route-skeleton.mjs';
import {createProposal,applyProposal,withProposal} from '../packages/ai/bulk-authoring.mjs';
import {playtestProposal} from '../packages/ai/bulk-robustness.mjs';
import {validatePack,createWorld,execute} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';

const pack=JSON.parse(readFileSync(new URL('./fixtures/bulk-replies/huntrix.pack.json',import.meta.url),'utf8'));
const approveAll=p=>({...p,scenes:p.scenes.map(x=>({...x,status:'approved'}))});

test('route frame adds modules, stats, dating profiles, run, last-day scene and endings; idempotent; rejects unknown or player ids',()=>{
 const f=routeFrame(pack,{route:'rumi,mira',days:7});
 for(const m of ['social.relationships','social.dating','character.stats','story.endings','story.scenes'])assert.ok(f.modules[m],m);
 assert.deepEqual(['charm','nerve','wit'].filter(s=>f.statDefinitions.some(d=>d.id===s)),['charm','nerve','wit']);
 assert.deepEqual(f.datingProfiles.map(d=>d.character).filter(x=>['rumi','mira'].includes(x)),['rumi','mira']);
 assert.deepEqual(f.run,{days:7,defaultEnding:'route-solo'});
 assert.ok(f.scriptedScenes.some(s=>s.id==='route-last-day'));assert.ok(['route-solo','rumi-ending','rumi-close','mira-ending','mira-close'].every(id=>f.endings.some(e=>e.id===id)));
 assert.ok(f.endings.filter(e=>e.id!=='route-solo').every(e=>e.requires.flags['last-day']),'endings wait for the last day');
 assert.deepEqual(routeFrame(f,{route:'rumi,mira',days:7}),f);
 assert.throws(()=>routeFrame(pack,{route:'nobody'}),/not a character/);assert.throws(()=>routeFrame(pack,{route:pack.playerId}),/not a character/);assert.throws(()=>routeFrame(pack,{route:'rumi',days:0}),/--days/);
 validatePack(withProposal(pack,createProposal(pack,routeCandidate(pack,{route:'rumi,mira',days:7}))),registry);
});

test('route scenes are hand cards at the love interest\'s home; every check fails forward with a reasoned chemistry effect',()=>{
 const f=routeFrame(pack,{route:'rumi',days:14}),s=routeScenes(f,'rumi',{days:14}),home=pack.actors.find(a=>a.id==='rumi').location;
 assert.deepEqual(s.map(x=>x.id),RUNGS.map(r=>`rumi-${r}`));
 for(const x of s){assert.equal(x.offer,'hand');assert.equal(x.when.charactersAt.rumi,home);assert.equal(x.pages[0].speaker,'rumi');}
 const checks=s.flatMap(x=>x.choices).filter(c=>c.check);assert.ok(checks.length>=4);
 for(const c of checks){assert.ok(c.check.fail.result);assert.ok(c.check.fail.effects.some(e=>e.type==='chemistry'&&e.reason),c.check.stat);}
 assert.ok(!s.find(x=>x.id==='rumi-night').choices.some(c=>c.check),'intimacy is never behind a check');
 assert.throws(()=>routeCandidate({...pack,scriptedScenes:[...pack.scriptedScenes||[],{id:'rumi-flirt'}]},{route:'rumi'}),/already exists/);
});

test('model prose fills slots over placeholders; missing slots are listed; the request stays small and schema-bound',()=>{
 const base=placeholderProse('Rumi'),filled=fillProse(base,{flirt:{title:' Stage lights ',says:'',boldWorks:7},ending:{text:'x'.repeat(900)}});
 assert.equal(filled.flirt.title,'Stage lights');assert.equal(filled.flirt.says,base.flirt.says);assert.equal(filled.flirt.boldWorks,base.flirt.boldWorks);assert.equal(filled.ending.text.length,800);
 const all=missingProse({});assert.equal(all.length,RUNGS.length*PROSE.length-3+4);assert.ok(!all.includes('night.boldFails'));
 assert.deepEqual(missingProse(fillProse(base,base)),[]);assert.deepEqual(missingProse({...base,kiss:{...base.kiss,says:' '}}),['kiss.says']);
 const [sys,user]=proseMessages(pack,'rumi',{brief:'Notes here',error:'bad'});assert.match(sys.content,/kiss:/);assert.match(sys.content,/failed: bad/);assert.match(user.content,/Rumi/);assert.ok(sys.content.length+user.content.length<4000);
 const copied=tidyProse({flirt:{boldWorks:'She laughs and the room goes quiet around you.',safeChoice:'Just talk'},charged:{boldWorks:'She laughs and the room goes quiet around you.',safeChoice:'Just talk'}});
 assert.deepEqual([copied.flirt.boldWorks&&'kept',copied.charged.boldWorks,copied.charged.safeChoice],['kept',undefined,'Just talk']);assert.ok(missingProse(copied).includes('charged.boldWorks'));
 const said=says=>routeScenes(routeFrame(pack,{route:'mira'}),'mira',{prose:{flirt:{says}}})[1].pages[0].text;assert.deepEqual(["Mira: 'Mind if I sit?' ",'mira : “Stay?”','Note: not a name'].map(said),['Mind if I sit?','Stay?','Note: not a name']);
 assert.deepEqual(proseSchema().required,[...RUNGS,'ending','close','likes','dislikes']);
 assert.deepEqual(parseProse('sure! {"flirt":{"title":"A"}} ok'),{flirt:{title:'A'}});assert.throws(()=>parseProse('nothing'),/no JSON/);
 const c=routeCandidate(pack,{route:'rumi',prose:{rumi:{flirt:{title:'Stage lights'},ending:{name:'Encore'}}}});
 assert.equal(c.scenes.find(x=>x.id==='rumi-flirt').title,'Stage lights');assert.equal(c.route.endings.rumi.ending.name,'Encore');
 assert.equal(applyProposal(pack,approveAll(createProposal(pack,c))).endings.find(e=>e.id==='rumi-ending').name,'Encore');
});

test('a short route plays: hand cards every daypart, the ladder is climbed and an ending lands',()=>{
 const empty=playtestProposal(pack,{scenes:[]},{turns:120}),p=playtestProposal(pack,createProposal(pack,routeCandidate(pack,{route:'rumi,mira',days:3})),{turns:120});
 assert.equal(p.errors,0);assert.ok(p.hand>=2,`hand ${p.hand}`);assert.ok(p.dead<empty.dead,`dead ${p.dead} vs ${empty.dead}`);assert.ok(p.played>=10,`played ${p.played}`);assert.ok(p.endings.some(e=>/-(ending|close)$/.test(e)),p.endings.join());
});

test('tastes: model likes/dislikes fill a bare actor, learning one in play pays chemistry once; authored likes are kept',()=>{
 assert.deepEqual(tastesOf({likes:['Likes: ramen.','"ramen"','x','stage lights','night drives','karaoke','extra'],dislikes:['Hates: fakes',' ']}),{likes:['ramen','stage lights','night drives','karaoke'],dislikes:['fakes']});
 assert.deepEqual(tastesOf(null),{likes:[],dislikes:[]});
 const bare={...pack,actors:pack.actors.map(a=>a.id==='rumi'?{...a,likes:[],dislikes:[]}:a.id==='mira'?{...a,likes:['sparring']}:a)};
 const f=routeFrame(bare,{route:'rumi,mira',tastes:{rumi:{likes:['ramen'],dislikes:['fakes']},mira:{likes:['naps'],dislikes:[]}}});
 assert.deepEqual(f.actors.find(a=>a.id==='rumi').likes,['ramen']);assert.deepEqual(f.actors.find(a=>a.id==='mira').likes,['sparring']);
 const sig=f.datingProfiles.find(d=>d.character==='rumi').signals.filter(x=>x.event==='social.topicLearned');
 assert.deepEqual(sig.map(x=>[x.match.topic,x.delta]),[['ramen',2],['fakes',1]]);assert.deepEqual(routeFrame(f,{route:'rumi,mira',tastes:{rumi:{likes:['ramen'],dislikes:['fakes']}}}),f);
 validatePack(f,registry);
 const run=(s,type,args,id)=>execute(s,{type,args,id,actorId:f.playerId,expectedRevision:s.revision},f,registry).state,chem=s=>s.modules['social.dating'].characters.rumi.chemistry;
 let s=structuredClone(createWorld(f,registry,'tastes'));s.actors[f.playerId].location=s.actors.rumi.location;const before=chem(s);
 s=run(s,'social.speak',{target:'rumi',text:'What is it you love about ramen?'},'t1');assert.equal(chem(s)-before,2);
 s=run(s,'social.speak',{target:'rumi',text:'Ramen again?'},'t2');assert.equal(chem(s)-before,2,'once');
});
