import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {budgetSceneContext} from '../packages/ai/context-budget.mjs';
import {createWorld} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';
import {beatDirection} from '../packages/ai/beats.mjs';

const trio=JSON.parse(readFileSync(new URL('../packs/campus-trio.json',import.meta.url)));
const legacy=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));

function ctx(cast,overrides={}){
  return {stagedCast:cast,scenePhase:'continuation',playerAction:'Nice frames.',sceneHistory:[],sceneSummary:'',...overrides};
}

function render(c){return scenePromptMessages(c,trio);}

test('voice block exists for each heroine and contains fingerprint',()=>{
  const store=new Store();const world=createWorld(trio,registry,'voice');store.insert(world);
  const {context}=budgetSceneContext(ctx(['yuna']),trio,world,'t1',{window:8192,reply:500,render});
  const y=context.castProfiles.find(p=>p.id==='yuna');
  assert.ok(y.voiceBlock,'yuna has voiceBlock');
  assert.ok(y.voiceBlock.fingerprint.includes('Soft formal'),'fingerprint present');
  assert.equal(y.voiceBlock.examples.length,2,'two examples');
  // No clothing/style in voiceBlock
  assert.ok(!JSON.stringify(y.voiceBlock).includes('Off-shoulder'),'no clothing in voiceBlock');
  store.close();
});

test('voice examples shift with relationship stage (dating -> welcoming)',()=>{
  const store=new Store();const world=createWorld(trio,registry,'voice2');store.insert(world);
  const {context}=budgetSceneContext(ctx(['yuna'],{dating:[{character:'yuna',phase:'dating'}]}),trio,world,'t1',{window:8192,reply:500,render});
  const y=context.castProfiles.find(p=>p.id==='yuna');
  const ex=y.voiceBlock.examples.join(' ');
  // Dating stage should pick welcoming examples
  assert.ok(ex.includes('tea')||ex.includes('early'),'welcoming example selected');
  store.close();
});

test('voice examples shift with mood (tired -> dodging)',()=>{
  const store=new Store();const world=createWorld(trio,registry,'voice3');store.insert(world);
  const {context}=budgetSceneContext(ctx(['yuna'],{mood:'a little tired today'}),trio,world,'t1',{window:8192,reply:500,render});
  const y=context.castProfiles.find(p=>p.id==='yuna');
  const ex=y.voiceBlock.examples.join(' ');
  // Tired mood should pick dodging examples
  assert.ok(ex.includes('direct question')||ex.includes('script'),'dodging example selected');
  store.close();
});

test('voice examples shift with strained stage -> declining',()=>{
  const store=new Store();const world=createWorld(trio,registry,'voice4');store.insert(world);
  const {context}=budgetSceneContext(ctx(['yuna'],{dating:[{character:'yuna',phase:'available',strained:true}]}),trio,world,'t1',{window:8192,reply:500,render});
  const y=context.castProfiles.find(p=>p.id==='yuna');
  const ex=y.voiceBlock.examples.join(' ');
  // Strained should pick declining examples
  assert.ok(ex.includes('appreciate')||ex.includes('No'),'declining example selected');
  store.close();
});

test('all three heroines have distinct voice blocks',()=>{
  const store=new Store();const world=createWorld(trio,registry,'voice5');store.insert(world);
  const {context}=budgetSceneContext(ctx(['yuna','haruka','minji']),trio,world,'t1',{window:8192,reply:500,render});
  const y=context.castProfiles.find(p=>p.id==='yuna');
  const h=context.castProfiles.find(p=>p.id==='haruka');
  const m=context.castProfiles.find(p=>p.id==='minji');
  // Fingerprints should differ
  assert.notEqual(y.voiceBlock.fingerprint,h.voiceBlock.fingerprint);
  assert.notEqual(h.voiceBlock.fingerprint,m.voiceBlock.fingerprint);
  assert.notEqual(m.voiceBlock.fingerprint,y.voiceBlock.fingerprint);
  // Examples should differ
  assert.notDeepEqual(y.voiceBlock.examples,h.voiceBlock.examples);
  assert.notDeepEqual(h.voiceBlock.examples,m.voiceBlock.examples);
  store.close();
});

test('voice block stays under token cap (~120 tokens per heroine)',()=>{
  const store=new Store();const world=createWorld(trio,registry,'voice6');store.insert(world);
  const {context,report}=budgetSceneContext(ctx(['yuna']),trio,world,'t1',{window:8192,reply:500,render});
  const y=context.castProfiles.find(p=>p.id==='yuna');
  // Rough token estimate: 1 token ~ 4 chars for English
  const voiceBlockTokens=JSON.stringify(y.voiceBlock).length/4;
  assert.ok(voiceBlockTokens<120,`voiceBlock ${voiceBlockTokens} tokens under 120 cap`);
  store.close();
});

