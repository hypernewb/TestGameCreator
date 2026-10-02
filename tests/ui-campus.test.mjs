import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,actions} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {sceneVerdicts,knownActs} from '../packages/modules/acts.mjs';
import {stageOf} from '../packages/modules/arc.mjs';
import {featuredFirst,SHOWCASE,isCampus,dayCard,newDay,hub,activityCommand,promptFill,speakCommand,endCard,journal,phone,poseFor,PHONE_ACTIONS} from '../public/campus.mjs';

const pack=()=>JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url)));
const run=(p,id)=>{let state=createWorld(p,registry,id);const act=(type,args={})=>{state=execute(state,{id:`${id}-${state.revision}`,actorId:p.playerId,type,args,expectedRevision:state.revision},p,registry).state;};return {act,get state(){return state;}};};
const read=f=>readFileSync(new URL(`../public/${f}`,import.meta.url),'utf8');

test('the day card opens the term with date, days left, weather and a rumor, and remembers yesterday',()=>{
 const p=pack(),g=run(p,'day');assert.ok(isCampus(p));assert.ok(!isCampus(JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)))));
 const first=dayCard(g.state,p);assert.equal(first.date,'September 7');assert.equal(first.weekday,'Monday');assert.equal(first.daysLeft,27);assert.ok(first.weather.name);assert.equal(first.yesterday,null);assert.ok(newDay(g.state,p));
 assert.match(first.rumor,/^Word is (Jana|Monique|Nova|Abigail) will be at .+ tonight\.$/);
 g.act('core.scene',{text:'Hey',location:'apartment',characters:['jana'],activity:'talk'});const sceneId=g.state.scene.id;
 g.act('social.priceActs',{character:'jana',sceneId,private:true,acts:[{kind:'listen',target:'dominik',size:'medium'}]});g.act('core.endScene');
 const before=g.state.tick;while(!newDay(g.state,p,before)&&g.state.tick<before+12)g.act('core.wait');
 const next=dayCard(g.state,p);assert.equal(next.day,2);assert.equal(next.daysLeft,26);assert.match(next.yesterday,/^Yesterday, Jana liked that you let her talk about Dominik/);
 assert.ok(p.calendar.weather.some(w=>w.name===next.weather.name));
});

test('the hub offers exactly the activities the engine would accept, and says why the rest are out',()=>{
 const p=pack(),g=run(p,'hub');
 for(let i=0;i<9;i++){const engine=new Set(actions(g.state,p,registry).filter(a=>a.type==='core.scene'&&a.args.activityId).map(a=>a.args.activityId)),here=g.state.actors.player.location,view=hub(g.state,p);
  const offered=new Set(view.find(l=>l.here).activities.filter(a=>a.available).map(a=>a.id));assert.deepEqual(offered,new Set([...engine].filter(id=>p.activities.find(a=>a.id===id).location===here)),`tick ${g.state.tick}`);
  for(const l of view)for(const a of l.activities)if(!a.available)assert.ok(a.why,`${a.id} needs a reason`);
  const pick=view.flatMap(l=>l.activities).find(a=>a.available&&!a.character);const c=activityCommand(p,pick.id);g.act(c.type,c.args);if(g.state.scene)g.act('core.endScene');}
 const monday=hub(run(p,'mon').state,p).find(l=>l.id==='murphys');assert.equal(monday.closed,"Murphy's is closed on Mondays");assert.ok(monday.activities.every(a=>!a.available&&a.why===monday.closed));
});

test('the end card shows why and which way each heart moved, never a number',()=>{
 const p=pack(),g=run(p,'end');g.act('core.scene',{text:'How was the call?',location:'apartment',characters:['jana'],activity:'talk'});const sceneId=g.state.scene.id;
 g.act('social.priceActs',{character:'jana',sceneId,private:true,acts:[{kind:'listen',target:'dominik',size:'medium'}]});g.act('social.priceActs',{character:'jana',sceneId,private:true,acts:[{kind:'compliment',target:'looks',size:'small'}]});
 assert.equal(endCard(g.state,p),null,'nothing to show until the scene closes');g.act('core.endScene');
 const card=endCard(g.state,p),verdicts=sceneVerdicts(g.state,sceneId);assert.equal(card.rows.length,verdicts.length);assert.deepEqual(card.rows.map(r=>r.mark),verdicts.map(v=>v.verdict==='liked'?'up':'down'));
 for(const r of card.rows){assert.equal(r.name,'Jana');assert.doesNotMatch(r.text,/\d/);assert.ok(verdicts.some(v=>r.text.includes(v.reason)));}
 const who=Object.keys(g.state.actors).find(id=>id!=='player'&&g.state.actors[id].location===g.state.actors.player.location)||'kaylee';g.act('core.scene',{text:'Morning',location:g.state.actors[who].location,characters:[who],activity:'talk'});g.act('core.endScene');assert.deepEqual(endCard(g.state,p).rows,[],'an earlier scene\'s verdicts do not leak into the next card');
});

