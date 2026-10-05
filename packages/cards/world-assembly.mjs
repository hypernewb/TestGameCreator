// M2 assembler: a world spec (world data + one short spec per love interest) -> a playable pack. The structure comes from the beat
// library; the spec only fills text slots. Anything left blank becomes a visible [[slot]] placeholder and is listed in `missing`.
import {withDirector} from './director-library.mjs';
import {TEMPERAMENTS,PACES,SHARED_ACTS,RANK_POINTS,THRESHOLDS,WANT_WEIGHTS,INTIMACY_CATEGORIES,RUNGS,FIRST_CHECKPOINTS,TONES,NIGHT,STOP_LABEL,STOP_TRUST,ENDING_PRIORITY,slug,idOf,AI_GUIDANCE,DEFAULT_CHOICE_TONES} from './beat-library.mjs';

const MODULES=['social.conversation','social.relationships','world.schedule','items.inventory','world.economy','character.stats','world.calendar','world.moments','social.dating','social.romance-tempo','social.intimacy','social.acts','character.arc','character.sobriety','social.phone','story.endings','story.scenes'];
const VERSIONS={'items.inventory':'0.2.0','world.economy':'0.2.0','social.romance-tempo':'0.2.0'};
const assert=(ok,msg)=>{if(!ok)throw new Error(`world spec: ${msg}`);};

