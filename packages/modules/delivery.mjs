export const DELIVERY_KINDS=['flirt','compliment','touch','physical','joke','tease','help-study','boast'];
const TIERS=['fumbled','plain','smooth','great'],MULT=[0.5,1,1.25,1.5];
const hash=s=>{let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
export function verdictOf(pack,state,act){
 if(!DELIVERY_KINDS.includes(act?.kind))return null;const stat=pack.deliveryStats?.[act.kind],d=(pack.statDefinitions||[]).find(x=>x.id===stat);if(!d)return null;
 const value=state.modules?.['character.stats']?.values?.[`${pack.playerId}--${stat}`]??d.min,ranks=d.ranks||[],rank=ranks.length?Math.max(0,ranks.filter(r=>value>=r.min).length-1)/Math.max(1,ranks.length-1):Math.max(0,Math.min(1,(value-d.min)/(d.max-d.min))),roll=hash(`${state.seed??state.id??pack.id}:${state.deliveryTurn??state.revision??state.tick??0}`)/4294967296,index=Math.max(0,Math.min(3,Math.floor(rank*3+roll*2-0.5))),tier=TIERS[index],label=`landed ${tier} (your ${d.name.toLowerCase()} ${['fell flat','came through simply','came through smoothly','shone'][index]})`,example=pack.deliveryExamples?.[tier];
 return {stat,value,tier,label,line:`Your delivery this turn: ${d.name} ${value}, ${tier}. Write the player's actual ${act.kind} as ${['a clumsy line with a false start or a poorly timed gesture','a straightforward line or simple gesture','an assured line or well-timed gesture','an inventive, apt line or precise expressive gesture'][index]}, then the character reacts to that; do not merely call it ${tier}. Preserve the requested meaning and committed boundaries; this grants no consent or success.${example?` Example of this quality (adapt to the requested move): ${example}`:''}`,mult:MULT[index]};
}
export function startingValues(pack){
 const option=pack.startingStats;if(!option)return {};
 const mode=typeof option==='string'?option:option.mode,defs=(pack.statDefinitions||[]).filter(d=>!d.derived),out={};
 for(const [i,d] of defs.entries()){const rank=n=>d.ranks?.[n]?.min??Math.round(d.min+(d.max-d.min)*n/3),value=mode==='chosen'?option.values?.[d.id]??d.min:mode==='spread'?rank(i===0?2:i===defs.length-1?0:1):d.min;out[`${pack.playerId}--${d.id}`]=Math.max(d.min,Math.min(d.max,value));}return out;
}
