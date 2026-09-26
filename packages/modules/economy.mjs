import {assert} from '../core/engine.mjs';
import {formatMoney} from '../../vendor/venus/money.mjs';

export function changeMoney(tx,delta){
 assert(Number.isInteger(delta)&&Math.abs(delta)<=100000,'Invalid money change');
 const money=tx.state.modules['world.economy'];assert(money,'Economy is disabled');
 const next=money.balance+delta;assert(next>=0&&next<=100000000,'Insufficient funds or invalid balance');
 tx.set(['modules','world.economy','balance'],next);
 tx.emit('world.moneyChanged',{delta,balance:next,text:`Balance: ${formatMoney(next)}.`},[tx.pack.playerId]);
}

export const economy={
 id:'world.economy',version:'0.1.0',coreApi:'0.1.0',requires:['items.inventory'],
 validate(p){
  assert(Number.isInteger(p.initialMoney??100)&&(p.initialMoney??100)>=0&&(p.initialMoney??100)<=100000000,'initialMoney must be an integer between 0 and 100,000,000');
  for(const item of p.items||[]){if(!item.shop)continue;assert(Number.isInteger(item.price)&&item.price>=0&&item.price<=100000,'Shop item needs a price from 0 to 100,000');assert(p.locations.some(l=>l.id===item.owner),'Shop item must begin at a location');}
 },
 init:p=>({balance:p.initialMoney??100}),
 commands:{
  'world.buy'(tx,{item:id}){
   const item=tx.pack.items.find(i=>i.id===id&&i.shop);assert(item,'Unknown shop item');
   const location=tx.state.actors[tx.pack.playerId].location;
   assert(item.owner===location,'This shop is elsewhere');
   assert(!item.hidden||tx.state.modules['world.objects']?.discovered.includes(id),'Item has not been discovered');
   assert(tx.state.modules['items.inventory'].owners[id]===location,'Item is sold out');
   changeMoney(tx,-item.price);tx.set(['modules','items.inventory','owners',id],tx.pack.playerId);
   tx.emit('items.transferred',{item:id,from:location,to:tx.pack.playerId,text:`Bought ${item.name} for ${formatMoney(item.price)}.`},[tx.pack.playerId]);
  },
  'world.sell'(tx,{item:id}){
   const item=tx.pack.items.find(i=>i.id===id&&i.shop);assert(item,'Unknown shop item');
   assert(tx.state.modules['items.inventory'].owners[id]===tx.pack.playerId,'You do not own that item');
   const location=tx.state.actors[tx.pack.playerId].location;assert(item.owner===location,'This shop is elsewhere');
   const amount=Math.floor(item.price/2);tx.set(['modules','items.inventory','owners',id],location);changeMoney(tx,amount);
   tx.emit('items.transferred',{item:id,from:tx.pack.playerId,to:location,text:`Sold ${item.name} for ${formatMoney(amount)}.`},[tx.pack.playerId]);
  }
 },
 actions(s,p){const location=s.actors[p.playerId].location;return (p.items||[]).filter(i=>i.shop&&i.owner===location&&(!i.hidden||s.modules['world.objects']?.discovered.includes(i.id))).flatMap(i=>s.modules['items.inventory'].owners[i.id]===location?[{label:`Buy ${i.name} (${formatMoney(i.price)})`,type:'world.buy',args:{item:i.id}}]:s.modules['items.inventory'].owners[i.id]===p.playerId?[{label:`Sell ${i.name} (${formatMoney(Math.floor(i.price/2))})`,type:'world.sell',args:{item:i.id}}]:[]);},
 panel(s){return {title:'Money',lines:[`Balance: ${formatMoney(s.modules['world.economy'].balance)}`]};}
};
