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
export interface Provider { interpret(input:string,context:unknown,actions:Action[],signal?:AbortSignal):Promise<{type:string;args:Record<string,unknown>}>; narrate(context:unknown,signal?:AbortSignal):Promise<string> }
export type ActKind='flirt'|'compliment'|'gift'|'touch'|'insult'|'buy'|'invite'|'tease'|'listen'|'boast'|'pushy';
export interface SceneAct { kind:ActKind; target:string; size?:'small'|'medium'|'large'; landed?:boolean }
export interface ActEntry { id:string; kind:ActKind; target:string; points:number; reason:string; memory?:string; when?:{private:boolean} }
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
export interface SceneFeedbackChip { character:string; stat:string; value:number; delta:number }
export interface SceneFeedbackMood { character:string; name:string; score:number; tier:number; label:string }
export interface SceneFeedback { chips:SceneFeedbackChip[]; moods:SceneFeedbackMood[] }
export interface SocialPacing { flirt?:{mode:'off'|'cap';dailyLimit?:number}; departure?:{enabled:boolean;graceTurns:number} }
export interface FlirtAllowance { day:number;count:number;cued:boolean }
export interface FlirtDeparture { sceneId:string;destination:string|null;remaining:number;origin:string;lastTurn:string }
export interface ActPricedEvent { capped?:boolean }
