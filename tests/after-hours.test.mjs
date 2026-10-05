import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createWorld,execute,validatePack,replay,actions} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {analyzeSceneGraphs} from '../packages/modules/scenes.mjs';
const pack=JSON.parse(readFileSync(new URL('./fixtures/route-mechanics.json',import.meta.url)));
// Days 2-14 storylets. Route tests skip them (leave, not complete) so they exercise one thread at a time; harness(p,[ids]) keeps the listed ones.
const side=new Set(['juno-limes','juno-dream','juno-flea','theo-busking','theo-notebook','theo-song','juno-flea-ask','juno-no-show','theo-song-ask','theo-no-show','priya-books','priya-tips','rowdy-regular','open-mic-heckler','theo-request','friday-rush','staff-drinks','juno-needles','priya-candid','juno-text','theo-voicenote','till-short','ex-at-the-bar','market-shakedown','landlord-inspection','crate-digging','pub-quiz','market-hustle','study-slate','after-work-drinks','stock-windfall']);
function harness(p,keep=[]){const skip=true;let s=createWorld(p,registry,'test');const run=(type,args)=>{const r=execute(s,{id:`t${s.revision}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,registry);s=r.state;return r;};
 return {get state(){return s;},act(type,args={}){const r=run(type,args);while(skip&&side.has(s.modules['story.scenes'].pending)&&!keep.includes(s.modules['story.scenes'].pending))run('story.leave',{scene:s.modules['story.scenes'].pending});return r;}};}
const ev=(r,type)=>r.turn.events.find(e=>e.type===type);
const stat=(h,id)=>h.state.modules['character.stats'].values[`player--${id}`];
const doing=(h,id,location='bar')=>{const who=pack.activities.find(a=>a.id===id).character,go=()=>h.act('core.scene',{text:id,location,characters:[who].filter(Boolean),activity:'other',activityId:id});
 for(let i=0;i<24;i++){try{return go();}catch(e){if(!/isn't there right now/.test(e.message))throw e;h.state.actors[who].location!==location&&h.state.actors.player.location===location?h.act('core.waitUntil',{actor:who}):h.act('core.wait');}}return go();};
const waitTo=(h,tick)=>{while(h.state.tick<tick){const p=h.state.modules['story.scenes'].pending;if(p)h.act('story.leave',{scene:p});else h.act('core.wait');}};
const choice=(h,id)=>actions(h.state,pack,registry).find(a=>a.args?.choice===id);

test('route mechanics fixture validates and every scene graph is reachable',()=>{
 validatePack(pack,registry);
 for(const g of analyzeSceneGraphs(pack))assert.deepEqual(g.unreachable,[],g.scene);
 const flagsSet=new Set(JSON.stringify(pack).match(/"type": ?"flag", ?"id": ?"[^"]+"/g).map(x=>x.match(/"([^"]+)"$/)[1]));
 for(const sc of pack.scriptedScenes)for(const c of [...sc.choices,...(sc.beats||[]).flatMap(b=>b.choices)])for(const m of c.check?.modifiers||[])for(const f of Object.keys(m.when.flags||{}))assert.ok(flagsSet.has(f),`${sc.id} modifier needs unreachable flag ${f}`);
});

test('Juno route: a failed ask fails forward, training and a callback win the rematch',()=>{
 const h=harness(pack);h.act('core.move',{to:'bar'});
 const banter=choice(h,'banter');assert.match(banter.label,/^\[Wit · Sharp ✗\]/);
 let r=h.act('story.choose',{scene:'first-night',choice:'banter'});assert.equal(ev(r,'story.checkResolved').payload.passed,false);assert.equal(stat(h,'wit'),4,'failing taught a little Wit');
 doing(h,'bar-shift');assert.equal(stat(h,'charm'),4);
 assert.match(choice(h,'flirt-back').label,/^\[Charm · Likable ✓\]/);h.act('story.choose',{scene:'juno-shift',choice:'flirt-back'});assert.equal(h.state.flags['juno-flirt'],true);
 doing(h,'stay-after-close');
 const ask=choice(h,'say-it');assert.match(ask.label,/^\[Nerve · Bold ✗\]/);assert.equal(ask.check.value,2);
 r=h.act('story.choose',{scene:'juno-after-close',choice:'say-it'});assert.equal(h.state.flags['juno-dare-owed'],true);assert.equal(h.state.flags['juno-kissed'],undefined);assert.equal(stat(h,'nerve'),3);
 doing(h,'open-mic');doing(h,'open-mic');assert.equal(stat(h,'nerve'),7);
 doing(h,'stay-after-close');const again=choice(h,'properly');assert.match(again.label,/✓/);assert.deepEqual(again.check.modifiers.map(m=>m.label),["She's been waiting for this"]);
 h.act('story.choose',{scene:'juno-rematch',choice:'properly'});assert.equal(h.state.flags['juno-kissed'],true);
 h.act('core.inspect');assert.ok(choice(h,'keep-quiet'),'Priya saw the kiss');
 assert.deepEqual(replay(createWorld(pack,registry,'test'),h.state.events).modules,h.state.modules);
});

test('gear is a choice: the jacket carries a Nerve check the player could not pass alone',()=>{
 const h=harness(pack);h.act('items.equip',{item:'leather-jacket'});h.act('core.move',{to:'bar'});h.act('story.choose',{scene:'first-night',choice:'just-work'});
 doing(h,'bar-shift');h.act('story.choose',{scene:'juno-shift',choice:'flirt-back'});
 doing(h,'open-mic');doing(h,'open-mic');doing(h,'stay-after-close');
 const ask=choice(h,'say-it');assert.equal(ask.check.value,8);assert.deepEqual(ask.check.modifiers.map(m=>m.label),['Leather jacket']);
 h.act('story.choose',{scene:'juno-after-close',choice:'say-it'});assert.equal(h.state.modules['story.scenes'].pendingBeat,'close');
 h.act('story.choose',{scene:'juno-after-close',choice:'rain-check'});assert.equal(h.state.flags['juno-rain-check'],true,'declining the kiss needs no check');
});

test('Theo route and the gossip fallout: a failed cover-up spreads, a failed lie costs Theo',()=>{
 const h=harness(pack);h.act('items.equip',{item:'leather-jacket'});h.act('core.move',{to:'bar'});h.act('story.choose',{scene:'first-night',choice:'theo-song'});assert.equal(h.state.flags['theo-asked'],undefined,'Empathy 3 misses Attentive');
 doing(h,'listen-theo');assert.match(choice(h,'name-it').label,/Empathy · Warm/);
 h.act('story.choose',{scene:'theo-piano',choice:'just-listen'});assert.equal(h.state.flags['theo-opened'],true);assert.equal(h.state.flags['theo-kind'],true);
 doing(h,'bar-shift');h.act('story.choose',{scene:'juno-shift',choice:'flirt-back'});doing(h,'open-mic');doing(h,'open-mic');doing(h,'stay-after-close');
 h.act('story.choose',{scene:'juno-after-close',choice:'say-it'});h.act('story.choose',{scene:'juno-after-close',choice:'kiss'});
 h.act('core.inspect');assert.match(choice(h,'keep-quiet').label,/^\[Charm · Magnetic ✗\]/);
 h.act('story.choose',{scene:'priya-saw',choice:'keep-quiet'});assert.equal(h.state.flags['theo-heard'],true);
 if(h.state.modules['story.scenes'].pending==='theo-last-song')h.act('story.choose',{scene:'theo-last-song',choice:'goodnight'});if(h.state.actors.theo.location!=='bar')h.act('core.waitUntil',{actor:'theo'});h.act('core.inspect');if(h.state.modules['story.scenes'].pending==='theo-last-song')h.act('story.choose',{scene:'theo-last-song',choice:'goodnight'});assert.equal(h.state.modules['story.scenes'].pending,'theo-heard');assert.match(choice(h,'deny').label,/^\[Wit · Quick ✗\]/);
 const r=h.act('story.choose',{scene:'theo-heard',choice:'deny'});assert.equal(ev(r,'story.checkResolved').payload.passed,false);assert.equal(h.state.flags['theo-hurt'],true);assert.equal(h.state.flags['lied-to-theo'],undefined);
 assert.deepEqual(replay(createWorld(pack,registry,'test'),h.state.events).modules,h.state.modules);
});

const junoKissed=h=>{h.act('items.equip',{item:'leather-jacket'});h.act('core.move',{to:'bar'});h.act('story.choose',{scene:'first-night',choice:'banter'});doing(h,'bar-shift');h.act('story.choose',{scene:'juno-shift',choice:'flirt-back'});doing(h,'open-mic');doing(h,'open-mic');doing(h,'stay-after-close');h.act('story.choose',{scene:'juno-after-close',choice:'say-it'});h.act('story.choose',{scene:'juno-after-close',choice:'kiss'});};
const named=(h,re)=>actions(h.state,pack,registry).find(a=>re.test(a.label));
const intim=(h,c)=>h.state.modules['social.intimacy'].characters[c];
const sat=(h,c)=>h.state.modules['social.dating'].characters[c].satisfaction;
const toBed=(h,c)=>{h.act('social.invite',{character:c,to:'flat'});h.act('social.requestIntimacy',{character:c,category:'first-night'});return h.act('social.beginIntimacy',{character:c,category:'first-night'});};

test('rung 4: a kiss starts dating, the invite and the ask are buttons, Nerve shapes the night and aftercare is heard',()=>{
 const h=harness(pack);h.act('core.move',{to:'bar'});assert.equal(named(h,/^Invite Juno/),undefined,'no invite home before there is trust or a date');
 const fresh=harness(pack);junoKissed(fresh);const g=fresh;assert.equal(g.state.modules['social.dating'].characters.juno.phase,'dating');
 assert.equal(named(g,/^Ask Juno:/),undefined,'the ask waits for somewhere private');
 const invite=named(g,/^Invite Juno back to Your flat$/);assert.deepEqual(invite.args,{character:'juno',to:'flat'});
 g.act(invite.type,invite.args);assert.equal(g.state.actors.juno.location,'flat');
 const ask=named(g,/^Ask Juno: Take it to bed\?$/);assert.ok(ask);g.act(ask.type,ask.args);
 assert.ok(named(g,/^Stop: Take it to bed with Juno$/),'stopping is always offered once she says yes');
 const r=g.act('social.beginIntimacy',{character:'juno',category:'first-night'});assert.ok(ev(r,'story.sceneStarted'));assert.equal(g.state.modules['story.scenes'].pending,'juno-night');
 const lead=choice(g,'take-lead');assert.match(lead.label,/^\[Nerve · Bold ✓\]/);assert.deepEqual(lead.check.modifiers.map(m=>m.label),['Leather jacket']);assert.match(choice(g,'stop').label,/^Say you want to stop here$/);
 g.act('story.choose',{scene:'juno-night',choice:'take-lead'});assert.equal(g.state.modules['story.scenes'].pendingBeat,'check-in');assert.equal(intim(g,'juno').encounters.length,0,'one choice is not the whole night');
 assert.match(choice(g,'stop').label,/stop/i,'the check-in offers a stop too');g.act('story.choose',{scene:'juno-night',choice:'ask-her'});assert.equal(g.state.modules['story.scenes'].pendingBeat,'peak');
 g.act('story.choose',{scene:'juno-night',choice:'contest'});
 const j=intim(g,'juno');assert.equal(j.encounters.at(-1).outcome,'positive');assert.deepEqual(j.knownInterests,['juno-lead','juno-contest']);assert.equal(sat(g,'juno'),63);assert.equal(g.state.flags['juno-night'],true);
 assert.equal(named(g,/^Stop:/),undefined,'nothing left to stop');
 const space=named(g,/^Afterwards with Juno: Give some space$/);g.act(space.type,space.args);assert.equal(sat(g,'juno'),63+8,'Juno likes being let go');assert.equal(intim(g,'juno').pendingAftercare,null);
 assert.deepEqual(replay(createWorld(pack,registry,'test'),g.state.events).modules,g.state.modules);
});

test('rung 4: stopping is never checked, always honoured, and ends the scene either way',()=>{
 const a=harness(pack);junoKissed(a);toBed(a,'juno');
 const r=a.act('story.choose',{scene:'juno-night',choice:'stop'});assert.equal(ev(r,'story.checkResolved'),undefined);assert.equal(ev(r,'social.intimacyCompleted'),undefined);
 assert.equal(intim(a,'juno').active,null);assert.equal(intim(a,'juno').consent['first-night'].status,'withdrawn');assert.equal(a.state.modules['story.scenes'].pending,null);assert.equal(named(a,/^Ask Juno:/),undefined,'no re-asking after a stop');
 const b=harness(pack);junoKissed(b);toBed(b,'juno');const stop=named(b,/^Stop: Take it to bed with Juno$/);
 const w=b.act(stop.type,stop.args);assert.ok(ev(w,'story.sceneDismissed'));assert.equal(b.state.modules['story.scenes'].pending,null);assert.equal(intim(b,'juno').active,null);assert.equal(b.state.flags['juno-night'],undefined);
});

test('Theo: Empathy reads him, a skipped goodbye costs more than it does with Juno',()=>{
 const h=harness(pack);h.act('items.equip',{item:'leather-jacket'});h.act('core.move',{to:'bar'});h.act('story.choose',{scene:'first-night',choice:'theo-song'});
 doing(h,'listen-theo');h.act('story.choose',{scene:'theo-piano',choice:'just-listen'});h.act('core.wait');h.act('core.inspect');h.act('story.choose',{scene:'theo-last-song',choice:'sit-beside'});
 doing(h,'walk-theo-home');h.act('story.choose',{scene:'theo-canal',choice:'kiss-him'});assert.equal(h.state.modules['social.dating'].characters.theo.phase,'dating');
 toBed(h,'theo');assert.equal(h.state.modules['story.scenes'].pending,'theo-night');
 const read=choice(h,'read-him');assert.match(read.label,/^\[Empathy · [A-Za-z]+ ✓\]/);assert.deepEqual(read.check.modifiers.map(m=>m.label),['He trusted you with the song']);
 for(const c of ['read-him','ask','slow'])h.act('story.choose',{scene:'theo-night',choice:c});assert.equal(sat(h,'theo'),63);assert.deepEqual(intim(h,'theo').knownInterests,['theo-slow','theo-tender']);
 for(let i=0;i<3;i++)h.act('core.wait');assert.ok(h.state.events.some(e=>e.type==='social.aftercareMissed'));assert.equal(sat(h,'theo'),63-8);
});

const toLastCall=h=>{for(let i=0;i<400&&h.state.modules['story.scenes'].pending!=='last-call';i++){const p=h.state.modules['story.scenes'].pending;if(p)h.act('story.leave',{scene:p});else h.act('core.wait');}assert.equal(h.state.modules['story.scenes'].pending,'last-call');};
test('last call: day 14 evening finds you wherever you are, ends the trial and unlocks endings from what happened',()=>{
 const h=harness(pack);junoKissed(h);h.act('social.invite',{character:'juno',to:'flat'});
 toLastCall(h);assert.ok(h.state.tick>=212);h.act('story.leave',{scene:'last-call'});while(h.state.modules['story.scenes'].pending)h.act('story.leave',{scene:h.state.modules['story.scenes'].pending});
 h.act('core.wait');assert.equal(h.state.modules['story.scenes'].pending,'last-call','walking away does not lose the finale');
 h.act('story.choose',{scene:'last-call',choice:'stay-on'});
 assert.deepEqual(h.state.modules['story.endings'].unlocked,['juno-last-one-out']);
 const end=named(h,/^Choose ending: Last one out$/);h.act(end.type,end.args);assert.equal(h.state.modules['story.endings'].selected,'juno-last-one-out');
 const early=harness(pack);waitTo(early,198);assert.ok(!early.state.events.some(e=>e.type==='story.sceneStarted'&&e.payload.scene==='last-call'),'not before day 16 evening');
});

const plan=(h,id)=>(h.state.modules['story.scenes'].plans||[]).filter(x=>x.id===id).at(-1)?.status;
const chem=(h,c)=>h.state.modules['social.dating'].characters[c].chemistry;

test('routines: Juno does the morning market run, Theo busks until evening, and the market has its own storylet',()=>{
 const h=harness(pack,['juno-limes']);assert.equal(h.state.actors.juno.location,'bar');waitTo(h,11);assert.equal(h.state.actors.juno.location,'bar','day one is the trial shift');assert.equal(h.state.actors.theo.location,'bar');
 waitTo(h,12);assert.equal(h.state.actors.juno.location,'market');assert.equal(h.state.actors.theo.location,'canal');
 h.act('core.move',{to:'market'});assert.equal(h.state.modules['story.scenes'].pending,'juno-limes');assert.match(choice(h,'haggle').label,/^\[Wit · Sharp ✗\]/);
 h.act('story.choose',{scene:'juno-limes',choice:'carry'});doing(h,'market-run','market');assert.equal(stat(h,'wit'),4);h.act('core.endScene');
 const again=h.act('core.scene',{text:'again',location:'market',characters:['juno'],activity:'other',activityId:'market-run'});const redirected=ev(again,'world.meetingRedirect');assert.ok(redirected,'she has gone back to open the bar');assert.match(redirected.payload.text,/not at Hollis Street market/);assert.match(redirected.payload.text,/at The Velvet Room right now/);assert.equal(again.state.actors.player.location,'market');assert.equal(again.state.tick,h.state.tick, 'the redirect costs no ticks');
 waitTo(h,20);assert.equal(h.state.actors.juno.location,'bar');assert.equal(h.state.actors.theo.location,'bar');
});

const toEvening=(h,id)=>{for(let i=0;i<40&&h.state.modules['story.scenes'].pending!==id;i++){const p=h.state.modules['story.scenes'].pending;if(p)h.act('story.choose',{scene:p,choice:actions(h.state,pack,registry).find(a=>a.type==='story.choose'&&!a.check)?.args.choice});else if(h.state.tick%12<8)h.act('core.wait');else if(!h.state.events.some(e=>e.type==='core.inspected'&&e.tick===h.state.tick))h.act('core.inspect');else h.act('core.wait');}assert.equal(h.state.modules['story.scenes'].pending,id);};

test('a date is a plan: show up on time and it is kept',()=>{
 const h=harness(pack,['juno-flea-ask','juno-flea','juno-limes']);junoKissed(h);toEvening(h,'juno-flea-ask');
 h.act('story.choose',{scene:'juno-flea-ask',choice:'yes'});assert.equal(plan(h,'juno-flea'),'pending');
 waitTo(h,Math.ceil(h.state.tick/12)*12);h.act('core.move',{to:'market'});
 if(h.state.modules['story.scenes'].pending==='juno-limes')h.act('story.choose',{scene:'juno-limes',choice:'carry'});
 assert.equal(h.state.modules['story.scenes'].pending,'juno-flea');const before=chem(h,'juno');
 const r=h.act('story.choose',{scene:'juno-flea',choice:'carry'});assert.ok(ev(r,'story.planKept'));assert.equal(plan(h,'juno-flea'),'kept');assert.equal(chem(h,'juno'),before+3);
 assert.deepEqual(replay(createWorld(pack,registry,'test'),h.state.events).modules,h.state.modules);
});

test('a date is a plan: miss it and the phone tells you, and the date scene never plays',()=>{
 const h=harness(pack,['juno-flea-ask','juno-no-show','juno-flea']);junoKissed(h);toEvening(h,'juno-flea-ask');h.act('story.choose',{scene:'juno-flea-ask',choice:'yes'});
 const before=chem(h,'juno');for(let i=0;i<20&&h.state.modules['story.scenes'].pending!=='juno-no-show';i++)h.act('core.wait');
 assert.equal(plan(h,'juno-flea'),'broken');assert.equal(h.state.modules['story.scenes'].pending,'juno-no-show');
 h.act('story.choose',{scene:'juno-no-show',choice:'sorry'});assert.equal(chem(h,'juno'),before-4);
 waitTo(h,Math.ceil(h.state.tick/12)*12+1);h.act('core.move',{to:'market'});assert.notEqual(h.state.modules['story.scenes'].pending,'juno-flea','a broken plan does not replay as a date');
});

test('the play view shows check numbers as they resolve, and an ending replaces the actions with a closing card',async()=>{
 const {createApp}=await import('../server.mjs'),{mkdtempSync,rmSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const dir=mkdtempSync(join(tmpdir(),'route-view-')),app=createApp({dataPath:join(dir,'campaigns.sqlite')});app.packs[pack.id]=pack;await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 try{const url=`http://127.0.0.1:${app.server.address().port}`,post=async(path,body)=>{const res=await fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await res.json();assert.equal(res.status,200,JSON.stringify(d));return d;};
  let v=await post('/api/new',{packId:pack.id});const id=v.state.campaignId,turn=async(type,args)=>{v=await post('/api/action',{campaignId:id,id:`v${v.state.revision}`,expectedRevision:v.state.revision,command:{type,actorId:pack.playerId,args}});return v;};
  await turn('core.move',{to:'bar'});await turn('story.choose',{scene:'first-night',choice:'banter'});
  const check=v.diagnostics.highlights.find(x=>x.type==='story.checkResolved');assert.equal(check.passed,false);assert.match(check.text,/\(\d+ vs \d+\)$/);assert.equal(v.diagnostics.ended,null);
  const s=createWorld(pack,registry,'ended-view');s.modules['story.endings'].selected='closing-time';app.store.insert(s);
  v=await post('/api/load',{id:'ended-view'});assert.equal(v.diagnostics.ended.name,pack.endings.find(e=>e.id==='closing-time').name);assert.deepEqual(v.actions,[]);
 }finally{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});}
});

