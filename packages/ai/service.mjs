import {assert,actions,execute,fallback,FREE_ACTIONS} from '../core/engine.mjs';
import {calendarFor} from '../../public/calendar.mjs';
import {heldBy} from '../modules/inventory.mjs';
import {contextFor} from './context.mjs';
import {parseIntent,MockProvider,CompatibleProvider} from './providers.mjs';
import {daypartContext,validateDaypart,fallbackDaypart} from './daypart.mjs';
import {sceneLines} from '../../vendor/venus/sceneText.mjs';
import {sanitizeSceneResponse} from '../../vendor/venus/sceneSanitizer.mjs';
import {validateGeneratedFacts,effectiveGeneratedFacts} from '../modules/facts.mjs';
import {scenePromptMessages} from '../../vendor/venus/scenePrompt.mjs';
import {ledgerMemories} from '../../vendor/venus/ledger.mjs';
import {sceneTranscript,closedScenes,budgetSceneContext} from './context-budget.mjs';
import {replyReserve} from './budget.mjs';
import {CONTEXT_SIZES} from './local-settings.mjs';
// A scene's start/continue events carry the player's own words; echoing them back reads as if the story repeated
// the player. Keep only real outcomes (travel, items, time) and say plainly that the reply failed.
const ECHO=new Set(['core.sceneStarted','core.sceneContinued','social.spoke']);
// Mechanical actions settle by rules alone: no model call, just the engine's own outcome text.
// Results the player must read before the next scripted page, so a chained scene never swallows them.
export const OUTCOME_EVENTS=new Set(['story.choiceResolved','world.activityCompleted','character.statChanged','social.relationshipChanged','social.chemistryChanged','world.moneyChanged','story.checkResolved','social.attractionChanged','social.bondChanged']);
export const RULES_ONLY=new Set([...FREE_ACTIONS,'story.leave','core.move','core.wait','core.waitUntil','items.take','items.place','items.give','items.use','items.craft','world.buy','world.sell','world.buyService','world.use','world.explore']);
// A solo authored activity is fully described by its pack text and effects; it needs no narrator.
export const soloActivity=turn=>turn.command.type==='core.scene'&&Boolean(turn.command.args?.activityId)&&!(turn.command.args.characters||[]).length;
const rulesOnly=turn=>RULES_ONLY.has(turn.command.type)||soloActivity(turn);
export function rulesText(world,pack,turn){if(soloActivity(turn)){const first=e=>e.type==='world.activityCompleted'?0:1;return turn.events.filter(e=>OUTCOME_EVENTS.has(e.type)&&e.payload?.text).sort((x,y)=>first(x)-first(y)).map(e=>e.payload.text).join('\n');}const here=world.actors[pack.playerId].location,loc=pack.locations.find(l=>l.id===here),present=pack.actors.filter(a=>a.id!==pack.playerId&&world.actors[a.id]?.location===here).map(a=>a.name);
  const extra=['core.move','core.wait','core.waitUntil'].includes(turn.command.type)?[turn.command.type==='core.move'&&loc?.description,present.length?`${present.join(' and ')} ${present.length>1?'are':'is'} here.`:'Nobody else is here.']:turn.command.type==='core.inspect'&&present.length?[`${present.join(' and ')} ${present.length>1?'are':'is'} here.`]:[];
  return [fallback(turn),...extra].filter(Boolean).join('\n');}
