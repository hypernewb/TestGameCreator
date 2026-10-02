import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack,actions} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {createProposal,applyProposal,withProposal,playability} from '../packages/ai/bulk-authoring.mjs';
import {reviewProposal,regenerateEntry} from '../packages/ai/proposal-review.mjs';
import {BEATS,STOP,adultEntry,missingStops,intimacyCandidate,intimacyFrame,boundaries,placeholderIntimacy,draftIntimacyProse} from '../packages/cards/intimacy-skeleton.mjs';

const huntrix=JSON.parse(readFileSync(new URL('./fixtures/bulk-replies/huntrix.pack.json',import.meta.url),'utf8'));
// The author's part: ages, and Mira out of Rumi's room so it is private.
const aged=()=>{const p=structuredClone(huntrix);for(const a of p.actors)a.age=25;p.actors.find(a=>a.id==='mira').location='kitchen-bar';return p;};
const approve=p=>({...p,scenes:p.scenes.map(e=>({...e,status:'approved'}))});

test('encounters: 5 segments, each with the same code-built stop choice; last beat completes and sets the night flag',()=>{
 const {scenes,intimacy}=intimacyCandidate(aged(),{characters:'rumi',contentLevel:'suggestive'}),[first,again]=scenes;
 assert.deepEqual(intimacy,{characters:['rumi'],contentLevel:'suggestive'});assert.deepEqual([first.id,again.id],['rumi-intimate','rumi-intimate-again']);
 const segs=[first,...first.beats];assert.deepEqual(first.beats.map(b=>b.id),BEATS.slice(1));
 for(const s of [...segs,again]){const stop=s.choices.find(c=>c.id==='stop');assert.equal(stop.label,STOP);assert.ok(!stop.when&&!stop.check);assert.deepEqual(stop.effects[0],{type:'intimacyConsent',character:'rumi',category:'together',status:'withdrawn'});}
 assert.deepEqual(first.beats.at(-1).choices.filter(c=>c.id!=='stop').map(c=>c.effects.find(e=>e.type==='completeIntimacy').outcome),['positive','neutral']);
 assert.ok(first.beats.at(-1).choices.filter(c=>c.id!=='stop').every(c=>c.effects.some(e=>e.type==='flag'&&e.id==='rumi-night')));
 assert.deepEqual(again.when,{completedScenes:['rumi-intimate']});assert.equal(again.repeatable,true);
 assert.deepEqual(scenes.map(missingStops),[[],[]]);assert.ok(scenes.every(adultEntry));
});

test('adultEntry and missingStops read content, not a stored flag; the lint names the beat without a stop',()=>{
 assert.equal(adultEntry({trigger:{event:'core.inspected'},choices:[{effects:[{type:'flag',id:'x'}]}]}),false);
 assert.equal(adultEntry({trigger:{event:'core.inspected'},beats:[{choices:[{check:{fail:{effects:[{type:'requestIntimacy'}]}}}]}]}),true);
 assert.equal(adultEntry({trigger:{event:'social.consentGranted'}}),true);
 const p=aged(),c=intimacyCandidate(p,{characters:'rumi',contentLevel:'fade'}),first=c.scenes[0];first.beats[1].choices=first.beats[1].choices.filter(x=>x.id!=='stop');first.choices=first.choices.map(x=>x.id==='stop'?{...x,when:{flags:{never:true}}}:x);
 assert.deepEqual(missingStops(first),['','check-in']);
 const w=playability(withProposal(p,approve(createProposal(p,c))));assert.ok(w.includes('scene rumi-intimate: no stop choice (an unconditional choice that withdraws consent)'));assert.ok(w.includes('scene rumi-intimate.check-in: no stop choice (an unconditional choice that withdraws consent)'));
 for(const f of ['campus','activity-workshop'])assert.ok(!playability(JSON.parse(readFileSync(new URL(`../packs/${f}.json`,import.meta.url),'utf8'))).some(x=>/no stop choice/.test(x)),f);
});

