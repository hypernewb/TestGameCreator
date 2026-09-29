import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createProposal} from '../packages/ai/bulk-authoring.mjs';
import {reviewProposal,regenerateEntry,applyReviewed,staleReason} from '../packages/ai/proposal-review.mjs';
import {routeCandidate,placeholderProse,RUNGS} from '../packages/cards/route-skeleton.mjs';

const workshop=()=>JSON.parse(readFileSync(new URL('../packs/activity-workshop.json',import.meta.url),'utf8'));
const huntrix=JSON.parse(readFileSync(new URL('./fixtures/bulk-replies/huntrix.pack.json',import.meta.url),'utf8'));
const character={id:'mira',name:'Mira',location:'hub',pronouns:'she/her',description:'An adult curator.',style:'Careful',goal:'Prepare the show.',traits:['patient'],backstory:'She came to organize the collection.',likes:['clarity'],dislikes:['waste'],voice:'Quiet, exact sentences.'};
const scene={id:'mira-arrives',title:'Mira arrives',opening:'Mira examines the room.',trigger:{event:'core.inspected',match:{location:'hub'}},when:{location:'hub'},pages:[{speaker:'mira',text:'This will need a careful hand.'}],choices:[{id:'help',label:'Offer to help',result:'Mira accepts.',effects:[]},{id:'back',label:'Give her room',result:'You step back.',effects:[]}]};

test('review blames errors and warnings on the entry that causes them; rejected entries are left out; stale and forced apply',()=>{
 const p=workshop(),ghost={...scene,id:'ghost-talk',title:'Ghost',pages:[{speaker:'ghost',text:'Boo'}]},far={...scene,id:'mira-away',title:'Away',trigger:{event:'core.inspected',match:{location:'workshop'}},when:{location:'workshop'}};
 const proposal=createProposal(p,{characters:[character],scenes:[scene,ghost,far]}),r=reviewProposal(p,proposal,{turns:30}),by=id=>r.entries.find(e=>e.id===id);
 assert.equal(r.stale,'');assert.deepEqual(r.errors,[]);assert.deepEqual(by('mira').errors,[]);assert.deepEqual(by('mira-arrives').errors,[]);
 assert.match(by('ghost-talk').errors[0],/speaker/);assert.ok(by('mira-away').warnings.some(w=>/^scene mira-away: mira speaks/.test(w)));assert.deepEqual(by('mira-arrives').warnings.filter(w=>!/no choice has an effect/.test(w)),[]);
 assert.ok(r.play&&r.calendar.length&&r.calendar.every(c=>c.day>=1&&c.daypart&&c.hand>=0),'playtest and calendar');
 const rejected={...proposal,scenes:proposal.scenes.map(e=>e.value.id==='ghost-talk'?{...e,status:'rejected'}:e)};assert.deepEqual(reviewProposal(p,rejected,{play:false}).entries.find(e=>e.id==='ghost-talk').errors,[]);
 const approved={...rejected,characters:rejected.characters.map(e=>({...e,status:'approved'})),scenes:rejected.scenes.map(e=>e.value.id==='mira-arrives'?{...e,status:'approved'}:e)},changed={...p,subtitle:'edited'};
 assert.match(staleReason(changed,approved),/changed/);assert.throws(()=>applyReviewed(changed,approved),/changed/);
 const next=applyReviewed(changed,approved,{force:true});assert.equal(next.subtitle,'edited');assert.ok(next.actors.some(a=>a.id==='mira')&&next.scriptedScenes.some(s=>s.id==='mira-arrives')&&!next.scriptedScenes.some(s=>s.id==='mira-away'));
 assert.throws(()=>applyReviewed({...p,id:'other'},approved,{force:true}),/not other/);
});

test('route review is a grid of love interest × rung with played marks',()=>{
 const r=reviewProposal(huntrix,createProposal(huntrix,routeCandidate(huntrix,{route:'rumi,mira',days:3})),{turns:120});
 assert.deepEqual(r.route.map(x=>x.character),['rumi','mira']);assert.deepEqual(r.route[0].cells.map(c=>c.rung),RUNGS);assert.ok(r.route.every(x=>x.cells.every(c=>c.id&&c.status==='pending'&&!c.errors)));
 assert.ok(r.route.flatMap(x=>x.cells).some(c=>c.played),'bots play some rungs');assert.ok(r.calendar.some(c=>c.hand>=2),'the heatmap shows a full hand somewhere');
});