test('another night is its own scene: it repeats, asks for more than the first, and builds on what the first taught',()=>{
 const g=harness(pack);junoKissed(g);
 const night=()=>{for(let i=0;i<40&&intim(g,'juno').cooldownUntil>g.state.tick;i++)g.act('core.wait');const at=g.state.actors.juno.location;if(g.state.actors.player.location!==at)g.act('core.move',{to:at});
  if(at!=='flat'){const inv=named(g,/^Invite Juno back to Your flat$/);assert.ok(inv,'invite offered');g.act(inv.type,inv.args);}
  const ask=named(g,/^Ask Juno: Take it to bed\?$/);assert.ok(ask,'ask offered');g.act(ask.type,ask.args);g.act('social.beginIntimacy',{character:'juno',category:'first-night'});return g.state.modules['story.scenes'].pending;};
 assert.equal(night(),'juno-night');for(const c of ['take-lead','yes','contest'])g.act('story.choose',{scene:'juno-night',choice:c});assert.equal(g.state.flags['juno-led'],true);
 const aftercare=()=>{const a=named(g,/^Afterwards with Juno: Give some space$/);if(a)g.act(a.type,a.args);};aftercare();
 assert.equal(night(),'juno-again','the first night never replays');
 const surprise=choice(g,'surprise-her');assert.match(surprise.label,/^\[Nerve · Fearless [✓✗]\]/);assert.ok(surprise.check.modifiers.some(m=>m.label==='She knows you mean it'));
 const before=sat(g,'juno');g.act('story.choose',{scene:'juno-again',choice:'let-her-lead'});assert.equal(sat(g,'juno'),before+2+2,'a familiar night is good, not new; the style she likes still counts');aftercare();
 assert.equal(night(),'juno-again','repeatable');g.act('story.choose',{scene:'juno-again',choice:'stop'});
 assert.equal(g.state.modules['story.scenes'].completed.filter(x=>x==='juno-again').length,1,'completed once, not per repeat');
 assert.deepEqual(replay(createWorld(pack,registry,'test'),g.state.events).modules,g.state.modules);
});

