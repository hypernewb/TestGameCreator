// Art and scene coverage for the Studio: which sex scenes exist, which have a scene image and how many beats have one.
const has=v=>typeof v==='string'&&v.trim().length>0;
export function sceneCoverage(pack){
 const rows=[];
 for(const a of pack?.actors||[]){const sex=a?.id&&pack.modules?.['social.intimacy']?(pack.intimacyProfiles||[]).find(x=>x.character===a.id):null;if(!sex)continue;
  for(const s of sex.scenes||[]){const beats=s.beats||[],withCg=beats.filter(b=>has(b.cg)).length;rows.push({character:a.id,name:a.name||a.id,category:s.category,scene:has(s.cg),beats:beats.length,beatsWithCg:withCg,complete:has(s.cg)&&beats.every(b=>has(b.cg))});}}
 const summary={scenes:rows.length,withSceneCg:rows.filter(r=>r.scene).length,beats:rows.reduce((n,r)=>n+r.beats,0),beatsWithCg:rows.reduce((n,r)=>n+r.beatsWithCg,0),complete:rows.filter(r=>r.complete).length};
 return {rows,summary};
}
