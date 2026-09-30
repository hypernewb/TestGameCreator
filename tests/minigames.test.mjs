import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack,actions} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {statValue} from '../packages/modules/stats.mjs';
import {GAMES,gameOf,PUSH_MISHAP} from '../packages/modules/minigames.mjs';

// M5 step 1: the play UI reports a result tier; code owns what each tier is worth. Skip is the floor, playing only adds.
const pack=()=>JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url)));
const run=(p,seed=1)=>{let state=createWorld(p,registry,'m5',seed);const events=[];const act=(type,args={})=>{const r=execute(state,{id:`m5-${state.revision}`,actorId:p.playerId,type,args,expectedRevision:state.revision},p,registry);state=r.state;events.push(...r.turn.events);return r.turn.events;};return {act,events,get s(){return state;}};};
const doing=(g,p,id,result)=>{const a=p.activities.find(x=>x.id===id);return g.act('core.scene',{text:a.name,location:a.location,characters:a.character?[a.character]:[],activity:'other',activityId:a.id,...(result?{result}:{})});};
const yieldOf=(id,result)=>{const p=pack(),g=run(p),m=()=>g.s.modules['world.economy'].balance,st=()=>Object.fromEntries(Object.keys(GAMES).map(k=>[k,statValue(g.s,p.playerId,k)]));const m0=m(),s0=st();doing(g,p,id,result);const s1=st();return {money:m()-m0,stats:Object.fromEntries(Object.keys(s1).map(k=>[k,s1[k]-s0[k]]).filter(([,v])=>v)),g,p};};

test('every campus activity plays a widget of its stat, and money jobs play the game of the stat they train',()=>{
 const p=pack();validatePack(p,registry);const games=p.activities.map(gameOf);
 assert.deepEqual(new Set(games),new Set(Object.values(GAMES)),'all four widgets are used');
 assert.equal(gameOf(p.activities.find(a=>a.id==='dining-shift')),'rhythm');assert.equal(gameOf(p.activities.find(a=>a.id==='tutoring-shift')),'quiz');
 assert.equal(gameOf({effects:[{type:'money',delta:30}]}),'timing','a job that trains nothing still gets a game');
 assert.throws(()=>validatePack({...p,activities:p.activities.map((a,i)=>i?a:{...a,game:'chess'})},registry),/game/);
});

test('only upside: skip and ok give the base yield, good and great add to it',()=>{
 const base=yieldOf('barista-shift'),skip=yieldOf('barista-shift','skip'),ok=yieldOf('barista-shift','ok'),good=yieldOf('barista-shift','good'),great=yieldOf('barista-shift','great');
 assert.deepEqual([skip.money,skip.stats],[base.money,base.stats]);assert.deepEqual([ok.money,ok.stats],[base.money,base.stats]);
 assert.equal(good.money-base.money,7);assert.equal(great.money-base.money,18,'+20% and +50% of the $35 shift');assert.equal(good.stats.charm,base.stats.charm+1);assert.equal(great.stats.charm,base.stats.charm+1);
 assert.ok(great.g.events.some(e=>e.type==='world.minigameScored'&&e.payload.canPush),'a great run offers push your luck');
 assert.ok(!good.g.s.modules['world.minigames'].run&&!actions(good.g.s,good.p,registry).some(a=>a.type==='world.pushLuck'),'a good run does not');
 assert.throws(()=>yieldOf('barista-shift','perfect'),/result/);
});

test('push your luck: free, pays per round, a rising mishap ends it without taking anything back',()=>{
 let mishaps=0,paid=0;
 for(let i=1;i<=40;i++){const seed=Math.imul(i,2654435761)>>>0,p=pack(),g=run(p,seed);doing(g,p,'workout','great');const tick=g.s.tick,after=statValue(g.s,p.playerId,'fitness');
  assert.ok(actions(g.s,p,registry).some(a=>a.type==='world.pushLuck'));
  for(let k=0;k<PUSH_MISHAP.length&&g.s.modules['world.minigames'].run;k++){const before=statValue(g.s,p.playerId,'fitness'),ev=g.act('world.pushLuck'),bad=ev.find(e=>e.type==='world.activityMishap');
   if(bad){mishaps++;assert.equal(bad.payload.activity,'workout');assert.equal(statValue(g.s,p.playerId,'fitness'),before,'a mishap costs nothing directly');}else{paid++;assert.equal(statValue(g.s,p.playerId,'fitness'),Math.min(before+1,p.statDefinitions.find(d=>d.id==='fitness').max));}}
  assert.equal(g.s.tick,tick,'pushing takes no time');assert.ok(statValue(g.s,p.playerId,'fitness')>=after,'never below what was banked');
  assert.throws(()=>g.act('world.pushLuck'),/no run/);}
 assert.ok(mishaps>=15&&paid>=15,`mishaps ${mishaps}, paid rounds ${paid}`);
 const p=pack(),g=run(p);doing(g,p,'workout','great');g.act('core.wait');assert.throws(()=>g.act('world.pushLuck'),/no run/,'the offer lapses once time moves');
});

