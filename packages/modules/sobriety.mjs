import {assert} from '../core/engine.mjs';
import {consume} from './inventory.mjs';

const path=['modules','character.sobriety','characters'];
export const sobrietyOf=(state,pack,character)=>{const drinks=state.modules['character.sobriety']?.characters?.[character]?.drinks||0,settings=pack.sobriety||{};return drinks>=(settings.drunkAt??3)?'drunk':drinks>=(settings.tipsyAt??2)?'tipsy':'sober';};
export const sobriety={id:'character.sobriety',version:'0.1.0',coreApi:'0.1.0',requires:['items.inventory'],
 validate(p){const s=p.sobriety||{},items=new Set((p.items||[]).map(x=>x.id));assert(Array.isArray(s.drinkItems||[])&&(s.drinkItems||[]).every(x=>items.has(x)),'sobriety drink items invalid');assert(Number.isInteger(s.tipsyAt??2)&&(s.tipsyAt??2)>0&&Number.isInteger(s.drunkAt??3)&&(s.drunkAt??3)>(s.tipsyAt??2),'sobriety thresholds invalid');assert(Number.isInteger(s.soberPerDaypart??1)&&(s.soberPerDaypart??1)>=0,'sobriety decay invalid');},
 init:p=>({characters:Object.fromEntries(p.actors.filter(x=>x.id!==p.playerId).map(x=>[x.id,{drinks:0}]))}),
 react(tx,event){if(event.type==='items.transferred'&&event.payload.from===tx.pack.playerId&&tx.pack.sobriety?.drinkItems?.includes(event.payload.item)){const id=event.payload.to,current=tx.state.modules['character.sobriety'].characters[id];if(current){tx.set([...path,id,'drinks'],current.drinks+event.payload.count);consume(tx,tx.pack.items.find(x=>x.id===event.payload.item),id,event.payload.count);}}if(event.type==='core.timeAdvanced'){const interval=tx.pack.daypart?.interval||4,count=Math.floor(event.payload.to/interval)-Math.floor(event.payload.from/interval),decay=(tx.pack.sobriety?.soberPerDaypart??1)*count;if(decay>0)for(const [id,runtime] of Object.entries(tx.state.modules['character.sobriety'].characters))if(runtime.drinks>0)tx.set([...path,id,'drinks'],Math.max(0,runtime.drinks-decay));}},
 actions(){return [];}
};
