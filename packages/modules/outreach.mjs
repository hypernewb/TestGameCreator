import {assert,safeKey} from '../core/engine.mjs';
import {calendarFor} from '../../public/calendar.mjs';
import {deliver} from './phone.mjs';
import {addPoints} from './romance-tempo.mjs';
import {changeTrust} from './romance-stats.mjs';

// She texts first: one authored line per kind, dropped into the ordinary phone thread at a daypart boundary.
// The engine owns the chance, the contact clock and the small texting budget; the model only narrates the reply.
const path=['modules','social.outreach'];
const KINDS=['check-in','plan','tease','neglected','strain'];
export const OUTREACH={stageChance:{acquaintance:0.1,dating:0.35,exclusive:0.55},likeScale:1,maxPerDay:2,neglectDays:2,teaseLikeThreshold:40,replyLike:1,replyTrust:1,replyLikeCap:2,ignoredLike:-1};
export const outreachSettings=p=>{const o=p.outreachSettings;return o?{...OUTREACH,...o,stageChance:{...OUTREACH.stageChance,...(o.stageChance||{})}}:null;};
const heroines=p=>(p.datingProfiles||[]).map(x=>x.character).filter(id=>(p.phoneContacts||[]).includes(id));
const unit=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0)/4294967296;};
const stageOf=(s,p,id)=>{const r=s.modules['social.dating']?.characters?.[id];return r?.stage||(['dating','exclusive'].includes(r?.phase)?r.phase:'acquaintance');};
const likeOf=(s,id)=>s.modules['social.romance-tempo']?.characters?.[id]?.points||0;
const lustOf=(s,id)=>s.modules['social.touch-ladder']?.characters?.[id]?.lust||0;
const textsOf=(p,kind,id)=>(p.outreachMessages||[]).filter(t=>t.kind===kind&&t.character===id);
const pendingOffer=(s,id)=>Object.values(s.modules['social.phone'].threads).flat().some(x=>x.character===id&&x.offer?.status==='pending'&&x.offer.expiresTick>=s.tick);
// Strain outranks neglect, neglect outranks a tease, and a plan only rides along when no other text is waiting.
function kindFor(s,p,id,r,day,cfg){const dating=s.modules['social.dating']?.characters?.[id]||{},has=k=>textsOf(p,k,id).length>0;
 if(dating.strained&&has('strain'))return'strain';
 if(['dating','exclusive'].includes(stageOf(s,p,id))&&day-(r.contactDay??0)>=cfg.neglectDays&&has('neglected'))return'neglected';
 if(lustOf(s,id)>=cfg.teaseLikeThreshold&&has('tease'))return'tease';
 if(!pendingOffer(s,id)&&has('plan'))return'plan';
 return has('check-in')?'check-in':null;}

function send(tx,slot){const {pack:p,state:s}=tx,cfg=outreachSettings(p),day=calendarFor(s.tick,p).day,phone=s.modules['social.phone'];
 for(const id of heroines(p)){const r=s.modules['social.outreach'].characters[id],sent=r.sent?.day===day?r.sent.count:0;
  if(sent>=cfg.maxPerDay)continue;
  // Still ignored a whole day after the neglected text: one Like, once.
  if(r.ignoredDay!=null&&day>r.ignoredDay&&(r.contactDay??0)<=r.ignoredDay){addPoints(tx,id,cfg.ignoredLike,'neglected text');tx.set([...path,'characters',id,'ignoredDay'],null);}
  const chance=Math.max(0,Math.min(1,cfg.stageChance[stageOf(s,p,id)]*(1+likeOf(s,id)/100*cfg.likeScale)));
  if(unit(`${s.initialSeed}:${day}:${slot}:${id}:${sent}`)>=chance)continue;
  const kind=kindFor(s,p,id,r,day,cfg);if(!kind)continue;
  const pool=textsOf(p,kind,id),text=pool[sent%pool.length],message=`${text.id}.d${day}s${slot}n${sent}`;
  if(phone.delivered.includes(message))continue;
  deliver(tx,{id:message,character:id,text:text.text.replace(/\{name\}/g,s.actors[id].name),...(text.offer?{offer:text.offer}:{}),template:text.id,kind});
  tx.set([...path,'characters',id,'sent'],{day,count:sent+1});
  tx.set([...path,'characters',id,'lastKind'],kind);
  if(kind==='neglected'&&r.ignoredDay==null)tx.set([...path,'characters',id,'ignoredDay'],day);}}

