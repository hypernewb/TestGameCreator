import {assert,actions,execute,fallback,FREE_ACTIONS,EXCHANGE_COMMANDS,rankLock,routeBetween} from '../core/engine.mjs';
import {calendarFor} from '../../public/calendar.mjs';
import {closedReason} from '../modules/calendar.mjs';
import {heldBy} from '../modules/inventory.mjs';
import {contextFor} from './context.mjs';
import {parseIntent,MockProvider,CompatibleProvider} from './providers.mjs';
import {daypartContext,validateDaypart,fallbackDaypart} from './daypart.mjs';
import {sceneLines} from '../../vendor/venus/sceneText.mjs';
import {sanitizeSceneResponse} from '../../vendor/venus/sceneSanitizer.mjs';
import {validateGeneratedFacts,effectiveGeneratedFacts} from '../modules/facts.mjs';
import {dailyNeedHint} from '../../public/daily-need.mjs';
import {scenePromptMessages} from '../../vendor/venus/scenePrompt.mjs';
import {ledgerMemories} from '../../vendor/venus/ledger.mjs';
import {sceneTranscript,closedScenes,budgetSceneContext,SUB_TURNS} from './context-budget.mjs';
import {replyReserve} from './budget.mjs';
import {contextPreset} from './local-settings.mjs';
import {actsEnabled,sceneActs,typedListen,typedDislike,ACTS_RULE,sceneClaims,CLAIMS_RULE} from './scene-acts.mjs';
import {sobrietyLevel} from '../modules/intimacy.mjs';
import {firstBrief,typedStop} from '../modules/firsts.mjs';
// A scene's start/continue events carry the player's own words; echoing them back reads as if the story repeated
// the player. Keep only real outcomes (travel, items, time) and say plainly that the reply failed.
const ECHO=new Set(['core.sceneStarted','core.sceneContinued','social.spoke']);
// Mechanical actions settle by rules alone: no model call, just the engine's own outcome text.
// Results the player must read before the next scripted page, so a chained scene never swallows them.
export const OUTCOME_EVENTS=new Set(['story.choiceResolved','world.activityCompleted','character.statChanged','social.relationshipChanged','social.chemistryChanged','world.moneyChanged','story.checkResolved','social.attractionChanged','social.bondChanged']);
export const RULES_ONLY=new Set([...FREE_ACTIONS,'social.priceActs','social.scoreFirst','social.stopFirst','story.leave','core.move','core.wait','core.waitUntil','items.take','items.place','items.give','items.use','items.craft','world.buy','world.sell','world.buyService','world.use','world.explore']);
// Sub-turns the service appends to one player action: they carry score and close state, never scene prose.
export {SUB_TURNS};
// A solo authored activity: the model narrates it from its committed outcomes (Venus rebase); rulesText stays for rules-only turns.
export const soloActivity=turn=>turn.command.type==='core.scene'&&Boolean(turn.command.args?.activityId)&&!(turn.command.args.characters||[]).length;
export const futurePlan=text=>/\b(tomorrow|tonight|this weekend|next (?:week|weekend|time|(?:mon|tues|wednes|thurs|fri|satur|sun)day)|(?:on|this|by|until|till) (?:mon|tues|wednes|thurs|fri|satur|sun)day|(?:mon|tues|wednes|thurs|fri|satur|sun)day (?:morning|afternoon|evening|night)|some ?time|one day|later this week|after class)\b/i.test(text);
const rulesOnly=turn=>RULES_ONLY.has(turn.command.type)||soloActivity(turn);
export function rulesText(world,pack,turn){if(soloActivity(turn)){const first=e=>e.type==='world.activityCompleted'?0:1;return turn.events.filter(e=>OUTCOME_EVENTS.has(e.type)&&e.payload?.text).sort((x,y)=>first(x)-first(y)).map(e=>e.payload.text).join('\n');}const here=world.actors[pack.playerId].location,loc=pack.locations.find(l=>l.id===here),present=pack.actors.filter(a=>a.id!==pack.playerId&&world.actors[a.id]?.location===here).map(a=>a.name);
  const extra=['core.move','core.wait','core.waitUntil'].includes(turn.command.type)?[turn.command.type==='core.move'&&loc?.description,present.length?`${present.join(' and ')} ${present.length>1?'are':'is'} here.`:'Nobody else is here.']:turn.command.type==='core.inspect'&&present.length?[`${present.join(' and ')} ${present.length>1?'are':'is'} here.`]:[];
  return [fallback(turn),...extra].filter(Boolean).join('\n');}
