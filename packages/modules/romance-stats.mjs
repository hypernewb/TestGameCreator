import {calendarFor} from '../../public/calendar.mjs';
import {RULES_MARKER,PROGRESSION_VERSION,DEFAULT_DAILY_GAIN} from '../core/progression.mjs';

// Romance stats (docs/ROMANCE-STATS.md). Like and Trust gains are capped per heroine per in-game day; losses never are.
// Off unless the pack sets romanceStats.dailyGain, or the save is stamped under progression version 1 (then the default cap applies).
// No engine import: core/engine.mjs calls changeTrust for activity effects.
export const dailyGainOf=(pack,s)=>pack.romanceStats?.dailyGain??(s?.progression?DEFAULT_DAILY_GAIN:undefined);
// The first capped gain of a flagged turn records the cap it used; replayPack reads that value back.
export function markRules(tx,character,amount){if(amount>0&&tx.state.progression&&(tx.pack.romanceTempoProfiles||[]).some(x=>x.character===character)&&!tx.events.some(e=>e.type===RULES_MARKER))tx.emit(RULES_MARKER,{version:PROGRESSION_VERSION,dailyGain:dailyGainOf(tx.pack,tx.state)},[]);}
export const validateRomanceStats=p=>{const r=p.romanceStats;if(r===undefined)return;if(!(r&&typeof r==='object'&&(r.dailyGain===undefined||Number.isInteger(r.dailyGain)&&r.dailyGain>0&&r.dailyGain<=100)))throw new Error('romanceStats.dailyGain must be a positive integer');};
export const dayOf=(state,pack)=>calendarFor(state.tick,pack).day;
// C1 Lust baseline (docs/ROMANCE-STATS.md): a rush fades back toward an earned per-heroine floor as game time passes.
// Off unless the pack sets lustBaseline; the numbers live in the pack so a creator can retune or omit them.
export const LUST_BASELINE={perDaypart:0.25,milestones:{intimateFirst:5,dating:5,exclusive:5,preference:2},hint:'some earlier warmth lingers'};
export const LUST_MILESTONES=Object.keys(LUST_BASELINE.milestones);
export const lustBaselineOf=pack=>pack.lustBaseline&&{...LUST_BASELINE,...pack.lustBaseline,milestones:{...LUST_BASELINE.milestones,...(pack.lustBaseline.milestones||{})}};
export const validateLustBaseline=p=>{const c=p.lustBaseline,bad=key=>{throw new Error(`lustBaseline${key?`.${key}`:''} is invalid`);};if(c===undefined)return;if(!c||typeof c!=='object'||Array.isArray(c))return bad('field');if(c.perDaypart!==undefined&&!(Number.isFinite(c.perDaypart)&&c.perDaypart>0&&c.perDaypart<=1))bad('perDaypart');for(const k of LUST_MILESTONES)if(c.milestones?.[k]!==undefined&&!(Number.isInteger(c.milestones[k])&&c.milestones[k]>=0&&c.milestones[k]<=100))bad(`milestones.${k}`);if(c.hint!==undefined&&(typeof c.hint!=='string'||!c.hint.trim()||c.hint.length>100))bad('hint');};
// steps dayparts close perDaypart of the remaining gap each: heat above the floor fades, a shortfall eases back up to it.
// The move never crosses the floor. Two places keep saved values stable, and a gap under a percent of the floor settles on it
// rather than leaving her a rounding step short of what she earned for good.
export const easeLust=(lust,floor,steps,perDaypart)=>{let value=Number(lust)||0;for(let i=0;i<steps;i++)value+=(floor-value)*perDaypart;const closed=Math.round(value*100)/100;return Math.abs(closed-floor)<Math.max(1,floor)/100?floor:closed;};
// used = gain already banked today; returns how much of amount may land.
export const cappedGain=(pack,character,amount,used,s)=>{const cap=dailyGainOf(pack,s);return amount<=0||!Number.isInteger(cap)||!(pack.romanceTempoProfiles||[]).some(x=>x.character===character)?amount:Math.max(0,Math.min(amount,cap-used));};
// The one Trust writer: clamps 0..100, applies the daily cap and emits social.relationshipChanged. Returns the applied delta.
export function changeTrust(tx,character,delta,extra={}){
 const {state:s,pack:p}=tx,m=s.modules['social.relationships'];if(!m)return 0;
 const edge=`${character}--${p.playerId}`,old=m.edges[edge]||0,day=dayOf(s,p),key=`${edge}--gain--d${day}`,used=m.rewarded[key]||0,want=cappedGain(p,character,delta,used,s),value=Math.max(0,Math.min(100,old+want)),applied=value-old,capped=delta>0&&want<delta;
 markRules(tx,character,delta);
 if(applied)tx.set(['modules','social.relationships','edges',edge],value);if(applied>0&&dailyGainOf(p,s))tx.set(['modules','social.relationships','rewarded',key],used+applied);
 if(applied||!extra.quiet)tx.emit('social.relationshipChanged',{actor:character,toward:p.playerId,old,value,delta:applied,...(capped?{capped:true}:{}),...Object.fromEntries(Object.entries(extra).filter(([k])=>!['quiet','note'].includes(k))),text:`${s.actors[character].name}: Trust ${old} → ${value}${extra.note||''}`},[p.playerId,character]);
 return applied;
}
