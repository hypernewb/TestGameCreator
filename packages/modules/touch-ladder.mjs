import {assert} from '../core/engine.mjs';
import {changeTrust} from './romance-stats.mjs';
import {sobrietyLevel} from './intimacy.mjs';

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

export function touchEligibility(state,pack,character,stepId){
 const step=stepOf(stepId);if(!step)return {eligible:false,reasons:['unknown step']};
 const trust=trustOf(state,pack,character),sobriety=sobrietyLevel(state,pack,character),reasons=[];
 if(step.sober&&sobriety!=='sober')reasons.push('sobriety');
 if(!step.public&&!privacyOk(state,pack,character))reasons.push('privacy');
 if(trust<step.minTrust)reasons.push('trust');
 return {eligible:reasons.length===0,reasons,trust,sobriety,step};
}

// Refusal is always in character, with a vague hint at what would help — never a system error string.
const HINTS={sobriety:"maybe when we've both had less to drink",privacy:'not out here where anyone could see',trust:"I don't know if I'm ready for that with you yet"};
const refusalText=(name,hintKey)=>`${name} pulls back gently. "${HINTS[hintKey]||'not right now'}," ${name} says, ${hintKey==='trust'?'searching your face':'glancing around'}.`;

export function attemptTouch(tx,character,stepId){
 const {state:s,pack:p}=tx,step=stepOf(stepId);if(!step||!s.actors[character])return;
 const name=s.actors[character].name,e=touchEligibility(s,p,character,stepId),oldLust=runtimeOf(s,character)?.lust||0;
 if(e.eligible){
  const trustDelta=changeTrust(tx,character,step.trustGain,{quiet:true}),lust=Math.max(0,Math.min(100,(runtimeOf(s,character)?.lust||0)+step.lust));
  tx.set([...path,'characters',character,'lust'],lust);
  tx.emit('social.touchAccepted',{character,step:step.id,verdict:'accept',trustDelta,lust,lustDelta:lust-oldLust,text:`${name} leans into it as you ${step.name}.`},[p.playerId,character]);
 } else {
  const hintKey=e.reasons[0],lust=Math.max(0,(runtimeOf(s,character)?.lust||0)-1),trustDelta=changeTrust(tx,character,-1,{quiet:true}),verdict=e.reasons.length===1&&hintKey==='trust'&&e.trust>=step.minTrust-10?'hesitate':'refuse';
  tx.set([...path,'characters',character,'lust'],lust);
  tx.emit('social.touchRefused',{character,step:step.id,verdict,reason:hintKey,trustDelta,lustDelta:lust-oldLust,text:refusalText(name,hintKey)},[p.playerId,character]);
 }
}

// Prompt-facing digest (packages/ai/context.mjs pattern): inject current Lust/Trust so the model narrates from state, never invents it.
export const touchLadderContext=(state,pack,viewer)=>Object.keys(state.modules['social.touch-ladder']?.characters||{}).filter(c=>viewer===pack.playerId||viewer===c).map(c=>({character:c,lust:runtimeOf(state,c).lust,trust:trustOf(state,pack,c)}));

export const touchLadder={id:'social.touch-ladder',version:'0.1.0',coreApi:'0.1.0',requires:['social.relationships'],
 validate(p){const locations=new Set(p.locations.map(x=>x.id));assert(p.touchLadder===undefined||p.touchLadder&&Array.isArray(p.touchLadder.privateLocations||[])&&(p.touchLadder.privateLocations||[]).every(x=>locations.has(x)),'touchLadder private locations invalid');},
 init:p=>({characters:Object.fromEntries(p.actors.filter(x=>x.id!==p.playerId).map(x=>[x.id,{lust:0}]))}),
 commands:{'social.attemptTouch'(tx,args){if(!args?.character||!tx.state.actors[args.character])return;const stepId=args.step&&stepOf(args.step)?args.step:mapTouchText(args.text);if(!stepId)return;attemptTouch(tx,args.character,stepId);}},
 actions(){return [];},
 panel(s){return {title:'Touch',lines:Object.entries(s.modules['social.touch-ladder'].characters).map(([c,x])=>`${s.actors[c].name}: Lust ${x.lust}`)};}
};
