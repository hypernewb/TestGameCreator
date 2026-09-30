import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {TONES,NIGHT,STOP_TRUST,STOP_LABEL,FIRST_CHECKPOINTS} from '../packages/cards/beat-library.mjs';
import {typedStop,typedYes,firstBrief} from '../packages/modules/firsts.mjs';

// O1 free-typed firsts (docs/FIRSTS-PLAN.md step 2): Jana's talk, kiss and night as typed firsts on the campus pack, scored from priced acts.
const cue=id=>`Jana's cue for ${id}.`,entry=(rung,trigger,extra={})=>({id:`jana-${rung}-free`,character:'jana',rung,trigger,title:`Jana ${rung}`,opening:`Jana, at the ${rung}.`,checkpoints:FIRST_CHECKPOINTS[rung].map(x=>({id:x.id,cue:cue(x.id)})),...extra});
const pack=()=>{const p=JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url)));
 p.modules['social.firsts']='0.1.0';p.scriptedScenes=p.scriptedScenes.filter(x=>!/^jana-(talk|kiss|night)$/.test(x.id));
 for(const g of p.gallery||[])if(Array.isArray(g.scenes))g.scenes=g.scenes.filter(x=>!/^jana-(talk|kiss|night)$/.test(x.id??x));
 // She likes flirting in this fixture, so the lead and peak have a best to find (campus Jana dislikes touch).
 p.actProfiles.find(x=>x.character==='jana').entries.push({id:'jana-flirt',kind:'flirt',target:'*',points:5,reason:'the flirting'});
 p.firsts=[entry('talk',{event:'test.never'}),entry('kiss',{event:'social.datingPhaseChanged',match:{character:'jana',to:'exclusive'}},{cg:'assets/campus/jana-kiss.png',checkpoints:FIRST_CHECKPOINTS.kiss.map((x,i)=>({id:x.id,cue:cue(x.id),...(i===0?{discover:'jana-active'}:{})}))}),
  entry('night',{event:'social.intimacyStarted',match:{character:'jana',category:'first-night'}},{interest:'jana-slow'})];return p;};
const run=(p,c='jana')=>{let state=createWorld(p,registry,'firsts'),n=0;const edit=f=>{state=structuredClone(state);f(state);};
 const act=(type,args={})=>{edit(s=>{for(const [id,a] of Object.entries(s.actors))a.location=id===p.playerId||id===c?'apartment':a.location==='apartment'?'langley':a.location;});const r=execute(state,{id:`t${n++}`,actorId:p.playerId,type,args,expectedRevision:state.revision},p,registry);state=r.state;return r;};
 return {act,edit,n:0,get state(){return state;},get firsts(){return state.modules['social.firsts'];},get dating(){return state.modules['social.dating'].characters[c];},get trust(){return state.modules['social.relationships'].edges[`${c}--${p.playerId}`]||0;},get intimacy(){return state.modules['social.intimacy'].characters[c];}};};

// One typed turn: the model's tags priced as usual (source = the talk turn), then the recorded scoreFirst reads them.
const say=(g,text,acts=[])=>{const source=`talk-${g.n++}`;if(acts.length)g.act('social.priceActs',{character:'jana',sceneId:g.state.scene?.id||'first',private:true,source,acts:acts.map(kind=>({kind,target:'her-day',size:'medium'}))});return g.act('social.scoreFirst',{source,text});};
const offerTalk=g=>g.edit(s=>{s.modules['social.firsts'].offers=[{first:'jana-talk-free',after:s.tick}];});
const ready=g=>{g.edit(s=>{const d=s.modules['social.dating'].characters.jana;Object.assign(d,{chemistry:90,score:90,phase:'exclusive',agreement:'monogamous'});});};
const bed=g=>{g.act('social.requestIntimacy',{character:'jana',category:'first-night'});return g.act('social.beginIntimacy',{character:'jana',category:'first-night'});};
const night=()=>{const p=pack(),g=run(p);ready(g);bed(g);assert.equal(g.firsts.active?.first,'jana-night-free','the night goes live on intimacyStarted with her here');return {p,g};};
const events=(r,type)=>r.turn.events.filter(e=>e.type===type);