// A reply is the one normal turn: it banks contact, settles the plan she is waiting on, and spends the daily texting budget.
function replied(tx,event){const {pack:p,state:s}=tx,cfg=outreachSettings(p),id=event.payload.character,thread=s.modules['social.phone'].threads[id]||[],entry=thread.find(x=>x.id===event.payload.message);
 if(!(p.outreachMessages||[]).some(t=>t.id===entry?.template))return;
 const day=calendarFor(s.tick,p).day,r=s.modules['social.outreach'].characters[id];
 tx.set([...path,'characters',id,'contactDay'],day);
 if(entry.offer?.status==='pending'){tx.set(['modules','social.phone','threads',id],thread.map(x=>x.id===entry.id?{...x,offer:{...x.offer,status:'accepted'}}:x));
  tx.emit('social.outreachPlanAccepted',{character:id,message:entry.id,location:entry.offer.location,kind:'plan',text:`${s.actors[id].name} waits for you at ${p.locations.find(l=>l.id===entry.offer.location)?.name||entry.offer.location}.`},[p.playerId,id]);}
 const used=r.gained?.day===day?r.gained.amount:0,budget=Math.max(0,cfg.replyLikeCap-used);let spent=0;
 if(cfg.replyLike>0)spent+=Math.max(0,addPoints(tx,id,Math.min(cfg.replyLike,budget),'texting'));
 if(cfg.replyTrust>0)spent+=Math.max(0,changeTrust(tx,id,Math.min(cfg.replyTrust,budget-spent),{quiet:true}));
 if(spent)tx.set([...path,'characters',id,'gained'],{day,amount:used+spent});}

