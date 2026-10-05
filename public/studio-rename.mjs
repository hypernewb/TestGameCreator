// Renaming a location/character Unique ID in Studio: rewrites exact references (values and object keys)
// across the pack so starts, exits, schedules, scenes etc. follow the new ID. Prose fields and the Game UI
// layout are never touched. Refuses when the new ID is taken or the old ID also names another entity.
const prose=new Set(['name','title','subtitle','label','description','text','aliases','premise','setting','personality','backstory','voice','style','examples','narrative','writingStyle','ui']);
export function renameId(pack,entity,from,to){
 if(!from||!to||from===to)return {ok:true,count:0};
 const owners=Object.entries(pack).flatMap(([k,v])=>Array.isArray(v)?v.filter(x=>x&&typeof x==='object'&&x!==entity&&typeof x.id==='string').map(x=>[k,x.id]):[]);
 const taken=owners.find(([,id])=>id===to);if(taken)return {ok:false,error:`ID “${to}” is already used in ${taken[0]}.`};
 const shared=owners.find(([,id])=>id===from);if(shared)return {ok:true,count:0,warning:`“${from}” also names an entry in ${shared[0]}; references were not updated.`};
 let count=0;
 const walk=o=>{if(!Array.isArray(o)&&Object.hasOwn(o,from)&&!Object.hasOwn(o,to)){const e=Object.entries(o);for(const [k] of e)delete o[k];for(const [k,v] of e)o[k===from?to:k]=v;count++;}
  for(const k of Object.keys(o)){if(!Array.isArray(o)&&prose.has(k))continue;const v=o[k];if(v===from){o[k]=to;count++;}else if(v&&typeof v==='object')walk(v);}};
 walk(pack);return {ok:true,count};
}