// An authored activity named anywhere in the line runs, and the whole line becomes its scene text, so
// "I greet Juno while I get to work" works the shift and the narration still covers the greeting.
const phraseRe=p=>new RegExp('(?<![\\p{L}])'+p.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![\\p{L}])','u');
export function activityFor(pack,input){const text=input.toLowerCase();let best=null,len=0;for(const a of pack.activities||[])for(const p of [a.name,...a.phrases||[]])if(p&&p.length>len&&phraseRe(p).test(text)){best=a;len=p.length;}return best;}
export function activityBlocked(world,pack,a){if(a.requiresFlag&&!world.flags[a.requiresFlag])return `${a.name} is not available yet.`;if(a.requiresItem&&heldBy(world,a.requiresItem,pack.playerId)<1)return `${a.name} needs ${pack.items.find(i=>i.id===a.requiresItem)?.name||'an item'}.`;if(a.once&&(world.activityUses||{})[a.id])return `You have already done that: ${a.name}.`;if(a.perDay&&((world.activityDayUses||{})[a.id]?.day===calendarFor(world.tick,pack).day&&(world.activityDayUses||{})[a.id].count>=a.perDay))return `You have had enough of that for today: ${a.name}.`;if(a.minTrust!==undefined&&(world.modules['social.relationships']?.edges[`${a.character}--${pack.playerId}`]||0)<a.minTrust)return `${world.actors[a.character]?.name} is not ready for that yet.`;return null;}
// "Wear the leather jacket" / "take off the cufflinks" are equipment actions, settled without the model.
const STOP=new Set(['a','an','the','to','of','and','i','my','at','in','on','with','for','just','what','he','she','her','his','is','it']),words=t=>t.toLowerCase().replace(/\[[^\]]*\]/g,'').match(/[\p{L}\d']+/gu)?.filter(w=>!STOP.has(w))||[];
// Typed text picks a scripted choice when it carries most of the choice's words ("I get to work" -> "Just get to work"),
// or an authored choice phrase, or a stat's approach words when one check in the beat uses that stat ("I stare the swan down" -> [Nerve] Stare it down).
const APPROACH={charm:['flirt','smile','wink','compliment','charm','sweet talk','win him over','win her over','win them over','schmooze','butter up','work the room'],nerve:['stare','dare','confront','stand up to','stand my ground','step in','step between','get between','go for it','kiss','take a chance','risk it','call his bluff','call her bluff'],wit:['joke','quip','banter','outsmart','outwit','figure out','work out','trick','haggle','spot','puzzle','deduce','heckle','comeback','clever'],empathy:['listen','comfort','reassure','understand','gently','softly','sympathise','sympathize','be there for','ask how','ask why','hear him out','hear her out','hear them out']};
const NEGATED=/\b(?:don'?t|do not|not|never|won'?t|refuse to)\b/i,approachRe=p=>{const q=p.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp('(?<![\\p{L}])'+(/e$/.test(q)?q.slice(0,-1)+'(?:e|es|ed|ing)':q+'(?:s|es|ed|ing)?')+'(?![\\p{L}])','u');};
export function choiceFor(available,input,beat=null,stats=null){const said=new Set(words(input)),text=input.toLowerCase(),open=available.filter(a=>a.type==='story.choose'&&!a.disabledReason);
  const scored=open.map(a=>{const w=words(a.label);return {a,s:w.length?w.filter(x=>said.has(x)).length/w.length:0};}).sort((x,y)=>y.s-x.s);if(scored[0]?.s>=0.6)return scored[0].a;if(NEGATED.test(input))return null;
  let best=null,len=0;for(const a of open)for(const p of beat?.choices?.find(c=>c.id===a.args.choice)?.phrases||[])if(p.length>len&&approachRe(p).test(text)){best=a;len=p.length;}if(best)return best;
  if(scored[0]?.s>=0.5&&scored[0].s>(scored[1]?.s||0))return scored[0].a;
  const hit=new Set((stats||Object.keys(APPROACH).map(id=>({id}))).filter(d=>(d.phrases||APPROACH[d.id]||[]).some(p=>approachRe(p).test(text))).map(d=>d.id));if(hit.size!==1)return null;
  const [stat]=hit,checks=open.filter(a=>a.check?.stat===stat);return checks.length===1?checks[0]:null;}
export function gearFor(available,pack,input){const m=/^\s*(?:i\s+)?(equip|wear|put on|change into|don|unequip|remove|take off)\b/i.exec(input);if(!m)return null;const type=/^(unequip|remove|take off)$/i.test(m[1])?'items.unequip':'items.equip',said=new Set(words(input));let best=null,score=0;for(const i of pack.items||[])if(i.slot){const w=words(i.name),s=w.filter(x=>said.has(x)).length/(w.length||1);if(s>score){best=i;score=s;}}if(score<0.5)return null;return available.find(a=>a.type===type&&a.args?.item===best.id)||{type,args:{item:best.id}};}
export function sceneFallback(turn){
  const outcomes=turn.events.filter(e=>!ECHO.has(e.type)&&(e.visibility==='public'||e.visibility?.includes(turn.command.actorId))).map(e=>e.payload.text).filter(Boolean);
  return [...outcomes,'(The model’s reply could not be used. Retry this turn.)'].join('\n');
}
import {scenePlanForTurn} from '../core/scene-plan.mjs';
import {guardSceneLines,stripStateSyntax,dropRepeats,dropAdvances,dropStock} from './untrusted-output.mjs';
import {beatDirection} from './beats.mjs';
import {parseInvite} from '../modules/social.mjs';
import {resolveSceneLocation} from '../../vendor/venus/sceneClassifier.mjs';
// Kept for callers of the old name: the transcript is now whole and budgeted per turn instead of capped at six.
export const recentSceneHistory=sceneTranscript;
export class GameService {
  constructor(store,packs,registry,provider){Object.assign(this,{store,packs,registry,provider});this.locks=new Set();this.previews=new Map();}
  preview(id){return this.previews.get(id)||null;}
  async act(id,request,signal){assert(!this.locks.has(id),'A turn is already in progress');this.locks.add(id);try{
    const world=this.store.load(id),pack=this.packs[world.packId];assert(pack,'Pack unavailable');
    if(world.turns[request.id])return await this.finish(id,request.id,signal);
    assert(request.expectedRevision===world.revision,'Stale revision; refresh and try again');
    const available=actions(world,pack,this.registry);let proposal=request.command,invite,activity,gear;
    if(request.input!==undefined){
      assert(typeof request.input==='string'&&request.input.trim().length>0&&request.input.length<=2000,'Input must be 1–2000 characters');
      const exact=available.find(a=>a.enabled&&a.label.toLowerCase()===request.input.trim().toLowerCase());
      if(exact)proposal={type:exact.type,args:exact.args};
      else if(world.modules['story.scenes']?.pending){const scene=pack.scriptedScenes.find(x=>x.id===world.modules['story.scenes'].pending),beat=scene?.beats?.find(x=>x.id===world.modules['story.scenes'].pendingBeat)||scene;const pick=choiceFor(available,request.input,beat,pack.statDefinitions),gear=!pick&&gearFor(available,pack,request.input);if(pick)proposal={type:pick.type,args:pick.args};else if(gear)proposal={type:gear.type,args:gear.args};else if(/^(leave|walk away|step away|excuse myself)\b/i.test(request.input.trim()))proposal={type:'story.leave',args:{scene:scene.id}};else if(beat?.allowInput!==false)proposal={type:'story.respond',args:{text:request.input.trim()}};else return {clarification:'Choose one of the available options to continue this scene.',state:world};}
      else if(pack.modules['world.economy']&&/^\s*(?:buy|purchase|sell)\b/i.test(request.input)){
        const wanted=/^\s*sell\b/i.test(request.input)?'world.sell':'world.buy';
        const matches=available.filter(a=>a.type===wanted&&request.input.toLowerCase().includes(pack.items.find(i=>i.id===a.args.item)?.name.toLowerCase()));
        if(matches.length===1&&matches[0].enabled)proposal={type:matches[0].type,args:matches[0].args};
        else if(matches.length===1)return {clarification:matches[0].reason||'That item is unavailable.',state:world};
        else return {clarification:matches.length?'Which item? Name one item to '+(wanted==='world.buy'?'buy':'sell')+'.':'That item is not available at this shop.',state:world};
      }
      else if(world.scene&&/^\s*(?:goodbye|bye|end (?:the )?(?:conversation|scene)|say goodbye)\s*[.!]?\s*$/i.test(request.input))proposal={type:'core.endScene',args:{}};
      else if((activity=activityFor(pack,request.input))){const blocked=activityBlocked(world,pack,activity);if(blocked)return {clarification:blocked,state:world};proposal={type:'core.scene',args:{text:request.input.trim(),location:activity.location,characters:activity.character?[activity.character]:[],activity:'other',activityId:activity.id,itemAction:'',itemId:'',itemTarget:''}};}
      else if((gear=gearFor(available,pack,request.input)))proposal={type:gear.type,args:gear.args};
      else if(pack.modules['social.conversation']&&(invite=parseInvite(world,pack,request.input)))proposal={type:'social.invite',args:invite};
      else if(this.provider instanceof MockProvider){
        const old=await this.provider.interpret(request.input,contextFor(world,pack,pack.playerId,null,request.input),available,signal);
        if(old.type!=='clarify'&&!(old.type==='social.speak'&&!/^(talk to |say |tell )/i.test(request.input)))proposal=old;
        else if(old.type==='clarify'&&/\b(teleport|set trust|system prompt|give me)\b/i.test(request.input))proposal=old;
      }
      if(!proposal&&typeof this.provider.interpretScene!=='function')proposal=await this.provider.interpret(request.input,contextFor(world,pack,pack.playerId,null,request.input),available,signal);
      const activityRequested=(pack.activities||[]).some(a=>[a.name,...a.phrases||[]].some(phrase=>phrase&&request.input.toLowerCase().includes(phrase.toLowerCase())));
      // "Ask Brin what he does on rest days" is speech, not a rest action: a line led by a speech verb only acts when it
      // adds an explicit "…and go/take …" clause. Splitting a conversation into new scenes loses its transcript.
      const speech=/^\s*(?:i\s+)?(?:ask|tell|say|reply|answer|whisper|shout|explain|admit|confess|promise|thank|remind|warn|compliment|apologi[sz]e|talk to|chat with)\b/i.test(request.input)&&!/\b(?:and|then)\s+(?:go|leave|exit|head|walk|travel|return|move|run|follow|take|grab|pick up|give|drop|sleep|rest|visit|meet)\b/i.test(request.input);
      const soloRequested=!speech&&/\b(read|study|sketch|draw|write|paint|practice|exercise|work|cook|clean|tidy|organize|organise|watch|observe|relax|shower|bathe|eat|drink)\b/i.test(request.input);
      const actionWords=!speech&&(soloRequested||/\b(go|leave|exit|travel|sleep|rest|visit|head to|move to|take|grab|pick up|give|drop|place|equip|unequip|search|inspect|use)\b/i.test(request.input)||/^\s*(?:go\s+)?meet\b/i.test(request.input));
      const mentions=pack.actors.filter(a=>a.id!==pack.playerId&&(' '+request.input.toLowerCase().split(/[^\p{L}\p{N}_-]+/u).join(' ')+' ').includes(' '+a.name.toLowerCase()+' ')).map(a=>a.id);
      const currentLocation=world.actors[pack.playerId].location;
      const liveCast=(world.scene?.location===currentLocation?world.scene.characters:[]).filter(id=>world.actors[id]?.location===currentLocation);
      // Talking *about* someone elsewhere ("I'm nervous about the meeting with Ada") discusses them; it does not summon them.
      // The person named right after the verb ("Ask Brin …") is still addressed even when absent, so that fails honestly.
      const addressee=speech?mentions.find(id=>new RegExp(`^\\s*(?:i\\s+)?\\S+(?:\\s+(?:to|with))?\\s+${pack.actors.find(a=>a.id===id).name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(request.input)):null;
      // Mid-conversation an absent name is only summoned when called out ("Brin!", "Hey Brin, …"); "I was with Brin" is news.
      const vocative=id=>{const n=pack.actors.find(a=>a.id===id).name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp(`^\\s*(?:(?:hey|hi|hello|yo|oi)[,!]?\\s+${n}\\b|${n}\\s*(?:[,!?:]|$))`,'i').test(request.input);};
      const addressed=speech?mentions.filter(id=>id===addressee||world.actors[id]?.location===currentLocation):liveCast.length&&!actionWords?mentions.filter(id=>world.actors[id]?.location===currentLocation||vocative(id)):mentions;
      const previous=Object.values(world.turns).at(-1),previousTarget=previous?.command.type==='social.speak'?previous.command.args.target:null;
      if(!proposal&&!activityRequested&&!actionWords&&!previousTarget&&!mentions.length&&/\b(her|him|them)\b/i.test(request.input)&&liveCast.length!==1)return {clarification:liveCast.length?'Who do you mean? '+liveCast.map(id=>world.actors[id].name).join(' or '):'Who do you want to meet? No character is in your current conversation.',state:world};
      if(!proposal&&!activityRequested&&!actionWords&&previousTarget&&world.actors[previousTarget]?.location===world.actors[pack.playerId].location&&addressed.every(id=>id===previousTarget))proposal={type:'social.speak',args:{target:previousTarget,text:request.input.trim()}};
      if(!proposal&&world.scene&&liveCast.length===world.scene.characters.length&&!activityRequested&&!actionWords&&addressed.every(id=>world.scene.characters.includes(id)))proposal={type:'core.scene',args:{text:request.input.trim(),location:world.scene.location,characters:world.scene.characters,activity:'continue'}};
      if(!proposal){const verdict=await this.provider.interpretScene(request.input,world,pack,signal);
        // A local model may turn an ordinary private activity into a conversation merely because an NPC shares
        // the location. Unless the player names someone, common solo verbs always stay solo.
        if(!mentions.length&&(soloRequested||actionWords&&!world.scene)){verdict.characters=[];if(verdict.activity==='talk'||verdict.activity==='meet')verdict.activity='explore';}
        const movementRequested=!speech&&/\b(go|leave|exit|travel|meet|visit|head|move|walk|run|return|follow|sleep|rest)\b/i.test(request.input),namedLocation=movementRequested?resolveSceneLocation(pack,request.input):null;
        if(namedLocation)verdict.location=namedLocation;
        if(!movementRequested&&!activityRequested&&!soloRequested){verdict.location=currentLocation;verdict.characters=addressed.length?addressed:liveCast;verdict.activity='talk';}
        const rule=(pack.activities||[]).find(a=>a.id===verdict.activityId),location=rule?.location||verdict.location||(verdict.activity==='rest'?pack.daypart?.introLocation||pack.startOptions?.[0]?.playerLocation||null:verdict.activity==='meet'&&verdict.characters.length?world.actors[verdict.characters[0]].location:null);if(movementRequested&&!location)return {clarification:`Where do you want to go? Try ${pack.locations.map(l=>l.name).join(', ')}.`,state:world};proposal={type:'core.scene',args:{text:request.input.trim(),location,characters:rule?.character?[...new Set([...verdict.characters,rule.character])]:verdict.characters,activity:verdict.activity,activityId:rule?.id||'',itemAction:verdict.itemAction||'',itemId:verdict.itemId||'',itemTarget:verdict.itemTarget||''}};}
    }
    assert(proposal,'Missing command');if(!['core.scene','story.respond','social.invite','items.equip','items.unequip'].includes(proposal.type))proposal=parseIntent(proposal,available);
    if(proposal.type==='clarify')return {clarification:proposal.args.question,state:world};
    assert(!signal?.aborted,'Cancelled before commit');
    const result=execute(world,{...proposal,id:request.id,actorId:pack.playerId,expectedRevision:request.expectedRevision},pack,this.registry);
    if(request.input!==undefined)result.turn.input=request.input;
    this.store.commit(result.state,world.revision);return await this.finish(id,request.id,signal);
  }finally{this.locks.delete(id);this.previews.delete(id);}}
  async finish(id,turnId,signal,retry=false){const world=this.store.load(id),pack=this.packs[world.packId],turn=world.turns[turnId];assert(turn,'Unknown turn');if(retry)assert(turn.status==='complete'&&turn.fallback,'Only a failed generated turn can be retried');else if(turn.status==='complete')return {state:world,turn};
    const scripted=pack.scriptedScenes?.find(s=>s.id===world.modules['story.scenes']?.pending);
    const opened=turn.events.some(e=>e.type==='story.sceneStarted');if((scripted&&turn.command.type!=='story.respond'&&(opened||!rulesOnly(turn)))||turn.command.type==='story.choose'){
      const beat=scripted?.beats?.find(b=>b.id===world.modules['story.scenes']?.pendingBeat)||scripted;
      const told=e=>['story.choiceResolved','world.activityCompleted'].includes(e.type)?0:1,outcome=turn.events.filter(e=>OUTCOME_EVENTS.has(e.type)&&e.payload?.text).sort((x,y)=>told(x)-told(y)).map(e=>({speaker:'',text:e.payload.text})),lines=[...(RULES_ONLY.has(turn.command.type)?rulesText(world,pack,turn).split('\n').map(t=>({speaker:'',text:t})):[]),...outcome,...(beat?[{speaker:'',text:beat.opening},...(beat.pages||[])]:[])];
      const text=lines.map(line=>`${line.speaker?`${pack.actors.find(a=>a.id===line.speaker)?.name}: `:''}${line.text}`).join('\n');
      const state=this.store.narrative(id,turnId,text,{sceneLines:lines,ledger:[],fallback:false,retry,provider:'Authored scene',promptVersion:'authored_scene_v1'});return {state,turn:state.turns[turnId]};
    }
    if(rulesOnly(turn)){const text=rulesText(world,pack,turn);const state=this.store.narrative(id,turnId,text,{sceneLines:text.split('\n').map(t=>({speaker:'',text:t})),ledger:[],fallback:false,retry,provider:'Game rules',promptVersion:'rules_v1'});return {state,turn:state.turns[turnId]};}
    if(turn.command.type==='core.endScene'){
      const text=fallback(turn);const state=this.store.narrative(id,turnId,text,{sceneLines:[{speaker:'',text}],ledger:[],fallback:false,retry,provider:'Game rules',promptVersion:'scene_end_v1'});return {state,turn:state.turns[turnId]};
    }
    const refused=turn.events.some(e=>e.type==='social.inviteDeclined')||turn.events.some(e=>e.type==='core.travelBlocked'||e.type==='world.meetingUnavailable'||e.type==='world.meetingRedirect')&&!turn.events.some(e=>['core.sceneStarted','core.sceneContinued','world.hangoutStarted'].includes(e.type)&&((e.payload.characters||[]).length||e.payload.char));
    if(refused){const text=fallback(turn);const state=this.store.narrative(id,turnId,text,{sceneLines:[{speaker:'',text}],ledger:[],fallback:false,retry,provider:'Game rules',promptVersion:'attendance_v1'});return {state,turn:state.turns[turnId]};}
    if(turn.command.type==='world.nextDaypart'){
      const context=daypartContext(world,pack,turn);let artifact,failed=false,failureReason='';
      try{artifact=validateDaypart(await this.provider.generateDaypart(context,signal),context);}catch(e){failed=true;failureReason=e.name==='AbortError'?'Model request timed out or was cancelled':String(e.message||e).slice(0,350);artifact=fallbackDaypart(context);}
      const state=this.store.narrative(id,turnId,artifact.lines.join('\n'),{artifact,sceneLines:artifact.lines.map(text=>({speaker:'',text})),fallback:failed,failureReason:failed?failureReason:null,retry,contextSources:[...context.recently.map(e=>e.source),...context.lorebook.map(e=>e.id)],promptVersion:'daypart_intro_v2',provider:this.provider.name});
      return {state,turn:state.turns[turnId]};
    }
    const scenePlan=scenePlanForTurn(world,pack,turn),onStage=scenePlan.cast,actor=scenePlan.actor;
    const context=contextFor(world,pack,actor,turn,turn.input||turn.command.args.text||turn.command.args.target||'',{wide:true});
    const cast=scenePlan.cast;context.scenePlan=scenePlan;
    context.stagedCast=cast;context.speakers=scenePlan.speakers;context.absentCharacters=pack.actors.filter(a=>a.id!==pack.playerId&&!cast.includes(a.id)).map(a=>({id:a.id,name:a.name,rule:'Not in this scene. May be discussed, but cannot appear, speak, arrive, or interact.'}));context.knownFacts=pack.modules['story.facts']?effectiveGeneratedFacts(world):[];context.sceneHistory=sceneTranscript(world,turn,cast);context.sceneSummary=world.scene?.summary||null;context.pastScenes=closedScenes(world,cast,pack);context.scenePhase=context.sceneHistory.length?'continuation':cast.length?'opening':'solo';context.playerAction=turn.input||turn.command.args.text||turn.events.find(e=>e.type!=='core.patch'&&e.payload.text)?.payload.text||turn.command.type;
    const hung=[...(context.pastScenes||[])].reverse().find(x=>x.unansweredQuestion&&cast.some(id=>pack.actors.find(a=>a.id===id)?.name===x.unansweredQuestion.by));if(hung)context.hangingAsk=hung.unansweredQuestion;
    const spokenBefore=[...context.sceneHistory.flatMap(h=>world.turns[h.source]?.sceneLines||[]),...(context.stagedCast||[]).flatMap(id=>[].concat(pack.actors.find(a=>a.id===id)?.examples||[]).map(text=>({speaker:id,text})))];context.spokenBefore=spokenBefore;context.openThreads=[...(context.plans||[]).map(x=>({kind:'plan',character:x.character,text:x.plan,due:x.deadlineTick})),...(context.memories||[]).filter(m=>m.promise).slice(-4).map(m=>({kind:'promise',text:m.text}))];context.direction=beatDirection(context,pack,world.scene?.id||turnId);if(context.hangingAsk)context.openThreads=[...(context.openThreads||[]),{kind:'question',character:context.hangingAsk.by,text:`asked the player: "${context.hangingAsk.text}" — never answered`}];
    // Physical contact an NPC initiates is only in character once romance has reached the crush stage; the lint
    // needs that per-cast verdict because the narration prompt alone does not stop small models from escalating.
    const datingPhases=Object.fromEntries((context.dating||[]).map(row=>[row.character,row.phase]));context.touchStage=Object.fromEntries(cast.map(id=>[id,['crush','dating','exclusive'].includes(datingPhases[id])]));
    const repeatAsk=turn.events.find(e=>e.type==='social.spoke'&&e.payload.repeat);context.repeatAsk=repeatAsk?pack.actors.find(a=>a.id===repeatAsk.payload.target)?.name||null:null;
    const budgeted=budgetSceneContext(context,pack,world,turnId,{window:this.provider.contextWindow||8192,reply:replyReserve(this.provider.usage,this.provider.maxTokens||1800,512,5,this.provider.contextWindow||8192),ratio:this.provider.calibration?.ratio||1,verbatim:CONTEXT_SIZES[this.provider.contextSize]?.verbatim??Infinity,render:c=>scenePromptMessages(c,pack)});Object.assign(context,budgeted.context);const contextReport=budgeted.report;
    let text,visualLines,failed=false,sceneEnded=false,sceneSummary='',lintTrace=[],bundledMemories=[],bundledFacts=[];
    let failureReason='';try{if(typeof this.provider.generateScene==='function'){
      const previewLines=[];const response=await this.provider.generateScene(context,pack,signal,lines=>{previewLines.push(...lines);try{const safe=sanitizeSceneResponse({lines:guardSceneLines(previewLines,scenePlan.speakers,pack)},pack,world,cast).lines;this.previews.set(id,{turnId,lines:safe,authoritative:false});}catch{}});
      lintTrace=response.lintTrace||[];
      const raw=response.plain?{lines:sceneLines(stripStateSyntax(response.plain),pack,actor)}:{...response};raw.lines=dropStock(dropRepeats(guardSceneLines(raw.lines,scenePlan.speakers,pack),spokenBefore,context.playerAction));if(!pack.modules?.['social.intimacy'])raw.lines=dropAdvances(raw.lines,context.playerAction);
      const sanitized=sanitizeSceneResponse(raw,pack,world,cast);visualLines=sanitized.lines;
      sceneEnded=Boolean(world.scene&&sanitized.end&&cast.length);
      sceneSummary=sanitized.summary;
      if(this.provider.bundlesSceneMetadata){bundledMemories=ledgerMemories({memories:response.memories},pack,turn);bundledFacts=Array.isArray(response.facts)?response.facts:[];}
      text=visualLines.map(line=>`${line.speaker?`${pack.actors.find(a=>a.id===line.speaker).name}: `:''}${line.text}`).join('\n');
    }else text=stripStateSyntax(await this.provider.narrate(context,signal));assert(typeof text==='string'&&text.trim()&&text.length<=20000,'Invalid narrative');}catch(e){failed=true;failureReason=e.name==='AbortError'?'Model request timed out or was cancelled':String(e.message||e).slice(0,350);text=turn.command.type==='core.scene'?sceneFallback(turn):fallback(turn);}
    let ledger=[];if(!failed)ledger=this.provider.bundlesSceneMetadata?bundledMemories:typeof this.provider.generateLedger==='function'?await this.provider.generateLedger(turn,text,pack,signal):[];
    let generatedFacts=[];const factCandidate=turn.events.some(e=>['core.sceneStarted','core.sceneContinued','social.spoke','world.hangoutStarted','story.sceneStarted','story.sceneResumed'].includes(e.type));if(!failed&&factCandidate&&pack.modules['story.facts'])try{const rawFacts=this.provider.bundlesSceneMetadata?bundledFacts:typeof this.provider.generateFacts==='function'?await this.provider.generateFacts(turn,text,pack,signal):[];generatedFacts=validateGeneratedFacts(rawFacts,pack,turn,text);}catch{generatedFacts=[];}
    // A continuous scene is closed by the engine (core.endScene), so the clock and attendance settle like any other exit.
    const continuous=pack.gameProject?.conversationStyle==='continuous',settled=world.scene&&cast.length&&!failed?{sceneId:world.scene.id,sceneSummary:sceneSummary||world.scene.summary||'',sceneEnded:sceneEnded&&!continuous}:{};
    const state=this.store.narrative(id,turnId,text,{sceneRequest:{phase:context.scenePhase,playerAction:context.playerAction,cast,history:context.sceneHistory,...(this.provider instanceof CompatibleProvider?{messages:scenePromptMessages(context,pack)}:{})},scenePlan,sceneLines:visualLines||sceneLines(text,pack,actor),ledger,...(pack.modules['story.facts']?{generatedFacts}:{}),...(lintTrace.length?{lintTrace}:{}),...settled,fallback:failed,failureReason:failed?failureReason:null,retry,...(context.loreTrace?.activated?.length?{loreActivations:{tick:context.loreTrace.tick,ids:context.loreTrace.activated.filter(id=>context.lorebook.some(e=>e.id===id))}}:{}),contextSources:[...context.sceneHistory.map(m=>m.source),...context.pastScenes.map(m=>m.source),...context.memories.map(m=>m.source),...context.generatedFacts.map(f=>f.id),...context.lorebook.map(e=>e.id),...context.recentActions.map(e=>e.source)],contextReport,promptVersion:visualLines?'scene_structured_v1':context.promptVersion,provider:this.provider.name},pack);this.previews.delete(id);
    if(continuous&&sceneEnded&&!failed&&state.scene?.id===world.scene.id){const endId=`${turnId}-end`.slice(0,100);try{const r=execute(state,{type:'core.endScene',args:{reason:'natural'},id:endId,actorId:pack.playerId,expectedRevision:state.revision},pack,this.registry);this.store.commit(r.state,state.revision);const ended=await this.finish(id,endId,signal);return {state:ended.state,turn:ended.state.turns[turnId]};}catch(e){if(e.name==='AbortError')throw e;}}
    return {state,turn:state.turns[turnId]};
  }
  async retry(id,turnId,signal){assert(!this.locks.has(id),'A turn is already in progress');this.locks.add(id);try{const s=this.store.load(id);assert(Object.values(s.turns).at(-1)?.id===turnId,'Only the latest turn can be retried');return await this.finish(id,turnId,signal,true);}finally{this.locks.delete(id);this.previews.delete(id);}}
  async recover(id){const s=this.store.load(id);for(const t of Object.values(s.turns))if(t.status==='pending')await this.finish(id,t.id);return this.store.load(id);}
}
