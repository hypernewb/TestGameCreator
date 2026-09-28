import {assert,safeKey} from '../core/engine.mjs';
import {placeHidden} from './objects.mjs';
import {changeMoney} from './economy.mjs';
import {changeStat} from './stats.mjs';
// Ownership is per (item, holder) with a quantity: holders are actors or locations, so a shop shelf and a
// player's pocket can both hold units of the same item. Legacy saves keep the flat `owners[item] = holder`
// shape; every reader accepts both, so old campaigns and old event replays stay valid.
export const heldBy=(state,item,holder)=>{const entry=state.modules['items.inventory']?.owners?.[item];return typeof entry==='string'?Number(entry===holder):entry?.[holder]||0;};
export const holdersOf=(state,item)=>{const entry=state.modules['items.inventory']?.owners?.[item];if(!entry)return[];return Object.entries(typeof entry==='string'?{[entry]:1}:entry).filter(([,n])=>n>0);};
const itemOf=(p,id)=>p.items.find(i=>i.id===id);
const entryOf=(state,item)=>{const raw=state.modules['items.inventory']?.owners?.[item];return {...(typeof raw==='string'?{[raw]:1}:raw)};};
// One holder holding one unit keeps the legacy flat `owners[item] = holder` shape; only real quantities go nested.
const writeEntry=(tx,item,entry)=>{const live=Object.entries(entry).filter(([,n])=>n>0);tx.set(['modules','items.inventory','owners',item.id],!live.length?undefined:live.length===1&&live[0][1]===1?live[0][0]:Object.fromEntries(live));};
export const setHeld=(tx,item,holder,count)=>{assert(item&&Number.isInteger(count)&&count>=0,'Invalid held count');const entry=entryOf(tx.state,item.id);if(count)entry[holder]=count;else delete entry[holder];writeEntry(tx,item,entry);};
const capOf=(state,item,holder)=>state.actors[holder]?item.stack||1:Infinity;
// Move units between holders; the destination stack cap and the source quantity are checked before anything changes,
// so a rejected transfer (or any later failure in the same turn) consumes nothing.
export function transfer(tx,item,from,to,count=1,text){
 assert(item&&Number.isInteger(count)&&count>=1&&count<=999,'Invalid item transfer');
 assert(heldBy(tx.state,item.id,from)>=count,`Not enough ${item.name} to move`);
 assert(heldBy(tx.state,item.id,to)+count<=capOf(tx.state,item,to),`Can't hold more than ${capOf(tx.state,item,to)} of ${item.name}`);
 const entry=entryOf(tx.state,item.id);entry[from]-=count;entry[to]=(entry[to]||0)+count;writeEntry(tx,item,entry);
 tx.emit('items.transferred',{item:item.id,from,to,count,text:text||`Moved ${item.name}.`},[tx.pack.playerId,...(tx.state.actors[to]&&to!==tx.pack.playerId?[to]:[])]);
}
// Consume units (a used consumable, crafting inputs): they go nowhere, so nothing can duplicate them by replay.
export function consume(tx,item,holder,count=1,text){
 assert(item&&Number.isInteger(count)&&count>=1&&count<=999,'Invalid item consume');
 assert(heldBy(tx.state,item.id,holder)>=count,`Not enough ${item.name}`);
 const entry=entryOf(tx.state,item.id);entry[holder]-=count;writeEntry(tx,item,entry);
 tx.emit('items.consumed',{item:item.id,holder,count,text:text||`${item.name} is used up.`},[tx.pack.playerId]);
}
export function mint(tx,item,to,count=1,text){
 assert(item&&Number.isInteger(count)&&count>=1&&count<=999,'Invalid item grant');
 assert(heldBy(tx.state,item.id,to)+count<=capOf(tx.state,item,to),`Can't hold more than ${capOf(tx.state,item,to)} of ${item.name}`);
 const entry=entryOf(tx.state,item.id);entry[to]=(entry[to]||0)+count;writeEntry(tx,item,entry);
 tx.emit('items.transferred',{item:item.id,from:null,to,count,text:text||`Received ${item.name}.`},[tx.pack.playerId,...(tx.state.actors[to]&&to!==tx.pack.playerId?[to]:[])]);
}
const effectSummary=(p,effects)=>effects.map(e=>e.type==='stat'?`${e.delta>0?'+':''}${e.delta} ${p.statDefinitions?.find(d=>d.id===e.stat)?.name||e.stat}`:e.type==='money'?`${e.delta<0?'-':'+'}${Math.abs(e.delta)}`:`flag ${e.id}`).join(', ');
export const inventory={id:'items.inventory',version:'0.2.0',coreApi:'0.1.0',requires:[],
  validate(p){const holders=new Set([...p.actors,...p.locations].map(x=>x.id));const items=new Set((p.items||[]).map(i=>i.id));
   for(const i of p.items||[]){assert(holders.has(i.owner)||(i.hideIn&&i.owner===undefined),`items.${i.id}.owner: unknown`);
    assert(i.stack===undefined||Number.isInteger(i.stack)&&i.stack>=1&&i.stack<=999,`items.${i.id}.stack: expected 1–999`);
    if(i.use){assert(i.use&&typeof i.use==='object'&&!Array.isArray(i.use),`items.${i.id}.use: expected an object`);assert(i.use.text===undefined||typeof i.use.text==='string'&&i.use.text.trim()&&i.use.text.length<=200,`items.${i.id}.use.text: up to 200 characters`);assert(i.use.charges===undefined||Number.isInteger(i.use.charges)&&i.use.charges>=1&&i.use.charges<=99,`items.${i.id}.use.charges: expected 1–99`);assert(Array.isArray(i.use.effects||[])&&(i.use.effects||[]).length<=6,`items.${i.id}.use.effects: up to 6`);
     for(const e of i.use.effects||[]){assert(['stat','money','flag'].includes(e.type),`items.${i.id}.use.effects: unknown type`);if(e.type==='stat')assert(p.modules['character.stats']&&(p.statDefinitions||[]).some(d=>d.id===e.stat)&&Number.isInteger(e.delta)&&e.delta!==0&&Math.abs(e.delta)<=5,`items.${i.id}.use: stat effect moves a stat by ±1–5`);if(e.type==='money')assert(p.modules['world.economy']&&Number.isInteger(e.delta)&&e.delta!==0&&Math.abs(e.delta)<=100000,`items.${i.id}.use: money effect invalid`);if(e.type==='flag'){const variables=new Set((p.storyVariables||[]).map(x=>x.id));assert(safeKey(e.id)&&(!variables.size||variables.has(e.id))&&(e.value===undefined||typeof e.value==='boolean'),`items.${i.id}.use: flag effect invalid or undefined`);}}}}
   const recipes=new Set();for(const r of p.recipes||[]){assert(safeKey(r.id)&&!recipes.has(r.id),`recipes.${r.id}: invalid or duplicate ID`);recipes.add(r.id);assert(typeof r.name==='string'&&r.name.trim()&&r.name.length<=120,`recipes.${r.id}.name: required`);assert(r.text===undefined||typeof r.text==='string'&&r.text.length<=200,`recipes.${r.id}.text: up to 200 characters`);assert(!r.location||holders.has(r.location),`recipes.${r.id}.location: unknown`);assert(r.once===undefined||typeof r.once==='boolean',`recipes.${r.id}.once: expected boolean`);
    assert(Array.isArray(r.inputs)&&r.inputs.length>=1&&r.inputs.length<=6,`recipes.${r.id}.inputs: 1–6 required`);for(const input of r.inputs){assert(items.has(input.item)&&Number.isInteger(input.count||1)&&(input.count||1)>=1&&(input.count||1)<=99,`recipes.${r.id}.inputs: invalid`);}
    assert(items.has(r.output?.item)&&Number.isInteger(r.output.count||1)&&(r.output.count||1)>=1&&(r.output.count||1)<=999,`recipes.${r.id}.output: invalid`);}},
  init:(p,o={})=>{const spots=placeHidden(p,o.seed),at=Object.fromEntries((p.objects||[]).map(x=>[x.id,x.location])),owners={};
   for(const i of p.items||[]){const holder=spots[i.id]?at[spots[i.id]]:i.owner;if(holder)owners[i.id]=i.shop&&i.stock&&i.stock!==1?{[holder]:i.stock}:holder;}
   return {owners,charges:Object.fromEntries((p.items||[]).filter(i=>i.use?.charges).map(i=>[i.id,i.use.charges]))};},
  commands:{
    'items.take'(tx,a){const {state:s,pack:p}=tx;const item=itemOf(p,a.item);assert(item,'Unknown item');assert(!item.shop||!p.modules['world.economy'],'Buy this item at its shop');const loc=s.actors[p.playerId].location;assert(!item.hidden||s.modules['world.objects']?.discovered.includes(a.item),'That item has not been discovered');const have=heldBy(s,a.item,loc);assert(have>0,'That item is not available here');const count=Math.min(a.count||1,have,capOf(s,item,p.playerId)-heldBy(s,a.item,p.playerId));assert(count>=1,`You can't carry more of ${item.name}`);transfer(tx,item,loc,p.playerId,count,`Picked up ${item.name}${count>1?` ×${count}`:''}.`);},
    'items.place'(tx,a){const {state:s,pack:p}=tx;const item=itemOf(p,a.item);assert(item,'Unknown item');assert(heldBy(s,a.item,p.playerId)>0,'You do not own that item');transfer(tx,item,p.playerId,s.actors[p.playerId].location,Math.min(a.count||1,heldBy(s,a.item,p.playerId)),`You place ${item.name} here.`);},
    'items.give'(tx,a){const {state:s,pack:p}=tx;const item=itemOf(p,a.item);assert(item,'Unknown item');assert(heldBy(s,a.item,p.playerId)>0,'You do not own that item');assert(a.target!==p.playerId&&s.actors[a.target]?.location===s.actors[p.playerId].location,'Recipient is not here');transfer(tx,item,p.playerId,a.target,Math.min(a.count||1,heldBy(s,a.item,p.playerId)),`Gave ${item.name} to ${s.actors[a.target].name}.`);},
    // A consumable's authored effects land first, then the unit is paid: if any effect is rejected, the whole
    // turn fails and nothing was spent. Charged items (use.charges) keep a separate counter and break at zero.
    'items.use'(tx,a){const {state:s,pack:p}=tx;const item=itemOf(p,a.item);assert(item?.use,'That item cannot be used');const charges=s.modules['items.inventory'].charges?.[a.item];assert(charges===undefined||charges>0,`${item.name} is used up`);assert(heldBy(s,a.item,p.playerId)>0,'You do not own that item');
     for(const e of item.use.effects||[]){if(e.type==='money')changeMoney(tx,e.delta);if(e.type==='stat')changeStat(tx,p.playerId,e.stat,e.delta,`used ${item.id}`);if(e.type==='flag')tx.set(['flags',e.id],e.value??true);}
     const used=charges!==undefined?charges-1:0;
     if(charges!==undefined){tx.set(['modules','items.inventory','charges',a.item],used);if(used<=0)consume(tx,item,p.playerId,1,`${item.name} breaks.`);}
     else consume(tx,item,p.playerId,1);
     tx.emit('items.used',{item:a.item,charges:item.use.charges,remaining:Math.max(0,used||heldBy(tx.state,a.item,p.playerId)),effects:item.use.effects||[],text:`${item.use.text||`You use ${item.name}.`}${item.use.effects?.length?` (${effectSummary(p,item.use.effects)})`:''}`},[p.playerId]);},
    'items.craft'(tx,a){const {state:s,pack:p}=tx;const recipe=(p.recipes||[]).find(r=>r.id===a.recipe);assert(recipe,'Unknown recipe');assert(!recipe.location||s.actors[p.playerId].location===recipe.location,'This recipe needs another place');assert(!recipe.once||!s.modules['items.inventory'].crafted?.includes(recipe.id),'Already crafted');
     for(const input of recipe.inputs)assert(heldBy(s,input.item,p.playerId)>=(input.count||1),`You need ${input.count||1}× ${itemOf(p,input.item)?.name||input.item}`);
     for(const input of recipe.inputs)consume(tx,itemOf(p,input.item),p.playerId,input.count||1);
     const out=itemOf(p,recipe.output.item);mint(tx,out,p.playerId,recipe.output.count||1);
     if(recipe.once){const crafted=s.modules['items.inventory'].crafted||[];tx.set(['modules','items.inventory','crafted'],[...crafted,recipe.id]);}
     tx.emit('items.crafted',{recipe:recipe.id,output:recipe.output.item,count:recipe.output.count||1,text:recipe.text||`You make ${out.name}${recipe.output.count>1?` ×${recipe.output.count}`:''}.`},[p.playerId]);}
  },
  actions(s,p){const loc=s.actors[p.playerId].location,out=[];
   for(const i of p.items||[]){
    const carried=heldBy(s,i.id,p.playerId),near=heldBy(s,i.id,loc);
    if(near>0&&(!i.shop||!p.modules['world.economy'])&&(!i.hidden||s.modules['world.objects']?.discovered.includes(i.id))){
     const count=Math.min(near,Math.max(0,capOf(s,i,p.playerId)-carried));
     if(count>0)out.push({label:`Take ${i.name}${count>1?` ×${count}`:''}`,type:'items.take',args:{item:i.id,count}});}
    if(carried>0){out.push({label:`Place ${i.name} here`,type:'items.place',args:{item:i.id}});
     for(const id of Object.keys(s.actors))if(id!==p.playerId&&s.actors[id].location===loc)out.push({label:`Give ${i.name} to ${s.actors[id].name}`,type:'items.give',args:{item:i.id,target:id}});
     if(i.use)out.push({label:`Use ${i.name}`,type:'items.use',args:{item:i.id}});}
   }
   for(const r of p.recipes||[])if((!r.location||r.location===loc)&&!(r.once&&(s.modules['items.inventory'].crafted||[]).includes(r.id)))out.push({label:`Craft ${r.name}`,type:'items.craft',args:{recipe:r.id}});
   return out;},
  panel(s,p){return {title:'Inventory',lines:(p.items||[]).flatMap(i=>{const n=heldBy(s,i.id,p.playerId);if(!n)return[];const charges=s.modules['items.inventory'].charges?.[i.id];return [`${i.name} ×${n}${charges!==undefined?` · ${charges} uses left`:''}`];})};}
};