test('the generator never sets ages: apply fails until the author marks them 18+, then frames only approved encounters',()=>{
 const c=intimacyCandidate(huntrix,{characters:'rumi,mira',contentLevel:'fade'});assert.deepEqual(c.warnings.map(w=>w.split(':')[0]),['player','rumi','mira']);
 assert.ok(huntrix.actors.every(a=>a.age===undefined));assert.throws(()=>applyProposal(huntrix,approve(createProposal(huntrix,c))),/adult/);
 const p=aged(),proposal=createProposal(p,intimacyCandidate(p,{characters:'rumi,mira',contentLevel:'fade'}));assert.ok(!JSON.stringify(proposal).includes('"age"'));
 const some={...proposal,scenes:proposal.scenes.map(e=>({...e,status:e.value.id.startsWith('rumi-')?'approved':'rejected'}))},next=applyProposal(p,some);
 assert.deepEqual(next.intimacyProfiles.map(x=>x.character),['rumi']);assert.equal(next.intimacySettings.contentLevel,'fade');assert.deepEqual(next.intimacySettings.privateLocations,['main-party-room']);
 assert.equal(next.modules['social.intimacy'],'0.1.0');assert.deepEqual(next.scriptedScenes.filter(s=>/intimate/.test(s.id)).map(s=>s.id),['rumi-intimate','rumi-intimate-again']);
 const none=applyProposal(p,{...proposal,scenes:proposal.scenes.map(e=>({...e,status:'rejected'}))});assert.equal(none.intimacyProfiles,undefined);assert.equal(none.modules['social.intimacy'],undefined);
});

test('an applied encounter plays: Stop is offered at every beat, go-through completes, a stop ends it at once',()=>{
 const p=aged(),next=applyProposal(p,approve(createProposal(p,intimacyCandidate(p,{characters:'rumi',contentLevel:'suggestive'}))));
 Object.assign(next.datingProfiles.find(d=>d.character==='rumi'),{initialPhase:'dating',initialChemistry:60,initialSatisfaction:30});validatePack(next,registry);
 const play=()=>{let s=createWorld(next,registry,'t');const h={get s(){return s;},act(type,args={}){const r=execute(s,{id:'t'+s.revision,actorId:next.playerId,type,args,expectedRevision:s.revision},next,registry);s=r.state;return r;}};
  h.act('core.move',{to:'main-party-room'});h.act('social.requestIntimacy',{character:'rumi',category:'together'});h.act('social.beginIntimacy',{character:'rumi',category:'together'});return h;};
 const g=play();for(const beat of [undefined,...BEATS.slice(1)]){const sc=g.s.modules['story.scenes'],as=actions(g.s,next,registry);assert.equal(sc.pending,'rumi-intimate');assert.equal(sc.pendingBeat??undefined,beat);
  assert.ok(as.some(a=>a.label==='Stop: Spend the night with Rumi'),`engine stop at ${beat}`);assert.ok(as.some(a=>a.args?.choice==='stop'&&a.label===STOP),`scene stop at ${beat}`);g.act('story.choose',{scene:'rumi-intimate',choice:'go'});}
 const rumi=g.s.modules['social.intimacy'].characters.rumi;assert.equal(g.s.modules['story.scenes'].pending,null);assert.equal(g.s.flags['rumi-night'],true);assert.equal(rumi.encounters[0].outcome,'positive');assert.equal(rumi.encounters[0].contentLevel,'suggestive');
 const a=play();a.act('story.choose',{scene:'rumi-intimate',choice:'go'});a.act('story.choose',{scene:'rumi-intimate',choice:'stop'});
 assert.equal(a.s.modules['story.scenes'].pending,null);assert.equal(a.s.modules['social.intimacy'].characters.rumi.consent.together.status,'withdrawn');assert.equal(a.s.flags['rumi-night'],undefined);assert.equal(a.s.modules['social.intimacy'].characters.rumi.encounters.length,0);
 const b=play(),stop=actions(b.s,next,registry).find(x=>x.label==='Stop: Spend the night with Rumi');b.act(stop.type,stop.args);assert.equal(b.s.modules['story.scenes'].pending,null);assert.equal(b.s.modules['social.intimacy'].characters.rumi.active,null);
});

