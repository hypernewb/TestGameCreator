import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,actions} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {RULES_ONLY} from '../packages/ai/service.mjs';
import {messages,PHONE_ACTIONS} from '../public/campus.mjs';

const pack=()=>{const p=JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url)));p.outreachSettings={...p.outreachSettings,stageChance:{acquaintance:1,dating:1,exclusive:1}};return p;};
const run=(p,id)=>{let state=createWorld(p,registry,id);const act=(type,args={})=>{state=execute(state,{id:`${id}-${state.revision}`,actorId:p.playerId,type,args,expectedRevision:state.revision},p,registry).state;};return {act,get state(){return state;}};};
const read=f=>readFileSync(new URL(`../public/${f}`,import.meta.url),'utf8');

test('the messages panel lists a thread per heroine, newest first, and counts what is unread',()=>{
  const p=pack(),g=run(p,'panel');
  assert.deepEqual(messages(g.state,p),{unread:0,threads:[]},'nobody has texted yet');
  g.act('core.move',{to:'langley'});
  const view=messages(g.state,p),kaylee=view.threads.find(t=>t.character==='kaylee'),hi=p.phoneMessages.find(m=>m.id==='kaylee-hi');
  assert.equal(view.threads.length,p.phoneContacts.length,'a thread per contact that has texted');
  assert.ok(view.threads[0].at>kaylee.at,'the text that just arrived leads the panel');
  assert.deepEqual(view.threads.map(t=>t.at),view.threads.map(t=>t.at).slice().sort((a,b)=>b-a),'threads run newest first');
  assert.equal(kaylee.messages.at(-1).text,hi.text,'her move-triggered text is the oldest in her thread');
  assert.equal(kaylee.messages.at(-1).offer.place,p.locations.find(l=>l.id==='langley').name);
  assert.equal(view.unread,view.threads.reduce((n,t)=>n+t.unread,0),'one badge count for every thread');
  for(const t of view.threads)assert.deepEqual(t.messages.map(m=>m.id),g.state.modules['social.phone'].threads[t.character].map(m=>m.id).reverse(),`${t.name} reads newest message first`);
  g.act('core.wait');
  const twice=messages(g.state,p).threads.find(t=>t.messages.length>1);
  assert.ok(twice,'a heroine who texts twice keeps both');
  assert.deepEqual(twice.messages.map(m=>m.id),g.state.modules['social.phone'].threads[twice.character].map(m=>m.id).reverse());
});

test('the panel shows authored pack text only, never an invented line',()=>{
  const p=pack(),g=run(p,'authored');g.act('core.wait');g.act('core.wait');
  const view=messages(g.state,p),shown=view.threads.flatMap(t=>t.messages);
  assert.ok(shown.length);
  for(const t of view.threads)for(const m of t.messages){
    const def=p.phoneMessages.find(x=>x.id===m.id)||p.outreachMessages.find(x=>m.id.startsWith(`${x.id}.`));
    assert.ok(def,`${m.id} is not an authored text`);
    assert.equal(m.text,def.text.replace(/\{name\}/g,p.actors.find(a=>a.id===t.character).name));
  }
  assert.deepEqual(view.threads.map(t=>t.name).sort(),[...new Set(view.threads.map(t=>t.name))].sort(),'one thread per heroine');
  assert.ok(view.threads.every(t=>p.actors.some(a=>a.name===t.name)),'threads are named from the pack');
});

test('opening a thread marks it read through the existing engine action, and reading costs no model call',()=>{
  const p=pack(),g=run(p,'read');g.act('core.wait');
  const [thread]=messages(g.state,p).threads;
  assert.ok(thread.unread,'an unread text to read');
  const act=actions(g.state,p,registry).filter(a=>PHONE_ACTIONS.includes(a.type)).find(a=>a.type==='social.readThread'&&a.args.character===thread.character);
  assert.ok(act,`the engine offers a read action for ${thread.character}`);
  assert.ok(RULES_ONLY.has('social.readThread'),'reading a thread is rules-only: no model call');
  g.act('social.readThread',{character:thread.character});
  assert.equal(messages(g.state,p).threads.find(t=>t.character===thread.character).unread,0);
  assert.ok(!actions(g.state,p,registry).some(a=>a.type==='social.readThread'&&a.args.character===thread.character),'nothing left to mark read');
});

test('the panel is empty, never broken, on a pack with no phone at all',()=>{
  const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));
  assert.ok(!p.modules['social.phone']);
  assert.deepEqual(messages(createWorld(p,registry,'legacy'),p),{unread:0,threads:[]});
});