test('clothing/style never appears in voiceBlock',()=>{
  const store=new Store();const world=createWorld(trio,registry,'voice7');store.insert(world);
  const {context}=budgetSceneContext(ctx(['yuna','haruka','minji']),trio,world,'t1',{window:8192,reply:500,render});
  for(const p of context.castProfiles){
    const vb=JSON.stringify(p.voiceBlock||{});
    assert.ok(!vb.includes('blouse'),`${p.id}: no blouse in voiceBlock`);
    assert.ok(!vb.includes('skirt'),`${p.id}: no skirt in voiceBlock`);
    assert.ok(!vb.includes('leather'),`${p.id}: no leather in voiceBlock`);
    assert.ok(!vb.includes('jacket'),`${p.id}: no jacket in voiceBlock`);
    assert.ok(!vb.includes('denim'),`${p.id}: no denim in voiceBlock`);
    assert.ok(!vb.includes('sneaker'),`${p.id}: no sneaker in voiceBlock`);
  }
  store.close();
});

test('beat direction uses fingerprint not style for tone',()=>{
  const store=new Store();const world=createWorld(trio,registry,'voice8');store.insert(world);
  const {context}=budgetSceneContext(ctx(['yuna']),trio,world,'t1',{window:8192,reply:500,render});
  const y=context.castProfiles.find(p=>p.id==='yuna');
  // Profile should have fingerprint but style should not be in voiceBlock
  assert.ok(y.fingerprint,'fingerprint on profile');
  assert.ok(!y.voiceBlock.style,'no style in voiceBlock');
  store.close();
});

test('haruka voice examples are distinct from yuna',()=>{
  const store=new Store();const world=createWorld(trio,registry,'voice9');store.insert(world);
  const {context}=budgetSceneContext(ctx(['haruka']),trio,world,'t1',{window:8192,reply:500,render});
  const h=context.castProfiles.find(p=>p.id==='haruka');
  assert.ok(h.voiceBlock.fingerprint.includes('Rapid-fire'),'haruka fingerprint');
  const ex=h.voiceBlock.examples.join(' ');
  // Haruka examples should contain her characteristic profanity/banter
  assert.ok(ex.includes('cider')||ex.includes('horror')||ex.includes('pass')||ex.includes('mess'),'haruka examples distinct');
  store.close();
});

test('minji voice examples are distinct',()=>{
  const store=new Store();const world=createWorld(trio,registry,'voice10');store.insert(world);
  const {context}=budgetSceneContext(ctx(['minji']),trio,world,'t1',{window:8192,reply:500,render});
  const m=context.castProfiles.find(p=>p.id==='minji');
  assert.ok(m.voiceBlock.fingerprint.includes('Clipped'),'minji fingerprint');
  const ex=m.voiceBlock.examples.join(' ');
  assert.ok(ex.includes('propeller')||ex.includes('torque')||ex.includes('error')||ex.includes('spec'),'minji examples distinct');
  store.close();
});

test('a legacy actor with no voice/fingerprint keeps the old tag text',()=>{
  const persona={...trio,actors:[...trio.actors,{id:'legacy',name:'Legacy',personality:'Gruff and terse.',voice:undefined,fingerprint:undefined}]};
  assert.match(beatDirection({stagedCast:['legacy'],scenePhase:'opening',playerAction:'Hi',sceneHistory:[]},persona,'s1'),/^Legacy \(Gruff and terse\.\):/,'personality is the tag');
  // Legacy packs (neutral, badge-bond, threshold) keep that same personality line in `style` and have no voice/fingerprint.
  const neutral=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));
  const ada=neutral.actors.find(a=>a.id==='ada');
  assert.equal(ada.voice,undefined);assert.equal(ada.fingerprint,undefined);
  assert.match(beatDirection({stagedCast:['ada'],scenePhase:'continuation',playerAction:'Hand me the spanner.',sceneHistory:[]},neutral,'s1'),/^Ada \(Measured and practical\)/,'legacy style line still tags the speech');
});

test('a voice/fingerprint replaces the legacy tag and clothing never reaches it',()=>{
  for(const a of trio.actors.filter(x=>x.fingerprint)){
    const dir=beatDirection({stagedCast:[a.id],scenePhase:'continuation',playerAction:'Nice frames.',sceneHistory:[]},trio,'s1');
    assert.match(dir,new RegExp(`^${a.name.split(' ')[0]} \\(${a.fingerprint.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`),`${a.id}: fingerprint is the tag`);
    assert.ok(!dir.includes(a.style),`${a.id}: clothing style never in the speech tag`);
  }
});