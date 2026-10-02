import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {castings,expandTemplate,bakeTemplates} from '../packages/cards/role-slots.mjs';

const read=f=>JSON.parse(readFileSync(new URL(f,import.meta.url),'utf8'));
const base=read('./fixtures/route-mechanics.json'),[tpl]=read('./fixtures/role-template.json'),pack=bakeTemplates(base,[tpl]);
const variants=pack.scriptedScenes.filter(x=>x.template?.id==='seen-together'),byId=id=>variants.find(x=>x.id===id);

test('a role-slot template expands to one scene per distinct cast pairing',()=>{
 assert.deepEqual(castings(base,tpl.roles).map(c=>`${c.crush}/${c.witness}`),['juno/theo','juno/priya','theo/juno','theo/priya']);
 assert.deepEqual(variants.map(x=>x.id),['seen-together.juno.theo','seen-together.juno.priya','seen-together.theo.juno','seen-together.theo.priya']);
 assert.doesNotThrow(()=>validatePack(pack,registry),'baked pack is an ordinary valid pack');
 assert.deepEqual(bakeTemplates(pack,[tpl]).scriptedScenes.length,pack.scriptedScenes.length,'re-baking replaces, never duplicates');
});

test('each pairing gets the right names, pronouns, speakers, conditions and effects',()=>{
 const a=byId('seen-together.juno.priya'),b=byId('seen-together.theo.juno');
 assert.equal(a.title,'Priya clocks it');assert.equal(b.title,'Juno clocks it');
 assert.equal(a.opening,'You come in and Juno lights up before she can stop it. Priya sees the whole thing from the end of the bar.');
 assert.equal(b.opening,'You come in and Theo lights up before he can stop it. Juno sees the whole thing from the end of the bar.');
 assert.deepEqual(a.pages.map(x=>[x.speaker,x.text]),[['priya','So. You and Juno. Don\'t make that face, she did the exact same one.'],['juno','Ignore her. She gets bored on quiet nights.']]);
 assert.deepEqual(b.pages.map(x=>x.speaker),['juno','theo']);
 assert.deepEqual(b.when.charactersAt,{theo:'bar',juno:'bar'});assert.deepEqual(b.when.trust,{theo:4});assert.equal(b.when.flags['seen-together.done'],false);
 assert.deepEqual(b.choices[0].effects.slice(0,2).map(e=>e.character),['theo','juno']);
 assert.ok(b.choices.every(c=>c.effects.some(e=>e.id==='seen-together.done')),'every ending choice closes the template');
 assert.ok(b.choices[0].check.fail.effects.some(e=>e.id==='seen-together.done'),'so does a failed check');
 assert.equal(b.choices[1].label,'Turn it back on Juno');
 assert.equal(JSON.stringify(variants).match(/[{@](crush|witness|Crush|Witness)\b/),null,'no unfilled slot left anywhere');
});

test('in play the variant matching the present cast fires, and the template plays only once',()=>{
 let s=createWorld(pack,registry,'rs');s=structuredClone(s);Object.assign(s,{tick:7});s.actors.player.location='market';s.actors.juno.location='bar';s.actors.priya.location='bar';s.actors.theo.location='canal';s.modules['social.relationships'].edges['juno--player']=5;
 s.modules['story.scenes'].completed=base.scriptedScenes.filter(x=>!x.template).map(x=>x.id);// past the authored bar scenes, so only the template competes
 const cmd=(s,type,args)=>execute(s,{type,args,id:`c${s.revision}`,actorId:'player',expectedRevision:s.revision},pack,registry).state;
 s=cmd(s,'core.move',{to:'bar'});const m=s.modules['story.scenes'];
 assert.equal(m.pending,'seen-together.juno.priya','Theo is at the canal, so only the Juno/Priya pairing can play');
 s=cmd(s,'story.choose',{scene:m.pending,choice:'deflect'});assert.equal(s.flags['seen-together.done'],true);
 s.actors.theo.location='bar';s.modules['social.relationships'].edges['theo--player']=5;s.tick=43;s.modules['story.scenes'].storyletSlot=null;
 s=cmd(cmd(s,'core.move',{to:'market'}),'core.move',{to:'bar'});
 assert.ok(['theo','juno'].every(id=>s.actors[id].location==='bar'),'Juno and Theo are both here: without the flag juno.theo would fire now');
 assert.ok(!variants.some(x=>x.id===s.modules['story.scenes'].pending),'another pairing does not replay the same beat');
});
