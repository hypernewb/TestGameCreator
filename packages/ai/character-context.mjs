export function relationshipStageOf(c,a,trust=c.actor?.id===a.id?c.actor.relationshipToPlayer:null){
 const d=(c.dating||[]).find(x=>x.character===a.id);if(d?.strained&&!['rejected','broken'].includes(d.phase))return 'strained';if(d&&d.phase!=='available')return d.phase;
 if(trust==null)return '';return trust>=75?'close':trust>=40?'friend':trust<5&&!(c.memories||[]).length&&!(c.pastScenes||[]).length?'stranger':'familiar';
}
export function behaviorCueOf(a,stage){const keys={stranger:'withStrangers',friend:'withFriends',close:'withFriends',crush:'withCrush',dating:'withLover',exclusive:'withLover'},key=Object.hasOwn(keys,stage)?keys[stage]:null,text=key&&a.behavior?.[key];return typeof text==='string'&&text.trim()?text.trim():'';}
export const speechOf=(pack,id)=>pack.characterSheets?.find(s=>s.actorId===id)?.speech;
export function speechLine(pack,id){const s=speechOf(pack,id);return s?['Speech:',s.tics?.length&&`tics: ${s.tics.slice(0,2).join('; ')}`,s.fillers?.length&&`fillers: ${s.fillers.slice(0,2).join('; ')}`,s.rhythm&&`rhythm: ${s.rhythm}`,s.petPhrases?.length&&`pet phrase: ${s.petPhrases[0]}`,s.avoid?.length&&`avoid: ${s.avoid.join('; ')}`,s.sample&&`sample: ${s.sample}`].filter(Boolean).join(' '):'';}