test('review marks encounters adult; regenerate redraws both scenes from one prose request and keeps the boundaries',async()=>{
 const p=aged(),proposal=createProposal(p,intimacyCandidate(p,{characters:'rumi',contentLevel:'explicit'})),r=reviewProposal(p,proposal,{play:false});
 assert.deepEqual(r.entries.map(e=>[e.id,e.adult,e.errors.length]),[['rumi-intimate',true,0],['rumi-intimate-again',true,0]]);
 const asked=[],base=placeholderIntimacy('Rumi'),ask=async(messages,schema)=>{asked.push(messages);assert.deepEqual(schema.required.slice(0,3),['title','againTitle','stop']);return JSON.stringify({...base,title:'Encore',start:{...base.start,go:'Kiss her'}});};
 const {proposal:next,replaced}=await regenerateEntry(ask,p,approve(proposal),{kind:'scenes',index:1,note:'Softer'});
 assert.equal(asked.length,1);assert.match(JSON.stringify(asked[0]),/Softer/);assert.match(asked[0][0].content,/Frank and sensual/);assert.deepEqual(replaced,['rumi-intimate','rumi-intimate-again']);
 assert.equal(next.scenes[0].value.title,'Encore');assert.equal(next.scenes[0].value.choices[0].label,'Kiss her');assert.ok(next.scenes.every(e=>e.status==='pending'));assert.deepEqual(next.intimacy,proposal.intimacy);
 assert.equal(next.scenes[0].value.choices.find(c=>c.id==='stop').label,STOP,'the stop label is not the model\'s');
});

test('prose: one repair when too many slots are missing; placeholders fill the rest',async()=>{
 const p=intimacyFrame(aged(),{characters:['rumi']});let n=0;const ask=async()=>++n===1?'{"title":"x"}':JSON.stringify({...placeholderIntimacy('Rumi'),stop:''});
 const {prose,missing}=await draftIntimacyProse(ask,p,'rumi');assert.equal(n,2);assert.deepEqual(missing,['stop']);assert.equal(prose.title,'A night with Rumi');
});

test('boundaries are the author\'s: content level and private places are checked, existing profiles are not overwritten',()=>{
 const p=aged();assert.throws(()=>boundaries(p,{contentLevel:'graphic'}),/--content must be one of fade, suggestive, explicit/);assert.throws(()=>boundaries(p,{privateLocations:'moon'}),/moon is not a location/);
 assert.deepEqual(boundaries(p,{contentLevel:'fade',privateLocations:'kitchen-bar'}),{contentLevel:'fade',privateLocations:['kitchen-bar']});
 assert.throws(()=>intimacyCandidate(p,{characters:'player'}),/not a character/);
 const q={...p,intimacyProfiles:[{character:'rumi',allowedCategories:['other']}]};assert.throws(()=>intimacyCandidate(q,{characters:'rumi'}),/already has an intimacy profile/);
 const framed=intimacyFrame({...p,intimacySettings:{difficulty:'easy',contentLevel:'explicit',privateLocations:['kitchen-bar']}},{characters:['rumi'],contentLevel:'fade'});assert.equal(framed.intimacySettings.contentLevel,'explicit','an existing setting stays');
});

test('Studio "Approve all" skips adult entries and badges them; the CLI requires --content',()=>{
 const ui=readFileSync(new URL('../public/studio.mjs',import.meta.url),'utf8'),cli=readFileSync(new URL('../scripts/ai-bulk-author.mjs',import.meta.url),'utf8');
 assert.match(ui,/e\.status==='pending'&&!e\.errors\.length&&!e\.adult/);assert.match(ui,/draft-adult/);assert.match(cli,/contentLevel:required\('content'\)/);
});
