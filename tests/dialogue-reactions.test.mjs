import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';

const base=()=>JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));
const act=(state,pack,id,type,args)=>execute(state,{id,type,args,actorId:pack.playerId,expectedRevision:state.revision},pack,registry);

test('authored dialogue reactions change visible relationship values with repeat decay',()=>{
 const p=base();delete p.modules['world.schedule'];p.modules['social.bonds']='0.1.0';p.relationshipDimensions=[{id:'love',name:'Love'}];p.initialRelationships=[{character:'ada',trust:40}];p.initialBonds=[{character:'ada',dimension:'love',value:10}];p.dialogueReactions=[{id:'support',character:'ada',phrases:['proud of you'],trustDelta:4,bonds:{love:2},cooldownTicks:3}];validatePack(p,registry);
 let s=createWorld(p,registry,'dialogue-reaction');s=act(s,p,'open','core.scene',{text:'Sit with Ada.',location:'hub',characters:['ada'],activity:'talk'}).state;
 let r=act(s,p,'one','core.scene',{text:'I am proud of you.',location:'hub',characters:['ada'],activity:'continue'});s=r.state;assert.equal(s.modules['social.relationships'].edges['ada--player'],44);assert.equal(s.modules['social.bonds'].values['ada--love--player'],12);assert.ok(r.turn.events.some(e=>e.payload.text==='Ada: Trust 40 → 44'));
 r=act(s,p,'two','core.scene',{text:'Still proud of you.',location:'hub',characters:['ada'],activity:'continue'});s=r.state;assert.equal(s.modules['social.relationships'].edges['ada--player'],46);assert.equal(s.modules['social.bonds'].values['ada--love--player'],13);assert.ok(r.turn.events.some(e=>/repeated; reduced effect/.test(e.payload.text||'')));
 s=act(s,p,'three','core.scene',{text:'Proud of you.',location:'hub',characters:['ada'],activity:'continue'}).state;assert.equal(s.modules['social.relationships'].edges['ada--player'],46);assert.equal(s.modules['social.bonds'].values['ada--love--player'],13);
});

test('dialogue reaction definitions reject unknown dimensions and excessive deltas',()=>{const p=base();p.dialogueReactions=[{id:'bad',phrases:['hello'],trustDelta:20,bonds:{missing:2}}];assert.throws(()=>validatePack(p,registry),/dialogueReactions/);});
