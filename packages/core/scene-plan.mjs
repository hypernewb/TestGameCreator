// One authoritative interpretation of the committed turn's scene location and cast.
// Consumers must not reconstruct cast membership from command shape independently.
export function scenePlanForTurn(world,pack,turn){
 const sceneEvent=turn.events.find(e=>e.type==='core.sceneStarted'||e.type==='core.sceneContinued');
 const hangout=turn.events.find(e=>e.type==='world.hangoutStarted');
  const first=turn.events.find(e=>e.type==='social.firstStarted');
 let cast=[],location=world.actors[pack.playerId].location,source='solo';
 if(sceneEvent){cast=sceneEvent.payload.characters||[];location=sceneEvent.payload.location||location;source=sceneEvent.type;}
 else if(hangout){cast=hangout.payload.char?[hangout.payload.char]:[];location=hangout.payload.location||location;source=hangout.type;}
  else if(first){cast=[first.payload.character];source=first.type;}
 else if(turn.command.type==='social.speak'){
  const id=turn.command.args.target;if(world.actors[id]?.location===location)cast=[id];source='social.spoke';
 }
 // A turn that opened no scene (a refused move) still plays out with whoever the player was already with.
 else if(world.scene?.location===location&&world.scene.characters?.length){cast=world.scene.characters;source='scene';}
 // A drop-in encounter this turn comes over, so it joins the cast instead of standing as a silent bystander.
 cast=[...cast,...turn.events.filter(e=>e.type==='world.moment'&&e.payload.kind==='encounter').map(e=>e.payload.character)];
 // So do the people a director incident brings in (story.sceneStarted cast).
 cast=[...cast,...turn.events.filter(e=>e.type==='story.sceneStarted').flatMap(e=>e.payload.cast||[])];
 cast=[...new Set(cast)].filter(id=>id!==pack.playerId&&(world.actors[id]?.location===location||sceneEvent?.payload.byPhone&&world.actors[id])&&pack.actors.some(a=>a.id===id));
 // The speaker slate is the only set of IDs that may voice a line this beat; narration stays unattributed.
 return {cast,speakers:[...cast],location,source,actor:cast[0]||pack.playerId,sceneId:world.scene?.id||null,started:Boolean(sceneEvent||hangout),continuing:sceneEvent?.type==='core.sceneContinued'};
}
