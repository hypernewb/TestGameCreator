import {assert} from '../core/engine.mjs';
import {changeTrust} from './romance-stats.mjs';
import {calendarFor} from '../../public/calendar.mjs';

const path=['modules','social.jealousy'];
// Owner numbers (T-034): 0-10 per heroine, stage-scaled triggers, 1 a day decay, cool tone at 3, Trust -2 and a confrontation hook at 6.
export const JEALOUSY={max:10,decayPerDay:1,coolAt:3,confrontAt:6,trustDelta:-2,acquaintanceScale:0.5,likeFloor:50,flirtAmount:2,intimacyAmount:3,rumorAmount:1};
export const JEALOUSY_SCALE={acquaintance:0.5,dating:1,exclusive:2};
// Flavour, not magnitude: the trait decides how she shows it, never whether the meter moves.
export const JEALOUSY_TONE={insecure:'louder and more pointed than usual, pressing for reassurance',guarded:'colder and shorter than usual, warmth withdrawn',competitive:'competitive, measuring you against the other woman and daring you to explain'};
const LEVEL={cool:'cooler than usual: shorter answers, pointed remarks, no explanations offered',confront:'close to confronting you about it'};
const settings=p=>({...JEALOUSY,...p.jealousySettings||{}});
const clamp=(v,max)=>Math.max(0,Math.min(max,v));
const profileOf=(p,character)=>(p.jealousyProfiles||[]).find(x=>x.character===character);
const runtimeOf=(s,character)=>s.modules['social.jealousy']?.characters[character];
const traitsOf=(p,character)=>p.characterSheets?.find(x=>x.actorId===character)?.personality?.traits||p.actors.find(a=>a.id===character)?.traits||[];
const toneOf=(p,character)=>JEALOUSY_TONE[traitsOf(p,character).find(t=>JEALOUSY_TONE[t])]||'cooler and more pointed than usual';
const scaleOf=(cfg,stage)=>stage==='acquaintance'?cfg.acquaintanceScale:JEALOUSY_SCALE[stage];
// She must actually be with you: a committed stage, or acquaintance carrying real Like behind it.
function eligible(state,pack,character,cfg){
  const d=state.modules['social.dating']?.characters?.[character];
  if(!d||d.agreement==='uncommitted'||['rejected','broken'].includes(d.phase))return null;
  if(['dating','exclusive'].includes(d.phase))return d.phase;
  return (state.modules['social.romance-tempo']?.characters?.[character]?.points??0)>=cfg.likeFloor?'acquaintance':null;
}
// A witnessed rival moment, or something she was told. The rival is always another heroine, never the player.
function raise(tx,character,amount,source,rival){
  const cfg=settings(tx.pack),profile=profileOf(tx.pack,character),runtime=runtimeOf(tx.state,character);
  if(!profile||!runtime)return;
  const stage=eligible(tx.state,tx.pack,character,cfg);
  if(!stage)return;
  const trait=traitsOf(tx.pack,character).find(t=>profile[`${t}Multiplier`]!==undefined&&profile[`${t}Multiplier`]!==1);
  const delta=Math.trunc(amount*scaleOf(cfg,stage)*(trait?profile[`${trait}Multiplier`]:1)),before=runtime.meter,after=clamp(before+delta,cfg.max);
  if(after===before)return;
  const name=tx.state.actors[character].name,other=rival?tx.state.actors[rival]?.name||'someone else':'what she heard';
  tx.set([...path,'characters',character,'meter'],after);
  tx.set([...path,'characters',character,'stage'],stage);
  tx.emit('social.jealousyMeterChanged',{character,rival,source,stage,meter:after,from:before,delta,text:`${name} sees you with ${other} and her mood turns.`},[tx.pack.playerId,character]);
  // Trust -2 lands once per crossing; the meter has to fall back under the line before it can bite again.
  if(before<cfg.confrontAt&&after>=cfg.confrontAt&&runtime.lastTrustHit==null){
    tx.set([...path,'characters',character,'lastTrustHit'],tx.state.tick);
    changeTrust(tx,character,cfg.trustDelta,{note:' jealousy'});
    tx.emit('social.jealousyConfrontation',{character,rival,meter:after,stage,text:`${name} confronts you about ${other}.`},[tx.pack.playerId,character]);
  }
}
function witnessed(tx,event,character,cfg){
  if(event.type!=='social.romanticInteraction'&&event.type!=='social.intimacyExposed')return;
  const rival=event.payload.target??event.payload.character;
  if((event.payload.actor??tx.pack.playerId)!==tx.pack.playerId||!event.payload.witnesses?.includes(character)||!rival||rival===character||rival===tx.pack.playerId)return;
  raise(tx,character,event.type==='social.intimacyExposed'?cfg.intimacyAmount:cfg.flirtAmount,event.type,rival);
}
// Told, not seen: a disclosure names the rival, a believed rumor only says something happened.
function told(tx,event,character,cfg){
  if(event.type==='social.encounterDisclosed'){if(event.payload.character===character&&event.payload.partner)raise(tx,character,cfg.intimacyAmount,event.type,event.payload.partner);return;}
  if(event.type==='social.rumorBelieved'&&event.payload.subject===tx.pack.playerId&&event.payload.character===character)raise(tx,character,cfg.rumorAmount,event.type,null);
}
// The prompt gets behaviour, never bookkeeping: one private line per jealous character in the cast.
export function jealousyHint(state,pack,id){
  if(!pack.modules?.['social.jealousy'])return '';
  const meter=runtimeOf(state,id)?.meter??0;
  if(!meter)return '';
  const cfg=settings(pack);
  return meter>=cfg.confrontAt?`${LEVEL.confront}; ${toneOf(pack,id)}`:`${LEVEL.cool}; ${toneOf(pack,id)}`;
}
export function jealousyContext(state,pack,viewer){
  const cfg=settings(pack);
  return (pack.jealousyProfiles||[]).filter(profile=>viewer===pack.playerId||viewer===profile.character).map(profile=>{
    const runtime=runtimeOf(state,profile.character);
    return {character:profile.character,...(viewer===pack.playerId?{}:{stage:runtime?.stage||'acquaintance',meter:runtime?.meter??0}),tension:(runtime?.meter??0)>=cfg.confrontAt?'confronting':(runtime?.meter??0)>=cfg.coolAt?'cooling':'none'};
  });
}

