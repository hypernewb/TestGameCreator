import {assert} from '../core/engine.mjs';
import {unwelcomeStyleOf} from '../core/character-sheet.mjs';
import {changeTrust} from './romance-stats.mjs';
import {addPoints} from './romance-tempo.mjs';

export const UNWELCOME_STYLES=['deflect','tease_back','shut_down'];
export function validateUnwelcome(p){const u=p.unwelcomeFlirt;if(u!==undefined){assert(u&&UNWELCOME_STYLES.every(k=>u[k]&&['like','trust','lust'].every(n=>Number.isInteger(u[k][n])&&Math.abs(u[k][n])<=100)&&u[k].like<=0&&u[k].trust<=0&&u[k].lust>=0),'unwelcome reaction tuning invalid');assert(Number.isInteger(u.tease_back.minTrust)&&u.tease_back.minTrust>=0&&u.tease_back.minTrust<=100,'unwelcome teasing Trust invalid');}for(const s of p.characterSheets||[]){assert(s.behavior?.unwelcomeStyle===undefined||UNWELCOME_STYLES.includes(s.behavior.unwelcomeStyle),'unwelcome style invalid');assert(s.dating?.ladderPace===undefined||['slow','normal','fast'].includes(s.dating.ladderPace),'ladder pace invalid');}}
export function reactUnwelcome(tx,character,reason,sceneId=tx.state.scene?.id||tx.commandId,{capped=false}={}){
 const {state:s,pack:p}=tx,base=unwelcomeStyleOf(p,character);if(!p.unwelcomeFlirt||!base)return null;
 const module=s.modules['social.acts']?.characters?.[character]?'social.acts':'social.touch-ladder',runtime=s.modules[module]?.characters?.[character];if(!runtime)return null;
 const prior=runtime.unwelcome,count=prior?.sceneId===sceneId?prior.count+1:1,style=base==='guarded'?(count>=2?'shut_down':'deflect'):UNWELCOME_STYLES[Math.min(2,UNWELCOME_STYLES.indexOf(base)+count-1)],t=p.unwelcomeFlirt[style],trust=s.modules['social.relationships']?.edges[`${character}--${p.playerId}`]||0;
 tx.set(['modules',module,'characters',character,'unwelcome'],{sceneId,count});
 const likeDelta=s.modules['social.romance-tempo']?.characters?.[character]?addPoints(tx,character,t.like,reason):0,trustDelta=changeTrust(tx,character,t.trust,{quiet:true}),touch=s.modules['social.touch-ladder']?.characters?.[character],old=touch?.lust||0,lust=touch?Math.max(0,Math.min(100,old+(!capped&&(style!=='tease_back'||trust>=t.minTrust)?t.lust:0))):old;
 if(touch&&lust!==old)tx.set(['modules','social.touch-ladder','characters',character,'lust'],lust);
 const data={character,sceneId,style,reason,count,likeDelta,trustDelta,lustDelta:lust-old,text:`${s.actors[character].name} ${style==='deflect'?'deflects':style==='tease_back'?'teases back':'shuts down'} the unwelcome advance.`};tx.emit('social.unwelcomeReaction',data,[p.playerId,character]);return data;
}
