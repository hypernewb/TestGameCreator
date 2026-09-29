import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';

// Per-heroine endings: being exclusive with her when the term runs out gives her ending; her arc's final flag plus her top rank gives the fuller one.
const pack=()=>JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url)));
const HEROINES=['jana','monique','nova','abigail'];
const finish=(p,f)=>{let state=structuredClone(createWorld(p,registry,'end'));state.flags['term-over']=true;state.tick=state.run.endTick;f(state);state=execute(state,{id:'end-1',actorId:p.playerId,type:'core.wait',args:{},expectedRevision:state.revision},p,registry).state;return state.modules['story.endings'].selected;};
const exclusive=c=>s=>{s.modules['social.dating'].characters[c].phase='exclusive';};

test('nobody chosen by the last day ends on the term-ends fallback',()=>{assert.equal(finish(pack(),()=>{}),'term-ends');});

for(const c of HEROINES)test(`${c}: exclusive at term end picks her together ending, her arc plus top rank picks her route ending`,()=>{
 const p=pack(),route=p.endings.find(e=>e.character===c&&e.priority===20),together=`${c}-together`;assert.ok(route&&p.endings.some(e=>e.id===together));
 assert.equal(finish(p,exclusive(c)),together);
 assert.equal(finish(p,s=>{exclusive(c)(s);Object.assign(s.flags,route.requires.flags);const prof=p.romanceTempoProfiles.find(x=>x.character===c);s.modules['social.romance-tempo'].characters[c].rank=prof.ranks.findIndex(r=>r.id===route.requires.romanceRanks[c]);}),route.id);
});