test('typed play: a phrase inside a longer sentence starts the shift, choices and dressing work mid-scene, none of it calls the model',async()=>{
 const {Store}=await import('../packages/persistence/store.mjs'),{GameService}=await import('../packages/ai/service.mjs');
 let calls=0;const no=async()=>{calls++;throw Error('model called');},model={name:'must-not-run',generateScene:no,interpretScene:no,generateLedger:no,interpret:no,narrate:no};
 const store=new Store();store.insert(createWorld(pack,registry,'typed'));const svc=new GameService(store,{[pack.id]:pack},registry,model);
 const say=input=>svc.act('typed',{id:`t${store.load('typed').revision}`,expectedRevision:store.load('typed').revision,input});
 try{let r=await say('I greet juno while I get to work');assert.equal(r.turn.command.args.activityId,'bar-shift');assert.equal(r.state.modules['world.economy'].balance,100,'the shift pays');
  assert.match(r.turn.narrative,/^Four hours of orders/);assert.match(r.turn.narrative,/Charm rose/);assert.equal(r.state.modules['story.scenes'].pending,'first-night');
  const tick=r.state.tick;r=await say('wear my jacket');assert.equal(r.turn.command.type,'items.equip');assert.equal(r.turn.provider,'Game rules');assert.equal(r.state.tick,tick,'dressing is free');
  assert.equal(r.state.modules['items.equipment'].slots.outer,'leather-jacket');
  r=await say("I tell Juno I'll just get to work");assert.equal(r.turn.command.type,'story.choose');assert.equal(r.turn.command.args.choice,'just-work');
  assert.match(r.turn.narrative,/^You carry crates/,'the choice result is shown before the next scene');
  r=await say('leave');assert.equal(r.turn.command.type,'story.leave');assert.equal(calls,0);
 }finally{store.close();}
});

