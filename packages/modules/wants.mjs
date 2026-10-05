import {assert,safeKey} from '../core/engine.mjs';
import {calendarFor} from '../../public/calendar.mjs';
import {addPoints} from './romance-tempo.mjs';

// Her own wants (T-040): each heroine carries authored wants on her sheet, a deterministic weekly draw from the
// save seed decides which one or two are live, and an interpreted act or a kept plan that matches the want keys
// retires one for Like. The engine owns the rotation and the price; the model only ever sees the wish.
export const WANTS={reward:3,active:2};
const path=['modules','social.wants'];
const settings=p=>({...WANTS,...p.wantSettings||{}});
const weekOf=(state,pack)=>calendarFor(state.tick,pack).week;
const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
export const wantsOf=(pack,character)=>(pack.characterSheets||[]).find(s=>s.actorId===character)?.wants||[];
const runtimeOf=(state,character)=>state.modules['social.wants']?.characters?.[character];
// A fulfilled want stays out of circulation for the rest of its week and the next one, so a new one can roll.
const inRotation=(id,week,spent)=>spent[id]===undefined||spent[id]<week-1;
// The draw depends on the save seed, the week and the heroine alone: same save, same wants, every reload.
export function pickWants(pack,seed,week,character,spent={}){
  const pool=wantsOf(pack,character).filter(w=>inRotation(w.id,week,spent));
  return pool.map(w=>[w,hash(`${seed}:${week}:${character}:${w.id}`)]).sort((a,b)=>a[1]-b[1]||(a[0].id<b[0].id?-1:1)).slice(0,settings(pack).active).map(([w])=>w.id);
}
export const liveWants=(state,pack,character)=>{
  const runtime=runtimeOf(state,character);if(!runtime)return [];
  const week=weekOf(state,pack),active=runtime.week===week?runtime.active||[]:pickWants(pack,state.initialSeed,week,character,runtime.spent||{});
  return active.map(id=>wantsOf(pack,character).find(w=>w.id===id)).filter(Boolean);
};
// One line, one character: what they have been wanting, in their words, never a price.
export function wantHint(state,pack,character){
  if(!pack.modules?.['social.wants']||character===pack.playerId)return '';
  const want=liveWants(state,pack,character)[0];
  return want?.text?`has been wanting ${want.text}`:'';
}
function rotate(tx){
  const week=weekOf(tx.state,tx.pack);
  for(const [character,runtime] of Object.entries(tx.state.modules['social.wants'].characters)){
    if(runtime.week===week)continue;
    const spent=Object.fromEntries(Object.entries(runtime.spent||{}).filter(([,at])=>at>=week-1));
    tx.set([...path,'characters',character],{week,active:pickWants(tx.pack,tx.state.initialSeed,week,character,spent),spent});
  }
}
// liveWants, not the raw list, so a want the prompt offered is the one that can actually be fulfilled.
function match(tx,character,keys){
  return liveWants(tx.state,tx.pack,character).find(w=>keys.some(key=>w.keys.includes(key)))||null;
}
function fulfil(tx,character,want,source){
  const runtime=runtimeOf(tx.state,character),cfg=settings(tx.pack),amount=want.reward??cfg.reward,week=weekOf(tx.state,tx.pack);
  const spent=Object.fromEntries(Object.entries(runtime.spent||{}).filter(([,at])=>at>=week-1));
  tx.set([...path,'characters',character,'week'],week);
  tx.set([...path,'characters',character,'active'],liveWants(tx.state,tx.pack,character).map(w=>w.id).filter(id=>id!==want.id));
  tx.set([...path,'characters',character,'spent'],{...spent,[want.id]:week});
  const points=addPoints(tx,character,amount,'her want');
  tx.emit('social.wantFulfilled',{character,want:want.id,source,points,text:`${tx.state.actors[character].name} gets what she wanted.`},[tx.pack.playerId,character]);
}

export const wants={
  id:'social.wants',version:'0.1.0',coreApi:'0.1.0',requires:['social.acts','social.romance-tempo'],
  validate(p){
    const s=p.wantSettings;
    if(s!==undefined){assert(s&&typeof s==='object'&&!Array.isArray(s),'wantSettings: expected an object');
     for(const [k,lo,hi] of [['reward',0,100],['active',1,4]])assert(s[k]===undefined||Number.isInteger(s[k])&&s[k]>=lo&&s[k]<=hi,`wantSettings.${k}: expected an integer from ${lo} to ${hi}`);}
    for(const sheet of p.characterSheets||[]){const seen=new Set();for(const want of sheet.wants||[]){
     assert(want&&typeof want==='object'&&!Array.isArray(want)&&safeKey(want.id)&&!seen.has(want.id),`wants.${sheet.actorId}: invalid or duplicate ID`);seen.add(want.id);
     assert(typeof want.text==='string'&&want.text.trim()&&want.text.length<=160,`wants.${want.id}.text: required`);
     assert(Array.isArray(want.keys)&&want.keys.length&&want.keys.length<=8&&want.keys.every(k=>safeKey(k)),`wants.${want.id}.keys: expected 1-8 short keys`);
     assert(want.reward===undefined||Number.isInteger(want.reward)&&want.reward>=0&&want.reward<=100,`wants.${want.id}.reward: expected 0-100`);}}
  },
  init(p,{seed,tick=0}){const week=calendarFor(tick,p).week;return {characters:Object.fromEntries(p.actors.filter(a=>a.id!==p.playerId&&wantsOf(p,a.id).length).map(a=>[a.id,{week,active:pickWants(p,seed,week,a.id,{}),spent:{}}]))};},
  react(tx,event){
    const characters=tx.state.modules['social.wants'].characters;if(!Object.keys(characters).length)return;
    if(event.type==='core.timeAdvanced'){rotate(tx);return;}
    const {character,act,verdict,location}=event.payload||{};
    if(!character||!characters[character])return;
    if(event.type==='social.actPriced'&&verdict!=='unpaid'){const want=match(tx,character,[act?.kind,act?.target].filter(Boolean));if(want)fulfil(tx,character,want,event.type);}
    if(event.type==='social.planKept'){const want=match(tx,character,[location]);if(want)fulfil(tx,character,want,event.type);}
  }
};
