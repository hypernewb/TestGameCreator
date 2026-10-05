import {assert} from '../core/engine.mjs';
import {formatMoney} from '../../vendor/venus/money.mjs';
import {calendarFor} from '../../public/calendar.mjs';
import {heldBy,transfer,setHeld} from './inventory.mjs';
import {closedReason} from './calendar.mjs';

export function changeMoney(tx,delta){
 assert(Number.isInteger(delta)&&Math.abs(delta)<=100000,'Invalid money change');
 const money=tx.state.modules['world.economy'];assert(money,'Economy is disabled');
 const next=money.balance+delta,minimum=-(tx.pack.economySettings?.debtLimit||0);assert(next>=minimum&&next<=100000000,'Insufficient funds or debt limit exceeded');
 tx.set(['modules','world.economy','balance'],next);
 tx.emit('world.moneyChanged',{delta,balance:next,text:delta<0?`Spent ${formatMoney(-delta)}; ${formatMoney(next)} left.`:delta>0?`Got ${formatMoney(delta)}; ${formatMoney(next)} now.`:`${formatMoney(next)} on hand.`},[tx.pack.playerId]);
}

export const economy={
 id:'world.economy',version:'0.2.0',coreApi:'0.1.0',requires:['items.inventory'],
 validate(p){
  assert(Number.isInteger(p.initialMoney??100)&&(p.initialMoney??100)>=0&&(p.initialMoney??100)<=100000000,'initialMoney must be an integer between 0 and 100,000,000');
  for(const item of p.items||[]){if(!item.shop)continue;assert(Number.isInteger(item.price)&&item.price>=0&&item.price<=100000,'Shop item needs a price from 0 to 100,000');assert(p.locations.some(l=>l.id===item.owner),'Shop item must begin at a location');assert(item.stock===undefined||Number.isInteger(item.stock)&&item.stock>=0&&item.stock<=9999,`items.${item.id}.stock: expected 0–9999`);assert(item.restock===undefined||item.stock!==undefined&&Number.isInteger(item.restock)&&item.restock>=0&&item.restock<=999,`items.${item.id}.restock: needs stock, expected 0–999`);}
  assert(Number.isInteger(p.economySettings?.debtLimit||0)&&(p.economySettings?.debtLimit||0)>=0&&(p.economySettings?.debtLimit||0)<=1000000,'economy debt limit invalid');for(const service of p.services||[]){assert(typeof service.id==='string'&&p.locations.some(x=>x.id===service.location)&&Number.isInteger(service.price)&&service.price>=0,'economy service invalid');}for(const wage of p.wageRules||[]){assert(typeof wage.id==='string'&&typeof wage.event==='string'&&Number.isInteger(wage.amount)&&wage.amount>0&&Number.isInteger(wage.cooldown||0)&&(wage.cooldown||0)>=0,'economy wage rule invalid');}
 },
 init:p=>({balance:p.initialMoney??100,wages:{},services:{}}),
 commands:{
  'world.buy'(tx,{item:id,count=1}){
   const item=tx.pack.items.find(i=>i.id===id&&i.shop);assert(item,'Unknown shop item');
   const location=tx.state.actors[tx.pack.playerId].location;
   assert(item.owner===location,'This shop is elsewhere');
   const closed=closedReason(tx.pack,tx.state,tx.state.tick,location);assert(!closed,`The shop is closed today${closed&&closed!=='closed'?`: ${closed}`:''}.`);
   assert(!item.hidden||tx.state.modules['world.objects']?.discovered.includes(id),'Item has not been discovered');
   const available=heldBy(tx.state,id,location);assert(available>=Math.min(count,1),'Item is sold out');
   const units=Math.min(count||1,available);assert(Number.isInteger(units)&&units>=1,'Invalid quantity');
   // The transfer is checked first so a full stack reports the cap, not the wallet; the turn is atomic, so a
   // money failure after the transfer still commits nothing.
   transfer(tx,item,location,tx.pack.playerId,units,`Bought ${item.name}${units>1?` ×${units}`:''} for ${formatMoney(item.price*units)}.`);
   changeMoney(tx,-item.price*units);
  },
  'world.sell'(tx,{item:id,count=1}){
   const item=tx.pack.items.find(i=>i.id===id&&i.shop);assert(item,'Unknown shop item');
   const held=heldBy(tx.state,id,tx.pack.playerId);assert(held>0,'You do not own that item');
   const location=tx.state.actors[tx.pack.playerId].location;assert(item.owner===location,'This shop is elsewhere');
   const closed=closedReason(tx.pack,tx.state,tx.state.tick,location);assert(!closed,`The shop is closed today${closed&&closed!=='closed'?`: ${closed}`:''}.`);
   const units=Math.min(count||1,held),amount=Math.floor(item.price/2)*units;
   transfer(tx,item,tx.pack.playerId,location,units,`Sold ${item.name}${units>1?` ×${units}`:''} for ${formatMoney(amount)}.`);changeMoney(tx,amount);
  },
  'world.buyService'(tx,{service:id}){const service=(tx.pack.services||[]).find(x=>x.id===id);assert(service,'Unknown service');assert(tx.state.actors[tx.pack.playerId].location===service.location,'This service is elsewhere');if(service.once)assert(!tx.state.modules['world.economy'].services[id],'Service already purchased');changeMoney(tx,-service.price);tx.set(['modules','world.economy','services',id],(tx.state.modules['world.economy'].services[id]||0)+1);tx.emit('world.servicePurchased',{service:id,location:service.location,text:service.result||`Purchased ${service.name}.`},[tx.pack.playerId]);}
 },
 // Shop shelves top up once per campaign day: stock is bounded by the authored maximum, so replay stays exact.
 react(tx,event){
  const {state:s,pack:p}=tx;
  if(event.type==='core.timeAdvanced'&&calendarFor(event.payload.from,p).day!==calendarFor(event.payload.to,p).day)for(const item of p.items||[]){
   if(!item.shop||!item.restock||!item.stock)continue;
   const have=heldBy(s,item.id,item.owner);if(have>=item.stock)continue;
   const next=Math.min(item.stock,have+item.restock);setHeld(tx,item,item.owner,next);
   tx.emit('world.restocked',{item:item.id,location:item.owner,stock:next,text:`${p.locations.find(l=>l.id===item.owner)?.name||item.owner} restocked ${item.name}.`},[tx.pack.playerId]);
  }
  for(const wage of p.wageRules||[]){if(wage.event!==event.type||Object.entries(wage.match||{}).some(([k,v])=>event.payload[k]!==v))continue;const last=s.modules['world.economy'].wages[wage.id];if(last!==undefined&&s.tick-last<(wage.cooldown||0))continue;tx.set(['modules','world.economy','wages',wage.id],s.tick);changeMoney(tx,wage.amount);tx.emit('world.wagePaid',{wage:wage.id,amount:wage.amount,text:wage.text||`Earned ${formatMoney(wage.amount)}.`},[tx.pack.playerId]);}
 },
 actions(s,p){const location=s.actors[p.playerId].location;return [...(p.items||[]).filter(i=>i.shop&&i.owner===location&&(!i.hidden||s.modules['world.objects']?.discovered.includes(i.id))).flatMap(i=>{const stock=heldBy(s,i.id,location),carried=heldBy(s,i.id,p.playerId);return [...(stock>0?[{label:`Buy ${i.name} (${formatMoney(i.price)})`,type:'world.buy',args:{item:i.id},...(stock>1?{storylet:{title:`Buy ${i.name}`,who:[],where:p.locations.find(l=>l.id===location)?.name||location,timeCost:1,hint:`${stock} in stock`}}:{})}]:[]),...(carried>0?[{label:`Sell ${i.name} (${formatMoney(Math.floor(i.price/2))})`,type:'world.sell',args:{item:i.id}}]:[])];}),...(p.services||[]).filter(x=>x.location===location&&(!x.once||!s.modules['world.economy'].services[x.id])).map(x=>({label:`${x.name} (${formatMoney(x.price)})`,type:'world.buyService',args:{service:x.id}}))];},
 panel(s,p){const location=s.actors[p.playerId].location;return {title:'Money',lines:[`Balance: ${formatMoney(s.modules['world.economy'].balance)}`,...(s.modules['world.economy'].balance<0?[`Debt remaining: ${formatMoney((p.economySettings?.debtLimit||0)+s.modules['world.economy'].balance)}`]:[]),...(p.items||[]).filter(i=>i.shop&&i.owner===location&&heldBy(s,i.id,location)>0).map(i=>`${i.name}: ${heldBy(s,i.id,location)} in stock`)]};}
};