// An authored activity named anywhere in the line runs, and the whole line becomes its scene text, so
// "I greet Juno while I get to work" works the shift and the narration still covers the greeting.
const phraseRe=p=>new RegExp('(?<![\\p{L}])'+p.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![\\p{L}])','u');
// "Ask Brin what he does on rest days" is speech, not a rest action: a line led by a speech verb only acts when it
// adds an explicit "…and go/take …" clause. Splitting a conversation into new scenes loses its transcript.
const isSpeech=input=>/^\s*(?:i\s+)?(?:ask|tell|say|reply|answer|whisper|shout|explain|admit|confess|promise|thank|remind|warn|compliment|apologi[sz]e|talk to|chat with)\b/i.test(input)&&!/\b(?:and|then)\s+(?:go|leave|exit|head|walk|travel|return|move|run|follow|take|grab|pick up|give|drop|sleep|rest|visit|meet)\b/i.test(input);
// What the player does, not what they say: quoted dialogue ("…a colder read…", "…draw it yourself…") never triggers an activity, a solo action or a move.
export const deeds=input=>input.replace(/["“][^"“”]*["”]/g,' ').replace(/["“][^"”]*$/,' ');
// Mid-conversation, "the climbing wall" is scenery unless its character is in the scene or named: it never casts someone who is not here.
export const strayActivity=(world,pack,a,input)=>Boolean(world.scene&&a.character&&!world.scene.characters.includes(a.character)&&!phraseRe((pack.actors.find(x=>x.id===a.character)?.name||a.character).split(/\s+/)[0].toLowerCase()).test(input.toLowerCase()));
export function activityFor(pack,input){const text=input.toLowerCase();let best=null,len=0;for(const a of pack.activities||[])for(const p of [a.name,...a.phrases||[]])if(p&&p.length>len&&phraseRe(p).test(text)){best=a;len=p.length;}return best;}
export function activityBlocked(world,pack,a){if(a.requiresFlag&&!world.flags[a.requiresFlag])return `${a.name} is not available yet.`;if(a.requiresItem&&heldBy(world,a.requiresItem,pack.playerId)<1)return `${a.name} needs ${pack.items.find(i=>i.id===a.requiresItem)?.name||'an item'}.`;if(a.once&&(world.activityUses||{})[a.id])return `You have already done that: ${a.name}.`;if(a.perDay&&((world.activityDayUses||{})[a.id]?.day===calendarFor(world.tick,pack).day&&(world.activityDayUses||{})[a.id].count>=a.perDay))return `You have had enough of that for today: ${a.name}.`;if(a.minTrust!==undefined&&(world.modules['social.relationships']?.edges[`${a.character}--${pack.playerId}`]||0)<a.minTrust)return `${world.actors[a.character]?.name} is not ready for that yet.`;const lock=rankLock(world,pack,a);if(lock)return `${a.name} unlocks at ${lock.name||lock.id} with ${world.actors[a.character]?.name}.`;const from=world.actors[pack.playerId].location,path=pack.modules['world.calendar']&&a.location&&a.location!==from&&routeBetween(pack,from,a.location,world.flags),closed=path&&closedReason(pack,world,world.tick+path.length-1,a.location);if(closed)return `${pack.locations.find(l=>l.id===a.location)?.name||a.location} is closed right now${closed!=='closed'?`: ${closed}`:''}.`;return null;}
// "Wear the leather jacket" / "take off the cufflinks" are equipment actions, settled without the model.
const STOP=new Set(['a','an','the','to','of','and','i','my','at','in','on','with','for','just','what','he','she','her','his','is','it']),words=t=>t.toLowerCase().replace(/\[[^\]]*\]/g,'').match(/[\p{L}\d']+/gu)?.filter(w=>!STOP.has(w))||[];
// Typed text picks a scripted choice when it carries most of the choice's words ("I get to work" -> "Just get to work"),
// or an authored choice phrase, or a stat's approach words when one check in the beat uses that stat ("I stare the swan down" -> [Nerve] Stare it down).
const APPROACH={charm:['flirt','smile','wink','compliment','charm','sweet talk','win him over','win her over','win them over','schmooze','butter up','work the room'],nerve:['stare','dare','confront','stand up to','stand my ground','step in','step between','get between','go for it','kiss','take a chance','risk it','call his bluff','call her bluff'],wit:['joke','quip','banter','outsmart','outwit','figure out','work out','trick','haggle','spot','puzzle','deduce','heckle','comeback','clever'],empathy:['listen','comfort','reassure','understand','gently','softly','sympathise','sympathize','be there for','ask how','ask why','hear him out','hear her out','hear them out']};
const NEGATED=/\b(?:don'?t|do not|not|never|won'?t|refuse to)\b/i,approachRe=p=>{const q=p.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp('(?<![\\p{L}])'+(/e$/.test(q)?q.slice(0,-1)+'(?:e|es|ed|ing)':q+'(?:s|es|ed|ing)?')+'(?![\\p{L}])','u');};
export function choiceFor(available,input,beat=null,stats=null){const said=new Set(words(input)),text=input.toLowerCase(),open=available.filter(a=>a.type==='story.choose'&&!a.disabledReason);
  // A name inside a label ("I snap right back at Jana.") is not a choice word: saying her name plus "do it right" is not snapping back.
  const scored=open.map(a=>{const w=words(a.label.replace(/(?<=\S\s+)\p{Lu}[\p{L}']*/gu,'')),n=w.filter(x=>said.has(x)).length;return {a,n,s:w.length?n/w.length:0};}).sort((x,y)=>y.s-x.s);if(scored[0]?.s>=0.6)return scored[0].a;if(NEGATED.test(input))return null;
  let best=null,len=0;for(const a of open)for(const p of beat?.choices?.find(c=>c.id===a.args.choice)?.phrases||[])if(p.length>len&&approachRe(p).test(text)){best=a;len=p.length;}if(best)return best;
  if(scored[0]?.s>=0.5&&scored[0].n>=2&&scored[0].s>(scored[1]?.s||0))return scored[0].a;
  const hit=new Set((stats||Object.keys(APPROACH).map(id=>({id}))).filter(d=>(d.phrases||APPROACH[d.id]||[]).some(p=>approachRe(p).test(text))).map(d=>d.id));if(hit.size!==1)return null;
  const [stat]=hit,checks=open.filter(a=>a.check?.stat===stat);return checks.length===1?checks[0]:null;}
export function gearFor(available,pack,input){const m=/^\s*(?:i\s+)?(equip|wear|put on|change into|don|unequip|remove|take off)\b/i.exec(input);if(!m)return null;const type=/^(unequip|remove|take off)$/i.test(m[1])?'items.unequip':'items.equip',said=new Set(words(input));let best=null,score=0;for(const i of pack.items||[])if(i.slot){const w=words(i.name),s=w.filter(x=>said.has(x)).length/(w.length||1);if(s>score){best=i;score=s;}}if(score<0.5)return null;return available.find(a=>a.type===type&&a.args?.item===best.id)||{type,args:{item:best.id}};}
export function sceneFallback(turn){
  const outcomes=turn.events.filter(e=>!ECHO.has(e.type)&&(e.visibility==='public'||e.visibility?.includes(turn.command.actorId))).map(e=>e.payload.text).filter(Boolean);
  return [...outcomes,'(The model’s reply could not be used. Retry this turn.)'].join('\n');
}
import {scenePlanForTurn} from '../core/scene-plan.mjs';
import {guardSceneLines,stripStateSyntax,dropRepeats,dropAdvances,dropStock} from './untrusted-output.mjs';
import {beatDirection,topicExhaustion} from './beats.mjs';
import {incidentBrief,incidentCast} from '../modules/scenes.mjs';
import {parseInvite,isRepeat} from '../modules/social.mjs';
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
      const first=firstBrief(world,pack);
      if(first&&['kiss','night'].includes(first.rung)&&typedStop(request.input))proposal={type:'social.stopFirst',args:{}};
      else if(exact)proposal={type:exact.type,args:exact.args};
      else if(first)proposal={type:'core.scene',args:{text:request.input.trim(),location:world.actors[pack.playerId].location,characters:[first.character],activity:world.scene?.characters?.length===1&&world.scene.characters[0]===first.character?'continue':'talk'}};
      else if(world.modules['story.scenes']?.pending){const scene=pack.scriptedScenes.find(x=>x.id===world.modules['story.scenes'].pending),beat=scene?.beats?.find(x=>x.id===world.modules['story.scenes'].pendingBeat)||scene;const pick=choiceFor(available,request.input,beat,pack.statDefinitions),gear=!pick&&gearFor(available,pack,request.input);if(pick)proposal={type:pick.type,args:pick.args};else if(gear)proposal={type:gear.type,args:gear.args};else if(/^(leave|walk away|step away|excuse myself)\b/i.test(request.input.trim()))proposal={type:'story.leave',args:{scene:scene.id}};else if(beat?.allowInput!==false)proposal={type:'story.respond',args:{text:request.input.trim()}};else return {clarification:'Choose one of the available options to continue this scene.',state:world};}
      else if(pack.modules['world.economy']&&/^\s*(?:buy|purchase|sell)\b/i.test(request.input)){
        const wanted=/^\s*sell\b/i.test(request.input)?'world.sell':'world.buy';
        const matches=available.filter(a=>a.type===wanted&&request.input.toLowerCase().includes(pack.items.find(i=>i.id===a.args.item)?.name.toLowerCase()));
        if(matches.length===1&&matches[0].enabled)proposal={type:matches[0].type,args:matches[0].args};
        else if(matches.length===1)return {clarification:matches[0].reason||'That item is unavailable.',state:world};
        else return {clarification:matches.length?'Which item? Name one item to '+(wanted==='world.buy'?'buy':'sell')+'.':'That item is not available at this shop.',state:world};
      }
      else if(world.scene&&/^\s*(?:goodbye|bye|end (?:the )?(?:conversation|scene)|say goodbye)\s*[.!]?\s*$/i.test(request.input))proposal={type:'core.endScene',args:{}};
      else if(!isSpeech(request.input)&&(activity=activityFor(pack,deeds(request.input)))&&!strayActivity(world,pack,activity,request.input)){const blocked=activityBlocked(world,pack,activity);if(blocked)return {clarification:blocked,state:world};proposal={type:'core.scene',args:{text:request.input.trim(),location:activity.location,characters:activity.character?[activity.character]:[],activity:'other',activityId:activity.id,itemAction:'',itemId:'',itemTarget:''}};}
      else if((gear=gearFor(available,pack,request.input)))proposal={type:gear.type,args:gear.args};
      else if(pack.modules['social.conversation']&&(invite=parseInvite(world,pack,request.input)))proposal={type:'social.invite',args:invite};
      else if(this.provider instanceof MockProvider){
        const old=await this.provider.interpret(request.input,contextFor(world,pack,pack.playerId,null,request.input),available,signal);
        if(old.type!=='clarify'&&!(old.type==='social.speak'&&!/^(talk to |say |tell )/i.test(request.input)))proposal=old;
        else if(old.type==='clarify'&&/\b(teleport|set trust|system prompt|give me)\b/i.test(request.input))proposal=old;
      }
      if(!proposal&&typeof this.provider.interpretScene!=='function')proposal=await this.provider.interpret(request.input,contextFor(world,pack,pack.playerId,null,request.input),available,signal);
      const speech=isSpeech(request.input),done=deeds(request.input);
      // Whole words only, and never on a speech line: "Ask what she is reading" is not the reading activity, "missing" is not "sing".
      const soloRequested=!speech&&/\b(read|study|sketch|draw|write|paint|practice|exercise|work|cook|clean|tidy|organize|organise|watch|observe|relax|shower|bathe|eat|drink)\b/i.test(done);
      const actionWords=!speech&&(soloRequested||/\b(go|leave|exit|travel|sleep|rest|visit|head to|move to|take|grab|pick up|give|drop|place|equip|unequip|search|inspect|use)\b/i.test(done)||/^\s*(?:go\s+)?meet\b/i.test(done));
      const mentions=pack.actors.filter(a=>a.id!==pack.playerId&&(' '+request.input.toLowerCase().split(/[^\p{L}\p{N}_-]+/u).join(' ')+' ').includes(' '+a.name.toLowerCase()+' ')).map(a=>a.id);
      const currentLocation=world.actors[pack.playerId].location;
      const liveCast=(world.scene?.location===currentLocation?world.scene.characters:[]).filter(id=>world.actors[id]?.location===currentLocation);
      const activityRequested=!speech&&(pack.activities||[]).some(a=>[a.name,...a.phrases||[]].some(p=>p&&phraseRe(p).test(done.toLowerCase()))&&!strayActivity(world,pack,a,request.input));
      // With no conversation open, "her/them" points at whoever is standing here: one person, or everyone for "them".
      // A gendered pronoun skips people whose pronouns say otherwise; just after naming someone who is elsewhere, it means them, so it stays unresolved.
      const said=/\b(them|they)\b/i.test(request.input)?null:/\b(her|she)\b/i.test(request.input)?/\b(she|her)\b/i:/\b(him|he)\b/i.test(request.input)?/\b(he|him)\b/i:null,fits=id=>{const pr=pack.actors.find(a=>a.id===id)?.pronouns;return !said||!pr||said.test(pr);};
      const lastNamed=(({args}={})=>[...(args?.characters||[]),args?.target].filter(Boolean))(Object.values(world.turns).at(-1)?.command),here=pack.actors.filter(a=>a.id!==pack.playerId&&world.actors[a.id]?.location===currentLocation&&fits(a.id)).map(a=>a.id);
      const pronoun=!mentions.length&&!lastNamed.some(id=>world.actors[id]?.location!==currentLocation)&&/\b(her|him|them|they|she|he)\b/i.test(request.input),pronounCast=!pronoun?[]:liveCast.length?liveCast:here.length===1||!said?here:[];
      // Talking *about* someone elsewhere ("I'm nervous about the meeting with Ada") discusses them; it does not summon them.
      // The person named right after the verb ("Ask Brin …") is still addressed even when absent, so that fails honestly.
      const addressee=speech?mentions.find(id=>new RegExp(`^\\s*(?:i\\s+)?\\S+(?:\\s+(?:to|with))?\\s+${pack.actors.find(a=>a.id===id).name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(request.input)):null;
      // Mid-conversation an absent name is only summoned when called out ("Brin!", "Hey Brin, …"); "I was with Brin" is news.
      const vocative=id=>{const n=pack.actors.find(a=>a.id===id).name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp(`^\\s*(?:(?:hey|hi|hello|yo|oi)[,!]?\\s+${n}\\b|${n}\\s*(?:[,!?:]|$))`,'i').test(request.input);};
      const addressed=speech?mentions.filter(id=>id===addressee||world.actors[id]?.location===currentLocation):liveCast.length&&!actionWords?mentions.filter(id=>world.actors[id]?.location===currentLocation||vocative(id)):mentions;
      const previous=Object.values(world.turns).at(-1),previousTarget=previous?.command.type==='social.speak'?previous.command.args.target:null;
      if(!proposal&&!activityRequested&&!actionWords&&!previousTarget&&!mentions.length&&/\b(her|him|them)\b/i.test(request.input)&&liveCast.length!==1&&!(!liveCast.length&&pronounCast.length)&&!(liveCast.length>1&&/\b(them|they)\b/i.test(request.input)&&!/\b(her|him)\b/i.test(request.input)))return {clarification:liveCast.length||here.length?'Who do you mean? '+(liveCast.length?liveCast:here).map(id=>world.actors[id].name).join(' or '):'Who do you mean? Nobody else is here.',state:world};
      if(!proposal&&!activityRequested&&!actionWords&&previousTarget&&world.actors[previousTarget]?.location===world.actors[pack.playerId].location&&addressed.every(id=>id===previousTarget))proposal={type:'social.speak',args:{target:previousTarget,text:request.input.trim()}};
      if(!proposal&&world.scene&&liveCast.length===world.scene.characters.length&&!activityRequested&&!actionWords&&addressed.every(id=>world.scene.characters.includes(id)))proposal={type:'core.scene',args:{text:request.input.trim(),location:world.scene.location,characters:world.scene.characters,activity:'continue'}};
      if(!proposal){const verdict=await this.provider.interpretScene(request.input,world,pack,signal);
        // A local model may turn an ordinary private activity into a conversation merely because an NPC shares
        // the location. Unless the player names someone, common solo verbs always stay solo.
        if(pronounCast.length&&!soloRequested){verdict.characters=pronounCast;if(!['talk','meet','continue'].includes(verdict.activity))verdict.activity='talk';}
        else if(!mentions.length&&(soloRequested||actionWords&&!world.scene)){verdict.characters=[];if(verdict.activity==='talk'||verdict.activity==='meet')verdict.activity='explore';}
        // Talking about a plan ("let's go to the beach on Sunday") is conversation, not a move: the model hears it, nobody travels.
        const movementRequested=!speech&&!futurePlan(request.input)&&/\b(go|leave|exit|travel|meet|visit|head|move|walk|run|return|follow|sleep|rest|find|look for|track down|catch up with|join)\b/i.test(done),namedLocation=movementRequested?resolveSceneLocation(pack,request.input):null;
        if(namedLocation)verdict.location=namedLocation;
        // "Go find Abigail" names a person, not a place: go where she is now instead of letting the engine turn you away.
        const sought=movementRequested&&!namedLocation&&mentions.find(id=>world.actors[id]?.location!==currentLocation&&!(verdict.mentionedOnly||[]).includes(id));if(sought){verdict.location=world.actors[sought].location;verdict.characters=[...new Set([sought,...verdict.characters.filter(id=>world.actors[id]?.location===verdict.location)])];if(!verdict.activityId)verdict.activity='meet';}
        else if(pronounCast.length&&!namedLocation)verdict.location=currentLocation;
        if(!movementRequested&&!activityRequested&&!soloRequested){verdict.location=currentLocation;verdict.characters=addressed.length?addressed:liveCast.length?liveCast:pronounCast;verdict.activity=verdict.characters.length?'talk':'explore';verdict.activityId='';}
        const rule=(pack.activities||[]).find(a=>a.id===verdict.activityId),location=rule?.location||verdict.location||(verdict.activity==='rest'?pack.daypart?.introLocation||pack.startOptions?.[0]?.playerLocation||null:verdict.activity==='meet'&&verdict.characters.length?world.actors[verdict.characters[0]].location:null)||(mentions.some(id=>world.actors[id]?.location===currentLocation)?currentLocation:null);
        // Mid-conversation, movement that names no place ("I'll get out of your hair", "head out") is the scene's goodbye: the model plays it, nobody is asked where to go.
        if(movementRequested&&!location&&liveCast.length&&!rule){proposal={type:'core.scene',args:{text:request.input.trim(),location:currentLocation,characters:liveCast,activity:liveCast.length===world.scene.characters.length?'continue':'talk'}};}
        else{if(movementRequested&&!location)return {clarification:`Where do you want to go? Try ${pack.locations.map(l=>l.name).join(', ')}.`,state:world};const ruleBlocked=rule&&activityBlocked(world,pack,rule);if(ruleBlocked)return {clarification:ruleBlocked,state:world};proposal={type:'core.scene',args:{text:request.input.trim(),location,characters:rule?.character?[...new Set([...verdict.characters,rule.character])]:verdict.characters,activity:verdict.activity,activityId:rule?.id||'',itemAction:verdict.itemAction||'',itemId:verdict.itemId||'',itemTarget:verdict.itemTarget||''}};}}
    }
    // social.speak is validated by its own command (target exists, co-located, text bounds); running it through
    // parseIntent would demand a suggestion button, breaking typed conversation once the authored topics run dry.
    assert(proposal,'Missing command');if(proposal.type==='core.wait'&&typeof proposal.args?.until==='string')proposal={type:'core.wait',args:{until:proposal.args.until}};// "Skip to Evening": the engine checks the daypart
    else if(!['core.scene','story.respond','social.invite','social.speak','items.equip','items.unequip'].includes(proposal.type))proposal=parseIntent(proposal,available);
    if(proposal.type==='clarify')return {clarification:proposal.args.question,state:world};
    // Re-asking something the person already heard costs their patience in life and a tick here: answer for free
    // (0-tick clarification, no turn committed) instead of charging for a deflection the model has to invent.
    if(proposal.type==='social.speak'&&request.input!==undefined&&pack.modules['social.conversation']){const heard=(world.modules['social.conversation'].memories||[]).filter(x=>x.knownBy.includes(proposal.args.target)).map(x=>x.topic);if(isRepeat(proposal.args.text,heard))return {clarification:`You already said that to ${world.actors[proposal.args.target].name}, and they have nothing new to add. Try a different topic.`,state:world};}
    assert(!signal?.aborted,'Cancelled before commit');
    const result=execute(world,{...proposal,...(pack.gameProject?.conversationStyle==='continuous'&&EXCHANGE_COMMANDS.has(proposal.type)?{deferExchangeCap:true}:{}),id:request.id,actorId:pack.playerId,expectedRevision:request.expectedRevision},pack,this.registry);
    if(request.input!==undefined)result.turn.input=request.input;
    this.store.commit(result.state,world.revision);return await this.finish(id,request.id,signal);
  }finally{this.locks.delete(id);this.previews.delete(id);}}
  async finish(id,turnId,signal,retry=false){const world=this.store.load(id),pack=this.packs[world.packId],turn=world.turns[turnId];assert(turn,'Unknown turn');if(retry)assert(turn.status==='complete'&&turn.fallback,'Only a failed generated turn can be retried');else if(turn.status==='complete')return {state:world,turn};
    const scripted=pack.scriptedScenes?.find(s=>s.id===world.modules['story.scenes']?.pending);
    const opened=turn.events.some(e=>e.type==='story.sceneStarted');
    // A director incident brings its cast to the player; a typed turn is then a model scene with them in it (never pasted), and a
    // sub-turn shows only the arrival cue, not an authored paragraph that may name another place or invent history.
    const incident=Boolean(scripted&&incidentCast(pack,scripted.id).length),cue=turn.events.find(e=>e.type==='story.sceneStarted'&&e.payload.incident)?.payload.text;
    if((scripted&&turn.command.type!=='story.respond'&&(incident?opened&&(turn.input===undefined||RULES_ONLY.has(turn.command.type)):opened||!rulesOnly(turn)))||turn.command.type==='story.choose'){
      const beat=scripted?.beats?.find(b=>b.id===world.modules['story.scenes']?.pendingBeat)||scripted;
      let opening=beat?.opening,drafted=false;
      if(incident)opening=cue||'';else if(opened&&scripted?.template&&pack.directorProfile?.textMode==='draft'&&typeof this.provider.complete==='function')try{
        const roles=Object.fromEntries(Object.entries(scripted.template.roles||{}).map(([role,id])=>[role,pack.actors.find(a=>a.id===id)?.name||id]));
        const raw=await this.provider.complete([{role:'system',content:'Rewrite the approved opening as one short paragraph of vivid presentation prose. Keep the same characters, location, event, and outcome. Do not add actions by the player, new characters, choices, rewards, deadlines, promises, or state changes. Return plain prose only.'},{role:'user',content:JSON.stringify({approvedOpening:opening,template:scripted.template.id,kind:scripted.template.kind,roles,style:pack.gameProject?.writingStyle||''})}],signal);
        const safe=stripStateSyntax(raw)?.trim();if(safe&&safe.length<=1000&&!/[\r\n]/u.test(safe)){opening=safe;drafted=true;}
      }catch{/* Keep the approved opening when optional drafting fails. */}
      const told=e=>['story.choiceResolved','world.activityCompleted'].includes(e.type)?0:1,outcome=turn.events.filter(e=>OUTCOME_EVENTS.has(e.type)&&e.payload?.text).sort((x,y)=>told(x)-told(y)).map(e=>({speaker:'',text:e.payload.text})),lines=[...(RULES_ONLY.has(turn.command.type)?rulesText(world,pack,turn).split('\n').map(t=>({speaker:'',text:t})):[]),...outcome,...(beat&&opening?[{speaker:'',text:opening},...(incident?[]:beat.pages||[])]:[])];
      const text=lines.map(line=>`${line.speaker?`${pack.actors.find(a=>a.id===line.speaker)?.name}: `:''}${line.text}`).join('\n');
      const state=this.store.narrative(id,turnId,text,{sceneLines:lines,ledger:[],fallback:false,retry,provider:drafted?this.provider.name:'Authored scene',promptVersion:drafted?'director_draft_v1':'authored_scene_v1'});return {state,turn:state.turns[turnId]};
    }
    if(RULES_ONLY.has(turn.command.type)){const text=rulesText(world,pack,turn);const state=this.store.narrative(id,turnId,text,{sceneLines:text.split('\n').map(t=>({speaker:'',text:t})),ledger:[],fallback:false,retry,provider:'Game rules',promptVersion:'rules_v1'});return {state,turn:state.turns[turnId]};}
    if(turn.command.type==='core.endScene'){
      const text=fallback(turn);const state=this.store.narrative(id,turnId,text,{sceneLines:[{speaker:'',text}],ledger:[],fallback:false,retry,provider:'Game rules',promptVersion:'scene_end_v1'});return {state,turn:state.turns[turnId]};
    }
    // A typed turn the map turns away is still a model scene where the player stands; the refusal is a fact in its direction (Venus rebase).
    const blockedBy=turn.events.find(e=>['core.travelBlocked','world.meetingUnavailable','world.meetingRedirect'].includes(e.type)),typedBlock=Boolean(blockedBy&&turn.input!==undefined);
    const refused=turn.events.some(e=>e.type==='social.inviteDeclined')||!typedBlock&&blockedBy&&!turn.events.some(e=>['core.sceneStarted','core.sceneContinued','world.hangoutStarted'].includes(e.type)&&((e.payload.characters||[]).length||e.payload.char));
    if(refused){const text=fallback(turn);const state=this.store.narrative(id,turnId,text,{sceneLines:[{speaker:'',text}],ledger:[],fallback:false,retry,provider:'Game rules',promptVersion:'attendance_v1'});return {state,turn:state.turns[turnId]};}
    if(turn.command.type==='world.nextDaypart'){
      const context=daypartContext(world,pack,turn);let artifact,failed=false,failureReason='';
      try{artifact=validateDaypart(await this.provider.generateDaypart(context,signal),context);}catch(e){failed=true;failureReason=e.name==='AbortError'?'Model request timed out or was cancelled':String(e.message||e).slice(0,350);artifact=fallbackDaypart(context);}
      const state=this.store.narrative(id,turnId,artifact.lines.join('\n'),{artifact,sceneLines:artifact.lines.map(text=>({speaker:'',text})),fallback:failed,failureReason:failed?failureReason:null,retry,contextSources:[...context.recently.map(e=>e.source),...context.lorebook.map(e=>e.id)],promptVersion:'daypart_intro_v2',provider:this.provider.name});
      return {state,turn:state.turns[turnId]};
    }
    const scenePlan=scenePlanForTurn(world,pack,turn),onStage=scenePlan.cast,actor=scenePlan.actor;
    const context=contextFor(world,pack,actor,turn,turn.input||turn.command.args.text||turn.command.args.target||'',{wide:true});
    const cast=scenePlan.cast;context.scenePlan=scenePlan;context.sceneWriter=world.sceneWriter??'framework';
    context.stagedCast=cast;context.speakers=scenePlan.speakers;context.absentCharacters=pack.actors.filter(a=>a.id!==pack.playerId&&!cast.includes(a.id)).map(a=>({id:a.id,name:a.name,rule:'Not in this scene. May be discussed, but cannot appear, speak, arrive, or interact.'}));context.knownFacts=pack.modules['story.facts']?effectiveGeneratedFacts(world):[];context.sceneHistory=sceneTranscript(world,turn,cast);context.sceneSummary=world.scene?.summary||null;context.pastScenes=closedScenes(world,cast,pack);context.scenePhase=context.sceneHistory.length?'continuation':cast.length?'opening':'solo';// Continuous scenes carry no input budget (they end on a model or player ending only), so budgetDone can only
// fire for authored game-tier packs — or a continuous scene opened before that rule, which the style check retired.
const continuousPack=pack.gameProject?.conversationStyle==='continuous';
const budgetDone=Boolean(world.scene?.budget&&cast.length&&world.scene.inputs>=world.scene.budget&&!continuousPack);if(world.scene?.focus&&cast.length)context.sceneBudget={...(world.scene.budget?{budget:world.scene.budget,inputs:world.scene.inputs}:{}),focus:world.scene.focus};if(budgetDone)context.scenePhase='closing';context.dailyNeedHints=cast.map(id=>{const hint=dailyNeedHint(world,pack,id);return hint?`${world.actors[id].name}: ${hint}`:'';}).filter(Boolean).join('; ');context.actTags=actsEnabled(context,pack)?ACTS_RULE:'';if(context.actTags)context.actBrief=(await import('../modules/acts.mjs').catch(()=>null))?.narratorBrief?.(world,pack,context.sceneBudget.focus)||[];context.typedActivity=turn.command.type==='core.scene'&&Boolean(turn.command.args?.activityId||['explore','other','work'].includes(turn.command.args?.activity||''));context.playerAction=turn.input||turn.command.args.text||turn.events.find(e=>e.type!=='core.patch'&&e.payload.text)?.payload.text||turn.command.type;
    const hung=[...(context.pastScenes||[])].reverse().find(x=>x.unansweredQuestion&&cast.some(id=>pack.actors.find(a=>a.id===id)?.name===x.unansweredQuestion.by));if(hung)context.hangingAsk=hung.unansweredQuestion;
    const spokenBefore=[...context.sceneHistory.flatMap(h=>world.turns[h.source]?.sceneLines||[]),...(context.stagedCast||[]).flatMap(id=>[].concat(pack.actors.find(a=>a.id===id)?.examples||[]).map(text=>({speaker:id,text})))];context.spokenBefore=spokenBefore;context.openThreads=[...(context.plans||[]).map(x=>({kind:'plan',character:x.character,text:x.plan,due:x.deadlineTick})),...(context.memories||[]).filter(m=>m.promise).slice(-4).map(m=>({kind:'promise',text:m.text}))];context.direction=beatDirection(context,pack,world.scene?.id||turnId);context.baseDirection=context.direction;context.calmDirection=beatDirection({...context,continuationStyle:'calm'},pack,world.scene?.id||turnId);const brief=incidentBrief(world,pack,world.modules['story.scenes']?.pending);if(brief)context.direction=[context.direction,`Right now: ${brief}`].filter(Boolean).join(' ');if(typedBlock&&blockedBy.payload?.text)context.direction=[context.direction,`The player does not go anywhere this turn: ${blockedBy.payload.text} Show that plainly in the scene; nobody moves.`].filter(Boolean).join(' ');if(context.hangingAsk)context.openThreads=[...(context.openThreads||[]),{kind:'question',character:context.hangingAsk.by,text:`asked the player: "${context.hangingAsk.text}" — never answered`}];
    // Physical contact an NPC initiates is only in character once romance has reached the crush stage; the lint
    // needs that per-cast verdict because the narration prompt alone does not stop small models from escalating.
    const datingPhases=Object.fromEntries((context.dating||[]).map(row=>[row.character,row.phase]));context.touchStage=Object.fromEntries(cast.map(id=>[id,['crush','dating','exclusive'].includes(datingPhases[id])]));
    // Secrecy (M4): a suspecting cast member shows it through behavior; an active confrontation gets the evidence brief and the claim classifier.
    if(pack.modules['social.secrecy']&&cast.length){const sec=await import('../modules/secrecy.mjs').catch(()=>null);if(sec?.suspicionLinesFor){const suspicionLines=sec.suspicionLinesFor(world,pack,cast);if(suspicionLines.length)context.suspicions=suspicionLines;const confrontation=sec.confrontationFor(world,pack,cast);if(confrontation){context.confrontation=confrontation;context.claimsTags=CLAIMS_RULE;}}}
    const first=firstBrief(world,pack),firstStarted=turn.events.some(e=>e.type==='social.firstStarted');
    if(first&&cast.includes(first.character)){
      context.first=first;context.scenePhase=context.sceneHistory.length?'continuation':'opening';
      context.sceneBudget={...context.sceneBudget,focus:first.character};
      context.actTags=!firstStarted&&actsEnabled(context,pack)?ACTS_RULE:'';
      context.actBrief=context.actTags?(await import('../modules/acts.mjs')).narratorBrief(world,pack,first.character):[];
      context.direction='Stay in this moment, don’t skip past it. Respond to the player within the current checkpoint and leave room for their next input.';
    }
    // Intimacy hard rule: without a consented, active encounter in state the lint caps prose at suggestive whatever the pack allows, and the prompt says how to decline.
    if(pack.modules['social.intimacy']&&cast.length){const intimate=world.modules['social.intimacy']?.characters||{},open=cast.some(id=>intimate[id]?.active),drunk=cast.filter(id=>sobrietyLevel(world,pack,id)!=='sober').map(id=>pack.actors.find(a=>a.id===id)?.name||id);context.intimacyGate={open};if(!open)context.intimacyRule='Nothing sexual happens in this scene. If the player pushes for more, the character turns it down in their own way.'+(drunk.length?` ${drunk.join(' and ')} ${drunk.length>1?'have':'has'} been drinking: any move gets a warm but firm "ask me again when I'm sober".`:'');}
    const topicDry=continuousPack&&Boolean(world.scene)&&!world.modules['story.scenes']?.pending&&!world.modules['social.firsts']?.active&&topicExhaustion(context);
    if(topicDry){context.scenePhase='closing';context.direction='Answer the player on the current topic, then let the character gently bring this conversation to a close. The same request has repeated without a new subject; do not invent a fresh crisis, appointment, or question to keep it going.';}
    const repeatAsk=turn.events.find(e=>e.type==='social.spoke'&&e.payload.repeat);context.repeatAsk=repeatAsk?pack.actors.find(a=>a.id===repeatAsk.payload.target)?.name||null:null;
    if(pack.modules['social.acts']){const cue=(await import('../modules/acts.mjs')).flirtDepartureCue(world,pack),left=turn.events.filter(e=>e.type==='social.departed').map(e=>e.payload.text).join(' ');if(cue||left)context.direction=[context.direction,cue,left].filter(Boolean).join(' ');}
    const budgeted=budgetSceneContext(context,pack,world,turnId,{window:this.provider.contextWindow||8192,reply:replyReserve(this.provider.usage,this.provider.maxTokens||1800,512,5,this.provider.contextWindow||8192),ratio:this.provider.calibration?.ratio||1,verbatim:this.provider.contextSize?contextPreset(this.provider.contextSize,this.provider.remote).verbatim:Infinity,render:c=>scenePromptMessages(c,pack),wideContext:this.provider.wideContext});Object.assign(context,budgeted.context);const contextReport=budgeted.report;
    let priced=[],claimStance=null,text,visualLines,failed=false,sceneEnded=false,sceneSummary='',lintTrace=[],bundledMemories=[],bundledFacts=[];
    let failureReason='';try{if(typeof this.provider.generateScene==='function'){
      const previewLines=[];const response=await this.provider.generateScene(context,pack,signal,lines=>{previewLines.push(...lines);try{const safe=sanitizeSceneResponse({lines:guardSceneLines(previewLines,scenePlan.speakers,pack)},pack,world,cast).lines;this.previews.set(id,{turnId,lines:safe,authoritative:false});}catch{}});
      lintTrace=response.lintTrace||[];
      const raw=response.plain?{lines:sceneLines(stripStateSyntax(response.plain),pack,actor)}:{...response};raw.lines=dropStock(dropRepeats(guardSceneLines(raw.lines,scenePlan.speakers,pack),spokenBefore,context.playerAction));if(!pack.modules?.['social.intimacy'])raw.lines=dropAdvances(raw.lines,context.playerAction);
      const sanitized=sanitizeSceneResponse(raw,pack,world,cast);visualLines=sanitized.lines;
      sceneEnded=Boolean(world.scene&&sanitized.end&&cast.length);
      sceneSummary=sanitized.summary;if(context.actTags){const focus=context.sceneBudget.focus,her=pack.actors.find(a=>a.id===focus),before=Object.entries(world.turns||{}).filter(([k,t])=>k!==turnId&&(t.command?.args?.target===focus||t.command?.args?.characters?.includes(focus))).map(([,t])=>t.command.args.text);priced=typedDislike(typedListen(sceneActs(response.acts),context.playerAction,her),context.playerAction,her,(pack.actProfiles||[]).find(x=>x.character===focus),before);}
      if(context.claimsTags)claimStance=sceneClaims(response.claims);
      if(this.provider.bundlesSceneMetadata){bundledMemories=ledgerMemories({memories:response.memories},pack,turn);bundledFacts=Array.isArray(response.facts)?response.facts:[];}
      text=visualLines.map(line=>`${line.speaker?`${pack.actors.find(a=>a.id===line.speaker).name}: `:''}${line.text}`).join('\n');
    }else text=stripStateSyntax(await this.provider.narrate(context,signal));assert(typeof text==='string'&&text.trim()&&text.length<=20000,'Invalid narrative');}catch(e){failed=true;failureReason=e.name==='AbortError'?'Model request timed out or was cancelled':String(e.message||e).slice(0,350);text=turn.command.type==='core.scene'?sceneFallback(turn):fallback(turn);}
    let ledger=[];if(!failed)ledger=this.provider.bundlesSceneMetadata?bundledMemories:typeof this.provider.generateLedger==='function'?await this.provider.generateLedger(turn,text,pack,signal):[];
    let generatedFacts=[];const factCandidate=turn.events.some(e=>['core.sceneStarted','core.sceneContinued','social.spoke','world.hangoutStarted','story.sceneStarted','story.sceneResumed'].includes(e.type));if(!failed&&factCandidate&&pack.modules['story.facts'])try{const rawFacts=this.provider.bundlesSceneMetadata?bundledFacts:typeof this.provider.generateFacts==='function'?await this.provider.generateFacts(turn,text,pack,signal):[];generatedFacts=validateGeneratedFacts(rawFacts,pack,turn,text);}catch{generatedFacts=[];}
    // A continuous scene is closed by the engine (core.endScene), so the clock and attendance settle like any other exit.
    const continuous=pack.gameProject?.conversationStyle==='continuous',settled=world.scene&&cast.length&&!failed?{sceneId:world.scene.id,sceneSummary:sceneSummary||world.scene.summary||'',sceneEnded:sceneEnded&&!continuous&&!budgetDone&&!context.first}:{};
    let state=this.store.narrative(id,turnId,text,{sceneRequest:{writer:context.sceneWriter,phase:context.scenePhase,playerAction:context.playerAction,cast,history:context.sceneHistory,...(this.provider instanceof CompatibleProvider?{messages:scenePromptMessages(context,pack)}:{})},scenePlan,sceneLines:visualLines||sceneLines(text,pack,actor),ledger,...(pack.modules['story.facts']?{generatedFacts}:{}),...(lintTrace.length?{lintTrace}:{}),...settled,fallback:failed,failureReason:failed?failureReason:null,retry,...(failed&&!retry&&EXCHANGE_COMMANDS.has(turn.command.type)?{exchangeRefund:world.scene?.id||null}:{}),...(context.loreTrace?.activated?.length?{loreActivations:{tick:context.loreTrace.tick,ids:context.loreTrace.activated.filter(id=>context.lorebook.some(e=>e.id===id))}}:{}),contextSources:[...context.sceneHistory.map(m=>m.source),...context.pastScenes.map(m=>m.source),...context.memories.map(m=>m.source),...context.generatedFacts.map(f=>f.id),...context.lorebook.map(e=>e.id),...context.recentActions.map(e=>e.source)],contextReport,promptVersion:visualLines?'scene_structured_v1':context.promptVersion,provider:this.provider.name},pack);this.previews.delete(id);
    // Model tags become one recorded social.priceActs turn, so replay never calls the model; it lands before the close so the end card sees it.
    if(!failed&&pack.modules['social.acts']&&state.scene&&state.scene.id===world.scene?.id&&(priced.length||Object.values(state.modules['social.acts']?.characters||{}).some(r=>r.departure))) {const actsId=`${turnId}-acts`.slice(0,100);try{const r=execute(state,{type:'social.priceActs',args:{character:context.sceneBudget?.focus||cast[0],sceneId:world.scene.id,source:turnId,private:cast.length===1,acts:priced},id:actsId,actorId:pack.playerId,expectedRevision:state.revision},pack,this.registry);this.store.commit(r.state,state.revision);state=(await this.finish(id,actsId,signal)).state;}catch(e){if(e.name==='AbortError')throw e;}}
    // Empty tags still consume an input. The score command reads engine-priced events, never model numbers.
    const firstInput=['core.scene','social.speak','story.respond'].includes(turn.command.type);
    if(context.first&&!firstStarted&&firstInput&&!failed&&state.modules['social.firsts']?.active?.first===context.first.first){
      const scoreId=`${turnId}-first`.slice(0,100),r=execute(state,{type:'social.scoreFirst',args:{source:turnId,text:context.playerAction},id:scoreId,actorId:pack.playerId,expectedRevision:state.revision},pack,this.registry);
      this.store.commit(r.state,state.revision);state=(await this.finish(id,scoreId,signal)).state;
    }
    // A classified claim prices the confrontation immediately; replay never calls the model (the tag is the recorded command).
    if(claimStance&&!failed&&state.modules['social.secrecy']?.confrontations?.[pack.playerId]?.observer){const claimId=`${turnId}-claim`.slice(0,100);try{const r=execute(state,{type:'social.resolveConfrontation',args:{character:state.modules['social.secrecy'].confrontations[pack.playerId].observer,stance:claimStance},id:claimId,actorId:pack.playerId,expectedRevision:state.revision},pack,this.registry);this.store.commit(r.state,state.revision);state=(await this.finish(id,claimId,signal)).state;}catch(e){if(e.name==='AbortError')throw e;}}
    // Evaluate the safety cap after generation succeeds; a failed last-slot turn must still be refundable.
    const safetyCap=continuous&&state.scene?.characters?.length&&(state.scene.exchanges||0)>=(pack.gameProject?.sceneTurns??12);
    const farewellPending=Object.values(state.modules['social.acts']?.characters||{}).some(r=>r.departure&&r.departure.sceneId===state.scene?.id);
    const closeScene=!farewellPending&&!state.modules['social.firsts']?.active&&(context.first||continuous&&sceneEnded||budgetDone||safetyCap||topicDry);
    if(closeScene&&!failed&&state.scene&&state.scene.id===world.scene?.id){const endId=`${turnId}-end`.slice(0,100);try{const r=execute(state,{type:'core.endScene',args:{reason:topicDry?'topic':safetyCap&&!sceneEnded?'safety':'natural'},id:endId,actorId:pack.playerId,expectedRevision:state.revision},pack,this.registry);this.store.commit(r.state,state.revision);const ended=await this.finish(id,endId,signal);return {state:ended.state,turn:ended.state.turns[turnId]};}catch(e){if(e.name==='AbortError')throw e;}}
    return {state,turn:state.turns[turnId]};
  }
  async retry(id,turnId,signal){assert(!this.locks.has(id),'A turn is already in progress');this.locks.add(id);try{const s=this.store.load(id);assert(Object.values(s.turns).at(-1)?.id===turnId,'Only the latest turn can be retried');return await this.finish(id,turnId,signal,true);}finally{this.locks.delete(id);this.previews.delete(id);}}
  async recover(id){const s=this.store.load(id);for(const t of Object.values(s.turns))if(t.status==='pending')await this.finish(id,t.id);return this.store.load(id);}
}