// improvise: save an unfinished world. An authored first or director beat with blanks can't be played as written, so the first turns free
// (typed; the AI improvises it around the code-held checkpoints) and the beat is left out; other blanks get a plain name or stay empty for the AI to improvise.
export function assemble(spec,{improvise=false}={}){
 if(!improvise)return build(spec);const first=build(spec);if(!first.missing.length)return {...first,improvised:[]};
 const s=structuredClone(spec),skip=new Set();for(const p of first.missing){const r=p.match(/^heroines\.([^.]+)\.rungs\.(talk|date|kiss|night)\./),b=p.match(/^director\.beats\.([^.]+)\./);
  if(r){const x=s.heroines.find(h=>h.id===r[1]);x.rungs||={};x.rungs[r[2]]={...x.rungs[r[2]],mode:'free'};}if(b)skip.add(b[1]);}
 const improvised=[],text=(v,path)=>typeof v==='string'&&v.trim()?v:(improvised.push(path),fallbackText(s,path));return {...build(s,text,skip),missing:[],improvised};
}
const RANK_NAMES=['Stranger','Acquaintance','Friend','Close'],STAGE_NAMES=['Guarded','Warming up','Open'],FIRST_TITLES={talk:'A real talk',date:'First date',kiss:'First kiss',night:'First night'};
const FIRST_OPENINGS={talk:n=>`${n} sets down what they were doing and actually looks at you.`,date:n=>`${n} is already there, and smiles when they see you.`,kiss:n=>`${n} goes quiet, standing closer than before.`,night:n=>`${n} doesn't let go of your hand.`};
const CUES={'opening-up':'they start to say something that matters to them','your-turn':'they turn it back on you','arrival':'the first look when you meet','noticing':'they notice something about you','moment':'a pause where something could happen','reading':'they read your face','leaning-in':'the distance closes','after':'right after','lead':'who moves first','check-in':'asking if this is what you both want','peak':'everything slows down'};
const REASONS={topic:'you got them talking about something they love',looks:'a compliment that missed',sore:'you touched a sore spot',listen:'you really listened',tease:'you teased them','tease-public':'you teased them in front of people',pushy:'you pushed too hard',invite:'you asked them out'};
function fallbackText(spec,path){
 const h=path.match(/^heroines\.([^.]+)\.(.*)$/),name=h&&(spec.heroines.find(x=>x.id===h[1])?.actor?.name?.trim()||h[1].replace(/^./,c=>c.toUpperCase())),rel=h?.[2]||path;let m;
 if(path==='title')return 'Untitled world';if(path==='fallback.name')return 'The end of the story';if(path==='fallback.text')return 'This chapter of your life comes to a close.';
 if(m=rel.match(/^ranks\.(\d)$/))return RANK_NAMES[m[1]];if(m=rel.match(/^stages\.(\d)\.name$/))return STAGE_NAMES[m[1]];if(m=rel.match(/^rungs\.(\w+)\.title$/))return FIRST_TITLES[m[1]];
 if(rel==='actor.name')return name;if(rel==='endings.route.name')return `${name}'s route`;if(rel==='endings.together.name')return `Together with ${name}`;if(/^endings\.\w+\.text$/.test(rel))return `You and ${name} found where you stand with each other.`;
 if(m=rel.match(/^reasons\.(.+)$/))return REASONS[m[1]]||'something you did';if(/^harp\.\d+$/.test(rel))return 'you kept on about something they dislike';if(rel==='interest.label')return 'something to find out together';
 if(m=rel.match(/^rungs\.(\w+)\.opening$/))return FIRST_OPENINGS[m[1]]?.(name)||'';if(m=rel.match(/^rungs\.\w+\.checkpoints\.([\w-]+)(\.cue)?$/))return CUES[m[1]]||'the moment shifts';
 return '';
}
function build(spec,text,skip){
 const missing=[];text||=(v,path)=>typeof v==='string'&&v.trim()?v:(missing.push(path),`[[${path}]]`);
 const w=spec.world||{},hs=spec.heroines||[];assert(hs.length>=1&&hs.length<=6,'1–6 love interests');assert(!w.firsts||w.firsts==='free'||w.firsts==='authored','world.firsts: must be "free" or "authored"');
 const run={days:spec.days||28,defaultEnding:spec.fallback?.id||'run-ends'},overFlag=spec.fallback?.flag||'run-over';
 const parts=hs.map(h=>heroine(h,spec,text));
 const firsts=parts.flatMap(x=>x.firsts);
 const cast=[{id:'player',name:'You',pronouns:'you',location:w.locations?.[0]?.id,...spec.player,identityTags:['adult']},...parts.map(x=>x.actor),...(spec.friends||[]).map(f=>({...f,identityTags:['adult']}))];
 for(const a of cast)assert(Number.isInteger(a.age)&&a.age>=18,`${a.id}: every character is an adult with an age`);
 const modules=spec.modules||Object.fromEntries(MODULES.filter(m=>m!=='character.sobriety'||w.sobriety).filter(m=>m!=='social.phone'||w.phoneContacts?.length).map(m=>[m,VERSIONS[m]||'0.1.0']).concat(firsts.length?[['social.firsts','0.1.0']]:[]));
 const pack={schemaVersion:1,id:spec.id,version:spec.version||'0.1.0',title:text(spec.title,'title'),...(spec.subtitle?{subtitle:spec.subtitle}:{}),playerId:'player',
  calendar:w.calendar||{},romanceStats:w.romanceStats||{dailyGain:6},modules,gameProject:{presentation:'visual-novel',conversationStyle:'continuous',sceneBudget:4,...spec.project,ai:{...AI_GUIDANCE,...spec.project?.ai},premise:text(spec.project?.premise,'project.premise'),setting:text(spec.project?.setting,'project.setting')},run,
  locations:w.locations||[],actors:cast,initialRelationships:[...parts.map(x=>x.relationship),...(w.initialRelationships||[])],
  statDefinitions:w.statDefinitions||[],initialStats:w.initialStats||[],items:w.items||[],activities:w.activities||[],schedules:w.schedules||[],initialMoney:w.initialMoney??50,economySettings:w.economySettings||{debtLimit:10},
  datingProfiles:parts.map(x=>x.dating),romanceTempoProfiles:parts.map(x=>x.tempo),actProfiles:parts.map(x=>x.acts),arcTracks:parts.map(x=>x.arc),
  ...(w.sobriety?{sobriety:w.sobriety}:{}),
  intimacySettings:{difficulty:'normal',contentLevel:w.contentLevel||'explicit',privateLocations:w.privateLocations||[w.locations?.[0]?.id],aftercareWindow:2,aftercareOptions:w.aftercareOptions||[{id:'stay',name:'Ask her to stay'},{id:'talk',name:'Lie there and talk'},{id:'space',name:'Give her some space'}]},
  intimacyCategories:INTIMACY_CATEGORIES,intimacyProfiles:parts.map(x=>x.intimacy),
  ...(w.phoneContacts?.length?{phoneContacts:w.phoneContacts,phoneMessages:w.phoneMessages||[]}:{}),
  momentsProfile:w.momentsProfile||{chancePercent:25,dryStepPercent:15,perDay:3,cooldown:12,generate:false},moments:w.moments||[],
  endings:[...parts.flatMap(x=>x.endings),{id:run.defaultEnding,name:text(spec.fallback?.name,'fallback.name'),priority:ENDING_PRIORITY.fallback,requires:{flags:{[overFlag]:true}},text:text(spec.fallback?.text,'fallback.text')}],
  scriptedScenes:parts.flatMap(x=>x.scenes),...(firsts.length?{firsts}:{})};
 // M3: the director library over every love interest; its text slots go through the same blank-tracking filler.
 return {pack:spec.director?withDirector(pack,{beats:spec.director.beats,tone:spec.director.tone,text,skip}):pack,missing};
}

