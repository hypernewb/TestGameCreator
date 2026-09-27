// Prompt budgeting: a model-agnostic token estimate and a deterministic tiered allocator.
// The allocator reserves a floor for every tier (NovelAI lorebook "reserved tokens"), caps each tier
// with a ceiling, and degrades an item through cheaper renderings before cutting it (graphics LOD).

// CJK, kana and hangul tokenize at roughly one token per character; Latin text at roughly four characters.
const DENSE=/[぀-ヿ㐀-䶿一-鿿가-힯豈-﫿]/gu;
export function estimateTokens(text,ratio=1){
 const s=typeof text==='string'?text:JSON.stringify(text??'');if(!s)return 0;
 const dense=(s.match(DENSE)||[]).length;
 return Math.ceil(((s.length-dense)/4+dense)*ratio);
}
export function messageTokens(messages,ratio=1){return messages.reduce((n,m)=>n+4+estimateTokens(m.content,ratio),3);}

/** Moving-average correction from a provider's reported prompt_tokens; estimated is the uncalibrated (ratio 1) count. */
/**
 * Tokens to hold back for the model's reply. max_tokens is only a ceiling: real replies are usually a few hundred
 * tokens, and reserving the full ceiling costs a small window almost half its prompt. Once enough replies have been
 * seen, reserve 1.5× the longest recent one (at least `floor`); until then, the ceiling or a fifth of `window`, whichever is
 * smaller, so a 4k window does not spend its first turns holding back 44% for a reply that never comes.
 */
export function replyReserve(usage,maxTokens=1800,floor=512,samples=5,window=Infinity){
 const seen=(usage||[]).slice(-30).map(u=>u?.tokens?.completion_tokens).filter(n=>n>0);
 return seen.length<samples?Math.min(maxTokens,Math.max(floor,Math.ceil(window/5))):Math.min(maxTokens,Math.max(floor,Math.ceil(Math.max(...seen)*1.5)));
}
export function calibrate(calibration,estimated,actual){
 const previous=calibration||{ratio:1,samples:0};
 if(!(estimated>0&&actual>0))return previous;
 const observed=Math.min(3,Math.max(0.33,actual/estimated)),weight=previous.samples<5?1/(previous.samples+1):0.2;
 return {ratio:Math.round((previous.ratio*(1-weight)+observed*weight)*1000)/1000,samples:previous.samples+1};
}

// Tier shares are fractions of the pool budget (everything except the fixed prompt and the reply).
export const DEFAULT_TIERS={
 1:{floor:0.15,ceiling:0.35},// staged cast profiles
 2:{floor:0.25,ceiling:0.55},// the active scene's own history
 3:{floor:0.08,ceiling:0.25},// facts and memories about the cast
 4:{floor:0.06,ceiling:0.2},// lore matched to input, location, or cast
 5:{floor:0.05,ceiling:0.2},// recaps of closed scenes
 6:{floor:0,ceiling:0.08,hard:true}// off-screen color, never allowed past its ceiling
};

/**
 * items: {key,pool,tier,rank,lods:[{level,value,cost}],monotone?}. lods are ordered from richest to cheapest.
 * In a monotone pool (a transcript) an item never renders richer than a higher-ranked item, and once an item is
 * cut every lower-ranked item is cut too, so the verbatim part is always a contiguous recent tail.
 */
export function allocate(items,{budget,tiers=DEFAULT_TIERS}){
 const pick=new Map(),spent={},floorOf=t=>Math.floor((tiers[t]?.floor||0)*budget),ceilingOf=t=>Math.floor((tiers[t]?.ceiling??1)*budget);
 let used=0;const ordered=[...items].sort((a,b)=>a.tier-b.tier||b.rank-a.rank||String(a.key).localeCompare(String(b.key)));
 const byTier=new Map();for(const item of ordered){if(!byTier.has(item.tier))byTier.set(item.tier,[]);byTier.get(item.tier).push(item);}
 // cheap=true only adds items at their cheapest rendering; otherwise it upgrades or adds at the richest that fits.
 const place=(tier,limit,cheap=false)=>{const floor={},closed=new Set();
  for(const item of byTier.get(tier)||[]){
   if(item.monotone&&closed.has(item.pool))continue;
   const minIndex=item.monotone?floor[item.pool]||0:0,current=pick.get(item.key),currentCost=current?.cost||0;
   const room=Math.min(limit-(spent[tier]||0),budget-used)+currentCost;
   const last=item.lods.length-1,index=cheap?(!current&&item.lods[last].cost<=room?last:-1):item.lods.findIndex((lod,i)=>i>=minIndex&&(!current||i<current.index)&&lod.cost<=room);
   if(index>=0){const lod=item.lods[index],delta=lod.cost-currentCost;pick.set(item.key,{item,index,cost:lod.cost});spent[tier]=(spent[tier]||0)+delta;used+=delta;}
   const chosen=pick.get(item.key);
   if(item.monotone){if(!chosen)closed.add(item.pool);else if(!cheap)floor[item.pool]=Math.max(floor[item.pool]||0,chosen.index);}
  }
 };
 const tierIds=[...byTier.keys()].sort((a,b)=>a-b);
 // Breadth before depth: cover every candidate at its cheapest rendering (a 20-token digest of an old turn beats
 // silence), then spend what is left upgrading the highest-ranked items.
 for(const tier of tierIds)place(tier,floorOf(tier),true);
 for(const tier of tierIds)place(tier,ceilingOf(tier),true);
 for(const tier of tierIds)place(tier,ceilingOf(tier));
 // Anything a ceiling held back may use budget that other tiers left unspent.
 for(const tier of tierIds)place(tier,tiers[tier]?.hard?ceilingOf(tier):budget);
 const included=[],cut=[];
 for(const item of ordered){const chosen=pick.get(item.key);if(chosen)included.push({key:item.key,pool:item.pool,tier:item.tier,level:item.lods[chosen.index].level,cost:chosen.cost});else cut.push({key:item.key,pool:item.pool,tier:item.tier,reason:item.monotone&&items.some(x=>x.pool===item.pool&&x.rank>item.rank&&!pick.has(x.key))?'older than a cut item':'budget'});}
 return {budget,used,included,cut,chosen:new Map([...pick].map(([key,{item,index}])=>[key,item.lods[index]]))};
}

/** Builds LOD entries with costs from [level,value] pairs, dropping empty or non-shrinking renderings. */
export function lods(pairs,ratio=1,view=null){
 const out=[];for(const [level,value] of pairs){if(value===undefined||value===null||value==='')continue;const cost=estimateTokens(view?view(value):value,ratio)+2;if(out.length&&cost>=out.at(-1).cost)continue;out.push({level,value,cost});}
 return out;
}
