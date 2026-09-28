// One authoritative interpretation of the committed turn's scene location and cast.
// Consumers must not reconstruct cast membership from command shape independently.
export function scenePlanForTurn(world,pack,turn){
 const sceneEvent=turn.events.find(e=>e.type==='core.sceneStarted'||e.type==='core.sceneContinued');
 const hangout=turn.events.find(e=>e.type==='world.hangoutStarted');
 let cast=[],location=world.actors[pack.playerId].location,source='solo';
 if(sceneEvent){cast=sceneEvent.payload.characters||[];location=sceneEvent.payload.location||location;source=sceneEvent.type;}
 else if(hangout){cast=hangout.payload.char?[hangout.payload.char]:[];location=hangout.payload.location||location;source=hangout.type;}
 else if(turn.command.type==='social.speak'){
  const id=turn.command.args.target;if(world.actors[id]?.location===location)cast=[id];source='social.spoke';
 }
 cast=[...new Set(cast)].filter(id=>id!==pack.playerId&&world.actors[id]?.location===location&&pack.actors.some(a=>a.id===id));
 // The speaker slate is the only set of IDs that may voice a line this beat; narration stays unattributed.
 return {cast,speakers:[...cast],location,source,actor:cast[0]||pack.playerId,sceneId:world.scene?.id||null,started:Boolean(sceneEvent||hangout),continuing:sceneEvent?.type==='core.sceneContinued'};
}
