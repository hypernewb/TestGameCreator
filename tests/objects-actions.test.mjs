import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,actions} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';

const pack=JSON.parse(readFileSync(new URL('../packs/living-world.json',import.meta.url),'utf8'));
const at=(s,loc)=>{s=structuredClone(s);s.actors.player.location=loc;return s;},run=(s,args)=>execute(s,{type:'world.explore',args,id:`x${s.revision}`,actorId:'player',expectedRevision:s.revision},pack,registry).state;
const buttons=s=>actions(s,pack,registry).filter(a=>a.type==='world.explore').map(a=>`${a.args.target}:${a.args.mode}`);

test('object buttons disappear once they can no longer change anything; the commands still work',()=>{
 let s=at(createWorld(pack,registry,'o'),'hub');assert.deepEqual(buttons(s),['bulletin-board:inspect']);
 s=run(s,{target:'bulletin-board',mode:'inspect'});assert.deepEqual(buttons(s),[],'read once, gone');
 assert.ok(run(s,{target:'bulletin-board',mode:'inspect'}).revision>s.revision,'typed "look at the board again" still resolves');
 s=at(s,'workshop');assert.deepEqual(buttons(s),['workbench-drawer:inspect','workbench-drawer:search_take']);
 s=run(s,{target:'workbench-drawer',mode:'inspect'});assert.deepEqual(buttons(s),['workbench-drawer:search_take'],'the token is still in there to take');
 s=run(s,{target:'workbench-drawer',mode:'search_take'});assert.equal(s.modules['items.inventory'].owners.token,'player');assert.deepEqual(buttons(s),[],'emptied');
});
