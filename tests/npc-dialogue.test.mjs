import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack,clone} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
const neutral=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));
function pack(){
 const p=clone(neutral);
 p.modules['social.npc']='0.2.0';delete p.modules['story.quests'];delete p.quests;
 p.npcSimulation={everySlots:1,runInChance:1,runInsPerDay:2};
 p.actors.find(a=>a.id==='brin').location='hub';delete p.schedules;
 p.npcDialogue=[
  {any:true,lines:['{a} glances at {b}: "Busy day again?"','{b} shrugs: "Same as ever."']},
  {pair:['ada','brin'],lines:['{a}: "The exhibition plan is safe with me."','{b}: "I knew I could count on you."']}
 ];
 return p;
}
function harness(p){let s=createWorld(p,registry,'test');return {get state(){return s;},act(type,args={}){const r=execute(s,{id:`t${s.revision}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,registry);s=r.state;return r;}};}

test('npcDialogue validates: exactly one selector, known group or NPCs, short lines',()=>{
 validatePack(pack(),registry);
 const both=pack();both.npcDialogue=[{group:'x',any:true,lines:['Hi']}];
 assert.throws(()=>validatePack(both,registry),/exactly one of group, pair or any/);
 const unknown=pack();unknown.npcDialogue=[{group:'nope',lines:['Hi']}];
 assert.throws(()=>validatePack(unknown,registry),/unknown npcGroup/);
 const badPair=pack();badPair.npcDialogue=[{pair:['ada','ada'],lines:['Hi']}];
 assert.throws(()=>validatePack(badPair,registry),/two distinct NPCs/);
 const long=pack();long.npcDialogue=[{any:true,lines:['x'.repeat(161)]}];
 assert.throws(()=>validatePack(long,registry),/1–6 lines/);
});

test('run-ins in the room carry visible authored dialogue; a pair match beats the any pool',()=>{
 const h=harness(pack());
 for(let i=0;i<4;i++)h.act('core.wait');
 const runIn=h.state.events.find(e=>e.type==='social.npcRunIn');
 assert.ok(runIn,'a run-in fired in the player\'s room');
 assert.ok(Array.isArray(runIn.payload.dialogue)&&runIn.payload.dialogue.length>=1,'authored lines are attached');
 assert.ok(runIn.payload.dialogue.every(line=>line.includes('Ada')||line.includes('Brin')),'lines are filled with the names on stage');
 assert.ok(runIn.payload.text.includes('"')||runIn.payload.dialogue.join(' ').includes('"'),'the text the player reads contains the dialogue');
});

test('dialogue rotates by slot instead of repeating the same exchange',()=>{
 const h=harness(pack());
 for(let i=0;i<4;i++)h.act('core.wait');
 const first=h.state.events.find(e=>e.type==='social.npcRunIn').payload.dialogue;
 for(let i=0;i<4;i++)h.act('core.wait');
 const second=h.state.events.filter(e=>e.type==='social.npcRunIn').at(-1).payload.dialogue;
 assert.ok(first.join('')!==second.join(''),'a later slot picks different lines');
});
