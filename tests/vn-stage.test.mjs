import test from 'node:test';
import assert from 'node:assert/strict';
import {stageCastIds} from '../public/vn-stage.mjs';

const pack={playerId:'player',actors:[{id:'player'},{id:'mina',poses:[{id:'smile'}]},{id:'rowan'}]};
const state=scene=>({actors:{player:{location:'room'},mina:{location:'room'},rowan:{location:'roof'}},scene});

test('a colocated character is not drawn unless the committed scene casts them',()=>{
 assert.deepEqual(stageCastIds(state(null),pack,{command:{type:'world.nextDaypart'}},null,[{speaker:'',text:'Two messages glow.'}]),[]);
 assert.deepEqual(stageCastIds(state({location:'room',characters:['mina']}),pack,{},null,[{speaker:'mina',text:'Hi.'}]),['mina']);
});

test('the completed turn cast and authored stage directions can keep a legal actor on screen',()=>{
 assert.deepEqual(stageCastIds(state(null),pack,{scenePlan:{cast:['mina']}},null,[{speaker:'mina',text:'See you.'}]),['mina']);
 assert.deepEqual(stageCastIds(state(null),pack,{}, {stage:['show:mina'],pages:[]},[]),['mina']);
 assert.deepEqual(stageCastIds(state(null),pack,{scenePlan:{cast:['rowan']}},null,[{speaker:'rowan',text:'Remote voice.'}]),[], 'off-location actors are never drawn');
});