function heroine(h,spec,text){
 const itemName=id=>spec.world?.items?.find(i=>i.id===id)?.name||id,c=h.id,T=TEMPERAMENTS[h.temperament],P=PACES[h.pace],trust0=h.trust??T?.initial.trust,at=p=>`heroines.${c}.${p}`;assert(safe(c),`bad id ${c}`);assert(T,`${c}: temperament must be one of ${Object.keys(TEMPERAMENTS)}`);assert(P,`${c}: pace must be one of ${Object.keys(PACES)}`);
 const topic=slug(h.topic||''),looks=slug(h.looks||'looks'),quirk=h.quirk&&slug(h.quirk),invite=h.invite||'*',gifts=h.gifts||{};assert(topic,`${c}: needs a topic she loves to talk about`);
 const fill=t=>t==='{topic}'?topic:t==='{looks}'?looks:t==='{quirk}'?quirk:t==='{invite}'?invite:t==='{gift}'?gifts.loved:t==='{buy}'?h.buy:t==='{badGift}'?gifts.disliked:t;
 const ranks=[0,1,2,3].map(i=>{const name=text(h.ranks?.[i],at(`ranks.${i}`));return {id:idOf(h.rankIds?.[i]||name)||`rank-${i}`,name,points:RANK_POINTS[i][0],ceiling:RANK_POINTS[i][1]};});
 const stages=[0,1,2].map(i=>{const s=h.stages?.[i]||{},name=text(s.name,at(`stages.${i}.name`));return {id:s.id||idOf(name)||`stage-${i}`,name,...(i?{when:{[T.second]:T.gates[i-1].second,trust:trust0+T.gates[i-1].trust}}:{}),voice:text(s.voice,at(`stages.${i}.voice`))};});
 const arcFlag=h.arcFlag||`${c}-${stages[2].id}`;stages[2].flag=arcFlag;
 const wants=(h.wants||[]).slice(0,3).map((x,i)=>({id:`${c}-${x.id||x.stat}`,type:'stat',stat:x.stat,min:x.min,weight:x.turnoff?-5:WANT_WEIGHTS[i],visibility:x.visibility||['discoverable','public','private'][i]}));
 if(T.wantsHerCall)wants.push({id:arcFlag,type:'flag',flag:arcFlag,value:true,weight:T.wantsHerCall,visibility:'private'});
 const reason=(role,fallback)=>{const r=h.reasons?.[role];return typeof r==='object'&&r?r:{reason:r,fallback};};
 const acts=[...T.acts,...SHARED_ACTS].map(([role,kind,t,points,extra={}])=>{const target=fill(t);if(!target)return null;const r=reason(role);
  return {id:`${c}-${role}`,kind,target:target==='*'?'*':slug(target),points,reason:text(r.reason||(role==='bad-gift'?`you brought her ${itemName(target).toLowerCase()}`:''),at(`reasons.${role}`)),...(extra.memory&&r.memory?{memory:r.memory}:{}),...(extra.when?{when:extra.when}:{})};}).filter(Boolean);
 (h.actor?.dislikes||[]).forEach((d,i)=>acts.push({id:`${c}-harp-${i+1}`,kind:'pushy',target:slug(d),points:-2,reason:text(h.harp?.[i],at(`harp.${i}`))}));
 const drift=T.drift.map(([act,t,trait,delta])=>{const target=t&&fill(t);if(t&&!target)return null;return {act,...(target?{target:slug(target)}:{}),trait:trait==='second'?T.second:trait,delta};}).filter(Boolean);
 const traits=[{id:T.second,initial:T.initial.second},{id:'trust',initial:trust0}];
 const interest={id:`${c}-${h.interest?.id||'pace'}`,category:P.casual?'fling':'first-night',label:text(h.interest?.label,at('interest.label')),visibility:'discoverable'};
 const aftercare={id:`${c}-${h.aftercare||'talk'}`,option:h.aftercare||'talk',reaction:'liked',satisfactionDelta:8,visibility:'discoverable'};
 const actor={...h.actor,id:c,identityTags:['adult']};for(const k of ['name','description','voice'])actor[k]=text(h.actor?.[k],at(`actor.${k}`));
 // M5: her line after an activity with you, per result tier (the play UI's minigame).
 actor.reactions=Object.fromEntries(['skip','ok','good','great'].map(r=>[r,text(h.actor?.reactions?.[r],at(`actor.reactions.${r}`))]));
 const E=h.endings||{},endings=[
  {id:E.route?.id||`${c}-route`,name:text(E.route?.name,at('endings.route.name')),character:c,priority:ENDING_PRIORITY.route,requires:{flags:{[arcFlag]:true},romanceRanks:{[c]:ranks[3].id}},text:text(E.route?.text,at('endings.route.text'))},
  {id:`${c}-together`,name:text(E.together?.name,at('endings.together.name')),character:c,priority:ENDING_PRIORITY.together,requires:{datingPhases:{[c]:'exclusive'}},text:text(E.together?.text,at('endings.together.text'))}];
 const prefIds=new Set(wants.map(x=>x.id));
 // O1: each rung is authored (today's choice scenes) or free (typed, engine-held checkpoints); the rung overrides the world. Default authored, so existing worlds build unchanged.
 const mode=r=>{const m=h.rungs?.[r]?.mode;if(m!==undefined)assert(m==='free'||m==='authored',`heroines.${c}.rungs.${r}.mode: must be "free" or "authored"`);return m||spec.world?.firsts||'authored';};
 const scenes=[],firsts=[];
 for(const r of ['talk','date','kiss']){const ctx={c,at,text,prefIds,friend:ranks[1].id,interest:interest.id};mode(r)==='free'?firsts.push(freeFirst(h,r,{...ctx})):scenes.push(first(h,r,ctx));}
 if(mode('night')==='free')firsts.push(freeFirst(h,'night',{c,at,text,prefIds,interest:interest.id}));else scenes.push(night(h,{c,at,text,interest:interest.id}));
 return {actor,relationship:{character:c,trust:trust0},endings,scenes,firsts,
  dating:{character:c,initialChemistry:T.chemistry,initialPhase:'available',agreements:P.casual?['casual','monogamous']:['monogamous'],thresholds:THRESHOLDS,preferences:wants,signals:[
   {id:`liked-${c}`,event:'social.actPriced',match:{character:c,verdict:'liked'},delta:2,label:'something you did that she liked',repeatable:true},
   {id:`disliked-${c}`,event:'social.actPriced',match:{character:c,verdict:'disliked'},delta:-1,label:'something you did that she did not like',repeatable:true},
   {id:`closer-${c}`,event:'social.romanceRankChanged',match:{character:c},delta:5,label:'the two of you got closer',repeatable:true}]},
  tempo:{character:c,advancement:'automatic',ranks,gifts:{periodTicks:12,limitPerPeriod:1,repeatDecayPercent:50,preferences:[
   ...(gifts.loved?[{item:gifts.loved,reaction:'loved',points:6,chemistry:2}]:[]),...[].concat(gifts.liked||[]).map(item=>({item,reaction:'liked',points:4,chemistry:1})),...(gifts.disliked?[{item:gifts.disliked,reaction:'disliked',points:-3}]:[])]},
   signals:(h.activities||[]).map(a=>({id:`${c}-${a}`,event:'world.activityCompleted',match:{activity:a},points:2,cooldownTicks:12})),jealousy:{preset:h.jealousy||'secure'}},
  acts:{character:c,entries:acts},arc:{character:c,traits,drift,stages},
  intimacy:{character:c,openness:P.openness,casual:P.casual,consentPolicy:'threshold',consentDuration:2,allowedCategories:P.categories,cooldown:12,requiresAgreement:[],requirements:{attraction:P.attraction,phases:P.phases},interests:[interest],aftercarePreferences:[aftercare]}};
}
const safe=id=>/^[a-z][a-z0-9-]*$/.test(id||'');
const pages=(ps,c,path,text)=>(ps?.length?ps:[{}]).map((p,i)=>({speaker:p.speaker||c,text:text(p.text,`${path}.pages.${i}.text`)}));
const cg=r=>r?.cg?{cg:r.cg}:{};

