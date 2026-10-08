import {parseAction} from '../vendor/venus/sceneActions.mjs';

// A shared location is not the same thing as appearing in the current shot. The engine's committed cast and an
// authored scene's pages/stage directions decide who may be drawn; schedules only prove that drawing them is legal.
export function stageSpeaker(pack,cast,id){return pack.actors.find(actor=>actor.id===id&&(id===pack.playerId||cast.includes(id)));}

export function stageCastIds(state,pack,turn,active,lines=[]){
 const playerLocation=state.actors[pack.playerId].location,ids=new Set();
 if(state.scene?.location===playerLocation)for(const id of state.scene.characters||[])ids.add(id);
 for(const id of turn?.scenePlan?.cast||[])ids.add(id);
 for(const page of [active,...active?.pages||[],...lines].filter(Boolean)){
  if(page.speaker)ids.add(page.speaker);
  for(const raw of page.stage||[]){
   const action=parseAction(raw,(id,ref)=>Boolean(pack.actors.find(actor=>actor.id===id)?.poses?.some(pose=>pose.id===ref)));
   if(action?.charKey)ids.add(action.charKey);
  }
 }
 return [...ids].filter(id=>id!==pack.playerId&&state.actors[id]?.location===playerLocation&&pack.actors.some(actor=>actor.id===id));
}
