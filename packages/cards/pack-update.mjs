// A campaign started on an older publish of a Studio project can move to the newest publish: text fixes apply as-is, edited or added
// places/people carry over, and anything that would strand saved state (removed entries, a different player, a changed module set) asks for a new game instead.
import {clone,describeMechanicsChange,migratePack,validatePack} from '../core/engine.mjs';

export const latestRelease=(packs,pack)=>{if(!pack?.publishedFrom)return null;const next=Object.values(packs).filter(p=>p.publishedFrom===pack.publishedFrom&&(p.publishedAt||'')>(pack.publishedAt||'')).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt))[0];return next||null;};
export function updatePlan(world,oldPack,newPack){
 const changes=describeMechanicsChange(oldPack,newPack),blocked=changes.filter(c=>/: removed$/.test(c)||/^(modules changed|playerId|schemaVersion)/.test(c));
 return {packId:newPack.id,title:newPack.title,publishedAt:newPack.publishedAt||null,changes:changes.length?changes:['Text only'],blocked:blocked.length?`Start a new game to use this version (${blocked.join('; ')})`:null};
}
export function applyUpdate(world,oldPack,newPack,registry){
 const plan=updatePlan(world,oldPack,newPack);if(plan.blocked)throw Error(plan.blocked);validatePack(newPack,registry);
 const base={...clone(world),actors:{...clone(world.actors)},flags:{...clone(world.flags||{})}};
 for(const a of newPack.actors)base.actors[a.id]??={name:a.name,location:a.location};
 for(const v of newPack.storyVariables||[])if(!Object.hasOwn(base.flags,v.id))base.flags[v.id]=v.initial;
 const edges=base.modules['social.relationships']?.edges;if(edges)for(const r of newPack.initialRelationships||[])edges[`${r.character}--${newPack.playerId}`]??=r.trust;
 return migratePack(base,oldPack,newPack,registry);
}