// Venus rebase: a solo activity is still a model scene; the rules commit the stat first and the model narrates from that outcome.
test('each place lists its activities with what they raise, and doing a solo one is narrated by the model from its committed outcome',async()=>{
 const {Store}=await import('../packages/persistence/store.mjs'),{GameService}=await import('../packages/ai/service.mjs');
 let calls=0;const seen=[],model={name:'probe',async generateScene(context){calls++;seen.push(context);return {lines:[{speaker:'',text:'You work the crossword down to the last clue.'}]};},async generateLedger(){return [];}};
 const store=new Store();store.insert(createWorld(pack,registry,'solo'));const svc=new GameService(store,{[pack.id]:pack},registry,model);
 try{const card=actions(store.load('solo'),pack,registry).find(a=>a.args?.activityId==='crosswords');assert.ok(card?.enabled);assert.equal(card.storylet.hint,'+2 Wit');assert.equal(card.storylet.timeCost,4);
  const r=await svc.act('solo',{id:'c1',expectedRevision:store.load('solo').revision,command:{type:card.type,args:card.args}});assert.equal(r.turn.provider,'probe');assert.equal(calls,1);
  assert.match(r.turn.narrative,/last clue/);assert.ok(seen[0].outcomes.some(o=>/anagrams/.test(JSON.stringify(o))),'the committed outcome reaches the model');assert.equal(r.state.modules['character.stats'].values['player--wit'],5);
  const bar=actions(r.state,pack,registry);assert.ok(!bar.some(a=>a.args?.activityId==='open-mic'),'activities elsewhere are not offered here');
 }finally{store.close();}
});

