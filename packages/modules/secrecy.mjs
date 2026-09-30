import {assert} from '../core/engine.mjs';
import {setDatingPhase,changeSatisfaction} from './dating.mjs';
import {changeStat} from './stats.mjs';

const path=['modules','social.secrecy'];
const DEFAULTS={curiousAt:30,confrontAt:70,decayPerTick:2,deadlineTicks:12};
const HARD_WEIGHT=45,SOFT_WEIGHT=15,REVEAL_WEIGHT=60;
const profileOf=(pack,character)=>(pack.datingProfiles||[]).find(x=>x.character===character);
const edgeOf=(state,character)=>state.modules['social.secrecy'].edges[character];
const presentNpcIds=(state,pack)=>pack.actors.filter(a=>a.id!==pack.playerId&&state.actors[a.id].location===state.actors[pack.playerId].location).map(a=>a.id);
const names=(state,ids)=>ids.map(id=>state.actors[id]?.name||id).join(', ');
const settingsOf=(pack,character)=>{const global=pack.suspicionSettings||{},profile=(pack.suspicionProfiles||[]).find(x=>x.character===character)||{};return {curiousAt:profile.curiousAt??global.curiousAt??DEFAULTS.curiousAt,confrontAt:profile.confrontAt??global.confrontAt??DEFAULTS.confrontAt,decayPerTick:profile.decayPerTick??global.decayPerTick??DEFAULTS.decayPerTick,deadlineTicks:profile.deadlineTicks??global.deadlineTicks??DEFAULTS.deadlineTicks};};
const datingEdge=(state,character)=>state.modules['social.dating']?.characters[character];
// Only a committed monogamous partner suspects; open/poly/casual edges are exempt by design.
const couldSuspect=(state,observer)=>{const edge=datingEdge(state,observer);return Boolean(edge&&['dating','exclusive'].includes(edge.phase)&&edge.agreement==='monogamous');};
const committedPartnerOf=(state,pack,exceptId)=>Object.entries(state.modules['social.dating']?.characters||{}).find(([id,x])=>id!==exceptId&&x.phase==='exclusive'&&x.agreement==='monogamous')?.[0]||null;
const STATUS_WORD={calm:'uneasy',pending:'wants to talk to you',watching:'watching you closely',admitted:'knows the truth',caught:'knows the truth'};

// Knowledge is channel-based: an edge being `public` means the pair stopped hiding it,
// not that everyone knows — only witnesses of the reveal (and later leaks) land in knownBy.
export function knowsAbout(state,character,viewer){const edge=state.modules['social.secrecy'].edges[character];return Boolean(edge&&edge.knownBy.includes(viewer));}
export function secrecyOf(state,character){return state.modules['social.secrecy'].edges[character]||null;}
export function suspicionOf(state,observer,subject){return state.modules['social.secrecy'].suspicions[observer]?.[subject]||null;}
export function evidenceOf(state,observer,subject){return (state.modules['social.secrecy'].evidence[observer]||[]).filter(x=>!subject||x.subject===subject);}
export function activeConfrontation(state,pack){return state.modules['social.secrecy'].confrontations[pack.playerId]||null;}
const STATUS_LINE={calm:'is uneasy around you',pending:'wants to talk to you',watching:'is watching you closely',admitted:'knows the truth',caught:'knows the truth'};
// Prompt-facing digests (M4.3): what a suspecting cast member shows, and the brief when a confrontation is live.
export function suspicionLinesFor(state,pack,cast){return cast.filter(id=>id!==pack.playerId).map(id=>{const susp=suspicionOf(state,id,pack.playerId);if(!susp)return null;const settings=settingsOf(pack,id);if(susp.score<settings.curiousAt)return null;return `${state.actors[id]?.name||id} ${STATUS_LINE[susp.status]||'is uneasy around you'}${susp.reasons.length?`: ${susp.reasons.slice(-2).join('; ')}`:''}`;}).filter(Boolean);}
export function confrontationFor(state,pack,cast){const con=activeConfrontation(state,pack);if(!con||!cast.includes(con.observer))return null;const evidence=evidenceOf(state,con.observer,pack.playerId);return {observer:con.observer,brief:`${state.actors[con.observer]?.name||con.observer} is demanding answers. Voice her accusations from this evidence only, never invent more: ${evidence.map(x=>x.summary).join('; ')||'she feels something is wrong but cannot prove it'}. Press her case and end expecting an answer.`};}
export function secrecyContext(state,pack,viewer){const edges=state.modules['social.secrecy'].edges,secrets=viewer===pack.playerId?Object.entries(edges).filter(([,edge])=>edge.visibility==='secret').map(([character,edge])=>({character,visibility:edge.visibility,knownBy:edge.knownBy})):Object.entries(edges).filter(([character,edge])=>character!==viewer&&edge.knownBy.includes(viewer)).map(([character,edge])=>({character,visibility:edge.visibility}));const suspicions=viewer!==pack.playerId?Object.entries(state.modules['social.secrecy'].suspicions[viewer]||{}).filter(([subject,susp])=>subject===pack.playerId&&susp.score>=settingsOf(pack,viewer).curiousAt&&['calm','pending','watching'].includes(susp.status)).map(([subject,susp])=>({subject,score:susp.score,status:susp.status,reasons:susp.reasons,evidence:evidenceOf(state,viewer,subject).map(x=>({summary:x.summary,strength:x.strength}))})):[];return {secrets,suspicions};}