test('the journal shows only discovered preferences and the arc stage by name',()=>{
 const p=pack();delete p.likesOpen;const g=run(p,'journal');assert.deepEqual(journal(g.state,p).map(j=>[j.id,j.likes.length,j.dislikes.length]),[['jana',0,0],['monique',0,0],['nova',0,0],['abigail',0,0]]);
 g.act('core.scene',{text:'Hey',location:'apartment',characters:['jana'],activity:'talk'});const sceneId=g.state.scene.id;
 g.act('social.priceActs',{character:'jana',sceneId,private:true,acts:[{kind:'listen',target:'dominik',size:'medium'},{kind:'pushy',target:'dominik',size:'small'}]});
 const jana=journal(g.state,p)[0],known=knownActs(g.state,p,'jana');assert.equal(jana.stage,stageOf(g.state,p,'jana').name);
 assert.deepEqual([...jana.likes,...jana.dislikes].map(x=>x.reason).sort(),known.map(x=>x.reason).sort());assert.ok(jana.likes.length&&jana.dislikes.length);
 assert.ok(!('points' in jana.likes[0]),'the journal never exposes points');
});

test('the phone lists threads with replies and invites, and the engine offers matching phone actions',()=>{
 const p=pack(),g=run(p,'phone');assert.deepEqual(phone(g.state,p),[]);g.act('core.move',{to:'langley'});
 const [t]=phone(g.state,p);assert.equal(t.name,'Kaylee');assert.equal(t.unread,1);assert.equal(t.messages[0].offer.place,p.locations.find(l=>l.id==='langley').name);
 const acts=actions(g.state,p,registry).filter(a=>PHONE_ACTIONS.includes(a.type));assert.ok(acts.some(a=>a.type==='social.replyMessage'&&a.args.message===t.messages[0].id));
 g.act('social.replyMessage',{message:'kaylee-hi',reply:'yes'});assert.equal(phone(g.state,p)[0].messages[0].reply,'See you there.');
});

test('a love interest smiles after a liked act and looks frustrated after a disliked one',()=>{
 const p=pack(),g=run(p,'pose');g.act('core.scene',{text:'Hey',location:'apartment',characters:['jana'],activity:'talk'});const sceneId=g.state.scene.id;assert.match(poseFor(g.state,p,'jana'),/jana-neutral/);
 g.act('social.priceActs',{character:'jana',sceneId,private:true,acts:[{kind:'listen',target:'dominik',size:'medium'}]});assert.match(poseFor(g.state,p,'jana'),/jana-smile/);
 g.act('social.priceActs',{character:'jana',sceneId,private:true,acts:[{kind:'compliment',target:'looks',size:'small'}]});assert.match(poseFor(g.state,p,'jana'),/jana-frustrated/);
 g.act('core.endScene');assert.match(poseFor(g.state,p,'jana'),/jana-neutral/);
});

