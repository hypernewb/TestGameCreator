import test from 'node:test';
import assert from 'node:assert/strict';
import {lintScene} from '../packages/ai/narration-lint.mjs';
const scene=(lines=[])=>({lines}),pack=()=>({actors:[{id:'juno',name:'Juno'}]});

test('typed activities refuse narrator-scripted player transactions, softly',()=>{
 const context={typedActivity:true,playerAction:'I start the closing shift',daypart:'Evening'};
 assert.throws(()=>lintScene(scene([{speaker:'',text:'You pocket the till tips and grin.'}]),context,pack()),/purchases, sales, trades and item transfers are committed by the engine/);
 try{lintScene(scene([{speaker:'',text:'You pocket the till tips.'}]),context,pack());}catch(e){assert.equal(e.soft,true);assert.equal(e.lintCheck,'player-transactions');}
 assert.throws(()=>lintScene(scene([{speaker:'',text:'You buy a round for the bar.'}]),context,pack()),/engine/);
});

test('what the player actually typed is allowed, and dialogue and normal scenes pass through',()=>{
 const context={typedActivity:true,playerAction:'I buy a round and get to work'};
 assert.doesNotThrow(()=>lintScene(scene([{speaker:'',text:'You buy a round for the table.'}]),context,pack()),'the verb the player typed is theirs');
 assert.doesNotThrow(()=>lintScene(scene([{speaker:'juno',text:'You are buying a round? Bold.'}]),{typedActivity:true,playerAction:'get to work'},pack()),'character lines are exempt');
 assert.doesNotThrow(()=>lintScene(scene([{speaker:'',text:'You pocket the till tips.'}]),{playerAction:''},pack()),'non-typed scenes are unchecked');
 assert.doesNotThrow(()=>lintScene(scene([{speaker:'',text:'The floor is sticky near the taps.'}]),{typedActivity:true,playerAction:'start the shift'},pack()));
});
