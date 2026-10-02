export interface Command { id:string; actorId:string; type:string; args:Record<string,unknown>; expectedRevision:number }
export type TimeMode='clock'|'planner';
export interface PlannerOptions { timeMode?:TimeMode }
export interface PlannerProgress { id:string; endTick:number }
export interface World { planner?:PlannerProgress|null }
export interface Action { planner?:boolean }
export interface Event { id:string; type:string; payload:Record<string,unknown>; tick:number; visibility:'public'|string[] }
export interface World { schemaVersion:number; campaignId:string; packId:string; packVersion:string; packDigest:string; moduleVersions:Record<string,string>; revision:number; tick:number; rng:number; actors:Record<string,{name:string;location:string}>; flags:Record<string,boolean>; modules:Record<string,unknown>; events:Event[]; turns:Record<string,Turn>; migrations?:{tick:number;from:string;to:string;changes:string[]}[] }
export interface Turn { id:string; command:Command; events:Event[]; narrative:string|null; status:'pending'|'complete'; fallback?:boolean; context?:unknown }
export interface Transaction { state:World; pack:unknown; set(path:(string|number)[],value:unknown):void; emit(type:string,payload:Record<string,unknown>,visibility?:'public'|string[]):void; random():number }
export interface Module { id:string; version:string; coreApi:string; requires:string[]; validate?(pack:any):void; init?(pack:any):unknown; commands?:Record<string,(tx:Transaction,args:any)=>void>; react?(tx:Transaction,event:Event):void; actions?(state:World,pack:any):Action[]; panel?(state:World,pack:any):{title:string;lines:string[]} }
export interface Action { label:string; type:string; args:Record<string,unknown> }
export interface TimeCost { ticks:number; display:string }
export interface TimeCostPack { tickMinutes?:number }
export interface Action { cost?:TimeCost }
export interface Provider { interpret(input:string,context:unknown,actions:Action[],signal?:AbortSignal):Promise<{type:string;args:Record<string,unknown>}>; narrate(context:unknown,signal?:AbortSignal):Promise<string> }
export type ActKind='flirt'|'compliment'|'gift'|'touch'|'insult'|'buy'|'invite'|'tease'|'listen'|'boast'|'pushy';
export interface SceneAct { kind:ActKind; target:string; size?:'small'|'medium'|'large'; landed?:boolean; region?:BodyRegion }
export interface ActEntry { id:string; kind:ActKind; target:string; points:number; reason:string; memory?:string; when?:{private:boolean} }
export interface ActEntry { clue?:string; softLabel?:string }
export interface LikesCluesPack { likesOpen?:boolean }
export interface LikeClue { entry:string; source:string; tick:number; text:string; label:string; liked:boolean; from:string|null }
export interface LikesCluesRuntime { likeClues?:LikeClue[] }
export interface LikeClueAddedEvent { character:string; text:string; from:string|null }
export interface LikesCluesView { clues:{text:string;tick:number;from:string|null}[]; likes:{reason:string}[]; dislikes:{reason:string}[] }
export interface ActProfile { character:string; entries:ActEntry[]; fallback?:{landed:number;missed:number}; sizeMultiplier?:{small:number;medium:number;large:number}; sceneCap?:number; repeatDecayPercent?:number }
export interface ActPricedEvent { character:string; sceneId:string; source:string; act:SceneAct; entry:string|null; points:number; verdict:'liked'|'disliked'|'neutral'|'unpaid'; reason:string; memory?:string; text:string }
export interface ActDiscoveredEvent { character:string; entry:string; reason:string; memory?:string }
export interface ArcTrait { id:string; label?:string; initial:number }
export interface ArcDrift { act?:ActKind; target?:string; event?:string; trait:string; delta:number }
export interface ArcStage { id:string; name:string; when:Record<string,number>; voice?:string; flag?:string }
export interface ArcTrack { character:string; traits:ArcTrait[]; drift:ArcDrift[]; stages:ArcStage[] }
export interface TraitChangedEvent { character:string; trait:string; delta:number; value:number }
export interface StageReachedEvent { character:string; stage:string; name:string; text:string }
export interface SobrietyPack { drinkItems:string[]; tipsyAt?:number; drunkAt?:number; soberPerDaypart?:number }

export interface SceneFeedbackPack { chips?:boolean; mood?:boolean }
export interface SlipGuardPack { slipGuard?:{echoWords?:number} }
export interface SceneFeedbackChip { character:string; stat:string; value:number; delta:number }
export interface SceneFeedbackMood { character:string; name:string; score:number; tier:number; label:string }
export interface SceneFeedback { chips:SceneFeedbackChip[]; moods:SceneFeedbackMood[] }
export type UnwelcomeStyle='deflect'|'tease_back'|'shut_down';
export interface UnwelcomeTuning { deflect:{like:number;trust:number;lust:number};tease_back:{like:number;trust:number;lust:number;minTrust:number};shut_down:{like:number;trust:number;lust:number} }
export interface UnwelcomeFlirtPack { unwelcomeFlirt?:UnwelcomeTuning }
export interface SocialPacing { flirt?:{mode:'off'|'cap';dailyLimit?:number}; departure?:{enabled:boolean;graceTurns:number} }
export interface FlirtAllowance { day:number;count:number;cued:boolean }
export interface FlirtDeparture { sceneId:string;destination:string|null;remaining:number;origin:string;lastTurn:string }
export interface ActPricedEvent { capped?:boolean }

