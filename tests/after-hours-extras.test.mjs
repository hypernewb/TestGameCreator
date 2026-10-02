import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';

const pack=()=>JSON.parse(readFileSync(new URL('./fixtures/route-mechanics.json',import.meta.url)));
const run=(p,seed='extras')=>{validatePack(p,registry);let s=createWorld(p,registry,seed);const act=(type,args={})=>{const r=execute(s,{id:`t${s.revision}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,registry);s=r.state;return r.turn.events;};return {act,get s(){return s;},set s(v){s=v;}};};

test('route mechanics fixture supplies moments, gift tastes and phone texts that validate',()=>{
 const p=pack();validatePack(p,registry);
 for(const m of ['world.moments','social.romance-tempo','social.phone'])assert.ok(p.modules[m],m);
 assert.ok(p.moments.some(m=>m.kind==='find'&&m.effects?.some(e=>e.type==='money')));assert.ok(p.moments.some(m=>m.kind==='encounter'));assert.ok(p.moments.some(m=>m.kind==='scene'));
 for(const m of p.phoneMessages.filter(m=>m.trigger.event==='world.moment'))assert.ok(p.moments.some(x=>x.id===m.trigger.match.moment),m.id);
});

test('a phone buzz moment delivers an invitation that can be accepted',()=>{
 const p=pack();p.moments=p.moments.filter(m=>m.id==='buzz-priya').map(m=>({...m,when:{charactersAt:{priya:'bar'}}}));p.momentsProfile={chancePercent:100,generate:false};
 const g=run(p),events=g.act('core.move',{to:'market'});
 assert.equal(events.find(e=>e.type==='world.moment')?.payload.moment,'buzz-priya');assert.ok(events.some(e=>e.type==='social.messageReceived'&&e.payload.character==='priya'));
 const accepted=g.act('social.acceptPhoneOffer',{message:'priya-cover'});
 assert.ok(accepted.some(e=>e.type==='social.phoneOfferAccepted'));assert.equal(g.s.actors.player.location,'bar');
});

test('a bought gift lands on the character\'s tastes and earns a thank-you text',()=>{
 const p=pack();p.momentsProfile={chancePercent:0,dryStepPercent:0,generate:false};const g=run(p);
 g.s={...g.s,actors:{...g.s.actors,player:{...g.s.actors.player,location:'market'},juno:{...g.s.actors.juno,location:'market'}}};
 g.act('world.buy',{item:'good-limes'});assert.equal(g.s.modules['items.inventory'].owners['good-limes'],'player');g.s={...g.s,actors:{...g.s.actors,juno:{...g.s.actors.juno,location:'market'}}};
 const before=g.s.modules['social.romance-tempo'].characters.juno.points,events=g.act('items.give',{item:'good-limes',target:'juno'});
 const got=events.find(e=>e.type==='social.giftReceived');assert.equal(got.payload.reaction,'loved');assert.ok(g.s.modules['social.romance-tempo'].characters.juno.points>before);
 assert.ok(events.some(e=>e.type==='social.messageReceived'&&e.payload.message==='juno-thanks'));
});

test('the lost-wallet hook opens its scene at the market',()=>{
 const p=pack();p.moments=p.moments.filter(m=>m.id==='wallet-hook').map(m=>({...m,when:{}}));p.momentsProfile={chancePercent:100,generate:false};
 const g=run(p);g.act('core.move',{to:'market'});
 assert.equal(g.s.modules['story.scenes'].pending,'lost-wallet');
});