function suspect(tx,observer,subject,strength,summary,sourceEvent,weight){
 if(observer===subject||!couldSuspect(tx.state,observer))return;
 const s=tx.state.modules['social.secrecy'];
 if((s.evidence[observer]||[]).some(x=>x.sourceEvent===sourceEvent&&x.subject===subject))return;
 const serial=s.serial+1;
 tx.set([...path,'serial'],serial);
 tx.set([...path,'evidence',observer],[...(s.evidence[observer]||[]),{id:`ev-${tx.state.revision}-${serial}`,subject,summary,strength,sourceEvent,tick:tx.state.tick}].slice(-20));
 const cur=s.suspicions[observer]?.[subject]||{score:0,status:'calm',deadlineTick:0,reasons:[]},settings=settingsOf(tx.pack,observer),score=Math.min(100,cur.score+weight),reasons=[...new Set([...cur.reasons,summary])].slice(-5);
 let status=cur.status,deadlineTick=cur.deadlineTick;
 if(['calm','watching'].includes(status)&&score>=settings.confrontAt){status='pending';deadlineTick=tx.state.tick+settings.deadlineTicks;}
 if(!s.suspicions[observer])tx.set([...path,'suspicions',observer],{});
 tx.set([...path,'suspicions',observer,subject],{score,status,deadlineTick,reasons});
 if(status==='pending'&&cur.status!=='pending')tx.emit('social.suspicionSurfaced',{observer,subject,deadlineTick,text:`${tx.state.actors[observer].name} is acting cold around you. She wants to talk.`},[tx.pack.playerId,observer]);
}

function ruleMatches(rule,event){return rule.event===event.type&&Object.entries(rule.match||{}).every(([key,value])=>event.payload[key]===value);}
function ruleSeeds(rule,event,pack){const ids=new Set(pack.actors.map(x=>x.id)),raw=rule.seedFrom==='visibility'?event.visibility:event.payload.witnesses||[];return [...new Set((Array.isArray(raw)?raw:[]).filter(x=>ids.has(x)))];}

function changeReputation(tx,slug,delta,reason){const rep=tx.pack.reputation;if(!rep||!delta||!tx.pack.modules['character.stats'])return;changeStat(tx,tx.pack.playerId,rep.stat,delta,reason);}

