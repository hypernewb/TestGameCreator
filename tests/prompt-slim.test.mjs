import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';
import {blockTokens} from '../packages/testing/prompt-ab.mjs';
const pack=()=>JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));

test('the state block never describes an absent character beyond the names line',()=>{
 const p=pack(),context={stagedCast:['brin'],scenePhase:'opening',sceneHistory:[],playerAction:'Hi',
  location:p.locations[0],present:p.actors.filter(a=>['player','brin'].includes(a.id)),
  absentCharacters:[{id:'jana',name:'Jana',rule:'stay put'},{id:'nova',name:'Nova',rule:'stay put'}],
  dating:[{character:'jana',phase:'friend'},{character:'brin',phase:'friend',agreement:'committed'}],
  intimacy:[{character:'jana',state:'held hands'},{character:'brin',state:'held hands'}],
  memories:[{text:'the player told Jana: the player fears deep water'},{text:'the player told Brin: the player collects old cameras'}],
  rumors:['Jana broke up with Dominik','Rowan hides snacks in the studio'],
  pastScenes:[{source:'s1',text:'Jana showed the player her surfboard'},{source:'s2',text:'Brin and the player sorted the darkroom'}]};
 const user=scenePromptMessages(context,p)[1].content;
 assert.match(user,/WITH YOU\n- Brin — stage: friend/);
 assert.match(user,/held hands/);
 assert.match(user,/not here \(can be talked about, can't show up\): Jana, Nova\./);
 assert.match(user,/the player told Brin: the player collects old cameras/);
 assert.doesNotMatch(user,/Jana — (?:stage|rival|held)/);
 assert.doesNotMatch(user,/Jana broke up with Dominik|Jana showed the player|fears deep water/);
});

test('filtered pools keep at most their cap, most recent first',()=>{
 const p=pack(),memories=Array.from({length:8},(_,i)=>({text:`the player told Brin: memory number ${i}`})),context={stagedCast:['brin'],scenePhase:'opening',sceneHistory:[],playerAction:'Hi',location:p.locations[0],memories,present:p.actors.filter(a=>['player','brin'].includes(a.id))};
 const user=scenePromptMessages(context,p)[1].content;
 const kept=user.match(/memory number \d/g)||[];
 assert.deepEqual([...new Set(kept)].map(s=>s.slice(-1)),['4','5','6','7']);
});

test('CURRENT STATE is prose, not a JSON dump',()=>{
 const p=pack(),context={stagedCast:['brin'],scenePhase:'opening',sceneHistory:[],playerAction:'Hi',location:p.locations[0],dating:[{character:'brin',phase:'friend'}],present:p.actors.filter(a=>['player','brin'].includes(a.id))};
 const user=scenePromptMessages(context,p)[1].content,state=user.split('CURRENT STATE')[1]||'';
 assert.match(user,/CURRENT STATE\n/);
 assert.doesNotMatch(state,/"(?:dating|memories|facts|rumors|items|outcomes)":/);
});

test('blockTokens prices the state block and sums every block',()=>{
 const p=pack(),context={stagedCast:['brin'],scenePhase:'opening',sceneHistory:[],playerAction:'Hi',location:p.locations[0],dating:[{character:'brin',phase:'friend'}],present:p.actors.filter(a=>['player','brin'].includes(a.id))};
 const blocks=blockTokens(context,p,scenePromptMessages);
 assert.ok(blocks['CURRENT STATE']>0);assert.ok(blocks['YOUR TURN']>0);
 const total=Object.values(blocks).reduce((a,b)=>a+b,0),messages=scenePromptMessages(context,p);
 assert.ok(Math.abs(total-Math.ceil(messages.reduce((a,m)=>a+m.content.length,0)/4))<total*0.25,'estimate near raw chars/4');
});

test('player stats render with rank names and the opening contract colors actions by them',()=>{
 const p=pack();p.statDefinitions=[{id:'charm',name:'Charm',min:0,max:20,ranks:[{min:0,name:'Awkward'},{min:8,name:'Magnetic'}]},{id:'wit',name:'Wit',min:0,max:20}];
 const withStats={stagedCast:['brin'],scenePhase:'opening',sceneHistory:[],playerAction:'Hi',location:p.locations[0],present:p.actors.filter(a=>['player','brin'].includes(a.id)),characterStats:[{character:'player',values:{charm:3,wit:0}}]};
 const [system,user]=scenePromptMessages(withStats,p);
 assert.match(user.content,/YOU — Charm: Awkward \(3\), Wit: 0/);
 const plain=scenePromptMessages({...withStats,characterStats:[]},p)[1].content;
 assert.doesNotMatch(plain,/YOU —/);
 assert.match(system.content,/stat ranks/);
 assert.match(user.content,/"You" narrator beat of the player.s action landing/);
});
