import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {createWorld,execute} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {changeTrust} from '../packages/modules/romance-stats.mjs';
import {RULES_MARKER} from '../packages/core/progression.mjs';

// GC2.4 trust policy: one writer (changeTrust), daily cap, repeat reduction, cooldowns, negatives, promises, disabled module.
// Flagged = progression.version 1 (campus ships it; neutral gets it added). Unflagged = the key removed.
const probe={id:'test.gc24-trust',version:'0.1.0',coreApi:'0.1.0',requires:[],commands:{'test.trust'(tx,a){tx.emit('test.applied',{applied:changeTrust(tx,a.character,a.amount,a.extra||{})},[]);}}};
const mods={...registry,[probe.id]:probe};
const build=(name,edit)=>{const p=JSON.parse(readFileSync(new URL(`../packs/${name}.json`,import.meta.url),'utf8'));p.modules[probe.id]='0.1.0';edit(p);return p;};
const flag=p=>{p.progression={version:1};};
const unflag=p=>{delete p.progression;};
const edge=(s,p,c)=>s.modules['social.relationships'].edges[`${c}--${p.playerId}`]||0;
const applied=r=>r.turn.events.find(e=>e.type==='test.applied').payload.applied;
const tr=(s,p,character,amount,id)=>execute(s,{id,actorId:p.playerId,type:'test.trust',args:{character,amount,extra:{quiet:true}},expectedRevision:s.revision},p,mods);
const markers=r=>r.turn.events.filter(e=>e.type===RULES_MARKER);
const act=(s,p,id,text,activity='continue')=>cmd(s,p,id,'core.scene',{text,location:'hub',characters:['ada'],activity});
const cmd=(s,p,id,type,args)=>execute(s,{id,type,args,actorId:p.playerId,expectedRevision:s.revision},p,mods);
const reactions=(r,id)=>r.turn.events.filter(e=>e.type==='social.relationshipChanged'&&e.payload.reaction===id).map(e=>e.payload.delta);
const neutralReactions=(edit=()=>{})=>build('neutral',p=>{delete p.modules['world.schedule'];p.initialRelationships=[{character:'ada',trust:40}];p.dialogueReactions=[{id:'support',character:'ada',phrases:['proud of you'],trustDelta:4,cooldownTicks:3},{id:'snub',character:'ada',phrases:['go away'],trustDelta:-4,cooldownTicks:3}];edit(p);});

test('campus flagged: gains cap at romanceStats.dailyGain, losses are not capped, the cap writes one marker',()=>{
 const p=build('campus',flag);let s=createWorld(p,mods,'gc24-cap',42);
 let r=tr(s,p,'jana',10,'g1');s=r.state;assert.equal(applied(r),6);assert.equal(markers(r).length,1);assert.equal(markers(r)[0].payload.dailyGain,6);
 r=tr(s,p,'jana',4,'g2');s=r.state;assert.equal(applied(r),0,'same day cap already used');
 const before=edge(s,p,'jana');r=tr(s,p,'jana',-10,'l1');s=r.state;assert.equal(applied(r),-Math.min(10,before));
});

test('campus unflagged: explicit romanceStats cap still applies and no marker is written',()=>{
 const p=build('campus',unflag);let s=createWorld(p,mods,'gc24-off',42);
 const r=tr(s,p,'jana',10,'u1');assert.equal(applied(r),6);assert.equal(markers(r).length,0);assert.equal(s.progression,undefined);
});

test('flagged pack with no explicit romanceStats: the default daily cap of 6 applies from the stamp turn',()=>{
 const p=build('campus',p=>{flag(p);delete p.romanceStats;});let s=createWorld(p,mods,'gc24-default',42);
 const r=tr(s,p,'jana',10,'d1');assert.equal(applied(r),6);assert.equal(markers(r)[0].payload.dailyGain,6);
});

test('unflagged pack with no romanceStats: Trust gains are uncapped',()=>{
 const p=build('campus',p=>{unflag(p);delete p.romanceStats;});let s=createWorld(p,mods,'gc24-none',42);
 assert.equal(applied(tr(s,p,'jana',10,'n1')),10);
});

test('disabled module: with no social.relationships, changeTrust is a silent no-op',()=>{
 const p=build('neutral',p=>{delete p.modules['social.relationships'];delete p.initialRelationships;});let s=createWorld(p,mods,'gc24-disabled',42);
 const r=tr(s,p,'ada',5,'x1');assert.equal(applied(r),0);assert.equal(r.turn.events.some(e=>e.type==='social.relationshipChanged'),false);
});

