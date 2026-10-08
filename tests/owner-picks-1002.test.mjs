import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {budgetSceneContext} from '../packages/ai/context-budget.mjs';
import {beatDirection} from '../packages/ai/beats.mjs';
import {contextFor} from '../packages/ai/context.mjs';
import {jealousy,jealousyHint,jealousyContext} from '../packages/modules/jealousy.mjs';
import {touchLadder} from '../packages/modules/touch-ladder.mjs';
import {lustBaselineHint} from '../public/lust-baseline.mjs';
import {lintScene} from '../packages/ai/narration-lint.mjs';

const campus=()=>JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url)));
const hash=s=>[...String(s)].reduce((h,c)=>Math.imul(h^c.charCodeAt(0),16777619)>>>0,2166136261);
test('voice examples follow each actor daily mood, including compact profiles and scripted suppression',()=>{
 const p=campus(),ids=['jana','nova'];
 for(const a of p.actors.filter(a=>ids.includes(a.id))){a.moods=['a little tired today'];a.voiceExamples={welcoming:['welcome'],dodging:['dodge'],declining:['decline']};}
 const w=createWorld(p,registry,'owner-voice');
 const render=c=>[{role:'system',content:JSON.stringify(c.castProfiles)}];
 const ctx={stagedCast:ids,scenePhase:'continuation',playerAction:'Hello',sceneHistory:[],day:1};
 for(let day=1;day<=12;day++){
  const c={...ctx,day,mood:'in a good mood today'},out=budgetSceneContext(c,p,w,'t1',{window:8192,reply:500,render}).context;
  for(const a of p.actors.filter(a=>ids.includes(a.id)))assert.deepEqual(out.castProfiles.find(x=>x.id===a.id).voiceBlock.examples,[hash(`${a.id}:day${day}`)%3===0?'dodge':'welcome']);
 }
 const day=Array.from({length:30},(_,i)=>i+1).find(d=>hash(`jana:day${d}`)%3===0),c={...ctx,stagedCast:['jana'],day};
 assert.match(beatDirection(c,p,'s1'),/respond to what the player means/);assert.equal(beatDirection(c,p,'s1'),beatDirection(c,p,'s2'));
 for(const window of [8192,600])assert.deepEqual(budgetSceneContext(c,p,w,'t1',{window,reply:0,render}).context.castProfiles[0].voiceBlock.examples,['dodge']);
 assert.deepEqual(budgetSceneContext({...c,scriptedScene:{id:'authored'}},p,w,'t1',{render}).context.castProfiles[0].voiceBlock.examples,['welcome']);
});
test('jealousy player panel and context show tone words while engine narration keeps its hint',()=>{
 const p=campus(),s=createWorld(p,registry,'owner-jealousy'),r=s.modules['social.jealousy'].characters.jana;
 assert.deepEqual(jealousy.panel(s,p).lines,[]);
 for(const [meter,tension] of [[2,'none'],[4,'cooling'],[8,'confronting']]){
  Object.assign(r,{meter,stage:'exclusive',lastTrustHit:1});
  assert.deepEqual(jealousy.panel(s,p).lines,[`Jana: ${tension}`]);
  assert.deepEqual(contextFor(s,p).jealousy.find(x=>x.character==='jana'),{character:'jana',tension});
  assert.deepEqual(jealousyContext(s,p,p.playerId).find(x=>x.character==='jana'),{character:'jana',tension});
  assert.ok(jealousyHint(s,p,'jana'));
 }
 assert.equal(s.modules['social.jealousy'].characters.jana.meter,8);
});
test('earned Lust baseline is hints only in the player panel and context',()=>{
 const p=campus();p.modules['social.touch-ladder']='0.1.0';
 const s=createWorld(p,registry,'owner-lust'),r=s.modules['social.touch-ladder'].characters.jana;
 Object.assign(r,{lust:24,lustBaseline:15});
 const hint=lustBaselineHint(s,p,'jana'),line=touchLadder.panel(s,p).lines.find(x=>x.startsWith('Jana:'));
 assert.ok(hint);assert.ok(line.includes(hint));assert.doesNotMatch(line,/15|warm floor|baseline/i);
 const c=contextFor(s,p).touchLadder.find(x=>x.character==='jana');
 assert.equal(c.baseline,undefined);assert.equal(c.baselineHint,hint);
 assert.equal(r.lustBaseline,15);
 delete p.lustBaseline;
 assert.equal(touchLadder.panel(s,p).lines.find(x=>x.startsWith('Jana:')),'Jana: Lust 24');
});
test('campus reskin disables anniversaries while creators can still enable the module',()=>{
 for(const name of ['campus','campus-trio']){
  const p=JSON.parse(readFileSync(new URL(`../packs/${name}.json`,import.meta.url)));
  assert.equal(p.modules['social.anniversary'],undefined);validatePack(p,registry);
  const s=createWorld(p,registry,`owner-${name}`);assert.equal(s.modules['social.anniversary'],undefined);
  assert.equal(contextFor(s,p).anniversary,undefined);
  p.modules['social.anniversary']='0.1.0';validatePack(p,registry);
  assert.ok(createWorld(p,registry,`creator-${name}`).modules['social.anniversary']);
 }
});
test('echo defaults to eight words for any world, with explicit zero and custom thresholds',()=>{
 const p=campus(),text='I tell her the truth about why I left',value={lines:[{speaker:'jana',text}]},c={stagedCast:['jana'],playerAction:text};
 for(const slipGuard of [undefined,{}, {echoWords:8}]){
  const echo=lintScene(value,c,{...p,slipGuard}).filter(x=>x.check==='echo');assert.equal(echo.length,1);assert.match(echo[0].message,/8\+ words/);
 }
 for(const echoWords of [0,11])assert.equal(lintScene(value,c,{...p,slipGuard:{echoWords}}).filter(x=>x.check==='echo').length,0);
 assert.equal(lintScene({lines:[{speaker:'jana',text:'I tell her the truth about why'}]},c,{...p,slipGuard:undefined}).filter(x=>x.check==='echo').length,0);
});
