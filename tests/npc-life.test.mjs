import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack,fallback} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {contextFor} from '../packages/ai/context.mjs';
import {calendarFor} from '../public/calendar.mjs';

const base=()=>{const p=JSON.parse(readFileSync(new URL('../packs/npc-social.json',import.meta.url)));p.actors.push({id:'dex',name:'Dex',location:'workshop'});return p;};
const run=(p,seed=7)=>{let s=createWorld(p,registry,'npc-life',seed);const act=(type,args={})=>{const r=execute(s,{id:`c${s.revision}`,type,args,actorId:p.playerId,expectedRevision:s.revision},p,registry);s=r.state;return r;};return {act,get s(){return s;}};};
const events=(s,type)=>s.events.filter(e=>e.type===type);

test('authored groups meet off-screen, witnessed only by NPCs physically in the room',()=>{
 const p=base();p.modules['social.gossip']='0.1.0';p.npcGroups=[{id:'makers',name:'Makers',members:['brin','cyra']}];p.npcSimulation={maxGroupSize:2};
 p.gossipRules=[{id:'seen-together',event:'social.npcEncounter',summary:'{names} were seen together at {place}.',seedFrom:'witnesses',ttl:24}];
 const c=run(p);for(let i=0;i<4;i++)c.act('core.wait');
 const [e]=events(c.s,'social.npcEncounter');assert.equal(e.payload.group,'makers');assert.deepEqual(e.payload.members,['brin','cyra']);
 assert.deepEqual([...e.visibility].sort(),['brin','cyra','dex']);assert.deepEqual(e.payload.witnesses,e.visibility);
 for(const x of events(c.s,'social.npcEncounter'))assert.ok(!x.visibility.includes('player')&&!x.visibility.includes('ada'));
 assert.ok(!contextFor(c.s,p,'player').recentActions.some(x=>x.type.startsWith('social.npc')));
 assert.ok(Object.values(c.s.turns).every(t=>!/Brin|Cyra/.test(fallback(t))));
 const rumor=c.s.modules['social.gossip'].rumors.find(r=>r.rule==='seen-together');assert.equal(rumor.summary,'Brin and Cyra were seen together at Workshop.');
 assert.ok(rumor.holders.dex&&!rumor.holders.player&&!rumor.holders.ada);assert.equal(rumor.sourceEvent,e.id);
});

test('seeded runs reproduce exactly; a different seed may differ but stays valid',()=>{
 const p=base();p.npcGroups=[{id:'makers',members:['brin','cyra','dex']}];p.npcSimulation={runInChance:1};
 const play=seed=>{const c=run(p,seed);for(let i=0;i<24;i++)c.act('core.wait');return c.s;};
 const a=play(11),b=play(11);assert.deepEqual(a.modules['social.npc'],b.modules['social.npc']);
 assert.deepEqual(a.events.map(e=>[e.type,e.payload,e.visibility]),b.events.map(e=>[e.type,e.payload,e.visibility]));
 assert.ok(events(a,'social.npcEncounter').length>=3);
});

test('run-ins are the only on-screen overlay and are capped per day',()=>{
 const p=base();p.npcGroups=[{id:'makers',members:['brin','cyra'],runInText:'{names} are arguing over a blueprint in the {location}.'}];p.npcSimulation={runInsPerDay:1,runInChance:1};
 const c=run(p);c.act('core.move',{to:'workshop'});for(let i=0;i<30;i++)c.act('core.wait');
 const runIns=events(c.s,'social.npcRunIn');assert.ok(runIns.length>=2);
 const days=runIns.map(e=>calendarFor(e.tick,p).day);assert.equal(new Set(days).size,days.length);
 assert.equal(runIns[0].payload.text,'Brin and Cyra are arguing over a blueprint in the Workshop.');assert.ok(runIns[0].visibility.includes('player')&&runIns[0].visibility.includes('dex'));
 assert.ok(Object.values(c.s.turns).some(t=>fallback(t).includes('arguing over a blueprint')));
 p.npcSimulation.runInsPerDay=0;const quiet=run(p);quiet.act('core.move',{to:'workshop'});for(let i=0;i<30;i++)quiet.act('core.wait');assert.equal(events(quiet.s,'social.npcRunIn').length,0);
});

test('simulation frequency and caps are creator controls',()=>{
 const p=base();p.npcSimulation={everySlots:3};const c=run(p);for(let i=0;i<24;i++)c.act('core.wait');
 const slots=events(c.s,'social.npcSettled').map(e=>e.payload.slot);assert.ok(slots.length&&slots.every(x=>x%3===0));
 p.npcSimulation={maxGroups:0,runInsPerDay:0};const off=run(p);for(let i=0;i<24;i++)off.act('core.wait');assert.equal(events(off.s,'social.npcEncounter').length,0);
 assert.deepEqual(off.s.modules['social.npc'].pairs,{'brin|cyra':{affinity:3}});
});

test('new friendships leave a memory only the pair can recall',()=>{
 const p=base();p.initialNpcRelationships=[{a:'brin',b:'cyra',affinity:3}];p.npcGroups=[{id:'makers',members:['brin','cyra']}];
 let s;for(let seed=1;seed<50&&!s;seed++){const c=run(p,seed);for(let i=0;i<8;i++)c.act('core.wait');if(events(c.s,'social.npcFriendship').length)s=c.s;}
 const [f]=events(s,'social.npcFriendship');assert.deepEqual(f.visibility,['brin','cyra']);assert.equal(f.payload.text,'Brin and Cyra became friends at Workshop.');
 assert.deepEqual(contextFor(s,p,'brin').npcFriendshipMemories,[f.payload.text]);
 for(const who of ['player','ada','dex'])assert.equal(contextFor(s,p,who).npcFriendshipMemories,undefined);
});

test('NPC group and simulation settings are validated',()=>{
 const bad=[{npcGroups:[{id:'solo',members:['brin']}]},{npcGroups:[{id:'x',members:['brin','player']}]},{npcGroups:[{id:'x',members:['brin','cyra'],locations:['moon']}]},{npcSimulation:{everySlots:0}},{npcSimulation:{runInChance:2}},{npcSimulation:{maxGroupSize:9}}];
 for(const extra of bad)assert.throws(()=>validatePack({...base(),...extra},registry),/npc/i);
 assert.doesNotThrow(()=>validatePack({...base(),npcGroups:[{id:'makers',members:['brin','cyra'],locations:['workshop']}],npcSimulation:{everySlots:2,runInChance:0.25}},registry));
});
