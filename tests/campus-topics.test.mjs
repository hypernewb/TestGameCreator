import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,actions} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';

// A live 4-day run clicked "Ask Jana about what the sea means to them" eleven times: short likes ("sea", "good pens") never counted as asked.
const pack=()=>JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url)));
test('every suggested topic is offered once, however short the like',()=>{
 const p=pack();for(const c of ['jana','monique','nova','abigail']){let s=createWorld(p,registry,`topics-${c}`),n=0;s=structuredClone(s);s.actors[c].location=s.actors.player.location;
  const act=(type,args)=>{s=execute(s,{id:`${c}-${n++}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,registry).state;};
  act('core.scene',{text:'Hey',location:s.actors.player.location,characters:[c],activity:'talk'});const asked=[];
  for(let i=0;i<12;i++){const a=actions(s,p,registry).find(x=>x.type==='social.speak'&&x.args.target===c&&x.label.startsWith('Ask'));if(!a||/up to later/.test(a.label))break;assert.ok(!asked.includes(a.label),`${c} re-offered: ${a.label}`);asked.push(a.label);act(a.type,a.args);}
  assert.ok(asked.length>=3,`${c}: ${asked.length} topics`);}
});

// The play screen puts an Ask into the prompt box, so it arrives as a typed scene line, not social.speak: a live run then re-offered one question twenty times.
test('a suggested question typed into the scene counts as asked',()=>{
 const p=pack();for(const c of ['jana','monique','nova','abigail']){let s=createWorld(p,registry,`typed-${c}`),n=0;s=structuredClone(s);s.actors[c].location=s.actors.player.location;const here=s.actors.player.location;
  const act=(type,args)=>{s=execute(s,{id:`${c}-${n++}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,registry).state;},ask=()=>actions(s,p,registry).find(x=>x.type==='social.speak'&&x.args.target===c&&x.label.startsWith('Ask'));
  act('core.scene',{text:'Hey',location:here,characters:[c],activity:'talk'});const first=ask();assert.ok(first,c);
  act('core.scene',{text:first.args.text,location:here,characters:[c],activity:'talk'});assert.notEqual(ask()?.label,first.label,`${c} re-offered after typing it`);}
});

// Live run 3 typed "What are you up to later?" nine times in one scene: the typed line never set the once-a-day hint.
test('typing the "up to later" question uses up the day\'s later button',()=>{
 const p=pack(),c='jana';let s=structuredClone(createWorld(p,registry,'later')),n=0;s.actors[c].location=s.actors.player.location;const here=s.actors.player.location;
 const act=(type,args)=>{s=execute(s,{id:`later-${n++}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,registry).state;},ask=()=>actions(s,p,registry).find(x=>x.type==='social.speak'&&x.args.target===c&&x.label.startsWith('Ask'));
 act('core.scene',{text:'Hey',location:here,characters:[c],activity:'talk'});let a;for(let i=0;i<15&&(a=ask())&&!/up to later/.test(a.label);i++)act('core.scene',{text:a.args.text,location:here,characters:[c],activity:'continue'});
 assert.match(a?.label||'',/up to later/,'the later question comes after the topics');act('core.scene',{text:a.args.text,location:here,characters:[c],activity:'continue'});
 assert.ok(!/up to later/.test(ask()?.label||''),'not offered again today');
});

// Live 4-day run: five typed "What is it you love about…?" questions, the 9b model tagged one. A question naming her like is a small listen whatever the model says.
test('a typed question about one of her likes is priced as a listen even when the model returns no acts',async()=>{
 const {Store}=await import('../packages/persistence/store.mjs'),{GameService}=await import('../packages/ai/service.mjs'),{typedListen}=await import('../packages/ai/scene-acts.mjs');
 const p=pack(),jana=p.actors.find(a=>a.id==='jana');
 assert.deepEqual(typedListen([],'What is it you love about Franzbrötchen?',jana),[{kind:'listen',target:'franzbrötchen'.replace(/[^a-z0-9@:_-]/g,''),size:'small'}]);
 assert.deepEqual(typedListen([],'I love the sea.',jana),[],'a statement is not a question');assert.deepEqual(typedListen([],'Are you asked about homework often?',jana),[],'filler words never match');
 assert.equal(typedListen([{kind:'listen',target:'*',size:'medium'}],'Tell me about the sea?',jana).length,1,'the model listen wins');
 const provider={name:'probe',async generateScene(){return {lines:[{speaker:'jana',text:'The sea? Everything.'}],acts:[]};}};
 const store=new Store(),w=createWorld(p,registry,'listen');store.insert(w);const service=new GameService(store,{[p.id]:p},registry,provider);
 try{await service.act('listen',{id:'open',expectedRevision:0,command:{type:'core.scene',args:{text:'Hey Jana',location:w.actors.jana.location,characters:['jana'],activity:'talk'}}});
  const r=await service.act('listen',{id:'ask',expectedRevision:store.load('listen').revision,command:{type:'social.speak',args:{target:'jana',text:'What is it you love about the sea?'}}});
  const priced=r.state.turns['ask-acts'];assert.ok(priced,'a priceActs turn is recorded');assert.deepEqual(priced.command.args.acts,[{kind:'listen',target:'the-sea',size:'small'}]);
  assert.ok(priced.events.some(e=>e.type==='social.actPriced'&&e.payload.verdict==='liked'));
 }finally{store.close();}
});

// Live run 2: "What is it you love about being taken seriously?" went unpriced because every word of that like was filler.
test('a like made only of filler words still matches by its phrase',async()=>{
 const {typedListen}=await import('../packages/ai/scene-acts.mjs'),p=pack(),monique=p.actors.find(a=>a.id==='monique'),nova=p.actors.find(a=>a.id==='nova');
 assert.deepEqual(typedListen([],'What is it you love about being taken seriously?',monique),[{kind:'listen',target:'being-taken-seriously',size:'small'}]);
 assert.deepEqual(typedListen([],'Seriously?',monique),[],'one filler word is not the topic');assert.deepEqual(typedListen([],'Are you going back home?',nova),[],'"back" alone is not being teased back');
});

// Owner call 2026-09-29, "Risky": a question about something she can't stand is neutral the first time, a small minus when you keep bringing it up.
test('a dislike question is free once and a small minus when repeated',async()=>{
 const {Store}=await import('../packages/persistence/store.mjs'),{GameService}=await import('../packages/ai/service.mjs'),{typedDislike}=await import('../packages/ai/scene-acts.mjs');
 const p=pack(),profile=c=>p.actProfiles.find(x=>x.character===c);
 for(const a of p.actors.filter(x=>profile(x.id)))for(const d of a.dislikes){const q=`Why can't you stand ${d}?`;assert.deepEqual(typedDislike([],q,a,profile(a.id),[]),[],`${a.id} first ask is free`);
  const [act]=typedDislike([],q,a,profile(a.id),[q]);assert.equal(act?.kind,'pushy',`${a.id}: ${d}`);const e=profile(a.id).entries.find(x=>x.kind==='pushy'&&x.target===act.target);assert.ok(e&&e.points<0&&e.points>=-3,`${a.id} ${d} has a small exact entry`);}
 const jana=p.actors.find(a=>a.id==='jana');assert.deepEqual(typedDislike([],'How is Dominik doing?',jana,profile('jana'),['Is Dominik okay?']),[],'talking about Dominik is not the sides dislike');
 assert.deepEqual(typedDislike([],'Why can\'t you stand pushiness?',jana,{entries:[]},['pushiness?']),[],'a pack without the exact entry never hits a pushy wildcard');
 const provider={name:'probe',async generateScene(){return {lines:[{speaker:'jana',text:'Because.'}],acts:[]};}};
 const store=new Store(),w=createWorld(p,registry,'risky');w.modules['social.romance-tempo'].characters.jana.points=10;store.insert(w);const service=new GameService(store,{[p.id]:p},registry,provider),rev=()=>store.load('risky').revision;
 try{await service.act('risky',{id:'open',expectedRevision:0,command:{type:'core.scene',args:{text:'Hey Jana',location:w.actors.jana.location,characters:['jana'],activity:'talk'}}});
  const q='Why can\'t you stand pushiness?',say=id=>service.act('risky',{id,expectedRevision:rev(),command:{type:'social.speak',args:{target:'jana',text:q}}});
  let r=await say('q1');assert.ok(!r.state.turns['q1-acts'],'first ask is neutral');
  r=await say('q2');const priced=r.state.turns['q2-acts'];assert.deepEqual(priced?.command.args.acts,[{kind:'pushy',target:'pushiness',size:'small'}]);
  const ev=priced.events.find(e=>e.type==='social.actPriced');assert.equal(ev.payload.verdict,'disliked');assert.ok(ev.payload.points<0&&ev.payload.points>=-3,String(ev.payload.points));
 }finally{store.close();}
});