export type SheetTrait='warm'|'sporty'|'curious'|'homesick'|'stubborn'|'ambitious'|'composed'|'dry'|'exacting'|'guarded'|'mischievous'|'expressive'|'creative'|'flirtatious'|'rebellious'|'analytical'|'adventurous'|'practical'|'low_drama'|'extroverted'|'loyal'|'insecure'|'reserved'|'patient'|'spontaneous'|'romantic'|'competitive'|'generous';
export type GiftCategory='romantic'|'cute'|'luxury'|'glamour'|'cozy'|'practical'|'nerdy'|'artsy'|'treats'|'edgy'|'vintage'|'novelty';
export type SheetExperience='none'|'first_encounter'|'occasional'|'recurring'|'extensive';
export type BodyRegion='face'|'lips'|'neck'|'arms_hands'|'chest'|'back'|'belly_waist'|'hips_butt'|'thighs_legs'|'intimate';
export type BodyLimit='ok'|'ask_first'|'hard'|'never';
export type SheetCondition=({type:'always'}|{type:'flag';flag:string;value:boolean}|{type:'stat';stat:string;op:'eq'|'lt'|'lte'|'gt'|'gte';value:number}|{type:'stage';stage:string})&{actorId?:string};
export type SheetEffect=({type:'note';text:string}|{type:'stat';stat:string;delta:number}|{type:'flag';flag:string;value:boolean}|{type:'limit';region:BodyRegion;limit:BodyLimit})&{actorId?:string};
export interface SheetRule { id:string;event:string;enabled:boolean;condition:SheetCondition;effect:SheetEffect;notes?:string }
export type SheetSocialLink={id:string;relation:string;notes:string}&({actorId:string;externalName:null}|{actorId:null;externalName:string});
export interface SheetWeeklyStop { weekday:'Monday'|'Tuesday'|'Wednesday'|'Thursday'|'Friday'|'Saturday'|'Sunday';daypart:'Morning'|'Afternoon'|'Evening';location:string;skipHolidays?:boolean }
export interface SheetException { id:string;startTick:number;endTick:number;location:string;notes?:string }
export interface SheetWant { id:string;text:string;keys:string[];reward?:number }
export interface CharacterSheet {
 actorId:string;
 identity:{name:string;age:number|null;pronouns:string;occupation:string;year:string;birthday:string;workplace:string|null;home:string|null;haunts:string[];lifeNotes:string};
 personality:{traits:SheetTrait[];notes:string;voice:string;examples:string[];fingerprint:string};
 appearance:{description:string;style:string;portrait:string;poses:{id:string;image:string;[key:string]:unknown}[];notes:string};
 tastes:{likes:string[];dislikes:string[];likedCategories:GiftCategory[];dislikedCategories:GiftCategory[];itemOverrides:{item:string;reaction:'loved'|'liked'|'neutral'|'disliked'|'hated';points?:number;[key:string]:unknown}[];notes:string};
 dating:{ladderPace?:'slow'|'normal'|'fast';history:string;experience:SheetExperience|null;body:Record<BodyRegion,{sensitivity:0|1|2|3|null;limit:BodyLimit|null}>;preferences:string;limitsNotes:string;policyOverrides:Record<string,unknown>;repairTrustBar?:number|null};
 routine:{weekly:SheetWeeklyStop[];exceptions:SheetException[];notes:string};
 behavior:{unwelcomeStyle?:UnwelcomeStyle;rules:SheetRule[];notes:string;stages:Record<string,string>};
 social:{links:SheetSocialLink[];notes:string};
 arc:{goal:string;tracks:ArcTrack[];payoffs:Record<string,unknown>[];notes:string};
 lore:{backstory:string;entries:Record<string,unknown>[];authorNotes:string};
 source:{actor:Record<string,unknown>;profiles:Record<string,Record<string,unknown>[]>};
 [key:string]:unknown;
}
export interface CharacterSheetPack { characterSheets?:CharacterSheet[] }
export interface BodyIntimacySettings { sensitivityScale?:[number,number,number,number]; hardLimit?:{trust:number;stage:'acquaintance'|'dating'|'exclusive'} }
export interface RegionAgreementRuntime { regionAgreements?:Partial<Record<BodyRegion,string>> }
export interface TouchRefusedEvent { character:string;region?:BodyRegion;step?:string;verdict:'refuse'|'hesitate';reason:string;trustDelta:number;lustDelta:number;text:string }
export interface RelationshipStageSettings { stages?:['acquaintance','dating','exclusive']; strainTrustFloor?:number; strainDays?:number; scar?:{trust?:number;chemistry?:number}; repairDelayDays?:number; repairTrustBar?:number }
export interface RelationshipStagesPack { relationshipStageSettings?:RelationshipStageSettings }
export interface BreakupHistoryEntry { tick:number; from:string; reason:string; scar:{trust:number;chemistry:number} }
export interface AnniversarySettings { interval:number; maxMoments:number; acknowledgeReward?:{like:number}; neglectPenalty?:{like:number} }
export interface AnniversaryPack { anniversarySettings?:AnniversarySettings }
export interface SharedMoment { kind:'firstMeeting'|'firstDate'|'firstKiss'|'firstNight'|'stageChange'|'breakup'|'reunion'; day:number; place:string; from?:string; to?:string }
export interface AnniversaryCharacter { history:SharedMoment[]; firstMeetingDay:number|null; datingStartDay:number|null; lastContactDay:number|null; anniversaryAcknowledged:number|null; mark:number; months:number }