export const secrecy={id:'social.secrecy',version:'0.2.0',coreApi:'0.1.0',requires:['social.dating'],
 validate(p){
  const settings=p.suspicionSettings||{};for(const key of ['curiousAt','confrontAt'])assert(settings[key]===undefined||Number.isInteger(settings[key])&&settings[key]>=0&&settings[key]<=100,`suspicionSettings.${key} invalid`);
  assert((settings.confrontAt??DEFAULTS.confrontAt)>=(settings.curiousAt??DEFAULTS.curiousAt),'suspicionSettings: confrontAt must be >= curiousAt');
  for(const key of ['decayPerTick','deadlineTicks'])assert(settings[key]===undefined||Number.isInteger(settings[key])&&settings[key]>=1&&settings[key]<=1000,`suspicionSettings.${key} invalid`);
  const npcs=new Set(p.actors.filter(a=>a.id!==p.playerId).map(a=>a.id)),profiles=new Set((p.datingProfiles||[]).map(x=>x.character)),seen=new Set();
  assert(Array.isArray(p.initialSecrets||[]),'initialSecrets: expected an array');
  for(const secret of p.initialSecrets||[]){assert(npcs.has(secret.character)&&profiles.has(secret.character)&&!seen.has(secret.character),'initial secret needs a distinct dating-profile character');seen.add(secret.character);const known=secret.knownBy||[];assert(known.every(id=>npcs.has(id)&&id!==secret.character)&&new Set(known).size===known.length,'initial secret knownBy needs distinct NPC ids');}
  const suspicionProfiles=new Set();assert(Array.isArray(p.suspicionProfiles||[])&&(p.suspicionProfiles||[]).length<=30,'suspicionProfiles invalid');
  for(const profile of p.suspicionProfiles||[]){assert(npcs.has(profile.character)&&profiles.has(profile.character)&&!suspicionProfiles.has(profile.character),'suspicion profile needs a distinct dating-profile character');suspicionProfiles.add(profile.character);for(const key of ['curiousAt','confrontAt'])assert(profile[key]===undefined||Number.isInteger(profile[key])&&profile[key]>=0&&profile[key]<=100,`suspicionProfiles.${key} invalid`);assert((profile.confrontAt??settings.confrontAt??DEFAULTS.confrontAt)>=(profile.curiousAt??settings.curiousAt??DEFAULTS.curiousAt),'suspicion profile: confrontAt must be >= curiousAt');for(const key of ['decayPerTick','deadlineTicks'])assert(profile[key]===undefined||Number.isInteger(profile[key])&&profile[key]>=1&&profile[key]<=1000,`suspicionProfiles.${key} invalid`);}
  const rules=new Set();assert(Array.isArray(p.suspicionRules||[])&&(p.suspicionRules||[]).length<=30,'suspicionRules: expected up to 30 rules');
  const rep=p.reputation;if(rep!==undefined){assert(rep&&typeof rep==='object'&&!Array.isArray(rep)&&typeof rep.stat==='string'&&rep.stat.trim()&&rep.stat.length<=40,'reputation config invalid');for(const key of ['perPublicReveal','perCaught'])assert(rep[key]===undefined||Number.isInteger(rep[key])&&Math.abs(rep[key])<=100,`reputation.${key} invalid`);}
  for(const rule of p.suspicionRules||[]){assert(typeof rule.id==='string'&&/^[a-z][a-z0-9-]*$/.test(rule.id)&&!rules.has(rule.id),'suspicion rule ID invalid or duplicate');rules.add(rule.id);assert(typeof rule.event==='string'&&rule.event&&!['core.patch','core.timeAdvanced','social.suspicionSurfaced','social.secretCaught','social.secretWatched','social.confrontationStarted','social.confrontationResolved'].includes(rule.event),'suspicion rule event invalid');assert(Number.isInteger(rule.weight)&&rule.weight>=1&&rule.weight<=100,'suspicion rule weight invalid');assert(typeof rule.summary==='string'&&rule.summary.trim()&&rule.summary.length<=300,'suspicion rule summary invalid');assert(['hard','soft'].includes(rule.strength||'soft'),'suspicion rule strength invalid');assert(['witnesses','visibility'].includes(rule.seedFrom||'witnesses'),'suspicion rule seed source invalid');assert(rule.match===undefined||rule.match&&typeof rule.match==='object'&&!Array.isArray(rule.match),'suspicion rule match invalid');assert(rule.subjectKey===undefined||typeof rule.subjectKey==='string'&&rule.subjectKey.length<=40,'suspicion rule subject key invalid');}
 },
 init(p){return {edges:Object.fromEntries((p.initialSecrets||[]).map(x=>[x.character,{visibility:'secret',knownBy:[...(x.knownBy||[])],sinceTick:0}])),suspicions:{},evidence:{},confrontations:{},serial:0};},
 commands:{
  'social.keepSecret'(tx,args){const profile=profileOf(tx.pack,args.character),runtime=tx.state.modules['social.dating'].characters[args.character];assert(profile&&runtime,'Unknown dating character');assert(tx.state.actors[args.character].location===tx.state.actors[tx.pack.playerId].location,'You must be together for this conversation');assert(['dating','exclusive'].includes(runtime.phase),'You need to be in a relationship first');const current=edgeOf(tx.state,args.character);assert(!current||current.visibility!=='secret','Your relationship is already a secret');const known=current?current.knownBy:[];tx.set([...path,'edges',args.character],{visibility:'secret',knownBy:known,sinceTick:tx.state.tick});tx.emit('social.relationshipHidden',{character:args.character,text:`You and ${tx.state.actors[args.character].name} agree to keep your relationship secret.`},[tx.pack.playerId,args.character]);},
  'social.revealRelationship'(tx,args){const edge=edgeOf(tx.state,args.character);assert(edge&&edge.visibility==='secret','Your relationship is not a secret');assert(tx.state.actors[args.character].location===tx.state.actors[tx.pack.playerId].location,'You must be together to go public');const witnesses=presentNpcIds(tx.state,tx.pack).filter(id=>id!==args.character),knownBy=[...new Set([...edge.knownBy,...witnesses])];tx.set([...path,'edges',args.character],{visibility:'public',knownBy,sinceTick:edge.sinceTick});tx.emit('social.relationshipRevealed',{character:args.character,witnesses,text:`You and ${tx.state.actors[args.character].name} stop hiding your relationship.`},[tx.pack.playerId,args.character,...witnesses]);},
  'social.confront'(tx,args){const settings=settingsOf(tx.pack,args.character),susp=tx.state.modules['social.secrecy'].suspicions[args.character]?.[tx.pack.playerId];assert(susp&&susp.score>=settings.curiousAt&&['pending','watching'].includes(susp.status),'She has nothing to confront you about right now');assert(tx.state.actors[args.character].location===tx.state.actors[tx.pack.playerId].location,'You must be together to have this conversation');const evidence=evidenceOf(tx.state,args.character,tx.pack.playerId);tx.set([...path,'confrontations',tx.pack.playerId],{observer:args.character,openedTick:tx.state.tick,evidence:evidence.map(x=>x.id)});tx.emit('social.confrontationStarted',{observer:args.character,evidence:evidence.map(x=>({summary:x.summary,strength:x.strength})),text:`${tx.state.actors[args.character].name} finally asks you about it.`},[tx.pack.playerId,args.character]);},
  'social.resolveConfrontation'(tx,args){const con=tx.state.modules['social.secrecy'].confrontations[tx.pack.playerId];assert(con&&con.observer===args.character,'No active confrontation with this character');assert(['admit','deny','deflect','apologize'].includes(args.stance),'Unknown claim');assert(tx.state.actors[args.character].location===tx.state.actors[tx.pack.playerId].location,'You must be together to finish this conversation');const s=tx.state.modules['social.secrecy'],settings=settingsOf(tx.pack,args.character),susp=s.suspicions[args.character][tx.pack.playerId],hard=(s.evidence[args.character]||[]).some(x=>x.subject===tx.pack.playerId&&x.strength==='hard');
   let outcome,delta,score=susp.score,status=susp.status,deadlineTick=susp.deadlineTick,reason;
   if(args.stance==='deny'&&hard){outcome='caught';delta=-30;reason='she had seen it herself';status='pending';deadlineTick=tx.state.tick+settings.deadlineTicks;}
   else if(args.stance==='deny'){outcome='talkedDown';delta=-5;reason='your story held together';score=Math.max(0,score-40);status=score>=settings.confrontAt?'pending':'watching';deadlineTick=status==='pending'?tx.state.tick+settings.deadlineTicks:deadlineTick;}
   else if(args.stance==='admit'||args.stance==='apologize'){outcome='admitted';delta=hard?-25:-15;reason=args.stance==='admit'?'you came clean':'you said you were sorry';score=0;status='admitted';deadlineTick=0;}
   else{outcome='deflected';delta=-3;reason='you changed the subject';score=Math.max(0,score-10);}
   tx.set([...path,'suspicions',args.character,tx.pack.playerId],{score,status,deadlineTick,reasons:susp.reasons});
   tx.set([...path,'confrontations',tx.pack.playerId],null);
   if(delta)changeSatisfaction(tx,args.character,delta,reason);
   tx.emit('social.confrontationResolved',{observer:args.character,stance:args.stance,outcome,delta,text:{caught:`${tx.state.actors[args.character].name} does not believe a word: she saw it herself.`,talkedDown:`${tx.state.actors[args.character].name} accepts your story, though doubt lingers.`,admitted:`${tx.state.actors[args.character].name} takes a long breath. At least you were honest.`,deflected:`${tx.state.actors[args.character].name} lets the subject drop, unpersuaded.`}[outcome]},[tx.pack.playerId,args.character]);}
 },
 react(tx,event){
  const s=tx.state.modules['social.secrecy'];
  if(event.type==='social.dateAccepted'||event.type==='social.relationshipAgreementChanged'&&event.payload.to==='monogamous'){
   const character=event.payload.character,competitor=committedPartnerOf(tx.state,tx.pack,character),edge=edgeOf(tx.state,character);
   if(competitor&&(!edge||edge.visibility!=='secret')){tx.set([...path,'edges',character],{visibility:'secret',knownBy:[],sinceTick:tx.state.tick});tx.emit('social.affairStarted',{character,partner:competitor,text:`You and ${tx.state.actors[character].name} both understand this stays quiet — you are committed to ${tx.state.actors[competitor].name}.`},[tx.pack.playerId,character]);}
   return;
  }
  if(event.type==='social.relationshipRevealed'){const partner=committedPartnerOf(tx.state,tx.pack,event.payload.character);if(partner)suspect(tx,partner,tx.pack.playerId,'hard',`you introduced ${tx.state.actors[event.payload.character].name} as your partner`,event.id,REVEAL_WEIGHT);if(event.payload.witnesses?.length)changeReputation(tx,'reveal',tx.pack.reputation?.perPublicReveal??2,'a public relationship reveal');return;}
  if(event.type==='social.intimacyExposed'){for(const witness of event.payload.witnesses||[])if(witness!==event.payload.character)suspect(tx,witness,tx.pack.playerId,'hard',`saw you and ${tx.state.actors[event.payload.character].name}: ${event.payload.category}`,event.id,HARD_WEIGHT);return;}
  if(event.type==='social.rumorBelieved'){const{subject,character,summary}=event.payload;if(subject===tx.pack.playerId)suspect(tx,character,tx.pack.playerId,'soft',`heard that ${summary}`,event.id,SOFT_WEIGHT);return;}
  if(event.type==='core.timeAdvanced'){
   const elapsed=event.payload.to-event.payload.from;
   for(const [observer,subjects] of Object.entries(s.suspicions))for(const [subject,susp] of Object.entries(subjects)){
    if(!['calm','pending','watching'].includes(susp.status))continue;
    const settings=settingsOf(tx.pack,observer);let{score,status,deadlineTick}=susp;
    if(status==='pending'&&event.payload.to>=deadlineTick){
     const hard=(s.evidence[observer]||[]).some(x=>x.subject===subject&&x.strength==='hard');
     if(hard){setDatingPhase(tx,observer,'broken','she found out',profileOf(tx.pack,observer)?.maintenance?.breakupCooldown||0);tx.emit('social.secretCaught',{observer,subject,outcome:'breakup',text:`${tx.state.actors[observer].name} found out. It is over.`},[tx.pack.playerId,observer]);changeReputation(tx,'caught',tx.pack.reputation?.perCaught??-10,'caught hiding a relationship');status='resolved';}
     else{changeSatisfaction(tx,observer,-20,'she suspects something');tx.emit('social.secretWatched',{observer,subject,text:`${tx.state.actors[observer].name} gives you a look that says she knows something. The moment passes, badly.`},[tx.pack.playerId,observer]);status='watching';deadlineTick=event.payload.to+settings.deadlineTicks;}
    }
    score=Math.max(0,score-settings.decayPerTick*elapsed);
    if(['pending','watching'].includes(status)&&score<settings.curiousAt)status='calm';
    tx.set([...path,'suspicions',observer,subject],{score,status,deadlineTick,reasons:susp.reasons});
   }
   return;
  }
  for(const rule of tx.pack.suspicionRules||[]){
   if(!ruleMatches(rule,event))continue;
   const seeds=ruleSeeds(rule,event,tx.pack);if(!seeds.length)continue;
   const subject=rule.subjectKey?event.payload[rule.subjectKey]??tx.pack.playerId:tx.pack.playerId,summary=rule.summary.replace(/\{(\w+)\}/g,(m,k)=>typeof event.payload[k]==='string'?event.payload[k]:m),weight=rule.weight,strength=rule.strength||'soft';
   for(const observer of seeds)suspect(tx,observer,subject,strength,summary,event.id,weight);
  }
 },
 actions(s,p){
  const out=[];
  for(const profile of p.datingProfiles||[]){
   const runtime=s.modules['social.dating'].characters[profile.character],edge=edgeOf(s,profile.character);
   if(!runtime||!['dating','exclusive'].includes(runtime.phase)||s.actors[profile.character].location!==s.actors[p.playerId].location)continue;
   if(!edge||edge.visibility!=='secret')out.push({label:`Keep your relationship with ${s.actors[profile.character].name} secret`,type:'social.keepSecret',args:{character:profile.character}});
   else out.push({label:`Stop hiding your relationship with ${s.actors[profile.character].name}`,type:'social.revealRelationship',args:{character:profile.character}});
  }
  for(const [observer,subjects] of Object.entries(s.modules['social.secrecy'].suspicions)){
   const susp=subjects[p.playerId],settings=settingsOf(p,observer);
   if(!susp||!['pending','watching'].includes(susp.status)||susp.score<settings.curiousAt||s.actors[observer].location!==s.actors[p.playerId].location)continue;
   out.push({label:`${s.actors[observer].name} wants to talk. Now.`,type:'social.confront',args:{character:observer}});
  }
  return out;
 },
 panel(s,p){
  const lines=Object.entries(s.modules['social.secrecy'].edges).filter(([,edge])=>edge.visibility==='secret').map(([character,edge])=>`${s.actors[character].name}: secret · known by ${edge.knownBy.length?names(s,edge.knownBy):'nobody'}`);
  for(const [observer,subjects] of Object.entries(s.modules['social.secrecy'].suspicions)){const word=STATUS_WORD[subjects[p.playerId]?.status];if(word)lines.push(`${s.actors[observer].name}: ${word}`);}
  return {title:'Secrets',lines};
 }
};
