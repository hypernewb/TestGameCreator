import {calendarFor} from '../../public/calendar.mjs';

// Romance stats (docs/ROMANCE-STATS.md). Like and Trust gains are capped per heroine per in-game day; losses never are.
// Off unless the pack sets romanceStats.dailyGain. No engine import: core/engine.mjs calls changeTrust for activity effects.
export const dailyGainOf=pack=>pack.romanceStats?.dailyGain;
export const validateRomanceStats=p=>{const r=p.romanceStats;if(r===undefined)return;if(!(r&&typeof r==='object'&&(r.dailyGain===undefined||Number.isInteger(r.dailyGain)&&r.dailyGain>0&&r.dailyGain<=100)))throw new Error('romanceStats.dailyGain must be a positive integer');};
export const dayOf=(state,pack)=>calendarFor(state.tick,pack).day;
// used = gain already banked today; returns how much of amount may land.
export const cappedGain=(pack,character,amount,used)=>{const cap=dailyGainOf(pack);return amount<=0||!Number.isInteger(cap)||!(pack.romanceTempoProfiles||[]).some(x=>x.character===character)?amount:Math.max(0,Math.min(amount,cap-used));};
// The one Trust writer: clamps 0..100, applies the daily cap and emits social.relationshipChanged. Returns the applied delta.
export function changeTrust(tx,character,delta,extra={}){
 const {state:s,pack:p}=tx,m=s.modules['social.relationships'];if(!m)return 0;
 const edge=`${character}--${p.playerId}`,old=m.edges[edge]||0,day=dayOf(s,p),key=`${edge}--gain--d${day}`,used=m.rewarded[key]||0,want=cappedGain(p,character,delta,used),value=Math.max(0,Math.min(100,old+want)),applied=value-old,capped=delta>0&&want<delta;
 if(applied)tx.set(['modules','social.relationships','edges',edge],value);if(applied>0&&dailyGainOf(p))tx.set(['modules','social.relationships','rewarded',key],used+applied);
 if(applied||!extra.quiet)tx.emit('social.relationshipChanged',{actor:character,toward:p.playerId,old,value,delta:applied,...(capped?{capped:true}:{}),...Object.fromEntries(Object.entries(extra).filter(([k])=>!['quiet','note'].includes(k))),text:`${s.actors[character].name}: Trust ${old} → ${value}${extra.note||''}`},[p.playerId,character]);
 return applied;
}
