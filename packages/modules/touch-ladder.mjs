import {assert} from '../core/engine.mjs';
import {changeTrust} from './romance-stats.mjs';
import {sobrietyLevel} from './intimacy.mjs';
import {regionLimitReason,sensitivityScaleOf,validateSensitivityScale,clearRegionAgreements} from './intimacy.mjs';
import {REGIONS,bodyRegionOf,ladderPaceOf} from '../core/character-sheet.mjs';
import {reactUnwelcome,validateUnwelcome} from './flirt-cap.mjs';
export const TOUCH_REGIONS={handhold:'arms_hands',cheekkiss:'face',kiss:'lips',makeout:'lips',oral:'intimate',sex:'intimate'};
export const touchRegion=(step,region)=>REGIONS.includes(region)?region:TOUCH_REGIONS[step]||null;
export const touchTextRegion=text=>REGIONS.find(r=>new RegExp(`\\b${r}\\b`,'i').test(text||''))||(/\bcheek\b/i.test(text||'')?'face':null);

// O2 part 1: the engine decides the outcome of a typed intimate action from state; the model only narrates it.
// Ladder tuned to fit the romance stat model (Like/Trust visible, Lust visible, hidden Chemistry/Inhibition not modeled here yet).
const path=['modules','social.touch-ladder'];
export const LADDER=[
 {id:'handhold',name:'take her hand',minTrust:0,lust:2,trustGain:1,public:true,sober:false},
 {id:'armaround',name:'put an arm around her',minTrust:5,lust:3,trustGain:1,public:true,sober:false},
 {id:'hug',name:'hug her',minTrust:5,lust:3,trustGain:1,public:true,sober:false},
 {id:'cheekkiss',name:'kiss her cheek',minTrust:10,lust:4,trustGain:2,public:true,sober:false},
 {id:'kiss',name:'kiss her',minTrust:20,lust:6,trustGain:2,public:true,sober:true},
 {id:'makeout',name:'make out',minTrust:30,lust:10,trustGain:2,public:false,sober:true},
 {id:'grope',name:'touch her intimately',minTrust:40,lust:12,trustGain:1,public:false,sober:true},
 {id:'undress',name:'undress her',minTrust:50,lust:15,trustGain:1,public:false,sober:true},
 {id:'oral',name:'go down on her',minTrust:60,lust:18,trustGain:1,public:false,sober:true},
 {id:'sex',name:'have sex',minTrust:70,lust:20,trustGain:1,public:false,sober:true},
];
const stepOf=id=>LADDER.find(x=>x.id===id);
// Deterministic free-text floor (same shape as firsts.mjs's typedStop/typedYes): most specific phrasing first.
const TEXT_MAP=[
 [/\b(sex|sleep together|make love)\b/i,'sex'],
 [/\boral\b|\bgo down on\b/i,'oral'],
 [/\bundress|strip (her|him|them)|take off (her|his|their) clothes\b/i,'undress'],
 [/\bgrope|grab (her|his|their) (breast|chest|butt|ass)\b/i,'grope'],
 [/\bmake(s|ing)? out\b/i,'makeout'],
 [/\bkiss.*(neck|collarbone|shoulder)\b/i,'kiss'],
 [/\bkiss\b/i,'kiss'],
 [/\bcheek\b/i,'cheekkiss'],
 [/\bhug|embrace|arms? around\b/i,'armaround'],
 [/\bhand\b/i,'handhold'],
];
export const mapTouchText=text=>{const t=(text||'').toLowerCase();for(const [re,id] of TEXT_MAP)if(re.test(t))return id;return null;};

const trustOf=(state,pack,character)=>state.modules['social.relationships']?.edges[`${character}--${pack.playerId}`]||0;
const runtimeOf=(state,character)=>state.modules['social.touch-ladder']?.characters?.[character];
// Private = a listed private location with nobody else present (same witness idea as intimacy.mjs's privacy check, kept local so this module has no hard dependency on social.intimacy).
const privacyOk=(state,pack,character)=>{const loc=state.actors[pack.playerId].location,priv=pack.touchLadder?.privateLocations||pack.intimacySettings?.privateLocations||[];if(!priv.includes(loc))return false;const others=pack.actors.filter(a=>![pack.playerId,character].includes(a.id)&&state.actors[a.id].location===loc);return others.length===0;};

export function touchEligibility(state,pack,character,stepId,region){
 const original=stepOf(stepId),step=original?{...original,minTrust:original.minTrust*ladderPaceOf(pack,character)}:null;if(!step)return {eligible:false,reasons:['unknown step']};
 const trust=trustOf(state,pack,character),sobriety=sobrietyLevel(state,pack,character),reasons=[];
 const limitReason=regionLimitReason(state,pack,character,touchRegion(stepId,region));if(limitReason)reasons.push(limitReason);
 if(step.sober&&sobriety!=='sober')reasons.push('sobriety');
 if(!step.public&&!privacyOk(state,pack,character))reasons.push('privacy');
 if(trust<step.minTrust)reasons.push('trust');
 return {eligible:reasons.length===0,reasons,trust,sobriety,step};
}

