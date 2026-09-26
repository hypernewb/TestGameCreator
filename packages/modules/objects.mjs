import {assert} from '../core/engine.mjs';
export const objects={id:'world.objects',version:'0.1.0',coreApi:'0.1.0',requires:['items.inventory'],
 validate(p){const locations=new Set(p.locations.map(l=>l.id)),items=new Set((p.items||[]).map(i=>i.id));for(const o of p.objects||[]){assert(locations.has(o.location),`objects.${o.id}.location: unknown`);assert(typeof o.description==='string',`objects.${o.id}.description: required`);for(const item of o.reveals||[])assert(items.has(item),`objects.${o.id}.reveals: unknown ${item}`);if(o.requiresItem)assert(items.has(o.requiresItem),`objects.${o.id}.requiresItem: unknown`);}},
 init:()=>({examined:[],discovered:[]}),
 commands:{
  'world.explore'(tx,a){const {state:s,pack:p}=tx,o=(p.objects||[]).find(o=>o.id===a.target);assert(o&&o.location===s.actors[p.playerId].location,'That object is not here');assert(['inspect','search_take'].includes(a.mode),'Unsupported interaction');
   const m=s.modules['world.objects'];if(!m.examined.includes(o.id))tx.set(['modules','world.objects','examined'],[...m.examined,o.id]);tx.emit('world.objectExamined',{object:o.id,location:o.location,text:`You examine ${o.name}. ${o.description}`},[p.playerId]);
   for(const id of o.reveals||[]){if(!s.modules['world.objects'].discovered.includes(id)){tx.set(['modules','world.objects','discovered'],[...s.modules['world.objects'].discovered,id]);tx.emit('world.itemDiscovered',{object:o.id,item:id,location:o.location,text:`You discover ${p.items.find(i=>i.id===id).name}.`},[p.playerId]);}
    if(a.mode==='search_take'&&s.modules['items.inventory'].owners[id]===o.location){tx.set(['modules','items.inventory','owners',id],p.playerId);tx.emit('items.transferred',{item:id,from:o.location,to:p.playerId,text:`You take ${p.items.find(i=>i.id===id).name}.`},[p.playerId]);}}
  },
  'world.use'(tx,a){const {state:s,pack:p}=tx,o=(p.objects||[]).find(o=>o.id===a.target);assert(o&&o.location===s.actors[p.playerId].location,'That object is not here');assert(o.effectFlag,'This object has no configured use');assert(!s.flags[o.effectFlag],'It has already been used');if(o.requiresItem)assert(s.modules['items.inventory'].owners[o.requiresItem]===p.playerId,'You need the required item');tx.set(['flags',o.effectFlag],true);tx.emit('world.objectUsed',{object:o.id,location:o.location,text:o.useText||`You use ${o.name}.`},[p.playerId]);}
 },
 actions(s,p){const loc=s.actors[p.playerId].location;return (p.objects||[]).filter(o=>o.location===loc).flatMap(o=>[{label:`Examine ${o.name}`,type:'world.explore',args:{target:o.id,mode:'inspect'}},...(o.reveals?.length?[{label:`Search ${o.name} and take finds`,type:'world.explore',args:{target:o.id,mode:'search_take'}}]:[]),...(o.effectFlag?[{label:`Use ${o.name}`,type:'world.use',args:{target:o.id}}]:[])]);},
 panel(s,p){return {title:'Nearby objects',lines:(p.objects||[]).filter(o=>o.location===s.actors[p.playerId].location).map(o=>o.name)};}
};
