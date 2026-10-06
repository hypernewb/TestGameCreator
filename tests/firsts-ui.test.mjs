import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,actions} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {FIRST_CHECKPOINTS} from '../packages/cards/beat-library.mjs';
import {firstProgress,firstOffers,firstTurn,firstEndCard} from '../public/firsts-ui.mjs';
import {endCard} from '../public/campus.mjs';
import {galleryOf,replayLines} from '../public/gallery.mjs';

const fixture=(rung='kiss')=>{
 const p=JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url)));
 p.modules['social.firsts']='0.1.0';p.scriptedScenes=[];p.gallery=[];p.schedules=[];
 p.firsts=[{id:`jana-${rung}-free`,character:'jana',rung,title:`A ${rung} with Jana`,opening:'She pauses beside you.',
  trigger:{event:'test.never'},cg:'assets/campus/jana-kiss.png',checkpoints:FIRST_CHECKPOINTS[rung].map(x=>({id:x.id,cue:`Her ${x.id} cue.`}))}];
 let state=createWorld(p,registry,'first-ui');
 for(const [id,a] of Object.entries(state.actors))a.location=id===p.playerId||id==='jana'?'apartment':'langley';
 state.modules['social.firsts'].offers=[{first:p.firsts[0].id,after:state.tick}];
 if(rung==='night')state.modules['social.intimacy'].characters.jana.active={category:'first-night',startedTick:state.tick};
 const act=(type,args={},id=`turn-${state.revision}`)=>{state=execute(state,{id,type,args,actorId:p.playerId,expectedRevision:state.revision},p,registry).state;return state.turns[id];};
 const score=(text='Hmm.')=>{const t=act('core.scene',{text,location:'apartment',characters:['jana'],activity:state.scene?'continue':'talk'});
  t.input=text;t.sceneLines=[{speaker:'jana',text:'Her narrated reply.'}];t.status='complete';return act('social.scoreFirst',{source:t.id,text});};
 return {p,act,score,get state(){return state;},start(){act('social.startFirst',{first:p.firsts[0].id});}};
};

test('first offers use the server start action, hide cooldown/completed offers and guide travel without inventing consent',()=>{
 const g=fixture(),{p}=g;let list=firstOffers(g.state,p,actions(g.state,p,registry));
 assert.equal(list.length,1);assert.match(list[0].label,/Jana — the moment’s right/);assert.deepEqual(list[0].command,{type:'social.startFirst',args:{first:p.firsts[0].id}});
 g.state.actors.jana.location='langley';list=firstOffers(g.state,p,actions(g.state,p,registry));assert.equal(list[0].travel,true);assert.deepEqual(list[0].command.args.characters,['jana']);assert.equal(list[0].command.args.location,'langley');
 g.state.modules['social.firsts'].offers[0].after=g.state.tick+1;assert.deepEqual(firstOffers(g.state,p,[]),[]);
 g.state.modules['social.firsts'].offers[0].after=g.state.tick;g.state.modules['social.firsts'].completed.push(p.firsts[0].id);assert.deepEqual(firstOffers(g.state,p,[]),[]);
 const night=fixture('night');night.state.modules['social.intimacy'].characters.jana.active=null;
 list=firstOffers(night.state,night.p,actions(night.state,night.p,registry));assert.equal(list[0].command,null);assert.match(list[0].hint,/ask her again/);
});

test('progress is dots only, reflects engine checkpoints and reveals no wanted tags or scores',()=>{
 const g=fixture();assert.equal(firstProgress(g.state,g.p),null);g.start();
 let progress=firstProgress(g.state,g.p);assert.deepEqual(progress.dots,['current','pending','pending']);
 assert.doesNotMatch(JSON.stringify(progress),/waitingFor|points|verdict|listen|flirt|inputs|step|\d/);
 assert.deepEqual(firstOffers(g.state,g.p,actions(g.state,g.p,registry)),[]);
 g.score();g.score();progress=firstProgress(g.state,g.p);assert.deepEqual(progress.dots,['done','current','pending']);
 assert.ok(actions(g.state,g.p,registry).some(a=>a.type==='social.stopFirst'&&a.enabled));
 g.act('social.stopFirst');assert.equal(firstProgress(g.state,g.p),null);
});