test('firsts validate: the checkpoint shape is fixed by code and the night keeps its check-in',()=>{
 const p=pack();validatePack(p,registry);
 const bad=f=>{const q=pack();f(q);assert.throws(()=>validatePack(q,registry));};
 bad(q=>{q.firsts[2].checkpoints=q.firsts[2].checkpoints.filter(x=>x.id!=='check-in');});
 bad(q=>{q.firsts[1].checkpoints.reverse();});
 bad(q=>{q.firsts[0].checkpoints[0].cue='';});
 bad(q=>{q.firsts.push({...q.firsts[0],id:'again'});});
 bad(q=>{q.firsts[1].cg='../secrets.png';});
 bad(q=>{q.firsts[1].checkpoints[0].discover='nope';});
 bad(q=>{q.firsts[0].interest='jana-slow';});
 bad(q=>{q.firsts[0].character='player';});
});

test('typed-stop floor: stops are stops, "don\'t stop" and "can\'t wait" are not',()=>{
 for(const t of ['stop','Wait.','can we slow down','not tonight','no','No!','please stop','hold on, wait a second','I want to stop'])assert.ok(typedStop(t),t);
 for(const t of ["don't stop","Don’t stop",'I can’t wait','I do not want to stop','never stop','no need to wait',"I don't wanna stop",'I know','nothing','is this okay?'])assert.ok(!typedStop(t),t);
 assert.ok(typedYes('yes, I want this'));assert.ok(typedYes("don't stop"));assert.ok(!typedYes('wait, yes'));assert.ok(!typedYes('maybe'));
});