test('regenerate one entry: written against the rest with the author note, one repair, status back to pending',async()=>{
 const p=workshop(),proposal=createProposal(p,{characters:[character],scenes:[scene]}),asked=[];
 const ask=async(messages,schema)=>{asked.push({messages,schema});return JSON.stringify({characters:[],scenes:[asked.length===1?{...scene,pages:[{speaker:'nobody',text:'?'}]}:{...scene,title:'Mira returns'}]});};
 const approved={...proposal,scenes:proposal.scenes.map(e=>({...e,status:'approved'}))},{proposal:next,replaced}=await regenerateEntry(ask,p,approved,{kind:'scenes',index:0,note:'Make it warmer'});
 assert.equal(asked.length,2,'one repair');assert.match(asked[0].messages.at(-1).content+asked[0].messages[0].content,/Make it warmer/);assert.match(JSON.stringify(asked[0].messages),/REPLACE THIS ONE/);
 assert.deepEqual(asked[0].schema.properties.scenes.minItems,1);assert.deepEqual(replaced,['mira-arrives']);
 assert.equal(next.scenes[0].value.title,'Mira returns');assert.equal(next.scenes[0].status,'pending');assert.deepEqual(next.characters,proposal.characters);
 await assert.rejects(regenerateEntry(ask,p,proposal,{kind:'events',index:0}),/No events entry/);
});

test('regenerating a route rung redraws that love interest only: scenes, endings and tastes',async()=>{
 const proposal=createProposal(huntrix,routeCandidate(huntrix,{route:'rumi,mira',days:5})),base=placeholderProse('Rumi'),before=proposal.scenes.filter(e=>e.value.id.startsWith('mira-'));
 const prose={...base,flirt:{...base.flirt,title:'Encore lights'},ending:{name:'Duet',text:'You sing the last verse together.'},likes:['ramen'],dislikes:[]};
 const ask=async messages=>{assert.match(JSON.stringify(messages),/Slower burn/);return JSON.stringify(prose);};
 const {proposal:next,replaced}=await regenerateEntry(ask,huntrix,proposal,{kind:'scenes',index:proposal.scenes.findIndex(e=>e.value.id==='rumi-kiss'),note:'Slower burn'});
 assert.deepEqual(replaced,RUNGS.map(r=>`rumi-${r}`));assert.equal(next.scenes.find(e=>e.value.id==='rumi-flirt').value.title,'Encore lights');
 assert.deepEqual(next.scenes.filter(e=>e.value.id.startsWith('mira-')),before);assert.equal(next.route.endings.rumi.ending.name,'Duet');assert.deepEqual(next.route.endings.mira,proposal.route.endings.mira);
 assert.deepEqual(next.route.tastes.rumi,{likes:['ramen'],dislikes:[]});assert.ok(!(next.warnings||[]).some(w=>w.startsWith('rumi:')));
 assert.equal(reviewProposal(huntrix,next,{play:false}).entries.filter(e=>e.errors.length).length,0);
});

test('Studio wires the review panel and card buttons to server routes that exist',()=>{
 const ui=readFileSync(new URL('../public/studio.mjs',import.meta.url),'utf8'),html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8'),server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(html,/id="load-proposal"/);assert.match(ui,/\$\('load-proposal'\)\.onchange/);
 for(const route of ['/api/studio/proposal/review','/api/studio/proposal/regenerate','/api/studio/proposal/apply','/api/studio/import-card','/api/studio/export-card']){assert.ok(ui.includes(route),route);assert.ok(server.includes(route.replace(/\/(review|regenerate|apply)$/,'/'))||server.includes(route),route);}
 assert.match(ui,/cardsEditor\(\);proposalEditor\(\);/);assert.match(ui,/\(draft\.pack\[key\]\|\|=\[\]\)\.entries\(\)/,'rows tolerate a pack without that list');
});