function first(h,rung,{c,at,text,prefIds,friend,interest}){
 const R=RUNGS[rung],x=h.rungs?.[rung]||{},path=at(`rungs.${rung}`),flag={type:'flag',id:`${c}-${R.flag}`,value:true};
 const choices=(x.choices?.length?x.choices:DEFAULT_CHOICE_TONES.map(tone=>({tone}))).map((ch,i)=>{const [chem,trust]=TONES[ch.tone]||assert(false,`${path}.choices.${i}: tone must be one of ${Object.keys(TONES)}`),pref=ch.discover&&`${c}-${ch.discover}`;
  assert(!pref||prefIds.has(pref),`${path}.choices.${i}: discovers unknown preference ${pref}`);
  return {id:ch.id||`choice-${i+1}`,label:text(ch.label,`${path}.choices.${i}.label`),result:text(ch.result,`${path}.choices.${i}.result`),effects:[{type:'chemistry',character:c,delta:chem,reason:'how the moment went'},...(trust?[{type:'trust',character:c,delta:trust}]:[]),...(pref?[{type:'discoverPreference',character:c,preference:pref}]:[]),...(ch.learn?[{type:'discoverIntimacyInterest',character:c,interest}]:[]),flag]};});
 assert(choices.some((_,i)=>['best','good'].includes((x.choices?.length?x.choices:DEFAULT_CHOICE_TONES.map(tone=>({tone})))[i]?.tone)),`${path}: needs one best or good choice`);
 const match=R.match(c);if('to' in match)match.to=rung==='talk'?friend:match.to;
 return {id:`${c}-${rung}`,title:text(x.title,`${path}.title`),opening:text(x.opening,`${path}.opening`),trigger:{event:R.event,match},pages:pages(x.pages,c,path,text),choices,...cg(x)};
}

