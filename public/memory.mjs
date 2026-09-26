const $=id=>document.getElementById(id);
const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};

export function createMemoryManager({api,getCampaign,onChanged,onError}){
 const dialog=$('memory-dialog'),list=$('memory-list'),results=$('memory-search');let snapshot=null,queryTimer=null;
 async function refresh(){const campaign=getCampaign();if(!campaign)return; snapshot=await api('/api/facts?id='+encodeURIComponent(campaign));list.replaceChildren();
  if(!snapshot.facts.length)list.append(el('p','No generated facts have been recorded yet. Play a scene with local AI, then return here.'));
  for(const fact of [...snapshot.facts].reverse()){
   const edit=[...snapshot.edits].reverse().find(x=>x.factId===fact.id),card=el('article');card.className='memory-card';
   const title=el('strong',`${fact.subject} · ${edit?.action==='retire'?'Retired':edit?.action==='merge'?'Merged':edit?.action==='correct'?'Corrected':'Active'}`);
   const body=el('p',edit?.action==='correct'?edit.text:fact.text),source=el('small',`Source: ${fact.source} · “${fact.quote}”`);
   card.append(title,body,source);
   const editor=el('div');editor.className='memory-edit';const input=el('input');input.value=edit?.action==='correct'?edit.text:fact.text;input.maxLength=220;input.setAttribute('aria-label',`Correction for ${fact.id}`);
   const save=el('button','Save correction'),retire=el('button',edit?.action==='retire'||edit?.action==='merge'?'Restore original':'Retire');
   save.onclick=()=>change(fact,'correct',input.value);retire.onclick=()=>change(fact,edit?.action==='retire'||edit?.action==='merge'?'correct':'retire',fact.text);
   editor.append(input,save,retire);card.append(editor);list.append(card);
   const related=snapshot.facts.filter(other=>other.id!==fact.id&&other.subject===fact.subject);if(related.length){const mergeRow=el('div');mergeRow.className='memory-edit';const select=el('select');select.setAttribute('aria-label',`Merge ${fact.id} into`);for(const other of related){const option=el('option',other.text);option.value=other.id;select.append(option);}const merge=el('button','Merge into selected fact');merge.onclick=()=>change(fact,'merge',null,select.value);mergeRow.append(select,merge);card.append(mergeRow);}
  }
  await preview();
 }
 async function change(fact,action,value,targetId){try{const campaign=getCampaign();await api('/api/facts/edit',{campaignId:campaign,factId:fact.id,action,...(action==='correct'?{text:value}:{}),...(action==='merge'?{targetId}:{}),expectedCount:snapshot.count});await onChanged();await refresh();}catch(error){onError(error);}}
 async function preview(){const campaign=getCampaign();if(!campaign||!dialog.open)return;try{const data=await api('/api/facts/search',{campaignId:campaign,query:$('memory-query').value});results.replaceChildren(el('strong',`Prompt preview · ${data.selected.length} selected`));for(const fact of data.selected)results.append(el('p',`${fact.subject}: ${fact.text} (${fact.reason})`));if(data.omitted.length)results.append(el('small',`${data.omitted.length} facts omitted by budget.`));}catch(error){onError(error);}}
 $('memory-manager').onclick=async()=>{if(!getCampaign())return onError(Error('Open a campaign first.'));dialog.showModal();try{await refresh();}catch(error){onError(error);dialog.close();}};
 $('memory-close').onclick=()=>dialog.close();$('memory-query').oninput=()=>{clearTimeout(queryTimer);queryTimer=setTimeout(preview,250);};
 return {refresh};
}