test('recorded score and close turns retain the typed narration and supply the next cue; the end card has exactly one row per checkpoint',()=>{
 const g=fixture();g.start();assert.equal(firstTurn(g.state,g.p).opening,g.p.firsts[0].opening);g.score();g.score();let view=firstTurn(g.state,g.p);
 assert.deepEqual(view.source.sceneLines,[{speaker:'jana',text:'Her narrated reply.'}]);assert.equal(view.cue,'Her leaning-in cue.');assert.equal(firstEndCard(g.state,g.p),null);
 for(let i=0;i<4;i++)g.score();g.act('core.endScene');view=firstTurn(g.state,g.p);
 assert.equal(view.cg,g.p.firsts[0].cg);assert.equal(view.cue,null);assert.ok(view.source.input);
 const card=endCard(g.state,g.p);assert.equal(card.rows.length,3);assert.deepEqual(card.rows.map(r=>r.checkpoint),['Reading the moment','Leaning in','After']);assert.ok(card.rows.every(r=>r.mark==='none'));
 assert.doesNotMatch(JSON.stringify(card.rows),/waitingFor|points|\d/);assert.equal(card.outcome,'completed');
 g.act('core.inspect');assert.equal(firstEndCard(g.state,g.p),null);assert.equal(firstTurn(g.state,g.p),null,'an old first never leaks into a later turn');
});

test('stopped and rejected firsts show their partial verdicts, stay locked in the gallery and remain retryable',()=>{
 const g=fixture('night');g.start();g.score();g.score();g.act('social.stopFirst');
 const card=endCard(g.state,g.p);assert.equal(card.outcome,'stopped');assert.equal(card.rows.length,1);assert.equal(firstProgress(g.state,g.p),null);assert.equal(galleryOf(g.state,g.p)[0].scenes[0].unlocked,false);assert.deepEqual(replayLines(g.state,g.p,g.p.firsts[0].id),[]);
 assert.ok(g.state.modules['social.firsts'].offers.some(o=>o.first===g.p.firsts[0].id));
 const h=fixture('night');h.start();h.act('core.scene',{text:'Come on.',location:'apartment',characters:['jana'],activity:'talk'},'push');h.act('social.priceActs',{character:'jana',source:'push',sceneId:'push',acts:[{kind:'pushy',target:'*',size:'small'}]});h.act('social.scoreFirst',{source:'push',text:'Come on.'});
 assert.equal(firstEndCard(h.state,h.p).outcome,'rejected');assert.equal(galleryOf(h.state,h.p)[0].scenes[0].unlocked,false);
});

test('a completed free first unlocks its CG and replays stored prose and cues without changing state',()=>{
 const g=fixture();g.start();for(let i=0;i<6;i++)g.score();
 const before=JSON.stringify(g.state),gallery=galleryOf(g.state,g.p),lines=replayLines(g.state,g.p,g.p.firsts[0].id);
 assert.equal(gallery[0].name,'Jana');assert.equal(gallery[0].scenes[0].unlocked,true);assert.equal(gallery[0].scenes[0].plays,1);assert.equal(gallery[0].scenes[0].cg,g.p.firsts[0].cg);
 assert.ok(lines.some(l=>l.text==='Her narrated reply.'));assert.ok(lines.some(l=>l.text==='Her leaning-in cue.'));assert.ok(lines.every(l=>l.cg===g.p.firsts[0].cg));assert.equal(JSON.stringify(g.state),before);
});

test('play wires persistent Stop outside dialogue and choices, dots, hub/phone offers and first replies',()=>{
 const read=f=>readFileSync(new URL(`../public/${f}`,import.meta.url),'utf8'),html=read('play.html'),js=read('play.mjs'),css=read('play.css');
 assert.match(html,/<section class="first-controls"[^]*id="first-stop"/);assert.match(js,/firstProgress\(current.state,current.pack\)/);assert.match(js,/firstOffers\(s,p,current.actions\)/);assert.match(js,/import \{playerLines[^}]*\} from '\.\/turn-presentation\.mjs'/);assert.match(readFileSync(new URL('../public/turn-presentation.mjs',import.meta.url),'utf8'),/firstTurn\(s,p\)/);assert.match(readFileSync(new URL('../public/turn-presentation.mjs',import.meta.url),'utf8'),/function playerLines\(data\)\{const lines=linesFor\(data\)/);
 assert.match(js,/#first-stop'\).onclick[^]*social.stopFirst/);assert.match(js,/offers.length\?\[offerList\(\)\]/);assert.match(js,/hubTab==='places'&&offers.length/);assert.match(css,/\.first-controls\[hidden\]/);
});
