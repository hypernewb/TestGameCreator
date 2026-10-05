import test from 'node:test';import assert from 'node:assert/strict';
import {scenePromptMessages,CONTRAST_RULE} from '../vendor/venus/scenePrompt.mjs';
import {venusStyleMessages} from '../vendor/venus/venusStylePrompt.mjs';
import {readFileSync} from 'node:fs';
import {validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
// A non-campus pack: two harbor hands who must not sound alike.
const pack={playerId:'me',actors:[{id:'me',name:'You'},{id:'olu',name:'Olu',voice:'short and dry',neverSays:['sweetheart','honestly']},{id:'bea',name:'Bea',voice:'rambling'}],locations:[]};
const ctx=cast=>({stagedCast:cast,scenePhase:'continuation',playerAction:'I ask about the storm.'});
test('a character sheet’s never-says list reaches both writers, and a group scene asks for distinct voices',()=>{
 for(const write of [scenePromptMessages,venusStyleMessages]){
  const [sys,user]=write(ctx(['olu','bea']),pack),all=sys.content+user.content;
  assert.match(all,/Never says: sweetheart; honestly\./,write.name);
  assert.ok(sys.content.includes(CONTRAST_RULE),write.name);
  const [solo]=write(ctx(['olu']),pack);assert.ok(!solo.content.includes(CONTRAST_RULE),`${write.name}: one NPC needs no contrast rule`);
  assert.doesNotMatch(write(ctx(['bea']),pack).map(m=>m.content).join(''),/Never says/,'no list, no line');
 }
});
test('neverSays is validated as a short list',()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url))),npc=p.actors.find(a=>a.id!==p.playerId);
 npc.neverSays=['sweetheart'];validatePack(p,registry);
 for(const bad of ['sweetheart',['  '],[3]]){npc.neverSays=bad;assert.throws(()=>validatePack(p,registry),/neverSays/);}
});
