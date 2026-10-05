import test from 'node:test';
import assert from 'node:assert/strict';
import {renameId} from '../public/studio-rename.mjs';
const pack=()=>({playerId:'player',locations:[{id:'start',name:'start',aliases:['start'],description:'start',exits:[{to:'cafe'}]},{id:'cafe',name:'Café',exits:[{to:'start'}]}],
 actors:[{id:'player',location:'start'},{id:'mara',location:'cafe',examples:['mara']}],startOptions:[{id:'a',playerLocation:'start'}],schedules:[{actor:'mara',stops:[{location:'start'}]}],
 scriptedScenes:[{when:{charactersAt:{mara:'start'}},pages:[{speaker:'mara',text:'mara'}]}],facts:[{knownBy:['mara','player']}],gameProject:{premise:'start',ui:{selected:'start'}}});
test('renaming a location ID rewrites references but not prose or the Game UI',()=>{
 const p=pack(),loc=p.locations[0];loc.id='harbor';const r=renameId(p,loc,'start','harbor');assert.ok(r.ok);assert.equal(r.count,5);
 assert.equal(p.actors[0].location,'harbor');assert.equal(p.startOptions[0].playerLocation,'harbor');assert.equal(p.locations[1].exits[0].to,'harbor');assert.equal(p.schedules[0].stops[0].location,'harbor');assert.equal(p.scriptedScenes[0].when.charactersAt.mara,'harbor');
 assert.deepEqual([loc.name,loc.aliases[0],loc.description,p.gameProject.premise,p.gameProject.ui.selected],['start','start','start','start','start']);
});
test('renaming a character ID rewrites values, object keys and playerId',()=>{
 const p=pack();p.actors[1].id='mara2';assert.ok(renameId(p,p.actors[1],'mara','mara2').ok);
 assert.deepEqual(Object.keys(p.scriptedScenes[0].when.charactersAt),['mara2']);assert.equal(p.schedules[0].actor,'mara2');assert.deepEqual(p.facts[0].knownBy,['mara2','player']);assert.equal(p.scriptedScenes[0].pages[0].speaker,'mara2');
 assert.equal(p.scriptedScenes[0].pages[0].text,'mara');assert.deepEqual(p.actors[1].examples,['mara']);
 const q=pack();q.actors[0].id='you';renameId(q,q.actors[0],'player','you');assert.equal(q.playerId,'you');assert.deepEqual(q.facts[0].knownBy,['mara','you']);
});
test('rename refuses a taken ID and skips an ambiguous old ID',()=>{
 const p=pack(),before=JSON.stringify(p);p.locations[0].id='cafe';const r=renameId(p,p.locations[0],'start','cafe');assert.equal(r.ok,false);assert.match(r.error,/already used in locations/);p.locations[0].id='start';assert.equal(JSON.stringify(p),before);
 const q=pack();q.actors.push({id:'start'});q.locations[0].id='harbor';const w=renameId(q,q.locations[0],'start','harbor');assert.ok(w.ok);assert.equal(w.count,0);assert.match(w.warning,/also names an entry in actors/);assert.equal(q.actors[0].location,'start');
 assert.deepEqual(renameId(pack(),{},'x','x'),{ok:true,count:0});
});
