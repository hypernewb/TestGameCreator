import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,clone} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {MockProvider} from '../packages/ai/providers.mjs';
import {speakStreak} from '../scripts/ai-game-tester.mjs';
const neutral=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));
function pack(){const p=clone(neutral);delete p.modules['world.schedule'];delete p.schedules;return p;}
function harness(p){let s=createWorld(p,registry,'test');return {get state(){return s;},act(type,args={}){const r=execute(s,{id:`t${s.revision}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,registry);s=r.state;return r;}};}
const LATHE='I finally fixed the stubborn lathe in the workshop';

test('novelty-weighted trust: generic talk pays nothing, substantive new talk pays once, repeats never pay',()=>{
 const h=harness(pack()),trust=()=>h.state.modules['social.relationships'].edges['ada--player']||0,start=trust();
 h.act('social.speak',{target:'ada',text:'Hi'});
 assert.equal(trust(),start,'hi is generic: no trust');
 h.act('social.speak',{target:'ada',text:'How are things going?'});
 assert.equal(trust(),start,'generic questions earn nothing even when fresh');
 h.act('social.speak',{target:'ada',text:LATHE});
 assert.equal(trust(),start+1,'first substantive chat of the day pays +1');
 h.act('social.speak',{target:'ada',text:LATHE});
 assert.equal(trust(),start+1,'the same story twice pays nothing');
 for(let i=0;i<13;i++)h.act('core.wait');
 h.act('social.speak',{target:'ada',text:'How are things going?'});
 assert.equal(trust(),start+1,'a new day does not make generic talk pay');
 h.act('social.speak',{target:'ada',text:LATHE});
 assert.equal(trust(),start+1,'a repeated topic is not novelty, even on a new day');
 h.act('social.speak',{target:'ada',text:'I promise to fix the leaky roof too'});
 assert.equal(trust(),start+3,'promises always count (+2)');
});

test('re-asking the same question answers for free: 0-tick clarification, no turn committed',async()=>{
 const p=pack(),store=new Store();
 const s=createWorld(p,registry,'test');store.insert(s);
 const svc=new GameService(store,{[p.id]:p},registry,new MockProvider());
 const first=await svc.act('test',{id:'q1',expectedRevision:0,command:{type:'social.speak',args:{target:'ada',text:'What are you building in the workshop lately?'}}});
 assert.ok(first.turn,'the first ask commits normally');
 const revision=first.state.revision,ticks=Object.keys(first.state.turns).length,tick=first.state.tick;
 const second=await svc.act('test',{id:'q2',expectedRevision:revision,input:'What are you building in the workshop lately?'});
 assert.ok(second.clarification,'the exact re-ask is answered with a clarification');
 assert.match(second.clarification,/already said that/);
 assert.equal(second.state.revision,revision,'no turn was committed');
 assert.equal(Object.keys(second.state.turns).length,ticks,'the turn count is unchanged');
 assert.equal(second.state.tick,tick,'no time passed');
 const third=await svc.act('test',{id:'q3',expectedRevision:revision,input:'That sounds wonderful and very true'});
 assert.ok(third.turn,'fresh input still commits normally');
 store.close();
});

test('speakStreak measures interview-mode runs and the gate caps them',()=>{
 const history=[{command:'social.speak'},{command:'social.speak'},{command:'social.speak'},{command:'core.wait'},{command:'social.speak'}];
 assert.equal(speakStreak(history),3);
 assert.equal(speakStreak([{command:'core.wait'},{command:'core.move'}]),0);
});