test('key scenes carry a CG path; bad paths are rejected and missing art falls back to the placeholder',()=>{
 const cgs=pack.scriptedScenes.filter(s=>s.cg);assert.ok(cgs.length>=8);assert.ok(existsSync(new URL('../public/assets/cg-placeholder.svg',import.meta.url)));
 for(const id of ['first-night','theo-piano'])assert.ok(existsSync(new URL(`../public/${pack.scriptedScenes.find(s=>s.id===id).cg}`,import.meta.url)),`${id} CG rendered`);
 for(const cg of ['../secret.png','http://x/y.png','assets/cg.gif',7]){const p=structuredClone(pack);p.scriptedScenes[0].cg=cg;assert.throws(()=>validatePack(p,registry),/cg: an assets\/ image path/);}
});

test('the world is populated: searching finds gear, a found key wakes the jukebox, which opens a scene and a new way to train',async()=>{
 const {Store}=await import('../packages/persistence/store.mjs'),{GameService}=await import('../packages/ai/service.mjs');
 let calls=0;const no=async()=>{calls++;throw Error('model called');},model={name:'must-not-run',generateScene:no,interpretScene:no,generateLedger:no,interpret:no,narrate:no};
 const store=new Store();store.insert(createWorld(pack,registry,'w'));const svc=new GameService(store,{[pack.id]:pack},registry,model);
 const st=()=>store.load('w'),go=async(type,args)=>{const r=await svc.act('w',{id:`c${st().revision}`,expectedRevision:st().revision,command:{type,args}});let p;while((p=st().modules['story.scenes'].pending)&&p!=='jukebox-lives')await svc.act('w',{id:`l${st().revision}`,expectedRevision:st().revision,command:{type:'story.leave',args:{scene:p}}});return r;};
 const find=async item=>{const o=pack.objects.find(o=>o.id===st().modules['world.objects'].stash[item]);if(st().actors.player.location!==o.location)await go('core.move',{to:o.location});return go('world.explore',{target:o.id,mode:'search_take'});};
 try{for(const l of pack.locations)assert.ok(pack.objects.filter(o=>o.location===l.id).length>=2,`${l.id} has things to find`);
  await find('old-mixtape');assert.equal(st().modules['items.inventory'].owners['old-mixtape'],'player');assert.deepEqual(pack.items.find(i=>i.id==='old-mixtape').statBonus,{nerve:1});
  await go('core.move',{to:'bar'});assert.ok(!actions(st(),pack,registry).some(a=>a.args?.activityId==='jukebox-song'),'jukebox is dead until fixed');
  assert.equal(actions(st(),pack,registry).find(a=>a.type==='world.use'&&a.args.target==='jukebox').reason,'You need the required item');await assert.rejects(go('world.use',{target:'jukebox'}));
  const r=await find('brass-key');assert.equal(r.turn.provider,'Game rules');assert.equal(st().modules['items.inventory'].owners['brass-key'],'player');
  if(st().actors.player.location!=='bar')await go('core.move',{to:'bar'});await go('world.use',{target:'jukebox'});assert.equal(st().flags['jukebox-on'],true);assert.equal(st().modules['story.scenes'].pending,'jukebox-lives');
  await go('story.choose',{scene:'jukebox-lives',choice:'ask-theo'});const card=actions(st(),pack,registry).find(a=>a.args?.activityId==='jukebox-song');assert.ok(card?.enabled);assert.match(card.storylet.hint,/Nerve/);
  assert.equal(calls,0,'exploring, using and training never call the model');
 }finally{store.close();}
});

