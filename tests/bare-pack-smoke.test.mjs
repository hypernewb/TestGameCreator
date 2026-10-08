import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,validatePack,clone,mechanicsDigest} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store,exportCampaign,validateImport} from '../packages/persistence/store.mjs';
import {MockProvider} from '../packages/ai/providers.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {contextFor} from '../packages/ai/context.mjs';
import {datingContext,likeClueContext} from '../packages/modules/dating.mjs';
import {romanceNetworkContext} from '../packages/modules/romance-network.mjs';
import {intimacyContext} from '../packages/modules/intimacy.mjs';
import {gossipContext} from '../packages/modules/gossip.mjs';
import {romanceTempoContext} from '../packages/modules/romance-tempo.mjs';
import {jealousyContext} from '../packages/modules/jealousy.mjs';
import {phoneContext} from '../packages/modules/phone.mjs';
import {endingsContext} from '../packages/modules/endings.mjs';
import {feedContext} from '../packages/modules/feed.mjs';
import {directorContext} from '../packages/modules/director.mjs';
import {touchLadderContext} from '../packages/modules/touch-ladder.mjs';
import {anniversaryBrief} from '../packages/modules/anniversary.mjs';
import {secrecyContext} from '../packages/modules/secrecy.mjs';
import {firstBrief} from '../packages/modules/firsts.mjs';
import {narratorBrief} from '../packages/modules/acts.mjs';
import {incidentBrief} from '../packages/modules/scenes.mjs';
import {INTIMACY_CATEGORIES} from '../packages/cards/beat-library.mjs';
const readPack=name=>JSON.parse(readFileSync(new URL(`../packs/${name}`,import.meta.url)));
const packs={neutral:readPack('neutral.json'),'fantasy-town':readPack('template-fantasy-town.json'),'template-bar':readPack('template-bar.json')};
// Every module's prompt-facing context hook (the datingContext/context family), each called for the player and every NPC.
const contextHooks={
  'social.dating':(s,p)=>{datingContext(s,p,p.playerId);for(const a of p.actors.filter(x=>x.id!==p.playerId)){datingContext(s,p,a.id);likeClueContext(s,p,a.id);}},
  'social.romance-network':(s,p)=>{romanceNetworkContext(s,p,p.playerId);for(const a of p.actors.filter(x=>x.id!==p.playerId))romanceNetworkContext(s,p,a.id);},
  'social.intimacy':(s,p)=>{intimacyContext(s,p,p.playerId);for(const a of p.actors.filter(x=>x.id!==p.playerId))intimacyContext(s,p,a.id);},
  'social.gossip':(s,p)=>{gossipContext(s,p.playerId);for(const a of p.actors.filter(x=>x.id!==p.playerId))gossipContext(s,a.id);},
  'social.romance-tempo':(s,p)=>{romanceTempoContext(s,p,p.playerId);for(const a of p.actors.filter(x=>x.id!==p.playerId))romanceTempoContext(s,p,a.id);},
  'social.jealousy':(s,p)=>{jealousyContext(s,p,p.playerId);for(const a of p.actors.filter(x=>x.id!==p.playerId))jealousyContext(s,p,a.id);},
  'social.phone':(s,p)=>phoneContext(s,p,p.playerId),
  'story.endings':(s,p)=>endingsContext(s,p),
  'social.feed':(s,p)=>{feedContext(s,p,p.playerId);for(const a of p.actors.filter(x=>x.id!==p.playerId))feedContext(s,p,a.id);},
  'story.director':(s,p)=>directorContext(s,p),
  'social.touch-ladder':(s,p)=>{touchLadderContext(s,p,p.playerId);for(const a of p.actors.filter(x=>x.id!==p.playerId))touchLadderContext(s,p,a.id);},
  'social.anniversary':(s,p)=>{anniversaryBrief(s,p,p.playerId);for(const a of p.actors.filter(x=>x.id!==p.playerId))anniversaryBrief(s,p,a.id);},
  'social.secrecy':(s,p)=>{secrecyContext(s,p,p.playerId);for(const a of p.actors.filter(x=>x.id!==p.playerId))secrecyContext(s,p,a.id);},
  'social.firsts':(s,p)=>firstBrief(s,p),
  'social.acts':(s,p)=>{for(const a of p.actors.filter(x=>x.id!==p.playerId))narratorBrief(s,p,a.id);},
  'story.scenes':(s,p)=>{for(const sc of p.scriptedScenes||[])incidentBrief(s,p,sc.id);}
};
const req=(id,revision,type,args={})=>({id,expectedRevision:revision,command:{type,args}});
// The bare-pack smoke: validate, init, three neutral turns on the mock provider, state serialises,
// save digest builds, and every enabled module's context hook returns. Throws on the first failure.
async function smoke(pack){
  validatePack(pack,registry);
  const store=new Store(),s=createWorld(pack,registry,'bare-smoke');store.insert(s);
  const svc=new GameService(store,{[pack.id]:pack},registry,new MockProvider());
  const at=pack.actors.find(a=>a.id===pack.playerId).location,to=pack.locations.find(l=>l.id===at).exits[0].to;
  await svc.act('bare-smoke',req('look',0,'core.inspect'));
  await svc.act('bare-smoke',req('wait',1,'core.wait'));
  await svc.act('bare-smoke',req('move',2,'core.move',{to}));
  const state=store.load('bare-smoke');
  JSON.stringify(state);
  assert.equal(validateImport(exportCampaign(state),pack,registry).revision,state.revision);
  const digest=mechanicsDigest(pack);assert.ok(typeof digest==='string'&&digest.length,'save digest builds');assert.equal(state.packDigest,digest);
  for(const id of Object.keys(pack.modules))if(contextHooks[id])contextHooks[id](state,pack);
  for(const a of pack.actors)contextFor(state,pack,a.id);
  store.close();
}
// Optional module options, deleted one at a time: the pack-level config each optional module reads.
// The brief's pack.dating/pack.recap/pack.endings/pack.director/pack.phone name these namespaces;
// dayRecap and directorProfile are absent here because recap/director are not enabled in these packs.
const optionalKeys=['items','schedules','quests','facts','durations','initialMoney','economySettings','services','wageRules','datingProfiles','intimacySettings','intimacyCategories','intimacyProfiles','phoneContacts','phoneMessages','feedPosts','timedEvents','endings'];
for(const [name,pack] of Object.entries(packs))test(`bare pack smoke: ${name}`,async()=>{await smoke(pack);});
// Without intimacyCategories the default set applies; a profile naming a custom category is then rejected by validation, not crashed.
const customCategory=p=>(p.intimacyProfiles||[]).some(x=>[...(x.allowedCategories||[]),...(x.blockedCategories||[]),...(x.scenes||[]).map(s=>s.category)].some(c=>!INTIMACY_CATEGORIES.some(d=>d.id===c)));
for(const [name,pack] of Object.entries(packs))for(const key of optionalKeys.filter(k=>k in pack))test(`bare pack smoke: ${name} without ${key}`,async()=>{const p=clone(pack);delete p[key];if(key==='intimacyCategories'&&customCategory(p))return assert.throws(()=>validatePack(p,registry),/intimacy/);await smoke(p);});