// Refusal is always in character, with a vague hint at what would help — never a system error string.
const HINTS={limit_hard:"I'm not ready for that with you yet",sobriety:"maybe when we've both had less to drink",privacy:'not out here where anyone could see',trust:"I don't know if I'm ready for that with you yet"};
const refusalText=(name,hintKey)=>`${name} pulls back gently. "${HINTS[hintKey]||'not right now'}," ${name} says, ${hintKey==='trust'?'searching your face':'glancing around'}.`;
const hardRefusal=(name,reason)=>reason==='limit_hard'?{refusal:{code:reason,reason:refusalText(name,reason),alternatives:[],retry:0}}:{};
export function refuseRegionTouch(tx,character,region,reason){const name=tx.state.actors[character].name;const reaction=reactUnwelcome(tx,character,reason);tx.emit('social.touchRefused',{character,region,verdict:'refuse',reason,...hardRefusal(name,reason),trustDelta:0,lustDelta:0,text:refusalText(name,reason),...(reaction?{style:reaction.style,likeDelta:reaction.likeDelta,trustDelta:reaction.trustDelta,lustDelta:reaction.lustDelta,text:reaction.text}:{})},[tx.pack.playerId,character]);}
export function applyRegionAct(tx,character,act){const step=stepOf(act.target)||stepOf(mapTouchText(act.target.replaceAll('-',' '))),region=act.region||touchTextRegion(act.target)||touchRegion(step?.id),reason=regionLimitReason(tx.state,tx.pack,character,region);if(reason){refuseRegionTouch(tx,character,region,reason);return false;}const body=bodyRegionOf(tx.pack,character,region);if(step&&runtimeOf(tx.state,character)&&(body.limit!==null||body.sensitivity!==null||ladderPaceOf(tx.pack,character)!==1)){const eligible=touchEligibility(tx.state,tx.pack,character,step.id,region).eligible;attemptTouch(tx,character,step.id,region);return eligible;}return true;}

export function attemptTouch(tx,character,stepId,region){
 const {state:s,pack:p}=tx,step=stepOf(stepId);if(!step||!s.actors[character])return;
 region=touchRegion(stepId,region);const name=s.actors[character].name,e=touchEligibility(s,p,character,stepId,region),oldLust=runtimeOf(s,character)?.lust||0;
 if(e.eligible){
  const sensitivity=bodyRegionOf(p,character,region).sensitivity,scale=sensitivity==null?1:sensitivityScaleOf(p)[sensitivity],trustDelta=changeTrust(tx,character,step.trustGain,{quiet:true}),lust=Math.max(0,Math.min(100,(runtimeOf(s,character)?.lust||0)+step.lust*scale));
  tx.set([...path,'characters',character,'lust'],lust);
  tx.emit('social.touchAccepted',{character,step:step.id,...(region?{region}:{}),verdict:'accept',trustDelta,lust,lustDelta:lust-oldLust,text:`${name} leans into it as you ${step.name}.`},[p.playerId,character]);
 } else {
  const hintKey=e.reasons[0],reaction=reactUnwelcome(tx,character,hintKey);if(reaction){tx.emit('social.touchRefused',{...reaction,step:step.id,...(region?{region}:{}),verdict:'refuse',...hardRefusal(name,hintKey)},[p.playerId,character]);return;}const lust=Math.max(0,(runtimeOf(s,character)?.lust||0)-1),trustDelta=changeTrust(tx,character,-1,{quiet:true}),verdict=e.reasons.length===1&&hintKey==='trust'&&e.trust>=e.step.minTrust-10?'hesitate':'refuse';
  tx.set([...path,'characters',character,'lust'],lust);
  tx.emit('social.touchRefused',{character,step:step.id,...(region?{region}:{}),verdict,reason:hintKey,...hardRefusal(name,hintKey),trustDelta,lustDelta:lust-oldLust,text:refusalText(name,hintKey)},[p.playerId,character]);
 }
}

// Prompt-facing digest (packages/ai/context.mjs pattern): inject current Lust/Trust so the model narrates from state, never invents it.
export const touchLadderContext=(state,pack,viewer)=>Object.keys(state.modules['social.touch-ladder']?.characters||{}).filter(c=>viewer===pack.playerId||viewer===c).map(c=>({character:c,lust:runtimeOf(state,c).lust,trust:trustOf(state,pack,c)}));

export const touchLadder={id:'social.touch-ladder',version:'0.1.0',coreApi:'0.1.0',requires:['social.relationships'],
 validate(p){validateUnwelcome(p);validateSensitivityScale(p);const locations=new Set(p.locations.map(x=>x.id));assert(p.touchLadder===undefined||p.touchLadder&&Array.isArray(p.touchLadder.privateLocations||[])&&(p.touchLadder.privateLocations||[]).every(x=>locations.has(x)),'touchLadder private locations invalid');},
 init:p=>({characters:Object.fromEntries(p.actors.filter(x=>x.id!==p.playerId).map(x=>[x.id,{lust:0}]))}),
 commands:{'social.attemptTouch'(tx,args){if(!args?.character||!tx.state.actors[args.character])return;assert(args.region===undefined||REGIONS.includes(args.region),'Touch region invalid');const stepId=args.step&&stepOf(args.step)?args.step:mapTouchText(args.text);if(!stepId)return;attemptTouch(tx,args.character,stepId,args.region||touchTextRegion(args.text));}},
 afterTurn(tx){clearRegionAgreements(tx);},
 actions(){return [];},
 panel(s){return {title:'Touch',lines:Object.entries(s.modules['social.touch-ladder'].characters).map(([c,x])=>`${s.actors[c].name}: Lust ${x.lust}`)};}
};