test('co-op: the heroine you did it with warms to a good run, more to a great one',()=>{
 const trust=r=>r.g.s.modules['social.relationships'].edges['jana--player'];
 const base=yieldOf('movie-night'),good=yieldOf('movie-night','good'),great=yieldOf('movie-night','great');
 assert.equal(trust(good),trust(base)+1);assert.equal(trust(great),trust(base)+2);
});

test('a mishap reliably produces a director beat: in-scene trouble, around whoever was there',async()=>{
 const {readPack}=await import('../packages/cards/director-library.mjs'),{fileURLToPath}=await import('node:url');
 const file=fileURLToPath(new URL('../packs/campus.json',import.meta.url));let hits=0;
 for(let i=1;i<=12;i++){const p=readPack(file),g=run(p,Math.imul(i,2654435761)>>>0);doing(g,p,'movie-night','great');let ev=[];
  while(g.s.modules['world.minigames'].run&&!ev.some(e=>e.type==='world.activityMishap'))ev=g.act('world.pushLuck');
  if(!ev.some(e=>e.type==='world.activityMishap'))continue;hits++;
  const beat=ev.find(e=>e.type==='story.incident');assert.ok(beat,`seed ${i}: the mishap dealt a beat`);assert.equal(beat.payload.mode,'mishap');assert.ok(beat.payload.template&&['obstacle','temptation'].includes(beat.payload.kind));
  assert.ok(Object.values(beat.payload.roles).includes('jana'),'the heroine who was there is in it');assert.equal(g.s.modules['story.scenes'].pending,beat.payload.scene,'it lands in-scene');}
 assert.ok(hits>=4,`only ${hits} mishaps`);
});

test('co-op lines: she says her own drafted line per tier when she was there; a plain fallback otherwise; no line on an untiered run',async()=>{
 const {reactionOf,REACTION_FALLBACK}=await import('../packages/modules/minigames.mjs'),line=r=>yieldOf('movie-night',r).g.events.find(e=>e.type==='world.coopReaction');
 const jana=pack().actors.find(a=>a.id==='jana');for(const r of ['skip','ok','good','great'])assert.equal(line(r).payload.text,jana.reactions[r]);
 assert.equal(line(),undefined,'old clients and free text get no line');assert.equal(yieldOf('barista-shift','great').g.events.find(e=>e.type==='world.coopReaction'),undefined,'a solo shift has nobody to react');
 assert.equal(reactionOf({name:'Mia'},'good'),REACTION_FALLBACK.good.replace('{name}','Mia'));
 const p=pack();assert.throws(()=>validatePack({...p,actors:p.actors.map(a=>a.id==='jana'?{...a,reactions:{perfect:'x'}}:a)},registry),/reactions/);
});

test('a great run with her sometimes becomes a moment she stays for; good runs never do',()=>{
 let hits=0;for(let i=1;i<=30;i++){const seed=Math.imul(i,2654435761)>>>0,p=pack(),g=run(p,seed);doing(g,p,'movie-night','great');const m=g.events.find(e=>e.type==='world.moment'&&e.payload.moment==='jana-great-run');if(m){hits++;assert.equal(m.payload.character,'jana');}
  const q=run(pack(),seed);doing(q,pack(),'movie-night','good');assert.ok(!q.events.some(e=>e.payload?.moment==='jana-great-run'));}
 assert.ok(hits>=5&&hits<=25,`${hits}/30 great runs sparked`);
});