// O1 free mode: no choice menu. The entry names the trigger, her opening line, and one cue per code-owned checkpoint
// (FIRST_CHECKPOINTS in beat-library.mjs). The creator writes cues, never the checkpoint list, so the night's check-in
// can't be removed; blank cues are [[slot]] placeholders the drafter fills, like every other prose slot.
function freeFirst(h,rung,{c,at,text,prefIds,friend,interest}){
 const R=RUNGS[rung],x=h.rungs?.[rung]||{},path=at(`rungs.${rung}`);
 const cue=cp=>{const v=x.checkpoints?.[cp.id];return typeof v==='string'?v:v?.cue;},discover=cp=>{const d=x.checkpoints?.[cp.id]?.discover,pref=d&&`${c}-${d}`;assert(!pref||prefIds.has(pref),`${path}.checkpoints.${cp.id}: discovers unknown preference ${pref}`);return pref?{discover:pref}:{};};
 const match=R.match(c);if('to' in match)match.to=rung==='talk'?friend:match.to;
 return {id:`${c}-${rung}`,character:c,rung,title:text(x.title,`${path}.title`),opening:text(x.opening,`${path}.opening`),trigger:{event:R.event,match},
  checkpoints:FIRST_CHECKPOINTS[rung].map(cp=>({id:cp.id,cue:text(cue(cp),`${path}.checkpoints.${cp.id}${typeof x.checkpoints?.[cp.id]==='object'?'.cue':''}`),...discover(cp)})),...(rung==='night'?{interest}:{}),...cg(x)};
}