test('what you say matters: topics they care about earn trust, repeats wear thin, rudeness costs, and small talk pays once a day',()=>{
 const h=harness(pack),trust=()=>h.state.modules['social.relationships'].edges['juno--player']||0,clear=()=>{let q;while((q=h.state.modules['story.scenes'].pending))h.act('story.leave',{scene:q});},say=text=>{clear();return h.act('social.speak',{target:'juno',text});};clear();
 if(h.state.actors.player.location!=='bar')h.act('core.move',{to:'bar'});for(let i=0;i<24&&h.state.actors.juno.location!=='bar';i++)h.act('core.wait');
 const start=trust();say('hi');const base=trust();assert.equal(base,start,'generic small talk earns nothing');say('hi again');assert.equal(trust(),base,'still nothing on a repeat');
 say('Tell me about your mum and the history of this place');assert.equal(trust(),base+3,'her family is a topic she cares about: daily bump +1 and reaction +2');
 say('Was your mum strict?');assert.equal(trust(),base+4,'asking again is worth half');say('And your mum?');assert.equal(trust(),base+4,'third time is worth nothing');
 say('Shut up, Juno');assert.equal(trust(),base+1,'rudeness costs 3');
 assert.ok(pack.dialogueReactions.some(r=>r.character==='theo')&&pack.dialogueReactions.some(r=>r.character==='priya'));
});

