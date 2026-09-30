import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store,exportCampaign,validateImport} from '../packages/persistence/store.mjs';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';

const pack=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));

test('scene writer is fixed at creation and survives storage and export',()=>{
 const state=createWorld(pack,registry,'writer-test',42,undefined,{sceneWriter:'venus'});
 const store=new Store();
 try{
  store.insert(state);
  assert.equal(store.load(state.campaignId).sceneWriter,'venus');
  assert.equal(validateImport(exportCampaign(state),pack,registry).sceneWriter,'venus');
  assert.throws(()=>createWorld(pack,registry,'bad',42,undefined,{sceneWriter:'other'}),/Unknown scene writer/);
 }finally{store.close();}
});

test('Venus-inspired prompt keeps the shared contract and requests a full scene turn',()=>{
 const context={sceneWriter:'venus',stagedCast:['ada'],scenePhase:'continuation',sceneBudget:{budget:3,inputs:2,focus:'ada'},sceneHistory:[],playerAction:'How was your day?'};
 const [system,user]=scenePromptMessages(context,pack);
 assert.match(system.content,/VENUS SCENE STRUCTURE/);
 assert.match(system.content,/6–9 visual-novel entries/);
 assert.match(system.content,/at least four of the remaining entries NPC dialogue/);
 assert.match(system.content,/End with a specific question or offer/);
 assert.match(system.content,/OUTPUT CONTRACT: Return one JSON object/);
 assert.match(user.content,/Respond directly to the latest player words or action/);
 assert.doesNotMatch(system.content,/Then 2–5 short entries/);
 const [original]=scenePromptMessages({...context,sceneWriter:'framework'},pack);
 assert.doesNotMatch(original.content,/VENUS SCENE STRUCTURE/);
 assert.match(original.content,/6–9 visual-novel entries/);
 assert.match(original.content,/pursue the beat direction/);
});