test('the play screen wires the campus layer: day card, hub, end card, journal and an always-on free-text box',()=>{
 const html=read('play.html'),js=read('play.mjs'),css=read('play.css');
 for(const id of ['day-card','hub','end-card','journal','player-prompt','gallery-dialog','gallery-body'])assert.match(html,new RegExp(`id="${id}"`),id);
 assert.match(js,/from '\.\/campus\.mjs'/);assert.match(js,/openGallery\(current/);assert.match(html,/data-action="gallery"/);for(const fn of ['dayCard','hub','endCard','journal','activityCommand'])assert.match(js,new RegExp(`\\b${fn}\\(`),fn);
 assert.match(css,/@keyframes heart-/);assert.match(css,/prefers-reduced-motion/);
});

test('campus leads both start screens; the other worlds keep their order',()=>{
 const packs=[{id:'sample.neutral'},{id:'sample.event-chain'},{id:SHOWCASE},{id:'sample.threshold'}];assert.deepEqual(featuredFirst(packs).map(p=>p.id),[SHOWCASE,'sample.neutral','sample.event-chain','sample.threshold']);assert.equal(pack().id,SHOWCASE);
 for(const f of ['play.mjs','app.mjs'])assert.match(read(f),/featuredFirst\(data\.packs\)/,f);
});

test('in a scene, an Ask button fills the prompt box instead of acting; outside a scene, buttons still act',()=>{
 const p=pack(),g=run(p,'ask');assert.ok(actions(g.state,p,registry).every(a=>promptFill(g.state,a)===null),'no scene, nothing to fill');
 g.act('core.scene',{text:'Hey',location:g.state.actors.jana.location,characters:['jana'],activity:'talk'});const acts=actions(g.state,p,registry),asks=acts.filter(a=>a.type==='social.speak');
 assert.ok(asks.length);for(const a of asks)assert.equal(promptFill(g.state,a),a.args.text);assert.ok(acts.filter(a=>a.type!=='social.speak').every(a=>promptFill(g.state,a)===null));
 assert.match(read('play.mjs'),/promptFill\(current\.state,a\)[^]*#player-prompt/);
});

test('outside a scene, Talk and Ask open a focused talk scene with her, so what you say is priced',()=>{
 const p=pack();p.gameProject.timeMode='clock';const g=run(p,'talk'),speaks=actions(g.state,p,registry).filter(a=>a.type==='social.speak');assert.ok(speaks.length);
 for(const a of speaks){const c=speakCommand(g.state,p,a);assert.equal(c.type,'core.scene');assert.deepEqual(c.args.characters,[a.args.target]);assert.equal(c.args.activity,'talk');assert.equal(c.args.location,g.state.actors[p.playerId].location);}
 const a=speaks[0];g.act('core.scene',speakCommand(g.state,p,a).args);assert.equal(g.state.scene.focus,a.args.target);assert.ok(p.actProfiles?.some(x=>x.character===a.args.target),'a talk scene is focused on a priceable character');
 assert.deepEqual(speakCommand(g.state,p,a),{type:a.type,args:a.args},'in a scene, speech is not rerouted');
 const other=actions(g.state,p,registry).find(x=>x.type!=='social.speak');if(other)assert.deepEqual(speakCommand(g.state,p,other),{type:other.type,args:other.args});
 assert.match(read('play.mjs'),/speakCommand\(current\.state,current\.pack,a\)/);
});

test('hub activities say what they pay: money exact, stats as arrows, her trust as a heart, no other digits',async()=>{
 const {yields,hub}=await import('../public/campus.mjs'),p=JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url)));
 const by=id=>yields(p,p.activities.find(a=>a.id===id));
 assert.equal(by('dining-shift'),'+$30 · Charm ↑');assert.equal(by('movie-night'),'Jana ♥ · Charm ↑');
 for(const a of p.activities){const y=yields(p,a);assert.ok(y,`${a.id} says what it pays`);assert.doesNotMatch(y.replace(/[+−]\$\d+/g,''),/\d/,`${a.id}: ${y}`);}
 const s=createWorld(p,registry,'yields');assert.ok(hub(s,p).flatMap(l=>l.activities).every(a=>typeof a.yields==='string'));
 assert.match(readFileSync(new URL('../public/play.mjs',import.meta.url),'utf8'),/actionHint\(current\.pack,a\)[\s\S]*hub__yields/);
 const {actionHint}=await import('../public/campus.mjs'),movie=actions(s,p,registry).find(a=>a.args?.activityId==='movie-night');assert.ok(movie,'movie night is on the menu');assert.equal(actionHint(p,movie),'Jana ♥ · Charm ↑','the choice list hides trust numbers too');
});