test('world generation: each new game hides the finds in different authored spots, deterministically from the seed',()=>{
 const spots=seed=>createWorld(pack,registry,'g'+seed,seed).modules['world.objects'].stash,hidden=pack.items.filter(i=>i.hideIn);
 assert.ok(hidden.length>=3);for(const i of hidden)assert.ok(i.hideIn.length>=2&&!i.hideIn.includes('jukebox'),i.id+' has several candidate spots and never locks itself away');
 assert.deepEqual(spots(7),spots(7),'same seed, same world');
 const layouts=new Set(Array.from({length:20},(_,n)=>JSON.stringify(spots(n*7919+1))));assert.ok(layouts.size>=4,'different seeds give different worlds');
 for(let n=0;n<20;n++){const w=createWorld(pack,registry,'h'+n,n*104729),st=w.modules['world.objects'].stash;for(const i of hidden){assert.ok(i.hideIn.includes(st[i.id]));assert.equal(w.modules['items.inventory'].owners[i.id],pack.objects.find(o=>o.id===st[i.id]).location,'item sits where its hiding spot is');}}
 const h=harness(pack),empty=pack.objects.find(o=>hidden.some(i=>i.hideIn.includes(o.id))&&!Object.values(h.state.modules['world.objects'].stash).includes(o.id)&&!o.reveals);
 if(empty){let q;while((q=h.state.modules['story.scenes'].pending))h.act('story.leave',{scene:q});if(h.state.actors.player.location!==empty.location)h.act('core.move',{to:empty.location});const r=h.act('world.explore',{target:empty.id,mode:'search_take'});assert.ok(r.turn.events.some(e=>e.type==='world.searchedEmpty'),'an empty candidate spot says so');}
});

const placed=(tick,flags={})=>{const s=createWorld(pack,registry,'hand');Object.assign(s.flags,flags);s.modules['story.scenes'].pending=null;s.tick=tick;const h=tick%12;s.actors.juno.location=h<6?'market':'bar';s.actors.theo.location=h<8?'canal':'bar';return s;};
const handsAt=s=>[...new Set(pack.locations.flatMap(l=>{const t=structuredClone(s);t.actors.player.location=l.id;return actions(t,pack,registry,['story.startOfferedScene']).filter(a=>a.type==='story.startOfferedScene'&&a.enabled!==false&&a.args.scene.startsWith('hand-')).map(a=>a.args.scene);}))];
test('focused hand previews match full action enumeration at opening and late-route boundaries',()=>{
 for(const [tick,flags] of [[13,{}],[69,{'juno-kissed':true,'juno-flirt':true,'juno-charged':true}],[210,{'theo-kissed':true,'theo-opened':true,'theo-close':true,'theo-charged':true}]]){const s=placed(tick,flags),full=[...new Set(pack.locations.flatMap(l=>{const t=structuredClone(s);t.actors.player.location=l.id;return actions(t,pack,registry).filter(a=>a.type==='story.startOfferedScene'&&a.enabled!==false&&a.args.scene.startsWith('hand-')).map(a=>a.args.scene);}))];assert.deepEqual(handsAt(s),full);}
});

test('F2: every daypart of the run holds 2-4 hand offers, whichever route you are on',()=>{
 // Hand windows only change at ticks 24/36/48/60/211 (days 2-5 and 17); days 7-16 repeat day 6, so sample the boundaries.
 const routes={fresh:{},juno:{'juno-flirt':true,'juno-banter':true},theo:{'theo-opened':true,'theo-close':true},'juno kissed':{'juno-kissed':true,'juno-flirt':true,'juno-charged':true},'theo kissed':{'theo-kissed':true,'theo-opened':true,'theo-close':true,'theo-charged':true}};
 for(const [route,flags] of Object.entries(routes))for(const day of [1,2,3,4,5,6,17])for(const h of [1,6,9]){if(day===17&&h===9)continue;const n=handsAt(placed(day*12+h,flags)).length;assert.ok(n>=2&&n<=4,`${route} day ${day} tick ${h}: ${n} hand offers`);}
});

const nights=pack.scriptedScenes.filter(s=>s.trigger.event==='social.intimacyStarted');
test('F5: an intimate scene is several beats, and every beat before the end offers an unchecked stop that withdraws consent',()=>{
 for(const id of ['juno-night','theo-night'])assert.ok(nights.find(s=>s.id===id).beats.length>=2,`${id} has an escalation and a peak`);
 for(const s of nights)for(const [at,choices] of [['opening',s.choices],...(s.beats||[]).map(b=>[b.id,b.choices])]){const stop=choices.find(c=>c.effects?.some(e=>e.type==='intimacyConsent'&&e.status==='withdrawn'));assert.ok(stop,`${s.id}/${at} can stop`);assert.equal(stop.check,undefined,`${s.id}/${at} stop is never checked`);assert.equal(stop.next,undefined,`${s.id}/${at} stop ends the scene`);}
});

