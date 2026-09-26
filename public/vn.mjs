import {sceneLines} from '/vendor/venus/sceneText.mjs';
import {parseAction} from '/vendor/venus/sceneActions.mjs';
import {displaySlotsOf} from '/vendor/venus/stageDisplay.mjs';
const $=id=>document.getElementById(id);
export function createVn({onAction,onRetry}){
 let key='',cursor=0,lines=[],data=null;
 const lineAt=()=>lines[Math.min(cursor,lines.length-1)]||{speaker:'',text:''};
 const refresh=()=>{
  if(!data)return;const {pack:p,state:s}=data,turn=Object.values(s.turns).at(-1),vn=data.visualNovel;
  if(!vn){$('vn-phone').hidden=true;$('vn-alert').hidden=true;$('input-form').hidden=false;return;}
  const line=lineAt(),activeScene=p.scriptedScenes?.find(x=>x.id===s.modules['story.scenes']?.pending),active=activeScene?.beats?.find(b=>b.id===s.modules['story.scenes']?.pendingBeat)||activeScene,at=s.actors[p.playerId].location;
  const present=p.actors.filter(a=>a.id!==p.playerId&&s.actors[a.id].location===at),speaker=present.find(a=>a.id===line.speaker);
  const poses={};if(active||lines.some(page=>page.stage?.length||page.background)){const overrides={};for(const raw of [...(active?.stage||[]),...lines.slice(0,cursor+1).flatMap(page=>page.stage||[])]){const action=parseAction(raw,(id,ref)=>Boolean(p.actors.find(a=>a.id===id)?.poses?.some(pose=>pose.id===ref)));if(!action||!present.some(a=>a.id===action.charKey))continue;if(action.kind==='show'||action.kind==='hide')overrides[action.charKey]=action.kind==='show';if(action.kind==='sprite')poses[action.charKey]=action.ref;}
   const slots=displaySlotsOf([...present.slice(0,4).map(a=>a.id),...Array(Math.max(0,4-present.length)).fill(null)],overrides);
   $('sprites').replaceChildren(...slots.map((id,index)=>{const actor=present.find(a=>a.id===id);if(!actor)return null;const image=actor.poses?.find(pose=>pose.id===poses[id])?.image||actor.portrait;if(!image)return null;const figure=document.createElement('div');figure.className='stage-character slot-'+index;figure.dataset.actor=id;const img=document.createElement('img');img.src=image;img.alt=actor.name;figure.append(img);return figure;}).filter(Boolean));
   const bg=[...lines.slice(0,cursor+1)].reverse().find(page=>page.background)?.background||active?.background||p.locations.find(l=>l.id===at)?.background;$('background').src=bg||'assets/missing.png';
  }

  $('vn-dialogue-text').textContent=line.text||p.locations.find(l=>l.id===s.actors[p.playerId].location)?.description||'';
  $('vn-speaker-name').textContent=speaker?.name||'Narration';const speakerImage=speaker?.poses?.find(pose=>pose.id===poses[speaker?.id])?.image||speaker?.portrait;$('vn-speaker-portrait').hidden=!speakerImage;if(speakerImage)$('vn-speaker-portrait').src=speakerImage;
  for(const figure of $('sprites').children)figure.classList.toggle('speaking',Boolean(speaker&&figure.dataset.actor===speaker.id));
  $('vn-progress').textContent=lines.length?`${Math.min(cursor+1,lines.length)} / ${lines.length}`:'';
  const reading=cursor<lines.length-1;$('vn-next').hidden=!reading;$('vn-next').textContent='Continue ▸';
  $('vn-actions').hidden=reading;$('input-form').hidden=reading;$('vn-phone').hidden=reading||!turn?.artifact?.hangouts?.length;
  $('vn-phone').replaceChildren();if(!reading&&turn?.artifact?.hangouts?.length){const title=document.createElement('strong');title.textContent='New messages';$('vn-phone').append(title);for(const h of turn.artifact.hangouts){const card=document.createElement('div');card.className='vn-message';const sender=document.createElement('b');sender.textContent=p.actors.find(a=>a.id===h.char)?.name||h.char;const message=document.createElement('p');message.textContent=h.text;card.append(sender,message);const choice=data.actions.find(a=>a.type==='world.acceptHangout'&&a.args.char===h.char&&a.enabled);if(choice){const button=document.createElement('button');button.type='button';button.textContent=`Meet ${sender.textContent} ↗`;button.onclick=()=>onAction(choice);card.append(button);}$('vn-phone').append(card);}}
  $('vn-alert').replaceChildren();$('vn-alert').hidden=!turn?.fallback;if(turn?.fallback){const label=document.createElement('span');label.textContent=`AI writing failed: ${turn.failureReason||'No details returned'}. Your action was saved.`;$('vn-alert').append(label);const retry=document.createElement('button');retry.type='button';retry.textContent='Retry writing';retry.onclick=()=>onRetry(turn.id);$('vn-alert').append(retry);}
 };
 function render(next){data=next;const {state:s,pack:p}=next,turn=Object.values(s.turns).at(-1),activeScene=p.scriptedScenes?.find(x=>x.id===s.modules['story.scenes']?.pending),active=activeScene?.beats?.find(b=>b.id===s.modules['story.scenes']?.pendingBeat)||activeScene;const nextKey=`${s.campaignId}:${turn?.id||'start'}:${turn?.narrative||''}:${activeScene?.id||''}:${s.modules['story.scenes']?.pendingBeat||''}`;if(key!==nextKey){key=nextKey;cursor=0;lines=active?[{speaker:'',text:active.opening,stage:[]},...active.pages||[]]:turn?.sceneLines?.length?turn.sceneLines:turn?.narrative?sceneLines(turn.narrative,p,turn.command.args?.target||turn.command.args?.char):[];}refresh();}
 function advance(){if(!data||!data.visualNovel)return;if(cursor<lines.length-1){cursor++;refresh();}}
 $('vn-next').onclick=advance;$('vn-dialogue').onclick=e=>{if(e.target.closest('button'))return;advance();};$('vn-dialogue').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();advance();}};
 document.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat&&!e.target.closest('input,textarea,button,dialog,[contenteditable]')&&data?.visualNovel){e.preventDefault();advance();}});
 return {render,advance};
}
