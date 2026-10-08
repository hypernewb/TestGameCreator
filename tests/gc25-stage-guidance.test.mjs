import test from 'node:test';
import assert from 'node:assert/strict';
import {relationshipStageOf} from '../packages/ai/character-context.mjs';
import {budgetSceneContext} from '../packages/ai/context-budget.mjs';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';

const actor={id:'a',name:'Ari'};
const pack=()=>({schemaVersion:1,id:'gc25',title:'GC25',version:'0.1.0',playerId:'player',modules:{},locations:[{id:'room',name:'Room',exits:[]}],
 actors:[{id:'player',name:'Player',location:'room'},{id:'a',name:'Ari',location:'room',personality:'Quiet',voice:'Measured',fingerprint:'Short clauses',examples:['Hello there.'],behavior:{withStrangers:'Polite.',withFriends:'Teases.',withLover:'Relaxed.'}}],
 relationshipStates:[{id:'route-start',name:'Introduction'},{id:'a-route-1',name:'Connection'}],
 relationshipProgressions:[{character:'a',initial:'route-start',transitions:[]}]});
const ctx=(extra={})=>({stagedCast:['a'],scenePhase:'continuation',playerAction:'How is your day?',memories:[],pastScenes:[],...extra});
const world=trust=>({events:[],turns:{},modules:{'social.relationships':{edges:{'a--player':trust}}}});

// Rule (b): no authored stage, trust thresholds decide the stage label.
test('GC2.5 (b) trust fallback: thresholds 0/40/75 map to stranger/friend/close when no dating phase',()=>{
 assert.equal(relationshipStageOf({},actor,2),'stranger');
 assert.equal(relationshipStageOf({},actor,40),'friend');
 assert.equal(relationshipStageOf({},actor,75),'close');
 assert.equal(relationshipStageOf({},actor,null),'');
});

// Rule (c): factual dating status, strain and breakup outrank a friendly trust label.
test('GC2.5 (c) dating phase outranks high trust; breakup and rejection are not erased by trust 90',()=>{
 for(const phase of ['dating','exclusive','broken','rejected'])
  assert.equal(relationshipStageOf({dating:[{character:'a',phase}]},actor,90),phase);
});
test('GC2.5 (c) strain is reported from dating state and never overrides broken/rejected',()=>{
 assert.equal(relationshipStageOf({dating:[{character:'a',phase:'dating',strained:true}]},actor,90),'strained');
 assert.equal(relationshipStageOf({dating:[{character:'a',phase:'broken',strained:true}]},actor,90),'broken');
 assert.equal(relationshipStageOf({dating:[{character:'a',phase:'rejected',strained:true}]},actor,90),'rejected');
});

// Rule (c) prompt side: the cast profile carries the stage the engine computed, not a re-derived trust label.
test('GC2.5 (c) budgeted cast profile carries a breakup label into the prompt',()=>{
 const p=pack(),out=budgetSceneContext(ctx({dating:[{character:'a',phase:'broken'}]}),p,world(90),'t1',{window:8192,reply:500,render:x=>scenePromptMessages(x,p)}).context;
 assert.equal(out.castProfiles.length,1);assert.equal(out.castProfiles[0].relationshipStage,'broken');
});

// Rule (a): authored progression stage should feed the stage line.
test.todo('GC2.5 (a) authored stage (social.progression state name) drives the stage line; todo-gap: relationshipStageOf never reads social.progression, only dating phase and trust');

// Bounds: boundaries and agreement gates are not part of relationshipStageOf output.
test.todo('GC2.5 bounds: refusal/boundary text reaches the stage prompt; todo-gap: not verified, no stage-line code reads agreementGates');
