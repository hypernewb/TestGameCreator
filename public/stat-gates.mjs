// VN-style stat gates on a character card, pure and world-neutral. A rule reads the player's own stat
// ({stat,min}) or this character's bond toward the player ({bond,min}).
// actor.interestGate=[rules]: not romantically interested until every rule passes.
// actor.desireReveal={stat|bond,hint,reveal}: the player's journal shows turn-ons/offs as a hint, then in full.
const isInt=n=>Number.isInteger(n)&&n>=0&&n<=1000;
export const gateValue=(state,pack,actor,rule)=>rule.stat?state?.modules?.['character.stats']?.values?.[`${pack.playerId}--${rule.stat}`]??0:state?.modules?.['social.bonds']?.values?.[`${actor}--${rule.bond}--${pack.playerId}`]??0;
export const gateLabel=(pack,rule)=>rule.stat?pack.statDefinitions?.find(d=>d.id===rule.stat)?.name||rule.stat:pack.relationshipDimensions?.find(d=>d.id===rule.bond)?.name||rule.bond;
const actorOf=(pack,a)=>typeof a==='string'?pack.actors.find(x=>x.id===a):a;
export function interestGate(state,pack,a){const actor=actorOf(pack,a);const missing=(actor?.interestGate||[]).map(rule=>({rule,label:gateLabel(pack,rule),min:rule.min,value:gateValue(state,pack,actor.id,rule)})).filter(x=>x.value<x.min);return {open:!missing.length,missing};}
// Plain-language reason, used by dating's reasons list, the narrator cue and Studio previews.
export const gateText=(m,player=true)=>m.rule.stat?`${player?'your':'the player\'s'} ${m.label} reaches ${m.min}`:`${m.label} reaches ${m.min}`;
export function interestCue(state,pack,a){const actor=actorOf(pack,a),g=interestGate(state,pack,actor);return g.open?'':`Not romantically interested in the player yet (until ${g.missing.map(m=>gateText(m,false)).join(' and ')}): friendly at most, deflects flirting and turns down romantic or sexual advances.`;}
export function desireReveal(state,pack,a){const actor=actorOf(pack,a),r=actor?.desireReveal;if(!r)return null;const on=actor.turnOns||[],off=actor.turnOffs||[];if(!on.length&&!off.length)return null;
 const value=gateValue(state,pack,actor.id,r),label=gateLabel(pack,r),stage=value>=r.reveal?'revealed':value>=r.hint?'hint':'hidden';
 const turnOns=stage==='revealed'?on:stage==='hint'?on.slice(0,1):[],turnOffs=stage==='revealed'?off:stage==='hint'?off.slice(0,1):[];
 return {stage,turnOns,turnOffs,hidden:on.length+off.length-turnOns.length-turnOffs.length,next:stage==='revealed'?null:{label,min:stage==='hint'?r.reveal:r.hint,value}};}
export function validateStatGates(pack,fail){const stats=new Set((pack.statDefinitions||[]).map(d=>d.id)),bonds=new Set((pack.relationshipDimensions||[]).map(d=>d.id));
 const rule=(r,where)=>{if(!r||typeof r!=='object')return fail(`${where}: expected an object`);if(!!r.stat===!!r.bond)return fail(`${where}: set exactly one of stat or bond`);if(r.stat&&!pack.modules?.['character.stats'])return fail(`${where}: stat gates need the character.stats module`);if(r.bond&&!pack.modules?.['social.bonds'])return fail(`${where}: bond gates need the social.bonds module`);if(r.stat&&!stats.has(r.stat))return fail(`${where}: unknown stat ${r.stat}`);if(r.bond&&!bonds.has(r.bond))return fail(`${where}: unknown relationship dimension ${r.bond}`);};
 for(const a of pack.actors||[]){const at=`actors.${a.id}`;
  if(a.interestGate!==undefined){if(!Array.isArray(a.interestGate)||a.interestGate.length>4)fail(`${at}.interestGate: expected up to 4 rules`);else a.interestGate.forEach((r,i)=>{rule(r,`${at}.interestGate[${i}]`);if(!isInt(r?.min))fail(`${at}.interestGate[${i}].min: whole number 0-1000`);});if(a.id===pack.playerId&&a.interestGate?.length)fail(`${at}.interestGate: the player has no interest gate`);}
  if(a.desireReveal!==undefined){const r=a.desireReveal;rule(r,`${at}.desireReveal`);if(!isInt(r?.hint)||!isInt(r?.reveal)||r.hint>r.reveal)fail(`${at}.desireReveal: hint and reveal are whole numbers 0-1000 with hint <= reveal`);}}}