function night(h,{c,at,text,interest}){
 const x=h.rungs?.night||{},path=at('rungs.night'),done=`${c}-first-night`,cat='first-night';
 const stop=(r,p)=>({id:'stop',label:STOP_LABEL,result:text(r,`${p}.stop`),effects:[{type:'intimacyConsent',character:c,category:cat,status:'withdrawn'},{type:'trust',character:c,delta:STOP_TRUST}]});
 const pick=(o,key,p,effects,next)=>({id:o?.id||key,label:text(o?.label,`${p}.${key}.label`),result:text(o?.result,`${p}.${key}.result`),...(next?{next}:{}),effects});
 const sat=(d,more=[])=>[{type:'satisfaction',character:c,delta:d[0]},...(d[1]?[{type:'trust',character:c,delta:d[1]}]:[]),...more];
 const learn={type:'discoverIntimacyInterest',character:c,interest},finish=[{type:'completeIntimacy',character:c,category:cat,outcome:'positive'},{type:'flag',id:done,value:true}];
 const ci=x.checkIn||{},pk=x.peak||{};
 return {id:`${c}-night`,title:text(x.title,`${path}.title`),opening:text(x.opening,`${path}.opening`),trigger:{event:RUNGS.night.event,match:RUNGS.night.match(c)},repeatable:true,when:{flags:{[done]:false}},
  pages:pages(x.pages,c,path,text),choices:[pick(x.lead,'lead',path,sat(NIGHT.lead,[learn]),'check-in'),pick(x.rush,'rush',path,sat(NIGHT.rush,[learn]),'check-in'),stop(x.stop,path)],
  beats:[{id:'check-in',opening:text(ci.opening,`${path}.checkIn.opening`),pages:pages(ci.pages,c,`${path}.checkIn`,text),choices:[pick(ci.honest,'honest',`${path}.checkIn`,sat(NIGHT.honest),'peak'),pick(ci.yes,'yes',`${path}.checkIn`,sat(NIGHT.yes),'peak'),stop(ci.stop,`${path}.checkIn`)]},
   {id:'peak',opening:text(pk.opening,`${path}.peak.opening`),...(pk.pages?.length?{pages:pages(pk.pages,c,`${path}.peak`,text)}:{}),choices:[pick(pk.close,'close',`${path}.peak`,sat(NIGHT.close,finish)),pick(pk.more,'more',`${path}.peak`,sat(NIGHT.more,finish)),stop(pk.stop,`${path}.peak`)]}],...cg(x)};
}

