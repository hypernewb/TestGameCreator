import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack,replay,clone} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {statValue} from '../packages/modules/stats.mjs';
const neutral=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));
function pack(){
 const p=clone(neutral);
 p.modules['character.stats']='0.1.0';delete p.modules['world.schedule'];delete p.schedules;
 p.statDefinitions=[
  {id:'charm',name:'Charm',min:0,max:10,visibility:'player'},
  {id:'poise',name:'Poise',min:0,max:20,visibility:'public',derived:{parts:[{stat:'charm',weight:2}],flat:1}}
 ];
 p.initialStats=[{character:'player',stat:'charm',value:2}];
 p.statMilestones=[{id:'charming',stat:'charm',min:5,flag:'charming',text:'You carry yourself with easy charm.'}];
 return p;
}
function harness(p){let s=createWorld(p,registry,'test');return {get state(){return s;},act(type,args={}){const r=execute(s,{id:`t${s.revision}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,registry);s=r.state;return r;}};}

test('derived stat packs validate; sources cannot be derived or cyclic',()=>{
 validatePack(pack(),registry);
 const bad=pack();bad.statDefinitions[1].derived.parts[0].stat='poise';
 assert.throws(()=>validatePack(bad,registry),/plain stats/);
 const chain=clone(pack());chain.statDefinitions.push({id:'aura',name:'Aura',min:0,max:40,visibility:'player',derived:{parts:[{stat:'poise',weight:1}]}});
 assert.throws(()=>validatePack(chain,registry),/plain stats/);
 const milestone=pack();milestone.statMilestones=[{id:'m',stat:'poise',min:5,flag:'flagged'}];
 assert.throws(()=>validatePack(milestone,registry),/plain stat/);
});

test('derived stats start computed from initial stats',()=>{
 const p=pack(),s=createWorld(p,registry,'test');
 assert.equal(statValue(s,'player','poise'),5,'2×2+1 at init');
});

test('a direct change to a derived stat is refused',()=>{
 const p=pack();
 p.modules['story.scenes']='0.1.0';
 p.scriptedScenes=[{id:'poise-training',title:'Poise training',opening:'You rehearse standing tall.',trigger:{event:'core.inspected'},choices:[{id:'train',label:'Train poise',result:'You stand straighter.',effects:[{type:'stat',stat:'poise',delta:2}]}]}];
 let s=createWorld(p,registry,'test');
 const r=execute(s,{id:'t0',actorId:p.playerId,type:'core.inspect',args:{},expectedRevision:s.revision},p,registry);s=r.state;
 assert.throws(()=>execute(s,{id:'t1',actorId:p.playerId,type:'story.choose',args:{scene:'poise-training',choice:'train'},expectedRevision:s.revision},p,registry),/derived and cannot change directly/);
});

test('milestones set their flag once when the stat crosses the threshold',()=>{
 const p=pack();
 // Drive changeStat through a scripted scene choice with a stat effect.
 p.modules['story.scenes']='0.1.0';
 p.scriptedScenes=[{id:'charm-lesson',title:'Charm lesson',repeatable:true,opening:'You practice your lines.',trigger:{event:'core.inspected'},choices:[{id:'practice',label:'Practice',result:'You feel sharper.',effects:[{type:'stat',stat:'charm',delta:3}]}]}];
 let s=createWorld(p,registry,'test'),act=(type,args={})=>{const r=execute(s,{id:`t${s.revision}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,registry);s=r.state;return r;};
 act('core.inspect');act('story.choose',{scene:'charm-lesson',choice:'practice'});
 assert.equal(statValue(s,'player','charm'),5);
 assert.equal(statValue(s,'player','poise'),11,'derived recomputed: 2×5+1');
 assert.equal(s.flags.charming,true,'milestone fired at charm 5');
 assert.ok(s.events.some(e=>e.type==='character.statMilestone'&&e.payload.milestone==='charming'));
 assert.ok(s.events.some(e=>e.type==='character.statChanged'&&e.payload.stat==='poise'&&e.payload.derived));
 act('core.inspect');act('story.choose',{scene:'charm-lesson',choice:'practice'});
 assert.equal(statValue(s,'player','charm'),8);
 assert.equal(statValue(s,'player','poise'),17);
 assert.equal(s.flags.charming,true,'flag set only once, stays set');
 const restored=replay(createWorld(p,registry,'test'),s.events);
 assert.deepEqual(restored.modules['character.stats'],s.modules['character.stats']);
});
