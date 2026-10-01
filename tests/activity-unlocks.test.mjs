import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack,actions,rankLock} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {advanceRomanceRank} from '../packages/modules/romance-tempo.mjs';
import {activityBlocked} from '../packages/ai/service.mjs';
import {hub} from '../public/campus.mjs';

const pack=()=>JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url)));
const at=(s,who,loc)=>{s.actors[who].location=loc;s.actors.player.location=loc;return s;};
const scene=(s,p,id)=>{const a=p.activities.find(x=>x.id===id);return execute(s,{id:`u-${s.revision}`,actorId:p.playerId,type:'core.scene',args:{text:a.name,location:a.location,characters:[a.character],activity:'other',activityId:a.id},expectedRevision:s.revision},p,registry);};

test('minRank validates only as a later rank of the activity character’s own profile',()=>{
 const bad=patch=>{const p=pack();Object.assign(p.activities.find(a=>a.id==='darts-with-jana'),patch);return ()=>validatePack(p,registry);};
 assert.doesNotThrow(bad({}));
 assert.throws(bad({minRank:'ally'}),/minRank: invalid/,'another heroine’s rank');
 assert.throws(bad({minRank:'roommate'}),/minRank: invalid/,'the starting rank is no unlock');
 assert.throws(bad({character:undefined}),/minRank: invalid/);
});

test('a social-link activity stays locked, with a teaser, until the rank is reached',()=>{
 const p=pack();let s=at(createWorld(p,registry,'unlock'),'jana','murphys');s.tick=20;
 const offered=w=>actions(w,p,registry).some(a=>a.args?.activityId==='darts-with-jana'),darts=p.activities.find(a=>a.id==='darts-with-jana');
 assert.equal(rankLock(s,p,darts).id,'friend');assert.ok(!offered(s),'not offered while locked');
 assert.throws(()=>scene(s,p,'darts-with-jana'),/not ready for this activity/);
 assert.equal(activityBlocked(s,p,darts),"Darts at Murphy's with Jana unlocks at Friend with Jana.");
 const row=hub(s,p).find(l=>l.id==='murphys').activities.find(a=>a.id==='darts-with-jana');assert.equal(row.available,false);assert.equal(row.why,'Unlocks at Friend with Jana');
 s.modules['social.romance-tempo'].characters.jana.rank=1;
 assert.equal(rankLock(s,p,darts),null);assert.ok(offered(s));assert.equal(activityBlocked(s,p,darts),null);assert.equal(hub(s,p).find(l=>l.id==='murphys').activities.find(a=>a.id==='darts-with-jana').available,true);
 const r=scene(s,p,'darts-with-jana');assert.equal(r.state.activityDayUses['darts-with-jana'].count,1);
});

test('the rank-up line names what the new rank unlocks',()=>{
 const p=pack(),s=createWorld(p,registry,'rankup'),events=[];s.modules['social.romance-tempo'].characters.jana.ready='friend';
 const set=(path,v)=>{let o=s;for(const k of path.slice(0,-1))o=o[k];o[path.at(-1)]=v;};
 advanceRomanceRank({state:s,pack:p,set,emit:(type,payload)=>events.push({type,payload})},'jana','friend');
 assert.equal(events.find(e=>e.type==='social.romanceRankChanged').payload.text,"Your relationship with Jana reached Friend. New: Darts at Murphy's with Jana.");
});

test('an activity at a venue that is closed by arrival is explained, not refused by the engine',()=>{
 const p=pack(),s=createWorld(p,registry,'closed'),karaoke=p.activities.find(a=>a.id==='karaoke');s.tick=0;
 assert.notEqual(s.actors.player.location,'murphys');assert.match(activityBlocked(s,p,karaoke),/^Murphy's is closed right now/);
 s.tick=20;assert.equal(activityBlocked(s,p,karaoke),null);
});