// The inverse, for the M2 first proof and for "start from an existing world" in Studio: pull a pack's text slots back into a spec.
// `cast` names each love interest's temperament and pace ({jana:{temperament:'torn',pace:'steady'}}); structure is not read back, it is re-derived.
export function specFromPack(p,{cast}){
 const ids=Object.keys(cast),by=(k,c)=>(p[k]||[]).find(x=>x.character===c),strip=(c,id)=>String(id).replace(`${c}-`,''),{schemaVersion,...rest}=p;
 const actorOf=id=>{const {id:_,identityTags,...a}=p.actors.find(x=>x.id===id);return a;};
 const heroines=ids.map(c=>{
  const T=TEMPERAMENTS[cast[c].temperament],acts=by('actProfiles',c).entries,tempo=by('romanceTempoProfiles',c),arc=by('arcTracks',c),date=by('datingProfiles',c),intim=by('intimacyProfiles',c),a=actorOf(c);
  const topicKind=T.acts.find(r=>r[0]==='topic')[1],topic=acts.filter(e=>e.kind===topicKind&&e.target!=='*'&&e.points>0).sort((x,y)=>y.points-x.points)[0]?.target;
  const looks=acts.find(e=>e.kind==='compliment'&&e.points<0)?.target,quirk=acts.find(e=>e.kind==='compliment'&&e.points>0&&e.target!==topic)?.target,gift=r=>tempo.gifts.preferences.filter(g=>g.reaction===r).map(g=>g.item);
  const h={id:c,...cast[c],actor:a,topic,looks,...(quirk?{quirk}:{}),invite:acts.find(e=>e.kind==='invite')?.target||'*',gifts:{loved:gift('loved')[0],liked:gift('liked'),disliked:gift('disliked')[0]},buy:acts.find(e=>e.kind==='buy')?.target,
   activities:tempo.signals.map(s=>s.match.activity),trust:p.initialRelationships.find(r=>r.character===c)?.trust,
   wants:date.preferences.filter(x=>x.type==='stat').map(x=>({id:strip(c,x.id),stat:x.stat,min:x.min,visibility:x.visibility,...(x.weight<0?{turnoff:true}:{})})),
   ranks:tempo.ranks.map(r=>r.name),rankIds:tempo.ranks.map(r=>r.id),stages:arc.stages.map(s=>({id:s.id,name:s.name,voice:s.voice})),arcFlag:arc.stages.at(-1).flag,
   interest:{id:strip(c,intim.interests[0].id),label:intim.interests[0].label},aftercare:intim.aftercarePreferences[0]?.option,reasons:{},harp:[]};
  const fill=t=>({'{topic}':topic,'{looks}':looks,'{quirk}':quirk,'{invite}':h.invite,'{gift}':h.gifts.loved,'{buy}':h.buy,'{badGift}':h.gifts.disliked})[t]??t;
  for(const [role,kind,t,points,extra={}] of [...T.acts,...SHARED_ACTS]){const target=fill(t),e=target&&acts.find(x=>x.kind===kind&&x.target===(target==='*'?'*':slug(target))&&Math.sign(x.points)===Math.sign(points)&&x.when?.private===extra.when?.private);
   if(e)h.reasons[role]=e.memory?{reason:e.reason,memory:e.memory}:e.reason;}
  h.harp=(a.dislikes||[]).map(d=>acts.find(e=>e.kind==='pushy'&&e.target===slug(d))?.reason);
  const scene=r=>p.scriptedScenes.find(s=>s.id===`${c}-${r}`),tone=ch=>{const f=t=>ch.effects.find(e=>e.type===t)?.delta||0,v=[f('chemistry'),f('trust')];return Object.keys(TONES).find(k=>TONES[k][0]===v[0]&&TONES[k][1]===v[1])||'flat';};
  const txt=s=>({title:s.title,opening:s.opening,pages:s.pages,...(s.cg?{cg:s.cg}:{})}),opt=ch=>({id:ch.id,label:ch.label,result:ch.result});
  // O1: free rungs read back from pack.firsts keyed by checkpoint kind; when a pack mixes modes, every rung carries its mode
  // explicitly so the round trip is exact (world.firsts alone could not express the mix).
  const free=r=>(p.firsts||[]).find(f=>f.character===c&&f.rung===r),anyFirst=Boolean(p.firsts?.length);
  const freeRung=f=>({mode:'free',title:f.title,opening:f.opening,...(f.cg?{cg:f.cg}:{}),checkpoints:Object.fromEntries(f.checkpoints.map(cp=>[cp.id,cp.discover?{cue:cp.cue,discover:strip(c,cp.discover)}:cp.cue]))});
  const authored=x=>anyFirst?{mode:'authored',...x}:x;
  h.rungs=Object.fromEntries(['talk','date','kiss'].map(r=>{const f=free(r);if(f)return [r,freeRung(f)];
   const s=scene(r),choices=s.choices.map(ch=>{const d=ch.effects.find(e=>e.type==='discoverPreference');return {...opt(ch),tone:tone(ch),...(d?{discover:strip(c,d.preference)}:{}),...(ch.effects.some(e=>e.type==='discoverIntimacyInterest')?{learn:true}:{})};});
   return [r,authored({...txt(s),choices})];}));
  const nf=free('night');
  if(nf)h.rungs.night=freeRung(nf);
  else{const n=scene('night'),[ci,pk]=n.beats;
   h.rungs.night=authored({...txt(n),lead:opt(n.choices[0]),rush:opt(n.choices[1]),stop:n.choices[2].result,checkIn:{opening:ci.opening,pages:ci.pages,honest:opt(ci.choices[0]),yes:opt(ci.choices[1]),stop:ci.choices[2].result},peak:{opening:pk.opening,...(pk.pages?{pages:pk.pages}:{}),close:opt(pk.choices[0]),more:opt(pk.choices[1]),stop:pk.choices[2].result}});}
  const end=pr=>p.endings.find(e=>e.character===c&&e.priority===pr);h.endings={route:{id:end(20).id,name:end(20).name,text:end(20).text},together:{name:end(10).name,text:end(10).text}};
  return h;});
 const fb=p.endings.find(e=>e.id===p.run.defaultEnding),hero=new Set(ids);
 return {id:p.id,version:p.version,title:p.title,subtitle:p.subtitle,days:p.run.days,project:p.gameProject,player:p.actors.find(a=>a.id===p.playerId),
  friends:p.actors.filter(a=>a.id!==p.playerId&&!hero.has(a.id)),fallback:{id:fb.id,name:fb.name,text:fb.text,flag:Object.keys(fb.requires?.flags||{})[0]},heroines,
  world:{calendar:p.calendar,romanceStats:p.romanceStats,locations:p.locations,statDefinitions:p.statDefinitions,initialStats:p.initialStats,items:p.items,activities:p.activities,schedules:p.schedules,initialMoney:p.initialMoney,economySettings:p.economySettings,sobriety:p.sobriety,
   phoneContacts:p.phoneContacts,phoneMessages:p.phoneMessages,momentsProfile:p.momentsProfile,moments:p.moments,contentLevel:p.intimacySettings.contentLevel,privateLocations:p.intimacySettings.privateLocations,aftercareOptions:p.intimacySettings.aftercareOptions,
   ...(p.firsts?.length?{firsts:'free'}:{}),
   initialRelationships:p.initialRelationships.filter(r=>!hero.has(r.character))}};
}
