import {assert,actions,execute,fallback} from '../core/engine.mjs';
import {contextFor} from './context.mjs';
import {parseIntent,MockProvider,CompatibleProvider} from './providers.mjs';
import {daypartContext,validateDaypart,fallbackDaypart} from './daypart.mjs';
import {sceneLines} from '../../vendor/venus/sceneText.mjs';
import {sanitizeSceneResponse} from '../../vendor/venus/sceneSanitizer.mjs';
import {validateGeneratedFacts} from '../modules/facts.mjs';
import {scenePromptMessages} from '../../vendor/venus/scenePrompt.mjs';
import {sceneTranscript,closedScenes,budgetSceneContext} from './context-budget.mjs';
import {replyReserve} from './budget.mjs';
import {CONTEXT_SIZES} from './local-settings.mjs';
// A scene's start/continue events carry the player's own words; echoing them back reads as if the story repeated
// the player. Keep only real outcomes (travel, items, time) and say plainly that the reply failed.
const ECHO=new Set(['core.sceneStarted','core.sceneContinued','social.spoke']);
export function sceneFallback(turn){
  const outcomes=turn.events.filter(e=>!ECHO.has(e.type)&&(e.visibility==='public'||e.visibility?.includes(turn.command.actorId))).map(e=>e.payload.text).filter(Boolean);
  return [...outcomes,'(The model’s reply could not be used. Retry this turn.)'].join('\n');
}
import {scenePlanForTurn} from '../core/scene-plan.mjs';
// Kept for callers of the old name: the transcript is now whole and budgeted per turn instead of capped at six.
export const recentSceneHistory=sceneTranscript;
export class GameService {
  constructor(store,packs,registry,provider){Object.assign(this,{store,packs,registry,provider});this.locks=new Set();this.previews=new Map();}
  preview(id){return this.previews.get(id)||null;}
  async act(id,request,signal){assert(!this.locks.has(id),'A turn is already in progress');this.locks.add(id);try{
    const world=this.store.load(id),pack=this.packs[world.packId];assert(pack,'Pack unavailable');
    if(world.turns[request.id])return await this.finish(id,request.id,signal);
    assert(request.expectedRevision===world.revision,'Stale revision; refresh and try again');
    const available=actions(world,pack,this.registry);let proposal=request.command;
    if(request.input!==undefined){
      assert(typeof request.input==='string'&&request.input.trim().length>0&&request.input.length<=2000,'Input must be 1–2000 characters');
      const exact=available.find(a=>a.enabled&&a.label.toLowerCase()===request.input.trim().toLowerCase());
      if(exact)proposal={type:exact.type,args:exact.args};
      else if(pack.modules['world.economy']&&/^\s*(?:buy|purchase|sell)\b/i.test(request.input)){
        const wanted=/^\s*sell\b/i.test(request.input)?'world.sell':'world.buy';
        const matches=available.filter(a=>a.type===wanted&&request.input.toLowerCase().includes(pack.items.find(i=>i.id===a.args.item)?.name.toLowerCase()));
        if(matches.length===1&&matches[0].enabled)proposal={type:matches[0].type,args:matches[0].args};
        else if(matches.length===1)return {clarification:matches[0].reason||'That item is unavailable.',state:world};
        else return {clarification:matches.length?'Which item? Name one item to '+(wanted==='world.buy'?'buy':'sell')+'.':'That item is not available at this shop.',state:world};
      }
      else if(world.scene&&/^\s*(?:goodbye|bye|end (?:the )?(?:conversation|scene)|say goodbye)\s*[.!]?\s*$/i.test(request.input))proposal={type:'core.endScene',args:{}};
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
      const actionWords=!speech&&(/\b(go|leave|exit|travel|sleep|rest|visit|head to|move to|take|grab|pick up|give|drop|place|equip|unequip|search|inspect|use)\b/i.test(request.input)||/^\s*(?:go\s+)?meet\b/i.test(request.input));
      const mentions=pack.actors.filter(a=>a.id!==pack.playerId&&(' '+request.input.toLowerCase().split(/[^\p{L}\p{N}_-]+/u).join(' ')+' ').includes(' '+a.name.toLowerCase()+' ')).map(a=>a.id);
      const currentLocation=world.actors[pack.playerId].location;
      const liveCast=(world.scene?.location===currentLocation?world.scene.characters:[]).filter(id=>world.actors[id]?.location===currentLocation);
      // Talking *about* someone elsewhere ("I'm nervous about the meeting with Ada") discusses them; it does not summon them.
      // The person named right after the verb ("Ask Brin …") is still addressed even when absent, so that fails honestly.
      const addressee=speech?mentions.find(id=>new RegExp(`^\\s*(?:i\\s+)?\\S+(?:\\s+(?:to|with))?\\s+${pack.actors.find(a=>a.id===id).name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(request.input)):null;
      const addressed=speech?mentions.filter(id=>id===addressee||world.actors[id]?.location===currentLocation):mentions;
      const previous=Object.values(world.turns).at(-1),previousTarget=previous?.command.type==='social.speak'?previous.command.args.target:null;
      if(!proposal&&!activityRequested&&!actionWords&&!previousTarget&&!mentions.length&&/\b(her|him|them)\b/i.test(request.input)&&liveCast.length!==1)return {clarification:liveCast.length?'Who do you mean? '+liveCast.map(id=>world.actors[id].name).join(' or '):'Who do you want to meet? No character is in your current conversation.',state:world};
      if(!proposal&&!activityRequested&&!actionWords&&previousTarget&&world.actors[previousTarget]?.location===world.actors[pack.playerId].location&&mentions.every(id=>id===previousTarget))proposal={type:'social.speak',args:{target:previousTarget,text:request.input.trim()}};
      if(!proposal&&world.scene&&liveCast.length===world.scene.characters.length&&!activityRequested&&!actionWords&&addressed.every(id=>world.scene.characters.includes(id)))proposal={type:'core.scene',args:{text:request.input.trim(),location:world.scene.location,characters:world.scene.characters,activity:'continue'}};
      if(!proposal){const verdict=await this.provider.interpretScene(request.input,world,pack,signal);
        const movementRequested=!speech&&/\b(go|leave|exit|travel|meet|visit|head|move|walk|run|return|follow|sleep|rest)\b/i.test(request.input);
        if(!movementRequested&&!activityRequested){verdict.location=currentLocation;verdict.characters=addressed.length?addressed:liveCast;verdict.activity='talk';}
        const rule=(pack.activities||[]).find(a=>a.id===verdict.activityId),location=rule?.location||verdict.location||(verdict.activity==='rest'?pack.daypart?.introLocation||pack.startOptions?.[0]?.playerLocation||null:verdict.activity==='meet'&&verdict.characters.length?world.actors[verdict.characters[0]].location:null);proposal={type:'core.scene',args:{text:request.input.trim(),location,characters:rule?.character?[...new Set([...verdict.characters,rule.character])]:verdict.characters,activity:verdict.activity,activityId:rule?.id||'',itemAction:verdict.itemAction||'',itemId:verdict.itemId||'',itemTarget:verdict.itemTarget||''}};}
    }
    assert(proposal,'Missing command');if(proposal.type!=='core.scene')proposal=parseIntent(proposal,available);
    if(proposal.type==='clarify')return {clarification:proposal.args.question,state:world};
    assert(!signal?.aborted,'Cancelled before commit');
    const result=execute(world,{...proposal,id:request.id,actorId:pack.playerId,expectedRevision:request.expectedRevision},pack,this.registry);
    if(request.input!==undefined)result.turn.input=request.input;
    this.store.commit(result.state,world.revision);return await this.finish(id,request.id,signal);
  }finally{this.locks.delete(id);this.previews.delete(id);}}
  async finish(id,turnId,signal,retry=false){const world=this.store.load(id),pack=this.packs[world.packId],turn=world.turns[turnId];assert(turn,'Unknown turn');if(retry)assert(turn.status==='complete'&&turn.fallback,'Only a failed generated turn can be retried');else if(turn.status==='complete')return {state:world,turn};
    const scripted=pack.scriptedScenes?.find(s=>s.id===world.modules['story.scenes']?.pending);
    if(scripted||turn.command.type==='story.choose'){
      const beat=scripted?.beats?.find(b=>b.id===world.modules['story.scenes']?.pendingBeat)||scripted;
      const lines=beat?[{speaker:'',text:beat.opening},...(beat.pages||[])]:turn.events.filter(e=>e.type==='story.choiceResolved').map(e=>({speaker:'',text:e.payload.text}));
      const text=lines.map(line=>`${line.speaker?`${pack.actors.find(a=>a.id===line.speaker)?.name}: `:''}${line.text}`).join('\n');
      const state=this.store.narrative(id,turnId,text,{sceneLines:lines,ledger:[],fallback:false,retry,provider:'Authored scene',promptVersion:'authored_scene_v1'});return {state,turn:state.turns[turnId]};
    }
    if(turn.command.type==='core.endScene'){
      const text=fallback(turn);const state=this.store.narrative(id,turnId,text,{sceneLines:[{speaker:'',text}],ledger:[],fallback:false,retry,provider:'Game rules',promptVersion:'scene_end_v1'});return {state,turn:state.turns[turnId]};
    }
    const refused=turn.events.some(e=>e.type==='core.travelBlocked'||e.type==='world.meetingUnavailable')&&!turn.events.some(e=>['core.sceneStarted','core.sceneContinued','world.hangoutStarted'].includes(e.type)&&((e.payload.characters||[]).length||e.payload.char));
    if(refused){const text=fallback(turn);const state=this.store.narrative(id,turnId,text,{sceneLines:[{speaker:'',text}],ledger:[],fallback:false,retry,provider:'Game rules',promptVersion:'attendance_v1'});return {state,turn:state.turns[turnId]};}
    if(turn.command.type==='world.nextDaypart'){
      const context=daypartContext(world,pack,turn);let artifact,failed=false,failureReason='';
      try{artifact=validateDaypart(await this.provider.generateDaypart(context,signal),context);}catch(e){failed=true;failureReason=e.name==='AbortError'?'Model request timed out or was cancelled':String(e.message||e).slice(0,350);artifact=fallbackDaypart(context);}
      const state=this.store.narrative(id,turnId,artifact.lines.join('\n'),{artifact,sceneLines:artifact.lines.map(text=>({speaker:'',text})),fallback:failed,failureReason:failed?failureReason:null,retry,contextSources:[...context.recently.map(e=>e.source),...context.lorebook.map(e=>e.id)],promptVersion:'daypart_intro_v2',provider:this.provider.name});
      return {state,turn:state.turns[turnId]};
    }
    const scenePlan=scenePlanForTurn(world,pack,turn),onStage=scenePlan.cast,actor=scenePlan.actor;
    const context=contextFor(world,pack,actor,turn,turn.input||turn.command.args.target||'',{wide:true});
    const cast=scenePlan.cast;context.scenePlan=scenePlan;
    context.stagedCast=cast;context.absentCharacters=pack.actors.filter(a=>a.id!==pack.playerId&&!cast.includes(a.id)).map(a=>({id:a.id,name:a.name,rule:'Not in this scene. May be discussed, but cannot appear, speak, arrive, or interact.'}));context.sceneHistory=sceneTranscript(world,turn,cast);context.sceneSummary=world.scene?.summary||null;context.pastScenes=closedScenes(world,cast,pack);context.scenePhase=context.sceneHistory.length?'continuation':cast.length?'opening':'solo';context.playerAction=turn.input||turn.command.args.text||turn.events.find(e=>e.type!=='core.patch'&&e.payload.text)?.payload.text||turn.command.type;
    const budgeted=budgetSceneContext(context,pack,world,turnId,{window:this.provider.contextWindow||8192,reply:replyReserve(this.provider.usage,this.provider.maxTokens||1800),ratio:this.provider.calibration?.ratio||1,verbatim:CONTEXT_SIZES[this.provider.contextSize]?.verbatim??Infinity,render:c=>scenePromptMessages(c,pack)});Object.assign(context,budgeted.context);const contextReport=budgeted.report;
    let text,visualLines,failed=false,sceneEnded=false,sceneSummary='';
    let failureReason='';try{if(typeof this.provider.generateScene==='function'){
      const previewLines=[];const response=await this.provider.generateScene(context,pack,signal,lines=>{previewLines.push(...lines);try{const safe=sanitizeSceneResponse({lines:previewLines},pack,world,cast).lines;this.previews.set(id,{turnId,lines:safe,authoritative:false});}catch{}});
      const raw=response.plain?{lines:sceneLines(response.plain,pack,actor)}:response;
      const sanitized=sanitizeSceneResponse(raw,pack,world,cast);visualLines=sanitized.lines;
      sceneEnded=Boolean(world.scene&&sanitized.end&&cast.length);
      sceneSummary=sanitized.summary;
      if(sceneEnded&&typeof this.provider.generateScene==='function'){
        // Venus's closing pass writes a separate landing before the scene is settled.
        const closing={...context,scenePhase:'closing',sceneSummary:sceneSummary||context.sceneSummary,sceneHistory:[...context.sceneHistory,{source:turn.id,input:context.playerAction,text:visualLines.map(line=>line.text).join('\n')}]};
        try{const answer=await this.provider.generateScene(closing,pack,signal);const landing=sanitizeSceneResponse(answer.plain?{lines:sceneLines(answer.plain,pack,actor)}:answer,pack,world,cast);visualLines=[...visualLines,...landing.lines].slice(0,80);sceneSummary=landing.summary||sceneSummary;}
        catch(error){if(error.name==='AbortError')throw error;}
      }
      text=visualLines.map(line=>`${line.speaker?`${pack.actors.find(a=>a.id===line.speaker).name}: `:''}${line.text}`).join('\n');
    }else text=await this.provider.narrate(context,signal);assert(typeof text==='string'&&text.trim()&&text.length<=20000,'Invalid narrative');}catch(e){failed=true;failureReason=e.name==='AbortError'?'Model request timed out or was cancelled':String(e.message||e).slice(0,350);text=turn.command.type==='core.scene'?sceneFallback(turn):fallback(turn);}
    let ledger=[];if(!failed&&typeof this.provider.generateLedger==='function')ledger=await this.provider.generateLedger(turn,text,pack,signal);
    let generatedFacts=[];const factCandidate=turn.events.some(e=>['core.sceneStarted','core.sceneContinued','social.spoke','world.hangoutStarted','story.sceneStarted','story.sceneResumed'].includes(e.type));if(!failed&&factCandidate&&pack.modules['story.facts']&&typeof this.provider.generateFacts==='function')try{generatedFacts=validateGeneratedFacts(await this.provider.generateFacts(turn,text,pack,signal),pack,turn,text);}catch{generatedFacts=[];}
    const settled=world.scene&&cast.length&&!failed?{sceneId:world.scene.id,sceneSummary:sceneSummary||world.scene.summary||'',sceneEnded}:{};
    const state=this.store.narrative(id,turnId,text,{sceneRequest:{phase:context.scenePhase,playerAction:context.playerAction,cast,history:context.sceneHistory,...(this.provider instanceof CompatibleProvider?{messages:scenePromptMessages(context,pack)}:{})},scenePlan,sceneLines:visualLines||sceneLines(text,pack,actor),ledger,...(pack.modules['story.facts']?{generatedFacts}:{}),...settled,fallback:failed,failureReason:failed?failureReason:null,retry,contextSources:[...context.sceneHistory.map(m=>m.source),...context.pastScenes.map(m=>m.source),...context.memories.map(m=>m.source),...context.generatedFacts.map(f=>f.id),...context.lorebook.map(e=>e.id),...context.recentActions.map(e=>e.source)],contextReport,promptVersion:visualLines?'scene_structured_v1':context.promptVersion,provider:this.provider.name},pack);this.previews.delete(id);return {state,turn:state.turns[turnId]};
  }
  async retry(id,turnId,signal){assert(!this.locks.has(id),'A turn is already in progress');this.locks.add(id);try{const s=this.store.load(id);assert(Object.values(s.turns).at(-1)?.id===turnId,'Only the latest turn can be retried');return await this.finish(id,turnId,signal,true);}finally{this.locks.delete(id);this.previews.delete(id);}}
  async recover(id){const s=this.store.load(id);for(const t of Object.values(s.turns))if(t.status==='pending')await this.finish(id,t.id);return this.store.load(id);}
}