// Step 4: getting handsy in front of someone at work, the gym or study starts a rumor and deals a beat; nothing is taken directly.
const touch=(g,where,cast,trust={})=>{g.act('core.scene',{text:'Hanging out',location:where,characters:cast,activity:'other'});return g.act('social.priceActs',{character:'jana',acts:[{kind:'touch',target:'arm',size:'small',landed:true}],sceneId:`s${g.s.revision}`,source:'test'});};
// Pin the cast where the test wants them (schedules would move them), so the scene is not redirected.
const pinned=(p,where,cast)=>{p.schedules=p.schedules.filter(x=>!cast.includes(x.actor));p.actors=p.actors.map(a=>cast.includes(a.id)?{...a,location:where}:a);return p;};
const withTrust=(p,t)=>(p.initialRelationships=p.initialRelationships.map(x=>t[x.character]!=null?{...x,trust:t[x.character]}:x),p);
test('witnessed touch: at the gym with a heroine watching, gossip starts and she gets the saw-you beat; no numbers move',async()=>{
 const {readPack}=await import('../packages/cards/director-library.mjs'),{fileURLToPath}=await import('node:url'),{watchedAt}=await import('../packages/modules/minigames.mjs');
 const file=fileURLToPath(new URL('../packs/campus.json',import.meta.url)),p=pinned(withTrust(readPack(file),{monique:30}),'hewett',['jana','monique']),g=run(p);
 assert.deepEqual(p.locations.filter(l=>watchedAt(p,l.id)).map(l=>l.id).sort(),['campbells','hewett','langley','prescott'],'jobs, gym and study; not home, not the pub');
 const money=g.s.modules['world.economy'].balance,edges={...g.s.modules['social.relationships'].edges},ev=touch(g,'hewett',['jana','monique']);
 const w=ev.find(e=>e.type==='social.touchWitnessed');assert.ok(w,'the touch was seen');assert.deepEqual([w.payload.character,w.payload.witnesses,w.payload.rivals],['jana',['monique','abigail'],['monique','abigail']],'Abigail trains there too');
 const rumor=ev.find(e=>e.type==='social.rumorCreated');assert.ok(rumor,'the witness starts a rumor');assert.match(g.s.modules['social.gossip'].rumors.at(-1).summary,/Jana/);
 const beat=ev.find(e=>e.type==='story.incident');assert.ok(beat,'the director deals a beat');assert.equal(beat.payload.mode,'witnessed');assert.equal(beat.payload.template,'saw-you');assert.deepEqual(beat.payload.roles,{lead:'jana',rival:'monique'},'Abigail is below the saw-you trust gate');
 assert.equal(g.s.modules['world.economy'].balance,money);for(const k of ['monique--player','kaylee--player'])assert.equal(g.s.modules['social.relationships'].edges[k],edges[k],`${k}: no direct loss`);
});
test('witnessed touch: a friend at work gives a rumor beat; alone or at home nothing happens',async()=>{
 const {readPack}=await import('../packages/cards/director-library.mjs'),{fileURLToPath}=await import('node:url');
 const file=fileURLToPath(new URL('../packs/campus.json',import.meta.url));
 let g=run(pinned(withTrust(readPack(file),{nova:20}),'campbells',['jana','kaylee'])),ev=touch(g,'campbells',['jana','kaylee']);
 assert.deepEqual(ev.find(e=>e.type==='social.touchWitnessed')?.payload.rivals,[]);assert.ok(ev.some(e=>e.type==='social.rumorCreated'));assert.equal(ev.find(e=>e.type==='story.incident')?.payload.template,'rumor','no heroine saw it: the rumor beat');
 for(const [where,cast] of [['campbells',['jana']],['apartment',['jana','kaylee']]]){g=run(pinned(readPack(file),where,cast));ev=touch(g,where,cast);assert.ok(!ev.some(e=>['social.touchWitnessed','social.rumorCreated','story.incident'].includes(e.type)),`${where} with ${cast}`);}
 const p=readPack(file);p.locations=p.locations.map(l=>l.id==='apartment'?{...l,watched:true}:l);g=run(pinned(p,'apartment',['jana','kaylee']));assert.ok(touch(g,'apartment',['jana','kaylee']).some(e=>e.type==='social.touchWitnessed'),'a pack can mark a place watched');
});
