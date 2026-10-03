export function relationshipStageOf(c,a,trust=c.actor?.id===a.id?c.actor.relationshipToPlayer:null){
 const d=(c.dating||[]).find(x=>x.character===a.id);if(d?.strained&&!['rejected','broken'].includes(d.phase))return 'strained';if(d&&d.phase!=='available')return d.phase;
 if(trust==null)return '';return trust>=75?'close':trust>=40?'friend':trust<5&&!(c.memories||[]).length&&!(c.pastScenes||[]).length?'stranger':'familiar';
}
export function behaviorCueOf(a,stage){const keys={stranger:'withStrangers',friend:'withFriends',close:'withFriends',crush:'withCrush',dating:'withLover',exclusive:'withLover'},key=Object.hasOwn(keys,stage)?keys[stage]:null,text=key&&a.behavior?.[key];return typeof text==='string'&&text.trim()?text.trim():'';}