test('ordinary talk and promise rewards pay once per key, flagged and unflagged',()=>{
 for(const f of [flag,unflag]){
  const p=build('neutral',f);let s=createWorld(p,mods,'gc24-talk',42);
  s=act(s,p,'open','Sit with Ada.','talk').state;
  let r=act(s,p,'t1','"Tell me about the harbor festival tonight."');s=r.state;assert.equal(edge(s,p,'ada'),1,'fresh substantive talk pays +1');
  r=act(s,p,'t2','"Tell me about the harbor festival tonight."');s=r.state;assert.equal(edge(s,p,'ada'),1,'repeated talk pays nothing');
  r=act(s,p,'p1','"I promise to meet you at the harbor."');s=r.state;assert.equal(edge(s,p,'ada'),3,'promise pays +2');
  r=act(s,p,'p2','"I promise to meet you at the harbor."');s=r.state;assert.equal(edge(s,p,'ada'),3,'a second promise on the same edge pays nothing');
 }
});

test('authored reaction: full effect, half on repeat, none inside the cooldown window, flagged and unflagged',()=>{
 for(const f of [flag,unflag]){
  const p=neutralReactions(f);let s=createWorld(p,mods,'gc24-repeat',42);
  s=act(s,p,'open','Sit with Ada.','talk').state;
  let r=act(s,p,'r1','"I am proud of you."');s=r.state;assert.deepEqual(reactions(r,'support'),[4]);
  r=act(s,p,'r2','"Still proud of you."');s=r.state;assert.deepEqual(reactions(r,'support'),[2],'repeat is halved');
  r=act(s,p,'r3','"Proud of you again."');s=r.state;assert.deepEqual(reactions(r,'support'),[],'third hit inside cooldown is zero');
 }
});

test('authored reaction: cooldown expiry resets the repeat count',()=>{
 const p=neutralReactions(flag);let s=createWorld(p,mods,'gc24-expire',42);
 s=act(s,p,'open','Sit with Ada.','talk').state;
 let r=act(s,p,'e1','"I am proud of you."');s=r.state;assert.deepEqual(reactions(r,'support'),[4]);
 s=cmd(s,p,'end','core.endScene',{}).state;for(const id of ['w1','w2','w3','w4'])s=cmd(s,p,id,'core.wait',{}).state;
 s=act(s,p,'open2','Sit with Ada.','talk').state;
 r=act(s,p,'e2','"I am proud of you."');s=r.state;assert.deepEqual(reactions(r,'support'),[4],'after the window the full effect returns');
});

test('authored reaction: negatives land in full, halve on repeat, and a non-matching turn changes no reaction',()=>{
 for(const f of [flag,unflag]){
  const p=neutralReactions(f);let s=createWorld(p,mods,'gc24-neg',42);
  s=act(s,p,'open','Sit with Ada.','talk').state;
  let r=act(s,p,'n0','The harbor is quiet tonight.');s=r.state;assert.deepEqual(reactions(r,'snub'),[]);assert.deepEqual(reactions(r,'support'),[]);
  let b=edge(s,p,'ada');r=act(s,p,'n1','"Go away."');s=r.state;assert.deepEqual(reactions(r,'snub'),[-4]);assert.equal(edge(s,p,'ada'),b-4);
  b=edge(s,p,'ada');r=act(s,p,'n2','"Go away."');s=r.state;assert.deepEqual(reactions(r,'snub'),[-2],'repeat is halved');assert.equal(edge(s,p,'ada'),b-2);
 }
});

test.todo('default daily Trust cap for flagged packs with no romanceTempoProfiles (CP6/U6): not implemented, neutral gains are uncapped');
test.todo('director missed-goal unflagged branch writes edges directly, not via changeTrust (GC2.2 legacy kept for replay; bullet asks for changeTrust everywhere)');

test('relationship edges are written only by changeTrust, or by the legacy director branch and init',()=>{
 const root=new URL('../packages/',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
 const files=[];const walk=d=>{for(const f of readdirSync(d)){const q=d+f;if(statSync(q).isDirectory())walk(q+'/');else if(f.endsWith('.mjs'))files.push(q);}};walk(root);
 const writers=files.filter(f=>/'social\.relationships',\s*'edges'/.test(readFileSync(f,'utf8'))).map(f=>f.split(/[\\/]packages[\\/]/)[1].replace(/\\/g,'/')).sort();
 assert.deepEqual(writers,['modules/director.mjs','modules/romance-stats.mjs']);
});