test('F5: stopping at the check-in is honoured mid-night; a mismatched opening ends the night early and awkwardly',()=>{
 const a=harness(pack);junoKissed(a);toBed(a,'juno');a.act('story.choose',{scene:'juno-night',choice:'let-her-lead'});assert.equal(a.state.modules['story.scenes'].pendingBeat,'check-in');
 const r=a.act('story.choose',{scene:'juno-night',choice:'stop'});assert.equal(ev(r,'social.intimacyCompleted'),undefined);assert.equal(a.state.modules['story.scenes'].pending,null);assert.equal(intim(a,'juno').consent['first-night'].status,'withdrawn');
 const b=harness(pack);junoKissed(b);toBed(b,'juno');const before=sat(b,'juno');b.act('story.choose',{scene:'juno-night',choice:'go-slow'});
 assert.equal(b.state.modules['story.scenes'].pending,null,'no check-in or peak after a mismatch');assert.equal(intim(b,'juno').encounters.at(-1).outcome,'awkward');assert.ok(sat(b,'juno')<before);
});

test('F7: ranking a stat up unlocks a perk card that hands you something usable',()=>{
 const s=placed(9);s.actors.player.location='bar';assert.equal(actions(s,pack,registry).find(a=>a.args?.scene==='perk-quiz')?.enabled,false,'shown, locked, with a hint below the rank');
 s.modules['character.stats'].values['player--wit']=4;const card=actions(s,pack,registry).find(a=>a.args?.scene==='perk-quiz');assert.ok(card?.enabled);
 let t=execute(s,{id:'p1',actorId:pack.playerId,type:card.type,args:card.args,expectedRevision:s.revision},pack,registry).state;
 t=execute(t,{id:'p2',actorId:pack.playerId,type:'story.choose',args:{scene:'perk-quiz',choice:'play'},expectedRevision:t.revision},pack,registry).state;
 assert.equal(t.modules['items.inventory'].owners['quiz-pen'],'player');assert.deepEqual(pack.items.find(i=>i.id==='quiz-pen').statBonus,{wit:2});
 for(const perk of pack.scriptedScenes.filter(x=>x.id.startsWith('perk-')))assert.ok(perk.offerHint&&perk.when.stats?.length,`${perk.id} is gated on a rank and says so`);
});

test('F1: the run ends by itself after last call, on the best ending the story earned',()=>{
 const h=harness(pack);junoKissed(h);toLastCall(h);h.act('story.choose',{scene:'last-call',choice:'stay-on'});
 for(let i=0;i<10&&!h.state.modules['story.endings'].selected;i++){const p=h.state.modules['story.scenes'].pending;if(p)h.act('story.leave',{scene:p});else if(h.state.scene)h.act('core.endScene');else h.act('core.wait');}assert.ok(h.state.tick<=pack.run.days*12,'time stops at the end of the trial');
 assert.equal(h.state.modules['story.endings'].selected,'juno-last-one-out');
});
test('F3: a conversation still open when time runs out closes on that turn, and the ending follows',()=>{
 const p={...pack,scriptedScenes:pack.scriptedScenes.filter(x=>x.id!=='last-call')},h=harness(p),end=p.run.days*12,clear=()=>{let q;while((q=h.state.modules['story.scenes'].pending))h.act('story.leave',{scene:q});};
 waitTo(h,end-2);clear();h.state.actors.player.location='bar';h.act('core.scene',{text:'Hi Priya.',location:'bar',characters:['priya'],activity:'talk'});clear();
 h.act('core.scene',{text:'One more?',location:'bar',characters:['priya'],activity:'continue'});
 assert.equal(h.state.tick,end-1);assert.ok(h.state.scene,'talking costs no time, so the scene stays open before the deadline');assert.equal(h.state.modules['story.endings'].selected,null);
 const r=h.act('core.wait');assert.equal(h.state.tick,end);assert.equal(h.state.scene,null);
 assert.match(ev(r,'core.sceneEnded').payload.text,/^Time is up. Priya says goodbye./);assert.equal(h.state.modules['story.endings'].selected,'regular');
});
test('F2: ordinary attention warms a crush once: the first gift a love interest gets pays chemistry, the second does not',()=>{
 const h=harness(pack),chem=()=>h.state.modules['social.dating'].characters.juno.chemistry;h.state.actors.player.location=h.state.actors.juno.location;const start=chem();
 h.act('items.give',{item:'black-shirt',target:'juno'});assert.equal(chem(),start+2);h.act('items.give',{item:'leather-jacket',target:'juno'});assert.equal(chem(),start+2);
 assert.equal(start,7,'a little spark to start from');for(const c of ['juno','theo'])assert.deepEqual(pack.datingProfiles.find(d=>d.character===c).signals.filter(s=>s.id.startsWith('warm-')).map(s=>s.repeatable||false),[false,false,false,false,false]);
});
test('F2: an activity with someone is only offered while they are here',()=>{
 const h=harness(pack),offered=()=>actions(h.state,pack,registry).some(a=>a.args?.activityId==='market-run');h.state.actors.player.location='market';h.state.actors.juno.location='bar';
 assert.ok(!offered(),'Juno is at the bar, so no market run');h.state.actors.juno.location='market';assert.ok(offered());
});
