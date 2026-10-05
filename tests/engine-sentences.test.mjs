import test from 'node:test';import assert from 'node:assert/strict';
import {pronounOf} from '../packages/core/engine.mjs';
import {changeMoney} from '../packages/modules/economy.mjs';
// Engine lines shown in the chat read like a person said them: the character's own pronoun, money as spent/got.
test('arrival notes use the character pronoun and default to they',()=>{
 const pack={actors:[{id:'ines',pronouns:'she/her'},{id:'olu',pronouns:'he/him'},{id:'kai'}]};
 assert.deepEqual(['ines','olu','kai'].map(id=>{const w=pronounOf(pack,id);return `${w.they} ${w.are}; ${w.ll}`;}),["she is; she'll","he is; he'll","they are; they'll"]);
});
test('money changes say what was spent or got and what is left',()=>{
 const said=[];const tx=d=>({state:{modules:{'world.economy':{balance:100}}},pack:{playerId:'me'},set(){},emit(type,p){said.push(p.text);}});
 changeMoney(tx(),-20);changeMoney(tx(),30);
 assert.deepEqual(said,['Spent $20; $80 left.','Got $30; $130 now.']);
});