export interface Refusal { code:string; reason:string; alternatives:{label:string;input:string}[]; retry:number; redirect?:boolean }
export interface Turn { refusal?:Refusal|null }
export interface Action { refusal?:Refusal }
export interface World { refusalHistory?:{scene:string;counts:Record<string,number>} }
export interface ActionReply { state:World; turn?:Turn; refusal?:Refusal }

export type RefusalStyle='hint'|'buttons';
export interface RefusalPack { refusalStyle?:RefusalStyle }
export interface Turn { refusalNarrated?:boolean }
export interface DailyNeedMatch { kind:ActKind|'ask'; target?:string }
export interface DailyNeedDefinition { id:string; hint:string; weight?:number; traitWeights?:Record<string,number>; matches:DailyNeedMatch[]; against?:DailyNeedMatch[] }
export interface DailyNeedsPack { reward:{like:number;trust:number}; againstLike:number; needs:DailyNeedDefinition[] }
export interface DailyNeedState { day:number; need:string|null; rewarded:boolean; sources:string[] }
export interface WantSettings { reward?:number; active?:number }
export interface WantPack { wantSettings?:WantSettings }
export interface WantState { week:number; active:string[]; spent:Record<string,number> }
export interface WantFulfilledEvent { character:string; want:string; source:string; points:number; text:string }
export interface LustBaselineTuning { perDaypart?:number; milestones?:{intimateFirst?:number;dating?:number;exclusive?:number;preference?:number}; hint?:string }
export interface LustBaselinePack { lustBaseline?:LustBaselineTuning }
export interface LustBaselineRaisedEvent { character:string; milestone:string; preference?:string; from:number; to:number; delta:number; text:string }
export interface GiftSettings { likedMultiplier:number; dislikedPoints:number; keepsakeMinGain:number; keepsakeLimit:number }
export interface GiftPack { giftRepeatScale?:number[]; giftSettings?:GiftSettings }
export interface GiftItem { categories?:GiftCategory[] }
export interface GiftKeepsake { item:string; tick:number; gain:number }
export interface GiftRuntime { giftCounts?:Record<string,number>; keepsakes?:GiftKeepsake[] }
export interface JealousySettings { max?:number; decayPerDay?:number; coolAt?:number; confrontAt?:number; trustDelta?:number; acquaintanceScale?:number; likeFloor?:number; flirtAmount?:number; intimacyAmount?:number; rumorAmount?:number }
export interface JealousyProfile { character:string; insecureMultiplier?:number; guardedMultiplier?:number; competitiveMultiplier?:number }
export interface JealousyPack { jealousySettings?:JealousySettings; jealousyProfiles?:JealousyProfile[] }
export interface JealousyRuntime { characters?:Record<string,{meter:number;stage:'acquaintance'|'dating'|'exclusive';lastTrustHit:number|null}> }
export interface DayRecapSettings { max?:number; keep?:number }
export interface DayRecapPack { dayRecap?:DayRecapSettings }
export interface DayRecap { day:number; weekday:string; date:string|null; lines:string[] }
export interface DayRecapRuntime { days:DayRecap[] }
export interface DayClosedEvent { day:number; weekday:string; date:string|null; lines:string[]; text:string }
export type OutreachKind='check-in'|'plan'|'tease'|'neglected'|'strain';
export interface OutreachReply { id:string; text:string }
export interface OutreachText { id:string; character:string; kind:OutreachKind; text:string; replies:OutreachReply[]; offer?:{location:string;expiresIn:number} }
export interface OutreachSettings { stageChance:Record<'acquaintance'|'dating'|'exclusive',number>; likeScale?:number; maxPerDay?:number; neglectDays?:number; teaseLust?:number; replyLike?:number; replyTrust?:number; replyLikeCap?:number; ignoredLike?:number }
export interface OutreachPack { outreachSettings?:OutreachSettings; outreachMessages?:OutreachText[] }
export interface OutreachState { sent:{day:number;count:number}; contactDay:number|null; ignoredDay:number|null; gained:{day:number;amount:number}|null; lastKind:OutreachKind|null }
export interface OutreachRuntime { characters:Record<string,OutreachState> }