export const jealousy={
  id:'social.jealousy',version:'0.1.0',coreApi:'0.1.0',requires:['social.dating','social.romance-tempo','social.relationships'],
  validate(p){
    const s=p.jealousySettings;
    if(s!==undefined){assert(s&&typeof s==='object'&&!Array.isArray(s),'jealousySettings: expected an object');
     for(const [k,lo,hi] of [['max',1,20],['decayPerDay',0,10],['coolAt',0,20],['confrontAt',0,20],['likeFloor',0,1000]])assert(s[k]===undefined||Number.isInteger(s[k])&&s[k]>=lo&&s[k]<=hi,`jealousySettings.${k}: expected an integer from ${lo} to ${hi}`);
     for(const [k,lo,hi] of [['trustDelta',-100,0],['acquaintanceScale',0,10]])assert(s[k]===undefined||Number.isFinite(s[k])&&s[k]>=lo&&s[k]<=hi,`jealousySettings.${k}: expected a number from ${lo} to ${hi}`);
     for(const k of ['flirtAmount','intimacyAmount','rumorAmount'])assert(s[k]===undefined||Number.isInteger(s[k])&&s[k]>=0&&s[k]<=20,`jealousySettings.${k}: expected an integer from 0 to 20`);
     assert(s.coolAt===undefined||s.confrontAt===undefined||s.confrontAt>=s.coolAt,'jealousySettings: the confrontation line cannot sit below the cool line');}
    assert(Array.isArray(p.jealousyProfiles||[])&&(p.jealousyProfiles||[]).length<=30,'jealousyProfiles: expected up to 30 profiles');
    const actors=new Set(p.actors.filter(a=>a.id!==p.playerId).map(a=>a.id)),dating=new Set((p.datingProfiles||[]).map(x=>x.character)),seen=new Set();
    for(const profile of p.jealousyProfiles||[]){
     assert(actors.has(profile.character)&&dating.has(profile.character)&&!seen.has(profile.character),'jealousy profile character invalid or duplicate');seen.add(profile.character);
     for(const trait of Object.keys(JEALOUSY_TONE)){const m=profile[`${trait}Multiplier`];assert(m===undefined||Number.isFinite(m)&&m>=1&&m<=3,`jealousy ${trait}Multiplier invalid`);}}
  },
  init(p){return {characters:Object.fromEntries((p.jealousyProfiles||[]).map(profile=>[profile.character,{meter:0,stage:'acquaintance',lastTrustHit:null}]))};},
  react(tx,event){
    if(event.type==='core.timeAdvanced'){const cfg=settings(tx.pack),days=calendarFor(event.payload.to,tx.pack).day-calendarFor(event.payload.from,tx.pack).day;
     if(days>0&&cfg.decayPerDay)for(const profile of tx.pack.jealousyProfiles||[]){const runtime=runtimeOf(tx.state,profile.character);
      if(!runtime||!runtime.meter)continue;
      const after=clamp(runtime.meter-days*cfg.decayPerDay,cfg.max);
      if(after!==runtime.meter)tx.set([...path,'characters',profile.character,'meter'],after);
      if(runtime.lastTrustHit!=null&&after<cfg.confrontAt)tx.set([...path,'characters',profile.character,'lastTrustHit'],null);}
     return;}
    const cfg=settings(tx.pack);
    for(const profile of tx.pack.jealousyProfiles||[]){witnessed(tx,event,profile.character,cfg);told(tx,event,profile.character,cfg);}
  },
  panel(s,p){return {title:'Jealousy',lines:(p.jealousyProfiles||[]).map(profile=>{const runtime=runtimeOf(s,profile.character);return runtime?.meter?`${s.actors[profile.character].name}: ${runtime.meter>=settings(p).confrontAt?'confronting':runtime.meter>=settings(p).coolAt?'cooling':'none'}`:'';}).filter(Boolean)};}
};