test('talk: offered first starts on the hub action, a best resolves at once, a light after two inputs, and TONES pays once',()=>{
 const p=pack(),g=run(p);offerTalk(g);
 const a=registry['social.firsts'].actions(g.state,p);assert.deepEqual(a.map(x=>x.type),['social.startFirst']);assert.match(a[0].label,/Jana: the moment's right/);
 const r=g.act('social.startFirst',{first:'jana-talk-free'});assert.equal(events(r,'social.firstStarted')[0].payload.text,'Jana, at the talk.');
 assert.deepEqual(registry['social.firsts'].actions(g.state,p),[{label:STOP_LABEL,type:'social.stopFirst',args:{}}],'Stop is the only first action while it is live');
 assert.equal(firstBrief(g.state,p).cue,cue('opening-up'));assert.deepEqual(firstBrief(g.state,p).waitingFor,['listen','compliment']);
 const best=say(g,'Tell me about the island.',['listen']);assert.equal(events(best,'social.firstCheckpoint')[0].payload.verdict,'best');assert.equal(g.firsts.active.checkpoint,1);
 say(g,'Hm.');assert.equal(g.firsts.active.checkpoint,1,'one input without a read is not enough to resolve');
 // Priced acts move chemistry on their own; the first pays its TONES on the scoring turn, once.
 const chem=g.dating.chemistry,trust=g.trust,light=say(g,'Anyway.');assert.equal(events(light,'social.firstCheckpoint')[0].payload.verdict,'light');
 assert.equal(g.firsts.active,null);assert.deepEqual(g.firsts.completed,['jana-talk-free']);assert.ok(g.state.flags['jana-talked']);
 const [c,t]=TONES.good;assert.equal(g.dating.chemistry,Math.min(100,chem+c));assert.equal(g.trust,Math.min(100,trust+t));
 assert.equal(events(light,'social.firstCompleted')[0].payload.tone,'good');
 assert.throws(()=>g.act('social.startFirst',{first:'jana-talk-free'}),/already happened/);
});

test('scoreFirst ignores a source it already scored, and a miss resolves at once',()=>{
 const p=pack(),g=run(p);offerTalk(g);g.act('social.startFirst',{first:'jana-talk-free'});
 g.act('social.priceActs',{character:'jana',sceneId:'first',private:true,source:'dup',acts:[{kind:'pushy',target:'her-day',size:'medium'}]});
 const r=g.act('social.scoreFirst',{source:'dup',text:'come on'});assert.equal(events(r,'social.firstCheckpoint')[0].payload.verdict,'miss');
 const again=g.act('social.scoreFirst',{source:'dup',text:'come on'});assert.equal(events(again,'social.firstCheckpoint').length,0);assert.equal(g.firsts.active.checkpoint,1);
});

test('kiss: fires on the phase change, a miss makes leaning in strict, discover pays on best, flag and CG on completion',()=>{
 const p=pack(),g=run(p);g.edit(s=>{Object.assign(s.modules['social.dating'].characters.jana,{chemistry:90,score:90,phase:'dating'});});
 g.act('social.defineRelationship',{character:'jana',agreement:'monogamous'});assert.equal(g.firsts.active?.first,'jana-kiss-free');
 const r=say(g,'You are funny.',['listen']);assert.ok(events(r,'social.preferenceDiscovered').some(e=>e.payload.preference==='jana-active'||JSON.stringify(e.payload).includes('jana-active')),'a best on a discover checkpoint reveals her preference');
 const miss=say(g,'Just kiss me already.',['pushy']);assert.equal(events(miss,'social.firstCheckpoint')[0].payload.verdict,'miss','pushy is a miss');
 const done=say(g,'Ha.',['tease']);assert.equal(events(done,'social.firstCheckpoint')[0].payload.verdict,'best');
 assert.ok(g.state.flags['jana-kissed']);const fin=events(done,'social.firstCompleted')[0].payload;assert.equal(fin.cg,'assets/campus/jana-kiss.png');assert.equal(fin.tone,'spark');
 // Strict: after a miss, a leaning-in that only half-lands counts as a miss.
 const h=run(p);h.edit(s=>{Object.assign(s.modules['social.dating'].characters.jana,{chemistry:90,score:90,phase:'dating'});});h.act('social.defineRelationship',{character:'jana',agreement:'monogamous'});
 say(h,'Whatever.',['pushy']);say(h,'Hm.');const strict=say(h,'So.');assert.equal(events(strict,'social.firstCheckpoint')[0].payload.verdict,'miss');
});

test('open checkpoints: on the physical beat a wanted act she doesn\'t dislike is best; elsewhere it takes a like',()=>{
 const p=pack(),g=run(p);g.edit(s=>{Object.assign(s.modules['social.dating'].characters.jana,{chemistry:90,score:90,phase:'dating'});});g.act('social.defineRelationship',{character:'jana',agreement:'monogamous'});
 const plain=say(g,'You look great today.',['compliment']);assert.equal(events(plain,'social.firstCheckpoint').length,0,'a neutral compliment is not best on reading, which is not open');
 say(g,'Tell me more.',['listen']);assert.equal(g.firsts.active.checkpoint,1);
 const lean=say(g,'I brush her hair back.',['touch']);assert.equal(events(lean,'social.firstCheckpoint')[0].payload.verdict,'best','private touch matches no entry for Jana, so it is neutral, and leaning-in is open');
 // In public her touch entry is a dislike: still a miss on an open beat.
 const h=run(p);h.edit(s=>{Object.assign(s.modules['social.dating'].characters.jana,{chemistry:90,score:90,phase:'dating'});});h.act('social.defineRelationship',{character:'jana',agreement:'monogamous'});say(h,'Tell me.',['listen']);
 h.act('social.priceActs',{character:'jana',sceneId:'first',private:false,source:'pub',acts:[{kind:'touch',target:'her-day',size:'medium'}]});
 assert.equal(events(h.act('social.scoreFirst',{source:'pub',text:'I grab her hand.'}),'social.firstCheckpoint')[0].payload.verdict,'miss');
 assert.deepEqual(Object.entries(FIRST_CHECKPOINTS).flatMap(([r,cs])=>cs.filter(x=>x.open).map(x=>`${r}.${x.id}`)),['date.moment','kiss.leaning-in','night.lead']);
});

test('night: NIGHT pays per checkpoint, the lead teaches her interest, and the peak completes the intimacy',()=>{
 const {p,g}=night(),sat=()=>g.dating.satisfaction,trust0=g.trust;let s0=sat();
 say(g,'I kiss her slowly.',['flirt']);assert.equal(sat(),s0+NIGHT.lead[0]);assert.ok(g.state.modules['social.intimacy'].characters.jana.discovered?.includes?.('jana-slow')||JSON.stringify(g.state.modules['social.intimacy']).includes('jana-slow'),'the lead reveals her interest');
 s0=sat();say(g,'Is this okay? What do you want?',['ask']);assert.equal(sat(),s0+NIGHT.honest[0]);assert.equal(g.trust,Math.min(100,trust0+NIGHT.honest[1]));
 s0=sat();const done=say(g,'I hold her close.',['flirt']);assert.equal(events(done,'social.firstCompleted').length,1);
 assert.ok(g.state.flags['jana-first-night']);assert.equal(g.intimacy.active,null);assert.ok(g.intimacy.encounters.length,'the intimacy completed');assert.equal(firstBrief(g.state,p),null);
});

test('night: no peak without the check-in, however the player types around it',()=>{
 const {g}=night();say(g,'I kiss her.',['flirt']);assert.equal(g.firsts.active.checkpoint,1);
 for(const [t,acts] of [['I take her to bed.',['flirt']],['I undress her.',['touch']],['Let us skip ahead.',['flirt','listen']],['...',[]],['Mm.',['compliment']]]){say(g,t,acts);assert.equal(g.firsts.active?.checkpoint,1,t);}
 assert.ok(!g.state.flags['jana-first-night']);assert.ok(g.intimacy.active,'still waiting, nothing completed');
 const yes=say(g,'Yes, I want this.');assert.equal(events(yes,'social.firstCheckpoint')[0].payload.verdict,'light','a typed yes to her question clears it lightly');assert.equal(g.firsts.active.checkpoint,2);
});

for(const at of [0,1,2])for(const how of ['button','typed'])test(`night: ${how} stop at checkpoint ${at} withdraws consent and the first can be retried`,()=>{
 const {p,g}=night();if(at>0)say(g,'I kiss her.',['flirt']);if(at>1)say(g,'Is this okay?',['ask']);assert.equal(g.firsts.active.checkpoint,at);
 const trust=g.trust,r=how==='button'?g.act('social.stopFirst'):say(g,'Wait, can we slow down?',['flirt']);
 assert.equal(events(r,'social.firstStopped').length,1);assert.equal(g.firsts.active,null);assert.equal(g.intimacy.active,null);assert.equal(g.intimacy.consent?.['first-night']?.status??'withdrawn','withdrawn');
 assert.ok(r.turn.events.some(e=>e.type==='social.consentWithdrawn'));assert.equal(g.trust,Math.min(100,trust+STOP_TRUST));assert.ok(!g.state.flags['jana-first-night']);assert.equal(events(r,'social.firstCheckpoint').length,0);
 assert.deepEqual(g.firsts.offers.map(x=>x.first),['jana-night-free'],'routes never close');assert.deepEqual(registry['social.firsts'].actions(g.state,p),[],'the offer waits for her to want it again');
});

test('kiss: "don\'t stop" and "can\'t wait" keep going; a typed stop ends it without the night effects',()=>{
 const p=pack(),g=run(p);g.edit(s=>{Object.assign(s.modules['social.dating'].characters.jana,{chemistry:90,score:90,phase:'dating'});});g.act('social.defineRelationship',{character:'jana',agreement:'monogamous'});
 say(g,"Don't stop.");say(g,"I can't wait.");assert.equal(g.firsts.active?.checkpoint,1,'two inputs, a light, still going');
 const trust=g.trust,r=say(g,'Stop.');assert.equal(events(r,'social.firstStopped')[0].payload.why,'typed');assert.equal(g.trust,trust);assert.ok(!g.state.flags['jana-kissed']);
});

test('night: pushy ends it as a remembered rejection without completing, and it can be retried to completion',()=>{
 const {p,g}=night(),s0=g.dating.satisfaction;const r=say(g,'Come on, you know you want to.',['pushy']);
 assert.equal(events(r,'social.firstRejected').length,1);assert.equal(events(r,'social.firstStopped').length,0,'the consent reaction does not double-end it');
 assert.equal(g.dating.satisfaction,Math.max(0,s0+NIGHT.rush[0]));assert.equal(g.intimacy.active,null);assert.ok(!g.state.flags['jana-first-night']);assert.ok(r.turn.events.some(e=>e.type==='social.consentDeclined'));
 assert.equal(g.firsts.history.at(-1).outcome,'rejected');assert.deepEqual(g.firsts.offers.map(x=>x.first),['jana-night-free']);
 // Later: she wants it again, the offer goes live on the next intimacyStarted.
 g.edit(s=>{s.tick+=24;const i=s.modules['social.intimacy'].characters.jana;i.cooldownUntil=0;i.consent={};});bed(g);assert.equal(g.firsts.active?.first,'jana-night-free');
 say(g,'I kiss her.',['flirt']);say(g,'Is this okay?',['ask']);say(g,'I hold her.',['flirt']);assert.ok(g.state.flags['jana-first-night']);assert.deepEqual(g.firsts.offers,[]);
});

test('a scene ending mid-first puts it back on offer; replay of the whole run is identical',()=>{
 const p=pack(),g=run(p);offerTalk(g);g.act('core.scene',{text:'Hey',location:'apartment',characters:['jana'],activity:'talk'});g.act('social.startFirst',{first:'jana-talk-free'});
 const r=g.act('core.endScene');assert.equal(events(r,'social.firstStopped')[0]?.payload.outcome,'abandoned');assert.equal(g.firsts.active,null);assert.deepEqual(g.firsts.offers.map(x=>x.first),['jana-talk-free']);
 const play=()=>{const {g:h}=night();say(h,'I kiss her.',['flirt']);say(h,'Is this okay?',['ask']);say(h,'I hold her.',['flirt']);return h.state;};
 assert.deepEqual(play(),play(),'the same recorded commands rebuild the same world');
});