// M0.5, owner call 2026-09-29: a CG for every rung (talk, date, kiss, night) of all four heroines, rendered at the NovelAI free tier.
test('every heroine first shows its own CG, and the art sheet renders each one at the free tier',async()=>{
 const {existsSync}=await import('node:fs'),{buildRequest}=await import('../packages/assets/novelai.mjs'),p=pack(),sheet=JSON.parse(readFileSync(new URL('../art/cg/campus.json',import.meta.url)));
 for(const h of ['jana','monique','nova','abigail'])for(const r of ['talk','date','kiss','night']){const id=`${h}-${r}`,s=p.firsts.find(x=>x.id===id),cg=sheet.cgs.find(x=>x.id===id);
  assert.ok(s&&cg,id);assert.match(s.cg,new RegExp(`^assets/campus/cg/${id}_v\\d+\\.png$`));assert.ok(existsSync(new URL(`../public/${s.cg}`,import.meta.url)),`${id} rendered`);
  assert.doesNotThrow(()=>buildRequest(sheet,cg),`${id} fits the free tier`);assert.match(sheet.characters[cg.cast[0].id],/adult woman/);}
 assert.match(sheet.negative,/child, loli, shota, underage/,'every CG, explicit or not, blocks anything underage');for(const c of sheet.cgs.filter(c=>!/-night$/.test(c.id)))assert.match(c.negative||'',/nsfw/,`${c.id} stays SFW`);
});

// Live run 3: the tester typed into Jana's first night while she was booked elsewhere and got "No character is present to answer this reply" twice.
test('the prompt box locks during a scripted scene when nobody in it is here to answer',()=>{
 const src=read('play.mjs');assert.match(src,/voiced=beat&&!\[\.\.\.\(beat\.pages\|\|\[\]\)\.map\(x=>x\.speaker\),\.\.\.Object\.keys\(beat\.when\?\.charactersAt\|\|\{\}\),\.\.\.Object\.values\(scene\?\.template\?\.roles\|\|\{\}\),\.\.\.\(s\.scene\?\.characters\|\|\[\]\)\]\.some\(id=>id&&present\(id\)\)/);
 assert.match(src,/blocked=beat\?\.allowInput===false\|\|voiced\|\|/);
});

test('M5 widgets: every campus activity resolves the same game in the UI and the engine, and the tier rides on the command', async()=>{
 const {gameFor,tierFor,zoneFor,timingHit,beatScore,memoryScore,deal,question,GAMES:UI}=await import('../public/minigames-ui.mjs'),{gameOf,GAMES}=await import('../packages/modules/minigames.mjs');
 const p=pack();assert.deepEqual(UI,GAMES);for(const a of p.activities)assert.equal(gameFor(a),gameOf(a),a.id);assert.equal(new Set(p.activities.map(gameFor)).size,4);
 assert.equal(activityCommand(p,p.activities[0].id).args.result,undefined);assert.equal(activityCommand(p,p.activities[0].id,'great').args.result,'great');
 const g=run(pack(),'mg-ui'),a=p.activities.find(x=>!x.character&&x.location===g.state.actors[p.playerId].location&&!x.requiresFlag)||p.activities.find(x=>!x.character&&!x.requiresFlag),c=activityCommand(p,a.id,'good');g.act(c.type,c.args);
 assert.equal(g.state.events.findLast(e=>e.type==='world.activityCompleted')?.payload.result,'good');
 assert.deepEqual([0,0.49,0.5,0.79,0.8,1].map(tierFor),['ok','ok','good','good','great','great']);
 const z=zoneFor(0);assert.ok(timingHit(z.centre,z)&&!timingHit(z.centre+z.width,z));assert.ok(zoneFor(4).width>0.1);
 assert.deepEqual([0,-90,150,-250].map(beatScore),[1,1,0.5,0]);assert.equal(memoryScore(6,6,4),1);assert.ok(memoryScore(6,6,10)<1&&memoryScore(3,6,0)===0.5);
 let seed=7;const rand=()=>(seed=(seed*16807)%2147483647)/2147483647,cards=deal(rand);assert.equal(cards.length,12);assert.ok(cards.every(f=>cards.filter(x=>x===f).length===2));
 for(let i=0;i<50;i++){const q=question(rand);assert.equal(new Set(q.options).size,4);assert.ok(q.options.includes(q.answer)&&q.options.every(v=>v>0));}
 const js=read('play.mjs');assert.match(js,/from '\.\/minigames-ui\.mjs'/);assert.match(js,/activityCommand\(p,a\.id,tier\)/);assert.match(js,/world\.pushLuck/);
});