test('a plan suggestion maps to the pending invite: accept travels and commits once',()=>{
  const p=pack(),g=run(p,'plan');g.act('core.wait');g.act('core.wait');
  const invites=messages(g.state,p).threads.flatMap(t=>t.messages.filter(m=>m.offer?.status==='pending').map(m=>[t,m]));
  assert.ok(invites.length,'a plan text carries an invitation she is waiting on');
  const acts=actions(g.state,p,registry).filter(a=>a.type==='social.acceptPhoneOffer');
  assert.deepEqual(acts.map(a=>a.args.message).sort(),invites.map(([,m])=>m.id).sort(),'every pending invite has an accept action, and nothing else does');
  for(const [thread,plan] of invites)assert.equal(plan.offer.place,p.locations.find(l=>l.id===g.state.modules['social.phone'].threads[thread.character].find(m=>m.id===plan.id).offer.location).name);
  assert.ok(invites.every(([,m])=>m.offer.expires>=g.state.tick),'a pending invitation has not run out yet');
  for(const [,plan] of invites){const act=acts.find(a=>a.args.message===plan.id);if(act.enabled===false)assert.ok(act.reason||act.refusal?.reason,`${plan.id} keeps its reason`);}
  const [thread,plan]=invites.find(([,m])=>acts.find(a=>a.args.message===m.id).enabled);
  const place=g.state.modules['social.phone'].threads[thread.character].find(m=>m.id===plan.id).offer.location;
  g.act('social.acceptPhoneOffer',{message:plan.id});
  assert.equal(g.state.actors[p.playerId].location,place,'one tap goes to where she is waiting');
  assert.equal(messages(g.state,p).threads.find(t=>t.character===thread.character).messages.find(m=>m.id===plan.id).offer.status,'accepted');
  assert.ok(!actions(g.state,p,registry).some(a=>a.type==='social.acceptPhoneOffer'&&a.args.message===plan.id),'the invitation commits once');
  assert.ok(!messages(g.state,p).threads.find(t=>t.character===thread.character).messages.some(m=>m.id===plan.id&&m.offer?.status==='pending'),'no stale pending invite is left in the panel');
});

test('the reply box is the ordinary typed turn, addressed to her',()=>{
  const js=read('play.mjs');
  assert.match(js,/act\(\{input:`Reply to \$\{who\}: \$\{text\}`\}\)\.then\(d=>\{if\(d&&!d\.refusal\)\$\('#messages-input'\)\.value='';\}\)/,'the reply box sends a typed turn, not a command');
  assert.match(js,/msgAct\('social\.acceptPhoneOffer'/,'accept stays an engine action');
  assert.match(js,/type:'social\.readThread'/,'opening a thread stays an engine action');
  assert.match(js,/no\.onclick=\(\)=>act\(\{command:\{type:decline\.type,args:decline\.args\}\}\)/,'decline sends the pending invitation engine action');assert.match(js,/msgAct\('social\.declinePhoneOffer',m\.id\)/);assert.doesNotMatch(js,/msgPassed/);
  assert.match(js,/for\(const id of \['day-card','end-card','messages'\]\)/,'closing the panel lets a queued card through');
});

test('the panel button carries the unread badge, and the panel holds at phone width',()=>{
  const html=read('play.html'),js=read('play.mjs'),css=read('play.css');
  for(const id of ['messages','messages-open','messages-badge','messages-threads','messages-log','messages-reply','messages-input'])assert.match(html,new RegExp(`id="${id}"`),id);
  assert.match(html,/<dialog id="messages"/);assert.match(html,/data-action="messages"/,'the panel has an entry point');
  assert.match(html,/<form method="dialog" class="messages__head">/);assert.match(html,/<form id="messages-reply"/,'the reply box is its own form, never nested');
  assert.match(js,/\bmessages\(current\.state,current\.pack\)/);assert.match(js,/messages-badge/);
  assert.match(js,/pending&&m\.offer\.expires<s\.tick\?'expired':pending\?'pending':m\.offer\.status/,'the panel reads the tick it renders against, and never invents an expiry');
  assert.match(css,/\.messages-panel\{[^}]*padding:16px/,'16px gutters');
  assert.match(css,/\.messages__body\{[^}]*grid-template-columns:[^;]*\d+px[^;]*minmax\(0,1fr\)/,'two columns on the desktop app');
  assert.match(css,/@media\(max-width:600px\)\{\.messages-panel\{[^}]*padding:16px/,'the same gutters at phone width');
  assert.match(css,/\.messages__log\{[^}]*min-width:0/,'the log never pushes the panel wide');
  assert.doesNotMatch(css,/\.messages[^{]*\{[^}]*overflow-x/,'nothing scrolls sideways');
});