export const outreach={id:'social.outreach',version:'0.1.0',coreApi:'0.1.0',requires:['social.phone','social.dating','social.romance-tempo'],
 validate(p){const o=p.outreachSettings;if(o===undefined)return;
  assert(o&&typeof o==='object'&&!Array.isArray(o),'outreachSettings: expected object');
  const cfg=outreachSettings(p),stages=cfg.stageChance;
  assert(stages&&typeof stages==='object'&&!Array.isArray(stages),'outreachSettings.stageChance: expected object');
  for(const [stage,value] of Object.entries(stages))assert(['acquaintance','dating','exclusive'].includes(stage)&&Number.isFinite(value)&&value>=0&&value<=1,`outreachSettings.stageChance.${stage}: expected 0–1`);
  assert(['acquaintance','dating','exclusive'].every(s=>stages[s]!==undefined),'outreachSettings.stageChance: acquaintance, dating and exclusive are required');
  assert(Number.isFinite(cfg.likeScale)&&cfg.likeScale>=0&&cfg.likeScale<=5,'outreachSettings.likeScale: expected 0–5');
  assert(Number.isInteger(cfg.maxPerDay)&&cfg.maxPerDay>=0&&cfg.maxPerDay<=10,'outreachSettings.maxPerDay: expected 0–10');
  assert(Number.isInteger(cfg.neglectDays)&&cfg.neglectDays>=0&&cfg.neglectDays<=30,'outreachSettings.neglectDays: expected 0–30');
  assert(Number.isInteger(cfg.teaseLust)&&cfg.teaseLust>=0&&cfg.teaseLust<=100,'outreachSettings.teaseLust: expected 0–100');
  assert(Number.isInteger(cfg.replyLike)&&cfg.replyLike>=0&&cfg.replyLike<=10,'outreachSettings.replyLike: expected 0–10');
  assert(Number.isInteger(cfg.replyTrust)&&cfg.replyTrust>=0&&cfg.replyTrust<=10,'outreachSettings.replyTrust: expected 0–10');
  assert(Number.isInteger(cfg.replyLikeCap)&&cfg.replyLikeCap>=0&&cfg.replyLikeCap<=100,'outreachSettings.replyLikeCap: expected 0–100');
  assert(Number.isInteger(cfg.ignoredLike)&&cfg.ignoredLike<=0&&cfg.ignoredLike>=-100,'outreachSettings.ignoredLike: expected −100–0');
  assert(Array.isArray(p.outreachMessages)&&p.outreachMessages.length>0&&p.outreachMessages.length<=200,'outreachMessages: expected 1–200');
  const contacts=new Set(p.phoneContacts||[]),dating=new Set((p.datingProfiles||[]).map(x=>x.character)),locations=new Set(p.locations.map(x=>x.id)),ids=new Set();
  for(const t of p.outreachMessages){const label=`outreach text ${t.id}`;
   assert(safeKey(t.id)&&!ids.has(t.id),`${label}: invalid or duplicate ID`);ids.add(t.id);
   assert(KINDS.includes(t.kind),`${label}.kind: ${KINDS.join(', ')}`);
   assert(contacts.has(t.character)&&dating.has(t.character),`${label}.character: needs a phone contact with a dating profile`);
   assert(typeof t.text==='string'&&t.text.trim()&&t.text.length<=400,`${label}.text: 1–400 characters`);
   assert(Array.isArray(t.replies)&&t.replies.length>0&&t.replies.length<=10,`${label}.replies: expected 1–10`);
   const replies=new Set();for(const reply of t.replies){assert(safeKey(reply.id)&&!replies.has(reply.id)&&typeof reply.text==='string'&&reply.text.trim()&&reply.text.length<=200,`${label}.replies: invalid reply`);replies.add(reply.id);}
   if(t.offer!==undefined)assert(t.offer&&locations.has(t.offer.location)&&Number.isInteger(t.offer.expiresIn)&&t.offer.expiresIn>0&&t.offer.expiresIn<=10000,`${label}.offer: needs a location and an expiry in ticks`);}},
 // Contact starts at the opening day, so neglect measures real silence rather than the game's first hours.
 init:(p,{tick=0})=>({characters:Object.fromEntries(heroines(p).map(id=>[id,{sent:{day:calendarFor(tick,p).day,count:0},contactDay:calendarFor(tick,p).day,ignoredDay:null,gained:null,lastKind:null}]))}),
 react(tx,event){if(!outreachSettings(tx.pack))return;
  if(event.type==='social.messageReplied'){replied(tx,event);return;}
  if(event.type==='social.phoneOfferAccepted'||event.type==='core.sceneStarted'){const day=calendarFor(tx.state.tick,tx.pack).day;
   for(const id of new Set([...(event.payload.characters||[]),event.payload.character].filter(x=>x&&tx.state.modules['social.outreach'].characters[x])))tx.set([...path,'characters',id,'contactDay'],day);
   return;}
  if(event.type!=='core.timeAdvanced')return;
  const interval=tx.pack.daypart?.interval||4;
  for(let slot=Math.floor(event.payload.from/interval)+1;slot<=Math.floor(event.payload.to/interval);slot++)send(tx,slot);},
 actions(){return [];},
 panel(s,p){const cfg=outreachSettings(p);if(!cfg)return {title:'Outreach',lines:[]};const day=calendarFor(s.tick,p).day;
  return {title:'Outreach',lines:heroines(p).map(id=>{const r=s.modules['social.outreach'].characters[id];return `${s.actors[id].name}: ${r.sent?.day===day?r.sent.count:0}/${cfg.maxPerDay} texts today · ${r.lastKind||'quiet'}${r.contactDay==null||day-r.contactDay>=cfg.neglectDays?' · no contact':''}`;})};}
};