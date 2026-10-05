// When the creator republished this playthrough's world, offer to carry on with the fixed version (GET/POST /api/update) instead of starting over.
const shown=new Set();
export async function offerUpdate({api,campaignId,anchor,onUpdated,doc=document}){
 if(!campaignId||!anchor||shown.has(campaignId))return null;shown.add(campaignId);
 let update;try{({update}=await api(`/api/update?id=${encodeURIComponent(campaignId)}`));}catch{return null;}if(!update)return null;
 doc.getElementById('pack-update')?.remove();const box=doc.createElement('aside'),text=doc.createElement('p'),close=doc.createElement('button');box.id='pack-update';box.className='pack-update';box.setAttribute('role','status');
 const changes=update.changes.slice(0,4).join(', ')+(update.changes.length>4?`, +${update.changes.length-4} more`:'');
 text.textContent=update.blocked?`${update.title} was updated, but this game can't switch to it. ${update.blocked}.`:`${update.title} was updated (${changes}). Continue this game with the new version? Your progress is kept and a backup is made first.`;
 close.type='button';close.textContent=update.blocked?'OK':'Not now';close.onclick=()=>box.remove();box.append(text);
 if(!update.blocked){const go=doc.createElement('button');go.type='button';go.textContent='Continue with the update';go.onclick=async()=>{go.disabled=true;try{const data=await api('/api/update',{campaignId,packId:update.packId});box.remove();onUpdated?.(data);}catch(e){text.textContent=e.message;go.disabled=false;}};box.append(go);}
 box.append(close);anchor.before(box);return box;
}
