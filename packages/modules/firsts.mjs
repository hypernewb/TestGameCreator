import {assert,safeKey} from '../core/engine.mjs';
import {RUNGS,TONES,NIGHT,STOP_LABEL,STOP_TRUST,FIRST_CHECKPOINTS,FIRST_INPUTS,firstTone} from '../cards/beat-library.mjs';
import {applyEffects} from './scenes.mjs';
import {setIntimacyConsent,completeIntimacy} from './intimacy.mjs';
import {actProfileOf} from './acts.mjs';

// O1 free-typed firsts (docs/FIRSTS-PLAN.md): the player types, the engine holds 2-3 checkpoints and scores each typed turn's priced acts
// against the one that's live. The model only tags acts and narrates; social.scoreFirst is a recorded command, so replay never calls it.
const path=['modules','social.firsts'],CAT='first-night',HISTORY=50,validCg=x=>typeof x==='string'&&/^assets\/[\w./-]+\.(png|jpe?g|webp|svg)$/.test(x)&&!x.includes('..');
const text=(x,max)=>typeof x==='string'&&x.trim().length>0&&x.length<=max;
const firstOf=(p,id)=>(p.firsts||[]).find(x=>x.id===id);
const here=(s,p,c)=>Boolean(s.scene?.characters?.includes(c)||s.actors[c]&&s.actors[c].location===s.actors[p.playerId].location);
const intimate=(s,c)=>s.modules['social.intimacy']?.characters?.[c]?.active?.category===CAT;
// How she felt about an act, from her profile entry when one matched: the scene's point cap can price a late liked act neutral, and a first shouldn't lose its best to that.
const feel=(p,c,x)=>{const e=x.entry&&actProfileOf(p,c)?.entries.find(y=>y.id===x.entry);return e?e.points>0?'liked':e.points<0?'disliked':'neutral':x.verdict;};
const ready=(s,p,f)=>here(s,p,f.character)&&(f.rung!=='night'||intimate(s,f.character));
// Deterministic floors, like typedListen: a typed stop never depends on the model tagging it. "don't stop" and "can't wait" are not stops.
const norm=t=>String(t||'').toLowerCase().replace(/[’‘]/g,"'");
export const typedStop=t=>{t=norm(t);return /^\s*no[.!]*\s*$/.test(t)||/\bnot tonight\b/.test(t)||/(?<!\b(?:don'?t|do not|never|not|can'?t|cannot|won'?t|couldn'?t|didn'?t|doesn'?t)\s+|\bno need to\s+|\b(?:don'?t|do not|never)\s+(?:want|wanna|need)(?:\s+to)?\s+)\b(?:stop|wait|slow down)\b/.test(t);};
export const typedYes=t=>!typedStop(t)&&/\b(?:yes|yeah|yep|yup|i'?m sure|i want (?:this|to|you)|of course|don'?t stop)\b/.test(norm(t));
// Prompt-facing digest for the narrator brief (step 4): her cue, and what reads her right, which stays private like the likes brief.
export function firstBrief(state,pack){const a=state.modules['social.firsts']?.active;if(!a)return null;const f=firstOf(pack,a.first),cp=FIRST_CHECKPOINTS[f.rung][a.checkpoint];
 return {first:f.id,character:f.character,rung:f.rung,title:f.title,checkpoint:cp.id,step:a.checkpoint+1,of:f.checkpoints.length,cue:f.checkpoints[a.checkpoint].cue,waitingFor:cp.want,required:Boolean(cp.required)};}

function begin(tx,f){const s=tx.state.modules['social.firsts'];
 tx.set([...path,'active'],{first:f.id,checkpoint:0,inputs:0,verdicts:[],sources:[],startedTick:tx.state.tick});tx.set([...path,'offers'],s.offers.filter(o=>o.first!==f.id));
 tx.emit('social.firstStarted',{first:f.id,character:f.character,rung:f.rung,title:f.title,cue:f.checkpoints[0].cue,text:f.opening},[tx.pack.playerId,f.character]);}
function offer(tx,f){const s=tx.state.modules['social.firsts'];if(!s.offers.some(o=>o.first===f.id))tx.set([...path,'offers'],[...s.offers,{first:f.id,after:tx.state.tick}]);}
// Every way out but completion puts the first back on offer: routes never close, a stopped or rushed first can be tried again later.
function end(tx,f,outcome,why){const s=tx.state.modules['social.firsts'],a=s.active;
 tx.set([...path,'active'],null);tx.set([...path,'offers'],[...s.offers.filter(o=>o.first!==f.id),{first:f.id,after:tx.state.tick+1}]);
 tx.set([...path,'history'],[...s.history,{first:f.id,outcome,verdicts:a.verdicts,tick:tx.state.tick}].slice(-HISTORY));
 tx.emit(outcome==='rejected'?'social.firstRejected':'social.firstStopped',{first:f.id,character:f.character,rung:f.rung,outcome,why,verdicts:a.verdicts,text:outcome==='rejected'?`You pushed. ${tx.state.actors[f.character].name} pulls away, and the moment is gone.`:outcome==='abandoned'?'The moment passes, for now.':`You stop. ${tx.state.actors[f.character].name} is glad you said so.`},[tx.pack.playerId,f.character]);}
// Stop (the button or a typed stop): today's authored stop effects on the night, a clean exit everywhere else.
function stop(tx,f,why){end(tx,f,'stopped',why);if(f.rung==='night')applyEffects(tx,[{type:'intimacyConsent',character:f.character,category:CAT,status:'withdrawn'},{type:'trust',character:f.character,delta:STOP_TRUST}]);}
function complete(tx,f,verdicts){const s=tx.state.modules['social.firsts'],c=f.character,tone=f.rung==='night'?null:firstTone(verdicts.map(v=>v.verdict));
 tx.set([...path,'active'],null);tx.set([...path,'completed'],[...s.completed,f.id]);tx.set([...path,'history'],[...s.history,{first:f.id,outcome:'completed',verdicts,tick:tx.state.tick}].slice(-HISTORY));
 if(f.rung==='night'){if(intimate(tx.state,c))completeIntimacy(tx,c,CAT,verdicts.at(-1).verdict==='miss'?'awkward':'positive');}
 else{const [chem,trust]=TONES[tone];applyEffects(tx,[{type:'chemistry',character:c,delta:chem,reason:'how the moment went'},...(trust?[{type:'trust',character:c,delta:trust}]:[])]);}
 applyEffects(tx,[{type:'flag',id:`${c}-${RUNGS[f.rung].flag}`,value:true}]);
 tx.emit('social.firstCompleted',{first:f.id,character:c,rung:f.rung,title:f.title,verdicts,...(tone?{tone}:{}),cg:f.cg||null,text:`${f.title}: done.`},[tx.pack.playerId,c]);}

export const firsts={id:'social.firsts',version:'0.1.0',coreApi:'0.1.0',requires:['social.acts'],
 validate(p){
  assert(Array.isArray(p.firsts||[])&&(p.firsts||[]).length<=60,'firsts: expected up to 60 entries');
  const actors=new Set(p.actors.filter(a=>a.id!==p.playerId).map(a=>a.id)),ids=new Set(),pairs=new Set();
  for(const f of p.firsts||[]){const at=`firsts.${f?.id}`;
   assert(f&&safeKey(f.id)&&!ids.has(f.id),`${at}: id invalid or duplicate`);ids.add(f.id);
   assert(actors.has(f.character),`${at}.character: unknown`);assert(Object.hasOwn(RUNGS,f.rung),`${at}.rung: one of ${Object.keys(RUNGS)}`);
   assert(!pairs.has(`${f.character}:${f.rung}`),`${at}: ${f.character} already has a ${f.rung} first`);pairs.add(`${f.character}:${f.rung}`);
   assert(text(f.title,120)&&text(f.opening,2000),`${at}: title and opening required`);
   assert(f.trigger&&typeof f.trigger.event==='string'&&f.trigger.event&&f.trigger.event.length<100,`${at}.trigger.event: required`);
   assert(f.trigger.match===undefined||f.trigger.match&&typeof f.trigger.match==='object'&&!Array.isArray(f.trigger.match)&&Object.entries(f.trigger.match).every(([k,v])=>safeKey(k)&&['string','number','boolean'].includes(typeof v)),`${at}.trigger.match: invalid`);
   const shape=FIRST_CHECKPOINTS[f.rung],prefs=new Set(((p.datingProfiles||[]).find(x=>x.character===f.character)?.preferences||[]).map(x=>x.id));
   assert(Array.isArray(f.checkpoints)&&f.checkpoints.length===shape.length&&f.checkpoints.every((x,i)=>x?.id===shape[i].id),`${at}.checkpoints: expected ${shape.map(x=>x.id).join(', ')} in order`);
   for(const x of f.checkpoints){assert(text(x.cue,600),`${at}.${x.id}.cue: required`);assert(x.discover===undefined||prefs.has(x.discover),`${at}.${x.id}.discover: unknown preference`);}
   assert(f.cg===undefined||validCg(f.cg),`${at}.cg: an assets/ image path`);
   if(f.rung==='night'){const profile=(p.intimacyProfiles||[]).find(x=>x.character===f.character);assert(p.modules['social.intimacy']&&profile?.allowedCategories?.includes(CAT),`${at}: the night needs social.intimacy and ${CAT} allowed for her`);
    assert(f.interest===undefined||[...(profile.interests||[]),...(profile.stylePreferences||[]),...(profile.aftercarePreferences||[])].some(x=>x.id===f.interest),`${at}.interest: unknown`);}
   else assert(f.interest===undefined,`${at}.interest: only the night learns one`);
  }
 },
 init(){return {active:null,offers:[],completed:[],history:[]};},
 commands:{
  'social.startFirst'(tx,args){const s=tx.state.modules['social.firsts'],f=firstOf(tx.pack,args?.first);assert(f,'Unknown first');assert(!s.completed.includes(f.id),'That already happened');assert(!s.active,'Something else is already happening');
   const o=s.offers.find(x=>x.first===f.id);assert(o,'The moment is not here yet');assert(tx.state.tick>=o.after,'Give it a little time');assert(here(tx.state,tx.pack,f.character),`You need to be with ${tx.state.actors[f.character].name}`);
   assert(f.rung!=='night'||intimate(tx.state,f.character),'She has to want this too');begin(tx,f);},
  // One recorded command per typed turn: reads that turn's social.actPriced events (source = the talk turn id) and the typed text.
  'social.scoreFirst'(tx,args){const s=tx.state.modules['social.firsts'],a=s.active;assert(a,'No first is under way');assert(typeof args?.source==='string'&&args.source&&args.source.length<=100,'source required');if(a.sources.includes(args.source))return;
   const f=firstOf(tx.pack,a.first),c=f.character,typed=typeof args.text==='string'?args.text.slice(0,2000):String(tx.state.turns?.[args.source]?.command?.args?.text||'');
   const sources=[...a.sources,args.source].slice(-20),inputs=a.inputs+1,cp=FIRST_CHECKPOINTS[f.rung][a.checkpoint],acts=(tx.state.events||[]).filter(e=>e.type==='social.actPriced'&&e.payload.source===args.source&&e.payload.character===c).map(e=>e.payload);
   if(['kiss','night'].includes(f.rung)&&typedStop(typed))return stop(tx,f,'typed');
   const pushy=acts.find(x=>x.act.kind==='pushy');if(f.rung==='night'&&pushy){end(tx,f,'rejected',pushy.reason);applyEffects(tx,[{type:'satisfaction',character:c,delta:NIGHT.rush[0],reason:'you pushed'}]);if(intimate(tx.state,c))setIntimacyConsent(tx,c,CAT,'declined');return;}
   const bad=pushy||acts.find(x=>feel(tx.pack,c,x)==='disliked'),good=acts.find(x=>cp.want.includes(x.act.kind)&&(feel(tx.pack,c,x)==='liked'||cp.open&&feel(tx.pack,c,x)!=='disliked')),missed=a.verdicts.some(v=>v.verdict==='miss');
   let verdict=null,reason='';
   // The check-in is required: only asking her, or a yes to her own question, moves it. Stalling or skipping ahead never does.
   if(cp.required){const ask=acts.find(x=>x.act.kind==='ask'&&feel(tx.pack,c,x)!=='disliked');verdict=ask?'best':typedYes(typed)?'light':null;reason=ask?'you asked what she wanted':'you said yes';}
   else if(bad){verdict='miss';reason=bad.reason;}
   else if(good){verdict='best';reason=good.reason;}
   else if(inputs>=FIRST_INPUTS){verdict=cp.strict&&missed?'miss':'light';reason=verdict==='miss'?'the moment had already slipped':'it half-landed';}
   if(!verdict){tx.set([...path,'active'],{...a,inputs,sources});return;}
   const verdicts=[...a.verdicts,{checkpoint:cp.id,verdict,reason}],discover=verdict==='best'&&f.checkpoints[a.checkpoint].discover,pay=cp.pay&&NIGHT[cp.pay[verdict]];
   applyEffects(tx,[...(pay?[{type:'satisfaction',character:c,delta:pay[0],reason:'how the moment went'},...(pay[1]?[{type:'trust',character:c,delta:pay[1]}]:[])]:[]),...(cp.id==='lead'&&f.interest?[{type:'discoverIntimacyInterest',character:c,interest:f.interest}]:[]),...(discover?[{type:'discoverPreference',character:c,preference:discover}]:[])]);
   const next=a.checkpoint+1,more=next<f.checkpoints.length;
   tx.emit('social.firstCheckpoint',{first:f.id,character:c,checkpoint:cp.id,verdict,reason,...(more?{cue:f.checkpoints[next].cue}:{}),text:`${reason[0].toUpperCase()}${reason.slice(1)}.`},[tx.pack.playerId]);
   if(more)tx.set([...path,'active'],{...a,checkpoint:next,inputs:0,verdicts,sources});else complete(tx,f,verdicts);},
  'social.stopFirst'(tx){const a=tx.state.modules['social.firsts'].active;assert(a,'No first is under way');stop(tx,firstOf(tx.pack,a.first),'button');}
 },
 react(tx,event){const s=tx.state.modules['social.firsts'],a=s.active,live=a&&firstOf(tx.pack,a.first);
  if(live&&event.type==='core.sceneEnded'&&(event.payload.characters||[]).includes(live.character))return end(tx,live,'abandoned','the scene ended');
  if(live&&live.rung==='night'&&['social.consentWithdrawn','social.consentDeclined'].includes(event.type)&&event.payload.character===live.character&&event.payload.category===CAT)return end(tx,live,'stopped','consent');
  for(const f of tx.pack.firsts||[]){
   if(f.trigger.event!==event.type||Object.entries(f.trigger.match||{}).some(([k,v])=>event.payload[k]!==v)||tx.state.modules['social.firsts'].completed.includes(f.id)||tx.state.modules['social.firsts'].active?.first===f.id)continue;
   if(!tx.state.modules['social.firsts'].active&&ready(tx.state,tx.pack,f))begin(tx,f);else offer(tx,f);
  }
 },
 actions(s,p){const m=s.modules['social.firsts'];if(m.active)return [{label:STOP_LABEL,type:'social.stopFirst',args:{}}];
  return m.offers.map(o=>firstOf(p,o.first)).filter(f=>f&&s.tick>=m.offers.find(o=>o.first===f.id).after&&ready(s,p,f)).map(f=>({label:`${s.actors[f.character].name}: the moment's right`,type:'social.startFirst',args:{first:f.id}}));}
};
