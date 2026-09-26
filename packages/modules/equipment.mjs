import {assert,safeKey} from '../core/engine.mjs';

export const equipment={id:'items.equipment',version:'0.1.0',coreApi:'0.1.0',requires:['items.inventory'],
 validate(p){assert(Array.isArray(p.equipmentSlots||[])&&(p.equipmentSlots||[]).length<=12,'equipmentSlots: expected up to 12 slots');const slots=new Set();for(const slot of p.equipmentSlots||[]){assert(safeKey(slot)&&!slots.has(slot),`equipmentSlots: invalid or duplicate ${slot}`);slots.add(slot);}for(const item of p.items||[])if(item.slot)assert(slots.has(item.slot),`items.${item.id}.slot: unknown equipment slot`);},
 init:()=>({slots:{}}),
 commands:{
  'items.equip'(tx,args){const {state:s,pack:p}=tx,item=p.items.find(i=>i.id===args.item);assert(item?.slot,'Item cannot be equipped');assert(s.modules['items.inventory'].owners[item.id]===p.playerId,'You must carry this item');assert(s.modules['items.equipment'].slots[item.slot]!==item.id,'Item is already equipped');const previous=s.modules['items.equipment'].slots[item.slot];if(previous)tx.emit('items.unequipped',{item:previous,slot:item.slot,text:`You remove ${p.items.find(i=>i.id===previous).name}.`},[p.playerId]);tx.set(['modules','items.equipment','slots',item.slot],item.id);tx.emit('items.equipped',{item:item.id,slot:item.slot,text:`You equip ${item.name}.`},[p.playerId]);},
  'items.unequip'(tx,args){const {state:s,pack:p}=tx,item=p.items.find(i=>i.id===args.item);assert(item?.slot&&s.modules['items.equipment'].slots[item.slot]===item.id,'Item is not equipped');tx.set(['modules','items.equipment','slots',item.slot],null);tx.emit('items.unequipped',{item:item.id,slot:item.slot,text:`You remove ${item.name}.`},[p.playerId]);}
 },
 react(tx,event){if(event.type!=='items.transferred'||event.payload.to===tx.pack.playerId)return;const slots=tx.state.modules['items.equipment'].slots;for(const [slot,id] of Object.entries(slots))if(id===event.payload.item){tx.set(['modules','items.equipment','slots',slot],null);tx.emit('items.unequipped',{item:id,slot,text:`${tx.pack.items.find(i=>i.id===id).name} is no longer equipped.`},[tx.pack.playerId]);}},
 actions(s,p){return (p.items||[]).filter(i=>i.slot&&s.modules['items.inventory'].owners[i.id]===p.playerId).map(i=>s.modules['items.equipment'].slots[i.slot]===i.id?{label:`Remove ${i.name}`,type:'items.unequip',args:{item:i.id}}:{label:`Equip ${i.name}`,type:'items.equip',args:{item:i.id}});},
 panel(s,p){return {title:'Equipment',lines:(p.equipmentSlots||[]).map(slot=>`${slot}: ${p.items.find(i=>i.id===s.modules['items.equipment'].slots[slot])?.name||'empty'}`)};}
};
