export function conversationSuggestionView(state,pack,actions){
 const active=state.scene?.characters||[],lastSpeaker=Object.values(state.turns||{}).at(-1)?.sceneLines?.findLast?.(line=>line.speaker)?.speaker,actor=pack.actors.find(entry=>entry.id===lastSpeaker&&active.includes(entry.id))||pack.actors.find(entry=>active.includes(entry.id));
 if(!actor)return {prompts:[],controls:actions};
 const authored=actor.conversationStarters||[],prompts=(authored.length?authored:['How are you feeling about today?','Is there anything I can help with?','What would you like to do next?']).slice(0,4);
 const controls=actions.filter(action=>['core.endScene','core.move','story.choose','story.leave','social.withdrawConsent'].includes(action.type));
 return {character:actor.name,prompts,controls};
}
