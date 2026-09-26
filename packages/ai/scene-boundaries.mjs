// Conservative checks for explicit invented entrances. Background mentions remain legal.
export function assertSceneBoundaries(value,context){
 for(const actor of context.absentCharacters||[]){
  const name=actor.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const entrance=new RegExp(`\\b${name}\\s+(?:suddenly\\s+)?(?:appears|arrives|enters|steps in|walks in|peeks in|says|replies|asks|whispers|calls back)\\b`,'iu');
  if(value.lines.some(line=>entrance.test(line.text)))throw Error(`${actor.name} is absent: remove their invented entrance or dialogue`);
 }
}
